import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { build } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const temp = await mkdtemp(path.join(os.tmpdir(), 'ncf-chatgpt-setup-ui-'));
let browser;
try {
  await symlink(path.join(root, 'node_modules'), path.join(temp, 'node_modules'), 'junction');
  await writeFile(
    path.join(temp, 'fixture.tsx'),
    `
import React, {useSyncExternalStore} from 'react';
import { createRoot } from 'react-dom/client';
import { ApplicationRows, ApplicationSetup } from ${JSON.stringify(path.join(root, 'desktop/renderer/ApplicationSetup.tsx'))};
import { OverviewApplications } from ${JSON.stringify(path.join(root, 'desktop/renderer/OverviewApplications.tsx'))};
import { McpSetup, CodexSetupDialog } from ${JSON.stringify(path.join(root, 'desktop/renderer/McpSetup.tsx'))};
import { mcpSetupEnglish } from ${JSON.stringify(path.join(root, 'desktop/renderer/mcp-setup-messages.ts'))};
import { ApplicationSetupFlow } from ${JSON.stringify(path.join(root, 'desktop/renderer/application-setup-model.ts'))};
const surface = new URLSearchParams(location.search).get('surface');
const calls = [];
window.fixture = { calls };
const target = {id: 'configuration', path: '/fixture/work/config.toml'};
const configured = ['session-delivery','manual-choice'].includes(surface) ? 'configured' : 'not-configured';
const status = {client:'codex', remembered:configured === 'configured', state:configured, files:[{...target,state:configured}]};
const preview = {client:'codex',planId:'fixture-plan',requiresReplacement:false,
  files:[{...target,action:'update',changes:[]}]};
const first = {profile:'/fixture/work', scope:'user', requiresClosedChatGPT:true};
let enabled = false;
const deliveryResults = [
  'throw', {state:'ready',...first}, {state:'close-required'}, {state:'enabled',...first},
  {state:'unavailable'}, 'throw', {state:'conflict'}, {state:'enabled',...first}, {state:'ready',...first},
];
const invoke = async (method, params) => {
  calls.push({method,params});
  if (method === 'desktopSessionDelivery') {
    if (['quick','manual-offer','manual-choice'].includes(surface)) {
      if (surface === 'manual-offer' && status.state !== 'configured') return {state:'configuration-required'};
      if(params.action==='enable') enabled=true;
      return {...first, profile:status.files[0].path.replace('/config.toml',''), state:enabled?'enabled':'ready'};
    }
    if (surface !== 'session-delivery') return {state:'unsupported'};
    const result = deliveryResults.shift();
    if (result === 'throw' || !result) throw new Error('Test failure');
    return result;
  }
  if (method === 'mcpSetupStatus') return status;
  if (method === 'mcpSetupDefaults') return {client:'codex',files:[{...target,format:'toml',alternatives:[target.path]}]};
  if (method === 'mcpSetupDiscard') return {};
  if (method === 'mcpSetupPreview') return {...preview,files:[{...preview.files[0],path:params.files[0].path}]};
  if (method === 'codexSetupPrepare' && surface === 'manual-failed') throw new Error('Fixture setup failure');
  if (method === 'codexSetupPrepare') return preview;
  if (method === 'mcpSetupApply') {
    const prepared=calls.filter(c=>c.method==='mcpSetupPreview').at(-1);
    status.files[0].path=prepared?.params.files[0].path ?? target.path;
    status.remembered=true;status.state='configured';
    return {status:'applied',files:[{path:status.files[0].path,status:'updated'}]};
  }
  throw new Error('Unexpected setup operation: ' + method);
};
const flow = new ApplicationSetupFlow(invoke);
const props = {flow, invoke, locale:'en', snapshot:{adapters:[],agents:[]},
  statuses:{statuses:{codex:status},errors:{},refreshAll:async()=>{}},
  discovery:{busy:false,failed:false,offers:['codex'],snapshot:{applications:[{client:'codex',status:'detected'}],offers:['codex']},refresh:async()=>{},acknowledge:async()=>{}},
  onManualSetup:()=>{}};
if (surface === 'manual-undetected') props.discovery.snapshot.applications=[];
function Fixture() {
  const states = useSyncExternalStore(flow.subscribe,flow.getSnapshot);
  if (surface === 'overview') return <OverviewApplications {...props} states={states}/>;
  if (surface === 'startup') return <ApplicationSetup {...props} startup={{open:true, clients:['codex'],close:()=>{}}}/>;
  if (['manual-choice','manual-before','manual-failed','manual-undetected'].includes(surface)) return <McpSetup client="codex" onClientChange={()=>{}} invoke={invoke} discovery={props.discovery} setupFlow={flow} setupStatuses={props.statuses}/>;
  if (['manual','manual-offer','session-delivery'].includes(surface)) return <CodexSetupDialog invoke={invoke} inline messages={mcpSetupEnglish}/>;
  return <ApplicationRows {...props}/>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
`,
  );
  const built = await build({
    configFile: false,
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    root: temp,
    cacheDir: path.join(temp, 'cache'),
    plugins: [react()],
    logLevel: 'error',
    build: {
      write: false,
      lib: { entry: path.join(temp, 'fixture.tsx'), formats: ['es'], fileName: 'fixture' },
    },
  });
  const outputs = (Array.isArray(built) ? built : [built]).flatMap((item) => item.output);
  const entry = outputs.find((item) => item.type === 'chunk' && item.isEntry);
  assert.ok(entry);
  browser = await chromium.launch({ channel: 'chrome', headless: true, chromiumSandbox: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 840 } });
  page.setDefaultTimeout(8000);
  page.on('pageerror', (error) => process.stderr.write(error.message + '\n'));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://ncf-setup.test') return route.abort();
    if (url.pathname === '/')
      return route.fulfill({
        contentType: 'text/html',
        body: `<div id="root"></div><script type="module" src="/${entry.fileName}"></script>`,
      });
    const file = outputs.find((item) => '/' + item.fileName === url.pathname);
    if (!file) return route.abort();
    return route.fulfill({
      contentType: file.type === 'chunk' ? 'text/javascript' : 'application/octet-stream',
      body: file.type === 'chunk' ? file.code : Buffer.from(file.source),
    });
  });

  for (const surface of ['applications', 'overview', 'startup', 'manual']) {
    await page.goto('http://ncf-setup.test/?surface=' + surface);
    const action =
      surface === 'overview'
        ? page.getByTestId('overview-application-codex').getByRole('button')
        : page.getByTestId(
            {
              applications: 'application-connect-codex',
              startup: 'startup-connect-codex',
              manual: 'mcp-apply',
            }[surface],
          );
    await action.waitFor();
    if (surface === 'manual')
      assert.equal(await page.getByRole('switch', { name: 'Background chat delivery' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /shortcut/i }).count(), 0);
    assert.equal(
      await page.evaluate(() => window.fixture.calls.some((c) => c.method === 'mcpSetupApply')),
      false,
    );
    await action.click();
    await page.waitForFunction(() =>
      window.fixture.calls.some((c) => c.method === 'mcpSetupApply'),
    );
    const calls = await page.evaluate(() => window.fixture.calls);
    assert.deepEqual(
      calls.filter((c) => c.method === 'mcpSetupApply').map((c) => c.params),
      [{ planId: 'fixture-plan', confirmReplace: false }],
    );
    assert.equal(
      calls.filter((c) => c.method === 'codexSetupPrepare').length,
      surface === 'manual' ? 0 : 1,
    );
    assert.ok(calls.every((c) => !/shortcut/i.test(c.method)));
    assert.equal(await page.getByText(/create.*shortcut/i).count(), 0);
  }
  for (const surface of ['manual-before', 'manual-failed', 'manual-undetected']) {
    await page.goto('http://ncf-setup.test/?surface=' + surface);
    const row = page.getByTestId('application-row-codex');
    if (surface === 'manual-failed') {
      await row.getByTestId('application-connect-codex').click();
      await row.getByRole('alert').waitFor();
    }
    const manual = row.getByRole('button', { name: 'Manual setup', exact: true });
    await manual.waitFor({ state: 'visible' });
    await manual.locator('svg').waitFor({ state: 'visible' });
    await manual.click();
    await page.getByTestId('mcp-path-configuration').waitFor();
    assert.equal(
      await page.evaluate(() => window.fixture.calls.some((c) => c.method === 'mcpSetupApply')),
      false,
    );
  }
  const background = page.getByRole('switch', { name: 'Background chat delivery' });
  for (const surface of ['quick', 'manual-offer', 'manual-choice']) {
    await page.goto('http://ncf-setup.test/?surface=' + surface);
    if (surface === 'manual-choice') {
      await page
        .getByTestId('application-row-codex')
        .getByRole('button', { name: 'Manual setup', exact: true })
        .click();
      const field = page.getByTestId('mcp-path-configuration');
      await field.fill('/fixture/home/config.toml');
      await page.getByRole('button', { name: 'Back', exact: false }).click();
    }
    if (surface === 'manual-offer') {
      await background.check();
      assert.equal(
        await page.evaluate(() =>
          window.fixture.calls.some(
            (c) => c.method === 'desktopSessionDelivery' && c.params.action === 'enable',
          ),
        ),
        false,
      );
      await page.getByTestId('mcp-apply').click();
    } else {
      assert.equal(await background.count(), 0);
      await page.getByTestId('application-connect-codex').click();
    }
    await page.waitForFunction(() =>
      window.fixture.calls.some(
        (c) => c.method === 'desktopSessionDelivery' && c.params.action === 'enable',
      ),
    );
    const steps = await page.evaluate(() =>
      window.fixture.calls.filter(
        (c) =>
          c.method === 'mcpSetupApply' ||
          (c.method === 'desktopSessionDelivery' && c.params.action === 'enable'),
      ),
    );
    assert.deepEqual(
      steps.map((c) => c.method),
      ['mcpSetupApply', 'desktopSessionDelivery'],
    );
    assert.equal(
      steps[1].params.profile,
      surface === 'manual-choice' ? '/fixture/home' : '/fixture/work',
    );
    assert.equal(await page.getByText('Setup details', { exact: true }).count(), 0);
  }
  await page.goto('http://ncf-setup.test/?surface=session-delivery');
  const control = page.getByRole('switch', { name: 'Background chat delivery' });
  const recheck = page.getByRole('button', { name: 'Check status' });
  const closeText = page.getByText(
    'Quit ChatGPT completely before changing this setting. Reopen it afterwards.',
  );
  const deliveryCalls = () =>
    page.evaluate(() =>
      window.fixture.calls
        .filter((call) => call.method === 'desktopSessionDelivery')
        .map((call) => call.params),
    );
  await recheck.click();
  await closeText.waitFor();
  await control.click();
  await page.getByRole('alert').filter({ hasText: 'Quit ChatGPT completely' }).waitFor();
  assert.equal(await control.isChecked(), false);
  await control.check();
  await control.click();
  await recheck.waitFor();
  assert.equal(await control.isChecked(), true);
  assert.equal(await control.isDisabled(), true);
  await page.getByText('/fixture/work', { exact: true }).waitFor();
  await recheck.click();
  await recheck.click();
  await page.getByRole('alert').filter({ hasText: 'different server' }).waitFor();
  assert.equal(await control.isDisabled(), true);
  await recheck.click();
  await page.getByText('/fixture/work', { exact: true }).waitFor();
  await control.uncheck();
  assert.deepEqual(await deliveryCalls(), [
    { action: 'status' },
    { action: 'status' },
    { action: 'enable', profile: '/fixture/work' },
    { action: 'enable', profile: '/fixture/work' },
    { action: 'disable', profile: '/fixture/work' },
    { action: 'status' },
    { action: 'status' },
    { action: 'status' },
    { action: 'disable', profile: '/fixture/work' },
  ]);
  process.stdout.write(
    'ChatGPT setup passed through Applications, Overview, Startup and Manual setup.\n',
  );
} finally {
  await browser?.close();
  await rm(temp, { recursive: true, force: true });
}

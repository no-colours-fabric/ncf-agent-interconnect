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
import { ThemeProvider } from '@mui/material';
import { ApplicationRows, ApplicationSetup, ApplicationSetupConfirmation } from ${JSON.stringify(path.join(root, 'desktop/renderer/ApplicationSetup.tsx'))};
import { OverviewApplications } from ${JSON.stringify(path.join(root, 'desktop/renderer/OverviewApplications.tsx'))};
import { McpSetup, CodexSetupDialog } from ${JSON.stringify(path.join(root, 'desktop/renderer/McpSetup.tsx'))};
import { mcpSetupEnglish } from ${JSON.stringify(path.join(root, 'desktop/renderer/mcp-setup-messages.ts'))};
import { ApplicationSetupFlow } from ${JSON.stringify(path.join(root, 'desktop/renderer/application-setup-model.ts'))};
import { createAppTheme } from ${JSON.stringify(path.join(root, 'desktop/renderer/theme.ts'))};
import { useApplicationDiscovery } from ${JSON.stringify(path.join(root, 'desktop/renderer/useApplicationDiscovery.ts'))};
const query = new URLSearchParams(location.search);
const surface = query.get('surface');
const sharedDelivery = surface === 'delivery-sync';
const requiredDelivery = surface === 'delivery-required';
const windowsDelivery = query.get('platform') === 'win32';
const calls = [];
window.fixture = { calls };
const restartFixture = surface?.startsWith('restart-');
const profileTargets = ['/fixture/Home/config.toml', '/fixture/Work/config.toml'];
const target = {id: 'configuration', path: '/fixture/work/config.toml'};
const configured = ['session-delivery','manual-choice','delivery-sync'].includes(surface) ? 'configured' : 'not-configured';
const status = {client:'codex', remembered:configured === 'configured', state:configured, files:[{...target,state:configured}]};
if (sharedDelivery) status.codexConnectRequired = true;
const preview = {client:'codex',planId:'fixture-plan',requiresReplacement:surface==='restart-replacement-cancel',
  files:[{...target,action:'update',changes:[]}]};
const first = {profile:'/fixture/work', scope:'user', requiresClosedChatGPT:true};
let enabled = query.get('state') === 'enabled';
let guiRunning = query.get('gui') === 'open';
window.fixture.setGuiRunning = (value) => { guiRunning=value; };
const deliveryResults = [
  'throw', {state:'ready',...first}, {state:'close-required'}, {state:'enabled',...first},
  {state:'unavailable'}, 'throw', {state:'conflict'}, {state:'enabled',...first}, {state:'ready',...first},
];
const invoke = async (method, params) => {
  calls.push({method,params});
  if (method === 'applicationDiscovery' || method === 'applicationDiscoveryRefresh')
    return structuredClone(props.discovery.snapshot);
  if (method === 'desktopSessionDelivery') {
    if (restartFixture) {
      const profile=status.files[0].path.replace('/config.toml','');
      if (surface==='restart-unsupported') return {state:'unsupported'};
      if (surface==='restart-refused') return {state:'close-required'};
      if (params.action==='enable') enabled=true;
      return {...first, profile, state:enabled||surface==='restart-noop'?'enabled':'ready',
        restartRequired: surface === 'restart-backend' && params.action==='enable'};
    }
    if (sharedDelivery || requiredDelivery) {
      if (query.get('state') === 'unavailable') return {state:'unavailable'};
      if (status.state !== 'configured') return {state:'configuration-required'};
      if (windowsDelivery && guiRunning && params.action !== 'status') return {state:'close-required'};
      if (params.action==='enable') enabled=true;
      if (params.action==='disable') {
        if (query.get('delay') === 'true') await new Promise((resolve) => {
          window.fixture.finishDisable = resolve;
        });
        enabled=false;
      }
      return {...first, state:enabled?'enabled':'ready',
        restartRequired: query.get('restart') === 'required' && params.action !== 'status'};

    }
    if (['applications','overview','startup','quick','manual-offer','manual-choice'].includes(surface)) {
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
  if (method === 'codexSetupPrepare') {
    if (surface === 'manual-failed') throw new Error('Fixture setup failure');
    if (surface === 'restart-profile' && !params.configuration) return {configurations:profileTargets};
    return {...preview,files:[{...preview.files[0],path:params.configuration ?? target.path}]};
  }
  if (method === 'mcpSetupApply') {
    if (surface==='restart-failed') return {status:'failed',files:[]};
    const prepared=calls.filter(c=>c.method==='mcpSetupPreview').at(-1);
    const choice=calls.filter(c=>c.method==='codexSetupPrepare').at(-1)?.params?.configuration;
    status.files[0].path=prepared?.params.files[0].path ?? choice ?? target.path;
    status.remembered=true;status.state='configured';
    const unchanged = surface === 'restart-noop' || surface === 'restart-backend';
    return {status:unchanged?'unchanged':'applied',files:[{path:status.files[0].path,status:'updated'}]};
  }
  throw new Error('Unexpected setup operation: ' + method);
};
const flow = new ApplicationSetupFlow(invoke);
window.fixture.snapshot=flow.getSnapshot;
const cursor={client:'cursor',state:'missing',remembered:false,files:[]};
const bound = sharedDelivery ? {
  adapters:[{id:'fixture-adapter',kind:'codex-desktop',state:'ready',error:null,
    capabilities:{wakeIdle:true,exactSession:true},lastOwnerVerifiedAt:'2026-11-22T00:00:00.000Z'}],
  agents:[{key:'fixture-agent',nickname:'Fixture',unread:0,binding:{adapterId:'fixture-adapter'}}],
} : {adapters:[],agents:[]};
const props = {flow, invoke, locale:'en', snapshot:bound,
  statuses:{statuses:{codex:status,...(restartFixture?{cursor}:{})},errors:{},refreshAll:async()=>{}},
  discovery:{busy:false,failed:false,offers:['codex'],snapshot:{
    platform:windowsDelivery||['restart-unsupported','restart-backend'].includes(surface)?'win32':'darwin',
    applications:[{client:'codex',status:'detected'},...(restartFixture?[{client:'cursor',status:'detected'}]:[])],
    chatgptCompatibility:{status:'unknown',version:
      surface==='restart-profile'||sharedDelivery||requiredDelivery
        ? query.get('version') === 'unknown' ? undefined : query.get('version') ?? '26.1120.50957'
        : '26.1111.71704'},
    offers:['codex']},refresh:async()=>{},acknowledge:async()=>{}},
  onManualSetup:()=>{}};
if (surface === 'manual-undetected' || query.get('detected') === 'false')
  props.discovery.snapshot.applications=[];
window.fixture.setVersion = (version) => {
  props.discovery.snapshot.chatgptCompatibility = {status:'unknown',version};
};
window.interconnect = {
  onApplicationDiscoveryChange: (callback) => {
    window.fixture.publishVersion=callback;
    return () => { delete window.fixture.publishVersion; };
  },
};
function LiveDeliveryFixture() {
  const discovery = useApplicationDiscovery(invoke);
  return <Fixture discovery={discovery}/>;
}
function Fixture({discovery=props.discovery}) {
  const states = useSyncExternalStore(flow.subscribe,flow.getSnapshot);
  const confirm = <ApplicationSetupConfirmation flow={flow} locale="en"/>;
  const overview = <OverviewApplications {...props} discovery={discovery} states={states}/>;
  const applications = <McpSetup client="codex" onClientChange={()=>{}} invoke={invoke} discovery={discovery} setupFlow={flow} setupStatuses={props.statuses} snapshot={props.snapshot}/>;
  if (sharedDelivery || requiredDelivery) return <><section data-testid="delivery-overview">{overview}</section>
    <section data-testid="delivery-applications">{applications}</section>{confirm}</>;
  if (surface === 'overview') return <>{overview}{confirm}</>;
  if (surface === 'startup') return <ApplicationSetup {...props} startup={{open:true, clients:['codex'],close:()=>{}}}/>;
  if (['manual-choice','manual-before','manual-failed','manual-undetected','restart-quick'].includes(surface)) return <>{applications}{confirm}</>;
  if (['manual','manual-offer','session-delivery'].includes(surface)) return <CodexSetupDialog invoke={invoke} inline messages={mcpSetupEnglish}/>;
  return <><ApplicationRows {...props}/>{confirm}</>;
}
createRoot(document.getElementById('root')).render(restartFixture || sharedDelivery || requiredDelivery ?
  <ThemeProvider theme={createAppTheme('light')}>{sharedDelivery?<LiveDeliveryFixture/>:<Fixture/>}</ThemeProvider> : <Fixture/>);
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
    if (surface !== 'manual') {
      const restartDialog = page.getByRole('dialog', { name: 'Restart ChatGPT' });
      await restartDialog.getByRole('button', { name: 'Got it' }).click();
      await restartDialog.waitFor({ state: 'hidden' });
    }
    const calls = await page.evaluate(() => window.fixture.calls);
    assert.deepEqual(
      calls.filter((c) => c.method === 'mcpSetupApply').map((c) => c.params),
      [{ planId: 'fixture-plan', confirmReplace: false }],
    );
    assert.equal(
      calls.filter((c) => c.method === 'codexSetupPrepare').length,
      surface === 'manual' ? 0 : 1,
    );
    assert.deepEqual(
      calls
        .filter(
          (call) => call.method === 'desktopSessionDelivery' && call.params.action === 'enable',
        )
        .map((call) => call.params.profile),
      surface === 'manual' ? [] : ['/fixture/work'],
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
      assert.equal(
        await page.evaluate(() =>
          window.fixture.calls.some(
            (c) => c.method === 'desktopSessionDelivery' && c.params.action === 'enable',
          ),
        ),
        false,
      );
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
  const restart = page.getByRole('dialog', { name: 'Restart ChatGPT' });
  const restartAction = page.getByTestId('application-connect-codex');
  const openRestartFixture = async (scenario) => {
    await page.goto('http://ncf-setup.test/?surface=restart-' + scenario);
    await restartAction.waitFor();
    assert.equal(await restart.count(), 0);
  };
  for (const width of [640, 1280]) {
    await page.setViewportSize({ width, height: 840 });
    await openRestartFixture('quick');
    const commonGeometry = (client) =>
      page.getByTestId('application-row-' + client).evaluate((row) => {
        const header = row.firstElementChild;
        const image = header.querySelector('img');
        const bounds = row.getBoundingClientRect();
        const logo = image.getBoundingClientRect();
        const h = header.getBoundingClientRect();
        const controls = [...header.querySelectorAll('button')].map((button) => {
          const rect = button.getBoundingClientRect();
          return [rect.x - h.x, rect.y - h.y, rect.width, rect.height];
        });
        return {
          controls,
          columns: getComputedStyle(header).gridTemplateColumns,
          logoX: logo.x - bounds.x,
          logoSize: [logo.width, logo.height],
          rowWidth: bounds.width,
          headerWidth: h.width,
          children: row.children.length,
        };
      });
    assert.deepEqual(await commonGeometry('codex'), await commonGeometry('cursor'));
  }
  await restartAction.press('Enter');
  await restart.waitFor();
  const acknowledge = restart.getByRole('button', { name: 'Got it' });
  await restart.getByText('Quit ChatGPT completely and reopen it.', { exact: true }).waitFor();
  assert.equal(await acknowledge.evaluate((button) => document.activeElement === button), true);
  await page.mouse.click(5, 5);
  await page.keyboard.press('Escape');
  assert.equal(await restart.isVisible(), true);
  await acknowledge.press('Enter');
  await restart.waitFor({ state: 'hidden' });
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'ChatGPT',
  );
  assert.equal(
    (await page.evaluate(() => window.fixture.snapshot())).codex.restartNotice,
    undefined,
  );
  assert.equal(await restartAction.count(), 0);
  const manualAfterConnect = page.getByTestId('application-manual-codex');
  await manualAfterConnect.locator('svg').waitFor();
  assert.equal(await manualAfterConnect.isEnabled(), true);
  await manualAfterConnect.press('Enter');
  await page.getByTestId('mcp-path-configuration').waitFor();
  assert.equal(
    await page.evaluate(
      () => window.fixture.calls.filter((call) => call.method === 'mcpSetupApply').length,
    ),
    1,
  );
  assert.equal(await restart.count(), 0);

  await openRestartFixture('profile');
  await page.getByTestId('application-row-codex').getByTestId('chatgpt-delivery-off').waitFor();
  const chooser = page.getByRole('dialog', { name: 'Choose the ChatGPT profile to connect' });
  await restartAction.click();
  await chooser.getByRole('button', { name: 'Home', exact: true }).waitFor();
  await chooser.getByRole('button', { name: 'Cancel', exact: true }).press('Enter');
  await chooser.waitFor({ state: 'hidden' });
  assert.equal(await restart.count(), 0);
  assert.equal(
    await page.evaluate(() => window.fixture.calls.some((call) => call.method === 'mcpSetupApply')),
    false,
  );
  await restartAction.click();
  await chooser.getByRole('button', { name: 'Work', exact: true }).press('Enter');
  await restart.waitFor();
  assert.deepEqual(
    await page.evaluate(() =>
      window.fixture.calls
        .filter(
          (call) => call.method === 'desktopSessionDelivery' && call.params.action === 'enable',
        )
        .map((call) => call.params.profile),
    ),
    ['/fixture/Work'],
  );
  await acknowledge.click();
  await restart.waitFor({ state: 'hidden' });

  await openRestartFixture('backend');
  await restartAction.press('Enter');
  await restart.waitFor();
  await acknowledge.press('Enter');
  await restart.waitFor({ state: 'hidden' });

  await openRestartFixture('replacement-cancel');
  await restartAction.click();
  const replacement = page.getByRole('dialog');
  await replacement.getByRole('button', { name: 'Cancel', exact: true }).press('Enter');
  await replacement.waitFor({ state: 'hidden' });
  assert.equal(await restart.count(), 0);
  assert.equal(
    await page.evaluate(() => window.fixture.calls.some((call) => call.method === 'mcpSetupApply')),
    false,
  );

  for (const scenario of ['failed', 'refused', 'noop', 'unsupported']) {
    await openRestartFixture(scenario);
    await restartAction.click();
    const phase = scenario === 'failed' || scenario === 'refused' ? 'failed' : 'succeeded';
    await page.waitForFunction((phase) => window.fixture.snapshot().codex.phase === phase, phase);
    assert.equal(await restart.count(), 0, scenario);
  }
  const summary = page.getByTestId('delivery-overview');
  const appSettings = page.getByTestId('delivery-applications');
  const warning = 'chatgpt-delivery-off';
  const switchName = { name: 'Background chat delivery' };
  const dialogToggle = appSettings.getByRole('switch', switchName);
  const overviewWarning = summary.getByTestId(warning);
  const appWarning = appSettings.getByTestId(warning);
  const overviewCard = summary.getByTestId('overview-application-codex');
  const queue = page.getByRole('dialog', { name: 'Messages may stay in the queue' });
  const dismissQueue = queue.getByRole('button', { name: 'Got it' });
  const progress = page.getByRole('progressbar', { name: 'Disabling background delivery' });
  const openDelivery = (query = '') =>
    page.goto('http://ncf-setup.test/?surface=delivery-sync' + query);
  for (const width of [560, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await openDelivery();
    for (const area of [overviewWarning, appWarning]) {
      await area.waitFor();
      assert.equal(await area.getByRole('link').count(), 0);
      assert.equal(await area.getByRole('switch', switchName).isEnabled(), true);
      await area.getByText(/Background chat delivery is off/).waitFor();
      assert.equal(
        await area.evaluate((element) => element.scrollWidth > element.clientWidth),
        false,
      );
    }
    assert.equal(await overviewCard.getAttribute('data-connected'), null);
    assert.match(await overviewCard.innerText(), /Configured/);
    assert.equal(await appSettings.getByTestId('application-connect-codex').count(), 0);
    await appSettings
      .getByTestId('application-row-codex')
      .getByTestId('mcp-settings-status')
      .waitFor();
    assert.equal(
      await appWarning.evaluate((element) =>
        Math.round(
          element.getBoundingClientRect().top -
            element.previousElementSibling.getBoundingClientRect().bottom,
        ),
      ),
      12,
    );
  }

  await overviewWarning.getByRole('switch', switchName).press('Space');
  await overviewWarning.waitFor({ state: 'hidden' });
  await appWarning.waitFor({ state: 'hidden' });
  await page.waitForFunction(() =>
    document
      .querySelector('[data-testid="overview-application-codex"]')
      ?.hasAttribute('data-connected'),
  );
  await appSettings.getByTestId('application-manual-codex').press('Enter');
  await dialogToggle.waitFor();
  assert.equal(await dialogToggle.isChecked(), true);
  await dialogToggle.press('Space');
  await queue.waitFor();
  assert.equal(await queue.getByRole('switch').count(), 0);
  assert.equal(await restart.count(), 0);
  await dismissQueue.press('Enter');
  await queue.waitFor({ state: 'hidden' });
  await overviewWarning.waitFor();
  await appSettings.getByRole('button', { name: /Back/ }).click();
  await appWarning.getByRole('switch', switchName).press('Space');
  await overviewWarning.waitFor({ state: 'hidden' });
  await appWarning.waitFor({ state: 'hidden' });
  await appSettings.getByTestId('application-manual-codex').press('Enter');
  await dialogToggle.waitFor();
  assert.equal(await dialogToggle.isChecked(), true);
  assert.deepEqual(
    (await deliveryCalls()).filter(({ action }) => action !== 'status'),
    [
      { action: 'enable', profile: '/fixture/work' },
      { action: 'disable', profile: '/fixture/work' },
      { action: 'enable', profile: '/fixture/work' },
    ],
  );

  await openDelivery('&state=enabled&restart=required&delay=true&gui=open');
  await appSettings.getByTestId('application-manual-codex').press('Enter');
  await dialogToggle.waitFor();
  await dialogToggle.press('Space');
  await appSettings.getByRole('progressbar', { name: 'Disabling background delivery' }).waitFor();
  await progress.first().waitFor();
  assert.equal(await dialogToggle.count(), 0);
  assert.equal(await queue.count(), 0);
  assert.equal(await restart.count(), 0);
  await page.keyboard.press('Space');
  assert.equal((await deliveryCalls()).filter(({ action }) => action === 'disable').length, 1);
  await page.evaluate(() => window.fixture.finishDisable());
  await queue.waitFor();
  assert.equal(await progress.count(), 0);
  assert.equal(await restart.count(), 0);
  assert.equal(await queue.getByRole('switch').count(), 0);
  await dismissQueue.press('Enter');
  await restart.waitFor();
  await overviewWarning.waitFor();
  await acknowledge.press('Enter');
  await restart.waitFor({ state: 'hidden' });
  await page.waitForFunction(() =>
    document.activeElement?.matches('input[data-chatgpt-restart-focus]'),
  );
  await appSettings.getByRole('button', { name: /Back/ }).click();
  await appWarning.waitFor();
  await appWarning.getByRole('switch', switchName).press('Space');
  await restart.waitFor();
  await appWarning.waitFor({ state: 'hidden' });
  await overviewWarning.waitFor({ state: 'hidden' });
  await acknowledge.press('Enter');
  await restart.waitFor({ state: 'hidden' });

  for (const query of [
    '&version=26.1111.71704',
    '&version=26.1111.71703',
    '&detected=false',
    '&state=enabled',
    '&state=unavailable',
  ]) {
    await openDelivery(query);
    await appSettings.getByTestId('application-manual-codex').waitFor();
    assert.equal(await overviewWarning.count(), 0, query);
    assert.equal(await appWarning.count(), 0, query);
  }

  await openDelivery('&version=unknown&gui=closed&platform=win32');
  for (const area of [overviewWarning, appWarning]) {
    await area
      .getByText(
        'If your ChatGPT version is newer than 26.1111.71704, messages may stay in the queue.',
      )
      .waitFor();
    assert.equal(await area.getByRole('switch', switchName).isEnabled(), true);
  }
  await page.evaluate(() => {
    window.fixture.setVersion('26.1111.71704');
    window.fixture.publishVersion();
  });
  await overviewWarning.waitFor({ state: 'hidden' });
  await appWarning.waitFor({ state: 'hidden' });
  await page.evaluate(() => {
    window.fixture.setVersion('26.1120.50957');
    window.dispatchEvent(new Event('focus'));
  });
  await overviewWarning.getByText(/Background chat delivery is off/).waitFor();
  await appWarning.getByText(/Background chat delivery is off/).waitFor();
  await appSettings.getByTestId('application-manual-codex').press('Enter');
  await dialogToggle.press('Space');
  await overviewWarning.waitFor({ state: 'hidden' });
  await appSettings.getByRole('button', { name: /Back/ }).click();
  assert.equal(await appWarning.count(), 0);

  await openDelivery('&platform=win32&gui=open&state=enabled');
  await appSettings.getByTestId('application-manual-codex').press('Enter');
  await dialogToggle.press('Space');
  await appSettings
    .getByRole('alert')
    .getByText(/before changing this setting/)
    .waitFor();
  assert.equal(await dialogToggle.isChecked(), true);
  assert.equal(await queue.count(), 0);
  assert.equal(await restart.count(), 0);
  await page.evaluate(() => window.fixture.setGuiRunning(false));
  await dialogToggle.press('Space');
  await queue.waitFor();
  await dismissQueue.press('Enter');
  await queue.waitFor({ state: 'hidden' });
  assert.equal(await restart.count(), 0);
  await overviewWarning.waitFor();

  await openDelivery('&platform=win32&gui=open');
  await overviewWarning.getByRole('switch', switchName).press('Space');
  await overviewWarning
    .getByRole('alert')
    .getByText(/before changing this setting/)
    .waitFor();
  await appWarning
    .getByRole('alert')
    .getByText(/before changing this setting/)
    .waitFor();
  assert.equal(await overviewWarning.getByRole('switch', switchName).isChecked(), false);
  assert.equal(await queue.count(), 0);
  assert.equal(await restart.count(), 0);

  // With no verified configuration, the warning uses guarded Connect, not a second writer.
  await page.goto('http://ncf-setup.test/?surface=delivery-required');
  await appWarning.getByRole('switch', switchName).press('Space');
  await restart.waitFor();
  await restart.getByRole('button', { name: 'Got it' }).press('Enter');
  await restart.waitFor({ state: 'hidden' });
  assert.deepEqual(
    await page.evaluate(() =>
      window.fixture.calls
        .filter(
          (call) =>
            call.method === 'codexSetupPrepare' ||
            call.method === 'mcpSetupApply' ||
            (call.method === 'desktopSessionDelivery' && call.params.action === 'enable'),
        )
        .map((call) => call.method),
    ),
    ['codexSetupPrepare', 'mcpSetupApply', 'desktopSessionDelivery'],
  );
  await overviewWarning.waitFor({ state: 'hidden' });
  await appWarning.waitFor({ state: 'hidden' });
  process.stdout.write(
    'ChatGPT setup passed through Applications, Overview, Startup and Manual setup.\n',
  );
} finally {
  await browser?.close();
  await rm(temp, { recursive: true, force: true });
}

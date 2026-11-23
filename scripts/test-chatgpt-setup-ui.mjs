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
import { CodexSetupDialog } from ${JSON.stringify(path.join(root, 'desktop/renderer/McpSetup.tsx'))};
import { mcpSetupEnglish } from ${JSON.stringify(path.join(root, 'desktop/renderer/mcp-setup-messages.ts'))};
import { ApplicationSetupFlow } from ${JSON.stringify(path.join(root, 'desktop/renderer/application-setup-model.ts'))};
const surface = new URLSearchParams(location.search).get('surface');
const calls = [];
window.fixture = { calls };
const target = {id: 'configuration', path: '/fixture/work/config.toml'};
const status = {client:'codex', remembered:false, state:'not-configured', files:[{...target,state:'not-configured'}]};
const preview = {client:'codex',planId:'fixture-plan',requiresReplacement:false,
  files:[{...target,action:'update',changes:[]}]};
const invoke = async (method, params) => {
  calls.push({method,params});
  if (method === 'mcpSetupStatus') return status;
  if (method === 'mcpSetupDefaults') return {client:'codex',files:[{...target,format:'toml',alternatives:[target.path]}]};
  if (method === 'mcpSetupPreview' || method === 'codexSetupPrepare') return preview;
  if (method === 'mcpSetupApply') return {status:'applied',files:[{path:target.path,status:'updated'}]};
  throw new Error('Unexpected setup operation: ' + method);
};
const flow = new ApplicationSetupFlow(invoke);
const props = {flow, invoke, locale:'en', snapshot:{adapters:[],agents:[]},
  statuses:{statuses:{codex:status},errors:{},refreshAll:async()=>{}},
  discovery:{busy:false,failed:false,offers:['codex'],snapshot:{applications:[{client:'codex',status:'detected'}],offers:['codex']},refresh:async()=>{},acknowledge:async()=>{}},
  onManualSetup:()=>{}};
function Fixture() {
  const states = useSyncExternalStore(flow.subscribe,flow.getSnapshot);
  if (surface === 'overview') return <OverviewApplications {...props} states={states}/>;
  if (surface === 'startup') return <ApplicationSetup {...props} startup={{open:true, clients:['codex'],close:()=>{}}}/>;
  if (surface === 'manual') return <CodexSetupDialog invoke={invoke} inline messages={mcpSetupEnglish}/>;
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
  process.stdout.write(
    'ChatGPT setup passed through Applications, Overview, Startup and Manual setup.\n',
  );
} finally {
  await browser?.close();
  await rm(temp, { recursive: true, force: true });
}

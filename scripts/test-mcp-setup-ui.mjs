import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { McpSetupService } from '../desktop/core/mcp-setup.ts';
import { mcpInstructions } from '../desktop/core/instructions.ts';

// Isolated component/service integration; never starts the hub or addresses live clients.
const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const temporary = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ncf-mcp-setup-ui-')));
const home = path.join(temporary, 'home');
const setup = new McpSetupService({
  home,
  stateDirectory: path.join(temporary, 'state'),
  env: {},
  instructions: (client) =>
    mcpInstructions(
      'http://127.0.0.1:42000/mcp',
      'isolated-ui-token',
      client,
      'file:///isolated/plugin.js',
      aionConfiguration,
    ),
});
const errors = [];
let browser;
let server;
let browsePath = null;
let page;
const openedFiles = [];
const copiedTexts = [];
const aionConfiguration = JSON.stringify({
  mcpServers: { ncf_agent_interconnect: { command: 'fixture-runtime', args: ['fixture-bridge'] } },
});
const requestGates = new Map();
const releaseGates = [];
function holdOperation(method) {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  requestGates.set(method, pending);
  releaseGates.push(release);
  return release;
}
async function geometry(dialog) {
  const result = {};
  for (const [key, locator] of [
    ['dialog', dialog],
    ['path', dialog.getByTestId('mcp-path-configuration')],
    ['apply', dialog.getByTestId('mcp-apply')],
  ])
    result[key] = await locator.boundingBox();
  return result;
}
function assertGeometry(actual, expected, label) {
  for (const key of Object.keys(expected)) {
    assert.ok(actual[key] && expected[key], label + ': missing ' + key);
    for (const dimension of ['x', 'y', 'width', 'height'])
      assert.ok(
        Math.abs(actual[key][dimension] - expected[key][dimension]) < 0.5,
        label + ': ' + key + ' ' + dimension + ' moved',
      );
  }
}
async function waitForApply() {
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="mcp-apply"]');
    return button && !button.disabled;
  });
}
async function waitForBusy() {
  await page.locator('[data-testid="mcp-setup-progress"][data-busy="true"]').waitFor();
}
try {
  await mkdir(home);
  await symlink(
    path.dirname(path.dirname(require.resolve('react/package.json'))),
    path.join(temporary, 'node_modules'),
    'junction',
  );
  await writeFile(
    path.join(temporary, 'index.html'),
    '<html><body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>',
  );
  await writeFile(
    path.join(temporary, 'fixture.tsx'),
    `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { ThemeProvider, CssBaseline } from '@mui/material';
    import { theme } from ${JSON.stringify('/@fs/' + path.join(root, 'desktop/renderer/theme.ts'))};
    import { McpSetup } from ${JSON.stringify('/@fs/' + path.join(root, 'desktop/renderer/McpSetup.tsx'))};
    const invoke = async (method, params = {}) => {
      const response = await fetch('/setup', { method: 'POST', body: JSON.stringify({ method, params }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result;
    };
    window.interconnect={onChange:()=>()=>{}};
    function App() {
      const [client, setClient] = React.useState('cursor');
      return <ThemeProvider theme={theme}><CssBaseline /><McpSetup client={client} onClientChange={setClient}
        invoke={invoke} /></ThemeProvider>;
    }
    createRoot(document.getElementById('root')).render(<App />);
  `,
  );
  const setupRequest = async (request, response) => {
    try {
      let body = '';
      for await (const chunk of request) body += chunk;
      const { method, params } = JSON.parse(body);
      const gate = requestGates.get(method);
      if (gate) {
        requestGates.delete(method);
        await gate;
      }
      if (params.files?.some((file) => !file.path.startsWith(home + path.sep)))
        throw new Error('Fixture path escaped');
      let result;
      if (method === 'mcpSetupStatus') result = await setup.status(params.client);
      else if (method === 'mcpSetupOpen') {
        openedFiles.push(await setup.openablePath(params.client));
        result = { opened: true };
      } else if (method === 'mcpSetupDefaults') result = await setup.defaults(params.client);
      else if (method === 'mcpSetupPreview')
        result = await setup.preview('isolated-browser', params.client, params.files);
      else if (method === 'mcpSetupApply')
        result = await setup.apply('isolated-browser', params.planId, params.confirmReplace);
      else if (method === 'mcpSetupDiscard') {
        setup.discard('isolated-browser', params.planId);
        result = {};
      } else if (method === 'mcpSetupBrowse') result = browsePath;
      else if (method === 'aionUiStatus')
        result = { state: 'not-paired', url: 'http://127.0.0.1:1' };
      else if (method === 'copy') {
        copiedTexts.push(params.text);
        result = { copied: true };
      } else throw new Error('Unknown fixture operation');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(result));
    } catch (error) {
      response.statusCode = 400;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ error: error.message }));
    }
  };
  server = await createServer({
    root: temporary,
    configFile: false,
    cacheDir: path.join(temporary, 'vite-cache'),
    plugins: [
      react(),
      {
        name: 'mcp-setup-fixture',
        configureServer(server) {
          server.middlewares.use('/setup', setupRequest);
        },
      },
    ],
    server: {
      host: '127.0.0.1',
      port: 0,
      fs: { allow: [temporary, root, path.resolve(root, '../..')] },
    },
  });
  await server.listen();
  browser = await chromium.launch({
    channel: process.env.NCF_UI_CHROMIUM_CHANNEL || 'chrome',
    headless: true,
  });
  page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('tab', { name: 'Cursor', exact: true }).waitFor();
  assert.equal(await page.getByRole('tab').count(), 5);
  assert.equal(await page.getByRole('combobox').count(), 0);
  await page.getByRole('tab', { name: 'AionUi', exact: true }).click();
  const aionSetup = page.getByTestId('aionui-setup');
  await aionSetup.getByText('Not paired', { exact: true }).waitFor();
  await page.getByTestId('aionui-configure-access').click();
  const accessDialog = page.getByRole('dialog');
  assert.equal(
    await accessDialog
      .getByRole('textbox', { name: 'AionUi WebUI address', exact: true })
      .inputValue(),
    'http://127.0.0.1:1',
  );
  assert.equal(
    await accessDialog.getByLabel('Pairing code', { exact: true }).getAttribute('type'),
    'password',
  );
  await accessDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByTestId('mcp-configure-aionui').click();
  const fileDialog = page.getByRole('dialog');
  await waitForApply();
  assert.ok((await fileDialog.innerText()).includes('replaces any existing NCF entry'));
  assert.equal(await page.locator('pre, textarea, [contenteditable="true"]').count(), 0);
  await fileDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('tab', { name: 'Cursor', exact: true }).click();

  for (const [client, label] of [
    ['cursor', 'Cursor'],
    ['opencode', 'OpenCode'],
    ['codex', 'Codex'],
    ['claude', 'Claude Code'],
  ]) {
    await page.getByRole('tab', { name: label, exact: true }).click();
    const releaseDefaults = holdOperation('mcpSetupDefaults');
    await page.getByRole('button', { name: 'Configure ' + label, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Apply', exact: true }).waitFor({ state: 'visible' });
    const opening = await dialog.boundingBox();
    releaseDefaults();
    await page.waitForFunction(
      () => {
        const button = document.querySelector('[data-testid="mcp-apply"]');
        return button && !button.disabled;
      },
      null,
      { timeout: 10000 },
    );
    const ready = await dialog.boundingBox();
    for (const dimension of ['x', 'y', 'width', 'height'])
      assert.ok(
        Math.abs(ready[dimension] - opening[dimension]) < 0.5,
        client + ': dialog moved while loading',
      );
    const configured = await setup.defaults(client);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await assert.rejects(readFile(configured.files[0].path));
    await page.getByRole('button', { name: 'Configure ' + label, exact: true }).click();
    await page.waitForFunction(
      () => {
        const button = document.querySelector('[data-testid="mcp-apply"]');
        return button && !button.disabled;
      },
      null,
      { timeout: 10000 },
    );
    const stable = await geometry(dialog);
    if (client === 'opencode') {
      const alternatives = (await setup.defaults(client)).files[0].alternatives;
      const releaseLocation = holdOperation('mcpSetupPreview');
      await dialog.getByRole('button', { name: alternatives[1], exact: true }).click();
      await waitForBusy();
      assertGeometry(await geometry(dialog), stable, 'OpenCode location while checking');
      releaseLocation();
      await waitForApply();
      assertGeometry(await geometry(dialog), stable, 'OpenCode location after checking');
      browsePath = path.join(home, '.hidden', 'выбранный профиль', 'opencode.jsonc');
      const releasePicker = holdOperation('mcpSetupBrowse');
      await dialog.getByRole('button', { name: 'Choose file…', exact: true }).click();
      await waitForBusy();
      assertGeometry(await geometry(dialog), stable, 'OpenCode file picker while open');
      releasePicker();
      await page.waitForFunction(() =>
        document
          .querySelector('[data-testid="mcp-path-configuration"]')
          ?.value.includes('выбранный'),
      );
      await waitForApply();
      assertGeometry(await geometry(dialog), stable, 'OpenCode selected file');
    } else {
      const releasePreview = holdOperation('mcpSetupPreview');
      await dialog
        .getByTestId('mcp-path-configuration')
        .fill(path.join(home, '.hidden', client, client === 'codex' ? 'config.toml' : 'mcp.json'));
      await waitForBusy();
      assertGeometry(await geometry(dialog), stable, client + ' while checking');
      releasePreview();
      await waitForApply();
      assertGeometry(await geometry(dialog), stable, client + ' after checking');
      browsePath = null;
      const releasePicker = holdOperation('mcpSetupBrowse');
      await dialog.getByRole('button', { name: 'Choose file…', exact: true }).click();
      await waitForBusy();
      assertGeometry(await geometry(dialog), stable, client + ' file picker while open');
      releasePicker();
      await waitForApply();
      assertGeometry(await geometry(dialog), stable, client + ' after picker cancellation');
    }
    const selected = await dialog
      .getByRole('textbox', { name: 'Configuration file path', exact: true })
      .inputValue();
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    await dialog.getByText('Setup applied.', { exact: true }).waitFor();
    const content = await readFile(selected, 'utf8');
    assert.ok(content.includes('ncf_agent_interconnect'));
    if (client === 'opencode')
      assert.deepEqual(JSON.parse(content).plugin, ['file:///isolated/plugin.js']);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByText('Settings are present', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Open configuration file', exact: true }).click();
    await page.reload();
    await page.getByRole('tab', { name: label, exact: true }).click();
    await page.getByText('Settings are present', { exact: true }).waitFor();
    assert.equal(await page.locator('pre, textarea, [contenteditable="true"]').count(), 0);
  }
  assert.equal(openedFiles.length, 3);
  await page.getByRole('tab', { name: 'Cursor', exact: true }).click();
  const cursorPath = (await setup.defaults('cursor')).files[0].path;
  await writeFile(
    cursorPath,
    '{"mcpServers":{"ncf_agent_interconnect":{"url":"https://old.invalid"}},"other":true}\n',
  );
  await page.getByRole('button', { name: 'Configure Cursor', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByText('The connection settings will be updated. A backup will be saved.', { exact: true })
    .waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-testid="mcp-apply"]').disabled);
  assert.equal(await dialog.getByRole('checkbox').count(), 0);
  const screenshot = path.join(root, 'release/mcp-setup-dialog.png');
  await mkdir(path.dirname(screenshot), { recursive: true });
  await page.screenshot({ path: screenshot, animations: 'disabled' });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await dialog.getByText('Setup applied.', { exact: true }).waitFor();
  assert.equal(JSON.parse(await readFile(cursorPath, 'utf8')).other, true);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  const conflict = path.join(home, 'concurrent.json');
  await writeFile(conflict, '{}');
  await page.getByRole('button', { name: 'Configure Cursor', exact: true }).click();
  await dialog
    .getByText('These settings are already present. No changes are needed.', { exact: true })
    .waitFor();
  await dialog
    .getByRole('textbox', { name: 'Configuration file path', exact: true })
    .fill(conflict);
  await page.waitForFunction(
    () => {
      const button = document.querySelector('[data-testid="mcp-apply"]');
      return button && !button.disabled;
    },
    null,
    { timeout: 10000 },
  );
  const external = '{"outside":"newer settings"}';
  await writeFile(conflict, external);
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await dialog
    .getByText('The configuration changed after preview; prepare a new preview', { exact: true })
    .first()
    .waitFor();
  assert.equal(await readFile(conflict, 'utf8'), external);
  assert.deepEqual(errors, []);
  console.log(
    'MCP setup UI: 5 tabs including AionUi and Claude Code read-only setup, stable file dialog/path/actions during loading, location changes and file selection, automatic file setup, no unrelated file configuration contents, remembered paths, startup status, system open action, cancel, backup and concurrent-edit rejection passed.',
  );
  console.log('Screenshot: ' + screenshot);
} catch (error) {
  console.error('Browser errors:', errors);
  if (page) console.error((await page.locator('body').innerText()).slice(-6000));
  throw error;
} finally {
  for (const release of releaseGates) release();
  await browser?.close();
  await server?.close();
  await rm(temporary, { recursive: true, force: true });
}

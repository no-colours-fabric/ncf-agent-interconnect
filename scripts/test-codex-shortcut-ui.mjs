import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { build } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const temp = await mkdtemp(path.join(os.tmpdir(), 'ncf-codex-shortcut-ui-'));
let browser;
try {
  await symlink(path.join(root, 'node_modules'), path.join(temp, 'node_modules'), 'junction');
  await writeFile(
    path.join(temp, 'fixture.tsx'),
    `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ApplicationRows } from ${JSON.stringify(path.join(root, 'desktop/renderer/ApplicationSetup.tsx'))};
import { ApplicationSetupFlow } from ${JSON.stringify(path.join(root, 'desktop/renderer/application-setup-model.ts'))};
const query = new URLSearchParams(location.search);
const supported = query.get('platform') !== 'linux';
const calls = [];
let settle;
const invoke = async (method, input) => {
  calls.push({ method, input });
  if (method === 'codexShortcutPlatform') return supported ? 'mac' : null;
  if (method === 'codexShortcutCreate') return new Promise(resolve => { settle = resolve; });
  throw new Error('Unexpected fixture operation: ' + method);
};
window.fixture = { calls, finish: result => settle(result) };
const discovery = { busy: false, failed: false, offers: [], refresh: async () => {} };
const statuses = {
  statuses: { codex: { client: 'codex', remembered: true, state: 'configured', files: [] } },
  errors: {}, refreshAll: async () => {}
};
createRoot(document.getElementById('root')).render(<ApplicationRows
  discovery={discovery} statuses={statuses} flow={new ApplicationSetupFlow(invoke)}
  invoke={invoke} onManualSetup={() => {}} locale={query.get('locale') ?? 'en'}
/>);
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
    if (url.origin !== 'http://ncf-shortcut.test') return route.abort();
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

  await page.goto('http://ncf-shortcut.test/');
  const codex = page.getByTestId('application-row-codex');
  const action = codex.getByRole('button', {
    name: 'Create shortcut for Codex with NCF',
    exact: true,
  });
  await action.waitFor();
  assert.equal(
    await codex.getByTestId('mcp-settings-status').textContent(),
    'Settings are present',
  );
  assert.equal(await codex.getByTestId('application-manual-codex').isVisible(), true);
  assert.deepEqual(await page.evaluate(() => window.fixture.calls), [
    { method: 'codexShortcutPlatform', input: {} },
  ]);
  await action.click();
  assert.equal(await codex.getByRole('button', { name: 'Creating shortcut…' }).isDisabled(), true);
  await page.evaluate(() => window.fixture.finish('cancelled'));
  await action.waitFor();
  assert.equal(await codex.getByRole('alert').count(), 0);
  await action.click();
  await page.evaluate(() => window.fixture.finish('created'));
  await codex.getByText('Codex shortcut created.', { exact: true }).waitFor();
  assert.equal(await action.isEnabled(), true);
  assert.deepEqual(
    await page.evaluate(() =>
      window.fixture.calls.filter((entry) => entry.method === 'codexShortcutCreate'),
    ),
    Array(2).fill({ method: 'codexShortcutCreate', input: { locale: 'en' } }),
  );

  await page.goto('http://ncf-shortcut.test/?locale=ru');
  const localized = codex.getByRole('button', { name: 'Создать ярлык Codex с NCF', exact: true });
  await localized.click();
  await page.evaluate(() => window.fixture.finish('alreadyExists'));
  await codex.getByText('Ярлык с таким именем уже есть. Выберите другую папку или имя.').waitFor();

  await page.goto('http://ncf-shortcut.test/?platform=linux');
  await codex.getByTestId('mcp-settings-status').waitFor();
  await page.waitForFunction(() => window.fixture.calls.length === 1);
  assert.equal(await codex.getByTestId('codex-create-shortcut').count(), 0);
  assert.equal(await codex.getByTestId('application-manual-codex').isVisible(), true);
  process.stdout.write(
    'Codex shortcut UI: configured row, cancel, success, localized collision and unsupported platform passed.\n',
  );
} finally {
  await browser?.close();
  await rm(temp, { recursive: true, force: true });
}

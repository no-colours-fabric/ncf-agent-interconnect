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
const platform = query.get('platform') ?? 'mac';
const calls = [];
let settle;
const invoke = async (method, input) => {
  calls.push({ method, input });
  if (method === 'codexShortcutPlatform') return platform === 'linux' ? null : platform;
  if (method === 'codexShortcutRevealDock') return true;
  if (method === 'codexShortcutCreate') return new Promise(resolve => { settle = resolve; });
  throw new Error('Unexpected fixture operation: ' + method);
};
window.fixture = { calls, finish: result => settle(result) };
const discovery = { busy: false, failed: false, offers: [], refresh: async () => {} };
const statuses = {
  statuses: { codex: { client: 'codex', remembered: false, state: 'configured', files: [] } },
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
    name: 'Create ChatGPT shortcut',
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
  const picker = page.getByRole('dialog');
  const confirm = picker.getByRole('button', { name: 'Create', exact: true });
  await action.click();
  await picker.waitFor();
  for (const name of ['Desktop', 'Applications (this user)', 'Dock', 'Other location…']) {
    assert.equal(await picker.getByRole('checkbox', { name, exact: true }).isChecked(), false);
  }
  assert.equal(await confirm.isDisabled(), true);
  await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await page.evaluate(() => window.fixture.calls.length), 1);

  await action.click();
  await picker.getByRole('checkbox', { name: 'Dock', exact: true }).check();
  assert.equal(await picker.getByRole('textbox').count(), 0);
  assert.equal(await picker.getByText('Choose where to save the shortcut first.').count(), 0);
  await confirm.click();
  assert.equal(await codex.getByRole('button', { name: 'Creating shortcut…' }).isDisabled(), true);
  await page.evaluate(() => window.fixture.finish({ state: 'cancelled' }));
  await action.waitFor();
  assert.equal(await codex.getByRole('alert').count(), 0);

  await action.click();
  for (const name of ['Desktop', 'Applications (this user)', 'Dock']) {
    await picker.getByRole('checkbox', { name, exact: true }).check();
  }
  await confirm.click();
  await page.evaluate(() =>
    window.fixture.finish({
      state: 'complete',
      destinations: [
        { destination: 'desktop', result: 'alreadyExists' },
        { destination: 'applications', result: 'created' },
        { destination: 'dock', result: 'dockPending' },
      ],
    }),
  );
  await codex.getByText('ChatGPT shortcut created.', { exact: true }).waitFor();
  await codex
    .getByText('Shortcut saved. Drag it from Finder to the apps area of the Dock to finish.')
    .waitFor();
  await codex.getByRole('button', { name: 'Show in Finder', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.fixture.calls.at(-1)), {
    method: 'codexShortcutRevealDock',
    input: {},
  });
  assert.equal(
    await codex
      .getByText('A shortcut with this name already exists. Choose another location or name.')
      .isVisible(),
    true,
  );
  assert.equal(await action.isEnabled(), true);
  assert.deepEqual(
    await page.evaluate(() =>
      window.fixture.calls
        .filter((entry) => entry.method === 'codexShortcutCreate')
        .map(({ input }) => input),
    ),
    [
      { locale: 'en', destinations: ['dock'] },
      { locale: 'en', destinations: ['desktop', 'applications', 'dock'] },
    ],
  );

  await page.goto('http://ncf-shortcut.test/?locale=ru&platform=windows');
  await codex.getByRole('button', { name: 'Создать ярлык ChatGPT', exact: true }).click();
  assert.equal(await picker.getByRole('checkbox', { name: 'Dock', exact: true }).count(), 0);
  assert.equal(await picker.getByRole('textbox').count(), 0);
  for (const name of ['Рабочий стол', 'Список приложений в меню «Пуск»', 'Другая папка…']) {
    assert.equal(await picker.getByRole('checkbox', { name, exact: true }).isChecked(), false);
  }
  await picker.getByRole('checkbox', { name: 'Рабочий стол', exact: true }).check();
  await picker
    .getByRole('checkbox', { name: 'Список приложений в меню «Пуск»', exact: true })
    .check();
  await picker.getByRole('button', { name: 'Создать', exact: true }).click();
  await page.evaluate(() =>
    window.fixture.finish({
      state: 'complete',
      destinations: [
        { destination: 'desktop', result: 'alreadyExists' },
        { destination: 'startMenu', result: 'created' },
      ],
    }),
  );
  await codex.getByText('Ярлык с таким именем уже есть. Выберите другую папку или имя.').waitFor();
  await codex.getByText('Ярлык ChatGPT создан.').waitFor();
  assert.deepEqual(await page.evaluate(() => window.fixture.calls.at(-1).input), {
    locale: 'ru',
    destinations: ['desktop', 'startMenu'],
  });

  await page.goto('http://ncf-shortcut.test/?platform=linux');
  await codex.getByTestId('mcp-settings-status').waitFor();
  await page.waitForFunction(() => window.fixture.calls.length === 1);
  assert.equal(await codex.getByTestId('codex-create-shortcut').count(), 0);
  assert.equal(await codex.getByTestId('application-manual-codex').isVisible(), true);
  process.stdout.write(
    'Codex shortcut UI: explicit Mac and Windows choices, cancellation, individual outcomes, Dock instruction and unsupported platform passed.\n',
  );
} finally {
  await browser?.close();
  await rm(temp, { recursive: true, force: true });
}

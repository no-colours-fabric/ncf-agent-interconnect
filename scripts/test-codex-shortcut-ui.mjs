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
let heldLocations;
let holdNextLocations = false;
let existing = platform === 'windows' && !query.has('fresh') ? ['desktop'] : [];
const invoke = async (method, input) => {
  calls.push({ method, input });
  if (method === 'codexShortcutPlatform') return platform === 'linux' ? null : platform;
  if (method === 'codexShortcutRevealDock') return true;
  if (method === 'codexShortcutLocations') {
    if (!holdNextLocations) return existing;
    holdNextLocations = false;
    const snapshot = existing;
    return new Promise(resolve => { heldLocations = () => resolve(snapshot); });
  }
  if (method === 'codexShortcutCreate') return new Promise(resolve => { settle = resolve; });
  throw new Error('Unexpected fixture operation: ' + method);
};
window.fixture = {
  calls,
  deleteDesktop: () => { existing = existing.filter(destination => destination !== 'desktop'); },
  holdNextLocations: () => { holdNextLocations = true; },
  finishLocations: () => { heldLocations(); },
  finish: result => {
  if (result.state === 'complete') existing = [...new Set([
    ...existing, ...result.destinations.filter(entry => entry.result === 'created').map(entry => entry.destination)
  ])];
  settle(result);
} };
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
  await codex.getByRole('heading', { name: 'ChatGPT', exact: true }).waitFor();
  const action = codex.getByRole('button', { name: 'Create ChatGPT shortcuts', exact: true });
  await action.waitFor();
  assert.equal(
    await codex.getByTestId('mcp-settings-status').textContent(),
    'Settings are present',
  );
  assert.equal(
    await action.evaluate((element) => element.nextElementSibling?.getAttribute('data-testid')),
    'application-manual-codex',
  );
  assert.deepEqual(await page.evaluate(() => window.fixture.calls), [
    { method: 'codexShortcutPlatform', input: {} },
  ]);
  const picker = page.getByRole('dialog');
  const confirm = picker.getByRole('button', { name: 'Create', exact: true });
  await action.focus();
  await page.keyboard.press('Enter');
  await picker.getByRole('heading', { name: 'Create ChatGPT shortcuts' }).waitFor();
  await picker
    .getByText('To let agents exchange messages in ChatGPT, create separate shortcuts once.')
    .waitFor();
  for (const name of ['Desktop', 'Applications (this user)', 'Dock', 'Other location…']) {
    assert.equal(await picker.getByRole('checkbox', { name, exact: true }).isChecked(), false);
  }
  assert.equal(await confirm.isDisabled(), true);
  await page.keyboard.press('Escape');
  await picker.waitFor({ state: 'hidden' });
  assert.equal(await action.evaluate((element) => element === document.activeElement), true);
  assert.equal(
    await page.evaluate(() =>
      window.fixture.calls.some((entry) => entry.method === 'codexShortcutCreate'),
    ),
    false,
  );

  await action.click();
  await picker.getByRole('checkbox', { name: 'Dock', exact: true }).check();
  assert.equal(await picker.getByRole('textbox').count(), 0);
  await confirm.click();
  assert.equal(await confirm.isDisabled(), true);
  await page.evaluate(() => window.fixture.finish({ state: 'cancelled' }));
  await confirm.waitFor();
  assert.equal(await picker.getByRole('alert').count(), 0);
  await picker.getByRole('checkbox', { name: 'Desktop', exact: true }).check();
  await picker.getByRole('checkbox', { name: 'Applications (this user)', exact: true }).check();
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
  const created = picker.getByTestId('chatgpt-shortcut-created-applications');
  await created
    .locator('.MuiChip-sizeSmall.MuiChip-colorSuccess')
    .getByText('Created', {
      exact: true,
    })
    .waitFor();
  assert.equal(await created.locator('img').count(), 1);
  assert.equal(
    await picker.getByRole('checkbox', { name: 'Applications (this user)', exact: true }).count(),
    0,
  );
  await picker.getByText('ChatGPT shortcut created.', { exact: true }).waitFor();
  await picker
    .getByText('Shortcut saved. Drag it from Finder to the apps area of the Dock to finish.')
    .waitFor();
  await picker.getByRole('button', { name: 'Show in Finder', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.fixture.calls.at(-1)), {
    method: 'codexShortcutRevealDock',
    input: {},
  });
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

  await page.setViewportSize({ width: 480, height: 720 });
  assert.equal(
    await picker.evaluate((element) => element.scrollWidth > element.clientWidth),
    false,
  );
  const left = await picker.getByTestId('chatgpt-shortcut-explanation').boundingBox();
  const right = await picker.getByTestId('chatgpt-shortcut-locations').boundingBox();
  assert.ok(left && right && right.y > left.y);
  await page.setViewportSize({ width: 1024, height: 840 });
  await page.goto('http://ncf-shortcut.test/?locale=ru&platform=windows');
  await codex.getByRole('button', { name: 'Создать ярлыки ChatGPT', exact: true }).click();
  await picker.getByRole('heading', { name: 'Создать ярлыки ChatGPT' }).waitFor();
  await picker
    .getByText(
      'Чтобы агенты могли обмениваться сообщениями в ChatGPT, нужно один раз создать отдельные значки запуска.',
      { exact: true },
    )
    .waitFor();
  await picker
    .getByText(
      'Когда вам нужны функции «NCF Agent Interconnect», открывайте ChatGPT через эти значки. При другом способе запуска ChatGPT работает как обычно, а функции «NCF Agent Interconnect» недоступны.',
      { exact: true },
    )
    .waitFor();
  const desktopStatus = picker.getByTestId('chatgpt-shortcut-created-desktop');
  await desktopStatus.getByText('Создан', { exact: true }).waitFor();
  assert.equal(
    await picker.getByRole('checkbox', { name: 'Рабочий стол', exact: true }).count(),
    0,
  );
  assert.equal(await picker.getByRole('checkbox', { name: 'Dock', exact: true }).count(), 0);
  assert.equal(await picker.getByRole('textbox').count(), 0);
  for (const name of ['Список приложений в меню «Пуск»', 'Другая папка…'])
    assert.equal(await picker.getByRole('checkbox', { name, exact: true }).isChecked(), false);
  await picker
    .getByRole('checkbox', { name: 'Список приложений в меню «Пуск»', exact: true })
    .check();
  await picker.getByRole('button', { name: 'Создать', exact: true }).click();
  assert.deepEqual(
    await page.evaluate(
      () => window.fixture.calls.findLast((entry) => entry.method === 'codexShortcutCreate').input,
    ),
    {
      locale: 'ru',
      destinations: ['startMenu'],
    },
  );
  await page.evaluate(() =>
    window.fixture.finish({
      state: 'complete',
      destinations: [{ destination: 'startMenu', result: 'created' }],
    }),
  );
  await picker
    .getByTestId('chatgpt-shortcut-created-startMenu')
    .getByText('Создан', { exact: true })
    .waitFor();
  await picker.getByText('Ярлык ChatGPT создан.').waitFor();

  for (const platform of ['mac', 'windows']) {
    await page.goto('http://ncf-shortcut.test/?fresh&platform=' + platform);
    const desktopCheckbox = picker.getByRole('checkbox', { name: 'Desktop', exact: true });
    const otherCheckbox = picker.getByRole('checkbox', { name: 'Other location…', exact: true });
    const createdDesktop = picker.getByTestId('chatgpt-shortcut-created-desktop');
    const createDesktop = async () => {
      await desktopCheckbox.check();
      await confirm.click();
      assert.deepEqual(
        await page.evaluate(
          () =>
            window.fixture.calls.findLast(({ method }) => method === 'codexShortcutCreate').input,
        ),
        { locale: 'en', destinations: ['desktop'] },
      );
      await page.evaluate(() =>
        window.fixture.finish({
          state: 'complete',
          destinations: [{ destination: 'desktop', result: 'created' }],
        }),
      );
      await createdDesktop.getByText('Created', { exact: true }).waitFor();
    };
    await action.click();
    await createDesktop();
    await otherCheckbox.check();
    await page.evaluate(() => {
      window.fixture.deleteDesktop();
      window.dispatchEvent(new Event('focus'));
    });
    await desktopCheckbox.waitFor();
    assert.equal(await otherCheckbox.isChecked(), true);
    assert.equal(await picker.getByText('ChatGPT shortcut created.', { exact: true }).count(), 0);
    await otherCheckbox.uncheck();
    await createDesktop();

    await page.evaluate(() => {
      window.fixture.holdNextLocations();
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
    await picker.waitFor({ state: 'hidden' });
    const readCount = await page.evaluate(
      () => window.fixture.calls.filter(({ method }) => method === 'codexShortcutLocations').length,
    );
    await page.evaluate(() => {
      window.fixture.deleteDesktop();
      window.dispatchEvent(new Event('focus'));
    });
    assert.equal(
      await page.evaluate(
        () =>
          window.fixture.calls.filter(({ method }) => method === 'codexShortcutLocations').length,
      ),
      readCount,
    );
    await action.click();
    await desktopCheckbox.waitFor();
    await page.evaluate(() => window.fixture.finishLocations());
    await createDesktop();
  }

  await page.goto('http://ncf-shortcut.test/?platform=linux');
  await codex.getByTestId('mcp-settings-status').waitFor();
  await page.waitForFunction(() => window.fixture.calls.length === 1);
  assert.equal(await codex.getByTestId('codex-create-shortcut').count(), 0);
  assert.equal(await codex.getByTestId('application-manual-codex').isVisible(), true);
  process.stdout.write(
    'ChatGPT shortcut UI: gear, keyboard, locations, Russian copy, layout, Dock, and Mac/Windows Desktop recreation after focus or reopen passed.\n',
  );
} finally {
  await browser?.close();
  await rm(temp, { recursive: true, force: true });
}

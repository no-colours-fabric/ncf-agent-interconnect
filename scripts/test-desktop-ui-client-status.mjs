import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

// Renderer-only fixtures never start the NCF service or open a real client profile.
const root = process.cwd();
const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ncf-client-status-ui-'));
const output = path.join(root, 'release');
const stamp = '2026-11-01T10:03:12.000Z';
const capabilities = (ready) => ({
  wakeIdle: ready,
  receiveActive: ready,
  exactSession: ready,
  nativeDisplay: false,
});
const profile = (kind, state, error = null, extra = {}) => ({
  id: randomUUID(),
  label: 'Synthetic connection',
  kind,
  state,
  error,
  capabilities: capabilities(state === 'ready'),
  ...extra,
});
const released = profile('opencode-http', 'error', 'OpenCode is disconnected', { released: true });
const failed = profile(
  'opencode-http',
  'error',
  'fetch failed <img src=x onerror="window.injected=true">',
);
const uncertain = profile('opencode-http', 'uncertain', 'The OpenCode event stream was closed', {
  released: true,
});
const active = profile('opencode-http', 'ready');
const verified = profile('codex-desktop', 'ready', null, { lastOwnerVerifiedAt: stamp });
const blocked = profile('codex-desktop', 'ready', null, {
  lastOwnerVerifiedAt: stamp,
  capabilities: capabilities(false),
});
const unsupported = profile(
  'codex-desktop',
  'error',
  'The handler for this Codex chat does not support external input',
  { lastOwnerVerifiedAt: stamp },
);
const codexUncertain = profile('codex-desktop', 'uncertain', 'Codex admission was not confirmed', {
  lastOwnerVerifiedAt: stamp,
});
const saved = profile('opencode-http', 'error', 'Synthetic saved connection timeout');
const adapters = [
  released,
  failed,
  uncertain,
  active,
  verified,
  blocked,
  unsupported,
  codexUncertain,
  saved,
];
const names = [
  'Released Ж',
  'Failed Æ',
  'Uncertain 漢字',
  'OpenCode active',
  'Codex verified',
  'Codex blocked',
  'Codex unsupported',
  'Codex uncertain',
];
const agents = adapters.slice(0, names.length).map((adapter, index) => ({
  key: names[index].toLowerCase(),
  nickname: names[index],
  binding: {
    connectionId: randomUUID(),
    client: 'Synthetic fixture',
    chatId: randomUUID(),
    adapterId: adapter.id,
    generation: 1,
  },
  messageCount: 0,
  unread: 0,
}));
const snapshot = {
  running: true,
  nodeId: randomUUID(),
  nodeLabel: 'Synthetic status review',
  mcpUrl: 'http://127.0.0.1:0/mcp',
  peerUrl: 'wss://127.0.0.1:0/peer',
  listenHost: '127.0.0.1',
  localAddresses: ['127.0.0.1'],
  exportRoots: [],
  errors: [],
  adapters,
  agents,
  peers: [],
  directories: [],
};
const allVerified = { ...snapshot, adapters: [active, verified], agents: [agents[3], agents[4]] };
let application;
const errors = [];
const screenshots = [];
try {
  await mkdir(output, { recursive: true });
  const preload = path.join(temporary, 'preload.cjs');
  const main = path.join(temporary, 'main.cjs');
  await writeFile(
    preload,
    `
const { contextBridge, ipcRenderer } = require('electron');
const fixtures = ${JSON.stringify({ mixed: snapshot, verified: allVerified })};
let snapshot = fixtures.mixed;
const listeners = new Set();
ipcRenderer.on('fixture:phase', (_event, phase) => {
  if (!fixtures[phase]) throw new Error('Invalid fixture phase');
  snapshot = fixtures[phase];
  for (const listener of listeners) listener();
});
contextBridge.exposeInMainWorld('interconnect', {
  invoke: async (method) => {
    if (method === 'snapshot') return snapshot;
    if (method === 'history') return { messages: [], nextCursor: 0, hasMore: false };
    throw new Error('Unexpected fixture call: ' + method);
  },
  onChange: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
  onNavigate: () => () => {},
});
`,
  );
  await writeFile(
    main,
    `
const { app, BrowserWindow } = require('electron');
app.setPath('userData', ${JSON.stringify(path.join(temporary, 'profile'))});
app.whenReady().then(() => {
  const window = new BrowserWindow({ title: 'Synthetic client status review', width: 1050, height: 700, webPreferences: { preload: ${JSON.stringify(preload)}, contextIsolation: true, sandbox: true } });
  window.loadFile(${JSON.stringify(path.join(root, 'build/renderer/index.html'))}, { hash: 'clients' });
});
app.on('window-all-closed', () => app.quit());
`,
  );
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  console.error(
    JSON.stringify({
      event: 'client-status-gui',
      phase: 'electron.launch',
      testPid: process.pid,
      electronPid: null,
    }),
  );
  application = await electron.launch({
    executablePath: require('electron'),
    args: [main],
    cwd: temporary,
    env: environment,
    timeout: 30000,
  });
  console.error(
    JSON.stringify({
      event: 'client-status-gui',
      phase: 'first-window',
      testPid: process.pid,
      electronPid: application.process().pid,
    }),
  );
  const page = await application.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('table').first().waitFor();
  for (const [locale, label] of [
    ['en', 'English'],
    ['ru', 'Русский'],
    ['de', 'Deutsch'],
  ]) {
    if (locale !== 'en') {
      await page.getByTestId('interface-language').getByRole('combobox').click();
      await page.getByRole('option', { name: label, exact: true }).click();
    }
    for (const width of [900, 1050]) {
      await page.setViewportSize({ width, height: 700 });
      const row = (name) => page.getByRole('row').filter({ hasText: name });
      const time = await page.evaluate(
        ({ stamp, locale }) => new Date(stamp).toLocaleString(locale),
        { stamp, locale },
      );
      assert.ok(
        (await row('Codex verified').innerText()).includes(time),
        'Verification time must be visible outside closed details',
      );
      assert.equal(await row('Codex verified').locator('.MuiChip-colorSuccess').count(), 0);
      assert.ok(await row('Codex blocked').locator('.MuiChip-colorWarning').count());
      assert.ok(await row('Codex unsupported').locator('.MuiChip-colorWarning').count());
      assert.equal(await row('Released Ж').locator('.MuiChip-colorWarning').count(), 0);
      assert.ok(await row('Uncertain 漢字').locator('.MuiChip-colorWarning').count());
      const visible = await page.locator('main').innerText();
      assert.ok(!visible.includes('fetch failed'));
      assert.ok(!visible.includes('Codex admission was not confirmed'));
      for (const adapter of adapters) assert.ok(!visible.includes(adapter.id));
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
      assert.equal(
        await page
          .locator('main')
          .evaluate((element) => element.scrollWidth > element.clientWidth + 1),
        false,
      );
      const failedRow = row('Failed Æ');
      await failedRow.locator('summary').focus();
      await page.keyboard.press('Enter');
      assert.ok((await failedRow.innerText()).includes(failed.error));
      assert.equal(await failedRow.locator('img').count(), 0);
      assert.equal(await page.evaluate(() => window.injected), undefined);
      await page.keyboard.press('Enter');
      const file = path.join(output, `client-status-${locale}-${width}.png`);
      await page.screenshot({ path: file, animations: 'disabled' });
      screenshots.push(file);
    }
  }
  await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send('fixture:phase', 'verified'),
  );
  await page.getByRole('row').filter({ hasText: 'Released Ж' }).waitFor({ state: 'detached' });
  const verifiedRow = page.getByRole('row').filter({ hasText: 'Codex verified' });
  assert.equal(await verifiedRow.locator('.MuiChip-colorSuccess').count(), 0);
  const codexCard = page.locator('div.MuiPaper-root').filter({ has: verifiedRow }).last();
  assert.equal(
    await codexCard.locator('.MuiChip-colorSuccess').count(),
    0,
    'All-verified Codex summary must not claim live connection',
  );
  await page.getByTestId('interface-language').getByRole('combobox').click();
  await page.getByRole('option', { name: 'Русский', exact: true }).click();
  await verifiedRow.scrollIntoViewIfNeeded();
  const codexScreenshot = path.join(output, 'client-status-codex-verified-ru-1050.png');
  await page.screenshot({ path: codexScreenshot, animations: 'disabled' });
  screenshots.push(codexScreenshot);
  assert.deepEqual(errors, []);
  const report = {
    rendererOnly: true,
    noNcfCoreOrLiveProfiles: true,
    locales: ['en', 'ru', 'de'],
    widths: [900, 1050],
    visibleVerificationTime: true,
    historicalFullAndPartialSummaries: true,
    currentFailurePrecedence: true,
    releasedUncertainWarning: true,
    closedDiagnosticsAndKeyboardEscaping: true,
    pageErrors: errors,
    screenshots,
  };
  await writeFile(
    path.join(output, 'client-status-ui-review.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report));
} finally {
  await application?.close();
  await rm(temporary, { recursive: true, force: true });
}

import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { access, mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

// Build the baseline renderer from the documented source checkpoint before this run.
const baseline = path.resolve('.local/network-before/build/renderer/index.html');
const updated = path.resolve('build/renderer/index.html');
const require = createRequire(import.meta.url);
const temp = await mkdtemp(path.join(os.tmpdir(), 'ncf-compact-peers-'));
const sharedName = 'Общий агент';
const longName = 'Unicode Ж 漢字 ' + 'LongName'.repeat(12);
const cases = [
  [
    'Peer Alpha',
    'ready',
    [
      { nickname: sharedName, availability: 'online' },
      { nickname: 'Unknown agent', availability: 'unknown' },
      { nickname: longName, availability: 'online' },
    ],
  ],
  ['Peer Beta', 'ready', [{ nickname: sharedName, availability: 'unknown' }]],
  ['Peer syncing', 'syncing', []],
  ['Peer offline', 'offline', []],
  ['Peer unsupported', 'unsupported', []],
  ['Peer empty', 'ready', []],
  ['Peer truncated', 'ready', [{ nickname: 'Partial agent', availability: 'online' }]],
  ['Peer error', 'offline', []],
];
const directories = cases.map(([nodeLabel, state, agents]) => ({
  nodeId: randomUUID(),
  nodeLabel,
  state,
  agents,
  local: false,
  epoch: null,
  revision: null,
  updatedAt: '2026-11-01T14:00:00.000Z',
  truncated: nodeLabel === 'Peer truncated',
  total: nodeLabel === 'Peer truncated' ? 201 : agents.length,
}));
const snapshot = {
  running: true,
  nodeId: randomUUID(),
  nodeLabel: 'Isolated compact directory fixture',
  mcpUrl: 'http://127.0.0.1:0/mcp',
  peerUrl: 'wss://127.0.0.1:0/peer',
  listenHost: '127.0.0.1',
  localAddresses: ['127.0.0.1'],
  agents: [],
  adapters: [],
  exportRoots: [],
  errors: [],
  directories,
  peers: directories.map((directory) => ({
    id: directory.nodeId,
    label: directory.nodeLabel,
    address: 'wss://fixture.invalid:7336/peer',
    connected: !['offline'].includes(directory.state),
    error: directory.nodeLabel === 'Peer error' ? 'Synthetic connection failure.' : null,
  })),
};
let application, page;
const screenshots = [],
  errors = [],
  heights = {};
const phase = (name) =>
  console.error(
    JSON.stringify({
      event: 'compact-peers-gui',
      phase: name,
      testPid: process.pid,
      testParentPid: process.ppid,
      electronPid: application?.process().pid ?? null,
    }),
  );
const card = (index) => page.getByTestId('peer-' + directories[index].nodeId);
const directory = (index) => page.getByTestId('directory-' + directories[index].nodeId);
async function capture(name) {
  const filename = 'release/compact-peers-' + name + '.png';
  await page.mouse.move(1, 1);
  await page.screenshot({ path: filename, animations: 'disabled' });
  screenshots.push(filename);
}
async function language(label) {
  await page.getByTestId('interface-language').getByRole('combobox').click();
  await page.getByRole('option', { name: label, exact: true }).click();
}
try {
  await access(baseline);
  await access(updated);
  await mkdir('release', { recursive: true });
  const preload = path.join(temp, 'fixture-preload.cjs');
  const main = path.join(temp, 'fixture-main.cjs');
  await writeFile(
    preload,
    `const {contextBridge}=require('electron'); const snapshot=${JSON.stringify(snapshot)}; contextBridge.exposeInMainWorld('interconnect', {invoke: async (method) => { if(method==='snapshot') return snapshot; if(method==='history') return {messages:[], nextCursor:0, hasMore:false}; throw new Error('Unexpected fixture method: '+method); }, onChange:()=>()=>{}, onNavigate:()=>()=>{} });`,
  );
  await writeFile(
    main,
    `const {app,BrowserWindow}=require('electron'); app.setPath('userData',${JSON.stringify(path.join(temp, 'profile'))}); app.whenReady().then(()=>{const window=new BrowserWindow({width:1050,height:700,webPreferences:{preload:${JSON.stringify(preload)},contextIsolation:true,sandbox:true}});window.loadFile(${JSON.stringify(baseline)});}); app.on('window-all-closed',()=>app.quit());`,
  );
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  phase('electron.launch');
  try {
    application = await electron.launch({
      executablePath: require('electron'),
      args: [main],
      cwd: temp,
      env,
      timeout: 30000,
    });
  } catch (cause) {
    phase('electron.launch-failed');
    throw new Error(
      'Electron GUI initialization failed. Use an authorized GUI environment and approved require_escalated in Codex. No automatic retry. Inspect original cause and launch PIDs.',
      { cause },
    );
  }
  phase('first-window');
  page = await application.firstWindow();
  phase('window-ready');
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByTestId('nav-network').click();
  const beforeRows = directory(0).getByRole('button');
  await beforeRows.first().waitFor();
  heights.before = (await beforeRows.first().boundingBox()).height;
  const baselineCard = page
    .locator('main .MuiPaper-root')
    .filter({ has: directory(0) })
    .first();
  assert.equal(await baselineCard.getByText('Peer Alpha', { exact: true }).count(), 2);
  await baselineCard.scrollIntoViewIfNeeded();
  await capture('before-en-1050x700');
  await application.evaluate(
    ({ BrowserWindow }, filename) => BrowserWindow.getAllWindows()[0].loadFile(filename),
    updated,
  );
  await page.getByTestId('nav-network').click();
  await card(0).waitFor();
  assert.equal(await card(0).getByText('Peer Alpha', { exact: true }).count(), 1);
  assert.equal(await card(0).getByText(directories[0].nodeId, { exact: true }).count(), 1);
  assert.equal(await card(0).getByText('Connected', { exact: true }).count(), 1);
  assert.equal(await directory(0).getByText('Online client', { exact: true }).count(), 2);
  await directory(0).getByText('Client availability unknown', { exact: true }).waitFor();
  await directory(2).getByText('Synchronizing', { exact: true }).waitFor();
  await directory(3).getByText('Offline', { exact: true }).waitFor();
  await directory(4).getByText('Directory unsupported', { exact: true }).waitFor();
  await directory(4)
    .getByText(
      'Update this peer to share its agent directory. Message delivery remains available.',
      { exact: true },
    )
    .waitFor();
  await directory(5).getByText('No connected agents registered.', { exact: true }).waitFor();
  await directory(6)
    .getByText('Directory is incomplete: showing 1 of 201 agents.', { exact: true })
    .waitFor();
  await card(7).getByText('Synthetic connection failure.', { exact: true }).waitFor();
  assert.ok((await directory(0).innerText()).includes('Updated '));
  const compactRows = directory(0).getByTestId('compact-peer-agent');
  heights.after = (await compactRows.first().boundingBox()).height;
  assert.ok(heights.after < heights.before, JSON.stringify(heights));
  await card(0).scrollIntoViewIfNeeded();
  await capture('after-en-1050x700');
  for (const index of [0, 1]) {
    const button = directory(index).getByRole('button', { name: new RegExp('^' + sharedName) });
    await button.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.getByTestId('agents-tab-remote').getAttribute('aria-selected'), 'true');
    assert.ok(
      (await page.getByTestId('remote-recipient-node').getByRole('combobox').innerText()).includes(
        directories[index].nodeId,
      ),
    );
    assert.equal(
      await page
        .getByTestId('agents-panel-remote')
        .getByRole('textbox', { name: 'Recipient agent name', exact: true })
        .inputValue(),
      sharedName,
    );
    await page.getByTestId('nav-network').click();
  }
  for (const label of ['Русский', 'Deutsch']) {
    await language(label);
    assert.ok(
      await page.locator('main').evaluate((element) => element.scrollWidth <= element.clientWidth),
    );
    const fullName = directory(0).getByText(longName, { exact: true });
    assert.equal(await fullName.textContent(), longName);
    assert.ok(await fullName.evaluate((element) => element.scrollWidth <= element.clientWidth + 1));
    await card(0).scrollIntoViewIfNeeded();
    await capture('after-' + (label === 'Русский' ? 'ru' : 'de') + '-1050x700');
  }
  assert.deepEqual(errors, []);
  const report = {
    command: 'node scripts/test-desktop-ui-compact-peers.mjs',
    fixture:
      'Static synthetic snapshots in an isolated Electron renderer; no transport or real application main process',
    launchCount: 1,
    heights,
    singleIdentity: true,
    statusesFreshnessEmptyTruncationErrors: true,
    fullUnicodeNames: true,
    keyboardExactRemoteNavigation: true,
    locales: ['en', 'ru', 'de'],
    window: [1050, 700],
    realConfigsOrPeersUsed: false,
    pageErrors: errors,
    screenshots,
  };
  await writeFile('release/compact-peers-qa.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  if (application) await application.close();
  await rm(temp, { recursive: true, force: true });
}

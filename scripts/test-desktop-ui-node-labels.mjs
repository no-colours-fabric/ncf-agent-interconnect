import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const temp = await mkdtemp(path.join(os.tmpdir(), 'ncf-node-labels-'));
const localId = randomUUID(),
  first = randomUUID(),
  second = randomUUID(),
  old = randomUUID();
const literalId = randomUUID();
const literalBody = 'User text keeps its UUID: ' + literalId;
const machine = 'Machine Ж 漢字 ' + 'LongMachineName'.repeat(4);
const dirs = [first, second].map((nodeId) => ({
  nodeId,
  nodeLabel: 'Stale directory label',
  local: false,
  state: 'ready',
  agents: [{ nickname: 'Same agent', availability: 'online' }],
  updatedAt: null,
  epoch: null,
  revision: null,
  total: 1,
  truncated: false,
}));
const snapshot = {
  running: true,
  nodeId: localId,
  nodeLabel: 'My Mac $& {node}',
  mcpUrl: 'http://127.0.0.1:0/mcp',
  peerUrl: 'wss://127.0.0.1:0/peer',
  listenHost: '127.0.0.1',
  localAddresses: ['127.0.0.1'],
  peers: [first, second].map((id) => ({
    id,
    label: machine,
    address: 'wss://fixture.invalid:7336/peer',
    connected: true,
    error: null,
  })),
  agents: [{ key: 'owner', nickname: 'Owner', binding: null, unread: 0, messageCount: 3 }],
  directories: dirs,
  adapters: [],
  exportRoots: [],
  errors: [],
};
const messages = [first, localId, old].map((fromNode, index) => ({
  sequence: index + 1,
  direction: 'in',
  state: 'ready',
  error: null,
  envelope: {
    protocol: 2,
    id: randomUUID(),
    fromNode,
    toNode: localId,
    fromNickname: 'Same agent',
    toNickname: 'Owner',
    createdAt: '2026-11-01T14:00:00.000Z',
    text: index === 0 ? literalBody : 'Synthetic message ' + index,
    attachments: [],
    replyTo: null,
  },
}));
let application, page;
const screenshots = [],
  errors = [];
const phase = (phase) =>
  console.error(
    JSON.stringify({
      event: 'node-labels-gui',
      phase,
      testPid: process.pid,
      testParentPid: process.ppid,
      electronPid: application?.process().pid ?? null,
    }),
  );
async function capture(name) {
  const file = 'release/node-labels-' + name + '.png';
  await page.mouse.move(1, 1);
  await page.screenshot({ path: file, animations: 'disabled' });
  screenshots.push(file);
}
async function assertNoGeneratedGuids() {
  const visibleText = await page.locator('main').innerText();
  const withoutUserText = visibleText.replaceAll(literalBody, '');
  for (const id of [localId, first, second, old, literalId])
    assert.ok(!withoutUserText.includes(id), 'Unexpected generated UUID: ' + id);
}
try {
  await mkdir('release', { recursive: true });
  const preload = path.join(temp, 'preload.cjs'),
    main = path.join(temp, 'main.cjs');
  const renderer = path.resolve('build/renderer/index.html');
  await writeFile(
    preload,
    `const {contextBridge}=require('electron'); const snapshot=${JSON.stringify(snapshot)},messages=${JSON.stringify(messages)},calls=[]; contextBridge.exposeInMainWorld('interconnect',{invoke:async(method,params)=>{if(method==='snapshot')return snapshot;if(method==='history')return{messages,nextCursor:3,hasMore:false};if(method==='send'){calls.push(params);return{accepted:true,id:'fixture'};}if(method==='fixtureCalls')return calls;throw Error('Unexpected method '+method);},onChange:()=>()=>{},onNavigate:()=>()=>{}});`,
  );
  await writeFile(
    main,
    `const{app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(temp, 'profile'))});app.whenReady().then(()=>{const w=new BrowserWindow({width:1050,height:700,webPreferences:{preload:${JSON.stringify(preload)},contextIsolation:true,sandbox:true}});w.loadFile(${JSON.stringify(renderer)});});app.on('window-all-closed',()=>app.quit());`,
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
      'Electron GUI initialization failed. Use an authorized GUI environment and approved require_escalated in Codex. No automatic retry; inspect original cause and PIDs.',
      { cause },
    );
  }
  phase('first-window');
  page = await application.firstWindow();
  phase('window-ready');
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByTestId('nav-agents').click();
  await page.getByTestId('message-text').filter({ hasText: literalBody }).waitFor();
  assert.equal(await page.getByText(literalBody, { exact: true }).textContent(), literalBody);
  const metadata = page.getByTestId('message-node-labels');
  assert.equal(await metadata.count(), 3);
  assert.ok((await metadata.nth(0).innerText()).includes(machine));
  assert.ok((await metadata.nth(1).innerText()).includes('My Mac $& {node}'));
  assert.ok((await metadata.nth(2).innerText()).includes('Unknown computer'));
  await assertNoGeneratedGuids();
  await capture('en-local');
  await page.getByTestId('agents-tab-remote').click();
  const names = [];
  for (const id of [first, second])
    names.push(
      await page
        .getByTestId('directory-' + id)
        .locator('.MuiTypography-body2')
        .first()
        .innerText(),
    );
  assert.notEqual(names[0], names[1]);
  assert.equal(await metadata.first().isVisible(), false);
  for (const [index, id] of [first, second].entries()) {
    await page
      .getByTestId('directory-' + id)
      .getByRole('button', { name: /Same agent/ })
      .click();
    assert.equal(await page.getByTestId('remote-recipient-node').locator('input').inputValue(), id);
    assert.equal(
      await page.getByTestId('remote-recipient-node').getByRole('combobox').innerText(),
      names[index],
    );
    await assertNoGeneratedGuids();
    if (index === 0) {
      await page.getByTestId('remote-sender').getByRole('combobox').click();
      await page.getByRole('option', { name: 'Owner', exact: true }).click();
    }
    const panel = page.getByTestId('agents-panel-remote');
    await panel
      .getByRole('textbox', { name: 'Message from the user', exact: true })
      .fill('Send to duplicate-name machine ' + index);
    await panel.getByRole('button', { name: 'Send message', exact: true }).click();
    const calls = await page.evaluate(() => window.interconnect.invoke('fixtureCalls'));
    assert.equal(calls[index].recipientNode, id);
    assert.equal(calls[index].recipientNickname, 'Same agent');
    assert.equal(calls[index].nickname, 'Owner');
  }
  await capture('en-remote');
  await page.getByTestId('agents-tab-local').click();
  await page.getByRole('button', { name: 'Add agent', exact: true }).click();
  await page.getByRole('textbox', { name: 'Agent name', exact: true }).fill('Same agent');
  const warning = await page.getByRole('dialog').getByRole('alert').innerText();
  for (const name of names) assert.ok(warning.includes(name));
  assert.ok(!warning.includes(first) && !warning.includes(second));
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByTestId('nav-network').click();
  await page.getByTestId('peer-' + first).waitFor();
  await assertNoGeneratedGuids();
  assert.equal(
    await page
      .getByTestId('peer-' + first)
      .locator('.MuiTypography-root')
      .first()
      .innerText(),
    names[0],
  );
  await page
    .getByTestId('peer-' + second)
    .getByRole('button', { name: /Same agent/ })
    .click();
  assert.equal(
    await page.getByTestId('remote-recipient-node').locator('input').inputValue(),
    second,
  );
  await page.getByTestId('interface-language').getByRole('combobox').click();
  await page.getByRole('option', { name: 'Русский', exact: true }).click();
  await assertNoGeneratedGuids();
  await capture('ru-remote');
  await page.getByTestId('agents-tab-local').click();
  await metadata.nth(2).filter({ hasText: 'Неизвестный компьютер' }).waitFor();
  assert.equal(await page.getByText(literalBody, { exact: true }).textContent(), literalBody);
  await assertNoGeneratedGuids();
  assert.ok(
    await page.locator('main').evaluate((element) => element.scrollWidth <= element.clientWidth),
  );
  await capture('ru-local');
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      launchCount: 1,
      fixture: 'Static synthetic renderer; no real app main/core/transport',
      localPeerUnknownLabels: true,
      noGeneratedGuidsInOrdinaryUi: true,
      literalBodyUuidPreserved: true,
      duplicateMachineLabelsAndExactSendCalls: true,
      metadataPickerHeaderWarningConsistent: true,
      networkNavigation: true,
      window: [1050, 700],
      locales: ['en', 'ru'],
      pageErrors: errors,
      screenshots,
    }),
  );
} finally {
  if (application) await application.close();
  await rm(temp, { recursive: true, force: true });
}

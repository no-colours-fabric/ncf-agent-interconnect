import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

// Synthetic renderer only: sends are held in memory without any node or real agent.
const require = createRequire(import.meta.url);
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ncf-chat-drafts-'));
const nodeId = randomUUID();
const first = 'First Ж',
  second = 'Second 漢字';
const snapshot = {
  running: true,
  nodeId,
  nodeLabel: 'Draft fixture',
  mcpUrl: '',
  peerUrl: '',
  listenHost: '127.0.0.1',
  localAddresses: [],
  peers: [],
  directories: [],
  adapters: [],
  exportRoots: [],
  errors: [],
  agents: [first, second].map((nickname) => ({
    key: nickname.toLowerCase(),
    nickname,
    incarnation: randomUUID(),
    binding: null,
    messageCount: 0,
    unread: 0,
  })),
};
let application, page;
const errors = [];
const invoke = (method, params = {}) =>
  page.evaluate(({ method, params }) => window.interconnect.invoke(method, params), {
    method,
    params,
  });
const message = () => page.getByRole('textbox', { name: 'Message from the user', exact: true });
const recipient = () => page.getByRole('textbox', { name: 'Recipient agent name', exact: true });
const send = () => page.getByRole('button', { name: 'Send message', exact: true });
const open = (nickname) =>
  page.getByRole('button', { name: 'Open chat with ' + nickname, exact: true }).click();
async function close() {
  await page.getByRole('button', { name: 'Close chat', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
}
const until = async (predicate) => {
  const deadline = Date.now() + 10000;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error('Delayed send fixture timed out');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};
async function begin(text) {
  await recipient().fill('Target');
  await message().fill(text);
  await send().click();
  assert.equal(await invoke('fixturePending'), true);
}
async function complete(expected, success = true) {
  await invoke('fixtureFinishSend', { success });
  await until(async () => (await message().inputValue()) === expected);
  if (expected) await until(() => send().isEnabled());
}
try {
  const preload = path.join(temporary, 'preload.cjs'),
    main = path.join(temporary, 'main.cjs');
  await writeFile(
    preload,
    `
const{contextBridge}=require('electron');const snapshot=${JSON.stringify(snapshot)},calls=[];let pending=null;
contextBridge.exposeInMainWorld('interconnect',{
 invoke:async(method,params)=>{
  if(method==='snapshot')return snapshot;
  if(method==='appVersion')return 'draft-fixture';
  if(method==='chatHistory')return{messages:[],nextCursor:0,hasMore:false};
  if(method==='send'){
   if(pending)throw Error('A fixture send is already pending');calls.push(params);
   return new Promise((resolve,reject)=>{pending={resolve,reject};});
  }
  if(method==='fixturePending')return !!pending;
  if(method==='fixtureFinishSend'){
   if(!pending)throw Error('No fixture send is pending');const sent=pending;pending=null;
   if(params.success)sent.resolve({accepted:true});else sent.reject(Error('Synthetic send rejected'));
   return true;
  }
  if(method==='fixtureCalls')return calls;
  throw Error('Unexpected fixture operation '+method);
 },onChange:()=>()=>{},onNavigate:()=>()=>{}
});`,
  );
  await writeFile(
    main,
    `const{app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(temporary, 'profile'))});app.whenReady().then(()=>{const window=new BrowserWindow({width:1050,height:700,webPreferences:{preload:${JSON.stringify(preload)},contextIsolation:true,sandbox:true}});window.loadFile(${JSON.stringify(path.resolve('build/renderer/index.html'))});});app.on('window-all-closed',()=>app.quit());`,
  );
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  application = await electron.launch({
    executablePath: require('electron'),
    args: [main],
    cwd: temporary,
    env,
    timeout: 30000,
  });
  page = await application.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByTestId('nav-agents').click();
  await open(first);

  await begin('Unchanged sent draft');
  await complete('');

  await begin('Original draft');
  await message().fill('Edited while sending');
  await complete('Edited while sending');

  await begin('Same text restored');
  await message().fill('Intermediate edit');
  await message().fill('Same text restored');
  await complete('Same text restored');

  await begin('Recipient changed');
  await recipient().fill('Other target');
  await complete('Recipient changed');

  await begin('Reopened draft with identical text');
  await close();
  await open(first);
  await recipient().fill('Target');
  await message().fill('Reopened draft with identical text');
  await complete('Reopened draft with identical text');

  await begin('Same body in another chat');
  await close();
  await open(second);
  await recipient().fill('Target');
  await message().fill('Same body in another chat');
  await complete('Same body in another chat');
  assert.equal(await page.getByRole('dialog').getByRole('heading').innerText(), second);

  await begin('Failed send retains draft');
  await complete('Failed send retains draft', false);
  await page.getByRole('alert').filter({ hasText: 'Synthetic send rejected' }).waitFor();
  const calls = await invoke('fixtureCalls');
  assert.equal(calls.length, 7);
  assert.deepEqual(
    calls.map((call) => call.nickname),
    [first, first, first, first, first, first, second],
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      unchangedDraftCleared: true,
      editsPreserved: true,
      restoredTextPreserved: true,
      recipientChangePreserved: true,
      reopenedChatDraftPreserved: true,
      switchedChatDraftPreserved: true,
      failedSendDraftPreserved: true,
      sends: calls.length,
      syntheticOnly: true,
      errors,
    }),
  );
} finally {
  if (application) await application.close();
  await rm(temporary, { recursive: true, force: true });
}

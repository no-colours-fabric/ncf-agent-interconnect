import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createUiEnvironment } from './ui-test-profile.mjs';

// Synthetic renderer fixtures never start a node, client adapter or real agent.
const require = createRequire(import.meta.url);
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ncf-unified-agents-ui-'));
const local = randomUUID(),
  first = randomUUID(),
  second = randomUUID(),
  unsupported = randomUUID(),
  offline = randomUUID();
const stamp = '2026-11-01T12:00:00.000Z';
const machine = 'Duplicate machine Ж 漢字';
const literal = 'Literal <script>unsafe()</script> $& {name} ' + randomUUID();
const agent = {
  key: 'owner ж',
  nickname: 'Owner Ж',
  incarnation: randomUUID(),
  binding: {
    client: 'Codex',
    adapterId: 'fixture-adapter',
    connectionId: randomUUID(),
    chatId: 'exact-fixture',
    generation: 1,
  },
  unread: 1,
  messageCount: 230,
  incomingCount: 115,
  outgoingCount: 115,
  lastMessageAt: stamp,
};
const directories = [
  {
    nodeId: local,
    nodeLabel: 'Local $& {node}',
    local: true,
    state: 'ready',
    agents: [{ nickname: agent.nickname, availability: 'online', delivery: 'mcp' }],
  },
  {
    nodeId: first,
    nodeLabel: machine,
    local: false,
    state: 'ready',
    agents: [
      { nickname: 'Same agent', availability: 'online', delivery: 'mcp' },
      { nickname: 'Unknown agent', availability: 'unknown', delivery: 'unknown' },
    ],
  },
  {
    nodeId: second,
    nodeLabel: machine,
    local: false,
    state: 'ready',
    agents: [{ nickname: 'Same agent', availability: 'unknown', delivery: 'unknown' }],
  },
  {
    nodeId: unsupported,
    nodeLabel: 'Unsupported node',
    local: false,
    state: 'unsupported',
    agents: [],
  },
  { nodeId: offline, nodeLabel: 'Offline node', local: false, state: 'offline', agents: [] },
].map((directory) => ({
  epoch: directory.state === 'ready' ? randomUUID() : null,
  revision: 1,
  total: directory.agents.length,
  updatedAt: stamp,
  truncated: false,
  ...directory,
}));
const snapshot = {
  running: true,
  nodeId: local,
  nodeLabel: 'Local $& {node}',
  mcpUrl: '',
  peerUrl: '',
  listenHost: '127.0.0.1',
  localAddresses: ['127.0.0.1'],
  agents: [agent],
  directories,
  peers: directories
    .filter((directory) => !directory.local)
    .map((directory) => ({
      id: directory.nodeId,
      label: directory.nodeLabel,
      address: 'wss://fixture.invalid/peer',
      connected: directory.state !== 'offline',
      error: null,
    })),
  adapters: [
    {
      id: 'fixture-adapter',
      label: 'Private profile',
      kind: 'codex-desktop',
      state: 'uncertain',
      error: 'Private diagnostic',
      lastOwnerVerifiedAt: stamp,
      capabilities: {
        wakeIdle: false,
        receiveActive: false,
        nativeDisplay: false,
        exactSession: true,
      },
    },
  ],
  exportRoots: [],
  errors: [],
};
const messages = Array.from({ length: 230 }, (_, index) => ({
  sequence: index * 3 + 1,
  direction: index % 2 ? 'in' : 'out',
  state: 'ready',
  error: null,
  envelope: {
    protocol: 2,
    id: randomUUID(),
    fromNode: index % 2 ? first : local,
    toNode: local,
    fromNickname: index % 2 ? 'Same agent' : agent.nickname,
    toNickname: agent.nickname,
    createdAt: stamp,
    text: index === 229 ? literal : 'Message ' + index,
    replyTo: null,
    attachments:
      index === 229 ? [{ id: 'a'.repeat(64), name: 'data$&-{size}-漢字.txt', size: 1 }] : [],
  },
}));
let application, page;
const errors = [],
  screenshots = [];
const invoke = (method, params = {}) =>
  page.evaluate(({ method, params }) => window.interconnect.invoke(method, params), {
    method,
    params,
  });
const exactRow = (node, name) => page.locator(`[data-agent-id="${node}:${name.toLowerCase()}"]`);
const until = async (predicate) => {
  const deadline = Date.now() + 10000;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error('Unified agents fixture timed out');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};
async function capture(name) {
  const filename = 'release/unified-agents-' + name + '.png';
  await page.screenshot({ path: filename, animations: 'disabled' });
  screenshots.push(filename);
}
async function closeChat() {
  await page.getByRole('button', { name: /^(Close chat|Закрыть чат)$/ }).click();
  await until(async () => (await page.getByRole('dialog').count()) === 0);
}
try {
  await mkdir('release', { recursive: true });
  const preload = path.join(temporary, 'preload.cjs'),
    main = path.join(temporary, 'main.cjs');
  await writeFile(
    preload,
    `
const {contextBridge}=require('electron');
const snapshot=${JSON.stringify(snapshot)},messages=${JSON.stringify(messages)},calls=[],listeners=new Set();
contextBridge.exposeInMainWorld('interconnect', {
  invoke:async(method,params)=>{
    if(method==='snapshot')return snapshot;
    if(method==='appVersion')return '0.11.1-fixture';
    if(method==='aionUiStatus')return {state:'not-paired',url:'http://127.0.0.1:1'};
    if(method==='mcpSetupStatus')return {client:params.client,remembered:false,state:'missing',files:[{id:'configuration',path:'/isolated/cursor/mcp.json',state:'missing'}]};
    if(method==='chatHistory'){
      calls.push({method,...params});
      const selected=messages.filter(message=>!params.before||message.sequence<params.before).slice().reverse();
      const page=selected.slice(0,params.limit).reverse();
      return {messages:page,nextCursor:page[0]?.sequence??0,hasMore:selected.length>params.limit};
    }
    if(method==='send'||method==='openAttachment'||method==='saveAttachment'){calls.push({method,...params});return{accepted:true};}
    if(method==='fixtureCalls')return calls;
    if(method==='fixtureReplaceOwner'){
      snapshot.agents[0]={...snapshot.agents[0],incarnation:params.incarnation,messageCount:0};
      for(const listener of listeners)listener();return true;
    }
    if(method==='fixtureAppend'){
      messages.push(params);snapshot.agents[0].messageCount++;for(const listener of listeners)listener();return true;
    }
    throw Error('Unexpected fixture operation '+method);
  },onChange:(listener)=>{listeners.add(listener);return()=>listeners.delete(listener);},onNavigate:()=>()=>{}
});`,
  );
  await writeFile(
    main,
    `const{app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(temporary, 'profile'))});app.whenReady().then(()=>{const window=new BrowserWindow({width:1050,height:700,webPreferences:{preload:${JSON.stringify(preload)},contextIsolation:true,sandbox:true}});window.loadFile(${JSON.stringify(path.resolve('build/renderer/index.html'))});});app.on('window-all-closed',()=>app.quit());`,
  );
  const env = await createUiEnvironment(path.join(temporary, 'clients'));
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
  await page.getByText('v0.11.1-fixture', { exact: true }).waitFor();
  assert.equal(await page.getByRole('tab').count(), 0);
  assert.equal(await page.getByTestId('agent-row').count(), 4);
  assert.equal(await page.getByTestId('agents-table').locator('thead th').count(), 7);
  await page.getByRole('columnheader', { name: 'Messages', exact: true }).waitFor();
  assert.equal(
    await exactRow(local, agent.nickname)
      .getByRole('img', { name: 'In: 115', exact: true })
      .count(),
    1,
  );
  assert.equal(
    await exactRow(local, agent.nickname)
      .getByRole('img', { name: 'Out: 115', exact: true })
      .count(),
    1,
  );
  assert.equal(await page.getByTestId('agent-online').count(), 2);
  assert.equal(await exactRow(first, 'Same agent').getByTestId('agent-online').count(), 1);
  assert.equal(await exactRow(second, 'Same agent').getByTestId('agent-online').count(), 0);
  assert.equal(await exactRow(first, 'Unknown agent').getByTestId('agent-online').count(), 0);
  assert.equal(
    await exactRow(first, 'Same agent')
      .getByRole('button', { name: 'Delete Same agent and history', exact: true })
      .isDisabled(),
    true,
  );
  const firstName = await exactRow(first, 'Same agent').locator('td').nth(2).innerText();
  const secondName = await exactRow(second, 'Same agent').locator('td').nth(2).innerText();
  assert.notEqual(firstName, secondName);
  const languageBounds = await page.getByTestId('interface-language').boundingBox();
  const statusBounds = await page.getByTestId('sidebar-node-status').boundingBox();
  assert.ok(languageBounds.y + languageBounds.height <= statusBounds.y);
  assert.equal(await page.locator('header .MuiChip-root').count(), 0);
  await capture('table-en');
  await exactRow(local, agent.nickname)
    .getByRole('button', { name: 'Open chat with ' + agent.nickname, exact: true })
    .click();
  await page.getByText(literal, { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.unsafe), undefined);
  assert.equal(await page.getByTestId('chat-message').count(), 100);
  const history = page.getByTestId('agent-chat-history');
  assert.ok(
    await history.evaluate(
      (element) => element.scrollHeight - element.scrollTop - element.clientHeight < 3,
    ),
  );
  assert.equal(await page.getByTestId('chat-message').locator('.MuiAvatar-root').count(), 100);
  await history.evaluate((element) => {
    element.scrollTop = 0;
  });
  await until(async () => (await page.getByTestId('chat-message').count()) === 200);
  assert.ok(await history.evaluate((element) => element.scrollTop > 100));
  const sequences = await page
    .getByTestId('chat-message')
    .evaluateAll((elements) => elements.map((element) => Number(element.dataset.sequence)));
  assert.deepEqual(
    sequences,
    sequences.slice().sort((a, b) => a - b),
  );
  const topBefore = await history.evaluate((element) => element.scrollTop);
  await invoke('fixtureAppend', {
    ...messages[229],
    sequence: 1000,
    envelope: {
      ...messages[229].envelope,
      id: randomUUID(),
      text: 'New while reading history',
      attachments: [],
    },
  });
  await until(async () => (await page.getByTestId('chat-message').count()) === 201);
  assert.ok(Math.abs((await history.evaluate((element) => element.scrollTop)) - topBefore) < 3);
  await page.getByRole('button', { name: 'Load more messages', exact: true }).click();
  await until(async () => (await page.getByTestId('chat-message').count()) === 231);
  await history.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.getByRole('button', { name: 'Open data$&-{size}-漢字.txt', exact: true }).click();
  await page.getByRole('button', { name: 'Save data$&-{size}-漢字.txt', exact: true }).click();
  const attachmentCalls = (await invoke('fixtureCalls')).filter(
    ({ method }) => method === 'openAttachment' || method === 'saveAttachment',
  );
  assert.ok(
    attachmentCalls.every(
      (call) => call.messageId === messages[229].envelope.id && call.fileId === 'a'.repeat(64),
    ),
  );
  const ordinaryText = (await page.locator('body').innerText()).replaceAll(literal, '');
  for (const id of [local, first, second, unsupported, offline, agent.incarnation])
    assert.ok(!ordinaryText.includes(id));
  await capture('chat-en');
  await page.getByTestId('agent-chat-compose-toggle').click();
  await page
    .getByRole('textbox', { name: 'Recipient agent name', exact: true })
    .fill('Local recipient');
  await page
    .getByRole('textbox', { name: 'Message from the user', exact: true })
    .fill('Local exact send');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  assert.deepEqual(
    (await invoke('fixtureCalls')).find(({ method }) => method === 'send'),
    {
      method: 'send',
      nickname: agent.nickname,
      sourceIncarnation: agent.incarnation,
      recipientNode: local,
      recipientNickname: 'Local recipient',
      text: 'Local exact send',
    },
  );
  await closeChat();
  const historyCalls = (await invoke('fixtureCalls')).filter(
    ({ method }) => method === 'chatHistory',
  ).length;
  for (const [index, node] of [first, second].entries()) {
    await exactRow(node, 'Same agent')
      .getByRole('button', { name: 'Open chat with Same agent', exact: true })
      .click();
    assert.equal(await page.getByTestId('agent-chat-history').count(), 0);
    await page.getByRole('combobox', { name: 'Sender agent', exact: true }).click();
    await page.getByRole('option', { name: agent.nickname, exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Message from the user', exact: true })
      .fill('Remote exact send ' + index);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    const sent = (await invoke('fixtureCalls')).filter(({ method }) => method === 'send').at(-1);
    assert.equal(sent.recipientNode, node);
    assert.equal(sent.recipientNickname, 'Same agent');
    await closeChat();
  }
  assert.equal(
    (await invoke('fixtureCalls')).filter(({ method }) => method === 'chatHistory').length,
    historyCalls,
  );
  await page.getByTestId('nav-network').click();
  assert.equal(await page.getByTestId('remote-nodes-table').locator('tbody tr').count(), 4);
  assert.ok(!(await page.getByTestId('remote-nodes-table').innerText()).includes('Same agent'));
  assert.equal(await page.getByTestId('remote-nodes-table').getByRole('button').count(), 0);
  await capture('network-en');
  await page.getByTestId('nav-mcp').click();
  for (const [tab, kind, count] of [
    ['Cursor', 'manual', 0],
    ['OpenCode', 'opencode-http', 0],
    ['Codex', 'codex-desktop', 1],
    ['AionUi', 'aionui', 0],
  ]) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    const summary = page.getByTestId('application-' + kind);
    const text = await summary.innerText();
    assert.ok(!text.includes(agent.nickname));
    assert.ok(!text.includes('Private diagnostic'));
    assert.equal(
      await summary.locator('[data-testid="application-agent-count"]').innerText(),
      String(count),
    );
  }
  await page.getByTestId('aionui-setup').getByText('Not paired', { exact: true }).waitFor();
  assert.equal(
    await page.getByRole('tab', { name: 'AionUi', exact: true }).getAttribute('aria-selected'),
    'true',
  );
  await capture('applications-en');
  await page.getByTestId('interface-language').getByRole('combobox').click();
  await page.getByRole('option', { name: 'Русский', exact: true }).click();
  await page.getByTestId('nav-agents').click();
  await capture('table-ru');
  await exactRow(local, agent.nickname)
    .getByRole('button', { name: 'Открыть чат с ' + agent.nickname, exact: true })
    .click();
  await page.getByText(literal, { exact: true }).waitFor();
  await page.getByTestId('agent-chat-compose-toggle').click();
  await page
    .getByRole('textbox', { name: 'Сообщение от пользователя', exact: true })
    .fill('Stale draft');
  await invoke('fixtureReplaceOwner', { incarnation: randomUUID() });
  await until(async () => (await page.getByRole('dialog').count()) === 0);
  await exactRow(local, agent.nickname)
    .getByRole('button', { name: 'Открыть чат с ' + agent.nickname, exact: true })
    .click();
  await page.getByTestId('agent-chat-compose-toggle').click();
  assert.equal(
    await page
      .getByRole('textbox', { name: 'Сообщение от пользователя', exact: true })
      .inputValue(),
    '',
  );
  await closeChat();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      unifiedAgentTable: true,
      confirmedOnlineOnly: true,
      exactRemoteAddresses: true,
      latestHistoryAtBottom: true,
      reversePaginationAndScrollAnchor: true,
      avatarBubblesAndAttachments: true,
      incarnationInvalidatesDraft: true,
      nodeCountsOnly: true,
      applicationsActivityAndCounts: true,
      applicationRows: 4,
      aionUiSetupNavigation: true,
      sidebarVersionAndOrder: true,
      syntheticOnly: true,
      errors,
      screenshots,
    }),
  );
} finally {
  if (application) await application.close();
  await rm(temporary, { recursive: true, force: true });
}

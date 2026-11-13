import { waitForComposerTransition } from './ui-chat-composer.mjs';
import { verifyClientStatusPanel } from './ui-client-status-assertions.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { createUiEnvironment } from './ui-test-profile.mjs';

// Renderer-only fixtures. No node, adapter, live agent or client configuration is opened.
const require = createRequire(import.meta.url);
const iconPath = async (name) => {
  const source = await readFile(require.resolve('@mui/icons-material/' + name), 'utf8');
  const match = source.match(/\bd:\s*"([^"]+)"/);
  assert.ok(match, 'Installed icon must have a path: ' + name);
  return match[1];
};
const chatIconPath = await iconPath('ChatBubbleOutlineOutlined');
const deleteIconPath = await iconPath('DeleteOutlined');
const root = process.cwd();
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ncf-ui-redesign-'));
const output = path.join(root, 'release', 'ui-redesign');
const id = (value) => '10000000-0000-4000-8000-' + String(value).padStart(12, '0');
const local = id(1);
const remote = [id(2), id(3), id(4)];
const stamp = '2026-11-03T12:00:00.000Z';
const researcher = 'Researcher Ж';
const reviewer = 'Reviewer 漢字';
const agents = [
  [researcher, 'Codex', 'codex-desktop', 28, 12, 16, 10],
  [reviewer, 'Cursor', 'manual', 16, 9, 7, 11],
  ['Builder', 'OpenCode', 'opencode-http', 42, 21, 21, 12],
].map(([nickname, client, kind, messageCount, incomingCount, outgoingCount, seed]) => ({
  key: nickname.toLowerCase(),
  nickname,
  incarnation: id(seed),
  binding: {
    client,
    adapterId: id(seed + 10),
    connectionId: id(seed + 20),
    chatId: 'fixture-chat-' + seed,
    generation: 1,
  },
  unread: nickname === researcher ? 2 : 0,
  messageCount,
  incomingCount,
  outgoingCount,
  lastMessageAt: stamp,
  fixtureAdapterKind: kind,
}));
const directories = [
  {
    nodeId: local,
    nodeLabel: 'Design workstation',
    local: true,
    state: 'ready',
    agents: agents.map((agent) => ({
      nickname: agent.nickname,
      availability: 'online',
      delivery: 'mcp',
    })),
  },
  {
    nodeId: remote[0],
    nodeLabel: 'Build station',
    local: false,
    state: 'ready',
    agents: [
      { nickname: 'Remote reviewer', availability: 'online', delivery: 'mcp' },
      { nickname: 'Remote builder', availability: 'unknown', delivery: 'unknown' },
    ],
  },
  {
    nodeId: remote[1],
    nodeLabel: 'Test station',
    local: false,
    state: 'ready',
    agents: [{ nickname: 'Remote tester', availability: 'online', delivery: 'mcp' }],
  },
  {
    nodeId: remote[2],
    nodeLabel: 'Archive station',
    local: false,
    state: 'offline',
    agents: [],
  },
].map((directory, index) => ({
  epoch: directory.state === 'ready' ? id(50 + index) : null,
  revision: directory.state === 'ready' ? 1 : null,
  updatedAt: directory.state === 'ready' ? stamp : null,
  total: directory.agents.length,
  truncated: false,
  ...directory,
}));
const snapshot = {
  running: true,
  nodeId: local,
  nodeLabel: 'Design workstation',
  mcpUrl: 'http://127.0.0.1:42000/mcp',
  peerUrl: 'wss://127.0.0.1:7336/peer',
  listenHost: '127.0.0.1',
  localAddresses: ['127.0.0.1', '192.0.2.20'],
  agents: agents.map(({ fixtureAdapterKind: _kind, ...agent }) => agent),
  directories,
  peers: remote.map((nodeId, index) => ({
    id: nodeId,
    label: directories[index + 1].nodeLabel,
    address: 'wss://192.0.2.' + (30 + index) + ':7336/peer',
    connected: index !== 2,
    error: null,
  })),
  adapters: agents.map((agent) => ({
    id: agent.binding.adapterId,
    label: agent.binding.client + ' fixture',
    kind: agent.fixtureAdapterKind,
    state: 'ready',
    error: null,
    lastOwnerVerifiedAt: stamp,
    capabilities: {
      wakeIdle: false,
      receiveActive: false,
      nativeDisplay: false,
      exactSession: true,
    },
  })),
  exportRoots: [path.join(temporary, 'export', 'Design files Кириллица 漢字')],
  errors: [],
};
const messages = [
  ['out', researcher, reviewer, 'The transport review is ready.', 'ready'],
  ['in', reviewer, researcher, 'I will check the recovery path and attachments.', 'processed'],
  [
    'out',
    researcher,
    'Builder',
    'Please verify the desktop layout at the minimum window size.',
    'ready',
  ],
  ['in', 'Builder', researcher, 'Layout notes attached. Unicode: Москва 東京.', 'processed'],
].map(([direction, fromNickname, toNickname, text, state], index) => ({
  sequence: index + 1,
  direction,
  state,
  error: null,
  envelope: {
    protocol: 2,
    id: id(100 + index),
    fromNode: local,
    toNode: local,
    fromNickname,
    toNickname,
    createdAt: '2026-11-03T12:0' + index + ':00.000Z',
    text,
    replyTo: null,
    attachments:
      index === 3 ? [{ id: 'a'.repeat(64), name: 'layout-notes-漢字.txt', size: 2048 }] : [],
  },
}));
const clients = {
  cursor: { relative: '.cursor/mcp.json', state: 'configured', format: 'jsonc' },
  opencode: { relative: '.config/opencode/opencode.json', state: 'missing', format: 'jsonc' },
  codex: { relative: '.codex/config.toml', state: 'configured', format: 'toml' },
  aionui: { relative: '.cursor/mcp.json', state: 'needs-update', format: 'jsonc' },
};
const clientPaths = Object.fromEntries(
  Object.entries(clients).map(([client, value]) => [
    client,
    { ...value, path: path.join(temporary, 'clients', value.relative) },
  ]),
);
let application, page;
const errors = [];
const screenshots = [];
const results = [];

async function bounds(locator, label) {
  const result = await locator.boundingBox();
  assert.ok(result, label + ' must be visible');
  return result;
}
async function capture(name, width) {
  await page.mouse.move(1, 1);
  const filename = path.join(output, width + '-' + name + '.png');
  await page.screenshot({ path: filename, animations: 'disabled' });
  screenshots.push(filename);
}
async function verifyApplicationSummaries() {
  assert.equal(await page.getByTestId('nav-clients').count(), 0);
  for (const [client, kind] of [
    ['Cursor', 'manual'],
    ['OpenCode', 'opencode-http'],
    ['Codex', 'codex-desktop'],
    ['AionUi', 'aionui'],
    ['Claude Code', 'claude-code'],
  ]) {
    await page.getByRole('tab', { name: client, exact: true }).click();
    const expected = agents.filter((agent) => agent.fixtureAdapterKind === kind).length;
    await verifyClientStatusPanel(page, {
      kind,
      count: expected,
      activity: expected ? stamp : undefined,
    });
  }
  await page.getByRole('tab', { name: 'Cursor', exact: true }).click();
}
async function settled() {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => Number.isFinite(animation.effect?.getTiming().iterations))
        .map((animation) => animation.finished.catch(() => {})),
    ),
  );
}
async function resizeWindow(size) {
  const window = await application.browserWindow(page);
  await window.evaluate((window, size) => window.setContentSize(size.width, size.height), size);
  await page.waitForFunction(
    ({ width, height }) => innerWidth === width && innerHeight === height,
    size,
  );
  const native = await window.evaluate((window) => window.getContentBounds());
  const renderer = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  assert.equal(page.viewportSize(), null, 'Use native window resizing without viewport emulation');
  assert.equal(native.width, size.width, 'Native content width');
  assert.equal(native.height, size.height, 'Native content height');
  assert.deepEqual(renderer, size, 'Renderer must match native content bounds');
  return { native, renderer };
}
async function assertContained(locator, label) {
  const box = await bounds(locator, label);
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  assert.ok(
    box.x >= -1 && box.x + box.width <= viewport.width + 1,
    label + ' clipped horizontally',
  );
  assert.ok(
    box.y >= -1 && box.y + box.height <= viewport.height + 1,
    label + ' clipped vertically',
  );
}
async function assertLayout(name) {
  const content = await bounds(page.getByTestId('page-content'), 'Content container');
  const header = await bounds(page.getByTestId('header-content'), 'Header container');
  assert.ok(content.width <= 1201, name + ': content exceeds 1200px');
  assert.ok(Math.abs(content.x - header.x) < 1.5, name + ': header/content start differs');
  assert.ok(
    Math.abs(content.width - header.width) < 1.5,
    name + ': header/content width differs ' + JSON.stringify({ content, header }),
  );
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    name + ': document has horizontal overflow',
  );
  const wrapped = await page.locator('button:visible').evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
        const lines = new Set();
        let node;
        while ((node = walker.nextNode())) {
          if (!node.textContent.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) lines.add(Math.round(rect.top));
        }
        return lines.size > 1;
      })
      .map((button) => button.textContent.trim()),
  );
  assert.deepEqual(wrapped, [], name + ': buttons must keep one text line');
  const outside = await page.locator('button:visible').evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        // Table actions remain available through their own horizontal scroll area.
        if (button.closest('table')) return false;
        const rect = button.getBoundingClientRect();
        return rect.left < -1 || rect.right > innerWidth + 1;
      })
      .map((button) => button.textContent.trim() || button.getAttribute('aria-label')),
  );
  assert.deepEqual(outside, [], name + ': buttons must remain within the window width');
  return content;
}

try {
  await mkdir(output, { recursive: true });
  const preload = path.join(temporary, 'preload.cjs');
  const main = path.join(temporary, 'main.cjs');
  await writeFile(
    preload,
    `
const {contextBridge}=require('electron');
const snapshot=${JSON.stringify(snapshot)},messages=${JSON.stringify(messages)},clients=${JSON.stringify(clientPaths)},calls=[];
const listeners=new Set();
contextBridge.exposeInMainWorld('interconnect',{
  invoke:async(method,params={})=>{
    calls.push({method,...params});
    if(method==='snapshot')return snapshot;
    if(method==='appVersion')return '0.13.0-design-fixture';
    if(method==='loginState')return {supported:true,openAtLogin:false};
    if(method==='aionUiStatus')return {state:'not-paired',url:'http://127.0.0.1:25808',bridgeConnected:false};
    if(method==='mcpSetupStatus'){
      const file=clients[params.client];
      return {client:params.client,remembered:true,state:file.state,files:[{id:'configuration',path:file.path,state:file.state}]};
    }
    if(method==='mcpSetupDefaults'){
      const file=clients[params.client];
      return {client:params.client,files:[{id:'configuration',path:file.path,format:file.format,alternatives:params.client==='opencode'?[file.path,file.path+'c']:[]}]};
    }
    if(method==='mcpSetupPreview')return {client:params.client,planId:'fixture-plan-'+params.client,expiresAt:'2099-01-01T00:00:00.000Z',requiresReplacement:false,files:params.files.map(file=>({...file,action:clients[params.client].state==='configured'?'unchanged':'create',changes:[]}))};
    if(method==='mcpSetupDiscard')return {};
    if(method==='chatHistory'){
      const selected=messages.filter(message=>!params.before||message.sequence<params.before).slice().reverse();
      const found=selected.slice(0,params.limit).reverse();
      return {messages:found,nextCursor:found[0]?.sequence??0,hasMore:selected.length>params.limit};
    }
    if(method==='fixtureCalls')return calls;
    if(method==='copy')return {copied:true};
    throw Error('Unexpected redesign fixture operation '+method);
  },
  onChange:(listener)=>{listeners.add(listener);return()=>listeners.delete(listener);},
  onNavigate:()=>()=>{}
});`,
    { mode: 0o600 },
  );
  await writeFile(
    main,
    `const{app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(temporary, 'profile'))});app.whenReady().then(()=>{const window=new BrowserWindow({width:1440,height:900,enableLargerThanScreen:true,webPreferences:{preload:${JSON.stringify(preload)},contextIsolation:true,sandbox:true}});window.loadFile(${JSON.stringify(path.join(root, 'build/renderer/index.html'))});});app.on('window-all-closed',()=>app.quit());`,
    { mode: 0o600 },
  );
  application = await electron.launch({
    executablePath: require('electron'),
    args: [main],
    cwd: temporary,
    env: await createUiEnvironment(path.join(temporary, 'clients')),
    timeout: 30000,
  });
  page = await application.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByTestId('page-title').waitFor();

  for (const viewport of [
    { width: 900, height: 620 },
    { width: 1440, height: 900 },
    { width: 2560, height: 1100 },
  ]) {
    const windowSize = await resizeWindow(viewport);
    for (const screen of ['overview', 'agents', 'network', 'mcp', 'settings']) {
      await page.getByTestId('nav-' + screen).click();
      await settled();
      const content = await assertLayout(screen);
      if (screen === 'agents') {
        const table = page.getByTestId('agents-table');
        assert.equal(await page.getByRole('dialog').count(), 0, 'Agents must open without chat');
        assert.equal(await table.getByRole('columnheader').count(), 6);
        assert.equal(
          await table.locator('thead th').count(),
          7,
          'Includes the unnamed node-kind column',
        );
        assert.equal(await table.locator('thead th').nth(2).innerText(), '');
        assert.equal(await table.getByTestId('agent-node-kind').count(), 6);
        assert.equal(await page.getByTestId('agent-row').count(), 6);
        const owner = page.locator(`[data-agent-id="${local}:${researcher.toLowerCase()}"]`);
        assert.equal(await owner.getByRole('img', { name: 'In: 12', exact: true }).count(), 1);
        assert.equal(await owner.getByRole('img', { name: 'Out: 16', exact: true }).count(), 1);
        for (const [label, icon] of [
          ['Outline chat', chatIconPath],
          ['Delete', deleteIconPath],
        ]) {
          assert.equal(
            await table
              .locator('button svg path')
              .evaluateAll(
                (paths, expected) =>
                  paths.filter((path) => path.getAttribute('d') === expected).length,
                icon,
              ),
            6,
            label + ': every row must keep the installed Material UI icon',
          );
        }
        const remoteRow = page.locator(`[data-agent-id="${remote[0]}:remote reviewer"]`);
        assert.ok(
          await remoteRow
            .getByRole('button', { name: 'Delete Remote reviewer and history', exact: true })
            .isDisabled(),
        );
        await capture('agents', viewport.width);
        await owner
          .getByRole('button', { name: 'Open chat with ' + researcher, exact: true })
          .click();
        const dialog = page.getByRole('dialog', { name: researcher, exact: true });
        await dialog
          .getByText('Layout notes attached. Unicode: Москва 東京.', { exact: true })
          .waitFor();
        await settled();
        const drawer = await bounds(dialog, 'Chat drawer');
        assert.ok(
          Math.abs(drawer.x + drawer.width - viewport.width) < 1.5,
          'Drawer must align with window right edge: ' + JSON.stringify({ drawer, viewport }),
        );
        const toggle = dialog.getByTestId('agent-chat-compose-toggle');
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        await toggle.click();
        await waitForComposerTransition(page);
        await settled();
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
        await assertContained(page.getByTestId('agent-chat-compose'), 'Chat composer');
        await assertContained(
          dialog.getByRole('button', { name: 'Send message', exact: true }),
          'Send action',
        );
        assert.equal(await dialog.getByTestId('chat-message').count(), 4);
        assert.equal(
          await dialog
            .getByRole('button', { name: 'Open layout-notes-漢字.txt', exact: true })
            .count(),
          1,
        );
        assert.equal(
          await dialog
            .getByRole('button', { name: 'Save layout-notes-漢字.txt', exact: true })
            .count(),
          1,
        );
        await capture('chat', viewport.width);
        await dialog.getByRole('button', { name: 'Close chat', exact: true }).click();
        await dialog.waitFor({ state: 'detached' });
        continue;
      }
      if (screen === 'network') {
        const table = page.getByTestId('remote-nodes-table');
        const forms = await bounds(page.getByTestId('network-forms'), 'Network forms');
        const tableBox = await bounds(table.locator('..'), 'Remote nodes table container');
        assert.equal(await table.locator('tbody tr').count(), 3);
        assert.equal(await table.getByRole('columnheader').count(), 5);
        assert.ok(
          tableBox.y >= forms.y + forms.height - 1,
          'Remote nodes table must follow the forms',
        );
        assert.ok(Math.abs(tableBox.x - content.x) < 2, 'Remote table must start at content edge');
        assert.ok(
          Math.abs(tableBox.width - content.width) < 2,
          'Remote table must span content container',
        );
      }
      if (screen === 'mcp') {
        assert.equal(await page.getByRole('tab').count(), 5);
        await verifyApplicationSummaries();
        await page.getByTestId('mcp-settings-status').waitFor();
        await capture('mcp', viewport.width);
        await page.getByTestId('mcp-configure-cursor').click();
        const dialog = page.getByRole('dialog', { name: 'Configure Cursor', exact: true });
        await page.waitForFunction(() => {
          const button = document.querySelector('[data-testid="mcp-apply"]');
          return button && !button.disabled;
        });
        await assertContained(dialog, 'MCP setup dialog');
        await assertContained(dialog.getByTestId('mcp-apply'), 'MCP Apply action');
        assert.equal(await dialog.locator('pre, textarea, [contenteditable="true"]').count(), 0);
        await capture('mcp-dialog', viewport.width);
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        await dialog.waitFor({ state: 'detached' });
        continue;
      }
      await capture(screen, viewport.width);
    }
    results.push({
      ...viewport,
      windowSize,
      screens: 5,
      applicationSummariesInMcp: 5,
      drawerAtWindowEdge: true,
      composerVisible: true,
    });
  }
  await resizeWindow({ width: 900, height: 620 });
  for (const [locale, label] of [
    ['ru', 'Русский'],
    ['de', 'Deutsch'],
  ]) {
    await page.getByTestId('interface-language').getByRole('combobox').click();
    await page.getByRole('option', { name: label, exact: true }).click();
    assert.equal(await page.locator('html').getAttribute('lang'), locale);
    for (const screen of ['network', 'mcp']) {
      await page.getByTestId('nav-' + screen).click();
      await settled();
      await assertLayout(locale + '-' + screen);
      await capture(locale + '-' + screen, 900);
      if (screen === 'mcp') {
        await page.getByTestId('mcp-configure-cursor').click();
        const dialog = page.getByRole('dialog');
        await page.waitForFunction(() => {
          const button = document.querySelector('[data-testid="mcp-apply"]');
          return button && !button.disabled;
        });
        await assertContained(dialog, locale + ': MCP dialog');
        await assertContained(dialog.getByTestId('mcp-apply'), locale + ': MCP Apply action');
        await assertLayout(locale + '-mcp-dialog');
        await capture(locale + '-mcp-dialog', 900);
        await dialog.locator('.MuiDialogActions-root').getByRole('button').first().click();
        await dialog.waitFor({ state: 'detached' });
      }
    }
    results.push({ width: 900, height: 620, locale, screens: 2, dialogContained: true });
  }
  assert.deepEqual(errors, []);
  const calls = await page.evaluate(() => window.interconnect.invoke('fixtureCalls'));
  assert.ok(
    !calls.some(({ method }) =>
      ['mcpSetupApply', 'aionUiPair', 'accessCode', 'connectPeer', 'send'].includes(method),
    ),
    'Visual checks must not invoke state-changing operations',
  );
  console.log(
    JSON.stringify(
      { syntheticOnly: true, contentMaxWidth: 1200, results, errors, screenshots },
      null,
      2,
    ),
  );
} catch (error) {
  if (page) {
    const filename = path.join(output, 'failure.png');
    await page.screenshot({ path: filename, animations: 'disabled' }).catch(() => {});
    console.error('UI redesign fixture screenshot: ' + filename);
  }
  console.error('Renderer errors:', errors);
  throw error;
} finally {
  if (application) await application.close();
  await rm(temporary, { recursive: true, force: true });
}

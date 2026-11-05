import { waitForComposerTransition } from './ui-chat-composer.mjs';
import { verifyClientStatusPanel } from './ui-client-status-assertions.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { createUiEnvironment } from './ui-test-profile.mjs';

// Synthetic renderer only. The fixture neither starts a node nor opens client configurations.
const require = createRequire(import.meta.url);
const root = process.cwd();
const chatLayoutOnly = process.argv.includes('--chat-layout-only');
const statusOnly = process.argv.includes('--status-only');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ncf-apps-chat-'));
const output = path.join(root, 'release', 'ui-apps-chat');
const id = (value) => '20000000-0000-4000-8000-' + String(value).padStart(12, '0');
const local = id(1),
  remote = id(2);
const owner = 'Owner Ж',
  second = 'Second 漢字',
  otherManual = 'Generic MCP 漢字',
  target = 'Remote reviewer';
const stamp = '2026-11-04T10:00:00.000Z';
const snapshot = {
  running: true,
  nodeId: local,
  nodeLabel: 'UI workstation',
  mcpUrl: 'http://127.0.0.1:42000/mcp',
  peerUrl: 'wss://127.0.0.1:7336/peer',
  listenHost: '127.0.0.1',
  localAddresses: ['127.0.0.1'],
  exportRoots: [],
  errors: [],
  agents: [owner, second, otherManual].map((nickname, index) => ({
    key: nickname.toLowerCase(),
    nickname,
    incarnation: id(index + 10),
    binding: {
      client: index === 0 ? 'Cursor' : index === 1 ? 'Codex' : 'Generic MCP',
      adapterId: id(index === 2 ? 24 : index + 20),
      connectionId: id(index + 30),
      chatId: 'fixture-' + index,
      generation: 1,
    },
    unread: 0,
    messageCount: index ? 0 : 12,
    incomingCount: index ? 0 : 7,
    outgoingCount: index ? 0 : 5,
    lastMessageAt: index ? null : stamp,
  })),
  adapters: ['manual', 'codex-desktop', 'opencode-http', 'aionui', 'manual'].map((kind, index) => ({
    id: id(index + 20),
    kind,
    label: kind,
    state: 'ready',
    error: null,
    lastOwnerVerifiedAt: index === 2 ? stamp : null,
    capabilities: {
      wakeIdle: false,
      receiveActive: false,
      nativeDisplay: false,
      exactSession: true,
    },
  })),
  peers: [
    {
      id: remote,
      label: 'Review station',
      address: 'wss://192.0.2.30:7336/peer',
      connected: true,
      error: null,
    },
  ],
  directories: [
    {
      nodeId: local,
      nodeLabel: 'UI workstation',
      local: true,
      state: 'ready',
      agents: [
        { nickname: owner, availability: 'online', delivery: 'mcp' },
        { nickname: second, availability: 'unknown', delivery: 'unknown' },
        { nickname: otherManual, availability: 'unknown', delivery: 'unknown' },
      ],
    },
    {
      nodeId: remote,
      nodeLabel: 'Review station',
      local: false,
      state: 'ready',
      agents: [{ nickname: target, availability: 'online', delivery: 'mcp' }],
    },
  ].map((directory) => ({
    ...directory,
    epoch: id(40),
    revision: 1,
    updatedAt: stamp,
    total: directory.agents.length,
    truncated: false,
  })),
};
const messages = Array.from({ length: 28 }, (_, index) => ({
  sequence: index + 1,
  direction: index % 2 ? 'in' : 'out',
  state: 'received',
  error: null,
  envelope: {
    protocol: 2,
    id: id(100 + index),
    fromNode: local,
    toNode: local,
    fromNickname: index % 2 ? second : owner,
    toNickname: index % 2 ? owner : second,
    createdAt: stamp,
    text:
      'Review ' +
      index +
      ': exact delivery, Unicode Москва 東京.\n' +
      'Preserve the visible message and its offset. '.repeat((index % 3) + 1),
    replyTo: null,
    attachments: [],
  },
}));
const clients = Object.fromEntries(
  ['cursor', 'opencode', 'codex', 'aionui'].map((client) => [
    client,
    {
      path: path.join(
        temporary,
        'clients',
        client,
        client === 'codex' ? 'config.toml' : 'mcp.json',
      ),
      format: client === 'codex' ? 'toml' : 'jsonc',
      state: {
        cursor: 'configured',
        opencode: 'not-configured',
        codex: 'unavailable',
        aionui: 'needs-update',
      }[client],
    },
  ]),
);
let application, page;
const errors = [],
  screenshots = [],
  results = [];
const invoke = (method, params = {}) =>
  page.evaluate(({ method, params }) => window.interconnect.invoke(method, params), {
    method,
    params,
  });
const dialog = () => page.getByRole('dialog');
const composer = () => page.getByTestId('agent-chat-compose');
const message = () => dialog().getByRole('textbox', { name: 'Message from the user', exact: true });
const recipient = () =>
  dialog().getByRole('textbox', { name: 'Recipient agent name', exact: true });
async function until(predicate, label) {
  const deadline = Date.now() + 10000;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error('Timed out: ' + label);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
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
async function resize(width, height) {
  const nativeWindow = await application.browserWindow(page);
  await nativeWindow.evaluate((window, size) => window.setContentSize(size.width, size.height), {
    width,
    height,
  });
  await page.waitForFunction(
    ({ width, height }) => innerWidth === width && innerHeight === height,
    { width, height },
  );
  const native = await nativeWindow.evaluate((window) => window.getContentBounds());
  const dom = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.equal(page.viewportSize(), null);
  assert.equal(native.width, width);
  assert.equal(native.height, height);
  assert.equal(dom.width, width);
  assert.equal(dom.height, height);
  assert.ok(dom.scrollWidth <= dom.width);
  return { native, dom };
}
async function contained(locator, name) {
  const bounds = await locator.boundingBox();
  assert.ok(bounds, name + ' exists');
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  assert.ok(
    bounds.x >= -1 && bounds.x + bounds.width <= viewport.width + 1,
    name + ' horizontal bounds',
  );
  assert.ok(
    bounds.y >= -1 && bounds.y + bounds.height <= viewport.height + 1,
    name + ' vertical bounds',
  );
  return bounds;
}
async function capture(name) {
  await page.mouse.move(1, 1);
  await settled();
  const filename = path.join(output, name + '.png');
  await page.screenshot({ path: filename, animations: 'disabled' });
  screenshots.push(filename);
}
async function sampleReadingAnchor(history, action) {
  const before = await history.evaluate((element) => {
    const viewport = element.getBoundingClientRect();
    const anchor = [...element.querySelectorAll('[data-message-key]')].find((row) => {
      const bounds = row.getBoundingClientRect();
      return bounds.bottom > viewport.top && bounds.top < viewport.bottom;
    });
    if (!anchor) throw Error('No visible history anchor');
    element.dataset.fixtureInstance = 'unchanged';
    const key = anchor.dataset.messageKey;
    const offset = anchor.getBoundingClientRect().top - viewport.top;
    window.__appsAnchorFrames = [];
    window.__appsAnchorSampling = true;
    requestAnimationFrame(function tick() {
      const row = [...element.querySelectorAll('[data-message-key]')].find(
        (item) => item.dataset.messageKey === key,
      );
      window.__appsAnchorFrames.push({
        key,
        offset: row ? row.getBoundingClientRect().top - element.getBoundingClientRect().top : null,
        connected: element.isConnected,
      });
      if (window.__appsAnchorSampling) requestAnimationFrame(tick);
    });
    return { key, offset };
  });
  await action();
  await settled();
  const frames = await page.evaluate(() => {
    window.__appsAnchorSampling = false;
    return window.__appsAnchorFrames;
  });
  assert.ok(frames.length > 0);
  assert.ok(frames.every((frame) => frame.connected && frame.offset !== null));
  const maxJump = Math.max(...frames.map((frame) => Math.abs(frame.offset - before.offset)));
  assert.ok(maxJump <= 1, 'Visible UUID:direction anchor moved: ' + maxJump);
  assert.equal(await history.getAttribute('data-fixture-instance'), 'unchanged');
  return { ...before, frames: frames.length, maxJump };
}
async function instrumentResizeObserver() {
  await page.evaluate(() => {
    const NativeResizeObserver = window.ResizeObserver;
    const registrations = new WeakMap();
    const identities = new WeakMap();
    let nextObserver = 0,
      nextTarget = 0,
      sequence = 0;
    const identity = (target) => {
      if (!identities.has(target)) identities.set(target, ++nextTarget);
      return identities.get(target);
    };
    window.__appsResizeRegistrations = [];
    window.__appsViewportRun = null;
    window.__appsRecordViewport = (phase, observerId = null) => {
      const run = window.__appsViewportRun;
      if (!run) return;
      const element = run.element;
      const target = [...element.querySelectorAll('[data-message-key]')].find(
        (item) => item.dataset.messageKey === run.key,
      );
      const sample = {
        seq: ++sequence,
        phase,
        observerId,
        targetInstance: identity(element),
        connected: element.isConnected,
        height: element.clientHeight,
        gap: element.scrollHeight - element.scrollTop - element.clientHeight,
        offset: target
          ? target.getBoundingClientRect().top - element.getBoundingClientRect().top
          : null,
      };
      run.samples.push(sample);
      return sample;
    };
    // Invoke the native product callback once with unchanged entries and receiver.
    // Measurements never move scroll, reconcile layout or wait for a good value.
    window.ResizeObserver = class extends NativeResizeObserver {
      constructor(callback) {
        const observerId = ++nextObserver;
        super(function (entries, observer) {
          const run = window.__appsViewportRun;
          const measuresHistory = !!run && entries.some((entry) => entry.target === run.element);
          if (measuresHistory) window.__appsRecordViewport('productRO:start', observerId);
          try {
            callback.call(observer, entries, observer);
          } finally {
            if (measuresHistory) window.__appsRecordViewport('productRO:return', observerId);
          }
        });
        registrations.set(this, observerId);
      }
      observe(target, options) {
        if (target.dataset?.testid === 'agent-chat-history') {
          window.__appsResizeRegistrations.push({
            seq: ++sequence,
            phase: 'observe',
            observerId: registrations.get(this),
            targetInstance: identity(target),
          });
        }
        return super.observe(target, options);
      }
    };
    window.__appsViewportTargetIdentity = identity;
  });
}
async function sampleViewportChange(history, mode, action) {
  const before = await history.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const row = [...element.querySelectorAll('[data-message-key]')].find((item) => {
      const bounds = item.getBoundingClientRect();
      return bounds.bottom > rect.top && bounds.top < rect.bottom;
    });
    if (!row) throw Error('No visible history anchor');
    window.__appsViewportRun = {
      element,
      key: row.dataset.messageKey,
      samples: [],
      sampling: true,
    };
    const activeRun = window.__appsViewportRun;
    const sample = window.__appsRecordViewport('before');
    requestAnimationFrame(function tick() {
      if (window.__appsViewportRun !== activeRun || !activeRun.sampling) return;
      window.__appsRecordViewport('rawRAF');
      requestAnimationFrame(tick);
    });
    return { ...sample, key: row.dataset.messageKey };
  });
  await action();
  await settled();
  const { samples, registrations } = await page.evaluate(() => {
    window.__appsRecordViewport('settled');
    const run = window.__appsViewportRun;
    run.sampling = false;
    const result = {
      samples: run.samples,
      registrations: window.__appsResizeRegistrations.filter(
        (item) => item.targetInstance === window.__appsViewportTargetIdentity(run.element),
      ),
    };
    window.__appsViewportRun = null;
    return result;
  });
  const deviation = (sample) =>
    Math.abs(mode === 'bottom' ? sample.gap : sample.offset - before.offset);
  const raw = samples.filter((sample) => sample.phase === 'rawRAF');
  const post = samples.filter((sample) => sample.phase === 'productRO:return');
  const checked = [...post, samples.at(-1)];
  assert.ok(post.length > 0, 'The active product ResizeObserver callback must run');
  assert.ok(post.length <= 4, 'Viewport changes must not create a ResizeObserver loop');
  assert.ok(
    post.every((sample) =>
      registrations.some((registration) => registration.observerId === sample.observerId),
    ),
    'Post samples must come from the callback of an observer that actually observed this history node',
  );
  assert.ok(
    post.every((sample) =>
      samples.some(
        (start) =>
          start.phase === 'productRO:start' &&
          start.observerId === sample.observerId &&
          start.seq === sample.seq - 1,
      ),
    ),
    'Callback return must be measured synchronously after its actual start',
  );
  const stableDOM = samples.every(
    (sample) =>
      sample.connected && sample.targetInstance === before.targetInstance && sample.offset !== null,
  );
  const maxRawDeviation = Math.max(...raw.map(deviation));
  const maxPostDeviation = Math.max(...checked.map(deviation));
  return {
    mode,
    before,
    after: samples.at(-1),
    rawFrames: raw.length,
    productCallbacks: post.length,
    registrations,
    stableDOM,
    maxRawDeviation,
    maxPostDeviation,
    samples,
    pass: stableDOM && maxPostDeviation <= 1,
  };
}
async function openChat(name) {
  await page.getByRole('button', { name: 'Open chat with ' + name, exact: true }).click();
  await dialog().waitFor();
  await settled();
}
async function closeChat(escape = false) {
  if (escape) await page.keyboard.press('Escape');
  else await dialog().getByRole('button', { name: 'Close chat', exact: true }).click();
  await dialog().waitFor({ state: 'detached' });
}
const state = (client) => page.locator('#mcp-tab-' + client + ' [data-mcp-state]');
const overviewState = (client) =>
  page.getByTestId('overview-application-' + client).locator('[data-mcp-state]');

try {
  await mkdir(output, { recursive: true });
  const preload = path.join(temporary, 'preload.cjs'),
    main = path.join(temporary, 'main.cjs');
  await writeFile(
    preload,
    `
const {contextBridge}=require('electron');
const snapshot=${JSON.stringify(snapshot)},messages=${JSON.stringify(messages)},clients=${JSON.stringify(clients)},calls=[];
const changes=new Set();let waiting=[],holdOpenCode=true,codexError=true,failedStatusClient=null,holdNextSend=false,pendingSend=null,holdOldCursorStatus=false,oldCursorStatus=null,statusRace=false,statusRaceRequests=0;
const status=client=>({client,remembered:true,state:clients[client].state,files:[{id:'configuration',path:clients[client].path,state:clients[client].state}]});
contextBridge.exposeInMainWorld('interconnect',{
 invoke:async(method,params={})=>{
  calls.push({method,...params});
  if(method==='snapshot')return snapshot;
  if(method==='appVersion')return '0.14.0-apps-chat-fixture';
  if(method==='loginState')return {supported:true,openAtLogin:false};
  if(method==='aionUiStatus')return {state:'not-paired',url:'http://127.0.0.1:1',bridgeConnected:false};
  if(method==='mcpSetupStatus'){
   if(statusRace&&params.client==='cursor')++statusRaceRequests;
   if(holdOldCursorStatus&&params.client==='cursor'){
    holdOldCursorStatus=false;const captured=status('cursor');
    return new Promise(resolve=>{oldCursorStatus={resolve,captured};});
   }
   if(params.client===failedStatusClient)throw Error('Synthetic selected status rejected');
   if(params.client==='opencode'&&holdOpenCode)return new Promise(resolve=>waiting.push(()=>resolve(status('opencode'))));
   if(params.client==='codex'&&codexError)throw Error('Synthetic status unavailable');
   return status(params.client);
  }
  if(method==='mcpSetupDefaults')return {client:params.client,files:[{id:'configuration',path:clients[params.client].path,format:clients[params.client].format,alternatives:[]}]};
  if(method==='mcpSetupPreview')return {client:params.client,planId:'plan-'+params.client,expiresAt:'2099-01-01T00:00:00.000Z',requiresReplacement:params.client==='aionui',files:params.files.map(file=>({...file,action:'update',changes:[]}))};
  if(method==='mcpSetupApply'){
   const client=params.planId.slice(5);clients[client].state='configured';
   if(client==='aionui')clients.cursor.state='needs-update';
   if(client==='cursor')clients.aionui.state='needs-update';
   return {status:'applied',files:[{path:clients[client].path,status:'updated'}]};
  }
  if(method==='mcpSetupDiscard'||method==='copy')return {};
  if(method==='chatHistory')return {messages:messages.filter(message=>message.envelope.fromNickname===params.nickname||message.envelope.toNickname===params.nickname),nextCursor:1,hasMore:false};
  if(method==='send'){
   if(holdNextSend){holdNextSend=false;return new Promise((resolve,reject)=>{pendingSend={resolve,reject};});}
   return {accepted:true};
  }
  if(method==='fixtureHoldNextSend'){holdNextSend=true;return true;}
  if(method==='fixtureFailClientStatus'){failedStatusClient=params.client;return true;}
  if(method==='fixtureRecoverClientStatus'){failedStatusClient=null;return true;}
  if(method==='fixtureArmStatusRace'){statusRace=true;statusRaceRequests=0;holdOldCursorStatus=true;failedStatusClient='cursor';return true;}
  if(method==='fixtureStatusRace')return {requests:statusRaceRequests,pending:!!oldCursorStatus};
  if(method==='fixtureReleaseOldStatus'){if(!oldCursorStatus)throw Error('No held old status');oldCursorStatus.resolve(oldCursorStatus.captured);oldCursorStatus=null;return true;}
  if(method==='fixtureRejectSend'){if(!pendingSend)throw Error('No pending fixture send');pendingSend.reject(Error('Synthetic collapsed send rejected'));pendingSend=null;return true;}
  if(method==='fixtureReleaseStatuses'){holdOpenCode=false;for(const release of waiting)release();waiting=[];return true;}
  if(method==='fixtureCalls')return calls;
  if(method==='fixtureResetCalls'){calls.length=0;return true;}
  throw Error('Unexpected apps/chat fixture operation '+method);
 },onChange:listener=>{changes.add(listener);return()=>changes.delete(listener);},onNavigate:()=>()=>{}
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
    env: await createUiEnvironment(path.join(temporary, 'home')),
    timeout: 30000,
  });
  page = await application.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByTestId('overview-applications').waitFor();
  await until(
    async () => (await overviewState('cursor').getAttribute('data-mcp-state')) === 'configured',
    'initial configured',
  );
  assert.equal(await overviewState('opencode').getAttribute('data-mcp-state'), 'unknown');
  await until(
    async () => (await overviewState('codex').getAttribute('data-mcp-state')) === 'unavailable',
    'status error',
  );
  assert.equal(await overviewState('aionui').getAttribute('data-mcp-state'), 'needs-update');
  await invoke('fixtureReleaseStatuses');
  await until(
    async () =>
      (await overviewState('opencode').getAttribute('data-mcp-state')) === 'not-configured',
    'initial not configured',
  );
  assert.equal(await page.locator('aside > .MuiStack-root svg').count(), 0, 'Brand mark removed');
  assert.equal(await page.locator('[data-testid^="nav-"]').count(), 5);
  assert.equal(await page.getByTestId('nav-clients').count(), 0);
  results.push({
    statuses: ['configured', 'unknown', 'not-configured', 'needs-update', 'unavailable'],
    initialReadOnly: !(await invoke('fixtureCalls')).some(({ method }) =>
      /Apply|Pair|send/.test(method),
    ),
  });

  if (statusOnly) {
    assert.equal(await overviewState('cursor').getAttribute('data-mcp-state'), 'configured');
    await invoke('fixtureFailClientStatus', { client: 'cursor' });
    await page.getByTestId('nav-mcp').click();
    await page
      .getByRole('alert')
      .filter({ hasText: 'Synthetic selected status rejected' })
      .waitFor();
    await settled();
    const tab = await state('cursor').getAttribute('data-mcp-state');
    const chip = await page.getByRole('tabpanel').locator('.MuiChip-label').innerText();
    await page.getByTestId('nav-overview').click();
    const overview = await overviewState('cursor').getAttribute('data-mcp-state');
    results.push({ selectedRefreshRejected: { tab, chip, overview } });
    await writeFile(
      path.join(output, 'status-observations.json'),
      JSON.stringify(results, null, 2),
    );
    await capture('status-only');
    assert.notEqual(
      tab,
      'configured',
      'A rejected current status must invalidate the configured tab',
    );
    assert.notEqual(
      overview,
      'configured',
      'Overview must not preserve stale configured after selected status failure',
    );
    assert.equal(chip, 'Could not check settings');
    await invoke('fixtureRecoverClientStatus');
    await page.getByTestId('nav-mcp').click();
    await until(
      async () => (await state('cursor').getAttribute('data-mcp-state')) === 'configured',
      'recovered current status',
    );
    await page.getByTestId('nav-overview').click();
    assert.equal(await overviewState('cursor').getAttribute('data-mcp-state'), 'configured');
    await invoke('fixtureArmStatusRace');
    await page.getByTestId('nav-mcp').click();
    await until(
      async () => (await invoke('fixtureStatusRace')).requests >= 2,
      'older selected and newer shared status requests',
    );
    await until(
      async () => (await state('cursor').getAttribute('data-mcp-state')) === 'unavailable',
      'newer status rejection',
    );
    const race = await invoke('fixtureStatusRace');
    assert.equal(race.pending, true);
    await invoke('fixtureReleaseOldStatus');
    await settled();
    const afterOldSuccess = {
      tab: await state('cursor').getAttribute('data-mcp-state'),
      chip: await page.getByRole('tabpanel').locator('.MuiChip-label').innerText(),
    };
    await page.getByTestId('nav-overview').click();
    afterOldSuccess.overview = await overviewState('cursor').getAttribute('data-mcp-state');
    results.push({ staleSelectedSuccess: { requests: race.requests, ...afterOldSuccess } });
    await writeFile(
      path.join(output, 'status-observations.json'),
      JSON.stringify(results, null, 2),
    );
    assert.equal(
      afterOldSuccess.tab,
      'unavailable',
      'An older selected success must not overwrite a newer shared failure',
    );
    assert.equal(afterOldSuccess.overview, 'unavailable');
    assert.equal(afterOldSuccess.chip, 'Could not check settings');
  } else if (chatLayoutOnly) {
    const dimensions = await resize(900, 620);
    await instrumentResizeObserver();
    await page.getByTestId('nav-agents').click();
    await openChat(owner);
    await page.getByTestId('agent-chat-compose-toggle').click();
    await waitForComposerTransition(page);
    await settled();
    await recipient().fill('Layout recipient');
    await message().fill('Two rows');
    const history = page.getByTestId('agent-chat-history');
    const rows = 'One\nTwo\nThree\nFour';
    await history.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await settled();
    const growsAtBottom = await sampleViewportChange(history, 'bottom', () => message().fill(rows));
    await history.evaluate((element) => {
      element.scrollTop = element.scrollHeight * 0.4;
    });
    await settled();
    const shrinksWhileReading = await sampleViewportChange(history, 'reading', () =>
      message().fill('Two rows'),
    );
    const growsWhileReading = await sampleViewportChange(history, 'reading', () =>
      message().fill(rows),
    );
    await message().fill('Collapsed failure draft');
    await page.getByTestId('agent-chat-compose-toggle').click();
    await waitForComposerTransition(page);
    await settled();
    await history.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await settled();
    await page.getByTestId('agent-chat-compose-toggle').click();
    await waitForComposerTransition(page);
    await settled();
    await invoke('fixtureHoldNextSend');
    await dialog().getByRole('button', { name: 'Send message', exact: true }).click();
    await page.getByTestId('agent-chat-compose-toggle').click();
    await waitForComposerTransition(page);
    await settled();
    await history.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await settled();
    const errorAtBottom = await sampleViewportChange(history, 'bottom', () =>
      invoke('fixtureRejectSend'),
    );
    await dialog()
      .getByRole('alert')
      .filter({ hasText: 'Synthetic collapsed send rejected' })
      .waitFor();
    await page.getByTestId('agent-chat-compose-toggle').click();
    await waitForComposerTransition(page);
    await settled();
    await invoke('fixtureHoldNextSend');
    await dialog().getByRole('button', { name: 'Send message', exact: true }).click();
    await page.getByTestId('agent-chat-compose-toggle').click();
    await waitForComposerTransition(page);
    await settled();
    await history.evaluate((element) => {
      element.scrollTop = element.scrollHeight * 0.4;
    });
    await settled();
    const errorWhileReading = await sampleViewportChange(history, 'reading', () =>
      invoke('fixtureRejectSend'),
    );
    results.push({
      dimensions,
      growsAtBottom,
      shrinksWhileReading,
      growsWhileReading,
      errorAtBottom,
      errorWhileReading,
    });
    await capture('chat-layout-only');
    await writeFile(
      path.join(output, 'chat-layout-observations.json'),
      JSON.stringify(results, null, 2),
    );
    try {
      const saved = JSON.parse(
        await readFile(path.join(output, 'baseline', 'chat-layout-baseline.json'), 'utf8'),
      ).find((item) => item.growsAtBottom);
      const baselineEvaluation = {
        criterion: 'The settled bottom gap must be within 1 CSS px',
        growsAtBottomGap: saved.growsAtBottom.after.gap,
        errorAtBottomGap: saved.errorAtBottom.after.gap,
        pass:
          Math.abs(saved.growsAtBottom.after.gap) <= 1 &&
          Math.abs(saved.errorAtBottom.after.gap) <= 1,
      };
      assert.equal(
        baselineEvaluation.pass,
        false,
        'The same settled criterion must continue to reject the unfixed baseline',
      );
      results.push({ baselineEvaluation });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    assert.ok(
      [
        growsAtBottom,
        shrinksWhileReading,
        growsWhileReading,
        errorAtBottom,
        errorWhileReading,
      ].every((result) => result.pass),
      'History viewport change must preserve bottom or visible anchor: ' +
        JSON.stringify(results.at(-1)),
    );
  } else {
    for (const theme of ['dark', 'light']) {
      await page.getByTestId('nav-settings').click();
      const toggle = page.getByRole('switch', { name: 'Dark theme', exact: true });
      if ((await toggle.isChecked()) !== (theme === 'dark')) await toggle.click();
      for (const width of [900, 1440]) {
        const dimensions = await resize(width, width === 900 ? 620 : 900);
        await page.getByTestId('nav-overview').click();
        await page.getByTestId('overview-applications').scrollIntoViewIfNeeded();
        await contained(page.getByTestId('overview-applications'), 'Overview applications');
        await capture(theme + '-' + width + '-overview');
        await page.getByTestId('overview-application-opencode').click();
        assert.equal(await page.locator('#mcp-tab-opencode').getAttribute('aria-selected'), 'true');
        for (const [client, kind, count, expectedActivity] of [
          ['cursor', null, 0, null],
          ['opencode', 'opencode-http', 0, stamp],
          ['codex', 'codex-desktop', 1, null],
          ['aionui', 'aionui', 0, null],
        ]) {
          await page.locator('#mcp-tab-' + client).click();
          await verifyClientStatusPanel(page, { kind, count, activity: expectedActivity });
          assert.ok(await page.locator('#mcp-tab-' + client).getAttribute('aria-description'));
        }
        await page.locator('#mcp-tab-cursor').click();
        await capture(theme + '-' + width + '-applications');
        await page.getByTestId('nav-agents').click();
        const rows = page.getByTestId('agent-row');
        assert.equal(await rows.count(), 4);
        const headers = await page
          .getByTestId('agents-table')
          .locator('thead th')
          .allTextContents();
        assert.deepEqual(headers, [
          'Name',
          'Client',
          '',
          'Node',
          'Last message',
          'Messages',
          'Actions',
        ]);
        const ownerRow = page.locator(`[data-agent-id="${local}:${owner.toLowerCase()}"]`);
        const remoteRow = page.locator(`[data-agent-id="${remote}:${target.toLowerCase()}"]`);
        assert.equal(
          await ownerRow.getByTestId('agent-node-kind').getAttribute('aria-label'),
          'Local agents',
        );
        assert.equal(
          await remoteRow.getByTestId('agent-node-kind').getAttribute('aria-label'),
          'Remote agents',
        );
        const iconCell = await ownerRow.locator('td').nth(1).boundingBox();
        assert.ok(iconCell.width <= 52, 'Kind column must stay narrow');
        const counts = await ownerRow.locator('td').nth(4).innerText();
        assert.ok(!/[()/]/.test(counts));
        assert.ok(counts.includes('12'));
        assert.equal(await ownerRow.getByRole('img', { name: 'In: 7', exact: true }).count(), 1);
        assert.equal(await ownerRow.getByRole('img', { name: 'Out: 5', exact: true }).count(), 1);
        assert.equal((await remoteRow.locator('td').nth(4).innerText()).trim(), '');
        await openChat(owner);
        assert.equal(await composer().count(), 0);
        const header = await contained(
          page.getByTestId('agent-chat-header'),
          'Compact chat header',
        );
        assert.ok(header.height <= 80, 'Chat header should be compact');
        const paper = await dialog().boundingBox();
        assert.ok(Math.abs(paper.x + paper.width - width) <= 1);
        assert.equal(
          await page.getByTestId('agent-chat-compose-toggle').getAttribute('aria-expanded'),
          'false',
        );
        await capture(theme + '-' + width + '-chat-collapsed');
        await page.getByTestId('agent-chat-compose-toggle').click();
        await waitForComposerTransition(page);
        await settled();
        await recipient().fill('Local target');
        await message().fill('Draft ' + theme + width);
        await contained(composer(), 'Bottom composer');
        await contained(
          dialog().getByRole('button', { name: 'Send message', exact: true }),
          'Send action',
        );
        const history = page.getByTestId('agent-chat-history');
        const historyBounds = await history.boundingBox();
        const composeBounds = await composer().boundingBox();
        assert.ok(historyBounds.height >= 120);
        assert.ok(historyBounds.y + historyBounds.height <= composeBounds.y + 1);
        assert.ok(
          await history.evaluate(
            (element) => element.scrollHeight - element.scrollTop - element.clientHeight <= 1,
          ),
          'Opening composer follows latest when already at bottom',
        );
        assert.equal(
          await recipient()
            .locator('..')
            .evaluate((element) => element.getBoundingClientRect().height),
          44,
        );
        assert.equal(await message().inputValue(), 'Draft ' + theme + width);
        await capture(theme + '-' + width + '-chat-expanded');
        await page.getByTestId('agent-chat-compose-toggle').click();
        await waitForComposerTransition(page);
        await settled();
        assert.equal(await composer().count(), 0);
        assert.ok(
          await history.evaluate(
            (element) => element.scrollHeight - element.scrollTop - element.clientHeight <= 1,
          ),
          'Closing composer follows latest when already at bottom',
        );
        await page.getByTestId('agent-chat-compose-toggle').click();
        await waitForComposerTransition(page);
        await settled();
        assert.equal(await message().inputValue(), 'Draft ' + theme + width);
        if (theme === 'dark' && width === 900) {
          await history.evaluate((element) => {
            element.scrollTop = element.scrollHeight * 0.4;
          });
          await settled();
          const collapsed = await sampleReadingAnchor(history, () =>
            page.getByTestId('agent-chat-compose-toggle').click(),
          );
          const expanded = await sampleReadingAnchor(history, () =>
            page.getByTestId('agent-chat-compose-toggle').click(),
          );
          results.push({
            composerHistoryAnchor: { collapsed, expanded },
            historyNotRemounted: true,
          });
        }
        await closeChat(true);
        await openChat(owner);
        assert.equal(await composer().count(), 0);
        await page.getByTestId('agent-chat-compose-toggle').click();
        await waitForComposerTransition(page);
        await settled();
        assert.equal(await message().inputValue(), 'Draft ' + theme + width);
        await closeChat();
        const beforeRemoteHistory = (await invoke('fixtureCalls')).filter(
          ({ method }) => method === 'chatHistory',
        ).length;
        await openChat(target);
        const remoteDialog = await contained(
          page.getByTestId('remote-agent-compose-dialog').getByRole('dialog'),
          'Remote dialog',
        );
        assert.ok(remoteDialog.width <= 600.5);
        assert.ok(remoteDialog.x > 0);
        assert.equal(await page.getByTestId('agent-chat-history').count(), 0);
        await dialog().getByRole('combobox', { name: 'Sender agent', exact: true }).click();
        await page.getByRole('option', { name: owner, exact: true }).click();
        await message().fill('Remote draft ' + theme + width);
        await capture(theme + '-' + width + '-remote');
        await closeChat(true);
        await openChat(target);
        assert.equal(await message().inputValue(), 'Remote draft ' + theme + width);
        await dialog().getByRole('combobox', { name: 'Sender agent', exact: true }).click();
        await page.getByRole('option', { name: second, exact: true }).click();
        assert.equal(await message().inputValue(), '', 'Other sender has a separate draft');
        await dialog().getByRole('combobox', { name: 'Sender agent', exact: true }).click();
        await page.getByRole('option', { name: owner, exact: true }).click();
        assert.equal(await message().inputValue(), 'Remote draft ' + theme + width);
        await page.getByRole('listbox').waitFor({ state: 'detached' });
        await settled();
        const backdrop = page
          .getByTestId('remote-agent-compose-dialog')
          .locator('.MuiDialog-container');
        assert.equal(
          await backdrop.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return document.elementFromPoint(bounds.left + 1, bounds.top + 1) === element;
          }),
          true,
          'The trusted click must hit the Dialog container outside its Paper',
        );
        await backdrop.click({ position: { x: 1, y: 1 } });
        await dialog().waitFor({ state: 'detached' });
        await openChat(target);
        assert.equal(
          await message().inputValue(),
          'Remote draft ' + theme + width,
          'Backdrop dismissal keeps the remote draft',
        );
        if (theme === 'light' && width === 1440) {
          await message().fill('Remote exact send');
          await dialog().getByRole('button', { name: 'Send message', exact: true }).click();
          await until(
            async () => (await message().inputValue()) === '',
            'remote sent draft cleared',
          );
          const sent = (await invoke('fixtureCalls')).find(({ method }) => method === 'send');
          assert.deepEqual(sent, {
            method: 'send',
            nickname: owner,
            sourceIncarnation: snapshot.agents[0].incarnation,
            recipientNode: remote,
            recipientNickname: target,
            text: 'Remote exact send',
          });
        }
        await closeChat();
        assert.equal(
          (await invoke('fixtureCalls')).filter(({ method }) => method === 'chatHistory').length,
          beforeRemoteHistory,
        );
        results.push({
          theme,
          width,
          dimensions,
          header: header.height,
          remoteWidth: remoteDialog.width,
          localAndRemoteDraftsRetained: true,
        });
      }
    }
    await page.getByTestId('nav-mcp').click();
    await page.locator('#mcp-tab-aionui').click();
    await page.getByTestId('mcp-configure-aionui').click();
    await dialog().getByRole('button', { name: 'Apply', exact: true }).waitFor();
    await until(
      () => dialog().getByRole('button', { name: 'Apply', exact: true }).isEnabled(),
      'Apply ready',
    );
    assert.equal(
      (await invoke('fixtureCalls')).filter(({ method }) => method === 'mcpSetupApply').length,
      0,
    );
    await dialog().getByRole('button', { name: 'Apply', exact: true }).click();
    await dialog().getByRole('button', { name: 'Close', exact: true }).click();
    await until(
      async () => (await state('aionui').getAttribute('data-mcp-state')) === 'configured',
      'Aion applied',
    );
    await until(
      async () => (await state('cursor').getAttribute('data-mcp-state')) === 'needs-update',
      'Cursor cross refresh',
    );
    await page.getByTestId('nav-overview').click();
    assert.equal(await overviewState('aionui').getAttribute('data-mcp-state'), 'configured');
    assert.equal(await overviewState('cursor').getAttribute('data-mcp-state'), 'needs-update');
    const calls = await invoke('fixtureCalls');
    assert.equal(calls.filter(({ method }) => method === 'mcpSetupApply').length, 1);
    assert.equal(calls.filter(({ method }) => method === 'send').length, 1);
    assert.equal(calls.filter(({ method }) => /aionUi(Pair|Disconnect)/.test(method)).length, 0);
  }
  assert.deepEqual(errors, []);
  const report = {
    syntheticOnly: true,
    nativeSizing: true,
    crossRefresh: !chatLayoutOnly && !statusOnly,
    results,
    screenshots,
    errors,
  };
  await writeFile(
    path.join(
      output,
      statusOnly
        ? 'status-summary.json'
        : chatLayoutOnly
          ? 'chat-layout-summary.json'
          : 'summary.json',
    ),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, (key, value) => (key === 'samples' ? undefined : value)));
} catch (error) {
  const failure = path.join(output, 'failure-' + Date.now());
  if (page)
    await page.screenshot({ path: failure + '.png', animations: 'disabled' }).catch(() => {});
  await writeFile(
    failure + '.json',
    JSON.stringify({ error: String(error), results, errors }, null, 2),
  );
  throw error;
} finally {
  if (application) await application.close();
  await rm(temporary, { recursive: true, force: true });
}

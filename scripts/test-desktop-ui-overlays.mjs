import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { createUiEnvironment } from './ui-test-profile.mjs';

// Renderer-only fixtures. No node, adapter, live agent or client configuration is opened.
const require = createRequire(import.meta.url);
const root = process.cwd();
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ncf-ui-redesign-'));
const output = path.join(root, 'release', 'ui-overlays');
const observeOnly = process.argv.includes('--observe');
const snackbarOnly = process.argv.includes('--snackbar-only');
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

try {
  await mkdir(output, { recursive: true });
  const preload = path.join(temporary, 'preload.cjs');
  const main = path.join(temporary, 'main.cjs');
  await writeFile(
    preload,
    `
const {contextBridge}=require('electron');
const snapshot=${JSON.stringify(snapshot)},clients=${JSON.stringify(clientPaths)},calls=[];
const listeners=new Set();let fixtureSaves=0;
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
    if(method==='clearAgents'){
      if(params.confirm)throw Error('The overlay fixture never deletes');
      const selected=snapshot.agents.filter(agent=>params.scope==='all'||agent.nickname===params.nickname);
      return {status:'confirmation_required',operationId:'fixture-clear-'+params.scope,scope:params.scope,targets:selected.map(agent=>({nickname:agent.nickname,messageCount:agent.messageCount})),agentCount:selected.length,messageCount:selected.reduce((sum,agent)=>sum+agent.messageCount,0),expiresAt:'2099-01-01T00:00:00.000Z'};
    }
    // Explicitly simulated success/error paths never persist settings.
    if(method==='saveNode'){
      fixtureSaves++;
      if(fixtureSaves===1)return {};
      throw Error('Synthetic overlay save failure');
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

  const report = [];
  const recordDialog = async (name, width) => {
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await settled();
    const result = await dialog.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        width: r.width,
        height: r.height,
        x: r.x,
        y: r.y,
        viewport: innerWidth,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        maxWidth: getComputedStyle(el).maxWidth,
      };
    });
    report.push({ kind: 'dialog', name, width, ...result });
    console.log('DIALOG', JSON.stringify({ name, width, ...result }));
    if (!observeOnly) {
      const expected = name.startsWith('mcp-') || name === 'aionui-access' ? 640 : 600;
      assert.ok(result.width <= expected + 1, name + ' must retain a compact maxWidth');
      const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
      assert.ok(
        result.x >= 0 && result.x + result.width <= viewport.width,
        name + ' must fit horizontally',
      );
      assert.ok(
        result.y >= 0 && result.y + result.height <= viewport.height,
        name + ' must fit vertically',
      );
      const footer = await dialog.locator('.MuiDialogActions-root').boundingBox();
      assert.ok(
        footer && footer.y >= 0 && footer.y + footer.height <= viewport.height,
        name + ' actions must remain visible',
      );
    }
    await capture(name, width);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
  };
  const metrics = () =>
    page.evaluate(() => {
      const box = (el) => ({
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
      });
      const tip = document.querySelector('[role="tooltip"]');
      const popper = tip?.closest('.MuiTooltip-popper');
      return {
        document: box(document.documentElement),
        body: box(document.body),
        main: box(document.querySelector('main')),
        tooltip: tip
          ? {
              text: tip.textContent,
              x: tip.getBoundingClientRect().x,
              width: tip.getBoundingClientRect().width,
            }
          : null,
        popper: popper
          ? {
              position: getComputedStyle(popper).position,
              x: popper.getBoundingClientRect().x,
              width: popper.getBoundingClientRect().width,
              style: popper.getAttribute('style'),
            }
          : null,
      };
    });
  const nativeWindow = await application.browserWindow(page);
  if (!snackbarOnly)
    for (const viewport of [
      { width: 900, height: 620 },
      { width: 1440, height: 900 },
      { width: 2560, height: 1100 },
    ]) {
      await nativeWindow.evaluate(
        (win, size) => win.setContentSize(size.width, size.height),
        viewport,
      );
      await page.waitForFunction(
        (size) => innerWidth === size.width && innerHeight === size.height,
        viewport,
      );
      const nativeSize = await nativeWindow.evaluate((win) => win.getContentBounds());
      const rendererSize = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
      assert.equal(
        nativeSize.width,
        viewport.width,
        'Native window content width must match renderer',
      );
      assert.equal(
        nativeSize.height,
        viewport.height,
        'Native window content height must match renderer',
      );
      report.push({
        kind: 'native',
        requested: viewport,
        native: nativeSize,
        renderer: rendererSize,
      });
      console.log(
        'NATIVE',
        JSON.stringify({ requested: viewport, native: nativeSize, renderer: rendererSize }),
      );
      await page.getByTestId('nav-agents').click();
      await page.getByRole('button', { name: 'Add agent', exact: true }).click();
      await recordDialog('add-agent', viewport.width);
      const owner = page.locator(`[data-agent-id="${local}:${researcher.toLowerCase()}"]`);
      await owner
        .getByRole('button', { name: 'Delete ' + researcher + ' and history', exact: true })
        .click();
      await recordDialog('delete-agent', viewport.width);
      await page.getByTestId('clear-all-local-agents').click();
      await recordDialog('delete-all', viewport.width);
      await page.getByTestId('nav-mcp').click();
      for (const client of ['cursor', 'opencode', 'codex', 'aionui']) {
        await page
          .getByRole('tab', {
            name:
              client === 'aionui'
                ? 'AionUi'
                : client === 'opencode'
                  ? 'OpenCode'
                  : client === 'codex'
                    ? 'Codex'
                    : 'Cursor',
            exact: true,
          })
          .click();
        const copy = page.getByRole('button', { name: 'Copy connection prompt', exact: true });
        await page.mouse.move(1, 1);
        await settled();
        const before = await metrics();
        await page.evaluate(() => {
          const box = (el) => ({
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth,
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight,
          });
          window.__overlayFrames = [];
          window.__overlayTrack = true;
          const sample = () => {
            const tip = document.querySelector('[role="tooltip"]'),
              p = tip?.closest('.MuiTooltip-popper');
            window.__overlayFrames.push({
              time: performance.now(),
              document: box(document.documentElement),
              body: box(document.body),
              main: box(document.querySelector('main')),
              tooltip: tip
                ? { x: tip.getBoundingClientRect().x, width: tip.getBoundingClientRect().width }
                : null,
              popper: p
                ? {
                    position: getComputedStyle(p).position,
                    x: p.getBoundingClientRect().x,
                    width: p.getBoundingClientRect().width,
                    style: p.getAttribute('style'),
                  }
                : null,
            });
          };
          window.__overlayObserver = new MutationObserver(sample);
          window.__overlayObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class'],
          });
          const tick = () => {
            sample();
            if (window.__overlayTrack) requestAnimationFrame(tick);
          };
          tick();
        });
        await copy.hover();
        await page.getByRole('tooltip', { name: 'Copy connection prompt', exact: true }).waitFor();
        await page.waitForTimeout(400);
        const during = await metrics();
        await page.mouse.move(1, 1);
        await page.getByRole('tooltip').waitFor({ state: 'detached' });
        await settled();
        const after = await metrics();
        const frames = await page.evaluate(() => {
          window.__overlayTrack = false;
          window.__overlayObserver.disconnect();
          return window.__overlayFrames;
        });
        const peaks = {};
        for (const target of ['document', 'body', 'main'])
          peaks[target] = {
            maxScrollWidth: Math.max(...frames.map((frame) => frame[target].scrollWidth)),
            minClientWidth: Math.min(...frames.map((frame) => frame[target].clientWidth)),
            maxScrollHeight: Math.max(...frames.map((frame) => frame[target].scrollHeight)),
            maxClientHeight: Math.max(...frames.map((frame) => frame[target].clientHeight)),
          };
        const tooltipFrames = frames.filter((frame) => frame.tooltip);
        report.push({
          kind: 'tooltip',
          client,
          viewport,
          before,
          during,
          after,
          peaks,
          tooltipFrames,
        });
        console.log(
          'TOOLTIP',
          JSON.stringify({
            client,
            viewport,
            before,
            during,
            after,
            peaks,
            positions: [...new Set(tooltipFrames.map((frame) => frame.popper?.position))],
          }),
        );
        if (!observeOnly)
          for (const target of ['document', 'body', 'main']) {
            assert.equal(
              peaks[target].maxScrollWidth,
              before[target].scrollWidth,
              client + ' tooltip must not widen ' + target,
            );
            assert.equal(
              peaks[target].minClientWidth,
              before[target].clientWidth,
              client + ' tooltip must not add a scrollbar to ' + target,
            );
            assert.equal(
              peaks[target].maxScrollHeight,
              before[target].scrollHeight,
              client + ' tooltip must not extend ' + target,
            );
          }
        await page.getByTestId('mcp-configure-' + client).click();
        await recordDialog('mcp-' + client, viewport.width);
        if (client === 'aionui') {
          await page.getByTestId('aionui-configure-access').click();
          await recordDialog('aionui-access', viewport.width);
        }
      }
    }
  await nativeWindow.evaluate((win) => win.setContentSize(1440, 900));
  await page.waitForFunction(() => innerWidth === 1440 && innerHeight === 900);
  await page.getByTestId('nav-settings').click();
  const contrast = async (locator) =>
    locator.evaluate((el) => {
      const style = getComputedStyle(el),
        text = style.color;
      const parse = (color) => {
        const channels = color.match(/[\d.]+/g)?.map(Number);
        if (!channels || channels.length < 3)
          throw new Error('Unsupported computed color: ' + color);
        return [channels[0], channels[1], channels[2], channels[3] ?? 1];
      };
      const luminance = (color) =>
        color
          .slice(0, 3)
          .map((value) => {
            const channel = value / 255;
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      const foreground = parse(text),
        base = parse(style.backgroundColor);
      if (base[3] !== 1) throw new Error('Snackbar contrast fixture needs an opaque base');
      // Paper can paint a dark gradient over an otherwise light backgroundColor.
      const stops = [...style.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(([color]) =>
        parse(color),
      );
      if (style.backgroundImage !== 'none' && !stops.length)
        throw new Error('Unsupported computed background: ' + style.backgroundImage);
      const backgrounds = stops.length
        ? stops.map((stop) =>
            stop
              .slice(0, 3)
              .map((channel, index) => channel * stop[3] + base[index] * (1 - stop[3])),
          )
        : [base.slice(0, 3)];
      const contrasts = backgrounds.map((background) => {
        const ink = foreground
          .slice(0, 3)
          .map(
            (channel, index) => channel * foreground[3] + background[index] * (1 - foreground[3]),
          );
        const a = luminance(ink),
          b = luminance(background);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
      return {
        text,
        background: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        backgroundSamples: backgrounds,
        contrast: Math.min(...contrasts),
        role: el.getAttribute('role'),
      };
    });
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await save.click();
  const success = page.locator('.MuiSnackbarContent-root');
  await success.getByText('Settings saved', { exact: true }).waitFor();
  await settled();
  const successStyle = await contrast(success);
  report.push({ kind: 'snackbar', name: 'success', ...successStyle });
  console.log('SNACKBAR', JSON.stringify({ name: 'success', ...successStyle }));
  if (!observeOnly)
    assert.ok(successStyle.contrast >= 4.5, 'Success snackbar text must meet 4.5:1 contrast');
  assert.equal(successStyle.role, 'alert');
  await capture('success-snackbar', 1440);
  await success.waitFor({ state: 'detached', timeout: 7000 });
  await save.click();
  const error = page.locator('.MuiSnackbar-root .MuiAlert-root');
  await error.getByText('Synthetic overlay save failure', { exact: true }).waitFor();
  await settled();
  const errorStyle = await contrast(error);
  report.push({ kind: 'snackbar', name: 'error', ...errorStyle });
  console.log('SNACKBAR', JSON.stringify({ name: 'error', ...errorStyle }));
  if (!observeOnly)
    assert.ok(errorStyle.contrast >= 4.5, 'Error snackbar text must meet 4.5:1 contrast');
  assert.equal(errorStyle.role, 'alert');
  await capture('error-snackbar', 1440);
  await error.getByRole('button', { name: 'Close', exact: true }).click();
  await error.waitFor({ state: 'detached' });
  assert.deepEqual(errors, []);
  const calls = await page.evaluate(() => window.interconnect.invoke('fixtureCalls'));
  assert.ok(
    !calls.some(
      (call) =>
        [
          'registerAgent',
          'mcpSetupApply',
          'aionUiPair',
          'accessCode',
          'connectPeer',
          'send',
        ].includes(call.method) ||
        (call.method === 'clearAgents' && call.confirm),
    ),
    'Overlay checks must never change fixture state',
  );
  await writeFile(
    path.join(
      output,
      (snackbarOnly ? 'snackbar-' : '') + (observeOnly ? 'before.json' : 'after.json'),
    ),
    JSON.stringify({ observeOnly, report, errors, screenshots }, null, 2),
  );
  console.log(
    JSON.stringify({
      observeOnly,
      snackbarOnly,
      dialogs: report.filter((item) => item.kind === 'dialog').length,
      tooltips: report.filter((item) => item.kind === 'tooltip').length,
      errors,
    }),
  );
} catch (error) {
  if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  console.error('Renderer errors:', errors);
  throw error;
} finally {
  if (application) await application.close();
  await rm(temporary, { recursive: true, force: true });
}

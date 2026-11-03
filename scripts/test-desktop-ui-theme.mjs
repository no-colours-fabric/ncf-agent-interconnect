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
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ncf-ui-theme-'));
const output = path.join(root, 'release', 'ui-theme');
const contrastOnly = process.argv.includes('--contrast-only');
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
const snapshot=${JSON.stringify(snapshot)},messages=${JSON.stringify(messages)},clients=${JSON.stringify(clientPaths)},calls=[];
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
    if(method==='chatHistory')return {messages,nextCursor:messages[0]?.sequence??0,hasMore:false};
    if(method==='clearAgents'){
      if(params.confirm)throw Error('The overlay fixture never deletes');
      const selected=snapshot.agents.filter(agent=>params.scope==='all'||agent.nickname===params.nickname);
      return {status:'confirmation_required',operationId:'fixture-clear-'+params.scope,scope:params.scope,targets:selected.map(agent=>({nickname:agent.nickname,messageCount:agent.messageCount})),agentCount:selected.length,messageCount:selected.reduce((sum,agent)=>sum+agent.messageCount,0),expiresAt:'2099-01-01T00:00:00.000Z'};
    }
    // Explicitly simulated success/error paths never persist settings.
    if(method==='saveNode'){
      fixtureSaves++;
      if(fixtureSaves%2===1)return {};
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
  async function launch() {
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
    await resize(1440, 900);
  }
  async function resize(width, height) {
    const window = await application.browserWindow(page);
    await window.evaluate((win, size) => win.setContentSize(size.width, size.height), {
      width,
      height,
    });
    await page.waitForFunction((size) => innerWidth === size.width && innerHeight === size.height, {
      width,
      height,
    });
    const bounds = await window.evaluate((win) => win.getContentBounds());
    assert.equal(bounds.width, width);
    assert.equal(bounds.height, height);
  }
  await launch();
  const rendererBundle = await page.locator('script[type="module"]').getAttribute('src');
  const report = [];
  const themeSwitch = () => page.getByLabel('Dark theme', { exact: true });
  const calls = async () =>
    (await page.evaluate(() => window.interconnect.invoke('fixtureCalls'))).filter(
      ({ method }) => method !== 'fixtureCalls',
    );
  async function assertMode(mode) {
    await page.waitForFunction((mode) => {
      const values = getComputedStyle(document.body)
        .backgroundColor.match(/[\d.]+/g)
        ?.map(Number);
      return values && (mode === 'light' ? values[0] > 180 : values[0] < 80);
    }, mode);
    assert.equal(await themeSwitch().isChecked(), mode === 'dark');
  }
  async function chooseMode(mode) {
    await page.getByTestId('nav-settings').click();
    const before = (await calls()).length;
    await themeSwitch().setChecked(mode === 'dark');
    await page.mouse.move(1, 1);
    await assertMode(mode);
    await settled();
    assert.equal(
      (await calls()).length,
      before,
      'Theme changes must not invoke backend operations',
    );
  }
  async function measuredContrast(locator, label, minimum = 4.5, graphical = false) {
    const result = await locator.evaluate((el, graphical) => {
      const parse = (value) => {
        const channels = value.match(/[\d.]+/g)?.map(Number);
        if (!channels || channels.length < 3) throw Error('Unsupported computed color ' + value);
        return [channels[0], channels[1], channels[2], channels[3] ?? 1];
      };
      const lum = (rgb) =>
        rgb
          .slice(0, 3)
          .map((value) => {
            const c = value / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, c, index) => sum + c * [0.2126, 0.7152, 0.0722][index], 0);
      const targetStyle = getComputedStyle(el);
      const foreground = graphical ? targetStyle.backgroundColor : targetStyle.color;
      const ink = parse(foreground);
      let node = graphical ? el.parentElement : el,
        backgrounds = null,
        backgroundImage = null,
        surfaceClass = null;
      while (node && !backgrounds) {
        const style = getComputedStyle(node),
          base = parse(style.backgroundColor);
        const stops = [...style.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(([color]) =>
          parse(color),
        );
        if (stops.length && stops.every((stop) => stop[3] === 1)) {
          backgrounds = stops.map((stop) => stop.slice(0, 3));
          backgroundImage = style.backgroundImage;
          surfaceClass = node.getAttribute('class');
        } else if (base[3] === 1) {
          backgrounds = stops.length
            ? stops.map((stop) =>
                stop.slice(0, 3).map((c, i) => c * stop[3] + base[i] * (1 - stop[3])),
              )
            : [base.slice(0, 3)];
          backgroundImage = style.backgroundImage;
          surfaceClass = node.getAttribute('class');
        } else if (base[3] > 0 || stops.some((stop) => stop[3] > 0)) {
          throw Error('Translucent surface needs backdrop compositing; no numeric claim');
        }
        node = node.parentElement;
      }
      if (!backgrounds) throw Error('Opaque contrast surface missing');
      const contrast = Math.min(
        ...backgrounds.map((bg) => {
          const foreground = ink.slice(0, 3).map((c, i) => c * ink[3] + bg[i] * (1 - ink[3]));
          const a = lum(foreground),
            b = lum(bg);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        }),
      );
      const box = el.getBoundingClientRect();
      return {
        foreground,
        targetClass: el.getAttribute('class'),
        rect: { x: box.x, y: box.y, width: box.width, height: box.height },
        surfaceClass,
        backgroundImage,
        backgrounds,
        contrast,
      };
    }, graphical);
    assert.ok(
      result.contrast >= minimum,
      label + ' contrast ' + result.contrast.toFixed(2) + ' must reach ' + minimum,
    );
    report.push({ kind: 'contrast', label, minimum, graphical, ...result });
    return result;
  }
  async function compactDialog(name, limit, screenshot = false) {
    const dialog = page.getByRole('dialog');
    await settled();
    const box = await bounds(dialog, name);
    const size = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    assert.ok(box.width <= limit + 1, name + ' must stay compact');
    assert.ok(box.x >= 0 && box.x + box.width <= size.width, name + ' horizontal bounds');
    assert.ok(box.y >= 0 && box.y + box.height <= size.height, name + ' vertical bounds');
    const footer = await bounds(dialog.locator('.MuiDialogActions-root'), name + ' actions');
    assert.ok(footer.y >= 0 && footer.y + footer.height <= size.height, name + ' actions visible');
    // Glass uses the live backdrop; this helper makes no numeric contrast claim for it.
    report.push({ kind: 'dialog', name, width: box.width, height: box.height });
    if (screenshot) await capture(name, size.width);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
  }
  async function copyHover(mode) {
    const copy = page.getByRole('button', { name: 'Copy connection prompt', exact: true });
    await page.mouse.move(1, 1);
    await settled();
    await page.evaluate(() => {
      const sample = () => {
        const box = (el) => ({
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
        });
        window.__themeHoverFrames.push({
          document: box(document.documentElement),
          body: box(document.body),
          main: box(document.querySelector('main')),
        });
      };
      window.__themeHoverFrames = [];
      window.__themeHoverTrack = true;
      window.__themeHoverObserver = new MutationObserver(sample);
      window.__themeHoverObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
      const tick = () => {
        sample();
        if (window.__themeHoverTrack) requestAnimationFrame(tick);
      };
      tick();
    });
    await copy.hover();
    const tooltip = page.getByRole('tooltip', { name: 'Copy connection prompt', exact: true });
    await tooltip.waitFor();
    await settled();
    const tooltipSurface = page
      .locator('.MuiTooltip-tooltip:visible')
      .filter({ hasText: 'Copy connection prompt' });
    assert.equal(
      await tooltipSurface.count(),
      1,
      'Measure the painted tooltip surface, not its Popper',
    );
    await measuredContrast(tooltipSurface, mode + ' tooltip');
    assert.equal(
      await tooltip.evaluate((el) => getComputedStyle(el.closest('.MuiTooltip-popper')).position),
      'fixed',
    );
    if (contrastOnly) {
      const filename = path.join(output, '900-' + mode + '-tooltip-final.png');
      await page.screenshot({ path: filename, animations: 'disabled' });
      screenshots.push(filename);
    }
    await page.waitForTimeout(250);
    await page.mouse.move(1, 1);
    await tooltip.waitFor({ state: 'detached' });
    const frames = await page.evaluate(() => {
      window.__themeHoverTrack = false;
      window.__themeHoverObserver.disconnect();
      return window.__themeHoverFrames;
    });
    const before = frames[0];
    for (const target of ['document', 'body', 'main'])
      for (const frame of frames) {
        assert.equal(
          frame[target].clientWidth,
          before[target].clientWidth,
          mode + ' tooltip clientWidth',
        );
        assert.equal(
          frame[target].scrollWidth,
          before[target].scrollWidth,
          mode + ' tooltip scrollWidth',
        );
        assert.equal(
          frame[target].scrollHeight,
          before[target].scrollHeight,
          mode + ' tooltip scrollHeight',
        );
      }
    report.push({ kind: 'tooltip', mode, frames: frames.length, unchanged: true });
  }
  async function snackbars(mode) {
    await page.getByTestId('nav-settings').click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const success = page.locator('.MuiSnackbarContent-root');
    await success.getByText('Settings saved', { exact: true }).waitFor();
    await settled();
    assert.equal(await success.getAttribute('role'), 'alert');
    await measuredContrast(success, mode + ' success snackbar');
    await capture(mode + '-success-snackbar', 1440);
    await success.waitFor({ state: 'detached', timeout: 7000 });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const error = page.locator('.MuiSnackbar-root .MuiAlert-root');
    await error.getByText('Synthetic overlay save failure', { exact: true }).waitFor();
    await settled();
    assert.equal(await error.getAttribute('role'), 'alert');
    await measuredContrast(error, mode + ' error snackbar');
    await capture(mode + '-error-snackbar', 1440);
    await error.getByRole('button', { name: 'Close', exact: true }).click();
    await error.waitFor({ state: 'detached' });
  }

  if (contrastOnly) {
    await resize(900, 620);
    await page.getByTestId('nav-settings').click();
    const nodeName = page.getByRole('textbox', { name: 'Node name', exact: true });
    await nodeName.fill('Narrow contrast draft Ж');
    for (const mode of ['dark', 'light']) {
      await chooseMode(mode);
      assert.equal(await nodeName.inputValue(), 'Narrow contrast draft Ж');
      if (mode === 'light') {
        assert.equal(await themeSwitch().isChecked(), false);
        const appearance = page.locator('.MuiPaper-root').filter({ has: themeSwitch() });
        assert.equal(await appearance.count(), 1, 'Appearance has its own Paper');
        const thumb = appearance.locator('.MuiSwitch-thumb');
        const result = await measuredContrast(thumb, 'light unchecked switch thumb', 3, true);
        assert.ok(result.surfaceClass.includes('MuiPaper-root'));
      }
      await capture(mode + '-appearance-final', 900);
      await page.getByTestId('nav-mcp').click();
      await page.getByRole('tab', { name: 'OpenCode', exact: true }).click();
      await copyHover(mode);
      await page.getByTestId('mcp-configure-opencode').click();
      await compactDialog(mode + ' mcp-final', 640, true);
      await page.getByTestId('nav-agents').click();
      await page.getByRole('button', { name: 'Add agent', exact: true }).click();
      await compactDialog(mode + ' add-agent-final', 600, true);
    }
    report.push({ kind: 'state', unsavedNodeLabelSurvives: true, noThemeIpc: true });
  } else {
    await page.getByTestId('nav-settings').click();
    await assertMode('dark');
    assert.equal(
      await page.evaluate(() => localStorage.getItem('interconnect.theme')),
      null,
      'Fresh profiles default to dark',
    );
    const nodeName = page.getByRole('textbox', { name: 'Node name', exact: true });
    await nodeName.fill('Unapplied theme transition Ж');
    const callsBeforeTheme = (await calls()).length;
    await themeSwitch().uncheck();
    await assertMode('light');
    assert.equal(
      await nodeName.inputValue(),
      'Unapplied theme transition Ж',
      'Theme toggle must preserve App state',
    );
    assert.equal(
      (await calls()).length,
      callsBeforeTheme,
      'Theme toggle must not remount App or save settings',
    );
    assert.equal(await page.evaluate(() => localStorage.getItem('interconnect.theme')), 'light');
    report.push({ kind: 'state', unsavedNodeLabelSurvives: true, noThemeIpc: true });

    for (const mode of ['dark', 'light']) {
      await resize(1440, 900);
      await chooseMode(mode);
      for (const screen of ['overview', 'agents', 'network', 'mcp', 'clients', 'settings']) {
        await page.getByTestId('nav-' + screen).click();
        await settled();
        const content = await bounds(page.getByTestId('page-content'), 'page content');
        const header = await bounds(page.getByTestId('header-content'), 'header content');
        assert.ok(content.width <= 1201);
        assert.ok(
          Math.abs(content.x - header.x) < 1.5 && Math.abs(content.width - header.width) < 1.5,
        );
        // The header is translucent; geometry and screenshots cover it without a numeric claim.
        await capture(mode + '-' + screen, 1440);
        if (screen === 'agents') {
          const owner = page.locator(`[data-agent-id="${local}:${researcher.toLowerCase()}"]`);
          assert.equal(await page.getByTestId('agents-table').getByRole('columnheader').count(), 6);
          await measuredContrast(owner.locator('th'), mode + ' agent name');
          await measuredContrast(
            owner
              .getByRole('button', { name: 'Delete ' + researcher + ' and history', exact: true })
              .locator('svg'),
            mode + ' destructive icon',
            3,
          );
          await owner
            .getByRole('button', { name: 'Open chat with ' + researcher, exact: true })
            .click();
          const dialog = page.getByRole('dialog', { name: researcher, exact: true });
          await dialog.getByTestId('message-text').last().waitFor();
          await settled();
          const box = await bounds(dialog, 'chat');
          assert.ok(Math.abs(box.x + box.width - 1440) < 1.5);
          await measuredContrast(dialog.getByTestId('message-text').first(), mode + ' chat bubble');
          const recipient = dialog.getByRole('textbox', {
            name: 'Recipient agent name',
            exact: true,
          });
          await recipient.fill('Reviewer 漢字');
          await measuredContrast(recipient, mode + ' recipient field');
          const draft = dialog.getByRole('textbox', { name: 'Message from the user', exact: true });
          await draft.fill('Unsent theme fixture draft Ж');
          await measuredContrast(draft, mode + ' message field');
          await capture(mode + '-chat', 1440);
          await dialog.getByRole('button', { name: 'Close chat', exact: true }).click();
          await dialog.waitFor({ state: 'detached' });
        }
      }
      await snackbars(mode);
      await resize(900, 620);
      await page.getByTestId('nav-settings').click();
      await capture(mode + '-settings', 900);
      assert.equal(await themeSwitch().isChecked(), mode === 'dark');
      await page.getByTestId('nav-agents').click();
      await page.getByRole('button', { name: 'Add agent', exact: true }).click();
      await compactDialog(mode + ' add-agent', 600);
      const owner = page.locator(`[data-agent-id="${local}:${researcher.toLowerCase()}"]`);
      await owner
        .getByRole('button', { name: 'Delete ' + researcher + ' and history', exact: true })
        .click();
      await compactDialog(mode + ' delete-agent', 600);
      await page.getByTestId('clear-all-local-agents').click();
      await compactDialog(mode + ' delete-all', 600);
      await page.getByTestId('nav-mcp').click();
      await page.getByRole('tab', { name: 'OpenCode', exact: true }).click();
      await copyHover(mode);
      await page.getByTestId('mcp-configure-opencode').click();
      await compactDialog(mode + ' mcp', 640);
    }
    await resize(1440, 900);
    await page.reload();
    await page.getByTestId('page-title').waitFor();
    await page.getByTestId('nav-settings').click();
    await assertMode('light');
    report.push({ kind: 'persistence', reload: true });
    await application.close();
    application = null;
    await launch();
    await page.getByTestId('nav-settings').click();
    await assertMode('light');
    assert.equal(await page.evaluate(() => localStorage.getItem('interconnect.theme')), 'light');
    report.push({ kind: 'persistence', freshRelaunchSameProfile: true });

    await page.addInitScript(() => {
      const storage = window.localStorage;
      window.__themeStorageNative = storage;
      const failure = sessionStorage.getItem('fixture.themeStorageFailure');
      if (!failure) return;
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          if (failure === 'getter') throw Error('Synthetic storage getter failure');
          return {
            getItem(key) {
              if (failure === 'read' && key === 'interconnect.theme')
                throw Error('Synthetic storage read failure');
              return storage.getItem(key);
            },
            setItem(key, value) {
              if (failure === 'write' && key === 'interconnect.theme')
                throw Error('Synthetic storage write failure');
              return storage.setItem(key, value);
            },
          };
        },
      });
    });
    for (const [failure, value] of [
      ['', 'corrupt'],
      ['getter', 'light'],
      ['read', 'light'],
      ['write', 'dark'],
    ]) {
      await page.evaluate(
        ({ failure, value }) => {
          sessionStorage.setItem('fixture.themeStorageFailure', failure);
          (window.__themeStorageNative ?? window.localStorage).setItem('interconnect.theme', value);
        },
        { failure, value },
      );
      await page.reload();
      await page.getByTestId('page-title').waitFor();
      await page.getByTestId('nav-settings').click();
      await assertMode('dark');
      const before = (await calls()).length;
      await themeSwitch().uncheck();
      await assertMode('light');
      assert.equal((await calls()).length, before, 'Storage failure must not cause theme IPC');
      if (failure === 'write')
        assert.equal(
          await page.evaluate(() => window.__themeStorageNative.getItem('interconnect.theme')),
          'dark',
          'Write failure must not fake persistence',
        );
      report.push({
        kind: 'storage',
        failure: failure || 'corrupt',
        fallbackDark: true,
        memoryToggle: true,
      });
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(output, contrastOnly ? 'contrast-results.json' : 'results.json'),
    JSON.stringify({ rendererBundle, report, errors, screenshots }, null, 2),
  );
  console.log(
    JSON.stringify(
      contrastOnly
        ? {
            contrastOnly: true,
            themes: 2,
            actualTooltipSurface: true,
            lightUncheckedSwitchThumb: true,
            compactDialogs: true,
            settingsDraftSurvives: true,
            themeNoIpc: true,
            errors,
            screenshots,
          }
        : {
            themes: 2,
            sixPagesPerTheme: true,
            settingsDraftSurvives: true,
            themeNoIpc: true,
            reloadPersistence: true,
            relaunchPersistence: true,
            storageFailures: 4,
            errors,
            screenshots,
          },
      null,
      2,
    ),
  );
} catch (error) {
  if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  console.error('Renderer errors:', errors);
  throw error;
} finally {
  if (application) await application.close();
  await rm(temporary, { recursive: true, force: true });
}

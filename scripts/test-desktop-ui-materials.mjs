import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { createUiEnvironment } from './ui-test-profile.mjs';

// Renderer-only fixtures. No node, adapter, live agent or client configuration is opened.
const require = createRequire(import.meta.url);
const root = process.cwd();
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ncf-ui-materials-'));
const output = path.join(root, 'release', 'ui-materials');
const observe = process.argv.includes('--observe');
const snackbarOnly = process.argv.includes('--snackbar-only');
const modeOnly = process.argv.find((value) => value.startsWith('--mode='))?.split('=')[1];
assert.ok(!modeOnly || ['dark', 'light'].includes(modeOnly), 'Supported material theme');
const phase = observe ? 'before' : 'after';
const stage = path.join(output, phase);
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
// Decode screenshot pixels without adding image dependencies.

function decodeScreenshotPng(input) {
  const buffer = Buffer.from(input);
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG signature');
  let width, height, channels;
  const chunks = [];
  for (let offset = 8; offset < buffer.length;) {
    assert.ok(offset + 12 <= buffer.length, 'Complete PNG chunk header');
    const length = buffer.readUInt32BE(offset),
      type = buffer.toString('ascii', offset + 4, offset + 8);
    assert.ok(offset + 12 + length <= buffer.length, 'Complete PNG chunk data');
    const chunk = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      assert.equal(chunk[8], 8, 'Only 8-bit screenshots are supported');
      assert.ok(chunk[9] === 2 || chunk[9] === 6, 'Only RGB/RGBA screenshots are supported');
      assert.equal(chunk[10], 0);
      assert.equal(chunk[11], 0);
      assert.equal(chunk[12], 0);
      channels = chunk[9] === 2 ? 3 : 4;
    } else if (type === 'IDAT') chunks.push(chunk);
    offset += length + 12;
    if (type === 'IEND') break;
  }
  assert.ok(width > 0 && height > 0 && channels && chunks.length, 'PNG image data');
  const stride = width * channels,
    raw = inflateSync(Buffer.concat(chunks));
  assert.equal(raw.length, height * (stride + 1), 'PNG scanline data length');
  const data = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c,
      pa = Math.abs(p - a),
      pb = Math.abs(p - b),
      pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const source = y * (stride + 1),
      filter = raw[source];
    assert.ok(filter <= 4, 'PNG scanline filter');
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x;
      const left = x >= channels ? data[index - channels] : 0;
      const above = y ? data[index - stride] : 0;
      const upperLeft = y && x >= channels ? data[index - stride - channels] : 0;
      const prediction = [
        0,
        left,
        above,
        Math.floor((left + above) / 2),
        paeth(left, above, upperLeft),
      ][filter];
      data[index] = (raw[source + 1 + x] + prediction) & 255;
    }
  }
  return { width, height, channels, data };
}

function parseComputedColor(value) {
  const match = value.match(/^rgba?\(([^)]+)\)$/);
  assert.ok(match, 'Expected computed sRGB color, received ' + value);
  const tokens = match[1].replaceAll(',', ' ').replace('/', ' ').trim().split(/\s+/);
  assert.ok(tokens.length === 3 || tokens.length === 4, 'Computed color channel count');
  const rgb = tokens.slice(0, 3).map((v) => parseFloat(v) * (v.endsWith('%') ? 2.55 : 1));
  const alpha =
    tokens[3] === undefined ? 1 : parseFloat(tokens[3]) * (tokens[3].endsWith('%') ? 0.01 : 1);
  assert.ok([...rgb, alpha].every(Number.isFinite), 'Finite computed color channels');
  return [...rgb, alpha];
}

const composite = (ink, background) =>
  ink.slice(0, 3).map((v, i) => v * ink[3] + background[i] * (1 - ink[3]));
function contrastRatio(a, b) {
  const luminance = (rgb) =>
    rgb
      .slice(0, 3)
      .map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const first = luminance(a),
    second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function samplePatch(png, { x, y }, tolerance = 3) {
  const samples = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const px = Math.floor(x) + dx,
        py = Math.floor(y) + dy;
      assert.ok(
        px >= 0 && py >= 0 && px < png.width && py < png.height,
        'Sample patch stays inside screenshot',
      );
      const index = (py * png.width + px) * png.channels;
      assert.ok(png.channels === 3 || png.data[index + 3] === 255, 'Opaque screenshot sample');
      samples.push([...png.data.subarray(index, index + 3)]);
    }
  const range = [0, 1, 2].map(
    (i) => Math.max(...samples.map((p) => p[i])) - Math.min(...samples.map((p) => p[i])),
  );
  assert.ok(
    Math.max(...range) <= tolerance,
    'Choose a clean canvas/fill sample away from text, borders and icons',
  );
  const rgb = [0, 1, 2].map((i) => samples.map((p) => p[i]).sort((a, b) => a - b)[4]);
  return { x, y, rgb, range };
}

// Call before showing a snackbar, in the same mode and native window size.
// Points are explicit CSS coordinates on clean app canvas; sampled coverage is reported.
async function captureCanvasSamples(page, points) {
  assert.ok(points.length > 0, 'Explicit clean canvas points are required');
  const visibleToasts = await page
    .locator('.MuiSnackbar-root .MuiSnackbarContent-root, .MuiSnackbar-root .MuiAlert-root')
    .evaluateAll((elements) =>
      elements.some((el) => {
        const r = el.getBoundingClientRect(),
          s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility === 'visible' && Number(s.opacity) > 0;
      }),
    );
  assert.equal(visibleToasts, false, 'Capture canvas before showing any snackbar');
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  const png = decodeScreenshotPng(await page.screenshot({ scale: 'css', animations: 'disabled' }));
  assert.equal(png.width, viewport.width);
  assert.equal(png.height, viewport.height);
  return { viewport, points: points.map((point) => samplePatch(png, point)) };
}

// Uses actual computed styles and actual canvas pixels. No theme source or tokens are read.
async function measureFlatSnackbar({ page, surface, canvas, label = 'Snackbar', error = false }) {
  await surface.waitFor({ state: 'visible' });
  await page.mouse.move(1, 1);
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => Number.isFinite(animation.effect?.getTiming().iterations))
        .map((animation) => animation.finished.catch(() => {})),
    ),
  );
  const styles = await surface.evaluate((root) => {
    const s = getComputedStyle(root),
      r = root.getBoundingClientRect();
    const ink = (el, graphical = false) => {
      if (!el) return null;
      const style = getComputedStyle(el);
      let opacity = 1;
      for (let node = el; node && node !== root; node = node.parentElement) {
        const current = getComputedStyle(node);
        opacity *= Number(current.opacity);
        if (current.filter !== 'none' || current.mixBlendMode !== 'normal')
          throw Error('Filtered ink needs rendered compositing');
      }
      return {
        color: graphical ? style.fill : style.color,
        opacity,
        background: style.backgroundColor,
        backgroundImage: style.backgroundImage,
      };
    };
    const rootOpacity = [],
      rootTransforms = [];
    for (let node = root; node; node = node.parentElement) {
      rootOpacity.push(Number(getComputedStyle(node).opacity));
      rootTransforms.push(getComputedStyle(node).transform);
    }
    return {
      insideSnackbar: !!root.closest('.MuiSnackbar-root'),
      box: { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom },
      viewport: { width: innerWidth, height: innerHeight },
      background: s.backgroundColor,
      image: s.backgroundImage,
      shadow: s.boxShadow,
      filter: s.filter,
      backdrop: s.backdropFilter,
      rootOpacity,
      rootTransforms,
      radii: [
        s.borderTopLeftRadius,
        s.borderTopRightRadius,
        s.borderBottomRightRadius,
        s.borderBottomLeftRadius,
      ],
      borderColors: [s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor],
      borderWidths: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth],
      borderStyles: [s.borderTopStyle, s.borderRightStyle, s.borderBottomStyle, s.borderLeftStyle],
      text: ink(root.querySelector('.MuiSnackbarContent-message, .MuiAlert-message')),
      errorIcon: ink(root.querySelector('.MuiAlert-icon svg'), true),
      close: ink(root.querySelector('.MuiAlert-action button svg'), true),
      closeButton: ink(root.querySelector('.MuiAlert-action button')),
    };
  });
  const message = (text) => label + ': ' + text;
  assert.equal(styles.insideSnackbar, true, message('surface belongs to Snackbar'));
  assert.deepEqual(
    styles.viewport,
    canvas.viewport,
    message('canvas and surface share the same native size'),
  );
  const background = parseComputedColor(styles.background);
  assert.equal(background[3], 1, message('opaque surface'));
  assert.ok(
    styles.rootOpacity.every((opacity) => opacity === 1),
    message('settled opacity'),
  );
  assert.equal(styles.image, 'none', message('no gradients/images'));
  assert.equal(styles.shadow, 'none', message('no shadow'));
  assert.equal(styles.filter, 'none', message('no surface filter'));
  assert.ok(!styles.backdrop || styles.backdrop === 'none', message('no backdrop filter'));
  assert.ok(
    styles.radii.every((v) => v === '8px'),
    message('eight-pixel radii'),
  );
  for (const values of [styles.borderColors, styles.borderWidths, styles.borderStyles])
    assert.equal(new Set(values).size, 1, message('uniform border'));
  assert.equal(styles.borderWidths[0], '1px', message('one-pixel border'));
  assert.equal(styles.borderStyles[0], 'solid', message('solid border'));
  const rendered = decodeScreenshotPng(
    await page.screenshot({ scale: 'css', animations: 'disabled' }),
  );
  assert.equal(rendered.width, canvas.viewport.width);
  assert.equal(rendered.height, canvas.viewport.height);
  const fill = [0.25, 0.5, 0.75]
    .flatMap((fraction) => [
      { x: styles.box.x + styles.box.width * fraction, y: styles.box.y + 4 },
      { x: styles.box.x + styles.box.width * fraction, y: styles.box.bottom - 4 },
    ])
    .map((point) => samplePatch(rendered, point));
  assert.ok(
    fill.every(({ rgb }) => rgb.every((v, i) => Math.abs(v - background[i]) <= 2)),
    message(
      'actual rendered fill matches the flat opaque computed surface ' +
        JSON.stringify({
          background: styles.background,
          rootOpacity: styles.rootOpacity,
          rootTransforms: styles.rootTransforms,
          box: styles.box,
          fill,
        }),
    ),
  );
  const ratio = (value, minimum, name, base = background) => {
    assert.ok(value, message(name + ' exists'));
    const ink = parseComputedColor(value.color);
    ink[3] *= value.opacity;
    const result = contrastRatio(composite(ink, base), base);
    assert.ok(
      result >= minimum,
      message(name + ' contrast ' + result.toFixed(2) + ' >= ' + minimum),
    );
    return result;
  };
  const textContrast = ratio(styles.text, 4.5, 'actual message text');
  const canvasContrasts = canvas.points.map((point) => ({
    ...point,
    contrast: contrastRatio(background, point.rgb),
  }));
  assert.ok(
    canvasContrasts.every(({ contrast }) => contrast >= 3),
    message('surface vs sampled actual canvas >= 3'),
  );
  let errorIconContrast = null,
    closeContrast = null;
  if (error) {
    errorIconContrast = ratio(styles.errorIcon, 3, 'error icon');
    assert.equal(styles.closeButton.backgroundImage, 'none', message('close button has no image'));
    const closeBackground = composite(
      parseComputedColor(styles.closeButton.background),
      background,
    );
    closeContrast = ratio(styles.close, 4.5, 'close icon', closeBackground);
  }
  return { label, styles, fill, textContrast, canvasContrasts, errorIconContrast, closeContrast };
}

let application, page;
const inventory = [],
  snackbars = [],
  screenshots = [],
  errors = [];
const basicKeys = new Set([
  'settingsAppearance',
  'settingsNode',
  'settingsBackground',
  'settingsExports',
  'overviewStat',
  'agentsTable',
]);
const cssProperties = [
  'color',
  'backgroundColor',
  'backgroundImage',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderTopStyle',
  'borderRightStyle',
  'borderBottomStyle',
  'borderLeftStyle',
  'borderRadius',
  'boxShadow',
  'backdropFilter',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
];
async function settle() {
  await page.mouse.move(1, 1);
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => Number.isFinite(animation.effect?.getTiming().iterations))
        .map((animation) => animation.finished.catch(() => {})),
    ),
  );
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}
async function capture(name) {
  const filename = path.join(stage, name + '.png');
  await page.screenshot({ path: filename, animations: 'disabled', scale: 'css' });
  screenshots.push(filename);
}
async function readStyle(locator) {
  assert.equal(await locator.count(), 1, 'One material target');
  return locator.evaluate(
    (el, keys) => Object.fromEntries(keys.map((key) => [key, getComputedStyle(el)[key]])),
    cssProperties,
  );
}
async function material(key, family, locator, mode, width = 1440) {
  await settle();
  const style = await readStyle(locator);
  inventory.push({ key, family, mode, width, style });
  return style;
}
function paper(title) {
  return page
    .locator('.MuiPaper-root')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}
async function nav(name) {
  await page.getByTestId('nav-' + name).click();
  await page
    .locator('main')
    .evaluate((el) => el.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
  await settle();
}
async function chooseMode(mode) {
  await nav('settings');
  const toggle = page.getByRole('switch', { name: 'Dark theme', exact: true });
  await toggle.setChecked(mode === 'dark');
  await settle();
  assert.equal(await toggle.isChecked(), mode === 'dark');
}
async function inventoryMode(mode) {
  await chooseMode(mode);
  for (const [key, title, family] of [
    ['settingsAppearance', 'Appearance', 'basic'],
    ['settingsNode', 'Node settings', 'basic'],
    ['settingsBackground', 'Background operation', 'basic'],
    ['settingsExports', 'Permitted export folders', 'basic'],
    ['settingsDiagnostics', 'Diagnostics', 'glass'],
  ])
    await material(key, family, paper(title), mode);
  await material(
    'settingsInput',
    'input',
    page
      .getByRole('textbox', { name: 'Node name', exact: true })
      .locator('xpath=ancestor::*[contains(@class,"MuiOutlinedInput-root")][1]'),
    mode,
  );
  if (mode === 'light') await capture('settings-light');
  await nav('overview');
  await material(
    'overviewStat',
    'basic',
    page.getByTestId('page-content').locator('.MuiPaper-root').first(),
    mode,
  );
  await material('overviewConnectAgents', 'raised', paper('Connect agents'), mode);
  await material('overviewConnectPeer', 'soft', paper('Connect another computer'), mode);
  await nav('network');
  await material('networkThisNode', 'soft', paper('This node'), mode);
  await material('networkConnect', 'raised', paper('Connect a remote node'), mode);
  await material('networkInfoAlert', 'semantic', paper('This node').getByRole('alert'), mode);
  if (mode === 'light') await capture('network-light');
  await nav('mcp');
  await page.getByRole('tab', { name: 'Cursor', exact: true }).click();
  await settle();
  const client = page
    .getByTestId('mcp-configure-cursor')
    .locator('xpath=ancestor::*[contains(@class,"MuiPaper-root")][1]');
  await material('mcpClient', 'raised', client, mode);
  await material('mcpPath', 'inset', client.locator(':scope > .MuiBox-root').first(), mode);
  await material('mcpCommand', 'inset', page.getByRole('tabpanel').locator('code'), mode);
  await page.getByRole('tab', { name: 'AionUi', exact: true }).click();
  await settle();
  await material('aionAuthorization', 'soft', page.getByTestId('aionui-authorization'), mode);
  await nav('agents');
  await material('agentsTable', 'basic', page.getByTestId('agents-table').locator('..'), mode);
  await page.getByRole('button', { name: 'Open chat with ' + researcher, exact: true }).click();
  const chat = page.getByRole('dialog', { name: researcher, exact: true });
  await chat.getByTestId('message-text').last().waitFor();
  await settle();
  for (const [key, direction] of [
    ['chatIncoming', 'in'],
    ['chatOutgoing', 'out'],
  ])
    await material(
      key,
      'chat',
      chat
        .locator('[data-testid="chat-message"][data-direction="' + direction + '"]')
        .first()
        .locator('.MuiPaper-root'),
      mode,
    );
  await material(
    'chatAttachment',
    'inset',
    chat.getByText('layout-notes-漢字.txt', { exact: false }).locator('..'),
    mode,
  );
  await chat.getByRole('button', { name: 'Close chat', exact: true }).click();
  await chat.waitFor({ state: 'detached' });
}
async function snackbarMode(mode, width = 1440) {
  await nav('settings');
  const canvas = observe
    ? null
    : await captureCanvasSamples(page, [
        { x: 1180, y: 700 },
        { x: 1180, y: 820 },
        { x: 1000, y: 700 },
      ]);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const success = page.locator('.MuiSnackbarContent-root');
  await success.getByText('Settings saved', { exact: true }).waitFor();
  await settle();
  const successContrast = observe
    ? null
    : await measureFlatSnackbar({ page, surface: success, canvas, label: mode + ' success' });
  snackbars.push({
    mode,
    width,
    kind: 'success',
    style: await readStyle(success),
    contrast: successContrast,
  });
  assert.equal(await success.getAttribute('role'), 'alert');
  await capture(mode + '-' + width + '-success');
  if (observe || width === 900) {
    await page.keyboard.press('Escape');
  }
  await success.waitFor({ state: 'detached', timeout: 7000 });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const error = page.locator('.MuiSnackbar-root .MuiAlert-root');
  await error.getByText('Synthetic material save failure', { exact: true }).waitFor();
  await settle();
  const errorContrast = observe
    ? null
    : await measureFlatSnackbar({
        page,
        surface: error,
        canvas,
        label: mode + ' error',
        error: true,
      });
  snackbars.push({
    mode,
    width,
    kind: 'error',
    style: await readStyle(error),
    contrast: errorContrast,
  });
  assert.equal(await error.getAttribute('role'), 'alert');
  await capture(mode + '-' + width + '-error');
  assert.equal(await error.locator('.MuiAlert-icon svg').count(), 1);
  await error.getByRole('button', { name: 'Close', exact: true }).click();
  await error.waitFor({ state: 'detached' });
}
function gradientRange(image) {
  const stops = [...image.matchAll(/rgba?\([^)]+\)/g)].map(([value]) => parseComputedColor(value));
  assert.ok(stops.length >= 2 && stops.every((stop) => stop[3] === 1), 'Opaque gradient stops');
  const light = (rgb) =>
    rgb
      .slice(0, 3)
      .map((value) => {
        const c = value / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  return Math.max(...stops.map(light)) - Math.min(...stops.map(light));
}
function shadowStrength(value) {
  return [...value.matchAll(/rgba?\([^)]+\)/g)].reduce(
    (sum, [color]) => sum + parseComputedColor(color)[3],
    0,
  );
}
function compareInventory(before) {
  const comparisons = [];
  for (const row of inventory) {
    const old = before.inventory.find((value) => value.key === row.key && value.mode === row.mode);
    assert.ok(old, 'Baseline material ' + row.key);
    if (row.mode === 'dark' || (!basicKeys.has(row.key) && row.family !== 'input')) {
      assert.deepEqual(row.style, old.style, row.mode + ' preserved ' + row.key);
      comparisons.push({ key: row.key, mode: row.mode, preserved: true });
      continue;
    }
    const gradientBefore = gradientRange(old.style.backgroundImage),
      gradientAfter = gradientRange(row.style.backgroundImage),
      shadowBefore = shadowStrength(old.style.boxShadow),
      shadowAfter = shadowStrength(row.style.boxShadow);
    assert.ok(
      gradientAfter > 0 && gradientAfter < gradientBefore,
      row.key + ' lower nonzero gradient range',
    );
    assert.ok(shadowAfter < shadowBefore, row.key + ' lower total shadow opacity');
    for (const property of [
      'color',
      'borderRadius',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'borderTopWidth',
      'borderRightWidth',
      'borderBottomWidth',
      'borderLeftWidth',
    ])
      assert.equal(row.style[property], old.style[property], row.key + ' preserves ' + property);
    comparisons.push({
      key: row.key,
      mode: row.mode,
      gradientBefore,
      gradientAfter,
      shadowBefore,
      shadowAfter,
    });
  }
  return comparisons;
}
try {
  await mkdir(stage, { recursive: true });
  const html = await readFile(path.join(root, 'build/renderer/index.html'), 'utf8'),
    rendererBundle = html.match(/src="([^\"]+\.js)"/)[1];
  const rendererSha256 = createHash('sha256')
    .update(await readFile(path.join(root, 'build/renderer', rendererBundle)))
    .digest('hex');
  const preload = path.join(temporary, 'preload.cjs'),
    main = path.join(temporary, 'main.cjs');
  await writeFile(
    preload,
    `const{contextBridge}=require('electron');const snapshot=${JSON.stringify(snapshot)},messages=${JSON.stringify(messages)},clients=${JSON.stringify(clientPaths)},calls=[],rejected=[];let saves=0;
contextBridge.exposeInMainWorld('interconnect',{invoke:async(method,params={})=>{calls.push({method,...params});
if(method==='snapshot')return snapshot;if(method==='appVersion')return '0.13.0-material-fixture';if(method==='loginState')return{supported:true,openAtLogin:false};
if(method==='aionUiStatus')return{state:'not-paired',url:'http://127.0.0.1:25808',bridgeConnected:false};
if(method==='mcpSetupStatus'){const file=clients[params.client];return{client:params.client,remembered:true,state:file.state,files:[{id:'configuration',path:file.path,state:file.state}]};}
if(method==='chatHistory')return{messages,nextCursor:messages[0].sequence,hasMore:false};
if(method==='saveNode'){saves++;if(saves%2)return{};throw Error('Synthetic material save failure');}
if(method==='fixtureCalls')return{calls,rejected};rejected.push(method);throw Error('Unexpected materials fixture operation '+method);
},onChange:()=>()=>{},onNavigate:()=>()=>{}});`,
    { mode: 0o600 },
  );
  await writeFile(
    main,
    `const{app,BrowserWindow}=require('electron');app.commandLine.appendSwitch('force-color-profile','srgb');app.setPath('userData',${JSON.stringify(path.join(temporary, 'profile'))});app.whenReady().then(()=>{const window=new BrowserWindow({width:1440,height:900,show:false,enableLargerThanScreen:true,webPreferences:{preload:${JSON.stringify(preload)},contextIsolation:true,sandbox:true,backgroundThrottling:false}});window.loadFile(${JSON.stringify(path.join(root, 'build/renderer/index.html'))});});app.on('window-all-closed',()=>app.quit());`,
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
  const window = await application.browserWindow(page);
  await window.evaluate((win) => win.setContentSize(1440, 900));
  await page.waitForFunction(() => innerWidth === 1440 && innerHeight === 900);
  const native = await window.evaluate((win) => win.getContentBounds());
  assert.equal(native.width, 1440);
  assert.equal(native.height, 900);
  for (const mode of modeOnly ? [modeOnly] : ['dark', 'light']) {
    if (snackbarOnly) await chooseMode(mode);
    else await inventoryMode(mode);
    await snackbarMode(mode);
  }
  let comparisons = [],
    narrow900 = [];
  if (!observe && !snackbarOnly) {
    const before = JSON.parse(await readFile(path.join(output, 'before/results.json'), 'utf8'));
    comparisons = compareInventory(before);
    await window.evaluate((win) => win.setContentSize(900, 620));
    await page.waitForFunction(() => innerWidth === 900 && innerHeight === 620);
    const native900 = await window.evaluate((win) => win.getContentBounds());
    assert.equal(native900.width, 900);
    assert.equal(native900.height, 620);
    for (const mode of ['dark', 'light']) {
      await chooseMode(mode);
      for (const [key, locator] of [
        ['settingsNode', paper('Node settings')],
        [
          'settingsInput',
          page
            .getByRole('textbox', { name: 'Node name', exact: true })
            .locator('xpath=ancestor::*[contains(@class,"MuiOutlinedInput-root")][1]'),
        ],
      ]) {
        const style = await readStyle(locator);
        assert.deepEqual(
          style,
          inventory.find((row) => row.key === key && row.mode === mode).style,
          mode + ' same material at900 ' + key,
        );
        narrow900.push({ key, mode, native: native900, style });
      }
    }
  }
  const ipc = await page.evaluate(() => window.interconnect.invoke('fixtureCalls'));
  assert.deepEqual(errors, []);
  assert.deepEqual(ipc.rejected, []);
  const result = {
    phase,
    screenshotColorProfile: 'srgb',
    rendererBundle,
    rendererSha256,
    native,
    inventory,
    comparisons,
    narrow900,
    snackbars,
    screenshots,
    errors,
    rejected: ipc.rejected,
  };
  await writeFile(
    path.join(stage, snackbarOnly ? 'snackbar-' + (modeOnly ?? 'both') + '.json' : 'results.json'),
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify({
      phase,
      rendererBundle,
      rendererSha256,
      materials: inventory.length,
      snackbars: snackbars.length,
      errors,
      output: stage,
    }),
  );
} catch (error) {
  await writeFile(
    path.join(stage, 'failure.json'),
    JSON.stringify({ inventory, snackbars, errors, message: error.message }, null, 2),
  );
  if (page)
    await page.screenshot({ path: path.join(stage, 'failure.png'), scale: 'css' }).catch(() => {});
  throw error;
} finally {
  if (application) await application.close();
  await rm(temporary, { recursive: true, force: true });
}

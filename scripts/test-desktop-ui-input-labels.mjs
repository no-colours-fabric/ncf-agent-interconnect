import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

// Component fixtures use actual MUI and the application theme without backend APIs.
const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const settingsOnly = process.argv.includes('--settings-only');
const output = path.join(root, 'release', settingsOnly ? 'ui-settings' : 'ui-static-labels');
const observe = process.argv.includes('--observe');
const visualOnly = process.argv.includes('--visual-only');
const layoutOnly = process.argv.includes('--layout-only');
const themeSha256 = createHash('sha256')
  .update(await readFile(path.join(root, 'desktop/renderer/theme.ts')))
  .digest('hex');
const temporary =
  layoutOnly || settingsOnly
    ? null
    : await realpath(await mkdtemp(path.join(os.tmpdir(), 'ncf-static-labels-')));
const report = [],
  errors = [],
  screenshots = [];
const cases = ['default', 'small'].flatMap((size) => [
  { key: size + '-plain', size, kind: 'plain', label: 'Node name', required: true },
  { key: size + '-select', size, kind: 'select', label: 'Локальный IP для входящих подключений' },
  { key: size + '-multiline', size, kind: 'multiline', label: 'Nachricht an den Agenten 漢字' },
]);
cases.push(
  {
    key: 'small-multiline-two',
    size: 'small',
    kind: 'multiline',
    rows: 2,
    label: 'Systemnachricht 東京',
    required: true,
  },
  {
    key: 'access-code',
    size: 'default',
    kind: 'plain',
    label: 'Temporary access code',
    readOnly: true,
    largeFont: 24,
  },
  {
    key: 'sidebar-language-long',
    size: 'small',
    kind: 'select',
    label:
      'Язык интерфейса приложения — выберите удобный язык для всех экранов и системных сообщений / Interface language 漢字',
  },
);
let server, browser, page;
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
  const filename = path.join(output, (observe ? 'before-' : 'after-') + name + '.png');
  await page.screenshot({ path: filename, fullPage: true, animations: 'disabled' });
  screenshots.push(filename);
}
async function measure(item, mode, width, state) {
  const result = await page.locator('[data-case="' + item.key + '"]').evaluate((field) => {
    const rect = (el) => {
      const b = el.getBoundingClientRect();
      return {
        x: b.x + scrollX,
        y: b.y + scrollY,
        width: b.width,
        height: b.height,
        right: b.right + scrollX,
        bottom: b.bottom + scrollY,
      };
    };
    const label = field.querySelector('.MuiInputLabel-root'),
      root = field.querySelector('.MuiOutlinedInput-root');
    const outline = field.querySelector('fieldset'),
      legend = field.querySelector('legend');
    const input =
      field.querySelector('[role="combobox"]') ||
      field.querySelector('input:not([type="hidden"]),textarea:not([aria-hidden="true"])');
    const style = getComputedStyle(label),
      rootStyle = getComputedStyle(root),
      inputStyle = getComputedStyle(input),
      placeholder = getComputedStyle(input, '::placeholder');
    return {
      form: rect(field),
      label: rect(label),
      inputRoot: rect(root),
      outline: rect(outline),
      labelStyle: {
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        transform: style.transform,
        transitionProperty: style.transitionProperty,
        whiteSpace: style.whiteSpace,
      },
      legendDisplay: getComputedStyle(legend).display,
      focused: root.classList.contains('Mui-focused'),
      labelContent: label.textContent,
      requiredMarkers: [...label.querySelectorAll('.MuiFormLabel-asterisk')].map((el) => ({
        text: el.textContent,
        display: getComputedStyle(el).display,
      })),
      inputStyle: {
        fontSize: inputStyle.fontSize,
        lineHeight: inputStyle.lineHeight,
        paddingTop: inputStyle.paddingTop,
        paddingBottom: inputStyle.paddingBottom,
      },
      placeholder: {
        text: input.getAttribute('placeholder'),
        opacity: placeholder.opacity,
        visibility: placeholder.visibility,
      },
      material: {
        boxShadow: rootStyle.boxShadow,
        borderBottomColor: getComputedStyle(outline).borderBottomColor,
      },
      value: input.value ?? input.textContent,
    };
  });
  const row = {
    key: item.key,
    kind: item.kind,
    size: item.size,
    mode,
    viewport: width,
    state,
    ...result,
  };
  report.push(row);
  if (!observe) {
    assert.equal(row.labelStyle.fontSize, '13px', item.key + ' normal label font');
    assert.equal(row.labelStyle.transform, 'none', item.key + ' label never transforms');
    assert.equal(
      row.labelStyle.transitionProperty,
      'none',
      item.key + ' label has no movement transition',
    );
    assert.ok(
      Math.abs(row.label.x - row.inputRoot.x) < 0.6,
      item.key + ' label aligns with field outer edge',
    );
    assert.ok(
      Math.abs(row.inputRoot.y - row.label.bottom - 8) < 0.6,
      item.key + ' label above field with eight-pixel gap',
    );
    assert.ok(
      Math.abs(row.form.height - row.inputRoot.height - row.label.height - 8) < 0.6,
      item.key + ' total field height includes label',
    );
    assert.equal(row.legendDisplay, 'none', item.key + ' no notch');
    for (const dimension of ['x', 'y', 'width', 'height'])
      assert.ok(
        Math.abs(row.outline[dimension] - row.inputRoot[dimension]) < 0.6,
        item.key + ' unbroken full outline ' + dimension,
      );
    const expectedHeight =
      item.kind === 'multiline'
        ? (item.rows ?? 3) * 20 + 24
        : item.largeFont
          ? (item.largeFont * 20) / 13 + 24
          : 44;
    assert.ok(
      Math.abs(row.inputRoot.height - expectedHeight) < 0.6,
      item.key + ' input height preserved',
    );
    assert.ok(row.material.boxShadow.includes('inset'), item.key + ' inset field material');
    if (item.required) {
      assert.equal(row.requiredMarkers.length, 1);
      assert.ok(row.requiredMarkers[0].text.includes('*'));
      assert.notEqual(row.requiredMarkers[0].display, 'none');
    }
    if (item.key === 'sidebar-language-long' && width === 900)
      assert.ok(row.label.height > 20, item.key + ' long label wraps');
    if (state === 'empty' && item.kind !== 'select') {
      assert.ok(row.placeholder.text?.length > 0, item.key + ' empty placeholder supplied');
      assert.ok(
        Number(row.placeholder.opacity) > 0 && row.placeholder.visibility === 'visible',
        item.key + ' empty placeholder remains visible',
      );
    }
  }
  return row;
}
function assertStable(actual, expected, key) {
  if (observe) return;
  for (const dimension of ['x', 'y', 'width', 'height'])
    assert.ok(
      Math.abs(actual.label[dimension] - expected.label[dimension]) < 0.6,
      key + ' label stable ' + dimension,
    );
  assert.ok(
    Math.abs(actual.inputRoot.height - expected.inputRoot.height) < 0.6,
    key + ' input height stable',
  );
}
if (layoutOnly || settingsOnly) {
  const result = await runStaticLayout({ root, output, settingsOnly });
  console.log(
    JSON.stringify({
      layoutOnly,
      settingsOnly,
      checks: result.report.length,
      errors: result.errors,
      screenshots: result.screenshots,
    }),
  );
} else {
  try {
    await mkdir(output, { recursive: true });
    await symlink(
      path.dirname(path.dirname(require.resolve('react/package.json'))),
      path.join(temporary, 'node_modules'),
      'junction',
    );
    await writeFile(
      path.join(temporary, 'index.html'),
      '<html><body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>',
    );
    await writeFile(
      path.join(temporary, 'fixture.tsx'),
      `
import React from 'react';import {createRoot} from 'react-dom/client';
import {ThemeProvider,CssBaseline,Box,Paper,Stack,Button,Typography,TextField,MenuItem} from '@mui/material';
import {createAppTheme} from ${JSON.stringify('/@fs/' + path.join(root, 'desktop/renderer/theme.ts'))};
const cases=${JSON.stringify(cases)};
function App(){const[mode,setMode]=React.useState('dark'),[values,setValues]=React.useState({});const theme=React.useMemo(()=>createAppTheme(mode),[mode]);
return <ThemeProvider theme={theme}><CssBaseline/><Box sx={{p:3,maxWidth:1100,mx:'auto'}}><Stack direction="row" spacing={2} sx={{mb:4}}><Button onClick={()=>setMode('dark')}>Dark fixture</Button><Button onClick={()=>setMode('light')}>Light fixture</Button><Button onClick={()=>setValues({})}>Reset fields</Button></Stack><Typography variant="h5" sx={{mb:3}}>Static labels / {mode}</Typography><Box sx={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:4}}>{cases.map(item=><Paper key={item.key} sx={{p:3}}><Typography sx={{mb:3}}>{item.key}</Typography><TextField data-case={item.key} id={'fixture-'+item.key} fullWidth label={item.label} required={item.required} placeholder={item.kind==='multiline'?'Enter a message Ж 漢字':'Enter a node name'} {...(item.size==='small'?{size:'small'}:{})} select={item.kind==='select'} multiline={item.kind==='multiline'} rows={item.kind==='multiline'?(item.rows??3):undefined} slotProps={item.readOnly?{input:{readOnly:true},htmlInput:{style:{fontFamily:'monospace',fontSize:24,letterSpacing:'0.15em'}}}:undefined} value={item.readOnly?'ABCD-EFGH':(values[item.key]??'')} onChange={event=>setValues(current=>({...current,[item.key]:event.target.value}))}>{item.kind==='select'?[<MenuItem key="empty" value="">None</MenuItem>,<MenuItem key="local" value="local">127.0.0.1 — Локальный узел</MenuItem>]:null}</TextField></Paper>)}</Box></Box></ThemeProvider>;}createRoot(document.getElementById('root')).render(<App/>);`,
    );
    server = await createServer({
      root: temporary,
      configFile: false,
      cacheDir: path.join(temporary, 'vite-cache'),
      plugins: [react()],
      server: {
        host: '127.0.0.1',
        port: 0,
        fs: { allow: [temporary, root, path.resolve(root, '../..')] },
      },
    });
    await server.listen();
    browser = await chromium.launch({
      channel: process.env.NCF_UI_CHROMIUM_CHANNEL || 'chrome',
      headless: true,
    });
    page = await browser.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(server.resolvedUrls.local[0]);
    for (const width of visualOnly ? [900] : [900, 1440])
      for (const mode of visualOnly ? ['light'] : ['dark', 'light']) {
        await page.setViewportSize({ width, height: 1000 });
        await page
          .getByRole('button', {
            name: mode === 'dark' ? 'Dark fixture' : 'Light fixture',
            exact: true,
          })
          .click();
        await page.getByRole('button', { name: 'Reset fields', exact: true }).click();
        await settle();
        const base = new Map();
        for (const item of cases)
          base.set(
            item.key,
            await measure(item, mode, width, item.readOnly ? 'readonly-filled' : 'empty'),
          );
        await capture(width + '-' + mode + '-empty');
        for (const item of cases) {
          const field = page.locator('[data-case="' + item.key + '"]'),
            control = field.getByRole(item.kind === 'select' ? 'combobox' : 'textbox');
          assert.equal(
            await field.getByLabel(item.label, { exact: false }).count(),
            1,
            item.key + ' accessible label',
          );
          if (item.readOnly) {
            assert.equal(await control.getAttribute('readonly'), '');
            assert.equal(await control.inputValue(), 'ABCD-EFGH');
            continue;
          }
          if (!visualOnly) {
            if (item.kind === 'select') {
              await field.locator('.MuiInputLabel-root').click();
              assert.equal(
                await control.evaluate((el) => document.activeElement === el),
                true,
                item.key + ' trusted select label click focuses control',
              );
              await control.press('Space');
              await page.keyboard.press('Escape');
            } else {
              await field.locator('label').click();
              assert.equal(
                await control.evaluate((el) => document.activeElement === el),
                true,
                item.key + ' trusted label click focuses control',
              );
            }
            await settle();
            const focused = await measure(item, mode, width, 'focus-empty');
            assert.equal(focused.focused, true);
            assertStable(focused, base.get(item.key), item.key);
          }
          if (item.kind === 'select') {
            await control.press('Space');
            await page.keyboard.press('Home');
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
          } else
            await control.fill(
              item.kind === 'multiline' ? 'Москва 東京\nSecond line' : 'Workstation Ж 漢字',
            );
          await page.getByRole('button', { name: 'Reset fields', exact: true }).focus();
          await settle();
          const filled = await measure(item, mode, width, 'filled');
          assert.equal(filled.focused, false);
          assert.ok(filled.value.length > 0);
          if (item.kind === 'select') assert.ok(filled.value.includes('127.0.0.1'));
          assertStable(filled, base.get(item.key), item.key);
        }
        await capture(width + '-' + mode + '-filled');
      }
    assert.deepEqual(errors, []);
    assert.equal(
      await page.evaluate(() => typeof window.interconnect),
      'undefined',
      'No backend API exposed',
    );
    await writeFile(
      path.join(output, observe ? 'before.json' : visualOnly ? 'visual-after.json' : 'after.json'),
      JSON.stringify({ observe, visualOnly, themeSha256, report, errors, screenshots }, null, 2),
    );
    console.log(JSON.stringify({ observe, measuredCases: report.length, errors, output }));
  } catch (error) {
    await writeFile(
      path.join(output, 'failure.json'),
      JSON.stringify({ report, errors, message: error.message }, null, 2),
    );
    if (page)
      await page
        .screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
        .catch(() => {});
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server) await server.close();
    await rm(temporary, { recursive: true, force: true });
  }
}

// Actual renderer with an isolated Electron profile and read-only synthetic IPC.

async function runStaticLayout({ root, output, settingsOnly = false }) {
  const require = createRequire(path.join(root, 'package.json'));
  const { _electron: electron } = require('playwright');
  const { createUiEnvironment } = await import(
    pathToFileURL(path.join(root, 'scripts/ui-test-profile.mjs')).href
  );
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'ncf-static-layout-'));
  const id = (value) => '10000000-0000-4000-8000-' + String(value).padStart(12, '0');
  const local = id(1),
    researcher = 'Researcher Ж',
    reviewer = 'Reviewer 漢字';
  const stamp = '2026-11-03T12:00:00.000Z';
  // The same synthetic identities and message shapes as test-desktop-ui-theme.mjs.
  const agents = [researcher, reviewer].map((nickname, index) => ({
    key: nickname.toLowerCase(),
    nickname,
    incarnation: id(10 + index),
    binding: {
      client: 'Codex',
      adapterId: id(20 + index),
      connectionId: id(30 + index),
      chatId: 'fixture-chat-' + index,
      generation: 1,
    },
    unread: 0,
    messageCount: 4,
    incomingCount: 2,
    outgoingCount: 2,
    lastMessageAt: stamp,
  }));
  const snapshot = {
    running: true,
    nodeId: local,
    nodeLabel: 'Design workstation',
    mcpUrl: 'http://127.0.0.1:42000/mcp',
    peerUrl: 'wss://127.0.0.1:7336/peer',
    listenHost: '127.0.0.1',
    localAddresses: ['127.0.0.1', '192.0.2.20'],
    agents,
    directories: [
      {
        nodeId: local,
        nodeLabel: 'Design workstation',
        local: true,
        state: 'ready',
        epoch: id(50),
        revision: 1,
        updatedAt: stamp,
        total: agents.length,
        truncated: false,
        agents: agents.map(({ nickname }) => ({
          nickname,
          availability: 'online',
          delivery: 'mcp',
        })),
      },
    ],
    peers: [],
    adapters: agents.map((agent) => ({
      id: agent.binding.adapterId,
      label: 'Codex fixture',
      kind: 'codex-desktop',
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
  const messages = Array.from({ length: 8 }, (_, index) => ({
    sequence: index + 1,
    direction: index % 2 ? 'in' : 'out',
    state: index % 2 ? 'processed' : 'ready',
    error: null,
    envelope: {
      protocol: 2,
      id: id(100 + index),
      fromNode: local,
      toNode: local,
      fromNickname: index % 2 ? reviewer : researcher,
      toNickname: index % 2 ? researcher : reviewer,
      createdAt: stamp,
      text: 'Synthetic layout history. Unicode: Москва 東京.',
      replyTo: null,
      attachments: [],
    },
  }));
  const clients = Object.fromEntries(
    Object.entries({
      cursor: '.cursor/mcp.json',
      opencode: '.config/opencode/opencode.json',
      codex: '.codex/config.toml',
      aionui: '.cursor/mcp.json',
    }).map(([client, relative]) => [
      client,
      {
        path: path.join(temporary, 'clients', relative),
        format: client === 'codex' ? 'toml' : 'jsonc',
        state: 'missing',
      },
    ]),
  );
  const report = [],
    screenshots = [],
    errors = [];
  let application, page;
  const geometry = (element) =>
    element.evaluate((el) => {
      const r = el.getBoundingClientRect(),
        s = getComputedStyle(el);
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        right: r.right,
        bottom: r.bottom,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        overflowY: s.overflowY,
      };
    });
  const inside = (inner, outer, name) =>
    assert.ok(
      inner.x >= outer.x - 1 &&
        inner.y >= outer.y - 1 &&
        inner.right <= outer.right + 1 &&
        inner.bottom <= outer.bottom + 1,
      name + ' must remain inside its visible bounds',
    );
  const viewport = { x: 0, y: 0, right: 900, bottom: 620 };
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
    const filename = path.join(output, 'layout-900-' + name + '.png');
    await page.screenshot({ path: filename, animations: 'disabled' });
    screenshots.push(filename);
  }
  async function field(control, name, height = 44) {
    assert.equal(await control.count(), 1, name + ' accessible control');
    const form = control.locator('xpath=ancestor::*[contains(@class,"MuiFormControl-root")][1]');
    const value = await form.evaluate((el) => {
      const box = (node) => {
        const r = node.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        };
      };
      const label = el.querySelector('.MuiInputLabel-root');
      const root = el.querySelector('.MuiOutlinedInput-root');
      const legend = el.querySelector('legend');
      const s = getComputedStyle(label);
      return {
        form: box(el),
        label: box(label),
        root: box(root),
        legend: box(legend),
        labelFont: s.fontSize,
        transform: s.transform,
        labelText: label.textContent,
        legendDisplay: getComputedStyle(legend).display,
      };
    });
    assert.equal(value.labelFont, '13px', name + ' label font');
    assert.equal(value.transform, 'none', name + ' label has no transform');
    assert.ok(Math.abs(value.root.y - value.form.y - 28) < 1, name + ' label adds 28px');
    assert.ok(value.label.bottom <= value.root.y, name + ' label remains above the field');
    assert.ok(Math.abs(value.root.height - height) < 1, name + ' field height');
    assert.ok(
      value.legendDisplay === 'none' || value.legend.width < 1,
      name + ' outline has no label notch',
    );
    report.push({ kind: 'field', name, ...value });
    return value;
  }
  async function dialog(name, width) {
    const element = page.getByRole('dialog');
    await element.waitFor();
    await settle();
    const box = await geometry(element),
      content = await geometry(element.locator('.MuiDialogContent-root'));
    const footer = await geometry(element.locator('.MuiDialogActions-root'));
    inside(box, viewport, name);
    inside(footer, box, name + ' footer');
    assert.ok(Math.abs(box.width - width) < 1, name + ' compact width');
    assert.ok(content.bottom <= footer.y + 1, name + ' content and footer do not overlap');
    assert.ok(
      content.scrollWidth <= content.clientWidth + 1,
      name + ' content has no horizontal overflow',
    );
    report.push({ kind: 'dialog', name, box, content, footer });
    return { element, content };
  }
  async function closeDialog() {
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
  }
  async function settingsCases() {
    const translations = {
      en: {
        appearance: 'Appearance',
        light: 'Light',
        dark: 'Dark',
        toggle: 'Dark theme',
        diagnostics: 'Diagnostics',
        terms: ['Node', 'MCP', 'Listening'],
        noErrors: 'No application errors',
        old: ['Graphite', 'Light sand'],
      },
      ru: {
        appearance: 'Оформление',
        light: 'Светлая',
        dark: 'Тёмная',
        toggle: 'Тёмная тема',
        diagnostics: 'Диагностика',
        terms: ['Узел', 'MCP', 'Адрес прослушивания'],
        noErrors: 'Ошибок приложения нет',
        old: ['Графитовая', 'Светло-песочная'],
      },
    };
    const readCalls = async () =>
      (await page.evaluate(() => window.interconnect.invoke('fixtureCalls'))).calls.filter(
        ({ method }) => !method.startsWith('fixture'),
      );
    const captureSettings = async (name) => {
      const filename = path.join(output, 'settings-' + name + '.png');
      await page.screenshot({ path: filename, animations: 'disabled' });
      screenshots.push(filename);
    };
    const resize = async (width, height) => {
      const window = await application.browserWindow(page);
      await window.evaluate((win, size) => win.setContentSize(size.width, size.height), {
        width,
        height,
      });
      await page.waitForFunction(
        (size) => innerWidth === size.width && innerHeight === size.height,
        { width, height },
      );
      const native = await window.evaluate((win) => win.getContentBounds());
      assert.equal(native.width, width);
      assert.equal(native.height, height);
      report.push({ kind: 'settings-native', width, height, native });
    };
    async function chooseMode(mode, locale = 'en') {
      const toggle = page.getByRole('switch', { name: translations[locale].toggle, exact: true });
      const before = (await readCalls()).length;
      await toggle.setChecked(mode === 'dark');
      await settle();
      await page.waitForFunction((mode) => {
        const color = getComputedStyle(document.body)
          .backgroundColor.match(/[\d.]+/g)
          .map(Number);
        return mode === 'dark' ? color[0] < 80 : color[0] > 180;
      }, mode);
      assert.equal(await toggle.isChecked(), mode === 'dark');
      assert.equal(await page.evaluate(() => localStorage.getItem('interconnect.theme')), mode);
      assert.equal(
        (await readCalls()).length,
        before,
        'Theme toggle performs no backend operation',
      );
    }
    async function inspect(locale, mode, width) {
      // A deliberate error-scroll in the previous case must not crop the next capture.
      await page
        .locator('main')
        .evaluate((el) => el.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
      await settle();
      const labels = translations[locale];
      const appearance = page
        .locator('.MuiPaper-root')
        .filter({ has: page.getByRole('heading', { name: labels.appearance, exact: true }) });
      const diagnostics = page
        .locator('.MuiPaper-root')
        .filter({ has: page.getByRole('heading', { name: labels.diagnostics, exact: true }) });
      assert.equal(await appearance.count(), 1);
      assert.equal(await diagnostics.count(), 1);
      const light = appearance.getByText(labels.light, { exact: true }),
        dark = appearance.getByText(labels.dark, { exact: true });
      const sun = light.locator('..').locator('svg'),
        moon = dark.locator('..').locator('svg');
      const toggle = appearance.getByRole('switch', { name: labels.toggle, exact: true });
      const switchRoot = toggle.locator('xpath=ancestor::*[contains(@class,"MuiSwitch-root")][1]');
      const panel = await geometry(appearance),
        boxes = [];
      const header = await geometry(page.locator('header'));
      assert.ok(panel.y >= header.bottom, 'Appearance heading is below sticky header');
      for (const [name, locator] of [
        ['sun', sun],
        ['light', light],
        ['switch', switchRoot],
        ['moon', moon],
        ['dark', dark],
      ]) {
        assert.equal(await locator.count(), 1);
        const box = await geometry(locator);
        inside(box, panel, 'Appearance ' + name);
        boxes.push({ name, ...box });
      }
      const centers = boxes.map((box) => box.y + box.height / 2);
      assert.ok(Math.max(...centers) - Math.min(...centers) < 1, 'Appearance stays on one row');
      for (let index = 1; index < boxes.length; index++)
        assert.ok(boxes[index].x >= boxes[index - 1].right - 0.6, 'Appearance order');
      for (const label of [light, dark])
        assert.equal(await label.evaluate((el) => getComputedStyle(el).whiteSpace), 'nowrap');
      for (const icon of [sun, moon]) assert.equal(await icon.getAttribute('aria-hidden'), 'true');
      for (const old of labels.old)
        assert.equal(
          await appearance.getByText(old, { exact: true }).count(),
          0,
          'Obsolete appearance caption absent',
        );
      assert.equal(await toggle.isChecked(), mode === 'dark');
      assert.ok(
        panel.scrollWidth <= panel.clientWidth + 1,
        'Appearance has no horizontal overflow',
      );
      assert.equal(await diagnostics.locator('dl').count(), 1);
      assert.equal(await diagnostics.locator('dt').count(), 3);
      assert.equal(await diagnostics.locator('dd').count(), 3);
      const terms = await diagnostics.locator('dt').allTextContents(),
        values = await diagnostics.locator('dd').allTextContents();
      assert.deepEqual(terms, labels.terms);
      assert.deepEqual(values, [snapshot.nodeId, snapshot.mcpUrl, snapshot.peerUrl]);
      const pairs = [];
      for (let index = 0; index < 3; index++) {
        const caption = diagnostics.locator('dt').nth(index),
          value = diagnostics.locator('dd').nth(index);
        const captionBox = await geometry(caption),
          valueBox = await geometry(value);
        const style = await value.evaluate((el) => ({
          fontFamily: getComputedStyle(el).fontFamily,
          overflowWrap: getComputedStyle(el).overflowWrap,
        }));
        assert.ok(style.fontFamily.includes('monospace'));
        assert.equal(style.overflowWrap, 'anywhere');
        assert.equal(await caption.evaluate((el) => getComputedStyle(el).fontSize), '12px');
        assert.ok(
          Math.abs(captionBox.x - valueBox.x) < 0.6 &&
            Math.abs(valueBox.y - captionBox.bottom - 4) < 0.6,
          'Diagnostic caption above separate value',
        );
        pairs.push({
          term: terms[index],
          value: values[index],
          caption: captionBox,
          valueBox,
          ...style,
        });
      }
      const divider = diagnostics.getByRole('separator');
      assert.equal(await divider.count(), 1);
      const dividerBox = await geometry(divider),
        list = await geometry(diagnostics.locator('dl'));
      assert.ok(dividerBox.y >= list.bottom, 'Divider follows diagnostic data');
      const status = diagnostics.getByText(labels.noErrors, { exact: true });
      await status.waitFor();
      const dot = status.locator('..').locator('[aria-hidden="true"]');
      assert.equal(await dot.count(), 1);
      const dotBox = await geometry(dot),
        statusBox = await geometry(status);
      assert.ok(
        Math.abs(dotBox.width - 6) < 0.1 && Math.abs(dotBox.height - 6) < 0.1,
        'Status dot remains compact',
      );
      assert.ok(
        Math.abs(dotBox.y + dotBox.height / 2 - statusBox.y - statusBox.height / 2) < 1,
        'Status dot aligns with text',
      );
      assert.ok(statusBox.y >= dividerBox.bottom, 'Status follows divider');
      assert.equal(await diagnostics.getByRole('alert').count(), 0);
      assert.notEqual(await dot.evaluate((el) => getComputedStyle(el).boxShadow), 'none');
      const diagnosticBox = await geometry(diagnostics);
      assert.ok(
        diagnosticBox.scrollWidth <= diagnosticBox.clientWidth + 1,
        'Diagnostics wraps long values',
      );
      report.push({
        kind: 'settings',
        locale,
        mode,
        width,
        appearance: { panel, boxes },
        diagnostics: {
          box: diagnosticBox,
          pairs,
          divider: dividerBox,
          status: statusBox,
          dot: dotBox,
        },
      });
      await captureSettings(locale + '-' + width + '-' + mode);
      return diagnostics;
    }
    await page.getByTestId('nav-settings').click();
    await settle();
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    const nodeName = page.getByRole('textbox', { name: 'Node name', exact: true });
    await nodeName.fill('Settings draft Ж');
    // Toggle both ways once so an unchanged default state still has explicit persisted evidence.
    await chooseMode('light');
    await chooseMode('dark');
    for (const [width, height] of [
      [900, 620],
      [1440, 900],
    ]) {
      await resize(width, height);
      for (const mode of ['dark', 'light']) {
        await chooseMode(mode);
        assert.equal(
          await nodeName.inputValue(),
          'Settings draft Ж',
          'Theme retains unsaved node name',
        );
        const diagnostic = await inspect('en', mode, width);
        if (width === 900 && mode === 'light') {
          const messages = [
            'Synthetic transport error Ж: remote connection unavailable.',
            'Synthetic configuration error 漢字: permission denied.',
          ];
          const before = (await readCalls()).filter(({ method }) => method === 'snapshot').length;
          const ack = await page.evaluate(
            (errors) => window.interconnect.invoke('fixtureEmitErrors', { errors }),
            messages,
          );
          assert.equal(ack.listeners, 1, 'One application event subscription');
          for (const message of messages)
            await diagnostic.getByRole('alert').getByText(message, { exact: true }).waitFor();
          assert.deepEqual(
            await diagnostic.locator('.MuiAlert-message').allTextContents(),
            messages,
          );
          assert.equal(
            await diagnostic.getByText(translations.en.noErrors, { exact: true }).count(),
            0,
            'No success state while errors exist',
          );
          assert.equal(
            (await readCalls()).filter(({ method }) => method === 'snapshot').length,
            before + 1,
            'Error event refreshes actual App snapshot',
          );
          const last = diagnostic.getByRole('alert').last();
          await last.scrollIntoViewIfNeeded();
          const box = await geometry(last);
          assert.ok(box.y >= 0 && box.bottom <= 620, 'Last error reachable in viewport');
          await captureSettings('en-900-light-errors');
          const cleared = await page.evaluate(() =>
            window.interconnect.invoke('fixtureEmitErrors', { errors: [] }),
          );
          assert.equal(cleared.listeners, 1);
          await diagnostic.getByText(translations.en.noErrors, { exact: true }).waitFor();
          assert.equal(await diagnostic.getByRole('alert').count(), 0);
          report.push({
            kind: 'settings-errors',
            allMessages: messages,
            eventRefresh: true,
            snapshotDelta: 1,
            subscriptionListeners: ack.listeners,
            restoredStatus: true,
          });
        }
      }
    }
    const beforeReloadIpc = await page.evaluate(() => window.interconnect.invoke('fixtureCalls'));
    assert.deepEqual(
      beforeReloadIpc.rejected,
      [],
      'Settings cases reject no unexpected operation before reload',
    );
    report.push({
      kind: 'settings-ipc',
      beforeReloadCalls: beforeReloadIpc.calls.map(({ method }) => method),
      rejected: beforeReloadIpc.rejected,
    });
    await page.reload();
    await page.getByTestId('page-title').waitFor();
    await page.getByTestId('nav-settings').click();
    await settle();
    assert.equal(
      await page.getByRole('switch', { name: 'Dark theme', exact: true }).isChecked(),
      false,
      'New appearance persists light after reload',
    );
    report.push({
      kind: 'settings-preference',
      persistedLightAcrossReload: true,
      noThemeIpc: true,
      unsavedDraftSurvivesToggle: true,
    });
    await resize(900, 620);
    await page.getByTestId('interface-language').getByRole('combobox').click();
    await page.getByRole('option', { name: 'Русский', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.lang === 'ru');
    await chooseMode('dark', 'ru');
    await inspect('ru', 'dark', 900);
  }
  try {
    await mkdir(output, { recursive: true });
    const preload = path.join(temporary, 'preload.cjs'),
      main = path.join(temporary, 'main.cjs');
    await writeFile(
      preload,
      `const {contextBridge}=require('electron');
const snapshot=${JSON.stringify(snapshot)},messages=${JSON.stringify(messages)},clients=${JSON.stringify(clients)},calls=[],rejected=[],listeners=new Set();let fixtureErrors=[];
contextBridge.exposeInMainWorld('interconnect',{
invoke:async(method,params={})=>{calls.push({method,...params});
if(method==='snapshot')return {...snapshot,errors:[...fixtureErrors]};
if(method==='fixtureEmitErrors'){fixtureErrors=[...params.errors];for(const listener of [...listeners])listener();return {listeners:listeners.size};}
if(method==='appVersion')return '0.13.0-layout-fixture';
if(method==='loginState')return {supported:true,openAtLogin:false};
if(method==='aionUiStatus')return {state:'not-paired',url:'http://127.0.0.1:25808',bridgeConnected:false};
if(method==='mcpSetupStatus'){const file=clients[params.client];return {client:params.client,remembered:true,state:file.state,files:[{id:'configuration',path:file.path,state:file.state}]};}
if(method==='mcpSetupDefaults'){const file=clients[params.client];return {client:params.client,files:[{id:'configuration',path:file.path,format:file.format,alternatives:params.client==='opencode'?[file.path,file.path+'c']:[]}]};}
if(method==='mcpSetupPreview')return {client:params.client,planId:'fixture-plan-'+params.client,expiresAt:'2099-01-01T00:00:00.000Z',requiresReplacement:false,files:params.files.map(file=>({...file,action:'create',changes:[]}))};
if(method==='mcpSetupDiscard')return {};
if(method==='chatHistory')return {messages,nextCursor:messages[0].sequence,hasMore:false};
if(method==='fixtureCalls')return {calls,rejected};
rejected.push(method);throw Error('Rejected layout fixture IPC '+method);
},onChange:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},onNavigate:()=>()=>{}});`,
      { mode: 0o600 },
    );
    await writeFile(
      main,
      `const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(temporary, 'profile'))});app.whenReady().then(()=>{const window=new BrowserWindow({width:900,height:620,show:${!settingsOnly},enableLargerThanScreen:true,webPreferences:{preload:${JSON.stringify(preload)},contextIsolation:true,sandbox:true,backgroundThrottling:false}});window.loadFile(${JSON.stringify(path.join(root, 'build/renderer/index.html'))});});app.on('window-all-closed',()=>app.quit());`,
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
    const native = await application.browserWindow(page);
    await native.evaluate((win) => win.setContentSize(900, 620));
    await page.waitForFunction(() => innerWidth === 900 && innerHeight === 620);
    const nativeBounds = await native.evaluate((win) => win.getContentBounds());
    assert.equal(nativeBounds.width, 900);
    assert.equal(nativeBounds.height, 620);
    report.push({ kind: 'native', bounds: nativeBounds });
    if (settingsOnly) {
      await settingsCases();
      const ipc = await page.evaluate(() => window.interconnect.invoke('fixtureCalls'));
      assert.deepEqual(ipc.rejected, []);
      assert.deepEqual(errors, []);
      const rendererBundle = await page.locator('script[type="module"]').getAttribute('src');
      const result = {
        rendererBundle,
        themeSha256,
        report,
        screenshots,
        errors,
        rejected: ipc.rejected,
        calls: ipc.calls.map(({ method }) => method),
      };
      await writeFile(path.join(output, 'settings-after.json'), JSON.stringify(result, null, 2));
      return result;
    }
    const language = page.getByTestId('interface-language');
    const sidebar = await geometry(page.locator('aside'));
    const languageField = await field(language.getByRole('combobox'), 'Sidebar language');
    inside(languageField.form, sidebar, 'Language field');
    inside(languageField.form, viewport, 'Language field');
    await capture('sidebar');
    await page.getByTestId('nav-mcp').click();
    await page.getByRole('tab', { name: 'OpenCode', exact: true }).click();
    await page.getByTestId('mcp-configure-opencode').click();
    const mcp = await dialog('Configure OpenCode', 640);
    const config = await field(
      mcp.element.getByRole('textbox', { name: 'Configuration file path', exact: true }),
      'OpenCode path',
    );
    inside(config.form, mcp.content, 'OpenCode path');
    await capture('opencode');
    await closeDialog();
    await page.getByRole('tab', { name: 'AionUi', exact: true }).click();
    await page.getByTestId('aionui-configure-access').click();
    const aion = await dialog('AionUi access', 640);
    for (const name of ['AionUi WebUI address', 'Pairing code']) {
      const control = aion.element.getByLabel(name, { exact: true });
      const current = await field(control, name);
      inside(current.form, aion.content, name);
    }
    await capture('aionui');
    await closeDialog();
    await page.getByTestId('nav-agents').click();
    await page.getByRole('button', { name: 'Add agent', exact: true }).click();
    const add = await dialog('Add agent', 600);
    const nameField = await field(add.element.getByRole('textbox'), 'Agent name');
    inside(nameField.form, add.content, 'Agent name');
    await capture('add-agent');
    await closeDialog();
    await page.getByRole('button', { name: 'Open chat with ' + researcher, exact: true }).click();
    const chat = page.getByRole('dialog', { name: researcher, exact: true });
    await chat.getByTestId('chat-message').first().waitFor();
    await settle();
    const drawer = await geometry(chat);
    inside(drawer, viewport, 'Chat drawer');
    assert.ok(
      Math.abs(drawer.width - 720) < 1 && Math.abs(drawer.right - 900) < 1,
      'Chat drawer must remain 720px wide and anchored to the right edge',
    );
    const compose = chat.getByTestId('agent-chat-compose');
    const recipient = chat.getByRole('textbox', { name: 'Recipient agent name', exact: true });
    const draft = chat.getByRole('textbox', { name: 'Message from the user', exact: true });
    await recipient.fill(reviewer);
    await field(recipient, 'Chat recipient');
    await field(draft, 'Chat message empty', 64);
    await draft.fill('Москва 東京\nSecond line\nThird line');
    await settle();
    const message = await field(draft, 'Chat message filled', 84);
    assert.equal(await draft.evaluate((el) => el.tagName), 'TEXTAREA');
    assert.equal(await draft.inputValue(), 'Москва 東京\nSecond line\nThird line');
    const composeBox = await geometry(compose),
      history = await geometry(chat.getByTestId('agent-chat-history'));
    const send = chat.getByRole('button', { name: 'Send message', exact: true });
    assert.equal(await send.isEnabled(), true);
    inside(composeBox, drawer, 'Composer');
    inside(message.form, composeBox, 'Message field');
    inside(await geometry(send), composeBox, 'Send control');
    assert.ok(
      composeBox.scrollWidth <= composeBox.clientWidth + 1,
      'Composer has no horizontal overflow',
    );
    assert.ok(
      history.height > 0 && history.bottom <= composeBox.y + 1,
      'History has visible separate scroll bounds',
    );
    assert.ok(
      history.scrollHeight > history.clientHeight,
      'Synthetic history exercises vertical scrolling',
    );
    report.push({ kind: 'chat', drawer, compose: composeBox, history });
    await capture('chat');
    const ipc = await page.evaluate(() => window.interconnect.invoke('fixtureCalls'));
    assert.deepEqual(ipc.rejected, [], 'Layout check must not request mutating IPC');
    assert.deepEqual(errors, []);
    const rendererBundle = await page.locator('script[type="module"]').getAttribute('src');
    const result = {
      rendererBundle,
      themeSha256,
      report,
      screenshots,
      errors,
      rejected: ipc.rejected,
      calls: ipc.calls.map(({ method }) => method),
    };
    await writeFile(path.join(output, 'layout-after.json'), JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    await writeFile(
      path.join(output, 'layout-failure.json'),
      JSON.stringify({ report, errors, message: error.message }, null, 2),
    );
    if (page)
      await page
        .screenshot({ path: path.join(output, 'layout-failure.png'), animations: 'disabled' })
        .catch(() => {});
    throw error;
  } finally {
    if (application) await application.close();
    await rm(temporary, { recursive: true, force: true });
  }
}

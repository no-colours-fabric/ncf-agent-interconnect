import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

// Actual MUI and application theme; no application, node, adapter or configuration service.
const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const temporary = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ncf-input-labels-')));
const output = path.join(root, 'release', 'ui-input-labels');
const observe = process.argv.includes('--observe');
const probeOptical = process.argv.includes('--probe-optical');
const visualOnly = process.argv.includes('--visual-only');
const themeSha256 = createHash('sha256')
  .update(await readFile(path.join(root, 'desktop/renderer/theme.ts')))
  .digest('hex');
const report = [],
  errors = [],
  screenshots = [];
const cases = ['default', 'small'].flatMap((size) => [
  { key: size + '-plain', size, kind: 'plain', label: 'Node name', required: true },
  { key: size + '-select', size, kind: 'select', label: 'Локальный IP для входящих подключений' },
  { key: size + '-multiline', size, kind: 'multiline', label: 'Nachricht an den Agenten 漢字' },
]);
if (!observe)
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
  const field = page.locator('[data-case="' + item.key + '"]');
  const geometry = await field.evaluate((field) => {
    const rect = (el) => {
      const box = el.getBoundingClientRect();
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        right: box.right,
        bottom: box.bottom,
      };
    };
    const textRect = (el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const box = range.getBoundingClientRect();
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        right: box.right,
        bottom: box.bottom,
      };
    };
    const mainTextRect = (el) => {
      const text = [...el.childNodes].find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
      );
      const range = document.createRange();
      range.selectNodeContents(text);
      const box = range.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    const font = (el) => {
      const style = getComputedStyle(el);
      return {
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        letterSpacing: style.letterSpacing,
        paddingTop: style.paddingTop,
        paddingRight: style.paddingRight,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
        transform: style.transform,
      };
    };
    const inputRoot = field.querySelector('.MuiOutlinedInput-root');
    const label = field.querySelector('.MuiInputLabel-root');
    const legend = field.querySelector('legend');
    const span = legend.querySelector('span');
    if (!label || !span) throw Error('Missing geometry node: ' + field.outerHTML);
    const input =
      field.querySelector('[role="combobox"]') ||
      field.querySelector('input:not([type="hidden"]), textarea:not([aria-hidden="true"])');
    const inputBox = rect(input),
      inputStyle = getComputedStyle(input),
      rootBox = rect(inputRoot);
    const rootStyle = getComputedStyle(inputRoot);
    const origin = {
      x: inputBox.x + parseFloat(inputStyle.paddingLeft),
      y: inputBox.y + parseFloat(inputStyle.paddingTop),
    };
    const labelBox = textRect(label),
      legendBox = textRect(span);
    const labelMain = mainTextRect(label),
      legendMain = mainTextRect(span);
    return {
      inputRoot: rootBox,
      outline: rect(field.querySelector('fieldset')),
      label: rect(label),
      labelText: labelBox,
      legend: rect(legend),
      legendText: legendBox,
      labelMainText: labelMain,
      legendMainText: legendMain,
      input: inputBox,
      origin,
      fonts: {
        root: font(inputRoot),
        label: font(label),
        legend: font(legend),
        input: font(input),
      },
      shrink: label.dataset.shrink === 'true',
      focused: inputRoot.classList.contains('Mui-focused'),
      labelContent: label.textContent,
      legendContent: span.textContent,
      labelToContentX: labelBox.x - origin.x,
      floatingWidthDifference: legendBox.width - labelBox.width,
      floatingMainWidthDifference: legendMain.width - labelMain.width,
      floatingCenterToBorder: labelBox.y + labelBox.height / 2 - rootBox.y,
      floatingCenterToNotchBorder:
        labelBox.y +
        labelBox.height / 2 -
        (rect(field.querySelector('fieldset')).y + rect(legend).height / 2),
      notchTextPadding: rect(legend).width - legendBox.width,
      requiredMarkers: [...field.querySelectorAll('.MuiFormLabel-asterisk')].map((marker) => ({
        text: marker.textContent,
        box: rect(marker),
        font: font(marker),
      })),
      borderWidth: parseFloat(rootStyle.borderTopWidth),
      material: {
        boxShadow: rootStyle.boxShadow,
        backgroundImage: rootStyle.backgroundImage,
        borderTopColor: getComputedStyle(field.querySelector('fieldset')).borderTopColor,
        borderBottomColor: getComputedStyle(field.querySelector('fieldset')).borderBottomColor,
      },
      multiline: input.tagName === 'TEXTAREA',
      value: input.value ?? input.textContent,
    };
  });
  const result = {
    key: item.key,
    kind: item.kind,
    size: item.size,
    mode,
    viewport: width,
    state,
    ...geometry,
  };
  report.push(result);
  if (!observe) {
    assert.ok(
      Math.abs(result.labelToContentX) < 1.1,
      item.key + ' label/content horizontal origin',
    );
    if (result.shrink) {
      // MUI lays out the legend at .75em and transforms a full-size label. Native
      // fractional-size glyph layout differs slightly; retain the measured delta.
      const widthTolerance = Math.max(2, result.labelMainText.width * 0.05);
      assert.ok(
        Math.abs(result.floatingMainWidthDifference) < widthTolerance,
        item.key + ' label/legend text width stays within native scaled-font metrics',
      );
      assert.ok(
        Math.abs(
          parseFloat(result.fonts.legend.fontSize) - parseFloat(result.fonts.label.fontSize) * 0.75,
        ) < 0.01,
        item.key + ' effective label/legend font size',
      );
      assert.ok(
        Math.abs(result.floatingCenterToNotchBorder) < 1.1,
        item.key + ' floating label centered on top border',
      );
      assert.ok(
        Math.abs(result.notchTextPadding - 10) < 1.1,
        item.key + ' native MUI notch text padding',
      );
      assert.ok(
        result.labelText.x >= result.legend.x - 0.6 &&
          Math.min(result.labelText.right, result.label.right) <= result.legend.right + 0.6,
        item.key + ' visible label contained in notch',
      );
      assert.ok(
        result.legend.right <= result.inputRoot.right + 0.6,
        item.key + ' notch contained in field',
      );
    } else {
      assert.ok(
        Math.abs(result.labelText.y - result.origin.y) < 3.1,
        item.key + ' empty label/content vertical origin',
      );
    }
    if (item.kind === 'multiline') {
      assert.ok(
        Math.abs(result.inputRoot.height - ((item.rows ?? 3) * 20 + 24)) < 0.6,
        item.key + ' text rows and increased vertical padding',
      );
      assert.equal(result.fonts.root.paddingTop, '12px');
      assert.equal(result.fonts.root.paddingBottom, '12px');
    } else if (item.largeFont) {
      assert.ok(result.inputRoot.height > 54.5, item.key + ' larger code remains unclipped');
      assert.ok(
        Math.abs(result.inputRoot.height - ((item.largeFont * 20) / 13 + 24)) < 0.6,
        item.key + ' height follows larger font',
      );
    } else
      assert.ok(
        Math.abs(result.inputRoot.height - 44) < 0.6,
        item.key + ' increased single-line field height',
      );
    assert.equal(result.fonts.root.fontSize, '13px');
    assert.ok(result.material.boxShadow.includes('inset'), item.key + ' inset field shadow');
    assert.ok(
      Math.abs(parseFloat(result.fonts.input.lineHeight) - ((item.largeFont ?? 13) * 20) / 13) <
        0.1,
      item.key + ' input line height follows font',
    );
    if (item.required)
      assert.equal(
        result.labelContent,
        result.legendContent,
        item.key + ' required asterisk preserved',
      );
  }
  return result;
}
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
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline, Box, Paper, Stack, Button, Typography, TextField, MenuItem } from '@mui/material';
import { createAppTheme } from ${JSON.stringify('/@fs/' + path.join(root, 'desktop/renderer/theme.ts'))};
const cases=${JSON.stringify(cases)};
function App(){
  const [mode,setMode]=React.useState('dark'),[values,setValues]=React.useState({});
  const theme=React.useMemo(()=>createAppTheme(mode),[mode]);
  return <ThemeProvider theme={theme}><CssBaseline/><Box sx={{p:3,maxWidth:1100,mx:'auto'}}>
    <Stack direction="row" spacing={2} sx={{mb:4}}><Button onClick={()=>setMode('dark')}>Dark fixture</Button><Button onClick={()=>setMode('light')}>Light fixture</Button><Button onClick={()=>setValues({})}>Reset fields</Button></Stack>
    <Typography variant="h5" sx={{mb:3}}>Outlined label geometry / {mode}</Typography>
    <Box sx={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:4}}>
      {cases.map(item=><Paper key={item.key} sx={{p:3}}><Typography sx={{mb:3}}>{item.key}</Typography>
        <TextField data-case={item.key} id={'fixture-'+item.key} fullWidth label={item.label} required={item.required}
          {...(item.size==='small'?{size:'small'}:{})} select={item.kind==='select'} multiline={item.kind==='multiline'} rows={item.kind==='multiline'?(item.rows??3):undefined}
          slotProps={item.readOnly?{input:{readOnly:true},htmlInput:{style:{fontFamily:'monospace',fontSize:24,letterSpacing:'0.15em'}}}:undefined}
          value={item.readOnly?'ABCD-EFGH':(values[item.key]??'')} onChange={event=>setValues(current=>({...current,[item.key]:event.target.value}))}>
          {item.kind==='select'?[<MenuItem key="empty" value="">None</MenuItem>,<MenuItem key="local" value="local">127.0.0.1 — Локальный узел</MenuItem>]:null}
        </TextField>
      </Paper>)}
    </Box></Box></ThemeProvider>;
}createRoot(document.getElementById('root')).render(<App/>);
`,
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
  if (probeOptical) {
    await page.setViewportSize({ width: 900, height: 1000 });
    const select = page.locator('[data-case="default-select"]').getByRole('combobox');
    await select.click();
    await page.getByRole('option', { name: '127.0.0.1 — Локальный узел', exact: true }).click();
    await page.getByRole('button', { name: 'Reset fields', exact: true }).focus();
    await settle();
    for (const key of ['default-select', 'access-code']) {
      const probe = await page.locator('[data-case="' + key + '"]').evaluate((field) => {
        const label = field.querySelector('.MuiInputLabel-root');
        const root = field.querySelector('.MuiOutlinedInput-root');
        const legend = field.querySelector('legend');
        const text = legend.querySelector('span');
        const width = (el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return range.getBoundingClientRect().width;
        };
        const read = () => ({
          labelWidth: width(label),
          legendWidth: width(text),
          difference: width(text) - width(label),
          styles: [label, root, legend].map((el) => ({
            fontOpticalSizing: getComputedStyle(el).fontOpticalSizing,
            fontSize: getComputedStyle(el).fontSize,
            fontVariationSettings: getComputedStyle(el).fontVariationSettings,
            fontFamily: getComputedStyle(el).fontFamily,
          })),
        });
        const before = read();
        const previous = [label, root].map((el) => el.style.fontOpticalSizing);
        label.style.fontOpticalSizing = 'none';
        root.style.fontOpticalSizing = 'none';
        const none = read();
        [label, root].forEach((el, index) => {
          el.style.fontOpticalSizing = previous[index];
        });
        return { before, none, restored: read() };
      });
      report.push({ key, ...probe });
    }
  } else {
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
          const field = page.locator('[data-case="' + item.key + '"]');
          const control = field.getByRole(item.kind === 'select' ? 'combobox' : 'textbox');
          assert.equal(await control.count(), 1, item.key + ' accessible control');
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
          let focused;
          if (!visualOnly) {
            if (item.kind === 'select') {
              await control.click();
              await page.keyboard.press('Escape');
            } else await control.focus();
            await settle();
            focused = await measure(item, mode, width, 'focus-empty');
            assert.equal(focused.focused, true);
            assert.equal(focused.shrink, true);
          }
          if (item.kind === 'select') {
            await control.click();
            await page
              .getByRole('option', { name: '127.0.0.1 — Локальный узел', exact: true })
              .click();
          } else
            await control.fill(
              item.kind === 'multiline' ? 'Москва 東京\nSecond line' : 'Workstation Ж 漢字',
            );
          await page.getByRole('button', { name: 'Reset fields', exact: true }).focus();
          await settle();
          const filled = await measure(item, mode, width, 'filled');
          assert.equal(filled.shrink, true);
          assert.equal(filled.focused, false);
          assert.ok(filled.value.length > 0);
          for (const current of [focused, filled].filter(Boolean))
            assert.ok(
              Math.abs(current.inputRoot.height - base.get(item.key).inputRoot.height) < 0.6,
              item.key + ' stable field height',
            );
        }
        await capture(width + '-' + mode + '-filled');
      }
  }
  assert.deepEqual(errors, []);
  assert.equal(
    await page.evaluate(() => typeof window.interconnect),
    'undefined',
    'Component fixture exposes no backend API',
  );
  await writeFile(
    path.join(
      output,
      probeOptical
        ? 'optical-probe.json'
        : observe
          ? 'before.json'
          : visualOnly
            ? 'visual-after.json'
            : 'after.json',
    ),
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

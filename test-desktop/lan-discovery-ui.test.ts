import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { build } from 'vite';
import { chromium, type Page } from 'playwright';
import { DiscoveredLanNodes } from '../desktop/renderer/DiscoveredLanNodes.js';
import {
  lanDiscoveryEnglish,
  lanDiscoveryMessages,
} from '../desktop/renderer/i18n/lan-discovery.js';
import { supportedLocales, type Locale } from '../desktop/renderer/i18n/index.js';
import type { DiscoveredLanNode, LanDiscoverySnapshot } from '../desktop/shared/lan-discovery.js';

const first: DiscoveredLanNode = {
  key: 'first@192.0.2.20:7336',
  nodeId: '00000000-0000-4000-8000-000000000002',
  label: 'Remote Ж <&>',
  address: 'wss://192.0.2.20:7336/peer',
};
const second: DiscoveredLanNode = {
  key: 'second@192.0.2.30:7336',
  nodeId: '00000000-0000-4000-8000-000000000003',
  label: 'Second computer',
  address: 'wss://192.0.2.30:7336/peer',
};
const snapshot = (): LanDiscoverySnapshot => ({
  state: 'searching',
  reason: null,
  announcement: { available: false, reason: 'listener-local' },
  nodes: [{ ...first }, { ...second }],
});
const noInvoke = async (): Promise<never> => assert.fail('Rendering must never invoke pairing');

test('discovery messages cover all 15 locales independently and preserve literal user labels', () => {
  const keys = Object.keys(lanDiscoveryEnglish).sort();
  for (const locale of supportedLocales) {
    const messages = lanDiscoveryMessages(locale);
    assert.deepEqual(Object.keys(messages).sort(), keys);
    assert.ok(Object.values(messages).every((text) => text.trim()));
    const html = renderToStaticMarkup(
      createElement(DiscoveredLanNodes, {
        discovery: snapshot(),
        running: true,
        locale,
        invoke: noInvoke,
      }),
    );
    assert.ok(html.includes('Remote Ж &lt;&amp;&gt;'));
    if (locale !== 'en') assert.notEqual(messages.codeHelp, lanDiscoveryEnglish.codeHelp);
    messages.codeLabel = 'Changed by caller';
    assert.notEqual(lanDiscoveryMessages(locale).codeLabel, messages.codeLabel);
  }
  assert.deepEqual(lanDiscoveryMessages('unknown' as Locale), lanDiscoveryEnglish);
});

test('discovery reception and local announcement remain separate and core opt-out renders no section', () => {
  const render = (discovery?: LanDiscoverySnapshot) =>
    renderToStaticMarkup(
      createElement(DiscoveredLanNodes, {
        discovery,
        running: true,
        locale: 'en',
        invoke: noInvoke,
      }),
    );
  assert.equal(render(), '');
  const html = render(snapshot());
  assert.ok(html.includes(lanDiscoveryEnglish.searching));
  assert.ok(html.includes(lanDiscoveryEnglish.listenerLocal));
  assert.ok(html.includes(first.address));
  assert.ok(!html.includes(first.nodeId));
  const unavailable = render({
    ...snapshot(),
    state: 'unavailable',
    reason: 'transport-error',
    nodes: [],
    announcement: { available: false, reason: 'transport-error' },
  });
  assert.ok(unavailable.includes(lanDiscoveryEnglish.transportError));
  assert.ok(unavailable.includes(lanDiscoveryEnglish.notAnnouncing));
});

interface FixtureWindow {
  fixture: {
    update(patch: {
      discovery?: LanDiscoverySnapshot;
      running?: boolean;
      locale?: Locale;
      mode?: 'dark' | 'light';
    }): void;
    reset(): void;
    settle(error?: string): void;
    calls: { method: string; input: { address: string; code: string } }[];
  };
}
async function update(page: Page, patch: Parameters<FixtureWindow['fixture']['update']>[0]) {
  await page.evaluate((value) => (window as unknown as FixtureWindow).fixture.update(value), patch);
}
async function calls(page: Page) {
  return page.evaluate(() => (window as unknown as FixtureWindow).fixture.calls);
}
async function settle(page: Page, error?: string) {
  await page.evaluate((value) => (window as unknown as FixtureWindow).fixture.settle(value), error);
}
async function reset(page: Page) {
  await page.evaluate(() => (window as unknown as FixtureWindow).fixture.reset());
  await page
    .getByRole('button', { name: `Pair ${first.label} (${first.address})`, exact: true })
    .waitFor();
}

// Opt in like the existing native/UI checks; the ordinary Node suite needs no browser installation.
test(
  'isolated discovery component interactions',
  { skip: process.env.NCF_LAN_COMPONENT_UI !== '1', timeout: 90000 },
  async (t) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-lan-component-'));
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      const require = createRequire(import.meta.url);
      await symlink(
        path.dirname(path.dirname(require.resolve('react/package.json'))),
        path.join(directory, 'node_modules'),
        'junction',
      );
      const component = fileURLToPath(
        new URL('../desktop/renderer/DiscoveredLanNodes.tsx', import.meta.url),
      );
      const theme = fileURLToPath(new URL('../desktop/renderer/theme.ts', import.meta.url));
      await writeFile(
        path.join(directory, 'index.html'),
        '<div id="root"></div><script type="module" src="/fixture.tsx"></script>',
      );
      await writeFile(
        path.join(directory, 'fixture.tsx'),
        `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider,CssBaseline,Box,TextField} from '@mui/material';
import {DiscoveredLanNodes} from ${JSON.stringify(component)};
import {createAppTheme} from ${JSON.stringify(theme)};
const initial=${JSON.stringify(snapshot())};
const root=createRoot(document.getElementById('root'));
const calls=[];let generation=0,update,pending;
const invoke=(method,input)=>{calls.push({method,input});return new Promise((resolve,reject)=>{pending={resolve,reject};});};
function App(){
 const[state,setState]=React.useState({discovery:initial,running:true,locale:'en',mode:'dark'});
 update=patch=>setState(current=>({...current,...patch}));
 return <ThemeProvider theme={createAppTheme(state.mode)}><CssBaseline/><Box sx={{p:3,maxWidth:900}}>
  <TextField label="Manual address fixture" defaultValue="manual-address-draft" slotProps={{htmlInput:{'data-testid':'manual-address'}}}/>
  <TextField label="Manual code fixture" defaultValue="manual-code-draft" slotProps={{htmlInput:{'data-testid':'manual-code'}}}/>
  <DiscoveredLanNodes discovery={state.discovery} running={state.running} locale={state.locale} invoke={invoke}/>
 </Box></ThemeProvider>;
}
window.fixture={calls,update:patch=>update(patch),reset(){calls.length=0;root.render(<App key={++generation}/>);},settle(error){if(!pending)throw new Error('No pending fixture request');const request=pending;pending=undefined;error?request.reject(new Error(error)):request.resolve({id:'authenticated-fixture-node',label:'Authenticated fixture'});}};
root.render(<App key={generation}/>);
`,
      );
      const result = await build({
        root: directory,
        configFile: false,
        logLevel: 'silent',
        cacheDir: path.join(directory, 'cache'),
        build: {
          write: false,
          minify: true,
          rollupOptions: { output: { format: 'iife' } },
        },
      });
      const outputs = Array.isArray(result) ? result : [result];
      const bundle = outputs
        .flatMap((output) => ('output' in output ? output.output : []))
        .find((output) => output.type === 'chunk');
      assert.ok(bundle && bundle.type === 'chunk');
      browser = await chromium.launch({
        channel: process.env.NCF_UI_CHROMIUM_CHANNEL || 'chrome',
        headless: true,
      });
      const page = await browser.newPage({ viewport: { width: 1000, height: 950 } });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      // No web server, application service, UDP transport or external requests are used.
      await page.route('**/*', (route) => route.abort());
      await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
      await page.addScriptTag({ content: bundle.code });

      await t.test(
        'Pair prompts immediately, validates a manual code and invokes the existing method once',
        async () => {
          await reset(page);
          await page
            .getByRole('button', { name: `Pair ${first.label} (${first.address})`, exact: true })
            .click();
          const dialog = page.getByRole('dialog');
          await dialog.waitFor();
          const code = dialog.getByRole('textbox', { name: 'Pairing code', exact: true });
          assert.equal(await code.inputValue(), '');
          assert.equal(
            await dialog
              .getByRole('textbox', { name: 'Selected address', exact: true })
              .getAttribute('readonly'),
            '',
          );
          assert.equal(
            await dialog.getByRole('button', { name: 'Pair', exact: true }).isDisabled(),
            true,
          );
          await code.fill('ABCD234');
          assert.equal(
            await dialog.getByRole('button', { name: 'Pair', exact: true }).isDisabled(),
            true,
          );
          await code.fill('11111111');
          assert.equal(
            await dialog.getByRole('button', { name: 'Pair', exact: true }).isDisabled(),
            true,
          );
          assert.deepEqual(await calls(page), []);
          await code.fill('abcd2345');
          assert.equal(await code.inputValue(), 'ABCD2345');
          await dialog.locator('form').evaluate((form: HTMLFormElement) => {
            form.requestSubmit();
            form.requestSubmit();
          });
          assert.deepEqual(await calls(page), [
            { method: 'connectPeer', input: { address: first.address, code: 'ABCD2345' } },
          ]);
          assert.equal(
            await dialog.getByRole('button', { name: 'Cancel', exact: true }).isDisabled(),
            true,
          );
          await settle(page);
          await dialog.waitFor({ state: 'hidden' });
          await page.getByText(lanDiscoveryEnglish.success, { exact: true }).waitFor();
          await page
            .getByRole('button', { name: `Pair ${second.label} (${second.address})`, exact: true })
            .click();
          assert.equal(await code.inputValue(), '');
          await code.fill('EFGH6789');
          await dialog.getByRole('button', { name: 'Pair', exact: true }).click();
          assert.deepEqual((await calls(page)).at(-1), {
            method: 'connectPeer',
            input: { address: second.address, code: 'EFGH6789' },
          });
          await settle(page);
          await dialog.waitFor({ state: 'hidden' });
        },
      );

      await t.test(
        'stale announcements, expiry, locale and theme updates preserve the selected endpoint and drafts',
        async () => {
          await reset(page);
          await page
            .getByRole('button', { name: `Pair ${first.label} (${first.address})`, exact: true })
            .click();
          const dialog = page.getByRole('dialog');
          const code = dialog.getByRole('textbox', { name: 'Pairing code', exact: true });
          const labelGeometry = () =>
            code.evaluate((input: HTMLInputElement) => {
              const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`)!;
              const border = input.closest('.MuiOutlinedInput-root')!;
              return {
                labelBottom: label.getBoundingClientRect().bottom,
                borderTop: border.getBoundingClientRect().top,
                height: border.getBoundingClientRect().height,
                transform: getComputedStyle(label).transform,
              };
            });
          const empty = await labelGeometry();
          assert.equal(empty.transform, 'none');
          assert.ok(empty.labelBottom <= empty.borderTop);
          assert.ok(Math.abs(empty.height - 44) < 1);
          await code.fill('ABCD2345');
          const filled = await labelGeometry();
          assert.equal(filled.transform, 'none');
          assert.ok(Math.abs(empty.labelBottom - filled.labelBottom) < 1);
          await update(page, {
            discovery: {
              ...snapshot(),
              nodes: [{ ...first, label: 'Spoofed rename', address: 'wss://192.0.2.99:9999/peer' }],
            },
            mode: 'light',
          });
          assert.equal(
            await dialog
              .getByRole('textbox', { name: 'Selected address', exact: true })
              .inputValue(),
            first.address,
          );
          assert.equal(
            await dialog.getByRole('textbox', { name: 'Computer', exact: true }).inputValue(),
            first.label,
          );
          assert.equal(await code.inputValue(), 'ABCD2345');
          await update(page, { discovery: { ...snapshot(), nodes: [] }, locale: 'ru' });
          const ru = lanDiscoveryMessages('ru');
          const translatedCode = dialog.getByRole('textbox', { name: ru.codeLabel, exact: true });
          await translatedCode.waitFor();
          assert.equal(await translatedCode.inputValue(), 'ABCD2345');
          assert.equal(
            await page.getByTestId('manual-address').inputValue(),
            'manual-address-draft',
          );
          assert.equal(await page.getByTestId('manual-code').inputValue(), 'manual-code-draft');
          await dialog.getByRole('button', { name: ru.pair, exact: true }).click();
          assert.equal((await calls(page))[0].input.address, first.address);
          await settle(page);
          await dialog.waitFor({ state: 'hidden' });
        },
      );

      await t.test(
        'Cancel and Escape discard code without calling pairing and allow another node',
        async () => {
          await reset(page);
          await page
            .getByRole('button', { name: `Pair ${first.label} (${first.address})`, exact: true })
            .click();
          const dialog = page.getByRole('dialog');
          const code = dialog.getByRole('textbox', { name: 'Pairing code', exact: true });
          await code.fill('ABCD2345');
          await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
          await dialog.waitFor({ state: 'hidden' });
          await page
            .getByRole('button', { name: `Pair ${second.label} (${second.address})`, exact: true })
            .click();
          assert.equal(await code.inputValue(), '');
          assert.equal(
            await dialog
              .getByRole('textbox', { name: 'Selected address', exact: true })
              .inputValue(),
            second.address,
          );
          await page.keyboard.press('Escape');
          await dialog.waitFor({ state: 'hidden' });
          assert.deepEqual(await calls(page), []);
        },
      );

      await t.test(
        'failed or uncertain pairing never retries automatically and keeps the editable code',
        async () => {
          await reset(page);
          await page
            .getByRole('button', { name: `Pair ${first.label} (${first.address})`, exact: true })
            .click();
          const dialog = page.getByRole('dialog');
          const code = dialog.getByRole('textbox', { name: 'Pairing code', exact: true });
          await code.fill('ABCD2345');
          await dialog.getByRole('button', { name: 'Pair', exact: true }).click();
          await settle(page, 'Pairing confirmation is uncertain (isolated fixture).');
          await dialog.getByRole('alert').waitFor();
          assert.equal(await code.inputValue(), 'ABCD2345');
          await update(page, { discovery: { ...snapshot(), nodes: [] } });
          assert.equal((await calls(page)).length, 1);
          assert.equal(
            await dialog.getByRole('button', { name: 'Pair', exact: true }).isEnabled(),
            true,
          );
          await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
          await dialog.waitFor({ state: 'hidden' });
        },
      );

      await t.test(
        'stopping preserves the draft and late completion cannot affect a replacement component',
        async () => {
          await reset(page);
          await page
            .getByRole('button', { name: `Pair ${first.label} (${first.address})`, exact: true })
            .click();
          const dialog = page.getByRole('dialog');
          const code = dialog.getByRole('textbox', { name: 'Pairing code', exact: true });
          await code.fill('ABCD2345');
          await update(page, { running: false });
          await page.waitForFunction(() =>
            document.querySelector('button[type="submit"]')?.hasAttribute('disabled'),
          );
          assert.equal(await code.inputValue(), 'ABCD2345');
          await update(page, { running: true });
          await dialog.getByRole('button', { name: 'Pair', exact: true }).click();
          await reset(page);
          await settle(page);
          assert.equal(await page.getByRole('dialog').count(), 0);
          assert.equal(
            await page.getByText(lanDiscoveryEnglish.success, { exact: true }).count(),
            0,
          );
        },
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

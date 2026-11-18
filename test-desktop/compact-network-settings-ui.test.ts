import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from 'playwright';
import { build } from 'vite';
import { computeNetworkInterfacePolicy } from '../desktop/core/network-interfaces.js';
import type {
  NetworkInterfaceExclusion,
  NetworkInterfaceSnapshot,
  NetworkInterfaceStatus,
} from '../desktop/shared/network-interfaces.js';
import { NetworkInterfacesSettings } from '../desktop/renderer/NetworkInterfacesSettings.js';
import { networkInterfaceMessages } from '../desktop/renderer/i18n/network-interfaces.js';
import { supportedLocales, type Locale } from '../desktop/renderer/i18n/index.js';

const address = (address: string, mac = '02:00:00:00:00:01', internal = false) => ({
  address,
  mac,
  internal,
  family: 'IPv4',
  netmask: internal ? '255.0.0.0' : '255.255.255.0',
});
const inventory: NetworkInterfaceSnapshot = {
  'Wi-Fi': [address('192.0.2.10'), address('192.0.2.11')],
  Ethernet: [address('198.51.100.20', '02:00:00:00:00:02')],
  'Work VPN': [address('203.0.113.30', '02:00:00:00:00:03')],
  'Dock Ж <&>': [address('198.51.100.40', '02:00:00:00:00:04')],
  lo0: [address('127.0.0.1', '00:00:00:00:00:00', true)],
  ...Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => [
      `utun${index}`,
      [
        {
          address: `fe80::${index + 1}`,
          family: 'IPv6',
          mac: '00:00:00:00:00:00',
          netmask: '',
          internal: false,
        },
      ],
    ]),
  ),
};
const initialExclusions = [{ name: 'Dock Ж <&>', mac: '02:00:00:00:00:04' }];
function status(
  exclusions: readonly NetworkInterfaceExclusion[] = initialExclusions,
): NetworkInterfaceStatus {
  const policy = computeNetworkInterfacePolicy(inventory, exclusions);
  return {
    ...policy,
    inventoryError: null,
    listeners: policy.listenAddresses.map((address) => ({
      address,
      port: 7336,
      state: 'listening',
      error: null,
    })),
  };
}

test('network settings: all 15 locales show only IPv4 interfaces and explicit exclusions without disclosures or prose', () => {
  for (const locale of supportedLocales) {
    const m = networkInterfaceMessages(locale);
    const html = renderToStaticMarkup(
      createElement(NetworkInterfacesSettings, {
        status: status(),
        value: [...initialExclusions, { name: 'utun0' }, { name: 'Absent VPN' }],
        locale,
        onChange() {
          assert.fail('Rendering must not write or alter a draft');
        },
      }),
    );
    assert.ok(!html.includes('<details'), locale);
    assert.ok(!html.includes('<summary'), locale);
    assert.ok(html.includes('data-interface-name="Wi-Fi"'), locale);
    assert.ok(html.includes('data-interface-name="lo0"'), locale);
    assert.ok(!html.includes('data-interface-name="utun0"'), locale);
    assert.ok(!html.includes('data-interface-name="utun1"'), locale);
    assert.ok(html.includes('Dock Ж &lt;&amp;&gt;'), locale);
    assert.ok(html.includes('Absent VPN'), locale);
    assert.ok(html.includes(m.remove), locale);
    for (const text of [m.help, m.identityHint]) {
      const escaped = renderToStaticMarkup(createElement('span', null, text)).slice(6, -7);
      assert.ok(!html.includes(escaped), locale);
    }
  }
});

interface FixtureState {
  locale: Locale;
  mode: 'light' | 'dark';
  status: NetworkInterfaceStatus;
  value: NetworkInterfaceExclusion[];
  disabled: boolean;
}
interface Fixture {
  changes: NetworkInterfaceExclusion[][];
  update(patch: Partial<FixtureState>): void;
  draft(): NetworkInterfaceExclusion[];
}

// Only the real component and theme are bundled in memory; no service, IPC or app is launched.
test(
  'network settings: direct IPv4 list, drafts and inline recovery',
  {
    skip: process.env.NCF_COMPACT_NETWORK_UI !== '1',
    timeout: 90000,
  },
  async (suite) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-compact-network-'));
    const artifacts = process.env.NCF_COMPACT_NETWORK_ARTIFACTS;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      const require = createRequire(import.meta.url);
      await symlink(
        path.dirname(path.dirname(require.resolve('react/package.json'))),
        path.join(directory, 'node_modules'),
        'junction',
      );
      await writeFile(
        path.join(directory, 'index.html'),
        '<div id="root"></div><script type="module" src="/fixture.tsx"></script>',
      );
      const source = (name: string) =>
        fileURLToPath(new URL(`../desktop/renderer/${name}`, import.meta.url));
      await writeFile(
        path.join(directory, 'fixture.tsx'),
        `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ThemeProvider,CssBaseline,Box} from '@mui/material';
import {NetworkInterfacesSettings} from ${JSON.stringify(source('NetworkInterfacesSettings.tsx'))};
import {createAppTheme} from ${JSON.stringify(source('theme.ts'))};
let update,draft;const changes=[];
function App(){
 const[state,setState]=React.useState(${JSON.stringify({ locale: 'en', mode: 'light', status: status(), value: initialExclusions, disabled: false })});
 update=patch=>flushSync(()=>setState(value=>({...value,...patch})));draft=()=>state.value;
 return <ThemeProvider theme={createAppTheme(state.mode)}><CssBaseline/><Box sx={{m:4,maxWidth:{xs:416,lg:736},backgroundColor:'background.paper',p:2}}>
  <NetworkInterfacesSettings status={state.status} value={state.value} locale={state.locale} disabled={state.disabled} onChange={value=>{changes.push(structuredClone(value));setState(state=>({...state,value}));}}/>
 </Box></ThemeProvider>;
}
window.fixture={changes,update:patch=>update(patch),draft:()=>draft()};
createRoot(document.getElementById('root')).render(<App/>);
`,
      );
      const output = await build({
        root: directory,
        configFile: false,
        logLevel: 'silent',
        cacheDir: path.join(directory, 'cache'),
        build: { write: false, minify: true },
      });
      const bundle = (Array.isArray(output) ? output : [output])
        .flatMap((value) => ('output' in value ? value.output : []))
        .find((value) => value.type === 'chunk');
      assert.ok(bundle && bundle.type === 'chunk');
      browser = await chromium.launch({
        channel: process.env.NCF_UI_CHROMIUM_CHANNEL || 'chrome',
        headless: true,
        chromiumSandbox: true,
      });
      const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/*', (route) => route.abort());
      await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
      await page.addScriptTag({ type: 'module', content: bundle.code });
      const section = page.getByTestId('network-interfaces-settings');
      await section.waitFor();
      const update = (patch: Partial<FixtureState>) =>
        page.evaluate(
          (value) => (window as unknown as { fixture: Fixture }).fixture.update(value),
          patch,
        );
      const draft = () =>
        page.evaluate(() => (window as unknown as { fixture: Fixture }).fixture.draft());
      const capture = async (name: string) => {
        if (!artifacts) return;
        await mkdir(artifacts, { recursive: true });
        await page.screenshot({
          path: path.join(artifacts, name + '.png'),
          fullPage: true,
          animations: 'disabled',
        });
      };
      await suite.test(
        'IPv4 rows are immediately visible, empty interfaces hidden, and exact draft toggles survive theme changes',
        async () => {
          const m = networkInterfaceMessages('en');
          assert.equal(await section.locator('summary').count(), 0);
          assert.equal(await section.getByRole('switch').count(), 5);
          assert.equal(await section.getByText('utun0', { exact: true }).count(), 0);
          assert.equal(await section.getByText(m.help, { exact: true }).count(), 0);
          assert.equal(await section.getByText(m.identityHint, { exact: true }).count(), 0);
          await section.getByText('192.0.2.11/24', { exact: true }).waitFor();
          const toggle = (name: string) =>
            section.locator(`[data-interface-name="${name}"]`).getByRole('switch');
          assert.equal(await toggle('Dock Ж <&>').isChecked(), false);
          assert.equal(await toggle('lo0').isChecked(), true);
          await toggle('Ethernet').uncheck();
          assert.deepEqual(await draft(), [
            ...initialExclusions,
            { name: 'Ethernet', mac: '02:00:00:00:00:02' },
          ]);
          await update({ mode: 'dark', locale: 'ru' });
          assert.equal(await toggle('Ethernet').isChecked(), false);
          await toggle('Ethernet').check();
          assert.deepEqual(await draft(), initialExclusions);
          await update({ value: [...initialExclusions, { name: 'utun0' }] });
          assert.equal(await section.getByText('utun0', { exact: true }).count(), 0);
          assert.deepEqual(await draft(), [...initialExclusions, { name: 'utun0' }]);
          const returned = computeNetworkInterfacePolicy(
            { ...inventory, utun0: [address('203.0.113.60')] },
            [...initialExclusions, { name: 'utun0' }],
          );
          await update({ status: { ...returned, listeners: [], inventoryError: null } });
          assert.equal(
            await toggle('utun0').isChecked(),
            false,
            'A returning address retains the saved exclusion',
          );
          await toggle('utun0').check();
          assert.deepEqual(await draft(), initialExclusions);
          await update({ status: status() });
          assert.equal(await section.getByText('utun0', { exact: true }).count(), 0);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await capture('direct-list-ru-dark-1024');
        },
      );
      await suite.test(
        'ambiguous and absent exclusions have inline recovery without a Technical details disclosure',
        async () => {
          const first = { name: 'Previous Ethernet', mac: '02:00:00:00:00:02' };
          const second = { name: 'Backup Ethernet', mac: '02:00:00:00:00:02' };
          const absent = { name: 'Absent VPN' };
          const value = [...initialExclusions, absent, first, second];
          const policy = computeNetworkInterfacePolicy(
            { ...inventory, 'USB Ethernet': [address('198.51.100.50', '02:00:00:00:00:02')] },
            value,
          );
          await update({
            locale: 'ru',
            mode: 'dark',
            disabled: false,
            value,
            status: {
              ...policy,
              inventoryError: null,
              listeners: policy.listenAddresses.map((address) => ({
                address,
                port: 7336,
                state: 'listening',
                error: null,
              })),
            },
          });
          const m = networkInterfaceMessages('ru');
          const row = section.locator('[data-interface-name="Ethernet"]');
          const toggle = row.getByRole('switch');
          assert.equal(await toggle.isDisabled(), true);
          assert.equal(await section.locator('details').count(), 0);
          const recovery = row.getByTestId('network-row-recovery');
          assert.equal(await recovery.isVisible(), true);
          const records = recovery.getByTestId('network-row-exclusion');
          assert.equal(await records.count(), 2);
          for (const record of await records.all()) {
            assert.ok((await record.textContent())!.includes(m.ambiguous));
            assert.ok((await record.textContent())!.includes('Ethernet, USB Ethernet'));
          }
          await update({ disabled: true });
          for (const button of await records.getByRole('button').all())
            assert.equal(await button.isDisabled(), true);
          await update({ disabled: false });
          await records
            .filter({ hasText: first.name })
            .getByRole('button', { name: m.remove, exact: true })
            .click();
          assert.deepEqual(await draft(), [absent, second, ...initialExclusions]);
          assert.equal(await toggle.isDisabled(), true);
          await records.getByRole('button', { name: m.remove, exact: true }).click();
          assert.deepEqual(await draft(), [absent, ...initialExclusions]);
          assert.equal(await toggle.isDisabled(), false);
          const missing = section.getByTestId('network-exclusion').filter({ hasText: absent.name });
          assert.equal(await missing.isVisible(), true);
          await missing.getByRole('button', { name: m.remove, exact: true }).click();
          assert.deepEqual(await draft(), initialExclusions);
        },
      );
      await suite.test(
        'actual error remains visible and diagnostic text is available on keyboard focus',
        async () => {
          await update({
            locale: 'en',
            mode: 'light',
            status: { ...status(), inventoryError: 'Synthetic inventory failure' },
            value: initialExclusions,
          });
          const problem = section.getByTestId('network-interface-problem');
          assert.equal(await problem.isVisible(), true);
          assert.equal(await problem.textContent(), networkInterfaceMessages('en').unavailable);
          assert.equal(await section.locator('pre').count(), 0);
          await page.keyboard.press('Tab');
          await problem.locator('[tabindex="0"]').focus();
          await page.getByRole('tooltip').waitFor();
          assert.ok(
            (await page.getByRole('tooltip').textContent())!.includes(
              'Synthetic inventory failure',
            ),
          );
          await section.getByRole('switch').first().focus();
          const allExcluded = Object.keys(inventory).map((name) => ({ name }));
          await update({ status: status(allExcluded), value: allExcluded });
          assert.equal(
            await problem.count(),
            0,
            'Intentional exclusions are not actual listener failures',
          );
          const empty = computeNetworkInterfacePolicy({ utun0: [] });
          await update({ status: { ...empty, listeners: [], inventoryError: null }, value: [] });
          assert.equal(await section.getByRole('switch').count(), 0);
          assert.equal(await section.getByText('utun0', { exact: true }).count(), 0);
          assert.deepEqual(errors, []);
        },
      );
    } finally {
      await browser?.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

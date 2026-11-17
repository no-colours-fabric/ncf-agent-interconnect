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

test('compact network settings: all 15 locales retain a collapsed section and every existing recovery/help string', () => {
  for (const locale of supportedLocales) {
    const m = networkInterfaceMessages(locale);
    const html = renderToStaticMarkup(
      createElement(NetworkInterfacesSettings, {
        status: status(),
        value: [...initialExclusions, { name: 'Absent VPN' }],
        locale,
        onChange() {
          assert.fail('Rendering must not write or alter a draft');
        },
      }),
    );
    const disclosure = html.match(
      /<details[^>]*data-testid="network-interfaces-settings"[^>]*>/,
    )?.[0];
    assert.ok(disclosure, locale);
    assert.ok(!/\bopen(?:=|\s|>)/.test(disclosure), locale);
    for (const text of [m.title, m.details, m.help, m.identityHint, m.absent, m.remove]) {
      const escaped = renderToStaticMarkup(createElement('span', null, text)).slice(6, -7);
      assert.ok(html.includes(escaped), `${locale}: ${text}`);
    }
    assert.ok(html.includes('Dock Ж &lt;&amp;&gt;'));
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
  'compact network settings: real source density, drafts and focused technical recovery',
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
      if (process.env.NCF_COMPACT_NETWORK_BASELINE === '1') {
        await capture('baseline-en-light-1024');
        if (artifacts)
          await writeFile(
            path.join(artifacts, 'baseline-metrics.json'),
            JSON.stringify(
              { sectionHeight: (await section.boundingBox())!.height, interfaces: 17 },
              null,
              2,
            ),
          );
        return;
      }
      await suite.test(
        'CN1: actual errors remain visible in the closed summary without exposing diagnostics',
        async () => {
          await update({ status: status(), value: initialExclusions, locale: 'en', mode: 'light' });
          await section.evaluate((element: HTMLDetailsElement) => (element.open = false));
          const problem = section
            .locator(':scope > summary')
            .getByTestId('network-interface-problem');
          assert.equal(await problem.count(), 0);
          await update({ status: { ...status(), inventoryError: 'Synthetic inventory failure' } });
          await problem.waitFor();
          assert.equal(await problem.textContent(), networkInterfaceMessages('en').unavailable);
          assert.equal(await section.locator('pre').isVisible(), false);
          assert.ok(
            !(await section.locator(':scope > summary').textContent())!.includes('Synthetic'),
          );
          await update({
            status: {
              ...status(),
              listeners: [{ address: '192.0.2.10', port: 7336, state: 'error', error: null }],
            },
          });
          assert.equal(
            await problem.isVisible(),
            true,
            'A listener error state is sufficient even without a diagnostic string',
          );
          const allExcluded = Object.keys(inventory).map((name) => ({ name }));
          await update({ status: status(allExcluded), value: allExcluded });
          assert.equal(
            await problem.count(),
            0,
            'Intentional exclusions are not actual listener failures',
          );
          const noIpv4 = computeNetworkInterfacePolicy({ utun0: [] });
          await update({ status: { ...noIpv4, listeners: [], inventoryError: null }, value: [] });
          assert.equal(
            await problem.count(),
            0,
            'No assigned IPv4 alone is not a reported runtime error',
          );
          await page.setViewportSize({ width: 1024, height: 900 });
          await update({
            locale: 'ru',
            mode: 'dark',
            value: initialExclusions,
            status: {
              ...status(),
              listeners: [
                {
                  address: '192.0.2.10',
                  port: 7336,
                  state: 'error',
                  error: 'Synthetic bind failure',
                },
              ],
            },
          });
          assert.equal(await problem.textContent(), networkInterfaceMessages('ru').unavailable);
          assert.equal(
            await section.evaluate((element: HTMLDetailsElement) => element.open),
            false,
          );
          assert.equal(await section.locator('pre').isVisible(), false);
          assert.ok(
            !(await section.locator(':scope > summary').textContent())!.includes('Synthetic'),
          );
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await capture('cn1-closed-error-ru-dark-1024');
        },
      );
      await suite.test(
        'CN2: an ambiguous row explains all matches and removes only its selected record locally',
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
          await section.locator(':scope > summary').focus();
          await page.keyboard.press('Enter');
          const m = networkInterfaceMessages('ru');
          const row = section.locator('[data-interface-name="Ethernet"]');
          const toggle = row.getByRole('switch');
          assert.equal(await toggle.isDisabled(), true);
          const globalDetails = section.getByTestId('network-technical-details');
          assert.equal(
            await globalDetails.evaluate((element: HTMLDetailsElement) => element.open),
            false,
          );
          const recovery = row.getByTestId('network-row-recovery');
          await recovery.locator(':scope > summary').focus();
          await page.keyboard.press('Enter');
          const records = recovery.getByTestId('network-row-exclusion');
          assert.equal(await records.count(), 2);
          for (const record of await records.all()) {
            assert.ok((await record.textContent())!.includes(m.ambiguous));
            assert.ok((await record.textContent())!.includes('Ethernet, USB Ethernet'));
            assert.ok((await record.textContent())!.includes(first.mac));
          }
          assert.equal(
            await globalDetails.evaluate((element: HTMLDetailsElement) => element.open),
            false,
            'Targeted explanation does not require opening unrelated Technical details',
          );
          await capture('cn2-targeted-recovery-ru-dark-1024');
          await records
            .filter({ hasText: first.name })
            .getByRole('button', { name: m.remove, exact: true })
            .click();
          assert.deepEqual(await draft(), [absent, second, ...initialExclusions]);
          assert.equal(
            await toggle.isDisabled(),
            true,
            'Another ambiguous exclusion still applies',
          );
          await update({ disabled: true });
          assert.equal(
            await records.getByRole('button', { name: m.remove, exact: true }).isDisabled(),
            true,
          );
          await update({ disabled: false });
          await records.getByRole('button', { name: m.remove, exact: true }).click();
          assert.deepEqual(await draft(), [absent, ...initialExclusions]);
          assert.equal(await toggle.isDisabled(), false);
          assert.equal(await recovery.count(), 0);
          assert.equal(
            await globalDetails.evaluate((element: HTMLDetailsElement) => element.open),
            false,
          );
          assert.deepEqual(errors, []);
        },
      );
      if (process.env.NCF_COMPACT_NETWORK_SEMANTIC === '1') return;
      await suite.test(
        'EN/RU narrow/wide light/dark remain compact by default and expose 48px working rows',
        async () => {
          const metrics: unknown[] = [];
          for (const locale of ['en', 'ru'] as const)
            for (const mode of ['light', 'dark'] as const)
              for (const width of [1024, 1440]) {
                await page.setViewportSize({ width, height: 900 });
                await update({ locale, mode, status: status(), value: initialExclusions });
                await section.evaluate((element: HTMLDetailsElement) => (element.open = false));
                assert.equal((await section.boundingBox())!.height, 44);
                assert.equal(await section.getByRole('switch').count(), 0);
                await capture(`${locale}-${mode}-${width}-collapsed`);
                await section.locator(':scope > summary').focus();
                await page.keyboard.press('Enter');
                assert.equal(await section.getByRole('switch').count(), 4);
                const rows = section.getByTestId('network-primary-list').locator(':scope > li');
                assert.equal(await rows.count(), 4);
                for (const row of await rows.all()) {
                  assert.ok(
                    (await row.boundingBox())!.height >= 44 &&
                      (await row.boundingBox())!.height <= 56,
                  );
                  const hit = await row.getByRole('switch').boundingBox();
                  assert.ok(hit && hit.width >= 44 && hit.height >= 44);
                }
                assert.equal(
                  await section
                    .getByText(networkInterfaceMessages(locale).help, { exact: true })
                    .isVisible(),
                  false,
                );
                assert.equal(
                  await section
                    .getByText(networkInterfaceMessages(locale).identityHint, { exact: true })
                    .isVisible(),
                  false,
                );
                assert.equal(await section.getByText('utun0', { exact: true }).isVisible(), false);
                assert.ok(
                  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                );
                await capture(`${locale}-${mode}-${width}-expanded`);
                metrics.push({
                  locale,
                  mode,
                  width,
                  collapsedHeight: 44,
                  expandedHeight: (await section.boundingBox())!.height,
                  rowHeights: await rows.evaluateAll((rows) =>
                    rows.map((row) => row.getBoundingClientRect().height),
                  ),
                });
              }
          if (artifacts)
            await writeFile(
              path.join(artifacts, 'density-metrics.json'),
              JSON.stringify(metrics, null, 2),
            );
        },
      );
      await suite.test(
        'switches alter only the selected draft and secondary loopback/no-IPv4 controls remain reachable',
        async () => {
          await update({ locale: 'en', mode: 'light', status: status(), value: initialExclusions });
          const wifi = section.locator('[data-interface-name="Wi-Fi"]');
          await wifi.locator('summary').focus();
          await page.keyboard.press('Enter');
          await wifi.getByText('192.0.2.11/24', { exact: true }).waitFor();
          await wifi.locator('summary').click();
          const toggle = (name: string) =>
            section.getByRole('switch', {
              name: `${name}: ${networkInterfaceMessages('en').enabled}`,
              exact: true,
            });
          await toggle('Ethernet').uncheck();
          assert.deepEqual(await draft(), [
            ...initialExclusions,
            { name: 'Ethernet', mac: '02:00:00:00:00:02' },
          ]);
          await update({ mode: 'dark', locale: 'ru' });
          assert.deepEqual(await draft(), [
            ...initialExclusions,
            { name: 'Ethernet', mac: '02:00:00:00:00:02' },
          ]);
          await update({ locale: 'en' });
          await toggle('Ethernet').check();
          assert.deepEqual(await draft(), initialExclusions);
          await section
            .getByTestId('network-technical-details')
            .locator(':scope > summary')
            .click();
          await section.getByText('utun0', { exact: true }).waitFor();
          await toggle('utun0').uncheck();
          assert.deepEqual(await draft(), [...initialExclusions, { name: 'utun0' }]);
          await toggle('utun0').check();
          await toggle('lo0').uncheck();
          assert.deepEqual(await draft(), [...initialExclusions, { name: 'lo0' }]);
          await toggle('lo0').check();
          assert.deepEqual(await draft(), initialExclusions);
        },
      );
      await suite.test(
        'absent/ambiguous exclusions, listener errors, rejected addresses and help remain accessible',
        async () => {
          const value = [
            ...initialExclusions,
            { name: 'Absent VPN' },
            { name: 'Previous Ethernet', mac: '02:00:00:00:00:02' },
          ];
          const policy = computeNetworkInterfacePolicy(
            { ...inventory, 'USB Ethernet': [address('198.51.100.50', '02:00:00:00:00:02')] },
            value,
          );
          const failed: NetworkInterfaceStatus = {
            ...policy,
            interfaces: policy.interfaces.map((entry) =>
              entry.name === 'Wi-Fi'
                ? { ...entry, rejected: [{ address: '0.0.0.0', reason: 'unspecified-address' }] }
                : entry,
            ),
            inventoryError: 'Synthetic inventory error',
            listeners: [
              { address: '192.0.2.10', port: 7336, state: 'error', error: 'Synthetic EADDRINUSE' },
            ],
          };
          await update({ status: failed, value, locale: 'en' });
          const technical = section.getByTestId('network-technical-details');
          await technical.evaluate((element: HTMLDetailsElement) => (element.open = true));
          await technical.getByText(networkInterfaceMessages('en').help, { exact: true }).waitFor();
          await technical
            .getByText(networkInterfaceMessages('en').identityHint, { exact: true })
            .waitFor();
          assert.equal(
            await section
              .getByRole('switch', { name: 'Ethernet: Listening enabled', exact: true })
              .isDisabled(),
            true,
          );
          const absent = technical
            .getByTestId('network-exclusion')
            .filter({ hasText: 'Absent VPN' });
          await absent.getByText(networkInterfaceMessages('en').absent, { exact: false }).waitFor();
          await absent.getByRole('button', { name: 'Remove exclusion', exact: true }).click();
          assert.deepEqual(
            await draft(),
            value.filter((entry) => entry.name !== 'Absent VPN'),
          );
          const ambiguous = technical
            .getByTestId('network-exclusion')
            .filter({ hasText: 'Previous Ethernet' });
          assert.ok(
            (await ambiguous.textContent())!.includes(networkInterfaceMessages('en').ambiguous),
          );
          assert.ok((await ambiguous.textContent())!.includes('USB Ethernet'));
          await ambiguous.getByRole('button', { name: 'Remove exclusion', exact: true }).click();
          assert.deepEqual(await draft(), initialExclusions);
          assert.equal(
            await section
              .getByRole('switch', { name: 'Ethernet: Listening enabled', exact: true })
              .isDisabled(),
            false,
          );
          assert.ok((await technical.textContent())!.includes('Synthetic EADDRINUSE'));
          assert.ok((await technical.textContent())!.includes('Synthetic inventory error'));
          assert.ok((await technical.textContent())!.includes('unspecified-address'));
          await update({ disabled: true });
          for (const control of await section.getByRole('switch').all())
            assert.equal(await control.isDisabled(), true);
          for (const control of await section
            .getByRole('button', { name: 'Remove exclusion', exact: true })
            .all())
            assert.equal(await control.isDisabled(), true);
          assert.deepEqual(errors, []);
          await capture('technical-recovery-en-dark-1440');
        },
      );
    } finally {
      await browser?.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

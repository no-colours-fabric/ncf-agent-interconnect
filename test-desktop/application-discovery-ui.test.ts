import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApplicationDiscovery } from '../desktop/renderer/ApplicationDiscovery.js';
import { mcpSetupClients } from '../desktop/shared/mcp-setup.js';
import type { ApplicationDiscoveryModel } from '../desktop/renderer/useApplicationDiscovery.js';
import { discoveryMessages } from '../desktop/renderer/i18n/application-discovery.js';
import { supportedLocales, t } from '../desktop/renderer/i18n/index.js';
import { readFile, mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('all five tiles distinguish installation from setup and expose manual setup for unknown/missing', () => {
  const model: ApplicationDiscoveryModel = {
    offers: [],
    offerError: false,
    acknowledge: async () => {},
    dismiss: () => {},
    busy: false,
    failed: false,
    refresh: async () => {},
    choose: async () => {},
    snapshot: {
      checkedAt: '2026-11-16T00:00:00.000Z',
      platform: 'linux',
      offers: [],
      stateError: false,
      applications: mcpSetupClients.map((client, index) => ({
        client,
        status: index === 0 ? 'detected' : index === 1 ? 'unknown' : 'not-found-in-known-locations',
        instances: [],
        coverage: [],
      })),
    },
  };
  const html = renderToStaticMarkup(
    React.createElement(ApplicationDiscovery, { model, locale: 'en', onSetup: () => {} }),
  );
  for (const client of mcpSetupClients) assert.ok(html.includes('installation-' + client));
  assert.equal(html.match(/>View setup</g)?.length, 5);
  assert.ok(html.includes('Not found in known locations'));
  assert.equal(html.includes('Not installed'), false);
  assert.equal(html.includes('Ready'), false);
});

test('discovery labels are complete and localized in every supported locale', () => {
  const expected = Object.keys(discoveryMessages('en')).sort();
  for (const locale of supportedLocales) {
    const messages = discoveryMessages(locale);
    assert.deepEqual(Object.keys(messages).sort(), expected);
    assert.ok(Object.values(messages).every((text) => typeof text === 'string' && text.length > 0));
    if (locale !== 'en')
      for (const key of ['limited', 'failed', 'claude', 'opencode'] as const)
        assert.notEqual(messages[key], discoveryMessages('en')[key]);
  }
});

test('five official local logos have provenance and contain no executable SVG or external references', async () => {
  const directory = new URL('../desktop/assets/client-logos/', import.meta.url);
  const provenance = JSON.parse(await readFile(new URL('provenance.json', directory), 'utf8'));
  assert.deepEqual(Object.keys(provenance.assets).sort(), [...mcpSetupClients].sort());
  for (const client of mcpSetupClients) {
    const asset = provenance.assets[client];
    const data = await readFile(new URL(asset.file, directory));
    assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256);
    assert.ok(asset.source && asset.owner && asset.license);
    if (asset.file.endsWith('.svg')) {
      const svg = data.toString();
      assert.match(svg, /^<svg/);
      assert.doesNotMatch(svg, /<script|<foreignObject|onload=|href="https?:|url\(https?:/i);
    } else assert.ok(data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  }
});

test(
  'isolated Electron UI: eligible startup tiles, visible offers and untouched overview and manual forms',
  {
    skip: process.env.NCF_DISCOVERY_UI !== '1',
    timeout: 60000,
  },
  async () => {
    const { _electron } = await import('playwright');
    const require = createRequire(import.meta.url);
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-discovery-ui-'));
    const root = fileURLToPath(new URL('..', import.meta.url));
    const snapshot = {
      running: false,
      nodeId: '00000000-0000-4000-8000-000000000001',
      nodeLabel: 'Discovery fixture',
      mcpUrl: '',
      peerUrl: '',
      listenHost: '127.0.0.1',
      localAddresses: [],
      peers: [],
      agents: [],
      directories: [],
      adapters: [],
      exportRoots: [],
      errors: [],
    };
    const discovery = {
      checkedAt: '2026-11-16T00:00:00.000Z',
      platform: 'linux',
      offers: [...mcpSetupClients],
      stateError: false,
      applications: mcpSetupClients.map((client) => ({
        client,
        status: client === 'claude' ? 'unknown' : 'detected',
        instances: [],
        coverage: [],
      })),
    };
    const packageData = Buffer.from(JSON.stringify({ name: 'AionUi', productName: 'AionUi' }));
    const headerData = Buffer.from(
      JSON.stringify({ files: { 'package.json': { offset: '0', size: packageData.length } } }),
    );
    const header = Buffer.alloc(8 + Math.ceil(headerData.length / 4) * 4);
    header.writeUInt32LE(header.length - 4, 0);
    header.writeUInt32LE(headerData.length, 4);
    headerData.copy(header, 8);
    const prefix = Buffer.alloc(8);
    prefix.writeUInt32LE(4);
    prefix.writeUInt32LE(header.length, 4);
    await mkdir(path.join(directory, 'resources'));
    await writeFile(
      path.join(directory, 'resources/app.asar'),
      Buffer.concat([prefix, header, packageData]),
    );
    const main = `const {app,BrowserWindow,ipcMain}=require('electron');
    app.setPath('userData',${JSON.stringify(path.join(directory, 'profile'))});
    const snapshot=${JSON.stringify(snapshot)}, discovery=${JSON.stringify(discovery)};
    global.counts={offered:0,refresh:0,apply:0};
    const v2Base={major:2,installationId:null,installationPath:null,profilePath:'/isolated/v2',configurationPath:'/isolated/v2/config.json'};
    global.fixture={offers:discovery.offers,seen:[],v2:'unproven',saved:[],unavailable:[],replace:false,failNext:false};
    const readDiscovery=()=>({...discovery,offers:global.fixture.offers.filter(client=>!global.fixture.seen.includes(client))});
    const v2Target=()=>global.fixture.v2==='unproven'?v2Base:{...v2Base,installationId:'known-v2',installationPath:'/isolated/OpenCode2.app'};
    const v2Availability=()=>global.fixture.v2==='unavailable'?{state:'unavailable',reason:'target-unresolved'}:{state:'available'};
    ipcMain.handle('interconnect:call',async(e,method,p={})=>{
      if(method==='snapshot')return snapshot;
      if(method==='windowState')return {visible:true};
      if(method==='appVersion')return 'discovery-fixture';
      if(method==='applicationDiscovery')return readDiscovery();
      if(method==='fixtureOfferCount')return global.counts.offered;
      if(method==='fixtureAsarManifest'){
        const core=await import(${JSON.stringify(new URL('../build/core/application-discovery-platforms.js', import.meta.url).href)});
        const boundary=await import(${JSON.stringify(new URL('../build/main/application-discovery-ipc.js', import.meta.url).href)});
        const files=boundary.createNativeDiscoveryFiles();
        return core.asarManifest(files,await files.canonical(${JSON.stringify(directory)}));
      }
      if(method==='applicationDiscoveryRefresh'){global.counts.refresh++;return readDiscovery();}
      if(method==='applicationDiscoveryOffered'){
        global.counts.offered++;
        global.fixture.seen.push(...p.clients);
        return {saved:true};
      }
      if(method==='mcpSetupStatus'){
        const state=global.fixture.unavailable.includes(p.client)||p.client==='claude'?'unavailable':p.client==='aionui'||global.fixture.saved.includes(p.client)?'configured':'missing';
        return {client:p.client,remembered:false,state,files:[]};
      }
      if(method==='opencodeV2SetupDefaults')return {client:'opencode-v2',target:v2Target(),alternatives:[],setupAvailability:v2Availability()};
      if(method==='opencodeV2SetupStatus')return {client:'opencode-v2',target:p.target??v2Target(),setupAvailability:v2Availability(),remembered:false,state:global.fixture.v2==='configured'?'configured':'missing',files:[]};
      if(method==='loginState')return {supported:false,openAtLogin:false};
      if(method==='mcpInstructions'||method==='clientInstructions')return {client:p.client,location:'/isolated',text:'Fixture',configuration:'{}',testPrompt:'Fixture'};
      if(method==='mcpSetupDefaults')return {client:p.client,files:[{id:'configuration',path:'/isolated/'+p.client+'.json',format:'jsonc',alternatives:[]}]};
      if(method==='mcpSetupPreview')return {client:p.client,planId:'00000000-0000-4000-8000-000000000002',expiresAt:new Date(Date.now()+600000).toISOString(),files:p.files.map(f=>({...f,action:global.fixture.replace?'update':'create',changes:[]})),requiresReplacement:global.fixture.replace};
      if(method==='mcpSetupDiscard')return {};
      if(method==='mcpSetupApply'){
        if(global.fixture.replace&&!p.confirmReplace)throw Error('Unexpected fixture write');
        global.counts.apply++;
        if(global.fixture.failNext){
          global.fixture.failNext=false;
          return {status:'failed',error:'Isolated setup error',files:[]};
        }
        global.fixture.saved.push('cursor');
        return {status:'applied',warning:'Isolated setup warning',files:[]};
      }
      throw Error('Unexpected fixture operation: '+method);
    });
    app.whenReady().then(()=>{const w=new BrowserWindow({width:1180,height:230,webPreferences:{preload:${JSON.stringify(path.join(root, 'build/main/preload.cjs'))},contextIsolation:true,nodeIntegration:false}});w.loadFile(${JSON.stringify(path.join(root, 'build/renderer/index.html'))});});`;
    await writeFile(path.join(directory, 'main.cjs'), main);
    const application = await _electron.launch({
      executablePath: require('electron'),
      chromiumSandbox: true,
      args: [path.join(directory, 'main.cjs')],
      env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
    });
    try {
      const page = await application.firstWindow();
      assert.deepEqual(
        await page.evaluate(() => window.interconnect.invoke('fixtureAsarManifest')),
        { name: 'AionUi', productName: 'AionUi' },
      );
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page
        .getByTestId('application-startup-setup')
        .waitFor()
        .catch(async (error) => {
          throw new Error(
            String(error) +
              '\npage errors: ' +
              errors.join(' | ') +
              '\nbody: ' +
              (await page.locator('body').innerText()),
          );
        });
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('[data-testid="application-startup-setup"] img')].length ===
            2 &&
          [...document.querySelectorAll('[data-testid="application-startup-setup"] img')].every(
            (image) => (image as HTMLImageElement).naturalWidth > 0,
          ),
      );
      await page.waitForFunction(() =>
        document.querySelector('[data-testid="application-startup-setup"]'),
      );
      assert.equal(
        await application.evaluate(
          () => (globalThis as unknown as { counts: { offered: number } }).counts.offered,
        ),
        0,
        'offers below the viewport must remain unacknowledged',
      );
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].setSize(1180, 880),
      );
      const waitForSeen = async (clients: string[]) => {
        await application.evaluate(async (_electron, expected) => {
          const fixture = (globalThis as unknown as { fixture: { seen: string[] } }).fixture;
          for (let attempt = 0; attempt < 80; attempt++) {
            if (expected.every((client) => fixture.seen.includes(client))) return;
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
          throw new Error('Offers were not acknowledged: ' + expected.join(', '));
        }, clients);
      };
      await waitForSeen(['cursor', 'codex']);
      type Scene = {
        offers: string[];
        seen: string[];
        v2: 'unproven' | 'eligible' | 'configured' | 'unavailable';
        saved: string[];
        unavailable: string[];
        replace: boolean;
        failNext: boolean;
      };
      const startup = page.getByTestId('application-startup-setup');
      const fixture = async (patch: Partial<Scene>, locale: 'en' | 'ru', width: number) => {
        await application.evaluate(
          ({ BrowserWindow }, { patch: values, width: size }) => {
            Object.assign(
              (globalThis as unknown as { fixture: Scene }).fixture,
              {
                offers: [],
                seen: [],
                v2: 'unproven',
                saved: [],
                unavailable: [],
                replace: false,
                failNext: false,
              },
              values,
            );
            BrowserWindow.getAllWindows()[0].setSize(size, 880);
          },
          { patch, width },
        );
        await page.evaluate((value) => localStorage.setItem('interconnect.locale', value), locale);
        await page.reload();
        await page.getByTestId('nav-overview').waitFor();
      };
      const assertStartupLayout = async (clients: string[], columns: number) => {
        const grid = startup.getByTestId('startup-application-grid');
        await grid.waitFor();
        const cards = grid.getByRole('article');
        assert.deepEqual(
          await cards.evaluateAll((items) => items.map((item) => item.getAttribute('data-testid'))),
          clients.map((client) => 'startup-application-' + client),
        );
        const layout = await grid.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            width: rect.width,
            center: (rect.left + rect.right) / 2,
            columns: Number(getComputedStyle(element).getPropertyValue('--startup-card-columns')),
            cards: [...element.children].map((child) => {
              const card = child.getBoundingClientRect();
              return {
                left: card.left,
                right: card.right,
                top: card.top,
                bottom: card.bottom,
                minHeight: getComputedStyle(child).minHeight,
              };
            }),
          };
        });
        assert.equal(layout.columns, columns, JSON.stringify(layout));
        for (const card of layout.cards) {
          assert.equal(card.minHeight, '360px');
          assert.ok(card.bottom - card.top >= 360, JSON.stringify(layout));
          assert.ok(
            Math.abs(card.right - card.left - (layout.width - 16 * (columns - 1)) / columns) < 1,
            JSON.stringify(layout),
          );
        }
        for (const top of new Set(layout.cards.map((card) => card.top))) {
          const row = layout.cards.filter((card) => card.top === top);
          const midpoint = (row[0]!.left + row.at(-1)!.right) / 2;
          assert.ok(Math.abs(midpoint - layout.center) < 1, JSON.stringify(layout));
          for (let i = 1; i < row.length; i++)
            assert.ok(row[i]!.left - row[i - 1]!.right >= 15.5, JSON.stringify(layout));
        }
        assert.equal(await startup.locator('details').count(), 0);
        assert.equal(await startup.getByRole('button', { name: 'Manual setup' }).count(), 0);
      };
      assert.deepEqual(
        await application.evaluate(() =>
          (globalThis as unknown as { fixture: Scene }).fixture.seen.toSorted(),
        ),
        ['codex', 'cursor'],
        'Only visible eligible cards must be acknowledged',
      );
      await assertStartupLayout(['cursor', 'codex'], 6);
      assert.equal(await startup.getByRole('heading', { name: 'Connect your apps' }).count(), 1);
      await page.screenshot({
        path: path.join(os.tmpdir(), 'ncf-startup-cards-en-wide.png'),
        animations: 'disabled',
      });
      await fixture({ offers: ['cursor'] }, 'ru', 640);
      await assertStartupLayout(['cursor'], 2);
      assert.equal(
        await startup.getByRole('heading', { name: 'Подключите свои приложения' }).count(),
        1,
      );
      assert.equal(await page.getByRole('button', { name: 'Продолжить', exact: true }).count(), 1);
      await page.screenshot({
        path: path.join(os.tmpdir(), 'ncf-startup-cards-ru-narrow.png'),
        animations: 'disabled',
      });
      await fixture({ offers: ['cursor', 'codex', 'opencode'], v2: 'eligible' }, 'ru', 700);
      await assertStartupLayout(['cursor', 'opencode-v2', 'codex'], 2);
      await fixture({ offers: ['opencode'], v2: 'eligible' }, 'en', 1010);
      await assertStartupLayout(['opencode-v2'], 4);
      await fixture({ offers: ['cursor'], replace: true }, 'en', 900);
      await assertStartupLayout(['cursor'], 3);
      await startup.getByTestId('startup-connect-cursor').click();
      const confirmation = page.getByRole('dialog', { name: 'Confirm configuration changes' });
      await confirmation.waitFor();
      assert.equal(
        await application.evaluate(
          () => (globalThis as unknown as { counts: { apply: number } }).counts.apply,
        ),
        0,
      );
      await confirmation.getByRole('button', { name: 'Apply', exact: true }).click();
      await startup.getByTestId('setup-next-cursor').waitFor();
      assert.equal(await startup.getByRole('article').count(), 0);
      await startup
        .getByTestId('setup-next-cursor')
        .getByRole('button', { name: 'Copy connection prompt' })
        .waitFor();
      assert.equal(await startup.getByText('Isolated setup warning', { exact: true }).count(), 1);
      assert.equal(
        await application.evaluate(
          () => (globalThis as unknown as { counts: { apply: number } }).counts.apply,
        ),
        1,
      );
      await page.reload();
      await page.getByTestId('nav-overview').waitFor();
      assert.equal(await startup.count(), 0);
      for (const patch of [
        {},
        { offers: ['opencode', 'aionui', 'claude', 'codex'], unavailable: ['codex'] },
        { offers: ['opencode'], v2: 'configured' as const },
        { offers: ['opencode'], v2: 'unavailable' as const },
      ]) {
        await fixture(patch, 'en', 1180);
        // Readiness completion is observable on Overview, even when Startup stays closed.
        await page.getByTestId('overview-application-aionui').getByText('Configured').waitFor();
        await assert.rejects(() => startup.waitFor({ state: 'visible', timeout: 300 }), /Timeout/);
      }
      await fixture({ offers: ['codex'] }, 'en', 1180);
      await assertStartupLayout(['codex'], 6);
      await waitForSeen(['codex']);
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await startup.waitFor({ state: 'hidden' });
      const acknowledgementsBeforeDismiss = await page.evaluate(() =>
        window.interconnect.invoke<number>('fixtureOfferCount'),
      );
      await page.reload();
      await page.getByTestId('nav-overview').waitFor();
      assert.equal(await startup.count(), 0);
      await page.getByTestId('nav-mcp').click();
      await page.getByRole('button', { name: 'Refresh', exact: true }).click();
      assert.equal(await page.getByTestId('application-startup-setup').count(), 0);
      assert.equal(
        await page.evaluate(() => window.interconnect.invoke<number>('fixtureOfferCount')),
        acknowledgementsBeforeDismiss,
      );
      await page.getByTestId('nav-settings').click();
      await page.getByLabel('Dark theme', { exact: true }).uncheck();
      await page.getByTestId('nav-overview').click();
      const overviewCards = await page
        .getByTestId('overview-applications-grid')
        .locator(':scope > [data-testid^="overview-application-"]')
        .evaluateAll((cards) =>
          cards.map((card) => {
            const rect = card.getBoundingClientRect();
            return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
          }),
        );
      for (let left = 0; left < overviewCards.length; left++)
        for (let right = left + 1; right < overviewCards.length; right++) {
          const a = overviewCards[left]!;
          const b = overviewCards[right]!;
          assert.ok(
            a.right <= b.left + 0.5 ||
              b.right <= a.left + 0.5 ||
              a.bottom <= b.top + 0.5 ||
              b.bottom <= a.top + 0.5,
            'overview overlap:' + JSON.stringify({ a, b }),
          );
        }
      await page.screenshot({
        path: path.join(os.tmpdir(), 'r0007-ui-light.png'),
        animations: 'disabled',
      });
      await page.getByTestId('nav-mcp').click();
      await page.getByTestId('application-manual-cursor').click();
      const dialog = page.getByRole('main');
      await dialog
        .getByRole('combobox', { name: 'Configuration file path', exact: true })
        .fill('/isolated/unsaved.json');
      await dialog.getByRole('button', { name: 'Back to Applications', exact: true }).click();
      assert.equal(
        await application.evaluate(
          () => (globalThis as unknown as { counts: { apply: number } }).counts.apply,
        ),
        1,
      );
      await page.getByTestId('nav-settings').click();
      const name = page.getByRole('textbox', { name: t('en', 'settingsNodeName'), exact: true });
      await name.fill('Unsaved fixture name');
      await page.getByLabel('Dark theme', { exact: true }).click();
      assert.equal(await name.inputValue(), 'Unsaved fixture name');
      await page.getByTestId('nav-overview').click();
      await page.screenshot({
        path: path.join(os.tmpdir(), 'r0007-ui-dark.png'),
        animations: 'disabled',
      });
      await fixture({ offers: ['cursor'], failNext: true }, 'en', 1180);
      await startup.getByTestId('startup-connect-cursor').click();
      await startup.getByRole('alert').waitFor();
      assert.equal(await startup.getByRole('article').count(), 1);
      await startup.getByTestId('startup-connect-cursor').click();
      await confirmation.waitFor();
      assert.equal(
        await application.evaluate(
          () => (globalThis as unknown as { counts: { apply: number } }).counts.apply,
        ),
        2,
        'A retry after a failed write requires a fresh explicit confirmation',
      );
      await confirmation.getByRole('button', { name: 'Apply', exact: true }).click();
      await startup.getByTestId('setup-next-cursor').waitFor();
      assert.deepEqual(errors, []);
    } finally {
      await application.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

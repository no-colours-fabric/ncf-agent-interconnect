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
  'isolated Electron UI: visible offers, five logos, refresh, manual setup, theme and drafts',
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
        status: 'detected',
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
    ipcMain.handle('interconnect:call',async(e,method,p={})=>{
      if(method==='snapshot')return snapshot;
      if(method==='appVersion')return 'discovery-fixture';
      if(method==='applicationDiscovery')return discovery;
      if(method==='fixtureOfferCount')return global.counts.offered;
      if(method==='fixtureAsarManifest'){
        const core=await import(${JSON.stringify(new URL('../build/core/application-discovery-platforms.js', import.meta.url).href)});
        const boundary=await import(${JSON.stringify(new URL('../build/main/application-discovery-ipc.js', import.meta.url).href)});
        const files=boundary.createNativeDiscoveryFiles();
        return core.asarManifest(files,await files.canonical(${JSON.stringify(directory)}));
      }
      if(method==='applicationDiscoveryRefresh'){global.counts.refresh++;return discovery;}
      if(method==='applicationDiscoveryOffered'){global.counts.offered++;discovery.offers=[];return {saved:true};}
      if(method==='mcpSetupStatus')return {client:p.client,remembered:false,state:'missing',files:[]};
      if(method==='loginState')return {supported:false,openAtLogin:false};
      if(method==='mcpInstructions'||method==='clientInstructions')return {client:p.client,location:'/isolated',text:'Fixture',configuration:'{}',testPrompt:'Fixture'};
      if(method==='mcpSetupDefaults')return {client:p.client,files:[{id:'configuration',path:'/isolated/'+p.client+'.json',format:'jsonc',alternatives:[]}]};
      if(method==='mcpSetupPreview')return {client:p.client,planId:'00000000-0000-4000-8000-000000000002',expiresAt:new Date(Date.now()+600000).toISOString(),files:p.files.map(f=>({...f,action:'create',changes:[]})),requiresReplacement:false};
      if(method==='mcpSetupDiscard')return {};
      if(method==='mcpSetupApply'){global.counts.apply++;throw Error('Apply forbidden in fixture');}
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
      await page.getByTestId('application-startup-setup').waitFor();
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('[data-testid="application-startup-setup"] img')].length ===
            5 &&
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
      await page.waitForFunction(
        async () => (await window.interconnect.invoke<number>('fixtureOfferCount')) >= 1,
      );
      const visibleAcknowledgements = await application.evaluate(
        () => (globalThis as unknown as { counts: { offered: number } }).counts.offered,
      );
      assert.ok(visibleAcknowledgements >= 1);
      await page.getByRole('button', { name: 'Not now', exact: true }).click();
      await page.getByTestId('application-startup-setup').waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Refresh', exact: true }).click();
      assert.equal(await page.getByTestId('application-startup-setup').count(), 0);
      assert.equal(
        await application.evaluate(
          () => (globalThis as unknown as { counts: { offered: number } }).counts.offered,
        ),
        visibleAcknowledgements,
      );
      await page.getByTestId('nav-settings').click();
      await page.getByLabel('Dark theme', { exact: true }).uncheck();
      await page.getByTestId('nav-overview').click();
      await page.screenshot({
        path: path.join(os.tmpdir(), 'r0007-ui-light.png'),
        animations: 'disabled',
      });
      await page.getByTestId('overview-application-cursor').click();
      const dialog = page.getByRole('main');
      await dialog
        .getByRole('textbox', { name: 'Configuration file path', exact: true })
        .fill('/isolated/unsaved.json');
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(
        await application.evaluate(
          () => (globalThis as unknown as { counts: { apply: number } }).counts.apply,
        ),
        0,
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
      assert.deepEqual(errors, []);
    } finally {
      await application.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

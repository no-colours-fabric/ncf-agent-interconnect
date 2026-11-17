import { OwnConnectionCard } from '../desktop/renderer/OwnConnectionCard.js';
import { lanDiscoveryMessages } from '../desktop/renderer/i18n/lan-discovery.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { build } from 'vite';
import { chromium, type Page } from 'playwright';
import type { Snapshot } from '../desktop/shared/contracts.js';
import type { LanSearchNode } from '../desktop/shared/lan-search.js';
import {
  NetworkPage,
  lanSearchNavigation,
  unpairedLanNodes,
} from '../desktop/renderer/NetworkPage.js';
import {
  lanSearchEnglish,
  lanSearchMessages,
  formatLanSearch,
} from '../desktop/renderer/i18n/lan-search.js';
import { supportedLocales, t as translate, type Locale } from '../desktop/renderer/i18n/index.js';

const first: LanSearchNode = {
  key: 'first@192.0.2.20:7336',
  nodeId: '00000000-0000-4000-8000-000000000002',
  label: 'Remote Ж <&>',
  address: 'wss://192.0.2.20:7336/peer',
  observedInRun: true,
  newlyFound: true,
  lastSeenAgoMs: 0,
};
const second: LanSearchNode = {
  ...first,
  key: 'second@192.0.2.30:7336',
  nodeId: '00000000-0000-4000-8000-000000000003',
  label: 'Second computer',
  address: 'wss://192.0.2.30:7336/peer',
  observedInRun: false,
  newlyFound: false,
  lastSeenAgoMs: 60000,
};
const snapshot = (): Snapshot => ({
  running: true,
  nodeId: '00000000-0000-4000-8000-000000000001',
  nodeLabel: 'Isolated fixture',
  mcpUrl: 'http://127.0.0.1:1/mcp',
  peerUrl: 'wss://127.0.0.1:7336/peer',
  listenHost: '127.0.0.1',
  localAddresses: [],
  lanSearch: {
    phase: 'searching',
    reason: null,
    runId: 1,
    durationMs: 30000,
    elapsedMs: 12000,
    foundCount: 1,
    nodes: [{ ...first }, { ...second }],
    unseenKeys: [first.key, second.key],
  },
  peers: [],
  agents: [],
  directories: [],
  adapters: [],
  exportRoots: [],
  errors: [],
});
const noInvoke = async (): Promise<never> => assert.fail('Rendering must not invoke an action');
const placeholders = (text: string) =>
  [...text.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();

test('search UI: all 15 independent dictionaries preserve placeholders and literal user content', () => {
  const keys = Object.keys(lanSearchEnglish).sort();
  assert.equal(supportedLocales.length, 15);
  for (const locale of supportedLocales) {
    const messages = lanSearchMessages(locale);
    assert.deepEqual(Object.keys(messages).sort(), keys);
    for (const key of keys as (keyof typeof lanSearchEnglish)[]) {
      assert.ok(messages[key].trim(), `${locale}.${key}`);
      assert.deepEqual(
        placeholders(messages[key]),
        placeholders(lanSearchEnglish[key]),
        `${locale}.${key}`,
      );
    }
    if (locale !== 'en') {
      assert.notEqual(messages.ownHelp, lanSearchEnglish.ownHelp);
      assert.notEqual(messages.uncertain, lanSearchEnglish.uncertain);
    }
    const html = renderToStaticMarkup(
      createElement(NetworkPage, {
        active: true,
        windowVisible: true,
        snapshot: snapshot(),
        locale,
        invoke: noInvoke,
        onSettings() {},
        ownCode: null,
        onOwnCodeChange() {},
        manual: { address: 'host:7336', code: '', onAddressChange() {}, onCodeChange() {} },
        children: createElement('div', null, 'Retained paired capabilities'),
      }),
    );
    assert.ok(html.includes(messages.ownTitle));
    assert.ok(html.includes('Remote Ж &lt;&amp;&gt;'));
    assert.ok(html.includes(messages.manualConnect));
    messages.searching = 'Caller mutation';
    assert.notEqual(lanSearchMessages(locale).searching, 'Caller mutation');
  }
  assert.equal(
    formatLanSearch(lanSearchEnglish.sidebarStatus, { seconds: 18, count: 1 }),
    'Searching · 18s left · 1 found',
  );
});

test('search UI: navigation excludes paired identities/addresses and retains current-pass count semantics', () => {
  const value = snapshot();
  value.peers = [
    { id: first.nodeId, label: 'Authenticated', address: '', connected: false, error: null },
  ];
  assert.deepEqual(
    unpairedLanNodes(value).map((node) => node.key),
    [second.key],
  );
  assert.deepEqual(lanSearchNavigation(value, 'en'), {
    searching: true,
    unseenCount: 1,
    statusLabel: 'Searching · 18s left · 1 found',
  });
  value.peers.push({
    id: 'different-authenticated-id',
    label: 'Address match',
    address: second.address,
    connected: true,
    error: null,
  });
  assert.equal(lanSearchNavigation(value, 'ru').unseenCount, 0);
  value.lanSearch!.phase = 'stopped';
  assert.deepEqual(lanSearchNavigation(value, 'en'), {
    searching: false,
    unseenCount: 0,
    statusLabel: '',
  });
  delete value.lanSearch;
  assert.deepEqual(unpairedLanNodes(value), []);
});

test('search UI: actual announcement reasons remain separate from search results and code generation', () => {
  const legacy = lanDiscoveryMessages('en');
  const reasons = {
    stopped: legacy.stopped,
    'listener-local': legacy.listenerLocal,
    'listener-unavailable': legacy.listenerUnavailable,
    'no-interfaces': legacy.noInterfaces,
    'transport-error': legacy.transportError,
  } as const;
  for (const [reason, message] of Object.entries(reasons)) {
    const html = renderToStaticMarkup(
      createElement(OwnConnectionCard, {
        node: snapshot(),
        announcement: { available: false, reason: reason as keyof typeof reasons },
        code: null,
        onCodeChange() {},
        locale: 'en',
        invoke: noInvoke,
        onSettings() {},
      }),
    );
    assert.ok(html.includes(message));
    assert.ok(html.includes(lanSearchEnglish.createCode));
    assert.ok(html.includes('announcement-details'));
    assert.ok(!html.includes('<details open'));
  }
});

type Call = { method: string; input: Record<string, unknown> };
interface Fixture {
  calls: Call[];
  update(patch: Record<string, unknown>): void;
  reset(patch?: Record<string, unknown>): void;
  settle(method: string, result?: unknown, error?: string): void;
  failCopy(value: boolean): void;
  visibility(visible: boolean, focused: boolean): void;
  observerMode(mode: 'native' | 'manual'): void;
  observerCount(): number;
  replay(index: number, key: string): void;
  unmount(): void;
}
async function callList(page: Page, method?: string) {
  return page.evaluate(
    (name) =>
      (window as unknown as { fixture: Fixture }).fixture.calls.filter(
        (call) => !name || call.method === name,
      ),
    method,
  );
}
async function update(page: Page, patch: Record<string, unknown>) {
  await page.evaluate(
    (value) => (window as unknown as { fixture: Fixture }).fixture.update(value),
    patch,
  );
}
async function settle(page: Page, method: string, result?: unknown, error?: string) {
  await page.evaluate(
    ({ method, result, error }) =>
      (window as unknown as { fixture: Fixture }).fixture.settle(method, result, error),
    { method, result, error },
  );
}
async function reset(page: Page, patch: Record<string, unknown> = {}) {
  await page.evaluate(
    (value) => (window as unknown as { fixture: Fixture }).fixture.reset(value),
    patch,
  );
  await page.getByTestId('own-connection-card').waitFor({ state: 'attached' });
}
async function until(check: () => Promise<boolean>, description: string) {
  for (let index = 0; index < 100; index++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(description);
}

// This isolated React fixture never constructs NodeService or a network transport.
test(
  'search UI: isolated component flow',
  { skip: process.env.NCF_LAN_SEARCH_UI !== '1', timeout: 120000 },
  async (suite) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-lan-search-ui-'));
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      const require = createRequire(import.meta.url);
      await symlink(
        path.dirname(path.dirname(require.resolve('react/package.json'))),
        path.join(directory, 'node_modules'),
        'junction',
      );
      const source = (name: string) =>
        fileURLToPath(new URL(`../desktop/renderer/${name}`, import.meta.url));
      await writeFile(
        path.join(directory, 'index.html'),
        '<div id="root"></div><script type="module" src="/fixture.tsx"></script>',
      );
      await writeFile(
        path.join(directory, 'fixture.tsx'),
        `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ThemeProvider,CssBaseline,Box,TextField,Button} from '@mui/material';
import {NetworkPage} from ${JSON.stringify(source('NetworkPage.tsx'))};
import {RemoteNodesTable} from ${JSON.stringify(source('RemoteNodesTable.tsx'))};
import {createAppTheme} from ${JSON.stringify(source('theme.ts'))};
const initial=${JSON.stringify(snapshot())};
const calls=[],pending=[],observers=[];
let update,root=createRoot(document.getElementById('root')),generation=0,copyFailure=false,mode='native';
let visible=true,focused=true;
const nativeFocus=document.hasFocus.bind(document);
Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>visible?'visible':'hidden'});
document.hasFocus=()=>focused&&nativeFocus();
const NativeObserver=window.IntersectionObserver;
window.IntersectionObserver=class {
 constructor(callback,options){this.callback=callback;this.targets=new Set();this.native=mode==='native'?new NativeObserver(callback,options):null;observers.push(this);}
 observe(target){this.targets.add(target);this.native?.observe(target);}
 unobserve(target){this.targets.delete(target);this.native?.unobserve(target);}
 disconnect(){this.native?.disconnect();}
};
const invoke=(method,input)=>{
 calls.push({method,input});
 if(method==='copy')return copyFailure?Promise.reject(new Error('Fixture copy failure')):Promise.resolve({copied:true});
 if(method==='ackLanSearch')return Promise.resolve({acknowledged:true});
 if(method==='startLanSearch')return Promise.resolve({started:true});
 if(method==='stopLanSearch')return Promise.resolve({stopped:true});
 return new Promise((resolve,reject)=>pending.push({method,resolve,reject}));
};
function App({patch}){
 const[state,setState]=React.useState({snapshot:structuredClone(initial),active:true,windowVisible:true,obscured:false,locale:'en',theme:'dark',ownCode:null,address:'manual-draft:7336',code:'ABCD2345',legacy:false,...patch});
 update=patch=>flushSync(()=>setState(value=>({...value,...patch})));
 return <ThemeProvider theme={createAppTheme(state.theme)}><CssBaseline/><Box sx={{p:4,ml:'240px'}}>
  <NetworkPage active={state.active} windowVisible={state.windowVisible} obscured={state.obscured} snapshot={state.snapshot} locale={state.locale} invoke={invoke} onSettings={()=>calls.push({method:'settings',input:{}})} ownCode={state.ownCode} onOwnCodeChange={ownCode=>setState(value=>({...value,ownCode}))} manual={{address:state.address,code:state.code,onAddressChange:address=>setState(value=>({...value,address})),onCodeChange:code=>setState(value=>({...value,code})),content:state.legacy?<form data-testid="legacy-manual" onSubmit={event=>event.preventDefault()}><TextField label="Retained manual field" value={state.address} onChange={event=>setState(value=>({...value,address:event.target.value}))}/><Button onClick={()=>calls.push({method:'legacyConnect',input:{address:state.address,code:state.code}})}>Retained manual action</Button></form>:undefined}}>
   <RemoteNodesTable snapshot={state.snapshot} locale={state.locale} nodeName={id=>state.snapshot.peers.find(peer=>peer.id===id)?.label||id}/>
   <Button onClick={()=>calls.push({method:'retainedDetails',input:{}})}>Retained details action</Button>
  </NetworkPage>
 </Box></ThemeProvider>;
}
window.fixture={calls,update:patch=>update(patch),reset(patch={}){calls.length=0;copyFailure=false;visible=true;focused=true;mode='native';flushSync(()=>root.render(<App key={++generation} patch={patch}/>));},settle(method,result,error){const index=pending.findIndex(request=>request.method===method);if(index<0)throw new Error('No pending '+method);const [request]=pending.splice(index,1);error?request.reject(new Error(error)):request.resolve(result);},failCopy(value){copyFailure=value;},visibility(v,f){visible=v;focused=f;document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event(f?'focus':'blur'));},observerMode(value){mode=value;},observerCount:()=>observers.length,replay(index,key){const observer=observers[index];const target=[...document.querySelectorAll('[data-lan-key]')].find(row=>row.dataset.lanKey===key);if(target)observer.callback([{target,isIntersecting:true,intersectionRatio:1}]);},unmount(){root.unmount();root=createRoot(document.getElementById('root'));}};
root.render(<App key={generation} patch={{}}/>);
`,
      );
      const result = await build({
        root: directory,
        configFile: false,
        logLevel: 'silent',
        cacheDir: path.join(directory, 'cache'),
        build: { write: false, minify: true },
      });
      const outputs = Array.isArray(result) ? result : [result];
      const bundle = outputs
        .flatMap((output) => ('output' in output ? output.output : []))
        .find((output) => output.type === 'chunk');
      assert.ok(bundle && bundle.type === 'chunk');
      browser = await chromium.launch({
        channel: process.env.NCF_UI_CHROMIUM_CHANNEL || 'chrome',
        headless: true,
        chromiumSandbox: true,
      });
      const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/*', (route) => route.abort());
      await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
      // Vite's ESM fixture is evaluated as a module, without a server or external requests.
      await page.addScriptTag({ type: 'module', content: bundle.code });
      const selectedCases = process.env.NCF_LAN_SEARCH_UI_CASES?.split(',');
      const runCase = (id: string, name: string, body: () => Promise<void>) =>
        suite.test(name, { skip: !!selectedCases && !selectedCases.includes(id) }, body);
      const connectButton = () =>
        page.getByRole('button', { name: `Connect ${first.label}`, exact: true });
      const dialog = () => page.getByRole('dialog');
      const codeInput = () =>
        dialog().getByRole('textbox', { name: lanSearchEnglish.connectionCode, exact: true });
      const submit = () => dialog().getByRole('button', { name: 'Connect', exact: true });
      const manual = () =>
        page.getByRole('button', { name: lanSearchEnglish.manualConnect, exact: true });

      await runCase(
        'own',
        'inline own code requires an action; copy, refresh, expiry and drafts survive navigation/theme',
        async () => {
          await reset(page);
          assert.equal((await callList(page, 'accessCode')).length, 0);
          assert.equal((await callList(page, 'startLanSearch')).length, 0);
          await page
            .getByRole('button', { name: 'Create code', exact: true })
            .evaluate((button: HTMLButtonElement) => {
              button.click();
              button.click();
            });
          assert.equal((await callList(page, 'accessCode')).length, 1);
          const expiresAt = new Date(Date.now() + 600000).toISOString();
          await settle(page, 'accessCode', { code: 'ABCD2345', expiresAt });
          const own = page.getByTestId('own-connection-card');
          await own.getByRole('textbox', { name: 'Connection code', exact: true }).waitFor();
          assert.equal(await page.getByRole('dialog').count(), 0);
          await own.getByRole('button', { name: 'Copy code', exact: true }).click();
          assert.deepEqual((await callList(page, 'copy')).at(-1)?.input, { text: 'ABCD2345' });
          await update(page, { active: false, theme: 'light' });
          await update(page, { active: true });
          assert.equal(
            await own.getByRole('textbox', { name: 'Connection code', exact: true }).inputValue(),
            'ABCD2345',
          );
          assert.equal((await callList(page, 'accessCode')).length, 1);
          await own.getByRole('button', { name: 'Create new code', exact: true }).click();
          await settle(page, 'accessCode', { code: 'BCDE3456', expiresAt });
          await until(
            async () =>
              (await own
                .getByRole('textbox', { name: 'Connection code', exact: true })
                .inputValue()) === 'BCDE3456',
            'Refresh replaces code once',
          );
          const geometry = await own
            .getByRole('button', { name: 'Create new code', exact: true })
            .boundingBox();
          const expiry = await own.getByTestId('own-code-expiry').boundingBox();
          assert.ok(geometry && expiry && geometry.x < expiry.x && geometry.width === 24);
          await page.evaluate(() =>
            (window as unknown as { fixture: Fixture }).fixture.failCopy(true),
          );
          await own.getByRole('button', { name: 'Copy address', exact: true }).click();
          await own.getByRole('alert').filter({ hasText: lanSearchEnglish.copyFailed }).waitFor();
          await update(page, {
            ownCode: { code: 'ABCD2345', expiresAt: new Date(Date.now() - 1000).toISOString() },
          });
          await own.getByText('Code expired', { exact: true }).waitFor();
          assert.equal(
            await own.getByRole('button', { name: 'Copy code', exact: true }).count(),
            0,
          );
          await update(page, { snapshot: { ...snapshot(), running: false } });
          assert.ok(
            await own.getByRole('button', { name: 'Create code', exact: true }).isDisabled(),
          );
          await own.getByText(lanSearchEnglish.startNodeHint, { exact: true }).waitFor();
          await own.getByRole('button', { name: 'Network settings', exact: true }).click();
          assert.equal((await callList(page, 'settings')).length, 1);
        },
      );

      await runCase(
        'search',
        'Stop/Retry use explicit empty inputs and retain results independently of current-pass count',
        async () => {
          await reset(page);
          await page.getByText('Found: 1', { exact: true }).waitFor();
          assert.equal(
            await page
              .getByRole('progressbar', { name: 'Search time' })
              .getAttribute('aria-valuenow'),
            '40',
          );
          await page.getByRole('button', { name: 'Stop search', exact: true }).click();
          assert.deepEqual((await callList(page, 'stopLanSearch'))[0].input, {});
          const value = snapshot();
          value.lanSearch!.phase = 'stopped';
          await update(page, { snapshot: value });
          await page.getByRole('button', { name: 'Search again', exact: true }).click();
          assert.deepEqual((await callList(page, 'startLanSearch'))[0].input, {});
          value.lanSearch = {
            ...value.lanSearch!,
            phase: 'searching',
            runId: 2,
            elapsedMs: 0,
            foundCount: 0,
          };
          await update(page, { snapshot: value });
          await page.getByText('Found: 0', { exact: true }).waitFor();
          assert.equal(await page.locator('[data-lan-key]').count(), 2);
          const heading = await page
            .getByRole('heading', { name: 'Nearby computers', exact: true })
            .boundingBox();
          const action = await manual().boundingBox();
          assert.ok(
            heading &&
              action &&
              action.x > heading.x + heading.width &&
              Math.abs(heading.y + heading.height / 2 - (action.y + action.height / 2)) < 3,
          );
        },
      );

      await runCase(
        'pair',
        'selected endpoint is frozen; duplicate submission and uncertain admission cannot be retried blindly',
        async () => {
          await reset(page);
          await connectButton().click();
          await codeInput().fill('11111111');
          assert.ok(await submit().isDisabled());
          await codeInput().fill('abcd2345');
          assert.equal(await codeInput().inputValue(), 'ABCD2345');
          const changed = snapshot();
          changed.lanSearch!.nodes = [
            { ...first, key: 'new-endpoint', address: 'wss://192.0.2.99:7336/peer' },
            second,
          ];
          await update(page, { snapshot: changed });
          await dialog().getByText(lanSearchEnglish.selectedMissing, { exact: true }).waitFor();
          await dialog()
            .locator('form')
            .evaluate((form: HTMLFormElement) => {
              form.requestSubmit();
              form.requestSubmit();
            });
          assert.deepEqual(await callList(page, 'connectPeer'), [
            { method: 'connectPeer', input: { address: first.address, code: 'ABCD2345' } },
          ]);
          await settle(page, 'connectPeer', undefined, 'Pairing confirmation is uncertain.');
          await dialog()
            .getByRole('alert')
            .filter({ hasText: lanSearchEnglish.uncertain })
            .waitFor();
          assert.ok(await submit().isDisabled());
          await dialog().getByRole('button', { name: 'Close', exact: true }).click();
          await update(page, { snapshot: snapshot() });
          await connectButton().click();
          await codeInput().fill('ABCD2345');
          assert.ok(await submit().isDisabled());
          await codeInput().fill('BCDE3456');
          await submit().click();
          assert.equal((await callList(page, 'connectPeer')).length, 2);
          await settle(page, 'connectPeer', { id: first.nodeId });
          await dialog().waitFor({ state: 'hidden' });
          await page.getByText('Computer paired.', { exact: true }).waitFor();
          assert.equal(await page.locator(`[data-lan-key="${first.key}"]`).count(), 0);
          assert.equal(await page.getByText('Connected', { exact: true }).count(), 0);
          const authenticated = snapshot();
          authenticated.peers = [
            {
              id: first.nodeId,
              label: 'Authenticated fixture',
              address: first.address,
              connected: false,
              error: null,
            },
          ];
          await update(page, { snapshot: authenticated });
          await page.getByTestId('remote-nodes-table').waitFor();
          await update(page, { snapshot: snapshot() });
          await connectButton().waitFor();
        },
      );

      await runCase(
        'manual',
        'manual input preserves drafts and forwards every existing address form unchanged; legacy slot stays primary',
        async () => {
          await reset(page);
          const forms = [
            '192.0.2.20:7336',
            'fixture-host',
            'wss://fixture.invalid/peer',
            'https://fixture.invalid:7443',
            '[2001:db8::20]:7336',
            '2001:db8::20',
          ];
          for (const address of forms) {
            await manual().click();
            await dialog()
              .getByRole('textbox', { name: translate('en', 'networkAddressLabel'), exact: true })
              .fill(address);
            await codeInput().fill('ABCD2345');
            await submit().click();
            assert.deepEqual((await callList(page, 'connectPeer')).at(-1)?.input, {
              address,
              code: 'ABCD2345',
            });
            await settle(page, 'connectPeer', undefined, 'Incorrect pairing code');
            await dialog().getByRole('button', { name: 'Cancel', exact: true }).click();
          }
          await manual().click();
          const addressField = dialog().getByRole('textbox', {
            name: translate('en', 'networkAddressLabel'),
            exact: true,
          });
          assert.equal(await addressField.inputValue(), forms.at(-1));
          await update(page, { theme: 'light' });
          assert.equal(await addressField.inputValue(), forms.at(-1));
          assert.equal(await codeInput().inputValue(), 'ABCD2345');
          await submit().click();
          await settle(page, 'connectPeer', { id: 'authenticated-manual-fixture' });
          await dialog().waitFor({ state: 'hidden' });
          await manual().click();
          assert.equal(await codeInput().inputValue(), '');
          assert.equal(await addressField.inputValue(), forms.at(-1));
          await dialog().getByRole('button', { name: 'Cancel', exact: true }).click();
          await update(page, { legacy: true });
          await manual().click();
          await dialog().getByTestId('legacy-manual').waitFor();
          assert.equal(
            await dialog().getByRole('button', { name: 'Connect', exact: true }).count(),
            0,
          );
          assert.equal(await dialog().locator('form form').count(), 0);
          await dialog()
            .getByRole('button', { name: 'Retained manual action', exact: true })
            .click();
          assert.equal((await callList(page, 'legacyConnect')).length, 1);
          await dialog().getByRole('button', { name: 'Cancel', exact: true }).click();
        },
      );

      await runCase(
        'visibility',
        'only viewport-visible rows are acknowledged; background/covered/old callbacks cannot clear new keys',
        async () => {
          const many = snapshot();
          many.lanSearch!.nodes = Array.from({ length: 12 }, (_, index) => ({
            ...first,
            key: `row-${index}`,
            nodeId: `fixture-${index}`,
            label: `Computer ${index}`,
            address: `wss://192.0.2.${index + 20}:7336/peer`,
          }));
          many.lanSearch!.unseenKeys = many.lanSearch!.nodes.map((node) => node.key);
          await reset(page, { snapshot: many });
          await page.evaluate(() => window.scrollTo(0, 0));
          await until(
            async () => (await callList(page, 'ackLanSearch')).length > 0,
            'Visible rows are acknowledged with real IntersectionObserver',
          );
          const acknowledged = (await callList(page, 'ackLanSearch')).flatMap(
            (call) => call.input.keys as string[],
          );
          assert.ok(acknowledged.includes('row-0'));
          assert.ok(!acknowledged.includes('row-11'));
          await page.locator('[data-lan-key="row-11"]').scrollIntoViewIfNeeded();
          await until(
            async () =>
              (await callList(page, 'ackLanSearch')).some((call) =>
                (call.input.keys as string[]).includes('row-11'),
              ),
            'Scrolling acknowledges newly visible row',
          );
          for (const patch of [{ active: false }, { windowVisible: false }, { obscured: true }]) {
            await reset(page, { snapshot: many, ...patch });
            await page.waitForTimeout(80);
            assert.equal((await callList(page, 'ackLanSearch')).length, 0);
          }
          await reset(page, { snapshot: many, obscured: true });
          await page.evaluate(() =>
            (window as unknown as { fixture: Fixture }).fixture.visibility(false, false),
          );
          await update(page, { obscured: false });
          await page.waitForTimeout(80);
          assert.equal((await callList(page, 'ackLanSearch')).length, 0);
          await page.evaluate(() => {
            (window as unknown as { fixture: Fixture }).fixture.visibility(true, true);
            (window as unknown as { fixture: Fixture }).fixture.observerMode('manual');
          });
          await update(page, { obscured: true });
          await update(page, { obscured: false });
          const old = await page.evaluate(
            () => (window as unknown as { fixture: Fixture }).fixture.observerCount() - 1,
          );
          await page.getByRole('button', { name: 'Connect Computer 11', exact: true }).click();
          await page.evaluate(
            ({ old }) => (window as unknown as { fixture: Fixture }).fixture.replay(old, 'row-11'),
            { old },
          );
          assert.equal((await callList(page, 'ackLanSearch')).length, 0);
          await dialog().getByRole('button', { name: 'Cancel', exact: true }).click();
          const updated = structuredClone(many);
          updated.lanSearch!.nodes.push({ ...first, key: 'new-key', label: 'New computer' });
          updated.lanSearch!.unseenKeys.push('new-key');
          await update(page, { snapshot: updated });
          await page.evaluate(
            ({ old }) => (window as unknown as { fixture: Fixture }).fixture.replay(old, 'new-key'),
            { old },
          );
          assert.equal((await callList(page, 'ackLanSearch')).length, 0);
          await manual().click();
          const covered = await page.evaluate(
            () => (window as unknown as { fixture: Fixture }).fixture.observerCount() - 1,
          );
          await page.evaluate(
            ({ covered }) =>
              (window as unknown as { fixture: Fixture }).fixture.replay(covered, 'row-0'),
            { covered },
          );
          assert.equal((await callList(page, 'ackLanSearch')).length, 0);
          await dialog().getByRole('button', { name: 'Cancel', exact: true }).click();
        },
      );

      await runCase(
        'late',
        'late Pair and code responses cannot affect a replacement component or changed node',
        async () => {
          await reset(page);
          await connectButton().click();
          await codeInput().fill('ABCD2345');
          await submit().click();
          await page.evaluate(() => (window as unknown as { fixture: Fixture }).fixture.unmount());
          await settle(page, 'connectPeer', { id: first.nodeId });
          await reset(page);
          assert.equal(await page.getByText('Computer paired.', { exact: true }).count(), 0);
          assert.equal(await connectButton().count(), 1);
          await page.getByRole('button', { name: 'Create code', exact: true }).click();
          await update(page, { snapshot: { ...snapshot(), nodeId: 'replacement-node' } });
          await settle(page, 'accessCode', {
            code: 'BCDE3456',
            expiresAt: new Date(Date.now() + 600000).toISOString(),
          });
          assert.equal(
            await page.getByRole('textbox', { name: 'Connection code', exact: true }).count(),
            0,
          );
          await page.getByRole('button', { name: 'Create code', exact: true }).waitFor();
        },
      );

      await runCase(
        'layout',
        'actual paired renderer retains metadata/details; dark/light layouts and permanent labels do not overflow',
        async () => {
          const value = snapshot();
          value.peers = [
            {
              id: first.nodeId,
              label: 'Authenticated fixture',
              address: first.address,
              connected: false,
              error: 'Isolated status diagnostic',
            },
          ];
          await reset(page, { snapshot: value });
          await page.getByTestId('remote-nodes-table').waitFor();
          await page.getByText(first.address, { exact: true }).waitFor();
          await page.getByText('Isolated status diagnostic', { exact: true }).waitFor();
          assert.equal(await connectButton().count(), 0);
          await page.getByRole('button', { name: 'Retained details action', exact: true }).click();
          assert.equal((await callList(page, 'retainedDetails')).length, 1);
          const artifacts = process.env.NCF_LAN_SEARCH_UI_ARTIFACTS;
          if (artifacts) await mkdir(artifacts, { recursive: true });
          for (const width of [1280, 1024]) {
            await page.setViewportSize({ width, height: 1000 });
            for (const theme of ['dark', 'light']) {
              await update(page, {
                theme,
                snapshot: snapshot(),
                ownCode: {
                  code: 'ABCD2345',
                  expiresAt: new Date(Date.now() + 600000).toISOString(),
                },
              });
              await page.evaluate(() => window.scrollTo(0, 0));
              await page.getByRole('textbox', { name: 'Computer address', exact: true }).waitFor();
              const layout = await page.evaluate(() => ({
                width: document.documentElement.clientWidth,
                scrollWidth: document.documentElement.scrollWidth,
              }));
              assert.ok(layout.scrollWidth <= layout.width, `${theme}/${width} overflow`);
              const input = page.getByRole('textbox', { name: 'Computer address', exact: true });
              const inputBox = await input.locator('..').boundingBox();
              assert.equal(inputBox?.height, 44);
              const header = await page
                .getByRole('heading', { name: 'Nearby computers', exact: true })
                .locator('..')
                .boundingBox();
              const manualAction = await manual().boundingBox();
              assert.ok(
                header &&
                  manualAction &&
                  Math.abs(header.x + header.width - manualAction.x - manualAction.width) < 2,
                'Manual action stays at the right edge of the Nearby heading row',
              );
              const primary = await connectButton().boundingBox();
              const stop = await page
                .getByRole('button', { name: 'Stop search', exact: true })
                .boundingBox();
              assert.ok(primary && primary.height >= 44 && stop && stop.height >= 44);

              const label = page.locator(`label[for="${await input.getAttribute('id')}"]`);
              assert.equal(await label.getAttribute('data-shrink'), 'true');
              if (artifacts)
                await page.screenshot({
                  path: path.join(artifacts, `network-${theme}-${width}.png`),
                  fullPage: true,
                });
            }
          }
          await update(page, { locale: 'ru' });
          await page
            .getByRole('heading', { name: lanSearchMessages('ru').ownTitle, exact: true })
            .waitFor();
          assert.equal(
            await page
              .getByRole('textbox', { name: lanSearchMessages('ru').connectionCode, exact: true })
              .inputValue(),
            'ABCD2345',
          );
          await update(page, { locale: 'en', snapshot: snapshot(), ownCode: null });
          await page.getByRole('button', { name: 'Create code', exact: true }).click();
          await page.evaluate(() => (window as unknown as { fixture: Fixture }).fixture.unmount());
          await settle(page, 'accessCode', {
            code: 'BCDE3456',
            expiresAt: new Date(Date.now() + 600000).toISOString(),
          });
          await reset(page);
          assert.equal(
            await page.getByRole('textbox', { name: 'Connection code', exact: true }).count(),
            0,
          );
          assert.deepEqual(errors, []);
        },
      );
    } finally {
      await browser?.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

import { computeNetworkInterfacePolicy } from '../desktop/core/network-interfaces.js';
import { networkInterfaceMessages } from '../desktop/renderer/i18n/network-interfaces.js';
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
  PairAttemptLedger,
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

test('pair attempt provenance: bounded aliases block the same code without trusting claims or changing input', async () => {
  const ledger = new PairAttemptLedger();
  const value = snapshot();
  const alias = { ...first, key: 'alias', address: 'wss://192.0.2.21:7336/peer' };
  value.lanSearch!.nodes = [first, alias];
  const input = { address: first.address, code: 'ABCD2345', expectedNodeId: first.nodeId };
  let attempts = 0;
  const uncertain = async () => {
    attempts++;
    throw new Error('Pairing outcome is uncertain: fixture');
  };
  await assert.rejects(
    ledger.run(value, input, 'Localized uncertainty', uncertain),
    /Localized uncertainty/,
  );
  const manual = { address: '192.0.2.21:7336', code: input.code };
  // Captured address provenance survives discovery expiry and closing the grouped dialog.
  await assert.rejects(
    ledger.run(null, manual, 'Localized uncertainty', uncertain),
    /Localized uncertainty/,
  );
  assert.equal(attempts, 1);
  assert.deepEqual(manual, { address: '192.0.2.21:7336', code: 'ABCD2345' });
  assert.equal(ledger.diagnostic(null, manual), 'Pairing outcome is uncertain: fixture');
  await ledger.run(
    value,
    { address: '192.0.2.99:7336', code: input.code },
    'Localized uncertainty',
    async () => {
      attempts++;
    },
  );
  assert.equal(
    attempts,
    2,
    'An unobserved address is not globally fenced by a claimed UUID or matching code',
  );
  assert.equal(ledger.blocked(value, { ...manual, code: 'BCDE3456' }), false);
  assert.equal(ledger.blocked(value, { ...manual, code: input.code }), true);

  for (let index = 0; index < 160; index++) {
    const node = {
      ...first,
      nodeId: `fixture-node-${index}`,
      address: `wss://192.0.2.1:${10000 + index}/peer`,
    };
    value.lanSearch!.nodes = [node];
    await assert.rejects(
      ledger.run(
        value,
        { address: node.address, code: input.code, expectedNodeId: node.nodeId },
        'Localized uncertainty',
        uncertain,
      ),
    );
    assert.ok(ledger.size <= 128, `Attempt ${index}: ${ledger.size}`);
    assert.equal(ledger.blocked(null, { address: node.address, code: input.code }), true);
    assert.equal(
      ledger.blocked(null, {
        address: alias.address,
        code: input.code,
        expectedNodeId: node.nodeId,
      }),
      true,
    );
  }
  // An older UUID is refreshed last alongside its newly selected address, even with many aliases.
  value.lanSearch!.nodes = Array.from({ length: 160 }, (_, index) => ({
    ...first,
    nodeId: 'fixture-node-159',
    address: `wss://192.0.2.2:${10000 + index}/peer`,
  }));
  const latest = {
    address: 'wss://192.0.2.3:7336/peer',
    code: 'BCDE3456',
    expectedNodeId: 'fixture-node-159',
  };
  await assert.rejects(ledger.run(value, latest, 'Localized uncertainty', uncertain));
  assert.equal(ledger.size, 128);
  assert.equal(ledger.blocked(null, latest), true);
  assert.equal(ledger.blocked(null, { address: latest.address, code: latest.code }), true);
  assert.equal(
    ledger.blocked(null, {
      address: first.address,
      code: latest.code,
      expectedNodeId: latest.expectedNodeId,
    }),
    true,
  );
});

test('endpoint freshness: previous-run addresses retain the previous label in all 15 locales', () => {
  const value = snapshot();
  const alias = {
    ...first,
    key: 'previous-alias',
    address: 'wss://192.0.2.21:7336/peer',
    observedInRun: false,
    newlyFound: false,
    lastSeenAgoMs: 1,
  };
  value.lanSearch!.nodes = [first, alias];
  for (const locale of supportedLocales) {
    const html = renderToStaticMarkup(
      createElement(NetworkPage, {
        active: true,
        windowVisible: true,
        snapshot: value,
        locale,
        invoke: noInvoke,
        onSettings() {},
        ownCode: null,
        onOwnCodeChange() {},
        manual: { address: '', code: '', onAddressChange() {}, onCodeChange() {} },
        children: null,
      }),
    );
    const text = html.replace(/<[^>]+>/g, '');
    const messages = lanSearchMessages(locale);
    const escaped = (text: string) =>
      renderToStaticMarkup(createElement('span', null, text)).slice(6, -7);
    assert.ok(text.includes(`${first.address} — ${escaped(messages.available)}`), locale);
    assert.ok(text.includes(`${alias.address} — ${escaped(messages.previous)}`), locale);
    assert.ok(!text.includes(`${alias.address} — ${escaped(messages.available)}`), locale);
  }
});

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
    statusLabel: 'Searching your network',
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
    'listener-local': networkInterfaceMessages('en').localHelp,
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

test('search UI correction: all15 responder labels describe this search and localized trust/local help remains available', () => {
  const expected: Record<Locale, string> = {
    en: 'Found in this search',
    ru: 'Найден в текущем поиске',
    'zh-CN': '在本次搜索中发现',
    fr: 'Trouvé lors de cette recherche',
    de: 'Bei dieser Suche gefunden',
    it: 'Trovato in questa ricerca',
    es: 'Encontrado en esta búsqueda',
    kk: 'Осы іздеуде табылды',
    ja: '今回の検索で見つかりました',
    'pt-BR': 'Encontrado nesta busca',
    ko: '이번 검색에서 발견됨',
    tr: 'Bu aramada bulundu',
    pl: 'Znaleziono w tym wyszukiwaniu',
    nl: 'Gevonden tijdens deze zoekactie',
    uk: 'Знайдено під час поточного пошуку',
  };
  const escaped = (text: string) =>
    renderToStaticMarkup(createElement('span', null, text)).slice(6, -7);
  for (const locale of supportedLocales) {
    const messages = lanSearchMessages(locale),
      legacy = lanDiscoveryMessages(locale);
    assert.equal(messages.available, expected[locale]);
    assert.deepEqual(placeholders(messages.available), []);
    const own = renderToStaticMarkup(
      createElement(OwnConnectionCard, {
        node: snapshot(),
        code: null,
        onCodeChange() {},
        locale,
        invoke: noInvoke,
        onSettings() {},
      }),
    );
    assert.ok(own.includes(escaped(networkInterfaceMessages(locale).localHelp)), locale);
    assert.ok(!own.includes(escaped(messages.ownHelp)), locale);
    assert.ok(own.includes(escaped(messages.createCode)), locale);
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
        manual: { address: '', code: '', onAddressChange() {}, onCodeChange() {} },
        children: null,
      }),
    );
    assert.ok(html.includes(escaped(expected[locale])), locale);
    assert.ok(html.includes(escaped(legacy.unverified)), locale);
    assert.ok(html.includes('nearby-details'), locale);
  }
  assert.equal(lanSearchMessages('kk').expiresIn, 'Аяқталуына {time} қалды');
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
import {ThemeProvider,CssBaseline,Box,TextField,Button,Dialog,DialogTitle} from '@mui/material';
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
 const[state,setState]=React.useState({snapshot:structuredClone(initial),active:true,windowVisible:true,obscured:false,locale:'en',theme:'dark',ownCode:null,address:'manual-draft:7336',code:'ABCD2345',legacy:false,externalModal:false,nestedModal:false,exitHold:false,...patch});
 update=patch=>flushSync(()=>setState(value=>({...value,...patch})));
 return <ThemeProvider theme={createAppTheme(state.theme)}><CssBaseline/><Box data-testid="fixture-owner" aria-hidden={state.exitHold?true:undefined} sx={{p:4,ml:'240px'}}>
  <NetworkPage active={state.active} windowVisible={state.windowVisible} obscured={state.obscured} snapshot={state.snapshot} locale={state.locale} invoke={invoke} onSettings={()=>calls.push({method:'settings',input:{}})} ownCode={state.ownCode} onOwnCodeChange={ownCode=>setState(value=>({...value,ownCode}))} manual={{address:state.address,code:state.code,onAddressChange:address=>setState(value=>({...value,address})),onCodeChange:code=>setState(value=>({...value,code})),content:state.legacy?<form data-testid="legacy-manual" onSubmit={event=>event.preventDefault()}><TextField label="Retained manual field" value={state.address} onChange={event=>setState(value=>({...value,address:event.target.value}))}/><Button onClick={()=>calls.push({method:'legacyConnect',input:{address:state.address,code:state.code}})}>Retained manual action</Button></form>:undefined}}>
   <RemoteNodesTable snapshot={state.snapshot} locale={state.locale} nodeName={id=>state.snapshot.peers.find(peer=>peer.id===id)?.label||id}/>
   <Button onClick={()=>calls.push({method:'retainedDetails',input:{}})}>Retained details action</Button>
  </NetworkPage>
 </Box>
 <Dialog open={state.externalModal} data-testid="external-modal" aria-labelledby="external-modal-title"><DialogTitle id="external-modal-title">Outer modal fixture</DialogTitle>
  <Dialog open={state.nestedModal} data-testid="nested-modal" aria-labelledby="nested-modal-title"><DialogTitle id="nested-modal-title">Nested modal fixture</DialogTitle></Dialog>
 </Dialog></ThemeProvider>;
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
        'missing-address',
        'CR1: initial running node without an endpoint exposes its localized cue and Settings before code intent',
        async () => {
          const value = snapshot();
          value.peerUrl = '';
          value.peerUrls = [];
          value.listenHost = '';
          value.lanDiscovery = {
            state: 'searching',
            reason: null,
            announcement: { available: false, reason: 'listener-unavailable' },
            nodes: [],
          };
          for (const locale of ['en', 'ru'] as const) {
            await reset(page, { snapshot: value, locale });
            const own = page.getByTestId('own-connection-card');
            const cue = own.getByTestId('own-address-unavailable');
            await cue.waitFor();
            assert.equal(await cue.textContent(), networkInterfaceMessages(locale).emptyEndpoint);
            assert.equal((await callList(page, 'accessCode')).length, 0);
            assert.equal(await own.getByRole('textbox').count(), 0);
            assert.equal(
              await own
                .getByRole('button', { name: lanSearchMessages(locale).createCode, exact: true })
                .isEnabled(),
              true,
            );
            await own
              .getByRole('button', { name: lanSearchMessages(locale).networkSettings, exact: true })
              .click();
            assert.equal((await callList(page, 'settings')).length, 1);
            assert.equal((await callList(page, 'accessCode')).length, 0);
          }
          await reset(page, { snapshot: value });
          const own = page.getByTestId('own-connection-card');
          await own.getByRole('button', { name: 'Create code', exact: true }).click();
          await settle(page, 'accessCode', {
            code: 'ABCD2345',
            expiresAt: new Date(Date.now() + 600000).toISOString(),
          });
          await own.getByRole('textbox', { name: 'Connection code', exact: true }).waitFor();
          assert.equal(
            (await callList(page, 'accessCode')).length,
            1,
            'Missing address does not add a code-generation prerequisite',
          );
          assert.equal(await own.getByTestId('own-address-unavailable').isVisible(), true);
        },
      );
      await runCase(
        'paired-problem',
        'CR2: affected paired row exposes a localized issue and targeted diagnostic without a misleading healthy summary',
        async () => {
          const raw = 'Fixture TLS handshake failed at wss://192.0.2.20:7336/peer';
          for (const locale of ['en', 'ru'] as const) {
            for (const connected of [false, true]) {
              const value = snapshot();
              value.peers = [
                {
                  id: first.nodeId,
                  label: 'Problem computer',
                  address: first.address,
                  connected,
                  error: raw,
                },
                {
                  id: second.nodeId,
                  label: 'Healthy computer',
                  address: second.address,
                  connected: true,
                  error: null,
                },
              ];
              await reset(page, { snapshot: value, locale });
              const row = page.locator(`[data-paired-key="${first.nodeId}"]`);
              const summary = row.locator(':scope > summary');
              await summary
                .getByText(translate(locale, 'clientsConnectionIssues', { count: 1 }), {
                  exact: true,
                })
                .waitFor();
              assert.ok((await summary.boundingBox())!.height >= 44);
              assert.equal((await summary.textContent())!.includes(raw), false);
              assert.equal(await row.getByTestId('paired-problem-diagnostic').isVisible(), false);
              if (connected)
                assert.equal(
                  (await summary.textContent())!.includes(translate(locale, 'networkConnected')),
                  false,
                );
              assert.equal(await page.getByTestId('paired-details').getAttribute('open'), null);
              await summary.focus();
              await summary.press('Enter');
              await row.getByTestId('paired-problem-diagnostic').waitFor();
              assert.equal(await row.locator('pre').textContent(), raw);
              assert.equal(
                await page.getByTestId('paired-details').getAttribute('open'),
                null,
                'Targeted details do not force open the global legacy table',
              );
              assert.equal(
                await page
                  .locator(`[data-paired-key="${second.nodeId}"]`)
                  .getByText(translate(locale, 'networkConnected'), { exact: true })
                  .isVisible(),
                true,
              );
              await summary.press('Enter');
              assert.equal(await row.getByTestId('paired-problem-diagnostic').isVisible(), false);
              assert.equal((await callList(page, 'connectPeer')).length, 0);
              assert.equal((await callList(page, 'accessCode')).length, 0);
            }
          }
        },
      );

      await runCase(
        'own',
        'inline own code requires an action; copy, refresh, expiry and drafts survive navigation/theme',
        async () => {
          await reset(page);
          assert.equal((await callList(page, 'accessCode')).length, 0);
          assert.equal(
            await page.getByRole('button', { name: 'Copy address', exact: true }).count(),
            0,
            'Own address appears only after a connection intent',
          );
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
          await update(page, {
            snapshot: {
              ...snapshot(),
              peerUrl: 'wss://192.0.2.10:7336/peer',
              listenHost: '192.0.2.10',
              peerUrls: ['wss://192.0.2.10:7336/peer', 'wss://198.51.100.10:7336/peer'],
            },
          });
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
          const singleUse = await own.getByText('Single use', { exact: true }).boundingBox();
          assert.ok(geometry && singleUse && geometry.x < singleUse.x && geometry.width === 44);
          assert.equal(await own.getByTestId('own-code-expiry').isVisible(), false);
          await own.getByRole('button', { name: 'Details', exact: true }).click();
          assert.equal(await own.getByTestId('own-code-expiry').isVisible(), true);
          await page.evaluate(() =>
            (window as unknown as { fixture: Fixture }).fixture.failCopy(true),
          );
          await own.getByRole('button', { name: 'Copy address', exact: true }).click();
          await own.getByRole('alert').filter({ hasText: lanSearchEnglish.copyFailed }).waitFor();
          assert.deepEqual(errors, [], 'A failed copy from the address selector must not throw');
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
        'group',
        'one claimed UUID has one card with explicit frozen endpoint choices',
        async () => {
          await reset(page);
          const value = snapshot();
          value.lanSearch!.nodes = [
            { ...first },
            { ...first, key: 'alternate', address: 'wss://192.0.2.21:7336/peer' },
            { ...second },
          ];
          await update(page, { snapshot: value });
          assert.equal(await page.locator('[data-lan-key]').count(), 2);
          const row = page.locator('[data-lan-key]').filter({ hasText: first.label });
          await row.getByTestId('node-endpoints').locator('summary').click();
          assert.ok((await row.textContent())?.includes('Unverified'));
          await row
            .getByRole('button', { name: 'Connect wss://192.0.2.21:7336/peer', exact: true })
            .click();
          value.lanSearch!.nodes = [];
          await update(page, { snapshot: value });
          await codeInput().fill('ABCD2345');
          await submit().click();
          assert.deepEqual((await callList(page, 'connectPeer')).at(-1)?.input, {
            address: 'wss://192.0.2.21:7336/peer',
            code: 'ABCD2345',
            expectedNodeId: first.nodeId,
          });
          await settle(page, 'connectPeer', undefined, 'Pairing confirmation is uncertain.');
          await dialog().getByRole('button', { name: 'Close', exact: true }).click();
          value.lanSearch!.nodes = [
            { ...first },
            { ...first, key: 'alternate', address: 'wss://192.0.2.21:7336/peer' },
          ];
          await update(page, { snapshot: value });
          await connectButton().click();
          await codeInput().fill('ABCD2345');
          assert.ok(
            await submit().isDisabled(),
            'Uncertain admission stays fenced across addresses of the same UUID',
          );
          await codeInput().fill('BCDE3456');
          await submit().click();
          await settle(page, 'connectPeer', { id: first.nodeId });
        },
      );

      await runCase(
        'search',
        'Stop/Retry use explicit empty inputs and retain results independently of current-pass count',
        async () => {
          await reset(page);
          await page.getByText('Found: 1', { exact: true }).waitFor();
          const searchDetails = page.getByTestId('nearby-details');
          assert.equal(
            await searchDetails.getByText('12 of 30s · 18s remaining', { exact: true }).isVisible(),
            false,
          );
          await searchDetails.locator('summary').click();
          await searchDetails.getByText('12 of 30s · 18s remaining', { exact: true }).waitFor();
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
            {
              method: 'connectPeer',
              input: { address: first.address, code: 'ABCD2345', expectedNodeId: first.nodeId },
            },
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
          await page.getByTestId('paired-details').locator('summary').click();
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
        'copy-correction',
        'local guidance is actionable while running-only Create/Refresh/Copy/Settings remain available',
        async () => {
          const value = snapshot();
          value.lanDiscovery = {
            state: 'searching',
            reason: null,
            announcement: { available: false, reason: 'listener-local' },
            nodes: [],
          };
          await reset(page, { snapshot: value });
          const own = page.getByTestId('own-connection-card');
          await own
            .getByText(networkInterfaceMessages('en').localHelp, { exact: true })
            .first()
            .waitFor();
          assert.equal(await own.getByText(lanSearchEnglish.ownHelp, { exact: true }).count(), 0);
          assert.equal(
            await own.getByRole('button', { name: 'Create code', exact: true }).isEnabled(),
            true,
          );
          await page
            .getByText('Found in this search', { exact: true })
            .filter({ visible: true })
            .waitFor();
          assert.equal(await page.getByText('Available to connect', { exact: true }).count(), 0);
          const details = page.getByTestId('nearby-details');
          await details.locator('summary').click();
          await details.getByText(lanDiscoveryMessages('en').unverified, { exact: true }).waitFor();
          await own.getByRole('button', { name: 'Create code', exact: true }).click();
          await settle(page, 'accessCode', {
            code: 'ABCD2345',
            expiresAt: new Date(Date.now() + 600000).toISOString(),
          });
          await own.getByRole('button', { name: 'Copy code', exact: true }).click();
          assert.deepEqual((await callList(page, 'copy')).at(-1)?.input, { text: 'ABCD2345' });
          await own.getByRole('button', { name: 'Create new code', exact: true }).click();
          await settle(page, 'accessCode', {
            code: 'BCDE3456',
            expiresAt: new Date(Date.now() + 600000).toISOString(),
          });
          await own.getByRole('button', { name: 'Network settings', exact: true }).click();
          assert.equal((await callList(page, 'settings')).length, 1);
          const unavailable = {
            ...value,
            listenHost: '0.0.0.0',
            peerUrl: 'wss://192.0.2.1:7336/peer',
            lanDiscovery: {
              ...value.lanDiscovery!,
              announcement: { available: false, reason: 'listener-unavailable' },
            },
          };
          await update(page, { snapshot: unavailable });
          assert.equal(
            await own.getByRole('button', { name: 'Create new code', exact: true }).isEnabled(),
            true,
          );
          assert.equal(
            await own.getByRole('textbox', { name: 'Connection code', exact: true }).inputValue(),
            'BCDE3456',
          );
          await own.getByText(lanSearchEnglish.ownHelp, { exact: true }).waitFor();
        },
      );

      await runCase(
        'modal-correction',
        'nested MUI cover and exit gap revoke old intersections; unhide uses fresh geometry only',
        async () => {
          const many = snapshot();
          many.lanSearch!.nodes = Array.from({ length: 12 }, (_, index) => ({
            ...first,
            key: `cover-${index}`,
            nodeId: `cover-node-${index}`,
            label: `Cover computer ${index}`,
            address: `wss://192.0.2.${index + 20}:7336/peer`,
          }));
          many.lanSearch!.foundCount = 12;
          many.lanSearch!.unseenKeys = many.lanSearch!.nodes.map((node) => node.key);
          await reset(page, { snapshot: many, obscured: true });
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.evaluate(() =>
            (window as unknown as { fixture: Fixture }).fixture.observerMode('manual'),
          );
          await update(page, { obscured: false });
          const current = await page.evaluate(
            () => (window as unknown as { fixture: Fixture }).fixture.observerCount() - 1,
          );
          // Run the queued entry in the same task as aria-hidden, before MutationObserver delivery.
          await page.evaluate(
            ({ current }) => {
              document
                .querySelector('[data-testid="fixture-owner"]')!
                .setAttribute('aria-hidden', 'true');
              (window as unknown as { fixture: Fixture }).fixture.replay(current, 'cover-0');
            },
            { current },
          );
          assert.equal((await callList(page, 'ackLanSearch')).length, 0);
          await page.evaluate(() =>
            document.querySelector('[data-testid="fixture-owner"]')!.removeAttribute('aria-hidden'),
          );
          await until(
            async () =>
              (await page.evaluate(() =>
                (window as unknown as { fixture: Fixture }).fixture.observerCount(),
              )) >
              current + 1,
            'Ancestor unhide creates a fresh observer',
          );
          await page.evaluate(
            ({ current }) =>
              (window as unknown as { fixture: Fixture }).fixture.replay(current, 'cover-0'),
            { current },
          );
          assert.equal((await callList(page, 'ackLanSearch')).length, 0);
          const beforeModal = await page.evaluate(
            () => (window as unknown as { fixture: Fixture }).fixture.observerCount() - 1,
          );
          await update(page, { externalModal: true, nestedModal: true });
          await page.getByRole('dialog', { name: 'Nested modal fixture', exact: true }).waitFor();
          assert.equal(
            await page
              .locator('[data-lan-key="cover-0"]')
              .evaluate((row) => !!row.closest('[aria-hidden="true"]')),
            true,
          );
          await page.evaluate(
            ({ beforeModal }) =>
              (window as unknown as { fixture: Fixture }).fixture.replay(beforeModal, 'cover-0'),
            { beforeModal },
          );
          assert.equal((await callList(page, 'ackLanSearch')).length, 0);
          await update(page, { nestedModal: false });
          await page.getByTestId('nested-modal').waitFor({ state: 'hidden' });
          assert.equal(
            await page
              .locator('[data-lan-key="cover-0"]')
              .evaluate((row) => !!row.closest('[aria-hidden="true"]')),
            true,
          );
          await update(page, { externalModal: false, exitHold: true });
          await page.getByTestId('external-modal').waitFor({ state: 'hidden' });
          const changed = structuredClone(many);
          changed.lanSearch!.nodes.push({
            ...first,
            key: 'future-cover-key',
            label: 'New covered computer',
          });
          changed.lanSearch!.unseenKeys.push('future-cover-key');
          await update(page, { snapshot: changed });
          const hiddenObserver = await page.evaluate(
            () => (window as unknown as { fixture: Fixture }).fixture.observerCount() - 1,
          );
          await page.evaluate(
            ({ beforeModal, hiddenObserver }) => {
              const fixture = (window as unknown as { fixture: Fixture }).fixture;
              fixture.replay(beforeModal, 'future-cover-key');
              fixture.replay(hiddenObserver, 'cover-0');
            },
            { beforeModal, hiddenObserver },
          );
          assert.equal((await callList(page, 'ackLanSearch')).length, 0);
          await page.evaluate(() =>
            (window as unknown as { fixture: Fixture }).fixture.observerMode('native'),
          );
          await update(page, { exitHold: false });
          await until(
            async () =>
              (await callList(page, 'ackLanSearch')).some((call) =>
                (call.input.keys as string[]).includes('cover-0'),
              ),
            'Fresh native IntersectionObserver acknowledges visible rows after unhide',
          );
          const accepted = (await callList(page, 'ackLanSearch')).flatMap(
            (call) => call.input.keys as string[],
          );
          assert.ok(!accepted.includes('cover-11'));
          assert.ok(!accepted.includes('future-cover-key'));
          const count = (await callList(page, 'ackLanSearch')).length;
          await page.evaluate(
            ({ beforeModal, hiddenObserver }) => {
              const fixture = (window as unknown as { fixture: Fixture }).fixture;
              fixture.replay(beforeModal, 'future-cover-key');
              fixture.replay(hiddenObserver, 'cover-11');
            },
            { beforeModal, hiddenObserver },
          );
          assert.equal((await callList(page, 'ackLanSearch')).length, count);
          assert.deepEqual(errors, []);
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
          await page.getByTestId('paired-details').locator('summary').click();
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

              assert.equal(await input.getAttribute('aria-label'), 'Computer address');
              const ownBounds = await page.getByTestId('own-connection-card').boundingBox();
              const toolbarBounds = await page.getByTestId('lan-search-toolbar').boundingBox();
              const rowBounds = await page.locator('[data-lan-key]').first().boundingBox();
              assert.ok(
                ownBounds && ownBounds.height <= 196,
                `${theme}/${width} own controls are content-sized`,
              );
              assert.ok(
                toolbarBounds && toolbarBounds.height <= 64,
                `${theme}/${width} compact search toolbar`,
              );
              assert.ok(
                rowBounds && rowBounds.height <= 72,
                `${theme}/${width} compact computer row`,
              );
              assert.equal(
                await page.getByTestId('node-endpoints').first().getByRole('button').count(),
                0,
              );
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

interface WiringHarness {
  calls: Call[];
  failPair(error: string | null): void;
  failNetworkSave(error: string | null): void;
  change(patch: { snapshot?: Snapshot; visible?: boolean }): void;
  navigate(page: string): void;
  holdReads(): void;
  readCount(): number;
  releasePair(index: number): void;
  resumeReads(): void;
  manualIntersections(manual: boolean): void;
  observerFor(key: string): number;
  replay(index: number, key: string): void;
}

// Compile the actual renderer entrypoint once; only its Electron bridge is replaced.
test(
  'network wiring: actual renderer preserves R7 and R1 flows',
  {
    skip: process.env.NCF_LAN_SEARCH_WIRING_UI !== '1',
    timeout: 120000,
  },
  async (suite) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-network-wiring-'));
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      const require = createRequire(import.meta.url);
      await symlink(
        path.dirname(path.dirname(require.resolve('react/package.json'))),
        path.join(directory, 'node_modules'),
        'junction',
      );
      const main = fileURLToPath(new URL('../desktop/renderer/main.tsx', import.meta.url));
      await writeFile(
        path.join(directory, 'index.html'),
        '<!doctype html><html><body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>',
      );
      await writeFile(path.join(directory, 'fixture.tsx'), `import ${JSON.stringify(main)};`);
      const result = await build({
        root: directory,
        configFile: false,
        logLevel: 'silent',
        cacheDir: path.join(directory, 'cache'),
        build: { write: false, minify: true },
      });
      const outputs = (Array.isArray(result) ? result : [result]).flatMap((output) =>
        'output' in output ? output.output : [],
      );
      const assets = new Map(
        outputs.map((output) => [
          output.fileName,
          output.type === 'chunk' ? Buffer.from(output.code) : Buffer.from(output.source),
        ]),
      );
      assert.ok(assets.has('index.html'));
      browser = await chromium.launch({
        channel: process.env.NCF_UI_CHROMIUM_CHANNEL || 'chrome',
        headless: true,
        chromiumSandbox: true,
      });
      const origin = 'https://ncf-network-fixture.invalid';
      const errors: string[] = [];
      const open = async (offers: string[] = [], hash = 'network') => {
        const page = await browser!.newPage({ viewport: { width: 1280, height: 1000 } });
        page.on('pageerror', (error) => errors.push(error.message));
        const initial = snapshot();
        initial.networkInterfaces = {
          ...computeNetworkInterfacePolicy({
            'Fixture interface': [
              {
                address: '127.0.0.1',
                netmask: '255.0.0.0',
                family: 'IPv4',
                internal: true,
                mac: '00:00:00:00:00:00',
              },
            ],
          }),
          listeners: [{ address: '127.0.0.1', port: 7336, state: 'listening', error: null }],
          inventoryError: null,
        };
        initial.peers = [
          {
            id: 'authenticated-fixture-peer',
            label: 'Authenticated fixture',
            address: 'wss://192.0.2.90:7336/peer',
            connected: false,
            error: 'Retained fixture peer diagnostic',
          },
        ];
        await page.addInitScript({
          content: `
const calls=[],listeners=new Set(),navigation=new Set(),reads=[],intersections=[];
let manualIntersections=false;
const NativeIntersectionObserver=window.IntersectionObserver;
window.IntersectionObserver=class {
 constructor(callback,options){this.callback=callback;this.targets=new Set();this.native=new NativeIntersectionObserver(entries=>{if(!manualIntersections)callback(entries);},options);intersections.push(this);}
 observe(target){this.targets.add(target);this.native.observe(target);}
 unobserve(target){this.targets.delete(target);this.native.unobserve(target);}
 disconnect(){this.native.disconnect();}
};
let value=${JSON.stringify(initial)},visible=true,held=false,pairError=null,saveError=null;
const clients=['cursor','opencode','codex','aionui','claude'];
const discovery={checkedAt:'2026-11-17T00:00:00.000Z',platform:'darwin',stateError:false,offers:${JSON.stringify(offers)},applications:clients.map(client=>({client,status:'detected',instances:[],coverage:[]}))};
const clone=value=>structuredClone(value);
const changed=()=>listeners.forEach(listener=>listener());
const read=(method,data)=>held?new Promise(resolve=>reads.push({method,data:clone(data),resolve})):Promise.resolve(clone(data));
window.wiring={calls,failPair(error){pairError=error;},failNetworkSave(error){saveError=error;},change(patch){if(patch.snapshot)value=clone(patch.snapshot);if('visible' in patch)visible=patch.visible;changed();},navigate(page){navigation.forEach(listener=>listener(page));},holdReads(){held=true;reads.length=0;},readCount:()=>reads.length,releasePair(index){for(const request of reads.slice(index*2,index*2+2))request.resolve(request.data);},resumeReads(){held=false;},manualIntersections(manual){manualIntersections=manual;},observerFor(key){const row=[...document.querySelectorAll('[data-lan-key]')].find(row=>row.dataset.lanKey===key);return intersections.findLastIndex(observer=>observer.targets.has(row));},replay(index,key){const row=[...document.querySelectorAll('[data-lan-key]')].find(row=>row.dataset.lanKey===key);if(row)intersections[index].callback([{target:row,isIntersecting:true,intersectionRatio:1}]);}};
window.interconnect={onChange(callback){listeners.add(callback);return()=>listeners.delete(callback);},onNavigate(callback){navigation.add(callback);return()=>navigation.delete(callback);},async invoke(method,input={}){
 calls.push({method,input:clone(input)});
 if(method==='snapshot')return read(method,value);
 if(method==='windowState')return read(method,{visible});
 if(method==='appVersion')return '0.18.7-fixture';
 if(method==='loginState')return {supported:true,openAtLogin:false};
 if(method==='applicationDiscovery'||method==='applicationDiscoveryRefresh')return clone(discovery);
 if(method==='applicationDiscoveryOffered')return {saved:true};
 if(method==='mcpSetupStatus')return {client:input.client,remembered:false,state:'missing',files:[]};
 if(method==='mcpSetupDefaults')return {client:input.client,files:[{id:'configuration',path:'/isolated/fixture/'+input.client+'.json',format:'jsonc',alternatives:[]}]};
 if(method==='mcpSetupPreview')return {client:input.client,planId:'fixture-plan',expiresAt:new Date(Date.now()+600000).toISOString(),requiresReplacement:true,files:input.files.map(file=>({...file,action:'update',changes:[]}))};
 if(method==='mcpSetupDiscard')return {discarded:true};
 if(method==='instructions')return {client:input.client,location:'/isolated/fixture',text:'Fixture instructions',configuration:'{}',testPrompt:'Fixture test prompt'};
 if(method==='aionUiStatus')return {state:'not-paired',url:'http://127.0.0.1:1/fixture',bridgeConnected:false};
 if(method==='aionUiInstructions')return {testPrompt:'Fixture access prompt'};
 if(method==='saveNode'){if(saveError)throw new Error(saveError);value.nodeLabel=input.nodeLabel;value.networkInterfaces.exclusions=input.networkExclusions.map(exclusion=>({exclusion,matchingNames:[exclusion.name],absent:false,ambiguous:false}));changed();return {saved:true};}
 if(method==='copy')return {copied:true};
 if(method==='accessCode')return {code:'ABCD2345',expiresAt:new Date(Date.now()+600000).toISOString()};
 if(method==='connectPeer'){if(pairError)throw new Error(pairError);return {id:'authenticated-fixture-result',label:'Authenticated fixture result'};}
 if(method==='stopLanSearch'){value.lanSearch.phase='stopped';changed();return {stopped:true};}
 if(method==='startLanSearch'){value.lanSearch={...value.lanSearch,phase:'searching',runId:value.lanSearch.runId+1,foundCount:0,elapsedMs:0,nodes:value.lanSearch.nodes.map(node=>({...node,observedInRun:false}))};changed();return {started:true};}
 if(method==='ackLanSearch'){value.lanSearch.unseenKeys=value.lanSearch.unseenKeys.filter(key=>!input.keys.includes(key));value.lanSearch.nodes=value.lanSearch.nodes.map(node=>input.keys.includes(node.key)?{...node,newlyFound:false}:node);changed();return {acknowledged:true};}
 throw new Error('Unexpected fixture method: '+method);
}};
`,
        });
        await page.route('**/*', async (route) => {
          const request = new URL(route.request().url());
          if (request.origin !== origin) return route.abort();
          const name = request.pathname === '/' ? 'index.html' : request.pathname.slice(1);
          const body = assets.get(name);
          if (!body) return route.abort();
          const contentType = name.endsWith('.html')
            ? 'text/html'
            : name.endsWith('.js')
              ? 'text/javascript'
              : name.endsWith('.css')
                ? 'text/css'
                : name.endsWith('.svg')
                  ? 'image/svg+xml'
                  : 'image/png';
          await route.fulfill({ status: 200, body, contentType });
        });
        await page.goto(`${origin}/#${hash}`);
        await page.getByTestId('nav-network').waitFor();
        return page;
      };
      const calls = (page: Page, method: string) =>
        page.evaluate(
          (name) =>
            (window as unknown as { wiring: WiringHarness }).wiring.calls.filter(
              (call) => call.method === name,
            ),
          method,
        );
      const change = (page: Page, patch: Parameters<WiringHarness['change']>[0]) =>
        page.evaluate(
          (value) => (window as unknown as { wiring: WiringHarness }).wiring.change(value),
          patch,
        );
      const navigate = (page: Page, tab: string) =>
        page.evaluate(
          (value) => (window as unknown as { wiring: WiringHarness }).wiring.navigate(value),
          tab,
        );
      const capture = async (page: Page, name: string) => {
        const folder = process.env.NCF_LAN_SEARCH_UI_ARTIFACTS;
        if (!folder) return;
        await mkdir(folder, { recursive: true });
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
        );
        await page.screenshot({
          path: path.join(folder, name + '.png'),
          fullPage: false,
          animations: 'disabled',
        });
      };

      if (process.env.NCF_LAN_WIRING_CAPTURE_ONLY === '1') {
        const page = await open();
        try {
          for (const dark of [true, false]) {
            if (!dark) {
              await page.getByTestId('nav-settings').click();
              await page
                .getByRole('switch', { name: translate('en', 'settingsDarkTheme'), exact: true })
                .uncheck();
              await page.getByTestId('nav-network').click();
            }
            for (const width of [1280, 1024]) {
              await page.setViewportSize({ width, height: 1000 });
              const body = await page.getByTestId('network-page').innerText();
              assert.equal(
                body.includes('wss://'),
                false,
                'Technical endpoints stay behind contextual disclosure',
              );
              assert.equal(
                (await calls(page, 'accessCode')).length,
                0,
                'Render/navigation/theme never create a code',
              );
              await capture(page, `combined-network-${dark ? 'dark' : 'light'}-${width}`);
            }
          }
          await page.getByRole('button', { name: 'Create code', exact: true }).click();
          await page.getByRole('textbox', { name: 'Connection code', exact: true }).waitFor();
          await page.getByRole('textbox', { name: 'Computer address', exact: true }).waitFor();
          await capture(page, 'combined-network-light-1024-connect-intent');
          assert.equal((await calls(page, 'accessCode')).length, 1);
          assert.deepEqual(errors, []);
        } finally {
          await page.close();
        }
        return;
      }

      await suite.test(
        'sidebar Stop, preserved manual/Settings/theme drafts, paired metadata and R7 return paths',
        {
          skip:
            !!process.env.NCF_LAN_WIRING_CASE && process.env.NCF_LAN_WIRING_CASE !== 'navigation',
        },
        async () => {
          const page = await open([], 'overview');
          try {
            await page.getByTestId('overview-applications').waitFor();
            await page
              .getByRole('status')
              .filter({ hasText: 'Searching · 18s left · 1 found' })
              .waitFor();
            assert.equal(
              (await calls(page, 'startLanSearch')).length,
              0,
              'renderer does not duplicate main window activation',
            );
            assert.equal(
              (await calls(page, 'ackLanSearch')).length,
              0,
              'inactive network page cannot acknowledge',
            );
            await page.getByTestId('nav-network').getByText('+2', { exact: true }).waitFor();
            const stop = page
              .getByRole('complementary')
              .getByRole('button', { name: 'Stop search', exact: true });
            assert.equal(await stop.locator('button').count(), 0);
            assert.equal(
              await stop.locator('xpath=ancestor::*[@data-testid="nav-network"]').count(),
              0,
            );
            assert.ok((await stop.boundingBox())!.height >= 44);
            await stop.click();
            assert.deepEqual((await calls(page, 'stopLanSearch'))[0].input, {});
            assert.equal((await calls(page, 'stop')).length, 0);
            assert.equal(await page.getByTestId('node-toggle').textContent(), 'Stop');
            await page.getByTestId('nav-network').click();
            await page.getByRole('button', { name: 'Search again', exact: true }).waitFor();
            await page.getByTestId('paired-details').locator('summary').click();
            await page.getByTestId('remote-nodes-table').waitFor();
            await page.getByText('Retained fixture peer diagnostic', { exact: true }).waitFor();
            await page.getByRole('button', { name: 'Create code', exact: true }).click();
            await page.getByRole('textbox', { name: 'Connection code', exact: true }).waitFor();
            await page.getByRole('button', { name: 'Connect by address', exact: true }).click();
            let dialog = page.getByRole('dialog');
            const address = dialog.getByRole('textbox', {
              name: translate('en', 'networkAddressLabel'),
              exact: true,
            });
            const code = dialog.getByRole('textbox', {
              name: translate('en', 'networkAccessLabel'),
              exact: true,
            });
            await address.fill('2001:db8::20');
            await code.fill('abcd2345');
            assert.equal(await code.inputValue(), 'ABCD2345');
            await dialog
              .getByText(translate('en', 'networkAccessHelper'), { exact: true })
              .waitFor();
            await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
            await page.getByTestId('nav-mcp').click();
            await page
              .getByRole('heading', { name: 'Applications', exact: true })
              .first()
              .waitFor();
            for (const client of ['cursor', 'opencode', 'codex', 'aionui', 'claude'])
              await page.getByTestId('application-row-' + client).waitFor();
            await page.getByTestId('nav-settings').click();
            const settingsDraft = page.getByRole('textbox', {
              name: translate('en', 'settingsNodeName'),
              exact: true,
            });
            await settingsDraft.fill('Unsaved fixture name');
            await page
              .getByRole('switch', { name: translate('en', 'settingsDarkTheme'), exact: true })
              .uncheck();
            assert.equal(await settingsDraft.inputValue(), 'Unsaved fixture name');
            await page.getByTestId('nav-network').click();
            assert.equal(
              await page
                .getByRole('textbox', { name: 'Connection code', exact: true })
                .inputValue(),
              'ABCD2345',
            );
            assert.equal((await calls(page, 'accessCode')).length, 1);
            await page.getByRole('button', { name: 'Connect by address', exact: true }).click();
            dialog = page.getByRole('dialog');
            assert.equal(
              await dialog
                .getByRole('textbox', { name: translate('en', 'networkAddressLabel'), exact: true })
                .inputValue(),
              '2001:db8::20',
            );
            assert.equal(
              await dialog
                .getByRole('textbox', { name: translate('en', 'networkAccessLabel'), exact: true })
                .inputValue(),
              'ABCD2345',
            );
            await dialog.getByRole('button', { name: 'Connect', exact: true }).click();
            assert.deepEqual((await calls(page, 'connectPeer')).at(-1)?.input, {
              address: '2001:db8::20',
              code: 'ABCD2345',
            });
            // The actual legacy form clears the code after success and retains the raw address.
            await until(
              async () =>
                (await dialog
                  .getByRole('textbox', {
                    name: translate('en', 'networkAccessLabel'),
                    exact: true,
                  })
                  .inputValue()) === '',
              'Legacy success preserves the address and clears only the submitted code',
            );
            await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
            await page.getByRole('button', { name: 'Search again', exact: true }).click();
            assert.deepEqual((await calls(page, 'startLanSearch')).at(-1)?.input, {});
            await capture(page, 'combined-network-light-1280');
            await page.setViewportSize({ width: 1024, height: 1000 });
            assert.ok(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
              ),
            );
            await capture(page, 'combined-network-light-1024');
            await page.getByTestId('nav-settings').click();
            assert.equal(await settingsDraft.inputValue(), 'Unsaved fixture name');
            assert.equal((await calls(page, 'saveNode')).length, 0);
            await page
              .getByRole('switch', { name: translate('en', 'settingsDarkTheme'), exact: true })
              .check();
            await page.getByTestId('nav-network').click();
            await page.setViewportSize({ width: 1280, height: 1000 });
            await capture(page, 'combined-network-dark-1280');
            await page.setViewportSize({ width: 1024, height: 1000 });
            assert.ok(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
              ),
            );
            await capture(page, 'combined-network-dark-1024');
          } finally {
            await page.close();
          }
        },
      );

      await suite.test(
        'grouped uncertain Pair fences the actual injected Manual alias before IPC and preserves manual inputs',
        {
          skip:
            !!process.env.NCF_LAN_WIRING_CASE && process.env.NCF_LAN_WIRING_CASE !== 'uncertainty',
        },
        async () => {
          const page = await open();
          try {
            const value = snapshot();
            const alias = { ...first, key: 'manual-alias', address: 'wss://192.0.2.21:7336/peer' };
            value.lanSearch!.nodes = [first, alias];
            await change(page, { snapshot: value });
            await page.evaluate(() =>
              (window as unknown as { wiring: WiringHarness }).wiring.failPair(
                'Pairing outcome is uncertain: fixture IPC timeout',
              ),
            );
            await page.getByRole('button', { name: `Connect ${first.label}`, exact: true }).click();
            let dialog = page.getByRole('dialog');
            await dialog
              .getByRole('textbox', { name: 'Connection code', exact: true })
              .fill('ABCD2345');
            await dialog.getByRole('button', { name: 'Connect', exact: true }).click();
            await dialog
              .getByRole('alert')
              .filter({ hasText: lanSearchMessages('en').uncertain })
              .waitFor();
            assert.deepEqual(
              (await calls(page, 'connectPeer')).map((call) => call.input),
              [{ address: first.address, code: 'ABCD2345', expectedNodeId: first.nodeId }],
            );
            await dialog.getByRole('button', { name: 'Close', exact: true }).click();
            value.lanSearch!.nodes = [];
            await change(page, { snapshot: value });
            await page.getByRole('button', { name: 'Connect by address', exact: true }).click();
            dialog = page.getByRole('dialog');
            const address = dialog.getByRole('textbox', {
              name: translate('en', 'networkAddressLabel'),
              exact: true,
            });
            const code = dialog.getByRole('textbox', {
              name: translate('en', 'networkAccessLabel'),
              exact: true,
            });
            await address.fill('192.0.2.21:7336');
            await code.fill('ABCD2345');
            await dialog.getByRole('button', { name: 'Connect', exact: true }).click();
            await page
              .getByRole('alert')
              .filter({ hasText: lanSearchMessages('en').uncertain })
              .last()
              .waitFor();
            assert.equal(
              (await calls(page, 'connectPeer')).length,
              1,
              'Actual parent Manual does not bypass the shared fence after discovery expiry',
            );
            assert.equal(await address.inputValue(), '192.0.2.21:7336');
            assert.equal(await code.inputValue(), 'ABCD2345');
            await page.evaluate(() =>
              (window as unknown as { wiring: WiringHarness }).wiring.failPair(null),
            );
            await address.fill('192.0.2.99:7336');
            await dialog.getByRole('button', { name: 'Connect', exact: true }).click();
            await until(
              async () => (await code.inputValue()) === '',
              'An unknown route retains the existing manual flow',
            );
            assert.deepEqual((await calls(page, 'connectPeer')).at(-1)?.input, {
              address: '192.0.2.99:7336',
              code: 'ABCD2345',
            });
            await address.fill('192.0.2.21:7336');
            await code.fill('BCDE3456');
            await dialog.getByRole('button', { name: 'Connect', exact: true }).click();
            await until(
              async () => (await code.inputValue()) === '',
              'A fresh code can use the known alias',
            );
            assert.deepEqual((await calls(page, 'connectPeer')).at(-1)?.input, {
              address: '192.0.2.21:7336',
              code: 'BCDE3456',
            });
            assert.equal((await calls(page, 'connectPeer')).length, 3);
            assert.deepEqual(errors, []);
          } finally {
            await page.close();
          }
        },
      );

      await suite.test(
        'network interface drafts survive theme/navigation and only explicit Save writes exclusions',
        {
          skip: !!process.env.NCF_LAN_WIRING_CASE && process.env.NCF_LAN_WIRING_CASE !== 'network',
        },
        async () => {
          const page = await open([], 'settings');
          try {
            const summary = page
              .getByTestId('network-interfaces-settings')
              .locator(':scope > summary');
            if (await summary.count()) await summary.click();
            const toggle = page.getByRole('switch', {
              name: 'Fixture interface: Listening enabled',
              exact: true,
            });
            await toggle.uncheck();
            const name = page.getByRole('textbox', {
              name: translate('en', 'settingsNodeName'),
              exact: true,
            });
            await name.fill('Unsaved network name');
            await page
              .getByRole('switch', { name: translate('en', 'settingsDarkTheme'), exact: true })
              .uncheck();
            assert.equal(await toggle.isChecked(), false);
            assert.equal((await calls(page, 'saveNode')).length, 0);
            await page.getByTestId('nav-network').click();
            await page.getByTestId('nav-settings').click();
            assert.equal(await toggle.isChecked(), false);
            assert.equal(await name.inputValue(), 'Unsaved network name');
            await page
              .getByRole('button', { name: translate('en', 'btnSave'), exact: true })
              .click();
            await until(
              async () => (await calls(page, 'saveNode')).length === 1,
              'Explicit owner Save sends one network update',
            );
            assert.deepEqual((await calls(page, 'saveNode'))[0].input, {
              nodeLabel: 'Unsaved network name',
              networkExclusions: [{ name: 'Fixture interface' }],
            });
            assert.equal((await calls(page, 'mcpSetupApply')).length, 0);
            await page.evaluate(() => localStorage.setItem('interconnect.locale', 'ru'));
            await page.reload();
            await page
              .getByRole('button', { name: translate('ru', 'btnSave'), exact: true })
              .waitFor();
            const diagnostic = 'Fixture EACCES while renaming /isolated/settings.json';
            await page.evaluate(
              (message) =>
                (window as unknown as { wiring: WiringHarness }).wiring.failNetworkSave(message),
              diagnostic,
            );
            await page
              .getByRole('button', { name: translate('ru', 'btnSave'), exact: true })
              .click();
            const failure = page.getByTestId('network-save-error');
            await failure.waitFor();
            assert.equal(
              await page.getByTestId('network-save-summary').textContent(),
              networkInterfaceMessages('ru').saveFailed,
            );
            assert.equal(await failure.locator('pre').isVisible(), false);
            assert.equal(
              await page.locator('.MuiSnackbar-root').filter({ hasText: diagnostic }).count(),
              0,
            );
            await failure
              .locator('summary')
              .getByText(networkInterfaceMessages('ru').details, { exact: true })
              .click();
            assert.equal(await failure.locator('pre').isVisible(), true);
            assert.equal(await failure.locator('pre').textContent(), diagnostic);
            await failure
              .getByRole('button', { name: translate('ru', 'mcpSetup_close'), exact: true })
              .click();
            assert.equal(await failure.count(), 0);
            assert.deepEqual(errors, []);
          } finally {
            await page.close();
          }
        },
      );

      await suite.test(
        'R7 startup/confirmation and nickname overlays, native visibility and refresh generations gate acknowledgements',
        {
          skip:
            !!process.env.NCF_LAN_WIRING_CASE && process.env.NCF_LAN_WIRING_CASE !== 'visibility',
        },
        async () => {
          const page = await open(['cursor']);
          try {
            await page.getByTestId('application-startup-setup').waitFor();
            assert.equal((await calls(page, 'ackLanSearch')).length, 0);
            await page
              .getByRole('dialog')
              .getByRole('button', { name: 'Not now', exact: true })
              .click();
            await until(
              async () => (await calls(page, 'ackLanSearch')).length > 0,
              'Actual network rows become visible after startup closes',
            );
            await page.getByTestId('nav-mcp').click();
            await page.getByTestId('application-connect-cursor').click();
            await page
              .getByRole('dialog', { name: 'Confirm configuration changes', exact: true })
              .waitFor();
            await navigate(page, 'network');
            const covered = snapshot();
            covered.lanSearch!.nodes = [
              { ...first, key: 'confirmation-key', label: 'Confirmation covered computer' },
            ];
            covered.lanSearch!.unseenKeys = ['confirmation-key'];
            await change(page, { snapshot: covered });
            await page.waitForTimeout(100);
            assert.ok(
              !(await calls(page, 'ackLanSearch')).some((call) =>
                (call.input.keys as string[]).includes('confirmation-key'),
              ),
            );
            assert.equal((await calls(page, 'mcpSetupApply')).length, 0);
            await page
              .getByRole('dialog', { name: 'Confirm configuration changes', exact: true })
              .getByRole('button', { name: 'Cancel', exact: true })
              .click();
            await until(
              async () =>
                (await calls(page, 'ackLanSearch')).some((call) =>
                  (call.input.keys as string[]).includes('confirmation-key'),
                ),
              'Confirmation close returns to fresh visible network rows',
            );
            await page.getByTestId('nav-agents').click();
            await page.getByTestId('create-agent-manually').click();
            await page
              .getByRole('dialog')
              .getByRole('textbox', { name: translate('en', 'dialogAgentName'), exact: true })
              .waitFor();
            await navigate(page, 'network');
            const nicknameCovered = snapshot();
            nicknameCovered.lanSearch!.nodes = [
              { ...first, key: 'nickname-key', label: 'Nickname covered computer' },
            ];
            nicknameCovered.lanSearch!.unseenKeys = ['nickname-key'];
            await change(page, { snapshot: nicknameCovered });
            await page.waitForTimeout(100);
            assert.ok(
              !(await calls(page, 'ackLanSearch')).some((call) =>
                (call.input.keys as string[]).includes('nickname-key'),
              ),
            );
            await page
              .getByRole('dialog')
              .getByRole('button', { name: 'Cancel', exact: true })
              .click();
            await until(
              async () =>
                (await calls(page, 'ackLanSearch')).some((call) =>
                  (call.input.keys as string[]).includes('nickname-key'),
                ),
              'Nickname dialog close restores visibility',
            );
            const hidden = snapshot();
            hidden.lanSearch!.nodes = [
              { ...first, key: 'native-hidden-key', label: 'Native hidden computer' },
            ];
            hidden.lanSearch!.unseenKeys = ['native-hidden-key'];
            await change(page, { snapshot: hidden, visible: false });
            await page.waitForTimeout(100);
            assert.ok(
              !(await calls(page, 'ackLanSearch')).some((call) =>
                (call.input.keys as string[]).includes('native-hidden-key'),
              ),
            );
            await page.evaluate(() =>
              (window as unknown as { wiring: WiringHarness }).wiring.holdReads(),
            );
            const stale = snapshot();
            stale.lanSearch!.nodes = [
              { ...first, key: 'stale-read-key', label: 'Stale read computer' },
            ];
            stale.lanSearch!.unseenKeys = ['stale-read-key'];
            await change(page, { snapshot: stale, visible: true });
            const current = snapshot();
            current.lanSearch!.nodes = [
              { ...first, key: 'current-read-key', label: 'Current read computer' },
            ];
            current.lanSearch!.unseenKeys = ['current-read-key'];
            await change(page, { snapshot: current, visible: false });
            await until(
              async () =>
                (await page.evaluate(() =>
                  (window as unknown as { wiring: WiringHarness }).wiring.readCount(),
                )) === 4,
              'Two snapshot/windowState pairs are pending',
            );
            await page.evaluate(() => {
              const fixture = (window as unknown as { wiring: WiringHarness }).wiring;
              fixture.resumeReads();
              fixture.releasePair(1);
            });
            await page.getByText('Current read computer', { exact: true }).waitFor();
            await page.evaluate(() =>
              (window as unknown as { wiring: WiringHarness }).wiring.releasePair(0),
            );
            await page.waitForTimeout(100);
            assert.equal(await page.getByText('Stale read computer', { exact: true }).count(), 0);
            assert.ok(
              !(await calls(page, 'ackLanSearch')).some((call) =>
                (call.input.keys as string[]).includes('current-read-key'),
              ),
            );
            await change(page, { visible: true });
            await until(
              async () =>
                (await calls(page, 'ackLanSearch')).some((call) =>
                  (call.input.keys as string[]).includes('current-read-key'),
                ),
              'Only the current visible read generation can acknowledge',
            );
            assert.ok(
              (await calls(page, 'windowState')).every(
                (call) => Object.keys(call.input).length === 0,
              ),
            );
            assert.equal((await calls(page, 'mcpSetupApply')).length, 0);
            assert.equal((await calls(page, 'registerAgent')).length, 0);
            await capture(page, 'combined-network-dark-1280');
          } finally {
            await page.close();
          }
        },
      );
      await suite.test(
        'sticky shell header does not acknowledge fully covered rows',
        {
          skip: !!process.env.NCF_LAN_WIRING_CASE && process.env.NCF_LAN_WIRING_CASE !== 'header',
        },
        async () => {
          const page = await open();
          try {
            const value = snapshot();
            // Compact rows need enough overflow to place the first row fully beneath the header.
            value.lanSearch!.nodes = Array.from({ length: 24 }, (_, index) => ({
              ...first,
              key: 'header-' + index,
              nodeId: 'header-node-' + index,
              label: 'Header computer ' + index,
              address: 'wss://192.0.2.' + (index + 20) + ':7336/peer',
            }));
            value.lanSearch!.unseenKeys = [];
            await change(page, { snapshot: value });
            await page.locator('[data-lan-key="header-0"]').waitFor();
            await page.locator('main').evaluate((main) => {
              const row = main.querySelector('[data-lan-key="header-0"]')!;
              const header = main.querySelector('header')!;
              main.scrollTop +=
                row.getBoundingClientRect().top - header.getBoundingClientRect().top - 8;
            });
            value.lanSearch!.unseenKeys = ['header-0'];
            await change(page, { snapshot: value });
            const covered = await page.locator('[data-lan-key="header-0"]').evaluate((row) => {
              const bounds = row.getBoundingClientRect(),
                header = row.closest('main')!.querySelector('header')!.getBoundingClientRect();
              return bounds.top >= header.top && bounds.bottom <= header.bottom;
            });
            assert.equal(
              covered,
              true,
              'The complete row is geometrically behind the sticky header',
            );
            await page.waitForTimeout(100);
            assert.ok(
              !(await calls(page, 'ackLanSearch')).some((call) =>
                (call.input.keys as string[]).includes('header-0'),
              ),
              'Covered rows are not seen by the owner',
            );
            await page.locator('main').evaluate((main) => {
              main.scrollTop -= 200;
            });
            await until(
              async () =>
                (await calls(page, 'ackLanSearch')).some((call) =>
                  (call.input.keys as string[]).includes('header-0'),
                ),
              'Scrolling out from under the header acknowledges the row',
            );
            await page.evaluate(() =>
              (window as unknown as { wiring: WiringHarness }).wiring.manualIntersections(true),
            );
            value.lanSearch!.nodes[0] = { ...value.lanSearch!.nodes[0], key: 'header-resize-key' };
            value.lanSearch!.unseenKeys = ['header-resize-key'];
            await change(page, { snapshot: value });
            await page.locator('[data-lan-key="header-resize-key"]').waitFor();
            await page.locator('main').evaluate((main) => {
              const row = main.querySelector('[data-lan-key="header-resize-key"]')!,
                header = main.querySelector('header')!;
              main.scrollTop +=
                row.getBoundingClientRect().top - header.getBoundingClientRect().bottom - 8;
            });
            const beforeResize = await page.evaluate(() =>
              (window as unknown as { wiring: WiringHarness }).wiring.observerFor(
                'header-resize-key',
              ),
            );
            assert.ok(beforeResize >= 0);
            // Change the header and replay in one task, before ResizeObserver can revoke the callback.
            await page.evaluate(
              ({ beforeResize }) => {
                const main = document.querySelector('main')!,
                  header = main.querySelector('header')!,
                  row = main.querySelector('[data-lan-key="header-resize-key"]')!;
                const top = row.getBoundingClientRect().top,
                  height = row.getBoundingClientRect().height;
                header.style.paddingBottom =
                  parseFloat(getComputedStyle(header).paddingBottom) + height + 24 + 'px';
                main.scrollTop += row.getBoundingClientRect().top - top;
                (window as unknown as { wiring: WiringHarness }).wiring.replay(
                  beforeResize,
                  'header-resize-key',
                );
              },
              { beforeResize },
            );
            assert.ok(
              !(await calls(page, 'ackLanSearch')).some((call) =>
                (call.input.keys as string[]).includes('header-resize-key'),
              ),
            );
            assert.equal(
              await page
                .locator('[data-lan-key="header-resize-key"]')
                .evaluate(
                  (row) =>
                    row.getBoundingClientRect().bottom <=
                    row.closest('main')!.querySelector('header')!.getBoundingClientRect().bottom,
                ),
              true,
            );
            await page.evaluate(
              ({ beforeResize }) => {
                const fixture = (window as unknown as { wiring: WiringHarness }).wiring;
                fixture.replay(beforeResize, 'header-resize-key');
                fixture.manualIntersections(false);
                const header = document.querySelector('main > header') as HTMLElement;
                header.style.paddingBottom =
                  parseFloat(getComputedStyle(header).paddingBottom) + 1 + 'px';
              },
              { beforeResize },
            );
            await page.waitForTimeout(100);
            assert.ok(
              !(await calls(page, 'ackLanSearch')).some((call) =>
                (call.input.keys as string[]).includes('header-resize-key'),
              ),
            );
            await page.locator('main').evaluate((main) => {
              main.scrollTop -= main.querySelector('header')!.getBoundingClientRect().height;
            });
            await until(
              async () =>
                (await calls(page, 'ackLanSearch')).some((call) =>
                  (call.input.keys as string[]).includes('header-resize-key'),
                ),
              'Fresh resized geometry acknowledges only after the row is visible',
            );
          } finally {
            await page.close();
          }
        },
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

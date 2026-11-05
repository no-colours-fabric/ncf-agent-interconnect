import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { _electron as electron } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { aionFixture } from '../test-desktop/aionui-fixture.ts';
import { createUiEnvironment, createUiProfile, uiClientConfigPaths } from './ui-test-profile.mjs';

// Build first, then: node --import tsx scripts/test-desktop-ui-aionui.mjs
// Actual main + preload + renderer + service, synthetic split-port WebUI/Core.
// No installed AionUi process, real agent, account or client configuration is used.
const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const temporary = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ncf-electron-aionui-')));
const profile = path.join(temporary, 'node data Кириллица 漢字');
const home = path.join(temporary, 'client home Кириллица 漢字');
const environment = await createUiEnvironment(home);
const configs = uiClientConfigPaths(environment);
const cleanups = [];
let application, bridge, sender;
const pageErrors = [];
let stderr = '';
const fingerprint = () =>
  Promise.all(
    configs.map(async (filename) => {
      try {
        return createHash('sha256')
          .update(await readFile(filename))
          .digest('hex');
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    }),
  );
const until = async (predicate) => {
  const limit = Date.now() + 10000;
  while (!(await predicate())) {
    if (Date.now() > limit) throw new Error('The isolated AionUi Electron fixture timed out.');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};
try {
  const fixture = await aionFixture({ after: (cleanup) => cleanups.push(cleanup) });
  await createUiProfile(profile, 'Isolated AionUi IPC check');
  for (const filename of configs) {
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(
      filename,
      filename.endsWith('.toml')
        ? '# Synthetic client setting\n'
        : JSON.stringify({
            fixture: 'keep',
            mcpServers: {
              foreign: { command: 'keep' },
              ncf_agent_interconnect: { url: 'http://127.0.0.1:1/mcp' },
            },
          }),
      { mode: 0o600 },
    );
  }
  const before = await fingerprint();
  const bootstrap = path.join(temporary, 'isolated-electron.cjs');
  const appData = environment.APPDATA;
  const logs = path.join(temporary, 'logs');
  await mkdir(logs);
  await writeFile(
    bootstrap,
    `
    const {app}=require('electron');
    const os=require('node:os');
    const normalize=value=>process.platform==='win32'?require('node:path').resolve(value).toLowerCase():require('node:path').resolve(value);
    if(normalize(os.homedir())!==normalize(${JSON.stringify(environment.HOME)}))throw new Error('The test home is not isolated');
    app.setPath('home',${JSON.stringify(home)});
    app.setPath('appData',${JSON.stringify(appData)});
    app.setPath('userData',${JSON.stringify(profile)});
    app.setPath('logs',${JSON.stringify(logs)});
    import(${JSON.stringify(pathToFileURL(path.join(root, 'build/main/index.js')).href)}).catch(()=>{process.exitCode=1;app.quit();});
  `,
    { mode: 0o600 },
  );
  application = await electron.launch({
    executablePath: require('electron'),
    args: [bootstrap, '--data-dir', profile],
    cwd: temporary,
    env: environment,
    timeout: 30000,
  });
  application.process().stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  const page = await application.firstWindow();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const invoke = (method, params = {}) =>
    page.evaluate(({ method, params }) => window.interconnect.invoke(method, params), {
      method,
      params,
    });
  await page.getByTestId('nav-mcp').click();
  await page.getByRole('tab', { name: 'AionUi', exact: true }).click();
  const setup = page.getByTestId('aionui-setup');
  await setup.getByTestId('aionui-authorization-status').getByText('Not paired').waitFor();
  assert.equal(
    await setup.getByTestId('aionui-connection-steps').locator('.MuiStep-root').count(),
    3,
  );
  await setup.getByText('AionUi bridge settings need updating', { exact: true }).first().waitFor();
  assert.ok((await setup.innerText()).includes('apply the updated bridge'));
  assert.equal((await invoke('aionUiStatus')).state, 'not-paired');
  const instructions = await invoke('aionUiInstructions');
  assert.ok(!('configuration' in instructions));
  assert.equal(await page.locator('pre, textarea, [contenteditable="true"]').count(), 0);
  assert.equal(await setup.getByTestId('mcp-open-file').count(), 1);
  assert.ok(!(await setup.getByTestId('mcp-open-file').isDisabled()));
  await page.getByTestId('aionui-configure-access').click();
  let dialog = page.getByRole('dialog');
  const geometry = async () => ({
    dialog: await dialog.boundingBox(),
    address: await dialog.getByTestId('aionui-address').boundingBox(),
    code: await dialog.getByTestId('aionui-code').boundingBox(),
  });
  const sameGeometry = (actual, expected) => {
    for (const key of Object.keys(expected))
      for (const dim of ['x', 'y', 'width', 'height'])
        assert.ok(
          Math.abs(actual[key][dim] - expected[key][dim]) < 0.5,
          'Pairing geometry changed: ' + key + ' ' + dim,
        );
  };
  const beforePair = await geometry();
  await dialog.getByTestId('aionui-address').fill(fixture.url);
  await dialog.getByTestId('aionui-code').fill('invalid-code');
  await dialog.getByRole('button', { name: 'Pair', exact: true }).click();
  await dialog.getByRole('alert').waitFor();
  sameGeometry(await geometry(), beforePair);
  assert.equal((await invoke('aionUiStatus')).state, 'not-paired');
  const releaseCancelled = fixture.holdPair();
  await dialog.getByTestId('aionui-code').fill(fixture.code);
  await dialog.getByRole('button', { name: 'Pair', exact: true }).click();
  await dialog.locator('[data-testid="aionui-pair-progress"][data-busy="true"]').waitFor();
  sameGeometry(await geometry(), beforePair);
  await mkdir(path.join(root, 'release'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'release/aionui-authorization.png') });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  releaseCancelled();
  await dialog.waitFor({ state: 'detached' });
  assert.equal((await invoke('aionUiStatus')).state, 'not-paired');
  assert.deepEqual(await fingerprint(), before);
  await page.getByTestId('aionui-configure-access').click();
  dialog = page.getByRole('dialog');
  await dialog.getByTestId('aionui-address').fill(fixture.url);
  const release = fixture.holdPair();
  await dialog.getByTestId('aionui-code').fill(fixture.code);
  await dialog.getByRole('button', { name: 'Pair', exact: true }).click();
  await dialog.locator('[data-testid="aionui-pair-progress"][data-busy="true"]').waitFor();
  release();
  await setup
    .getByTestId('aionui-authorization-status')
    .getByText('Authorization saved', { exact: true })
    .waitFor();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  assert.equal((await invoke('aionUiStatus')).bridgeConnected, false);
  const credentials = JSON.parse(
    await readFile(path.join(profile, 'aionui-credentials.json'), 'utf8'),
  );
  assert.equal(credentials.revoked, false);
  assert.deepEqual(await fingerprint(), before, 'Pairing must not write any client configuration');
  await page.getByTestId('mcp-configure-aionui').click();
  dialog = page.getByRole('dialog');
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="mcp-apply"]');
    return button && !button.disabled;
  });
  assert.ok((await dialog.innerText()).includes('replaces any existing NCF entry'));
  assert.ok((await dialog.innerText()).includes('Cursor outside AionUi'));
  const warning = dialog.getByTestId('aionui-global-cursor-warning');
  assert.ok((await warning.innerText()).includes(configs[0]));
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(root, 'release/aionui-bridge-warning.png') });
  assert.equal(await page.locator('pre, textarea, [contenteditable="true"]').count(), 0);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.deepEqual(await fingerprint(), before);
  await page.getByTestId('mcp-configure-aionui').click();
  dialog = page.getByRole('dialog');
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="mcp-apply"]');
    return button && !button.disabled;
  });
  const targetFile = await dialog.getByTestId('mcp-path-configuration').inputValue();
  assert.equal(targetFile, configs[0]);
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await dialog.getByText('Setup applied.', { exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  const applied = JSON.parse(await readFile(targetFile, 'utf8'));
  const configuration = applied.mcpServers.ncf_agent_interconnect;
  assert.equal(configuration.env.ELECTRON_RUN_AS_NODE, '1');
  assert.ok(!('url' in configuration));
  assert.equal(applied.fixture, 'keep');
  assert.equal(applied.mcpServers.foreign.command, 'keep');
  assert.deepEqual((await fingerprint()).slice(1), before.slice(1));
  const configured = await fingerprint();
  assert.equal((await invoke('aionUiStatus')).bridgeConnected, false);
  await setup
    .getByTestId('aionui-bridge-status')
    .getByText('Bridge not connected to a verified chat', { exact: true })
    .waitFor();
  await setup
    .getByTestId('mcp-settings-status')
    .getByText('Settings are present', { exact: true })
    .waitFor();
  await setup.getByTestId('aionui-reconnect-next').waitFor();
  assert.ok(
    (await setup.getByTestId('aionui-reconnect-next').innerText()).includes('Reconnect agent'),
  );
  await page.screenshot({ path: path.join(root, 'release/aionui-connection-steps.png') });

  const rejected = await application.evaluate(async ({ BrowserWindow }) => {
    const other = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false },
    });
    try {
      await other.loadURL('data:text/html,<title>Isolated untrusted sender</title>');
      return await other.webContents.executeJavaScript(`(async()=>{
        const {ipcRenderer}=require('electron');const results=[];
        for(const method of ['aionUiStatus','aionUiInstructions','aionUiPair','aionUiDisconnect']){
          try{await ipcRenderer.invoke('interconnect:call',method,{});results.push('unexpected authorization');}
          catch(error){results.push(error.message);}
        }return results;
      })()`);
    } finally {
      other.destroy();
    }
  });
  assert.equal(rejected.length, 4);
  assert.ok(rejected.every((result) => result.includes('Invalid operation source')));

  // The generated configuration launches the real bundled bridge in Electron's
  // Node mode. Its host context is synthetic; it cannot contact a real agent.
  bridge = new Client({ name: 'synthetic-AionUi-backend', version: 'fixture' });
  await bridge.connect(
    new StdioClientTransport({
      command: configuration.command,
      args: configuration.args,
      env: {
        ...getDefaultEnvironment(),
        ...configuration.env,
        AIONUI_BASE_URL: fixture.coreUrl,
        AIONUI_USER_ID: fixture.state.userId,
        AIONUI_CONVERSATION_ID: 'fixture-chat-b',
        AIONUI_RUNTIME_TOKEN: fixture.runtimeToken,
      },
      stderr: 'pipe',
    }),
  );
  const target = await bridge.callTool({
    name: 'agent_connect',
    arguments: { nickname: 'IPC Тигр 漢字' },
  });
  assert.ok(!target.isError);
  assert.equal(target.structuredContent.binding.chatId, 'fixture-chat-b');
  assert.equal(target.structuredContent.delivery.automatic, true);
  assert.notEqual(fixture.coreUrl, fixture.url);
  assert.ok(
    fixture.proofs.length > 0 &&
      fixture.proofs.every(
        (proof) => proof.accepted && !proof.hasCoreJwt && proof.hasFrontendCookie,
      ),
  );
  // The already-open page must react to the real binding event without a
  // status read, refresh, tab switch or other action from the test.
  await setup
    .getByTestId('aionui-bridge-status')
    .getByText('Bridge connected to a verified chat', { exact: true })
    .waitFor();
  assert.equal((await invoke('aionUiStatus')).bridgeConnected, true);
  const settings = JSON.parse(await readFile(path.join(profile, 'settings.json'), 'utf8'));
  const snapshot = await invoke('snapshot');
  sender = new Client({ name: 'synthetic-sender', version: 'fixture' });
  await sender.connect(
    new StreamableHTTPClientTransport(new URL(snapshot.mcpUrl), {
      requestInit: { headers: { authorization: 'Bearer ' + settings.localToken } },
    }),
  );
  const tools = await sender.listTools();
  assert.ok(!tools.tools.some((tool) => tool.name.startsWith('aionUi')));
  const source = await sender.callTool({
    name: 'agent_connect',
    arguments: { nickname: 'IPC source' },
  });
  assert.ok(!source.isError);
  const message = await sender.callTool({
    name: 'agent_send',
    arguments: {
      connectionId: source.structuredContent.binding.connectionId,
      recipientNode: snapshot.nodeId,
      recipientNickname: 'IPC Тигр 漢字',
      text: 'Synthetic IPC delivery 漢字',
    },
  });
  assert.ok(!message.isError);
  await until(() => fixture.posts.length === 1);
  assert.equal(fixture.posts[0].chat, 'fixture-chat-b');
  assert.ok(fixture.posts[0].content.includes('Synthetic IPC delivery 漢字'));
  await until(async () => {
    const current = await invoke('snapshot');
    return current.agents.some((agent) => agent.nickname === 'IPC Тигр 漢字' && agent.unread === 0);
  });
  const body = await page.locator('body').innerText();
  for (const value of [
    fixture.session,
    fixture.runtimeToken,
    fixture.code,
    fixture.state.userId,
    fixture.state.accountId,
    'private-account-fixture',
  ])
    assert.ok(!body.includes(value));

  await bridge.close();
  bridge = undefined;
  await setup
    .getByTestId('aionui-bridge-status')
    .getByText('Bridge not connected to a verified chat', { exact: true })
    .waitFor();
  assert.equal((await invoke('aionUiStatus')).bridgeConnected, false);
  assert.equal((await invoke('aionUiStatus')).state, 'paired');

  await page.screenshot({ path: path.join(root, 'release/aionui-setup.png'), fullPage: true });
  await setup.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await setup.getByTestId('aionui-authorization-status').getByText('Access ended').waitFor();
  assert.equal((await invoke('aionUiStatus')).state, 'revoked');
  assert.equal(
    JSON.parse(await readFile(path.join(profile, 'aionui-credentials.json'), 'utf8')).revoked,
    true,
  );
  assert.deepEqual(await fingerprint(), configured);
  assert.deepEqual(pageErrors, []);
  for (const value of [fixture.session, fixture.runtimeToken, fixture.code, settings.localToken])
    assert.ok(!stderr.includes(value));
  console.log(
    JSON.stringify({
      actualMainPreloadRendererService: true,
      ownerIpcMethods: 4,
      foreignWindowRejected: true,
      splitPortRuntimeProofWithoutCoreJwt: true,
      generatedElectronNodeBridge: true,
      exactSyntheticChatDelivery: true,
      automaticReceipt: true,
      visibleBridgeStatusReactsToBindingAndDisconnect: true,
      durableOwnerDisconnect: true,
      clientFilesChangedOnlyOnApply: true,
      authorizationDialogGeometryStable: true,
      authorizationCancelSafe: true,
      noConfigurationInRenderer: true,
      liveAgentsOrAccountsContacted: false,
    }),
  );
} finally {
  await bridge?.close();
  await sender?.close();
  await application?.close();
  for (const cleanup of cleanups.reverse()) await cleanup();
  await rm(temporary, { recursive: true, force: true });
}

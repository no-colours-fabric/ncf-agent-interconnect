import { waitForComposerTransition } from './ui-chat-composer.mjs';
import { _electron as electron, errors } from 'playwright';
import { createRequire } from 'node:module';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createUiEnvironment, createUiProfile, uiClientConfigPaths } from './ui-test-profile.mjs';
import { verifyChatHistoryPagination } from './ui-chat-history-smoke.mjs';
import { NodeService } from '../build/core/service.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function verifyClientStatusPanel(page, { client, configured, count, activity }) {
  const row = page.getByTestId('application-row-' + client);
  const panel = row.getByTestId('client-status-panel');
  assert.equal(
    await page.getByTestId('application-manual').count(),
    0,
    'There is no overall manual-MCP summary',
  );
  if (!configured) {
    assert.equal(await panel.count(), 0, 'Only configured applications have a status panel');
    return;
  }
  await panel.waitFor();
  assert.equal(await panel.count(), 1);
  assert.equal(await panel.getAttribute('data-status'), 'configured');
  assert.equal(await panel.getByTestId('application-agent-count').innerText(), String(count));
  const actualActivity = await panel.getByTestId('application-last-activity').innerText();
  if (activity)
    assert.equal(
      actualActivity,
      await page.evaluate((date) => new Date(date).toLocaleString('en'), activity),
    );
  else assert.equal(actualActivity, 'Unknown');
  assert.ok((await panel.getByTestId('application-delivery-status').innerText()).trim());
}

const require = createRequire(import.meta.url);
const temp = await mkdtemp(path.join(os.tmpdir(), 'ncf-interconnect-ui-'));
const launchEnv = await createUiEnvironment(path.join(temp, 'clients'));
const clientConfigs = uiClientConfigPaths(launchEnv);
const hashes = async () =>
  Promise.all(
    clientConfigs.map(async (file) => {
      try {
        return createHash('sha256')
          .update(await readFile(file))
          .digest('hex');
      } catch (e) {
        if (e.code === 'ENOENT') return null;
        throw e;
      }
    }),
  );
let before;
let application, remote, receiver;
let stderr = '';
try {
  await createUiProfile(path.join(temp, 'desktop'));
  const packaged = process.env.INTERCONNECT_TEST_EXECUTABLE;
  for (const filename of clientConfigs) {
    await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
    await writeFile(
      filename,
      filename.endsWith('.toml') ? '# Private UI fixture\n' : '{"fixture":true}\n',
      { mode: 0o600 },
    );
  }
  before = await hashes();
  application = await electron.launch({
    executablePath: packaged ?? require('electron'),
    args: [...(packaged ? [] : [process.cwd()]), '--data-dir', path.join(temp, 'desktop')],
    cwd: temp,
    env: launchEnv,
    timeout: 30000,
  });
  application.process().stderr?.on('data', (b) => {
    stderr += b.toString();
  });
  const page = await application.firstWindow();
  await page.getByText('Connect agents', { exact: true }).waitFor();
  await page.evaluate(async () => {
    let timer;
    try {
      await Promise.race([
        window.interconnect.invoke('applicationDiscovery').catch(() => {}),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Startup discovery did not settle')), 10000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  });
  const startup = page.getByTestId('application-startup-setup');
  let startupVisible = false;
  try {
    await startup.waitFor({ state: 'visible', timeout: 3000 });
    startupVisible = true;
  } catch (error) {
    if (!(error instanceof errors.TimeoutError)) throw error;
  }
  if (startupVisible) {
    await page
      .getByRole('dialog', { name: 'Connect your apps', exact: true })
      .getByRole('button', { name: 'Close', exact: true })
      .click();
    await startup.waitFor({ state: 'hidden' });
  }
  await mkdir('release', { recursive: true });
  await page.screenshot({ path: 'release/preview-overview.png' });
  await page.getByTestId('nav-mcp').click();
  const applicationList = page.getByTestId('application-setup-list');
  await applicationList.waitFor();
  assert.equal(
    await applicationList
      .getByRole('button', { name: 'Manual setup', exact: true, includeHidden: true })
      .count(),
    5,
  );
  assert.equal(await page.getByRole('tab').count(), 0);
  assert.equal(await page.locator('main').getByRole('combobox').count(), 0);
  const openManual = async (client, label) => {
    const row = page.getByTestId('application-row-' + client);
    if (client === 'opencode' && !(await row.count()))
      await applicationList.getByRole('switch', { name: 'Show OpenCode v1', exact: true }).check();
    await row.getByRole('heading', { name: label, exact: true }).waitFor();
    const manual = row.getByRole('button', { name: 'Manual setup', exact: true });
    if (!(await manual.isVisible())) await row.locator('summary').first().click();
    await manual.click();
    const form = page.locator('#mcp-setup-form-' + client);
    await form.waitFor();
    await page.getByRole('heading', { name: label, exact: true }).waitFor();
    assert.equal(await form.getByRole('heading').count(), 0);
    await form.locator('footer').getByTestId('mcp-apply').waitFor();
    assert.equal(await applicationList.count(), 0);
    assert.equal(await page.getByRole('dialog').count(), 0);
    return form;
  };
  const backToApplications = async () => {
    await page.getByRole('button', { name: 'Back to Applications', exact: true }).click();
    await applicationList.waitFor();
    assert.equal(
      await applicationList
        .getByRole('button', { name: 'Manual setup', exact: true, includeHidden: true })
        .count(),
      5,
    );
  };
  for (const [client, label] of [
    ['cursor', 'Cursor'],
    ['opencode', 'OpenCode v1'],
    ['codex', 'Codex'],
    ['aionui', 'AionUi with Cursor Agent'],
    ['claude', 'Claude Code'],
  ]) {
    const form = await openManual(client, label);
    assert.equal(await page.getByTestId('client-status-panel').count(), 0);
    assert.equal(await page.locator('pre, textarea, [contenteditable="true"]').count(), 0);
    const selectedPath = await form
      .getByRole('combobox', { name: 'Configuration file path', exact: true })
      .inputValue();
    assert.ok(clientConfigs.includes(selectedPath));
    await page.waitForFunction((client) => {
      const apply = document
        .getElementById('mcp-setup-form-' + client)
        ?.querySelector('[data-testid="mcp-apply"]');
      return apply && !apply.disabled;
    }, client);
    assert.equal(await form.getByRole('button', { name: 'Cancel', exact: true }).count(), 0);
    await backToApplications();
    assert.deepEqual(
      await hashes(),
      before,
      'status and cancellation must preserve private client files',
    );
  }
  await openManual('aionui', 'AionUi with Cursor Agent');
  const aionSetup = page.getByTestId('aionui-setup');
  await aionSetup.getByTestId('aionui-connection-steps').waitFor();
  assert.equal(
    await aionSetup.getByTestId('aionui-connection-steps').locator('.MuiStep-root').count(),
    3,
  );
  await aionSetup
    .getByTestId('aionui-step-hint')
    .getByRole('button', { name: 'Configure access', exact: true })
    .waitFor();
  assert.equal(await aionSetup.getByTestId('aionui-status-facts').count(), 0);
  assert.equal(
    (await page.evaluate(() => window.interconnect.invoke('aionUiStatus'))).state,
    'not-paired',
  );
  await page.getByTestId('aionui-configure-access').click();
  const accessDialog = page.getByRole('dialog');
  assert.equal(
    await accessDialog
      .getByRole('textbox', { name: 'AionUi WebUI address', exact: true })
      .inputValue(),
    'http://127.0.0.1:25808',
  );
  assert.equal(
    await accessDialog.getByLabel('Pairing code', { exact: true }).getAttribute('type'),
    'password',
  );
  assert.ok(await accessDialog.getByRole('button', { name: 'Pair', exact: true }).isDisabled());
  await accessDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await page.locator('pre, textarea, [contenteditable="true"]').count(), 0);
  assert.deepEqual(
    await hashes(),
    before,
    'AionUi instructions must not write client configuration',
  );
  await backToApplications();
  assert.equal(await page.getByTestId('nav-clients').count(), 0);
  const applicationSnapshot = await page.evaluate(() => window.interconnect.invoke('snapshot'));
  await applicationList.getByRole('switch', { name: 'Show OpenCode v1', exact: true }).check();
  const aionState = await page.evaluate(() => window.interconnect.invoke('aionUiStatus'));
  for (const [client, kind] of [
    ['cursor', 'cursor-hook'],
    ['opencode', 'opencode-http'],
    ['codex', 'codex-desktop'],
    ['aionui', 'aionui'],
    ['claude', 'claude-code'],
  ]) {
    const { state } = await page.evaluate(
      (client) => window.interconnect.invoke('mcpSetupStatus', { client }),
      client,
    );
    const profiles = applicationSnapshot.adapters.filter((profile) => profile.kind === kind);
    const ids = new Set(profiles.map((profile) => profile.id));
    const agents = applicationSnapshot.agents.filter(
      (agent) => agent.binding && ids.has(agent.binding.adapterId),
    );
    const dates = [
      ...agents.map((agent) => agent.lastMessageAt),
      ...profiles.map((profile) => profile.lastOwnerVerifiedAt),
    ].filter((value) => value && Number.isFinite(Date.parse(value)));
    const activity = dates.sort((a, b) => Date.parse(b) - Date.parse(a))[0];
    await verifyClientStatusPanel(page, {
      client,
      configured: state === 'configured' && (client !== 'aionui' || aionState.state === 'paired'),
      count: agents.length,
      activity,
    });
  }
  assert.equal(await page.getByRole('button', { name: 'Add adapter', exact: true }).count(), 0);
  assert.equal(await page.getByRole('textbox', { name: /Exact.*(ID|UUID)/ }).count(), 0);
  await page.getByRole('button', { name: 'Agents', exact: true }).click();
  await page.getByTestId('create-agent-manually').click();
  await page.getByRole('textbox', { name: 'Agent name' }).fill('Interface check');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Open chat with Interface check', exact: true }).click();
  const access = await page.evaluate(() => window.interconnect.invoke('accessCode'));
  const settings = JSON.parse(await readFile(path.join(temp, 'desktop/settings.json'), 'utf8'));
  assert.equal((await page.evaluate(() => window.interconnect.invoke('snapshot'))).peers.length, 0);
  await page.getByTestId('agent-chat-compose-toggle').click();
  await waitForComposerTransition(page);
  await page
    .getByRole('textbox', { name: 'Recipient agent name', exact: true })
    .fill('Local recipient');
  await page
    .getByRole('textbox', { name: 'Message from the user', exact: true })
    .fill('A local message with no remote connections.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByText('A local message with no remote connections.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close chat', exact: true }).click();
  await page.getByRole('button', { name: 'Open chat with Local recipient', exact: true }).click();
  await page.getByText('A local message with no remote connections.', { exact: true }).waitFor();
  assert.equal(await page.getByTestId('chat-message').getAttribute('data-direction'), 'in');
  assert.equal((await page.evaluate(() => window.interconnect.invoke('snapshot'))).peers.length, 0);
  await page.getByRole('button', { name: 'Close chat', exact: true }).click();
  await page.getByRole('button', { name: 'Open chat with Interface check', exact: true }).click();
  remote = new NodeService(path.join(temp, 'remote'));
  await remote.open();
  await remote.network.join(`wss://127.0.0.1:${settings.peerPort}/peer`, access.code);
  const owner = remote.connect({ nickname: 'Sender', client: 'UI test' });
  assert.equal(owner.status, 'connected');
  const until = async (fn) => {
    const deadline = Date.now() + 10000;
    while (!(await fn())) {
      if (Date.now() > deadline) throw new Error('UI exchange timed out');
      await new Promise((r) => setTimeout(r, 20));
    }
  };
  await until(() => remote.snapshot().peers[0]?.connected);
  const attachmentName = 'data$&-{size}-漢字.txt';
  const file = path.join(remote.settings.value.exportRoots[0], attachmentName);
  await writeFile(file, 'Verified attachment\nContent and extension are preserved.\n');
  const text =
    'Full incoming message\nThe second line should wrap without horizontal scrolling.\n<script>window.injected = true</script>\n[external link](https://untrusted.invalid)';
  const sent = await remote.send({
    connectionId: owner.binding.connectionId,
    recipientNode: settings.nodeId,
    recipientNickname: 'INTERFACE CHECK',
    text,
    files: [file],
  });
  await page.getByText('Full incoming message', { exact: false }).waitFor();
  await page.getByRole('button', { name: `Open ${attachmentName}`, exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.injected), undefined);
  assert.equal(await page.locator('a[href="https://untrusted.invalid"]').count(), 0);
  await page.getByRole('button', { name: 'Close chat', exact: true }).click();
  await page.getByRole('button', { name: 'Open chat with Interface check', exact: true }).click();
  await page.getByText('Full incoming message', { exact: false }).waitFor();
  assert.equal(
    await page.getByRole('button', { name: `Open ${attachmentName}`, exact: true }).count(),
    1,
  );
  assert.equal(
    await page.getByRole('button', { name: `Save ${attachmentName}`, exact: true }).count(),
    1,
  );
  const saved = path.join(temp, 'saved.txt');
  await application.evaluate(
    ({ dialog, shell }, { saved }) => {
      globalThis.__testOpenPaths = [];
      shell.openPath = async (filename) => {
        globalThis.__testOpenPaths.push(filename);
        return '';
      };
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: saved });
    },
    { saved },
  );
  await page.getByRole('button', { name: `Open ${attachmentName}`, exact: true }).click();
  await page.getByRole('button', { name: `Save ${attachmentName}`, exact: true }).click();
  await until(async () => {
    try {
      await readFile(saved);
      return true;
    } catch (e) {
      if (e.code === 'ENOENT') return false;
      throw e;
    }
  });
  assert.equal(await readFile(saved, 'utf8'), await readFile(file, 'utf8'));
  const opened = await application.evaluate(() => globalThis.__testOpenPaths);
  assert.equal(opened.length, 1);
  assert.equal(path.extname(opened[0]), '.txt');
  receiver = new Client({ name: 'ui-test', version: '1' });
  await receiver.connect(
    new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${settings.mcpPort}/mcp`), {
      requestInit: { headers: { authorization: 'Bearer ' + settings.localToken } },
    }),
  );
  assert.equal((await receiver.listTools()).tools.length, 11);
  const connected = (
    await receiver.callTool({ name: 'agent_connect', arguments: { nickname: 'Interface check' } })
  ).structuredContent;
  assert.equal(connected.status, 'connected');
  const receive = async () => {
    const result = await receiver.callTool({
      name: 'agent_read',
      arguments: { connectionId: connected.binding.connectionId },
    });
    assert.ok(!result.isError);
  };
  await receive();
  await page
    .getByTestId('chat-message')
    .filter({ has: page.getByTestId('message-text').filter({ hasText: 'Full incoming message' }) })
    .getByText(/Received by agent$/)
    .waitFor();
  assert.equal(
    (await page.evaluate(() => window.interconnect.invoke('snapshot'))).agents.find(
      (agent) => agent.nickname === 'Interface check',
    ).unread,
    0,
  );
  await page.evaluate(async () => {
    const snapshot = await window.interconnect.invoke('snapshot');
    for (let index = 0; index < 205; index++)
      await window.interconnect.invoke('send', {
        nickname: 'Interface check',
        recipientNode: snapshot.nodeId,
        recipientNickname: 'Local recipient',
        text: 'Paging message ' + index,
      });
  });
  await page.getByRole('button', { name: 'Close chat', exact: true }).click();
  await page.getByRole('button', { name: 'Open chat with Interface check', exact: true }).click();
  await page.getByText('Paging message 204', { exact: true }).waitFor();
  const history = page.getByTestId('agent-chat-history');
  const pagination = await verifyChatHistoryPagination(
    page,
    [
      'A local message with no remote connections.',
      text,
      ...Array.from({ length: 205 }, (_, index) => 'Paging message ' + index),
    ],
    async () => {
      await page.getByRole('button', { name: 'Close chat', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'detached' });
      await page
        .getByRole('button', { name: 'Open chat with Interface check', exact: true })
        .click();
      await page.getByText('Paging message 204', { exact: true }).waitFor();
    },
  );
  await page.getByText('Full incoming message', { exact: false }).waitFor();
  await history.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.screenshot({ path: 'release/preview-agents.png' });
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  assert.equal(
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()),
    false,
  );
  await remote.send({
    connectionId: owner.binding.connectionId,
    recipientNode: settings.nodeId,
    recipientNickname: 'Interface check',
    text: 'Messaging continues after closing the window.',
  });
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
  await page.getByText('Messaging continues after closing the window.', { exact: true }).waitFor();
  await receive();
  await until(
    async () =>
      (await page.evaluate(() => window.interconnect.invoke('snapshot'))).agents.find(
        (agent) => agent.nickname === 'Interface check',
      ).unread === 0,
  );
  assert.deepEqual(
    await hashes(),
    before,
    'private client settings must be unchanged without Apply',
  );
  console.log(
    JSON.stringify({
      aionUiReadOnlySetup: true,
      applicationManualForms: 5,
      electron: '45.1.0',
      renderer: 'React + MUI 9.5.0',
      liveTlsMessage: sent.id,
      windowCloseKeepsExchange: true,
      localExchangeWithoutPeers: true,
      automaticReadReceipt: true,
      attachmentOpenBoundary: true,
      attachmentSaved: true,
      externalTextEscaped: true,
      drawerHistoryAndAttachmentsPreserved: true,
      newestFirstPaginationAndScrollAnchor: true,
      pagination,
      literalAttachmentNamePreserved: true,
      isolatedClientConfigsUnchangedWithoutApply: true,
      screenshots: ['release/preview-overview.png', 'release/preview-agents.png'],
    }),
  );
} catch (e) {
  console.error(stderr.slice(-6000));
  throw e;
} finally {
  if (receiver) await receiver.close();
  if (remote) await remote.close();
  if (application) await application.close();
  await rm(temp, { recursive: true, force: true });
}

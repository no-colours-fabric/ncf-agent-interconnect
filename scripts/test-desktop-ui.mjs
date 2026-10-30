import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { NodeService } from '../build/core/service.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const require = createRequire(import.meta.url);
const userConfigs = [
  path.join(os.homedir(), '.cursor/mcp.json'),
  path.join(os.homedir(), '.config/opencode/opencode.json'),
  path.join(os.homedir(), '.config/opencode/opencode.jsonc'),
  path.join(os.homedir(), '.opencode/opencode.json'),
  path.join(os.homedir(), '.opencode/opencode.jsonc'),
  ...(process.env.CODEX_HOME ? [path.join(process.env.CODEX_HOME, 'config.toml')] : []),
  path.join(os.homedir(), '.codex/config.toml'),
];
const hashes = async () =>
  Promise.all(
    userConfigs.map(async (file) => {
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
const before = await hashes();
const temp = await mkdtemp(path.join(os.tmpdir(), 'ncf-interconnect-ui-'));
let application, remote, receiver;
let stderr = '';
try {
  const packaged = process.env.INTERCONNECT_TEST_EXECUTABLE;
  application = await electron.launch({
    executablePath: packaged ?? require('electron'),
    args: [...(packaged ? [] : [process.cwd()]), '--data-dir', path.join(temp, 'desktop')],
    cwd: temp,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '' },
    timeout: 30000,
  });
  application.process().stderr?.on('data', (b) => {
    stderr += b.toString();
  });
  const page = await application.firstWindow();
  await page.getByText('Connect agents', { exact: true }).waitFor();
  await mkdir('release', { recursive: true });
  await page.screenshot({ path: 'release/preview-overview.png' });
  await page.getByRole('button', { name: 'MCP setup', exact: true }).click();
  await page.getByText('1. Add the configuration', { exact: true }).waitFor();
  const configuration = await page.locator('pre').textContent();
  assert.ok(configuration.includes('/mcp'));
  assert.ok(!configuration.includes(process.cwd()));
  await page.getByRole('button', { name: 'Applications', exact: true }).click();
  await page.getByText('OpenCode and its frontends', { exact: true }).waitFor();
  await page.getByText('Codex Desktop', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Add adapter', exact: true }).count(), 0);
  assert.equal(await page.getByRole('textbox', { name: /Exact.*(ID|UUID)/ }).count(), 0);
  await page.getByRole('button', { name: 'Agents', exact: true }).click();
  await page.getByRole('button', { name: 'Add agent' }).click();
  await page.getByRole('textbox', { name: 'Agent name' }).fill('Interface check');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByText('History is available; no active chat', { exact: true }).waitFor();
  const access = await page.evaluate(() => window.interconnect.invoke('accessCode'));
  const settings = JSON.parse(await readFile(path.join(temp, 'desktop/settings.json'), 'utf8'));
  assert.equal((await page.evaluate(() => window.interconnect.invoke('snapshot'))).peers.length, 0);
  await page
    .getByRole('textbox', { name: 'Recipient agent name', exact: true })
    .fill('Local recipient');
  await page
    .getByRole('textbox', { name: 'Message from the user', exact: true })
    .fill('A local message with no remote connections.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByText('A local message with no remote connections.', { exact: true }).waitFor();
  await page.getByRole('button', { name: /^Local recipient/ }).click();
  await page.getByText('A local message with no remote connections.', { exact: true }).waitFor();
  await page.getByText('Incoming message', { exact: true }).waitFor();
  assert.equal((await page.evaluate(() => window.interconnect.invoke('snapshot'))).peers.length, 0);
  await page.getByRole('button', { name: /^Interface check/ }).click();
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
  const file = path.join(remote.settings.value.exportRoots[0], 'data.txt');
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
  await page.getByRole('button', { name: 'Open data.txt', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.injected), undefined);
  assert.equal(await page.locator('a[href="https://untrusted.invalid"]').count(), 0);
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
  await page.getByRole('button', { name: 'Open data.txt', exact: true }).click();
  await page.getByRole('button', { name: 'Save data.txt', exact: true }).click();
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
  assert.equal((await receiver.listTools()).tools.length, 8);
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
  await page.getByText('Received by agent', { exact: true }).waitFor();
  assert.equal(
    (await page.evaluate(() => window.interconnect.invoke('snapshot'))).agents.find(
      (agent) => agent.nickname === 'Interface check',
    ).unread,
    0,
  );
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
  assert.deepEqual(await hashes(), before, 'real MCP client settings must be unchanged');
  console.log(
    JSON.stringify({
      electron: '45.1.0',
      renderer: 'React + MUI 9.5.0',
      liveTlsMessage: sent.id,
      windowCloseKeepsExchange: true,
      localExchangeWithoutPeers: true,
      automaticReadReceipt: true,
      attachmentOpenBoundary: true,
      attachmentSaved: true,
      externalTextEscaped: true,
      realClientConfigsUnchanged: true,
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

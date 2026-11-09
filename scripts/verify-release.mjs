import * as asar from '@electron/asar';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const release = new URL('../release/', import.meta.url),
  base = new URL(
    process.platform === 'darwin'
      ? `mac-${process.arch}/NCF Agent Interconnect.app/Contents/`
      : process.platform === 'win32'
        ? process.arch === 'arm64'
          ? 'win-arm64-unpacked/'
          : 'win-unpacked/'
        : 'linux-unpacked/',
    release,
  );
const { fileURLToPath } = await import('node:url');
const archive = fileURLToPath(
  new URL(process.platform === 'darwin' ? 'Resources/app.asar' : 'resources/app.asar', base),
);
const executable = fileURLToPath(
  new URL(
    process.platform === 'darwin'
      ? 'MacOS/NCF Agent Interconnect'
      : process.platform === 'win32'
        ? 'NCF Agent Interconnect.exe'
        : 'ncf-agent-interconnect',
    base,
  ),
);
const entries = asar.listPackage(archive).map((entry) => entry.replaceAll('\\', '/'));
assert.ok(entries.includes('/build/integrations/opencode.js'));
assert.ok(entries.includes('/build/integrations/claude-code.js'));
assert.ok(entries.includes('/build/core/client-contexts.js'));
assert.ok(entries.includes('/node_modules/fast-srp-hap/LICENSE'));
assert.ok(!entries.includes('/build/core/store.js'));
assert.ok(!entries.some((entry) => /^\/(src|test-desktop|\.local)\//.test(entry)));
assert.equal(JSON.parse(asar.extractFile(archive, 'package.json').toString()).version, pkg.version);
const temporary = await mkdtemp(path.join(os.tmpdir(), 'interconnect-package-'));
try {
  const extracted = path.join(temporary, 'application');
  asar.extractAll(archive, extracted);
  const worker = path.join(extracted, 'verify-installed.mjs');
  await writeFile(
    worker,
    `
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { NodeService } from './build/core/service.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const directory = path.resolve('../isolated-data'), service = new NodeService(directory), clients = [];
let host; const prompts = [];
try {
  assert.ok(process.versions.electron, 'Use the runtime shipped in the package');
  await service.open();
  const instructions = await service.userCall('instructions', { client: 'opencode' });
  const config = JSON.parse(instructions.configuration), plugin = await import(config.plugin[0]);
  assert.ok(config.plugin[0].includes('/isolated-data/Integrations/'));
  assert.ok(!config.plugin[0].includes(process.cwd()));
  const workspace = path.join(directory, 'workspace');
  host = await plugin.NCFAgentInterconnect({ directory: workspace, client: { session: {
    get: async options => ({ data: { id: options.path.id, directory: workspace } }),
    status: async () => ({ data: {} }),
    promptAsync: async options => { prompts.push({ id: options.path.id, text: options.body.parts[0].text }); return {}; }
  } } });
  const connectClient = async name => {
    const client = new Client({ name, version: 'package-verification' });
    await client.connect(new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), { requestInit: { headers: { authorization: 'Bearer ' + service.settings.value.localToken } } }));
    clients.push(client); return client;
  };
  const cursor = await connectClient('Cursor'), opencode = await connectClient('opencode');
  const tools = await opencode.listTools(), schema = tools.tools.find(tool => tool.name === 'agent_connect').inputSchema;
  const sendSchema = tools.tools.find(tool => tool.name === 'agent_send').inputSchema;
  assert.ok(opencode.getInstructions().includes('Reply-To')); assert.ok(opencode.getInstructions().includes('agent_send'));
  assert.ok(sendSchema.properties.replyRef);
  assert.equal(tools.tools.length, 11); assert.ok(!tools.tools.some(tool => tool.name === 'message_ack'));
  assert.ok(tools.tools.find(tool => tool.name === 'agent_clear_history').inputSchema.properties.operationId);
  for (const tool of tools.tools) assert.equal(tool.annotations.destructiveHint, ['agent_connect', 'agent_clear_history'].includes(tool.name));
  for (const removed of ['client', 'chatId', 'adapterId', 'codexTarget']) assert.ok(!(removed in schema.properties));
  const first = (await cursor.callTool({ name: 'agent_connect', arguments: { nickname: 'Package sender' } })).structuredContent;
  assert.equal(first.status, 'connected'); assert.equal(first.delivery.automatic, false);
  const output = { args: { nickname: 'Package recipient' } };
  await host['tool.execute.before']({ tool: 'ncf_agent_interconnect_agent_connect', sessionID: 'ses_packaged' }, output);
  const second = (await opencode.callTool({ name: 'agent_connect', arguments: output.args })).structuredContent;
  assert.equal(second.status, 'connected'); assert.equal(second.delivery.automatic, true);
  const missingAddress = await cursor.callTool({ name: 'agent_send', arguments: { connectionId: first.binding.connectionId, recipientNickname: 'Package recipient', text: 'Missing explicit node' } });
  assert.equal(missingAddress.isError, true); assert.match(JSON.stringify(missingAddress.content), /recipientNode.*required/);
  const message = await service.send({ connectionId: first.binding.connectionId, recipientNode: service.settings.value.nodeId, recipientNickname: 'Package recipient', text: 'The package runs without source files' });
  assert.equal(message.accepted, true); assert.equal(message.recipientNode, service.settings.value.nodeId); assert.ok(!('sent' in message));
  const deadline = Date.now() + 5000;
  while (service.store.dispatchState(message.id)?.state !== 'admitted') { if (Date.now() > deadline) throw new Error('Packaged integration did not deliver'); await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.equal(prompts.length, 1); assert.equal(prompts[0].id, 'ses_packaged');
  const replyRef = 'r' + service.store.get(message.id, 'in').sequence.toString(36);
  assert.equal(prompts[0].text, ['**Incoming NCF Agent Interconnect**', 'From: "Package sender"', '', 'The package runs without source files', '', 'Reply-To: ' + replyRef, 'Use agent_send(connectionId, replyRef="' + replyRef + '", text) to reply.'].join(String.fromCharCode(10))); assert.ok(!prompts[0].text.includes(second.binding.connectionId));
  const reply = await opencode.callTool({ name: 'agent_send', arguments: { connectionId: second.binding.connectionId, replyRef, text: 'Packaged compact reply' } });
  assert.ok(!reply.isError); const replyEnvelope = service.store.get(reply.structuredContent.id, 'out').envelope;
  assert.equal(replyEnvelope.toNode, service.settings.value.nodeId); assert.equal(replyEnvelope.toNickname, 'Package sender'); assert.equal(replyEnvelope.replyTo, message.id);
  while (service.snapshot().agents.find(agent => agent.nickname === 'Package recipient').unread) { if (Date.now() > deadline) throw new Error('Delivered message still unread'); await new Promise(resolve => setTimeout(resolve, 10)); } assert.deepEqual(service.snapshot().peers, []);
  assert.ok((await readFile(path.join(directory, 'Integrations/opencode.js'), 'utf8')).includes('tool.execute.before'));
  await host.event({ event: { type: 'server.instance.disposed' } });
  let releaseSessionApi;
  const sessionApiReady = new Promise(resolve => { releaseSessionApi = resolve; });
  const restartingHost = plugin.NCFAgentInterconnect({ directory: workspace, client: { session: {
    get: async options => { await sessionApiReady; return { data: { id: options.path.id, directory: workspace } }; },
    status: async () => ({ data: {} }),
    promptAsync: async options => { prompts.push({ id: options.path.id, text: options.body.parts[0].text }); return {}; }
  } } });
  let startupTimer;
  const hooksReady = await Promise.race([
    restartingHost.then(() => true),
    new Promise(resolve => { startupTimer = setTimeout(() => resolve(false), 2000); })
  ]);
  releaseSessionApi(); clearTimeout(startupTimer); host = await restartingHost;
  assert.equal(hooksReady, true, 'Packaged plugin startup must not wait for its host session API');
  const restored = await service.send({ connectionId: first.binding.connectionId, recipientNode: service.settings.value.nodeId, recipientNickname: 'Package recipient', text: 'After cold host restart without UI or connect tools' });
  const recoveryDeadline = Date.now() + 6000;
  while (service.store.get(restored.id, 'in')?.state !== 'processed') { if (Date.now() > recoveryDeadline) throw new Error('Packaged host did not restore the saved chat'); await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.deepEqual(service.store.assertOwner(second.binding.connectionId).binding, second.binding);
  assert.equal(prompts.length, 2); assert.equal(prompts[1].id, 'ses_packaged');
  console.log(JSON.stringify({ electron: process.versions.electron, node: process.versions.node, installedPlugin: true, nicknameOnlyConnect: true, explicitRecipientNode: true, fullReplyAddress: true, compactReplyReference: true, exactLocalDelivery: true, directMessageBody: true, automaticReceipt: true, coldHostStartup: true, savedChatRestoredWithoutUi: true, originalBindingPreserved: true, mcpToolCount: tools.tools.length, independentOfCheckout: true, liveAgentsContacted: false, nativeUiTested: false }));
} finally {
  if (host) await host.event({ event: { type: 'server.instance.disposed' } });
  for (const client of clients) await client.close(); await service.close();
}
`,
  );
  const result = spawnSync(executable, [worker], {
    cwd: extracted,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      'Installed package verification: ' + (result.stderr || result.stdout).slice(-4000),
    );
  // The Claude Code plugin runs the installed executable directly against its own archive entry.
  const claudeWorker = path.join(extracted, 'verify-installed-claude.mjs');
  await writeFile(
    claudeWorker,
    `
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { NodeService } from './build/core/service.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
const helper = process.env.NCF_INSTALLED_CLAUDE_HELPER;
const directory = path.resolve('../isolated-claude-data'), service = new NodeService(directory);
const nodeFile = path.join(directory, 'Integrations', 'node.json');
const prefix = 'mcp__plugin_ncf-agent-interconnect_ncf__';
const session = randomUUID();
let client;
// Asynchronous: the node in this process must keep serving the hook's HTTP request.
const hook = (input) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [helper, '--hook', '--node-file', nodeFile], { env: { ...getDefaultEnvironment(), ELECTRON_RUN_AS_NODE: '1' }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error('Hook exited ' + code));
      // PreToolUse prints the node's one-use proof as updatedInput, as Claude Code applies it.
      resolve(stdout ? JSON.parse(stdout).hookSpecificOutput.updatedInput : undefined);
    });
    child.stdin.end(JSON.stringify(input));
  });
try {
  assert.ok(process.versions.electron, 'Use the runtime shipped in the package');
  await service.open();
  const plugin = JSON.parse(await readFile(path.join(directory, 'Integrations/claude-code/plugin/.claude-plugin/plugin.json'), 'utf8'));
  assert.equal(plugin.mcpServers.ncf.command, process.execPath);
  assert.deepEqual(plugin.mcpServers.ncf.env, { ELECTRON_RUN_AS_NODE: '1' });
  const hooks = JSON.parse(await readFile(path.join(directory, 'Integrations/claude-code/plugin/hooks/hooks.json'), 'utf8')).hooks;
  const command = hooks.SessionStart[0].hooks[0];
  assert.ok(process.platform === 'win32' ? command.command.includes(process.execPath.replaceAll("'", "''")) : command.args[1] === process.execPath);
  assert.equal(await hook({ hook_event_name: 'SessionStart', session_id: session, source: 'startup' }), undefined);
  const wakes = [];
  client = new Client({ name: 'claude-code', version: 'package-check' });
  client.setNotificationHandler(z.object({ method: z.literal('notifications/claude/channel'), params: z.object({ content: z.string(), meta: z.record(z.string(), z.string()).optional() }) }), async (n) => { wakes.push(n.params); });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [helper, '--node-file', nodeFile], env: { ...getDefaultEnvironment(), ELECTRON_RUN_AS_NODE: '1', CLAUDE_CODE_SESSION_ID: session }, stderr: 'pipe' }));
  const tools = await client.listTools();
  // Model lifecycle tools have no authority and are not exposed.
  assert.ok(!tools.tools.some((tool) => tool.name === 'session_event'));
  const root = path.join(directory, 'Integrations/claude-code');
  const version = JSON.parse(await readFile('./package.json', 'utf8')).version;
  assert.deepEqual(plugin.dependencies, [{ name: 'ncf-agent-interconnect-gate', version: '=' + version }]);
  assert.deepEqual(JSON.parse(await readFile(path.join(root, 'plugin/hooks/hooks.json'), 'utf8')).modules, ['./wake.js']);
  assert.equal(JSON.parse(await readFile(path.join(root, 'gate/.claude-plugin/plugin.json'), 'utf8')).version, version);
  const wakeModule = await readFile(path.join(root, 'plugin/hooks/wake.js'), 'utf8');
  assert.ok(wakeModule.includes(JSON.stringify(process.execPath)) && wakeModule.includes(JSON.stringify(nodeFile)));
  assert.ok((await readFile(path.join(root, 'gate/hooks/gate.js'), 'utf8')).includes('ncf-agent-interconnect'));
  const args = { nickname: 'Пакет 漢字' };
  // The helper's route is proven once its node stream is attached, as before any model tool call.
  const routeDeadline = Date.now() + 15000;
  while (!service.claude.route(session).helper) { if (Date.now() > routeDeadline) throw new Error('No packaged helper route'); await new Promise((resolve) => setTimeout(resolve, 20)); }
  const connectInput = await hook({ hook_event_name: 'PreToolUse', session_id: session, tool_name: prefix + 'agent_connect', tool_input: args });
  const connected = await client.callTool({ name: 'agent_connect', arguments: connectInput });
  assert.equal(connected.isError, undefined, JSON.stringify(connected.content));
  const sender = service.connect({ nickname: 'Package sender', client: 'MCP' });
  const sent = await service.send({ connectionId: sender.binding.connectionId, recipientNode: service.settings.value.nodeId, recipientNickname: 'Пакет 漢字', text: 'Packaged Claude wake' });
  const deadline = Date.now() + 10000;
  while (!wakes.length) { if (Date.now() > deadline) throw new Error('No packaged channel wake'); await new Promise((resolve) => setTimeout(resolve, 20)); }
  assert.ok(!wakes[0].content.includes('Packaged Claude wake'));
  assert.equal(service.store.get(sent.id, 'in').state, 'ready');
  // The installed mod's child: the packaged runtime holds this session's wake stream.
  const child = spawn(process.execPath, [helper, '--wake-stream', '--node-file', nodeFile, '--session', session], { env: { ...getDefaultEnvironment(), ELECTRON_RUN_AS_NODE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let streamed = '';
  child.stdout.on('data', (chunk) => { streamed += chunk; });
  const streamDeadline = Date.now() + 15000;
  while (!streamed.includes('\\n')) { if (Date.now() > streamDeadline) throw new Error('No packaged mod wake'); await new Promise((resolve) => setTimeout(resolve, 20)); }
  child.kill();
  const wake = JSON.parse(streamed.split('\\n')[0]);
  assert.equal(wake.type, 'wake'); assert.match(wake.claim, /^[0-9a-f]{64}$/);
  assert.ok(!streamed.includes('Packaged Claude wake'));
  const descriptor = JSON.parse(await readFile(nodeFile, 'utf8'));
  const postNode = async (route, body) => (await fetch(new URL(route, descriptor.url), { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + descriptor.token }, body: JSON.stringify(body) })).json();
  assert.deepEqual(await postNode('/integrations/claude/wake/claim', { sessionId: session, claim: wake.claim }), { consumed: true });
  const noticeHash = createHash('sha256').update(wake.notice, 'utf8').digest('hex');
  assert.deepEqual(await postNode('/integrations/claude/wake/start', { sessionId: session, notice: noticeHash }), { started: true });
  // Receipt through the packaged bridge: committed only after its frame write.
  const readArgs = { connectionId: connected.structuredContent.binding.connectionId };
  const readInput = await hook({ hook_event_name: 'PreToolUse', session_id: session, tool_name: prefix + 'agent_read', tool_input: readArgs });
  const read = await client.callTool({ name: 'agent_read', arguments: readInput });
  assert.equal(read.isError, undefined, JSON.stringify(read.content));
  assert.ok(JSON.stringify(read.structuredContent).includes('Packaged Claude wake'));
  assert.ok(!JSON.stringify(read).includes('ncf/claude-delivery'));
  const receiptDeadline = Date.now() + 10000;
  while (service.store.get(sent.id, 'in').state !== 'processed') { if (Date.now() > receiptDeadline) throw new Error('No packaged write-commit receipt'); await new Promise((resolve) => setTimeout(resolve, 20)); }
  console.log(JSON.stringify({ claudeHelperFromArchive: true, claudeHooksExitQuietly: true, claudeChannelWake: true, claudeModWakeStream: true, claudeGateStart: true, claudeWriteCommitReceipt: true, claudeReceiptWithoutRead: false, liveClaudeCodeContacted: false }));
} finally {
  await client?.close(); await service.close();
}
`,
  );
  const claude = spawnSync(executable, [claudeWorker], {
    cwd: extracted,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NCF_INSTALLED_CLAUDE_HELPER: path.join(archive, 'build', 'integrations', 'claude-code.js'),
    },
    encoding: 'utf8',
    timeout: 60000,
    windowsHide: true,
  });
  if (claude.error) throw claude.error;
  if (claude.status !== 0)
    throw new Error(
      'Installed Claude Code verification: ' + (claude.stderr || claude.stdout).slice(-4000),
    );
  const git = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8',
    windowsHide: true,
  });
  const archivedRevision = (
    await readFile(new URL('../SOURCE_REVISION', import.meta.url), 'utf8')
  ).trim();
  const sourceRevision =
    process.env.GITHUB_SHA ??
    process.env.NCF_SOURCE_REVISION ??
    (/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(archivedRevision)
      ? archivedRevision
      : git.status === 0
        ? git.stdout.trim()
        : null);
  if (sourceRevision && !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(sourceRevision))
    throw new Error('Invalid source revision');
  const report = {
    version: pkg.version,
    sourceRevision,
    platform: process.platform,
    arch: process.arch,
    verifiedAt: new Date().toISOString(),
    ...JSON.parse(result.stdout.trim().split('\n').at(-1)),
    ...JSON.parse(claude.stdout.trim().split('\n').at(-1)),
  };
  await writeFile(new URL('verification.json', release), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  await rm(temporary, { recursive: true, force: true });
}

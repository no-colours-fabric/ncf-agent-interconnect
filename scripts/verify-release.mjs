import * as asar from '@electron/asar';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const targetArch = process.argv.find((arg) => arg.startsWith('--arch='))?.slice(7) ?? process.arch;
assert.ok(['arm64', 'x64'].includes(targetArch), 'Supported package architecture');
const release = new URL('../release/', import.meta.url),
  base = new URL(
    process.platform === 'darwin'
      ? `${targetArch === 'x64' ? 'mac' : 'mac-' + targetArch}/NCF Agent Interconnect.app/Contents/`
      : process.platform === 'win32'
        ? targetArch === 'arm64'
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
assert.ok(entries.includes('/build/integrations/aionui.js'));
assert.ok(entries.includes('/build/main/preload.cjs'));
assert.ok(entries.includes('/build/renderer/index.html'));
assert.ok(entries.includes('/build/core/client-contexts.js'));
assert.ok(entries.includes('/node_modules/fast-srp-hap/LICENSE'));
assert.ok(!entries.includes('/build/core/store.js'));
assert.ok(!entries.some((entry) => /^\/(src|test-desktop|\.local)\//.test(entry)));
assert.equal(JSON.parse(asar.extractFile(archive, 'package.json').toString()).version, pkg.version);
async function sourceRevision() {
  const git = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8',
    windowsHide: true,
  });
  const archived = (await readFile(new URL('../SOURCE_REVISION', import.meta.url), 'utf8')).trim();
  const revision =
    process.env.GITHUB_SHA ??
    process.env.NCF_SOURCE_REVISION ??
    (/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(archived)
      ? archived
      : git.status === 0
        ? git.stdout.trim()
        : null);
  if (revision && !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(revision))
    throw new Error('Invalid source revision');
  return revision;
}
if (process.platform === 'darwin') {
  const architecture = spawnSync('lipo', ['-archs', executable], { encoding: 'utf8' });
  if (architecture.error) throw architecture.error;
  assert.equal(architecture.status, 0, 'Read packaged Mach-O architecture');
  assert.equal(architecture.stdout.trim(), targetArch === 'x64' ? 'x86_64' : 'arm64');
}
if (targetArch !== process.arch) {
  assert.equal(process.platform, 'darwin', 'Cross-architecture packaging is supported on macOS');
  const report = {
    version: pkg.version,
    sourceRevision: await sourceRevision(),
    platform: process.platform,
    arch: targetArch,
    hostArch: process.arch,
    packageLayout: true,
    executableArchitecture: true,
    runtimeExecuted: false,
    note: 'Packaged on macOS; this architecture was not run on target hardware.',
  };
  await writeFile(
    new URL(`verification-${targetArch}.json`, release),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report));
  process.exit(0);
}
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
  const report = {
    version: pkg.version,
    sourceRevision: await sourceRevision(),
    platform: process.platform,
    arch: process.arch,
    verifiedAt: new Date().toISOString(),
    ...JSON.parse(result.stdout.trim().split('\n').at(-1)),
  };
  await writeFile(new URL('verification.json', release), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  await rm(temporary, { recursive: true, force: true });
}

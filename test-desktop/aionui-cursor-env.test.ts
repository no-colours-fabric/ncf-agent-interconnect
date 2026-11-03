import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import { McpSetupService } from '../desktop/core/mcp-setup.js';
import { aionFixture, until } from './aionui-fixture.js';
import { ownStdio, temporaryNode } from './aionui-lifecycle.js';
import { cursorMcpFixtureLoader, type CursorStdioEntry } from './cursor-mcp-loader-fixture.js';

const fields = [
  'AIONUI_BASE_URL',
  'AIONUI_USER_ID',
  'AIONUI_CONVERSATION_ID',
  'AIONUI_RUNTIME_TOKEN',
] as const;

test('Cursor whitelist and interpolation deliver current ACP context to the real helper and reject unresolved context', async (t) => {
  const f = await aionFixture(t);
  const service = await temporaryNode(f.scope, 'ncf-cursor-env-');
  await service.userCall('aionUiPair', { url: f.url, code: f.code });
  const loader = await cursorMcpFixtureLoader();
  t.diagnostic(loader.provenance);
  const config = service.clientInstructions('aionui').configuration;
  const entry: CursorStdioEntry = JSON.parse(config).mcpServers.ncf_agent_interconnect;
  const ambient = {
    ...getDefaultEnvironment(),
    HOME: service.directory,
    USERPROFILE: service.directory,
    AIONUI_BASE_URL: f.coreUrl,
    AIONUI_USER_ID: f.state.userId,
    AIONUI_CONVERSATION_ID: 'fixture-chat-b',
    AIONUI_RUNTIME_TOKEN: f.runtimeToken,
  };
  for (const field of fields) {
    assert.equal(entry.env[field], '${env:' + field + '}');
    assert.ok(!config.includes(ambient[field]));
  }
  let registrations = 0;
  const register = service.contexts.registerAionUi.bind(service.contexts);
  service.contexts.registerAionUi = async (input) => {
    registrations++;
    return register(input);
  };
  const launch = async (candidate: CursorStdioEntry, host: Record<string, string>) => {
    const resolved = loader.load(candidate, host);
    const client = new Client({ name: 'fixture-Cursor-loader', version: 'fixture' });
    const transport = new StdioClientTransport({
      ...resolved,
      args: ['--import', import.meta.resolve('tsx'), ...resolved.args],
      stderr: 'pipe',
    });
    const exited = ownStdio(f.scope, client, transport);
    let stderr = '';
    transport.stderr?.on('data', (chunk) => (stderr += chunk.toString()));
    f.scope.file({
      label: 'Cursor loader helper output',
      close: async () => {
        assert.ok(exited(), 'The owned Cursor loader helper must exit before cleanup');
        for (const field of fields) assert.ok(!stderr.includes(ambient[field]));
      },
    });
    await f.scope.start('Cursor loader stdio MCP connect', () => client.connect(transport));
    return { client, resolved };
  };
  const invoke = (client: Client) =>
    client.callTool({ name: 'agent_connect', arguments: { nickname: 'Мост 漢字' } });

  // Reproduce the original assumption: ACP has all four values, but the stdio whitelist drops them.
  const legacy = await launch({ ...entry, env: { ELECTRON_RUN_AS_NODE: '1' } }, ambient);
  for (const field of fields) assert.ok(!(field in legacy.resolved.env));
  const original = await invoke(legacy.client);
  assert.equal(original.isError, true);
  assert.deepEqual(original.content, [
    {
      type: 'text',
      text:
        'This MCP integration requires the current AionUi agent runtime. ' +
        `Missing fields: ${fields.join(', ')}. Restart the agent in AionUi after setup.`,
    },
  ]);
  assert.equal(registrations, 0);
  assert.equal(service.store.list().length, 0);

  const current = await launch(entry, ambient);
  const result = await invoke(current.client);
  assert.ok(!result.isError);
  const bound = result.structuredContent as { binding: { chatId: string } };
  assert.equal(bound.binding.chatId, 'fixture-chat-b');
  assert.equal(registrations, 1);
  const sender = service.connect({ nickname: 'Source', client: 'fixture' });
  assert.equal(sender.status, 'connected');
  if (sender.status !== 'connected') throw new Error('The synthetic sender did not connect.');
  const sent = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'мост 漢字',
    text: 'Cursor loader synthetic delivery',
  });
  await until(() => service.store.dispatchState(sent.id)?.state === 'admitted');
  assert.equal(f.posts.length, 1);
  assert.equal(f.posts[0].chat, 'fixture-chat-b');

  for (const absent of [fields, ...fields.map((field) => [field])]) {
    const outside: Record<string, string> = { ...ambient };
    for (const field of absent) delete outside[field];
    const rejected = await launch(entry, outside);
    for (const field of absent) assert.equal(rejected.resolved.env[field], '${env:' + field + '}');
    const failure = await invoke(rejected.client);
    assert.equal(failure.isError, true);
    assert.deepEqual(failure.content, [
      {
        type: 'text',
        text:
          'This MCP integration requires the current AionUi agent runtime. ' +
          `Invalid fields: ${absent.join(', ')}. Restart the agent in AionUi after setup.`,
      },
    ]);
    assert.equal(registrations, 1, 'Unresolved references must be rejected before runtime proof');
    assert.equal(service.store.list().length, 2);
    assert.equal(f.posts.length, 1);
  }
});

test('owner Apply saves only Cursor literal references, preserves other settings and leaves matching bytes unchanged', async (t) => {
  const f = await aionFixture(t);
  const node = await temporaryNode(f.scope, 'ncf-cursor-env-setup-');
  const home = path.join(node.directory, 'Cursor profile 漢字');
  const setup = new McpSetupService({
    home,
    env: {},
    stateDirectory: path.join(node.directory, 'setup-state'),
    instructions: (client) => node.clientInstructions(client),
  });
  const filename = (await setup.defaults('aionui')).files[0].path;
  const oldEntry = JSON.parse(node.clientInstructions('aionui').configuration).mcpServers
    .ncf_agent_interconnect;
  oldEntry.env = { ELECTRON_RUN_AS_NODE: '1' };
  const original = JSON.stringify({
    other: 'keep',
    mcpServers: { foreign: { command: 'keep' }, ncf_agent_interconnect: oldEntry },
  });
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, original);
  assert.equal((await setup.status('aionui')).state, 'needs-update');
  const files = [{ id: 'configuration', path: filename }];
  const preview = await setup.preview('fixture-owner', 'aionui', files);
  assert.equal(preview.requiresReplacement, true);
  await assert.rejects(setup.apply('fixture-owner', preview.planId, false), /Confirm replacement/);
  assert.equal(await readFile(filename, 'utf8'), original);
  const applied = await setup.apply('fixture-owner', preview.planId, true);
  assert.equal(applied.status, 'applied');
  assert.equal(await readFile(applied.files[0].backupPath!, 'utf8'), original);
  const content = await readFile(filename, 'utf8');
  const config = JSON.parse(content);
  assert.equal(config.other, 'keep');
  assert.deepEqual(config.mcpServers.foreign, { command: 'keep' });
  for (const field of fields)
    assert.equal(config.mcpServers.ncf_agent_interconnect.env[field], '${env:' + field + '}');
  assert.equal((await setup.status('aionui')).state, 'configured');
  assert.equal((await setup.status('cursor')).state, 'needs-update');
  const stamp = (await stat(filename)).mtimeMs;
  const next = await setup.preview('fixture-owner', 'aionui', files);
  assert.equal(next.files[0].action, 'unchanged');
  assert.equal((await setup.apply('fixture-owner', next.planId, false)).status, 'unchanged');
  assert.equal(await readFile(filename, 'utf8'), content);
  assert.equal((await stat(filename)).mtimeMs, stamp);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import { claudePluginFiles, publishClaudePlugin } from '../desktop/core/claude-plugin.js';
import { claudeToolPrefix } from '../desktop/integrations/claude-code.js';
import { until } from './aionui-fixture.js';
import { claudeFixture, type ClaudeFixture } from './claude-code-fixture.js';

const script = fileURLToPath(new URL('../desktop/integrations/claude-code.ts', import.meta.url));
const tsx = import.meta.resolve('tsx');
const channelSchema = z.object({
  method: z.literal('notifications/claude/channel'),
  params: z.object({ content: z.string(), meta: z.record(z.string(), z.string()).optional() }),
});

test('Generated plugin files use exec form on POSIX, quoted literals on Windows and reject unsafe paths', async (t) => {
  const posix = claudePluginFiles({
    execPath: "/Applications/NCF O'Brien $HOME.app/Contents/MacOS/NCF",
    runtimeArgs: [],
    script: '/Applications/NCF.app/Contents/Resources/app.asar/build/integrations/claude-code.js',
    nodeFile: '/Users/Пользователь 漢字/Library/Application Support/NCF/Integrations/node.json',
    platform: 'darwin',
    version: '0.12.0',
  });
  const hooks = JSON.parse(posix['plugin/hooks/hooks.json']).hooks;
  const command = hooks.SessionStart[0].hooks[0];
  assert.equal(command.command, '/usr/bin/env');
  assert.deepEqual(command.args, [
    'ELECTRON_RUN_AS_NODE=1',
    "/Applications/NCF O'Brien $HOME.app/Contents/MacOS/NCF",
    '/Applications/NCF.app/Contents/Resources/app.asar/build/integrations/claude-code.js',
    '--hook',
    '--node-file',
    '/Users/Пользователь 漢字/Library/Application Support/NCF/Integrations/node.json',
  ]);
  assert.equal(hooks.SessionStart[0].hooks.length, 1);
  assert.deepEqual(hooks.SessionStart[1], {
    matcher: 'clear|compact|resume',
    hooks: [
      {
        type: 'mcp_tool',
        server: 'plugin:ncf-agent-interconnect:ncf',
        tool: 'session_event',
        input: { event: 'start', session_id: '${session_id}' },
      },
    ],
  });
  assert.equal(hooks.SessionEnd[0].hooks[1].input.event, 'end');
  // The command SessionStart hook has no matcher, so every source, including clear, is covered.
  assert.ok(!('matcher' in hooks.SessionStart[0]));
  assert.equal(hooks.PreToolUse[0].matcher, 'mcp__plugin_ncf-agent-interconnect_ncf__.*');
  assert.deepEqual(hooks.Stop, [{ hooks: [command] }]);
  assert.equal(claudeToolPrefix, 'mcp__plugin_ncf-agent-interconnect_ncf__');
  const plugin = JSON.parse(posix['plugin/.claude-plugin/plugin.json']);
  assert.deepEqual(plugin.channels, [{ server: 'ncf', displayName: 'NCF Agent Interconnect' }]);
  assert.deepEqual(plugin.mcpServers.ncf.env, { ELECTRON_RUN_AS_NODE: '1' });
  assert.equal(plugin.mcpServers.ncf.command, command.args[1]);
  assert.ok(!JSON.stringify(posix).includes('token'));
  assert.equal(JSON.parse(posix['.claude-plugin/marketplace.json']).plugins[0].source, './plugin');

  const windows = claudePluginFiles({
    execPath: "C:\\Program Files\\NCF O'Brien\\NCF.exe",
    runtimeArgs: [],
    script: 'C:\\Program Files\\NCF\\resources\\app.asar\\build\\integrations\\claude-code.js',
    nodeFile: 'C:\\Users\\Пользователь 漢字\\AppData\\Roaming\\NCF\\Integrations\\node.json',
    platform: 'win32',
    version: '0.12.0',
  });
  const hook = JSON.parse(windows['plugin/hooks/hooks.json']).hooks.PreToolUse[0].hooks[0];
  assert.equal(hook.shell, 'powershell');
  assert.ok(!('args' in hook));
  assert.equal(
    hook.command,
    "$env:ELECTRON_RUN_AS_NODE='1'; & 'C:\\Program Files\\NCF O''Brien\\NCF.exe' 'C:\\Program Files\\NCF\\resources\\app.asar\\build\\integrations\\claude-code.js' '--hook' '--node-file' 'C:\\Users\\Пользователь 漢字\\AppData\\Roaming\\NCF\\Integrations\\node.json'",
  );
  for (const execPath of ['relative/NCF', '/opt/NCF\nrm', '/opt/${CLAUDE_PLUGIN_ROOT}/NCF'])
    assert.throws(() =>
      claudePluginFiles({
        execPath,
        runtimeArgs: [],
        script: '/opt/a.js',
        nodeFile: '/opt/node.json',
        platform: 'linux',
        version: '1',
      }),
    );

  const root = await mkdtemp(path.join(os.tmpdir(), 'interconnect-claude-plugin-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await publishClaudePlugin(root, posix);
  const target = path.join(root, 'plugin', 'hooks', 'hooks.json');
  const before = await stat(target);
  await publishClaudePlugin(root, posix);
  assert.equal((await stat(target)).mtimeMs, before.mtimeMs);
  assert.equal(await readFile(target, 'utf8'), posix['plugin/hooks/hooks.json']);
  if (process.platform !== 'win32') assert.equal(before.mode & 0o777, 0o600);
});

function runHook(nodeFile: string, input: unknown): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', tsx, script, '--hook', '--node-file', nodeFile],
      {
        env: { ...getDefaultEnvironment(), ELECTRON_RUN_AS_NODE: '1' },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.once('error', reject);
    child.once('exit', (code) => resolve({ code: code ?? -1, output }));
    child.stdin.end(typeof input === 'string' ? input : JSON.stringify(input));
  });
}

async function launchHelper(t: test.TestContext, f: ClaudeFixture, session: string) {
  const client = new Client({ name: 'claude-code', version: 'fixture' });
  const wakes: z.infer<typeof channelSchema>['params'][] = [];
  client.setNotificationHandler(channelSchema, async (notification) => {
    wakes.push(notification.params);
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      '--import',
      tsx,
      script,
      '--node-file',
      path.join(f.directory, 'Integrations', 'node.json'),
    ],
    env: {
      ...getDefaultEnvironment(),
      ELECTRON_RUN_AS_NODE: '1',
      CLAUDE_CODE_SESSION_ID: session,
    },
    stderr: 'pipe',
  });
  t.after(() => client.close());
  await client.connect(transport);
  return { client, wakes };
}

test('The real helper and hook processes bind an exact chat, deliver wakes, record receipt only through agent_read and fence /clear', async (t) => {
  const f = await claudeFixture(t);
  const nodeFile = path.join(f.directory, 'Integrations', 'node.json');
  // The node publishes the plugin from its own runtime at startup.
  const published = JSON.parse(
    await readFile(
      path.join(f.service.claudePluginRoot, 'plugin/.claude-plugin/plugin.json'),
      'utf8',
    ),
  );
  assert.equal(published.mcpServers.ncf.args.at(-1), nodeFile);
  const [s1, s2] = [randomUUID(), randomUUID()];
  assert.equal(
    (
      await runHook(nodeFile, {
        hook_event_name: 'SessionStart',
        session_id: s1,
        source: 'startup',
      })
    ).code,
    0,
  );
  const { client, wakes } = await launchHelper(t, f, s1);
  const tools = (await client.listTools()).tools;
  assert.ok(tools.some((tool) => tool.name === 'session_event'));
  const connect = tools.find((tool) => tool.name === 'agent_connect')!;
  assert.ok(!('contextToken' in (connect.inputSchema.properties ?? {})));

  // Claude Code runs PreToolUse with the exact input, then calls the tool on this transport.
  const call = async (name: string, args: Record<string, unknown>) => {
    const hook = await runHook(nodeFile, {
      hook_event_name: 'PreToolUse',
      session_id: s1,
      tool_name: claudeToolPrefix + name,
      tool_input: args,
      tool_use_id: 'toolu_fixture',
    });
    assert.deepEqual(hook, { code: 0, output: '' });
    return client.callTool({ name, arguments: args });
  };
  // A model-invented contextToken is part of the hashed input and then discarded.
  const connected = await call('agent_connect', {
    nickname: 'Боб 漢字',
    contextToken: randomUUID(),
  });
  assert.equal(connected.isError, undefined, JSON.stringify(connected.content));
  const binding = (connected.structuredContent as { binding: { connectionId: string } }).binding;

  const sender = f.service.connect({ nickname: 'Отправитель', client: 'MCP' });
  if (sender.status !== 'connected') throw new Error();
  const sent = await f.service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Боб 漢字',
    text: 'Секретный текст',
  });
  await until(() => wakes.length === 1);
  assert.equal(wakes[0].meta?.agent, 'Боб 漢字');
  assert.ok(!wakes[0].content.includes('Секретный текст'));
  assert.equal(f.service.store.get(sent.id, 'out')!.state, 'ready');

  // Without the PreToolUse record the call is refused before reaching the inbox.
  const unverified = await client.callTool({
    name: 'agent_read',
    arguments: { connectionId: binding.connectionId },
  });
  assert.equal(unverified.isError, true);
  assert.equal(f.service.store.get(sent.id, 'out')!.state, 'ready');
  const read = await call('agent_read', { connectionId: binding.connectionId });
  assert.equal(read.isError, undefined);
  assert.match(JSON.stringify(read.structuredContent), /Секретный текст/);
  assert.equal(f.service.store.get(sent.id, 'out')!.state, 'processed');

  // /clear: command SessionEnd and the mcp_tool session events on this transport.
  await runHook(nodeFile, { hook_event_name: 'SessionEnd', session_id: s1, reason: 'clear' });
  await client.callTool({ name: 'session_event', arguments: { event: 'end', session_id: s1 } });
  await runHook(nodeFile, { hook_event_name: 'SessionStart', session_id: s2, source: 'clear' });
  await client.callTool({ name: 'session_event', arguments: { event: 'start', session_id: s2 } });
  const later = await f.service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Боб 漢字',
    text: 'После clear',
  });
  await until(() => f.service.store.dispatchState(later.id)?.state === 'waiting');
  assert.equal(wakes.length, 1);
});

test('A hook never blocks Claude Code: invalid input or an absent node exits 0 without output', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-claude-hook-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const missing = path.join(directory, 'node.json');
  assert.deepEqual(await runHook(missing, 'not json'), { code: 0, output: '' });
  assert.deepEqual(
    await runHook(missing, { hook_event_name: 'SessionStart', session_id: randomUUID() }),
    { code: 0, output: '' },
  );
  assert.deepEqual(
    await runHook(missing, {
      hook_event_name: 'Stop',
      session_id: randomUUID(),
      stop_hook_active: false,
      last_assistant_message: 'private text is never forwarded',
    }),
    { code: 0, output: '' },
  );
});

test('A live helper reconnects after a node restart and receives the stale offer again without user action', async (t) => {
  const f = await claudeFixture(t);
  const nodeFile = path.join(f.directory, 'Integrations', 'node.json');
  const s1 = randomUUID();
  await runHook(nodeFile, { hook_event_name: 'SessionStart', session_id: s1, source: 'startup' });
  const { client, wakes } = await launchHelper(t, f, s1);
  const args = { nickname: 'Боб' };
  await runHook(nodeFile, {
    hook_event_name: 'PreToolUse',
    session_id: s1,
    tool_name: claudeToolPrefix + 'agent_connect',
    tool_input: args,
  });
  assert.equal(
    (await client.callTool({ name: 'agent_connect', arguments: args })).isError,
    undefined,
  );
  const sender = f.service.connect({ nickname: 'Отправитель', client: 'MCP' });
  if (sender.status !== 'connected') throw new Error();
  await f.service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Боб',
    text: 'Через рестарт',
  });
  await until(() => wakes.length === 1);
  await f.restart();
  await until(() => wakes.length === 2, 15000);
  assert.equal(wakes[1].meta?.agent, 'Боб');
  // The first read after the restart must reach the new node lifecycle (on-site T11 regression).
  const agent = f.service.store.list().find((value) => value.nickname === 'Боб')!;
  const read = { connectionId: agent.binding!.connectionId };
  await runHook(nodeFile, {
    hook_event_name: 'PreToolUse',
    session_id: s1,
    tool_name: claudeToolPrefix + 'agent_read',
    tool_input: read,
  });
  const result = await client.callTool({ name: 'agent_read', arguments: read });
  assert.equal(result.isError, undefined, JSON.stringify(result.content));
  assert.match(JSON.stringify(result.structuredContent), /Через рестарт/);
});

test('A reconnected helper offers its route only after the MCP handshake, so a pending wake is not lost', async (t) => {
  const f = await claudeFixture(t);
  const nodeFile = path.join(f.directory, 'Integrations', 'node.json');
  const s1 = randomUUID();
  await runHook(nodeFile, { hook_event_name: 'SessionStart', session_id: s1, source: 'startup' });
  const first = await launchHelper(t, f, s1);
  const args = { nickname: 'Боб' };
  await runHook(nodeFile, {
    hook_event_name: 'PreToolUse',
    session_id: s1,
    tool_name: claudeToolPrefix + 'agent_connect',
    tool_input: args,
  });
  assert.equal(
    (await first.client.callTool({ name: 'agent_connect', arguments: args })).isError,
    undefined,
  );
  await first.client.close();
  const sender = f.service.connect({ nickname: 'Отправитель', client: 'MCP' });
  if (sender.status !== 'connected') throw new Error();
  const sent = await f.service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Боб',
    text: 'Ждёт reconnect',
  });
  await until(() => f.service.store.dispatchState(sent.id)?.state === 'waiting');
  // On-site T16: /mcp Reconnect spawns a helper while a message is already queued.
  const { startClaudeBridge } = await import('../desktop/integrations/claude-code.js');
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
  const [client, server] = InMemoryTransport.createLinkedPair();
  const received: { method?: string }[] = [];
  client.onmessage = (message) => received.push(message as { method?: string });
  const bridge = await startClaudeBridge(nodeFile, { CLAUDE_CODE_SESSION_ID: s1 }, server);
  t.after(() => bridge.close());
  await client.start();
  await client.send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'claude-code', version: 'fixture' },
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  assert.ok(!received.some((message) => message.method === 'notifications/claude/channel'));
  assert.equal(f.service.store.dispatchState(sent.id)?.state, 'waiting');
  await client.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  await until(
    () => received.some((message) => message.method === 'notifications/claude/channel'),
    10000,
  );
  assert.equal(f.service.store.dispatchState(sent.id)?.state, 'offered');
});

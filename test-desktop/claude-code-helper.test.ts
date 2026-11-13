import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import { claudePluginFiles, publishClaudePlugin } from '../desktop/core/claude-plugin.js';
import { claudeToolPrefix, startClaudeBridge } from '../desktop/integrations/claude-code.js';
import { readNativeLease } from '../desktop/integrations/claude-native-lease.js';
import { until } from './aionui-fixture.js';
import { claudeFixture, FakeHelper, type ClaudeFixture } from './claude-code-fixture.js';

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
  assert.deepEqual(hooks.SessionStart, [{ hooks: [command] }]);
  assert.deepEqual(hooks.SessionEnd, [{ hooks: [command] }]);
  for (const groups of Object.values(hooks) as { hooks: { type: string }[] }[][])
    for (const group of groups)
      assert.ok(group.hooks.every((handler) => handler.type === 'command'));
  // The command SessionStart hook has no matcher, so every source, including clear, is covered.
  assert.ok(!('matcher' in hooks.SessionStart[0]));
  assert.equal(hooks.PreToolUse[0].matcher, 'mcp__plugin_ncf-agent-interconnect_ncf__.*');
  assert.deepEqual(hooks.Stop, [{ hooks: [command] }]);
  assert.equal(claudeToolPrefix, 'mcp__plugin_ncf-agent-interconnect_ncf__');
  const plugin = JSON.parse(posix['plugin/.claude-plugin/plugin.json']);
  assert.deepEqual(plugin.channels, [{ server: 'ncf', displayName: 'NCF Agent Interconnect' }]);
  assert.deepEqual(plugin.mcpServers.ncf.env, { ELECTRON_RUN_AS_NODE: '1' });
  assert.equal(plugin.mcpServers.ncf.command, command.args[1]);
  // No secret is published: the mods read the node descriptor at run time.
  assert.ok(!/[0-9a-f]{64}/.test(JSON.stringify(posix)));
  assert.deepEqual(
    JSON.parse(posix['.claude-plugin/marketplace.json']).plugins.map(
      (entry: { name: string; source: string }) => [entry.name, entry.source],
    ),
    [
      ['ncf-agent-interconnect', './plugin'],
      ['ncf-agent-interconnect-gate', './gate'],
    ],
  );
  // The documented mod order: the main mod runs before the gate it depends on;
  // an absent, disabled or mismatched gate stops the main plugin from loading.
  assert.deepEqual(plugin.dependencies, [
    { name: 'ncf-agent-interconnect-gate', version: '=0.12.0' },
  ]);
  assert.deepEqual(JSON.parse(posix['plugin/hooks/hooks.json']).modules, ['./wake.js']);
  assert.ok(posix['plugin/hooks/incoming.js'].includes("from './incoming-format.js'"));
  assert.ok(posix['plugin/hooks/incoming-format.js'].includes('Use agent_send(connectionId'));
  assert.equal(
    (posix['plugin/hooks/wake.js'].match(/registerIncomingPresentation\(on\);/g) ?? []).length,
    1,
  );
  assert.equal(JSON.parse(posix['gate/.claude-plugin/plugin.json']).version, '0.12.0');
  assert.deepEqual(JSON.parse(posix['gate/hooks/hooks.json']), {
    description: 'NCF wake notice gate.',
    modules: ['./gate.js'],
  });
  // Paths reach the mods as JSON string literals and an argument vector, never a shell line.
  const wake = posix['plugin/hooks/wake.js'];
  assert.ok(
    wake.includes(
      'const streamArgv = ' +
        JSON.stringify([
          "/Applications/NCF O'Brien $HOME.app/Contents/MacOS/NCF",
          '/Applications/NCF.app/Contents/Resources/app.asar/build/integrations/claude-code.js',
          '--wake-stream',
          '--node-file',
          '/Users/Пользователь 漢字/Library/Application Support/NCF/Integrations/node.json',
        ]) +
        ';',
    ),
  );
  assert.ok(!wake.includes('asUser'));
  assert.ok(posix['gate/hooks/gate.js'].includes('const source = "ncf-agent-interconnect";'));

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

function runHook(
  nodeFile: string,
  input: unknown,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', tsx, script, '--hook', '--node-file', nodeFile],
      {
        env: { ...getDefaultEnvironment(), ELECTRON_RUN_AS_NODE: '1' },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    let stdout = '',
      stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.once('error', reject);
    child.once('exit', (code) => resolve({ code: code ?? -1, stdout, stderr }));
    child.stdin.end(typeof input === 'string' ? input : JSON.stringify(input));
  });
}

function assertQuietHook(result: { code: number; stdout: string; stderr: string }): void {
  assert.equal(result.code, 0);
  assert.ok(result.stdout === '', 'The hook must not write unexpected stdout');
  assert.ok(result.stderr === '', 'The hook must not write unexpected stderr');
}

/** Emulates the host applying the fixed hook output without changing permission decisions. */
async function prepareCall(
  nodeFile: string,
  session: string,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const hook = await runHook(nodeFile, {
    hook_event_name: 'PreToolUse',
    session_id: session,
    tool_name: claudeToolPrefix + name,
    tool_input: args,
    tool_use_id: 'toolu_' + randomUUID(),
  });
  assert.equal(hook.code, 0);
  assert.ok(hook.stderr === '', 'The PreToolUse hook must not write stderr');
  let response: Record<string, any>;
  try {
    response = JSON.parse(hook.stdout) as Record<string, any>;
  } catch {
    throw new Error('The native PreToolUse hook did not return a JSON response');
  }
  assert.deepEqual(Object.keys(response), ['hookSpecificOutput']);
  const output = response.hookSpecificOutput;
  assert.equal(output.hookEventName, 'PreToolUse');
  assert.ok(!('permissionDecision' in output));
  assert.ok(!('permissionDecisionReason' in output));
  assert.deepEqual(Object.keys(output).sort(), ['hookEventName', 'updatedInput']);
  const updated = output.updatedInput as Record<string, unknown>;
  assert.ok(typeof updated.contextToken === 'string' && updated.contextToken.length > 0);
  if ('contextToken' in args)
    assert.ok(updated.contextToken !== args.contextToken, 'Model-supplied proof must be replaced');
  const original = { ...args },
    preserved = { ...updated };
  delete original.contextToken;
  delete preserved.contextToken;
  assert.ok(isDeepStrictEqual(preserved, original), 'The hook must preserve ordinary tool input');
  return updated;
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

test('Source helper and command-hook processes require native proofs, reject model lifecycle calls and fence a cleared chat', async (t) => {
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
  assert.ok(!tools.some((tool) => tool.name === 'session_event'));
  for (const tool of tools) assert.ok('contextToken' in (tool.inputSchema.properties ?? {}));

  const forged = await client.callTool({
    name: 'agent_connect',
    arguments: { nickname: 'Боб 漢字', contextToken: randomUUID() },
  });
  assert.equal(forged.isError, true);
  assert.ok(!f.service.store.list().some((agent) => agent.nickname === 'Боб 漢字'));
  // The fixed hook overwrites model input with a fresh node-issued proof.
  const connectArgs = await prepareCall(nodeFile, s1, 'agent_connect', {
    nickname: 'Боб 漢字',
    contextToken: randomUUID(),
  });
  const connected = await client.callTool({ name: 'agent_connect', arguments: connectArgs });
  assert.equal(connected.isError, undefined);
  const binding = (connected.structuredContent as { binding: { connectionId: string } }).binding;

  // A public MCP call has no authority to end this chat or start another one.
  for (const [event, session] of [
    ['end', s1],
    ['start', s2],
  ]) {
    const attempted = await client.callTool({
      name: 'session_event',
      arguments: { event, session_id: session },
    });
    assert.equal(attempted.isError, true);
  }
  assert.equal((await readNativeLease(nodeFile, s1))?.active, true);
  assert.equal(await readNativeLease(nodeFile, s2), null);

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

  // Without a native proof the call is refused before reaching the inbox.
  const unverified = await client.callTool({
    name: 'agent_read',
    arguments: { connectionId: binding.connectionId },
  });
  assert.equal(unverified.isError, true);
  assert.equal(f.service.store.get(sent.id, 'out')!.state, 'ready');
  const readArgs = await prepareCall(nodeFile, s1, 'agent_read', {
    connectionId: binding.connectionId,
  });
  const read = await client.callTool({ name: 'agent_read', arguments: readArgs });
  assert.equal(read.isError, undefined);
  assert.match(JSON.stringify(read.structuredContent), /Секретный текст/);
  // The bridge commits receipt after its write of the complete response frame.
  await until(() => f.service.store.get(sent.id, 'out')!.state === 'processed');
  assert.ok(!JSON.stringify(read).includes('ncf/claude-delivery'));
  const replayed = await client.callTool({ name: 'agent_read', arguments: readArgs });
  assert.equal(replayed.isError, true);

  const beforeClear = await prepareCall(nodeFile, s1, 'agent_read', {
    connectionId: binding.connectionId,
  });
  // /clear revokes the disk lease before HTTP; model calls cannot revive the old helper.
  await runHook(nodeFile, { hook_event_name: 'SessionEnd', session_id: s1, reason: 'clear' });
  await runHook(nodeFile, { hook_event_name: 'SessionStart', session_id: s2, source: 'clear' });
  assert.equal((await readNativeLease(nodeFile, s1))?.active, false);
  assert.equal((await readNativeLease(nodeFile, s2))?.active, true);
  assert.equal(
    (await client.callTool({ name: 'agent_read', arguments: beforeClear })).isError,
    true,
  );
  const later = await f.service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Боб 漢字',
    text: 'После clear',
  });
  await until(() => f.service.store.dispatchState(later.id)?.state === 'waiting');
  assert.equal(wakes.length, 1);

  await f.restart();
  assert.equal(
    (await client.callTool({ name: 'agent_read', arguments: beforeClear })).isError,
    true,
  );
  assert.equal(f.service.store.get(later.id, 'out')!.state, 'ready');
  const fresh = await launchHelper(t, f, s2);
  const freshConnect = await prepareCall(nodeFile, s2, 'agent_connect', {
    nickname: 'Новый Боб 漢字',
  });
  const freshResult = await fresh.client.callTool({
    name: 'agent_connect',
    arguments: freshConnect,
  });
  assert.equal(freshResult.isError, undefined);
  const freshBinding = (freshResult.structuredContent as { binding: { connectionId: string } })
    .binding;
  const currentSender = f.service.connect({ nickname: 'Новый отправитель', client: 'MCP' });
  if (currentSender.status !== 'connected') throw new Error();
  const freshMessage = await f.service.send({
    connectionId: currentSender.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Новый Боб 漢字',
    text: 'Только новому native context',
  });
  await until(() => fresh.wakes.length === 1);
  const freshRead = await prepareCall(nodeFile, s2, 'agent_read', {
    connectionId: freshBinding.connectionId,
  });
  const freshReceipt = await fresh.client.callTool({ name: 'agent_read', arguments: freshRead });
  assert.equal(freshReceipt.isError, undefined);
  await until(() => f.service.store.get(freshMessage.id, 'out')!.state === 'processed');
  assert.equal(f.service.store.get(later.id, 'out')!.state, 'ready');
  assert.equal(wakes.length, 1);
});

for (const invalidation of ['native-end', 'route-replacement'] as const)
  test(`A source helper withholds a completed read result after ${invalidation} in flight`, async (t) => {
    const f = await claudeFixture(t);
    const session = randomUUID();
    assertQuietHook(
      await runHook(f.nodeFile, {
        hook_event_name: 'SessionStart',
        session_id: session,
        source: 'startup',
      }),
    );
    const { client, wakes } = await launchHelper(t, f, session);
    const connect = await prepareCall(f.nodeFile, session, 'agent_connect', {
      nickname: 'Получатель',
    });
    const connected = await client.callTool({ name: 'agent_connect', arguments: connect });
    assert.equal(connected.isError, undefined);
    const binding = (connected.structuredContent as { binding: { connectionId: string } }).binding;
    const oldHelper = f.service.claude.route(session).helper;
    assert.ok(oldHelper);
    const nativeBefore = await readNativeLease(f.nodeFile, session);
    let replacement: FakeHelper | undefined;
    const sender = f.service.connect({ nickname: 'Отправитель', client: 'MCP' });
    if (sender.status !== 'connected') throw new Error();
    const body = 'REVOKED_NATIVE_BODY_' + randomUUID();
    const sent = await f.service.send({
      connectionId: sender.binding.connectionId,
      recipientNode: f.service.settings.value.nodeId,
      recipientNickname: 'Получатель',
      text: body,
    });
    await until(() => wakes.length === 1);

    let reached = false;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => (release = resolve));
    const originalRead = f.service.readClaude;
    f.service.readClaude = async (...args) => {
      const result = await originalRead.apply(f.service, args);
      reached = true;
      await barrier;
      return result;
    };
    try {
      const read = await prepareCall(f.nodeFile, session, 'agent_read', {
        connectionId: binding.connectionId,
      });
      const pending = client.callTool({ name: 'agent_read', arguments: read });
      await until(() => reached);
      if (invalidation === 'native-end') {
        assertQuietHook(
          await runHook(f.nodeFile, {
            hook_event_name: 'SessionEnd',
            session_id: session,
            reason: 'clear',
          }),
        );
      } else {
        f.service.claude.detach(oldHelper);
        replacement = new FakeHelper(f, session);
        await replacement.attach();
        const current = f.service.claude.route(session).helper;
        assert.ok(current && current.id !== oldHelper.id);
        const nativeAfter = await readNativeLease(f.nodeFile, session);
        assert.ok(nativeAfter?.active && nativeAfter.nonce === nativeBefore?.nonce);
      }
      release();
      const result = await pending;
      assert.equal(result.isError, true);
      assert.ok(
        !JSON.stringify(result).includes(body),
        'Revoked native context must not receive the body',
      );
      // The withheld content is never receipted. After native end the helper can
      // still prove it wrote nothing, so the attempt is cancelled and the message
      // stays readable; a replaced helper cannot report any more, so its
      // released attempt stays uncertain and its message stays fenced.
      const inbound = f.service.store.get(sent.id, 'in')!;
      assert.equal(inbound.state, 'ready');
      await until(
        () => f.service.store.claudeFenced(sent.id) === (invalidation === 'route-replacement'),
      );
    } finally {
      release();
      f.service.readClaude = originalRead;
      const cleanup = await Promise.allSettled([client.close(), replacement?.detach()]);
      assert.ok(
        cleanup.every((result) => result.status === 'fulfilled'),
        'Source fixture cleanup failed',
      );
    }
  });

for (const invalidation of ['native-end', 'route-replacement'] as const)
  test(`A source helper does not forward a new tool call after ${invalidation} during its node MCP reconnect`, async (t) => {
    const f = await claudeFixture(t);
    const session = randomUUID();
    assertQuietHook(
      await runHook(f.nodeFile, {
        hook_event_name: 'SessionStart',
        session_id: session,
        source: 'startup',
      }),
    );
    const originalFetch = globalThis.fetch;
    const localMcp = f.url('/mcp').href;
    let failStatus = false,
      holdInitialize = false,
      initializeWaiting = false,
      forwardedPeers = 0,
      failedStatus = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => (release = resolve));
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'claude-code', version: 'fixture' });
    let bridge: Awaited<ReturnType<typeof startClaudeBridge>> | undefined;
    let replacement: FakeHelper | undefined;
    let pending: ReturnType<Client['callTool']> | undefined;
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      if (url === localMcp && method === 'POST') {
        const body =
          typeof init?.body === 'string'
            ? init.body
            : input instanceof Request
              ? await input.clone().text()
              : '';
        let message: { method?: string; params?: { name?: string } } | undefined;
        try {
          message = JSON.parse(body) as typeof message;
        } catch {
          // Only valid fixture JSON-RPC requests participate in the fault barrier.
        }
        if (
          message?.method === 'tools/call' &&
          message.params?.name === 'node_status' &&
          failStatus
        ) {
          failStatus = false;
          failedStatus++;
          throw new Error('Synthetic fixture transport failure');
        }
        if (message?.method === 'initialize' && holdInitialize) {
          holdInitialize = false;
          initializeWaiting = true;
          await barrier;
        }
        if (message?.method === 'tools/call' && message.params?.name === 'node_peers')
          forwardedPeers++;
      }
      return originalFetch(input, init);
    };
    try {
      bridge = await startClaudeBridge(
        f.nodeFile,
        { CLAUDE_CODE_SESSION_ID: session },
        serverTransport,
      );
      await client.connect(clientTransport);
      await until(() => !!f.service.claude.route(session).helper);
      const connect = await prepareCall(f.nodeFile, session, 'agent_connect', {
        nickname: 'Борис',
      });
      assert.equal(
        (await client.callTool({ name: 'agent_connect', arguments: connect })).isError,
        undefined,
      );
      const oldHelper = f.service.claude.route(session).helper;
      assert.ok(oldHelper);
      const nativeBefore = await readNativeLease(f.nodeFile, session);

      // A failed read-only request makes the bridge reconnect its node MCP client.
      failStatus = true;
      const status = await prepareCall(f.nodeFile, session, 'node_status', {});
      assert.equal(
        (await client.callTool({ name: 'node_status', arguments: status })).isError,
        true,
      );
      assert.equal(failedStatus, 1);
      const peers = await prepareCall(f.nodeFile, session, 'node_peers', {});
      holdInitialize = true;
      pending = client.callTool({ name: 'node_peers', arguments: peers });
      await until(() => initializeWaiting);
      if (invalidation === 'native-end') {
        assertQuietHook(
          await runHook(f.nodeFile, {
            hook_event_name: 'SessionEnd',
            session_id: session,
            reason: 'clear',
          }),
        );
      } else {
        f.service.claude.detach(oldHelper);
        replacement = new FakeHelper(f, session);
        await replacement.attach();
        const current = f.service.claude.route(session).helper;
        assert.ok(current && current.id !== oldHelper.id);
        const nativeAfter = await readNativeLease(f.nodeFile, session);
        assert.ok(nativeAfter?.active && nativeAfter.nonce === nativeBefore?.nonce);
      }
      release();
      const result = await pending;
      assert.equal(result.isError, true);
      assert.equal(forwardedPeers, 0);
    } finally {
      release();
      try {
        const cleanup = await Promise.allSettled([
          client.close(),
          bridge?.close(),
          replacement?.detach(),
          pending?.catch(() => {}),
        ]);
        assert.ok(
          cleanup.every((result) => result.status === 'fulfilled'),
          'Source fixture cleanup failed',
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  });

test('Actual node MCP admission rejects an ambiguous helper permit permanently before invoking the read handler', async (t) => {
  const f = await claudeFixture(t);
  const session = randomUUID();
  assertQuietHook(
    await runHook(f.nodeFile, {
      hook_event_name: 'SessionStart',
      session_id: session,
      source: 'startup',
    }),
  );
  const originalFetch = globalThis.fetch;
  const originalRead = f.service.read;
  const localMcp = f.url('/mcp').href;
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'claude-code', version: 'fixture' });
  let bridge: Awaited<ReturnType<typeof startClaudeBridge>> | undefined;
  let twin: FakeHelper | undefined;
  let pending: ReturnType<Client['callTool']> | undefined;
  let holdRead = false,
    readWaiting = false,
    forwardedReads = 0,
    invokedReads = 0;
  let captured: { message: Record<string, any> } | undefined;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => (release = resolve));
  f.service.read = async (...args) => {
    invokedReads++;
    return originalRead.apply(f.service, args);
  };
  globalThis.fetch = async (input, init) => {
    const request = new Request(input instanceof Request ? input.clone() : input, init);
    if (request.url === localMcp && request.method === 'POST') {
      let message: Record<string, any> | undefined;
      try {
        message = (await request.clone().json()) as Record<string, any>;
      } catch {
        // Only valid fixture JSON-RPC requests participate in the admission barrier.
      }
      if (message?.method === 'tools/call' && message.params?.name === 'agent_read') {
        forwardedReads++;
        if (holdRead) {
          holdRead = false;
          captured = { message };
          readWaiting = true;
          await barrier;
        }
      }
    }
    return originalFetch(input, init);
  };
  try {
    bridge = await startClaudeBridge(
      f.nodeFile,
      { CLAUDE_CODE_SESSION_ID: session },
      serverTransport,
    );
    await client.connect(clientTransport);
    await until(() => !!f.service.claude.route(session).helper);
    const connect = await prepareCall(f.nodeFile, session, 'agent_connect', { nickname: 'Борис' });
    const connected = await client.callTool({ name: 'agent_connect', arguments: connect });
    assert.equal(connected.isError, undefined);
    const binding = (connected.structuredContent as { binding: { connectionId: string } }).binding;
    const oldHelper = f.service.claude.route(session).helper;
    assert.ok(oldHelper);
    const read = await prepareCall(f.nodeFile, session, 'agent_read', {
      connectionId: binding.connectionId,
    });
    holdRead = true;
    pending = client.callTool({ name: 'agent_read', arguments: read });
    await until(() => readWaiting);
    // Forward validation already passed; the request has not reached the node handler.
    assert.equal(forwardedReads, 1);
    assert.equal(invokedReads, 0);
    twin = new FakeHelper(f, session);
    await twin.attach();
    await until(() => f.service.claude.route(session).ambiguous);
    release();
    const rejected = await pending;
    assert.equal(rejected.isError, true);
    assert.equal(invokedReads, 0);

    await twin.detach();
    twin = undefined;
    await until(() => f.service.claude.route(session).helper === oldHelper);
    assert.ok(captured, 'The fixture must capture the actual MCP request');
    // The bridge closes its old HTTP client after denial. A new live Claude Code
    // MCP session distinguishes stale-permit rejection from an expired transport.
    const replayClient = await f.mcp();
    assert.ok((await replayClient.listTools()).tools.some((tool) => tool.name === 'agent_read'));
    let replayRejected = false;
    try {
      const reply = await replayClient.callTool({
        name: captured.message.params.name,
        arguments: captured.message.params.arguments,
        _meta: captured.message.params._meta,
      });
      replayRejected = reply.isError === true;
    } catch {
      replayRejected = true;
    }
    assert.ok(replayRejected, 'The rejected permit must not revive after ambiguity ends');
    assert.ok((await replayClient.listTools()).tools.some((tool) => tool.name === 'agent_read'));
    assert.equal(invokedReads, 0);
    assert.equal(forwardedReads, 2);
  } finally {
    release();
    try {
      const cleanup = await Promise.allSettled([
        client.close(),
        bridge?.close(),
        twin?.detach(),
        pending?.catch(() => {}),
      ]);
      assert.ok(
        cleanup.every((result) => result.status === 'fulfilled'),
        'Source fixture cleanup failed',
      );
    } finally {
      f.service.read = originalRead;
      globalThis.fetch = originalFetch;
    }
  }
});

test('An old source helper cannot recapture a resumed session incarnation after a node restart', async (t) => {
  const f = await claudeFixture(t);
  const session = randomUUID();
  assertQuietHook(
    await runHook(f.nodeFile, {
      hook_event_name: 'SessionStart',
      session_id: session,
      source: 'startup',
    }),
  );
  const old = await launchHelper(t, f, session);
  const connect = await prepareCall(f.nodeFile, session, 'agent_connect', { nickname: 'Борис' });
  const connected = await old.client.callTool({ name: 'agent_connect', arguments: connect });
  assert.equal(connected.isError, undefined);
  const binding = (connected.structuredContent as { binding: { connectionId: string } }).binding;
  const staleRead = await prepareCall(f.nodeFile, session, 'agent_read', {
    connectionId: binding.connectionId,
  });
  const initial = await readNativeLease(f.nodeFile, session);
  assertQuietHook(
    await runHook(f.nodeFile, {
      hook_event_name: 'SessionEnd',
      session_id: session,
      reason: 'resume',
    }),
  );
  assertQuietHook(
    await runHook(f.nodeFile, {
      hook_event_name: 'SessionStart',
      session_id: session,
      source: 'resume',
    }),
  );
  const resumed = await readNativeLease(f.nodeFile, session);
  assert.equal(resumed?.active, true);
  assert.ok(resumed?.nonce !== initial?.nonce, 'Resume must create a new native incarnation');
  await f.restart();
  const sender = f.service.connect({ nickname: 'Отправитель', client: 'MCP' });
  if (sender.status !== 'connected') throw new Error();
  const queued = await f.service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Борис',
    text: 'Только новому incarnation',
  });
  await until(() => f.service.store.dispatchState(queued.id)?.state === 'waiting');
  assert.equal(
    (await old.client.callTool({ name: 'agent_read', arguments: staleRead })).isError,
    true,
  );
  assert.equal(old.wakes.length, 0);
  assert.equal(f.service.store.get(queued.id, 'out')!.state, 'ready');

  const fresh = await launchHelper(t, f, session);
  await until(() => fresh.wakes.length === 1);
  const freshRead = await prepareCall(f.nodeFile, session, 'agent_read', {
    connectionId: binding.connectionId,
  });
  const received = await fresh.client.callTool({ name: 'agent_read', arguments: freshRead });
  assert.equal(received.isError, undefined);
  await until(() => f.service.store.get(queued.id, 'out')!.state === 'processed');
  assert.equal(old.wakes.length, 0);
});

test('A hook never blocks Claude Code: invalid input or an absent node exits 0 without output', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-claude-hook-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const missing = path.join(directory, 'node.json');
  assertQuietHook(await runHook(missing, 'not json'));
  assertQuietHook(
    await runHook(missing, { hook_event_name: 'SessionStart', session_id: randomUUID() }),
  );
  assertQuietHook(
    await runHook(missing, {
      hook_event_name: 'Stop',
      session_id: randomUUID(),
      stop_hook_active: false,
      last_assistant_message: 'private text is never forwarded',
    }),
  );
  assertQuietHook(
    await runHook(missing, {
      hook_event_name: 'PreToolUse',
      session_id: randomUUID(),
      tool_name: claudeToolPrefix + 'agent_read',
      tool_input: { connectionId: randomUUID(), contextToken: randomUUID() },
    }),
  );
});

test('A lifecycle hook persists revocation even when its node HTTP request cannot be delivered', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-claude-hook-offline-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const nodeFile = path.join(directory, 'Integrations', 'node.json');
  await mkdir(path.dirname(nodeFile));
  await writeFile(
    nodeFile,
    JSON.stringify({ url: 'http://127.0.0.1:1/mcp', token: 'a'.repeat(64) }),
    { mode: 0o600 },
  );
  const session = randomUUID();
  assertQuietHook(
    await runHook(nodeFile, {
      hook_event_name: 'SessionStart',
      session_id: session,
      source: 'startup',
    }),
  );
  const initial = await readNativeLease(nodeFile, session);
  assert.equal(initial?.active, true);
  assertQuietHook(
    await runHook(nodeFile, {
      hook_event_name: 'SessionEnd',
      session_id: session,
      reason: 'clear',
    }),
  );
  const revoked = await readNativeLease(nodeFile, session);
  assert.equal(revoked?.active, false);
  assert.ok(revoked?.nonce !== initial?.nonce, 'Revocation must replace the native incarnation');
});

test('A source helper reconnects after a node restart and receives the stale offer again without user action', async (t) => {
  const f = await claudeFixture(t);
  const nodeFile = path.join(f.directory, 'Integrations', 'node.json');
  const s1 = randomUUID();
  await runHook(nodeFile, { hook_event_name: 'SessionStart', session_id: s1, source: 'startup' });
  const { client, wakes } = await launchHelper(t, f, s1);
  const args = await prepareCall(nodeFile, s1, 'agent_connect', { nickname: 'Боб' });
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
  const read = await prepareCall(nodeFile, s1, 'agent_read', {
    connectionId: agent.binding!.connectionId,
  });
  const result = await client.callTool({ name: 'agent_read', arguments: read });
  assert.equal(result.isError, undefined);
  assert.match(JSON.stringify(result.structuredContent), /Через рестарт/);
});

test('A source helper offers its route only after the synthetic MCP client initializes', async (t) => {
  const f = await claudeFixture(t);
  const nodeFile = path.join(f.directory, 'Integrations', 'node.json');
  const s1 = randomUUID();
  await runHook(nodeFile, { hook_event_name: 'SessionStart', session_id: s1, source: 'startup' });
  const first = await launchHelper(t, f, s1);
  const args = await prepareCall(nodeFile, s1, 'agent_connect', { nickname: 'Боб' });
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CursorHookAdapter, type EventInput } from '../desktop/core/adapters.js';
import { cursorIntegration } from '../desktop/core/cursor-integration.js';
import { NodeService } from '../desktop/core/service.js';
import { runCursorHook } from '../desktop/integrations/cursor-hook.js';
import type { ConnectResult } from '../desktop/core/agent-store.js';

const conversationId = '11111111-2222-4333-8444-555555555555';

async function until(check: () => boolean): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Cursor delivery timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function event(isCurrent: () => boolean = () => true): EventInput {
  return {
    nickname: 'Получатель',
    messageId: randomUUID(),
    replyRef: 'r3',
    binding: {
      connectionId: randomUUID(),
      client: 'Cursor',
      chatId: conversationId,
      adapterId: randomUUID(),
      generation: 1,
    },
    message: {
      fromNode: randomUUID(),
      fromNickname: 'Автор',
      text: 'Проверка Cursor',
      files: [],
    },
    isCurrent,
  };
}

test('Cursor plugin commands use the installed Electron runtime on macOS and Windows', () => {
  const windows = cursorIntegration({
    executable: 'C:\\Program Files\\NCF Agent Interconnect\\NCF Agent Interconnect.exe',
    bridge:
      'C:\\Program Files\\NCF Agent Interconnect\\resources\\app.asar\\build\\integrations\\cursor.js',
    hook: "C:\\Users\\Owner's PC\\cursor-hook.js",
    nodeFile: 'C:\\Users\\Owner\\NCF\\node.json',
    platform: 'win32',
  });
  const windowsHooks = JSON.parse(
    windows.managedFiles!.find((file) => file.id === 'cursor-plugin-hooks')!.content,
  );
  assert.match(windowsHooks.hooks.stop[0].command, /^& \{ \$env:ELECTRON_RUN_AS_NODE='1'; /);
  assert.match(windowsHooks.hooks.stop[0].command, /\$input \| & /);
  assert.match(
    windowsHooks.hooks.stop[0].command,
    /\| ForEach-Object \{ \$_ \}; exit \$LASTEXITCODE \}$/,
  );
  assert.match(windowsHooks.hooks.stop[0].command, /Owner''s PC/);
  assert.equal(windowsHooks.hooks.stop[0].loop_limit, null);
  const windowsMcp = JSON.parse(windows.configuration);
  assert.equal(windowsMcp.mcpServers.ncf_agent_interconnect.env.ELECTRON_RUN_AS_NODE, '1');

  const mac = cursorIntegration({
    executable: '/Applications/NCF Agent Interconnect.app/Contents/MacOS/NCF Agent Interconnect',
    bridge:
      '/Applications/NCF Agent Interconnect.app/Contents/Resources/app.asar/build/integrations/cursor.js',
    hook: "/Users/owner's Mac/cursor-hook.js",
    nodeFile: '/Users/owner/Library/Application Support/NCF/Integrations/node.json',
    platform: 'darwin',
  });
  const macHooks = JSON.parse(
    mac.managedFiles!.find((file) => file.id === 'cursor-plugin-hooks')!.content,
  );
  assert.match(macHooks.hooks.beforeSubmitPrompt[0].command, /^ELECTRON_RUN_AS_NODE=1 /);
  assert.match(macHooks.hooks.beforeSubmitPrompt[0].command, /owner'\\''s Mac/);
});

test(
  'Cursor Windows hook command preserves UTF-8 JSON, stdout and exit code through the host pipeline',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-cursor-pipeline-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const unicodeDirectory = path.join(directory, "путь 漢字 owner's");
    await mkdir(unicodeDirectory);
    const hook = path.join(unicodeDirectory, "owner's hook.cjs");
    const nodeFile = path.join(unicodeDirectory, "node's descriptor.json");
    const inputFile = path.join(unicodeDirectory, "hook input's 漢字.json");
    await writeFile(
      hook,
      [
        "process.stdin.setEncoding('utf8');",
        "let input = '';",
        "process.stdin.on('data', (chunk) => { input += chunk; });",
        "process.stdin.on('end', () => {",
        '  process.stdout.write(JSON.stringify({ input, runAsNode: process.env.ELECTRON_RUN_AS_NODE, event: process.argv.at(-1) }));',
        '  process.exit(Number(process.env.NCF_CURSOR_TEST_EXIT));',
        '});',
      ].join('\n'),
    );
    const setup = cursorIntegration({
      executable: process.execPath,
      bridge: path.join(directory, 'cursor.js'),
      hook,
      nodeFile,
      platform: 'win32',
    });
    const hooks = JSON.parse(
      setup.managedFiles!.find((file) => file.id === 'cursor-plugin-hooks')!.content,
    );
    const command = hooks.hooks.stop[0].command as string;
    const payload = '{"text":"Unicode Привет 漢字"}';
    await writeFile(inputFile, payload, 'utf8');
    const inputLiteral = "'" + inputFile.replaceAll("'", "''") + "'";
    const vendorCommand = `Get-Content -LiteralPath ${inputLiteral} -Raw -Encoding UTF8 | & { $input | ${command} }`;
    const invoke = (exitCode: number) =>
      new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(
          'powershell.exe',
          ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', vendorCommand],
          {
            env: { ...process.env, NCF_CURSOR_TEST_EXIT: String(exitCode) },
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
          },
        );
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
          stdout += chunk;
        });
        child.stderr.on('data', (chunk) => {
          stderr += chunk;
        });
        child.on('error', reject);
        child.on('close', (code) => resolve({ code, stdout, stderr }));
      });
    for (const exitCode of [0, 23]) {
      const result = await invoke(exitCode);
      assert.equal(result.code, exitCode);
      assert.equal(result.stderr, '');
      const output = JSON.parse(result.stdout.trim()) as {
        input: string;
        runAsNode: string;
        event: string;
      };
      assert.deepEqual(JSON.parse(output.input), JSON.parse(payload));
      assert.equal(output.runAsNode, '1');
      assert.equal(output.event, 'stop');
    }
  },
);

test('Cursor hook adapter admits only the matching exact-chat follow-up confirmation', async () => {
  let idle = 0;
  const adapter = new CursorHookAdapter(
    {
      id: randomUUID(),
      label: 'Cursor',
      kind: 'cursor-hook',
      sessionId: conversationId,
    },
    () => {},
    () => {
      idle++;
    },
  );
  await adapter.start();
  assert.equal(adapter.status().state, 'error');
  assert.equal((await adapter.deliver(event())).state, 'waiting');
  const abort = new AbortController();
  const wait = adapter.wait('completed', abort.signal);
  const delivery = adapter.deliver(event());
  const output = await wait;
  assert.match(output.followup_message!, /Incoming NCF Agent Interconnect/);
  const admissionId = output.followup_message!.match(/NCF-Admission-ID: ([0-9a-f-]+)/)![1];
  adapter.acknowledge(randomUUID());
  let settled = false;
  void delivery.then(() => {
    settled = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(settled, false);
  adapter.acknowledge(admissionId);
  assert.equal((await delivery).state, 'admitted');
  assert.ok(idle >= 2);
  await adapter.stop();
});

test('Cursor admission is revoked when the binding moves before native submission', async () => {
  let current = true;
  const adapter = new CursorHookAdapter(
    {
      id: randomUUID(),
      label: 'Cursor',
      kind: 'cursor-hook',
      sessionId: conversationId,
    },
    () => {},
    () => {},
  );
  await adapter.start();
  const wait = adapter.wait('completed', new AbortController().signal);
  const delivery = adapter.deliver(event(() => current));
  const output = await wait;
  const admissionId = output.followup_message!.match(/NCF-Admission-ID: ([0-9a-f-]+)/)![1];
  current = false;
  adapter.acknowledge(admissionId);
  assert.equal((await delivery).state, 'revoked');
  await adapter.stop();
});

test('Cursor plugin context is one-use and arbitrary owner prompts restore exact reactive delivery', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-cursor-adapter-'));
  const service = new NodeService(directory);
  await service.open();
  const nodeFile = path.join(directory, 'Integrations', 'node.json');
  const client = new Client({ name: 'Cursor', version: '1' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [
        '--import',
        'tsx',
        path.join(process.cwd(), 'desktop/integrations/cursor.ts'),
        '--node-file',
        nodeFile,
      ],
    }),
  );
  let clientClosed = false;
  t.after(async () => {
    if (!clientClosed) await client.close().catch(() => {});
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  const tools = await client.listTools();
  const connectTool = tools.tools.find((tool) => tool.name === 'agent_connect');
  assert.ok(connectTool);
  assert.equal(Object.hasOwn(connectTool.inputSchema.properties ?? {}, 'contextToken'), false);
  const setup = service.clientInstructions('cursor');
  const configuration = JSON.parse(setup.configuration);
  assert.equal(configuration.mcpServers.ncf_agent_interconnect.command, process.execPath);
  assert.equal(configuration.mcpServers.ncf_agent_interconnect.env.ELECTRON_RUN_AS_NODE, '1');
  assert.equal(setup.managedFiles?.length, 2);
  assert.equal(
    JSON.parse(setup.managedFiles!.find((file) => file.id === 'cursor-plugin-hooks')!.content).hooks
      .stop[0].loop_limit,
    null,
  );
  const connectHook = await runCursorHook(nodeFile, 'preToolUse', {
    conversation_id: conversationId,
    workspace_roots: [path.join(directory, 'workspace')],
    tool_name: 'MCP:ncf_agent_interconnect_agent_connect',
    tool_input: { nickname: 'Курсор' },
  });
  assert.equal(connectHook.permission, 'allow');
  const argumentsWithContext = connectHook.updated_input as Record<string, unknown>;
  assert.match(String(argumentsWithContext.contextToken), /^[0-9a-f-]{36}$/);
  const connected = await client.callTool({
    name: 'agent_connect',
    arguments: argumentsWithContext,
  });
  assert.equal(connected.isError, undefined);
  const body = connected.structuredContent as ConnectResult;
  assert.equal(body.status, 'connected');
  if (body.status !== 'connected') throw new Error();
  assert.equal(body.binding.chatId, conversationId);
  assert.equal(body.binding.client, 'Cursor');
  assert.equal(
    service.settings.value.adapters.find((profile) => profile.id === body.binding.adapterId)?.kind,
    'cursor-hook',
  );
  const reused = await client.callTool({
    name: 'agent_connect',
    arguments: argumentsWithContext,
  });
  assert.equal(reused.isError, true);

  const sender = service.connect({ nickname: 'Автор', client: 'MCP' });
  if (sender.status !== 'connected') throw new Error();
  const firstWait = runCursorHook(nodeFile, 'stop', {
    conversation_id: conversationId,
    status: 'completed',
  });
  const first = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Курсор',
    text: 'Первое сообщение',
  });
  const firstPrompt = await firstWait;
  assert.match(String(firstPrompt.followup_message), /Первое сообщение/);
  await runCursorHook(nodeFile, 'beforeSubmitPrompt', {
    conversation_id: randomUUID(),
    prompt: firstPrompt.followup_message,
  });
  assert.notEqual(service.store.get(first.id, 'in')?.state, 'processed');
  await runCursorHook(nodeFile, 'beforeSubmitPrompt', {
    conversation_id: conversationId,
    prompt: firstPrompt.followup_message,
  });
  await until(() => service.store.get(first.id, 'in')?.state === 'processed');

  await client.close();
  clientClosed = true;
  await service.stop();
  await service.start();
  assert.equal(service.adapters.get(body.binding.adapterId).status().state, 'error');
  const second = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Курсор',
    text: 'После перезапуска',
  });
  await until(() => service.store.dispatchState(second.id)?.state === 'waiting');
  await runCursorHook(nodeFile, 'beforeSubmitPrompt', {
    conversation_id: conversationId,
    prompt: 'Продолжи текущую задачу.',
  });
  const secondWait = runCursorHook(nodeFile, 'stop', {
    conversation_id: conversationId,
    status: 'completed',
  });
  const secondPrompt = await secondWait;
  assert.match(String(secondPrompt.followup_message), /После перезапуска/);
  await runCursorHook(nodeFile, 'beforeSubmitPrompt', {
    conversation_id: conversationId,
    prompt: secondPrompt.followup_message,
  });
  await until(() => service.store.get(second.id, 'in')?.state === 'processed');
  assert.equal(service.store.assertOwner(body.binding.connectionId).binding.chatId, conversationId);
});

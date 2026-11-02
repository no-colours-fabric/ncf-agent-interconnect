import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import { aionRuntimeContext } from '../desktop/integrations/aionui.js';
import { aionFixture, until } from './aionui-fixture.js';
import { ownStdio, temporaryNode } from './aionui-lifecycle.js';

test('bundled stdio bridge injects current context, hides it from the model and forwards real MCP exchange', async (t) => {
  const f = await aionFixture(t);
  const service = await temporaryNode(f.scope, 'ncf-aionui-bridge-isolated-');
  const directory = service.directory;
  const client = new Client({ name: 'fixture-AionUi-backend', version: 'fixture' });
  const helper = fileURLToPath(new URL('../desktop/integrations/aionui.ts', import.meta.url));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      '--import',
      'tsx',
      helper,
      '--node-file',
      path.join(directory, 'Integrations', 'node.json'),
    ],
    env: {
      ...getDefaultEnvironment(),
      AIONUI_BASE_URL: f.coreUrl,
      AIONUI_USER_ID: f.state.userId,
      AIONUI_CONVERSATION_ID: 'fixture-chat-b',
      AIONUI_RUNTIME_TOKEN: f.runtimeToken,
    },
    stderr: 'pipe',
  });
  const childExited = ownStdio(f.scope, client, transport);
  let stderr = '';
  f.scope.file({
    label: 'stdio credential output assertions',
    close: async () => {
      assert.ok(!stderr.includes(f.runtimeToken));
      assert.ok(!stderr.includes(f.session));
      assert.ok(childExited(), 'The owned stdio helper must exit before removing test data');
    },
  });
  await service.userCall('aionUiPair', { url: f.url, code: f.code });
  await f.scope.start('stdio MCP connect', () => client.connect(transport));
  transport.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  assert.ok(client.getInstructions()?.includes('Reply-To'));
  assert.ok(client.getInstructions()?.includes('Do not poll agents'));
  const tools = await client.listTools();
  const connect = tools.tools.find((tool) => tool.name === 'agent_connect')!;
  assert.ok(!('contextToken' in connect.inputSchema.properties!));
  const result = await client.callTool({
    name: 'agent_connect',
    arguments: { nickname: 'Мост 漢字', contextToken: '11111111-1111-4111-8111-111111111111' },
  });
  assert.ok(!result.isError);
  const connected = result.structuredContent as {
    binding: { chatId: string; connectionId: string };
    delivery: { automatic: boolean };
  };
  assert.equal(connected.binding.chatId, 'fixture-chat-b');
  assert.equal(connected.delivery.automatic, true);
  const sender = service.connect({ nickname: 'Source', client: 'fixture' });
  assert.equal(sender.status, 'connected');
  if (sender.status !== 'connected') return;
  const sent = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Мост 漢字',
    text: 'native bridge fixture',
  });
  await until(() => service.store.dispatchState(sent.id)?.state === 'admitted');
  assert.equal(f.posts[0].chat, 'fixture-chat-b');
  const history = await client.callTool({
    name: 'agent_history',
    arguments: { connectionId: connected.binding.connectionId },
  });
  assert.ok(!history.isError);
  assert.match(JSON.stringify(history), /native bridge fixture/);
  // A node restart invalidates its HTTP session; a failed send is not replayed.
  await service.stop();
  await service.start();
  const status = await client.callTool({ name: 'node_status', arguments: {} });
  if (status.isError) {
    const next = await client.callTool({ name: 'node_status', arguments: {} });
    assert.ok(!next.isError);
  } else assert.ok(status.structuredContent);
});

test('bridge never substitutes missing host context with a guessed or recent chat', () => {
  assert.throws(() => aionRuntimeContext({}), /requires the current AionUi agent runtime/);
  assert.throws(
    () =>
      aionRuntimeContext({
        AIONUI_USER_ID: 'fixture-user',
        AIONUI_CONVERSATION_ID: 'fixture-chat',
        AIONUI_BASE_URL: 'http://127.0.0.1:1',
      }),
    /requires the current AionUi agent runtime/,
  );
});

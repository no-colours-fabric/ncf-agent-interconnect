import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { LATEST_PROTOCOL_VERSION, type JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { claudeChannelServer, wakeNotification } from '../desktop/integrations/claude-code.js';

async function initialize(protocolVersion: string) {
  const server = claudeChannelServer('Remote instructions.');
  const [client, transport] = InMemoryTransport.createLinkedPair();
  const received: JSONRPCMessage[] = [];
  client.onmessage = (message) => received.push(message);
  await server.connect(transport);
  await client.start();
  await client.send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion,
      capabilities: {},
      clientInfo: { name: 'claude-code', version: 'fixture' },
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  await server.close();
  const response = received.find((message) => 'id' in message && message.id === 1) as unknown as {
    result: {
      protocolVersion: string;
      capabilities: Record<string, unknown> & { experimental?: Record<string, unknown> };
      instructions?: string;
    };
  };
  return response.result;
}

test('A client offering 2026-07-28 negotiates the pinned SDK revision with the channel capability', async () => {
  assert.equal(LATEST_PROTOCOL_VERSION, '2025-11-25');
  const result = await initialize('2026-07-28');
  assert.equal(result.protocolVersion, '2025-11-25');
  assert.notEqual(result.protocolVersion, '2026-07-28');
  assert.deepEqual(result.capabilities.experimental, { 'claude/channel': {} });
  assert.ok(!('claude/channel/permission' in result.capabilities.experimental!));
  assert.deepEqual(result.capabilities.tools, {});
  assert.match(result.instructions!, /agent_read/);
  assert.match(result.instructions!, /Remote instructions\./);
  // An already supported older revision is kept unchanged.
  assert.equal((await initialize('2025-06-18')).protocolVersion, '2025-06-18');
});

test('A wake names the agent with identifier-only meta keys and no message content', () => {
  const wake = wakeNotification('Боб "漢字"');
  assert.equal(wake.method, 'notifications/claude/channel');
  assert.deepEqual(Object.keys(wake.params.meta), ['agent']);
  for (const key of Object.keys(wake.params.meta)) assert.match(key, /^[A-Za-z0-9_]+$/);
  assert.equal(wake.params.meta.agent, 'Боб "漢字"');
  assert.match(wake.params.content, /agent_read/);
  assert.match(wake.params.content, /no message content/);
});

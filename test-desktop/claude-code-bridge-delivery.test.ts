import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { startClaudeBridge } from '../desktop/integrations/claude-code.js';
import { claudeFixture } from './claude-code-fixture.js';
import { until } from './aionui-fixture.js';

const barrier = () => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => (release = resolve));
  return { promise, release };
};

async function fixture(
  t: test.TestContext,
  afterWrite?: (message: JSONRPCMessage) => Promise<void>,
) {
  const f = await claudeFixture(t);
  const session = randomUUID();
  await f.hook('SessionStart', session, { source: 'startup' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const actualSend = serverTransport.send.bind(serverTransport);
  serverTransport.send = async (message, options) => {
    await actualSend(message, options);
    await afterWrite?.(message);
  };
  const bridge = await startClaudeBridge(
    f.nodeFile,
    { CLAUDE_CODE_SESSION_ID: session },
    serverTransport,
  );
  const client = new Client({ name: 'claude-code', version: 'fixture' });
  t.after(async () => {
    await client.close();
    await bridge.close();
  });
  await client.connect(clientTransport);
  await until(() => !!f.service.claude.route(session).helper);
  const args = { nickname: 'Отмена 漢字' };
  const contextToken = await f.preTool(session, 'agent_connect', args);
  const connected = await client.callTool({
    name: 'agent_connect',
    arguments: { ...args, contextToken },
  });
  assert.ok(!connected.isError);
  const connectionId = String((connected.structuredContent as any).binding.connectionId);
  const sender = f.service.connect({ nickname: 'Sender', client: 'MCP' });
  assert.equal(sender.status, 'connected');
  if (sender.status !== 'connected') throw new Error('sender');
  const sent = await f.service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: args.nickname,
    text: 'CANCELLED-CONTENT',
  });
  return { f, session, client, clientTransport, serverTransport, connectionId, sent };
}

test('Actual SDK cancellation and request-id reuse cannot commit an unwritten read response', async (t) => {
  const { f, session, client, clientTransport, connectionId, sent } = await fixture(t);
  const reached = barrier(),
    resume = barrier();
  const original = f.service.readClaude.bind(f.service);
  f.service.readClaude = async (...args) => {
    const result = await original(...args);
    reached.release();
    await resume.promise;
    return result;
  };
  t.after(() => resume.release());
  let readId: string | number | undefined;
  const outbound = clientTransport.send.bind(clientTransport);
  clientTransport.send = async (message, options) => {
    if (
      'method' in message &&
      message.method === 'tools/call' &&
      'id' in message &&
      (message.params as any)?.name === 'agent_read'
    )
      readId = message.id;
    return outbound(message, options);
  };
  const contextToken = await f.preTool(session, 'agent_read', { connectionId });
  const cancel = new AbortController();
  const reading = client.callTool(
    { name: 'agent_read', arguments: { connectionId, contextToken } },
    undefined,
    { signal: cancel.signal },
  );
  const rejected = assert.rejects(reading);
  await reached.promise;
  cancel.abort();
  await rejected;
  resume.release();
  // Let the cancelled handler complete; the SDK must omit its response.
  const idle = barrier();
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const result = await fetchBefore(input, init);
    if (
      String(input).endsWith('/integrations/claude/call/validate') &&
      String(init?.body).includes('return')
    )
      setImmediate(idle.release);
    return result;
  };
  t.after(() => {
    globalThis.fetch = fetchBefore;
  });
  await idle.promise;
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.notEqual(readId, undefined);
  const frames: JSONRPCMessage[] = [];
  const received = clientTransport.onmessage;
  clientTransport.onmessage = (message, extra) => {
    frames.push(message);
    received?.(message, extra);
  };
  const proof = await f.preTool(session, 'node_status', {});
  await clientTransport.send({
    jsonrpc: '2.0',
    id: readId!,
    method: 'tools/call',
    params: { name: 'node_status', arguments: { contextToken: proof } },
  });
  await until(() => frames.some((message) => 'id' in message && message.id === readId));
  await until(() => !f.service.store.claudeFenced(sent.id));
  assert.equal(
    f.service.store.get(sent.id, 'in')?.state,
    'ready',
    'An unrelated response must not receipt cancelled content',
  );
  assert.equal(
    f.service.store.claudeFenced(sent.id),
    false,
    'A definitely unwritten cancelled response must release its reservation',
  );
});

test('A native revocation before the final delivery validation releases no content frame', async (t) => {
  let bodyFrames = 0;
  const { f, session, client, connectionId, sent } = await fixture(t, async (message) => {
    if ('result' in message && JSON.stringify(message.result).includes('CANCELLED-CONTENT'))
      bodyFrames++;
  });
  const reached = barrier(),
    resume = barrier();
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (
      String(input).endsWith('/integrations/claude/delivery') &&
      JSON.parse(String(init?.body)).phase === 'validate'
    ) {
      reached.release();
      await resume.promise;
    }
    return fetchBefore(input, init);
  };
  t.after(() => {
    resume.release();
    globalThis.fetch = fetchBefore;
  });
  const contextToken = await f.preTool(session, 'agent_read', { connectionId });
  const controller = new AbortController();
  const pending = client.callTool(
    { name: 'agent_read', arguments: { connectionId, contextToken } },
    undefined,
    { signal: controller.signal },
  );
  const rejected = assert.rejects(pending);
  await reached.promise;
  await f.hook('SessionEnd', session, { reason: 'clear' });
  resume.release();
  await until(() => !f.service.store.claudeFenced(sent.id));
  controller.abort();
  await rejected;
  assert.equal(bodyFrames, 0);
  assert.equal(f.service.store.get(sent.id, 'in')?.state, 'ready');
});

test('Revocation during a complete-frame callback leaves delivery uncertain rather than receipted', async (t) => {
  const reached = barrier(),
    resume = barrier();
  const { f, session, client, connectionId, sent } = await fixture(t, async (message) => {
    if ('result' in message && JSON.stringify(message.result).includes('CANCELLED-CONTENT')) {
      reached.release();
      await resume.promise;
    }
  });
  t.after(() => resume.release());
  const contextToken = await f.preTool(session, 'agent_read', { connectionId });
  const pending = client.callTool({
    name: 'agent_read',
    arguments: { connectionId, contextToken },
  });
  await reached.promise;
  await f.hook('SessionEnd', session, { reason: 'clear' });
  resume.release();
  const received = await pending;
  assert.ok(
    JSON.stringify(received).includes('CANCELLED-CONTENT'),
    'The completed write may already have reached the exact transport',
  );
  await until(() => /uncertain/i.test(f.service.store.get(sent.id, 'in')?.error ?? ''));
  assert.equal(f.service.store.get(sent.id, 'in')?.state, 'ready');
  assert.equal(f.service.store.claudeFenced(sent.id), true);
});

test('An unchanged exact request commits only its matching complete response frame', async (t) => {
  const { f, session, client, connectionId, sent } = await fixture(t);
  const contextToken = await f.preTool(session, 'agent_read', { connectionId });
  const response = await client.callTool({
    name: 'agent_read',
    arguments: { connectionId, contextToken },
  });
  assert.ok(!response.isError);
  assert.ok(JSON.stringify(response).includes('CANCELLED-CONTENT'));
  await until(() => f.service.store.get(sent.id, 'in')?.state === 'processed');
  assert.equal(f.service.store.claudeFenced(sent.id), false);
});

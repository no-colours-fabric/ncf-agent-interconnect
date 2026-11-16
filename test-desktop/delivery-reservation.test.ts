import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import net from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { NodeService } from '../desktop/core/service.js';
import { SettingsFile } from '../desktop/core/settings.js';
import {
  agentMessageText,
  CursorHookAdapter,
  OpenCodeAdapter,
  type EventInput,
  type Admission,
} from '../desktop/core/adapters.js';
import { AionUiAdapter } from '../desktop/core/aionui-adapter.js';
import type { AionUiSessions } from '../desktop/core/aionui-sessions.js';
import { codexExchange } from '../desktop/core/codex-adapter.js';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function fixture(t: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-reservation-'));
  const settings = new SettingsFile(directory);
  await settings.load();
  settings.value.peerPort = 0;
  settings.value.mcpPort = 0;
  await settings.save();
  const service = new NodeService(directory);
  await service.open();
  const client = new Client({ name: 'Reservation fixture', version: '1' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
      requestInit: { headers: { authorization: 'Bearer ' + service.settings.value.localToken } },
    }),
  );
  const cleanup: (() => void)[] = [];
  t.after(async () => {
    for (const done of cleanup) done();
    await client.close();
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  const send = async () => {
    const sender = service.connect({ nickname: 'Sender', client: 'Fixture' });
    if (sender.status !== 'connected') throw new Error('Expected sender');
    return service.send({
      connectionId: sender.binding.connectionId,
      recipientNode: service.settings.value.nodeId,
      recipientNickname: 'Receiver',
      text: 'One content path 漢字',
    });
  };
  return { service, client, send, cleanup };
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
async function until(check: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Isolated reservation condition timed out');
    await tick();
  }
}
async function nativeFixture(
  t: test.TestContext,
  action: (input: EventInput) => Promise<Admission>,
  gated = true,
  initiallyReady = true,
) {
  const f = await fixture(t),
    id = randomUUID();
  await f.service.installAdapter({ id, kind: 'manual', label: 'Private native fixture' });
  let ready = initiallyReady,
    calls = 0;
  Object.assign(f.service.adapters.get(id), {
    contentGate: gated,
    status: () => ({
      id,
      kind: 'manual',
      label: 'Fixture',
      state: ready ? 'ready' : 'checking',
      error: null,
      capabilities: {
        wakeIdle: ready,
        exactSession: true,
        receiveActive: false,
        nativeDisplay: true,
      },
    }),
    deliver: async (input: EventInput) => {
      if (input.systemEvent) return { state: 'admitted' };
      calls++;
      return action(input);
    },
  });
  const receiver = f.service.connect({
    nickname: 'Receiver',
    client: 'Fixture',
    adapterId: id,
    chatId: 'exact-session',
  });
  if (receiver.status !== 'connected') throw new Error('Expected native fixture');
  return {
    ...f,
    connectionId: receiver.binding.connectionId,
    calls: () => calls,
    ready() {
      ready = true;
      f.service.adapters.emit('idle');
    },
  };
}

test('MCP handler completion is not receipt before its actual response handoff', async (t) => {
  const f = await fixture(t);
  const receiver = f.service.connect({ nickname: 'Receiver', client: 'Fixture' });
  if (receiver.status !== 'connected') throw new Error('Expected receiver');
  const message = await f.send();
  const prepared = deferred();
  const release = deferred();
  f.cleanup.push(() => release.resolve());
  const read = f.service.read.bind(f.service);
  f.service.read = async (...args) => {
    const result = await read(...args);
    prepared.resolve();
    await release.promise;
    return result;
  };
  const result = f.client.callTool({
    name: 'agent_read',
    arguments: {
      connectionId: receiver.binding.connectionId,
    },
  });
  result.catch(() => {});
  await prepared.promise;
  try {
    assert.equal(f.service.store.get(message.id, 'in')?.state, 'ready');
  } finally {
    release.resolve();
    await result;
  }
  assert.equal(f.service.store.get(message.id, 'in')?.state, 'processed');
});

test('native reservation excludes the same ready body from concurrent MCP history', async (t) => {
  const f = await fixture(t);
  const id = randomUUID();
  await f.service.installAdapter({ id, kind: 'manual', label: 'Private native fixture' });
  const entered = deferred();
  const release = deferred();
  const finished = deferred();
  f.cleanup.push(() => release.resolve());
  const adapter = f.service.adapters.get(id);
  let released = 0;
  Object.assign(adapter, {
    contentGate: true,
    status: () => ({
      id,
      label: 'Fixture',
      kind: 'manual',
      state: 'ready',
      error: null,
      capabilities: {
        wakeIdle: true,
        exactSession: true,
        receiveActive: false,
        nativeDisplay: true,
      },
    }),
    deliver: async (input: EventInput & { beforeRelease?: (text: string) => void }) => {
      if (input.systemEvent) return { state: 'admitted' };
      entered.resolve();
      await release.promise;
      input.beforeRelease?.(agentMessageText(input));
      released++;
      finished.resolve();
      return { state: 'admitted' };
    },
  });
  const receiver = f.service.connect({
    nickname: 'Receiver',
    client: 'Fixture',
    adapterId: id,
    chatId: 'exact-native-session',
  });
  if (receiver.status !== 'connected') throw new Error('Expected receiver');
  await f.send();
  await entered.promise;
  try {
    const result = await f.client.callTool({
      name: 'agent_history',
      arguments: {
        connectionId: receiver.binding.connectionId,
      },
    });
    assert.ok(
      !JSON.stringify(result).includes('One content path 漢字'),
      'A held native body must not be released by history',
    );
  } finally {
    release.resolve();
    await finished.promise;
  }
  assert.equal(released, 1);
});

for (const state of ['waiting', 'failed'] as const)
  test(`a proved pre-release ${state} keeps backlog retryable without false uncertainty`, async (t) => {
    let proceed = false;
    const f = await nativeFixture(t, async (input) => {
      if (!proceed) return { state };
      input.beforeRelease?.(agentMessageText(input));
      return { state: 'admitted' };
    });
    const message = await f.send();
    await until(() => f.service.store.dispatchState(message.id)?.state === 'failed');
    assert.equal(f.calls(), 1);
    assert.equal(f.service.store.get(message.id, 'in')?.state, 'ready');
    proceed = true;
    f.ready();
    await until(() => f.service.store.get(message.id, 'in')?.state === 'processed');
    assert.equal(f.calls(), 2);
  });

test('an uninstrumented legacy waiting outcome stays uncertain after possible release', async (t) => {
  const f = await nativeFixture(t, async () => ({ state: 'waiting' }), false);
  const message = await f.send();
  await until(() => f.service.store.dispatchState(message.id)?.state === 'uncertain');
  f.ready();
  await tick();
  assert.equal(f.calls(), 1);
  assert.equal(f.service.store.get(message.id, 'in')?.state, 'ready');
});

test('a second body gate cannot overwrite intent or release a second body', async (t) => {
  let bodyWrites = 0;
  const f = await nativeFixture(t, async (input) => {
    const body = agentMessageText(input);
    input.beforeRelease?.(body);
    bodyWrites++;
    assert.throws(() => input.beforeRelease?.(body), /already released/);
    return { state: 'admitted' };
  });
  const message = await f.send();
  await until(() => f.service.store.get(message.id, 'in')?.state === 'processed');
  assert.equal(bodyWrites, 1);
  assert.equal(f.calls(), 1);
});

test('MCP reservation first excludes a concurrent native release', async (t) => {
  const f = await nativeFixture(
    t,
    async (input) => {
      input.beforeRelease?.(agentMessageText(input));
      return { state: 'admitted' };
    },
    true,
    false,
  );
  const message = await f.send(),
    prepared = deferred(),
    release = deferred();
  f.cleanup.push(() => release.resolve());
  const read = f.service.read.bind(f.service);
  f.service.read = async (...args) => {
    const value = await read(...args);
    prepared.resolve();
    await release.promise;
    return value;
  };
  const reading = f.client.callTool({
    name: 'agent_read',
    arguments: { connectionId: f.connectionId },
  });
  await prepared.promise;
  f.ready();
  await tick();
  assert.equal(f.calls(), 0);
  release.resolve();
  const result = await reading;
  assert.ok(!result.isError);
  assert.equal(f.service.store.get(message.id, 'in')?.state, 'processed');
  assert.equal(f.calls(), 0);
});

test('processed explicit history remains readable without a second attempt', async (t) => {
  const f = await fixture(t),
    receiver = f.service.connect({ nickname: 'Receiver', client: 'Fixture' });
  if (receiver.status !== 'connected') throw new Error('Expected receiver');
  const message = await f.send(),
    args = { connectionId: receiver.binding.connectionId };
  await f.client.callTool({ name: 'agent_read', arguments: args });
  const previous = f.service.store.db
    .prepare('SELECT attempt_id FROM dispatches WHERE message_id=?')
    .get(message.id);
  const history = await f.client.callTool({ name: 'agent_history', arguments: args });
  assert.ok(JSON.stringify(history).includes('One content path 漢字'));
  assert.deepEqual(
    f.service.store.db
      .prepare('SELECT attempt_id FROM dispatches WHERE message_id=?')
      .get(message.id),
    previous,
  );
});

test('actual partial HTTP response leaves unread uncertainty and blocks another read', async (t) => {
  const f = await fixture(t),
    receiver = f.service.connect({ nickname: 'Receiver', client: 'Fixture' });
  if (receiver.status !== 'connected') throw new Error('Expected receiver');
  const message = await f.send(),
    server = Reflect.get(f.service.mcp, 'server') as Server;
  const partial = (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== 'POST') return;
    server.off('request', partial);
    const write = response.write.bind(response);
    response.write = ((chunk: Buffer, callback?: (error?: Error | null) => void) =>
      write(chunk.subarray(0, 17), () => {
        response.destroy();
        callback?.();
      })) as ServerResponse['write'];
  };
  server.on('request', partial);
  t.after(() => server.off('request', partial));
  await assert.rejects(
    f.client.callTool(
      { name: 'agent_read', arguments: { connectionId: receiver.binding.connectionId } },
      undefined,
      { timeout: 1000 },
    ),
  );
  await until(() => f.service.store.dispatchState(message.id)?.state === 'uncertain');
  assert.equal(f.service.store.get(message.id, 'in')?.state, 'ready');
  const blocked = await f.client.callTool({
    name: 'agent_read',
    arguments: { connectionId: receiver.binding.connectionId },
  });
  assert.equal(blocked.isError, true);
  assert.ok(!JSON.stringify(blocked).includes('One content path 漢字'));
});

function nativeInput(
  adapterId: string,
  chatId: string,
  beforeRelease: (text: string) => void,
): EventInput {
  return {
    nickname: 'Fixture',
    binding: { adapterId, chatId, client: 'Fixture', connectionId: randomUUID(), generation: 1 },
    messageId: randomUUID(),
    replyRef: 'r1',
    message: { fromNode: randomUUID(), fromNickname: 'Sender', text: 'Gate body 漢字', files: [] },
    isCurrent: () => true,
    beforeRelease,
  };
}

for (const deny of [false, true])
  test(`Cursor private gate ${deny ? 'failure returns no followup' : 'runs once before followup'}`, async (t) => {
    const id = randomUUID(),
      adapter = new CursorHookAdapter(
        { id, kind: 'cursor-hook', label: 'Fixture' },
        () => {},
        () => {},
      );
    t.after(() => adapter.stop());
    const waiting = adapter.wait('completed', new AbortController().signal);
    let gates = 0;
    let representation = '';
    const delivery = adapter.deliver(
      nativeInput(id, 'exact-session', (actual) => {
        representation = actual;
        gates++;
        if (deny) throw new Error('Private gate refused');
      }),
    );
    const followup = await waiting;
    if (deny) {
      assert.deepEqual(followup, {});
      assert.equal((await delivery).state, 'failed');
    } else {
      assert.deepEqual(JSON.parse(representation), followup);
      assert.match(followup.followup_message!, /Gate body 漢字/);
      adapter.acknowledge(followup.followup_message!.match(/NCF-Admission-ID: (.*)$/)![1]);
      assert.equal((await delivery).state, 'admitted');
    }
    assert.equal(gates, 1);
  });

for (const deny of [false, true])
  test(`OpenCode private gate ${deny ? 'failure prevents prompt submission' : 'precedes the exact serialized prompt'}`, async (t) => {
    const id = randomUUID(),
      adapter = new OpenCodeAdapter(
        { id, kind: 'opencode-http', label: 'Fixture', sessionId: 'ses_exact' },
        () => {},
        () => {},
      );
    t.after(() => adapter.stop());
    (Reflect.get(adapter, 'state') as { state: string }).state = 'ready';
    const order: string[] = [];
    let representation = '';
    Object.assign(adapter, {
      request: async (route: string, options?: { body?: string }) => {
        if (route === '/session/status') return Response.json({ ses_exact: { type: 'idle' } });
        order.push('body');
        assert.equal(route, '/session/ses_exact/prompt_async');
        assert.equal(representation, options?.body);
        assert.match(options?.body ?? '', /Gate body 漢字/);
        return new Response(null, { status: 204 });
      },
    });
    const result = await adapter.deliver(
      nativeInput(id, 'ses_exact', (actual) => {
        representation = actual;
        order.push('gate');
        if (deny) throw new Error('Private gate refused');
      }),
    );
    assert.deepEqual(order, deny ? ['gate'] : ['gate', 'body']);
    assert.equal(result.state, deny ? 'uncertain' : 'admitted');
  });

for (const deny of [false, true])
  test(`AionUi private gate ${deny ? 'failure prevents message submission' : 'precedes the exact serialized message'}`, async (t) => {
    const id = randomUUID(),
      order: string[] = [];
    let representation = '';
    const sessions = Object.assign(new EventEmitter(), {
      access: () => ({
        signal: new AbortController().signal,
        http: {
          request: async (_route: string, options: { body: string }) => {
            order.push('body');
            assert.equal(representation, options.body);
            assert.match(options.body, /Gate body 漢字/);
            return Response.json(
              { success: true, data: { msg_id: 'm1', turn_id: 't1' } },
              { status: 202 },
            );
          },
        },
      }),
    });
    const adapter = new AionUiAdapter(
      {
        id,
        kind: 'aionui',
        label: 'Fixture',
        aionConnectionId: randomUUID(),
        sessionId: 'exact-session',
      },
      sessions as unknown as AionUiSessions,
      () => {},
      () => {},
    );
    t.after(() => adapter.stop());
    (Reflect.get(adapter, 'state') as { state: string }).state = 'ready';
    Object.assign(adapter, {
      inspect: async () => true,
      socket: { readyState: 1, terminate() {} },
    });
    const result = await adapter.deliver(
      nativeInput(id, 'exact-session', (actual) => {
        representation = actual;
        order.push('gate');
        if (deny) throw new Error('Private gate refused');
      }),
    );
    assert.deepEqual(order, deny ? ['gate'] : ['gate', 'body']);
    assert.equal(result.state, deny ? 'uncertain' : 'admitted');
  });

for (const deny of [false, true])
  test(`Codex actual socket gate ${deny ? 'failure prevents a content frame' : 'precedes a content frame'}`, async (t) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-codex-gate-')),
      threadId = randomUUID(),
      id = randomUUID();
    const socket =
      process.platform === 'win32'
        ? '\\\\.\\pipe\\ncf-gate-' + randomUUID()
        : path.join(directory, 'ipc.sock');
    const connections = new Set<net.Socket>(),
      ended = deferred(),
      order: string[] = [];
    let representation = '';
    const server = net.createServer((connection) => {
      connections.add(connection);
      connection.on('error', () => {});
      connection.on('close', () => {
        connections.delete(connection);
        ended.resolve();
      });
      let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
      const send = (value: object) => {
        const bytes = Buffer.from(JSON.stringify(value)),
          frame = Buffer.alloc(bytes.length + 4);
        frame.writeUInt32LE(bytes.length);
        bytes.copy(frame, 4);
        connection.write(frame);
      };
      connection.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, typeof chunk === 'string' ? Buffer.from(chunk) : chunk]);
        while (buffer.length >= 4 && buffer.length >= buffer.readUInt32LE(0) + 4) {
          const size = buffer.readUInt32LE(0),
            message = JSON.parse(buffer.subarray(4, size + 4).toString());
          buffer = buffer.subarray(size + 4);
          if (message.method === 'initialize')
            send({
              type: 'response',
              requestId: message.requestId,
              resultType: 'success',
              result: { clientId: 'fixture-client' },
            });
          else if (message.method === 'thread-owner-discovery')
            send({
              type: 'response',
              requestId: message.requestId,
              resultType: 'success',
              handledByClientId: 'owner',
              result: { supportsUntrustedAppInput: true },
            });
          else if (message.method === 'thread-stream-following-changed' && message.params.following)
            send({
              type: 'broadcast',
              sourceClientId: 'owner',
              method: 'thread-stream-state-changed',
              version: 11,
              params: {
                hostId: 'local',
                conversationId: threadId,
                change: {
                  type: 'snapshot',
                  conversationState: { threadRuntimeStatus: { type: 'idle' } },
                },
              },
            });
          else if (message.method === 'thread-follower-start-turn') {
            order.push('wire');
            assert.equal(representation, JSON.stringify(message));
            assert.match(JSON.stringify(message.params), /Gate body 漢字/);
            send({
              type: 'response',
              requestId: message.requestId,
              resultType: 'success',
              result: {},
            });
          }
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(socket, resolve));
    t.after(async () => {
      for (const connection of connections) connection.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    });
    const result = await codexExchange(
      { id, kind: 'codex-desktop', label: 'Fixture', threadId, socket },
      nativeInput(id, threadId, (actual) => {
        representation = actual;
        order.push('gate');
        if (deny) throw new Error('Private gate refused');
      }),
    );
    await ended.promise;
    assert.deepEqual(order, deny ? ['gate'] : ['gate', 'wire']);
    assert.equal(result.state, deny ? 'failed' : 'admitted');
  });

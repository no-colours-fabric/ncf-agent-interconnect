import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CodexDesktopAdapter, codexExchange } from '../desktop/core/codex-adapter.js';
import { NodeService } from '../desktop/core/service.js';
import type { AdapterProfile } from '../desktop/shared/contracts.js';

interface Request {
  type: string;
  method: string;
  requestId: string;
  version: number;
  targetClientId?: string;
  params: Record<string, unknown>;
}
async function fixture(t: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-codex-'));
  const socket =
    process.platform === 'win32'
      ? '\\\\.\\pipe\\interconnect-test-' + randomUUID()
      : path.join(directory, 'ipc.sock');
  const requests: Request[] = [],
    sockets = new Set<net.Socket>();
  const state = {
    runtime: 'idle',
    support: true as boolean | undefined,
    ownerClientId: 'exact-owner' as string | undefined,
    discoveryResult: 'success',
    admission: 'success',
    ownerThreadId: '',
  };
  const server = net.createServer((connection) => {
    sockets.add(connection);
    connection.on('close', () => sockets.delete(connection));
    let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    const write = (value: object) => {
      const bytes = Buffer.from(JSON.stringify(value)),
        frame = Buffer.alloc(bytes.length + 4);
      frame.writeUInt32LE(bytes.length);
      bytes.copy(frame, 4);
      connection.write(frame);
    };
    connection.on('data', (data) => {
      buffer = Buffer.concat([buffer, typeof data === 'string' ? Buffer.from(data) : data]);
      while (buffer.length >= 4 && buffer.length >= buffer.readUInt32LE(0) + 4) {
        const length = buffer.readUInt32LE(0),
          request = JSON.parse(buffer.subarray(4, length + 4).toString()) as Request;
        buffer = buffer.subarray(length + 4);
        requests.push(request);
        if (request.method === 'initialize')
          write({
            type: 'response',
            requestId: request.requestId,
            resultType: 'success',
            result: { clientId: 'test-follower' },
          });
        if (request.method === 'thread-owner-discovery')
          write({
            type: 'response',
            requestId: request.requestId,
            resultType:
              request.params.conversationId === state.ownerThreadId
                ? state.discoveryResult
                : 'error',
            handledByClientId: state.ownerClientId,
            result: { supportsUntrustedAppInput: state.support },
            error: 'private-protocol-detail',
          });
        if (
          request.method === 'thread-stream-following-changed' &&
          request.params.following === true
        ) {
          // A broadcast belonging to another chat must never trigger admission.
          for (const conversationId of [randomUUID(), request.params.conversationId])
            write({
              type: 'broadcast',
              sourceClientId: 'exact-owner',
              method: 'thread-stream-state-changed',
              version: 11,
              params: {
                hostId: 'local',
                conversationId,
                change: {
                  type: 'snapshot',
                  conversationState: { threadRuntimeStatus: { type: state.runtime } },
                },
              },
            });
        }
        if (
          request.method === 'thread-follower-start-turn' ||
          request.method === 'thread-follower-steer-turn'
        ) {
          if (state.admission === 'lost') connection.destroy();
          else
            write({ type: 'response', requestId: request.requestId, resultType: state.admission });
        }
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(socket, resolve));
  t.after(async () => {
    for (const c of sockets) c.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  const profile: AdapterProfile = {
    id: randomUUID(),
    label: 'Точный чат',
    kind: 'codex-desktop',
    threadId: randomUUID(),
    socket,
  };
  state.ownerThreadId = profile.threadId!;
  return { directory, profile, requests, state };
}
function input(profile: AdapterProfile) {
  return {
    message: {
      fromNode: '11111111-1111-4111-8111-111111111111',
      fromNickname: 'Коллега',
      text: 'Готовое поручение',
      files: [],
    },
    nickname: 'Беседа',
    messageId: randomUUID(),
    binding: {
      connectionId: randomUUID(),
      client: 'Codex',
      chatId: profile.threadId!,
      adapterId: profile.id,
      generation: 1,
    },
  };
}

test('Codex owner probe is read-only; idle admission inherits settings and targets only the discovered exact owner', async (t) => {
  const f = await fixture(t),
    adapter = new CodexDesktopAdapter(f.profile, () => {});
  t.after(() => adapter.stop());
  await adapter.start();
  assert.equal(adapter.status().state, 'ready');
  assert.deepEqual(
    f.requests.map((r) => r.method),
    ['initialize', 'thread-owner-discovery'],
  );
  assert.equal(f.requests[1].params.conversationId, f.profile.threadId);
  assert.equal(adapter.status().capabilities.nativeDisplay, false);
  const event = input(f.profile);
  assert.equal((await adapter.deliver(event)).state, 'admitted');
  const admissions = f.requests.filter((r) => r.method === 'thread-follower-start-turn');
  assert.equal(admissions.length, 1);
  const request = admissions[0];
  assert.equal(request.targetClientId, 'exact-owner');
  assert.equal(request.version, 2);
  const params = request.params as {
    conversationId: string;
    turnStart: {
      request: { threadId: string; input: unknown[] };
      context: { inheritThreadSettings: boolean; responseItems?: unknown[] };
    };
  };
  assert.equal(params.conversationId, f.profile.threadId);
  assert.equal(params.turnStart.request.threadId, f.profile.threadId);
  assert.equal(params.turnStart.context.inheritThreadSettings, true);
  assert.deepEqual(Object.keys(params.turnStart.context), ['inheritThreadSettings']);
  assert.deepEqual(params.turnStart.request.input, [
    {
      type: 'text',
      text: `**Incoming NCF Agent Interconnect**\nFrom: "Коллега"\nFrom-Node: ${event.message.fromNode}\nMessage-ID: ${event.messageId}\n\n---\n\nГотовое поручение\n\n---\n\nReply-To:\n\n    {"recipientNode":"${event.message.fromNode}","recipientNickname":"Коллега","replyTo":"${event.messageId}"}\n\n*Use NCF Agent Interconnect MCP agent_send with the Reply-To parameters to reply.*`,
      text_elements: [],
    },
  ]);
  assert.ok(!JSON.stringify(params).includes(event.binding.connectionId));
  assert.ok(!JSON.stringify(params).includes('untrusted_input'));
  assert.ok(!JSON.stringify(params).includes('approvalPolicy'));
  assert.ok(!JSON.stringify(params).includes('model'));
});

test('Codex active admission has required restore metadata; revoked binding never submits and lost admission is uncertain', async (t) => {
  const f = await fixture(t);
  f.state.runtime = 'active';
  const revoked = await codexExchange(f.profile, { ...input(f.profile), isCurrent: () => false });
  assert.equal(revoked.state, 'revoked');
  assert.ok(!f.requests.some((r) => r.method.startsWith('thread-follower-')));
  const event = input(f.profile);
  assert.equal((await codexExchange(f.profile, event)).state, 'admitted');
  const request = f.requests.find((r) => r.method === 'thread-follower-steer-turn')!;
  assert.equal(request.version, 1);
  assert.deepEqual(request.params.input, [
    {
      type: 'text',
      text: `**Incoming NCF Agent Interconnect**\nFrom: "Коллега"\nFrom-Node: ${event.message.fromNode}\nMessage-ID: ${event.messageId}\n\n---\n\nГотовое поручение\n\n---\n\nReply-To:\n\n    {"recipientNode":"${event.message.fromNode}","recipientNickname":"Коллега","replyTo":"${event.messageId}"}\n\n*Use NCF Agent Interconnect MCP agent_send with the Reply-To parameters to reply.*`,
      text_elements: [],
    },
  ]);
  assert.deepEqual(request.params.attachments, []);
  assert.equal(
    (request.params.restoreMessage as { id: string }).id,
    request.params.clientUserMessageId,
  );
  assert.equal(
    (request.params.restoreMessage as { text: string }).text,
    `**Incoming NCF Agent Interconnect**\nFrom: "Коллега"\nFrom-Node: ${event.message.fromNode}\nMessage-ID: ${event.messageId}\n\n---\n\nГотовое поручение\n\n---\n\nReply-To:\n\n    {"recipientNode":"${event.message.fromNode}","recipientNickname":"Коллега","replyTo":"${event.messageId}"}\n\n*Use NCF Agent Interconnect MCP agent_send with the Reply-To parameters to reply.*`,
  );
  assert.ok(!('toolOutput' in request.params));
  f.state.admission = 'lost';
  assert.equal((await codexExchange(f.profile, input(f.profile))).state, 'uncertain');
  f.state.support = false;
  const before = f.requests.filter((r) => r.method.startsWith('thread-follower-')).length;
  assert.equal((await codexExchange(f.profile, input(f.profile))).state, 'failed');
  assert.equal(f.requests.filter((r) => r.method.startsWith('thread-follower-')).length, before);
});

test('Codex discovery distinguishes unavailable handlers, unconfirmed support and explicit rejection', async (t) => {
  const scenarios = [
    {
      name: 'discovery error without handler or capability',
      discoveryResult: 'error',
      ownerClientId: undefined,
      support: undefined,
      error: 'Codex owner discovery failed for this exact chat',
    },
    {
      name: 'successful discovery without a handler',
      discoveryResult: 'success',
      ownerClientId: undefined,
      support: true,
      error: 'Codex did not identify a handler for this exact chat',
    },
    {
      name: 'empty handler',
      discoveryResult: 'success',
      ownerClientId: '',
      support: true,
      error: 'Codex did not identify a handler for this exact chat',
    },
    {
      name: 'whitespace handler',
      discoveryResult: 'success',
      ownerClientId: '  \t ',
      support: true,
      error: 'Codex did not identify a handler for this exact chat',
    },
    {
      name: 'handler without capability confirmation',
      discoveryResult: 'success',
      ownerClientId: 'exact-owner',
      support: undefined,
      error: 'The handler for this Codex chat did not confirm external input support',
    },
    {
      name: 'handler explicitly rejects external input',
      discoveryResult: 'success',
      ownerClientId: 'exact-owner',
      support: false,
      error: 'The handler for this Codex chat does not support external input',
    },
  ];
  for (const scenario of scenarios)
    await t.test(scenario.name, async (t) => {
      const f = await fixture(t);
      Object.assign(f.state, scenario);
      const result = await codexExchange(f.profile, input(f.profile));
      assert.deepEqual(result, { state: 'failed', error: scenario.error });
      assert.ok(!result.error?.includes('private-protocol-detail'));
      assert.deepEqual(
        f.requests.map((request) => request.method),
        ['initialize', 'thread-owner-discovery'],
      );
      assert.equal(f.requests[1].params.conversationId, f.profile.threadId);
    });
});

const unavailableCapabilities = {
  wakeIdle: false,
  receiveActive: false,
  nativeDisplay: false,
  exactSession: false,
};

test('a failed Codex probe clears previous capabilities and a successful probe restores them', async (t) => {
  const f = await fixture(t),
    adapter = new CodexDesktopAdapter(f.profile, () => {});
  t.after(() => adapter.stop());
  await adapter.start();
  assert.equal(adapter.status().state, 'ready');
  assert.equal(adapter.status().capabilities.wakeIdle, true);
  f.state.discoveryResult = 'error';
  await adapter.start();
  assert.equal(adapter.status().state, 'error');
  assert.deepEqual(adapter.status().capabilities, unavailableCapabilities);
  f.state.discoveryResult = 'success';
  await adapter.start();
  assert.equal(adapter.status().state, 'ready');
  assert.equal(adapter.status().error, null);
  assert.deepEqual(adapter.status().capabilities, {
    wakeIdle: true,
    receiveActive: true,
    nativeDisplay: false,
    exactSession: true,
  });
  assert.ok(
    f.requests.every((request) =>
      ['initialize', 'thread-owner-discovery'].includes(request.method),
    ),
  );
});

test('failed Codex delivery clears capabilities without submitting to an unconfirmed owner', async (t) => {
  const f = await fixture(t),
    adapter = new CodexDesktopAdapter(f.profile, () => {});
  t.after(() => adapter.stop());
  await adapter.start();
  f.state.support = undefined;
  assert.equal((await adapter.deliver(input(f.profile))).state, 'failed');
  assert.equal(adapter.status().state, 'error');
  assert.deepEqual(adapter.status().capabilities, unavailableCapabilities);
  assert.ok(!f.requests.some((request) => request.method.startsWith('thread-follower-')));
});

test('Codex uncertain admission clears capabilities and read-only recovery never repeats input', async (t) => {
  const f = await fixture(t),
    adapter = new CodexDesktopAdapter(f.profile, () => {});
  t.after(() => adapter.stop());
  await adapter.start();
  f.state.admission = 'lost';
  const event = input(f.profile);
  assert.equal((await adapter.deliver(event)).state, 'uncertain');
  assert.equal(adapter.status().state, 'uncertain');
  assert.deepEqual(adapter.status().capabilities, unavailableCapabilities);
  const submissions = () =>
    f.requests.filter((request) => request.method.startsWith('thread-follower-'));
  assert.equal(submissions().length, 1);
  f.state.admission = 'success';
  await adapter.start();
  assert.equal(adapter.status().state, 'ready');
  assert.equal(adapter.status().capabilities.exactSession, true);
  assert.equal(submissions().length, 1);
  const afterRecovery = await adapter.deliver({ ...event, isCurrent: () => false });
  assert.equal(afterRecovery.state, 'revoked');
  assert.equal(submissions().length, 1);
});

test('node recovery preserves uncertain Codex dispatch and does not acknowledge or resend the message', async (t) => {
  const f = await fixture(t),
    directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-codex-uncertain-')),
    service = new NodeService(directory);
  await service.open();
  t.after(async () => {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  const receiver = await service.connectCodex(
      { nickname: 'Получатель', client: 'Codex' },
      { threadId: f.profile.threadId!, socket: f.profile.socket },
    ),
    sender = service.connect({ nickname: 'Автор', client: 'MCP' });
  if (receiver.status !== 'connected' || sender.status !== 'connected') throw new Error();
  f.state.admission = 'lost';
  const message = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Получатель',
    text: 'Preserve uncertain admission without repeating external input.',
  });
  const deadline = Date.now() + 3000;
  while (service.store.dispatchState(message.id)?.state !== 'uncertain') {
    if (Date.now() > deadline) throw new Error('The uncertain Codex dispatch was not recorded');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const adapter = service.adapters.get(receiver.binding.adapterId);
  assert.deepEqual(adapter.status().capabilities, unavailableCapabilities);
  f.state.admission = 'success';
  await adapter.start();
  assert.equal(adapter.status().state, 'ready');
  assert.equal(service.store.dispatchState(message.id)?.state, 'uncertain');
  assert.equal(service.store.get(message.id, 'in')?.state, 'ready');
  assert.equal(service.store.get(message.id, 'out')?.state, 'ready');
  assert.equal(
    service.snapshot().agents.find((agent) => agent.nickname === 'Получатель')?.unread,
    1,
  );
  assert.equal(
    f.requests.filter((request) => request.method.startsWith('thread-follower-')).length,
    1,
  );
});

test('Codex receives the original body and attachment link and completes delivery without asking the model to read or acknowledge', async (t) => {
  const f = await fixture(t),
    directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-codex-body-')),
    service = new NodeService(directory);
  await service.open();
  t.after(async () => {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  const receiver = await service.connectCodex(
    { nickname: 'Получатель', client: 'Codex' },
    { threadId: f.profile.threadId!, socket: f.profile.socket },
  );
  const sender = service.connect({ nickname: 'Исследователь', client: 'MCP' });
  if (receiver.status !== 'connected' || sender.status !== 'connected') throw new Error();
  const filename = path.join(service.settings.value.exportRoots[0], 'расчёт.txt');
  await writeFile(filename, 'Числа для проверки');
  const message = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Получатель',
    text: 'Проверь расчёт.\nОтветь с результатом.',
    files: [filename],
  });
  const deadline = Date.now() + 3000;
  while (service.snapshot().agents.find((agent) => agent.nickname === 'Получатель')!.unread) {
    if (Date.now() > deadline) throw new Error('Codex message was not delivered');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const request = f.requests.find((item) => item.method === 'thread-follower-start-turn')!;
  const { turnStart } = request.params as { turnStart: { request: { input: { text: string }[] } } };
  const text = turnStart.request.input[0].text;
  assert.ok(
    text.startsWith(
      `**Incoming NCF Agent Interconnect**\nFrom: "Исследователь"\nFrom-Node: ${service.settings.value.nodeId}\nMessage-ID: ${message.id}\n\n---\n\nПроверь расчёт.\nОтветь с результатом.\n\nAttachments:\n`,
    ),
  );
  assert.equal(await readFile(text.match(/\]\(<([^>]+)>\)/)![1], 'utf8'), 'Числа для проверки');
  for (const noise of [
    'agent_read',
    'message_ack',
    'untrusted_input',
    'Системное событие',
    receiver.binding.connectionId,
  ])
    assert.ok(!text.replace(/\]\(<[^>]+>\)/g, ']').includes(noise));
  assert.equal(service.store.get(message.id, 'out')!.state, 'processed');
});

test('Codex setup reuses the exact adapter, preserves approved nickname transfer and notifies the revoked chat', async (t) => {
  const f = await fixture(t),
    directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-codex-node-')),
    service = new NodeService(directory);
  await service.open();
  t.after(async () => {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  const target = { threadId: f.profile.threadId!, socket: f.profile.socket };
  const first = await service.connectCodex({ nickname: 'Тема', client: 'Codex' }, target);
  if (first.status !== 'connected') throw new Error();
  const same = await service.connectCodex(
    { nickname: 'ТЕМА', client: 'Codex', connectionId: first.binding.connectionId },
    target,
  );
  if (same.status !== 'connected') throw new Error();
  assert.equal(same.binding.connectionId, first.binding.connectionId);
  assert.equal(service.snapshot().adapters.length, 2);
  const profile = service.settings.value.adapters.find((a) => a.kind === 'codex-desktop')!;
  await assert.rejects(
    service.userCall('saveAdapter', { ...profile, threadId: randomUUID() }),
    /Unknown interface operation/,
  );
  const pending = service.connect({ nickname: 'тема', client: 'Cursor' });
  if (pending.status !== 'nickname_in_use') throw new Error();
  assert.equal(service.store.assertOwner(first.binding.connectionId).nickname, 'Тема');
  const moved = service.connect({
    nickname: 'тема',
    ...pending.requestingChat,
    connectionId: pending.connectionId,
    transferId: pending.transferId,
    confirmTransfer: true,
  });
  if (moved.status !== 'connected') throw new Error();
  assert.throws(() => service.store.assertOwner(first.binding.connectionId), /agent_moved/);
  const deadline = Date.now() + 2000;
  while (!f.requests.some((r) => JSON.stringify(r.params).includes('was moved to another chat'))) {
    if (Date.now() > deadline) throw new Error('System event not delivered');
    await new Promise((r) => setTimeout(r, 10));
  }
  const notice = f.requests.find((r) =>
    JSON.stringify(r.params).includes('was moved to another chat'),
  )!;
  assert.equal(notice.params.conversationId, target.threadId);
  assert.ok(!JSON.stringify(notice.params).includes(first.binding.connectionId));
  await assert.rejects(
    service.connectCodex({ nickname: 'Другая', client: 'Codex', chatId: randomUUID() }, target),
    /same chat/,
  );
});

test('Codex MCP metadata automatically selects the exact chat and profile among multiple running instances', async (t) => {
  const a = await fixture(t),
    b = await fixture(t),
    directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-codex-auto-'));
  const service = new NodeService(directory, {
    codexSockets: () => [b.profile.socket!, a.profile.socket!],
  });
  await service.open();
  const client = new Client({ name: 'Codex', version: 'test' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
      requestInit: { headers: { authorization: 'Bearer ' + service.settings.value.localToken } },
    }),
  );
  t.after(async () => {
    await client.close();
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  const connect = (threadId: string, extra: Record<string, unknown> = {}) =>
    client.callTool({
      name: 'agent_connect',
      arguments: { nickname: 'Воевода', ...extra },
      _meta: { threadId },
    });
  const first = (await connect(a.profile.threadId!))
    .structuredContent as unknown as import('../desktop/core/agent-store.js').ConnectResult;
  assert.equal(first.status, 'connected');
  if (first.status !== 'connected') throw new Error();
  assert.equal(first.binding.chatId, a.profile.threadId);
  assert.equal(
    service.settings.value.adapters.find((profile) => profile.id === first.binding.adapterId)!
      .socket,
    a.profile.socket,
  );
  const same = (await connect(a.profile.threadId!))
    .structuredContent as unknown as import('../desktop/core/agent-store.js').ConnectResult;
  assert.equal(same.status, 'connected');
  if (same.status !== 'connected') throw new Error();
  assert.equal(same.binding.connectionId, first.binding.connectionId);
  const conflict = (await connect(b.profile.threadId!))
    .structuredContent as unknown as import('../desktop/core/agent-store.js').ConnectResult;
  assert.equal(conflict.status, 'nickname_in_use');
  if (conflict.status !== 'nickname_in_use') throw new Error();
  assert.equal(
    service.store.assertOwner(first.binding.connectionId).binding.chatId,
    a.profile.threadId,
  );
  const moved = (
    await connect(b.profile.threadId!, {
      connectionId: conflict.connectionId,
      transferId: conflict.transferId,
      confirmTransfer: true,
    })
  ).structuredContent as unknown as import('../desktop/core/agent-store.js').ConnectResult;
  assert.equal(moved.status, 'connected');
  if (moved.status !== 'connected') throw new Error();
  assert.equal(moved.binding.chatId, b.profile.threadId);
  const metadataMissing = await client.callTool({
    name: 'agent_connect',
    arguments: { nickname: 'Другое имя' },
  });
  assert.equal(metadataMissing.isError, true);
  assert.match(JSON.stringify(metadataMissing), /current chat context/);
});

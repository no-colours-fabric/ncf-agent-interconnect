import { runCodexSendHook } from '../desktop/integrations/codex-send-hook.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { exec } from 'node:child_process';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import fsPromises, { mkdir, mkdtemp, realpath, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import {
  CODEX_IPC_MAX_FRAME_BYTES,
  codexEndpoints,
  CodexDesktopAdapter,
  codexExchange,
} from '../desktop/core/codex-adapter.js';
import { AdapterRegistry, agentMessageText, type EventInput } from '../desktop/core/adapters.js';
import {
  CodexConnectFailure,
  CodexQueueAdapter,
  codexQueueLocator,
} from '../desktop/core/codex-queue.js';
import { codexQueueWitness, contentHash } from '../desktop/core/delivery-attempt.js';
import { NodeService } from '../desktop/core/service.js';
import { formatAgentMessageTimestamp } from '../desktop/core/message-presentation.js';
import type { AdapterProfile } from '../desktop/shared/contracts.js';

interface Request {
  type: string;
  method: string;
  requestId: string;
  version: number;
  targetClientId?: string;
  params: Record<string, unknown>;
}
type MessageEvent = Extract<EventInput, { message: unknown }>;
interface HeldReply {
  release(): void;
  disconnect(): void;
}
type ReplyGate = (reply: HeldReply) => void;
function nextReply(queue: ReplyGate[]): Promise<HeldReply> {
  return new Promise((resolve) => queue.push(resolve));
}
async function fixture(t: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-codex-'));
  const socket =
    process.platform === 'win32'
      ? '\\\\.\\pipe\\interconnect-test-' + randomUUID()
      : path.join(directory, 'ipc.sock');
  const requests: Request[] = [],
    sockets = new Set<net.Socket>(),
    discoveryGates: ReplyGate[] = [],
    admissionGates: ReplyGate[] = [];
  const state = {
    runtime: 'idle',
    support: true as boolean | undefined,
    ownerClientId: 'exact-owner' as string | undefined,
    discoveryResult: 'success',
    admission: 'success',
    ownerThreadId: '',
    snapshotPadding: '',
    frameFragmentBytes: 0,
    coalesceSnapshots: false,
    truncateSnapshot: false,
    invalidSnapshotLength: undefined as number | undefined,
  };
  const server = net.createServer((connection) => {
    sockets.add(connection);
    connection.on('close', () => sockets.delete(connection));
    connection.on('error', () => {});
    let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    const encode = (value: object, truncate = false) => {
      const bytes = Buffer.from(JSON.stringify(value)),
        frame = Buffer.alloc(bytes.length + 4);
      frame.writeUInt32LE(bytes.length);
      bytes.copy(frame, 4);
      return truncate ? frame.subarray(0, Math.max(4, Math.floor(frame.length / 2))) : frame;
    };
    const send = (output: Buffer) => {
      if (connection.destroyed || !connection.writable) return;
      if (!state.frameFragmentBytes) {
        connection.write(output);
        return;
      }
      for (let offset = 0; offset < output.length; offset += state.frameFragmentBytes)
        connection.write(output.subarray(offset, offset + state.frameFragmentBytes));
    };
    const write = (value: object, truncate = false) => send(encode(value, truncate));
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
        if (request.method === 'thread-owner-discovery') {
          const response = {
            type: 'response',
            requestId: request.requestId,
            resultType:
              request.params.conversationId === state.ownerThreadId
                ? state.discoveryResult
                : 'error',
            handledByClientId: state.ownerClientId,
            result: { supportsUntrustedAppInput: state.support },
            error: 'private-protocol-detail',
          };
          const gate = discoveryGates.shift();
          if (gate)
            gate({ release: () => write(response), disconnect: () => connection.destroy() });
          else write(response);
        }
        if (
          request.method === 'thread-stream-following-changed' &&
          request.params.following === true
        ) {
          if (state.invalidSnapshotLength !== undefined) {
            const header = Buffer.alloc(4);
            header.writeUInt32LE(state.invalidSnapshotLength);
            connection.write(header);
            state.invalidSnapshotLength = undefined;
            return;
          }
          // A broadcast belonging to another chat must never trigger admission.
          const snapshots = [randomUUID(), request.params.conversationId].map((conversationId) => ({
            type: 'broadcast',
            sourceClientId: 'exact-owner',
            method: 'thread-stream-state-changed',
            version: 11,
            params: {
              hostId: 'local',
              conversationId,
              change: {
                type: 'snapshot',
                conversationState: {
                  threadRuntimeStatus: { type: state.runtime },
                  ignoredLargeState:
                    conversationId === request.params.conversationId ? state.snapshotPadding : '',
                },
              },
            },
          }));
          if (state.coalesceSnapshots)
            send(
              Buffer.concat(snapshots.map((snapshot) => encode(snapshot, state.truncateSnapshot))),
            );
          else for (const snapshot of snapshots) write(snapshot, state.truncateSnapshot);
        }
        if (
          request.method === 'thread-follower-start-turn' ||
          request.method === 'thread-follower-steer-turn'
        ) {
          const response = {
            type: 'response',
            requestId: request.requestId,
            resultType: state.admission,
          };
          const gate = admissionGates.shift();
          if (gate)
            gate({ release: () => write(response), disconnect: () => connection.destroy() });
          else if (state.admission === 'lost') connection.destroy();
          else write(response);
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
  return {
    directory,
    profile,
    requests,
    state,
    holdDiscovery: () => nextReply(discoveryGates),
    holdAdmission: () => nextReply(admissionGates),
  };
}
function input(profile: AdapterProfile): MessageEvent {
  return {
    message: {
      fromNode: '11111111-1111-4111-8111-111111111111',
      fromNickname: 'Коллега',
      text: 'Готовое поручение',
      files: [],
    },
    nickname: 'Беседа',
    messageId: randomUUID(),
    replyRef: 'r7',
    binding: {
      connectionId: randomUUID(),
      client: 'Codex',
      chatId: profile.threadId!,
      adapterId: profile.id,
      generation: 1,
    },
  };
}

test(
  'a complete node restart waits for the exact Codex owner, recovers without UI, and preserves uncertain input',
  { timeout: 15000 },
  async (t) => {
    const f = await fixture(t),
      directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-codex-cold-'));
    let service = new NodeService(directory);
    t.after(async () => {
      await service.close();
      await rm(directory, { recursive: true, force: true });
    });
    const until = async (check: () => boolean) => {
      const deadline = Date.now() + 6000;
      while (!check()) {
        if (Date.now() > deadline) throw new Error('Exact-owner recovery timed out');
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    };
    await service.open();
    const target = await service.connectCodex(
      { nickname: 'Точный получатель', client: 'Codex' },
      { threadId: f.profile.threadId!, socket: f.profile.socket },
    );
    const sender = service.connect({ nickname: 'Источник', client: 'MCP' });
    if (target.status !== 'connected' || sender.status !== 'connected') throw new Error();
    const send = (text: string) =>
      service.send({
        connectionId: sender.binding.connectionId,
        recipientNode: service.settings.value.nodeId,
        recipientNickname: target.nickname,
        text,
      });
    f.state.admission = 'lost';
    const uncertain = await send('An uncertain request must survive restart without a duplicate.');
    await until(() => service.store.dispatchState(uncertain.id)?.state === 'uncertain');
    await service.close();
    f.state.discoveryResult = 'error';
    f.state.admission = 'success';
    service = new NodeService(directory);
    await service.open();
    assert.equal(service.adapters.get(target.binding.adapterId).status().state, 'error');
    const queued = await send('Deliver only when the exact handler is available.');
    assert.equal(service.store.get(queued.id, 'in')?.state, 'ready');
    assert.equal(f.requests.filter((r) => r.method.startsWith('thread-follower-')).length, 1);
    // This fixture supplies an initialized handler, not a UI or a new binding.
    // Discovery itself cannot create a handler in an external application.
    f.state.discoveryResult = 'success';
    await until(() => service.store.get(queued.id, 'in')?.state === 'processed');
    assert.deepEqual(
      service.store.assertOwner(target.binding.connectionId).binding,
      target.binding,
    );
    assert.equal(service.store.dispatchState(uncertain.id)?.state, 'uncertain');
    assert.equal(service.store.get(uncertain.id, 'in')?.state, 'ready');
    assert.equal(service.store.get(uncertain.id, 'out')?.state, 'ready');
    const deliveries = f.requests.filter((r) => r.method.startsWith('thread-follower-'));
    assert.equal(deliveries.length, 2);
    assert.ok(deliveries.every((r) => r.params.conversationId === f.profile.threadId));
  },
);

test('Codex owner probe is read-only; idle admission inherits settings and targets only the discovered exact owner', async (t) => {
  const f = await fixture(t),
    adapter = new CodexDesktopAdapter(f.profile, () => {});
  t.after(() => adapter.stop());
  await adapter.start();
  assert.equal(adapter.status().state, 'ready');
  assert.ok(
    f.requests.every((r) =>
      ['initialize', 'thread-owner-discovery', 'thread-stream-following-changed'].includes(
        r.method,
      ),
    ),
  );
  assert.ok(
    f.requests.some(
      (r) => r.method === 'thread-stream-following-changed' && r.params.following === true,
    ),
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
      text: `**Incoming NCF Agent Interconnect**\nFrom: "Коллега"\n\nГотовое поручение\n\nReply-To: ${event.replyRef}\nUse agent_send(replyRef="${event.replyRef}", text) to reply.`,
      text_elements: [],
    },
  ]);
  assert.ok(!JSON.stringify(params).includes(event.binding.connectionId));
  assert.ok(!JSON.stringify(params).includes('untrusted_input'));
  assert.ok(!JSON.stringify(params).includes('approvalPolicy'));
  assert.ok(!JSON.stringify(params).includes('model'));
});

test(
  'Codex assembles a fragmented frame larger than 32 MiB and parses it only when complete',
  { timeout: 20000 },
  async (t) => {
    const f = await fixture(t);
    const unicode = 'Ж漢🙂';
    f.state.snapshotPadding = unicode.repeat(
      Math.ceil((33 * 1024 * 1024) / Buffer.byteLength(unicode)),
    );
    assert.ok(Buffer.byteLength(f.state.snapshotPadding) > 32 * 1024 * 1024);
    f.state.frameFragmentBytes = 1024 * 1024 - 17;
    const result = await codexExchange(f.profile, input(f.profile), undefined, 15000);
    assert.deepEqual(result, { state: 'admitted' });
    assert.equal(
      f.requests.filter((request) => request.method === 'thread-follower-start-turn').length,
      1,
    );
  },
);

test('Codex decodes coalesced frames and ignores a complete frame for another chat', async (t) => {
  const f = await fixture(t);
  f.state.coalesceSnapshots = true;
  f.state.snapshotPadding = 'Граница UTF-8 漢🙂';
  assert.deepEqual(await codexExchange(f.profile, input(f.profile)), { state: 'admitted' });
  assert.equal(
    f.requests.filter((request) => request.method === 'thread-follower-start-turn').length,
    1,
  );
});

test('Codex rejects invalid frame lengths and never parses an incomplete frame', async (t) => {
  await t.test('zero length', async (t) => {
    const f = await fixture(t);
    f.state.invalidSnapshotLength = 0;
    assert.deepEqual(await codexExchange(f.profile, input(f.profile)), {
      state: 'failed',
      error: 'Invalid Codex IPC frame',
      definiteNoBody: true,
    });
  });
  await t.test('length above the absolute limit', async (t) => {
    const f = await fixture(t);
    f.state.invalidSnapshotLength = CODEX_IPC_MAX_FRAME_BYTES + 1;
    assert.deepEqual(await codexExchange(f.profile, input(f.profile)), {
      state: 'failed',
      error: 'Invalid Codex IPC frame',
      definiteNoBody: true,
    });
  });
  await t.test('truncated JSON frame', async (t) => {
    const f = await fixture(t);
    f.state.truncateSnapshot = true;
    assert.deepEqual(await codexExchange(f.profile, input(f.profile), undefined, 50), {
      state: 'failed',
      error: 'Codex IPC: request timed out',
      definiteNoBody: true,
    });
    assert.ok(!f.requests.some((request) => request.method.startsWith('thread-follower-')));
  });
});

test('Codex active admission has required restore metadata; revoked binding never submits and lost admission is uncertain', async (t) => {
  const f = await fixture(t);
  f.state.runtime = 'active';
  const revoked = await codexExchange(f.profile, { ...input(f.profile), isCurrent: () => false });
  assert.equal(revoked.state, 'revoked');
  assert.ok(!f.requests.some((r) => r.method.startsWith('thread-follower-')));
  const event = input(f.profile);
  const deliveredAt = 1731846907000;
  const presented = 'R-0011 Codex active body';
  let presentationCalls = 0;
  event.presentMessage = () => {
    presentationCalls++;
    return { text: presented, deliveredAt };
  };
  assert.equal((await codexExchange(f.profile, event)).state, 'admitted');
  assert.equal(presentationCalls, 1);
  const request = f.requests.find((r) => r.method === 'thread-follower-steer-turn')!;
  assert.equal(request.version, 1);
  assert.deepEqual(request.params.input, [
    {
      type: 'text',
      text: presented,
      text_elements: [],
    },
  ]);
  assert.deepEqual(request.params.attachments, []);
  assert.equal(
    (request.params.restoreMessage as { id: string }).id,
    request.params.clientUserMessageId,
  );
  assert.equal((request.params.restoreMessage as { text: string }).text, presented);
  assert.equal((request.params.restoreMessage as { createdAt: number }).createdAt, deliveredAt);
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
      assert.deepEqual(result, {
        state: 'failed',
        error: scenario.error,
        definiteNoBody: true,
      });
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
      ['initialize', 'thread-owner-discovery', 'thread-stream-following-changed'].includes(
        request.method,
      ),
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
    deliveredAt = Date.UTC(2026, 10, 17, 9, 35, 7),
    display = { locale: 'en-GB', timeZone: 'Europe/Moscow' },
    service = new NodeService(directory, {
      presentationNow: () => deliveredAt,
      messageDisplayContext: () => display,
    });
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
  const stored = service.store.get(message.id, 'in')!;
  assert.ok(
    text.startsWith(
      `**Incoming NCF Agent Interconnect**\nFrom: "Исследователь"\nSent: ${formatAgentMessageTimestamp(stored.envelope.createdAt, display)}\nDelivered: ${formatAgentMessageTimestamp(deliveredAt, display)}\n\nПроверь расчёт.\nОтветь с результатом.\n\nAttachments:\n`,
    ),
  );
  const replyRef = 'r' + stored.sequence.toString(36);
  assert.ok(text.includes(`Reply-To "Исследователь": ${replyRef}\n`));
  assert.ok(!text.includes('From-Node:'));
  assert.ok(!text.includes('Message-ID:'));
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
  service.store.ensure('Café');
  const renameArgs = { connectionId: moved.binding.connectionId, nickname: 'CAFE\u0301' };
  const rename = (threadId: string, args = renameArgs, on = client) =>
    on.callTool({ name: 'agent_rename', arguments: args, _meta: { threadId } });
  const structured = (result: Awaited<ReturnType<Client['callTool']>>) =>
    result.structuredContent as Record<string, unknown> | undefined;
  const wrongChat = await rename(a.profile.threadId!);
  assert.equal(wrongChat.isError, true);
  assert.notEqual(structured(wrongChat)?.nextAction, 'agent_connect');
  assert.ok(!JSON.stringify(wrongChat).includes(moved.binding.chatId));
  assert.equal(
    (await rename(b.profile.threadId!, { ...renameArgs, connectionId: first.binding.connectionId }))
      .isError,
    true,
  );
  const before = service.store.list();
  const occupied = structured(await rename(b.profile.threadId!));
  assert.equal(occupied?.status, 'nickname_in_use');
  assert.equal(occupied?.nickname, 'Воевода');
  assert.match(
    String(occupied?.description),
    /current name is unchanged.*do not transfer or reset/i,
  );
  assert.deepEqual(service.store.list(), before);
  await client.close();

  // A new MCP client/server handshake models the MCP boundary after a host restart.
  const reopened = new Client({ name: 'Codex', version: 'test' });
  await reopened.connect(
    new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
      requestInit: { headers: { authorization: 'Bearer ' + service.settings.value.localToken } },
    }),
  );
  t.after(() => reopened.close());
  const instructions = reopened.getInstructions()!;
  assert.match(instructions, /reconnect this chat, call agent_connect/);
  assert.match(instructions, /new unbound chat.*means agent_connect with nickname X/);
  assert.match(instructions, /already bound as a different agent, ask whether/);
  assert.match(instructions, /change its agent name means agent_rename/);
  assert.match(instructions, /disconnect this chat, call agent_disconnect/);
  const catalog = await reopened.listTools();
  for (const name of ['agent_connect', 'agent_rename', 'agent_disconnect'])
    assert.match(
      catalog.tools.find((tool) => tool.name === name)!.description!,
      /new unbound chat.*means agent_connect with nickname X/,
    );

  const newName = 'Редактор';
  const unverified = await rename(
    b.profile.threadId!,
    { ...renameArgs, nickname: newName },
    reopened,
  );
  assert.equal(unverified.isError, true);
  assert.equal(structured(unverified)?.status, 'codex_rename_reconnect_required');
  assert.equal(structured(unverified)?.nextAction, 'agent_connect');
  assert.match(
    String(structured(unverified)?.description),
    /last confirmed nickname.*same connectionId/,
  );
  assert.match(
    String(structured(unverified)?.description),
    /After status=connected, call agent_rename once/,
  );
  assert.ok(!JSON.stringify(unverified).includes(moved.binding.connectionId));
  assert.deepEqual(service.store.list(), before);
  const conflictingMetadata = await reopened.callTool({
    name: 'agent_rename',
    arguments: { ...renameArgs, nickname: newName },
    _meta: {
      threadId: b.profile.threadId,
      'x-codex-turn-metadata': { thread_id: a.profile.threadId },
    },
  });
  assert.equal(conflictingMetadata.isError, true);
  assert.notEqual(structured(conflictingMetadata)?.nextAction, 'agent_connect');
  assert.deepEqual(service.store.list(), before);

  const restored = await reopened.callTool({
    name: 'agent_connect',
    arguments: { nickname: moved.nickname, connectionId: moved.binding.connectionId },
    _meta: { threadId: b.profile.threadId },
  });
  assert.equal(structured(restored)?.status, 'connected');
  assert.deepEqual(structured(restored)?.binding, moved.binding);
  const renamedArgs = { ...renameArgs, nickname: newName };
  assert.deepEqual(structured(await rename(b.profile.threadId!, renamedArgs, reopened)), {
    status: 'renamed',
    nickname: newName,
  });
  const unchanged = structured(await rename(b.profile.threadId!, renamedArgs, reopened));
  assert.equal(unchanged?.status, 'unchanged');
  assert.match(String(unchanged?.description), /already has the requested name/);
  assert.deepEqual(service.store.assertOwner(moved.binding.connectionId).binding, moved.binding);
  const metadataMissing = await reopened.callTool({
    name: 'agent_connect',
    arguments: { nickname: 'Другое имя' },
  });
  assert.equal(metadataMissing.isError, true);
  assert.match(JSON.stringify(metadataMissing), /current chat context/);

  const unbound = await reopened.callTool({
    name: 'agent_connect',
    arguments: { nickname: 'Новый агент' },
    _meta: { threadId: a.profile.threadId },
  });
  assert.equal(structured(unbound)?.status, 'connected');
  assert.equal(structured(unbound)?.nickname, 'Новый агент');
  const newBinding = structured(unbound)?.binding as { connectionId: string; chatId: string };
  assert.equal(newBinding.chatId, a.profile.threadId);
  const disconnect = () =>
    reopened.callTool({
      name: 'agent_disconnect',
      arguments: { connectionId: newBinding.connectionId },
      _meta: { threadId: a.profile.threadId },
    });
  assert.equal(structured(await disconnect())?.disconnected, true);
  const alreadyDisconnected = await disconnect();
  assert.equal(structured(alreadyDisconnected)?.status, 'connection_not_found');
  assert.match(String(structured(alreadyDisconnected)?.description), /already disconnected/);
  assert.equal(structured(alreadyDisconnected)?.nextAction, undefined);
});

test(
  'Codex queue recovery preserves the exact binding and waits for native receipt evidence',
  { skip: process.platform !== 'darwin' },
  async (t) => {
    const f = await fixture(t);
    const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-codex-queue-node-'));
    const service = new NodeService(directory, {
      codexSockets: () => [f.profile.socket!],
      wakeCodexChat: async () => {},
    });
    const client = new Client({ name: 'Codex', version: 'test' });
    t.after(async () => {
      try {
        await client.close();
      } finally {
        await service.close();
        await rm(directory, { recursive: true, force: true });
      }
    });
    await service.open();
    await client.connect(
      new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
        requestInit: { headers: { authorization: 'Bearer ' + service.settings.value.localToken } },
      }),
    );
    const threadId = f.profile.threadId!;
    const receiver = await service.connectCodex(
      { nickname: 'Recipient', client: 'Codex' },
      { threadId, socket: f.profile.socket },
    );
    const sender = service.connect({ nickname: 'Sender', client: 'MCP' });
    if (receiver.status !== 'connected' || sender.status !== 'connected') throw new Error();
    const binding = receiver.binding;
    const old = service.adapters.get(binding.adapterId);
    const oldStatus = old.status();
    f.state.discoveryResult = 'error';
    t.mock.method(old, 'status', () => ({
      ...oldStatus,
      state: 'error',
      error: 'Codex IPC: ECONNREFUSED',
    }));
    const start = t.mock.method(CodexQueueAdapter.prototype, 'start', async () => {});
    t.mock.method(CodexQueueAdapter.prototype, 'status', function (this: CodexQueueAdapter) {
      return { ...oldStatus, id: this.profile.id };
    });
    const queued: string[] = [];
    let project: (() => void) | undefined;
    const offer = t.mock.method(
      CodexQueueAdapter.prototype,
      'deliver',
      async (event: EventInput) => {
        const text = agentMessageText(event);
        event.beforeRelease!(text, {
          messageId: event.deliveryAttempt!.id,
          runtime: codexQueueWitness,
          session: threadId,
        });
        queued.push(text);
        return { state: 'queued' };
      },
    );
    t.mock.method(
      CodexQueueAdapter.prototype,
      'observeDelivery',
      (_attempt: object, isCurrent: () => boolean, admit: () => void) => {
        project = () => {
          assert.equal(isCurrent(), true);
          admit();
        };
      },
    );
    const challenges: string[] = [];
    t.mock.method(
      CodexQueueAdapter.prototype,
      'challenge',
      async function (this: CodexQueueAdapter, token: string, isCurrent: () => boolean) {
        assert.equal(this.profile.threadId, threadId);
        assert.equal(this.profile.socket, f.profile.socket);
        assert.equal(isCurrent(), true);
        challenges.push(token);
        return {
          state: 'uncertain',
          witness: { messageId: randomUUID(), payloadHash: 'fixture' },
        };
      },
    );
    let observation: 'queued' | 'unknown' | { admittedAt: number } = 'unknown';
    let launchCheck: (() => boolean) | undefined;
    const observed = t.mock.method(
      CodexQueueAdapter.prototype,
      'observeConfirmation',
      async function (this: CodexQueueAdapter, _witness: unknown, current?: () => boolean) {
        assert.equal(this.profile.threadId, threadId);
        if (current) {
          assert.ok(current());
          launchCheck = current;
        }
        return observation;
      },
    );

    const connect = (
      id: string,
      proof: { connectionId?: string; contextToken?: string; codexRecoveryToken?: string } = {},
    ) =>
      client.callTool({
        name: 'agent_connect',
        arguments: { nickname: 'Recipient', ...proof },
        _meta: { threadId: id },
      });
    const status = (result: Awaited<ReturnType<typeof connect>>) =>
      (result.structuredContent as { status?: string } | undefined)?.status;
    assert.equal((await connect(threadId, { connectionId: randomUUID() })).isError, true);
    assert.equal(
      (await connect(randomUUID(), { connectionId: binding.connectionId })).isError,
      true,
    );
    const pending = await connect(threadId);
    assert.equal(pending.isError, undefined);
    assert.equal(status(pending), 'codex_recovery_uncertain');
    assert.equal(status(await connect(threadId)), 'codex_recovery_uncertain');
    service.desktopChatGptLaunched();
    service.desktopChatGptLaunched();
    assert.equal(observed.mock.callCount(), 2, 'one read-only observation and one launch wake');
    assert.equal(launchCheck?.(), true);
    assert.equal(challenges.length, 1);
    const expiresAt = (pending.structuredContent as { expiresAt: string }).expiresAt;
    assert.ok(Date.parse(expiresAt) > Date.now());
    const token = challenges[0]!;
    assert.match(token, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
    assert.ok(!JSON.stringify(pending).includes(token));
    assert.ok(!JSON.stringify(pending).includes(binding.connectionId));
    assert.equal((await connect(threadId, { contextToken: randomUUID() })).isError, true);
    assert.equal((await connect(randomUUID(), { contextToken: token })).isError, true);
    assert.equal(
      (await connect(threadId, { contextToken: token, codexRecoveryToken: token })).isError,
      true,
    );
    assert.equal(start.mock.callCount(), 0);
    // A real busy stock chat may admit the ordinary confirmation well after issuance.
    const late = Date.now() + 15 * 60_000;
    const clock = t.mock.method(Date, 'now', () => late);
    observation = 'queued';
    assert.equal((await connect(threadId, { contextToken: token })).isError, true);
    observation = { admittedAt: late + 1000 };
    assert.equal((await connect(threadId, { contextToken: token })).isError, true);
    observation = { admittedAt: late - 1000 };
    const result = await connect(threadId, { contextToken: token });
    clock.mock.restore();
    assert.equal(result.isError, undefined);
    const recovered =
      result.structuredContent as unknown as import('../desktop/core/agent-store.js').ConnectResult;
    assert.equal(launchCheck?.(), false, 'the original wake loses authority after confirmation');
    if (recovered.status !== 'connected')
      throw new Error('The saved Codex binding was not recovered');
    assert.deepEqual(recovered.binding, binding);
    assert.equal((await connect(threadId, { contextToken: token })).isError, true);
    assert.equal((await connect(threadId, { codexRecoveryToken: token })).isError, true);
    assert.equal(
      status(await connect(threadId, { connectionId: binding.connectionId })),
      'connected',
    );
    assert.equal(
      service.settings.value.adapters.find((a) => a.id === binding.adapterId)?.codexQueue,
      true,
    );
    const message = await service.send({
      connectionId: sender.binding.connectionId,
      recipientNode: service.settings.value.nodeId,
      recipientNickname: 'Recipient',
      text: 'NCF delivers the original message.',
    });
    const deadline = Date.now() + 2000;
    while (!project) {
      if (Date.now() > deadline) throw new Error('Codex receipt observer was not registered');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(offer.mock.callCount(), 1);
    assert.match(queued[0]!, /^\*\*Incoming NCF Agent Interconnect\*\*/);
    assert.match(queued[0]!, /NCF delivers the original message/);
    assert.equal(service.store.dispatchState(message.id)?.state, 'dispatching');
    assert.equal(service.store.get(message.id, 'out')?.state, 'ready');
    for (const meta of [{ threadId: randomUUID() }, undefined]) {
      const denied = await client.callTool({
        name: 'agent_read',
        arguments: { connectionId: binding.connectionId },
        _meta: meta,
      });
      assert.equal(denied.isError, true);
      assert.equal(service.store.get(message.id, 'out')?.state, 'ready');
    }
    project();
    assert.equal(service.store.get(message.id, 'in')?.state, 'processed');
    while (service.store.get(message.id, 'out')?.state !== 'processed') {
      if (Date.now() > deadline) throw new Error('Codex receipt was not returned to sender');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(offer.mock.callCount(), 1);

    const peerDirectory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-codex-sender-'));
    const peer = new NodeService(peerDirectory, { codexSockets: () => [] });
    t.after(async () => {
      await peer.close();
      await rm(peerDirectory, { recursive: true, force: true });
    });
    await peer.open();
    await peer.network.join(service.snapshot().peerUrl, service.network.accessCode().code);
    const peerSender = peer.connect({ nickname: 'Remote sender', client: 'MCP' });
    if (peerSender.status !== 'connected') throw new Error('Could not bind the test sender');
    const ownerKey = service.store.assertOwner(binding.connectionId).key;
    const armRead = async () => {
      let signalArmed!: () => void;
      const armed = new Promise<void>((resolve) => {
        signalArmed = resolve;
      });
      const after = service.store.history(ownerKey).nextCursor;
      const readOnArrival = service.readOnArrival.bind(service);
      const mock = t.mock.method(
        service,
        'readOnArrival',
        (...args: Parameters<typeof readOnArrival>) => {
          const read = readOnArrival(...args);
          signalArmed();
          return read;
        },
      );
      const result = client.callTool({
        name: 'agent_read',
        arguments: { connectionId: binding.connectionId, waitMs: 5000, after },
        _meta: { threadId },
      });
      await armed;
      mock.mock.restore();
      return { result, after };
    };
    const sendFromPeer = (text: string, files?: string[]) =>
      peer.send({
        connectionId: peerSender.binding.connectionId,
        recipientNode: service.settings.value.nodeId,
        recipientNickname: 'Recipient',
        text,
        files,
      });
    const unreadPage = (result: Awaited<ReturnType<typeof client.callTool>>) =>
      result.structuredContent as {
        messages: {
          envelope: { id: string; text: string };
          replyRef: string;
          files: { name: string; localPath: string }[];
        }[];
        nextCursor: number;
      };
    const waitFor = async (check: () => boolean, error: string) => {
      const limit = Date.now() + 2000;
      while (!check()) {
        if (Date.now() > limit) throw new Error(error);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    };
    const waitForPeerState = (id: string, state: 'ready' | 'processed') =>
      waitFor(
        () => peer.store.get(id, 'out')?.state === state,
        'The paired sender did not reach ' + state,
      );

    await t.test(
      'a paired sender reaches the exact restored chat without an armed read',
      { timeout: 3000 },
      async () => {
        const priorProjection = project;
        const sent = await sendFromPeer('Ordinary input from a paired peer');
        await waitFor(
          () => project !== priorProjection,
          'The exact chat did not accept the submission',
        );
        await waitForPeerState(sent.id, 'ready');
        assert.equal(offer.mock.callCount(), 2);
        assert.match(queued.at(-1)!, /Ordinary input from a paired peer/);
        assert.equal(service.store.get(sent.id, 'in')?.state, 'ready');
        project!();
        await waitForPeerState(sent.id, 'processed');
      },
    );

    await t.test(
      'an armed read yields to native queue submission and returns before projection',
      { timeout: 3000 },
      async () => {
        const deliveries = offer.mock.callCount();
        const { result, after } = await armRead();
        const text = 'Прямая доставка после восстановления';
        const sent = await sendFromPeer(text);
        const response = await result;
        assert.equal(
          offer.mock.callCount(),
          deliveries + 1,
          'the armed MCP read must not preempt exact chat delivery',
        );
        assert.equal(response.isError, undefined);
        assert.deepEqual(unreadPage(response).messages, []);
        assert.equal(unreadPage(response).nextCursor, after);
        assert.ok(!JSON.stringify(response).includes(text));
        assert.match(queued.at(-1)!, /Прямая доставка после восстановления/);
        await waitForPeerState(sent.id, 'ready');
        project!();
        assert.equal(service.store.get(sent.id, 'in')?.state, 'processed');
        await waitForPeerState(sent.id, 'processed');
      },
    );

    await t.test(
      'a definite native failure falls back to one full MCP response in both formats',
      { timeout: 3000 },
      async () => {
        const deliveries = offer.mock.callCount();
        offer.mock.mockImplementationOnce(async () => ({ state: 'failed' }));
        const { result, after } = await armRead();
        const text = 'Резервный путь 東京\nВторая строка';
        const filename = path.join(peer.settings.value.exportRoots[0], 'план.txt');
        await writeFile(filename, 'Synthetic attachment', 'utf8');
        const sent = await sendFromPeer(text, [filename]);
        const response = await result;
        assert.equal(response.isError, undefined);
        const page = unreadPage(response);
        assert.deepEqual(
          page?.messages.map(({ envelope }) => [envelope.id, envelope.text]),
          [[sent.id, text]],
          'JSON-only callers must receive the original text',
        );
        assert.equal(offer.mock.callCount(), deliveries + 1);
        assert.ok(page.nextCursor > after);
        assert.match(page.messages[0].replyRef, /^r[0-9a-z]+$/);
        assert.equal(page.messages[0].files[0].name, 'план.txt');
        assert.equal(
          await readFile(page.messages[0].files[0].localPath, 'utf8'),
          'Synthetic attachment',
        );
        assert.ok(Array.isArray(response.content));
        assert.equal(response.content[0]?.type, 'text');
        assert.ok(String(response.content[0]?.text).includes(text));
        assert.ok(String(response.content[0]?.text).includes('план.txt'));
        await waitForPeerState(sent.id, 'processed');
        const later = await client.callTool({
          name: 'agent_read',
          arguments: { connectionId: binding.connectionId },
          _meta: { threadId },
        });
        assert.deepEqual(unreadPage(later).messages, []);
      },
    );

    await t.test(
      'an uncertain native release cannot leak through the waiting read or retry',
      { timeout: 3000 },
      async () => {
        const deliveries = offer.mock.callCount();
        offer.mock.mockImplementationOnce(async (event: EventInput) => {
          event.beforeRelease!(agentMessageText(event), {
            messageId: event.deliveryAttempt!.id,
            runtime: codexQueueWitness,
            session: threadId,
          });
          return { state: 'uncertain' };
        });
        const { result, after } = await armRead();
        const text = 'Possibly admitted only once';
        const sent = await sendFromPeer(text);
        const response = await result;
        assert.equal(response.isError, undefined);
        assert.deepEqual(unreadPage(response).messages, []);
        assert.equal(unreadPage(response).nextCursor, after);
        assert.ok(!JSON.stringify(response).includes(text));
        assert.equal(service.store.dispatchState(sent.id)?.state, 'uncertain');
        assert.equal(service.store.get(sent.id, 'in')?.state, 'ready');
        await waitForPeerState(sent.id, 'ready');
        const later = await client.callTool({
          name: 'agent_history',
          arguments: { connectionId: binding.connectionId, after },
          _meta: { threadId },
        });
        assert.ok(!JSON.stringify(later).includes(text));
        service.desktopChatGptLaunched();
        assert.equal(offer.mock.callCount(), deliveries + 1);
      },
    );
  },
);

test('Disconnected Codex can confirm the same exact chat under the old or a free name', async (t) => {
  for (const nickname of ['Идея7', 'Мика']) {
    await t.test(nickname, async (t) => {
      const f = await fixture(t);
      const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-codex-rebind-'));
      const service = new NodeService(directory, { codexSockets: () => [] });
      const client = new Client({ name: 'Codex', version: 'test' });
      t.after(async () => {
        await client.close();
        await service.close();
        await rm(directory, { recursive: true, force: true });
      });
      await service.open();
      const threadId = f.profile.threadId!;
      const first = await service.connectCodex(
        { nickname: 'Идея7', client: 'Codex' },
        {
          threadId,
          socket: f.profile.socket,
        },
      );
      if (first.status !== 'connected') throw new Error('Missing fixture binding');
      const saved = service.settings.value.adapters.find((p) => p.id === first.binding.adapterId)!;
      let expectedSocket = saved.socket;
      if (process.platform === 'win32') {
        const fixtureHome = await realpath(directory);
        const home = path.join(fixtureHome, '.codex');
        await mkdir(home);
        expectedSocket = codexQueueLocator(home);
        if (nickname === 'Идея7') {
          // Cover a Desktop pipe without a remembered config.toml or a real profile.
          const homeMock = t.mock.method(os, 'homedir', () => fixtureHome);
          syncBuiltinESMExports();
          t.after(() => {
            homeMock.mock.restore();
            syncBuiltinESMExports();
          });
          saved.socket = codexEndpoints()[0];
        } else {
          saved.socket = expectedSocket;
          saved.codexQueue = true;
        }
        await service.settings.save();
      }
      const sent = await service.send({
        connectionId: first.binding.connectionId,
        recipientNode: service.settings.value.nodeId,
        recipientNickname: 'History recipient',
        text: 'History before disconnect',
      });
      const before = await service.userCall('chatHistory', { nickname: 'Идея7' });
      assert.match(JSON.stringify(before), new RegExp(sent.id));
      const challenges: string[] = [];
      let offerState: 'queued' | 'dispatched' = 'dispatched';
      const observe = t.mock.method(
        CodexQueueAdapter.prototype,
        'observeConfirmation',
        async () => 'missing',
      );
      t.mock.method(
        CodexQueueAdapter.prototype,
        'challenge',
        async function (this: CodexQueueAdapter, token: string, current: () => boolean) {
          assert.equal(this.profile.threadId, threadId);
          assert.equal(this.profile.socket, expectedSocket);
          assert.equal(current(), true);
          challenges.push(token);
          return {
            state: offerState,
            witness: { messageId: randomUUID(), payloadHash: 'fixture' },
          };
        },
      );
      t.mock.method(CodexQueueAdapter.prototype, 'start', async () => {});
      const ready = service.adapters.get(saved.id).status();
      t.mock.method(CodexQueueAdapter.prototype, 'status', function (this: CodexQueueAdapter) {
        return { ...ready, id: this.profile.id };
      });
      t.mock.method(service.adapters.get(saved.id), 'status', () => ({
        ...ready,
        state: 'error',
        error: 'Codex IPC: ECONNREFUSED',
      }));
      await client.connect(
        new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
          requestInit: {
            headers: { authorization: 'Bearer ' + service.settings.value.localToken },
          },
        }),
      );
      const call = (name: string, args: Record<string, unknown>, thread = threadId) =>
        client.callTool({ name, arguments: args, _meta: { threadId: thread } });
      const connect = (name: string, contextToken?: string, thread?: string) =>
        call(
          'agent_connect',
          { nickname: name, ...(contextToken ? { contextToken } : {}) },
          thread,
        );
      const disconnect = (connectionId: string) => call('agent_disconnect', { connectionId });
      const status = (result: Awaited<ReturnType<typeof connect>>) =>
        (result.structuredContent as { status?: string } | undefined)?.status;
      assert.equal((await connect('Мика')).isError, true, 'Active owner blocks an alias');
      assert.equal((await disconnect(first.binding.connectionId)).isError, undefined);
      const occupied = service.connect({ nickname: 'Occupied', client: 'MCP' });
      if (occupied.status !== 'connected') throw new Error('Missing occupied name');
      assert.equal((await connect(occupied.nickname)).isError, true);
      const duplicate = { ...saved, id: randomUUID() };
      service.settings.value.adapters.push(duplicate);
      try {
        assert.equal((await connect(nickname)).isError, true);
      } finally {
        service.settings.value.adapters.pop();
      }
      assert.equal(challenges.length, 0);
      if (nickname === 'Мика') {
        offerState = 'queued';
        const queued = await connect(nickname);
        assert.equal(status(queued), 'codex_recovery_queued');
        assert.equal(status(await connect(nickname)), 'codex_recovery_unavailable');
        assert.equal(status(await connect(nickname)), 'codex_recovery_unavailable');
        assert.equal(observe.mock.callCount(), 1);
        assert.equal(challenges.length, 1);
        assert.equal((await connect(nickname, challenges[0]!)).isError, true);
        const expiresAt = (queued.structuredContent as { expiresAt: string }).expiresAt;
        const clock = t.mock.method(Date, 'now', () => Date.parse(expiresAt) + 1);
        try {
          assert.equal(status(await connect(nickname)), 'codex_recovery_expired');
          assert.equal(challenges.length, 1);
        } finally {
          clock.mock.restore();
        }
        const second = await connect(nickname);
        assert.equal(status(second), 'codex_recovery_queued');
        const late = Date.now() + 12 * 60_000;
        const afterAdmission = t.mock.method(Date, 'now', () => late);
        observe.mock.mockImplementation(async () => ({ admittedAt: late - 6 * 60_000 }));
        try {
          assert.equal((await connect(nickname, challenges.at(-1)!)).isError, true);
          assert.equal(status(await connect(nickname)), 'codex_recovery_expired');
        } finally {
          afterAdmission.mock.restore();
        }
        offerState = 'dispatched';
      }
      const previousChallenges = challenges.length;
      const pending = await connect(nickname);
      assert.equal(pending.isError, undefined, JSON.stringify(pending));
      assert.equal(status(pending), 'codex_recovery_pending');
      assert.equal(challenges.length, previousChallenges + 1);
      const stale = challenges[previousChallenges]!;
      assert.equal((await connect(nickname, stale, randomUUID())).isError, true);
      assert.equal((await connect('Another name', stale)).isError, true);
      // An intervening owner can claim and release this exact chat. The earlier
      // confirmation must not become valid again after that disconnect.
      const intervening = service.connect({
        nickname: 'Other owner',
        client: 'Codex',
        chatId: threadId,
        adapterId: saved.id,
      });
      if (intervening.status !== 'connected') throw new Error('Missing intervening owner');
      assert.equal((await connect(nickname, stale)).isError, true);
      assert.equal((await disconnect(intervening.binding.connectionId)).isError, undefined);
      assert.equal((await connect(nickname, stale)).isError, true);
      assert.equal(status(await connect(nickname)), 'codex_recovery_pending');
      assert.equal(challenges.length, previousChallenges + 2);
      const token = challenges[previousChallenges + 1]!;
      const result = await connect(nickname, token);
      assert.equal(result.isError, undefined, JSON.stringify(result));
      const recovered = result.structuredContent as unknown as typeof first;
      assert.equal(recovered.status, 'connected');
      assert.equal(recovered.binding.chatId, threadId);
      assert.equal(recovered.binding.adapterId, first.binding.adapterId);
      assert.notEqual(recovered.binding.connectionId, first.binding.connectionId);
      assert.equal(recovered.binding.generation, nickname === 'Идея7' ? 2 : 1);
      assert.equal((await connect(nickname, token)).isError, true);
      assert.equal(
        service.settings.value.adapters.filter((p) => p.threadId === threadId).length,
        1,
      );
      assert.deepEqual(await service.userCall('chatHistory', { nickname: 'Идея7' }), before);
      if (nickname === 'Мика') {
        assert.equal(
          service.store.list().find((agent) => agent.nickname === 'Идея7')?.binding,
          null,
        );
        assert.doesNotMatch(
          JSON.stringify(await service.userCall('chatHistory', { nickname })),
          /History before disconnect/,
        );
      }
    });
  }
});

test('Codex queue recovery offers a transfer only in the exact verified destination', async (t) => {
  const f = await fixture(t);
  const directory = await realpath(
    await mkdtemp(path.join(os.tmpdir(), 'interconnect-codex-move-')),
  );
  const profileHome = path.join(directory, 'codex-profile');
  const configFile = path.join(profileHome, 'config.toml');
  const service = new NodeService(directory, {
    codexSockets: () => [],
    runningCodexConfiguration: () => Promise.resolve(configFile),
  });
  const client = new Client({ name: 'Codex', version: 'test' });
  t.after(async () => {
    await client.close();
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  await service.open();
  await mkdir(profileHome, { mode: 0o700 });
  await writeFile(configFile, service.clientInstructions('codex').configuration, { mode: 0o600 });
  const originalName = 'Хранитель истории';
  const nickname = 'Хранитель';
  const source = await service.connectCodex(
    { nickname: originalName, client: 'Codex' },
    {
      threadId: f.profile.threadId!,
      socket: f.profile.socket,
    },
  );
  const sender = service.connect({ nickname: 'Sender', client: 'MCP' });
  if (source.status !== 'connected' || sender.status !== 'connected')
    throw new Error('Missing fixture binding');
  const identity = service.store.list().find((agent) => agent.nickname === originalName)!;
  assert.deepEqual(
    await service.userCall('renameAgent', {
      key: identity.key,
      incarnation: identity.incarnation,
      currentNickname: originalName,
      nickname,
    }),
    { status: 'renamed' },
  );
  const sourceAdapter = service.adapters.get(source.binding.adapterId);
  const baseStatus = sourceAdapter.status();
  const quiet = { ...baseStatus, capabilities: { ...baseStatus.capabilities, wakeIdle: false } };
  t.mock.method(sourceAdapter, 'status', () => quiet);
  const file = path.join(service.settings.value.exportRoots[0], 'transfer.txt');
  await writeFile(file, 'Verified history and attachment');
  const pending = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: nickname,
    text: 'Pending delivery',
    files: [file],
  });
  const before = service.store.get(pending.id, 'in');
  assert.equal(before?.state, 'ready');
  const current = () => service.store.list().find((agent) => agent.nickname === nickname)?.binding;
  const destination = randomUUID();
  const unknown = randomUUID();
  let confirmation: string | undefined;
  let queueReady = true;
  t.mock.method(
    CodexQueueAdapter.prototype,
    'challenge',
    async function (this: CodexQueueAdapter, token: string, isCurrent: () => boolean) {
      assert.equal(this.profile.socket, codexQueueLocator(profileHome));
      assert.equal(isCurrent(), true);
      if (this.profile.threadId !== destination) return { state: 'failed' };
      assert.equal(confirmation, undefined);
      confirmation = token;
      return { state: 'dispatched', witness: { messageId: randomUUID(), payloadHash: 'fixture' } };
    },
  );
  const probe = t.mock.method(CodexQueueAdapter.prototype, 'start', async () => {});
  t.mock.method(CodexQueueAdapter.prototype, 'status', function (this: CodexQueueAdapter) {
    assert.equal(this.profile.threadId, destination);
    return queueReady
      ? { ...quiet, id: this.profile.id }
      : { ...quiet, id: this.profile.id, state: 'error', error: 'Exact destination unavailable' };
  });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
      requestInit: { headers: { authorization: 'Bearer ' + service.settings.value.localToken } },
    }),
  );
  const connect = (threadId: string, args: Record<string, unknown> = {}) =>
    client.callTool({
      name: 'agent_connect',
      arguments: { nickname, ...args },
      _meta: { threadId },
    });
  const denied = await connect(unknown);
  assert.equal(denied.isError, true);
  assert.match(
    JSON.stringify(denied.content),
    /chat’s route for confirmation could not be verified/,
  );
  assert.equal(
    service.settings.value.adapters.some((profile) => profile.threadId === unknown),
    false,
  );
  assert.deepEqual(current(), source.binding);

  const challenge = await connect(destination);
  assert.equal(challenge.isError, undefined, JSON.stringify(challenge));
  assert.equal(
    (challenge.structuredContent as { status?: string })?.status,
    'codex_recovery_pending',
  );
  assert.ok(confirmation);
  assert.ok(!JSON.stringify(challenge).includes(confirmation));
  assert.equal((await connect(unknown, { contextToken: confirmation })).isError, true);
  const proof = await connect(destination, { contextToken: confirmation });
  assert.equal(proof.isError, undefined, JSON.stringify(proof));
  const offer =
    proof.structuredContent as unknown as import('../desktop/core/agent-store.js').ConnectResult;
  if (offer.status !== 'nickname_in_use') throw new Error('Missing transfer offer');
  assert.equal(offer.requestingChat.chatId, destination);
  assert.equal(offer.userApprovalRequired, true);
  assert.deepEqual(current(), source.binding);
  const approval = {
    connectionId: offer.connectionId,
    transferId: offer.transferId,
    confirmTransfer: true,
  };
  assert.equal((await connect(unknown, approval)).isError, true);
  assert.equal((await connect(destination, { ...approval, resetHistory: true })).isError, true);
  queueReady = false;
  assert.equal((await connect(destination, approval)).isError, true);
  assert.deepEqual(current(), source.binding);
  assert.deepEqual(service.store.get(pending.id, 'in'), before);

  queueReady = true;
  const moved = await connect(destination, approval);
  assert.equal(moved.isError, undefined, JSON.stringify(moved));
  assert.equal((moved.structuredContent as { status?: string })?.status, 'connected');
  assert.equal(current()?.chatId, destination);
  assert.equal(current()?.generation, source.binding.generation + 1);
  assert.throws(() => service.store.assertOwner(source.binding.connectionId));
  assert.deepEqual(service.store.get(pending.id, 'in'), before);
  assert.equal(await service.files.exists(before.envelope.attachments[0]), true);
  assert.equal((await connect(destination, approval)).isError, true);
  assert.ok(probe.mock.callCount() >= 3);
});

test('Codex records a last-verified observation on success and keeps it as history after a later failure', async (t) => {
  const f = await fixture(t),
    adapter = new CodexDesktopAdapter(f.profile, () => {});
  t.after(() => adapter.stop());
  await adapter.start();
  assert.equal(adapter.status().state, 'ready');
  const stamp = adapter.status().lastOwnerVerifiedAt;
  assert.ok(stamp && !Number.isNaN(Date.parse(stamp)));
  f.state.discoveryResult = 'error';
  await adapter.start();
  assert.equal(adapter.status().state, 'error');
  // The previous successful observation remains as historical evidence only.
  assert.equal(adapter.status().lastOwnerVerifiedAt, stamp);
  const before = new Set([...f.requests.map((request) => request.method)]);
  assert.ok(
    [...before].every((method) =>
      ['initialize', 'thread-owner-discovery', 'thread-stream-following-changed'].includes(method),
    ),
  );
  f.state.discoveryResult = 'success';
  await adapter.start();
  const refreshed = adapter.status().lastOwnerVerifiedAt;
  assert.ok(refreshed && refreshed >= stamp);
});

test('Codex keeps the previous verified stamp when a later attempt fails or is stopped', async (t) => {
  const f = await fixture(t),
    adapter = new CodexDesktopAdapter(f.profile, () => {});
  t.after(() => adapter.stop());
  await adapter.start();
  const stamp = adapter.status().lastOwnerVerifiedAt;
  assert.ok(stamp);
  f.state.support = false;
  f.state.discoveryResult = 'error';
  await adapter.start();
  assert.equal(adapter.status().state, 'error');
  // A failed or stopped attempt must not clear or refresh the historical stamp.
  assert.equal(adapter.status().lastOwnerVerifiedAt, stamp);
  await adapter.stop();
  assert.equal(adapter.status().lastOwnerVerifiedAt, stamp);
});

async function registeredFixture(t: test.TestContext) {
  const f = await fixture(t),
    registry = new AdapterRegistry();
  let idle = 0,
    changed = 0;
  registry.on('idle', () => idle++);
  registry.on('change', () => changed++);
  t.after(() => registry.close());
  await registry.add(f.profile);
  return {
    ...f,
    registry,
    adapter: registry.get(f.profile.id),
    notifications: () => ({ idle, changed }),
  };
}

test(
  'Codex idleness adds no calls and one delivery performs exactly one exact preflight',
  { timeout: 10000 },
  async (t) => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 2000000 });
    const connections = t.mock.method(net, 'createConnection'),
      f = await registeredFixture(t);
    const count = (method: string) =>
      f.requests.filter((request) => request.method === method).length;
    const before = {
      connections: connections.mock.callCount(),
      initialize: count('initialize'),
      discovery: count('thread-owner-discovery'),
      inputs: count('thread-follower-start-turn') + count('thread-follower-steer-turn'),
      notifications: f.notifications(),
    };
    t.mock.timers.tick(60000);
    await Promise.resolve();
    assert.equal(connections.mock.callCount(), before.connections);
    assert.deepEqual(f.notifications(), before.notifications);
    f.state.runtime = 'active';
    assert.equal((await f.adapter.deliver(input(f.profile))).state, 'admitted');
    assert.equal(connections.mock.callCount() - before.connections, 1);
    assert.equal(count('initialize') - before.initialize, 1);
    assert.equal(count('thread-owner-discovery') - before.discovery, 1);
    assert.equal(
      count('thread-follower-start-turn') + count('thread-follower-steer-turn') - before.inputs,
      1,
    );
    assert.ok(
      f.requests
        .filter(
          (request) =>
            request.method === 'thread-owner-discovery' ||
            request.method.startsWith('thread-follower-'),
        )
        .every((request) => request.params.conversationId === f.profile.threadId),
    );
    assert.deepEqual(
      f.notifications(),
      before.notifications,
      'metadata alone must not emit idle/change',
    );
  },
);

test(
  'an older held Codex probe cannot replace newer failure evidence or emit idle',
  { timeout: 10000 },
  async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: 2000000 });
    const f = await registeredFixture(t),
      arrival = f.holdDiscovery(),
      older = f.adapter.start();
    assert.equal(f.adapter.start(), older, 'coalesced start must not create another observation');
    const held = await arrival;
    f.state.discoveryResult = 'error';
    assert.equal((await f.adapter.deliver(input(f.profile))).state, 'failed');
    const failure = f.adapter.status(),
      notifications = f.notifications(),
      requests = () =>
        f.requests.filter((request) => request.method !== 'thread-stream-following-changed'),
      count = requests().length;
    assert.equal(failure.state, 'error');
    assert.equal(failure.capabilities.wakeIdle, false);
    t.mock.timers.tick(1000);
    held.release();
    await older;
    assert.deepEqual(f.adapter.status(), failure);
    assert.deepEqual(f.notifications(), notifications);
    assert.equal(requests().length, count);
    assert.ok(!f.requests.some((request) => request.method.startsWith('thread-follower-')));
  },
);

test(
  'a late uncertain Codex admission returns to its caller without replacing newer health or retrying',
  { timeout: 10000 },
  async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: 2000000 });
    const timers = t.mock.method(globalThis, 'setTimeout'),
      f = await registeredFixture(t),
      before = f.notifications(),
      arrival = f.holdAdmission();
    t.mock.timers.tick(1000);
    const delivery = f.adapter.deliver(input(f.profile)),
      held = await arrival;
    assert.equal(
      f.adapter.status().lastOwnerVerifiedAt,
      new Date().toISOString(),
      'proof precedes admission',
    );
    assert.deepEqual(f.notifications(), before, 'proof metadata cannot trigger drain');
    t.mock.timers.tick(1000);
    await f.adapter.start();
    const newer = f.adapter.status(),
      notifications = f.notifications(),
      recoveries = () => timers.mock.calls.filter((call) => call.arguments[1] === 3000).length,
      retryCount = recoveries();
    t.mock.timers.tick(1000);
    held.disconnect();
    assert.equal((await delivery).state, 'uncertain');
    assert.deepEqual(f.adapter.status(), newer);
    assert.deepEqual(f.notifications(), notifications);
    assert.equal(recoveries(), retryCount, 'obsolete outcome must not schedule recovery');
    assert.equal(
      f.requests.filter((request) => request.method.startsWith('thread-follower-')).length,
      1,
    );
  },
);

test(
  'stop invalidates a pending Codex proof and all later shared completion effects',
  { timeout: 10000 },
  async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: 2000000 });
    const connections = t.mock.method(net, 'createConnection'),
      f = await registeredFixture(t),
      before = f.adapter.status(),
      arrival = f.holdDiscovery(),
      pending = f.adapter.start(),
      held = await arrival,
      notifications = f.notifications();
    t.mock.timers.tick(1000);
    await f.adapter.stop();
    await pending;
    held.release();
    const connectionCount = connections.mock.callCount();
    await f.adapter.start();
    assert.equal((await f.adapter.deliver(input(f.profile))).state, 'failed');
    assert.equal(connections.mock.callCount(), connectionCount);
    assert.deepEqual(f.adapter.status(), before);
    assert.deepEqual(f.notifications(), notifications);
  },
);

test(
  'a pending delivery stopped after submission still returns uncertain without publishing health',
  { timeout: 10000 },
  async (t) => {
    const f = await registeredFixture(t),
      arrival = f.holdAdmission(),
      pending = f.adapter.deliver(input(f.profile)),
      held = await arrival,
      before = f.adapter.status(),
      notifications = f.notifications();
    await f.adapter.stop();
    assert.equal((await pending).state, 'uncertain');
    held.release();
    assert.deepEqual(f.adapter.status(), before);
    assert.deepEqual(f.notifications(), notifications);
    assert.equal(
      f.requests.filter((request) => request.method.startsWith('thread-follower-')).length,
      1,
    );
  },
);

test(
  'an old Codex probe cannot publish into a replacement adapter with the same profile',
  { timeout: 10000 },
  async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: 2000000 });
    const f = await registeredFixture(t),
      arrival = f.holdDiscovery(),
      pending = f.adapter.start(),
      held = await arrival;
    t.mock.timers.tick(1000);
    await f.registry.add(f.profile);
    await pending;
    const replacement = f.registry.get(f.profile.id),
      status = replacement.status(),
      notifications = f.notifications(),
      calls = f.requests.length;
    assert.notEqual(replacement, f.adapter);
    t.mock.timers.tick(1000);
    held.release();
    await Promise.resolve();
    assert.deepEqual(replacement.status(), status);
    assert.deepEqual(f.notifications(), notifications);
    assert.equal(f.requests.length, calls);
  },
);

test(
  'existing Codex failure recovery survives an older coalesced probe without extra idle',
  { timeout: 10000 },
  async (t) => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 2000000 });
    const f = await registeredFixture(t),
      arrival = f.holdDiscovery(),
      older = f.adapter.start(),
      held = await arrival;
    f.state.discoveryResult = 'error';
    assert.equal((await f.adapter.deliver(input(f.profile))).state, 'failed');
    const before = f.notifications();
    t.mock.timers.tick(3000);
    await Promise.resolve();
    assert.equal(f.requests.filter((request) => request.method === 'initialize').length, 3);
    const retryArrival = f.holdDiscovery();
    f.state.discoveryResult = 'success';
    held.release();
    await older;
    const retry = await retryArrival;
    assert.deepEqual(f.notifications(), before, 'older probe cannot emit a recovery event');
    const recovered = new Promise<void>((resolve) => f.registry.once('idle', resolve));
    retry.release();
    await recovered;
    assert.equal(f.adapter.status().state, 'ready');
    assert.equal(f.notifications().idle, before.idle + 1);
    assert.equal(f.requests.filter((request) => request.method === 'initialize').length, 4);
    assert.ok(!f.requests.some((request) => request.method.startsWith('thread-follower-')));
  },
);

test(
  'stop cancels recovery waiting for an older Codex probe without another network attempt',
  { timeout: 10000 },
  async (t) => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 2000000 });
    const connections = t.mock.method(net, 'createConnection'),
      f = await registeredFixture(t),
      arrival = f.holdDiscovery(),
      older = f.adapter.start();
    await arrival;
    f.state.discoveryResult = 'error';
    assert.equal((await f.adapter.deliver(input(f.profile))).state, 'failed');
    const notifications = f.notifications(),
      count = connections.mock.callCount();
    t.mock.timers.tick(3000);
    await Promise.resolve();
    await f.adapter.stop();
    await older;
    t.mock.timers.tick(60000);
    await Promise.resolve();
    assert.equal(connections.mock.callCount(), count);
    assert.deepEqual(f.notifications(), notifications);
  },
);

test(
  'a ready event during an occupied dispatch key redrains once without replaying uncertain input',
  { timeout: 15000 },
  async (t) => {
    for (const outcome of ['failed', 'uncertain'] as const)
      await t.test(outcome, async (t) => {
        const f = await fixture(t),
          directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-codex-redrain-')),
          service = new NodeService(directory);
        t.after(async () => {
          await service.close();
          await rm(directory, { recursive: true, force: true });
        });
        await service.open();
        const receiver = await service.connectCodex(
            { nickname: 'Получатель', client: 'Codex' },
            { threadId: f.profile.threadId!, socket: f.profile.socket },
          ),
          sender = service.connect({ nickname: 'Автор', client: 'MCP' });
        if (receiver.status !== 'connected' || sender.status !== 'connected') throw new Error();
        const adapter = service.adapters.get(receiver.binding.adapterId),
          actualDeliver = adapter.deliver.bind(adapter),
          delivered: string[] = [];
        let started!: () => void, release!: () => void;
        const firstStarted = new Promise<void>((resolve) => (started = resolve)),
          held = new Promise<void>((resolve) => (release = resolve));
        adapter.deliver = async (event) => {
          delivered.push(event.messageId);
          if (delivered.length === 1) {
            started();
            await held;
            if (outcome === 'uncertain')
              event.beforeRelease?.(JSON.stringify({ input: 'Synthetic uncertain release' }));
            return { state: outcome, error: 'Synthetic preflight outcome' };
          }
          return actualDeliver(event);
        };
        const send = (text: string) =>
            service.send({
              connectionId: sender.binding.connectionId,
              recipientNode: service.settings.value.nodeId,
              recipientNickname: receiver.nickname,
              text,
            }),
          first = await send('First queued request'),
          waitUntil = async (check: () => boolean) => {
            const deadline = Date.now() + 7000;
            while (!check()) {
              if (Date.now() > deadline) throw new Error('Queued Codex recovery timed out');
              await new Promise((resolve) => setTimeout(resolve, 10));
            }
          };
        await firstStarted;
        const second = await send('Second queued request');
        service.adapters.emit('idle');
        release();
        await waitUntil(() => service.store.get(second.id, 'in')?.state === 'processed');
        assert.equal(service.store.dispatchState(second.id)?.state, 'admitted');
        if (outcome === 'failed') {
          await waitUntil(() => service.store.get(first.id, 'in')?.state === 'processed');
          assert.deepEqual(delivered, [first.id, first.id, second.id]);
          assert.equal(service.store.dispatchState(first.id)?.state, 'admitted');
        } else {
          assert.deepEqual(delivered, [first.id, second.id]);
          assert.equal(service.store.get(first.id, 'in')?.state, 'ready');
          assert.equal(service.store.dispatchState(first.id)?.state, 'uncertain');
        }
      });
  },
);

test(
  'a late uncertain dispatch remains pending in the store after a newer Codex proof',
  { timeout: 10000 },
  async (t) => {
    const f = await fixture(t),
      directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-codex-late-uncertain-')),
      service = new NodeService(directory);
    t.after(async () => {
      await service.close();
      await rm(directory, { recursive: true, force: true });
    });
    await service.open();
    const receiver = await service.connectCodex(
      { nickname: 'Получатель', client: 'Codex' },
      { threadId: f.profile.threadId!, socket: f.profile.socket },
    );
    const sender = service.connect({ nickname: 'Автор', client: 'MCP' });
    if (receiver.status !== 'connected' || sender.status !== 'connected') throw new Error();
    const arrival = f.holdAdmission();
    const sent = await service.send({
      connectionId: sender.binding.connectionId,
      recipientNode: service.settings.value.nodeId,
      recipientNickname: receiver.nickname,
      text: 'Keep this uncertain request without replaying or acknowledging it.',
    });
    const held = await arrival,
      adapter = service.adapters.get(receiver.binding.adapterId);
    await adapter.start();
    const newer = adapter.status();
    const recorded = new Promise<void>((resolve) => {
      const changed = () => {
        if (service.store.dispatchState(sent.id)?.state !== 'uncertain') return;
        service.off('change', changed);
        resolve();
      };
      service.on('change', changed);
    });
    held.disconnect();
    await recorded;
    assert.deepEqual(adapter.status(), newer);
    assert.equal(service.store.dispatchState(sent.id)?.state, 'uncertain');
    assert.equal(service.store.get(sent.id, 'in')?.state, 'ready');
    assert.equal(service.store.get(sent.id, 'out')?.state, 'ready');
    assert.equal(
      service.snapshot().agents.find((agent) => agent.nickname === receiver.nickname)?.unread,
      1,
    );
    assert.equal(
      f.requests.filter((request) => request.method.startsWith('thread-follower-')).length,
      1,
    );
  },
);

test('agent_connect keeps MCP available and resumes the same saved Codex binding after a native failure', async (t) => {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ncf-connect-stage-')));
  const threadId = randomUUID();
  const profile: AdapterProfile = {
    id: randomUUID(),
    label: 'Fixture',
    kind: 'codex-desktop',
    codexQueue: true,
    socket: codexQueueLocator(directory),
    threadId,
  };
  let rejectItems = true;
  let discoveries = 0;
  const service = new NodeService(directory, {
    codexSockets: () => {
      discoveries++;
      return [];
    },
  });
  const client = new Client({ name: 'Codex', version: 'fixture' });
  t.after(async () => {
    await client.close();
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  const submitted: string[] = [];
  const queued: object[] = [];
  t.mock.method(
    CodexQueueAdapter,
    'forDesktop',
    (p: AdapterProfile, changed: () => void) =>
      new CodexQueueAdapter(
        p,
        changed,
        undefined,
        async () => 'synthetic-transcript',
        async (_p, _signal, operation) =>
          operation(async (method, params) => {
            assert.equal((params as { threadId: string }).threadId, threadId);
            if (method === 'thread/read')
              return {
                thread: {
                  id: threadId,
                  ephemeral: false,
                  path: 'synthetic-transcript',
                  status: { type: 'idle' },
                },
              };
            if (method === 'thread/items/list' && rejectItems) throw Error('private diagnostic');
            if (method === 'thread/queue/add') {
              const input = params as { clientUserMessageId: string; input: { text: string }[] };
              submitted.push(input.input[0].text);
              queued.push(input);
              return { queuedSubmission: { id: randomUUID(), ...input } };
            }
            if (method === 'thread/queue/list') return { data: queued };
            assert.ok(['thread/turns/list', 'thread/items/list'].includes(method));
            return { data: [] };
          }),
      ),
  );
  await service.open();
  await service.installAdapter(profile);
  const saved = service.connect({
    nickname: 'Receiver',
    client: 'Codex',
    chatId: threadId,
    adapterId: profile.id,
  });
  if (saved.status !== 'connected') throw Error('fixture');
  await client.connect(
    new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
      requestInit: { headers: { authorization: 'Bearer ' + service.settings.value.localToken } },
    }),
  );
  const call = async (name: string, args: Record<string, unknown>, thread = threadId) => {
    const result = await client.callTool({ name, arguments: args, _meta: { threadId: thread } });
    return {
      isError: result.isError,
      content: result.content,
      structuredContent: result.structuredContent as Record<string, unknown> | undefined,
    };
  };
  const connect = (args: Record<string, unknown> = {}, thread = threadId) =>
    call('agent_connect', { nickname: 'Receiver', ...args }, thread);
  const { connectionId } = saved.binding;
  const failure = await connect({ connectionId });
  assert.equal(failure.isError, true);
  assert.equal(failure.structuredContent?.stage, 'history');
  assert.equal(failure.structuredContent?.nextAction, 'agent_read');
  assert.doesNotMatch(JSON.stringify(failure), /private diagnostic/);
  const sender = service.connect({ nickname: 'Sender', client: 'MCP' });
  if (sender.status !== 'connected') throw Error('fixture sender');
  const msg = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Receiver',
    text: 'One full incoming — ё / 東京.',
  });
  const read = await call('agent_read', { connectionId, waitMs: 0 });
  assert.equal(read.isError, undefined);
  assert.match(JSON.stringify(read.structuredContent), /One full incoming — ё \/ 東京\./);
  const beforeRetry = discoveries;
  assert.equal((await connect({ connectionId })).structuredContent?.stage, 'history');
  assert.equal(discoveries, beforeRetry);
  rejectItems = false;
  const retry = await connect({ connectionId });
  assert.deepEqual(retry.structuredContent?.binding, saved.binding);
  assert.equal(discoveries, beforeRetry, 'retry stays on the exact saved recovery route');
  assert.equal(service.store.get(msg.id, 'in')?.state, 'processed');
  assert.equal(submitted.length, 0);
  assert.equal((await connect({ connectionId }, randomUUID())).isError, true);

  const offer = await connect();
  assert.equal(offer.structuredContent?.status, 'codex_recovery_queued');
  assert.equal(submitted.length, 1);
  const beforeObservation = discoveries;
  await connect();
  assert.equal(
    discoveries,
    beforeObservation + 1,
    'probe the exact Desktop route before observing the existing offer',
  );
  assert.equal(submitted.length, 1);
  assert.doesNotMatch(submitted[0]!, /codex/i);
  assert.match(submitted[0]!, /call agent_connect once with the original nickname/);
  assert.match(submitted[0]!, /Omit connectionId and transfer or reset options/);
  const token = submitted[0].split('contextToken: ')[1];
  assert.ok(token);
  // Make the registered adapter check readiness again during proof redemption.
  rejectItems = true;
  await service.adapters.get(profile.id).start();
  const delayed = await connect({ contextToken: token });
  assert.equal(delayed.structuredContent?.stage, 'history');
  assert.equal(delayed.structuredContent?.nextAction, 'agent_connect');
  assert.ok(Date.parse(String(delayed.structuredContent?.expiresAt)) > Date.now());
  assert.equal(JSON.stringify(delayed).includes(token), false);
  assert.equal((await connect({ contextToken: token }, randomUUID())).isError, true);
  rejectItems = false;
  const competing = await Promise.all([
    connect({ contextToken: token }),
    connect({ contextToken: token }),
  ]);
  assert.equal(competing.filter((result) => result.isError).length, 1);
  assert.deepEqual(
    competing.find((result) => !result.isError)?.structuredContent?.binding,
    saved.binding,
  );
  assert.equal((await connect({ contextToken: token })).isError, true);
  assert.equal(submitted.length, 1);
  assert.equal(service.store.get(msg.id, 'in')?.state, 'processed');
});

async function recoveryMcp(
  t: test.TestContext,
  options: NonNullable<ConstructorParameters<typeof NodeService>[1]>,
) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ncf-accept-connect-')));
  const service = new NodeService(directory, options);
  const client = new Client({ name: 'Codex', version: 'fixture' });
  t.after(async () => {
    await client.close();
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  await service.open();
  await client.connect(
    new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
      requestInit: { headers: { authorization: 'Bearer ' + service.settings.value.localToken } },
    }),
  );
  const connect = async (threadId: string, proof: Record<string, unknown> = {}) => {
    const result = await client.callTool({
      name: 'agent_connect',
      arguments: { nickname: 'Recipient', ...proof },
      _meta: { threadId },
    });
    return {
      isError: result.isError,
      content: result.content,
      body: result.structuredContent as Record<string, unknown> | undefined,
    };
  };
  return { directory, service, client, connect };
}

test('ChatGPT confirms the exact send from a new MCP session with either the host hook or two halves of a native confirmation', async (t) => {
  const f = await fixture(t);
  const { service, client, directory } = await recoveryMcp(t, {
    codexSockets: () => [f.profile.socket!],
  });
  const thread = f.profile.threadId!;
  const owner = await service.connectCodex(
    { client: 'Codex', nickname: 'Source' },
    { threadId: thread, socket: f.profile.socket },
  );
  assert.equal(owner.status, 'connected');
  const args = {
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Recipient',
    text: 'One 普通 Ω',
    id: randomUUID(),
  };
  const begin = (input: Record<string, unknown>, id = thread) =>
    client.callTool({ name: 'agent_send', arguments: input, _meta: { threadId: id } });
  const resume = (receipt: string, contextToken?: string, id = thread) =>
    client.callTool({
      name: 'agent_connect',
      arguments: { sendReceipt: receipt, ...(contextToken && { contextToken }) },
      _meta: { threadId: id },
    });
  const stage = await begin(args);
  const body = stage.structuredContent as { status: string; receipt: string };
  assert.equal(body.status, 'awaiting_chat_confirmation');
  assert.equal(service.store.get(args.id, 'out'), undefined);
  const event = {
    hook_event_name: 'PostToolUse',
    session_id: thread,
    turn_id: randomUUID(),
    tool_use_id: 'call-fixture',
    tool_name: 'mcp__ncf_agent_interconnect__agent_send',
    tool_input: args,
    tool_response: stage,
  };
  const hook = (changes: Record<string, unknown> = {}) =>
    runCodexSendHook(path.join(directory, 'Integrations'), { ...event, ...changes });
  for (const invalid of [
    { session_id: randomUUID() },
    { tool_input: { ...args, text: 'Other' } },
  ]) {
    const rejected = JSON.stringify(await hook(invalid));
    assert.match(rejected, /send_chat_changed/);
    assert.doesNotMatch(rejected, /agent_history|outgoing history/);
  }
  assert.equal(service.store.get(args.id, 'out'), undefined);
  const config = parseToml(service.clientInstructions('codex').configuration).hooks as {
    PostToolUse: { hooks: { command: string }[] }[];
  };
  const command = config.PostToolUse[0].hooks[0].command;
  const output = await new Promise<string>((resolve, reject) => {
    const child = exec(command, { timeout: 15_000 }, (error, stdout) =>
      error ? reject(error) : resolve(stdout),
    );
    child.stdin!.end(JSON.stringify(event));
  });
  assert.match(JSON.parse(output).hookSpecificOutput.additionalContext, /accepted/);
  assert.match(JSON.stringify(await hook()), /accepted/);
  assert.equal(service.store.get(args.id, 'out')?.envelope.fromNickname, 'Source');
  const other = { ...args, id: randomUUID(), text: 'fallback' };
  const fallback = (await begin(other)).structuredContent as { receipt: string };
  f.state.runtime = 'active';
  const notices = () =>
    f.requests.filter(
      (r) =>
        r.method === 'thread-follower-steer-turn' &&
        JSON.stringify(r.params).includes('NCF Agent Interconnect send confirmation.'),
    );
  assert.equal((await resume(fallback.receipt, undefined, randomUUID())).isError, true);
  const offer = await resume(fallback.receipt);
  assert.equal(
    (offer.structuredContent as { status: string }).status,
    'awaiting_native_confirmation',
  );
  assert.equal(notices().length, 1);
  const text = (notices()[0].params.input as { text: string }[])[0].text;
  const proof = text.split('contextToken: ').at(-1)!;
  assert.match(proof, /^[0-9a-f-]{36}$/);
  assert.ok(!text.includes(fallback.receipt));
  assert.ok(!JSON.stringify(offer).includes(proof));
  await resume(fallback.receipt);
  assert.equal(notices().length, 1);
  assert.equal((await resume(fallback.receipt, randomUUID())).isError, true);
  assert.equal(service.store.get(other.id, 'out'), undefined);
  const both = await Promise.all([
    resume(fallback.receipt, proof),
    resume(fallback.receipt, proof),
  ]);
  assert.ok(both.every((r) => (r.structuredContent as { accepted?: boolean })?.accepted === true));
  assert.equal(service.store.get(other.id, 'out')?.envelope.text, 'fallback');
  const third = { ...args, id: randomUUID() };
  const old = (await begin(third)).structuredContent as { receipt: string };
  assert.equal(owner.status, 'connected');
  if (owner.status !== 'connected') throw new Error();
  service.disconnect(owner.binding.connectionId);
  assert.equal((await resume(old.receipt)).isError, true);
  assert.equal(service.store.get(third.id, 'out'), undefined);
});

test('fresh Codex MCP session recovers a lost ID before sending one exact reply', async (t) => {
  const f = await fixture(t);
  const { service, client, connect } = await recoveryMcp(t, {
    codexSockets: () => [f.profile.socket!],
  });
  const thread = f.profile.threadId!;
  const owner = await service.connectCodex(
    { client: 'Codex', nickname: 'Recipient' },
    { threadId: thread, socket: f.profile.socket },
  );
  assert.equal(owner.status, 'connected');
  if (owner.status !== 'connected') throw new Error('fixture binding');
  const saved = owner.binding;
  const author = service.connect({ client: 'Fixture', nickname: 'Author' });
  if (author.status !== 'connected') throw new Error('fixture sender');
  const delivered = await service.send({
    connectionId: author.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Recipient',
    text: 'Original Incoming — 東京',
  });
  const incoming = service.store.get(delivered.id, 'in')!;
  const ref = 'r' + incoming.sequence.toString(36);

  const { tools } = await client.listTools();
  const connectTool = tools.find((tool) => tool.name === 'agent_connect')!;
  const sendTool = tools.find((tool) => tool.name === 'agent_send')!;
  assert.ok(!connectTool.inputSchema.required?.includes('connectionId'));
  assert.equal(sendTool.inputSchema.properties?.connectionId, undefined);
  assert.match(sendTool.description ?? '', /Call agent_send directly/);
  assert.match(connectTool.description ?? '', /recoverOnly=true/);
  for (const args of [
    { nickname: 'Unbound name', recoverOnly: true },
    { recoverOnly: true, connectionId: author.binding.connectionId },
    { recoverOnly: true, confirmTransfer: true },
    { recoverOnly: true, resetHistory: true },
  ]) {
    const refused = await connect(thread, args);
    assert.equal(refused.body?.status, 'own_binding_unverified');
    assert.doesNotMatch(JSON.stringify(refused), /transferId|requestingChat|currentOwner/);
    assert.ok(!JSON.stringify(refused).includes(saved.connectionId));
  }
  const foreign = await connect(randomUUID(), { recoverOnly: true });
  assert.equal(foreign.body?.status, 'own_binding_unverified');
  assert.ok(!JSON.stringify(foreign).includes(saved.connectionId));
  assert.equal(service.store.list().length, 2);
  assert.deepEqual(service.store.bindingForNickname('Recipient'), saved);

  const recovered = await connect(thread, { recoverOnly: true });
  assert.equal(recovered.body?.status, 'connected');
  assert.deepEqual(recovered.body?.binding, saved);
  assert.equal(recovered.body?.connectionId, undefined);
  assert.match(String(recovered.body?.description), /^Read binding\.connectionId first\./);
  assert.deepEqual(JSON.parse((recovered.content as { text: string }[])[0]!.text), recovered.body);
  const reply = {
    replyRef: ref,
    text: 'One exact reply',
    id: randomUUID(),
  };
  const originalSend = service.send.bind(service);
  const lostResponse = t.mock.method(
    service,
    'send',
    async (...args: Parameters<typeof service.send>) => {
      await originalSend(...args);
      throw new Error(
        'Connection not found. Call agent_connect with the agent name chosen by the user',
      );
    },
  );
  const uncertain = await client.callTool({
    name: 'agent_send',
    arguments: reply,
    _meta: { threadId: thread },
  });
  const receipt = (uncertain.structuredContent as { receipt: string }).receipt;
  const outcome = await service.codexSends.finish({
    thread,
    receipt,
    input: reply,
    toolUseId: 'fixture',
  });
  assert.equal(outcome.status, 'send_outcome_unverified');
  assert.equal(outcome.nextAction, 'agent_history');
  const history = await client.callTool({
    name: 'agent_history',
    arguments: { connectionId: saved.connectionId },
    _meta: { threadId: thread },
  });
  const rows = ((history.structuredContent as { messages?: unknown[] })?.messages ?? []) as {
    direction: string;
    envelope: { id: string; text: string; replyTo?: string };
  }[];
  assert.deepEqual(
    rows
      .filter((row) => row.direction === 'out' && row.envelope.id === reply.id)
      .map(({ envelope }) => ({ text: envelope.text, replyTo: envelope.replyTo })),
    [{ text: reply.text, replyTo: delivered.id }],
  );
  assert.equal(lostResponse.mock.callCount(), 1);
});

test(
  'Codex lost-ID recovery retains the existing exact confirmation without starting another',
  { skip: process.platform === 'win32' },
  async (t) => {
    const x = await legacyConfirmation(t, true);
    let entered!: () => void;
    let unblock!: () => void;
    const entering = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    t.mock.method(CodexQueueAdapter.prototype, 'start', async () => {
      entered();
      await blocked;
    });
    t.mock.method(CodexQueueAdapter.prototype, 'status', () => x.ready);
    const recovering = await x.connect(x.thread, { recoverOnly: true });
    assert.equal(recovering.body?.status, 'codex_recovery_pending');
    assert.equal(recovering.body?.expiresAt, new Date(x.deadline).toISOString());
    assert.doesNotMatch(String(recovering.body?.description), /codex/i);
    assert.match(
      String(recovering.body?.description),
      /Do not resend, restart agent_connect or poll/,
    );
    assert.equal(x.tokens.length, 1);
    const foreign = await x.connect(randomUUID(), { recoverOnly: true, contextToken: x.tokens[0] });
    assert.equal(foreign.body?.status, 'codex_confirmation_unusable');
    const redeeming = x.connect(x.thread, { recoverOnly: true, contextToken: x.tokens[0] });
    await entering;
    try {
      const during = await x.connect(x.thread, { recoverOnly: true });
      assert.equal(during.body?.status, 'codex_recovery_uncertain');
      assert.equal(during.body?.phase, 'redeeming');
      assert.match(String(during.body?.description), /Wait for that result/);
      assert.doesNotMatch(String(during.body?.description), /codex/i);
      assert.equal(x.tokens.length, 1);
    } finally {
      unblock();
    }
    const restored = await redeeming;
    assert.equal(restored.body?.status, 'connected');
    assert.deepEqual(restored.body?.binding, x.saved);
    assert.equal(x.tokens.length, 1);
    x.assertHistory();
    assert.equal(
      (await x.connect(x.thread, { recoverOnly: true, contextToken: x.tokens[0] })).isError,
      true,
    );
    // The successful redemption result may have been dropped. A caller without
    // it must not end up waiting for the already redeemed confirmation.
    x.f.state.discoveryResult = 'success';
    const afterLostResponse = await x.connect(x.thread, { recoverOnly: true });
    assert.equal(afterLostResponse.body?.status, 'connected');
    assert.deepEqual(afterLostResponse.body?.binding, x.saved);
    assert.equal(x.tokens.length, 1);
    x.assertHistory();
  },
);

async function legacyConfirmation(t: test.TestContext, recoverOnly = false) {
  const f = await fixture(t);
  const { service, connect } = await recoveryMcp(t, { codexSockets: () => [f.profile.socket!] });
  const thread = f.profile.threadId!;
  const initial = await service.connectCodex(
    { client: 'Codex', nickname: 'Recipient' },
    { threadId: thread, socket: f.profile.socket },
  );
  if (initial.status !== 'connected') throw Error('fixture binding');
  const saved = service.store.assertOwner(initial.binding.connectionId).binding;
  const prior = await service.send({
    connectionId: saved.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Fixture archive',
    text: 'History before recovery — ё / 東京.',
  });
  const history = service.store.get(prior.id, 'out');
  assert.ok(history);
  const assertHistory = () => assert.deepEqual(service.store.get(prior.id, 'out'), history);
  const old = service.adapters.get(saved.adapterId);
  const ready = old.status();
  let allowQueue = true;
  t.mock.method(old, 'status', () =>
    f.state.discoveryResult === 'error' && allowQueue
      ? { ...ready, state: 'error', error: 'Codex IPC: ECONNREFUSED' }
      : ready,
  );
  const tokens: string[] = [];
  t.mock.method(CodexQueueAdapter.prototype, 'challenge', async (token: string) => {
    tokens.push(token);
    return { state: 'dispatched', witness: { messageId: randomUUID(), payloadHash: 'fixture' } };
  });
  f.state.discoveryResult = 'error';
  const offer = await connect(thread, recoverOnly ? { recoverOnly } : {});
  assert.equal(offer.body?.status, 'codex_recovery_pending');
  const deadline = Date.parse(String(offer.body?.expiresAt));
  assert.ok(Number.isFinite(deadline));
  return {
    f,
    thread,
    saved,
    old,
    ready,
    service,
    connect,
    tokens,
    deadline,
    assertHistory,
    blockFreshQueue: () => {
      allowQueue = false;
    },
  };
}

test(
  'pending Codex confirmation allows the same Desktop owner to return on either side of expiry',
  { skip: process.platform === 'win32' },
  async (t) => {
    for (const offset of [-1, 1])
      await t.test(String(offset), async (t) => {
        const x = await legacyConfirmation(t);
        x.blockFreshQueue();
        let now = x.deadline - 2;
        t.mock.method(Date, 'now', () => now);
        const existing = await x.connect(x.thread);
        assert.equal(existing.body?.status, 'codex_recovery_pending');
        assert.equal(Date.parse(String(existing.body?.expiresAt)), x.deadline);
        x.f.state.discoveryResult = 'success';
        const before = x.f.requests.length;
        now = x.deadline + offset;
        assert.deepEqual((await x.connect(x.thread)).body?.binding, x.saved);
        assert.ok(
          x.f.requests
            .slice(before)
            .some(
              (request) =>
                request.method === 'thread-owner-discovery' &&
                request.params.conversationId === x.thread,
            ),
        );
        assert.equal(x.service.adapters.get(x.saved.adapterId), x.old);
        x.assertHistory();
        assert.equal((await x.connect(x.thread, { contextToken: x.tokens[0] })).isError, true);
        assert.equal(x.tokens.length, 1);
      });
    await t.test('expiry takes precedence over an unavailable recovery route', async (t) => {
      const x = await legacyConfirmation(t);
      x.blockFreshQueue();
      t.mock.method(Date, 'now', () => x.deadline);
      assert.equal((await x.connect(x.thread)).body?.status, 'codex_recovery_expired');
      assert.equal(x.tokens.length, 1);
      assert.deepEqual(x.service.store.bindingForNickname('Recipient'), x.saved);
    });
  },
);

test('profile setup failure returns one public MCP action for the selected configuration', async (t) => {
  let file = '';
  const { directory, service, connect } = await recoveryMcp(t, {
    codexSockets: () => [],
    runningCodexConfiguration: async () => file,
  });
  file = path.join(directory, 'config.toml');
  const thread = randomUUID();
  for (const content of [undefined, '# unrelated setup\n']) {
    if (content) await writeFile(file, content, { mode: 0o600 });
    const error = await connect(thread);
    assert.equal(error.isError, true);
    assert.equal(error.body?.stage, 'profile');
    assert.equal(error.body?.nextAction, 'apply_codex_setup');
    assert.match(JSON.stringify(error.content), /Apply/);
    assert.doesNotMatch(JSON.stringify(error), /retry agent_connect|agent_read|config\.toml/);
    assert.equal(service.store.bindingForNickname('Recipient'), undefined);
  }
  // Exercise the Windows profile-verification refusal via the same real file resolver on any host.
  const profile: AdapterProfile = {
    id: randomUUID(),
    kind: 'codex-desktop',
    label: 'Fixture',
    threadId: thread,
    codexQueue: true,
    socket: codexQueueLocator(directory),
  };
  const start = t.mock.method(CodexQueueAdapter.prototype, 'start', async () => {});
  await service.installAdapter(profile);
  const saved = service.connect({
    nickname: 'Recipient',
    client: 'Codex',
    chatId: thread,
    adapterId: profile.id,
  });
  if (saved.status !== 'connected') throw Error('fixture binding');
  start.mock.mockImplementation(async () => {
    await service['configuredCodexQueueSocket']();
  });
  const bound = await connect(thread, { connectionId: saved.binding.connectionId });
  assert.equal(bound.isError, true);
  assert.equal(bound.body?.stage, 'profile');
  assert.equal(bound.body?.nextAction, 'agent_read');
  assert.doesNotMatch(JSON.stringify(bound.content), /Apply/);
  assert.deepEqual(service.store.bindingForNickname('Recipient'), saved.binding);
});

test(
  'same-chat redemption rejects stale authority before changing the route or binding',
  { skip: process.platform === 'win32' },
  async (t) => {
    for (const barrier of [
      'adapterSetup',
      'readiness',
      'replacement',
      'settings-write',
      'binding',
    ] as const)
      await t.test(barrier, async (t) => {
        const x = await legacyConfirmation(t);
        const before = contentHash(await readFile(x.service.settings.filename, 'utf8'));
        const originalProfile = structuredClone(
          x.service.settings.value.adapters.find((a) => a.id === x.saved.adapterId),
        );
        const commit = t.mock.method(x.service.store, 'connect');
        let now = x.deadline - 1;
        t.mock.method(Date, 'now', () => now);
        // First prove a transient readiness failure leaves this same proof retryable.
        let fail = true;
        let entered!: () => void, unblock!: () => void;
        const entering = new Promise<void>((resolve) => {
          entered = resolve;
        });
        const blocked = new Promise<void>((resolve) => {
          unblock = resolve;
        });
        t.mock.method(CodexQueueAdapter.prototype, 'start', async () => {
          if (fail) throw new CodexConnectFailure('history');
          if (barrier === 'readiness' || barrier === 'replacement') {
            entered();
            await blocked;
          }
        });
        t.mock.method(CodexQueueAdapter.prototype, 'status', () => x.ready);
        assert.equal(
          (await x.connect(x.thread, { contextToken: x.tokens[0] })).body?.stage,
          'history',
        );
        fail = false;
        if (barrier === 'adapterSetup') {
          // Schedule the real retry behind a held serialized operation.
          x.service['adapterSetup'] = blocked;
          const complete = x.service['completeCodexBinding'].bind(x.service);
          t.mock.method(
            x.service as unknown as { completeCodexBinding: typeof complete },
            'completeCodexBinding',
            (...args: Parameters<typeof complete>) => {
              const result = complete(...args);
              entered();
              return result;
            },
          );
        }
        if (barrier === 'settings-write' || barrier === 'binding') {
          const replace = x.service.settings.replaceAdapter.bind(x.service.settings);
          t.mock.method(
            x.service.settings,
            'replaceAdapter',
            async (previous: AdapterProfile, next: AdapterProfile, guard?: () => void) => {
              if (!guard) return replace(previous, next);
              if (barrier === 'binding') await replace(previous, next, guard);
              entered();
              await blocked;
              if (barrier === 'settings-write') return replace(previous, next, guard);
            },
          );
        }
        const retry = x.connect(x.thread, { contextToken: x.tokens[0] });
        await entering;
        if (barrier === 'replacement') x.service['codexRecovery'].delete(x.thread);
        else now = x.deadline;
        unblock();
        const result = await retry;
        assert.equal(result.isError, true);
        assert.match(JSON.stringify(result.content), /invalid or expired/);
        assert.equal(commit.mock.callCount(), 0);
        x.assertHistory();
        assert.deepEqual(x.service.store.bindingForNickname('Recipient'), x.saved);
        assert.deepEqual(
          x.service.settings.value.adapters.find((a) => a.id === x.saved.adapterId),
          originalProfile,
        );
        assert.equal(contentHash(await readFile(x.service.settings.filename, 'utf8')), before);
        const adapter = x.service.adapters.get(x.saved.adapterId);
        if (barrier === 'settings-write' || barrier === 'binding')
          assert.ok(adapter instanceof CodexDesktopAdapter);
        else assert.equal(adapter, x.old);
        assert.equal(x.tokens.length, 1);
      });
  },
);

test('a new Codex destination is private until the exact proof and owner survive publication', async (t) => {
  for (const scenario of [
    'queued-expiry',
    'temp-expiry',
    'temp-revocation',
    'temp-owner-change',
    'rename-revocation',
    'success',
  ] as const) {
    await t.test(scenario, { timeout: 10000 }, async (t) => {
      let configuration = '';
      const { service, connect, directory } = await recoveryMcp(t, {
        codexSockets: () => [],
        runningCodexConfiguration: async () => configuration,
      });
      configuration = path.join(directory, 'config.toml');
      await writeFile(configuration, service.clientInstructions('codex').configuration, {
        mode: 0o600,
      });
      const occupied = scenario === 'temp-owner-change' || scenario === 'rename-revocation';
      const source = occupied ? await fixture(t) : undefined;
      const original = source
        ? await service.connectCodex(
            { nickname: 'Recipient', client: 'Codex' },
            { threadId: source.profile.threadId!, socket: source.profile.socket },
          )
        : undefined;
      if (original && original.status !== 'connected') throw Error('fixture source');
      if (original) {
        const adapter = service.adapters.get(original.binding.adapterId);
        const state = adapter.status();
        t.mock.method(adapter, 'status', () => ({
          ...state,
          capabilities: { ...state.capabilities, wakeIdle: false },
        }));
      }
      const sender = service.connect({ nickname: 'Sender', client: 'MCP' });
      if (sender.status !== 'connected') throw Error('fixture sender');
      const message = await service.send({
        connectionId: sender.binding.connectionId,
        recipientNode: service.settings.value.nodeId,
        recipientNickname: 'Recipient',
        text: 'Saved history — ё / 東京.',
      });
      const history = service.store.get(message.id, 'in');
      assert.ok(history);
      const dest = randomUUID();
      const tokens: string[] = [];
      t.mock.method(CodexQueueAdapter.prototype, 'challenge', async (token: string) => {
        tokens.push(token);
        return {
          state: 'dispatched',
          witness: { messageId: randomUUID(), payloadHash: 'fixture' },
        };
      });
      let candidateId = '';
      t.mock.method(CodexQueueAdapter.prototype, 'start', async function (this: CodexQueueAdapter) {
        candidateId = this.profile.id;
      });
      t.mock.method(CodexQueueAdapter.prototype, 'status', function (this: CodexQueueAdapter) {
        return {
          id: this.profile.id,
          label: 'Fixture',
          kind: 'codex-desktop',
          state: 'ready',
          error: null,
          capabilities: {
            wakeIdle: false,
            nativeDisplay: true,
            exactSession: true,
            receiveActive: false,
          },
        };
      });
      const offer = await connect(dest);
      assert.equal(offer.body?.status, 'codex_recovery_pending');
      const expires = Date.parse(String(offer.body?.expiresAt));
      let now = expires - 1;
      t.mock.method(Date, 'now', () => now);
      const filename = service.settings.filename;
      const before = JSON.parse(await readFile(filename, 'utf8'));
      let expectedOwner = original?.binding;
      const storeConnect = t.mock.method(service.store, 'connect');
      const candidateTemps = new Set<string>();
      let renames = 0;
      let resume!: () => void, entered!: () => void;
      const hold = new Promise<void>((r) => {
        resume = r;
      });
      const atBarrier = new Promise<void>((r) => {
        entered = r;
      });
      const originalWrite = fsPromises.writeFile.bind(fsPromises);
      const originalRename = fsPromises.rename.bind(fsPromises);
      const write = t.mock.method(
        fsPromises,
        'writeFile',
        async (...args: Parameters<typeof fsPromises.writeFile>) => {
          await originalWrite(...args);
          const [file, data] = args;
          if (
            typeof file !== 'string' ||
            !file.startsWith(filename + '.') ||
            !file.endsWith('.tmp') ||
            typeof data !== 'string'
          )
            return;
          const hasCandidate = JSON.parse(data).adapters.some(
            (a: AdapterProfile) => a.threadId === dest,
          );
          if (hasCandidate) candidateTemps.add(file);
          if (hasCandidate && scenario.startsWith('temp-')) {
            entered();
            await hold;
          }
        },
      );
      const rename = t.mock.method(
        fsPromises,
        'rename',
        async (...args: Parameters<typeof fsPromises.rename>) => {
          const ours =
            typeof args[0] === 'string' && candidateTemps.has(args[0]) && args[1] === filename;
          if (ours) renames++;
          await originalRename(...args);
          if (ours && scenario === 'rename-revocation') {
            entered();
            await hold;
          }
        },
      );
      // Hold a real unrelated save before it serializes live settings. The destination
      // must stay private while its own write waits behind that save.
      const originalMkdir = fsPromises.mkdir.bind(fsPromises);
      let first = true;
      const mkdirGate =
        scenario === 'queued-expiry'
          ? t.mock.method(
              fsPromises,
              'mkdir',
              async (...args: Parameters<typeof fsPromises.mkdir>) => {
                const result = await originalMkdir(...args);
                if (first && args[0] === directory) {
                  first = false;
                  entered();
                  await hold;
                }
                return result;
              },
            )
          : undefined;
      syncBuiltinESMExports();
      const preexisting = mkdirGate ? service.settings.save() : Promise.resolve();
      if (mkdirGate) await atBarrier;
      const blockedTail = service.settings['saving'];
      const redemption = connect(dest, { contextToken: tokens[0] });
      let otherSave: Promise<void> | undefined;
      let visible = false,
        active = false;
      try {
        if (scenario !== 'success') {
          if (scenario === 'queued-expiry') {
            const end = performance.now() + 2000;
            while (service.settings['saving'] === blockedTail && performance.now() < end)
              await new Promise((r) => setTimeout(r, 5));
            assert.notEqual(service.settings['saving'], blockedTail);
          } else await atBarrier;
          visible = service.settings.value.adapters.some((a) => a.threadId === dest);
          active = service.adapters.states().some((a) => a.id === candidateId);
          if (scenario.endsWith('expiry')) now = expires;
          if (scenario.endsWith('revocation')) service['codexRecovery'].delete(dest);
          if (scenario === 'temp-owner-change' && original) {
            // Change the source generation independently of challenge bookkeeping.
            service.store.disconnect(original.binding.connectionId);
            const changed = service.store.connect({
              nickname: 'Recipient',
              client: 'Codex',
              chatId: original.binding.chatId,
              adapterId: original.binding.adapterId,
            });
            if (changed.status !== 'connected') throw Error('fixture owner');
            expectedOwner = changed.binding;
          }
          service.settings.value.nodeLabel = 'Concurrent settings change';
          if (scenario === 'rename-revocation') {
            const unrelated: AdapterProfile = {
              id: randomUUID(),
              label: 'Concurrent manual adapter',
              kind: 'manual',
            };
            before.adapters.push(unrelated);
            otherSave = service.installAdapter(unrelated);
          } else otherSave = service.settings.save();
          resume();
        }
        const outcome = await redemption;
        await otherSave;
        assert.equal(tokens.length, 1);
        if (scenario === 'success') {
          assert.equal(outcome.body?.status, 'connected');
          assert.equal(service.store.bindingForNickname('Recipient')?.chatId, dest);
          assert.equal(renames, 1);
        } else {
          assert.equal(outcome.isError, true);
          assert.equal(
            renames,
            scenario === 'rename-revocation' ? 1 : 0,
            'only an already authorized candidate rename can reach disk',
          );
          assert.equal(
            visible,
            false,
            'another settings caller must never see a provisional destination',
          );
          assert.equal(active, false, 'the adapter must remain private until commit');
          assert.equal(
            storeConnect.mock.calls.filter((call) => call.arguments[0].chatId === dest).length,
            0,
          );
          assert.equal(service.store.db.prepare('SELECT COUNT(*) AS n FROM transfers').get()?.n, 0);
          assert.deepEqual(service.store.bindingForNickname('Recipient'), expectedOwner);
          assert.deepEqual(service.store.get(message.id, 'in'), history);
          assert.equal(
            service.settings.value.adapters.some((a) => a.threadId === dest),
            false,
          );
          assert.equal(
            service.adapters.states().some((a) => a.id === candidateId),
            false,
          );
          before.nodeLabel = 'Concurrent settings change';
          assert.equal(
            contentHash(await readFile(filename, 'utf8')),
            contentHash(JSON.stringify(before, null, 2) + '\n'),
          );
          assert.ok(
            !(await fsPromises.readdir(directory)).some(
              (name) => name.startsWith('settings.json.') && name.endsWith('.tmp'),
            ),
          );
        }
      } finally {
        resume();
        await Promise.allSettled([redemption, otherSave, preexisting]);
        mkdirGate?.mock.restore();
        write.mock.restore();
        rename.mock.restore();
        syncBuiltinESMExports();
      }
    });
  }
});

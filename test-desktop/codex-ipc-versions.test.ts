import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CodexDesktopAdapter, codexExchange } from '../desktop/core/codex-adapter.js';
import { agentMessageText } from '../desktop/core/adapters.js';
import type { AdapterProfile } from '../desktop/shared/contracts.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function fixture(t: test.TestContext, version = 13, runtime: unknown = 'idle') {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-codex-version-'));
  const socket =
    process.platform === 'win32'
      ? '\\\\.\\pipe\\ncf-codex-version-' + randomUUID()
      : path.join(directory, 'ipc.sock');
  const profile: AdapterProfile = {
    id: randomUUID(),
    kind: 'codex-desktop',
    label: 'Isolated fixture',
    threadId: randomUUID(),
    socket,
  };
  const requests: Record<string, any>[] = [];
  const sockets = new Set<net.Socket>();
  const followed = deferred();
  const held: (() => void)[] = [];
  const state = { hold: false, unrelatedFirst: false };
  const server = net.createServer((connection) => {
    sockets.add(connection);
    connection.on('close', () => sockets.delete(connection));
    connection.on('error', () => {});
    let buffer = Buffer.alloc(0);
    const write = (value: object) => {
      if (connection.destroyed) return;
      const bytes = Buffer.from(JSON.stringify(value));
      const frame = Buffer.alloc(4 + bytes.length);
      frame.writeUInt32LE(bytes.length);
      bytes.copy(frame, 4);
      connection.write(frame);
    };
    const snapshot = (
      sourceClientId = 'exact-owner',
      conversationId = profile.threadId,
      wireVersion = version,
    ) =>
      write({
        type: 'broadcast',
        sourceClientId,
        method: 'thread-stream-state-changed',
        version: wireVersion,
        params: {
          conversationId,
          hostId: 'local',
          change: {
            type: 'snapshot',
            conversationState: {
              id: conversationId,
              hostId: 'local',
              threadRuntimeStatus: { type: runtime },
            },
          },
        },
      });
    connection.on('data', (data) => {
      buffer = Buffer.concat([buffer, typeof data === 'string' ? Buffer.from(data) : data]);
      while (buffer.length >= 4 && buffer.length >= buffer.readUInt32LE(0) + 4) {
        const length = buffer.readUInt32LE(0);
        const request = JSON.parse(buffer.subarray(4, length + 4).toString());
        buffer = buffer.subarray(length + 4);
        requests.push(request);
        if (request.method === 'initialize')
          write({
            type: 'response',
            requestId: request.requestId,
            resultType: 'success',
            result: { clientId: 'follower' },
          });
        if (request.method === 'thread-owner-discovery')
          write({
            type: 'response',
            requestId: request.requestId,
            resultType: 'success',
            handledByClientId: 'exact-owner',
            result: { supportsUntrustedAppInput: true },
          });
        if (
          request.method === 'thread-stream-following-changed' &&
          request.params.following === true
        ) {
          followed.resolve();
          const send = () => {
            if (state.unrelatedFirst) {
              snapshot('other-owner', profile.threadId, 99);
              snapshot('exact-owner', randomUUID(), 99);
            }
            snapshot();
          };
          if (state.hold) held.push(send);
          else send();
        }
        if (
          request.method === 'thread-follower-start-turn' ||
          request.method === 'thread-follower-steer-turn'
        )
          write({ type: 'response', requestId: request.requestId, resultType: 'success' });
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(socket, resolve));
  t.after(async () => {
    for (const connection of sockets) connection.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  const input = {
    nickname: 'Receiver',
    messageId: randomUUID(),
    replyRef: 'r7',
    binding: {
      connectionId: randomUUID(),
      generation: 1,
      adapterId: profile.id,
      chatId: profile.threadId!,
      client: 'Codex',
    },
    message: {
      fromNode: randomUUID(),
      fromNickname: 'Sender 漢字',
      text: 'Versioned incoming body',
      files: [],
    },
  };
  return {
    profile,
    requests,
    input,
    state,
    followed,
    release: () => held.splice(0).forEach((send) => send()),
  };
}

test('owner discovery alone cannot publish ready before a compatible exact-chat snapshot', async (t) => {
  const f = await fixture(t);
  f.state.hold = true;
  const adapter = new CodexDesktopAdapter(f.profile, () => {});
  t.after(() => adapter.stop());
  const start = adapter.start();
  const first = await Promise.race([
    start.then(() => 'finished'),
    f.followed.promise.then(() => 'following'),
  ]);
  assert.equal(first, 'following');
  assert.equal(adapter.status().state, 'checking');
  assert.equal(adapter.status().capabilities.wakeIdle, false);
  f.release();
  await start;
  assert.equal(adapter.status().state, 'ready');
  assert.ok(f.requests.every((request) => !request.method.startsWith('thread-follower-')));
  assert.ok(
    f.requests.some(
      (request) =>
        request.method === 'thread-stream-following-changed' && request.params.following === true,
    ),
  );
});

for (const version of [11, 13])
  for (const runtime of ['idle', 'active']) {
    test(`stream ${version} ${runtime} admits one canonical body to the exact owner`, async (t) => {
      const f = await fixture(t, version, runtime);
      f.state.unrelatedFirst = true;
      const result = await codexExchange(f.profile, f.input, undefined, 250);
      assert.equal(result.state, 'admitted');
      const submitted = f.requests.filter((request) =>
        request.method.startsWith('thread-follower-'),
      );
      assert.equal(submitted.length, 1);
      assert.equal(submitted[0].targetClientId, 'exact-owner');
      assert.equal(submitted[0].params.conversationId, f.profile.threadId);
      assert.equal(
        submitted[0].method,
        runtime === 'idle' ? 'thread-follower-start-turn' : 'thread-follower-steer-turn',
      );
      const parts =
        runtime === 'idle'
          ? submitted[0].params.turnStart.request.input
          : submitted[0].params.input;
      assert.equal(parts[0].text, agentMessageText(f.input));
      assert.equal(submitted[0].version, runtime === 'idle' ? 2 : 1);
    });
  }

test('unknown stream version fails explicitly without ready or an input request', async (t) => {
  const f = await fixture(t, 14);
  const result = await codexExchange(f.profile, undefined, undefined, 250);
  assert.equal(result.state, 'failed');
  assert.match(result.error!, /Unsupported Codex.*stream version.*14/);
  assert.ok(f.requests.every((request) => !request.method.startsWith('thread-follower-')));
});

test('malformed v13 runtime snapshot fails before native submission', async (t) => {
  const f = await fixture(t, 13, { type: 'active' });
  const result = await codexExchange(f.profile, f.input, undefined, 250);
  assert.equal(result.state, 'failed');
  assert.match(result.error!, /Invalid.*Codex.*snapshot/);
  assert.ok(f.requests.every((request) => !request.method.startsWith('thread-follower-')));
});

test('v13 runtime arrays cannot impersonate a supported status through coercion', async (t) => {
  const f = await fixture(t, 13, ['active']);
  const result = await codexExchange(f.profile, f.input, undefined, 250);
  assert.equal(result.state, 'failed');
  assert.match(result.error!, /Invalid.*Codex.*snapshot/);
  assert.ok(f.requests.every((request) => !request.method.startsWith('thread-follower-')));
});

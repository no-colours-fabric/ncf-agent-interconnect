import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { CODEX_IPC_MAX_FRAME_BYTES, codexExchange } from './build/core/codex-adapter.js';

// This helper is copied beside the extracted ASAR modules for package QA only.
export async function verifyCodexPackage() {
  assert.equal(CODEX_IPC_MAX_FRAME_BYTES, 128 * 1024 * 1024);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-package-codex-'));
  const endpoint =
    process.platform === 'win32'
      ? '\\\\.\\pipe\\ncf-package-' + randomUUID()
      : path.join(directory, 'ipc.sock');
  const threadId = randomUUID(),
    sockets = new Set();
  let admissions = 0,
    snapshotBytes = 0;
  const server = net.createServer((connection) => {
    sockets.add(connection);
    connection.on('close', () => sockets.delete(connection));
    connection.on('error', () => {});
    let input = Buffer.alloc(0);
    const send = (value, fragmented = false) => {
      const bytes = Buffer.from(JSON.stringify(value));
      const header = Buffer.alloc(4);
      header.writeUInt32LE(bytes.length);
      if (fragmented) {
        snapshotBytes = bytes.length;
        connection.write(header.subarray(0, 1));
        connection.write(header.subarray(1, 3));
        connection.write(header.subarray(3));
        for (let offset = 0; offset < bytes.length; offset += 1024 * 1024 - 17)
          connection.write(bytes.subarray(offset, offset + 1024 * 1024 - 17));
      } else connection.write(Buffer.concat([header, bytes]));
    };
    connection.on('data', (chunk) => {
      input = Buffer.concat([input, chunk]);
      while (input.length >= 4 && input.length >= input.readUInt32LE(0) + 4) {
        const length = input.readUInt32LE(0);
        const request = JSON.parse(input.subarray(4, length + 4).toString('utf8'));
        input = input.subarray(length + 4);
        if (request.method === 'initialize')
          send({
            type: 'response',
            requestId: request.requestId,
            resultType: 'success',
            result: { clientId: 'package-follower' },
          });
        if (request.method === 'thread-owner-discovery') {
          assert.equal(request.params.conversationId, threadId);
          send({
            type: 'response',
            requestId: request.requestId,
            resultType: 'success',
            handledByClientId: 'package-owner',
            result: { supportsUntrustedAppInput: true },
          });
        }
        if (
          request.method === 'thread-stream-following-changed' &&
          request.params.following === true
        ) {
          for (const exact of [false, true])
            send(
              {
                type: 'broadcast',
                sourceClientId: 'package-owner',
                method: 'thread-stream-state-changed',
                version: 11,
                params: {
                  hostId: 'local',
                  conversationId: exact ? threadId : randomUUID(),
                  change: {
                    type: 'snapshot',
                    conversationState: {
                      threadRuntimeStatus: { type: 'idle' },
                      ignoredLargeState: exact
                        ? 'Ж漢'.repeat(Math.ceil((33 * 1024 * 1024) / 5))
                        : '',
                    },
                  },
                },
              },
              exact,
            );
        }
        if (request.method === 'thread-follower-start-turn') {
          assert.equal(request.params.conversationId, threadId);
          admissions++;
          send({ type: 'response', requestId: request.requestId, resultType: 'success' });
        }
      }
    });
  });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(endpoint, resolve);
    });
    const profile = {
      id: randomUUID(),
      label: 'Package Codex',
      kind: 'codex-desktop',
      threadId,
      socket: endpoint,
    };
    const result = await codexExchange(
      profile,
      {
        message: {
          fromNode: randomUUID(),
          fromNickname: 'Package sender',
          text: 'Package Unicode request Ж漢',
          files: [],
        },
        nickname: 'Package Codex',
        messageId: randomUUID(),
        replyRef: 'r1',
        binding: {
          connectionId: randomUUID(),
          client: 'Codex',
          chatId: threadId,
          adapterId: profile.id,
          generation: 1,
        },
      },
      undefined,
      15000,
    );
    assert.deepEqual(result, { state: 'admitted' });
    assert.ok(snapshotBytes > 32 * 1024 * 1024 && snapshotBytes < CODEX_IPC_MAX_FRAME_BYTES);
    assert.equal(admissions, 1);
    return {
      packagedCodexLargeFrame: true,
      codexFragmentedUnicode: true,
      codexExactSyntheticAdmission: true,
      codexFrameLimitBytes: CODEX_IPC_MAX_FRAME_BYTES,
      codexOwnAsar: true,
      codexLiveClientTested: false,
    };
  } finally {
    for (const connection of sockets) connection.destroy();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}

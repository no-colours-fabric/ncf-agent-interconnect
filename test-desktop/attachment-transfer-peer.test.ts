import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { open, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { WebSocket } from 'ws';
import type { NodeService } from '../desktop/core/service.js';
import { bytesPerMiB, legacyAttachmentLimitMiB } from '../desktop/shared/attachment-limit.js';
import { until } from './aionui-fixture.js';
import { pairingNode } from './pairing-node-fixture.js';
import { withDeadline } from './pairing-harness.js';

function sender(service: NodeService, recipientNode: string) {
  const agent = service.connect({ nickname: 'Attachment sender', client: 'MCP' });
  if (agent.status !== 'connected') throw new Error('Fixture owner unavailable');
  return (text: string, files: string[] = []) =>
    service.send({
      connectionId: agent.binding.connectionId,
      recipientNickname: 'Attachment receiver',
      recipientNode,
      text,
      files,
    });
}

async function sparseFixture(service: NodeService, size: number): Promise<string> {
  const filename = path.join(service.settings.value.exportRoots[0], 'synthetic-transfer.bin');
  const handle = await open(filename, 'wx', 0o600);
  try {
    await handle.truncate(size);
  } finally {
    await handle.close();
  }
  return filename;
}

const legacyLimit = legacyAttachmentLimitMiB * bytesPerMiB;

test(
  'A receiver configured for 1 MiB accepts a file over 100 MiB and waits for SHA-256 verification before receipt',
  { timeout: 45000 },
  async (t) => {
    const source = await pairingNode(t),
      target = await pairingNode(t);
    await target.userCall('saveAttachmentLimit', { limitMiB: 1 });
    await source.network.join(target.snapshot().peerUrl, target.network.accessCode().code);
    await until(() => source.snapshot().peers[0]?.connected === true);
    const send = sender(source, target.settings.value.nodeId);
    const file = await sparseFixture(source, legacyLimit + 1);
    const additional = await send('other mail keeps flowing');
    await until(() => target.store.get(additional.id, 'in')?.state === 'ready');

    let release!: () => void;
    let reached!: () => void;
    const permit = new Promise<void>((resolve) => {
      release = resolve;
    });
    const lastChunk = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const receive = target.files.receive.bind(target.files);
    target.files.receive = (attachment, request) =>
      receive(attachment, async (offset, length) => {
        const data = await request(offset, length);
        if (offset + length === attachment.size) {
          reached();
          await permit;
        }
        return data;
      });
    const pending = await send('above the legacy ceiling', [file]);
    const attachment = source.store.get(pending.id, 'out')!.envelope.attachments[0];
    try {
      await withDeadline(lastChunk, 20000, 'last attachment chunk');
      assert.equal(pending.accepted, true);
      assert.equal(pending.delivery, 'queued');
      assert.equal(pending.attachmentTransfer, undefined);
      assert.equal(target.store.get(pending.id, 'in')?.state, 'received');
      assert.equal(source.store.get(pending.id, 'out')?.state, 'queued');
      await assert.rejects(stat(target.files.blob(attachment.id)), { code: 'ENOENT' });
    } finally {
      release();
    }
    await until(() => source.store.get(pending.id, 'out')?.state === 'ready');
    assert.equal((await stat(target.files.blob(attachment.id))).size, legacyLimit + 1);
    assert.equal(await target.files.hash(target.files.blob(attachment.id)), attachment.id);
  },
);

test('The dialing peer and the accepting peer both apply their own cap only on send', async (t) => {
  const source = await pairingNode(t),
    target = await pairingNode(t);
  await source.userCall('saveAttachmentLimit', { limitMiB: 1 });
  await target.userCall('saveAttachmentLimit', { limitMiB: 2 });
  await source.network.join(target.snapshot().peerUrl, target.network.accessCode().code);
  await until(() => source.snapshot().peers[0]?.connected === true);
  const outbound = await sparseFixture(source, bytesPerMiB + 1);
  const inbound = await sparseFixture(target, bytesPerMiB + 1);
  await assert.rejects(
    sender(source, target.settings.value.nodeId)('locally blocked', [outbound]),
    /attachment size limit/,
  );
  const accepted = await sender(target, source.settings.value.nodeId)('reverse direction', [
    inbound,
  ]);
  await until(() => target.store.get(accepted.id, 'out')?.state === 'ready');
  const file = target.store.get(accepted.id, 'out')!.envelope.attachments[0];
  assert.equal(await source.files.exists(file), true);
  assert.equal(source.store.get(accepted.id, 'in')?.state, 'ready');
});

test(
  'The unmodified legacy handshake receives later text while >100 MiB stays queued locally',
  { timeout: 25000 },
  async (t) => {
    const source = await pairingNode(t);
    const peerId = randomUUID();
    const secret = randomBytes(32).toString('hex');
    const certificate = await readFile(path.join(source.directory, 'node-cert.pem'), 'utf8');
    await source.settings.savePeers(() => [
      { id: peerId, label: 'Legacy fixture', address: '', secret, certificate },
    ]);
    const socket = new WebSocket(source.snapshot().peerUrl, {
      ca: certificate,
      headers: { authorization: 'Bearer ' + secret, 'x-node-id': peerId },
    });
    t.after(() => socket.terminate());
    const messages: string[] = [];
    socket.on('message', (bytes) => {
      const frame = JSON.parse(bytes.toString());
      if (frame.type === 'message') messages.push(frame.envelope.id);
    });
    await withDeadline(
      new Promise<void>((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
      }),
      5000,
      'legacy socket open',
    );
    socket.send(JSON.stringify({ type: 'hello', protocol: 2, nodeId: peerId }));
    await until(() => source.snapshot().peers[0]?.connected === true);
    const send = sender(source, peerId);
    const oversized = await send('large file stays on sender', [
      await sparseFixture(source, legacyLimit + 1),
    ]);
    assert.equal(oversized.attachmentTransfer, 'peer_size_limit');
    assert.equal(oversized.delivery, 'queued');
    const text = await send('legacy receives text');
    await until(() => messages.includes(text.id));
    assert.deepEqual(messages, [text.id]);
    assert.equal(source.store.get(oversized.id, 'out')?.state, 'queued');
  },
);

test('A pre-update peer can still set its incoming limit with the existing handshake header', async (t) => {
  const node = await pairingNode(t);
  const peerId = randomUUID();
  const secret = randomBytes(32).toString('hex');
  const certificate = await readFile(path.join(node.directory, 'node-cert.pem'), 'utf8');
  await node.userCall('saveAttachmentLimit', { limitMiB: 3 });
  await node.settings.savePeers(() => [
    { id: peerId, label: 'Previous-version fixture', address: '', secret, certificate },
  ]);
  const socket = new WebSocket(node.snapshot().peerUrl, {
    ca: certificate,
    headers: {
      authorization: 'Bearer ' + secret,
      'x-node-id': peerId,
      'x-ncf-attachment-limit-mib': '1',
    },
  });
  t.after(() => socket.terminate());
  await withDeadline(
    new Promise<void>((resolve, reject) => {
      socket.once('upgrade', (result) => {
        try {
          assert.equal(result.headers['x-ncf-attachment-limit-mib'], 'unlimited');
        } catch (error) {
          reject(error);
        }
      });
      socket.once('open', resolve);
      socket.once('error', reject);
    }),
    5000,
    'previous-version socket open',
  );
  socket.send(JSON.stringify({ type: 'hello', protocol: 2, nodeId: peerId }));
  await until(() => node.snapshot().peers[0]?.connected === true);
  const blocked = await sender(node, peerId)('the previous receiver still rejects it', [
    await sparseFixture(node, bytesPerMiB + 1),
  ]);
  assert.equal(blocked.delivery, 'queued');
  assert.equal(blocked.attachmentTransfer, 'peer_size_limit');
});

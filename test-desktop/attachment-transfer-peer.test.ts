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
  'The receiving limit keeps a large file queued and retries it after a capability change',
  { timeout: 45000 },
  async (t) => {
    const source = await pairingNode(t),
      target = await pairingNode(t);
    await target.userCall('saveAttachmentLimit', { limitMiB: 1 });
    await source.network.join(target.snapshot().peerUrl, target.network.accessCode().code);
    await until(() => source.snapshot().peers[0]?.connected === true);
    const send = sender(source, target.settings.value.nodeId);
    const file = await sparseFixture(source, legacyLimit + 1);
    const pending = await send('above the legacy ceiling', [file]);
    assert.equal(pending.accepted, true);
    assert.equal(pending.delivery, 'queued');
    assert.equal(pending.attachmentTransfer, 'peer_size_limit');
    assert.equal(target.store.get(pending.id, 'in'), undefined);
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
    const attachment = source.store.get(pending.id, 'out')!.envelope.attachments[0];
    try {
      await target.userCall('saveAttachmentLimit', { limitMiB: null });
      await withDeadline(lastChunk, 20000, 'last attachment chunk');
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

test('The receiver independently rejects a send made against a stale advertised limit before writing', async (t) => {
  const source = await pairingNode(t),
    target = await pairingNode(t);
  await source.network.join(target.snapshot().peerUrl, target.network.accessCode().code);
  await until(() => source.snapshot().peers[0]?.connected === true);
  // Model an already in-flight envelope: the receiver's persisted limit changes
  // before its updated limit notice reaches the sender.
  await target.settings.saveAttachmentLimit(1);
  const pending = await sender(source, target.settings.value.nodeId)('against stale capability', [
    await sparseFixture(source, bytesPerMiB + 1),
  ]);
  const saved = source.store.get(pending.id, 'out')!;
  assert.equal(pending.attachmentTransfer, undefined);
  assert.equal(pending.delivery, 'queued');
  const attachment = saved.envelope.attachments[0];
  await until(() => {
    const active = source.network as unknown as {
      links: Map<string, { attachmentLimitMiB: number }>;
    };
    return active.links.get(target.settings.value.nodeId)?.attachmentLimitMiB === 1;
  });
  assert.equal(target.store.get(pending.id, 'in'), undefined);
  await assert.rejects(stat(target.files.blob(attachment.id) + '.part'), { code: 'ENOENT' });
  assert.equal(source.store.get(pending.id, 'out')?.state, 'queued');
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

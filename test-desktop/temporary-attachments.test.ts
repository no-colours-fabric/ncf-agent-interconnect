import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { copyFile, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { NodeService } from '../desktop/core/service.js';
import type { ReceivedAttachmentUsage } from '../desktop/shared/attachment-cleanup.js';
import type { Attachment, ChatHistoryPage } from '../desktop/shared/contracts.js';
import { mcpRead } from './fixtures/mcp-read.js';
import { pairingNode } from './pairing-node-fixture.js';
import { until } from './aionui-fixture.js';

function connected(service: NodeService, nickname: string) {
  const agent = service.connect({ nickname, client: 'MCP' });
  if (agent.status !== 'connected') throw new Error('Fixture owner unavailable');
  return agent.binding.connectionId;
}

type History = {
  messages: {
    envelope: { id: string; text: string };
    files: (Attachment & { localPath?: string; status?: string })[];
  }[];
};

test('Peer receipt removes staged sources automatically; scoped cleanup preserves shared, edited, pending and saved files', async (t) => {
  const sender = await pairingNode(t);
  const receiver = await pairingNode(t);
  await sender.network.join(receiver.snapshot().peerUrl, receiver.network.accessCode().code);
  const sourceId = connected(sender, 'Source');
  const receiverId = connected(receiver, 'Recipient');
  const otherId = connected(receiver, 'Other');
  const mcp = new Client({ name: 'Attachment fixture', version: '1' });
  t.after(() => mcp.close());
  await mcp.connect(
    new StreamableHTTPClientTransport(new URL(sender.snapshot().mcpUrl), {
      requestInit: { headers: { authorization: 'Bearer ' + sender.settings.value.localToken } },
    }),
  );
  const temporary = async (name: string, bytes: string) => {
    const result = await mcp.callTool({
      name: 'attachment_stage',
      arguments: { connectionId: sourceId, name },
    });
    assert.equal(result.isError ?? false, false, JSON.stringify(result.content));
    const localPath = (result.structuredContent as { localPath?: unknown } | undefined)?.localPath;
    assert.equal(typeof localPath, 'string');
    await writeFile(localPath as string, bytes);
    return localPath as string;
  };
  const exact = await temporary('временный 漢字.txt', 'shared digest');
  const edited = await temporary('edited.txt', 'edit me after delivery');
  const waiting = await temporary('waiting.txt', 'still queued for the agent');
  const normal = path.join(sender.settings.value.exportRoots[0], 'ordinary.txt');
  await writeFile(normal, 'shared digest');
  const send = (nickname: string, text: string, files: string[], id?: string) =>
    sender.send({
      connectionId: sourceId,
      recipientNode: receiver.settings.value.nodeId,
      recipientNickname: nickname,
      text,
      files,
      id,
    });
  const one = await send('Recipient', 'Temporary message', [exact, edited]);
  const two = await send('Other', 'Ordinary file with the same digest', [normal]);
  const queued = await send('Offline mailbox', 'Pending delivery', [waiting]);
  await until(() =>
    [one, two, queued].every(({ id }) => sender.store.get(id, 'out')?.state === 'ready'),
  );
  const now = Date.now();
  const deadline = now - 7 * 86_400_000;
  const setAge = receiver.store.db.prepare(
    'UPDATE received_attachment_times SET received_at=? WHERE message_id=?',
  );
  setAge.run(deadline - 1, one.id);
  setAge.run(deadline, two.id);
  setAge.run(deadline - 1, queued.id);
  const recipient = receiver.store.list().find((agent) => agent.nickname === 'Recipient')!;
  const remove = (scope: 'all' | 'agent', olderThanDays: 7 | 'all' = 7) =>
    receiver.userCall('removeReceivedAttachments', {
      olderThanDays,
      ...(scope === 'all'
        ? { scope }
        : {
            scope,
            key: recipient.key,
            incarnation: recipient.incarnation,
          }),
    });
  assert.deepEqual(await remove('all'), { removed: 0, preserved: 0 });
  assert.equal(await readFile(exact, 'utf8'), 'shared digest');
  assert.equal(await readFile(waiting, 'utf8'), 'still queued for the agent');
  assert.deepEqual(await remove('all', 'all'), { removed: 0, preserved: 0 });
  await writeFile(edited, 'source working edits');
  const savedSource = path.join(sender.settings.value.exportRoots[0], 'saved-source.txt');
  await copyFile(exact, savedSource);
  const roundTrip = (await mcpRead(receiver, receiverId)) as History;
  const otherHistory = (await mcpRead(receiver, otherId)) as History;
  const original = roundTrip.messages.find(({ envelope }) => envelope.id === one.id)!;
  const ordinary = otherHistory.messages.find(({ envelope }) => envelope.id === two.id)!;
  const [managedCopy, editedCopy] = original.files;
  assert.equal(await readFile(managedCopy.localPath!, 'utf8'), 'shared digest');
  assert.equal(await readFile(ordinary.files[0].localPath!, 'utf8'), 'shared digest');
  const saved = path.join(receiver.settings.value.exportRoots[0], 'saved-received.txt');
  await copyFile(managedCopy.localPath!, saved);
  await until(
    () =>
      sender.store.attachments.verifiedSources(one.id).length === 1 &&
      sender.store.get(one.id, 'out')?.state === 'processed',
  );
  await assert.rejects(readFile(exact), { code: 'ENOENT' });
  const retry = await send('Recipient', 'Temporary message', [exact, edited], one.id).catch(
    (error: Error) => error,
  );
  assert.match(String(retry), /Duplicate ID with different content/);
  await writeFile(editedCopy.localPath!, 'recipient working edits');

  t.mock.timers.enable({ apis: ['Date'], now });
  assert.deepEqual(
    await receiver
      .userCall('removeReceivedAttachments', {
        olderThanDays: 7,
        scope: 'agent',
        key: recipient.key,
        incarnation: randomUUID(),
      })
      .catch((error: Error) => error.message),
    'The selected agent changed',
  );
  const usage = () =>
    receiver.userCall('receivedAttachmentUsage', {}) as Promise<ReceivedAttachmentUsage>;
  const before = await usage();
  assert.equal(
    before.agents.find(({ nickname }) => nickname === 'Other')?.bytes,
    managedCopy.size * 2,
  );
  assert.ok(before.totalBytes < before.agents.reduce((sum, row) => sum + row.bytes, 0));
  setAge.run(now, one.id);
  assert.deepEqual(await remove('agent'), { removed: 0, preserved: 0 });
  assert.deepEqual(await remove('agent', 'all'), { removed: 1, preserved: 1 });
  assert.deepEqual(await remove('all'), { removed: 0, preserved: 0 });
  await assert.rejects(readFile(managedCopy.localPath!), { code: 'ENOENT' });
  assert.equal(await readFile(edited, 'utf8'), 'source working edits');
  assert.equal(await readFile(editedCopy.localPath!, 'utf8'), 'recipient working edits');
  assert.equal(await readFile(waiting, 'utf8'), 'still queued for the agent');
  assert.equal(await readFile(normal, 'utf8'), 'shared digest');
  assert.equal(await readFile(saved, 'utf8'), 'shared digest');
  assert.equal(await readFile(savedSource, 'utf8'), 'shared digest');
  assert.equal(await receiver.files.exists(managedCopy), true);
  assert.equal(await readFile(ordinary.files[0].localPath!, 'utf8'), 'shared digest');
  assert.equal(
    (await usage()).agents.find(({ key }) => key === recipient.key)?.bytes,
    editedCopy.size,
  );

  const after = (await mcpRead(receiver, receiverId)) as History;
  const first = after.messages.find(({ envelope }) => envelope.id === one.id)!;
  assert.equal(first.envelope.text, 'Temporary message');
  assert.deepEqual(first.files[0], {
    id: managedCopy.id,
    size: managedCopy.size,
    name: 'временный 漢字.txt',
    status: 'unavailable',
  });
  await assert.rejects(receiver.receiveFile(receiverId, one.id, managedCopy.id), /unavailable/);
  const ui = (await receiver.userCall('chatHistory', { nickname: 'Recipient' })) as ChatHistoryPage;
  assert.deepEqual(
    ui.messages.find(({ envelope }) => envelope.id === one.id)?.unavailableAttachments,
    [managedCopy.id],
  );
  assert.equal(
    ui.messages.find(({ envelope }) => envelope.id === one.id)?.envelope.attachments[0].name,
    'временный 漢字.txt',
  );
  assert.deepEqual(await remove('all', 'all'), { removed: 1, preserved: 1 });
  assert.deepEqual(await remove('all', 'all'), { removed: 0, preserved: 1 });
  assert.equal(receiver.store.get(queued.id, 'in')?.state, 'ready');
  const otherAfter = (await mcpRead(receiver, otherId)) as History;
  assert.equal(
    otherAfter.messages.find(({ envelope }) => envelope.id === two.id)?.files[0].status,
    'unavailable',
  );
  await assert.rejects(stat(receiver.files.blob(managedCopy.id)), { code: 'ENOENT' });
  await assert.rejects(stat(ordinary.files[0].localPath!), { code: 'ENOENT' });
});

test('Local temporary attachment cleanup follows the same mailbox after a rename', async (t) => {
  const service = await pairingNode(t);
  const sender = connected(service, 'Source');
  const recipient = connected(service, 'Recipient');
  const { localPath } = await service.stageAttachment(sender, 'temporary.txt');
  await writeFile(localPath, 'Local temporary contents');
  const send = (id?: string) =>
    service.send({
      connectionId: sender,
      recipientNode: service.settings.value.nodeId,
      recipientNickname: 'Recipient',
      text: 'Local attachment',
      files: [localPath],
      id,
    });
  const { id } = await send();
  const owner = service.store.list().find(({ nickname }) => nickname === 'Recipient')!;
  assert.deepEqual(
    await service.userCall('renameAgent', {
      key: owner.key,
      incarnation: owner.incarnation,
      currentNickname: owner.nickname,
      nickname: 'Renamed recipient',
    }),
    { status: 'renamed' },
  );
  const before = (await mcpRead(service, recipient)) as History;
  const file = before.messages.find(({ envelope }) => envelope.id === id)!.files[0];
  assert.equal(await readFile(file.localPath!, 'utf8'), 'Local temporary contents');
  await until(
    () =>
      service.store.get(id, 'out')?.state === 'processed' &&
      service.store.attachments.verifiedSources(id).length === 0,
  );
  await assert.rejects(readFile(localPath), { code: 'ENOENT' });
  const retry = await send(id);
  assert.equal(retry.id, id);
  assert.equal(retry.delivery, 'received_by_agent');
  service.store.db
    .prepare('UPDATE received_attachment_times SET received_at=? WHERE message_id=?')
    .run(Date.now() - 40 * 86_400_000, id);
  assert.deepEqual(
    await service.userCall('removeReceivedAttachments', {
      scope: 'agent',
      key: owner.key,
      incarnation: owner.incarnation,
      olderThanDays: 30,
    }),
    { removed: 1, preserved: 0 },
  );
  // Outgoing history is an independent reference to the same local copy and blob.
  assert.equal(await readFile(file.localPath!, 'utf8'), 'Local temporary contents');
  const outgoing = (await mcpRead(service, sender)) as History;
  assert.equal(
    outgoing.messages.find(({ envelope }) => envelope.id === id)?.files[0].localPath,
    file.localPath,
  );
  const ui = (await service.userCall('chatHistory', {
    nickname: 'Renamed recipient',
  })) as ChatHistoryPage;
  const row = ui.messages.find(({ envelope }) => envelope.id === id);
  assert.equal(row?.envelope.text, 'Local attachment');
  assert.deepEqual(row?.unavailableAttachments, [file.id]);
});

test('A persisted agent receipt is enough to finish interrupted source cleanup on node restart', async (t) => {
  const service = await pairingNode(t);
  const source = connected(service, 'Source');
  const recipient = connected(service, 'Recipient');
  const { localPath } = await service.stageAttachment(source, 'restart.txt');
  await writeFile(localPath, 'Restart fixture');
  const { id } = await service.send({
    connectionId: source,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Recipient',
    text: 'Restart fixture',
    files: [localPath],
  });
  // Simulate a process stopping after the committed receipt but before its file job.
  assert.deepEqual([...service.store.recordDelivery(recipient, [id])], [id]);
  assert.equal(await readFile(localPath, 'utf8'), 'Restart fixture');
  await service.stop();
  await service.start();
  await until(() => service.store.attachments.verifiedSources(id).length === 0);
  await assert.rejects(stat(localPath), { code: 'ENOENT' });
  assert.equal(service.store.get(id, 'out')?.state, 'processed');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NodeService } from '../desktop/core/service.js';
import type { Message } from '../desktop/shared/contracts.js';

async function fixture(t: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-delivery-')),
    service = new NodeService(directory);
  await service.open();
  t.after(async () => {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  const sender = service.connect({ nickname: 'Автор', client: 'MCP' }),
    recipient = service.connect({ nickname: 'Получатель', client: 'MCP' });
  if (sender.status !== 'connected' || recipient.status !== 'connected') throw new Error();
  const unread = () =>
    service.snapshot().agents.find((agent) => agent.nickname === 'Получатель')!.unread;
  return { service, sender, recipient, unread };
}
const page = (value: unknown) =>
  value as { messages: Message[]; nextCursor: number; hasMore: boolean };

test("MCP receipt is automatic for exactly the returned page; history persists and outgoing history cannot receive another agent's messages", async (t) => {
  const f = await fixture(t),
    ids: string[] = [];
  for (const text of ['Первое', 'Второе', 'Третье']) {
    const sent = await f.service.send({
      connectionId: f.sender.binding.connectionId,
      recipientNode: f.service.settings.value.nodeId,
      recipientNickname: 'Получатель',
      text,
    });
    assert.equal(sent.accepted, true);
    assert.equal(sent.delivery, 'accepted_by_node');
    assert.equal(sent.recipientNode, f.service.settings.value.nodeId);
    ids.push(sent.id);
  }
  await f.service.read(f.sender.binding.connectionId);
  assert.equal(f.unread(), 3);
  const first = page(await f.service.read(f.recipient.binding.connectionId, 0, 1, true));
  assert.deepEqual(
    first.messages.map((message) => message.envelope.id),
    ids.slice(0, 1),
  );
  assert.equal(first.hasMore, true);
  assert.equal(f.unread(), 2);
  assert.ok(!('state' in first.messages[0]));
  assert.ok(!('error' in first.messages[0]));
  assert.equal(f.service.store.get(ids[0], 'out')!.state, 'processed');
  assert.equal(f.service.store.get(ids[1], 'out')!.state, 'ready');
  const next = page(await f.service.read(f.recipient.binding.connectionId, 0, 1, true));
  assert.equal(next.messages[0].envelope.id, ids[1]);
  assert.equal(f.unread(), 1);
  const history = page(await f.service.read(f.recipient.binding.connectionId));
  assert.deepEqual(
    history.messages.map((message) => message.envelope.id),
    ids,
  );
  assert.equal(f.unread(), 0);
  assert.equal(
    page(await f.service.read(f.recipient.binding.connectionId, 0, 50, true)).messages.length,
    0,
  );
  assert.equal(page(await f.service.read(f.recipient.binding.connectionId)).messages.length, 3);
});

test('simultaneous inbox requests do not both receive the same messages', async (t) => {
  const f = await fixture(t);
  for (const text of ['Один', 'Два'])
    await f.service.send({
      connectionId: f.sender.binding.connectionId,
      recipientNode: f.service.settings.value.nodeId,
      recipientNickname: 'Получатель',
      text,
    });
  const results = await Promise.all([
    f.service.read(f.recipient.binding.connectionId, 0, 50, true),
    f.service.read(f.recipient.binding.connectionId, 0, 50, true),
  ]);
  const messages = results.flatMap((result) => page(result).messages);
  assert.equal(messages.length, 2);
  assert.equal(new Set(messages.map((message) => message.envelope.id)).size, 2);
  assert.equal(f.unread(), 0);
});

test('failed attachment preparation and a revoked chat cannot clear the inbox', async (t) => {
  const f = await fixture(t),
    filename = path.join(f.service.settings.value.exportRoots[0], 'план.txt');
  await writeFile(filename, 'Проверенное вложение');
  await f.service.send({
    connectionId: f.sender.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Получатель',
    text: 'Изучи план',
    files: [filename],
  });
  const original = f.service.files.materialize.bind(f.service.files);
  f.service.files.materialize = async () => {
    throw new Error('The attachment is unavailable');
  };
  await assert.rejects(
    f.service.read(f.recipient.binding.connectionId, 0, 50, true),
    /The attachment is unavailable/,
  );
  assert.equal(f.unread(), 1);
  let unblock!: () => void, started!: () => void;
  const waiting = new Promise<void>((resolve) => {
      unblock = resolve;
    }),
    preparing = new Promise<void>((resolve) => {
      started = resolve;
    });
  f.service.files.materialize = async (...args) => {
    const copy = await original(...args);
    started();
    await waiting;
    return copy;
  };
  const read = f.service.read(f.recipient.binding.connectionId, 0, 50, true);
  await preparing;
  const transfer = f.service.connect({ nickname: 'Получатель', client: 'Другой чат' });
  if (transfer.status !== 'nickname_in_use') throw new Error();
  const moved = f.service.connect({
    nickname: 'Получатель',
    ...transfer.requestingChat,
    connectionId: transfer.connectionId,
    transferId: transfer.transferId,
    confirmTransfer: true,
  });
  if (moved.status !== 'connected') throw new Error();
  unblock();
  await assert.rejects(read, /agent_moved/);
  assert.equal(f.unread(), 1);
  f.service.files.materialize = original;
  assert.equal(
    page(await f.service.read(moved.binding.connectionId, 0, 50, true)).messages.length,
    1,
  );
  assert.equal(f.unread(), 0);
});

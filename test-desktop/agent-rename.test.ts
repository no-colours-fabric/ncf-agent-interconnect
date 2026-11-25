import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { AgentStore } from '../desktop/core/agent-store.js';
import { NodeService } from '../desktop/core/service.js';
import type { Binding, Envelope } from '../desktop/shared/contracts.js';

const rename = (store: AgentStore, currentNickname: string, nickname: string) => {
  const key = store.keyForNickname(currentNickname)!;
  return {
    key,
    incarnation: store.sourceStampByKey(key).incarnation!,
    currentNickname,
    nickname,
  };
};

test('a version-five profile keeps raw history and identity while enforcing NFC and case folding on rename', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-rename-legacy-'));
  const incarnation = randomUUID();
  const binding: Binding = {
    connectionId: randomUUID(),
    client: 'Cursor',
    chatId: 'exact legacy chat',
    adapterId: randomUUID(),
    generation: 3,
  };
  const saved: Envelope = {
    protocol: 2,
    id: randomUUID(),
    fromNode: randomUUID(),
    toNode: randomUUID(),
    fromNickname: 'Sender',
    toNickname: 'Old',
    createdAt: '2026-11-22T09:00:00.000Z',
    text: 'Сохранённое сообщение 漢字',
    replyTo: null,
    attachments: [{ id: 'a'.repeat(64), name: 'Документ.txt', size: 7 }],
  };
  const db = new DatabaseSync(path.join(directory, 'agents.sqlite'));
  db.exec(`
    CREATE TABLE agents (key TEXT PRIMARY KEY, nickname TEXT NOT NULL, binding TEXT, generation INTEGER NOT NULL DEFAULT 0, incarnation TEXT NOT NULL DEFAULT '');
    CREATE TABLE messages (sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, local_key TEXT NOT NULL, direction TEXT NOT NULL, envelope TEXT NOT NULL, state TEXT NOT NULL, error TEXT, UNIQUE(id,direction));
    CREATE TABLE timeline (cursor INTEGER PRIMARY KEY AUTOINCREMENT, message_id TEXT NOT NULL, direction TEXT NOT NULL, UNIQUE(message_id,direction));
    CREATE TABLE dispatches (message_id TEXT PRIMARY KEY, connection_id TEXT NOT NULL, state TEXT NOT NULL, error TEXT, attempt_id TEXT, attempt_meta TEXT);
    PRAGMA user_version=5;
  `);
  db.prepare("INSERT INTO agents VALUES('old','Old',?,3,?)").run(
    JSON.stringify(binding),
    incarnation,
  );
  db.prepare("INSERT INTO messages VALUES(42,?,'old','in',?,'ready',NULL)").run(
    saved.id,
    JSON.stringify(saved),
  );
  db.prepare("INSERT INTO timeline VALUES(81,?,'in')").run(saved.id);
  db.close();
  let store = new AgentStore(directory);
  t.after(async () => {
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  store.ensure('Café');
  const before = store.list();
  assert.equal(store.rename(rename(store, 'Old', 'CAFE\u0301')), 'nickname_in_use');
  assert.deepEqual(store.list(), before);
  const oldRequest = rename(store, 'Old', 'Straße');
  assert.equal(store.rename(oldRequest), 'renamed');
  assert.equal(store.rename(oldRequest), 'stale');
  assert.equal(store.rename(rename(store, 'Straße', 'STRASSE')), 'renamed');
  assert.equal(store.rename(rename(store, 'STRASSE', 'STRASSE')), 'unchanged');
  assert.equal(store.keyForNickname('straße'), 'old');
  const reused = store.ensure('OLD');
  assert.notEqual(reused, 'old');
  assert.equal(store.history(reused).messages.length, 0);
  store.close();
  store = new AgentStore(directory);
  assert.deepEqual(store.assertOwner(binding.connectionId), {
    key: 'old',
    nickname: 'STRASSE',
    binding,
  });
  assert.equal(store.sourceStampByKey('old').incarnation, incarnation);
  assert.deepEqual(store.history('old').messages[0].envelope, saved);
  assert.equal(store.history('old').nextCursor, 81);
  assert.equal(store.incomingBySequence('old', 42)?.envelope.id, saved.id);
  assert.equal(store.attachmentReferenced(saved.attachments[0].id), true);
});

test('local sends and old Reply-To preserve the exact mailbox across rename and reuse during an attachment send', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-rename-route-'));
  const service = new NodeService(directory);
  t.after(async () => {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  await service.open();
  await service.userCall('exportRoots', { roots: [directory] });
  await service.start();
  const nodeId = service.settings.value.nodeId;
  const a = service.connect({ nickname: 'Автор', client: 'A', chatId: 'exact author chat' });
  const b = service.connect({
    nickname: 'Получатель',
    client: 'B',
    chatId: 'exact recipient chat',
  });
  assert.equal(a.status, 'connected');
  assert.equal(b.status, 'connected');
  const source = a.binding.connectionId;
  const target = b.binding.connectionId;
  const payloadPath = path.join(directory, 'Вложение.txt');
  await writeFile(payloadPath, 'Вложение 漢字');
  const file = service.files.snapshot.bind(service.files);
  let begin!: () => void, resume!: () => void;
  const began = new Promise<void>((resolve) => {
    begin = resolve;
  });
  const resumed = new Promise<void>((resolve) => {
    resume = resolve;
  });
  service.files.snapshot = async (filepath) => {
    begin();
    await resumed;
    return file(filepath);
  };
  const pending = service.send({
    connectionId: source,
    recipientNode: nodeId,
    recipientNickname: 'Получатель',
    text: 'Сообщение в пути',
    files: [payloadPath],
  });
  await began;
  const targetRename = rename(service.store, 'Получатель', 'Эксперт');
  const sourceRename = rename(service.store, 'Автор', 'Редактор');
  try {
    assert.deepEqual(await service.userCall('renameAgent', targetRename), { status: 'renamed' });
    await service.userCall('registerAgent', { nickname: 'Получатель' });
  } finally {
    resume();
  }
  const sent = await pending;
  const stored = service.store.get(sent.id, 'in')!;
  assert.equal(service.store.messageOwnerKey(sent.id, 'in'), targetRename.key);
  assert.equal(stored.envelope.toNickname, 'Получатель');
  assert.equal(
    service.store.history(service.store.keyForNickname('Получатель')!).messages.length,
    0,
  );
  assert.deepEqual(await service.userCall('renameAgent', sourceRename), { status: 'renamed' });
  await service.userCall('registerAgent', { nickname: 'Автор' });
  const address = service.resolveReplyAddress(target, {
    replyRef: 'r' + stored.sequence.toString(36),
  });
  assert.equal(address.recipientNickname, 'Автор');
  const response = await service.send({
    connectionId: target,
    ...address,
    text: 'Ответ по старому коду',
  });
  assert.equal(service.store.messageOwnerKey(response.id, 'in'), sourceRename.key);
  assert.equal(service.store.history(service.store.keyForNickname('Автор')!).messages.length, 0);
  assert.deepEqual(service.store.assertOwner(target).binding, b.binding);
  assert.deepEqual(service.store.assertOwner(source).binding, a.binding);
  const fileId = stored.envelope.attachments[0].id;
  const attachment = (await service.receiveFile(target, sent.id, fileId)) as { localPath: string };
  assert.equal(await readFile(attachment.localPath, 'utf8'), 'Вложение 漢字');
  const senderAttachment = (await service.receiveFile(source, sent.id, fileId)) as {
    localPath: string;
  };
  assert.equal(await readFile(senderAttachment.localPath, 'utf8'), 'Вложение 漢字');
  const replacement = service.connect({ nickname: 'Получатель', client: 'Wrong chat' });
  assert.equal(replacement.status, 'connected');
  await assert.rejects(
    service.receiveFile(replacement.binding.connectionId, sent.id, fileId),
    /does not belong/,
  );
  const before = service.agentDirectories()[0].revision!;
  const finalRename = rename(service.store, 'Эксперт', 'EXPERT');
  assert.deepEqual(await service.userCall('renameAgent', finalRename), { status: 'renamed' });
  const directoryAfter = service.agentDirectories()[0];
  assert.ok(directoryAfter.revision! > before);
  assert.ok(directoryAfter.agents.some(({ nickname }) => nickname === 'EXPERT'));
  assert.ok(!directoryAfter.agents.some(({ nickname }) => nickname === 'Эксперт'));
  const next = await service.send({
    connectionId: source,
    recipientNode: nodeId,
    recipientNickname: 'expert',
    text: 'На новое имя',
  });
  assert.equal(service.store.messageOwnerKey(next.id, 'in'), targetRename.key);
  assert.deepEqual(service.store.assertOwner(target).binding, b.binding);
  assert.equal(
    (
      (await service.userCall('chatHistory', {
        nickname: 'EXPERT',
        incarnation: targetRename.incarnation,
      })) as { messages: { envelope: Envelope }[] }
    ).messages.some(({ envelope }) => envelope.id === sent.id),
    true,
  );
  const retry = await service.send({
    id: sent.id,
    connectionId: source,
    recipientNode: nodeId,
    recipientNickname: 'Получатель',
    text: 'Сообщение в пути',
    files: [payloadPath],
  });
  assert.equal(retry.id, sent.id);
  assert.equal(service.store.messageOwnerKey(sent.id, 'in'), targetRename.key);
});

test('a rename keeps an issued attempt and its original receipt attached to the same binding', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-rename-attempt-'));
  const store = new AgentStore(directory);
  t.after(async () => {
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  const node = randomUUID();
  const target = store.connect({
    nickname: 'Before',
    client: 'Cursor',
    chatId: 'exact chat',
    adapterId: randomUUID(),
  });
  assert.equal(target.status, 'connected');
  const id = randomUUID();
  store.insertLocal(
    {
      protocol: 2,
      id,
      fromNode: node,
      toNode: node,
      fromNickname: 'Source',
      toNickname: 'Before',
      text: 'Already issued',
      createdAt: '2026-11-22T09:00:00.000Z',
      replyTo: null,
      attachments: [],
    },
    true,
  );
  const lifecycle = { service: randomUUID(), transport: randomUUID() };
  const attempt = store.reserveDelivery({
    connectionId: target.binding.connectionId,
    ids: [id],
    transport: 'native',
    lifecycle,
  });
  store.sealDelivery(attempt.id, 'a'.repeat(64));
  store.issueDelivery(attempt.id);
  assert.equal(store.rename(rename(store, 'Before', 'После')), 'renamed');
  assert.equal(store.deliveryFenced(id), true);
  assert.deepEqual([...store.completeDelivery(attempt.id, lifecycle)], [id]);
  assert.equal(store.get(id, 'in')?.state, 'processed');
  assert.equal(store.get(id, 'out')?.state, 'processed');
  assert.equal(store.get(id, 'in')?.envelope.toNickname, 'Before');
});

test('a remote reply to the former name follows the verified reverse route even after the name is reused', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-rename-peer-'));
  const store = new AgentStore(directory);
  t.after(async () => {
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  const original: Envelope = {
    protocol: 2,
    id: randomUUID(),
    fromNode: randomUUID(),
    toNode: randomUUID(),
    fromNickname: 'Before',
    toNickname: 'Remote',
    createdAt: '2026-11-22T09:00:00.000Z',
    text: 'Original',
    replyTo: null,
    attachments: [],
  };
  store.insert(original, 'out');
  const change = rename(store, 'Before', 'After');
  assert.equal(store.rename(change), 'renamed');
  const other = store.ensure('before');
  const inbound = {
    ...original,
    id: randomUUID(),
    fromNode: original.toNode,
    toNode: original.fromNode,
    fromNickname: 'Remote also renamed',
    toNickname: original.fromNickname,
    replyTo: original.id,
  };
  store.insert(inbound, 'in');
  assert.equal(store.messageOwnerKey(inbound.id, 'in'), change.key);
  const wrongNode = { ...inbound, id: randomUUID(), fromNode: randomUUID() };
  store.insert(wrongNode, 'in');
  assert.equal(store.messageOwnerKey(wrongNode.id, 'in'), other);
});

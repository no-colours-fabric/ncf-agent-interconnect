import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AgentStore } from '../desktop/core/agent-store.js';
import { nicknameKey, type Envelope } from '../desktop/shared/contracts.js';
import { FileStore } from '../desktop/core/files.js';

async function fixture(t: test.TestContext) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'interconnect беседы '));
  let store = new AgentStore(dir);
  t.after(async () => {
    store.close();
    await rm(dir, { recursive: true, force: true });
  });
  return {
    dir,
    get store() {
      return store;
    },
    reopen() {
      store.close();
      store = new AgentStore(dir);
    },
  };
}
const bind = (nickname: string, client = 'Cursor', chatId = randomUUID()) => ({
  nickname,
  client,
  chatId,
  adapterId: randomUUID(),
});
const envelope = (nickname: string): Envelope => ({
  protocol: 2,
  id: randomUUID(),
  fromNode: randomUUID(),
  toNode: randomUUID(),
  fromNickname: 'Собеседник',
  toNickname: nickname,
  createdAt: new Date().toISOString(),
  text: 'Кириллица\nВторая строка',
  replyTo: null,
  attachments: [],
});

test('nicknames identify agents case-insensitively across chats and clients', async (t) => {
  const f = await fixture(t),
    input = bind('Проект');
  const first = f.store.connect(input);
  assert.equal(first.status, 'connected');
  const second = f.store.connect(bind('ПРОЕКТ', 'OpenCode'));
  assert.equal(second.status, 'nickname_in_use');
  assert.equal(f.store.list().length, 1);
  assert.equal(nicknameKey('ДОЗОР'), nicknameKey('дозор'));
  assert.notEqual(nicknameKey('дозор'), nicknameKey('dozor'));
  assert.equal(nicknameKey('Straße'), nicknameKey('STRASSE'));
  if (first.status === 'connected')
    assert.equal(f.store.assertOwner(first.binding.connectionId).binding.client, 'Cursor');
  if (second.status === 'nickname_in_use')
    assert.ok(
      !('connectionId' in second.currentOwner),
      'conflict must not leak the old binding capability',
    );
});

test('approved transfer preserves history, revokes old chat, and persists its system notification', async (t) => {
  const f = await fixture(t),
    old = f.store.connect(bind('Обсуждение'));
  assert.equal(old.status, 'connected');
  if (old.status !== 'connected') throw new Error();
  const message = envelope('ОБСУЖДЕНИЕ');
  f.store.insert(message, 'in');
  f.store.ready(message.id);
  const candidate = bind('обсуждение', 'OpenCode'),
    pending = f.store.connect(candidate);
  assert.equal(pending.status, 'nickname_in_use');
  if (pending.status !== 'nickname_in_use') throw new Error();
  assert.equal(f.store.assertOwner(old.binding.connectionId).nickname, 'Обсуждение');
  assert.throws(() => f.store.connect({ ...candidate, confirmTransfer: true }), /transferId/);
  const next = f.store.connect({
    ...candidate,
    connectionId: pending.connectionId,
    transferId: pending.transferId,
    confirmTransfer: true,
  });
  assert.equal(next.status, 'connected');
  if (next.status !== 'connected') throw new Error();
  assert.throws(() => f.store.assertOwner(old.binding.connectionId), /agent_moved/);
  assert.throws(
    () => f.store.recordDelivery(old.binding.connectionId, [message.id]),
    /agent_moved/,
  );
  const history = f.store.history(nicknameKey('Обсуждение'));
  assert.equal(history.messages[0].envelope.text, message.text);
  f.reopen();
  assert.equal(f.store.events(old.binding.connectionId)[0].type, 'agent_moved');
  assert.match(f.store.events(old.binding.connectionId)[0].text, /OpenCode/);
  assert.equal(f.store.assertOwner(next.binding.connectionId).binding.generation, 2);
  f.store.recordDelivery(next.binding.connectionId, [message.id]);
  assert.equal(f.store.history(nicknameKey('Обсуждение'), 0, 10, true).messages.length, 0);
  assert.equal(f.store.history(nicknameKey('Обсуждение')).messages[0].state, 'processed');
});

test('stale approval cannot steal a conversation after another confirmed transfer', async (t) => {
  const f = await fixture(t);
  f.store.connect(bind('Тема'));
  const a = bind('тема', 'A'),
    b = bind('ТЕМА', 'B'),
    pa = f.store.connect(a),
    pb = f.store.connect(b);
  if (pa.status !== 'nickname_in_use' || pb.status !== 'nickname_in_use') throw new Error();
  f.store.connect({
    ...a,
    connectionId: pa.connectionId,
    transferId: pa.transferId,
    confirmTransfer: true,
  });
  assert.throws(
    () =>
      f.store.connect({
        ...b,
        connectionId: pb.connectionId,
        transferId: pb.transferId,
        confirmTransfer: true,
      }),
    /binding changed/,
  );
});

test('another chat cannot record delivery for a different agent; duplicate UUID keeps one message', async (t) => {
  const f = await fixture(t),
    first = f.store.connect(bind('Первая')),
    second = f.store.connect(bind('Вторая'));
  if (first.status !== 'connected' || second.status !== 'connected') throw new Error();
  const message = envelope('Первая');
  f.store.insert(message, 'in');
  f.store.ready(message.id);
  assert.equal(f.store.insert(message, 'in'), false);
  assert.throws(() => f.store.insert({ ...message, text: 'изменено' }, 'in'), /different content/);
  assert.throws(
    () => f.store.recordDelivery(second.binding.connectionId, [message.id]),
    /does not belong/,
  );
  const foreign = envelope('Вторая');
  f.store.insert(foreign, 'in');
  f.store.ready(foreign.id);
  assert.throws(
    () => f.store.recordDelivery(first.binding.connectionId, [message.id, foreign.id]),
    /does not belong/,
  );
  assert.equal(f.store.get(message.id, 'in')!.state, 'ready');
  assert.equal(f.store.dispatchState(message.id), null);
  assert.equal(f.store.history(nicknameKey('Первая')).messages.length, 1);
});

test('readiness cursor never skips a slow attachment that becomes ready after a later message', async (t) => {
  const f = await fixture(t),
    slow = envelope('История'),
    fast = envelope('История');
  f.store.insert(slow, 'in');
  f.store.insert(fast, 'in');
  f.store.ready(fast.id);
  const first = f.store.history(nicknameKey('История'));
  assert.equal(first.messages[0].envelope.id, fast.id);
  f.store.ready(slow.id);
  const next = f.store.history(nicknameKey('История'), first.nextCursor);
  assert.equal(next.messages[0].envelope.id, slow.id);
});

test('received file copies preserve extension and cannot corrupt the immutable transport snapshot', async (t) => {
  const f = await fixture(t),
    files = new FileStore(f.dir, [f.dir]);
  await files.init();
  const input = path.join(f.dir, 'данные.txt');
  await writeFile(input, 'исходное содержимое');
  const attachment = await files.snapshot(input),
    id = randomUUID(),
    copy = await files.materialize(id, attachment);
  assert.equal(path.extname(copy), '.txt');
  await writeFile(copy, 'правка пользователя');
  assert.equal(await files.exists(attachment), true);
  const recovered = await files.materialize(id, attachment);
  assert.notEqual(recovered, copy);
  assert.equal(await files.hash(recovered), attachment.id);
  await assert.rejects(() => files.snapshot(path.join(os.tmpdir(), '..', 'outside.txt')));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { AgentStore, type ConnectInput, type ConnectResult } from '../desktop/core/agent-store.js';
import { nicknameKey, type Envelope } from '../desktop/shared/contracts.js';

async function storage(t: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-reset-'));
  let store = new AgentStore(directory);
  t.after(async () => {
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  return {
    directory,
    get store() {
      return store;
    },
    reopen() {
      store.close();
      store = new AgentStore(directory);
    },
  };
}
const binding = (nickname = 'Филипп'): ConnectInput => ({
  nickname,
  client: 'MCP',
  chatId: randomUUID(),
  adapterId: randomUUID(),
});
function connected(result: ConnectResult) {
  assert.equal(result.status, 'connected');
  if (result.status !== 'connected') throw new Error();
  return result;
}
function pending(result: ConnectResult) {
  assert.equal(result.status, 'nickname_in_use');
  if (result.status !== 'nickname_in_use') throw new Error();
  return result;
}
function confirm(request: ReturnType<typeof pending>, reset = true): ConnectInput {
  return {
    nickname: request.nickname,
    ...request.requestingChat,
    connectionId: request.connectionId,
    transferId: request.choices.find((choice) => choice.mode === (reset ? 'reset' : 'transfer'))!
      .transferId,
    confirmTransfer: true,
    resetHistory: reset,
  };
}
const envelope = (toNickname = 'Филипп'): Envelope => ({
  protocol: 2,
  id: randomUUID(),
  fromNode: randomUUID(),
  toNode: randomUUID(),
  fromNickname: 'Автор',
  toNickname,
  createdAt: new Date().toISOString(),
  text: 'Старая переписка\nUnicode Straße',
  replyTo: null,
  attachments: [],
});

test('reset tokens are mode-bound, exact-chat-bound and never grant legacy preserve approval destructive rights', async (t) => {
  const f = await storage(t),
    input = binding(),
    old = connected(f.store.connect(input));
  const message = envelope();
  f.store.insert(message, 'in');
  const request = pending(f.store.connect(binding('ФИЛИПП')));
  assert.equal(request.transferId, request.choices[0].transferId);
  assert.throws(
    () => f.store.connect({ ...confirm(request), transferId: request.transferId }),
    /selected history mode/,
  );
  assert.throws(
    () => f.store.connect({ ...confirm(request), resetHistory: false }),
    /selected history mode/,
  );
  assert.throws(
    () => f.store.connect({ ...confirm(request), chatId: randomUUID() }),
    /binding changed/,
  );
  assert.throws(
    () => f.store.connect({ ...input, client: 'Spoofed', resetHistory: true }),
    /another chat/,
  );
  assert.throws(
    () => f.store.connect({ ...confirm(request), confirmTransfer: true, transferId: undefined }),
    /transferId/,
  );
  assert.ok(f.store.get(message.id, 'in'));
  assert.ok(f.store.assertOwner(old.binding.connectionId));
  f.reopen();
  const fresh = connected(f.store.connect(confirm(request)));
  assert.equal(fresh.historyCleared, true);
  assert.equal(fresh.binding.generation, 2);
  assert.throws(() => f.store.assertOwner(old.binding.connectionId), /agent_moved/);
  assert.equal(f.store.events(old.binding.connectionId)[0].historyCleared, true);
  assert.throws(() => f.store.connect(confirm(request)), /another chat|transferId/);
  assert.equal(f.store.list().length, 1);
});

test('format 1 migration is atomic, idempotent and keeps legacy requests preserve-only', async (t) => {
  const f = await storage(t);
  connected(f.store.connect(binding()));
  const request = pending(f.store.connect(binding()));
  const message = envelope();
  f.store.insert(message, 'in');
  f.store.ready(message.id);
  f.store.db
    .exec(`CREATE TABLE legacy_transfers AS SELECT id,key,generation,requester,details,expires,consumed FROM transfers WHERE mode='transfer';
    DROP TABLE transfers; ALTER TABLE legacy_transfers RENAME TO transfers;
    DROP TABLE cleared_messages; DROP TABLE file_cleanup; PRAGMA user_version=1;`);
  f.reopen();
  assert.equal(
    (f.store.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
    2,
  );
  assert.throws(
    () => f.store.connect({ ...confirm(request), transferId: request.transferId }),
    /selected history mode/,
  );
  assert.equal(connected(f.store.connect(confirm(request, false))).historyCleared, undefined);
  assert.ok(f.store.get(message.id, 'in'));
  f.reopen();
  assert.ok(f.store.get(message.id, 'in'));
});

test('reset clears owned rows and safe local output only, preserves foreign admission and never reuses short references', async (t) => {
  const f = await storage(t),
    old = connected(f.store.connect(binding()));
  const incoming = envelope(),
    outgoing = { ...envelope('Коллега'), fromNickname: 'Филипп' };
  const file = { id: 'a'.repeat(64), name: 'план.txt', size: 3 };
  incoming.attachments = [file];
  f.store.insert(incoming, 'in');
  f.store.ready(incoming.id);
  const sequence = f.store.get(incoming.id, 'in')!.sequence;
  f.store.dispatch(incoming.id, old.binding.connectionId, 'uncertain');
  f.store.insert(outgoing, 'out');
  const retained: string[] = [],
    removed: string[] = [];
  const colleague = connected(f.store.connect(binding('Коллега')));
  for (const state of ['waiting', 'dispatching', 'uncertain', 'admitted', 'processed']) {
    const local = { ...envelope('Коллега'), fromNickname: 'Филипп' };
    local.toNode = local.fromNode;
    f.store.insertLocal(local, true);
    if (state === 'processed') f.store.recordDelivery(colleague.binding.connectionId, [local.id]);
    else f.store.dispatch(local.id, colleague.binding.connectionId, state);
    (state === 'waiting' ? removed : retained).push(local.id);
  }
  const foreignOutgoing = { ...envelope(), fromNickname: 'Коллега' };
  foreignOutgoing.toNode = foreignOutgoing.fromNode;
  f.store.insertLocal(foreignOutgoing, true);
  const fresh = connected(f.store.connect(confirm(pending(f.store.connect(binding('филипп'))))));
  assert.equal(f.store.history(nicknameKey('Филипп')).messages.length, 0);
  assert.equal(f.store.incomingBySequence(nicknameKey('Филипп'), sequence), undefined);
  assert.equal(f.store.get(outgoing.id, 'out'), undefined);
  assert.equal(f.store.dispatchState(incoming.id), null);
  for (const id of retained) assert.ok(f.store.get(id, 'in'));
  for (const id of removed) assert.equal(f.store.get(id, 'in'), undefined);
  assert.equal(
    f.store.get(foreignOutgoing.id, 'out')!.state,
    'ready',
    'reset must not fabricate agent receipt',
  );
  assert.equal(f.store.fileCleanup().length, 1);
  assert.equal(f.store.attachmentReferenced(file.id), false);
  assert.equal(f.store.insert(incoming, 'in'), false);
  assert.throws(
    () => f.store.insert({ ...incoming, text: 'Different' }, 'in'),
    /different content/,
  );
  f.store.ready(incoming.id);
  f.store.dispatch(incoming.id, old.binding.connectionId, 'failed');
  assert.equal(f.store.dispatchState(incoming.id), null);
  f.reopen();
  assert.equal(f.store.clearedState(incoming.id, 'in'), 'ready');
  assert.equal(f.store.insert(incoming, 'in'), false);
  const next = envelope();
  f.store.insert(next, 'in');
  f.store.ready(next.id);
  assert.ok(f.store.get(next.id, 'in')!.sequence > sequence);
  assert.ok(f.store.assertOwner(fresh.binding.connectionId));
});

test('failed reset rolls back history, cleanup, tombstones, approval and binding; stale or expired requests cannot reset', async (t) => {
  const f = await storage(t),
    old = connected(f.store.connect(binding()));
  const message = envelope();
  message.attachments = [{ id: 'a'.repeat(64), name: 'old.txt', size: 1 }];
  f.store.insert(message, 'in');
  const request = pending(f.store.connect(binding()));
  f.store.db.exec(
    "CREATE TRIGGER reject_binding BEFORE UPDATE ON agents BEGIN SELECT RAISE(ABORT, 'Simulated failure'); END",
  );
  assert.throws(() => f.store.connect(confirm(request)), /Simulated failure/);
  assert.ok(f.store.get(message.id, 'in'));
  assert.equal(f.store.clearedState(message.id, 'in'), undefined);
  assert.deepEqual(f.store.fileCleanup(), []);
  assert.ok(f.store.assertOwner(old.binding.connectionId));
  assert.deepEqual(f.store.events(old.binding.connectionId), []);
  f.store.db.exec('DROP TRIGGER reject_binding');
  const stale = pending(f.store.connect(binding()));
  connected(f.store.connect(confirm(request, false)));
  assert.throws(() => f.store.connect(confirm(stale)), /binding changed/);
  const expired = pending(f.store.connect(binding()));
  f.store.db.prepare('UPDATE transfers SET expires=0 WHERE id=?').run(confirm(expired).transferId!);
  assert.throws(() => f.store.connect(confirm(expired)), /transferId/);
  assert.ok(f.store.get(message.id, 'in'));
});

test('fresh start cannot target an unbound name or the current exact chat', async (t) => {
  const f = await storage(t),
    input = binding();
  assert.throws(() => f.store.connect({ ...input, resetHistory: true }), /another chat/);
  assert.equal(f.store.list().length, 0);
  const old = connected(f.store.connect(input));
  assert.throws(
    () => f.store.connect({ ...input, client: 'Renamed client', resetHistory: true }),
    /another chat/,
  );
  f.store.disconnect(old.binding.connectionId);
  assert.throws(() => f.store.connect({ ...binding(), resetHistory: true }), /another chat/);
  assert.equal(connected(f.store.connect(input)).binding.generation, 2);
});

test('failed format migration leaves the prior version and no partially created reset tables', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-reset-migration-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'agents.sqlite');
  const prior = new DatabaseSync(filename);
  // A conflicting legacy schema forces ALTER TABLE to fail after CREATE statements.
  prior.exec('CREATE TABLE transfers(id TEXT,mode TEXT); PRAGMA user_version=1');
  prior.close();
  assert.throws(() => new AgentStore(directory), /duplicate column/);
  const inspected = new DatabaseSync(filename);
  try {
    assert.equal(
      (inspected.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
      1,
    );
    assert.equal(
      inspected.prepare("SELECT 1 FROM sqlite_master WHERE name='cleared_messages'").get(),
      undefined,
    );
    assert.equal(
      inspected.prepare("SELECT 1 FROM sqlite_master WHERE name='file_cleanup'").get(),
      undefined,
    );
  } finally {
    inspected.close();
  }
});

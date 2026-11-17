import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentStore } from '../desktop/core/agent-store.js';
import { contentHash, decodeDelivery, encodeDelivery } from '../desktop/core/delivery-attempt.js';
import type { Envelope } from '../desktop/shared/contracts.js';

async function fixture(t: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-attempt-'));
  let store = new AgentStore(directory);
  t.after(async () => {
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  const args = {
    nickname: 'Receiver 漢字',
    client: 'Fixture',
    adapterId: randomUUID(),
    chatId: 'exact-session',
  };
  const connected = store.connect(args);
  if (connected.status !== 'connected') throw new Error('Expected fixture binding');
  const connectionId = connected.binding.connectionId,
    node = randomUUID();
  const message = () => {
    const value: Envelope = {
      protocol: 2,
      id: randomUUID(),
      fromNode: node,
      toNode: node,
      fromNickname: 'Sender',
      toNickname: args.nickname,
      createdAt: new Date().toISOString(),
      text: 'Private body 漢字',
      attachments: [],
      replyTo: null,
    };
    store.insertLocal(value, true);
    return value.id;
  };
  const reserve = (ids: string[]) =>
    store.reserveDelivery({
      connectionId,
      ids,
      transport: 'native',
      lifecycle: { service: randomUUID(), transport: randomUUID() },
    });
  const privateReserve = (ids: string[]) =>
    store.reserveClaudeDelivery({ connectionId, ids, helperId: randomUUID(), scope: {} });
  return {
    get store() {
      return store;
    },
    args,
    connectionId,
    message,
    reserve,
    privateReserve,
    restart() {
      store.close();
      store = new AgentStore(directory);
    },
  };
}

test('all-ID reservation is atomic and a second reservation cannot overlap', async (t) => {
  const f = await fixture(t),
    a = f.message(),
    b = f.message();
  const first = f.reserve([b]);
  assert.throws(() => f.reserve([a, b]), /in progress|uncertain/);
  assert.equal(f.store.dispatchState(a), null);
  assert.equal(f.store.deliveryAttempt(first.id).meta.phase, 'reserved');
  assert.throws(() => f.reserve([a, a]), /member set/);
});

test('exact group CAS commits once and loose late dispatch cannot overwrite it', async (t) => {
  const f = await fixture(t),
    a = f.message(),
    b = f.message(),
    attempt = f.reserve([a, b]);
  f.store.sealDelivery(attempt.id, contentHash('actual outbound'));
  assert.throws(() => f.store.sealDelivery(attempt.id, contentHash('replacement')), /phase/);
  f.store.issueDelivery(attempt.id);
  assert.throws(() => f.store.issueDelivery(attempt.id), /phase/);
  assert.throws(
    () =>
      f.store.completeDelivery(attempt.id, { ...attempt.meta.lifecycle, service: randomUUID() }),
    /lifecycle/,
  );
  assert.deepEqual(
    [...f.store.completeDelivery(attempt.id, attempt.meta.lifecycle)].sort(),
    [a, b].sort(),
  );
  assert.equal(f.store.completeDelivery(attempt.id, attempt.meta.lifecycle).size, 0);
  f.store.dispatch(a, randomUUID(), 'failed');
  assert.equal(f.store.dispatchState(a)?.state, 'admitted');
  assert.equal(f.store.get(a, 'out')?.state, 'processed');
});

test('private Claude fence first excludes common reservation', async (t) => {
  const f = await fixture(t),
    a = f.message();
  f.privateReserve([a]);
  assert.throws(() => f.reserve([a]), /in progress|uncertain/);
});

test('common reservation first excludes private Claude fence; definite cancellation permits replacement', async (t) => {
  const f = await fixture(t),
    a = f.message(),
    attempt = f.reserve([a]);
  assert.throws(() => f.privateReserve([a]), /in progress|uncertain/);
  f.store.cancelDelivery(attempt.id);
  const privateId = f.privateReserve([a]);
  assert.throws(() => f.store.issueDelivery(attempt.id), /unavailable/);
  f.store.issueClaudeDelivery(privateId);
  assert.deepEqual(f.store.commitClaudeDelivery(privateId), [a]);
});

test('failed grouped private reservation rolls back retirement of an earlier cancelled common member', async (t) => {
  const f = await fixture(t),
    a = f.message(),
    b = f.message();
  const cancelled = f.reserve([a]);
  f.store.cancelDelivery(cancelled.id);
  const active = f.reserve([b]);
  assert.throws(() => f.privateReserve([a, b]), /in progress|uncertain/);
  assert.equal(f.store.deliveryAttempt(cancelled.id).meta.phase, 'cancelled');
  assert.equal(f.store.deliveryAttempt(active.id).meta.phase, 'reserved');
  assert.equal(
    (
      f.store.db.prepare('SELECT COUNT(*) AS count FROM claude_deliveries').get() as {
        count: number;
      }
    ).count,
    0,
  );
});

for (const phase of ['reserved', 'sealed', 'issued'] as const)
  test(`restart preserves the ${phase} release boundary`, async (t) => {
    const f = await fixture(t),
      a = f.message(),
      attempt = f.reserve([a]);
    if (phase !== 'reserved') f.store.sealDelivery(attempt.id, contentHash('outbound'));
    if (phase === 'issued') f.store.issueDelivery(attempt.id);
    f.restart();
    assert.equal(
      f.store.deliveryAttempt(attempt.id).meta.phase,
      phase === 'issued' ? 'uncertain' : 'cancelled',
    );
    assert.equal(f.store.get(a, 'in')?.state, 'ready');
    if (phase === 'issued') assert.throws(() => f.reserve([a]), /in progress|uncertain/);
    else assert.notEqual(f.reserve([a]).id, attempt.id);
  });

test('unknown phase and malformed metadata recover as uncertainty, never not-released', async (t) => {
  const f = await fixture(t),
    a = f.message(),
    b = f.message();
  const first = f.reserve([a]);
  f.reserve([b]);
  const meta = f.store.deliveryAttempt(first.id).meta;
  f.store.db
    .prepare('UPDATE dispatches SET attempt_meta=? WHERE message_id=?')
    .run(JSON.stringify({ ...meta, phase: 'writing' }), a);
  f.store.db.prepare('UPDATE dispatches SET attempt_meta=? WHERE message_id=?').run('{broken', b);
  f.restart();
  assert.equal(f.store.dispatchState(a)?.state, 'uncertain');
  assert.equal(f.store.dispatchState(b)?.state, 'uncertain');
  assert.throws(() => f.reserve([a]), /in progress|uncertain/);
});

test('transfer revokes old completion without erasing the message fence', async (t) => {
  const f = await fixture(t),
    a = f.message(),
    attempt = f.reserve([a]);
  f.store.sealDelivery(attempt.id, contentHash('outbound'));
  f.store.issueDelivery(attempt.id);
  const changed = { ...f.args, chatId: 'replacement-session' },
    preview = f.store.connect(changed);
  if (preview.status !== 'nickname_in_use') throw new Error('Expected transfer');
  const transferred = f.store.connect({
    ...changed,
    connectionId: preview.connectionId,
    transferId: preview.transferId,
    confirmTransfer: true,
  });
  if (transferred.status !== 'connected') throw new Error('Expected approved transfer');
  assert.throws(() => f.store.completeDelivery(attempt.id, attempt.meta.lifecycle));
  f.store.uncertainDelivery(attempt.id);
  assert.throws(
    () =>
      f.store.reserveDelivery({
        connectionId: transferred.binding.connectionId,
        ids: [a],
        transport: 'native',
        lifecycle: attempt.meta.lifecycle,
      }),
    /in progress|uncertain/,
  );
  assert.equal(f.store.get(a, 'in')?.state, 'ready');
});

test('clear deletes content and late completion cannot resurrect a grouped member', async (t) => {
  const f = await fixture(t),
    a = f.message(),
    b = f.message(),
    attempt = f.reserve([a, b]);
  const original = f.store.get(a, 'in')!.envelope;
  f.store.sealDelivery(attempt.id, contentHash('outbound'));
  f.store.issueDelivery(attempt.id);
  const requester = { channel: 'interface' as const, session: 'private-fixture' };
  const preview = f.store.clearAgents({ scope: 'agent', nickname: f.args.nickname }, requester);
  if (preview.status !== 'confirmation_required') throw new Error('Expected preview');
  f.store.clearAgents(
    { scope: 'agent', nickname: f.args.nickname, operationId: preview.operationId, confirm: true },
    requester,
  );
  assert.throws(() => f.store.completeDelivery(attempt.id, attempt.meta.lifecycle));
  f.store.dispatch(a, f.connectionId, 'admitted');
  assert.equal(f.store.get(a, 'in'), undefined);
  assert.equal(f.store.get(b, 'in'), undefined);
  assert.equal(f.store.insertLocal(original, true), false);
});

test('strict metadata codec rejects extra fields, unknown phases and oversized input', async (t) => {
  const f = await fixture(t),
    attempt = f.reserve([f.message()]);
  assert.equal(decodeDelivery(encodeDelivery(attempt.meta)).phase, 'reserved');
  assert.throws(() =>
    encodeDelivery({ ...attempt.meta, body: 'forbidden' } as typeof attempt.meta),
  );
  assert.throws(() => decodeDelivery(' '.repeat(8193)));
});

test('partially replaced cancelled groups stay retryable while an issued successor stays uncertain after restart', async (t) => {
  const f = await fixture(t),
    a = f.message(),
    b = f.message(),
    group = f.reserve([a, b]);
  f.store.cancelDelivery(group.id);
  const successor = f.reserve([a]);
  f.store.sealDelivery(successor.id, contentHash('outbound'));
  f.store.issueDelivery(successor.id);
  f.restart();
  assert.equal(f.store.dispatchState(a)?.state, 'uncertain');
  assert.equal(f.store.dispatchState(b)?.state, 'failed');
  assert.notEqual(f.reserve([b]).id, group.id);
  assert.throws(() => f.store.completeDelivery(group.id, group.meta.lifecycle));
});

test('format 4 migration is atomic and legacy dispatch uncertainty stays fenced', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-migration-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'agents.sqlite'),
    db = new DatabaseSync(filename),
    id = randomUUID();
  db.exec(
    'CREATE TABLE dispatches(message_id TEXT PRIMARY KEY,connection_id TEXT NOT NULL,state TEXT NOT NULL,error TEXT); PRAGMA user_version=4;',
  );
  db.prepare("INSERT INTO dispatches VALUES(?,?,'dispatching',NULL)").run(id, randomUUID());
  db.close();
  const store = new AgentStore(directory);
  assert.equal(
    (store.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
    5,
  );
  assert.equal(store.dispatchState(id)?.state, 'uncertain');
  assert.equal(store.deliveryFenced(id), true);
  store.close();
});

test('failed migration rolls back added tables and keeps the old version', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-migration-failure-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'agents.sqlite'),
    db = new DatabaseSync(filename);
  db.exec(
    'CREATE TABLE dispatches(message_id TEXT PRIMARY KEY,connection_id TEXT NOT NULL,state TEXT NOT NULL,error TEXT,attempt_id TEXT); PRAGMA user_version=4;',
  );
  db.close();
  assert.throws(() => new AgentStore(directory), /duplicate column/);
  const after = new DatabaseSync(filename);
  assert.equal(
    (after.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
    4,
  );
  assert.equal(
    after.prepare("SELECT name FROM sqlite_master WHERE name='agents'").get(),
    undefined,
  );
  after.close();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentStore } from '../desktop/core/agent-store.js';
import { contentHash } from '../desktop/core/delivery-attempt.js';
async function fixture(t: import('node:test').TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-v2-ledger-'));
  let store = new AgentStore(directory);
  t.after(async () => {
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  const args = {
    nickname: 'V2 owner',
    client: 'OpenCode v2',
    adapterId: randomUUID(),
    chatId: 'ses_exact',
  };
  const connection = store.connect(args);
  if (connection.status !== 'connected') throw new Error();
  const node = randomUUID(),
    message = randomUUID();
  store.insertLocal(
    {
      protocol: 2,
      id: message,
      fromNode: node,
      toNode: node,
      fromNickname: 'Sender',
      toNickname: args.nickname,
      createdAt: new Date().toISOString(),
      text: 'canonical 漢字',
      attachments: [],
      replyTo: null,
    },
    true,
  );
  const attempt = store.reserveDelivery({
    connectionId: connection.binding.connectionId,
    ids: [message],
    transport: 'native',
    lifecycle: { service: randomUUID(), transport: randomUUID() },
  });
  const host = {
    messageId: 'msg_' + attempt.id,
    runtime: randomUUID() + ':' + randomUUID() + ':' + randomUUID(),
    session: args.chatId,
  };
  const payloadHash = contentHash('exact full native input');
  store.sealDelivery(attempt.id, payloadHash, host);
  store.issueDelivery(attempt.id);
  return {
    get store() {
      return store;
    },
    message,
    attempt,
    host,
    payloadHash,
    args,
    restart() {
      store.close();
      store = new AgentStore(directory);
    },
  };
}
test('v2 persists host ID at common gate and joins exact host acceptance/projection once', async (t) => {
  const f = await fixture(t);
  assert.notEqual(f.host.messageId, 'msg_' + f.message);
  assert.deepEqual(f.store.deliveryAttempt(f.attempt.id).meta.host, f.host);
  f.store.acceptOpenCodeV2Delivery(f.attempt.id, f.host, f.payloadHash);
  assert.equal(f.store.deliveryAttempt(f.attempt.id).meta.phase, 'host-accepted');
  f.store.uncertainDelivery(f.attempt.id);
  assert.throws(() => f.store.completeDelivery(f.attempt.id, f.attempt.meta.lifecycle), /phase/);
  assert.deepEqual(
    [
      ...f.store.completeOpenCodeV2Delivery(
        f.attempt.id,
        f.attempt.meta.lifecycle,
        f.host,
        f.payloadHash,
      ),
    ],
    [f.message],
  );
  assert.equal(
    f.store.completeOpenCodeV2Delivery(
      f.attempt.id,
      f.attempt.meta.lifecycle,
      f.host,
      f.payloadHash,
    ).size,
    0,
  );
  assert.equal(f.store.get(f.message, 'in')?.state, 'processed');
});
test('v2 host/hash/session/runtime and lifecycle mismatches leave the original attempt uncertain', async (t) => {
  const f = await fixture(t);
  f.store.uncertainDelivery(f.attempt.id);
  for (const host of [
    { ...f.host, messageId: 'msg_' + randomUUID() },
    { ...f.host, runtime: randomUUID() },
    { ...f.host, session: 'ses_other' },
  ])
    assert.throws(
      () =>
        f.store.completeOpenCodeV2Delivery(
          f.attempt.id,
          f.attempt.meta.lifecycle,
          host,
          f.payloadHash,
        ),
      /witness/,
    );
  assert.throws(
    () =>
      f.store.completeOpenCodeV2Delivery(
        f.attempt.id,
        f.attempt.meta.lifecycle,
        f.host,
        contentHash('rewritten'),
      ),
    /witness/,
  );
  assert.throws(
    () =>
      f.store.completeOpenCodeV2Delivery(
        f.attempt.id,
        { ...f.attempt.meta.lifecycle, service: randomUUID() },
        f.host,
        f.payloadHash,
      ),
    /lifecycle/,
  );
  assert.equal(f.store.deliveryAttempt(f.attempt.id).meta.phase, 'uncertain');
  assert.equal(f.store.get(f.message, 'in')?.state, 'ready');
});
test('v2 transfer cannot turn an old uncertain projection into receipt under the new owner', async (t) => {
  const f = await fixture(t);
  f.store.uncertainDelivery(f.attempt.id);
  const replacementAdapter = randomUUID();
  const proposed = f.store.connect({
    ...f.args,
    chatId: 'ses_replacement',
    adapterId: replacementAdapter,
  });
  assert.equal(proposed.status, 'nickname_in_use');
  if (proposed.status !== 'nickname_in_use') throw new Error();
  const transferred = f.store.connect({
    ...f.args,
    chatId: 'ses_replacement',
    adapterId: replacementAdapter,
    connectionId: proposed.connectionId,
    transferId: proposed.transferId,
    confirmTransfer: true,
  });
  assert.equal(transferred.status, 'connected');
  assert.throws(() =>
    f.store.completeOpenCodeV2Delivery(
      f.attempt.id,
      f.attempt.meta.lifecycle,
      f.host,
      f.payloadHash,
    ),
  );
  assert.equal(f.store.get(f.message, 'in')?.state, 'ready');
  assert.equal(f.store.deliveryAttempt(f.attempt.id).meta.phase, 'uncertain');
});
test('v2 restart retains uncertain host identity and rejects generic completion or new release', async (t) => {
  const f = await fixture(t);
  f.restart();
  assert.equal(f.store.deliveryAttempt(f.attempt.id).meta.phase, 'uncertain');
  assert.deepEqual(f.store.deliveryAttempt(f.attempt.id).meta.host, f.host);
  assert.throws(() => f.store.completeDelivery(f.attempt.id, f.attempt.meta.lifecycle), /phase/);
  assert.throws(
    () =>
      f.store.reserveDelivery({
        connectionId: f.attempt.meta.owner.connectionId,
        ids: [f.message],
        transport: 'native',
        lifecycle: { service: randomUUID(), transport: randomUUID() },
      }),
    /uncertain|progress/,
  );
});

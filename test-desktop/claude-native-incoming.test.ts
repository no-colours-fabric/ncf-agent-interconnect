import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentStore } from '../desktop/core/agent-store.js';
import { ClaudeNativeIncoming } from '../desktop/core/claude-native-incoming.js';
import { nativeClaudeRowHash, nativeClaudeTrigger } from '../desktop/core/claude-native-content.js';
import { WakeClaims, wakePending } from '../desktop/core/claude-wake.js';
import type { ClaudeProofLease } from '../desktop/core/claude-sessions.js';
import type { AdapterProfile, Envelope, Message } from '../desktop/shared/contracts.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

/** Real store transactions with a deliberately controllable native authority. */
async function fixture(t: test.TestContext, startLifetime = 600000) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-native-incoming-'));
  const store = new AgentStore(directory);
  t.after(async () => {
    current = false;
    incoming.observe();
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  const session = randomUUID();
  const profile: AdapterProfile = {
    id: randomUUID(),
    kind: 'claude-code',
    label: 'Fixture Claude',
    sessionId: session,
  };
  const connected = store.connect({
    nickname: 'Клод Linux 漢字',
    client: 'Claude Code',
    adapterId: profile.id,
    chatId: session,
  });
  if (connected.status !== 'connected') throw new Error('fixture');
  const lease: ClaudeProofLease = {
    session,
    helperId: randomUUID(),
    epoch: randomUUID(),
    generation: 1,
    nativeLeaseNonce: randomUUID(),
  };
  let current = true;
  let sinkId = randomUUID();
  let validate = async () => {};
  let materialize = async (_message: Message) => [];
  let scans = 0;
  const committed: string[][] = [];
  const claude = {
    validateCurrentSync(captured: ClaudeProofLease) {
      if (!current || captured !== lease) throw new Error('revoked');
    },
    async validateCurrent(captured: ClaudeProofLease) {
      await validate();
      this.validateCurrentSync(captured);
    },
    route: (_session: string) => ({
      ambiguous: false,
      helper: { ...lease, id: lease.helperId, proven: session },
    }),
    wakeSink: (_session: string) => ({ id: sinkId }),
    wakeDropped: (_session: string) => {},
  };
  const authority = {
    // The fixture only implements the native methods used by the coordinator.
    claude: claude as never,
    profiles: () => [profile],
    store: {
      list: () => store.list(),
      get: store.get.bind(store),
      history: (...args: Parameters<AgentStore['history']>) => {
        scans++;
        return store.history(...args);
      },
    },
  };
  const claims = new WakeClaims(authority, Date.now, { claim: 15000, start: startLifetime });
  const incoming = new ClaudeNativeIncoming({
    claude: claude as never,
    claims,
    profiles: authority.profiles,
    store: () => store,
    ready: () => true,
    materialize: (message) => materialize(message),
    committed: async (_connectionId, ids) => {
      committed.push(ids);
    },
  });
  const node = randomUUID();
  function message(text = 'Точный текст\n漢字') {
    const envelope: Envelope = {
      protocol: 2,
      id: randomUUID().toUpperCase(),
      fromNode: node,
      toNode: node,
      fromNickname: 'Отправитель 漢字',
      toNickname: connected.nickname,
      createdAt: new Date().toISOString(),
      text,
      replyTo: null,
      attachments: [],
    };
    store.insertLocal(envelope, true);
    return envelope;
  }
  function claim() {
    const pending = wakePending(authority, session, {
      limit: 20,
      eligible: (id) =>
        !['dispatching', 'uncertain'].includes(store.dispatchState(id)?.state ?? ''),
    });
    if (typeof pending === 'string') throw new Error(pending);
    // Exact identity is captured by the real route in production.
    pending.lease = lease;
    return claims.issue(session, pending, sinkId);
  }
  return {
    store,
    session,
    incoming,
    claims,
    lease,
    message,
    claim,
    committed,
    connectionId: connected.binding.connectionId,
    prepare: () =>
      incoming.prepare({ sessionId: session, claim: claim().id }, new AbortController().signal),
    get scans() {
      return scans;
    },
    revoke() {
      current = false;
    },
    replaceSink() {
      sinkId = randomUUID();
    },
    setValidate(fn: typeof validate) {
      validate = fn;
    },
    setMaterialize(fn: typeof materialize) {
      materialize = fn;
    },
  };
}

test('native preparation releases only an exact trigger; admission returns the standard full message', async (t) => {
  const f = await fixture(t);
  const message = f.message();
  const prepared = await f.prepare();
  assert.equal(prepared.trigger, nativeClaudeTrigger + prepared.delivery);
  assert.equal('body' in prepared, false);
  assert.equal(f.store.claudeDelivery(prepared.delivery)?.state, 'reserved');
  assert.equal(f.store.history('клод linux 漢字', 0, 20, true, true).messages.length, 0);
  const admitted = await f.incoming.admit({
    nativeLeaseNonce: f.lease.nativeLeaseNonce,
    sessionId: f.session,
    delivery: prepared.delivery,
  });
  const ref = 'r' + f.store.get(message.id, 'in')!.sequence.toString(36);
  assert.equal(
    admitted.body,
    '**Incoming NCF Agent Interconnect**\nFrom: "Отправитель 漢字"\n\n' +
      message.text +
      `\n\nReply-To: ${ref}\nUse agent_send(connectionId, replyRef="${ref}", text) to reply.`,
  );
  assert.ok(!admitted.body.includes('Message ID'));
  assert.ok(!admitted.body.includes('agent_read'));
  assert.equal(f.store.claudeDelivery(prepared.delivery)?.state, 'issued');
  assert.equal(f.store.get(message.id, 'in')?.state, 'ready');
  const witness = {
    sessionId: f.session,
    delivery: prepared.delivery,
    reportKey: prepared.reportKey,
    phase: 'stored',
    storedRowId: randomUUID(),
    representationHash: nativeClaudeRowHash(admitted.body, admitted.receiverContext),
  };
  await assert.rejects(
    f.incoming.report({ ...witness, representationHash: '0'.repeat(64) }),
    /does not match/,
  );
  assert.equal(f.store.claudeDelivery(prepared.delivery)?.state, 'issued');
  assert.deepEqual(await Promise.all([f.incoming.report(witness), f.incoming.report(witness)]), [
    { state: 'committed' },
    { state: 'committed' },
  ]);
  assert.deepEqual(await f.incoming.report(witness), { state: 'committed' });
  assert.deepEqual(f.committed, [[message.id]]);
  assert.equal(f.store.get(message.id, 'in')?.state, 'processed');
  assert.equal(f.store.get(message.id, 'out')?.state, 'processed');
});

test('foreign session and concurrent admission cannot spend or cancel the captured right', async (t) => {
  const f = await fixture(t);
  f.message();
  const claim = f.claim();
  await assert.rejects(
    f.incoming.prepare({ sessionId: randomUUID(), claim: claim.id }, new AbortController().signal),
  );
  assert.equal(claim.state, 'issued');
  const prepared = await f.incoming.prepare(
    { sessionId: f.session, claim: claim.id },
    new AbortController().signal,
  );
  await assert.rejects(
    f.incoming.admit({
      nativeLeaseNonce: f.lease.nativeLeaseNonce,
      sessionId: randomUUID(),
      delivery: prepared.delivery,
    }),
  );
  await assert.rejects(
    f.incoming.admit({
      nativeLeaseNonce: randomUUID(),
      sessionId: f.session,
      delivery: prepared.delivery,
    }),
  );
  assert.equal(f.store.claudeDelivery(prepared.delivery)?.state, 'reserved');
  const entered = deferred(),
    release = deferred();
  f.setValidate(async () => {
    entered.resolve();
    await release.promise;
  });
  const first = f.incoming.admit({
    nativeLeaseNonce: f.lease.nativeLeaseNonce,
    sessionId: f.session,
    delivery: prepared.delivery,
  });
  await entered.promise;
  await assert.rejects(
    f.incoming.admit({
      nativeLeaseNonce: f.lease.nativeLeaseNonce,
      sessionId: f.session,
      delivery: prepared.delivery,
    }),
    /already been used/,
  );
  release.resolve();
  assert.ok((await first).body.includes('Incoming NCF'));
  assert.equal(f.store.claudeDelivery(prepared.delivery)?.state, 'issued');
});

test('replacing the stream during asynchronous file preparation releases no content or receipt', async (t) => {
  const f = await fixture(t);
  const message = f.message();
  const entered = deferred(),
    release = deferred();
  f.setMaterialize(async () => {
    entered.resolve();
    await release.promise;
    return [];
  });
  const preparing = f.prepare();
  await entered.promise;
  f.replaceSink();
  f.incoming.observe();
  release.resolve();
  await assert.rejects(preparing, /no longer current/);
  assert.equal(f.store.claudeFenced(message.id), false);
  assert.equal(f.store.get(message.id, 'in')?.state, 'ready');
  assert.deepEqual(f.committed, []);
});

test('a failed pre-intent preparation cannot leave a consumed claim suppressing the next event', async (t) => {
  const f = await fixture(t);
  const message = f.message();
  const claim = f.claim();
  f.setMaterialize(async () => {
    throw new Error('synthetic file failure');
  });
  await assert.rejects(
    f.incoming.prepare({ sessionId: f.session, claim: claim.id }, new AbortController().signal),
    /synthetic file failure/,
  );
  assert.equal(f.claims.queued(f.session, f.connectionId), false);
  assert.equal(f.incoming.queued(f.session, f.connectionId), false);
  assert.equal(f.store.claudeFenced(message.id), false);
  f.setMaterialize(async () => []);
  const next = await f.prepare();
  const admitted = await f.incoming.admit({
    sessionId: f.session,
    delivery: next.delivery,
    nativeLeaseNonce: f.lease.nativeLeaseNonce,
  });
  assert.ok(admitted.body.includes(message.text));
});

test('revocation after native body release preserves uncertainty and rejects a late stored row', async (t) => {
  const f = await fixture(t);
  const message = f.message();
  const prepared = await f.prepare();
  const admitted = await f.incoming.admit({
    nativeLeaseNonce: f.lease.nativeLeaseNonce,
    sessionId: f.session,
    delivery: prepared.delivery,
  });
  f.revoke();
  await assert.rejects(
    f.incoming.report({
      sessionId: f.session,
      delivery: prepared.delivery,
      reportKey: prepared.reportKey,
      phase: 'stored',
      storedRowId: randomUUID(),
      representationHash: nativeClaudeRowHash(admitted.body, admitted.receiverContext),
    }),
    /revoked/,
  );
  assert.equal(f.store.claudeDelivery(prepared.delivery)?.state, 'uncertain');
  assert.equal(f.store.claudeFenced(message.id), true);
  assert.equal(f.store.get(message.id, 'in')?.state, 'ready');
  assert.deepEqual(f.committed, []);
});

test('a dropped trigger is cancellable only before the gate releases its body', async (t) => {
  const f = await fixture(t);
  const message = f.message();
  const first = await f.prepare();
  await f.incoming.report({
    sessionId: f.session,
    delivery: first.delivery,
    reportKey: first.reportKey,
    phase: 'dropped',
  });
  assert.equal(f.store.claudeDelivery(first.delivery)?.state, 'cancelled');
  assert.equal(f.store.claudeFenced(message.id), false);
  const second = await f.prepare();
  await assert.rejects(
    f.incoming.admit({
      nativeLeaseNonce: f.lease.nativeLeaseNonce,
      sessionId: f.session,
      delivery: first.delivery,
    }),
  );
  assert.equal(f.store.claudeDelivery(second.delivery)?.state, 'reserved');
  await f.incoming.admit({
    nativeLeaseNonce: f.lease.nativeLeaseNonce,
    sessionId: f.session,
    delivery: second.delivery,
  });
  await f.incoming.report({
    sessionId: f.session,
    delivery: second.delivery,
    reportKey: second.reportKey,
    phase: 'dropped',
  });
  assert.equal(f.store.claudeDelivery(second.delivery)?.state, 'uncertain');
  assert.equal(f.store.claudeFenced(message.id), true);
});

test('bounded native selection skips fenced old pages and finds a new arrival without a full census', async (t) => {
  const f = await fixture(t);
  const old = Array.from({ length: 221 }, () => f.message('old'));
  const fence = f.store.reserveClaudeDelivery({
    connectionId: f.connectionId,
    ids: old.map((message) => message.id),
    helperId: f.lease.helperId,
    scope: {},
  });
  f.store.issueClaudeDelivery(fence);
  f.store.uncertainClaudeDelivery(fence, 'isolated fixture');
  const arrival = f.message('new arrival');
  const prepared = await f.prepare();
  assert.equal(f.scans, 2); // one bounded selection, one consume eligibility check
  const admitted = await f.incoming.admit({
    nativeLeaseNonce: f.lease.nativeLeaseNonce,
    sessionId: f.session,
    delivery: prepared.delivery,
  });
  assert.ok(admitted.body.includes('new arrival'));
  assert.ok(!admitted.body.includes('\nold\n'));
  assert.deepEqual(
    f.store.db
      .prepare('SELECT message_id FROM claude_delivery_items WHERE delivery_id=?')
      .all(prepared.delivery)
      .map((row) => row.message_id),
    [arrival.id],
  );
  assert.equal(f.store.claudeFenced(old[0].id), true);
});

for (const released of [false, true]) {
  test(`lost ${released ? 'terminal report' : 'prepare response'} retires coverage without replaying released content`, async (t) => {
    const f = await fixture(t, 150);
    const old = f.message('old reserved body');
    const prepared = await f.prepare();
    if (released)
      await f.incoming.admit({
        sessionId: f.session,
        delivery: prepared.delivery,
        nativeLeaseNonce: f.lease.nativeLeaseNonce,
      });
    assert.equal(f.incoming.queued(f.session, f.connectionId), true);
    await new Promise((resolve) => setTimeout(resolve, 210));
    assert.equal(f.incoming.queued(f.session, f.connectionId), false);
    assert.equal(
      f.store.claudeDelivery(prepared.delivery)?.state,
      released ? 'uncertain' : 'cancelled',
    );
    assert.equal(f.store.claudeFenced(old.id), released);
    assert.equal(f.store.get(old.id, 'in')?.state, 'ready');
    const fresh = f.message('fresh later arrival');
    const next = await f.prepare();
    const admitted = await f.incoming.admit({
      sessionId: f.session,
      delivery: next.delivery,
      nativeLeaseNonce: f.lease.nativeLeaseNonce,
    });
    assert.ok(admitted.body.includes(fresh.text));
    if (released) assert.ok(!admitted.body.includes(old.text));
    assert.deepEqual(f.committed, []);
  });
}

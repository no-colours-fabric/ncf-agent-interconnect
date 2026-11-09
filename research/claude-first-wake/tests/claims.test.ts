// Contract tests for the research wake claim. Run explicitly:
// node --experimental-sqlite --import tsx --test research/claude-first-wake/tests/claims.test.ts
// Races use explicit barriers and synchronous state, never sleeps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { claudeCallMetaKey } from '../../../desktop/integrations/claude-code.js';
import {
  claudeFixture,
  FakeHelper,
  type ClaudeFixture,
} from '../../../test-desktop/claude-code-fixture.js';
import {
  noticeHash,
  startFirstWakeEndpoint,
  WakeClaims,
  type FirstWakeAnswer,
} from '../fixture-node.js';

process.env.NCF_FIRST_WAKE_DEADLINE_MS = '600';

interface Page {
  messages: { envelope: { id: string } }[];
  nextCursor: number;
  hasMore: boolean;
}

async function rig(t: test.TestContext, f: ClaudeFixture, claims?: WakeClaims) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-first-wake-claims-'));
  const journal = path.join(directory, 'journal.jsonl');
  const server = await startFirstWakeEndpoint(f.service, journal, { control: true, claims });
  t.after(async () => {
    await server.close();
    await rm(directory, { recursive: true, force: true });
  });
  const post = async (route: string, body: unknown): Promise<Record<string, any>> => {
    const response = await fetch(server.url + route, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + f.service.settings.value.localToken },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 200);
    return (await response.json()) as Record<string, any>;
  };
  // The gate names a notice by the hash of its text; tests keep that per claim.
  const notices = new Map<string, string>();
  return {
    server,
    post,
    notices,
    ask: async (sessionId: string) => {
      const answer = (await post('/first-wake/pending', { sessionId })) as FirstWakeAnswer;
      if (answer.claim && answer.notice) notices.set(answer.claim, noticeHash(answer.notice));
      return answer;
    },
    consume: (sessionId: string, claim: string) => post('/first-wake/claim', { sessionId, claim }),
    start: (sessionId: string, claim: string) =>
      post('/first-wake/start', { sessionId, notice: notices.get(claim) ?? '0'.repeat(64) }),
    journal: () => readFile(journal, 'utf8').catch(() => ''),
  };
}

async function bound(f: ClaudeFixture, nickname: string) {
  const session = randomUUID();
  const helper = new FakeHelper(f, session);
  await f.hook('SessionStart', session, { source: 'startup' });
  await helper.attach();
  const connected = await f.connect(helper, session, nickname);
  return { session, helper, connectionId: String(connected.binding.connectionId) };
}

function sender(f: ClaudeFixture) {
  const connected = f.service.connect({ nickname: 'Отправитель ' + randomUUID(), client: 'MCP' });
  if (connected.status !== 'connected') throw new Error('sender');
  return (nickname: string, text: string) =>
    f.service.send({
      connectionId: connected.binding.connectionId,
      recipientNode: f.service.settings.value.nodeId,
      recipientNickname: nickname,
      text,
    });
}

const unread = (f: ClaudeFixture, ids: string[]) =>
  ids.every((id) => f.service.store.get(id, 'in')?.state === 'ready');

test('A claim is consumed once and started once; replay and concurrent use fail closed', async (t) => {
  const f = await claudeFixture(t);
  const r = await rig(t, f);
  const { session } = await bound(f, 'Боб 漢字');
  const send = sender(f);
  const sent = await send('Боб 漢字', 'pending before start');
  const answer = await r.ask(session);
  assert.equal(answer.wake, true);
  const claim = String(answer.claim);
  // Two concurrent consumers: exactly one wins.
  const both = await Promise.all([r.consume(session, claim), r.consume(session, claim)]);
  assert.deepEqual(both.map((x) => x.consumed).sort(), [false, true]);
  assert.equal(both.find((x) => !x.consumed)!.reason, 'replayed');
  const starts = await Promise.all([r.start(session, claim), r.start(session, claim)]);
  assert.deepEqual(starts.map((x) => x.started).sort(), [false, true]);
  assert.equal((await r.consume(session, claim)).reason, 'replayed');
  // No step read, receipted or hid the message.
  assert.ok(unread(f, [sent.id]));
});

test('Missing, foreign and expired claims fail without spending the owner right', async (t) => {
  const f = await claudeFixture(t);
  let now = 1_000_000;
  const r = await rig(t, f, new WakeClaims(f.service, () => now));
  const a = await bound(f, 'Анна');
  const b = await bound(f, 'Борис');
  const send = sender(f);
  const sent = await send('Анна', 'for A only');
  const answer = await r.ask(a.session);
  const claim = String(answer.claim);
  assert.equal((await r.consume(a.session, 'f'.repeat(64))).reason, 'unknown');
  // B in the same node cannot spend or probe A's claim.
  assert.equal((await r.consume(b.session, claim)).reason, 'unknown');
  assert.equal((await r.start(b.session, claim)).reason, 'unknown');
  assert.equal((await r.ask(b.session)).reason, 'deadline:none-pending');
  // The owner can still consume after the foreign attempts.
  assert.equal((await r.consume(a.session, claim)).consumed, true);
  // A consumed claim whose queued prompt starts too late expires.
  now += 3_600_000;
  assert.equal((await r.start(a.session, claim)).reason, 'expired');
  // A fresh claim that is not consumed in time expires as well.
  const second = String((await r.ask(a.session)).claim);
  now += 60_000;
  assert.equal((await r.consume(a.session, second)).reason, 'expired');
  assert.equal((await r.consume(a.session, second)).reason, 'expired');
  assert.ok(unread(f, [sent.id]));
});

test('Helper replacement, session end, approved transfer and node restart revoke claims at every boundary', async (t) => {
  const f = await claudeFixture(t);
  const r = await rig(t, f);
  const send = sender(f);

  // Helper replacement before consumption: a new helper epoch is a new lifecycle.
  const one = await bound(f, 'Ева');
  const m1 = await send('Ева', 'one');
  const c1 = String((await r.ask(one.session)).claim);
  await one.helper.detach();
  const replacement = new FakeHelper(f, one.session);
  await replacement.attach();
  assert.equal((await r.consume(one.session, c1)).reason, 'revoked:helper');
  // The replacement lifecycle gets its own claim for the same intact backlog.
  const c1b = String((await r.ask(one.session)).claim);
  assert.notEqual(c1b, c1);
  assert.equal((await r.consume(one.session, c1b)).consumed, true);
  assert.ok(unread(f, [m1.id]));

  // Session end between consumption and the queued prompt start.
  const two = await bound(f, 'Лев');
  const m2 = await send('Лев', 'two');
  const c2 = String((await r.ask(two.session)).claim);
  assert.equal((await r.consume(two.session, c2)).consumed, true);
  await f.hook('SessionEnd', two.session, { reason: 'clear' });
  assert.equal((await r.start(two.session, c2)).reason, 'revoked:helper');
  assert.ok(unread(f, [m2.id]));

  // Approved transfer of the name between consumption and start.
  const three = await bound(f, 'Мира');
  const m3 = await send('Мира', 'three');
  const c3 = String((await r.ask(three.session)).claim);
  assert.equal((await r.consume(three.session, c3)).consumed, true);
  assert.equal((await r.post('/fixture/transfer', { nickname: 'Мира' })).status, 'connected');
  assert.equal((await r.start(three.session, c3)).reason, 'revoked:binding');
  assert.ok(unread(f, [m3.id]));

  // Node restart: claims are node-owned, in memory, per incarnation.
  const four = await bound(f, 'Ада');
  const m4 = await send('Ада', 'four');
  const c4 = String((await r.ask(four.session)).claim);
  await f.restart();
  const after = await rig(t, f);
  assert.equal((await after.consume(four.session, c4)).reason, 'unknown');
  assert.ok(unread(f, [m4.id]));
});

test('Multiple pending messages: the claim captures ordered IDs, paginated reads keep order, a read backlog voids the claim', async (t) => {
  const f = await claudeFixture(t);
  const r = await rig(t, f);
  const { session, helper, connectionId } = await bound(f, 'Pages 漢字');
  const send = sender(f);
  const ids: string[] = [];
  for (let index = 0; index < 5; index++) ids.push((await send('Pages 漢字', 'p' + index)).id);
  const claim = String((await r.ask(session)).claim);
  assert.deepEqual(r.server.claims.get(claim)!.backlog, ids);
  const client = await f.mcp();
  // Authenticated synthetic reads through the unchanged native proof and call permit.
  const read = async (after: number): Promise<Page> => {
    const args = { connectionId, after, limit: 2 };
    const proof = await f.preTool(session, 'agent_read', args);
    const verified = await helper.verify('agent_read', args, proof);
    assert.equal(verified.status, 200);
    const result = await client.callTool({
      name: 'agent_read',
      arguments: args,
      _meta: { [claudeCallMetaKey]: verified.body.callToken },
    });
    assert.equal(result.isError, undefined);
    return result.structuredContent as unknown as Page;
  };
  const first = await read(0);
  assert.deepEqual(
    first.messages.map((m) => m.envelope.id),
    ids.slice(0, 2),
  );
  // A partially read backlog still authorizes the notice for the rest.
  assert.equal((await r.consume(session, claim)).consumed, true);
  const returned = [...first.messages.map((m) => m.envelope.id)];
  let page = first;
  while (page.hasMore) {
    page = await read(page.nextCursor);
    returned.push(...page.messages.map((m) => m.envelope.id));
  }
  assert.deepEqual(returned, ids);
  // Everything captured is now read: the queued notice has nothing left to announce.
  assert.equal((await r.start(session, claim)).reason, 'backlog-read');
});

test('Pending before subscription, arrival while held, and a later arrival: one answer per query, no self-loop', async (t) => {
  const f = await claudeFixture(t);
  const r = await rig(t, f);
  const { session } = await bound(f, 'Вера');
  const send = sender(f);
  // Held query: the barrier is released only after the arrival is stored.
  await r.post('/fixture/hold', {});
  const pending = r.ask(session);
  const during = await send('Вера', 'arrives while the query is held');
  await r.post('/fixture/release', {});
  const answer = await pending;
  assert.equal(answer.wake, true);
  const claim = String(answer.claim);
  assert.deepEqual(r.server.claims.get(claim)!.backlog, [during.id]);
  // A later arrival changes nothing already answered and issues no claim by itself.
  const later = await send('Вера', 'later arrival');
  const journal = await r.journal();
  assert.equal(journal.match(/"event":"mod-answer"/g)?.length, 1);
  assert.deepEqual(r.server.claims.get(claim)!.backlog, [during.id]);
  // A new query captures both, in arrival order.
  const next = String((await r.ask(session)).claim);
  assert.deepEqual(r.server.claims.get(next)!.backlog, [during.id, later.id]);
  assert.ok(unread(f, [during.id, later.id]));
});

test('Research controls: an observed native event releases the barrier, second arrivals precede the snapshot, transfer follows consumption', async (t) => {
  const f = await claudeFixture(t);
  const r = await rig(t, f);
  const { session } = await bound(f, 'Зоя');
  await r.post('/fixture/hold', { trigger: 'turn.start', send: 2, transferOnConsume: true });
  const pending = r.ask(session);
  // Unrelated observations do not release it.
  await r.post('/fixture/observe', {
    sessionId: session,
    event: 'draft',
    detail: { present: true },
  });
  await r.post('/fixture/observe', { sessionId: session, event: 'turn.start', detail: {} });
  const answer = await pending;
  assert.equal(answer.wake, true);
  const claim = String(answer.claim);
  const ids = r.server.claims.get(claim)!.backlog;
  assert.equal(ids.length, 2);
  assert.equal((await r.consume(session, claim)).consumed, true);
  assert.match(
    await r.journal(),
    /"event":"fixture-transfer","nickname":"Зоя","status":"connected"/,
  );
  assert.equal((await r.start(session, claim)).reason, 'revoked:binding');
  assert.ok(unread(f, ids));
});

test('A newer answer for the same session supersedes its unfinished claims; other sessions keep theirs', async (t) => {
  const f = await claudeFixture(t);
  const r = await rig(t, f);
  const a = await bound(f, 'Тая');
  const b = await bound(f, 'Юрий');
  const send = sender(f);
  const sent = await send('Тая', 'superseded');
  await send('Юрий', 'kept');
  const old = String((await r.ask(a.session)).claim);
  assert.equal((await r.consume(a.session, old)).consumed, true);
  const other = String((await r.ask(b.session)).claim);
  const fresh = String((await r.ask(a.session)).claim);
  assert.equal((await r.start(a.session, old)).reason, 'superseded');
  assert.equal((await r.consume(a.session, fresh)).consumed, true);
  assert.equal((await r.start(a.session, fresh)).started, true);
  assert.equal((await r.consume(b.session, other)).consumed, true);
  assert.ok(unread(f, [sent.id]));
});

test('A nested change event after the answer issues no second claim for the same query', async (t) => {
  const f = await claudeFixture(t);
  const r = await rig(t, f);
  const { session, helper } = await bound(f, 'Нина');
  const send = sender(f);
  const sent = await send('Нина', 'nested change');
  await helper.detach();
  // While the route is missing the query waits; a claude change that re-emits a
  // service change synchronously reaches the waiting check twice in one cycle.
  const relay = () => f.service.emit('change');
  f.service.claude.prependListener('change', relay);
  t.after(() => f.service.claude.off('change', relay));
  const pending = r.ask(session);
  // Wait until the query is journaled, so it is subscribed before the route returns.
  while (!(await r.journal()).includes('"event":"mod-query"')) await new Promise(setImmediate);
  const replacement = new FakeHelper(f, session);
  await replacement.attach();
  const answer = await pending;
  assert.equal(answer.wake, true);
  assert.equal((await r.consume(session, String(answer.claim))).consumed, true);
  assert.ok(unread(f, [sent.id]));
});

test('G2: an older queued notice cannot start a newer claim; the fresh right survives its rejection', async (t) => {
  const f = await claudeFixture(t);
  const r = await rig(t, f);
  const { session } = await bound(f, 'Лиза');
  const send = sender(f);
  const first = await send('Лиза', 'first');
  // C1 consumed, notice N1 queued.
  const a1 = await r.ask(session);
  assert.equal((await r.consume(session, String(a1.claim))).consumed, true);
  // C2 issued and consumed, superseding C1; notice N2 queued.
  const second = await send('Лиза', 'second');
  const a2 = await r.ask(session);
  assert.notEqual(a2.notice, a1.notice);
  assert.equal((await r.consume(session, String(a2.claim))).consumed, true);
  // N1 dequeues first: refused as superseded, without spending C2.
  const n1 = await r.post('/first-wake/start', {
    sessionId: session,
    notice: noticeHash(a1.notice!),
  });
  assert.deepEqual([n1.started, n1.reason], [false, 'superseded']);
  // Replays of N1, concurrent and later, are refused too.
  const replays = await Promise.all(
    [1, 2, 3].map(() =>
      r.post('/first-wake/start', { sessionId: session, notice: noticeHash(a1.notice!) }),
    ),
  );
  assert.ok(replays.every((x) => x.started === false));
  // N2 starts C2 exactly once, even under concurrent dequeues.
  const n2 = await Promise.all(
    [1, 2].map(() =>
      r.post('/first-wake/start', { sessionId: session, notice: noticeHash(a2.notice!) }),
    ),
  );
  assert.deepEqual(n2.map((x) => x.started).sort(), [false, true]);
  assert.ok(unread(f, [first.id, second.id]));
});

test('G2: a notice cannot carry an old identity across a stale helper or an approved transfer', async (t) => {
  const f = await claudeFixture(t);
  const r = await rig(t, f);
  const { session, helper } = await bound(f, 'Марк');
  const send = sender(f);
  const sent = await send('Марк', 'stale helper');
  const old = await r.ask(session);
  assert.equal((await r.consume(session, String(old.claim))).consumed, true);
  // The helper is replaced: the queued notice of the old lifecycle is refused.
  await helper.detach();
  const replacement = new FakeHelper(f, session);
  await replacement.attach();
  assert.equal((await r.start(session, String(old.claim))).reason, 'revoked:helper');
  // The new lifecycle gets a fresh claim; an approved transfer then revokes it.
  const fresh = await r.ask(session);
  assert.equal((await r.consume(session, String(fresh.claim))).consumed, true);
  assert.equal((await r.post('/fixture/transfer', { nickname: 'Марк' })).status, 'connected');
  assert.equal((await r.start(session, String(fresh.claim))).reason, 'revoked:binding');
  // The same nickname text cannot authorize anything by itself.
  const forged =
    'NCF Agent Interconnect messages were already waiting for agent "Марк" when this session started.';
  assert.equal(
    (await r.post('/first-wake/start', { sessionId: session, notice: noticeHash(forged) })).reason,
    'unknown',
  );
  assert.ok(unread(f, [sent.id]));
});

test('G3: finished and expired claims are reclaimed; active authority is never evicted', async (t) => {
  const f = await claudeFixture(t);
  let now = 1_000_000;
  const claims = new WakeClaims(f.service, () => now);
  const r = await rig(t, f, claims);
  const send = sender(f);
  const agents = await Promise.all(
    Array.from({ length: 4 }, (_, index) => bound(f, 'Ресурс ' + index)),
  );
  for (const [index] of agents.entries()) await send('Ресурс ' + index, 'pending');
  // More than 256 completed claims, cycling through the sessions.
  for (let round = 0; round < 300; round++) {
    const { session } = agents[round % agents.length];
    const answer = await r.ask(session);
    assert.equal((await r.consume(session, String(answer.claim))).consumed, true);
    assert.equal((await r.start(session, String(answer.claim))).started, true);
  }
  // More than 256 consumed claims whose start deadline then expired.
  for (let round = 0; round < 300; round++) {
    const { session } = agents[round % agents.length];
    const answer = await r.ask(session);
    assert.equal((await r.consume(session, String(answer.claim))).consumed, true);
    now += 700_000;
  }
  assert.equal(claims.size, 0);
  const fresh = await r.ask(agents[0].session);
  assert.equal((await r.consume(agents[0].session, String(fresh.claim))).consumed, true);
  assert.equal((await r.start(agents[0].session, String(fresh.claim))).started, true);
  // Active claims are counted, never evicted: the quota fails closed instead.
  const quota = new WakeClaims(f.service, () => now);
  const pending = {
    nickname: 'Ресурс 0',
    agentKey: 'x',
    binding: { agentKey: 'x', connectionId: 'c', adapterId: 'a', generation: 1 },
    lease: { helperId: 'h', epoch: 'e', generation: 0, session: 's', nativeLeaseNonce: 'n' },
    backlog: ['m'],
  };
  for (let index = 0; index < 256; index++) quota.issue('session-' + index, pending);
  assert.throws(() => quota.issue('session-overflow', pending), /too many active wake claims/);
  assert.equal(quota.size, 256);
  // Messages and their state are untouched by reclamation.
  for (const [index] of agents.entries())
    assert.equal(
      f.service.store.history(
        f.service.store.list().find((a) => a.nickname === 'Ресурс ' + index)!.key,
        0,
        10,
        true,
      ).messages.length,
      1,
    );
});

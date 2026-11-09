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
import { startFirstWakeEndpoint, WakeClaims, type FirstWakeAnswer } from '../fixture-node.js';

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
  return {
    server,
    post,
    ask: (sessionId: string) =>
      post('/first-wake/pending', { sessionId }) as Promise<FirstWakeAnswer>,
    consume: (sessionId: string, claim: string) => post('/first-wake/claim', { sessionId, claim }),
    start: (sessionId: string, claim: string) => post('/first-wake/start', { sessionId, claim }),
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
  // A fresh claim that is not consumed in time expires.
  const second = String((await r.ask(a.session)).claim);
  now += 60_000;
  assert.equal((await r.consume(a.session, second)).reason, 'expired');
  assert.equal((await r.consume(a.session, second)).reason, 'replayed');
  // A consumed claim whose queued prompt starts too late expires as well.
  now += 3_600_000;
  assert.equal((await r.start(a.session, claim)).reason, 'expired');
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

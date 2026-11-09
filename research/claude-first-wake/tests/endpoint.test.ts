// Contract tests for the research first-wake endpoint. Run explicitly:
// node --experimental-sqlite --import tsx --test research/claude-first-wake/tests/endpoint.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  claudeFixture,
  FakeHelper,
  type ClaudeFixture,
} from '../../../test-desktop/claude-code-fixture.js';
import { startFirstWakeEndpoint, type FirstWakeAnswer } from '../fixture-node.js';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

process.env.NCF_FIRST_WAKE_DEADLINE_MS = '600';

const senders = new Map<string, string>();
async function sendTo(f: ClaudeFixture, nickname: string, text: string) {
  let connectionId = senders.get(f.directory);
  if (!connectionId) {
    const sender = f.service.connect({ nickname: 'Отправитель', client: 'MCP' });
    if (sender.status !== 'connected') throw new Error('sender');
    connectionId = sender.binding.connectionId;
    senders.set(f.directory, connectionId);
  }
  return f.service.send({
    connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: nickname,
    text,
  });
}

async function endpoint(t: test.TestContext, f: ClaudeFixture) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-first-wake-journal-'));
  const journal = path.join(directory, 'journal.jsonl');
  const server = await startFirstWakeEndpoint(f.service, journal);
  t.after(async () => {
    await server.close();
    await rm(directory, { recursive: true, force: true });
  });
  const ask = async (sessionId: string): Promise<FirstWakeAnswer & { status: number }> => {
    const response = await fetch(server.url + '/first-wake/pending', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + f.service.settings.value.localToken },
      body: JSON.stringify({ sessionId }),
    });
    return { status: response.status, ...((await response.json()) as FirstWakeAnswer) };
  };
  return { server, ask, journal: () => readFile(journal, 'utf8').catch(() => '') };
}

async function bound(f: ClaudeFixture, nickname: string) {
  const session = randomUUID();
  const helper = new FakeHelper(f, session);
  await f.hook('SessionStart', session, { source: 'startup' });
  await helper.attach();
  await f.connect(helper, session, nickname);
  return { session, helper };
}

test('A pending message on a proven exact route answers once with the bound name', async (t) => {
  const f = await claudeFixture(t);
  const e = await endpoint(t, f);
  const { session } = await bound(f, 'Боб 漢字');
  const sent = await sendTo(f, 'Боб 漢字', 'pending before start');
  const answer = await e.ask(session);
  assert.equal(answer.wake, true);
  assert.equal(answer.nickname, 'Боб 漢字');
  assert.match(String(answer.claim), /^[0-9a-f]{64}$/);
  assert.ok(!('ids' in answer));
  assert.match(await e.journal(), new RegExp(sent.id));
  // The endpoint never reads the inbox: the message is still unread.
  assert.equal(f.service.store.get(sent.id, 'in')!.state, 'ready');
});

test('An arrival while the query waits is not missed (snapshot after subscription)', async (t) => {
  const f = await claudeFixture(t);
  const e = await endpoint(t, f);
  const { session } = await bound(f, 'Ева');
  const pending = e.ask(session);
  await new Promise((resolve) => setTimeout(resolve, 50));
  await sendTo(f, 'Ева', 'arrives during the query');
  const answer = await pending;
  assert.equal(answer.wake, true);
  assert.equal(answer.nickname, 'Ева');
});

test('Negative controls: wrong scope, nothing pending, no route, stale lease and ambiguity never wake', async (t) => {
  const f = await claudeFixture(t);
  const e = await endpoint(t, f);
  // Wrong scope: a session with no binding answers at once.
  assert.deepEqual(
    { wake: (await e.ask(randomUUID())).wake, reason: (await e.ask(randomUUID())).reason },
    { wake: false, reason: 'no-binding' },
  );
  // Nothing pending: the deadline is a resource limit, not a wake.
  const { session, helper } = await bound(f, 'Анна');
  const idle = await e.ask(session);
  assert.equal(idle.wake, false);
  assert.equal(idle.reason, 'deadline:none-pending');
  // Helper gone (no route): queued messages still do not wake.
  await sendTo(f, 'Анна', 'queued without a route');
  await helper.detach();
  const noRoute = await e.ask(session);
  assert.equal(noRoute.wake, false);
  assert.equal(noRoute.reason, 'deadline:no-route');
  // Stale native lease: SessionEnd revokes it; a reattached old helper is not current.
  const second = await bound(f, 'Лев');
  await sendTo(f, 'Лев', 'queued before end');
  await f.hook('SessionEnd', second.session, { reason: 'clear' });
  const stale = await e.ask(second.session);
  assert.equal(stale.wake, false);
  assert.match(String(stale.reason), /^deadline:no-route/);
  // Ambiguity: a second live helper claiming the same session.
  const third = await bound(f, 'Мира');
  await sendTo(f, 'Мира', 'queued with a twin');
  const twin = new FakeHelper(f, third.session);
  await twin.attach();
  const ambiguous = await e.ask(third.session);
  assert.equal(ambiguous.wake, false);
  assert.match(String(ambiguous.reason), /ambiguous|no-route/);
});

test('The endpoint requires the node credential and an exact session UUID', async (t) => {
  const f = await claudeFixture(t);
  const e = await endpoint(t, f);
  const wrong = await fetch(e.server.url + '/first-wake/pending', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + 'f'.repeat(64) },
    body: JSON.stringify({ sessionId: randomUUID() }),
  });
  assert.equal(wrong.status, 401);
  const invalid = await fetch(e.server.url + '/first-wake/pending', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + f.service.settings.value.localToken },
    body: JSON.stringify({ sessionId: 'not-a-session' }),
  });
  assert.equal(invalid.status, 400);
});

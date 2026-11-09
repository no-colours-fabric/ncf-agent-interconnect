import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readNativeLease } from '../desktop/integrations/claude-native-lease.js';
import { runWakeStream } from '../desktop/integrations/claude-code.js';
import { wakeNoticeHash, wakeNoticePrefix } from '../desktop/core/claude-wake.js';
import { until } from './aionui-fixture.js';
import { claudeFixture, FakeHelper, type ClaudeFixture } from './claude-code-fixture.js';

/** What the installed mod's child does: hold the node's wake stream for one session. */
class FakeSink {
  lines: Record<string, unknown>[] = [];
  private controller = new AbortController();
  private reading?: Promise<void>;
  constructor(
    readonly f: ClaudeFixture,
    readonly session: string,
  ) {}
  async attach(nonce?: string): Promise<boolean> {
    const lease = await readNativeLease(this.f.nodeFile, this.session);
    const response = await fetch(this.f.url('/integrations/claude/wake/stream'), {
      method: 'POST',
      headers: this.f.headers(),
      body: JSON.stringify({ sessionId: this.session, nativeLeaseNonce: nonce ?? lease?.nonce }),
      signal: this.controller.signal,
    });
    let ready!: (value: boolean) => void;
    const started = new Promise<boolean>((resolve) => (ready = resolve));
    this.reading = (async () => {
      let buffer = '';
      try {
        for await (const chunk of response.body!) {
          buffer += Buffer.from(chunk).toString();
          let end: number;
          while ((end = buffer.indexOf('\n')) >= 0) {
            const line = JSON.parse(buffer.slice(0, end)) as Record<string, unknown>;
            buffer = buffer.slice(end + 1);
            if (line.type === 'ready') ready(true);
            else if (line.type === 'error') ready(false);
            else if (line.type !== 'ping') this.lines.push(line);
          }
        }
      } catch {
        // Closed by the test.
      } finally {
        ready(false);
      }
    })();
    return started;
  }
  wakes(): { claim: string; notice: string }[] {
    return this.lines.filter((line) => line.type === 'wake') as never;
  }
  async detach(): Promise<void> {
    this.controller.abort();
    await this.reading;
  }
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

const post = (f: ClaudeFixture, route: string, body: unknown) => f.post(route, body);
const adapterState = (f: ClaudeFixture, connectionId: string) => {
  const agent = f.service.store.list().find((a) => a.binding?.connectionId === connectionId)!;
  return f.service.adapters.get(agent.binding!.adapterId).status();
};

test('A pending backlog is announced through the mod stream once it attaches, not the channel', async (t) => {
  const f = await claudeFixture(t);
  const { session, helper, connectionId } = await bound(f, 'Боб 漢字');
  const send = sender(f);
  // Pending before the stream exists: the legacy channel offer goes to the helper.
  const sent = await send('Боб 漢字', 'pending before the mod');
  await until(() => helper.wakes().length === 1);
  assert.match(String(adapterState(f, connectionId).error), /Automatic wake is unavailable/);
  // A wrong native lease is refused.
  const wrong = new FakeSink(f, session);
  assert.equal(await wrong.attach(randomUUID()), false);
  await wrong.detach();
  const sink = new FakeSink(f, session);
  t.after(() => sink.detach());
  assert.equal(await sink.attach(), true);
  await until(() => sink.wakes().length === 1);
  assert.equal(helper.wakes().length, 1);
  const [wake] = sink.wakes();
  assert.match(wake.claim, /^[0-9a-f]{64}$/);
  assert.ok(wake.notice.startsWith(wakeNoticePrefix + JSON.stringify('Боб 漢字') + ' '));
  assert.ok(!wake.notice.includes('pending before the mod'));
  assert.match(String(adapterState(f, connectionId).error), /not verified yet/);
  // The mod consumes, then the gate starts the exact notice: wake is now verified.
  assert.deepEqual(
    (await post(f, '/integrations/claude/wake/claim', { sessionId: session, claim: wake.claim }))
      .body,
    { consumed: true },
  );
  const started = await post(f, '/integrations/claude/wake/start', {
    sessionId: session,
    notice: wakeNoticeHash(wake.notice),
  });
  assert.deepEqual(started.body, { started: true });
  assert.equal(adapterState(f, connectionId).state, 'ready');
  assert.equal(adapterState(f, connectionId).error, null);
  // Nothing was read or receipted by the wake path.
  assert.equal(f.service.store.get(sent.id, 'in')!.state, 'ready');
});

test('A later arrival supersedes a queued notice; the older notice cannot start the newer claim', async (t) => {
  const f = await claudeFixture(t);
  const { session } = await bound(f, 'Ева');
  const sink = new FakeSink(f, session);
  t.after(() => sink.detach());
  assert.equal(await sink.attach(), true);
  const send = sender(f);
  await send('Ева', 'first');
  await until(() => sink.wakes().length === 1);
  const first = sink.wakes()[0];
  await post(f, '/integrations/claude/wake/claim', { sessionId: session, claim: first.claim });
  // The first notice is still queued; a read clears the outstanding cover so a
  // later arrival is offered again.
  f.service.adapters
    .get(f.service.store.list().find((a) => a.nickname === 'Ева')!.binding!.adapterId)
    .beforeRead?.(f.service.store.list().find((a) => a.nickname === 'Ева')!.binding!.connectionId);
  await send('Ева', 'second');
  await until(() => sink.wakes().length === 2);
  const second = sink.wakes()[1];
  assert.notEqual(second.notice, first.notice);
  await post(f, '/integrations/claude/wake/claim', { sessionId: session, claim: second.claim });
  const old = await post(f, '/integrations/claude/wake/start', {
    sessionId: session,
    notice: wakeNoticeHash(first.notice),
  });
  assert.deepEqual(old.body, { started: false, reason: 'superseded' });
  const fresh = await post(f, '/integrations/claude/wake/start', {
    sessionId: session,
    notice: wakeNoticeHash(second.notice),
  });
  assert.deepEqual(fresh.body, { started: true });
  const replay = await post(f, '/integrations/claude/wake/start', {
    sessionId: session,
    notice: wakeNoticeHash(second.notice),
  });
  assert.deepEqual(replay.body, { started: false, reason: 'replayed' });
});

test('A foreign session, a session end and an approved transfer never start a notice', async (t) => {
  const f = await claudeFixture(t);
  const a = await bound(f, 'Анна');
  const b = await bound(f, 'Борис');
  const sinkA = new FakeSink(f, a.session);
  const sinkB = new FakeSink(f, b.session);
  t.after(async () => {
    await sinkA.detach();
    await sinkB.detach();
  });
  assert.equal(await sinkA.attach(), true);
  assert.equal(await sinkB.attach(), true);
  const send = sender(f);
  await send('Анна', 'for A only');
  await until(() => sinkA.wakes().length === 1);
  assert.equal(sinkB.wakes().length, 0);
  const wake = sinkA.wakes()[0];
  const foreign = await post(f, '/integrations/claude/wake/claim', {
    sessionId: b.session,
    claim: wake.claim,
  });
  assert.deepEqual(foreign.body, { consumed: false, reason: 'unknown' });
  assert.deepEqual(
    (await post(f, '/integrations/claude/wake/claim', { sessionId: a.session, claim: wake.claim }))
      .body,
    { consumed: true },
  );
  await f.hook('SessionEnd', a.session, { reason: 'clear' });
  const ended = await post(f, '/integrations/claude/wake/start', {
    sessionId: a.session,
    notice: wakeNoticeHash(wake.notice),
  });
  assert.equal(ended.body.started, false);
  assert.equal(f.service.claude.wakeSink(a.session), undefined);
  // Approved transfer: B's claim is revoked at start.
  await send('Борис', 'for B');
  await until(() => sinkB.wakes().length === 1);
  const wakeB = sinkB.wakes()[0];
  await post(f, '/integrations/claude/wake/claim', { sessionId: b.session, claim: wakeB.claim });
  const target = {
    nickname: 'Борис',
    client: 'MCP',
    chatId: randomUUID(),
    adapterId: f.service.settings.value.adapters.find((p) => p.kind === 'manual')!.id,
  };
  const request = f.service.connect(target);
  assert.equal(request.status, 'nickname_in_use');
  if (request.status !== 'nickname_in_use') return;
  f.service.connect({
    ...target,
    connectionId: request.connectionId,
    transferId: request.transferId,
    confirmTransfer: true,
  });
  const revoked = await post(f, '/integrations/claude/wake/start', {
    sessionId: b.session,
    notice: wakeNoticeHash(wakeB.notice),
  });
  assert.deepEqual(revoked.body, { started: false, reason: 'revoked:binding' });
});

test('The mod child relays claimed wakes as lines and ends with its native session', async (t) => {
  const f = await claudeFixture(t);
  const { session } = await bound(f, 'Ада');
  const lines: string[] = [];
  const parent = { pid: 1 };
  const child = runWakeStream(
    f.nodeFile,
    session,
    (line) => void lines.push(line),
    () => parent.pid,
  );
  await until(() => !!f.service.claude.wakeSink(session));
  const send = sender(f);
  await send('Ада', 'relayed');
  await until(() => lines.length === 1);
  const wake = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(wake).sort(), ['claim', 'notice', 'type']);
  assert.ok(!lines[0].includes('relayed'));
  // The session ends: the node closes the stream on its next check and the child exits.
  await f.hook('SessionEnd', session, { reason: 'prompt_input_exit' });
  parent.pid = 2;
  await child;
  t.after(() => undefined);
});

test('The mod child waits for a native lease the SessionStart hook has not written yet', async (t) => {
  const f = await claudeFixture(t);
  const session = randomUUID();
  const lines: string[] = [];
  const parent = { pid: 1 };
  // The mod starts before the command hook: no active lease and no route yet.
  const child = runWakeStream(
    f.nodeFile,
    session,
    (line) => void lines.push(line),
    () => parent.pid,
  );
  await new Promise((resolve) => setTimeout(resolve, 300));
  await f.hook('SessionStart', session, { source: 'resume' });
  const helper = new FakeHelper(f, session);
  await helper.attach();
  await f.connect(helper, session, 'Поздний');
  await until(() => !!f.service.claude.wakeSink(session));
  await sender(f)('Поздний', 'after the late lease');
  await until(() => lines.length === 1);
  parent.pid = 2;
  await f.hook('SessionEnd', session, { reason: 'prompt_input_exit' });
  await child;
});

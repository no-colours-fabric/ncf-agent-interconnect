import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { until } from './aionui-fixture.js';
import { claudeFixture, FakeHelper, type ClaudeFixture } from './claude-code-fixture.js';

const senders = new Map<string, string>();
async function sendTo(f: ClaudeFixture, nickname: string, text: string) {
  let connectionId = senders.get(f.directory);
  if (!connectionId) {
    const sender = f.service.connect({ nickname: 'Отправитель', client: 'MCP' });
    if (sender.status !== 'connected') throw new Error('The sender could not connect');
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
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));
const adapterOf = (f: ClaudeFixture, connectionId: string) => {
  const agent = f.service.store.list().find((a) => a.binding?.connectionId === connectionId)!;
  return f.service.adapters.get(agent.binding!.adapterId).status();
};

test('Two Claude Code chats in one folder and a second instance receive wakes only on their exact transports', async (t) => {
  const f = await claudeFixture(t);
  const [s1, s2, s3] = [randomUUID(), randomUUID(), randomUUID()];
  const a = new FakeHelper(f, s1),
    b = new FakeHelper(f, s2),
    other = new FakeHelper(f, s3);
  for (const [helper, session] of [
    [a, s1],
    [b, s2],
    [other, s3],
  ] as const) {
    await f.hook('SessionStart', session, { source: 'startup' });
    await helper.attach();
  }
  const bob = await f.connect(a, s1, 'Боб');
  const alice = await f.connect(b, s2, 'Алиса 漢字');
  assert.equal(bob.status, 'connected');
  assert.equal(bob.delivery.automatic, false);
  assert.match(bob.delivery.description, /will be announced in this chat/);
  assert.match(bob.delivery.description, /Do not poll/);
  assert.equal(adapterOf(f, bob.binding.connectionId).state, 'checking');
  // The snapshot hides Claude Code chat identifiers like other exact-chat integrations.
  const snapshotBinding = f.service.snapshot().agents.find((x) => x.nickname === 'Боб')!.binding!;
  assert.equal(snapshotBinding.chatId, '[private]');

  const sent = await sendTo(f, 'Боб', 'Только Бобу');
  await until(() => a.wakes().length === 1);
  await settle();
  assert.deepEqual(a.wakes(), ['Боб']);
  assert.deepEqual(b.wakes(), []);
  assert.deepEqual(other.wakes(), []);
  assert.equal(f.service.store.dispatchState(sent.id)?.state, 'offered');
  assert.equal(f.service.store.get(sent.id, 'in')!.state, 'ready');
  // No wake body ever contains the message text.
  assert.ok(!JSON.stringify(a.lines).includes('Только Бобу'));

  await sendTo(f, 'Алиса 漢字', 'Алисе');
  await until(() => b.wakes().length === 1);
  await settle();
  assert.deepEqual(a.wakes(), ['Боб']);

  // A connectionId of another Claude Code chat is refused even with a valid hook record.
  const stolen = { connectionId: alice.binding.connectionId };
  await f.preTool(s1, 'agent_read', stolen);
  const refused = await a.verify('agent_read', stolen);
  assert.equal(refused.status, 400);
  assert.match(String(refused.body.error), /another Claude Code chat/);
});

test('Context without a hook record, a replayed record, another input and a concurrent identical call are refused', async (t) => {
  const f = await claudeFixture(t);
  const [s1, s2] = [randomUUID(), randomUUID()];
  const a = new FakeHelper(f, s1),
    b = new FakeHelper(f, s2);
  await a.attach();
  await b.attach();
  const args = { nickname: 'Боб' };
  const missing = await a.verify('agent_connect', args);
  assert.equal(missing.status, 400);
  assert.match(String(missing.body.error), /did not confirm this chat/);

  await f.preTool(s1, 'agent_connect', args);
  const other = await a.verify('agent_connect', { nickname: 'Мэллори' });
  assert.equal(other.status, 400);
  const wrongTool = await a.verify('agent_disconnect', args);
  assert.equal(wrongTool.status, 400);
  const first = await a.verify('agent_connect', args);
  assert.equal(first.status, 200);
  const replay = await a.verify('agent_connect', args);
  assert.equal(replay.status, 400);

  // A model-supplied contextToken is not a node ticket.
  const client = await f.mcp();
  const forged = await client.callTool({
    name: 'agent_connect',
    arguments: { nickname: 'Боб', contextToken: randomUUID() },
  });
  assert.equal(forged.isError, true);
  // The ticket is one-use as well.
  const ticket = String(first.body.contextToken);
  const used = await client.callTool({
    name: 'agent_connect',
    arguments: { nickname: 'Боб', contextToken: ticket },
  });
  assert.equal(used.isError, undefined);
  const again = await client.callTool({
    name: 'agent_connect',
    arguments: { nickname: 'Боб', contextToken: ticket },
  });
  assert.equal(again.isError, true);

  // Two chats issuing the identical call at the same time cannot be told apart.
  const same = { nickname: 'Общий' };
  await f.preTool(s1, 'agent_connect', same);
  await f.preTool(s2, 'agent_connect', same);
  const ambiguous = await b.verify('agent_connect', same);
  assert.equal(ambiguous.status, 400);
  assert.match(String(ambiguous.body.error), /same request/);

  // Without its node-issued context, a plain Claude Code MCP connect is refused.
  const plain = await client.callTool({ name: 'agent_connect', arguments: { nickname: 'Ева' } });
  assert.equal(plain.isError, true);
  // An unknown helper secret cannot use a record.
  await f.preTool(s1, 'node_status', {});
  const impostor = await f.post('/integrations/claude/call', {
    helperId: a.id,
    secret: 'f'.repeat(64),
    tool: 'node_status',
    inputHash: '0'.repeat(64),
  });
  assert.equal(impostor.status, 400);
});

test('A dropped wake never records receipt; a queued backlog gets one wake and a partial read renews it', async (t) => {
  const f = await claudeFixture(t);
  const s1 = randomUUID();
  const a = new FakeHelper(f, s1);
  await f.hook('SessionStart', s1, { source: 'startup' });
  await a.attach();
  const bob = await f.connect(a, s1, 'Боб');
  // Messages queued while the helper transport is down form one backlog.
  await a.detach();
  await until(() => adapterOf(f, bob.binding.connectionId).state === 'error');
  const ids: string[] = [];
  for (const text of ['1', '2', '3']) ids.push((await sendTo(f, 'Боб', text)).id);
  await a.attach();
  await until(() => ids.every((id) => f.service.store.dispatchState(id)?.state === 'offered'));
  await settle();
  assert.equal(a.wakes().length, 1);
  // Claude Code may silently drop the event: nothing is received without agent_read.
  for (const id of ids) assert.equal(f.service.store.get(id, 'out')!.state, 'ready');
  assert.equal(f.service.snapshot().agents.find((x) => x.nickname === 'Боб')!.unread, 3);
  assert.equal(adapterOf(f, bob.binding.connectionId).state, 'checking');

  const read = { connectionId: bob.binding.connectionId, after: 0, limit: 1 };
  await f.preTool(s1, 'agent_read', read);
  assert.equal((await a.verify('agent_read', read)).status, 200);
  const page = (await f.service.read(read.connectionId, 0, 1, true)) as { hasMore: boolean };
  assert.equal(page.hasMore, true);
  // A read that confirms a wake marks channel delivery as working for this process.
  await until(() => adapterOf(f, bob.binding.connectionId).state === 'ready');
  await until(() => a.wakes().length === 2);
  await settle();
  assert.equal(a.wakes().length, 2);
  await f.service.read(read.connectionId, 0, 50, true);
  await settle();
  assert.equal(a.wakes().length, 2);
  for (const id of ids) assert.equal(f.service.store.get(id, 'out')!.state, 'processed');
  // A message arriving after the read gets a fresh wake.
  await sendTo(f, 'Боб', '4');
  await until(() => a.wakes().length === 3);
  const directory = f.service.snapshot().directories[0].agents.find((x) => x.nickname === 'Боб');
  assert.equal(directory?.delivery, 'automatic');
});

test('An ignored wake does not stall later messages: each new arrival is announced again', async (t) => {
  const f = await claudeFixture(t);
  const s1 = randomUUID();
  const a = new FakeHelper(f, s1);
  await f.hook('SessionStart', s1, { source: 'startup' });
  await a.attach();
  await f.connect(a, s1, 'Боб');
  // The model sees the first wake but does not read (on-site T05 regression).
  const first = await sendTo(f, 'Боб', 'Первое без чтения');
  await until(() => a.wakes().length === 1);
  const second = await sendTo(f, 'Боб', 'Второе позже');
  await until(() => a.wakes().length === 2);
  await settle();
  assert.equal(a.wakes().length, 2);
  for (const sent of [first, second]) {
    assert.equal(f.service.store.dispatchState(sent.id)?.state, 'offered');
    assert.equal(f.service.store.get(sent.id, 'in')!.state, 'ready');
  }
});

test('A session switch fences the old route before a new context is admitted', async (t) => {
  const f = await claudeFixture(t);
  const [s1, s2] = [randomUUID(), randomUUID()];
  const a = new FakeHelper(f, s1);
  await f.hook('SessionStart', s1, { source: 'startup' });
  await a.attach();
  const bob = await f.connect(a, s1, 'Боб');
  // /clear: SessionEnd for the old chat, then the hook-driven session event on the same transport.
  await f.hook('SessionEnd', s1, { reason: 'clear' });
  await a.switchSession(s2);
  const sent = await sendTo(f, 'Боб', 'Не в новый чат');
  await until(() => f.service.store.dispatchState(sent.id)?.state === 'waiting');
  await settle();
  assert.deepEqual(a.wakes(), []);
  assert.equal(adapterOf(f, bob.binding.connectionId).state, 'error');
  // The new chat proves its own session but does not inherit the nickname.
  await f.hook('SessionStart', s2, { source: 'clear' });
  const read = { connectionId: bob.binding.connectionId };
  await f.preTool(s2, 'agent_read', read);
  const refused = await a.verify('agent_read', read);
  assert.equal(refused.status, 400);
  await settle();
  assert.deepEqual(a.wakes(), []);
  const moved = await f.connect(a, s2, 'Боб');
  assert.equal(moved.status, 'nickname_in_use');
  // /resume back to the proven chat restores its route.
  await f.hook('SessionStart', s1, { source: 'resume' });
  await a.switchSession(s1);
  await until(() => a.wakes().length === 1);
  assert.equal(f.service.store.dispatchState(sent.id)?.state, 'offered');
});

test('A late session event cannot roll a helper back, and two helpers claiming one chat pause delivery', async (t) => {
  const f = await claudeFixture(t);
  const s1 = randomUUID();
  const a = new FakeHelper(f, s1);
  await f.hook('SessionStart', s1, { source: 'resume' });
  await a.attach();
  await f.connect(a, s1, 'Боб');
  const stale = await f.post('/integrations/claude/session', {
    helperId: a.id,
    secret: a.secret,
    session: randomUUID(),
    generation: 0 + 1,
  });
  assert.equal(stale.status, 200);
  a.generation = 1;
  // A replayed older generation is ignored.
  const replay = await f.post('/integrations/claude/session', {
    helperId: a.id,
    secret: a.secret,
    session: s1,
    generation: 1,
  });
  assert.equal(replay.status, 200);
  const sent = await sendTo(f, 'Боб', 'Пауза');
  await until(() => f.service.store.dispatchState(sent.id)?.state === 'waiting');
  // Two processes resuming the same chat are ambiguous.
  await f.hook('SessionStart', s1, { source: 'resume' });
  await a.switchSession(s1);
  const twin = new FakeHelper(f, s1);
  await f.hook('SessionStart', s1, { source: 'resume' });
  await twin.attach();
  await settle();
  const agent = f.service.store.list().find((x) => x.nickname === 'Боб')!;
  assert.match(
    String(f.service.adapters.get(agent.binding!.adapterId).status().error),
    /More than one Claude Code process/,
  );
  assert.deepEqual(twin.wakes(), []);
});

test('Node restart with a live helper restores the proven route and re-offers stale signals once; helper death keeps the queue', async (t) => {
  const f = await claudeFixture(t);
  const s1 = randomUUID();
  const a = new FakeHelper(f, s1);
  await f.hook('SessionStart', s1, { source: 'startup' });
  await a.attach();
  await f.connect(a, s1, 'Боб');
  const first = await sendTo(f, 'Боб', 'До рестарта');
  await until(() => a.wakes().length === 1);
  await a.detach();
  await f.restart();
  assert.equal(f.service.store.get(first.id, 'in')!.state, 'ready');
  // The same helper process reconnects with its in-memory secret and generation (P4).
  const lines = a.lines.length;
  await a.attach();
  await until(() => a.lines.length === lines + 1);
  assert.deepEqual(a.wakes(), ['Боб', 'Боб']);
  // A different helper process with a stale identity cannot reuse the persisted proof.
  const forged = new FakeHelper(f, s1);
  await forged.attach();
  await settle();
  assert.deepEqual(forged.wakes(), []);
  await forged.detach();

  // Helper death: the route disappears, messages stay queued without receipt.
  await a.detach();
  const bob = f.service.store.list().find((x) => x.nickname === 'Боб')!;
  await until(() => adapterOf(f, bob.binding!.connectionId).state === 'error');
  const second = await sendTo(f, 'Боб', 'После смерти helper');
  // Ordered delivery waits on the oldest message; nothing is received without agent_read.
  await until(() => f.service.store.dispatchState(first.id)?.state === 'waiting');
  assert.equal(f.service.store.get(first.id, 'in')!.state, 'ready');
  assert.equal(f.service.store.get(second.id, 'in')!.state, 'ready');
  // After the client reconnects the server, the new helper proves the still-active chat.
  await f.hook('SessionStart', s1, { source: 'resume' });
  const reconnected = new FakeHelper(f, s1);
  await reconnected.attach();
  await until(() => reconnected.wakes().length === 1);
  await reconnected.detach();
});

test('A helper reconnected after a node restart proves a still-active chat without a new hook; an ended chat stays fenced', async (t) => {
  const f = await claudeFixture(t);
  const [s1, s2] = [randomUUID(), randomUUID()];
  const a = new FakeHelper(f, s1),
    b = new FakeHelper(f, s2);
  for (const [helper, session] of [
    [a, s1],
    [b, s2],
  ] as const) {
    await f.hook('SessionStart', session, { source: 'startup' });
    await helper.attach();
  }
  await f.connect(a, s1, 'Боб');
  await f.connect(b, s2, 'Ева');
  await f.hook('SessionEnd', s2, { reason: 'prompt_input_exit' });
  await a.detach();
  await b.detach();
  await f.restart();
  // /mcp Reconnect spawns new helper processes with new secrets (on-site T16 path).
  const reconnected = new FakeHelper(f, s1);
  const ended = new FakeHelper(f, s2);
  await reconnected.attach();
  await ended.attach();
  await sendTo(f, 'Боб', 'После reconnect');
  const late = await sendTo(f, 'Ева', 'Завершённому чату');
  await until(() => reconnected.wakes().length === 1);
  await until(() => f.service.store.dispatchState(late.id)?.state === 'waiting');
  await settle();
  assert.deepEqual(ended.wakes(), []);
  await reconnected.detach();
  await ended.detach();
});

test('A wake the model deferred is renewed once when its turn ends, never in a loop', async (t) => {
  const f = await claudeFixture(t);
  const [s1, s2] = [randomUUID(), randomUUID()];
  const a = new FakeHelper(f, s1),
    other = new FakeHelper(f, s2);
  for (const [helper, session] of [
    [a, s1],
    [other, s2],
  ] as const) {
    await f.hook('SessionStart', session, { source: 'startup' });
    await helper.attach();
  }
  await f.connect(a, s1, 'Боб');
  await f.connect(other, s2, 'Ева');
  // On-site T06: the event arrived mid-turn and the model was told to stop first.
  const sent = await sendTo(f, 'Боб', 'Отложенное');
  await until(() => a.wakes().length === 1);
  // Another chat's turn end does not renew this chat.
  await f.hook('Stop', s2);
  await settle();
  assert.equal(a.wakes().length, 1);
  await f.hook('Stop', s1);
  await until(() => a.wakes().length === 2);
  // The model keeps deferring: further turn ends do not repeat the same message.
  await f.hook('Stop', s1);
  await f.hook('Stop', s1);
  await settle();
  assert.equal(a.wakes().length, 2);
  assert.equal(f.service.store.dispatchState(sent.id)?.state, 'offered');
  assert.equal(f.service.store.get(sent.id, 'in')!.state, 'ready');
  // A turn end without unread offers sends nothing.
  await f.hook('Stop', s2);
  await settle();
  assert.deepEqual(other.wakes(), []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { until } from './aionui-fixture.js';
import {
  canonicalInputHash,
  claudeFixture,
  FakeHelper,
  type ClaudeFixture,
} from './claude-code-fixture.js';

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
  assert.ok(!('delivery' in bob));
  assert.equal(adapterOf(f, bob.binding.connectionId).state, 'manual');
  assert.match(
    String(adapterOf(f, bob.binding.connectionId).error),
    /^Automatic wake is unavailable in this chat/,
  );
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
  const proof = await f.preTool(s1, 'agent_read', stolen);
  const refused = await a.verify('agent_read', stolen, proof);
  assert.equal(refused.status, 400);
  assert.match(String(refused.body.error), /another Claude Code chat/);
});

test('A tool proof is required, one-use and bound to the exact helper, tool and original input', async (t) => {
  const f = await claudeFixture(t);
  const [s1, s2] = [randomUUID(), randomUUID()];
  const a = new FakeHelper(f, s1),
    b = new FakeHelper(f, s2);
  await f.hook('SessionStart', s1, { source: 'startup' });
  await f.hook('SessionStart', s2, { source: 'startup' });
  await a.attach();
  await b.attach();
  const args = { nickname: 'Боб' };
  const missing = await a.verify('agent_connect', args);
  assert.equal(missing.status, 400);
  const fabricated = await a.verify('agent_connect', args, randomUUID());
  assert.equal(fabricated.status, 400);
  const foreignProof = await f.preTool(s2, 'agent_connect', args);
  const foreign = await a.verify('agent_connect', args, foreignProof);
  assert.equal(foreign.status, 400);

  const otherProof = await f.preTool(s1, 'agent_connect', args);
  const other = await a.verify('agent_connect', { nickname: 'Мэллори' }, otherProof);
  assert.equal(other.status, 400);
  const wrongToolProof = await f.preTool(s1, 'agent_connect', args);
  const wrongTool = await a.verify('agent_disconnect', args, wrongToolProof);
  assert.equal(wrongTool.status, 400);
  const proof = await f.preTool(s1, 'agent_connect', args);
  const first = await a.verify('agent_connect', { ...args, contextToken: proof }, proof);
  assert.equal(first.status, 200);
  assert.equal(typeof first.body.contextToken, 'string');
  assert.equal(typeof first.body.callToken, 'string');
  const replay = await a.verify('agent_connect', args, proof);
  assert.equal(replay.status, 400);

  // Check ticket consumption directly, independently of the MCP call-permit boundary.
  await assert.rejects(
    f.service.connectAutomatic(
      { nickname: 'Боб', contextToken: randomUUID() },
      { client: 'Claude Code' },
    ),
  );
  const ticket = String(first.body.contextToken);
  const used = await f.service.connectAutomatic(
    { nickname: 'Боб', contextToken: ticket },
    { client: 'Claude Code' },
  );
  assert.equal(used.status, 'connected');
  await assert.rejects(
    f.service.connectAutomatic(
      { nickname: 'Боб', contextToken: ticket },
      { client: 'Claude Code' },
    ),
  );

  // Identical input does not grant another helper authority over this chat.
  const same = { nickname: 'Общий' };
  const aProof = await f.preTool(s1, 'agent_connect', same);
  const bProof = await f.preTool(s2, 'agent_connect', same);
  assert.equal((await a.verify('agent_connect', same, aProof)).status, 200);
  assert.equal((await b.verify('agent_connect', same, bProof)).status, 200);

  // The connection consumer refuses Claude Code without its node-issued context.
  await assert.rejects(f.service.connectAutomatic({ nickname: 'Ева' }, { client: 'Claude Code' }));
  // An unknown helper secret cannot use a node-issued proof.
  const impostorProof = await f.preTool(s1, 'node_status', {});
  const impostor = await f.post('/integrations/claude/call', {
    helperId: a.id,
    secret: 'f'.repeat(64),
    tool: 'node_status',
    inputHash: canonicalInputHash({}),
    contextToken: impostorProof,
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
  assert.equal(adapterOf(f, bob.binding.connectionId).state, 'manual');

  const read = { connectionId: bob.binding.connectionId, after: 0, limit: 1 };
  const proof = await f.preTool(s1, 'agent_read', read);
  assert.equal((await a.verify('agent_read', read, proof)).status, 200);
  assert.equal(adapterOf(f, bob.binding.connectionId).state, 'manual');
  const page = (await f.service.read(read.connectionId, 0, 1, true)) as { hasMore: boolean };
  assert.equal(page.hasMore, true);
  // A completed MCP read does not establish that an idle channel event caused it.
  assert.equal(adapterOf(f, bob.binding.connectionId).state, 'manual');
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
  assert.equal(directory?.delivery, 'unknown');
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

test('A native session change fences the old helper; a fresh helper does not inherit its nickname', async (t) => {
  const f = await claudeFixture(t);
  const [s1, s2] = [randomUUID(), randomUUID()];
  const a = new FakeHelper(f, s1);
  await f.hook('SessionStart', s1, { source: 'startup' });
  await a.attach();
  const bob = await f.connect(a, s1, 'Боб');
  // An in-process identity change is unsupported: the new native lease needs a fresh helper.
  await f.hook('SessionEnd', s1, { reason: 'clear' });
  await f.hook('SessionStart', s2, { source: 'clear' });
  const sent = await sendTo(f, 'Боб', 'Не в новый чат');
  await until(() => f.service.store.dispatchState(sent.id)?.state === 'waiting');
  await settle();
  assert.deepEqual(a.wakes(), []);
  assert.equal(adapterOf(f, bob.binding.connectionId).state, 'error');
  // The new chat proves its own native session but does not inherit the nickname.
  const next = new FakeHelper(f, s2);
  await next.attach();
  const read = { connectionId: bob.binding.connectionId };
  const proof = await f.preTool(s2, 'agent_read', read);
  const refused = await next.verify('agent_read', read, proof);
  assert.equal(refused.status, 400);
  await settle();
  assert.deepEqual(a.wakes(), []);
  const moved = await f.connect(next, s2, 'Боб');
  assert.equal(moved.status, 'nickname_in_use');
  // Resuming the original chat also needs a fresh helper for its new native lease.
  await f.hook('SessionEnd', s2, { reason: 'prompt_input_exit' });
  await next.detach();
  await a.detach();
  await f.hook('SessionStart', s1, { source: 'resume' });
  const resumed = new FakeHelper(f, s1);
  await resumed.attach();
  await until(() => resumed.wakes().length === 1);
  assert.equal(f.service.store.dispatchState(sent.id)?.state, 'offered');
});

test('Public session messages cannot rebind a helper; duplicate native helpers pause delivery', async (t) => {
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
  assert.equal(stale.status, 404);
  // Replayed model-supplied identity is non-authoritative as well.
  const replay = await f.post('/integrations/claude/session', {
    helperId: a.id,
    secret: a.secret,
    session: s1,
    generation: 1,
  });
  assert.equal(replay.status, 404);
  const sent = await sendTo(f, 'Боб', 'Пауза');
  await until(() => a.wakes().length === 1);
  assert.equal(f.service.store.dispatchState(sent.id)?.state, 'offered');
  // A second helper presenting the same current native lease creates ambiguity.
  const twin = new FakeHelper(f, s1);
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
  const forged = new FakeHelper(f, s1, s1, randomUUID());
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
  // Reconnecting the server uses the unchanged active native lease, without a new SessionStart.
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

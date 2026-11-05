import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { claudeFixture, FakeHelper } from './claude-code-fixture.js';
import type { ClaudeHelper } from '../desktop/core/claude-sessions.js';
import type { ClaudeCodeAdapter } from '../desktop/core/claude-adapter.js';
import { claudeCallMetaKey } from '../desktop/integrations/claude-code.js';
import type { ChatHistoryPage } from '../desktop/shared/contracts.js';
import { until } from './aionui-fixture.js';

async function fixture(t: TestContext) {
  const f = await claudeFixture(t);
  const session = randomUUID();
  const helper = new FakeHelper(f, session);
  await f.hook('SessionStart', session, { source: 'startup' });
  await helper.attach();
  const connected = await f.connect(helper, session, 'R5 Боб 漢字');
  const binding = connected.binding;
  const adapter = f.service.adapters.get(binding.adapterId) as ClaudeCodeAdapter;
  const sender = f.service.connect({ nickname: 'R5 fixture sender', client: 'MCP' });
  assert.equal(sender.status, 'connected');
  if (sender.status !== 'connected') throw new Error('The fixture sender is unavailable');
  const writes: { helper: ClaudeHelper; type: unknown }[] = [];
  const send = f.service.claude.send.bind(f.service.claude);
  f.service.claude.send = (target, message) => {
    const result = send(target, message);
    if (result) writes.push({ helper: target, type: message.type });
    return result;
  };
  const settle = async () => {
    const pending = (f.service as unknown as { jobs: Set<Promise<void>> }).jobs;
    for (let round = 0; round < 50; round++) {
      if (!pending.size) return;
      await Promise.all([...pending]);
    }
    throw new Error('The isolated adapter dispatch did not settle');
  };
  const native = () => {
    const current = f.service.claude.route(session).helper;
    assert.ok(current);
    return current;
  };
  const count = (target: ClaudeHelper, type = 'wake') =>
    writes.filter((write) => write.helper === target && write.type === type).length;
  const states = () =>
    adapter as unknown as {
      offers: Map<string, { connectionId: string }>;
      renewed: Map<string, { connectionId: string }>;
    };
  const sendMessage = async (text: string) => {
    const result = await f.service.send({
      connectionId: sender.binding.connectionId,
      recipientNode: f.service.settings.value.nodeId,
      recipientNickname: connected.nickname,
      text,
    });
    await settle();
    assert.equal(f.service.store.dispatchState(result.id)?.state, 'offered');
    assert.equal(adapter.offerCurrent(result.id), true);
    return result.id;
  };
  const stop = async () => {
    await f.hook('Stop', session);
    await settle();
  };
  const unread = (ids: string[]) => {
    for (const id of ids) {
      assert.equal(f.service.store.get(id, 'in')?.envelope.id, id);
      assert.equal(f.service.store.get(id, 'in')?.state, 'ready');
      assert.equal(f.service.store.get(id, 'out')?.state, 'ready');
    }
  };
  const read = async (target: FakeHelper, limit = 50) => {
    const args = { connectionId: binding.connectionId, after: 0, limit };
    const proof = await f.preTool(session, 'agent_read', args);
    const permit = await target.verify('agent_read', args, proof);
    assert.equal(permit.status, 200);
    const client = await f.mcp();
    const result = await client.callTool({
      name: 'agent_read',
      arguments: args,
      _meta: { [claudeCallMetaKey]: permit.body.callToken },
    });
    assert.equal(result.isError, undefined, JSON.stringify(result.content));
    await settle();
    return result.structuredContent as unknown as ChatHistoryPage;
  };
  return {
    f,
    session,
    helper,
    connected,
    binding,
    adapter,
    settle,
    native,
    count,
    states,
    sendMessage,
    stop,
    unread,
    read,
  };
}

test('R5 unread messages renew once for each transport lifecycle and native incarnation', async (t) => {
  const r = await fixture(t);
  const first = r.native();
  const initialRevision = r.adapter.offerRevision;
  const id = await r.sendMessage('Unread across helper lifecycles');
  assert.equal(r.count(first), 1);
  assert.equal(r.adapter.offerRevision, initialRevision);
  await r.stop();
  assert.equal(r.count(first), 2);
  assert.equal(r.adapter.offerRevision, initialRevision + 1);
  await r.stop();
  await r.stop();
  assert.equal(r.count(first), 2);
  assert.equal(r.adapter.offerRevision, initialRevision + 1);
  r.f.service.adapters.emit('idle');
  await r.settle();
  assert.equal(r.adapter.offerRevision, initialRevision + 1);
  r.unread([id]);

  await r.helper.detach();
  await until(() => !r.f.service.claude.route(r.session).helper);
  await r.helper.attach();
  await r.settle();
  const reconnected = r.native();
  assert.equal(reconnected.id, first.id);
  assert.notEqual(reconnected.epoch, first.epoch);
  assert.equal(r.count(reconnected), 1);
  await r.stop();
  await r.stop();
  assert.equal(r.count(reconnected), 2);
  assert.equal(r.states().renewed.size, 1);
  r.unread([id]);

  await r.f.hook('SessionEnd', r.session, { reason: 'fixture restart' });
  await r.helper.detach();
  await r.f.hook('SessionStart', r.session, { source: 'resume' });
  const resumed = new FakeHelper(r.f, r.session);
  await resumed.attach();
  await r.settle();
  const incarnation = r.native();
  assert.notEqual(incarnation.id, first.id);
  assert.notEqual(incarnation.nativeLeaseNonce, first.nativeLeaseNonce);
  assert.equal(r.count(incarnation), 1);
  await r.stop();
  await r.stop();
  assert.equal(r.count(incarnation), 2);
  assert.equal(r.states().renewed.size, 1);
  r.unread([id]);
});

test('R5 transient ambiguity does not replenish the original helper renewal budget', async (t) => {
  const r = await fixture(t);
  const original = r.native();
  const id = await r.sendMessage('Still unread after ambiguity');
  await r.stop();
  assert.equal(r.count(original), 2);
  const twin = new FakeHelper(r.f, r.session);
  await twin.attach();
  await r.settle();
  assert.equal(r.f.service.claude.route(r.session).ambiguous, true);
  await twin.detach();
  await until(() => r.f.service.claude.route(r.session).helper === original);
  await r.settle();
  await r.stop();
  await r.stop();
  assert.equal(r.count(original), 2);
  assert.equal(r.states().renewed.size, 1);
  r.unread([id]);
});

test('R5 partial reads preserve unread budgets; draining cleans tracking and new IDs get one renewal', async (t) => {
  const r = await fixture(t);
  const original = r.native();
  const first = await r.sendMessage('First page');
  const second = await r.sendMessage('Remaining page');
  await r.stop();
  const afterRenewal = r.count(original);
  const beforePageRevision = r.adapter.offerRevision;
  const page = await r.read(r.helper, 1);
  assert.deepEqual(
    page.messages.map((message) => message.envelope.id),
    [first],
  );
  assert.equal(page.hasMore, true);
  assert.equal(r.adapter.offerRevision, beforePageRevision + 1);
  const afterPage = r.count(original);
  assert.ok(afterPage > afterRenewal);
  await r.stop();
  await r.stop();
  assert.equal(r.count(original), afterPage);
  r.unread([second]);
  assert.equal(r.f.service.store.get(first, 'out')?.state, 'processed');

  const beforeArrivalRevision = r.adapter.offerRevision;
  const third = await r.sendMessage('A new unread ID');
  assert.equal(r.adapter.offerRevision, beforeArrivalRevision);
  const beforeNewRenewal = r.count(original);
  await r.stop();
  assert.equal(r.count(original), beforeNewRenewal + 1);
  await r.stop();
  assert.equal(r.count(original), beforeNewRenewal + 1);
  r.unread([second, third]);
  const beforeDrainRevision = r.adapter.offerRevision;
  const drained = await r.read(r.helper);
  assert.deepEqual(
    drained.messages.map((message) => message.envelope.id),
    [second, third],
  );
  assert.equal(drained.hasMore, false);
  assert.equal(r.adapter.offerRevision, beforeDrainRevision);
  assert.equal(r.states().offers.size, 0);
  assert.equal(r.states().renewed.size, 0);
  for (const id of [first, second, third])
    assert.equal(r.f.service.store.get(id, 'out')?.state, 'processed');
  const beforeEmptyStop = r.count(original);
  await r.stop();
  assert.equal(r.count(original), beforeEmptyStop);

  const fourth = await r.sendMessage('After a complete drain');
  const beforeFourthRenewal = r.count(original);
  await r.stop();
  await r.stop();
  assert.equal(r.count(original), beforeFourthRenewal + 1);
  assert.equal(r.states().renewed.size, 1);
  r.unread([fourth]);
});

test('R5 adapter stop clears tracking and leaves offered system notice receipt semantics unchanged', async (t) => {
  const r = await fixture(t);
  const original = r.native();
  const id = await r.sendMessage('Unread during an approved fixture transfer');
  await r.stop();
  const args = {
    nickname: r.connected.nickname,
    client: 'MCP',
    chatId: randomUUID(),
    adapterId: r.f.service.settings.value.adapters.find((profile) => profile.kind === 'manual')!.id,
  };
  const choice = r.f.service.connect(args);
  assert.equal(choice.status, 'nickname_in_use');
  if (choice.status !== 'nickname_in_use') throw new Error('The fixture transfer is unavailable');
  const moved = r.f.service.connect({
    ...args,
    connectionId: choice.connectionId,
    transferId: choice.transferId,
    confirmTransfer: true,
  });
  assert.equal(moved.status, 'connected');
  await r.settle();
  assert.equal(r.count(original, 'notice'), 1);
  const events = r.f.service.store.events(r.binding.connectionId);
  assert.equal(events.length, 1);
  const dispatch = () =>
    r.f.service.store.db
      .prepare('SELECT dispatch_state FROM system_events WHERE id=?')
      .get(events[0].id)?.dispatch_state;
  assert.equal(dispatch(), 'offered');
  await r.stop();
  assert.equal(r.count(original, 'notice'), 1);
  assert.equal(dispatch(), 'offered');
  await r.adapter.stop();
  assert.equal(r.states().offers.size, 0);
  assert.equal(r.states().renewed.size, 0);
  assert.equal(dispatch(), 'offered');
  r.unread([id]);
});

test('R5 returning an unread message to the same helper gives its new binding one renewal', async (t) => {
  const r = await fixture(t);
  const original = r.native();
  const originalEpoch = original.epoch;
  const id = await r.sendMessage('Unread through an approved round-trip transfer');
  await r.stop();
  assert.equal(r.count(original), 2);
  assert.equal(r.states().renewed.get(id)?.connectionId, r.binding.connectionId);
  const approveTransfer = (target: { client: string; chatId: string; adapterId: string }) => {
    const request = r.f.service.connect({ nickname: r.connected.nickname, ...target });
    assert.equal(request.status, 'nickname_in_use');
    if (request.status !== 'nickname_in_use')
      throw new Error('The fixture transfer is unavailable');
    const result = r.f.service.connect({
      nickname: r.connected.nickname,
      ...target,
      connectionId: request.connectionId,
      transferId: request.transferId,
      confirmTransfer: true,
    });
    assert.equal(result.status, 'connected');
    if (result.status !== 'connected') throw new Error('The fixture transfer was not applied');
    return result.binding;
  };
  approveTransfer({
    client: 'MCP',
    chatId: randomUUID(),
    adapterId: r.f.service.settings.value.adapters.find((profile) => profile.kind === 'manual')!.id,
  });
  await r.settle();
  const returned = approveTransfer({
    client: 'Claude Code',
    chatId: r.session,
    adapterId: r.binding.adapterId,
  });
  await r.settle();
  assert.notEqual(returned.connectionId, r.binding.connectionId);
  assert.ok(returned.generation > r.binding.generation);
  assert.equal(r.native(), original);
  assert.equal(original.epoch, originalEpoch);
  assert.equal(r.count(original), 3);
  r.unread([id]);
  await r.stop();
  assert.equal(r.count(original), 4);
  assert.equal(r.states().renewed.get(id)?.connectionId, returned.connectionId);
  await r.stop();
  await r.stop();
  assert.equal(r.count(original), 4);
  assert.equal(r.f.service.store.dispatchState(id)?.connectionId, returned.connectionId);
  r.unread([id]);
});

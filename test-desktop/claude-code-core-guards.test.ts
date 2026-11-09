import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { claudeFixture, FakeHelper, type ClaudeFixture } from './claude-code-fixture.js';
import { until } from './aionui-fixture.js';
import { claudeCallMetaKey } from '../desktop/integrations/claude-code.js';
import type { AgentAdapter, EventInput } from '../desktop/core/adapters.js';

async function fixture(t: test.TestContext) {
  const f = await claudeFixture(t);
  const session = randomUUID();
  const helper = new FakeHelper(f, session);
  await f.hook('SessionStart', session, { source: 'startup' });
  await helper.attach();
  const connected = await f.connect(helper, session, 'Получатель 漢字');
  const connectionId = String(connected.binding.connectionId);
  const sender = f.service.connect({ nickname: 'Sender', client: 'MCP' });
  if (sender.status !== 'connected') throw new Error('sender');
  const send = (files: string[] = []) =>
    f.service.send({
      connectionId: sender.binding.connectionId,
      recipientNode: f.service.settings.value.nodeId,
      recipientNickname: 'Получатель 漢字',
      text: 'body',
      files,
    });
  const reserve = (id: string, scope: Record<string, unknown> = {}) =>
    f.service.store.reserveClaudeDelivery({
      connectionId,
      ids: [id],
      helperId: helper.id,
      scope,
    });
  return { f, session, helper, connectionId, send, reserve };
}

test('Prior dispatch uncertainty is not overwritten by a fresh Claude reservation', async (t) => {
  const { f, send, reserve } = await fixture(t);
  for (const state of ['dispatching', 'uncertain']) {
    const sent = await send();
    f.service.store.dispatch(sent.id, randomUUID(), state);
    assert.throws(() => reserve(sent.id), /in progress|uncertain/);
    assert.equal(f.service.store.dispatchState(sent.id)?.state, state);
    assert.equal(f.service.store.get(sent.id, 'in')?.state, 'ready');
  }
});

test('An attachment reserved while materialization awaits never releases its path', async (t) => {
  const { f, connectionId, send, reserve } = await fixture(t);
  const filename = path.join(f.service.settings.value.exportRoots[0], 'файл 漢字.txt');
  await writeFile(filename, 'file body');
  const sent = await send([filename]);
  const file = f.service.store.get(sent.id, 'in')!.envelope.attachments[0];
  let release!: () => void, reached!: () => void;
  const barrier = new Promise<void>((resolve) => (release = resolve));
  const waiting = new Promise<void>((resolve) => (reached = resolve));
  const original = f.service.files.materialize.bind(f.service.files);
  f.service.files.materialize = async (...args) => {
    reached();
    await barrier;
    return original(...args);
  };
  const pending = f.service.receiveFile(connectionId, sent.id, file.id);
  await waiting;
  reserve(sent.id);
  release();
  await assert.rejects(pending, /in progress|uncertain/);
  assert.equal(f.service.store.get(sent.id, 'in')?.state, 'ready');
});

test('An entirely fenced unread page returns an explicit blocked outcome', async (t) => {
  const { f, connectionId, send, reserve } = await fixture(t);
  const sent = await send();
  reserve(sent.id);
  await assert.rejects(f.service.read(connectionId, 0, 50, true), /in progress|uncertain/);
  const owner = f.service.store.chatHistory(f.service.store.assertOwner(connectionId).key);
  assert.ok(owner.messages.some((row) => row.envelope.text === 'body'));
});

test('Replacing the same helper transport retires only old-epoch issued attempts', async (t) => {
  const { f, helper, send, reserve } = await fixture(t);
  const oldEpoch = f.service.claude.authenticateHelper(helper.id, helper.secret).epoch;
  const first = await send();
  const old = reserve(first.id, { epoch: oldEpoch });
  f.service.store.issueClaudeDelivery(old);
  await helper.attach();
  const newEpoch = f.service.claude.authenticateHelper(helper.id, helper.secret).epoch;
  assert.notEqual(newEpoch, oldEpoch);
  await until(() => f.service.store.claudeDelivery(old)?.state === 'uncertain');
  const second = await send();
  const fresh = reserve(second.id, { epoch: newEpoch });
  f.service.store.issueClaudeDelivery(fresh);
  f.service.store.claudeHelperGone(helper.id, oldEpoch);
  assert.equal(f.service.store.claudeDelivery(fresh)?.state, 'issued');
});

test('A native end rejects a final writer validation and makes a late commit uncertain', async (t) => {
  const { f, session, helper, connectionId, send } = await fixture(t);
  const sent = await send();
  const args = { connectionId };
  const proof = await f.preTool(session, 'agent_read', args);
  const verified = await helper.verify('agent_read', args, proof);
  const client = await f.mcp();
  const result = await client.callTool({
    name: 'agent_read',
    arguments: args,
    _meta: { [claudeCallMetaKey]: verified.body.callToken },
  });
  const delivery = result._meta?.['ncf/claude-delivery'];
  const report = (phase: string) =>
    f.post('/integrations/claude/delivery', {
      helperId: helper.id,
      secret: helper.secret,
      delivery,
      phase,
    });
  assert.equal((await report('validate')).status, 200);
  await f.hook('SessionEnd', session, { reason: 'clear' });
  assert.equal((await report('validate')).status, 400);
  assert.equal((await report('commit')).status, 400);
  assert.equal(f.service.store.claudeDelivery(String(delivery))?.state, 'uncertain');
  assert.equal(f.service.store.get(sent.id, 'in')?.state, 'ready');
});

test('A delivery callback sees a fence introduced after adapter invocation', async (t) => {
  const { f, connectionId, send, reserve } = await fixture(t);
  const owner = f.service.store.assertOwner(connectionId);
  let entered!: (value: EventInput) => void, release!: () => void;
  const invoking = new Promise<EventInput>((resolve) => (entered = resolve));
  const barrier = new Promise<void>((resolve) => (release = resolve));
  const original = f.service.adapters.get(owner.binding.adapterId);
  const adapter: AgentAdapter = {
    wakeOnly: true,
    status: () => ({
      ...original.status(),
      capabilities: { ...original.status().capabilities, wakeIdle: true },
    }),
    start: async () => {},
    stop: async () => {},
    deliver: async (input) => {
      entered(input);
      await barrier;
      return { state: 'revoked' };
    },
  };
  (f.service.adapters as unknown as { adapters: Map<string, AgentAdapter> }).adapters.set(
    owner.binding.adapterId,
    adapter,
  );
  const sent = await send();
  const input = await invoking;
  assert.equal(input.isCurrent?.(), true);
  reserve(sent.id);
  assert.equal(input.isCurrent?.(), false);
  release();
  assert.equal(f.service.store.get(sent.id, 'in')?.state, 'ready');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NodeService } from '../desktop/core/service.js';
import { AgentStore } from '../desktop/core/agent-store.js';
import type { AgentAdapter, Admission, EventInput } from '../desktop/core/adapters.js';
import type { AdapterState } from '../desktop/shared/contracts.js';
import { until } from './aionui-fixture.js';

class WakeOnly implements AgentAdapter {
  readonly wakeOnly = true;
  offers: string[] = [];
  epoch = 1;
  mode: 'offer' | 'throw' | 'admit' | 'waiting' = 'offer';
  private offered = new Map<string, number>();
  constructor(readonly id: string) {}
  status(): AdapterState {
    return {
      id: this.id,
      label: 'Wake fixture',
      kind: 'manual',
      capabilities: {
        wakeIdle: true,
        receiveActive: false,
        nativeDisplay: false,
        exactSession: true,
      },
      state: 'ready',
      error: null,
    };
  }
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async deliver(input: EventInput): Promise<Admission> {
    if (this.mode === 'throw') throw new Error('The wake transport closed');
    if (this.mode === 'admit') return { state: 'admitted' };
    if (this.mode === 'waiting') return { state: 'waiting' };
    this.offers.push(input.messageId);
    this.offered.set(input.messageId, this.epoch);
    return { state: 'offered' };
  }
  offerCurrent(messageId: string): boolean {
    return this.offered.get(messageId) === this.epoch;
  }
}

async function fixture(t: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-offered-'));
  let service = new NodeService(directory);
  await service.open();
  t.after(async () => {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  const sender = service.connect({ nickname: 'Автор', client: 'MCP' }),
    recipient = service.connect({ nickname: 'Получатель 漢字', client: 'MCP' });
  if (sender.status !== 'connected' || recipient.status !== 'connected') throw new Error();
  const install = (target: NodeService) => {
    const wake = new WakeOnly(recipient.binding.adapterId);
    (target.adapters as unknown as { adapters: Map<string, AgentAdapter> }).adapters.set(
      wake.id,
      wake,
    );
    return wake;
  };
  let wake = install(service);
  const send = (text: string) =>
    service.send({
      connectionId: sender.binding.connectionId,
      recipientNode: service.settings.value.nodeId,
      recipientNickname: 'Получатель 漢字',
      text,
    });
  const drain = () => service.adapters.emit('idle');
  const restart = async () => {
    await service.close();
    service = new NodeService(directory);
    await service.open();
    wake = install(service);
    return service;
  };
  return {
    get service() {
      return service;
    },
    get wake() {
      return wake;
    },
    sender,
    recipient,
    send,
    drain,
    restart,
    directory,
  };
}

test('An offer is not a receipt; a current offer is not repeated and a new lifecycle re-offers once', async (t) => {
  const f = await fixture(t);
  const sent = await f.send('Первое сообщение');
  await until(() => f.service.store.dispatchState(sent.id)?.state === 'offered');
  assert.equal(f.service.store.get(sent.id, 'in')!.state, 'ready');
  assert.equal(f.service.store.get(sent.id, 'out')!.state, 'ready');
  assert.deepEqual(f.wake.offers, [sent.id]);
  f.drain();
  f.drain();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.deepEqual(f.wake.offers, [sent.id]);
  f.wake.epoch++;
  f.drain();
  await until(() => f.wake.offers.length === 2);
  assert.equal(f.service.store.dispatchState(sent.id)?.state, 'offered');
  const read = (await f.service.read(f.recipient.binding.connectionId, 0, 50, true)) as {
    messages: { envelope: { id: string; text: string } }[];
  };
  assert.deepEqual(
    read.messages.map((message) => message.envelope.text),
    ['Первое сообщение'],
  );
  assert.equal(f.service.store.dispatchState(sent.id)?.state, 'admitted');
  assert.equal(f.service.store.get(sent.id, 'out')!.state, 'processed');
});

test('Every ready message of a binding is offered in order; a failed wake is not uncertain and an admitted wake-only result is refused', async (t) => {
  const f = await fixture(t);
  const ids: string[] = [];
  for (const text of ['A', 'B', 'C']) ids.push((await f.send(text)).id);
  await until(() => ids.every((id) => f.service.store.dispatchState(id)?.state === 'offered'));
  assert.deepEqual(f.wake.offers, ids);
  f.wake.mode = 'throw';
  f.wake.epoch++;
  f.drain();
  await until(() => f.service.store.dispatchState(ids[0])?.state === 'failed');
  assert.notEqual(f.service.store.dispatchState(ids[0])?.state, 'uncertain');
  f.wake.mode = 'admit';
  f.drain();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(f.service.store.dispatchState(ids[0])?.state, 'failed');
  assert.equal(f.service.store.get(ids[0], 'in')!.state, 'ready');
  f.wake.mode = 'waiting';
  f.drain();
  await until(() => f.service.store.dispatchState(ids[0])?.state === 'waiting');
  f.wake.mode = 'offer';
  f.drain();
  await until(() => ids.every((id) => f.service.store.dispatchState(id)?.state === 'offered'));
});

test('Restart turns an interrupted offer into a stale offer and keeps uncertain content admissions', async (t) => {
  const f = await fixture(t);
  const offering = await f.send('Прерванный сигнал');
  const uncertain = await f.send('Неопределённый');
  await until(() => f.service.store.dispatchState(uncertain.id)?.state === 'offered');
  f.service.store.dispatch(offering.id, f.recipient.binding.connectionId, 'offering');
  f.service.store.dispatch(uncertain.id, f.recipient.binding.connectionId, 'uncertain', 'lost');
  await f.restart();
  assert.equal(f.service.store.dispatchState(offering.id)?.state, 'offered');
  assert.equal(f.service.store.dispatchState(uncertain.id)?.state, 'uncertain');
  // The fresh lifecycle has no current offers: only the interrupted signal is re-offered.
  f.drain();
  await until(() => f.wake.offers.includes(offering.id));
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.deepEqual(f.wake.offers, [offering.id]);
  assert.equal(f.service.store.dispatchState(uncertain.id)?.state, 'uncertain');
});

test('An offer for a previous binding generation is offered again to the new binding', async (t) => {
  const f = await fixture(t);
  const sent = await f.send('Для нового чата');
  await until(() => f.service.store.dispatchState(sent.id)?.state === 'offered');
  const moved = f.service.connect({ nickname: 'Получатель 漢字', client: 'MCP', chatId: 'new' });
  assert.equal(moved.status, 'nickname_in_use');
  if (moved.status !== 'nickname_in_use') return;
  const confirmed = f.service.connect({
    nickname: 'Получатель 漢字',
    client: 'MCP',
    chatId: 'new',
    connectionId: moved.connectionId,
    transferId: moved.transferId,
    confirmTransfer: true,
  });
  assert.equal(confirmed.status, 'connected');
  if (confirmed.status !== 'connected') return;
  await until(
    () => f.service.store.dispatchState(sent.id)?.connectionId === confirmed.binding.connectionId,
  );
  await until(() => f.service.store.dispatchState(sent.id)?.state === 'offered');
  assert.equal(f.wake.offers.filter((id) => id === sent.id).length, 2);
});

test('Interrupted system-event offers return to pending on restart', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-offered-store-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let store = new AgentStore(directory);
  const first = store.connect({ nickname: 'Старый', client: 'MCP', chatId: 'a', adapterId: 'x' });
  if (first.status !== 'connected') throw new Error();
  store.db
    .prepare('INSERT INTO system_events(connection_id,event,dispatch_state) VALUES(?,?,?)')
    .run(first.binding.connectionId, JSON.stringify({ type: 'agent_moved' }), 'offering');
  store.db
    .prepare('INSERT INTO system_events(connection_id,event,dispatch_state) VALUES(?,?,?)')
    .run(first.binding.connectionId, JSON.stringify({ type: 'agent_moved' }), 'offered');
  store.close();
  store = new AgentStore(directory);
  const states = store.db
    .prepare('SELECT dispatch_state FROM system_events ORDER BY id')
    .all()
    .map((row) => row.dispatch_state);
  assert.deepEqual(states, ['pending', 'offered']);
  assert.equal(store.pendingSystemEvents().length, 1);
  store.close();
});

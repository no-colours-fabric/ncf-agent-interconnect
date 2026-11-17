import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { agentMessageText, type Admission, type EventInput } from '../desktop/core/adapters.js';
import type { Binding } from '../desktop/shared/contracts.js';
import { NodeService } from '../desktop/core/service.js';
import { SettingsFile } from '../desktop/core/settings.js';

const flush = async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
};

async function fixture(t: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-transfer-fence-'));
  const settings = new SettingsFile(directory);
  await settings.load();
  settings.value.peerPort = 0;
  await settings.save();
  let service = new NodeService(directory);
  await service.open();
  const pending = new Set<(result: Admission) => void>();
  t.after(async () => {
    for (const resolve of pending) resolve({ state: 'uncertain' });
    await flush();
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });

  const mock = (
    id: string,
    result: (input: EventInput) => Promise<Admission>,
    wakeOnly = false,
    noBody = false,
  ) => {
    const calls: EventInput[] = [];
    const adapter = service.adapters.get(id);
    Object.assign(adapter, {
      wakeOnly,
      contentGate: true,
      offerCurrent: () => true,
      status: () => ({
        id,
        label: 'Isolated native fixture',
        kind: 'manual' as const,
        capabilities: {
          wakeIdle: true,
          receiveActive: false,
          nativeDisplay: true,
          exactSession: true,
        },
        state: 'ready' as const,
        error: null,
      }),
      deliver: async (input: EventInput) => {
        if (input.systemEvent) return { state: 'admitted' as const };
        calls.push(input);
        if (!wakeOnly && !noBody) input.beforeRelease?.(agentMessageText(input));
        return result(input);
      },
    });
    return calls;
  };
  const add = async (
    result: (input: EventInput) => Promise<Admission>,
    wakeOnly = false,
    noBody = false,
  ) => {
    const id = randomUUID();
    await service.installAdapter({ id, label: 'Isolated native fixture', kind: 'manual' });
    return { id, calls: mock(id, result, wakeOnly, noBody) };
  };
  const bind = (adapterId: string, chatId: string): Binding => {
    const result = service.connect({ nickname: 'Receiver', client: 'Fixture', adapterId, chatId });
    assert.equal(result.status, 'connected');
    if (result.status !== 'connected') throw new Error('Expected a connected fixture');
    return result.binding;
  };
  const transfer = (adapterId: string): Binding => {
    const args = { nickname: 'Receiver', client: 'Fixture', adapterId, chatId: 'second-chat' };
    const preview = service.connect(args);
    assert.equal(preview.status, 'nickname_in_use');
    if (preview.status !== 'nickname_in_use') throw new Error('Expected transfer approval');
    const result = service.connect({
      ...args,
      connectionId: preview.connectionId,
      transferId: preview.transferId,
      confirmTransfer: true,
    });
    assert.equal(result.status, 'connected');
    if (result.status !== 'connected') throw new Error('Expected approved transfer');
    return result.binding;
  };
  const send = async () => {
    const sender = service.connect({ nickname: 'Sender', client: 'MCP' });
    if (sender.status !== 'connected') throw new Error('Expected fixture sender');
    const message = await service.send({
      connectionId: sender.binding.connectionId,
      recipientNode: service.settings.value.nodeId,
      recipientNickname: 'Receiver',
      text: 'One durable message 漢字',
    });
    await flush();
    return message.id;
  };
  const deferred = () => {
    let resolve!: (result: Admission) => void;
    const promise = new Promise<Admission>((done) => {
      resolve = (result) => {
        pending.delete(resolve);
        done(result);
      };
      pending.add(resolve);
    });
    return { promise, resolve };
  };
  return {
    get service() {
      return service;
    },
    add,
    mock,
    bind,
    transfer,
    send,
    deferred,
    async restart() {
      await service.close();
      service = new NodeService(directory);
      await service.open();
    },
  };
}

test('history-preserving transfer does not replay an uncertain native delivery', async (t) => {
  const f = await fixture(t);
  const old = await f.add(async () => ({ state: 'uncertain', error: 'No admission witness' }));
  const next = await f.add(async () => ({ state: 'admitted' }));
  const before = f.bind(old.id, 'first-chat');
  const id = await f.send();
  assert.equal(f.service.store.dispatchState(id)?.state, 'uncertain');
  const after = f.transfer(next.id);
  assert.notEqual(after.connectionId, before.connectionId);
  f.service.adapters.emit('idle');
  await flush();
  assert.equal(next.calls.length, 0);
  assert.deepEqual(f.service.store.dispatchState(id), {
    connectionId: before.connectionId,
    state: 'uncertain',
  });
  assert.equal(f.service.store.get(id, 'in')?.state, 'ready');
});

for (const outcome of ['uncertain', 'admitted', 'revoked'] as const) {
  test(`in-flight transfer and late old ${outcome} completion preserve the original fence`, async (t) => {
    const f = await fixture(t);
    const delayed = f.deferred();
    const old = await f.add(() => delayed.promise);
    const next = await f.add(async () => ({ state: 'admitted' }));
    const before = f.bind(old.id, 'first-chat');
    const id = await f.send();
    assert.equal(old.calls.length, 1);
    assert.equal(f.service.store.dispatchState(id)?.state, 'dispatching');
    f.transfer(next.id);
    f.service.adapters.emit('idle');
    await flush();
    const beforeCompletion = next.calls.length;
    delayed.resolve({ state: outcome });
    await flush();
    assert.equal(beforeCompletion, 0, 'The replacement must not release a second body');
    assert.equal(next.calls.length, 0, 'The old completion must not permit a replay');
    assert.deepEqual(f.service.store.dispatchState(id), {
      connectionId: before.connectionId,
      state: 'uncertain',
    });
    assert.equal(f.service.store.get(id, 'in')?.state, 'ready');
  });
}

test('uncertainty survives transfer and node restart without a second release', async (t) => {
  const f = await fixture(t);
  const old = await f.add(async () => ({ state: 'uncertain' }));
  const next = await f.add(async () => ({ state: 'waiting' }));
  const before = f.bind(old.id, 'first-chat');
  const id = await f.send();
  f.transfer(next.id);
  await flush();
  await f.restart();
  const calls = f.mock(next.id, async () => ({ state: 'admitted' }));
  f.service.adapters.emit('idle');
  await flush();
  assert.equal(calls.length, 0);
  assert.deepEqual(f.service.store.dispatchState(id), {
    connectionId: before.connectionId,
    state: 'uncertain',
  });
});

for (const outcome of ['waiting', 'failed'] as const) {
  test(`a definite ${outcome} outcome permits the approved new owner to receive`, async (t) => {
    const f = await fixture(t);
    const old = await f.add(async () => ({ state: outcome }), false, true);
    const next = await f.add(async () => ({ state: 'admitted' }));
    f.bind(old.id, 'first-chat');
    const id = await f.send();
    const after = f.transfer(next.id);
    await flush();
    assert.equal(next.calls.length, 1);
    assert.equal(next.calls[0].messageId, id);
    assert.equal(f.service.store.get(id, 'in')?.state, 'processed');
    assert.deepEqual(f.service.store.dispatchState(id), {
      connectionId: after.connectionId,
      state: 'admitted',
    });
  });
}

test('an in-flight definite failure releases the transferred backlog without another idle edge', async (t) => {
  const f = await fixture(t);
  const delayed = f.deferred();
  const old = await f.add(() => delayed.promise, false, true);
  const next = await f.add(async () => ({ state: 'admitted' }));
  f.bind(old.id, 'first-chat');
  const id = await f.send();
  f.transfer(next.id);
  await flush();
  const beforeCompletion = next.calls.length;
  delayed.resolve({ state: 'failed', error: 'Nothing was released' });
  await flush();
  assert.equal(beforeCompletion, 0);
  assert.equal(next.calls.length, 1);
  assert.equal(next.calls[0].messageId, id);
  assert.equal(f.service.store.get(id, 'in')?.state, 'processed');
});

test('a wake-only offer can move to the new binding because it released no body', async (t) => {
  const f = await fixture(t);
  const old = await f.add(async () => ({ state: 'offered' }), true);
  const next = await f.add(async () => ({ state: 'admitted' }));
  f.bind(old.id, 'first-chat');
  const id = await f.send();
  assert.equal(f.service.store.dispatchState(id)?.state, 'offered');
  f.transfer(next.id);
  await flush();
  assert.equal(next.calls.length, 1);
  assert.equal(f.service.store.get(id, 'in')?.state, 'processed');
});

test('ordinary current-owner delivery still releases and receipts the message once', async (t) => {
  const f = await fixture(t);
  const receiver = await f.add(async () => ({ state: 'admitted' }));
  f.bind(receiver.id, 'first-chat');
  const id = await f.send();
  f.service.adapters.emit('idle');
  await flush();
  assert.equal(receiver.calls.length, 1);
  assert.equal(receiver.calls[0].messageId, id);
  assert.equal(f.service.store.get(id, 'in')?.state, 'processed');
});

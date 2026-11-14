import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentStore } from '../desktop/core/agent-store.js';
import type { Envelope } from '../desktop/shared/contracts.js';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');

async function fixture(t: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-native-store-'));
  let store = new AgentStore(directory);
  t.after(async () => {
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  const node = randomUUID();
  const connected = store.connect({
    nickname: 'Клод Linux 漢字',
    client: 'Claude Code',
    adapterId: randomUUID(),
    chatId: randomUUID(),
  });
  assert.equal(connected.status, 'connected');
  if (connected.status !== 'connected') throw new Error('fixture');
  const connectionId = connected.binding.connectionId;
  const helperId = randomUUID();
  const message = (): Envelope => {
    const envelope: Envelope = {
      protocol: 2,
      id: randomUUID().toUpperCase(),
      fromNode: node,
      toNode: node,
      fromNickname: 'Отправитель 漢字',
      toNickname: connected.nickname,
      createdAt: new Date().toISOString(),
      text: 'Точный текст\n漢字',
      replyTo: null,
      attachments: [],
    };
    store.insertLocal(envelope, true);
    return envelope;
  };
  const reserve = (envelope: Envelope, native = true) =>
    store.reserveClaudeDelivery({
      connectionId,
      ids: [envelope.id],
      helperId,
      scope: native
        ? { transport: 'native-prompt-v1', reportKeyHash: hash('private fixture key') }
        : {},
    });
  return {
    get store() {
      return store;
    },
    connectionId,
    message,
    reserve,
    restart() {
      store.close();
      store = new AgentStore(directory);
    },
  };
}

test('native content is sealed before issue and only its matching final row commits node-owned IDs', async (t) => {
  const f = await fixture(t);
  const message = f.message();
  const id = f.reserve(message);
  assert.throws(() => f.store.issueClaudeDelivery(id), /not been sealed/);
  assert.equal(f.store.claudeDelivery(id)?.state, 'reserved');
  f.store.sealClaudeNativeDelivery(id, hash('body'), [hash('row')]);
  f.store.sealClaudeNativeDelivery(id, hash('body'), [hash('row')]);
  assert.throws(
    () => f.store.sealClaudeNativeDelivery(id, hash('changed'), [hash('row')]),
    /already sealed/,
  );
  f.store.issueClaudeDelivery(id);
  assert.throws(() => f.store.commitClaudeDelivery(id), /does not match/);
  assert.throws(
    () =>
      f.store.commitClaudeDelivery(id, {
        storedRowId: randomUUID(),
        representationHash: hash('foreign'),
      }),
    /does not match/,
  );
  assert.equal(f.store.get(message.id, 'in')?.state, 'ready');
  assert.equal(f.store.claudeFenced(message.id), true);
  const witness = { storedRowId: randomUUID().toUpperCase(), representationHash: hash('row') };
  assert.deepEqual(f.store.commitClaudeDelivery(id, witness), [message.id]);
  assert.equal(f.store.get(message.id, 'in')?.envelope.text, message.text);
  assert.equal(f.store.get(message.id, 'in')?.envelope.id, message.id);
  assert.equal(f.store.get(message.id, 'out')?.state, 'processed');
  assert.deepEqual(f.store.commitClaudeDelivery(id, witness), []);
  f.store.sealClaudeNativeDelivery(id, hash('body'), [hash('row')]);
  assert.throws(
    () => f.store.commitClaudeDelivery(id, { ...witness, storedRowId: randomUUID() }),
    /another row/,
  );
  assert.equal(
    (f.store.claudeDelivery(id)?.scope.nativePrompt as { storedRowId: string }).storedRowId,
    witness.storedRowId,
  );
});

test('a stored native row cannot be reused for another delivery or spend its reserved IDs', async (t) => {
  const f = await fixture(t);
  const a = f.message(),
    b = f.message();
  const first = f.reserve(a),
    second = f.reserve(b);
  for (const id of [first, second]) {
    f.store.sealClaudeNativeDelivery(id, hash('distinct canonical text ' + id), [
      hash('same representation'),
    ]);
    f.store.issueClaudeDelivery(id);
  }
  const witness = { storedRowId: randomUUID(), representationHash: hash('same representation') };
  f.store.commitClaudeDelivery(first, witness);
  assert.throws(
    () =>
      f.store.commitClaudeDelivery(second, {
        ...witness,
        storedRowId: witness.storedRowId.toUpperCase(),
      }),
    /another delivery/,
  );
  assert.throws(() => f.store.commitClaudeDelivery(second, witness), /another delivery/);
  assert.equal(f.store.get(b.id, 'in')?.state, 'ready');
  assert.equal(f.store.claudeDelivery(second)?.state, 'issued');
  assert.equal(f.store.claudeFenced(b.id), true);
  assert.deepEqual(
    f.store.commitClaudeDelivery(second, { ...witness, storedRowId: randomUUID() }),
    [b.id],
  );
});

test('one admitted native envelope never names a second attempt, including after uncertainty', async (t) => {
  const f = await fixture(t);
  const a = f.message(),
    b = f.message();
  const first = f.reserve(a),
    second = f.reserve(b);
  for (const id of [first, second])
    f.store.sealClaudeNativeDelivery(id, hash('one canonical envelope'), [hash('row')]);
  f.store.issueClaudeDelivery(first);
  assert.throws(() => f.store.cancelClaudeDelivery(first, 'unproved drop'), /cannot be cancelled/);
  assert.throws(() => f.store.issueClaudeDelivery(second), /UNIQUE constraint/);
  f.store.uncertainClaudeDelivery(first, 'isolated fixture');
  assert.throws(() => f.store.issueClaudeDelivery(second), /UNIQUE constraint/);
  assert.equal(f.store.claudeDelivery(second)?.state, 'reserved');
  assert.equal(f.store.get(b.id, 'in')?.state, 'ready');
});

test('native row metadata cannot substitute for an existing MCP-frame receipt', async (t) => {
  const f = await fixture(t);
  const message = f.message();
  const id = f.reserve(message, false);
  f.store.issueClaudeDelivery(id);
  assert.throws(
    () =>
      f.store.commitClaudeDelivery(id, {
        storedRowId: randomUUID(),
        representationHash: hash('row'),
      }),
    /cannot commit an MCP/,
  );
  assert.equal(f.store.get(message.id, 'in')?.state, 'ready');
  assert.deepEqual(f.store.commitClaudeDelivery(id), [message.id]);
});

test('restart retains native issued uncertainty and releases only never-issued reservations', async (t) => {
  const f = await fixture(t);
  const issuedMessage = f.message(),
    reservedMessage = f.message();
  const issued = f.reserve(issuedMessage),
    reserved = f.reserve(reservedMessage);
  f.store.sealClaudeNativeDelivery(issued, hash('body'), [hash('row')]);
  f.store.issueClaudeDelivery(issued);
  f.restart();
  assert.equal(f.store.claudeDelivery(issued)?.state, 'uncertain');
  assert.equal(f.store.claudeDelivery(reserved)?.state, 'cancelled');
  assert.equal(f.store.claudeFenced(issuedMessage.id), true);
  assert.equal(f.store.claudeFenced(reservedMessage.id), false);
  assert.deepEqual(
    f.store.commitClaudeDelivery(issued, {
      storedRowId: randomUUID(),
      representationHash: hash('row'),
    }),
    [],
  );
  assert.equal(f.store.get(issuedMessage.id, 'in')?.state, 'ready');
});

test('a native stored-row witness cannot commit after its binding transfers', async (t) => {
  const f = await fixture(t);
  const message = f.message();
  const id = f.reserve(message);
  f.store.sealClaudeNativeDelivery(id, hash('body'), [hash('row')]);
  f.store.issueClaudeDelivery(id);
  const request = {
    nickname: message.toNickname,
    client: 'Other client',
    chatId: randomUUID(),
    adapterId: randomUUID(),
  };
  const offer = f.store.connect(request);
  assert.equal(offer.status, 'nickname_in_use');
  if (offer.status !== 'nickname_in_use') throw new Error('fixture');
  const moved = f.store.connect({
    ...request,
    connectionId: offer.connectionId,
    transferId: offer.transferId,
    confirmTransfer: true,
  });
  assert.equal(moved.status, 'connected');
  assert.throws(
    () =>
      f.store.commitClaudeDelivery(id, {
        storedRowId: randomUUID(),
        representationHash: hash('row'),
      }),
    /connection|binding/i,
  );
  assert.equal(f.store.get(message.id, 'in')?.state, 'ready');
  assert.equal(f.store.claudeFenced(message.id), true);
});

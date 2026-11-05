import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { nicknameKey, type Envelope } from '../desktop/shared/contracts.js';
import { until } from './aionui-fixture.js';
import { claudeFixture, FakeHelper } from './claude-code-fixture.js';

async function fixture(t: TestContext) {
  const f = await claudeFixture(t);
  const session = randomUUID();
  const nickname = 'Dispatch window 漢字';
  const senderName = 'Window sender';
  await f.hook('SessionStart', session, { source: 'startup' });
  const helper = new FakeHelper(f, session);
  await helper.attach();
  t.after(() => helper.detach());
  const recipient = await f.connect(helper, session, nickname);
  assert.equal(recipient.status, 'connected');
  const connectionId = String(recipient.binding.connectionId);
  const sender = f.service.connect({ nickname: senderName, client: 'MCP' });
  assert.ok(sender.status === 'connected');
  const envelope = (text: string, toNickname = nickname): Envelope => ({
    protocol: 2,
    id: randomUUID(),
    fromNode: f.service.settings.value.nodeId,
    toNode: f.service.settings.value.nodeId,
    fromNickname: senderName,
    toNickname,
    createdAt: new Date().toISOString(),
    text,
    replyTo: null,
    attachments: [],
  });
  const seed = (count: number) =>
    Array.from({ length: count }, (_, index) => {
      const message = envelope('Queued ' + (index + 1));
      f.service.store.insertLocal(message, true);
      return message.id;
    });
  const send = () =>
    f.service.send({
      connectionId: sender.binding.connectionId,
      recipientNode: f.service.settings.value.nodeId,
      recipientNickname: nickname,
      text: 'Later arrival',
    });
  const offered = (ids: string[]) =>
    until(() => ids.every((id) => f.service.store.dispatchState(id)?.state === 'offered'));
  const unread = (ids: string[]) => {
    for (const id of ids) {
      assert.equal(f.service.store.get(id, 'in')?.state, 'ready');
      assert.equal(f.service.store.get(id, 'out')?.state, 'ready');
    }
  };
  return { f, helper, connectionId, nickname, seed, envelope, send, offered, unread };
}

test('Two hundred current unread offers do not hide the next arrival without read, Stop or reconnect', async (t) => {
  const x = await fixture(t);
  const ids = x.seed(200);
  x.f.service.adapters.emit('idle');
  await x.offered(ids);
  await until(() => x.helper.wakes().length === 1);
  x.unread(ids);

  const later = await x.send();
  await x.offered([later.id]);
  await until(() => x.helper.wakes().length === 2);
  assert.deepEqual(x.helper.wakes(), [x.nickname, x.nickname]);
  x.unread([...ids, later.id]);
});

test('An offline backlog beyond one page has one wake, with its full physical sequence covered', async (t) => {
  const x = await fixture(t);
  await x.helper.detach();
  // Pending messages have no timeline cursor yet, so the two sequence domains differ.
  for (let index = 0; index < 5; index++)
    x.f.service.store.insert(x.envelope('Pending unrelated ' + index, 'Another mailbox'), 'in');
  const ids = x.seed(205);
  const lastSequence = x.f.service.store.get(ids.at(-1)!, 'in')!.sequence;
  const history = x.f.service.store.history(nicknameKey(x.nickname), 0, 205, true);
  assert.notEqual(lastSequence, history.nextCursor);
  await x.helper.attach();
  await x.offered(ids);
  await until(() => x.helper.wakes().length === 1);
  const routed = x.f.service.claude.route(x.helper.session!).helper;
  assert.ok(routed);
  assert.equal(routed.outstanding.get(x.connectionId), lastSequence);
  x.unread(ids);

  const later = await x.send();
  await x.offered([later.id]);
  await until(() => x.helper.wakes().length === 2);
  assert.deepEqual(x.helper.wakes(), [x.nickname, x.nickname]);
  x.unread([...ids, later.id]);
});

test('A full page of uncertain rows stays unchanged while the later eligible message is offered', async (t) => {
  const x = await fixture(t);
  const uncertain = x.seed(200);
  for (const id of uncertain)
    x.f.service.store.dispatch(id, x.connectionId, 'uncertain', 'Unconfirmed content admission');
  const later = await x.send();
  await x.offered([later.id]);
  await until(() => x.helper.wakes().length === 1);
  for (const id of uncertain) {
    assert.deepEqual(x.f.service.store.dispatchState(id), {
      connectionId: x.connectionId,
      state: 'uncertain',
    });
    assert.equal(
      x.f.service.store.db.prepare('SELECT error FROM dispatches WHERE message_id=?').get(id)
        ?.error,
      'Unconfirmed content admission',
    );
  }
  assert.deepEqual(x.helper.wakes(), [x.nickname]);
  x.unread([...uncertain, later.id]);
});

test('A cold backlog scans bounded pages once, ignores unrelated idle, and rewinds only eligibility on Stop', async (t) => {
  const x = await fixture(t);
  await x.helper.detach();
  const ids = x.seed(401);
  const pages = Math.ceil(ids.length / 200);
  const key = nicknameKey(x.nickname);
  const history = x.f.service.store.history.bind(x.f.service.store);
  let calls = 0;
  let scannedRows = 0;
  x.f.service.store.history = (...args) => {
    const page = history(...args);
    if (args[0] === key && args[3]) {
      assert.equal(args[2], 200);
      calls++;
      scannedRows += page.messages.length;
    }
    return page;
  };
  t.after(() => {
    x.f.service.store.history = history;
  });
  await x.helper.attach();
  await until(
    () => ids.every((id) => x.f.service.store.dispatchState(id)?.state === 'offered'),
    15000,
  );
  await until(() => x.helper.wakes().length === 1);
  assert.ok(calls <= 2 * pages, 'Each page is read at most for the census and dispatch sweep');
  assert.ok(scannedRows <= 2 * ids.length, 'Unchanged offers must not repeat full backlog scans');
  const coldCalls = calls;
  const coldRows = scannedRows;
  for (let index = 0; index < 3; index++) x.f.service.adapters.emit('idle');
  assert.equal(calls, coldCalls);
  assert.equal(scannedRows, coldRows);

  await x.f.hook('Stop', x.helper.session!);
  const adapter = x.f.service.adapters.get(
    x.f.service.store.assertOwner(x.connectionId).binding.adapterId,
  );
  await until(() => ids.every((id) => adapter.offerCurrent?.(id) === true), 15000);
  await until(() => x.helper.wakes().length === 2);
  assert.ok(calls - coldCalls <= pages, 'Stop reuses the existing census and reads one sweep');
  assert.ok(scannedRows - coldRows <= ids.length);
  assert.deepEqual(x.helper.wakes(), [x.nickname, x.nickname]);
  x.unread(ids);
  const snapshots = (x.f.service as unknown as { claudeDispatchSnapshots: Map<string, unknown> })
    .claudeDispatchSnapshots;
  assert.ok(snapshots.has(key));
  const callsBeforeDetach = calls;
  await x.helper.detach();
  await until(() => !snapshots.has(key));
  assert.equal(calls, callsBeforeDetach, 'Native cleanup does not scan history');
});

test('A late low-sequence ready row survives an older materializing job without clearing a foreign binding budget', async (t) => {
  const x = await fixture(t);
  const session = x.helper.session!;
  const foreignName = 'Foreign wake budget';
  const foreign = await x.f.connect(x.helper, session, foreignName);
  assert.equal(foreign.status, 'connected');
  const pending = x.envelope('Older received message');
  x.f.service.store.insertLocal(pending, false);
  const physical = x.f.service.store.get(pending.id, 'in')!.sequence;
  const first = x.seed(200);
  const foreignMessage = x.envelope('Foreign binding message', foreignName);
  x.f.service.store.insertLocal(foreignMessage, true);
  x.f.service.adapters.emit('idle');
  await x.offered([...first, foreignMessage.id]);
  await until(() => x.helper.wakes().length === 2);
  const routed = x.f.service.claude.route(session).helper;
  assert.ok(routed);
  const covered = routed.outstanding.get(x.connectionId);
  const foreignCovered = routed.outstanding.get(foreign.binding.connectionId);
  assert.ok(covered !== undefined && physical < covered);
  assert.ok(foreignCovered !== undefined);

  const filename = path.join(x.f.service.settings.value.exportRoots[0], 'blocked-dispatch.txt');
  await writeFile(filename, 'Synthetic delivery materialization');
  const attachment = await x.f.service.files.snapshot(filename);
  const delayed = { ...x.envelope('A newer physical message'), attachments: [attachment] };
  const materialize = x.f.service.files.materialize.bind(x.f.service.files);
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => (release = resolve));
  let entered = false;
  x.f.service.files.materialize = async (...args) => {
    const result = await materialize(...args);
    if (args[0] === delayed.id && !entered) {
      entered = true;
      await blocked;
    }
    return result;
  };
  const ready = (message: Envelope) =>
    (x.f.service as unknown as { messageReady(envelope: Envelope): void }).messageReady(message);
  try {
    x.f.service.store.insertLocal(delayed, true);
    ready(delayed);
    await until(() => entered);
    const cutoff = x.f.service.store.history(
      nicknameKey(x.nickname),
      0,
      first.length + 2,
      true,
    ).nextCursor;
    x.f.service.store.ready(pending.id);
    const changed = x.f.service.store.history(nicknameKey(x.nickname), 0, first.length + 2, true);
    assert.equal(x.f.service.store.get(pending.id, 'in')!.sequence, physical);
    assert.ok(changed.nextCursor > cutoff);
    assert.equal(changed.messages.at(-1)?.envelope.id, pending.id);

    ready({ ...pending, toNickname: foreignName });
    assert.equal(routed.outstanding.get(foreign.binding.connectionId), foreignCovered);
    ready(pending);
    assert.equal(routed.outstanding.get(foreign.binding.connectionId), foreignCovered);
  } finally {
    release();
    x.f.service.files.materialize = materialize;
  }
  await x.offered([delayed.id, pending.id]);
  await until(() => x.helper.wakes().filter((name) => name === x.nickname).length === 3);
  assert.equal(x.helper.wakes().filter((name) => name === foreignName).length, 1);
  assert.equal(routed.outstanding.get(foreign.binding.connectionId), foreignCovered);
  x.unread([...first, delayed.id, pending.id, foreignMessage.id]);
});

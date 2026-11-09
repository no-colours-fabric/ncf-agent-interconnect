import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { ClaudeStdioTransport, claudeCallMetaKey } from '../desktop/integrations/claude-code.js';
import { until } from './aionui-fixture.js';
import { claudeFixture, FakeHelper, type ClaudeFixture } from './claude-code-fixture.js';

interface Page {
  messages: { envelope: { id: string; text?: string }; withheld?: string }[];
  nextCursor: number;
  hasMore: boolean;
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
  return (nickname: string, text: string, files: string[] = []) =>
    f.service.send({
      connectionId: connected.binding.connectionId,
      recipientNode: f.service.settings.value.nodeId,
      recipientNickname: nickname,
      text,
      files,
    });
}

/** One exact Claude Code call through the fixture helper, without the write report. */
async function call(
  f: ClaudeFixture,
  helper: FakeHelper,
  session: string,
  tool: string,
  args: Record<string, unknown>,
) {
  const proof = await f.preTool(session, tool, args);
  const verified = await helper.verify(tool, args, proof);
  assert.equal(verified.status, 200);
  const client = await f.mcp();
  return client.callTool({
    name: tool,
    arguments: args,
    _meta: { [claudeCallMetaKey]: verified.body.callToken },
  });
}

const deliveryOf = (result: { _meta?: Record<string, unknown> }) =>
  String(result._meta?.['ncf/claude-delivery']);
const report = (f: ClaudeFixture, helper: FakeHelper, delivery: string, phase: string) =>
  f.post('/integrations/claude/delivery', {
    helperId: helper.id,
    secret: helper.secret,
    delivery,
    phase,
  });
const state = (f: ClaudeFixture, id: string) => f.service.store.get(id, 'in')?.state;

test('A Claude read records no receipt until the helper reports the complete frame write', async (t) => {
  const f = await claudeFixture(t);
  const { session, helper, connectionId } = await bound(f, 'Боб 漢字');
  const send = sender(f);
  const sent = await send('Боб 漢字', 'Текст 漢字 ✓');
  const result = await call(f, helper, session, 'agent_read', { connectionId });
  const page = result.structuredContent as unknown as Page;
  assert.equal(page.messages[0].envelope.text, 'Текст 漢字 ✓');
  assert.equal(page.messages[0].envelope.id, sent.id);
  assert.equal(state(f, sent.id), 'ready');
  assert.equal(f.service.store.claudeFenced(sent.id), true);
  // The same ID is not repeated while the write is outstanding.
  const again = await call(f, helper, session, 'agent_read', { connectionId });
  assert.equal(again.isError, true);
  assert.match(JSON.stringify(again.content), /in progress or uncertain/);
  const history = await call(f, helper, session, 'agent_history', { connectionId });
  const row = (history.structuredContent as unknown as Page).messages.find(
    (message) => message.envelope.id === sent.id,
  )!;
  assert.ok(row.withheld);
  assert.equal(row.envelope.text, undefined);
  // Commit is idempotent on node-owned IDs.
  assert.deepEqual((await report(f, helper, deliveryOf(result), 'commit')).body, {
    state: 'committed',
  });
  assert.deepEqual((await report(f, helper, deliveryOf(result), 'commit')).body, {
    state: 'committed',
  });
  assert.equal(state(f, sent.id), 'processed');
  assert.equal(f.service.store.get(sent.id, 'out')?.state, 'processed');
  assert.equal(f.service.store.claudeFenced(sent.id), false);
  // The owner UI history keeps the content.
  const owner = f.service.store.chatHistory(
    f.service.store.list().find((agent) => agent.nickname === 'Боб 漢字')!.key,
  );
  assert.ok(owner.messages.some((message) => message.envelope.text === 'Текст 漢字 ✓'));
});

test('Only the issuing helper can report; a cancel before any write releases the IDs', async (t) => {
  const f = await claudeFixture(t);
  const { session, helper, connectionId } = await bound(f, 'Ева');
  const other = await bound(f, 'Лев');
  const sent = await sender(f)('Ева', 'one');
  const result = await call(f, helper, session, 'agent_read', { connectionId });
  const foreign = await report(f, other.helper, deliveryOf(result), 'commit');
  assert.equal(foreign.status, 400);
  assert.equal(state(f, sent.id), 'ready');
  assert.deepEqual((await report(f, helper, deliveryOf(result), 'cancel')).body, {
    state: 'cancelled',
  });
  assert.equal(f.service.store.claudeFenced(sent.id), false);
  // A late commit after a cancel records nothing.
  assert.deepEqual((await report(f, helper, deliveryOf(result), 'commit')).body, {
    state: 'cancelled',
  });
  assert.equal(state(f, sent.id), 'ready');
  // The message is read again normally.
  const again = await call(f, helper, session, 'agent_read', { connectionId });
  assert.equal((again.structuredContent as unknown as Page).messages[0].envelope.id, sent.id);
});

test('A failed or partial write and a helper gone before its report stay uncertain and fenced', async (t) => {
  const f = await claudeFixture(t);
  const { session, helper, connectionId } = await bound(f, 'Мира');
  const send = sender(f);
  const first = await send('Мира', 'partial');
  const partial = await call(f, helper, session, 'agent_read', { connectionId });
  assert.deepEqual((await report(f, helper, deliveryOf(partial), 'uncertain')).body, {
    state: 'uncertain',
  });
  // Neither a cancel nor a commit can rewrite an uncertain outcome.
  await report(f, helper, deliveryOf(partial), 'cancel');
  await report(f, helper, deliveryOf(partial), 'commit');
  assert.equal(state(f, first.id), 'ready');
  assert.equal(f.service.store.claudeFenced(first.id), true);
  assert.match(String(f.service.store.get(first.id, 'in')?.error), /uncertain/);
  const second = await send('Мира', 'helper gone');
  const issued = await call(f, helper, session, 'agent_read', {
    connectionId,
    after: (partial.structuredContent as unknown as Page).nextCursor,
  });
  const ids = (issued.structuredContent as unknown as Page).messages.map((m) => m.envelope.id);
  assert.deepEqual(ids, [second.id]);
  await helper.detach();
  await until(() => f.service.store.claudeDelivery(deliveryOf(issued))?.state === 'uncertain');
  assert.equal(state(f, second.id), 'ready');
  // Unresolved attempts are inspectable per agent and never repeated automatically.
  const key = f.service.store.list().find((agent) => agent.nickname === 'Мира')!.key;
  assert.equal(f.service.store.claudeUncertain().get(key), 2);
  const replacement = new FakeHelper(f, session);
  await replacement.attach();
  const after = await call(f, replacement, session, 'agent_read', { connectionId });
  assert.equal(after.isError, true);
  assert.match(JSON.stringify(after.content), /in progress or uncertain/);
});

test('A restart cancels reserved attempts and keeps issued ones uncertain', async (t) => {
  const f = await claudeFixture(t);
  const { session, helper, connectionId } = await bound(f, 'Ада');
  const send = sender(f);
  const issuedMessage = await send('Ада', 'issued before the crash');
  const issued = await call(f, helper, session, 'agent_read', { connectionId });
  const reservedMessage = await send('Ада', 'reserved before the crash');
  const reserved = f.service.store.reserveClaudeDelivery({
    connectionId,
    ids: [reservedMessage.id],
    helperId: helper.id,
    scope: { fixture: true },
  });
  await f.restart();
  assert.equal(f.service.store.claudeDelivery(deliveryOf(issued))?.state, 'uncertain');
  assert.equal(f.service.store.claudeDelivery(reserved)?.state, 'cancelled');
  assert.equal(state(f, issuedMessage.id), 'ready');
  assert.equal(f.service.store.claudeFenced(issuedMessage.id), true);
  assert.equal(f.service.store.claudeFenced(reservedMessage.id), false);
  // The old helper's commit cannot authenticate against the new node lifecycle.
  const late = await report(f, helper, deliveryOf(issued), 'commit');
  assert.equal(late.status, 400);
  assert.equal(state(f, issuedMessage.id), 'ready');
});

test('Concurrent reads, attachments and dispatch skip IDs reserved during file preparation', async (t) => {
  const f = await claudeFixture(t);
  const { session, helper, connectionId } = await bound(f, 'Файл');
  const filename = path.join(f.service.settings.value.exportRoots[0], 'вложение 漢字.txt');
  await writeFile(filename, 'attachment', 'utf8');
  const sent = await sender(f)('Файл', 'with a file', [filename]);
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => (release = resolve));
  let reached!: () => void;
  const preparing = new Promise<void>((resolve) => (reached = resolve));
  const materialize = f.service.files.materialize.bind(f.service.files);
  f.service.files.materialize = async (...args) => {
    reached();
    await barrier;
    return materialize(...args);
  };
  const pending = call(f, helper, session, 'agent_read', { connectionId });
  await preparing;
  // Reserved before the asynchronous preparation: no other path takes the ID.
  assert.equal(f.service.store.claudeFenced(sent.id), true);
  f.service.files.materialize = materialize;
  await assert.rejects(f.service.read(connectionId, 0, 50, true), /in progress or uncertain/);
  const file = f.service.store.get(sent.id, 'in')!.envelope.attachments[0];
  await assert.rejects(
    f.service.receiveFile(connectionId, sent.id, file.id),
    /in progress or uncertain/,
  );
  assert.throws(
    () => f.service.store.recordDelivery(connectionId, [sent.id]),
    /being delivered to Claude Code/,
  );
  release();
  const result = await pending;
  assert.equal((result.structuredContent as unknown as Page).messages[0].envelope.id, sent.id);
  await report(f, helper, deliveryOf(result), 'commit');
  assert.equal(state(f, sent.id), 'processed');
});

test('A commit after a reset or an approved transfer never revives or misplaces receipt', async (t) => {
  const f = await claudeFixture(t);
  const { session, helper, connectionId } = await bound(f, 'Ресет');
  const send = sender(f);
  const moved = await send('Ресет', 'before the transfer');
  const before = await call(f, helper, session, 'agent_read', { connectionId });
  // Approved transfer after the content was released to this chat.
  const target = {
    nickname: 'Ресет',
    client: 'MCP',
    chatId: randomUUID(),
    adapterId: f.service.settings.value.adapters.find((p) => p.kind === 'manual')!.id,
  };
  const request = f.service.connect(target);
  assert.equal(request.status, 'nickname_in_use');
  if (request.status !== 'nickname_in_use') return;
  const transferred = f.service.connect({
    ...target,
    connectionId: request.connectionId,
    transferId: request.transferId,
    confirmTransfer: true,
  });
  assert.equal(transferred.status, 'connected');
  if (transferred.status !== 'connected') return;
  // No writer ordering has been proven across the transfer: do not invent receipt.
  await assert.rejects(
    f.service.read(transferred.binding.connectionId, 0, 50, true),
    /in progress or uncertain/,
  );
  assert.equal((await report(f, helper, deliveryOf(before), 'commit')).status, 400);
  assert.equal(state(f, moved.id), 'ready');
  assert.equal(f.service.store.claudeDelivery(deliveryOf(before))?.state, 'uncertain');

  // A reset (fresh agent, history deleted) after release: the old commit is void.
  const second = await bound(f, 'Сброс');
  const kept = await send('Сброс', 'before the reset');
  const issued = await call(f, second.helper, second.session, 'agent_read', {
    connectionId: second.connectionId,
  });
  const reset = {
    nickname: 'Сброс',
    client: 'MCP',
    chatId: randomUUID(),
    adapterId: f.service.settings.value.adapters.find((p) => p.kind === 'manual')!.id,
  };
  const choice = f.service.connect(reset);
  assert.equal(choice.status, 'nickname_in_use');
  if (choice.status !== 'nickname_in_use') return;
  const resetChoice = choice.choices.find((option) => option.mode === 'reset');
  assert.ok(resetChoice);
  const fresh = f.service.connect({
    ...reset,
    connectionId: choice.connectionId,
    transferId: resetChoice.transferId,
    confirmTransfer: true,
    resetHistory: true,
  });
  assert.equal(fresh.status, 'connected');
  await report(f, second.helper, deliveryOf(issued), 'commit');
  // The reset mailbox has a new incarnation: the old commit records nothing in it.
  assert.notEqual(f.service.store.get(kept.id, 'in')?.state, 'processed');
});

test('The stdio transport resolves only after the complete frame write and rejects a failed write', async () => {
  const written: string[] = [];
  const ok = new Writable({
    write(chunk, _encoding, callback) {
      written.push(chunk.toString());
      callback();
    },
  });
  const transport = new ClaudeStdioTransport(new PassThrough(), ok);
  await transport.send({ jsonrpc: '2.0', id: 7, result: { content: [] } });
  assert.equal(written.length, 1);
  assert.ok(written[0].endsWith('\n'));
  const broken = new Writable({
    write(_chunk, _encoding, callback) {
      callback(new Error('EPIPE'));
    },
  });
  broken.on('error', () => {});
  const failing = new ClaudeStdioTransport(new PassThrough(), broken);
  await assert.rejects(failing.send({ jsonrpc: '2.0', id: 8, result: { content: [] } }), /EPIPE/);
});

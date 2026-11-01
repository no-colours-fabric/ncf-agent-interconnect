import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { NodeService } from '../desktop/core/service.js';
import { agentMessageText } from '../desktop/core/adapters.js';
import { nicknameKey, type Envelope, type Message } from '../desktop/shared/contracts.js';

async function fixture(t: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'compact-replies-'));
  const f = {
    service: new NodeService(directory),
    async restart() {
      await f.service.close();
      f.service = new NodeService(directory);
      await f.service.open();
    },
  };
  await f.service.open();
  t.after(async () => {
    await f.service.close();
    await rm(directory, { recursive: true, force: true });
  });
  const owner = f.service.connect({ nickname: 'Бил 漢字', client: 'MCP' });
  if (owner.status !== 'connected') throw new Error();
  return { f, owner };
}
function incoming(service: NodeService, nickname: string, changes: Partial<Envelope> = {}) {
  const envelope: Envelope = {
    protocol: 2,
    id: randomUUID(),
    fromNode: service.settings.value.nodeId,
    toNode: service.settings.value.nodeId,
    fromNickname: 'БоБ 東京',
    toNickname: nickname,
    createdAt: new Date().toISOString(),
    text: "Literal $& $$ $` $' {size}\nМосква 東京",
    replyTo: null,
    attachments: [],
    ...changes,
  };
  service.store.insert(envelope, 'in');
  return service.store.get(envelope.id, 'in')!;
}
const reference = (row: Message) => 'r' + row.sequence.toString(36);

async function client(t: test.TestContext, service: NodeService) {
  const c = new Client({ name: 'compact-reply-test', version: '1' });
  await c.connect(
    new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
      requestInit: { headers: { authorization: 'Bearer ' + service.settings.value.localToken } },
    }),
  );
  t.after(() => c.close());
  return c;
}

test('compact template preserves literal content and attachments without routing UUIDs', async (t) => {
  const { f, owner } = await fixture(t);
  const row = incoming(f.service, owner.nickname);
  const text = agentMessageText({
    nickname: owner.nickname,
    binding: owner.binding,
    messageId: row.envelope.id,
    replyRef: reference(row),
    message: {
      fromNode: row.envelope.fromNode,
      fromNickname: row.envelope.fromNickname,
      text: row.envelope.text,
      files: [
        {
          id: 'a'.repeat(64),
          name: 'данные$&-{size}-漢字.txt',
          size: 3,
          localPath: '/tmp/данные$&-{size}-漢字.txt',
        },
      ],
    },
  });
  assert.ok(text.includes(row.envelope.text));
  assert.ok(text.includes('данные$&-\\{size\\}-漢字.txt'));
  assert.ok(text.includes('/tmp/данные$&-{size}-漢字.txt'));
  assert.ok(text.includes('From: "БоБ 東京"'));
  assert.ok(text.includes(`Reply-To: ${reference(row)}`));
  assert.ok(!text.includes('From-Node:'));
  assert.ok(!text.includes('Message-ID:'));
  assert.ok(!text.includes(row.envelope.id));
  assert.ok(!text.includes(row.envelope.fromNode));
  const bodyWithId = agentMessageText({
    nickname: owner.nickname,
    binding: owner.binding,
    messageId: row.envelope.id,
    replyRef: reference(row),
    message: {
      fromNode: row.envelope.fromNode,
      fromNickname: row.envelope.id,
      text: row.envelope.id,
      files: [],
    },
  });
  assert.ok(bodyWithId.includes(row.envelope.id));
  const notice = agentMessageText({
    nickname: owner.nickname,
    binding: owner.binding,
    messageId: 'system:1',
    systemEvent: {
      id: 1,
      connectionId: owner.binding.connectionId,
      binding: owner.binding,
      type: 'agent_moved',
      nickname: owner.nickname,
      text: 'Moved',
      createdAt: new Date().toISOString(),
    },
  });
  assert.ok(!notice.includes('Reply-To'));
});

test('raw sequence differs from timeline; references survive receipt and restart with uppercase legacy IDs', async (t) => {
  const { f, owner } = await fixture(t);
  const row = incoming(f.service, owner.nickname, { id: randomUUID().toUpperCase() });
  const self = await f.service.send({
    connectionId: owner.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: owner.nickname,
    text: 'Other',
  });
  const selfAddress = f.service.resolveReplyAddress(owner.binding.connectionId, {
    replyRef: reference(f.service.store.get(self.id, 'in')!),
  });
  assert.deepEqual(selfAddress, {
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: owner.nickname,
    replyTo: self.id,
  });
  f.service.store.ready(row.envelope.id);
  const timeline = f.service.store
    .history(nicknameKey(owner.nickname))
    .messages.find((m) => m.envelope.id === row.envelope.id)!;
  assert.notEqual(timeline.sequence, row.sequence);
  const ref = reference(row);
  const address = f.service.resolveReplyAddress(owner.binding.connectionId, { replyRef: ref });
  assert.equal(f.service.store.get(row.envelope.id, 'in')!.state, 'ready');
  assert.deepEqual(address, {
    recipientNode: row.envelope.fromNode,
    recipientNickname: 'БоБ 東京',
    replyTo: row.envelope.id,
  });
  const read = (await f.service.read(owner.binding.connectionId)) as {
    messages: (Message & { replyRef?: string })[];
  };
  assert.equal(read.messages.find((m) => m.envelope.id === row.envelope.id)!.replyRef, ref);
  assert.ok(read.messages.filter((m) => m.direction === 'out').every((m) => !m.replyRef));
  assert.equal(f.service.store.get(row.envelope.id, 'in')!.state, 'processed');
  await f.restart();
  assert.deepEqual(
    f.service.resolveReplyAddress(owner.binding.connectionId, { replyRef: ref }),
    address,
  );
  const sent = await f.service.send({
    connectionId: owner.binding.connectionId,
    ...address,
    text: 'Reply',
  });
  assert.equal(f.service.store.get(sent.id, 'out')!.envelope.replyTo, row.envelope.id);
});

test('MCP rejects mixed, incomplete, foreign, outgoing and noncanonical refs before file snapshots', async (t) => {
  const { f, owner } = await fixture(t);
  const row = incoming(f.service, owner.nickname);
  const other = incoming(f.service, 'Foreign');
  const outgoing = {
    ...row.envelope,
    id: randomUUID(),
    fromNickname: owner.nickname,
    toNickname: 'Other',
  };
  f.service.store.insert(outgoing, 'out');
  const c = await client(t, f.service);
  let snapshots = 0;
  f.service.files.snapshot = async () => {
    snapshots++;
    throw new Error('Unexpected snapshot');
  };
  const before = f.service.store.history(nicknameKey(owner.nickname));
  const invalid = [
    '',
    'r0',
    'r01',
    'rA',
    'r-1',
    'r1x!',
    'r1 ',
    'r1\n',
    'rzzzzzzzzzzz',
    'r' + '1'.repeat(10000),
    reference(other),
    reference(f.service.store.get(outgoing.id, 'out')!),
  ];
  for (const replyRef of invalid) {
    const result = await c.callTool({
      name: 'agent_send',
      arguments: {
        connectionId: owner.binding.connectionId,
        replyRef,
        text: 'Invalid',
        files: ['/missing'],
      },
    });
    assert.equal(result.isError, true, replyRef);
  }
  for (const mixed of [
    { recipientNode: row.envelope.fromNode },
    { recipientNickname: 'БоБ 東京' },
    { replyTo: null },
    { replyTo: row.envelope.id },
  ]) {
    const result = await c.callTool({
      name: 'agent_send',
      arguments: {
        connectionId: owner.binding.connectionId,
        replyRef: reference(row),
        ...mixed,
        text: 'Invalid',
        files: ['/missing'],
      },
    });
    assert.equal(result.isError, true);
  }
  for (const address of [
    {},
    { recipientNickname: 'БоБ 東京' },
    { recipientNode: row.envelope.fromNode },
  ]) {
    const result = await c.callTool({
      name: 'agent_send',
      arguments: {
        connectionId: owner.binding.connectionId,
        ...address,
        text: 'Invalid',
        files: ['/missing'],
      },
    });
    assert.equal(result.isError, true);
  }
  assert.equal(snapshots, 0);
  assert.deepEqual(f.service.store.history(nicknameKey(owner.nickname)), before);
  for (const address of [
    { replyRef: reference(row) },
    {
      recipientNode: row.envelope.fromNode,
      recipientNickname: row.envelope.fromNickname,
      replyTo: row.envelope.id,
    },
  ]) {
    const result = await c.callTool({
      name: 'agent_send',
      arguments: {
        connectionId: owner.binding.connectionId,
        ...address,
        text: 'Compatible reply',
      },
    });
    assert.ok(!result.isError, JSON.stringify(result));
  }
});

test('transfer revokes old binding and permits the approved owner of the same mailbox', async (t) => {
  const { f, owner } = await fixture(t);
  const row = incoming(f.service, owner.nickname);
  const conflict = f.service.connect({ nickname: owner.nickname, client: 'Other' });
  if (conflict.status !== 'nickname_in_use') throw new Error();
  const moved = f.service.connect({
    nickname: owner.nickname,
    client: 'Other',
    chatId: conflict.requestingChat.chatId,
    adapterId: conflict.requestingChat.adapterId,
    connectionId: conflict.connectionId,
    transferId: conflict.transferId,
    confirmTransfer: true,
  });
  if (moved.status !== 'connected') throw new Error();
  assert.throws(
    () => f.service.resolveReplyAddress(owner.binding.connectionId, { replyRef: 'invalid' }),
    /agent_moved/,
  );
  const address = f.service.resolveReplyAddress(moved.binding.connectionId, {
    replyRef: reference(row),
  });
  assert.equal(address.replyTo, row.envelope.id);
  f.service.files.snapshot = async () => {
    f.service.store.disconnect(moved.binding.connectionId);
    return { id: 'a'.repeat(64), name: 'a.txt', size: 1 };
  };
  await assert.rejects(
    f.service.send({
      connectionId: moved.binding.connectionId,
      ...address,
      text: 'Revoked while snapshotting',
      files: ['/fake'],
    }),
    /Connection not found/,
  );
  assert.equal(f.service.store.history(nicknameKey(owner.nickname)).messages.length, 0);
});

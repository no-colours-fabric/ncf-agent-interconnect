import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { NodeService } from '../desktop/core/service.js';
import { AgentStore, type ConnectResult } from '../desktop/core/agent-store.js';
import { nicknameKey, type Envelope, type Message } from '../desktop/shared/contracts.js';

async function fixture(t: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-local-')),
    service = new NodeService(directory);
  await service.open();
  t.after(async () => {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  return service;
}
async function client(t: test.TestContext, service: NodeService) {
  const c = new Client({ name: 'local-chat', version: '1' });
  await c.connect(
    new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
      requestInit: { headers: { Authorization: 'Bearer ' + service.settings.value.localToken } },
    }),
  );
  t.after(() => c.close());
  return c;
}
const page = (value: unknown) =>
  value as { messages: Message[]; nextCursor: number; hasMore: boolean };

test('two MCP chats exchange local text/files and automatic delivery receipts without any configured peer or network dispatch', async (t) => {
  const service = await fixture(t),
    a = await client(t, service),
    b = await client(t, service);
  const first = (await a.callTool({ name: 'agent_connect', arguments: { nickname: 'Автор' } }))
    .structuredContent as unknown as ConnectResult;
  const second = (
    await b.callTool({ name: 'agent_connect', arguments: { nickname: 'Проверяющий' } })
  ).structuredContent as unknown as ConnectResult;
  if (first.status !== 'connected' || second.status !== 'connected') throw new Error();
  const peers = (await a.callTool({ name: 'node_peers', arguments: {} })).structuredContent as {
    localNode: { id: string };
    peers: unknown[];
  };
  assert.deepEqual(peers.peers, []);
  assert.equal(peers.localNode.id, service.settings.value.nodeId);
  let networkCalls = 0;
  service.network.message = async () => {
    networkCalls++;
    throw new Error('No network allowed');
  };
  service.network.receipt = async () => {
    networkCalls++;
    throw new Error('No network allowed');
  };
  service.network.chunk = async () => {
    networkCalls++;
    throw new Error('No network allowed');
  };
  const file = path.join(service.settings.value.exportRoots[0], 'локальное.txt');
  await writeFile(file, 'Локальное вложение\n');
  const args = {
    connectionId: first.binding.connectionId,
    recipientNickname: 'ПРОВЕРЯЮЩИЙ',
    text: 'Первое локальное сообщение',
    id: randomUUID(),
    files: [file],
  };
  const sent = await a.callTool({ name: 'agent_send', arguments: args });
  assert.ok(!sent.isError, JSON.stringify(sent.content));
  assert.equal((sent.structuredContent as { sent: boolean }).sent, true);
  assert.ok(!(await a.callTool({ name: 'agent_send', arguments: args })).isError);
  assert.equal(service.store.history(nicknameKey('Автор')).messages.length, 1);
  assert.equal(service.store.history(nicknameKey('Проверяющий')).messages.length, 1);
  const incomingResult = await b.callTool({
    name: 'agent_read',
    arguments: { connectionId: second.binding.connectionId },
  });
  const incoming = page(incomingResult.structuredContent).messages as (Message & {
    files: { localPath: string }[];
  })[];
  assert.equal(incoming.length, 1);
  assert.equal(incoming[0].direction, 'in');
  assert.equal(incoming[0].envelope.id, args.id);
  assert.equal(await readFile(incoming[0].files[0].localPath, 'utf8'), 'Локальное вложение\n');
  const received = await a.callTool({
    name: 'attachment_receive',
    arguments: {
      connectionId: first.binding.connectionId,
      messageId: args.id,
      fileId: incoming[0].envelope.attachments[0].id,
    },
  });
  assert.ok(!received.isError);
  assert.ok(!(await b.listTools()).tools.some((tool) => tool.name === 'message_ack'));
  assert.equal(
    page(
      (
        await b.callTool({
          name: 'agent_read',
          arguments: { connectionId: second.binding.connectionId },
        })
      ).structuredContent,
    ).messages.length,
    0,
  );
  assert.equal(service.store.get(args.id, 'in')?.state, 'processed');
  assert.equal(service.store.get(args.id, 'out')?.state, 'processed');
  const reply = await b.callTool({
    name: 'agent_send',
    arguments: {
      connectionId: second.binding.connectionId,
      recipientNode: service.settings.value.nodeId,
      recipientNickname: 'АВТОР',
      text: 'Ответ на том же узле',
      replyTo: args.id,
    },
  });
  assert.ok(!reply.isError);
  const senderHistory = page(
    (
      await a.callTool({
        name: 'agent_history',
        arguments: { connectionId: first.binding.connectionId },
      })
    ).structuredContent,
  );
  assert.deepEqual(
    senderHistory.messages.map((m) => m.direction),
    ['out', 'in'],
  );
  assert.equal(senderHistory.messages[1].envelope.replyTo, args.id);
  const changed = await a.callTool({
    name: 'agent_send',
    arguments: { ...args, text: 'Другое содержимое того же ID' },
  });
  assert.equal(changed.isError, true);
  assert.equal(networkCalls, 0);
  assert.deepEqual(service.snapshot().peers, []);
});

test('queued local delivery and both histories survive a full restart, even before the recipient chat connects', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-local-restart-'));
  let service = new NodeService(directory);
  await service.open();
  t.after(async () => {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  const sender = service.connect({ nickname: 'Первый', client: 'A' });
  if (sender.status !== 'connected') throw new Error();
  const file = path.join(service.settings.value.exportRoots[0], 'queued.txt');
  await writeFile(file, 'Снимок до перезапуска');
  await service.stop();
  const sent = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNickname: 'Второй',
    text: 'До подключения получателя',
    files: [file],
  });
  assert.equal(sent.sent, true);
  assert.equal(service.store.get(sent.id, 'out')?.state, 'queued');
  await writeFile(file, 'Изменённый исходник');
  await service.close();
  service = new NodeService(directory);
  await service.open();
  const recipient = service.connect({ nickname: 'ВТОРОЙ', client: 'B' });
  if (recipient.status !== 'connected') throw new Error();
  const deadline = Date.now() + 2000;
  while (service.store.get(sent.id, 'in')?.state !== 'ready') {
    if (Date.now() > deadline) throw new Error('Local recovery timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
  const incoming = page(await service.read(recipient.binding.connectionId)).messages[0];
  assert.equal(incoming.envelope.id, sent.id);
  const attachment = (await service.receiveFile(
    recipient.binding.connectionId,
    sent.id,
    incoming.envelope.attachments[0].id,
  )) as { localPath: string };
  assert.equal(await readFile(attachment.localPath, 'utf8'), 'Снимок до перезапуска');
  assert.equal(service.store.get(sent.id, 'out')!.state, 'processed');
  const self = await service.send({
    connectionId: recipient.binding.connectionId,
    recipientNickname: 'Второй',
    text: 'Себе',
  });
  const selfHistory = page(await service.read(recipient.binding.connectionId));
  assert.deepEqual(
    selfHistory.messages.filter((m) => m.envelope.id === self.id).map((m) => m.direction),
    ['out', 'in'],
  );
  assert.equal(service.store.list().find((c) => c.key === nicknameKey('Второй'))?.unread, 0);
});

test('local message pair is atomic, persists agent bindings/cursors, and never reads or modifies a previous store', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-agent-store-'));
  const previous = path.join(directory, 'conversations.sqlite');
  await writeFile(previous, 'previous test data');
  let store = new AgentStore(directory);
  t.after(async () => {
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  const binding = store.connect({
    nickname: 'Автор',
    client: 'Cursor',
    chatId: randomUUID(),
    adapterId: randomUUID(),
  });
  if (binding.status !== 'connected') throw new Error();
  const node = randomUUID(),
    message: Envelope = {
      protocol: 2,
      id: randomUUID(),
      fromNode: node,
      toNode: node,
      fromNickname: 'Автор',
      toNickname: 'Проверяющий',
      createdAt: new Date().toISOString(),
      text: 'Атомарная локальная доставка',
      replyTo: null,
      attachments: [],
    };
  store.insertLocal(message, true);
  const cursor = store.history(nicknameKey('Автор')).nextCursor;
  assert.throws(
    () => store.insertLocal({ ...message, toNickname: 'Лишний агент' }, true),
    /different content/,
  );
  assert.equal(store.list().length, 2);
  store.close();
  store = new AgentStore(directory);
  assert.equal(store.assertOwner(binding.binding.connectionId).nickname, 'Автор');
  assert.equal(store.history(nicknameKey('Автор')).nextCursor, cursor);
  assert.equal(store.get(message.id, 'in')?.envelope.toNickname, 'Проверяющий');
  assert.equal(store.get(message.id, 'out')?.state, 'ready');
  assert.equal(store.insertLocal(message, true), false);
  assert.equal(store.history(nicknameKey('Проверяющий')).messages.length, 1);
  assert.equal(await readFile(previous, 'utf8'), 'previous test data');
});

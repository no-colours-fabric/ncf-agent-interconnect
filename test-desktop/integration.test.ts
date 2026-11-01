import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { NodeService } from '../desktop/core/service.js';
import { normalizePeerAddress } from '../desktop/core/settings.js';
import type { ConnectResult } from '../desktop/core/agent-store.js';
import type { McpInstructions } from '../desktop/shared/contracts.js';
import { agentMessageText } from '../desktop/core/adapters.js';

async function until(check: () => boolean, timeout = 5000): Promise<void> {
  const end = Date.now() + timeout;
  while (!check()) {
    if (Date.now() > end) throw new Error('Test timed out');
    await new Promise((r) => setTimeout(r, 15));
  }
}
async function node(t: test.TestContext): Promise<NodeService> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect узел ')),
    service = new NodeService(directory);
  await service.open();
  t.after(async () => {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  return service;
}
async function mcp(t: test.TestContext, service: NodeService): Promise<Client> {
  const client = new Client({ name: 'independent-client', version: '1.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
      requestInit: { headers: { Authorization: 'Bearer ' + service.settings.value.localToken } },
    }),
  );
  t.after(() => client.close());
  return client;
}

test('explicit peer address + one code connects two fresh nodes; isolated nicknames and verified files survive transfer', async (t) => {
  const a = await node(t),
    b = await node(t);
  const code = b.network.accessCode();
  await a.network.join(b.snapshot().peerUrl, code.code);
  await until(
    () => a.snapshot().peers[0]?.connected === true && b.snapshot().peers[0]?.connected === true,
  );
  const first = a.connect({ nickname: 'Разработка', client: 'Cursor' }),
    destination = b.connect({ nickname: 'Проверка', client: 'OpenCode' });
  if (first.status !== 'connected' || destination.status !== 'connected') throw new Error();
  const filename = path.join(a.settings.value.exportRoots[0], 'отчёт.txt');
  await writeFile(filename, 'Строка 1\nСтрока 2\n');
  const id = randomUUID();
  await a.send({
    connectionId: first.binding.connectionId,
    recipientNode: b.settings.value.nodeId,
    recipientNickname: 'ПРОВЕРКА',
    text: 'Проверка передачи\nПолный текст',
    files: [filename],
    id,
  });
  await until(() => b.store.get(id)?.state === 'ready');
  const input = b.store.get(id)!;
  assert.equal(input.envelope.fromNickname, 'Разработка');
  const attachment = input.envelope.attachments[0];
  const file = (await b.receiveFile(destination.binding.connectionId, id, attachment.id)) as {
    localPath: string;
  };
  assert.equal(await readFile(file.localPath, 'utf8'), await readFile(filename, 'utf8'));
  assert.equal(path.extname(file.localPath), '.txt');
  await a.send({
    connectionId: first.binding.connectionId,
    recipientNode: b.settings.value.nodeId,
    recipientNickname: 'ПРОВЕРКА',
    text: 'Проверка передачи\nПолный текст',
    files: [filename],
    id,
  });
  assert.equal(b.store.list()[0].messageCount, 1);
  const takeover = b.connect({ nickname: 'проверка', client: 'Другой Codex' });
  if (takeover.status !== 'nickname_in_use') throw new Error();
  const moved = b.connect({
    nickname: 'проверка',
    client: 'Другой Codex',
    chatId: takeover.requestingChat.chatId,
    adapterId: takeover.requestingChat.adapterId,
    connectionId: takeover.connectionId,
    transferId: takeover.transferId,
    confirmTransfer: true,
  });
  if (moved.status !== 'connected') throw new Error();
  assert.throws(() => b.store.assertOwner(destination.binding.connectionId), /agent_moved/);
  await b.read(moved.binding.connectionId, 0, 50, true);
  await until(() => a.store.get(id)?.state === 'processed');
  await b.stop();
  await b.start();
  const history = (await b.read(moved.binding.connectionId)) as { messages: unknown[] };
  assert.equal(history.messages.length, 1);
  assert.equal(b.store.events(destination.binding.connectionId)[0].type, 'agent_moved');
});

test('real Streamable HTTP MCP exposes agent tools and never leaks another active binding capability', async (t) => {
  const service = await node(t),
    firstClient = await mcp(t, service),
    secondClient = await mcp(t, service);
  const instructions = firstClient.getInstructions()!;
  assert.match(instructions, /Incoming NCF Agent Interconnect/);
  assert.match(instructions, /From:/);
  assert.match(instructions, /Reply-To/);
  assert.match(instructions, /Example:.*agent_send/);
  const catalog = await firstClient.listTools();
  assert.equal(catalog.tools.length, 11);
  assert.ok(catalog.tools.some((tool) => tool.name === 'agent_connect'));
  assert.ok(catalog.tools.every((tool) => !tool.name.startsWith('conversation_')));
  const connectSchema = catalog.tools.find((tool) => tool.name === 'agent_connect')!.inputSchema;
  assert.ok(!connectSchema.properties?.client);
  assert.ok(!connectSchema.properties?.chatId);
  assert.ok(!connectSchema.properties?.adapterId);
  assert.ok(!connectSchema.properties?.codexTarget);
  assert.ok(!connectSchema.properties?.agent);
  const connected = await firstClient.callTool({
    name: 'agent_connect',
    arguments: { nickname: 'Новая тема' },
  });
  const first = connected.structuredContent as unknown as ConnectResult;
  if (first.status !== 'connected') throw new Error();
  const occupied = await secondClient.callTool({
    name: 'agent_connect',
    arguments: { nickname: 'НОВАЯ ТЕМА' },
  });
  const pending = occupied.structuredContent as unknown as ConnectResult;
  if (pending.status !== 'nickname_in_use') throw new Error();
  assert.ok(!JSON.stringify(pending.currentOwner).includes(first.binding.connectionId));
  const status = await secondClient.callTool({ name: 'node_status', arguments: {} });
  assert.ok(!JSON.stringify(status).includes(first.binding.connectionId));
  const confirmed = await secondClient.callTool({
    name: 'agent_connect',
    arguments: {
      nickname: 'новая тема',
      connectionId: pending.connectionId,
      transferId: pending.transferId,
      confirmTransfer: true,
    },
  });
  assert.equal((confirmed.structuredContent as { status: string }).status, 'connected');
  const previous = await firstClient.callTool({
    name: 'agent_read',
    arguments: { connectionId: first.binding.connectionId },
  });
  assert.equal(previous.isError, true);
  assert.match(JSON.stringify(previous.content), /agent_moved/);
  const events = await firstClient.callTool({
    name: 'connection_events',
    arguments: { connectionId: first.binding.connectionId },
  });
  assert.match(JSON.stringify(events), /Agent .* was moved/);
});

test('MCP local API rejects missing credentials and Origin; generated instructions have only installed service URL', async (t) => {
  const service = await node(t),
    url = service.snapshot().mcpUrl;
  assert.equal((await fetch(url, { method: 'POST', body: '{}' })).status, 401);
  assert.equal(
    (
      await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + service.settings.value.localToken,
          Origin: 'https://untrusted.invalid',
        },
        body: '{}',
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + service.settings.value.localToken,
          'mcp-session-id': randomUUID(),
        },
        body: '{}',
      })
    ).status,
    404,
  );
  for (const client of ['cursor', 'opencode', 'codex']) {
    const instructions = (await service.userCall('instructions', { client })) as McpInstructions;
    assert.ok(instructions.configuration.includes(url));
    assert.ok(!instructions.configuration.includes(process.cwd()));
    assert.ok(!instructions.configuration.includes('command'));
    assert.ok(!instructions.configuration.includes('node_modules'));
  }
  assert.equal(normalizePeerAddress('127.0.0.1:7336'), 'wss://127.0.0.1:7336/peer');
  assert.equal(normalizePeerAddress('192.168.1.20'), 'wss://192.168.1.20:7336/peer');
  assert.equal(normalizePeerAddress('::1'), 'wss://[::1]:7336/peer');
  assert.throws(() => normalizePeerAddress('http://untrusted.invalid'), /IP/);
});

test('one node serves multiple peers and keeps messages isolated by user-selected conversation', async (t) => {
  const a = await node(t),
    b = await node(t),
    c = await node(t);
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  await c.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  await until(() => b.snapshot().peers.filter((p) => p.connected).length === 2);
  const fromA = a.connect({ nickname: 'Архитектура', client: 'A' }),
    fromC = c.connect({ nickname: 'Тестирование', client: 'C' });
  const common = b.connect({ nickname: 'Общая беседа', client: 'B' }),
    isolated = b.connect({ nickname: 'Другая беседа', client: 'B2' });
  if (
    fromA.status !== 'connected' ||
    fromC.status !== 'connected' ||
    common.status !== 'connected' ||
    isolated.status !== 'connected'
  )
    throw new Error();
  const one = await a.send({
    connectionId: fromA.binding.connectionId,
    recipientNode: b.settings.value.nodeId,
    recipientNickname: 'Общая беседа',
    text: 'От первого узла',
  });
  const two = await c.send({
    connectionId: fromC.binding.connectionId,
    recipientNode: b.settings.value.nodeId,
    recipientNickname: 'ОБЩАЯ БЕСЕДА',
    text: 'От второго узла',
  });
  await until(
    () => b.store.get(one.id)?.state === 'ready' && b.store.get(two.id)?.state === 'ready',
  );
  const history = (await b.read(common.binding.connectionId)) as {
    messages: { envelope: { fromNode: string } }[];
  };
  assert.deepEqual(
    new Set(history.messages.map((m) => m.envelope.fromNode)),
    new Set([a.settings.value.nodeId, c.settings.value.nodeId]),
  );
  assert.equal(
    ((await b.read(isolated.binding.connectionId)) as { messages: unknown[] }).messages.length,
    0,
  );
});

test('same agent name on three nodes has independent routes and compact replies preserve exact addresses', async (t) => {
  const a = await node(t),
    b = await node(t),
    c = await node(t);
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  await a.network.join(c.snapshot().peerUrl, c.network.accessCode().code);
  await until(() => a.snapshot().peers.filter((peer) => peer.connected).length === 2);
  const owners = [a, b, c].map((service) => {
    const owner = service.connect({ nickname: 'Общий агент', client: 'MCP' });
    service.connect({ nickname: 'Другой агент', client: 'MCP' });
    if (owner.status !== 'connected') throw new Error();
    return owner;
  });
  const outgoing = await Promise.all(
    [b, c].map((service) =>
      a.send({
        connectionId: owners[0].binding.connectionId,
        recipientNode: service.settings.value.nodeId.toUpperCase(),
        recipientNickname: 'ОБЩИЙ АГЕНТ',
        text: 'Поручение этому узлу',
      }),
    ),
  );
  await until(() =>
    [b, c].every((service, i) => service.store.get(outgoing[i].id, 'in')?.state === 'ready'),
  );
  assert.equal(a.store.history('общий агент').messages.length, 2);
  assert.ok(
    a.store.history('общий агент').messages.every((message) => message.direction === 'out'),
  );
  await assert.rejects(
    a.network.onFrame(c.settings.value.nodeId, {
      type: 'receipt',
      id: outgoing[0].id,
      state: 'processed',
    }),
    /receipt does not belong/,
  );
  const replies: string[] = [];
  for (const [i, service] of [b, c].entries()) {
    await until(() => a.store.get(outgoing[i].id, 'out')?.state === 'ready');
    const before = (await a.read(owners[0].binding.connectionId)) as {
      messages: { envelope: { id: string }; delivery: string }[];
    };
    assert.equal(
      before.messages.find((message) => message.envelope.id === outgoing[i].id)!.delivery,
      'accepted_by_node',
    );
    const message = service.store.get(outgoing[i].id, 'in')!;
    const formatted = agentMessageText({
      nickname: owners[i + 1].nickname,
      binding: owners[i + 1].binding,
      messageId: message.envelope.id,
      replyRef: 'r' + message.sequence.toString(36),
      message: {
        fromNode: message.envelope.fromNode,
        fromNickname: message.envelope.fromNickname,
        text: message.envelope.text,
        files: [],
      },
    });
    assert.ok(!formatted.includes('From-Node:'));
    assert.ok(!formatted.includes(message.envelope.id));
    const ref = formatted.match(/Reply-To: (r[0-9a-z]+)/)![1];
    const address = service.resolveReplyAddress(owners[i + 1].binding.connectionId, {
      replyRef: ref,
    });
    assert.deepEqual(address, {
      recipientNode: a.settings.value.nodeId,
      recipientNickname: 'Общий агент',
      replyTo: outgoing[i].id,
    });
    let snapshots = 0;
    const snapshot = service.files.snapshot;
    service.files.snapshot = async () => {
      snapshots++;
      throw new Error('Unexpected snapshot');
    };
    await assert.rejects(
      service.send({
        ...address,
        connectionId: owners[i + 1].binding.connectionId,
        recipientNode: service.settings.value.nodeId,
        text: 'Wrong node',
        files: ['/missing.txt'],
      }),
      /reply address must match/,
    );
    await assert.rejects(
      service.send({
        ...address,
        connectionId: owners[i + 1].binding.connectionId,
        recipientNickname: 'Другой агент',
        text: 'Wrong name',
        files: ['/missing.txt'],
      }),
      /reply address must match/,
    );
    const stranger = service.store
      .list()
      .find((agent) => agent.nickname === 'Другой агент')!.binding!;
    await assert.rejects(
      service.send({
        ...address,
        connectionId: stranger.connectionId,
        text: 'Foreign message',
        files: ['/missing.txt'],
      }),
      /reply address must match/,
    );
    assert.equal(snapshots, 0);
    service.files.snapshot = snapshot;
    await service.read(owners[i + 1].binding.connectionId);
    const reply = await service.send({
      ...address,
      recipientNickname: 'ОБЩИЙ АГЕНТ',
      replyTo: address.replyTo,
      connectionId: owners[i + 1].binding.connectionId,
      text: 'Ответ с конкретного узла',
    });
    replies.push(reply.id);
    await assert.rejects(
      service.send({
        ...address,
        replyTo: reply.id,
        connectionId: owners[i + 1].binding.connectionId,
        text: 'Outgoing message cannot authorize a reply',
      }),
      /reply address must match/,
    );
    await until(() => a.store.get(outgoing[i].id, 'out')?.state === 'processed');
    await a.network.onFrame(service.settings.value.nodeId, {
      type: 'receipt',
      id: outgoing[i].id,
      state: 'ready',
    });
    assert.equal(a.store.get(outgoing[i].id, 'out')!.state, 'processed');
  }
  await until(() =>
    replies.every((id) => ['ready', 'processed'].includes(a.store.get(id, 'in')?.state ?? '')),
  );
  const history = (await a.read(owners[0].binding.connectionId)) as {
    messages: { envelope: { id: string; fromNode: string }; direction: string; delivery: string }[];
  };
  assert.deepEqual(
    new Set(
      history.messages
        .filter((message) => message.direction === 'in')
        .map((message) => message.envelope.fromNode),
    ),
    new Set([b.settings.value.nodeId, c.settings.value.nodeId]),
  );
  for (const id of replies) {
    const incoming = a.store.get(id, 'in')!;
    const address = a.resolveReplyAddress(owners[0].binding.connectionId, {
      replyRef: 'r' + incoming.sequence.toString(36),
    });
    assert.deepEqual(address, {
      recipientNode: incoming.envelope.fromNode,
      recipientNickname: incoming.envelope.fromNickname,
      replyTo: id,
    });
  }
  assert.ok(history.messages.every((message) => message.delivery === 'received_by_agent'));
  for (const service of [a, b, c])
    assert.equal(service.store.history('другой агент').messages.length, 0);
});

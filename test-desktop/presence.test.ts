import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { PingRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { AgentPresence } from '../desktop/core/presence.js';
import { NodeService } from '../desktop/core/service.js';
import type { ConnectResult } from '../desktop/core/agent-store.js';
import type {
  DirectoryAgent,
  DirectorySnapshot,
  NicknameConflict,
} from '../desktop/shared/contracts.js';

async function until(check: () => boolean, timeout = 6000): Promise<void> {
  const end = Date.now() + timeout;
  while (!check()) {
    if (Date.now() > end) throw new Error('Presence update timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
async function node(t: test.TestContext, clientLeaseMs?: number): Promise<NodeService> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-presence-'));
  const service = new NodeService(directory, { clientLeaseMs });
  await service.open();
  t.after(async () => {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  return service;
}
async function client(t: test.TestContext, service: NodeService) {
  const transport = new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
    requestInit: { headers: { Authorization: 'Bearer ' + service.settings.value.localToken } },
  });
  const mcp = new Client({ name: 'presence-test', version: '1' });
  await mcp.connect(transport);
  t.after(() => mcp.close());
  return { mcp, transport };
}
async function connect(mcp: Client, nickname: string, connectionId?: string) {
  const result = (
    await mcp.callTool({
      name: 'agent_connect',
      arguments: { nickname, ...(connectionId ? { connectionId } : {}) },
    })
  ).structuredContent as unknown as ConnectResult;
  if (result.status !== 'connected') throw new Error('Agent connection failed');
  return result;
}
type Catalog = {
  agents: (DirectoryAgent & { nodeId: string })[];
  complete: boolean;
  nodes: { nodeId: string; state: string }[];
  hasMore: boolean;
  nextCursor: string | null;
};
const catalog = (service: NodeService, args: Parameters<NodeService['listAgents']>[0] = {}) =>
  service.listAgents(args) as Catalog;
const advertised = (service: NodeService, nodeId: string) =>
  service.agentDirectories().find((directory) => directory.nodeId === nodeId)!;

test('live evidence aggregates sessions; snapshots reject stale epochs/revisions and normalize duplicate identities', () => {
  const presence = new AgentPresence(() => {}, 0),
    connection = randomUUID();
  presence.touch('first', connection);
  presence.touch('second', connection);
  presence.close('first');
  assert.equal(presence.isOnline(connection), true);
  presence.uncertain('second');
  assert.equal(presence.isOnline(connection), false);
  const peer = randomUUID(),
    snapshot: DirectorySnapshot = {
      epoch: randomUUID(),
      revision: 5,
      total: 1,
      agents: [{ nickname: 'Автор', availability: 'online', delivery: 'mcp' }],
    };
  assert.equal(presence.receive(peer, snapshot), true);
  assert.equal(presence.receive(peer, { ...snapshot, revision: 4, agents: [] }), false);
  assert.equal(
    presence.receive(peer, { ...snapshot, epoch: randomUUID(), revision: 6, agents: [] }),
    false,
  );
  assert.equal(presence.remoteDirectory(peer, 'Peer', false, true).state, 'offline');
  assert.deepEqual(presence.remoteDirectory(peer, 'Peer', false, true).agents, []);
  assert.throws(
    () =>
      presence.receive(peer, {
        ...snapshot,
        revision: 6,
        total: 2,
        agents: [snapshot.agents[0], { ...snapshot.agents[0], nickname: 'АВТОР' }],
      }),
    /duplicate names/,
  );
  presence.begin(peer);
  assert.equal(presence.remoteDirectory(peer, 'Peer', true, true).state, 'syncing');
  assert.equal(
    presence.receive(peer, { ...snapshot, epoch: randomUUID(), revision: 0, total: 0, agents: [] }),
    true,
  );
  assert.equal(presence.remoteDirectory(peer, 'Peer', true, false).state, 'unsupported');
});

test('three nodes exchange push presence without transitive agents; duplicate names warn and departure preserves history', async (t) => {
  const a = await node(t),
    b = await node(t),
    c = await node(t);
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  await a.network.join(c.snapshot().peerUrl, c.network.accessCode().code);
  await until(
    () =>
      advertised(a, b.settings.value.nodeId).state === 'ready' &&
      advertised(a, c.settings.value.nodeId).state === 'ready',
  );
  const ca = await client(t, a),
    cb = await client(t, b),
    cc = await client(t, c);
  const one = await connect(cb.mcp, 'Общий агент'),
    two = await connect(cc.mcp, 'ОБЩИЙ АГЕНТ');
  await until(() => catalog(a).agents.length === 2);
  const local = await connect(ca.mcp, 'общий агент');
  assert.equal(local.warnings?.length, 2);
  assert.ok(
    local.warnings?.every(
      (warning: NicknameConflict) => warning.code === 'nickname_on_remote_node',
    ),
  );
  await until(() => catalog(b).agents.length === 2 && catalog(c).agents.length === 2);
  assert.ok(!catalog(b).nodes.some((value) => value.nodeId === c.settings.value.nodeId));
  assert.equal(catalog(a).agents.length, 3);
  const sent = await b.send({
    connectionId: one.binding.connectionId,
    recipientNode: a.settings.value.nodeId,
    recipientNickname: 'общий агент',
    text: 'Persistent history',
  });
  await until(() => !!a.store.get(sent.id, 'in'));
  const result = await cb.mcp.callTool({
    name: 'agent_disconnect',
    arguments: { connectionId: one.binding.connectionId },
  });
  assert.ok(!result.isError);
  await until(() => !catalog(a).agents.some((agent) => agent.nodeId === b.settings.value.nodeId));
  assert.equal(b.store.get(sent.id, 'out')!.envelope.id, sent.id);
  assert.equal(b.store.list().find((agent) => agent.nickname === 'Общий агент')!.binding, null);
  assert.ok(
    (
      await cb.mcp.callTool({
        name: 'agent_disconnect',
        arguments: { connectionId: one.binding.connectionId },
      })
    ).isError,
  );
  const discovery = await ca.mcp.callTool({ name: 'agents_list', arguments: {} });
  assert.ok(!discovery.isError);
  const publicData = JSON.stringify(discovery.structuredContent);
  for (const privateValue of [
    local.binding.connectionId,
    one.binding.connectionId,
    two.binding.connectionId,
    local.binding.chatId,
    local.binding.adapterId,
    a.settings.value.localToken,
  ])
    assert.ok(!publicData.includes(privateValue));
  assert.ok(!/"(?:connectionId|adapterId|chatId|hostPid|password|token)"\s*:/i.test(publicData));
  const first = catalog(a, { limit: 1 });
  assert.equal(first.hasMore, true);
  assert.equal(catalog(a, { limit: 1, cursor: first.nextCursor! }).agents.length, 1);
  await connect(cc.mcp, 'Новый');
  await until(() => catalog(a).agents.length === 3);
  assert.throws(() => catalog(a, { limit: 1, cursor: first.nextCursor! }), /directory changed/);
  assert.ok(
    !(
      await cc.mcp.callTool({
        name: 'agent_disconnect',
        arguments: { connectionId: two.binding.connectionId },
      })
    ).isError,
  );
  await until(
    () =>
      catalog(a).agents.filter((agent) => agent.nodeId === c.settings.value.nodeId).length === 1,
  );
  assert.equal(
    catalog(a).agents.find((agent) => agent.nodeId === c.settings.value.nodeId)!.nickname,
    'Новый',
  );
});

test('directory publication stays below the frame byte budget and explicitly reports truncated Unicode names', () => {
  const presence = new AgentPresence(() => {});
  presence.update(
    Array.from({ length: 1001 }, (_, i) => ({
      nickname: String(i).padStart(4, '0') + '\ud800'.repeat(110),
      availability: 'online' as const,
      delivery: 'mcp' as const,
    })),
  );
  const snapshot = presence.snapshot();
  assert.equal(snapshot.total, 1001);
  assert.ok(snapshot.agents.length < 1000);
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) <= 384 * 1024);
});

test('a late negative probe cannot overwrite newer evidence for either binding on a shared transport', () => {
  const presence = new AgentPresence(() => {}, 0),
    first = randomUUID(),
    second = randomUUID();
  presence.touch('session', first);
  const probeVersion = presence.version('session');
  presence.touch('session', second);
  assert.equal(presence.uncertain('session', probeVersion), false);
  assert.equal(presence.isOnline(first), true);
  assert.equal(presence.isOnline(second), true);
  presence.close('session');
});

test('readonly MCP requests renew existing shared associations and stale idle sessions release capacity', async (t) => {
  const service = await node(t, 100),
    active = await client(t, service);
  const first = await connect(active.mcp, 'First'),
    second = await connect(active.mcp, 'Second');
  active.mcp.setRequestHandler(PingRequestSchema, async () => {
    throw new Error('Reverse transport unavailable');
  });
  await until(() => catalog(service).agents.length === 0);
  assert.ok(!(await active.mcp.callTool({ name: 'node_status', arguments: {} })).isError);
  assert.equal(catalog(service).agents.length, 2);
  await until(() => catalog(service).agents.length === 0);
  assert.ok(!(await active.mcp.callTool({ name: 'agents_list', arguments: {} })).isError);
  assert.equal(catalog(service).agents.length, 2);
  const expiredSession = active.transport.sessionId;
  await active.mcp.close();
  await until(() => catalog(service).agents.length === 0);
  await service.mcp.checkLiveness(50, 0);
  const late = await fetch(service.snapshot().mcpUrl, {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + service.settings.value.localToken,
      'mcp-session-id': expiredSession!,
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
  });
  assert.equal(late.status, 404);
  const capacity = await node(t, 0);
  for (let i = 0; i < 130; i++) {
    const stale = await client(t, capacity);
    await stale.mcp.close();
    await capacity.mcp.checkLiveness(20, 0);
  }
  const available = await client(t, capacity);
  assert.ok(!(await available.mcp.callTool({ name: 'node_status', arguments: {} })).isError);
  const resumed = await client(t, service);
  await connect(resumed.mcp, 'First', first.binding.connectionId);
  assert.equal(catalog(service).agents.length, 1);
  assert.equal(service.store.assertOwner(second.binding.connectionId).nickname, 'Second');
});

test('MCP transport pings retain idle presence, detect lost clients and aggregate same-binding sessions', async (t) => {
  const a = await node(t),
    b = await node(t, 250);
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  const first = await client(t, b),
    second = await client(t, b);
  const owner = await connect(first.mcp, 'Idle agent');
  await connect(second.mcp, 'Idle agent', owner.binding.connectionId);
  await until(() => catalog(a).agents.length === 1);
  await b.mcp.checkLiveness(500);
  assert.equal(catalog(b).agents.length, 1);
  await first.transport.terminateSession();
  assert.equal(catalog(b).agents.length, 1);
  await second.mcp.close();
  await b.mcp.checkLiveness(100);
  await until(() => catalog(a).agents.length === 0, 25000);
  assert.equal(catalog(a, { includeUnavailable: true }).agents[0].availability, 'unknown');
  assert.equal(b.store.assertOwner(owner.binding.connectionId).nickname, 'Idle agent');
});

test('transfer and reconnect discard obsolete evidence and cached remote agents', async (t) => {
  const a = await node(t),
    b = await node(t),
    oldClient = await client(t, b),
    newClient = await client(t, b);
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  const old = await connect(oldClient.mcp, 'Transfer');
  await until(() => catalog(a).agents.length === 1);
  const pending = (
    await newClient.mcp.callTool({ name: 'agent_connect', arguments: { nickname: 'TRANSFER' } })
  ).structuredContent as unknown as ConnectResult;
  if (pending.status !== 'nickname_in_use') throw new Error();
  const moved = (
    await newClient.mcp.callTool({
      name: 'agent_connect',
      arguments: {
        nickname: 'TRANSFER',
        connectionId: pending.connectionId,
        transferId: pending.transferId,
        confirmTransfer: true,
      },
    })
  ).structuredContent as unknown as ConnectResult;
  assert.equal(moved.status, 'connected');
  await oldClient.transport.terminateSession();
  await b.mcp.checkLiveness(500);
  assert.equal(catalog(b).agents.length, 1);
  assert.ok(
    (
      await newClient.mcp.callTool({
        name: 'agent_disconnect',
        arguments: { connectionId: old.binding.connectionId },
      })
    ).isError,
  );
  await b.stop();
  await until(() => advertised(a, b.settings.value.nodeId).state === 'offline');
  assert.equal(catalog(a).agents.length, 0);
  assert.equal(catalog(a).complete, false);
  await b.start();
  await until(() => advertised(a, b.settings.value.nodeId).state === 'ready');
  assert.equal(catalog(a).agents.length, 0);
  assert.equal(catalog(a, { includeUnavailable: true }).agents[0].availability, 'unknown');
  assert.equal(b.store.list().filter((agent) => agent.binding).length, 1);
});

test('peers without the negotiated capability stay unsupported and protocol 2 messages still work', async (t) => {
  const a = await node(t),
    b = await node(t);
  b.network.server!.prependListener('upgrade', (req) => {
    delete req.headers['x-ncf-features'];
  });
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  await until(() => a.snapshot().peers[0]?.connected === true);
  assert.equal(advertised(a, b.settings.value.nodeId).state, 'unsupported');
  assert.equal(advertised(b, a.settings.value.nodeId).state, 'unsupported');
  const cb = await client(t, b),
    ca = await client(t, a);
  await connect(cb.mcp, 'Remote');
  const owner = await connect(ca.mcp, 'Local');
  assert.equal(catalog(a).complete, false);
  assert.ok(!catalog(a).agents.some((agent) => agent.nodeId === b.settings.value.nodeId));
  const sent = await a.send({
    connectionId: owner.binding.connectionId,
    recipientNode: b.settings.value.nodeId,
    recipientNickname: 'Remote',
    text: 'Compatible message',
  });
  await until(() => b.store.get(sent.id, 'in')?.state === 'ready');
  await assert.rejects(
    a.network.directory(b.settings.value.nodeId, {
      epoch: randomUUID(),
      revision: 0,
      total: 0,
      agents: [],
    }),
    /not supported/,
  );
});

test('closing a superseded socket cannot erase a replacement connection directory', async (t) => {
  const a = await node(t),
    b = await node(t);
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  await until(() => a.snapshot().peers[0]?.connected === true);
  const receiver = a.settings.value.nodeId > b.settings.value.nodeId ? a : b,
    sender = receiver === a ? b : a;
  const peer = receiver.settings.value.peers.find(
    (value) => value.id === sender.settings.value.nodeId,
  )!;
  const target = sender.settings.value.peers.find(
    (value) => value.id === receiver.settings.value.nodeId,
  )!;
  const ws = new WebSocket(receiver.snapshot().peerUrl, {
    ca: target.certificate,
    headers: {
      authorization: 'Bearer ' + peer.secret,
      'x-node-id': sender.settings.value.nodeId,
      'x-ncf-features': 'agent-directory-v1',
    },
  });
  t.after(() => ws.terminate());
  await new Promise<void>((resolve, reject) => {
    ws.once('error', reject);
    ws.once('open', resolve);
  });
  const epoch = randomUUID();
  ws.send(JSON.stringify({ type: 'hello', protocol: 2, nodeId: sender.settings.value.nodeId }));
  ws.send(
    JSON.stringify({
      type: 'directory',
      snapshot: {
        epoch,
        revision: 10,
        total: 1,
        agents: [{ nickname: 'Replacement agent', availability: 'online', delivery: 'mcp' }],
      },
    }),
  );
  await until(() => advertised(receiver, sender.settings.value.nodeId).epoch === epoch);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(advertised(receiver, sender.settings.value.nodeId).state, 'ready');
  assert.equal(catalog(receiver).agents[0].nickname, 'Replacement agent');
});

test('committed immutable peer rotation revokes active and connecting sockets and reconnects with current credentials', async (t) => {
  const a = await node(t),
    b = await node(t),
    cb = await client(t, b);
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  await connect(cb.mcp, 'Rotating peer');
  await until(() => catalog(a).agents.length === 1);
  const secret = randomBytes(32).toString('hex');
  a.settings.value.peers = a.settings.value.peers.map((peer) => ({ ...peer, secret }));
  b.settings.value.peers = b.settings.value.peers.map((peer) => ({ ...peer, secret }));
  await Promise.all([a.settings.save(), b.settings.save()]);
  a.network.reconnectPeer(b.settings.value.nodeId);
  a.network.reconnectPeer(b.settings.value.nodeId);
  b.network.reconnectPeer(a.settings.value.nodeId);
  assert.notEqual(advertised(a, b.settings.value.nodeId).state, 'ready');
  await until(
    () =>
      advertised(a, b.settings.value.nodeId).state === 'ready' && catalog(a).agents.length === 1,
  );
  assert.equal(a.snapshot().peers[0].error, null);
  assert.equal(b.snapshot().peers[0].error, null);
  assert.equal(catalog(a).agents[0].nickname, 'Rotating peer');
});

test('the same network can close with a queued retry, start into refusal and recover when its peer returns', async (t) => {
  const a = await node(t),
    b = await node(t);
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  await until(() => advertised(a, b.settings.value.nodeId).state === 'ready');
  const network = a.network;
  const disconnected = new Promise<void>((resolve) => network.once('disconnected', resolve));
  await b.stop();
  await disconnected;
  await network.close();
  assert.equal(network.states()[0].directorySupported, false);
  assert.equal(network.states()[0].connected, false);
  await network.start();
  assert.equal(a.network, network);
  await until(() => /ECONNREFUSED/.test(network.states()[0].error ?? ''));
  // Let the failed WebSocket close schedule its next transport retry.
  await new Promise<void>((resolve) => setImmediate(resolve));
  await b.start();
  await until(() => advertised(a, b.settings.value.nodeId).state === 'ready');
  assert.equal(network.states()[0].connected, true);
  assert.equal(network.states()[0].directorySupported, true);
  assert.equal(network.states()[0].error, null);
});

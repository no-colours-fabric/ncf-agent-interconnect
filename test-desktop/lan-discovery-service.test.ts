import fsPromises from 'node:fs/promises';
import tls from 'node:tls';
import https from 'node:https';
import test, { after, mock } from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { syncBuiltinESMExports } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { NodeService } from '../desktop/core/service.js';
import { SettingsFile } from '../desktop/core/settings.js';
import type { LanDiscoveryOptions, LanDiscoveryTransport } from '../desktop/core/lan-discovery.js';
import type { Snapshot } from '../desktop/shared/contracts.js';
import { setTimeout as delay } from 'node:timers/promises';
import { unpairedLanNodes } from '../desktop/renderer/NetworkPage.js';

// All discovery traffic in this file must use the injected transport, even on failure.
const udp = mock.method(dgram, 'createSocket', () =>
  assert.fail('Real UDP is forbidden in service tests'),
);
syncBuiltinESMExports();
after(() => {
  try {
    assert.equal(udp.mock.callCount(), 0);
  } finally {
    udp.mock.restore();
    syncBuiltinESMExports();
  }
});

const remoteId = '00000000-0000-4000-8000-000000000002';
class FakeLanTransport implements LanDiscoveryTransport {
  handlers?: Parameters<LanDiscoveryTransport['start']>[0];
  sent: { packet: Record<string, unknown>; interfaceAddress?: string }[] = [];
  closed = false;
  failStart = false;
  hold = false;
  release?: () => void;
  onStop?: () => void;
  async start(handlers: Parameters<LanDiscoveryTransport['start']>[0]): Promise<void> {
    this.handlers = handlers;
    if (this.failStart) throw new Error('Isolated discovery startup failure');
    if (this.hold)
      await new Promise<void>((resolve) => {
        this.release = resolve;
      });
  }
  send(data: Uint8Array, interfaceAddress?: string): void {
    this.sent.push({ packet: JSON.parse(Buffer.from(data).toString()), interfaceAddress });
  }
  stop(): void {
    this.onStop?.();
    this.closed = true;
    this.release?.();
  }
  announce(nodeId = remoteId, label = 'Untrusted fixture computer'): void {
    this.handlers?.message(
      Buffer.from(
        JSON.stringify({
          service: 'ncf-agent-interconnect',
          version: 1,
          type: 'announce',
          nodeId,
          label,
          peerPort: 7336,
        }),
      ),
      '192.0.2.20',
    );
  }
}
function discoveryFixture(prepare?: (transport: FakeLanTransport) => void) {
  const transports: FakeLanTransport[] = [],
    ticks = new Set<() => void>();
  let now = 0;
  const options: Omit<LanDiscoveryOptions, 'local' | 'changed'> = {
    interfaces: () => [{ address: '192.0.2.10', netmask: '255.255.255.0' }],
    now: () => now,
    every: (callback) => {
      ticks.add(callback);
      return () => {
        ticks.delete(callback);
      };
    },
    transport: () => {
      const transport = new FakeLanTransport();
      prepare?.(transport);
      transports.push(transport);
      return transport;
    },
  };
  return {
    options,
    transports,
    ticks,
    get transport() {
      return transports.at(-1)!;
    },
    advance(milliseconds: number) {
      now += milliseconds;
      for (const tick of [...ticks]) tick();
    },
  };
}
async function serviceFixture(
  t: test.TestContext,
  lanDiscovery?: Omit<LanDiscoveryOptions, 'local' | 'changed'>,
) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-lan-service-'));
  const settings = new SettingsFile(directory);
  await settings.load();
  settings.value.mcpPort = settings.value.peerPort = 0;
  await settings.save();
  const service = new NodeService(directory, { codexSockets: () => [], lanDiscovery });
  t.after(async () => {
    if (service.store) await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  return service;
}
const uiSnapshot = (service: NodeService) => service.userCall('snapshot') as Promise<Snapshot>;
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test('default core startup and restart never create a discovery socket or UI discovery field', async (t) => {
  const service = await serviceFixture(t);
  await service.open();
  assert.equal(service.snapshot().listenHost, '127.0.0.1');
  assert.equal(Object.hasOwn(await uiSnapshot(service), 'lanDiscovery'), false);
  assert.equal(Object.hasOwn(await uiSnapshot(service), 'lanSearch'), false);
  assert.ok((await uiSnapshot(service)).networkInterfaces);
  assert.equal(Object.hasOwn(service.snapshot(), 'networkInterfaces'), false);
  assert.deepEqual(await service.userCall('startLanSearch'), { started: false });
  await service.stop();
  await service.start();
  assert.equal(Object.hasOwn(await uiSnapshot(service), 'lanDiscovery'), false);
  assert.equal(Object.hasOwn(await uiSnapshot(service), 'lanSearch'), false);
  assert.equal(udp.mock.callCount(), 0);
});

test('loopback listener still receives discovery but keeps it out of settings, MCP and trusted directories', async (t) => {
  const discovery = discoveryFixture(),
    service = await serviceFixture(t, discovery.options);
  let changes = 0;
  service.on('change', () => {
    changes++;
  });
  await service.open();
  await settle();
  assert.equal((await uiSnapshot(service)).lanDiscovery?.announcement.reason, 'listener-local');
  assert.equal(discovery.transport.sent.length, 0);
  assert.equal((await uiSnapshot(service)).lanSearch?.phase, 'stopped');
  assert.deepEqual(await service.userCall('startLanSearch'), { started: true });
  assert.deepEqual(
    discovery.transport.sent.map(({ packet }) => packet.type),
    ['query', 'direct-query'],
  );
  const before = changes;
  discovery.transport.announce();
  discovery.advance(1000);
  assert.ok(changes > before);
  assert.equal((await uiSnapshot(service)).lanDiscovery?.nodes[0].nodeId, remoteId);
  assert.equal((await uiSnapshot(service)).lanSearch?.foundCount, 1);
  assert.deepEqual(service.settings.value.peers, []);
  assert.equal(service.settings.value.listenHost, '127.0.0.1');
  assert.equal(Object.hasOwn(service.snapshot(), 'lanDiscovery'), false);
  assert.equal(Object.hasOwn(service.snapshot(), 'lanSearch'), false);
  assert.equal(
    service.agentDirectories().some((entry) => entry.nodeId === remoteId),
    false,
  );
  const saved = JSON.parse(await readFile(service.settings.filename, 'utf8'));
  assert.equal(Object.hasOwn(saved, 'lanDiscovery'), false);
  assert.equal(Object.hasOwn(saved, 'lanSearch'), false);
  assert.deepEqual(saved.peers, []);
  const client = new Client({ name: 'Isolated LAN lifecycle check', version: '1' });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
        requestInit: { headers: { authorization: 'Bearer ' + service.settings.value.localToken } },
      }),
    );
    const status = (await client.callTool({ name: 'node_status', arguments: {} }))
      .structuredContent!;
    assert.equal(Object.hasOwn(status, 'lanDiscovery'), false);
    assert.equal(Object.hasOwn(status, 'lanSearch'), false);
    const peers = (await client.callTool({ name: 'node_peers', arguments: {} }))
      .structuredContent as { peers: unknown[] };
    assert.deepEqual(peers.peers, []);
  } finally {
    await client.close();
  }
});

test('only the actual bound listener supplies announcement host and port, including after rename', async (t) => {
  const discovery = discoveryFixture(),
    service = await serviceFixture(t, discovery.options);
  let actualPort = 0;
  const configure = service.adapters.configure.bind(service.adapters);
  t.mock.method(
    service.adapters,
    'configure',
    async (profiles: Parameters<typeof service.adapters.configure>[0]) => {
      await configure(profiles);
      const server = service.network.server!,
        bound = server.address();
      assert.ok(bound && typeof bound !== 'string');
      assert.equal(
        bound.address,
        '127.0.0.1',
        'The real fixture listener must remain loopback-only',
      );
      actualPort = bound.port;
      // Simulate a bound LAN address without binding a socket on the owner's LAN.
      t.mock.getter(service.network, 'endpoints', () => [
        { address: '192.0.2.10', port: actualPort },
      ]);
      service.settings.value.peerPort = 1;
    },
  );
  await service.open();
  await settle();
  const first = discovery.transport.sent.find(({ packet }) => packet.type === 'announce')!;
  assert.equal(first.interfaceAddress, '192.0.2.10');
  assert.equal(first.packet.peerPort, actualPort);
  assert.notEqual(first.packet.peerPort, service.settings.value.peerPort);
  await service.userCall('saveNode', { nodeLabel: 'Renamed Ж fixture', listenHost: '127.0.0.1' });
  discovery.advance(2000);
  const renamed = discovery.transport.sent.at(-1)!;
  assert.equal(renamed.packet.label, 'Renamed Ж fixture');
  assert.equal(renamed.packet.peerPort, actualPort);
  assert.equal(discovery.transports.length, 1, 'A rename must not restart discovery');
  assert.equal(service.settings.value.listenHost, '127.0.0.1');
});

test('stop cancels discovery before peer shutdown and restart fences the old transport', async (t) => {
  const discovery = discoveryFixture(),
    service = await serviceFixture(t, discovery.options);
  await service.open();
  await settle();
  const previous = discovery.transport;
  previous.announce();
  assert.equal((await uiSnapshot(service)).lanDiscovery?.nodes.length, 1);
  previous.onStop = () => assert.equal(service.network.server!.listening, true);
  await service.stop();
  assert.equal(previous.closed, true);
  assert.equal(discovery.ticks.size, 0);
  assert.equal((await uiSnapshot(service)).lanDiscovery?.state, 'stopped');
  assert.deepEqual((await uiSnapshot(service)).lanDiscovery?.nodes, []);
  previous.onStop = undefined;
  await service.start();
  await settle();
  assert.equal(discovery.transports.length, 2);
  previous.announce();
  previous.handlers!.failed();
  assert.equal((await uiSnapshot(service)).lanDiscovery?.state, 'searching');
  assert.deepEqual((await uiSnapshot(service)).lanDiscovery?.nodes, []);
  discovery.transport.announce();
  assert.equal((await uiSnapshot(service)).lanDiscovery?.nodes.length, 1);
});

test('close during discovery startup cancels the pending bind without blocking messaging startup', async (t) => {
  const discovery = discoveryFixture((transport) => {
    transport.hold = true;
  });
  const service = await serviceFixture(t, discovery.options);
  await service.open();
  assert.equal(service.running, true);
  assert.equal(discovery.transport.sent.length, 0);
  let stopped: Snapshot | undefined;
  service.on('change', () => {
    if (!service.running) stopped = service.snapshot({ lanDiscovery: true });
  });
  discovery.transport.onStop = () => assert.equal(service.network.server!.listening, true);
  await service.close();
  assert.equal(discovery.transport.closed, true);
  assert.equal(discovery.ticks.size, 0);
  assert.equal(stopped?.lanDiscovery?.state, 'stopped');
  discovery.transport.announce();
  assert.deepEqual(stopped?.lanDiscovery?.nodes, []);
});

test('discovery startup failure is visible without stopping the messaging node', async (t) => {
  const discovery = discoveryFixture((transport) => {
    transport.failStart = true;
  });
  const service = await serviceFixture(t, discovery.options);
  await service.open();
  await settle();
  assert.equal(service.integrationsReady, true);
  assert.equal(service.network.server!.listening, true);
  assert.equal((await uiSnapshot(service)).lanDiscovery?.reason, 'transport-error');
  assert.deepEqual(service.snapshot().errors, []);
  assert.equal(discovery.transport.closed, true);
  assert.equal(discovery.ticks.size, 0);
});

test('no IPv4 interface leaves messaging ready and creates no discovery transport', async (t) => {
  const discovery = discoveryFixture();
  const service = await serviceFixture(t, { ...discovery.options, interfaces: () => [] });
  await service.open();
  await settle();
  assert.equal(service.integrationsReady, true);
  assert.equal((await uiSnapshot(service)).lanDiscovery?.reason, 'no-interfaces');
  assert.equal(discovery.transports.length, 0);
});

test('failure before discovery startup creates no transport and closes the peer listener', async (t) => {
  const discovery = discoveryFixture(),
    service = await serviceFixture(t, discovery.options);
  t.mock.method(service.adapters, 'configure', async () => {
    throw new Error('Isolated adapter startup failure');
  });
  await assert.rejects(service.open(), /Isolated adapter startup failure/);
  assert.equal(discovery.transports.length, 0);
  assert.equal(service.network.server?.listening ?? false, false);
  assert.equal(service.running, false);
});

test('startup cleanup cancels discovery if a later startup observer fails', async (t) => {
  const discovery = discoveryFixture((transport) => {
    transport.hold = true;
  });
  const service = await serviceFixture(t, discovery.options);
  service.on('change', () => {
    if (service.running && service.snapshot({ lanDiscovery: true }).lanDiscovery)
      throw new Error('Isolated startup observer failure');
  });
  await assert.rejects(service.open(), /Isolated startup observer failure/);
  assert.equal(discovery.transport.closed, true);
  assert.equal(discovery.ticks.size, 0);
  assert.equal(service.network.server?.listening ?? false, false);
  assert.equal(service.running, false);
});

test('UI profile helper explicitly disables production discovery without changing the parent environment', async (t) => {
  const { createUiEnvironment } = await import(
    new URL('../scripts/ui-test-profile.mjs', import.meta.url).href
  );
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-lan-ui-optout-'));
  const previous = process.env.NCF_DISABLE_LAN_DISCOVERY;
  t.after(async () => {
    if (previous === undefined) delete process.env.NCF_DISABLE_LAN_DISCOVERY;
    else process.env.NCF_DISABLE_LAN_DISCOVERY = previous;
    await rm(directory, { recursive: true, force: true });
  });
  process.env.NCF_DISABLE_LAN_DISCOVERY = '0';
  const environment = await createUiEnvironment(directory);
  assert.equal(environment.NCF_DISABLE_LAN_DISCOVERY, '1');
  assert.equal(process.env.NCF_DISABLE_LAN_DISCOVERY, '0');
});

test('search-ui: bounded pass, Stop, Retry and exact-key acknowledgement keep results untrusted', async (t) => {
  const discovery = discoveryFixture();
  const service = await serviceFixture(t, discovery.options);
  await service.open();
  await settle();
  await service.userCall('startLanSearch');
  discovery.transport.announce();
  discovery.advance(5000);
  const displayed = (await uiSnapshot(service)).lanSearch!.unseenKeys;
  discovery.transport.announce('00000000-0000-4000-8000-000000000003');
  await service.userCall('ackLanSearch', { keys: [...displayed, 'unknown-key'] });
  assert.equal((await uiSnapshot(service)).lanSearch!.unseenKeys.length, 1);
  await service.userCall('stopLanSearch');
  const stopped = (await uiSnapshot(service)).lanSearch!;
  assert.equal(stopped.phase, 'stopped');
  assert.equal(stopped.nodes.length, 2);
  assert.equal(stopped.elapsedMs, 5000);
  await service.userCall('startLanSearch');
  assert.equal((await uiSnapshot(service)).lanSearch!.foundCount, 0);
  assert.equal((await uiSnapshot(service)).lanSearch!.nodes.length, 2);
  discovery.transport.announce();
  discovery.transport.announce();
  assert.equal((await uiSnapshot(service)).lanSearch!.foundCount, 1);
  discovery.advance(30000);
  assert.equal((await uiSnapshot(service)).lanSearch!.phase, 'complete');
  assert.equal((await uiSnapshot(service)).lanSearch!.elapsedMs, 30000);
  assert.deepEqual(service.settings.value.peers, []);
  assert.equal(service.settings.value.listenHost, '127.0.0.1');
  assert.equal(
    service.agentDirectories().some((entry) => entry.nodeId === remoteId),
    false,
  );
});

test('search-ui: commands reject nonempty options and oversized acknowledgement before changing state', async (t) => {
  const discovery = discoveryFixture();
  const service = await serviceFixture(t, discovery.options);
  await service.open();
  await settle();
  await service.userCall('startLanSearch');
  for (const [method, args] of [
    ['startLanSearch', { listenHost: '0.0.0.0' }],
    ['stopLanSearch', { extra: true }],
    ['ackLanSearch', { keys: [], extra: true }],
    ['ackLanSearch', { keys: Array(129).fill('unknown-key') }],
    ['ackLanSearch', { keys: ['x'.repeat(129)] }],
    ['ackLanSearch', { keys: [''] }],
    ['ackLanSearch', { keys: [1] }],
  ] as const)
    await assert.rejects(service.userCall(method, args));
  assert.equal((await uiSnapshot(service)).lanSearch!.phase, 'searching');
  assert.equal((await uiSnapshot(service)).lanSearch!.runId, 1);
  assert.deepEqual(service.settings.value.peers, []);
  assert.equal(service.settings.value.listenHost, '127.0.0.1');
});

test('search-ui: Stop during pending transport start cancels a delayed UI search', async (t) => {
  const discovery = discoveryFixture((transport) => {
    transport.hold = true;
  });
  const service = await serviceFixture(t, discovery.options);
  await service.open();
  const starting = service.userCall('startLanSearch');
  await service.userCall('stopLanSearch');
  discovery.transport.release!();
  assert.deepEqual(await starting, { started: false });
  assert.equal((await uiSnapshot(service)).lanSearch!.phase, 'stopped');
  assert.equal(discovery.transport.sent.length, 0);
  assert.deepEqual(await service.userCall('startLanSearch'), { started: true });
  assert.equal(discovery.transport.sent.filter(({ packet }) => packet.type === 'query').length, 1);
});

test('search-ui: pending requests coalesce and cannot cross node-stop instance fences', async (t) => {
  const discovery = discoveryFixture((transport) => {
    transport.hold = true;
  });
  const service = await serviceFixture(t, discovery.options);
  await service.open();
  const first = service.userCall('startLanSearch');
  const second = service.userCall('startLanSearch');
  discovery.transport.release!();
  assert.deepEqual(await first, { started: false });
  assert.deepEqual(await second, { started: true });
  assert.equal((await uiSnapshot(service)).lanSearch!.runId, 1);
  const previous = discovery.transport;
  const incarnation = service.deliveryIncarnation;
  let invalidated = false;
  const invalidate = service.mcp.invalidate.bind(service.mcp);
  t.mock.method(service.mcp, 'invalidate', () => {
    invalidated = true;
    invalidate();
  });
  previous.onStop = () => {
    assert.equal(invalidated, true);
    assert.equal(service.running, false);
    assert.equal(service.integrationsReady, false);
    assert.notEqual(service.deliveryIncarnation, incarnation);
    assert.equal(service.network.server!.listening, true);
  };
  await service.stop();
  previous.onStop = undefined;
  await service.start();
  const latest = service.userCall('startLanSearch');
  previous.announce();
  previous.handlers!.failed();
  discovery.transport.release!();
  assert.deepEqual(await latest, { started: true });
  assert.equal((await uiSnapshot(service)).lanSearch!.reason, null);
  assert.equal((await uiSnapshot(service)).lanSearch!.foundCount, 0);
  discovery.transport.announce();
  assert.equal((await uiSnapshot(service)).lanSearch!.foundCount, 1);
});

test('search-ui: node stop cancels a still-pending search before it can open queries', async (t) => {
  const discovery = discoveryFixture((transport) => {
    transport.hold = true;
  });
  const service = await serviceFixture(t, discovery.options);
  await service.open();
  const starting = service.userCall('startLanSearch');
  const old = discovery.transport;
  await service.stop();
  assert.deepEqual(await starting, { started: false });
  assert.equal(old.closed, true);
  assert.deepEqual(old.sent, []);
  assert.equal((await uiSnapshot(service)).lanSearch!.phase, 'stopped');
  assert.equal(discovery.ticks.size, 0);
});

test('search-ui: explicit retry reopens failed transport and retains prior observations', async (t) => {
  const discovery = discoveryFixture();
  const service = await serviceFixture(t, discovery.options);
  await service.open();
  await settle();
  await service.userCall('startLanSearch');
  discovery.transport.announce();
  const key = (await uiSnapshot(service)).lanSearch!.nodes[0].key;
  discovery.transport.handlers!.failed();
  assert.equal((await uiSnapshot(service)).lanSearch!.phase, 'unavailable');
  assert.equal(discovery.transports.length, 1);
  assert.deepEqual(await service.userCall('startLanSearch'), { started: true });
  const retried = (await uiSnapshot(service)).lanSearch!;
  assert.equal(discovery.transports.length, 2);
  assert.equal(retried.foundCount, 0);
  assert.equal(retried.nodes[0].key, key);
  discovery.transport.announce();
  assert.equal((await uiSnapshot(service)).lanSearch!.foundCount, 1);
});

test('interface exclusion closes peer listeners while local MCP, identity and local messages survive', async (t) => {
  const service = await serviceFixture(t);
  await service.open();
  const before = service.snapshot();
  const certificate = await readFile(path.join(service.directory, 'node-cert.pem'), 'utf8');
  const socket = tls.connect({
    host: '127.0.0.1',
    port: service.network.port,
    rejectUnauthorized: false,
  });
  socket.on('error', () => {});
  socket.resume();
  t.after(() => socket.destroy());
  await new Promise<void>((resolve) => socket.once('secureConnect', resolve));
  const client = new Client({ name: 'isolated-exclusion-check', version: '1' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(before.mcpUrl), {
      requestInit: { headers: { authorization: 'Bearer ' + service.settings.value.localToken } },
    }),
  );
  t.after(() => client.close());
  const sender = service.connect({ nickname: 'Local sender', client: 'manual' });
  const receiver = service.connect({ nickname: 'Local receiver', client: 'manual' });
  if (sender.status !== 'connected' || receiver.status !== 'connected')
    throw new Error('Fixture binding failed');
  await service.userCall('saveNode', {
    nodeLabel: before.nodeLabel,
    networkExclusions: [{ name: 'loopback' }],
  });
  assert.equal(service.snapshot().running, true);
  assert.equal(service.snapshot().mcpUrl, before.mcpUrl);
  assert.deepEqual(service.snapshot().peerUrls, []);
  assert.equal(service.network.server, undefined);
  await waitFor(() => socket.destroyed, 3000);
  const status = await client.callTool({ name: 'node_status', arguments: {} });
  assert.ok(!status.isError);
  assert.equal((status.structuredContent as { running: boolean }).running, true);
  assert.equal(Object.hasOwn(status.structuredContent ?? {}, 'networkInterfaces'), false);
  const sent = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: before.nodeId,
    recipientNickname: 'Local receiver',
    text: 'Local exchange while peer listeners are disabled',
  });
  assert.equal(sent.accepted, true);
  assert.equal(
    service.store.get(sent.id, 'in')?.envelope.text,
    'Local exchange while peer listeners are disabled',
  );
  await service.userCall('saveNode', { nodeLabel: before.nodeLabel, networkExclusions: [] });
  assert.deepEqual(service.snapshot().peerUrls, before.peerUrls);
  assert.equal(service.snapshot().nodeId, before.nodeId);
  assert.equal(await readFile(path.join(service.directory, 'node-cert.pem'), 'utf8'), certificate);
});

async function waitFor(check: () => boolean, timeout = 10000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Isolated network check timed out');
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}

test('alternate proof verifies the pinned certificate and exact UUID without sending secrets', async (t) => {
  const a = await serviceFixture(t),
    b = await serviceFixture(t);
  await a.open();
  await b.open();
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  const peer = a.settings.value.peers[0];
  const probe = a.network as unknown as {
    verifyAlternate(value: typeof peer, address: string): Promise<void>;
  };
  const headers: import('node:http').IncomingHttpHeaders[] = [];
  let claimed = a.snapshot().nodeId;
  const server = https.createServer(
    { key: await readFile(path.join(b.directory, 'node-key.pem')), cert: peer.certificate },
    (request, response) => {
      headers.push(request.headers);
      response.writeHead(200);
      response.end(JSON.stringify({ nodeId: claimed }));
    },
  );
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = `wss://127.0.0.1:${(server.address() as { port: number }).port}/peer`;
  await assert.rejects(probe.verifyAlternate(peer, address), /does not match/);
  assert.ok(headers.every((value) => !value.authorization && !value['x-node-id']));
  claimed = peer.id;
  await probe.verifyAlternate(peer, address);
  assert.equal(a.settings.value.peers[0].address, peer.address);
  const wrongPin = {
    ...peer,
    certificate: await readFile(path.join(a.directory, 'node-cert.pem'), 'utf8'),
  };
  const before = headers.length;
  await assert.rejects(probe.verifyAlternate(wrongPin, address));
  assert.equal(
    headers.length,
    before,
    'A rejected TLS pin must prevent even the public HTTP request',
  );
});

test('authenticated alternate recovery keeps the configured route and logical peer after a port change', async (t) => {
  const a = await serviceFixture(t),
    b = await serviceFixture(t);
  await a.open();
  await b.open();
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  await waitFor(() => a.snapshot().peers[0]?.connected === true);
  const originalAddress = a.settings.value.peers[0].address;
  const certificate = a.settings.value.peers[0].certificate;
  const id = b.snapshot().nodeId;
  await b.stop();
  b.settings.value.peerPort = 0;
  await b.start();
  const alternate = b.snapshot().peerUrl;
  assert.notEqual(alternate, originalAddress);
  a.network.observeEndpoint({ nodeId: id, address: alternate });
  await waitFor(
    () =>
      a.snapshot().peers[0]?.connected === true &&
      a.snapshot().peers[0]?.activeAddress === alternate,
  );
  assert.equal(a.settings.value.peers.length, 1);
  assert.equal(a.settings.value.peers[0].address, originalAddress);
  assert.equal(a.settings.value.peers[0].certificate, certificate);
  assert.equal(a.snapshot().directories.filter((directory) => directory.nodeId === id).length, 1);
});

test('a saved exclusion is enforced against the last inventory when OS enumeration fails', async (t) => {
  const service = await serviceFixture(t);
  await service.open();
  t.mock.method(service.network as unknown as { inventory(): never }, 'inventory', () => {
    throw new Error('Isolated inventory failure');
  });
  await service.userCall('saveNode', {
    nodeLabel: service.snapshot().nodeLabel,
    networkExclusions: [{ name: 'loopback' }],
  });
  assert.deepEqual(service.network.endpoints, []);
  assert.equal(service.network.networkStatus().interfaces[0].excluded, true);
  assert.equal(service.network.networkStatus().inventoryError, 'Isolated inventory failure');
  assert.equal(service.snapshot().running, true);
});

test('discovered Pair rejects a changed claimed UUID before either peer is saved', async (t) => {
  const a = await serviceFixture(t),
    b = await serviceFixture(t);
  await a.open();
  await b.open();
  const code = b.network.accessCode().code;
  await assert.rejects(
    a.userCall('connectPeer', {
      address: b.snapshot().peerUrl,
      code,
      expectedNodeId: a.snapshot().nodeId,
    }),
    /does not match the selected/,
  );
  assert.equal(a.settings.value.peers.length, 0);
  assert.equal(b.settings.value.peers.length, 0);
  await a.userCall('connectPeer', {
    address: b.snapshot().peerUrl,
    code,
    expectedNodeId: b.snapshot().nodeId,
  });
  assert.equal(a.settings.value.peers[0].id, b.snapshot().nodeId);
});

function delayedPeerTempWrite(t: test.TestContext, filename: string) {
  const original = fsPromises.writeFile;
  let entered = false;
  let release!: () => void;
  const resumed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const write = t.mock.method(
    fsPromises,
    'writeFile',
    async (...args: Parameters<typeof fsPromises.writeFile>) => {
      await original(...args);
      if (
        !entered &&
        typeof args[0] === 'string' &&
        args[0].startsWith(filename + '.') &&
        args[0].endsWith('.tmp') &&
        typeof args[1] === 'string' &&
        JSON.parse(args[1]).peers?.length
      ) {
        entered = true;
        await resumed;
      }
    },
  );
  syncBuiltinESMExports();
  return {
    get entered() {
      return entered;
    },
    release,
    restore() {
      write.mock.restore();
      syncBuiltinESMExports();
    },
  };
}

test(
  'precommit fence: inbound interface exclusion during temp write cannot persist a peer',
  { timeout: 15000 },
  async (t) => {
    const a = await serviceFixture(t),
      b = await serviceFixture(t);
    await a.open();
    await b.open();
    const delay = delayedPeerTempWrite(t, b.settings.filename);
    let committed = 0;
    t.mock.method(
      b.network as unknown as { peerCommitted(id: string): void },
      'peerCommitted',
      () => {
        committed++;
      },
    );
    const joining = a.network.join(b.snapshot().peerUrl, b.network.accessCode().code).then(
      () => null,
      (error: unknown) => error,
    );
    let excluding: Promise<unknown> | undefined;
    try {
      await waitFor(() => delay.entered);
      excluding = b.userCall('saveNode', {
        nodeLabel: b.settings.value.nodeLabel,
        networkExclusions: [{ name: 'loopback' }],
      });
      await waitFor(() => b.settings.value.networkExclusions?.[0]?.name === 'loopback');
      await b.network.refreshInterfaces();
      assert.equal(b.network.endpoints.length, 0);
      delay.release();
      await Promise.all([joining, excluding]);
      assert.equal(b.settings.value.peers.length, 0);
      assert.equal(JSON.parse(await readFile(b.settings.filename, 'utf8')).peers.length, 0);
      assert.equal(committed, 0);
    } finally {
      delay.release();
      await Promise.allSettled([joining, ...(excluding ? [excluding] : [])]);
      delay.restore();
    }
  },
);

test(
  'precommit fence: outbound stop during temp write cannot persist a peer',
  { timeout: 15000 },
  async (t) => {
    const a = await serviceFixture(t),
      b = await serviceFixture(t);
    await a.open();
    await b.open();
    const delay = delayedPeerTempWrite(t, a.settings.filename);
    let committed = 0;
    t.mock.method(
      a.network as unknown as { peerCommitted(id: string): void },
      'peerCommitted',
      () => {
        committed++;
      },
    );
    const joining = a.network.join(b.snapshot().peerUrl, b.network.accessCode().code).then(
      () => null,
      (error: unknown) => error,
    );
    try {
      await waitFor(() => delay.entered);
      await a.stop();
      delay.release();
      const result = await joining;
      assert.ok(result instanceof Error);
      assert.equal(a.settings.value.peers.length, 0);
      assert.equal(JSON.parse(await readFile(a.settings.filename, 'utf8')).peers.length, 0);
      assert.equal(committed, 0);
      assert.equal(
        b.settings.value.peers.length,
        1,
        'The already-authorized remote side is not rolled back',
      );
    } finally {
      delay.release();
      await joining;
      delay.restore();
    }
  },
);

test('precommit fence: separate commit guard does not repeat a one-use beforeWrite callback', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-precommit-callback-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const settings = new SettingsFile(directory);
  await settings.load();
  let earlyCalls = 0,
    commitCalls = 0;
  await settings.savePeers(
    (current) => [...current],
    () => {
      earlyCalls++;
      assert.equal(earlyCalls, 1, 'The one-use callback must not run at the commit boundary');
    },
    () => {
      commitCalls++;
      assert.equal(earlyCalls, 1);
    },
  );
  assert.equal(earlyCalls, 1);
  assert.equal(commitCalls, 1);
});

for (const initiator of ['connector', 'receiver'] as const) {
  test(`first owner search finds both nodes after Disconnect from the ${initiator}`, async (t) => {
    const [aLan, bLan] = [discoveryFixture(), discoveryFixture()];
    const [a, b] = await Promise.all([
      serviceFixture(t, aLan.options),
      serviceFixture(t, bLan.options),
    ]);
    await Promise.all([a.open(), b.open()]);
    const [aId, bId] = [a.snapshot().nodeId, b.snapshot().nodeId];
    const disconnector = initiator === 'connector' ? a : b;
    const counterpart = disconnector === a ? b : a;
    const until = async (condition: () => boolean) => {
      for (let attempt = 0; attempt < 150 && !condition(); attempt++) await delay(20);
      assert.ok(condition());
    };
    await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
    await until(() =>
      Boolean(a.snapshot().peers[0]?.connected && b.snapshot().peers[0]?.connected),
    );
    const selected = (await uiSnapshot(disconnector)).peers[0];
    await disconnector.userCall('removePeer', {
      nodeId: selected.id,
      token: selected.removalToken,
    });
    for (const node of [a, b])
      assert.deepEqual(await node.userCall('startLanSearch'), { started: true });
    // Discovery fixtures use documentation addresses, never TCP destinations.
    t.mock.method(a.network, 'observeEndpoint', () => {});
    t.mock.method(b.network, 'observeEndpoint', () => {});
    aLan.transport.announce(bId, b.snapshot().nodeLabel);
    bLan.transport.announce(aId, a.snapshot().nodeLabel);
    await until(() => counterpart.settings.value.peers.length === 0);
    for (const [node, discovery, expected] of [
      [a, aLan, bId],
      [b, bLan, aId],
    ] as const) {
      discovery.advance(1000);
      assert.deepEqual(
        discovery.transport.sent.map(({ packet }) => packet.type),
        ['query', 'direct-query'],
      );
      const snapshot = await uiSnapshot(node);
      assert.equal(snapshot.lanSearch?.runId, 1);
      assert.equal(snapshot.lanSearch?.foundCount, 1);
      assert.deepEqual(
        unpairedLanNodes(snapshot).map((option) => option.nodeId),
        [expected],
      );
      assert.equal(snapshot.peerDisconnection?.id, expected);
      assert.deepEqual(snapshot.peers, []);
      assert.deepEqual((await new SettingsFile(node.settings.directory).load()).peers, []);
    }
  });
}

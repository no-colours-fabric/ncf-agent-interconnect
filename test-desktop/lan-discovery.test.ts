import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LanDiscovery,
  lanDiscoveryLimits,
  type LanDiscoveryOptions,
  type LanDiscoveryTransport,
  type LocalLanNode,
} from '../desktop/core/lan-discovery.js';

const localId = '00000000-0000-4000-8000-000000000001';
const remoteId = '00000000-0000-4000-8000-000000000002';
const secondId = '00000000-0000-4000-8000-000000000003';
const local = (): LocalLanNode => ({
  nodeId: localId,
  label: 'Local Mac',
  listener: { address: '192.168.4.10', port: 7336 },
});
const announce = (extra: Record<string, unknown> = {}) => ({
  service: 'ncf-agent-interconnect',
  version: 1,
  type: 'announce',
  nodeId: remoteId,
  label: 'Remote Ж 漢字',
  peerPort: 7336,
  ...extra,
});
const query = { service: 'ncf-agent-interconnect', version: 1, type: 'query' };
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value));

class FakeTransport implements LanDiscoveryTransport {
  handlers?: Parameters<LanDiscoveryTransport['start']>[0];
  sent: { packet: Record<string, unknown>; interfaceAddress?: string }[] = [];
  closed = false;
  startError = false;
  sendError = false;
  pending?: Promise<void>;
  async start(handlers: Parameters<LanDiscoveryTransport['start']>[0]) {
    this.handlers = handlers;
    if (this.startError) throw new Error('Isolated bind failure');
    await this.pending;
  }
  send(data: Uint8Array, interfaceAddress?: string) {
    if (this.sendError) throw new Error('Isolated send failure');
    this.sent.push({ packet: JSON.parse(Buffer.from(data).toString()), interfaceAddress });
  }
  stop() {
    this.closed = true;
  }
  receive(packet: unknown, source = '192.168.4.20') {
    this.handlers?.message(bytes(packet), source);
  }
}
function fixture(overrides: Partial<LanDiscoveryOptions> = {}) {
  let now = 0,
    changes = 0;
  const ticks = new Set<() => void>(),
    transports: FakeTransport[] = [];
  const options: LanDiscoveryOptions = {
    local: local(),
    interfaces: () => [{ address: '192.168.4.10', netmask: '255.255.255.0' }],
    transport: () => {
      const transport = new FakeTransport();
      transports.push(transport);
      return transport;
    },
    now: () => now,
    every: (callback) => {
      ticks.add(callback);
      return () => {
        ticks.delete(callback);
      };
    },
    changed: () => {
      changes++;
    },
    ...overrides,
  };
  const discovery = new LanDiscovery(options);
  return {
    discovery,
    transports,
    ticks,
    get changes() {
      return changes;
    },
    get transport() {
      return transports.at(-1)!;
    },
    advance(milliseconds: number) {
      now += milliseconds;
      for (const tick of [...ticks]) tick();
    },
  };
}

test('startup queries all interfaces, announces only the live listener and sends no private data', async () => {
  const f = fixture();
  await f.discovery.start();
  assert.deepEqual(f.transport.sent, [
    { packet: query, interfaceAddress: undefined },
    {
      packet: { ...announce(), nodeId: localId, label: 'Local Mac' },
      interfaceAddress: '192.168.4.10',
    },
  ]);
  assert.deepEqual(f.discovery.snapshot(), {
    state: 'searching',
    reason: null,
    announcement: { available: true, reason: null },
    nodes: [],
  });
  f.discovery.stop();
  assert.equal(f.transport.closed, true);
  assert.equal(f.ticks.size, 0);
});

test('a loopback-only node still receives discovery for outbound pairing', async () => {
  const f = fixture({ local: { ...local(), listener: { address: '127.0.0.1', port: 7336 } } });
  await f.discovery.start();
  f.transport.receive(announce());
  f.transport.receive(query);
  f.advance(10000);
  assert.equal(f.discovery.snapshot().nodes.length, 1);
  assert.deepEqual(f.discovery.snapshot().announcement, {
    available: false,
    reason: 'listener-local',
  });
  assert.ok(f.transport.sent.every(({ packet }) => packet.type === 'query'));
});

test('an absent listener is reported separately from discovered nodes', async () => {
  const f = fixture({ local: { ...local(), listener: null } });
  await f.discovery.start();
  f.transport.receive(announce());
  assert.equal(f.discovery.snapshot().state, 'searching');
  assert.equal(f.discovery.snapshot().announcement.reason, 'listener-unavailable');
  assert.equal(f.discovery.snapshot().nodes.length, 1);
});

test('multiple interfaces retain their own subnet boundaries and announce only a reachable listener', async () => {
  const f = fixture({
    interfaces: () => [
      { address: '192.168.4.10', netmask: '255.255.255.0' },
      { address: '10.3.0.10', netmask: '255.255.0.0' },
    ],
  });
  await f.discovery.start();
  f.transport.receive(announce(), '10.3.9.20');
  f.transport.receive(announce(), '10.4.9.20');
  assert.equal(f.discovery.snapshot().nodes.length, 1);
  assert.equal(f.discovery.snapshot().nodes[0].address, 'wss://10.3.9.20:7336/peer');
  assert.equal(f.transport.sent[0].interfaceAddress, undefined);
  assert.equal(f.transport.sent[1].interfaceAddress, '192.168.4.10');
  f.discovery.updateLocal({ ...local(), listener: { address: '10.3.0.10', port: 18888 } });
  f.advance(2000);
  assert.equal(f.transport.sent.at(-1)!.interfaceAddress, '10.3.0.10');
  assert.equal(f.transport.sent.at(-1)!.packet.peerPort, 18888);
});

test('invalid live listener endpoints and identity do not announce or suppress reception', async () => {
  const candidates = [
    { ...local(), listener: { address: '192.168.4.10', port: 0 } },
    { ...local(), listener: { address: '192.168.4.10', port: 65536 } },
    { ...local(), listener: { address: '192.168.5.10', port: 7336 } },
    { ...local(), nodeId: 'invalid' },
    { ...local(), label: 'line\nlabel' },
  ];
  for (const value of candidates) {
    const f = fixture({ local: value });
    await f.discovery.start();
    f.transport.receive(announce());
    assert.equal(f.discovery.snapshot().nodes.length, 1);
    assert.equal(f.discovery.snapshot().announcement.available, false);
    assert.ok(f.transport.sent.every(({ packet }) => packet.type === 'query'));
  }
});

test('discovery is unavailable with no suitable IPv4 interfaces and never opens transport', async () => {
  const f = fixture({
    interfaces: () => [
      { address: '127.0.0.1', netmask: '255.0.0.0' },
      { address: '::1', netmask: 'ffff:ffff::' },
      { address: '192.168.4.10', netmask: '0.0.0.0' },
      { address: '192.168.4.11', netmask: '255.0.255.0' },
    ],
  });
  await f.discovery.start();
  assert.equal(f.transports.length, 0);
  assert.equal(f.discovery.snapshot().reason, 'no-interfaces');
  assert.equal(f.discovery.snapshot().announcement.reason, 'no-interfaces');
});

test('same-subnet source determines the endpoint; duplicate announcements renew a fixed lease', async () => {
  const f = fixture();
  await f.discovery.start();
  f.transport.receive(announce());
  f.advance(20000);
  f.transport.receive(announce());
  const [node] = f.discovery.snapshot().nodes;
  assert.equal(node.address, 'wss://192.168.4.20:7336/peer');
  assert.equal(node.label, 'Remote Ж 漢字');
  assert.equal(f.discovery.snapshot().nodes.length, 1);
  f.advance(29999);
  assert.equal(f.discovery.snapshot().nodes.length, 1);
  f.advance(1);
  assert.deepEqual(f.discovery.snapshot().nodes, []);
  assert.equal(f.discovery.select(node.key), undefined);
});

test('a selected endpoint is immutable through rename, spoofed IDs, port changes and expiry', async () => {
  const f = fixture();
  await f.discovery.start();
  f.transport.receive(announce());
  const [node] = f.discovery.snapshot().nodes;
  const selected = f.discovery.select(node.key)!;
  assert.ok(Object.isFrozen(selected));
  f.transport.receive(announce({ label: 'Changed' }));
  f.transport.receive(announce({ peerPort: 9999 }));
  f.transport.receive(announce({ label: 'Spoofed' }), '192.168.4.30');
  assert.equal(f.discovery.snapshot().nodes.length, 3);
  assert.equal(selected.label, 'Remote Ж 漢字');
  assert.equal(selected.address, 'wss://192.168.4.20:7336/peer');
  assert.equal(f.discovery.select(node.key)?.label, 'Changed');
  f.advance(30000);
  assert.equal(selected.address, 'wss://192.168.4.20:7336/peer');
});

test('malformed, oversized, invalid UTF-8 and extra-field packets cannot add nodes', async () => {
  const f = fixture();
  await f.discovery.start();
  const invalid = [
    null,
    [],
    {},
    { ...announce(), service: 'other' },
    announce({ version: 2 }),
    announce({ type: 'pair' }),
    announce({ nodeId: 'not-a-uuid' }),
    announce({ peerPort: 0 }),
    announce({ peerPort: 65536 }),
    announce({ peerPort: 7.5 }),
    announce({ label: '' }),
    announce({ label: ' ' }),
    announce({ label: 'a'.repeat(121) }),
    announce({ label: 'line\nlabel' }),
    announce({ label: '\u202espoofed' }),
    announce({ address: 'wss://outside.example/peer' }),
    announce({ token: 'fixture-only' }),
    { ...query, nodeId: remoteId },
  ];
  for (const packet of invalid) {
    f.transport.receive(packet);
    f.advance(1000);
  }
  for (const data of [Buffer.alloc(1025), Buffer.from('{'), Buffer.from([0xff]), Buffer.alloc(0)]) {
    f.transport.handlers!.message(data, '192.168.4.20');
    f.advance(1000);
  }
  assert.deepEqual(f.discovery.snapshot().nodes, []);
});

test('off-link, local, multicast, network, broadcast and malformed sources are rejected', async () => {
  const f = fixture();
  await f.discovery.start();
  for (const source of [
    '192.168.5.20',
    '192.168.4.10',
    '127.0.0.1',
    '0.0.0.0',
    '239.255.73.36',
    '255.255.255.255',
    '192.168.4.0',
    '192.168.4.255',
    '::ffff:192.168.4.20',
    '192.168.4.20:7336',
    'outside.example',
    '192.168.4.999',
  ])
    f.transport.receive(announce(), source);
  f.transport.receive(announce({ nodeId: localId }));
  assert.deepEqual(f.discovery.snapshot().nodes, []);
});

test('per-source and global input budgets are bounded independently', async () => {
  const f = fixture();
  await f.discovery.start();
  for (let index = 0; index < 20; index++)
    f.transport.receive(announce({ peerPort: 1000 + index }));
  assert.equal(f.discovery.snapshot().nodes.length, lanDiscoveryLimits.sourcePacketsPerSecond);
  f.advance(1000);
  for (let index = 0; index < 100; index++)
    f.transport.receive(announce({ nodeId: secondId }), `192.168.4.${30 + index}`);
  assert.equal(f.discovery.snapshot().nodes.length, 8 + lanDiscoveryLimits.packetsPerSecond);
});

test('cache capacity is fixed and expired entries free capacity', async () => {
  const f = fixture();
  await f.discovery.start();
  for (let batch = 0; batch < 3; batch++) {
    for (let index = 0; index < 64; index++)
      f.transport.receive(announce({ peerPort: 1000 + batch }), `192.168.4.${30 + index}`);
    f.advance(1000);
  }
  assert.equal(f.discovery.snapshot().nodes.length, lanDiscoveryLimits.cacheEntries);
  f.advance(30000);
  f.transport.receive(announce());
  assert.equal(f.discovery.snapshot().nodes.length, 1);
});

test('query storms coalesce replies and cannot cause unicast reflection', async () => {
  const f = fixture();
  await f.discovery.start();
  for (let second = 0; second < 10; second++) {
    for (let index = 0; index < 100; index++) f.transport.receive(query);
    f.advance(1000);
  }
  const announcements = f.transport.sent.filter(({ packet }) => packet.type === 'announce');
  assert.equal(announcements.length, 6);
  assert.ok(announcements.every((entry) => entry.interfaceAddress === '192.168.4.10'));
  assert.equal(f.transport.sent.filter(({ packet }) => packet.type === 'query').length, 2);
});

test('announcement payload uses only explicit public identity fields', async () => {
  const value = { ...local(), token: 'private-fixture-token', code: 'private-fixture-code' };
  const f = fixture({ local: value });
  await f.discovery.start();
  const payload = f.transport.sent.find(({ packet }) => packet.type === 'announce')!.packet;
  assert.deepEqual(Object.keys(payload).sort(), [
    'label',
    'nodeId',
    'peerPort',
    'service',
    'type',
    'version',
  ]);
  assert.ok(Buffer.byteLength(JSON.stringify(payload)) <= lanDiscoveryLimits.packetBytes);
});

test('snapshot mutations cannot modify cache or later selections', async () => {
  const f = fixture();
  await f.discovery.start();
  f.transport.receive(announce());
  const [node] = f.discovery.snapshot().nodes;
  node.address = 'wss://changed.invalid/peer';
  assert.equal(f.discovery.select(node.key)!.address, 'wss://192.168.4.20:7336/peer');
});

test('updates stop announcement immediately without disabling reception', async () => {
  const f = fixture();
  await f.discovery.start();
  f.discovery.updateLocal({ ...local(), listener: null });
  f.transport.receive(announce());
  f.advance(10000);
  assert.equal(f.discovery.snapshot().nodes.length, 1);
  assert.equal(f.transport.sent.filter(({ packet }) => packet.type === 'announce').length, 1);
  f.discovery.updateLocal({ ...local(), label: 'Renamed' });
  f.advance(1000);
  assert.equal(f.transport.sent.at(-1)!.packet.label, 'Renamed');
});

test('transport failure clears stale nodes and exposes separate receive and announce failure', async () => {
  const f = fixture();
  await f.discovery.start();
  f.transport.receive(announce());
  f.transport.handlers!.failed();
  assert.deepEqual(f.discovery.snapshot(), {
    state: 'unavailable',
    reason: 'transport-error',
    announcement: { available: false, reason: 'transport-error' },
    nodes: [],
  });
  assert.equal(f.ticks.size, 0);
  assert.equal(f.transport.closed, true);
});

test('interface, factory, startup and send failures do not escape or leave a running timer', async () => {
  for (const mode of ['interfaces', 'factory', 'start', 'send']) {
    const transport = new FakeTransport();
    transport.startError = mode === 'start';
    transport.sendError = mode === 'send';
    const f = fixture({
      interfaces: () => {
        if (mode === 'interfaces') throw new Error('Isolated interface failure');
        return [{ address: '192.168.4.10', netmask: '255.255.255.0' }];
      },
      transport: () => {
        if (mode === 'factory') throw new Error('Isolated factory failure');
        return transport;
      },
    });
    await f.discovery.start();
    assert.equal(f.discovery.snapshot().reason, 'transport-error');
    assert.equal(f.ticks.size, 0);
  }
});

test('stopped and superseded transports cannot repopulate the cache or poison a new session', async () => {
  const f = fixture();
  await f.discovery.start();
  const previous = f.transport;
  await f.discovery.start();
  previous.receive(announce());
  previous.handlers!.failed();
  assert.equal(f.discovery.snapshot().state, 'searching');
  assert.deepEqual(f.discovery.snapshot().nodes, []);
  f.transport.receive(announce());
  assert.equal(f.discovery.snapshot().nodes.length, 1);
  f.discovery.stop();
  f.transport.receive(announce());
  assert.deepEqual(f.discovery.snapshot().nodes, []);
});

test('stop during startup fences late completion and leaves no scheduled work', async () => {
  let finish!: () => void;
  const transport = new FakeTransport();
  transport.pending = new Promise((resolve) => {
    finish = resolve;
  });
  const f = fixture({ transport: () => transport });
  const starting = f.discovery.start();
  f.discovery.stop();
  finish();
  await starting;
  assert.equal(f.discovery.snapshot().state, 'stopped');
  assert.equal(transport.closed, true);
  assert.equal(f.ticks.size, 0);
  assert.equal(transport.sent.length, 0);
});

test('packet floods notify consumers at most once per timer tick', async () => {
  const f = fixture();
  await f.discovery.start();
  const before = f.changes;
  for (let index = 0; index < 64; index++)
    f.transport.receive(announce(), `192.168.4.${30 + index}`);
  assert.equal(f.changes, before);
  f.advance(1000);
  assert.equal(f.changes, before + 1);
});

test('search-control: query gating and deadline leave listener announcements independent', async () => {
  const f = fixture({ querying: false });
  await f.discovery.start();
  assert.deepEqual(
    f.transport.sent.map(({ packet }) => packet.type),
    ['announce'],
  );
  f.discovery.setQuerying(true, 30000);
  assert.equal(f.transport.sent.filter(({ packet }) => packet.type === 'query').length, 1);
  f.discovery.setQuerying(false);
  f.transport.receive(query);
  f.advance(2000);
  assert.equal(f.transport.sent.filter(({ packet }) => packet.type === 'announce').length, 2);
  f.discovery.setQuerying(true, 30000);
  assert.equal(f.transport.sent.filter(({ packet }) => packet.type === 'query').length, 2);
  f.advance(28000);
  assert.equal(f.transport.sent.filter(({ packet }) => packet.type === 'query').length, 2);
  assert.equal(f.discovery.snapshot().announcement.available, true);
  f.discovery.stop();
});

test('search-control: observation follows strict packet and source validation, including duplicates', async () => {
  const observed: Readonly<{ key: string; nodeId: string; label: string; address: string }>[] = [];
  const f = fixture({ querying: false, observed: (node) => observed.push(node) });
  await f.discovery.start();
  f.transport.receive(announce(), '127.0.0.1');
  f.transport.receive(announce(), '198.51.100.20');
  f.transport.receive(announce(), '192.168.4.10');
  f.transport.receive(announce({ token: 'never-observed' }));
  f.transport.receive(announce({ version: 2 }));
  f.transport.receive(announce({ peerPort: 0 }));
  f.transport.handlers!.message(Uint8Array.from([255]), '192.168.4.20');
  assert.equal(observed.length, 0);
  f.advance(1000);
  f.transport.receive(announce());
  f.transport.receive(announce());
  assert.equal(observed.length, 2);
  assert.equal(Object.isFrozen(observed[0]), true);
  assert.deepEqual(Object.keys(observed[0]).sort(), ['address', 'key', 'label', 'nodeId']);
  assert.equal(observed[0].address, 'wss://192.168.4.20:7336/peer');
  assert.deepEqual(observed[0], observed[1]);
  f.discovery.stop();
});

test('search-control: rate-rejected announcements never reach the observer', async () => {
  let observed = 0;
  const f = fixture({
    querying: false,
    observed: () => {
      observed++;
    },
  });
  await f.discovery.start();
  for (let index = 0; index < 20; index++) f.transport.receive(announce());
  assert.equal(observed, lanDiscoveryLimits.sourcePacketsPerSecond);
  f.advance(1000);
  f.transport.receive(announce());
  assert.equal(observed, lanDiscoveryLimits.sourcePacketsPerSecond + 1);
  f.discovery.stop();
});

import test, { after, mock } from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { syncBuiltinESMExports } from 'node:module';
import { LanSearch, lanSearchLimits } from '../desktop/core/lan-search.js';
import { lanDiscoveryLimits, type LanDiscoveryTransport } from '../desktop/core/lan-discovery.js';

const udp = mock.method(dgram, 'createSocket', () => assert.fail('Real UDP is forbidden'));
syncBuiltinESMExports();
after(() => {
  try {
    assert.equal(udp.mock.callCount(), 0);
  } finally {
    udp.mock.restore();
    syncBuiltinESMExports();
  }
});

const localId = '00000000-0000-4000-8000-000000000001';
const remoteId = (index = 0) =>
  `00000000-0000-4000-8000-${(index + 2).toString(16).padStart(12, '0')}`;
const announcement = (index = 0, label = 'Remote computer') => ({
  service: 'ncf-agent-interconnect',
  version: 1,
  type: 'announce',
  nodeId: remoteId(index),
  label,
  peerPort: 7336,
});
class Transport implements LanDiscoveryTransport {
  handlers?: Parameters<LanDiscoveryTransport['start']>[0];
  packets: Record<string, unknown>[] = [];
  stopped = false;
  error = false;
  pending?: Promise<void>;
  release?: () => void;
  async start(handlers: Parameters<LanDiscoveryTransport['start']>[0]): Promise<void> {
    this.handlers = handlers;
    if (this.error) throw new Error('Isolated start failure');
    await this.pending;
  }
  send(data: Uint8Array): void {
    this.packets.push(JSON.parse(Buffer.from(data).toString()));
  }
  stop(): void {
    this.stopped = true;
    this.release?.();
  }
  receive(index = 0, source = '192.0.2.20', label?: string): void {
    this.handlers?.message(Buffer.from(JSON.stringify(announcement(index, label))), source);
  }
}
function fixture(
  t: test.TestContext,
  options: { loopback?: boolean; interfaces?: boolean; pending?: boolean; error?: boolean } = {},
) {
  let now = 0,
    changes = 0;
  const ticks = new Set<() => void>();
  const transports: Transport[] = [];
  const paired: string[] = [];
  const search = new LanSearch({
    local: {
      nodeId: localId,
      label: 'Local computer',
      listener: { address: options.loopback ? '127.0.0.1' : '192.0.2.10', port: 7336 },
    },
    now: () => now,
    interfaces: () =>
      options.interfaces === false ? [] : [{ address: '192.0.2.10', netmask: '255.255.255.0' }],
    every: (callback) => {
      ticks.add(callback);
      return () => {
        ticks.delete(callback);
      };
    },
    transport: () => {
      const transport = new Transport();
      transport.error = !!options.error;
      if (options.pending)
        transport.pending = new Promise((resolve) => {
          transport.release = resolve;
        });
      transports.push(transport);
      return transport;
    },
    changed: () => {
      changes++;
    },
    pairedNodeIds: () => paired,
  });
  t.after(() => search.close());
  return {
    search,
    ticks,
    paired,
    transports,
    get transport() {
      return transports.at(-1)!;
    },
    get changes() {
      return changes;
    },
    advance(milliseconds: number) {
      now += milliseconds;
      for (const tick of [...ticks]) tick();
    },
    setTime(value: number) {
      now = value;
    },
    announceMany(first: number, count: number) {
      for (let index = 0; index < count; index++) {
        if (index && index % 64 === 0) {
          now += 1000;
          for (const tick of [...ticks]) tick();
        }
        transports.at(-1)!.receive(first + index, `192.0.2.${20 + Math.floor((index % 128) / 8)}`);
      }
    },
  };
}

test('transport announcement stays active before, during and after a bounded owner search', async (t) => {
  const f = fixture(t);
  await f.search.open();
  assert.equal(f.search.snapshot().phase, 'stopped');
  assert.deepEqual(
    f.transport.packets.map((packet) => packet.type),
    ['announce'],
  );
  f.transport.receive();
  assert.equal(f.search.snapshot().nodes.length, 0);
  assert.equal(f.search.startSearch(), true);
  assert.equal(f.transport.packets.filter((packet) => packet.type === 'query').length, 1);
  f.transport.receive();
  f.advance(lanSearchLimits.durationMs);
  assert.equal(f.search.snapshot().phase, 'complete');
  assert.equal(f.search.snapshot().elapsedMs, 30000);
  assert.equal(f.search.snapshot().foundCount, 1);
  // The engine tick runs first: its deadline must still prevent a query at 30s.
  assert.equal(f.transport.packets.filter((packet) => packet.type === 'query').length, 1);
  assert.equal(f.transport.packets.filter((packet) => packet.type === 'announce').length, 2);
  assert.equal(f.transport.stopped, false);
});

test('cached records do not count until a fresh accepted response; duplicate responses count once', async (t) => {
  const f = fixture(t);
  await f.search.open();
  f.search.startSearch();
  f.transport.receive();
  f.transport.receive();
  assert.equal(f.search.snapshot().foundCount, 1);
  f.advance(2000);
  f.search.stopSearch();
  const original = f.search.snapshot().nodes[0];
  f.search.startSearch();
  assert.equal(f.search.snapshot().foundCount, 0);
  assert.equal(f.search.snapshot().nodes[0].observedInRun, false);
  assert.equal(f.search.snapshot().nodes[0].newlyFound, false);
  f.transport.receive();
  f.transport.receive();
  assert.equal(f.search.snapshot().foundCount, 1);
  assert.equal(f.search.snapshot().nodes[0].observedInRun, true);
  assert.equal(f.search.snapshot().nodes[0].address, original.address);
  assert.equal(f.search.snapshot().unseenKeys.length, 1);
});

test('Stop keeps results and unseen state while queries stop and listener replies continue', async (t) => {
  const f = fixture(t);
  await f.search.open();
  f.search.startSearch();
  f.transport.receive();
  f.advance(5000);
  f.search.stopSearch();
  const stopped = f.search.snapshot();
  assert.equal(stopped.elapsedMs, 5000);
  f.transport.receive(1);
  f.advance(15000);
  assert.deepEqual(
    f.search.snapshot().nodes.map((node) => node.key),
    stopped.nodes.map((node) => node.key),
  );
  assert.equal(f.search.snapshot().phase, 'stopped');
  assert.equal(f.search.snapshot().elapsedMs, 5000);
  assert.equal(f.transport.packets.filter((packet) => packet.type === 'query').length, 1);
  assert.ok(f.transport.packets.filter((packet) => packet.type === 'announce').length > 1);
  assert.deepEqual(f.search.snapshot().unseenKeys, stopped.unseenKeys);
});

test('acknowledgement affects only displayed keys; later nodes and paired nodes have separate semantics', async (t) => {
  const f = fixture(t);
  await f.search.open();
  f.search.startSearch();
  f.transport.receive();
  const displayed = f.search.snapshot().unseenKeys;
  f.transport.receive(1);
  f.search.acknowledge([...displayed, 'missing-key']);
  const pending = f.search.snapshot().unseenKeys;
  assert.equal(pending.length, 1);
  assert.notEqual(pending[0], displayed[0]);
  f.paired.push(remoteId(1));
  assert.deepEqual(f.search.snapshot().unseenKeys, []);
  assert.equal(f.search.snapshot().nodes.length, 2);
  assert.equal(f.search.snapshot().foundCount, 2);
});

test('query deadline is monotonic, including delayed ticks and a backwards injected clock', async (t) => {
  const f = fixture(t);
  await f.search.open();
  f.search.startSearch();
  f.advance(10000);
  f.setTime(1000);
  assert.equal(f.search.snapshot().elapsedMs, 10000);
  f.setTime(30000);
  assert.equal(f.search.snapshot().phase, 'complete');
  f.transport.receive();
  assert.equal(f.search.snapshot().foundCount, 0);
  assert.equal(f.search.snapshot().nodes.length, 0);
});

test('retry cannot generate a burst of queries', async (t) => {
  const f = fixture(t);
  await f.search.open();
  for (let index = 0; index < 20; index++) {
    f.search.startSearch();
    f.search.stopSearch();
  }
  assert.equal(f.transport.packets.filter((packet) => packet.type === 'query').length, 1);
  f.search.startSearch();
  f.advance(1000);
  assert.equal(f.transport.packets.filter((packet) => packet.type === 'query').length, 2);
  assert.equal(f.search.snapshot().elapsedMs, 1000);
});

test('results, known keys and unseen state are capped and expire without affecting peer configuration', async (t) => {
  const f = fixture(t);
  await f.search.open();
  f.search.startSearch();
  f.announceMany(0, 128);
  assert.equal(lanSearchLimits.durationMs, lanDiscoveryLimits.cacheMs);
  assert.equal(f.search.snapshot().nodes.length, 128);
  assert.equal(f.search.snapshot().foundCount, 128);
  assert.equal(f.search.snapshot().unseenKeys.length, 128);
  f.search.stopSearch();
  f.advance(31000);
  f.search.startSearch();
  f.announceMany(128, 128);
  assert.equal(f.search.snapshot().nodes.length, 128);
  assert.equal(f.search.snapshot().unseenKeys.length, 128);
  assert.equal(f.search.snapshot().foundCount, 128);
  assert.ok(f.search.snapshot().nodes.every((node) => node.newlyFound));
  assert.deepEqual(f.paired, []);
  f.search.stopSearch();
  f.advance(lanSearchLimits.retentionMs);
  assert.deepEqual(f.search.snapshot().nodes, []);
  assert.deepEqual(f.search.snapshot().unseenKeys, []);
});

test('transport failure preserves owner-visible observations and reports unavailability without retry', async (t) => {
  const f = fixture(t);
  await f.search.open();
  f.search.startSearch();
  f.transport.receive();
  f.transport.handlers!.failed();
  assert.equal(f.search.snapshot().phase, 'unavailable');
  assert.equal(f.search.snapshot().reason, 'transport-error');
  assert.equal(f.search.snapshot().nodes.length, 1);
  assert.equal(f.search.startSearch(), false);
  assert.equal(f.transports.length, 1);
});

test('missing interfaces and transport startup failure never create an automatic search', async (t) => {
  for (const options of [{ interfaces: false }, { error: true }]) {
    const f = fixture(t, options);
    await f.search.open();
    assert.equal(f.search.snapshot().phase, 'unavailable');
    assert.equal(f.search.startSearch(), false);
    assert.equal(f.search.snapshot().foundCount, 0);
    assert.equal(f.search.snapshot().nodes.length, 0);
  }
});

test('loopback announcement does not prevent receiving a valid search result', async (t) => {
  const f = fixture(t, { loopback: true });
  await f.search.open();
  f.search.startSearch();
  f.transport.receive();
  f.advance(1000);
  assert.equal(f.search.snapshot().foundCount, 1);
  assert.equal(f.search.discoverySnapshot().announcement.reason, 'listener-local');
  assert.ok(f.transport.packets.every((packet) => packet.type === 'query'));
});

test('close cancels pending start, timers and stale callbacks without producing a search', async (t) => {
  const f = fixture(t, { pending: true });
  const opening = f.search.open();
  f.search.close();
  await opening;
  f.transport.receive();
  f.advance(60000);
  assert.equal(f.search.snapshot().phase, 'stopped');
  assert.equal(f.search.snapshot().foundCount, 0);
  assert.equal(f.search.startSearch(), false);
  assert.equal(f.transport.stopped, true);
  assert.equal(f.ticks.size, 0);
});

test('returned snapshots cannot mutate retained identity, results or acknowledgement state', async (t) => {
  const f = fixture(t);
  await f.search.open();
  f.search.startSearch();
  f.transport.receive();
  const snapshot = f.search.snapshot();
  snapshot.nodes[0].address = 'wss://different.example/peer';
  snapshot.nodes.length = 0;
  snapshot.unseenKeys.length = 0;
  const current = f.search.snapshot();
  assert.equal(current.nodes[0].address, 'wss://192.0.2.20:7336/peer');
  assert.equal(current.unseenKeys.length, 1);
});

test('explicit retry after transport failure retains prior results and requires a new response to count', async (t) => {
  const f = fixture(t);
  await f.search.open();
  f.search.startSearch();
  f.transport.receive();
  const original = f.search.snapshot().nodes[0];
  f.transport.handlers!.failed();
  await f.search.open();
  assert.equal(f.transports.length, 2);
  assert.equal(f.search.snapshot().nodes[0].key, original.key);
  f.search.startSearch();
  assert.equal(f.search.snapshot().foundCount, 0);
  assert.equal(f.search.snapshot().unseenKeys.length, 1);
  f.transport.receive();
  assert.equal(f.search.snapshot().foundCount, 1);
  assert.equal(f.search.snapshot().nodes[0].address, original.address);
});

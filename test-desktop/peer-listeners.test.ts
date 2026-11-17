import test from 'node:test';
import assert from 'node:assert/strict';
import { PeerListeners } from '../desktop/core/peer-listeners.js';

function fixture() {
  const handles: { address: string; port: number; closed: boolean; close(): Promise<void> }[] = [];
  const failures = new Map<string, string>();
  let fallback = 0;
  const manager = new PeerListeners({
    bind: async (address, port) => {
      const code = failures.get(address);
      if (code) throw Object.assign(new Error(code), { code });
      const handle = {
        address,
        port: port || 18001,
        closed: false,
        async close() {
          this.closed = true;
        },
      };
      handles.push(handle);
      return handle;
    },
    fallback: () => {
      fallback++;
    },
  });
  return {
    manager,
    handles,
    failures,
    get fallback() {
      return fallback;
    },
  };
}
test('adds/removes destinations without closing unaffected handles or moving the common port', async () => {
  const f = fixture();
  await f.manager.start(['192.0.2.10', '127.0.0.1'], 7336);
  const loopback = f.handles.find((h) => h.address === '127.0.0.1')!;
  const update = f.manager.update(['127.0.0.1', '198.51.100.10']);
  assert.equal(f.manager.allows('192.0.2.10'), false);
  await update;
  assert.equal(loopback.closed, false);
  assert.equal(f.handles.find((h) => h.address === '192.0.2.10')!.closed, true);
  assert.ok(f.manager.snapshot().every((s) => s.port === 7336 && s.state === 'listening'));
  await f.manager.close();
  assert.ok(f.handles.every((h) => h.closed));
});
test('bind failures are visible and retried without restarting healthy listeners', async () => {
  const f = fixture();
  await f.manager.start(['127.0.0.1'], 0);
  f.failures.set('192.0.2.10', 'EADDRNOTAVAIL');
  await f.manager.update(['127.0.0.1', '192.0.2.10']);
  assert.equal(f.manager.snapshot()[1].state, 'error');
  assert.equal(f.handles[0].closed, false);
  f.failures.clear();
  await f.manager.update(['127.0.0.1', '192.0.2.10']);
  assert.ok(f.manager.snapshot().every((s) => s.state === 'listening' && s.port === 18001));
  assert.equal(f.handles.length, 2);
  await f.manager.close();
});
test('startup conflict has one common-port fallback; all-excluded remains recoverable', async () => {
  let count = 0;
  const ports: number[] = [];
  const manager = new PeerListeners({
    bind: async (_address, port) => {
      ports.push(port);
      if (port === 7336) throw Object.assign(new Error('occupied'), { code: 'EADDRINUSE' });
      return { port: port || 18002, close: async () => {} };
    },
    fallback: () => {
      count++;
    },
  });
  await manager.start(['127.0.0.1', '192.0.2.1'], 7336);
  assert.equal(count, 1);
  assert.equal(manager.port, 18002);
  assert.deepEqual(ports, [7336, 7336, 0, 18002]);
  await manager.update([]);
  assert.deepEqual(manager.snapshot(), []);
  await manager.update(['127.0.0.1']);
  assert.equal(manager.snapshot()[0].port, 18002);
  await manager.close();
});
test('late bind completions after exclusion and stop are closed, never published', async () => {
  let release!: () => void;
  let closed = 0;
  const manager = new PeerListeners({
    bind: async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return {
        port: 7336,
        close: async () => {
          closed++;
        },
      };
    },
  });
  const starting = manager.start(['192.0.2.1'], 7336);
  while (!release) await new Promise<void>((resolve) => setImmediate(resolve));
  const updating = manager.update([]);
  const stopping = manager.close();
  release();
  await Promise.all([starting, updating, stopping]);
  assert.equal(closed, 1);
  assert.equal(manager.allows('192.0.2.1'), false);
  assert.deepEqual(manager.snapshot(), []);
});

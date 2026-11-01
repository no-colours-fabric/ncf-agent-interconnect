import test from 'node:test';
import assert from 'node:assert/strict';
import { StartupLifecycle } from '../desktop/main/startup-lifecycle.js';

function fixture() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const opening = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const order: string[] = [],
    windows: (string | undefined)[] = [];
  let serviceReady = false,
    ipcReady = false;
  const lifecycle = new StartupLifecycle((tab) => {
    assert.ok(serviceReady, 'the service must be ready before creating the renderer');
    assert.ok(ipcReady, 'IPC must be registered before creating the renderer');
    order.push('window');
    windows.push(tab);
  });
  return {
    lifecycle,
    order,
    windows,
    resolve,
    reject,
    start: (openByDefault: boolean) =>
      lifecycle.start(
        async () => {
          order.push('service-open');
          await opening;
          serviceReady = true;
          order.push('service-ready');
        },
        () => {
          ipcReady = true;
          order.push('ipc');
        },
        openByDefault,
      ),
  };
}

test('early activate, second-instance and tray requests wait for service and IPC readiness', async () => {
  const f = fixture();
  f.lifecycle.requestOpen();
  const starting = f.start(true);
  f.lifecycle.requestOpen('settings');
  f.lifecycle.requestOpen();
  f.lifecycle.requestOpen();
  assert.deepEqual(f.order, ['service-open']);
  assert.deepEqual(f.windows, []);
  f.resolve();
  await starting;
  assert.deepEqual(f.order, ['service-open', 'service-ready', 'ipc', 'window']);
  assert.deepEqual(f.windows, ['settings']);
});

test('the latest explicit tab survives later generic and default open requests', async () => {
  const f = fixture();
  f.lifecycle.requestOpen('settings');
  const starting = f.start(true);
  f.lifecycle.requestOpen('mcp');
  f.lifecycle.requestOpen();
  f.resolve();
  await starting;
  assert.deepEqual(f.windows, ['mcp']);
  f.lifecycle.requestOpen('agents');
  assert.deepEqual(f.windows, ['mcp', 'agents']);
});

test('foreground startup opens once after readiness without an explicit request', async () => {
  const f = fixture(),
    starting = f.start(true);
  assert.deepEqual(f.windows, []);
  f.resolve();
  await starting;
  assert.deepEqual(f.windows, [undefined]);
});

test('background or login startup stays hidden until an explicit request', async () => {
  const f = fixture(),
    starting = f.start(false);
  f.resolve();
  await starting;
  assert.deepEqual(f.order, ['service-open', 'service-ready', 'ipc']);
  assert.deepEqual(f.windows, []);
  f.lifecycle.requestOpen('settings');
  assert.deepEqual(f.windows, ['settings']);
});

test('an explicit request during background startup opens once when ready', async () => {
  const f = fixture(),
    starting = f.start(false);
  f.lifecycle.requestOpen('settings');
  f.lifecycle.requestOpen();
  f.resolve();
  await starting;
  assert.deepEqual(f.windows, ['settings']);
});

test('quit before startup cancels pending requests without opening the service', async () => {
  const f = fixture();
  f.lifecycle.requestOpen('settings');
  f.lifecycle.stop();
  f.lifecycle.requestOpen();
  await f.start(true);
  assert.deepEqual(f.order, []);
  assert.deepEqual(f.windows, []);
});

test('quit during service startup prevents late IPC registration and window creation', async () => {
  const f = fixture(),
    starting = f.start(true);
  f.lifecycle.requestOpen('settings');
  f.lifecycle.stop();
  f.resolve();
  await starting;
  f.lifecycle.requestOpen();
  await f.start(true);
  assert.deepEqual(f.order, ['service-open', 'service-ready']);
  assert.deepEqual(f.windows, []);
});

test('startup failure discards pending opens and cannot be restarted by later events', async () => {
  const f = fixture(),
    starting = f.start(true),
    failure = new Error('Service startup failed');
  f.lifecycle.requestOpen('settings');
  f.reject(failure);
  await assert.rejects(starting, (error) => error === failure);
  f.lifecycle.requestOpen();
  await f.start(true);
  assert.deepEqual(f.order, ['service-open']);
  assert.deepEqual(f.windows, []);
});

test('IPC registration failure prevents a pending window from opening', async () => {
  const windows: (string | undefined)[] = [],
    lifecycle = new StartupLifecycle((tab) => windows.push(tab)),
    failure = new Error('IPC registration failed');
  lifecycle.requestOpen('settings');
  await assert.rejects(
    lifecycle.start(
      async () => {},
      () => {
        throw failure;
      },
      true,
    ),
    (error) => error === failure,
  );
  lifecycle.requestOpen();
  assert.deepEqual(windows, []);
});

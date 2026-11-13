import test from 'node:test';
import assert from 'node:assert/strict';
import { UiServiceAccess } from '../desktop/main/ui-service-access.js';

test('UI shutdown fences new calls and delayed routing or dialog continuations before closed-store access', async () => {
  let quitting = false;
  let storeClosed = false;
  let serviceCalls = 0;
  const service = {
    snapshot() {
      serviceCalls++;
      if (storeClosed) throw new Error('database is not open');
      return { running: true };
    },
  };
  let current: typeof service | null = service;
  const access = new UiServiceAccess(
    () => current,
    () => quitting,
  );
  assert.deepEqual(await access.waitFor(async () => ({ handled: false })), { handled: false });
  assert.deepEqual(access.current().snapshot(), { running: true });

  for (const phase of ['setup route', 'dialog']) {
    quitting = false;
    storeClosed = false;
    let complete!: () => void;
    const barrier = new Promise<void>((resolve) => {
      complete = resolve;
    });
    let operationCompleted = false;
    const delayed = access
      .waitFor(async () => {
        await barrier;
        operationCompleted = true;
        return phase;
      })
      .then(() => access.current().snapshot());
    quitting = true;
    storeClosed = true;
    complete();
    await assert.rejects(delayed, { message: 'The node is not running' });
    assert.equal(
      operationCompleted,
      true,
      'The guard does not cancel an operation already started',
    );
    assert.equal(serviceCalls, 1, 'No delayed continuation may touch the closed store');
  }

  let routed = false;
  await assert.rejects(
    access.waitFor(async () => {
      routed = true;
    }),
    { message: 'The node is not running' },
  );
  assert.equal(routed, false, 'New calls are rejected before routing');
  assert.throws(() => access.current().snapshot(), { message: 'The node is not running' });
  assert.equal(serviceCalls, 1);

  quitting = false;
  current = null;
  assert.throws(() => access.current(), { message: 'The node is not running' });
  current = service;
  storeClosed = false;
  const original = new Error('Dialog failed');
  await assert.rejects(
    access.waitFor(async () => {
      throw original;
    }),
    (error) => error === original,
  );
  assert.deepEqual(access.current().snapshot(), { running: true });
  assert.equal(serviceCalls, 2, 'Ordinary service access is unchanged');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { LanSearchLifecycle } from '../desktop/main/lan-search-lifecycle.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('window search: hidden/login startup does not query; show/restore starts once per actual visible epoch', () => {
  let starts = 0;
  const lifecycle = new LanSearchLifecycle(async (current) => {
    if (current()) starts++;
  });
  lifecycle.setVisible(false);
  lifecycle.setVisible(false);
  assert.equal(starts, 0);
  lifecycle.setVisible(true);
  lifecycle.setVisible(true);
  lifecycle.setVisible(true);
  assert.equal(starts, 1, 'focus, navigation and a repeated show do not restart');
  lifecycle.setVisible(false);
  assert.equal(starts, 1, 'hiding does not issue another query or cancel the ongoing pass');
  lifecycle.setVisible(true);
  assert.equal(starts, 2, 'a real restore/reopen creates one new epoch');
});

test('window search: Stop supersedes a pending start and persists through focus/page events', async () => {
  const ready = deferred();
  let starts = 0;
  const lifecycle = new LanSearchLifecycle(async (current) => {
    await ready.promise;
    if (current()) starts++;
  });
  lifecycle.setVisible(true);
  lifecycle.supersede();
  lifecycle.setVisible(true);
  ready.resolve();
  await ready.promise;
  assert.equal(starts, 0);
  lifecycle.setVisible(true);
  assert.equal(starts, 0);
  lifecycle.setVisible(false);
  lifecycle.setVisible(true);
  await Promise.resolve();
  assert.equal(starts, 1);
});

test('window search: explicit retry replaces a pending automatic request without a second auto-start', async () => {
  const ready = deferred();
  let starts = 0;
  const lifecycle = new LanSearchLifecycle(async (current) => {
    await ready.promise;
    if (current()) starts++;
  });
  lifecycle.setVisible(true);
  lifecycle.supersede();
  starts++; // The explicit UI Start is routed through the existing service method.
  ready.resolve();
  await ready.promise;
  lifecycle.setVisible(true);
  assert.equal(starts, 1);
});

test('window search: hidden/replaced epochs reject late callbacks while the current one can proceed', async () => {
  const first = deferred(),
    second = deferred();
  let requests = 0,
    starts = 0;
  const lifecycle = new LanSearchLifecycle(async (current) => {
    const ready = ++requests === 1 ? first : second;
    await ready.promise;
    if (current()) starts++;
  });
  lifecycle.setVisible(true);
  lifecycle.setVisible(false);
  lifecycle.setVisible(true);
  first.resolve();
  await first.promise;
  assert.equal(starts, 0);
  second.resolve();
  await second.promise;
  assert.equal(starts, 1);
});

test('window search: dispose/quit invalidates pending readiness and all later window events', async () => {
  const ready = deferred();
  let starts = 0;
  const lifecycle = new LanSearchLifecycle(async (current) => {
    await ready.promise;
    if (current()) starts++;
  });
  lifecycle.setVisible(true);
  lifecycle.close();
  lifecycle.setVisible(false);
  lifecycle.setVisible(true);
  ready.resolve();
  await ready.promise;
  assert.equal(starts, 0);
});

test('window search: rejected or synchronous failed starts never retry until a new actual open', async () => {
  for (const synchronous of [false, true]) {
    let requests = 0;
    const lifecycle = new LanSearchLifecycle(() => {
      requests++;
      if (synchronous) throw new Error('Injected start failure');
      return Promise.reject(new Error('Injected start failure'));
    });
    lifecycle.setVisible(true);
    await Promise.resolve();
    lifecycle.setVisible(true);
    assert.equal(requests, 1);
    lifecycle.setVisible(false);
    lifecycle.setVisible(true);
    await Promise.resolve();
    assert.equal(requests, 2);
  }
});

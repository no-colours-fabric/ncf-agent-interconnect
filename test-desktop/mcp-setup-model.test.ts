import test from 'node:test';
import assert from 'node:assert/strict';
import { McpSetupFlow } from '../desktop/renderer/mcp-setup-model.js';
import type { McpSetupInvoke, McpSetupPreview } from '../desktop/shared/mcp-setup.js';

const plan = (id: string, replace = false): McpSetupPreview => ({
  client: 'cursor',
  planId: id,
  expiresAt: '2030-01-01T00:00:00.000Z',
  requiresReplacement: replace,
  files: [
    {
      id: 'configuration',
      path: '/isolated/mcp.json',
      action: 'create',
      changes: [],
    },
  ],
});
const defaults = {
  client: 'cursor',
  files: [{ id: 'configuration', path: '/isolated/mcp.json', format: 'jsonc', alternatives: [] }],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('opening prepares a read-only preview; cancel discards it without Apply', async () => {
  const calls: string[] = [];
  const flow = new McpSetupFlow('cursor', (async (method: string) => {
    calls.push(method);
    return method === 'mcpSetupDefaults'
      ? defaults
      : method === 'mcpSetupPreview'
        ? plan('first')
        : {};
  }) as McpSetupInvoke);
  await flow.begin();
  assert.deepEqual(calls, ['mcpSetupDefaults', 'mcpSetupPreview']);
  assert.equal(flow.getSnapshot().preview?.planId, 'first');
  flow.cancel();
  assert.equal(flow.getSnapshot().open, false);
  assert.equal(calls.at(-1), 'mcpSetupDiscard');
  assert.ok(!calls.includes('mcpSetupApply'));
});

test('changing the target invalidates the prepared operation until it has been checked again', async () => {
  const calls: { method: string; params: unknown }[] = [];
  const flow = new McpSetupFlow('cursor', (async (method: string, params: unknown) => {
    calls.push({ method, params });
    return method === 'mcpSetupDefaults'
      ? defaults
      : method === 'mcpSetupPreview'
        ? plan('replace', true)
        : {};
  }) as McpSetupInvoke);
  await flow.begin();
  flow.setPath('configuration', '/isolated/other.json');
  assert.equal(flow.getSnapshot().preview, undefined);
  await flow.apply();
  assert.ok(!calls.some((call) => call.method === 'mcpSetupApply'));
  await flow.review();
  const review = calls.filter((call) => call.method === 'mcpSetupPreview').at(-1)!;
  assert.deepEqual(review.params, {
    client: 'cursor',
    files: [{ id: 'configuration', path: '/isolated/other.json' }],
  });
  await flow.apply();
  assert.deepEqual(calls.find((call) => call.method === 'mcpSetupApply')?.params, {
    planId: 'replace',
    confirmReplace: true,
  });
});

test('unmounted or switched clients discard late previews and do not install stale state', async () => {
  const pending = deferred<McpSetupPreview>();
  const calls: { method: string; params: unknown }[] = [];
  const flow = new McpSetupFlow('cursor', (async (method: string, params: unknown) => {
    calls.push({ method, params });
    return method === 'mcpSetupDefaults'
      ? defaults
      : method === 'mcpSetupPreview'
        ? pending.promise
        : {};
  }) as McpSetupInvoke);
  const begin = flow.begin();
  await Promise.resolve();
  flow.dispose();
  pending.resolve(plan('late'));
  await begin;
  assert.equal(flow.getSnapshot().preview, undefined);
  assert.ok(
    calls.some(
      (call) =>
        call.method === 'mcpSetupDiscard' && (call.params as { planId: string }).planId === 'late',
    ),
  );
});

test('native dialog cancellation preserves the preview; selected file requires review', async () => {
  let picked: string | null = null;
  const flow = new McpSetupFlow('cursor', (async (method: string) => {
    return method === 'mcpSetupDefaults'
      ? defaults
      : method === 'mcpSetupPreview'
        ? plan('first')
        : method === 'mcpSetupBrowse'
          ? picked
          : {};
  }) as McpSetupInvoke);
  await flow.begin();
  await flow.browse('configuration');
  assert.equal(flow.getSnapshot().preview?.planId, 'first');
  picked = '/isolated/selected.json';
  await flow.browse('configuration');
  assert.equal(flow.getSnapshot().preview, undefined);
  assert.equal(flow.getSnapshot().files[0].path, picked);
  assert.equal(flow.getSnapshot().busy, false);
});

test('uncertain Apply retries the same plan, blocks concurrent submissions and cannot apply again after success', async () => {
  const pending = deferred<unknown>();
  const applies: unknown[] = [];
  let attempt = 0;
  const flow = new McpSetupFlow('cursor', (async (method: string, params: unknown) => {
    if (method === 'mcpSetupDefaults') return defaults;
    if (method === 'mcpSetupPreview') return plan('same-operation');
    if (method === 'mcpSetupApply') {
      applies.push(params);
      if (++attempt === 1) throw new Error('Reply unavailable');
      return pending.promise;
    }
    return {};
  }) as McpSetupInvoke);
  await flow.begin();
  await flow.apply();
  assert.match(flow.getSnapshot().error!, /Reply unavailable/);
  const retry = flow.apply();
  await flow.apply();
  assert.equal(applies.length, 2);
  assert.deepEqual(applies[0], applies[1]);
  pending.resolve({ status: 'applied', files: [] });
  await retry;
  await flow.apply();
  assert.equal(applies.length, 2);
  assert.equal(flow.getSnapshot().result?.status, 'applied');
});

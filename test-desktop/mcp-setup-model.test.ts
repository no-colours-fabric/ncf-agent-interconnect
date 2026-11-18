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
  assert.ok(!calls.some((call) => call.method === 'mcpSetupApply'));
  await flow.apply(true);
  assert.deepEqual(calls.find((call) => call.method === 'mcpSetupApply')?.params, {
    planId: 'replace',
    confirmReplace: true,
  });
});

test('manual drafts survive cancel and reopening without selecting a different default', async () => {
  let defaultReads = 0;
  const flow = new McpSetupFlow('cursor', (async (method: string, params: unknown) => {
    if (method === 'mcpSetupDefaults') {
      defaultReads++;
      return defaults;
    }
    if (method === 'mcpSetupPreview')
      return {
        ...plan('draft'),
        files: [
          {
            ...plan('draft').files[0],
            path: (params as { files: { path: string }[] }).files[0].path,
          },
        ],
      };
    return {};
  }) as McpSetupInvoke);
  await flow.begin();
  flow.setPath('configuration', '/isolated/Своя папка/draft.json');
  flow.cancel();
  await flow.begin();
  assert.equal(flow.getSnapshot().files[0].path, '/isolated/Своя папка/draft.json');
  assert.equal(defaultReads, 1);
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

test('native dialog cancellation preserves the preview or result; a changed file requires review', async () => {
  let picked: string | null = null;
  let previews = 0;
  const writes: unknown[] = [];
  const flow = new McpSetupFlow('cursor', (async (method: string, params: unknown) => {
    if (method === 'mcpSetupDefaults') return defaults;
    if (method === 'mcpSetupPreview') {
      const preview = plan('plan-' + ++previews);
      preview.files[0].path = (params as { files: { path: string }[] }).files[0].path;
      return preview;
    }
    if (method === 'mcpSetupBrowse') return picked;
    if (method === 'mcpSetupApply') {
      writes.push(params);
      return { status: 'applied', files: [] };
    }
    return {};
  }) as McpSetupInvoke);
  await flow.begin();
  await flow.browse('configuration');
  assert.equal(flow.getSnapshot().preview?.planId, 'plan-1');
  await flow.apply();
  const original = flow.getSnapshot().result;
  assert.equal(original?.status, 'applied');
  await flow.browse('configuration');
  assert.equal(flow.getSnapshot().result, original);
  picked = '/isolated/mcp.json';
  await flow.browse('configuration');
  assert.equal(flow.getSnapshot().result, original);
  picked = '/isolated/selected.json';
  await flow.browse('configuration');
  assert.equal(flow.getSnapshot().preview, undefined);
  assert.equal(flow.getSnapshot().result, undefined);
  assert.equal(flow.getSnapshot().files[0].path, picked);
  assert.equal(flow.getSnapshot().busy, false);
  await flow.apply();
  assert.equal(writes.length, 1);
  flow.setPath('configuration', '/isolated/corrected.json');
  await flow.review();
  assert.equal(flow.getSnapshot().preview?.files[0].path, '/isolated/corrected.json');
  await flow.apply();
  assert.deepEqual(writes, [
    { planId: 'plan-1', confirmReplace: false },
    { planId: 'plan-2', confirmReplace: false },
  ]);
});

test(
  'uncertain Apply reads the same target before retrying, blocks concurrent submissions and cannot apply again after success',
  { timeout: 2000 },
  async () => {
    const pending = deferred<unknown>();
    const submitted = deferred<void>();
    const applies: unknown[] = [];
    let attempt = 0;
    const flow = new McpSetupFlow('cursor', (async (method: string, params: unknown) => {
      if (method === 'mcpSetupDefaults') return defaults;
      if (method === 'mcpSetupPreview') return plan('same-operation');
      if (method === 'mcpSetupApply') {
        applies.push(params);
        if (++attempt === 1) throw new Error('Reply unavailable');
        submitted.resolve();
        return pending.promise;
      }
      return {};
    }) as McpSetupInvoke);
    await flow.begin();
    await flow.apply();
    assert.match(flow.getSnapshot().error!, /Reply unavailable/);
    const retry = flow.apply();
    await flow.apply();
    await submitted.promise;
    assert.equal(applies.length, 2);
    assert.deepEqual(applies[0], applies[1]);
    pending.resolve({ status: 'applied', files: [] });
    await retry;
    await flow.apply();
    assert.equal(applies.length, 2);
    assert.equal(flow.getSnapshot().result?.status, 'applied');
    assert.equal(flow.getSnapshot().uncertain?.error, 'Reply unavailable');
  },
);

test('manual recovery verifies existing settings without replaying the uncertain Apply', async () => {
  let previews = 0;
  let applies = 0;
  const flow = new McpSetupFlow('cursor', (async (method: string) => {
    if (method === 'mcpSetupDefaults') return defaults;
    if (method === 'mcpSetupPreview')
      return {
        ...plan('p-' + ++previews),
        files: [{ ...plan('x').files[0], action: previews > 1 ? 'unchanged' : 'create' }],
      };
    if (method === 'mcpSetupApply') {
      applies++;
      throw new Error('Original reply unavailable');
    }
    if (method === 'mcpSetupStatus')
      return { client: 'cursor', state: 'configured', remembered: true, files: [] };
    return {};
  }) as McpSetupInvoke);
  await flow.begin();
  await flow.apply();
  await flow.apply();
  assert.equal(applies, 1);
  assert.equal(flow.getSnapshot().verified, true);
  assert.equal(flow.getSnapshot().result, undefined);
  assert.equal(flow.getSnapshot().uncertain?.preview.planId, 'p-1');
  await flow.apply();
  assert.equal(applies, 1);
});

test('manual recovery of a changed target needs a fresh confirmation and preserves the original outcome', async () => {
  let previews = 0;
  const applies: unknown[] = [];
  const flow = new McpSetupFlow('cursor', (async (method: string, input: unknown) => {
    if (method === 'mcpSetupDefaults') return defaults;
    if (method === 'mcpSetupPreview')
      return {
        ...plan('p-' + ++previews),
        files: [
          {
            ...plan('x').files[0],
            path: previews > 1 ? '/isolated/changed.json' : '/isolated/mcp.json',
          },
        ],
      };
    if (method === 'mcpSetupApply') {
      applies.push(input);
      if (applies.length === 1) throw new Error('Original uncertain reply');
      return { status: 'applied', files: [] };
    }
    return {};
  }) as McpSetupInvoke);
  await flow.begin();
  await flow.apply();
  await flow.apply();
  assert.equal(applies.length, 1);
  assert.equal(flow.getSnapshot().preview?.planId, 'p-2');
  assert.equal(flow.getSnapshot().reviewRequired, true);
  await flow.apply();
  assert.equal(applies.length, 1);
  await flow.apply(true);
  assert.equal(applies.length, 2);
  assert.equal(flow.getSnapshot().uncertain?.preview.planId, 'p-1');
});

test('manual setup still requires confirmation after a failed write and returning to Applications', async () => {
  let previews = 0;
  const applies: unknown[] = [];
  const flow = new McpSetupFlow('cursor', (async (method: string, input: unknown) => {
    if (method === 'mcpSetupDefaults') return defaults;
    if (method === 'mcpSetupPreview') return plan('p-' + ++previews);
    if (method === 'mcpSetupApply') {
      applies.push(input);
      return { status: applies.length === 1 ? 'failed' : 'applied', files: [] };
    }
    return {};
  }) as McpSetupInvoke);
  await flow.begin();
  await flow.apply();
  assert.equal(flow.getSnapshot().result?.status, 'failed');
  flow.cancel();
  await flow.begin();
  await flow.apply();
  assert.equal(applies.length, 1);
  assert.equal(flow.getSnapshot().reviewRequired, true);
  await flow.apply(true);
  assert.equal(applies.length, 2);
  assert.equal(flow.getSnapshot().reviewRequired, false);
});

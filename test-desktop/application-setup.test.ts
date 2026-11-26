import assert from 'node:assert/strict';
import test from 'node:test';
import { ApplicationSetupFlow } from '../desktop/renderer/application-setup-model.js';
import type { McpSetupInvoke, McpSetupPreview } from '../desktop/shared/mcp-setup.js';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { McpSetupService } from '../desktop/core/mcp-setup.js';
import { mcpInstructions } from '../desktop/core/instructions.js';
import { parse as parseToml } from '@decimalturn/toml-patch';

function fixture(options: { replacement?: boolean; uncertain?: boolean } = {}) {
  const calls: { method: string; params: unknown }[] = [];
  let attempts = 0;
  const preview: McpSetupPreview = {
    client: 'cursor',
    planId: 'isolated-operation',
    expiresAt: '2030-01-01T00:00:00.000Z',
    requiresReplacement: options.replacement === true,
    files: [{ id: 'configuration', path: '/isolated/cursor.json', action: 'create', changes: [] }],
  };
  const invoke = (async (method: string, params: unknown) => {
    calls.push({ method, params });
    if (method === 'mcpSetupDefaults')
      return {
        client: 'cursor',
        files: [
          { id: 'configuration', path: '/isolated/cursor.json', alternatives: [], format: 'jsonc' },
        ],
      };
    if (method === 'mcpSetupPreview') return preview;
    if (method === 'mcpSetupApply') {
      if (options.uncertain && ++attempts === 1) throw new Error('Isolated lost reply');
      return { status: 'applied', files: [] };
    }
    if (method === 'mcpSetupDiscard') return {};
    throw new Error('Unexpected isolated operation: ' + method);
  }) as McpSetupInvoke;
  return { flow: new ApplicationSetupFlow(invoke), calls };
}

test('startup is read-only; one owner click configures only the selected target', async () => {
  const { flow, calls } = fixture();
  assert.equal(calls.length, 0);
  await flow.connect('cursor');
  assert.deepEqual(
    calls.map((call) => call.method),
    ['mcpSetupDefaults', 'mcpSetupPreview', 'mcpSetupApply'],
  );
  assert.deepEqual(calls[1].params, {
    client: 'cursor',
    files: [{ id: 'configuration', path: '/isolated/cursor.json' }],
  });
  assert.deepEqual(calls[2].params, { planId: 'isolated-operation', confirmReplace: false });
  assert.equal(flow.getSnapshot().cursor.phase, 'succeeded');
  assert.equal(flow.getSnapshot().codex.phase, 'idle');
  await flow.connect('cursor');
  assert.equal(calls.length, 3);
});

test('replacement is a separate owner confirmation; cancellation never writes', async () => {
  const { flow, calls } = fixture({ replacement: true });
  await flow.connect('cursor');
  assert.equal(flow.getSnapshot().cursor.phase, 'confirmation');
  assert.ok(!calls.some((call) => call.method === 'mcpSetupApply'));
  flow.cancel('cursor');
  assert.equal(flow.getSnapshot().cursor.phase, 'idle');
  assert.equal(calls.at(-1)?.method, 'mcpSetupDiscard');
  await flow.connect('cursor');
  await flow.confirm('cursor');
  assert.deepEqual(calls.find((call) => call.method === 'mcpSetupApply')?.params, {
    planId: 'isolated-operation',
    confirmReplace: true,
  });
});

test('uncertain Apply rechecks the selected target before retrying the original operation', async () => {
  const { flow, calls } = fixture({ uncertain: true });
  await flow.connect('cursor');
  assert.equal(flow.getSnapshot().cursor.phase, 'uncertain');
  await flow.connect('cursor');
  const applies = calls.filter((call) => call.method === 'mcpSetupApply');
  assert.equal(applies.length, 2);
  assert.deepEqual(applies[0].params, applies[1].params);
  assert.equal(calls.filter((call) => call.method === 'mcpSetupPreview').length, 2);
  assert.deepEqual(calls.filter((call) => call.method === 'mcpSetupPreview').at(-1)?.params, {
    client: 'cursor',
    files: [{ id: 'configuration', path: '/isolated/cursor.json' }],
  });
  assert.equal(flow.getSnapshot().cursor.phase, 'succeeded');
  assert.equal(flow.getSnapshot().cursor.uncertain?.error, 'Isolated lost reply');
});

test('unresolved ChatGPT profile keeps manual configuration available without applying', async () => {
  const calls: string[] = [];
  const flow = new ApplicationSetupFlow((async (method: string) => {
    calls.push(method);
    return null;
  }) as McpSetupInvoke);
  await flow.connect('codex');
  assert.deepEqual(calls, ['codexSetupPrepare']);
  assert.equal(flow.getSnapshot().codex.phase, 'failed');
});

test('shared Cursor/AionUi configuration cannot be submitted concurrently', async () => {
  let release!: (value: unknown) => void;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const calls: string[] = [];
  const flow = new ApplicationSetupFlow((async (method: string) => {
    calls.push(method);
    return pending;
  }) as McpSetupInvoke);
  const first = flow.connect('cursor');
  await flow.connect('cursor');
  await flow.connect('aionui');
  await flow.connect('codex');
  assert.deepEqual(calls, ['mcpSetupDefaults']);
  flow.dispose();
  release({ client: 'cursor', files: [] });
  await first;
  assert.ok(!calls.includes('mcpSetupApply'));
});

test('an owner retry can verify current matching settings without another write while preserving uncertainty', async () => {
  let previews = 0;
  let applies = 0;
  const flow = new ApplicationSetupFlow((async (method: string) => {
    if (method === 'mcpSetupDefaults')
      return {
        client: 'cursor',
        files: [{ id: 'configuration', path: '/isolated/selected-link.json' }],
      };
    if (method === 'mcpSetupPreview')
      return {
        client: 'cursor',
        planId: 'read-' + ++previews,
        requiresReplacement: false,
        expiresAt: '2030-01-01T00:00:00Z',
        files: [
          {
            id: 'configuration',
            path: '/isolated/canonical.json',
            action: previews === 1 ? 'create' : 'unchanged',
            changes: [],
          },
        ],
      };
    if (method === 'mcpSetupApply') {
      applies++;
      throw new Error('Isolated original lost reply');
    }
    return {};
  }) as McpSetupInvoke);
  await flow.connect('cursor');
  assert.equal(applies, 1);
  await flow.connect('cursor');
  assert.equal(applies, 1);
  assert.equal(flow.getSnapshot().cursor.phase, 'succeeded');
  assert.equal(flow.getSnapshot().cursor.verified, true);
  assert.equal(flow.getSnapshot().cursor.result, undefined);
  assert.equal(flow.getSnapshot().cursor.uncertain?.planId, 'read-1');
});

test('changed canonical target or expired plan requires a fresh preview and separate confirmation', async () => {
  for (const changedTarget of [true, false]) {
    let previews = 0;
    const applies: unknown[] = [];
    const flow = new ApplicationSetupFlow((async (method: string, params: unknown) => {
      if (method === 'mcpSetupDefaults')
        return {
          client: 'cursor',
          files: [{ id: 'configuration', path: '/isolated/selected.json' }],
        };
      if (method === 'mcpSetupPreview')
        return {
          client: 'cursor',
          planId: 'preview-' + ++previews,
          requiresReplacement: false,
          expiresAt:
            !changedTarget && previews === 1 ? '1970-01-01T00:00:00Z' : '2030-01-01T00:00:00Z',
          files: [
            {
              id: 'configuration',
              path:
                changedTarget && previews > 1
                  ? '/isolated/new-target.json'
                  : '/isolated/selected.json',
              action: 'create',
              changes: [],
            },
          ],
        };
      if (method === 'mcpSetupApply') {
        applies.push(params);
        if (applies.length === 1) throw new Error('Isolated original uncertainty');
        return { status: 'applied', files: [] };
      }
      return {};
    }) as McpSetupInvoke);
    await flow.connect('cursor');
    await flow.connect('cursor');
    assert.equal(flow.getSnapshot().cursor.phase, 'confirmation');
    assert.equal(applies.length, 1);
    assert.equal(flow.getSnapshot().cursor.preview?.planId, 'preview-2');
    await flow.confirm('cursor');
    assert.deepEqual(applies[1], { planId: 'preview-2', confirmReplace: true });
    assert.equal(flow.getSnapshot().cursor.uncertain?.planId, 'preview-1');
  }
});

test('a failed recovery read retains the uncertain operation and never calls Apply again', async () => {
  let previews = 0;
  let applies = 0;
  const flow = new ApplicationSetupFlow((async (method: string) => {
    if (method === 'mcpSetupDefaults')
      return {
        client: 'cursor',
        files: [{ id: 'configuration', path: '/isolated/selected.json' }],
      };
    if (method === 'mcpSetupPreview') {
      if (++previews > 1) throw new Error('Isolated recovery read failure');
      return {
        client: 'cursor',
        planId: 'original',
        requiresReplacement: false,
        files: [
          { id: 'configuration', path: '/isolated/selected.json', action: 'create', changes: [] },
        ],
      };
    }
    if (method === 'mcpSetupApply') {
      applies++;
      throw new Error('Original reply lost');
    }
    return {};
  }) as McpSetupInvoke);
  await flow.connect('cursor');
  await flow.connect('cursor');
  assert.equal(applies, 1);
  assert.equal(flow.getSnapshot().cursor.phase, 'uncertain');
  assert.equal(flow.getSnapshot().cursor.preview?.planId, 'original');
  assert.equal(flow.getSnapshot().cursor.uncertain?.error, 'Original reply lost');
  assert.equal(flow.getSnapshot().cursor.error, 'Isolated recovery read failure');
});

test('disposal discards a late preview without applying it', async () => {
  let release!: (value: McpSetupPreview) => void;
  const pending = new Promise<McpSetupPreview>((resolve) => {
    release = resolve;
  });
  const calls: string[] = [];
  const flow = new ApplicationSetupFlow((async (method: string) => {
    calls.push(method);
    if (method === 'mcpSetupDefaults')
      return { client: 'cursor', files: [{ id: 'configuration', path: '/isolated/a.json' }] };
    if (method === 'mcpSetupPreview') return pending;
    return {};
  }) as McpSetupInvoke);
  const connecting = flow.connect('cursor');
  await Promise.resolve();
  flow.dispose();
  release({
    client: 'cursor',
    planId: 'late',
    expiresAt: '',
    files: [],
    requiresReplacement: false,
  });
  await connecting;
  assert.equal(calls.at(-1), 'mcpSetupDiscard');
  assert.ok(!calls.includes('mcpSetupApply'));
});

test('an unchanged result is successful; a failed status refresh cannot cause another Apply', async () => {
  let writes = 0;
  const flow = new ApplicationSetupFlow(
    (async (method: string) => {
      if (method === 'desktopSessionDelivery') return { state: 'unsupported' };
      if (method === 'codexSetupPrepare')
        return {
          client: 'codex',
          planId: 'unchanged',
          requiresReplacement: false,
          files: [{ id: 'configuration', path: '/isolated/config.toml' }],
        };
      if (method === 'mcpSetupApply') {
        writes++;
        return { status: 'unchanged', files: [] };
      }
      return {};
    }) as McpSetupInvoke,
    async () => {
      throw new Error('Isolated status unavailable');
    },
  );
  await flow.connect('codex');
  assert.equal(flow.getSnapshot().codex.phase, 'succeeded');
  await flow.connect('codex');
  assert.equal(writes, 1);
  flow.invalidateSucceeded('codex');
  assert.equal(flow.getSnapshot().codex.phase, 'idle');
});

test('a mismatched target or preview never reaches Apply', async () => {
  for (const badDefaults of [true, false]) {
    const calls: string[] = [];
    const flow = new ApplicationSetupFlow((async (method: string) => {
      calls.push(method);
      if (method === 'mcpSetupDefaults')
        return {
          client: badDefaults ? 'codex' : 'opencode',
          files: [{ id: 'configuration', path: '/isolated/opencode-v1.json' }],
        };
      if (method === 'mcpSetupPreview') return { client: 'codex', planId: 'wrong-target' };
      return {};
    }) as McpSetupInvoke);
    await flow.connect('opencode');
    assert.equal(flow.getSnapshot().opencode.phase, 'failed');
    assert.ok(!calls.includes('mcpSetupApply'));
  }
});

test('one Connect uses the existing guarded writer and preserves other clients and unrelated settings', async (t) => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'ncf-application-setup-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  await mkdir(path.join(home, '.codex'));
  await mkdir(path.join(home, '.cursor'));
  const target = path.join(home, '.codex', 'config.toml');
  const untouched = path.join(home, '.cursor', 'mcp.json');
  const original = '# preserved Unicode: настройки\nmodel = "isolated-model"\n';
  await writeFile(target, original);
  await writeFile(untouched, '{"untouched":true}\n');
  const service = new McpSetupService({
    home,
    env: {},
    stateDirectory: path.join(home, 'ncf-state'),
    instructions: (client) =>
      mcpInstructions(
        'http://127.0.0.1:42000/mcp',
        'isolated-token',
        client,
        'file:///isolated/opencode.js',
      ),
  });
  const flow = new ApplicationSetupFlow((async (method: string, raw: unknown) => {
    const input = raw as {
      client: 'codex';
      files: { id: string; path: string }[];
      planId: string;
      confirmReplace: boolean;
    };
    if (method === 'desktopSessionDelivery') return { state: 'unsupported' };
    if (method === 'codexSetupPrepare')
      return service.preview('isolated-owner', 'codex', [{ id: 'configuration', path: target }]);
    if (method === 'mcpSetupApply')
      return service.apply('isolated-owner', input.planId, input.confirmReplace);
    if (method === 'mcpSetupDiscard') {
      service.discard('isolated-owner', input.planId);
      return {};
    }
    throw new Error('Unexpected fixture method');
  }) as McpSetupInvoke);
  assert.equal(await readFile(target, 'utf8'), original);
  await flow.connect('codex');
  assert.equal(flow.getSnapshot().codex.phase, 'succeeded');
  const result = await readFile(target, 'utf8');
  assert.ok(result.startsWith(original));
  assert.ok((parseToml(result).mcp_servers as Record<string, unknown>).ncf_agent_interconnect);
  assert.equal(await readFile(untouched, 'utf8'), '{"untouched":true}\n');
  assert.equal(
    await readFile(flow.getSnapshot().codex.result!.files[0].backupPath!, 'utf8'),
    original,
  );
});

test('failed write review survives a defaults or preview rejection before another owner retry', async () => {
  for (const rejected of ['mcpSetupDefaults', 'mcpSetupPreview']) {
    let rejectNext = false;
    let previews = 0;
    let applies = 0;
    const paths: string[] = [];
    const flow = new ApplicationSetupFlow((async (method: string, raw: unknown) => {
      if (rejectNext && method === rejected) {
        rejectNext = false;
        throw new Error('Isolated recovery preparation failure');
      }
      if (method === 'mcpSetupDefaults')
        return {
          client: 'cursor',
          files: [
            {
              id: 'configuration',
              path: applies ? '/isolated/changed-default.json' : '/isolated/original.json',
            },
          ],
        };
      if (method === 'mcpSetupPreview') {
        const filename = (raw as { files: { path: string }[] }).files[0].path;
        paths.push(filename);
        return {
          client: 'cursor',
          planId: 'review-' + ++previews,
          requiresReplacement: false,
          expiresAt: '2030-01-01T00:00:00Z',
          files: [{ id: 'configuration', path: filename, action: 'create', changes: [] }],
        };
      }
      if (method === 'mcpSetupApply')
        return {
          status: ++applies === 1 ? 'failed' : 'applied',
          error: applies === 1 ? 'Original failed write' : undefined,
          files: [],
        };
      return {};
    }) as McpSetupInvoke);
    await flow.connect('cursor');
    assert.equal(flow.getSnapshot().cursor.result?.status, 'failed');
    rejectNext = true;
    await flow.connect('cursor');
    flow.invalidateSucceeded();
    await flow.connect('cursor');
    assert.equal(
      applies,
      1,
      rejected + ': failed-write confirmation must not be lost after a read failure',
    );
    assert.equal(flow.getSnapshot().cursor.phase, 'confirmation');
    assert.equal(flow.getSnapshot().cursor.reviewRequired, true);
    assert.equal(flow.getSnapshot().cursor.target?.path, '/isolated/original.json');
    assert.equal(paths.at(-1), '/isolated/original.json');
    await flow.confirm('cursor');
    assert.equal(applies, 2);
    assert.equal(flow.getSnapshot().cursor.reviewRequired, false);
  }
});

test('failed write review survives cancelling its fresh confirmation and reconnecting', async () => {
  let previews = 0;
  let applies = 0;
  const flow = new ApplicationSetupFlow((async (method: string) => {
    if (method === 'mcpSetupDefaults')
      return {
        client: 'cursor',
        files: [{ id: 'configuration', path: '/isolated/original.json' }],
      };
    if (method === 'mcpSetupPreview')
      return {
        client: 'cursor',
        planId: 'review-' + ++previews,
        expiresAt: '2030-01-01T00:00:00Z',
        requiresReplacement: false,
        files: [
          { id: 'configuration', path: '/isolated/original.json', action: 'create', changes: [] },
        ],
      };
    if (method === 'mcpSetupApply')
      return {
        status: ++applies === 1 ? 'failed' : 'applied',
        error: applies === 1 ? 'Original failed write' : undefined,
        files: [],
      };
    return {};
  }) as McpSetupInvoke);
  await flow.connect('cursor');
  await flow.connect('cursor');
  assert.equal(flow.getSnapshot().cursor.phase, 'confirmation');
  flow.cancel('cursor');
  flow.invalidateSucceeded('cursor');
  await flow.connect('cursor');
  assert.equal(applies, 1, 'cancel must not turn a failed write into a fresh automatic Apply');
  assert.equal(flow.getSnapshot().cursor.phase, 'confirmation');
  assert.equal(flow.getSnapshot().cursor.reviewRequired, true);
  assert.equal(flow.getSnapshot().cursor.result?.status, 'failed');
  assert.equal(flow.getSnapshot().cursor.target?.path, '/isolated/original.json');
  await flow.confirm('cursor');
  assert.equal(applies, 2);
  assert.equal(flow.getSnapshot().cursor.reviewRequired, false);
});

test('delivery retry for a manually selected profile never repeats Apply or falls back to Home', async () => {
  const actions: string[] = [];
  let attempts = 0;
  const target = '/fixture/work/config.toml';
  const flow = new ApplicationSetupFlow((async (method: string, raw: any) => {
    actions.push(method + ':' + (raw?.action ?? ''));
    if (method === 'mcpSetupPreview') {
      assert.equal(raw.files[0].path, target);
      return {
        client: 'codex',
        planId: 'work',
        requiresReplacement: false,
        files: [{ id: 'configuration', path: target }],
      };
    }
    if (method === 'mcpSetupApply') return { status: 'unchanged', files: [] };
    if (method === 'desktopSessionDelivery') {
      if (raw.action === 'status')
        return { state: 'ready', scope: 'user', profile: '/fixture/work' };
      assert.equal(raw.profile, '/fixture/work');
      return ++attempts === 1
        ? { state: 'close-required' }
        : { state: 'enabled', scope: 'user', profile: raw.profile };
    }
    throw Error(method);
  }) as McpSetupInvoke);
  flow.selectCodexConfiguration(target);
  await flow.connect('codex');
  assert.equal(flow.getSnapshot().codex.deliveryIssue, 'close-required');
  await flow.connect('codex');
  assert.equal(flow.getSnapshot().codex.phase, 'succeeded');
  assert.deepEqual(actions, [
    'mcpSetupPreview:',
    'mcpSetupApply:',
    'desktopSessionDelivery:status',
    'desktopSessionDelivery:enable',
    'desktopSessionDelivery:status',
    'desktopSessionDelivery:enable',
  ]);
});

test('ChatGPT restart notice follows a successful change, including delivery-only changes', async () => {
  for (const [result, delivery, expected, restartRequired] of [
    ['applied', 'enabled', 'pending', false],
    ['unchanged', 'ready', undefined, true],
    ['unchanged', 'ready', undefined, false],
    ['unchanged', 'enabled', undefined, false],
    ['applied', 'close-required', 'requested', false],
    ['failed', 'enabled', 'requested', false],
  ] as const) {
    let enables = 0;
    const flow = new ApplicationSetupFlow((async (method: string, raw: { action?: string }) => {
      if (method === 'codexSetupPrepare')
        return {
          client: 'codex',
          planId: 'restart-fixture',
          requiresReplacement: false,
          files: [{ id: 'configuration', path: '/fixture/Work/config.toml' }],
        };
      if (method === 'mcpSetupApply') return { status: result, files: [] };
      if (method === 'desktopSessionDelivery') {
        if (raw.action === 'enable') enables++;
        return {
          state: raw.action === 'enable' ? 'enabled' : delivery,
          profile: '/fixture/Work',
          scope: 'login',
          restartRequired: raw.action === 'enable' && restartRequired,
        };
      }
      throw Error(method);
    }) as McpSetupInvoke);
    await flow.connect('codex', undefined, { showRestartNotice: true });
    assert.equal(flow.getSnapshot().codex.restartNotice, expected, result + delivery);
    assert.equal(enables, delivery === 'ready' ? 1 : 0);
    assert.equal(flow.chatDelivery.getSnapshot().restartPending === true, restartRequired);
    flow.chatDelivery.acknowledgeRestart();
    assert.equal(flow.chatDelivery.getSnapshot().restartPending, undefined);
    const phase = flow.getSnapshot().codex.phase;
    assert.equal(phase, expected === 'requested' ? 'failed' : 'succeeded');
    if (expected === 'pending') {
      flow.acknowledgeCodexRestart();
      assert.equal(flow.getSnapshot().codex.restartNotice, undefined);
      assert.equal(flow.getSnapshot().codex.phase, 'succeeded');
    }
    flow.dispose();
  }
});

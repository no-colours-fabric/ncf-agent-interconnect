import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenCodeV2SetupFlow } from '../desktop/renderer/opencode-v2-setup-model.js';
import { ApplicationSetupFlow } from '../desktop/renderer/application-setup-model.js';
import type {
  McpSetupInvoke,
  OpenCodeV2SetupApplyResult,
  OpenCodeV2SetupAvailability,
  OpenCodeV2SetupDefaults,
  OpenCodeV2SetupPreview,
  OpenCodeV2SetupTarget,
} from '../desktop/shared/mcp-setup.js';

const target: OpenCodeV2SetupTarget = {
  major: 2,
  installationId: 'fixture-v2',
  installationPath: '/isolated/OpenCode v2',
  profilePath: '/isolated/Профиль v2',
  configurationPath: '/isolated/Профиль v2/opencode.json',
};

function fixture() {
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  let sequence = 0;
  const plan = (
    selected: OpenCodeV2SetupTarget,
    action: 'create' | 'update' | 'unchanged' = 'create',
  ): OpenCodeV2SetupPreview => ({
    client: 'opencode-v2',
    target: { ...selected },
    targetId: 'fixture-target',
    planId: 'v2-plan-' + ++sequence,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    requiresReplacement: false,
    files: [
      {
        id: 'configuration',
        path: selected.configurationPath,
        action,
        changes: [{ scope: 'ncf_agent_interconnect', action: 'add' }],
      },
    ],
  });
  const handlers = {
    availability: { state: 'available' } as OpenCodeV2SetupAvailability,
    defaults: async (): Promise<OpenCodeV2SetupDefaults> => ({
      client: 'opencode-v2',
      target: { ...target },
      alternatives: [target.configurationPath],
      setupAvailability: handlers.availability,
    }),
    preview: async (selected: OpenCodeV2SetupTarget) => plan(selected),
    apply: async (selected: OpenCodeV2SetupTarget): Promise<OpenCodeV2SetupApplyResult> => ({
      status: 'applied',
      target: { ...selected },
      targetId: 'fixture-target',
      files: [{ path: selected.configurationPath, status: 'created' }],
    }),
    browse: async (_selected: OpenCodeV2SetupTarget): Promise<OpenCodeV2SetupTarget | null> => null,
  };
  const invoke = (async (method: string, input: Record<string, unknown> = {}) => {
    calls.push({ method, params: structuredClone(input) });
    const selected = input.target as OpenCodeV2SetupTarget;
    if (method === 'opencodeV2SetupDefaults') return handlers.defaults();
    if (method === 'opencodeV2SetupStatus')
      return {
        client: 'opencode-v2',
        target: { ...selected },
        state: 'not-configured',
        remembered: false,
        setupAvailability: handlers.availability,
        files: [{ id: 'configuration', path: selected.configurationPath, state: 'not-configured' }],
      };
    if (method === 'opencodeV2SetupPreview') return handlers.preview(selected);
    if (method === 'opencodeV2SetupApply') return handlers.apply(selected);
    if (method === 'opencodeV2SetupBrowse') return handlers.browse(selected);
    if (method === 'opencodeV2SetupDiscard') return { discarded: true };
    throw new Error('Unexpected legacy operation: ' + method);
  }) as McpSetupInvoke;
  return {
    calls,
    handlers,
    invoke,
    plan,
    writes: () => calls.filter(({ method }) => method === 'opencodeV2SetupApply'),
  };
}

test('v2 mount reads only; one Connect applies exactly the backend-selected target through dedicated IPC', async () => {
  const f = fixture();
  const flow = new OpenCodeV2SetupFlow(f.invoke);
  await flow.refresh();
  assert.equal(flow.getSnapshot().availability, 'available');
  assert.equal(f.writes().length, 0);
  await flow.connect();
  assert.equal(f.writes().length, 1);
  assert.deepEqual(f.writes()[0].params.target, target);
  assert.equal(flow.getSnapshot().phase, 'succeeded');
  await flow.apply(true);
  await flow.connect();
  assert.equal(f.writes().length, 1, 'a saved outcome must not replay its write');
  assert.ok(f.calls.every(({ method }) => method.startsWith('opencodeV2Setup')));
});

test('v2 manual selection retains full Browse target, invalidates a plan and never derives a profile from the filename', async () => {
  const f = fixture();
  const flow = new OpenCodeV2SetupFlow(f.invoke);
  await flow.beginManual();
  const previous = flow.getSnapshot().preview!.planId;
  const picked = {
    ...target,
    installationId: 'second-v2',
    installationPath: '/isolated/Other install',
    profilePath: '/isolated/Other profile',
    configurationPath: '/isolated/Custom/配置.json',
  };
  f.handlers.browse = async () => picked;
  await flow.browse();
  assert.deepEqual(flow.getSnapshot().target, picked);
  assert.equal(flow.getSnapshot().preview, undefined);
  assert.ok(
    f.calls.some(
      ({ method, params }) => method === 'opencodeV2SetupDiscard' && params.planId === previous,
    ),
  );
  flow.setConfigurationPath('/isolated/Another/Черновик.json');
  assert.equal(flow.getSnapshot().target?.profilePath, picked.profilePath);
  assert.equal(flow.getSnapshot().target?.installationId, picked.installationId);
  await flow.review();
  const selected = { ...picked, configurationPath: '/isolated/Another/Черновик.json' };
  assert.deepEqual(
    flow.getSnapshot().status?.target,
    selected,
    'the cached status follows the reviewed target instead of showing another profile indefinitely',
  );
  await flow.apply();
  assert.deepEqual(f.writes()[0].params.target, selected);
  assert.equal(f.writes().length, 1);
  const completed = flow.getSnapshot();
  assert.equal(completed.phase, 'succeeded');
  f.handlers.browse = async () => null;
  await flow.browse();
  assert.equal(flow.getSnapshot().phase, 'succeeded');
  assert.equal(flow.getSnapshot().result, completed.result);
  f.handlers.browse = async () => selected;
  await flow.browse();
  assert.equal(flow.getSnapshot().phase, 'succeeded');
  await flow.apply();
  assert.equal(f.writes().length, 1, 'closing the picker must not make a consumed plan actionable');
  f.handlers.browse = async () => picked;
  await flow.browse();
  assert.deepEqual(flow.getSnapshot().target, picked);
  assert.equal(flow.getSnapshot().result, undefined);
  assert.equal(flow.getSnapshot().preview, undefined);
  await flow.apply();
  assert.equal(f.writes().length, 1);
  await flow.review();
  await flow.apply();
  assert.equal(f.writes().length, 2);
  assert.deepEqual(f.writes()[1].params.target, picked);
});

test('v2 uncertain original result is inspected at its captured target and verified configuration is not replayed', async () => {
  const f = fixture();
  f.handlers.apply = async () => {
    throw new Error('Original result unknown');
  };
  const flow = new OpenCodeV2SetupFlow(f.invoke);
  await flow.connect();
  const original = flow.getSnapshot().uncertain!;
  f.handlers.defaults = async () => ({
    client: 'opencode-v2',
    target: { ...target, configurationPath: '/isolated/Other default.json' },
    alternatives: [],
    setupAvailability: { state: 'available' },
  });
  f.handlers.preview = async (selected) => f.plan(selected, 'unchanged');
  await flow.connect();
  assert.equal(f.writes().length, 1);
  assert.equal(flow.getSnapshot().verified, true);
  assert.deepEqual(flow.getSnapshot().target, original.target);
  assert.equal(flow.getSnapshot().uncertain, original, 'original unknown history is retained');
  assert.equal(f.calls.filter(({ method }) => method === 'opencodeV2SetupDefaults').length, 1);
});

test('v2 changed preview after uncertainty needs a separate fresh confirmation and retains original history', async () => {
  const f = fixture();
  f.handlers.apply = async () => {
    throw new Error('Original result unknown');
  };
  const flow = new OpenCodeV2SetupFlow(f.invoke);
  await flow.connect();
  const original = flow.getSnapshot().uncertain!;
  f.handlers.preview = async (selected) => f.plan(selected, 'update');
  await flow.connect();
  assert.equal(flow.getSnapshot().phase, 'confirmation');
  assert.equal(flow.checkingOriginal(), false);
  assert.equal(f.writes().length, 1);
  await flow.apply(false);
  assert.equal(f.writes().length, 1);
  f.handlers.apply = async (selected) => ({
    status: 'applied',
    target: selected,
    targetId: 'fixture-target',
    files: [{ path: selected.configurationPath, status: 'updated' }],
  });
  await flow.confirm();
  assert.equal(f.writes().length, 2);
  assert.notEqual(f.writes()[1].params.planId, original.preview.planId);
  assert.deepEqual(f.writes()[1].params.target, original.target);
  assert.equal(flow.getSnapshot().uncertain, original);
});

test('v2 failed-write provenance survives preview failure, confirmation cancel and changed defaults', async () => {
  const f = fixture();
  f.handlers.apply = async (selected) => ({
    status: 'failed',
    target: selected,
    targetId: 'fixture-target',
    files: [{ path: selected.configurationPath, status: 'restored' }],
    error: 'Isolated failed write',
  });
  const flow = new OpenCodeV2SetupFlow(f.invoke);
  await flow.connect();
  const failed = flow.getSnapshot().failedWrite;
  f.handlers.defaults = async () => ({
    client: 'opencode-v2',
    target: { ...target, configurationPath: '/isolated/Unselected.json' },
    alternatives: [],
    setupAvailability: { state: 'available' },
  });
  f.handlers.preview = async () => {
    throw new Error('Preview unavailable');
  };
  await flow.connect();
  assert.equal(flow.getSnapshot().reviewRequired, true);
  f.handlers.preview = async (selected) => f.plan(selected);
  await flow.connect();
  assert.equal(flow.getSnapshot().phase, 'confirmation');
  flow.cancel();
  await flow.connect();
  assert.equal(flow.getSnapshot().phase, 'confirmation');
  assert.equal(f.writes().length, 1);
  assert.equal(flow.getSnapshot().failedWrite, failed);
  assert.deepEqual(flow.getSnapshot().target, target);
  await flow.apply(false);
  assert.equal(f.writes().length, 1);
});

test('v2 unavailable backend and mismatched target never fall back to legacy setup or Apply', async () => {
  const absent = fixture();
  absent.handlers.defaults = async () => {
    throw new Error('Dedicated method unavailable');
  };
  const unavailable = new OpenCodeV2SetupFlow(absent.invoke);
  await unavailable.connect();
  assert.equal(unavailable.getSnapshot().availability, 'unavailable');
  assert.equal(absent.writes().length, 0);
  const f = fixture();
  f.handlers.preview = async (selected) => ({
    ...f.plan(selected),
    target: { ...selected, profilePath: '/isolated/Unselected profile' },
  });
  const flow = new OpenCodeV2SetupFlow(f.invoke);
  await flow.connect();
  assert.equal(flow.getSnapshot().phase, 'failed');
  assert.equal(f.writes().length, 0);
});

test('v2 late preview after disposal cannot apply or replace a successor', async () => {
  const f = fixture();
  let release!: (value: OpenCodeV2SetupPreview) => void;
  const pending = new Promise<OpenCodeV2SetupPreview>((resolve) => {
    release = resolve;
  });
  f.handlers.preview = () => pending;
  const flow = new OpenCodeV2SetupFlow(f.invoke);
  await flow.refresh();
  const connect = flow.connect();
  flow.dispose();
  release(f.plan(target));
  await connect;
  assert.equal(f.writes().length, 0);
});

test('legacy v1 remains usable when v2 is unavailable and v2 cannot enter legacy requests', async () => {
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  const invoke = (async (method: string, params: Record<string, unknown> = {}) => {
    calls.push({ method, params });
    if (method.startsWith('opencodeV2Setup')) throw new Error('V2 unavailable');
    if (method === 'mcpSetupDefaults')
      return { client: 'opencode', files: [{ id: 'configuration', path: '/isolated/v1.json' }] };
    if (method === 'mcpSetupPreview')
      return {
        client: 'opencode',
        planId: 'v1-only',
        files: [{ id: 'configuration', path: '/isolated/v1.json', action: 'create', changes: [] }],
        requiresReplacement: false,
      };
    if (method === 'mcpSetupApply')
      return { status: 'applied', files: [{ path: '/isolated/v1.json', status: 'created' }] };
    return {};
  }) as McpSetupInvoke;
  const flow = new ApplicationSetupFlow(invoke);
  await flow.openCodeV2.refresh();
  await flow.connect('opencode');
  assert.equal(flow.getSnapshot().opencode.phase, 'succeeded');
  assert.equal(flow.getSnapshot()['opencode-v2'].availability, 'unavailable');
  assert.ok(
    calls
      .filter(({ method }) => method === 'mcpSetupDefaults' || method === 'mcpSetupPreview')
      .every(({ params }) => params.client === 'opencode'),
  );
  assert.equal(calls.filter(({ method }) => method === 'mcpSetupApply').length, 1);
});

test('v2 rechecks the other-operation guard after its read-only defaults await', async () => {
  const f = fixture();
  let release!: (value: Awaited<ReturnType<typeof f.handlers.defaults>>) => void;
  f.handlers.defaults = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  let otherBusy = false;
  const flow = new OpenCodeV2SetupFlow(f.invoke, undefined, () => otherBusy);
  const connect = flow.connect();
  otherBusy = true;
  release({
    client: 'opencode-v2',
    target: { ...target },
    alternatives: [],
    setupAvailability: { state: 'available' },
  });
  await connect;
  assert.equal(f.writes().length, 0);
  assert.equal(f.calls.filter(({ method }) => method === 'opencodeV2SetupPreview').length, 0);
  otherBusy = false;
  await flow.connect();
  assert.equal(f.writes().length, 1, 'a new owner action may proceed after the other operation');
});

test('a pending read-only v2 availability check does not lock legacy v1 setup', async () => {
  let release!: (value: unknown) => void;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const invoke = (async (method: string) => {
    if (method === 'opencodeV2SetupDefaults') return pending;
    if (method === 'opencodeV2SetupStatus')
      return {
        client: 'opencode-v2',
        target,
        state: 'missing',
        remembered: false,
        setupAvailability: { state: 'available' },
        files: [],
      };
    if (method === 'mcpSetupDefaults')
      return { client: 'opencode', files: [{ id: 'configuration', path: '/isolated/v1.json' }] };
    if (method === 'mcpSetupPreview')
      return {
        client: 'opencode',
        planId: 'v1',
        files: [{ id: 'configuration', path: '/isolated/v1.json', action: 'create', changes: [] }],
        requiresReplacement: false,
      };
    if (method === 'mcpSetupApply')
      return { status: 'applied', files: [{ path: '/isolated/v1.json', status: 'created' }] };
    return {};
  }) as McpSetupInvoke;
  const flow = new ApplicationSetupFlow(invoke);
  const reading = flow.openCodeV2.refresh();
  await flow.connect('opencode');
  release({
    client: 'opencode-v2',
    target,
    alternatives: [],
    setupAvailability: { state: 'available' },
  });
  await reading;
  assert.equal(flow.getSnapshot().opencode.phase, 'succeeded');
});

test('cancel during a pending v2 status read cannot resurrect manual preparation', async () => {
  const f = fixture();
  let release!: (value: unknown) => void;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  let reads = 0;
  const invoke = (async (method: string, params: Record<string, unknown> = {}) => {
    if (method === 'opencodeV2SetupStatus' && ++reads === 2) return pending;
    return f.invoke(method, params);
  }) as McpSetupInvoke;
  const flow = new OpenCodeV2SetupFlow(invoke);
  await flow.refresh();
  const reading = flow.refresh();
  const opening = flow.beginManual();
  flow.cancel();
  release({
    client: 'opencode-v2',
    target,
    state: 'not-configured',
    remembered: false,
    setupAvailability: { state: 'available' },
    files: [],
  });
  await Promise.all([reading, opening]);
  assert.equal(flow.getSnapshot().open, false);
  assert.equal(f.calls.filter(({ method }) => method === 'opencodeV2SetupPreview').length, 0);
  assert.equal(f.writes().length, 0);
});

test('explicit v2 setup capability permits one selected-config transaction with no installation evidence', async () => {
  const f = fixture();
  const manualTarget = { ...target, installationId: null, installationPath: null };
  f.handlers.defaults = async () => ({
    client: 'opencode-v2',
    target: manualTarget,
    alternatives: [],
    setupAvailability: { state: 'available' },
  });
  const flow = new OpenCodeV2SetupFlow(f.invoke);
  await flow.connect();
  assert.equal(f.writes().length, 1);
  assert.deepEqual(f.writes()[0].params.target, manualTarget);
  assert.equal(flow.getSnapshot().phase, 'succeeded');
});

test('installation evidence never overrides unavailable selected-target setup capability', async () => {
  for (const reason of ['v1-collision', 'asset-unavailable', 'target-unresolved'] as const) {
    const f = fixture();
    f.handlers.availability = { state: 'unavailable', reason };
    const flow = new OpenCodeV2SetupFlow(f.invoke);
    await flow.connect();
    assert.equal(flow.getSnapshot().availability, 'available', 'dedicated backend exists');
    assert.equal(flow.getSnapshot().target?.installationId, target.installationId);
    assert.equal(
      f.calls.filter(({ method }) => method === 'opencodeV2SetupPreview').length,
      0,
      reason,
    );
    assert.equal(f.writes().length, 0, reason);
  }
});

test('an old or malformed v2 reply without mandatory setup capability cannot enable Connect', async () => {
  const f = fixture();
  const invoke = (async (method: string, params?: unknown) => {
    const result = await f.invoke(method, params);
    if (method === 'opencodeV2SetupStatus')
      delete (result as Record<string, unknown>).setupAvailability;
    return result;
  }) as McpSetupInvoke;
  const flow = new OpenCodeV2SetupFlow(invoke);
  await flow.connect();
  assert.equal(flow.getSnapshot().availability, 'unavailable');
  assert.equal(f.writes().length, 0);
});

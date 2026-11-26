import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createWindowsDesktopSessionDeliveryHandler } from '../desktop/main/desktop-session-delivery-windows.js';
import type { DesktopSessionDelivery } from '../desktop/shared/desktop-session-delivery.js';

const require = createRequire(import.meta.url);
const service = require('../desktop/integrations/codex-windows-service.cjs') as {
  parseSettings(text: string): unknown;
  address(settings: { pipeId: string }): string;
  runCommand(options: { appExecutable: string }): string;
};

function fixture(selectedProfile?: string | null) {
  const profile = path.join(homedir(), '.codex');
  const options = {
    userData: 'C:\\NCF state',
    appExecutable: 'C:\\NCF\\NCF Agent Interconnect.exe',
    appPath: 'C:\\NCF\\resources\\app.asar',
    appData: 'C:\\Roaming',
    installed: true,
    alternateUserData: false,
  };
  const calls: string[] = [];
  let settings: { version: 1; enabled: boolean; pipeId: string; profile: string } | null = null;
  let running = 0,
    foreign = false,
    controlError: Error | undefined;
  let answer: DesktopSessionDelivery = { state: 'enabled', profile, scope: 'user' };
  const dependencies = {
    runtime: {
      async readSettings(_options: unknown, verify?: boolean) {
        calls.push(verify ? 'read-owned' : 'read-only');
        return settings;
      },
      async saveSettings(_options: unknown, value: NonNullable<typeof settings>) {
        calls.push('save');
        settings = value;
      },
      locations() {
        return { broker: 'C:\\NCF\\codex-win-pipe.exe' };
      },
      async registry(
        _options: unknown,
        _settings: unknown,
        action: 'status' | 'publish' | 'withdraw',
      ) {
        calls.push('registry-' + action);
        return { conflict: foreign, published: false };
      },
      async broadcast() {
        calls.push('broadcast');
      },
      async control() {
        calls.push('control');
        if (controlError) throw controlError;
        return answer;
      },
      async start() {
        calls.push('start');
        return answer;
      },
    },
    platform: {
      async canonical(value: string) {
        return value;
      },
      async inspectPackage() {
        calls.push('inspect');
        return { running };
      },
    },
    async metadata() {
      return { isFile: () => true, isSymbolicLink: () => false };
    },
    async stockData() {
      calls.push('layout');
      return { state: 'ready' as const, directory: 'C:\\Roaming\\Codex' };
    },
    async stockProfile() {
      return profile;
    },
  };
  const handler = createWindowsDesktopSessionDeliveryHandler(
    options,
    async () => (selectedProfile === undefined ? profile : selectedProfile),
    dependencies,
  );
  return {
    profile,
    options,
    calls,
    handler,
    dependencies,
    saved: () => settings,
    enable: () => {
      settings = { version: 1, enabled: true, pipeId: randomUUID(), profile };
    },
    running: () => {
      running = 1;
    },
    foreign: () => {
      foreign = true;
    },
    controlError: (error: Error) => {
      controlError = error;
    },
    answer: (value: DesktopSessionDelivery) => {
      answer = value;
    },
  };
}
const native = { skip: process.platform !== 'win32' };

test(
  'Windows status offers setup for a missing configuration without authorizing any mutation',
  native,
  async () => {
    const f = fixture(null);
    assert.deepEqual(await f.handler('status'), { state: 'configuration-required' });
    assert.deepEqual(await f.handler('enable', f.profile), { state: 'unavailable' });
    assert.deepEqual(await f.handler('disable', f.profile), { state: 'unavailable' });
    assert.deepEqual(f.calls, []);
    assert.equal(f.saved(), null);
    f.options.installed = false;
    assert.deepEqual(await f.handler('status'), { state: 'unsupported' });
  },
);

test(
  'an unsupported selected profile remains unsupported instead of offering delivery setup',
  native,
  async () => {
    const f = fixture('C:\\unsupported-profile');
    for (const action of ['status', 'enable', 'disable'] as const)
      assert.deepEqual(await f.handler(action, 'C:\\unsupported-profile'), {
        state: 'unsupported',
      });
    assert.deepEqual(f.calls, []);
    assert.equal(f.saved(), null);
  },
);
test(
  'Windows delivery status is read-only and declares the user scope and close requirement',
  native,
  async () => {
    const f = fixture();
    assert.deepEqual(await f.handler('status'), {
      state: 'ready',
      profile: f.profile,
      scope: 'user',
      requiresClosedChatGPT: true,
    });
    assert.deepEqual(f.calls, ['read-only']);
  },
);
test('a changed profile cannot mutate the selected installation', native, async () => {
  const f = fixture();
  assert.deepEqual(await f.handler('enable', f.profile + '-other'), { state: 'conflict' });
  assert.deepEqual(f.calls, ['read-owned']);
});
test('a live ChatGPT refuses before any state or registry change', native, async () => {
  for (const action of ['enable', 'disable'] as const) {
    const f = fixture();
    f.running();
    assert.deepEqual(await f.handler(action, f.profile), { state: 'close-required' });
    assert.deepEqual(f.calls, ['read-owned', 'inspect']);
  }
});
test('a foreign selector is preserved without saving or starting a service', native, async () => {
  const f = fixture();
  f.foreign();
  assert.deepEqual(await f.handler('enable', f.profile), { state: 'conflict' });
  assert.ok(
    !f.calls.includes('save') && !f.calls.includes('start') && !f.calls.includes('broadcast'),
  );
});
test(
  'explicit enable starts the exact saved profile and preserves Unicode paths',
  native,
  async () => {
    const f = fixture();
    const result = await f.handler('enable', f.profile);
    assert.deepEqual(result, {
      state: 'enabled',
      profile: f.profile,
      scope: 'user',
      requiresClosedChatGPT: true,
    });
    assert.equal(f.saved()?.profile, f.profile);
    assert.equal(f.saved()?.enabled, true);
    assert.deepEqual(f.calls, [
      'read-owned',
      'inspect',
      'layout',
      'registry-status',
      'save',
      'start',
    ]);
  },
);
test(
  'an ambiguous control result never repeats disable through another mutation path',
  native,
  async () => {
    const f = fixture();
    f.enable();
    f.controlError(Error('reply lost'));
    assert.deepEqual(await f.handler('disable', f.profile), { state: 'unavailable' });
    assert.ok(!f.calls.includes('save') && !f.calls.includes('registry-withdraw'));
    assert.equal(f.saved()?.enabled, true);
  },
);
test('a proved absent worker permits removal of only the stored route', native, async () => {
  const f = fixture();
  f.enable();
  f.controlError(Error('NCF_CHATGPT_SERVICE_ABSENT'));
  assert.deepEqual(await f.handler('disable', f.profile), {
    state: 'ready',
    profile: f.profile,
    scope: 'user',
    requiresClosedChatGPT: true,
  });
  assert.ok(f.calls.includes('registry-withdraw') && f.calls.includes('broadcast'));
  assert.equal(f.saved()?.enabled, false);
});
test('a broker reply for another profile cannot establish enabled status', native, async () => {
  const f = fixture();
  f.enable();
  f.answer({ state: 'enabled', profile: f.profile + '-other', scope: 'user' });
  assert.deepEqual(await f.handler('status'), { state: 'unavailable' });
  assert.deepEqual(f.calls, ['read-only', 'control']);
});
test(
  'a stopped service keeps the saved opt-in visible so its partial registration can be disabled',
  native,
  async () => {
    const f = fixture();
    f.enable();
    f.foreign();
    f.controlError(Error('NCF_CHATGPT_SERVICE_ABSENT'));
    assert.deepEqual(await f.handler('status'), {
      state: 'enabled',
      profile: f.profile,
      scope: 'user',
      requiresClosedChatGPT: true,
    });
    assert.ok(!f.calls.includes('save') && !f.calls.includes('registry-withdraw'));
    assert.deepEqual(await f.handler('disable', f.profile), {
      state: 'ready',
      profile: f.profile,
      scope: 'user',
      requiresClosedChatGPT: true,
    });
    assert.equal(f.saved()?.enabled, false);
  },
);
test('Windows refuses unsupported profile layouts without service mutation', native, async () => {
  const f = fixture();
  f.dependencies.stockData = async () => ({ state: 'profileUnavailable' }) as never;
  assert.deepEqual(await f.handler('enable', f.profile), { state: 'unavailable' });
  assert.ok(!f.calls.includes('save') && !f.calls.includes('start'));
});
test('service settings reject executable input, UNC profiles and malformed identities', () => {
  const valid = {
    version: 1,
    enabled: true,
    pipeId: randomUUID(),
    profile: 'C:\\Users\\测试\\.codex',
  };
  assert.deepEqual(service.parseSettings(JSON.stringify(valid)), valid);
  for (const m of [
    { ...valid, executable: 'other.exe' },
    { ...valid, profile: '\\\\remote\\profile' },
    { ...valid, profile: 'relative' },
    { ...valid, pipeId: '../other' },
    { ...valid, enabled: 'true' },
  ])
    assert.throws(() => service.parseSettings(JSON.stringify(m)));
  const url = new URL(service.address(valid));
  assert.equal(url.hostname, 'localhost');
  assert.equal(url.pathname.split(':')[0], '//.\\pipe\\ncf-chatgpt-' + valid.pipeId);
  assert.equal(
    service.runCommand({ appExecutable: 'C:\\测试\\NCF Agent Interconnect.exe' }),
    '"C:\\测试\\NCF Agent Interconnect.exe" --chatgpt-service',
  );
  assert.throws(() => service.runCommand({ appExecutable: 'bad" command' }));
});

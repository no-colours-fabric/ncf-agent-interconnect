import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createMcpSetupHandler } from '../desktop/main/mcp-setup-ipc.js';
import { createWindowsDesktopSessionDeliveryHandler } from '../desktop/main/desktop-session-delivery-windows.js';
import { ApplicationSetupFlow } from '../desktop/renderer/application-setup-model.js';
import { mcpInstructions } from '../desktop/core/instructions.js';
import type { McpSetupClient, McpSetupInvoke } from '../desktop/shared/mcp-setup.js';
import type { DesktopSessionDelivery } from '../desktop/shared/desktop-session-delivery.js';
import { enableChatDelivery } from '../desktop/shared/desktop-session-delivery.js';

async function fixture(t: TestContext) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'ncf-win-connect-')));
  const profile = path.join(directory, '.codex');
  await mkdir(profile);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const options = {
    userData: path.join(directory, 'node'),
    appExecutable: path.join(directory, 'NCF.exe'),
    appPath: path.join(directory, 'resources', 'app.asar'),
    appData: path.join(directory, 'Roaming'),
    installed: true,
    alternateUserData: false,
  };
  type Settings = { version: 1; enabled: boolean; pipeId: string; profile: string };
  let saved: Settings | null = null,
    running = 1,
    foreign = false,
    starts = 0;
  const actions: string[] = [],
    nativeProfiles: string[] = [];
  const ready = (enabled: boolean): DesktopSessionDelivery => ({
    state: enabled ? 'enabled' : 'ready',
    scope: 'user',
    profile,
  });
  const handler = createMcpSetupHandler({
    stateDirectory: options.userData,
    home: directory,
    env: {},
    instructions: (client: McpSetupClient) =>
      mcpInstructions(
        'http://127.0.0.1:42000/mcp',
        'isolated-fixture-token',
        client,
        'file:///isolated/plugin.js',
        JSON.stringify({
          mcpServers: {
            ncf_agent_interconnect: {
              command: 'fixture-runtime',
              args: ['fixture-bridge'],
              env: { ELECTRON_RUN_AS_NODE: '1' },
            },
          },
        }),
      ),
    window: () => null,
    openPath: async () => '',
    dialog: {
      showOpenDialog: async () => {
        throw Error('Unexpected profile picker');
      },
    },
    createDesktopDelivery: (selected) =>
      createWindowsDesktopSessionDeliveryHandler(options, selected, {
        platform: {
          canonical: (filename) => realpath(filename),
          inspectPackage: async () => ({ running }),
        },
        metadata: async () => ({ isFile: () => true, isSymbolicLink: () => false }),
        stockData: async () => ({ state: 'ready', directory: path.join(options.appData, 'Codex') }),
        stockProfile: async () => profile,
        runtime: {
          locations: () => ({ broker: path.join(directory, 'codex-win-pipe.exe') }),
          readSettings: async () => saved,
          saveSettings: async (_options, settings) => {
            saved = settings;
          },
          registry: async () => ({ conflict: foreign, published: false }),
          broadcast: async () => {},
          control: async (_options, settings, action) => {
            if (action === 'disable') {
              saved = { ...settings, enabled: false };
              return ready(false);
            }
            return ready(!!saved?.enabled);
          },
          start: async (_options, settings) => {
            nativeProfiles.push(settings.profile);
            starts++;
            return ready(true);
          },
        },
      }),
  });
  const invoke: McpSetupInvoke = async <T>(method: string, raw: unknown) => {
    actions.push(method);
    const answer = await handler(method, raw, 'isolated-window');
    assert.equal(answer.handled, true);
    if (!answer.handled) throw Error('Unhandled request');
    return answer.result as T;
  };
  return {
    profile,
    invoke,
    actions,
    nativeProfiles,
    flow: new ApplicationSetupFlow(invoke),
    saved: () => saved,
    starts: () => starts,
    closeChatGPT: () => {
      running = 0;
    },
    foreign: (value: boolean) => {
      foreign = value;
    },
  };
}

test(
  'Windows one-click applies the exact profile then retries only delivery after close-required',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const f = await fixture(t);
    t.after(() => f.flow.dispose());
    assert.deepEqual(await f.invoke('desktopSessionDelivery', { action: 'status' }), {
      state: 'configuration-required',
    });
    await assert.rejects(stat(path.join(f.profile, 'config.toml')), { code: 'ENOENT' });
    assert.equal(f.saved(), null);
    assert.equal(f.starts(), 0);
    assert.equal(
      await enableChatDelivery(f.invoke, path.join(f.profile, 'config.toml')),
      'unavailable',
    );
    assert.equal(f.saved(), null);
    assert.equal(f.starts(), 0);
    await f.flow.connect('codex');
    assert.equal(f.flow.getSnapshot().codex.deliveryIssue, 'close-required');
    assert.equal(f.starts(), 0);
    assert.equal(f.saved(), null);
    const file = path.join(f.profile, 'config.toml');
    const bytes = await readFile(file);
    const before = await stat(file);
    f.closeChatGPT();
    await f.flow.connect('codex');
    assert.equal(f.flow.getSnapshot().codex.phase, 'succeeded');
    assert.equal(f.actions.filter((method) => method === 'mcpSetupApply').length, 1);
    assert.deepEqual(f.nativeProfiles, [f.profile]);
    assert.equal(f.saved()?.enabled, true);
    assert.deepEqual(await readFile(file), bytes);
    assert.equal((await stat(file)).mtimeMs, before.mtimeMs);
    const status = await f.invoke<{ codexConnectRequired?: boolean }>('mcpSetupStatus', {
      client: 'codex',
    });
    assert.equal(status.codexConnectRequired, undefined);
    assert.deepEqual(
      await f.invoke('desktopSessionDelivery', { action: 'disable', profile: f.profile }),
      {
        state: 'ready',
        profile: f.profile,
        scope: 'user',
        requiresClosedChatGPT: true,
      },
    );
    assert.equal(f.saved()?.enabled, false);
  },
);

test(
  'Windows one-click preserves a foreign selector and retries without a second configuration write',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const f = await fixture(t);
    t.after(() => f.flow.dispose());
    f.closeChatGPT();
    f.foreign(true);
    await f.flow.connect('codex');
    assert.equal(f.flow.getSnapshot().codex.deliveryIssue, 'conflict');
    assert.equal(f.saved(), null);
    assert.equal(f.starts(), 0);
    const file = path.join(f.profile, 'config.toml');
    const bytes = await readFile(file),
      before = await stat(file);
    f.foreign(false);
    await f.flow.connect('codex');
    assert.equal(f.flow.getSnapshot().codex.phase, 'succeeded');
    assert.equal(f.actions.filter((method) => method === 'mcpSetupApply').length, 1);
    assert.deepEqual(await readFile(file), bytes);
    assert.equal((await stat(file)).mtimeMs, before.mtimeMs);
    assert.deepEqual(f.nativeProfiles, [f.profile]);
  },
);

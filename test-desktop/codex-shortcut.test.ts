import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import type { BrowserWindow, OpenDialogOptions } from 'electron';
import { McpSetupService } from '../desktop/core/mcp-setup.js';
import { mcpInstructions } from '../desktop/core/instructions.js';
import {
  codexShortcutPlatform,
  createCodexShortcutHandler,
} from '../desktop/main/codex-shortcut-ipc.js';
import { createMacCodexShortcut } from '../desktop/main/codex-shortcut-mac.js';
import {
  hasCodexShortcutLaunchFlags,
  type CodexShortcutDestination,
  type CodexShortcutDestinationResult,
} from '../desktop/shared/codex-shortcut.js';
import { supportedLocales } from '../desktop/renderer/i18n/index.js';
import {
  codexShortcutLocales,
  codexShortcutMessages,
} from '../desktop/shared/codex-shortcut-messages.js';

const execute = promisify(execFile);
test('shortcut supports installed desktop platforms and provides independent localized copy', () => {
  assert.equal(codexShortcutPlatform('darwin', false), null);
  assert.equal(codexShortcutPlatform('darwin', true), 'mac');
  assert.equal(codexShortcutPlatform('linux', true), null);
  assert.equal(codexShortcutPlatform('win32', true), 'windows');
  assert.equal(codexShortcutPlatform('win32', true, true), null);
  assert.equal(codexShortcutPlatform('win32', false), null);
  assert.equal(codexShortcutPlatform('darwin', true, true), 'mac');
  assert.deepEqual(codexShortcutLocales, supportedLocales);
  for (const locale of supportedLocales) {
    const copy = codexShortcutMessages(locale);
    for (const [key, value] of Object.entries(copy)) {
      assert.ok(value.trim(), locale + '.' + key);
      if (locale !== 'en' && key !== 'dock')
        assert.notEqual(value, codexShortcutMessages('en')[key as keyof typeof copy]);
    }
  }
});

test('shortcut launch flags route malformed Windows entries away from ordinary startup', () => {
  assert.equal(hasCodexShortcutLaunchFlags(['--background']), false);
  assert.equal(hasCodexShortcutLaunchFlags(['--data-dir', 'isolated']), false);
  for (const args of [
    ['--launch-codex', '--launcher-manifest', 'C:\\fixture\\manifest.json'],
    ['--launch-codex'],
    ['--launch-codex=true'],
    ['--launcher-manifest'],
    ['--launcher-manifest=malformed'],
  ])
    assert.equal(hasCodexShortcutLaunchFlags(args), true, args.join(' '));
});

test('shortcut verifies an exact unremembered Codex config without Apply or profile writes', async (t) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ncf-codex-profile-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const defaultProfile = path.join(root, '.codex');
  const selectedProfile = path.join(root, 'Other Codex profile');
  const desktopData = path.join(root, 'Codex desktop');
  const stateDirectory = path.join(root, 'ncf-state');
  await Promise.all(
    [defaultProfile, selectedProfile, desktopData].map((directory) =>
      mkdir(directory, { mode: 0o700 }),
    ),
  );
  const defaultConfig = path.join(defaultProfile, 'config.toml');
  const selectedConfig = path.join(selectedProfile, 'config.toml');
  const nodeUrl = 'http://127.0.0.1:44000/mcp';
  const instructions = mcpInstructions(nodeUrl, 'isolated-test-token', 'codex', '', '{}');
  const matching = '# Preserve this comment\n' + instructions.configuration;
  const service = new McpSetupService({
    stateDirectory,
    home: root,
    env: {},
    instructions: () => instructions,
  });
  const owner = { isDestroyed: () => false } as BrowserWindow;
  const selectedDestination = path.join(root, 'Custom shortcut.app');
  let cancelSave = false;
  const input = (...destinations: CodexShortcutDestination[]) => ({ locale: 'en', destinations });
  const complete = (...destinations: CodexShortcutDestinationResult[]) => ({
    state: 'complete',
    destinations,
  });
  const calls: string[] = [];
  const createRequests: Array<Parameters<typeof createMacCodexShortcut>[0]> = [];
  const options: Parameters<typeof createCodexShortcutHandler>[0] = {
    platform: 'darwin',
    installed: true,
    appExecutable: path.join(root, 'NCF'),
    appPath: root,
    appData: root,
    userData: stateDirectory,
    home: root,
    desktop: root,
    window: () => owner,
    status: () => service.status('codex'),
    configuredFile: (filename) => service.configuredCodexFile(filename),
    dialog: {
      showOpenDialog: async (_window: BrowserWindow, options: OpenDialogOptions) => {
        const file = options.properties?.includes('openFile');
        calls.push(file ? 'config' : 'data');
        if (file) assert.equal(options.defaultPath, defaultConfig);
        else assert.equal(options.message, selectedProfile);
        return { canceled: false, filePaths: [file ? selectedConfig : desktopData] };
      },
      showSaveDialog: async () => {
        calls.push('save');
        return cancelSave
          ? { canceled: true, filePath: '' }
          : { canceled: false, filePath: selectedDestination };
      },
    },
  };
  const handle = createCodexShortcutHandler(options, {
    findMacCodex: async () => ({
      desktop: path.join(root, 'Codex.app'),
      desktopExecutable: path.join(root, 'Codex.app/Contents/MacOS/Codex'),
      cli: path.join(root, 'codex'),
    }),
    macShortcutDirectory: realpath,
    createMacCodexShortcut: async (options) => {
      createRequests.push(options);
      return 'created';
    },
  });

  await writeFile(defaultConfig, matching);
  await t.test(
    'configured without a saved path can use the explicitly selected profile',
    async () => {
      await writeFile(selectedConfig, matching);
      const status = await service.status('codex');
      assert.equal(status.state, 'configured');
      assert.equal(status.remembered, false);
      assert.deepEqual(
        await handle('codexShortcutCreate', input('custom')),
        complete({ destination: 'custom', result: 'created' }),
      );
      assert.deepEqual(calls.splice(0), ['config', 'data', 'save']);
      assert.equal(createRequests.length, 1);
      assert.equal(createRequests[0].profile, selectedProfile);
      assert.equal(createRequests[0].desktopData, desktopData);
      assert.equal((await service.status('codex')).remembered, false);
      assert.equal(await readFile(selectedConfig, 'utf8'), matching);
      await assert.rejects(stat(stateDirectory), { code: 'ENOENT' });
    },
  );

  await t.test(
    'a mismatched or disabled selected config does not use the matching default',
    async () => {
      const wrongNode = matching.replace(nodeUrl, 'http://127.0.0.1:44001/mcp');

      const wrongToken = matching.replace('isolated-test-token', 'different-fixture-token');
      for (const invalid of [wrongNode, wrongToken, matching + 'enabled = false\n']) {
        await writeFile(selectedConfig, invalid);
        assert.deepEqual(await handle('codexShortcutCreate', input('custom')), {
          state: 'failed',
          reason: 'setupRequired',
        });
        assert.deepEqual(calls.splice(0), ['config']);
        assert.equal(createRequests.length, 1);
        assert.equal(await readFile(selectedConfig, 'utf8'), invalid);
        assert.equal(await readFile(defaultConfig, 'utf8'), matching);
        await assert.rejects(stat(stateDirectory), { code: 'ENOENT' });
      }
    },
  );

  await t.test('cancelling a custom destination cancels every selected write', async () => {
    await writeFile(selectedConfig, matching);
    cancelSave = true;
    const count = createRequests.length;
    assert.deepEqual(
      await handle('codexShortcutCreate', input('desktop', 'applications', 'custom')),
      { state: 'cancelled' },
    );
    assert.deepEqual(calls.splice(0), ['config', 'data', 'save']);
    assert.equal(createRequests.length, count);
    await assert.rejects(stat(path.join(root, 'Applications')), { code: 'ENOENT' });
    cancelSave = false;
  });

  await t.test(
    'Mac destinations report collisions and a remaining manual Dock step separately',
    async () => {
      const alreadyPresent = path.join(root, 'Codex with NCF.app');
      await writeFile(alreadyPresent, 'Existing shortcut stays');
      const count = createRequests.length;
      assert.deepEqual(
        await handle('codexShortcutCreate', input('desktop', 'applications', 'dock')),
        complete(
          { destination: 'desktop', result: 'alreadyExists' },
          { destination: 'applications', result: 'created' },
          { destination: 'dock', result: 'dockPending' },
        ),
      );
      assert.deepEqual(calls.splice(0), ['config', 'data']);
      assert.equal(createRequests.length, count + 1);
      assert.equal(
        createRequests[count].destination,
        path.join(root, 'Applications', 'Codex with NCF.app'),
      );
      assert.equal(createRequests[count].profile, selectedProfile);
      assert.equal(await readFile(alreadyPresent, 'utf8'), 'Existing shortcut stays');

      assert.deepEqual(
        await handle('codexShortcutCreate', input('dock')),
        complete({ destination: 'dock', result: 'dockPending' }),
      );
      assert.deepEqual(calls.splice(0), ['config', 'data', 'save']);
      assert.equal(createRequests.length, count + 2);
      assert.equal(createRequests[count + 1].destination, selectedDestination);
    },
  );

  await t.test(
    'Windows uses Desktop and the resolved user Programs folder with one profile',
    async () => {
      const desktop = path.join(root, 'Codex with NCF.lnk');
      const programs = path.join(root, 'Redirected Programs');
      await mkdir(programs);
      let resolveCalls = 0;
      const createCalls: string[] = [];
      const create = createCodexShortcutHandler(
        {
          ...options,
          platform: 'win32',
          dialog: {
            ...options.dialog,
            showSaveDialog: async () =>
              assert.fail('Explicit destinations must not prompt for a save path'),
          },
        },
        undefined,
        {
          create: async (request, context) => {
            createCalls.push(request.destination);
            assert.deepEqual(request, {
              destination:
                createCalls.length === 1 ? desktop : path.join(programs, 'Codex with NCF.lnk'),
              profile: selectedProfile,
              desktopData,
              appExecutable: options.appExecutable,
              appPath: root,
            });
            assert.deepEqual(context, { userData: stateDirectory });
            assert.notEqual(context.userData, options.appData);
            return 'created';
          },
          programs: async () => {
            resolveCalls++;
            return programs;
          },
        },
      );
      assert.deepEqual(
        await create('codexShortcutCreate', input('desktop', 'startMenu')),
        complete(
          { destination: 'desktop', result: 'created' },
          { destination: 'startMenu', result: 'created' },
        ),
      );
      assert.deepEqual(calls.splice(0), ['config', 'data']);
      assert.equal(createCalls.length, 2);
      assert.equal(resolveCalls, 1);
      assert.deepEqual(await create('codexShortcutCreate', input('dock')), {
        state: 'failed',
        reason: 'failed',
      });
      await assert.rejects(create('codexShortcutCreate', input('desktop', 'desktop')));
      assert.deepEqual(calls, []);
      assert.equal(await readFile(selectedConfig, 'utf8'), matching);
      await assert.rejects(stat(stateDirectory), { code: 'ENOENT' });
    },
  );
});

test(
  'Mac shortcut creates a signed bundle, refuses replacement, and passes CLI arguments without launch environment',
  { skip: process.platform !== 'darwin' || process.env.NCF_TEST_CODEX_SHORTCUT_RUNTIME !== '1' },
  async (t) => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ncf-shortcut-')));
    t.after(() => rm(root, { recursive: true, force: true }));
    const profile = path.join(root, "Codex's profile");
    const desktopData = path.join(root, 'Desktop data');
    await mkdir(profile, { mode: 0o700 });
    await mkdir(desktopData, { mode: 0o700 });
    const bridgeProfile = path.join(root, 'c');
    await mkdir(bridgeProfile, { mode: 0o700 });
    const config = path.join(profile, 'config.toml');
    await writeFile(config, '# Existing Codex settings\n');
    const cli = path.join(root, "Codex's cli");
    await writeFile(cli, '#!/bin/sh\nprintf "%s\\n" "$@"\nexit 17\n', { mode: 0o755 });
    const destination = path.join(root, 'Codex with NCF.app');
    const options = {
      destination,
      profile,
      desktopData,
      cli,
      desktop: path.join(root, 'Fixture Codex.app'),
      desktopExecutable: '/not-used/in-passthrough',
      appExecutable: process.execPath,
      appPath: process.cwd(),
      alreadyOpen: 'Close this profile',
      launchFailed: 'Could not open Codex',
    };
    assert.equal(await createMacCodexShortcut(options), 'created');
    await execute('/usr/bin/codesign', ['--verify', '--strict', destination]);
    const wrapper = path.join(destination, 'Contents/Resources/ncf-codex-cli');
    assert.ok((await stat(wrapper)).mode & 0o111);
    const manifest = path.join(destination, 'Contents/Resources/launch.json');
    const original = await readFile(manifest, 'utf8');
    assert.deepEqual(JSON.parse(original), {
      profile,
      desktopData,
      cli,
      desktop: options.desktop,
      runtime: options.appExecutable,
      alreadyOpen: options.alreadyOpen,
      launchFailed: options.launchFailed,
    });
    assert.equal(
      await createMacCodexShortcut({ ...options, launchFailed: 'Changed' }),
      'alreadyExists',
    );
    assert.equal(await readFile(manifest, 'utf8'), original);
    const args = ['--flag', "spaces and 'quotes'", 'αβ $literal'];
    await assert.rejects(
      execute(wrapper, args, { env: {}, encoding: 'utf8' }),
      (error: NodeJS.ErrnoException & { stdout?: string }) => {
        assert.equal(Number(error.code), 17);
        assert.equal(error.stdout, args.join('\n') + '\n');
        return true;
      },
    );
    const bridgeShortcut = path.join(root, 'Ownership fixture.app');
    assert.equal(
      await createMacCodexShortcut({
        ...options,
        profile: bridgeProfile,
        destination: bridgeShortcut,
        desktopExecutable: await realpath(process.execPath),
      }),
      'created',
    );
    const cliScript = [
      '#!/bin/sh',
      'printf "%s\\n" "$@" > "$FIXTURE_ARGV"',
      'printf "%s" "${NCF_CODEX_SHORTCUT_OWNER_MARKER-}" > "$FIXTURE_MARKER"',
      'exit 17',
      '',
    ].join('\n');
    await writeFile(cli, cliScript);
    const fixtureArgs = path.join(root, 'argv');
    const verification = path.join(root, 'marker-env');
    const ownerMarker = path.join(root, 'ncf-codex-owner-AB12CD');
    const ownedWrapper = path.join(bridgeShortcut, 'Contents/Resources/ncf-codex-cli');
    const env = {
      TMPDIR: root,
      CODEX_HOME: bridgeProfile,
      NCF_CODEX_SHORTCUT_OWNER_MARKER: ownerMarker,
      FIXTURE_ARGV: fixtureArgs,
      FIXTURE_MARKER: verification,
    };
    await writeFile(ownerMarker, '', { mode: 0o600 });
    const stdio = ['app-server', '--listen', 'stdio://'];
    await assert.rejects(execute(ownedWrapper, ['app-server', '--help'], { env }), {
      code: 17,
    });
    assert.equal((await stat(ownerMarker)).size, 0, 'Help does not claim ownership');
    await assert.rejects(
      execute(ownedWrapper, stdio, { env }),
      /The Codex App Server stopped during startup/,
    );
    assert.match(await readFile(fixtureArgs, 'utf8'), /unix:\/\/.*app-server-control\.sock/);
    await assert.rejects(stat(ownerMarker), { code: 'ENOENT' });
    assert.equal(await readFile(verification, 'utf8'), '');
    await assert.rejects(execute(ownedWrapper, stdio, { env }), { code: 17 });
    assert.equal(await readFile(fixtureArgs, 'utf8'), stdio.join('\n') + '\n');

    assert.equal(await readFile(config, 'utf8'), '# Existing Codex settings\n');
  },
);

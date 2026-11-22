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
  assert.deepEqual(codexShortcutLocales, supportedLocales);
  for (const locale of supportedLocales) {
    const copy = codexShortcutMessages(locale);
    for (const [key, value] of Object.entries(copy)) {
      assert.ok(value.trim(), locale + '.' + key);
      if (locale !== 'en')
        assert.notEqual(value, codexShortcutMessages('en')[key as keyof typeof copy]);
    }
  }
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
  const selectedDestination = path.join(root, 'Codex with NCF.app');
  const calls: string[] = [];
  const createRequests: Array<Parameters<typeof createMacCodexShortcut>[0]> = [];
  const handle = createCodexShortcutHandler(
    {
      platform: 'darwin',
      installed: true,
      appExecutable: path.join(root, 'NCF'),
      appPath: root,
      appData: root,
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
          return { canceled: false, filePath: selectedDestination };
        },
      },
    },
    {
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
    },
  );

  await writeFile(defaultConfig, matching);
  await t.test(
    'configured without a saved path can use the explicitly selected profile',
    async () => {
      await writeFile(selectedConfig, matching);
      const status = await service.status('codex');
      assert.equal(status.state, 'configured');
      assert.equal(status.remembered, false);
      assert.equal(await handle('codexShortcutCreate', { locale: 'en' }), 'created');
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
        assert.equal(await handle('codexShortcutCreate', { locale: 'en' }), 'setupRequired');
        assert.deepEqual(calls.splice(0), ['config']);
        assert.equal(createRequests.length, 1);
        assert.equal(await readFile(selectedConfig, 'utf8'), invalid);
        assert.equal(await readFile(defaultConfig, 'utf8'), matching);
        await assert.rejects(stat(stateDirectory), { code: 'ENOENT' });
      }
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

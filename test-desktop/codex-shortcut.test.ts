import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { codexShortcutPlatform } from '../desktop/main/codex-shortcut-ipc.js';
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

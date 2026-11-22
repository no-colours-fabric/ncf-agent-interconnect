import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";

test(
  'Mac bridge accepts only direct main or canonical immediate Aperitif and upgrades old shortcuts',
  {
    skip: process.platform !== 'darwin' || process.env.NCF_TEST_CODEX_SHORTCUT_RUNTIME !== '1',
  },
  async (t) => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ncf-mac-owner-')));
    t.after(() => rm(root, { recursive: true, force: true }));
    const contents = path.join(root, 'Vendor.app/Contents');
    const desktop = path.join(contents, 'MacOS/ChatGPT');
    const versions = path.join(contents, 'Frameworks/Codex Framework.framework/Versions');
    const version = path.join(versions, '158.0.8127.37');
    const helper = path.join(
      version,
      'Helpers/Codex (Aperitif).app/Contents/MacOS/Codex (Aperitif)',
    );
    const other = path.join(root, 'foreign/Codex (Aperitif)');
    const profile = path.join(root, 'profile');
    await Promise.all(
      [path.dirname(desktop), path.dirname(helper), path.dirname(other), profile].map((p) =>
        mkdir(p, { recursive: true, mode: 0o700 }),
      ),
    );
    await symlink('158.0.8127.37', path.join(versions, 'Current'));
    const source = path.join(root, 'parent.c');
    await writeFile(
      source,
      [
        '#include <unistd.h>',
        '#include <sys/wait.h>',
        '#include <errno.h>',
        'int main(int argc, char **argv) {',
        '  if (argc < 2) return 91;',
        '  pid_t child = fork();',
        '  if (child < 0) return 92;',
        '  if (!child) { execv(argv[1], argv + 1); _exit(93); }',
        '  int status; while (waitpid(child, &status, 0) < 0) if (errno != EINTR) return 94;',
        '  return WIFEXITED(status) ? WEXITSTATUS(status) : 95;',
        '}',
      ].join('\n'),
    );
    await execute('/usr/bin/xcrun', ['clang', source, '-o', desktop], { timeout: 15000 });
    await copyFile(desktop, helper);
    await copyFile(desktop, other);
    const marker = path.join(root, 'ncf-codex-owner-AB12CD');
    const argvFile = path.join(root, 'vendor-argv');
    const legacyUsed = path.join(root, 'legacy-matcher-used');
    const legacyNative = path.join(root, 'old-shortcut-native');
    await writeFile(legacyNative, '#!/bin/sh\nprintf used > ' + quote(legacyUsed) + '\nexit 99\n', {
      mode: 0o755,
    });
    const cli = path.join(root, 'vendor-cli');
    await writeFile(cli, '#!/bin/sh\nprintf "%s\\n" "$@" > ' + quote(argvFile) + '\nexit 17\n', {
      mode: 0o755,
    });
    const wrapper = path.join(root, 'old-shortcut-wrapper');
    // The old shortcut still supplies an obsolete matcher. Updated installed JS
    // must select its own build/assets matcher without rewriting this wrapper.
    await writeFile(
      wrapper,
      '#!/bin/sh\nexec /usr/bin/env -u NODE_OPTIONS ELECTRON_RUN_AS_NODE=1 ' +
        quote(process.execPath) +
        ' ' +
        quote(path.resolve('build/integrations/codex-shortcut-bridge.js')) +
        ' "$@"\n',
      { mode: 0o755 },
    );
    const env = {
      ...process.env,
      TMPDIR: root,
      CODEX_HOME: profile,
      NCF_CODEX_SHORTCUT_CLI: cli,
      NCF_CODEX_SHORTCUT_PROFILE: profile,
      NCF_CODEX_SHORTCUT_DESKTOP: desktop,
      NCF_CODEX_SHORTCUT_NATIVE: legacyNative,
      NCF_CODEX_SHORTCUT_OWNER_MARKER: marker,
    };
    const args = ['app-server', '--analytics-default-enabled', '-c', 'fixture=true'];
    async function run(chain: string[], input: string[], claimed: boolean) {
      await writeFile(marker, '', { mode: 0o600 });
      let error: (Error & { code?: number; stderr?: string }) | undefined;
      try {
        await execute(desktop, [...chain, wrapper, ...input], { env, timeout: 10000 });
      } catch (caught) {
        error = caught as typeof error;
      }
      assert.ok(error);
      const actual = (await readFile(argvFile, 'utf8')).trimEnd().split('\n');
      if (claimed) {
        assert.match(error.stderr ?? '', /The Codex App Server stopped during startup/);
        assert.deepEqual(actual, [
          ...input,
          '--listen',
          'unix://' + path.join(profile, 'app-server-control/app-server-control.sock'),
        ]);
        await assert.rejects(stat(marker), { code: 'ENOENT' });
        await assert.rejects(
          execute(desktop, [...chain, wrapper, ...input], { env, timeout: 10000 }),
          { code: 17 },
        );
        assert.deepEqual((await readFile(argvFile, 'utf8')).trimEnd().split('\n'), input);
      } else {
        assert.equal(error.code, 17);
        assert.deepEqual(actual, input);
        assert.equal((await stat(marker)).size, 0);
      }
      await assert.rejects(stat(legacyUsed), { code: 'ENOENT' });
    }
    await run([], args, true);
    await run([helper], args, true);
    await run([other], args, false);
    await run([other, helper], args, false);
    await run([helper], ['app-server', '--help'], false);
    await run([helper], ['debug', 'mcp-server'], false);
  },
);

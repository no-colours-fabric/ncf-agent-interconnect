import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline';
import {
  mkdtemp,
  mkdir,
  copyFile,
  writeFile,
  readFile,
  realpath,
  lstat,
  rm,
  rename,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import net from 'node:net';

const execute = promisify(execFile);
const digest = async (file: string) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
type Exit = ChildProcess & { completed: Promise<number | null> };
const within = <T>(promise: Promise<T>, timeout = 12000) => {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Error('Isolated lifecycle fixture timeout')), timeout);
    }),
  ]).finally(() => clearTimeout(timer));
};
function launch(image: string, args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(image, args, {
    env,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  }) as Exit;
  child.completed = new Promise((resolve, reject) => {
    child.once('exit', resolve);
    child.once('error', reject);
  });
  let stderr = '';
  child.stderr!.on('data', (bytes) => {
    stderr = (stderr + bytes).slice(-4000);
  });
  const ready = within(
    new Promise<string>((resolve, reject) => {
      const reader = createInterface({ input: child.stdout! });
      reader.once('line', resolve);
      child.once('exit', () => reject(Error('Fixture exited before ready: ' + stderr)));
      child.once('error', reject);
    }),
  );
  return { child, ready };
}
function control(name: string, action: string) {
  return within(
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const socket = net.connect('\\\\.\\pipe\\' + name + '-control');
      socket.once('error', reject);
      socket.once('connect', () => socket.write(action + '\n'));
      let text = '';
      socket.on('data', (bytes) => {
        text += bytes.toString();
        if (text.includes('\n')) {
          socket.end();
          resolve(JSON.parse(text.split('\n')[0]));
        }
      });
    }),
  );
}

test(
  'isolated Windows Quit to upgrade preserves the enabled service choice and respects active/foreign clients',
  { skip: process.platform !== 'win32' },
  async (t) => {
    // An explicit archived source enables a mixed-version compatibility probe.
    // The default regression always tests the current product helpers.
    const legacySource = process.env.NCF_LIFECYCLE_LEGACY_PIPE_SOURCE;
    const base = await realpath(await mkdtemp(path.join(tmpdir(), 'ncf-lifecycle-')));
    const csc = path.join(
      process.env.SystemRoot ?? 'C:\\Windows',
      'Microsoft.NET',
      'Framework64',
      'v4.0.30319',
      'csc.exe',
    );
    const compile = async (source: string, output: string, references: string[]) => {
      await execute(
        csc,
        [
          '/nologo',
          '/optimize+',
          '/target:exe',
          '/platform:x64',
          ...references.map((x) => '/reference:' + x),
          '/out:' + output,
          path.resolve(source),
        ],
        { windowsHide: true },
      );
    };
    const fixtureExe = path.join(base, 'fixture.exe'),
      pipeExe = path.join(base, 'pipe.exe'),
      preflightExe = path.join(base, 'preflight.exe');
    await compile('test-desktop/fixtures/windows-session-lifecycle.cs', fixtureExe, [
      'System.Management.dll',
      'System.Web.Extensions.dll',
    ]);
    await compile(legacySource ?? 'desktop/integrations/codex-win-pipe.cs', pipeExe, [
      'System.Web.Extensions.dll',
    ]);
    await compile('desktop/integrations/ncf-update-preflight.cs', preflightExe, [
      'System.Management.dll',
      'System.Web.Extensions.dll',
    ]);
    const reports: unknown[] = [];
    let completed = true;
    t.after(async () => {
      if (process.env.NCF_LIFECYCLE_REPORT)
        await writeFile(
          process.env.NCF_LIFECYCLE_REPORT,
          JSON.stringify({ nativeFixture: true, workingProcessesChanged: false, reports }, null, 2),
        );
      // Retain failed fixture roots if an orderly cleanup could not be proved.
      if (completed) {
        assert.equal((await lstat(base)).isSymbolicLink(), false);
        await rm(base, { recursive: true, force: true });
      }
    });
    const modes = legacySource
      ? (['owned', 'active'] as const)
      : (['owned', 'active', 'foreign', 'wrong-parent', 'busy'] as const);
    for (const mode of modes)
      await t.test(mode, async () => {
        const root = path.join(base, mode);
        await mkdir(root);
        await writeFile(path.join(root, '.ncf-lifecycle-fixture'), randomUUID());
        const assets = path.join(root, 'resources', 'app.asar.unpacked', 'build', 'assets');
        await mkdir(assets, { recursive: true });
        await mkdir(path.join(root, 'resources', 'tools'));
        await mkdir(path.join(root, 'vendor'));
        await mkdir(path.join(root, 'foreign'));
        await mkdir(path.join(root, 'profile'));
        const image = path.join(root, 'NCF Agent Interconnect.exe');
        for (const file of [
          image,
          path.join(root, 'vendor', 'codex.exe'),
          path.join(root, 'vendor', 'codex-code-mode-host.exe'),
          path.join(root, 'foreign', 'codex-code-mode-host.exe'),
          path.join(root, 'BusyEditor.exe'),
        ])
          await copyFile(fixtureExe, file);
        const archive = path.join(root, 'resources', 'app.asar');
        await writeFile(archive, 'Isolated immutable fixture archive');
        await copyFile(pipeExe, path.join(assets, 'codex-win-pipe.exe'));
        await copyFile(
          preflightExe,
          path.join(root, 'resources', 'tools', 'ncf-update-preflight.exe'),
        );
        await writeFile(
          path.join(root, 'resources', 'ncf-launcher-identity.json'),
          JSON.stringify({
            version: 1,
            asarHash: await digest(archive),
            pipeHash: await digest(pipeExe),
          }),
        );
        const state = path.join(root, 'profile', 'service.json'),
          history = path.join(root, 'profile', 'history.json');
        await writeFile(
          state,
          JSON.stringify({ enabled: true, profile: path.join(root, 'profile') }),
        );
        await writeFile(
          history,
          JSON.stringify({ ids: ['synthetic-existing-message'], generation: 3 }),
        );
        const before = {
          state: await digest(state),
          history: await digest(history),
          archive: await digest(archive),
        };
        const pipe = 'ncf-chatgpt-' + randomUUID();
        const env: NodeJS.ProcessEnv = { ...process.env, NCF_LIFECYCLE_PIPE: pipe };
        delete env.ELECTRON_RUN_AS_NODE;
        const service = launch(
          image,
          [
            'worker',
            root,
            mode === 'busy' ? 'none' : mode,
            path.join(
              root,
              'resources',
              'app.asar',
              'build',
              'integrations',
              'codex-windows-service.cjs',
            ),
          ],
          env,
        );
        let busy: ReturnType<typeof launch> | undefined;
        let serviceExited = false;
        const report: Record<string, unknown> = {
          mode,
          fixtureRoot: root,
          pipe,
          originalSettingEnabled: true,
          guiLaunched: false,
          fullGuiTested: false,
          mixedLegacyHelper: Boolean(legacySource),
        };
        reports.push(report);
        try {
          const ready = JSON.parse(await service.ready);
          report.workerPid = service.child.pid;
          report.serverPid = ready.server;
          assert.deepEqual(await control(pipe, 'status'), { state: 'enabled' });
          // The hub is absent. Its independent service remains, just as after Quit.
          if (mode === 'busy') {
            busy = launch(path.join(root, 'BusyEditor.exe'), ['busy', root], env);
            await busy.ready;
          }
          const probe = async (pid: number) => {
            const result = await execute(fixtureExe, ['probe', root, String(pid)], {
              env,
              windowsHide: true,
              timeout: 35000,
            });
            return JSON.parse(result.stdout) as {
              error?: string;
              phase?: string;
              recognized: number;
              stopped: boolean;
              exclusiveOpen: boolean;
              executableFree: boolean;
              blockers: { pid: number; role: string }[];
            };
          };
          const initial = await probe(service.child.pid!);
          report.initial = initial;
          assert.equal(initial.error, undefined, JSON.stringify(initial));
          assert.equal(initial.recognized, 1);
          if (mode === 'owned') {
            if (legacySource) {
              assert.equal(
                initial.stopped,
                false,
                'The unchanged old console matcher refuses its direct host',
              );
              assert.equal(initial.exclusiveOpen, false);
              assert.equal(initial.executableFree, false);
              assert.ok(initial.blockers.some((row) => row.pid === service.child.pid));
              assert.equal(await digest(state), before.state);
              assert.equal(await digest(history), before.history);
              report.profileHistoryAndEnablePreserved = true;
              report.replacementUnlocked = false;
              // Only fixture teardown can close this simulated old process tree.
              // This is not a product migration or a user recovery procedure.
              return;
            }
            assert.equal(
              initial.stopped,
              true,
              'A verified direct vendor host must not prevent graceful shutdown',
            );
            assert.equal(initial.exclusiveOpen, true);
            assert.deepEqual(initial.blockers, []);
            assert.equal(await within(service.child.completed), 0);
            serviceExited = true;
          } else if (mode === 'active') {
            assert.equal(initial.stopped, false);
            assert.equal(initial.exclusiveOpen, false);
            assert.ok(initial.blockers.some((row) => row.pid === service.child.pid));
            await control(pipe, 'release-active');
            const retry = await probe(service.child.pid!);
            report.retry = retry;
            assert.equal(retry.stopped, true);
            assert.equal(retry.exclusiveOpen, true);
            assert.equal(await within(service.child.completed), 0);
            serviceExited = true;
          } else if (mode === 'foreign' || mode === 'wrong-parent') {
            assert.equal(initial.stopped, false);
            assert.equal(initial.exclusiveOpen, false);
            // Only the owner of this disposable fixture asks it to close normally.
            await control(pipe, 'cleanup');
            assert.equal(await within(service.child.completed), 0);
            serviceExited = true;
            const retry = await probe(0);
            report.retry = retry;
            assert.equal(retry.stopped, true);
            assert.equal(retry.exclusiveOpen, true);
          } else {
            assert.equal(initial.stopped, true);
            assert.equal(await within(service.child.completed), 0);
            serviceExited = true;
            assert.equal(initial.exclusiveOpen, false);
            assert.ok(initial.blockers.some((row) => row.pid === busy!.child.pid));
            assert.ok(initial.blockers.some((row) => row.role === 'Close BusyEditor.exe'));
            busy!.child.stdin!.end('quit\n');
            assert.equal(await within(busy!.child.completed), 0);
            const retry = await probe(0);
            report.retry = retry;
            assert.equal(retry.stopped, true);
            assert.equal(retry.exclusiveOpen, true);
            assert.deepEqual(retry.blockers, []);
          }
          assert.equal(await digest(state), before.state);
          assert.equal(await digest(history), before.history);
          assert.equal(await digest(archive), before.archive);
          await rename(archive, archive + '.upgrade-backup');
          await rename(archive + '.upgrade-backup', archive);
          report.profileHistoryAndEnablePreserved = true;
          report.replacementUnlocked = true;
        } finally {
          try {
            if (!serviceExited && service.child.exitCode === null) {
              await control(pipe, 'cleanup');
              await within(service.child.completed);
            }
            if (busy?.child.exitCode === null) {
              busy.child.stdin!.end('quit\n');
              await within(busy.child.completed);
            }
          } catch {
            completed = false;
          }
        }
      });
  },
);

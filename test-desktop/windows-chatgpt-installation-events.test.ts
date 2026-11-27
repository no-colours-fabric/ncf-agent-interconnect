import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { spawn, type ChildProcess } from 'node:child_process';
import { test } from 'node:test';
import {
  watchWindowsChatgptInstallation,
  windowsChatgptInstallationEvents,
} from '../desktop/main/chatgpt-windows-installation-events.js';

function fixture() {
  const children: (EventEmitter & { stdin: PassThrough; stdout: PassThrough })[] = [];
  const launch = (() => {
    const child = Object.assign(new EventEmitter(), {
      stdin: new PassThrough(),
      stdout: new PassThrough(),
    });
    children.push(child);
    return child;
  }) as unknown as typeof spawn;
  return { children, launch };
}

test('Windows package subscription forwards only invalidation markers and stops its own helper', () => {
  const f = fixture();
  const changes: string[] = [];
  const stop = watchWindowsChatgptInstallation((reason) => changes.push(reason), {
    platform: 'win32',
    launch: f.launch,
  });
  const child = f.children[0];
  child.stdout.write('ready\nignored\nchanged\n');
  assert.deepEqual(changes, ['ready', 'changed']);
  // A GUI lifecycle has no package event and cannot invalidate the version.
  child.emit('gui-open');
  child.emit('gui-close');
  assert.deepEqual(changes, ['ready', 'changed']);
  stop();
  assert.equal(child.stdin.writableEnded, true);
  child.stdout.write('changed\n');
  assert.deepEqual(changes, ['ready', 'changed']);
  stop();
});

test('only a failed event transport reconnects, and disposal cancels that retry', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  let failures = 0;
  const stop = watchWindowsChatgptInstallation(() => {}, {
    platform: 'win32',
    launch: f.launch,
    unavailable: () => failures++,
  });
  f.children[0].emit('error', Error('Fixture stream failed'));
  f.children[0].emit('exit', 1);
  assert.equal(failures, 1);
  context.mock.timers.tick(1000);
  assert.equal(f.children.length, 2);
  f.children[1].emit('exit', 1);
  stop();
  context.mock.timers.tick(30000);
  assert.equal(f.children.length, 2);
});

test('other platforms do not launch a Windows package watcher', () => {
  const f = fixture();
  watchWindowsChatgptInstallation(() => assert.fail(), {
    platform: 'darwin',
    launch: f.launch,
  })();
  assert.equal(f.children.length, 0);
});

test(
  'native WinRT registration filters fixture package callbacks and exits on stdin EOF',
  { skip: process.platform !== 'win32', timeout: 15000 },
  async (context) => {
    let child: ChildProcess | undefined;
    let exited: Promise<number | null> | undefined;
    let stderr = '';
    const changes: string[] = [];
    const fixtureTypes = String.raw`
public sealed class NcfFixtureId {
    public string Name { get; set; }
    public string FamilyName { get; set; }
}
public sealed class NcfFixturePackage {
    public NcfFixtureId Id { get; set; }
}
public sealed class NcfFixturePackageEvent {
    public NcfFixturePackage Package { get; set; }
    public bool IsComplete { get; set; }
}
public sealed class NcfFixtureUpdateEvent {
    public NcfFixturePackage SourcePackage { get; set; }
    public NcfFixturePackage TargetPackage { get; set; }
    public bool IsComplete { get; set; }
}
public sealed class NcfFixtureStatusEvent {
    public NcfFixturePackage Package { get; set; }
}
public static class NcfFixtureCallbacks {
    public static void Run() {
        var id = new NcfFixtureId { Name = "Other.Package", FamilyName = "Other.Package_fixture" };
        var args = new NcfFixturePackageEvent { Package = new NcfFixturePackage { Id = id }, IsComplete = true };
        NcfPackageChange.Changed(null, args);
        id.Name = "OpenAI.Codex";
        NcfPackageChange.Changed(null, args);
        id.FamilyName = "OpenAI.Codex_2p2nqsd0c76g0";
        args.IsComplete = false;
        NcfPackageChange.Changed(null, args);
        args.IsComplete = true;
        NcfPackageChange.Changed(null, args);
        NcfPackageChange.Changed(null, new NcfFixtureUpdateEvent {
            SourcePackage = new NcfFixturePackage { Id = new NcfFixtureId { Name = "Other.Package" } },
            TargetPackage = args.Package, IsComplete = true
        });
        NcfPackageChange.Changed(null, new NcfFixtureStatusEvent { Package = args.Package });
    }
}
`;
    // The catalog and add/remove accessors are real. Only the callback payloads
    // below are synthetic; no installed package is changed for this test.
    const script = windowsChatgptInstallationEvents
      .replace("\n'@\n$catalog", `\n${fixtureTypes}\n'@\n$catalog`)
      .replace(
        '[Console]::In.ReadToEnd() | Out-Null',
        '[NcfFixtureCallbacks]::Run(); [Console]::In.ReadToEnd() | Out-Null',
      );
    const launch = ((command: string, args: string[], options: object) => {
      assert.equal(
        args.at(-1),
        Buffer.from(windowsChatgptInstallationEvents, 'utf16le').toString('base64'),
      );
      child = spawn(
        command,
        [...args.slice(0, -1), Buffer.from(script, 'utf16le').toString('base64')],
        { ...options, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      child.stderr!.on('data', (bytes) => (stderr += bytes.toString()));
      exited = new Promise((resolve, reject) => {
        child!.once('exit', resolve);
        child!.once('error', reject);
      });
      return child;
    }) as typeof spawn;
    let complete: () => void;
    let unavailable: (error: Error) => void;
    const observed = new Promise<void>((resolve, reject) => {
      complete = resolve;
      unavailable = reject;
    });
    const stop = watchWindowsChatgptInstallation(
      (reason) => {
        changes.push(reason);
        if (changes.length === 4) complete();
      },
      {
        launch,
        unavailable: () => unavailable(Error(stderr || 'Native event helper unavailable')),
      },
    );
    context.after(stop);
    try {
      await observed;
      assert.deepEqual(changes, ['ready', 'changed', 'changed', 'changed']);
    } finally {
      stop();
    }
    assert.equal(await exited, 0);
    assert.equal(child!.exitCode, 0);
  },
);

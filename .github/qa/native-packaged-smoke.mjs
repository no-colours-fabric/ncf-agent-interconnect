import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';

const sourceRoot = process.env.NCF_SMOKE_SOURCE_ROOT;
const expectedVersion = process.env.NCF_SMOKE_EXPECTED_VERSION;
const reportPath = process.env.NCF_SMOKE_REPORT;
assert.ok(sourceRoot && expectedVersion && reportPath);
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: sourceRoot,
  encoding: 'utf8',
}).trim();
assert.equal(sourceRevision, process.env.NCF_SMOKE_EXPECTED_SHA);
const { _electron } = await import(
  pathToFileURL(path.join(sourceRoot, 'node_modules/playwright/index.mjs')).href
);

// Windows may expose a launcher PID. Hold a handle to the evaluated native main
// before Quit, so a launcher exit or later PID reuse cannot stand in for its exit.
async function observeWindowsMain(pid) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  const script = `
$ErrorActionPreference = 'Stop'
$native = [System.Diagnostics.Process]::GetProcessById(${pid})
$null = $native.Handle
$nativeName = $native.ProcessName
[Console]::Out.WriteLine('NCF_MAIN_READY')
[Console]::Out.Flush()
$native.WaitForExit()
@{ pid = $native.Id; exitCode = $native.ExitCode; processName = $nativeName; observedAt = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json -Compress
`;
  const observer = spawn(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
    {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let resolveReady, rejectReady, resolveExit, rejectExit;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const exited = new Promise((resolve, reject) => {
    resolveExit = resolve;
    rejectExit = reject;
  });
  exited.catch(() => {});
  let attached = false,
    output = '',
    errorText = '',
    result;
  const fail = (error) => {
    clearTimeout(timer);
    rejectReady(error);
    rejectExit(error);
  };
  const timer = setTimeout(
    () => fail(new Error('Native process observer did not attach within 10 seconds')),
    10000,
  );
  observer.stderr.on('data', (chunk) => {
    errorText = (errorText + chunk.toString()).slice(-1000);
  });
  observer.stdout.on('data', (chunk) => {
    output += chunk.toString();
    const lines = output.split(/\r?\n/);
    output = lines.pop();
    for (const line of lines) {
      if (line === 'NCF_MAIN_READY') {
        attached = true;
        clearTimeout(timer);
        resolveReady();
      } else if (line.trim().startsWith('{')) {
        try {
          result = JSON.parse(line);
        } catch {
          fail(new Error('Invalid native exit observation'));
        }
      }
    }
  });
  observer.on('error', fail);
  observer.on('close', (code, signal) => {
    clearTimeout(timer);
    if (code !== 0 || signal || !attached || result?.pid !== pid)
      fail(new Error('Native process observer failed: ' + errorText));
    else resolveExit(result);
  });
  await ready;
  return { exited };
}

const report = {
  sourceRevision,
  executable: process.env.INTERCONNECT_TEST_EXECUTABLE,
  applications: [],
};
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
const launch = _electron.launch.bind(_electron);
_electron.launch = async (...args) => {
  const application = await launch(...args);
  const child = application.process();
  const record = {
    launcherPid: child.pid,
    identity: await application.evaluate(({ app }) => ({
      version: app.getVersion(),
      pid: process.pid,
      electron: process.versions.electron,
      arch: process.arch,
      platform: process.platform,
    })),
    closedStoreErrorCount: 0,
  };
  report.applications.push(record);
  let stderrTail = '';
  child.stderr?.on('data', (chunk) => {
    const text = stderrTail + chunk.toString();
    record.closedStoreErrorCount += (
      text.match(/database (?:is not open|is closed)/gi) ?? []
    ).length;
    stderrTail = text.slice(-64);
  });
  let requestedAt;
  const exited = new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      record.launcherExitCode = code;
      record.launcherExitSignal = signal;
      record.launcherExitObservedAt = new Date().toISOString();
      record.elapsedAfterQuitMs =
        requestedAt === undefined ? null : performance.now() - requestedAt;
      save();
    });
    child.once('close', resolve);
  });
  let nativeExit;
  if (process.platform === 'win32' && record.identity.pid !== child.pid) {
    try {
      // Await the attachment acknowledgement before the test can request Quit.
      nativeExit = (await observeWindowsMain(record.identity.pid)).exited;
    } catch (error) {
      await application.close();
      throw error;
    }
  }
  const close = application.close.bind(application);
  application.close = async (...closeArgs) => {
    requestedAt = performance.now();
    record.quitRequestedAt = new Date().toISOString();
    record.quitMechanism = 'Playwright Electron close invokes native app.quit';
    save();
    await close(...closeArgs);
    await exited;
    if (nativeExit) {
      record.nativeExit = await nativeExit;
      record.nativeObservation = 'Windows process handle acquired before Quit';
      assert.equal(record.nativeExit.exitCode, 0);
    } else {
      assert.equal(record.identity.pid, child.pid);
      record.nativeExit = { pid: child.pid, exitCode: record.launcherExitCode };
      record.nativeObservation = 'Direct native child-process exit';
    }
    record.closeReturnedAt = new Date().toISOString();
    save();
    assert.equal(record.launcherExitCode, 0);
    assert.equal(record.launcherExitSignal, null);
    assert.equal(record.closedStoreErrorCount, 0);
  };
  save();
  return application;
};

try {
  await import(pathToFileURL(path.join(sourceRoot, 'scripts/test-desktop-ui.mjs')).href);
  assert.equal(report.applications.length, 1, 'One packaged smoke app only');
  assert.equal(report.applications[0].identity.version, expectedVersion);
  assert.equal(report.applications[0].identity.platform, process.platform);
  assert.equal(report.applications[0].identity.arch, process.arch);
  report.result = 'PASS';
} catch (error) {
  report.result = 'FAIL';
  report.failure = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  save();
}

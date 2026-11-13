import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const sourceRoot = process.env.NCF_SMOKE_SOURCE_ROOT;
assert.ok(sourceRoot, 'An explicit isolated product checkout is required');
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: sourceRoot,
  encoding: 'utf8',
}).trim();
assert.equal(sourceRevision, process.env.NCF_SMOKE_EXPECTED_SHA);
const reportPath = process.env.NCF_SMOKE_REPORT;
assert.ok(reportPath);
const { _electron } = await import(
  pathToFileURL(path.join(sourceRoot, 'node_modules/playwright/index.mjs')).href
);
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
    pid: child.pid,
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
  child.stderr?.on('data', (chunk) => {
    record.closedStoreErrorCount += (
      chunk.toString().match(/database (?:is not open|is closed)/gi) ?? []
    ).length;
  });
  let requestedAt;
  const exited = new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      record.exitCode = code;
      record.exitSignal = signal;
      record.exitObservedAt = new Date().toISOString();
      record.elapsedAfterQuitMs =
        requestedAt === undefined ? null : performance.now() - requestedAt;
      save();
      resolve();
    });
  });
  const close = application.close.bind(application);
  application.close = async (...closeArgs) => {
    requestedAt = performance.now();
    record.quitRequestedAt = new Date().toISOString();
    record.quitMechanism = 'Playwright Electron close invokes native app.quit';
    save();
    await close(...closeArgs);
    await exited;
    record.closeReturnedAt = new Date().toISOString();
    save();
    assert.equal(record.exitCode, 0, 'Packaged main exits naturally with code zero');
    assert.equal(record.exitSignal, null, 'Packaged main is not killed by a signal');
    assert.equal(record.closedStoreErrorCount, 0, 'No closed-store teardown errors');
  };
  save();
  return application;
};
try {
  await import(pathToFileURL(path.join(sourceRoot, 'scripts/test-desktop-ui.mjs')).href);
  assert.equal(report.applications.length, 1, 'One packaged smoke app only');
  assert.equal(report.applications[0].identity.version, '0.18.0');
  assert.equal(report.applications[0].identity.platform, 'win32');
  assert.equal(report.applications[0].identity.arch, 'x64');
  report.result = 'PASS';
} catch (error) {
  report.result = 'FAIL';
  report.failure = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  save();
}

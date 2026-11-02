import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { AionLifecycle } from './aionui-lifecycle.js';
import { withDeadline } from './pairing-harness.js';

const context = () => ({ after: (_close: () => Promise<void>) => {} });
test('a first owned failure cancels even an arrival barrier whose sibling has not started', async () => {
  const scope = new AionLifecycle(context(), 100);
  const original = new Error('Injected before sibling arrival');
  const arrival = scope.barrier('unreached sibling').entered;
  const result = scope.run(async () => {
    scope.watch('early failure', Promise.reject(original));
    await arrival;
  });
  await assert.rejects(result, (error) => error === original);
  await assert.rejects(arrival, (error) => error === original);
  assert.deepEqual(scope.snapshot(), { closing: true, operations: 0, gates: 0 });
});
test('a cleanup deadline stays FAIL after owned force cleanup releases the operation', async () => {
  const scope = new AionLifecycle(context(), 500);
  let release!: () => void,
    forced = false;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  scope.consumer({
    label: 'owned blocked close',
    close: () => blocked,
    budget: 25,
    force: () => {
      forced = true;
      release();
    },
  });
  await assert.rejects(
    scope.close(),
    (error) =>
      error instanceof AggregateError &&
      error.errors.some((item) => String(item).includes('owned blocked close timed out')),
  );
  assert.equal(forced, true);
  assert.equal(scope.snapshot().operations, 0);
});

test(
  'partial startup, held Pair/proxy, early abort and cleanup deadline fail naturally with final TAP and drained resources',
  { timeout: 50000 },
  async () => {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const child = spawn(
      process.execPath,
      [
        '--experimental-sqlite',
        '--import',
        'tsx',
        fileURLToPath(new URL('./fixtures/aionui-lifecycle-failure.ts', import.meta.url)),
      ],
      { env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' },
    );
    let output = '',
      stderr = '',
      timedOut = false;
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    const closed = new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    let code: number | null;
    try {
      code = await withDeadline(closed, 40000, 'Owned AionUi regression child');
    } catch (error) {
      timedOut = true;
      // Only this test's process tree may be reaped. A watchdog kill is always FAIL.
      if (child.pid) {
        if (process.platform === 'win32') {
          const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
            stdio: 'ignore',
          });
          await withDeadline(
            new Promise<void>((resolve, reject) => {
              killer.once('error', reject);
              killer.once('close', () => resolve());
            }),
            5000,
            'Owned regression tree reap',
          );
        } else process.kill(-child.pid, 'SIGKILL');
      }
      await withDeadline(closed, 5000, 'Owned regression child forced exit');
      throw error;
    }
    assert.equal(timedOut, false);
    assert.equal(code, 1, output + stderr);
    for (const phase of [
      'partial-startup',
      'held-pair',
      'held-proxy',
      'early-abort',
      'cleanup-deadline',
    ]) {
      assert.ok(output.includes('original-error-preserved ' + phase), output + stderr);
      assert.ok(output.includes('cleanup-complete ' + phase), output + stderr);
    }
    assert.match(output, /# tests 5\b/);
    assert.match(output, /# pass 0\b/);
    assert.match(output, /# fail 5\b/);
    assert.match(output, /# cancelled 0\b/);
    assert.match(output, /held consumer cleanup timed out/);
    assert.doesNotMatch(
      output + stderr,
      /failureType: 'unhandledRejection'|failureType: 'uncaughtException'/,
    );
  },
);

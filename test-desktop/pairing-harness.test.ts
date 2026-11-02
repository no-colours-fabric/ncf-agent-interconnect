import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PairingHarness } from './pairing-harness.js';

test('an unreachable test barrier has a finite deadline', async () => {
  const harness = new PairingHarness();
  await assert.rejects(
    harness.run(async (scope) => {
      await scope.barrier().promise;
    }, 50),
    /Pairing scenario timed out/,
  );
});

test('a scenario cannot pass while a watched operation is unfinished', async () => {
  const harness = new PairingHarness();
  await assert.rejects(
    harness.run(async (scope) => {
      scope.watch(scope.barrier().promise);
    }),
    /finished with unfinished operations/,
  );
});

test(
  'early start, prove and confirm failures settle both directions, clean up nodes and emit a final FAIL summary',
  { timeout: 40000 },
  async () => {
    const fixture = fileURLToPath(
      new URL('./fixtures/pairing-harness-failure.ts', import.meta.url),
    );
    const env = { ...process.env };
    // Run the intentional failures in one direct node:test process, not an inherited worker IPC channel.
    delete env.NODE_TEST_CONTEXT;
    const child = spawn(process.execPath, ['--experimental-sqlite', '--import', 'tsx', fixture], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '',
      stderr = '',
      timedOut = false;
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 30000);
    let code: number | null;
    try {
      code = await new Promise<number | null>((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      });
    } finally {
      clearTimeout(timer);
    }
    assert.equal(
      timedOut,
      false,
      'The failing child must exit naturally after releasing its own resources',
    );
    assert.equal(code, 1, output + stderr);
    for (const phase of ['start', 'prove', 'confirm']) {
      for (const side of [0, 1]) {
        const label = `${phase}-${side}`;
        assert.ok(output.includes('Injected connect EADDRINUSE ' + label), output + stderr);
        assert.ok(output.includes('original-error-preserved ' + label), output + stderr);
        assert.ok(output.includes('cleanup-complete ' + label), output + stderr);
      }
    }
    assert.match(output, /# tests 6\b/);
    assert.match(output, /# pass 0\b/);
    assert.match(output, /# fail 6\b/);
    assert.match(output, /# cancelled 0\b/);
  },
);

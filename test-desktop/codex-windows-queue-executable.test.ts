import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveWindowsCodexQueueExecutable } from '../desktop/core/codex-queue.js';

const installation = {
  root: 'C:\\Program Files\\WindowsApps\\OpenAI.Codex_exact',
  executable: 'C:\\Program Files\\WindowsApps\\OpenAI.Codex_exact\\app\\ChatGPT.exe',
  packageFullName: 'OpenAI.Codex_exact',
};

test('Windows passive queue uses the verified cache of the exact discovered package', async () => {
  const cached = 'C:\\Users\\fixture\\AppData\\Local\\OpenAI\\Codex\\bin\\exact\\codex.exe';
  let calls = 0;
  const executable = await resolveWindowsCodexQueueExecutable(
    { windowsCodex: async () => [installation] },
    async (info) => {
      calls++;
      assert.deepEqual(info, { root: installation.root });
      return { originalCli: cached };
    },
  );
  assert.equal(executable, cached);
  assert.equal(calls, 1);
  assert.notEqual(executable, installation.root + '\\app\\resources\\codex.exe');
});

test('Windows queue rejects missing or ambiguous packages before selecting a cache', async () => {
  for (const installs of [[], [installation, installation]]) {
    await assert.rejects(
      resolveWindowsCodexQueueExecutable({ windowsCodex: async () => installs }, async () =>
        assert.fail('No executable may be selected for an unknown package'),
      ),
      /unavailable or ambiguous/,
    );
  }
});

test('Windows queue never falls back to an unchecked executable after cache verification fails', async () => {
  for (const code of ['ENOENT', 'NCF_CODEX_CACHE_IDENTITY', 'NCF_CODEX_REPARSE']) {
    const failure = Object.assign(new Error(code), { code });
    await assert.rejects(
      resolveWindowsCodexQueueExecutable({ windowsCodex: async () => [installation] }, async () => {
        throw failure;
      }),
      (error) => error === failure,
    );
  }
});

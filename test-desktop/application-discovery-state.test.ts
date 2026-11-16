import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, readdir, rm, writeFile, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ApplicationDiscoveryState } from '../desktop/core/application-discovery-state.js';
import { mcpSetupClients } from '../desktop/shared/mcp-setup.js';
import type { ApplicationInstallation } from '../desktop/shared/application-discovery.js';

const applications = (
  status: ApplicationInstallation['status'] = 'detected',
): ApplicationInstallation[] =>
  mcpSetupClients.map((client) => ({ client, status, instances: [], coverage: [] }));

test('startup is read-only; only visible acknowledgement persists once-only product IDs', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-discovery-state-'));
  try {
    const state = new ApplicationDiscoveryState(directory);
    assert.deepEqual(await state.offers(applications('unknown')), []);
    assert.deepEqual(await state.offers(applications('not-found-in-known-locations')), []);
    assert.deepEqual(await state.offers(applications()), [...mcpSetupClients]);
    assert.deepEqual(await readdir(directory), []);
    await Promise.all([
      state.markOffered(['cursor', 'opencode']),
      state.markOffered(['codex', 'aionui', 'claude']),
    ]);
    const saved = await readFile(path.join(directory, 'application-discovery.json'), 'utf8');
    assert.equal(saved.includes('path'), false);
    assert.deepEqual(await new ApplicationDiscoveryState(directory).offers(applications()), []);
    assert.deepEqual(await readdir(directory), ['application-discovery.json']);
    await state.markOffered(['cursor']);
    assert.equal(await readFile(path.join(directory, 'application-discovery.json'), 'utf8'), saved);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a later installation receives its offer; removal/reinstallation does not reset one already shown', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-discovery-state-'));
  try {
    const state = new ApplicationDiscoveryState(directory);
    await state.markOffered(['cursor']);
    assert.deepEqual(
      await state.offers(applications().filter((app) => app.client === 'cursor')),
      [],
    );
    assert.deepEqual(await state.offers(applications().filter((app) => app.client === 'claude')), [
      'claude',
    ]);
    await state.markOffered(['claude']);
    assert.deepEqual(
      await new ApplicationDiscoveryState(directory).offers(
        applications().filter((app) => ['cursor', 'claude'].includes(app.client)),
      ),
      [],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('corrupt, oversized, future-version, and symlink state never silently resets or overwrites data', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-discovery-state-'));
  const filename = path.join(directory, 'application-discovery.json');
  try {
    for (const original of [
      '{bad json',
      JSON.stringify({ version: 2, offered: {} }),
      'x'.repeat(32769),
    ]) {
      await writeFile(filename, original);
      const state = new ApplicationDiscoveryState(directory);
      assert.deepEqual(await state.offers(applications()), []);
      assert.equal(state.error, true);
      assert.equal(await state.markOffered(['cursor']), false);
      assert.equal(await readFile(filename, 'utf8'), original);
    }
    if (process.platform !== 'win32') {
      await rm(filename);
      const target = path.join(directory, 'unrelated.json');
      await writeFile(target, 'private fixture');
      await symlink(target, filename);
      const state = new ApplicationDiscoveryState(directory);
      assert.deepEqual(await state.offers(applications()), []);
      assert.equal(await state.markOffered(['cursor']), false);
      assert.equal(await readFile(target, 'utf8'), 'private fixture');
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pendingInstallationRestartNotice } from '../desktop/main/installation-restart-notice.js';

async function fixture(context: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-install-notice-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const data = path.join(directory, 'profile');
  const archive = path.join(directory, 'app.asar');
  await mkdir(data);
  await writeFile(archive, 'original build');
  return {
    directory,
    data,
    archive,
    check: () => pendingInstallationRestartNotice(data, archive),
  };
}

test('a new profile and ordinary restarts do not display an installation warning', async (context) => {
  const { data, check } = await fixture(context);
  assert.equal(await check(), null);
  await writeFile(path.join(data, 'settings.json'), '{}');
  assert.equal(await check(), null);
  assert.equal(await check(), null);
});

test('an existing profile from an older version sees the warning until dismissal', async (context) => {
  const { data, check } = await fixture(context);
  await writeFile(path.join(data, 'settings.json'), '{}');
  assert.ok(await check());
  const acknowledge = await check();
  assert.ok(acknowledge);
  await acknowledge();
  assert.equal(await check(), null);
});

test('reinstalling the same package and updating the package each trigger a new warning', async (context) => {
  const { directory, archive, check } = await fixture(context);
  assert.equal(await check(), null);

  const replacement = path.join(directory, 'replacement.asar');
  await copyFile(archive, replacement);
  await rename(replacement, archive);
  const acknowledgeReinstall = await check();
  assert.ok(acknowledgeReinstall);
  await acknowledgeReinstall();
  assert.equal(await check(), null);

  await writeFile(replacement, 'new build');
  await rename(replacement, archive);
  const acknowledgeUpdate = await check();
  assert.ok(acknowledgeUpdate);
  await acknowledgeUpdate();
  assert.equal(await check(), null);
});

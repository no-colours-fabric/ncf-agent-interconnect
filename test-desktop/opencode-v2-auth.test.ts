import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  writeFile,
  chmod,
  lstat,
  rm,
  mkdir,
  symlink,
  readdir,
  rename,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { OpenCodeV2Auth, openCodeV2PrivateFiles } from '../desktop/core/opencode-v2-auth.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
async function fixture(t: import('node:test').TestContext, checkpoint?: (phase: string) => void) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ncf-v2-auth-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = {
    major: 2 as const,
    installationId: null,
    installationPath: null,
    profilePath: root,
    configurationPath: path.join(root, 'opencode.json'),
  };
  const configurationHash = async (file: string) => digest(await readFile(file, 'utf8'));
  const auth = new OpenCodeV2Auth(root, { configurationHash, checkpoint });
  const draft = await auth.prepare(target, randomUUID(), 'http://127.0.0.1:12345');
  return { root, target, auth, draft, configurationHash };
}
test('v2 private preview is read-only; Apply publishes verifier last and restart reloads it', async (t) => {
  const { root, target, auth, draft, configurationHash } = await fixture(t);
  await assert.rejects(lstat(auth.root), { code: 'ENOENT' });
  assert.equal(await auth.current(target), undefined);
  await auth.stage(draft, 'export default {};');
  await assert.rejects(
    auth.authenticate(
      draft.provision.targetId,
      draft.provision.generation,
      draft.provision.credential,
    ),
  );
  await writeFile(target.configurationPath, 'selected configuration', { mode: 0o600 });
  await auth.activate(
    draft,
    'export default {};',
    await configurationHash(target.configurationPath),
  );
  const restarted = new OpenCodeV2Auth(root, { configurationHash });
  assert.equal(
    (
      await restarted.authenticate(
        draft.provision.targetId,
        draft.provision.generation,
        draft.provision.credential,
      )
    ).targetId,
    draft.provision.targetId,
  );
  const next = await restarted.prepare(target, draft.provision.nodeId, draft.provision.nodeUrl);
  assert.deepEqual(next.provision, draft.provision);
  assert.ok(next.existing);
  assert.equal(
    (await readFile(path.join(auth.root, 'targets.json'), 'utf8')).includes(
      draft.provision.credential,
    ),
    false,
  );
});
for (const failure of ['protected', 'assets', 'before-activate'])
  test(`v2 publication crash at ${failure} cannot activate a partial generation`, async (t) => {
    const { target, auth, draft, configurationHash } = await fixture(t, (phase) => {
      if (phase === failure) throw new Error('injected crash');
    });
    if (failure === 'before-activate') {
      await auth.stage(draft, 'asset');
      await writeFile(target.configurationPath, 'new config', { mode: 0o600 });
      await assert.rejects(
        auth.activate(draft, 'asset', await configurationHash(target.configurationPath)),
        /injected crash/,
      );
    } else await assert.rejects(auth.stage(draft, 'asset'), /injected crash/);
    await assert.rejects(
      auth.authenticate(
        draft.provision.targetId,
        draft.provision.generation,
        draft.provision.credential,
      ),
    );
    if (failure === 'protected')
      await assert.rejects(lstat(path.join(draft.generationDirectory, 'ncf-target.json')), {
        code: 'ENOENT',
      });
  });
test('v2 config/descriptor corruption and generic bearer never authenticate or silently heal', async (t) => {
  const { target, auth, draft, configurationHash } = await fixture(t);
  await auth.stage(draft, 'asset');
  await writeFile(target.configurationPath, 'config', { mode: 0o600 });
  await auth.activate(draft, 'asset', await configurationHash(target.configurationPath));
  await assert.rejects(
    auth.authenticate(draft.provision.targetId, draft.provision.generation, 'b'.repeat(64)),
    /UNAUTHORIZED/,
  );
  await writeFile(target.configurationPath, 'changed');
  await assert.rejects(
    auth.authenticate(
      draft.provision.targetId,
      draft.provision.generation,
      draft.provision.credential,
    ),
    /CONFIGURATION_MISMATCH/,
  );
  const repair = await auth.prepare(target, draft.provision.nodeId, draft.provision.nodeUrl);
  assert.notEqual(repair.provision.generation, draft.provision.generation);
  assert.equal(repair.existing, undefined);
  assert.equal(await readFile(target.configurationPath, 'utf8'), 'changed');
  await writeFile(target.configurationPath, 'config');
  await writeFile(path.join(draft.generationDirectory, 'ncf-target.json'), '{}');
  await assert.rejects(auth.current(target));
  assert.equal(
    await readFile(path.join(draft.generationDirectory, 'ncf-target.json'), 'utf8'),
    '{}',
  );
});
test('v2 protection failure occurs before credential write and never activates', async (t) => {
  const { root, target, draft } = await fixture(t);
  const auth = new OpenCodeV2Auth(root, {
    configurationHash: async () => digest('config'),
    security: {
      protect: async () => {
        throw new Error('DACL unavailable');
      },
      verify: async () => {
        throw new Error('DACL unavailable');
      },
    },
  });
  await assert.rejects(auth.stage(draft, 'asset'), /DACL unavailable/);
  await assert.rejects(lstat(target.configurationPath), { code: 'ENOENT' });
  await assert.rejects(lstat(path.join(draft.generationDirectory, 'ncf-target.json')), {
    code: 'ENOENT',
  });
});
test(
  'Windows private protection uses system modules with an inherited module path',
  {
    skip: process.platform !== 'win32',
  },
  async (t) => {
    const { root } = await fixture(t);
    const inherited = process.env.PSModulePath;
    t.after(() => {
      if (inherited === undefined) delete process.env.PSModulePath;
      else process.env.PSModulePath = inherited;
    });
    process.env.PSModulePath = path.join(root, 'nonexistent-modules');

    const security = openCodeV2PrivateFiles(root);
    await security.protect(root, true);
    await security.verify(root, true);
    const file = path.join(root, 'private.txt');
    await writeFile(file, 'synthetic private file');
    await security.protect(file, false);
    await security.verify(file, false);
  },
);
test('POSIX private verification rejects broad access; no mode-only Windows claim', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Native Windows DACL acceptance is separate; injected security failure tested above.');
    return;
  }
  const { root } = await fixture(t),
    file = path.join(root, 'secret');
  await writeFile(file, 'private', { mode: 0o600 });
  const security = openCodeV2PrivateFiles(root);
  await security.verify(file, false);
  await chmod(file, 0o644);
  await assert.rejects(security.verify(file, false), /PERMISSIONS/);
});

for (const boundary of ['Integrations', 'opencode-v2'])
  test(`v2 private stage rejects redirected ${boundary} before writing outside node state`, async (t) => {
    const { root, auth, draft } = await fixture(t);
    const outside = await mkdtemp(path.join(os.tmpdir(), 'ncf-v2-outside-'));
    t.after(() => rm(outside, { recursive: true, force: true }));
    if (boundary === 'opencode-v2') await mkdir(path.join(root, 'Integrations'));
    await symlink(
      outside,
      boundary === 'Integrations' ? path.join(root, boundary) : auth.root,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await assert.rejects(auth.stage(draft, 'asset'), /SCOPE|PRIVATE/);
    assert.deepEqual(await readdir(outside), []);
    await assert.rejects(
      auth.prepare(draft.target, draft.provision.nodeId, draft.provision.nodeUrl),
      /SCOPE|PRIVATE|REGISTRY/,
    );
  });

test('v2 registry authentication rejects a redirected Integrations ancestor after publication', async (t) => {
  const { root, auth, draft, target, configurationHash } = await fixture(t);
  await auth.stage(draft, 'asset');
  await writeFile(target.configurationPath, 'config', { mode: 0o600 });
  await auth.activate(draft, 'asset', await configurationHash(target.configurationPath));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'ncf-v2-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  const moved = path.join(outside, 'Integrations');
  await rename(path.join(root, 'Integrations'), moved);
  await symlink(
    moved,
    path.join(root, 'Integrations'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await assert.rejects(
    auth.authenticate(
      draft.provision.targetId,
      draft.provision.generation,
      draft.provision.credential,
    ),
    /REGISTRY|SCOPE|PRIVATE/,
  );
});

test('v2 private canonical guard accepts an explicitly selected node-directory alias', async (t) => {
  const { root, target, configurationHash } = await fixture(t);
  const parent = await mkdtemp(path.join(os.tmpdir(), 'ncf-v2-node-alias-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const alias = path.join(parent, 'selected-node');
  await symlink(root, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const auth = new OpenCodeV2Auth(alias, { configurationHash });
  const draft = await auth.prepare(target, randomUUID(), 'http://127.0.0.1:12345');
  await auth.stage(draft, 'asset');
  await writeFile(target.configurationPath, 'config', { mode: 0o600 });
  await auth.activate(draft, 'asset', await configurationHash(target.configurationPath));
  assert.equal(
    (
      await auth.authenticate(
        draft.provision.targetId,
        draft.provision.generation,
        draft.provision.credential,
      )
    ).targetId,
    draft.provision.targetId,
  );
});

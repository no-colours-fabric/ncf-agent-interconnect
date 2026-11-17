import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, lstat, rm, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { OpenCodeV2SetupService } from '../desktop/core/mcp-setup.js';
import { McpSetupPaths } from '../desktop/core/mcp-setup-paths.js';
import { OpenCodeV2Auth } from '../desktop/core/opencode-v2-auth.js';
import {
  editMcpConfiguration,
  editOpenCodeV2Configuration,
} from '../desktop/core/mcp-setup-editors.js';

async function fixture(
  t: TestContext,
  checkpoint?: (phase: 'protected' | 'assets' | 'before-activate' | 'activated') => void,
) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ncf-v2-setup-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const state = path.join(root, 'node');
  await mkdir(path.join(state, 'Integrations'), { recursive: true });
  await writeFile(path.join(state, 'settings.json'), JSON.stringify({ nodeId: randomUUID() }));
  await writeFile(
    path.join(state, 'Integrations', 'node.json'),
    JSON.stringify({ url: 'http://127.0.0.1:12345/mcp', token: 'not-a-v2-credential' }),
  );
  const target = {
    major: 2 as const,
    installationId: null,
    installationPath: null,
    profilePath: root,
    configurationPath: path.join(root, 'opencode.jsonc'),
  };
  const source =
    '// owner settings\n{"providers":{"corporate":{"models":["unchanged"]}},"permissions":{"deny":["keep"]},"mcp":{"servers":{"corporate":{"type":"remote","url":"https://example.invalid/mcp","disabled":true}}},"plugins":["other-plugin"]}\n';
  await writeFile(target.configurationPath, source, { mode: 0o600 });
  const setup = new OpenCodeV2SetupService({
    stateDirectory: state,
    home: root,
    env: { XDG_CONFIG_HOME: root },
    instructions: () => {
      throw new Error('Legacy instructions must not be called');
    },
    asset: async () => 'export default {id:"ncf-fixture"};',
    checkpoint,
  });
  return { root, state, target, source, setup };
}
test('v2 owner Apply preserves unrelated config and coherent no-op keeps credentials and registry bytes', async (t) => {
  const { state, target, source, setup } = await fixture(t);
  const preview = await setup.v2Preview('window', target);
  assert.equal(preview.client, 'opencode-v2');
  assert.equal(await readFile(target.configurationPath, 'utf8'), source);
  assert.equal(JSON.stringify(preview).includes('Bearer '), false);
  await assert.rejects(lstat(path.join(state, 'Integrations', 'opencode-v2')), { code: 'ENOENT' });
  const applied = await setup.v2Apply('window', preview.planId, target, false);
  assert.equal(applied.status, 'applied');
  const updated = await readFile(target.configurationPath, 'utf8'),
    parsed = JSON.parse(updated.slice(updated.indexOf('{')));
  assert.deepEqual(parsed.providers, { corporate: { models: ['unchanged'] } });
  assert.deepEqual(parsed.permissions, { deny: ['keep'] });
  assert.equal(parsed.mcp.servers.corporate.disabled, true);
  assert.equal(parsed.plugins[0], 'other-plugin');
  assert.ok(updated.startsWith('// owner settings'));
  const registryFile = path.join(state, 'Integrations', 'opencode-v2', 'targets.json'),
    registry = await readFile(registryFile, 'utf8');
  const status = await setup.v2Status(target);
  assert.equal(status.state, 'configured');
  assert.equal(status.targetId, preview.targetId);
  const second = await setup.v2Preview('window', target);
  const noop = await setup.v2Apply('window', second.planId, target, false);
  assert.equal(noop.status, 'unchanged');
  assert.equal(await readFile(target.configurationPath, 'utf8'), updated);
  assert.equal(await readFile(registryFile, 'utf8'), registry);
  assert.equal(JSON.stringify(status).includes('Bearer '), false);
});
test('v2 stale owner/target/config cannot stage or activate a generation', async (t) => {
  const { state, target, source, setup } = await fixture(t),
    preview = await setup.v2Preview('window', target);
  await assert.rejects(
    setup.v2Apply('other-window', preview.planId, target, false),
    /another window/,
  );
  await assert.rejects(
    setup.v2Apply('window', preview.planId, { ...target, installationId: 'different' }, false),
    /target changed/,
  );
  await writeFile(target.configurationPath, source + '\n');
  assert.equal((await setup.v2Apply('window', preview.planId, target, false)).status, 'failed');
  await assert.rejects(lstat(path.join(state, 'Integrations', 'opencode-v2')), { code: 'ENOENT' });
});
for (const phase of ['assets', 'before-activate'] as const)
  test(`v2 ${phase} transaction failure restores selected config and cannot activate verifier`, async (t) => {
    const { state, target, source, setup } = await fixture(t, (current) => {
      if (current === phase) throw new Error('injected failure');
    });
    const preview = await setup.v2Preview('window', target),
      result = await setup.v2Apply('window', preview.planId, target, false);
    assert.equal(result.status, 'failed');
    assert.equal(await readFile(target.configurationPath, 'utf8'), source);
    await assert.rejects(lstat(path.join(state, 'Integrations', 'opencode-v2', 'targets.json')), {
      code: 'ENOENT',
    });
  });
test('v2 refuses selected canonical v1 path and legacy contents; legacy editor refuses v2', async (t) => {
  const { state, target, setup } = await fixture(t);
  await new McpSetupPaths(state).remember('opencode', target.configurationPath);
  await assert.rejects(setup.v2Preview('window', target), /retained by OpenCode v1/);
  assert.throws(() => editOpenCodeV2Configuration('{"plugin":["legacy"]}', '{}'), /legacy v1/);
  assert.throws(
    () => editMcpConfiguration('opencode', '{"plugins":[],"mcp":{"servers":{}}}', '{}'),
    /not supported/,
  );
});

test('post-commit observer exceptions cannot fail Apply or suppress the next revocation observer', async (t) => {
  const { state, target, setup } = await fixture(t, (phase) => {
    if (phase === 'activated') throw new Error('post-commit observer');
  });
  const observer = new OpenCodeV2Auth(state, {
    configurationHash: async () => {
      throw new Error('unused');
    },
  });
  const stopFirst = observer.observe(() => {
    throw new Error('first observer');
  });
  let notified = 0;
  const stopSecond = observer.observe(() => {
    notified++;
  });
  t.after(() => {
    stopFirst();
    stopSecond();
  });
  const preview = await setup.v2Preview('window', target),
    result = await setup.v2Apply('window', preview.planId, target, false);
  assert.equal(result.status, 'applied');
  assert.equal(notified, 1);
  assert.equal((await setup.v2Status(target)).state, 'configured');
});
test('explicit owner config-drift repair creates a new generation without startup repair', async (t) => {
  const { state, target, source, setup } = await fixture(t);
  const first = await setup.v2Preview('window', target);
  assert.equal((await setup.v2Apply('window', first.planId, target, false)).status, 'applied');
  const registryFile = path.join(state, 'Integrations', 'opencode-v2', 'targets.json');
  const old = JSON.parse(await readFile(registryFile, 'utf8')).targets[0];
  await writeFile(target.configurationPath, source);
  assert.equal((await setup.v2Status(target)).state, 'unavailable');
  assert.equal(await readFile(target.configurationPath, 'utf8'), source);
  const repair = await setup.v2Preview('window', target);
  assert.equal(await readFile(target.configurationPath, 'utf8'), source);
  assert.equal((await setup.v2Apply('window', repair.planId, target, true)).status, 'applied');
  const current = JSON.parse(await readFile(registryFile, 'utf8')).targets[0];
  assert.equal(current.targetId, old.targetId);
  assert.notEqual(current.generation, old.generation);
  assert.notEqual(current.credentialVerifier, old.credentialVerifier);
  assert.equal((await setup.v2Status(target)).state, 'configured');
});

test('selected managed config changed after write cannot become the activated verifier baseline', async (t) => {
  const { state, target, setup } = await fixture(t);
  const remember = McpSetupPaths.prototype.remember;
  t.mock.method(
    McpSetupPaths.prototype,
    'remember',
    async function (
      this: McpSetupPaths,
      client: Parameters<McpSetupPaths['remember']>[0],
      filename: string,
    ) {
      await remember.call(this, client, filename);
      const current = await readFile(target.configurationPath, 'utf8');
      await writeFile(
        target.configurationPath,
        current.replace(/Bearer [a-f0-9]{64}/, 'Bearer ' + 'f'.repeat(64)),
      );
    },
  );
  const preview = await setup.v2Preview('window', target),
    result = await setup.v2Apply('window', preview.planId, target, false);
  assert.equal(result.status, 'failed');
  await assert.rejects(lstat(path.join(state, 'Integrations', 'opencode-v2', 'targets.json')), {
    code: 'ENOENT',
  });
});

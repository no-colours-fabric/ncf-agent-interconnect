import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, lstat, rm, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { OpenCodeV2SetupService } from '../desktop/core/mcp-setup.js';
import { McpSetupPaths } from '../desktop/core/mcp-setup-paths.js';
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

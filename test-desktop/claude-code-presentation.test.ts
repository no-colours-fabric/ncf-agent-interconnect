import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { claudePluginFiles, publishClaudePlugin } from '../desktop/core/claude-plugin.js';

const runtime = {
  execPath: '/fixture/NCF',
  runtimeArgs: [],
  script: '/fixture/claude-code.js',
  nodeFile: '/fixture/node.json',
  platform: 'linux' as const,
  version: '0.12.0',
};
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
// Generated from exact a00294d3 with the synthetic runtime above, before the UI delta.
const baseline = {
  '.claude-plugin/marketplace.json':
    '1806196177912f176648d81d41962a332bd45067fefa4fd603ad51975a028bf7',
  'plugin/.claude-plugin/plugin.json':
    'fd195044e63e166c965c18e49ab85465234924ea2eca030731aa246649ee1d31',
  'plugin/hooks/hooks.json': 'edfbdd97777433c46c3ddf7158d5a7a8cc9f70ab8d1c7913dbd4ef72020aec9b',
  'plugin/hooks/wake.js': '3003e6272e1964e49e5ca912fa55a51b9a551b6ae77b3b04cb11642d314cbfcb',
  'gate/.claude-plugin/plugin.json':
    '0a46f8355fdae88fc4f1a53a08b8329fbe93b3ad01fe43f8b77ca3f756ce5432',
  'gate/hooks/hooks.json': '2404fadbc22040bcdfcd459bc7e59f6bf90065acbe9a6379c20ce0f0c0768504',
  'gate/hooks/gate.js': 'f1e68d49a9e95c5a81a5c2f5a6ff29f101a8431d21ada4a7bca57558cdcf80c7',
};

test('Generated Claude UI adds only static modules and preserves the original authority artifacts', () => {
  const files = claudePluginFiles(runtime);
  const added = ['plugin/hooks/incoming-format.js', 'plugin/hooks/incoming.js'];
  assert.deepEqual(Object.keys(files).sort(), [...Object.keys(baseline), ...added].sort());
  for (const [name, expected] of Object.entries(baseline)) {
    const text =
      name === 'plugin/hooks/wake.js'
        ? files[name]
            .replace(
              "import { register as registerIncomingPresentation } from './incoming.js';\n",
              '',
            )
            .replace('  registerIncomingPresentation(on);\n', '')
        : files[name];
    assert.equal(digest(text), expected, name);
  }
  for (const name of added) {
    assert.ok(
      !files[name].includes('/fixture/'),
      'Presentation assets must not capture runtime paths',
    );
    assert.ok(!/\$\.(?:fs|http|process|session|prompt|tool)\./.test(files[name]));
    assert.ok(!files[name].includes('research/'));
  }
});

async function materialize(t: test.TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ncf-claude-presentation-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await publishClaudePlugin(root, claudePluginFiles(runtime));
  return root;
}

test('Actual generated wake entry imports relative assets and registers presentation exactly once', async (t) => {
  const root = await materialize(t);
  const { register } = await import(pathToFileURL(path.join(root, 'plugin/hooks/wake.js')).href);
  const entries: { name: string; component?: string }[] = [];
  register((name: string, matcher: unknown) => {
    entries.push({
      name,
      component:
        typeof matcher === 'object' && matcher !== null
          ? (matcher as { component?: string }).component
          : undefined,
    });
  });
  assert.deepEqual(
    entries
      .filter((e) => e.name === 'ui.render')
      .map((e) => e.component)
      .sort(),
    ['ToolGroup', 'ToolResult', 'ToolUse', 'UserMessage'],
  );
  assert.equal(entries.filter((e) => e.name === 'session.start').length, 1);
  assert.equal(entries.filter((e) => e.name === 'session.end').length, 1);
  assert.equal(entries.length, 6);
});

test(
  'Installed Claude SDK validates and mounts the actual generated production plugin entry',
  {
    skip: !process.env.NCF_CLAUDE_TEST_CLI,
  },
  async (t) => {
    const cli = process.env.NCF_CLAUDE_TEST_CLI!;
    assert.ok(
      path.isAbsolute(cli),
      'Select an absolute native Claude Code executable for this offline check',
    );
    const root = await materialize(t);
    await mkdir(path.join(root, 'plugin/tests'));
    await mkdir(path.join(root, 'profile'));
    await copyFile(
      new URL('./fixtures/claude-presentation/mounted.test.ts.txt', import.meta.url),
      path.join(root, 'plugin/tests/presentation.test.ts'),
    );
    const run = promisify(execFile);
    const options = {
      cwd: root,
      env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(root, 'profile') },
      timeout: 20000,
      maxBuffer: 2 * 1024 * 1024,
    };
    for (const name of ['plugin', 'gate']) {
      const result = await run(cli, ['plugin', 'validate', path.join(root, name)], options);
      assert.match(result.stdout, /Validation passed/);
      t.diagnostic(`${name}: actual generated files validated`);
    }
    const result = await run(cli, ['plugin', 'test', path.join(root, 'plugin')], options);
    const output = result.stdout + '\n' + result.stderr;
    assert.match(output, /10 pass/);
    assert.match(output, /0 fail/);
    t.diagnostic(output.trim());
  },
);

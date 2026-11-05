import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parse as parseJson } from 'jsonc-parser';
import { mcpInstructions } from '../desktop/core/instructions.js';
import { editMcpConfiguration } from '../desktop/core/mcp-setup-editors.js';
import { McpSetupService } from '../desktop/core/mcp-setup.js';
import { createMcpSetupHandler } from '../desktop/main/mcp-setup-ipc.js';
import { claudeLaunchCommand, type McpSetupClient } from '../desktop/shared/mcp-setup.js';

const owner = 'isolated-window';
const marketplace = '/isolated/NCF Агент 漢字/Integrations/claude-code';
const rule = 'mcp__plugin_ncf-agent-interconnect_ncf__agent_read';
const instructions = (client: McpSetupClient, root = marketplace) =>
  mcpInstructions(
    'http://127.0.0.1:42000/mcp',
    'fixture-token-never-live',
    client,
    'file:///isolated/opencode.js',
    undefined,
    root,
  );
const configuration = instructions('claude').configuration;
const edit = (source: string) => editMcpConfiguration('claude', source, configuration);

test('Claude Code settings gain the marketplace, enabled plugin and one exact allow rule', () => {
  const generated = JSON.parse(configuration);
  assert.deepEqual(generated, {
    extraKnownMarketplaces: {
      'ncf-agent-interconnect': { source: { source: 'directory', path: marketplace } },
    },
    enabledPlugins: { 'ncf-agent-interconnect@ncf-agent-interconnect': true },
    permissions: { allow: [rule] },
  });
  assert.ok(!configuration.includes('fixture-token-never-live'));
  assert.ok(!('mcpServers' in generated));
  assert.equal(instructions('claude').launchCommand, claudeLaunchCommand);
  assert.equal(
    claudeLaunchCommand,
    'claude --dangerously-load-development-channels plugin:ncf-agent-interconnect@ncf-agent-interconnect',
  );
  const created = edit('');
  assert.deepEqual(JSON.parse(created.content), generated);
  assert.deepEqual(
    created.changes.map((change) => change.action),
    ['add', 'add', 'add'],
  );
  assert.equal(created.requiresReplacement, false);
});

test('Unrelated Claude Code settings, BOM, CRLF and other permissions survive; matching settings stay byte-for-byte', () => {
  const source =
    '﻿{\r\n  "model": "fixture",\r\n  "permissions": {\r\n    "allow": ["Bash(npm test:*)"],\r\n    "deny": ["Read(./.env)"]\r\n  },\r\n  "enabledPlugins": { "other@team": true },\r\n  "extraKnownMarketplaces": { "team": { "source": { "source": "github", "repo": "a/b" } } },\r\n  "hooks": {}\r\n}\r\n';
  const result = edit(source);
  assert.ok(result.content.startsWith('﻿'));
  assert.ok(result.content.startsWith('\uFEFF{\r\n  "model": "fixture",\r\n'));
  const parsed = parseJson(result.content.slice(1));
  assert.equal(parsed.model, 'fixture');
  assert.deepEqual(parsed.permissions.allow, ['Bash(npm test:*)', rule]);
  assert.deepEqual(parsed.permissions.deny, ['Read(./.env)']);
  assert.equal(parsed.enabledPlugins['other@team'], true);
  assert.equal(parsed.extraKnownMarketplaces.team.source.repo, 'a/b');
  assert.deepEqual(parsed.hooks, {});
  // Applying again is a byte-for-byte no-op and never duplicates the rule.
  const again = edit(result.content);
  assert.equal(again.content, result.content);
  assert.ok(again.changes.every((change) => change.action === 'unchanged'));
  // Extra user options on the managed marketplace entry are kept.
  const custom = result.content.replace(
    '"source": "directory",',
    '"source": "directory", "autoUpdate": false,',
  );
  const kept = edit(custom);
  assert.equal(kept.content, custom);
});

test('A disabled plugin or another marketplace path needs replacement confirmation; invalid shapes are refused without excerpts', () => {
  const disabled = edit(
    JSON.stringify({ enabledPlugins: { 'ncf-agent-interconnect@ncf-agent-interconnect': false } }),
  );
  assert.equal(disabled.requiresReplacement, true);
  assert.equal(disabled.changes[1].action, 'replace');
  const moved = edit(
    JSON.stringify({
      extraKnownMarketplaces: {
        'ncf-agent-interconnect': { source: { source: 'directory', path: '/old/place' } },
      },
    }),
  );
  assert.equal(moved.requiresReplacement, true);
  assert.equal(
    parseJson(moved.content).extraKnownMarketplaces['ncf-agent-interconnect'].source.path,
    marketplace,
  );
  assert.throws(
    () => edit('{"permissions": {"allow": "secret-value"}}'),
    (error: Error) =>
      /permissions\.allow/.test(error.message) && !error.message.includes('secret-value'),
  );
  assert.throws(
    () => edit('{"model": "secret-value",'),
    (error: Error) => !error.message.includes('secret-value'),
  );
  assert.throws(() => edit('{"enabledPlugins": []}'), /enabledPlugins/);
  // Claude Code ignores a settings file with comments or trailing commas, so Apply refuses it.
  for (const source of ['{\n  // comment\n  "model": "x"\n}\n', '{"model": "x",}'])
    assert.throws(() => edit(source), /plain JSON without comments or trailing commas/);
});

async function fixture(t: test.TestContext, env: NodeJS.ProcessEnv = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-claude-setup-'));
  t.after(() => rm(directory, { force: true, recursive: true }));
  return {
    directory,
    service: new McpSetupService({
      instructions: (client) => instructions(client),
      home: directory,
      env,
      stateDirectory: path.join(directory, '.app-state'),
    }),
  };
}

test('Defaults use the Claude Code user settings.json and never the client-owned ~/.claude.json', async (t) => {
  const { directory, service } = await fixture(t);
  const defaults = await service.defaults('claude');
  assert.equal(defaults.files[0].path, path.join(directory, '.claude', 'settings.json'));
  assert.equal(defaults.files[0].format, 'jsonc');
  const custom = path.join(directory, 'Профиль Claude');
  const configured = await fixture(t, { CLAUDE_CONFIG_DIR: custom });
  assert.equal(
    (await configured.service.defaults('claude')).files[0].path,
    path.join(custom, 'settings.json'),
  );
  const hot = path.join(directory, '.claude.json');
  await writeFile(hot, '{"projects": {}}');
  await assert.rejects(
    service.preview(owner, 'claude', [{ id: 'configuration', path: hot }]),
    /\.claude\.json is managed by Claude Code/,
  );
  await assert.rejects(
    service.preview(owner, 'claude', [
      { id: 'configuration', path: path.join(directory, 'settings.jsonc') },
    ]),
    /\.json configuration file/,
  );
  assert.equal(await readFile(hot, 'utf8'), '{"projects": {}}');
});

test('Owner Apply writes only the selected Claude settings file with a backup, then reports configured; Cancel writes nothing', async (t) => {
  const { directory, service } = await fixture(t);
  const filename = path.join(directory, '.claude', 'settings.json');
  const cancelled = await service.preview(owner, 'claude', [
    { id: 'configuration', path: filename },
  ]);
  assert.equal(cancelled.files[0].action, 'create');
  service.discard(owner, cancelled.planId);
  assert.deepEqual(await readdir(directory), []);
  await mkdir(path.dirname(filename));
  const source = '{\n  "theme": "dark"\n}\n';
  await writeFile(filename, source);
  assert.equal((await service.status('claude')).state, 'not-configured');
  const preview = await service.preview(owner, 'claude', [{ id: 'configuration', path: filename }]);
  assert.equal(preview.files[0].action, 'update');
  assert.equal(preview.requiresReplacement, false);
  const result = await service.apply(owner, preview.planId, false);
  assert.equal(result.status, 'applied');
  assert.equal(await readFile(result.files[0].backupPath!, 'utf8'), source);
  const written = parseJson(await readFile(filename, 'utf8'));
  assert.equal(written.theme, 'dark');
  assert.deepEqual(written.permissions.allow, [rule]);
  assert.equal((await service.status('claude')).state, 'configured');
  assert.equal((await service.status('claude')).remembered, true);
  // A moved application asks for an update of the marketplace path.
  const moved = new McpSetupService({
    instructions: (client) => instructions(client, '/moved/NCF/Integrations/claude-code'),
    home: directory,
    env: {},
    stateDirectory: path.join(directory, '.app-state'),
  });
  assert.equal((await moved.status('claude')).state, 'needs-update');
  // No other file was touched.
  assert.deepEqual((await readdir(directory)).sort(), ['.app-state', '.claude']);
});

test('Desktop IPC accepts the Claude client with a JSON-only picker and one configuration target', async (t) => {
  const { directory } = await fixture(t);
  let pickerOptions: { title: string; filters: { extensions: string[] }[]; properties: string[] };
  const handle = createMcpSetupHandler({
    instructions: (client) => instructions(client),
    home: directory,
    stateDirectory: path.join(directory, '.app-state'),
    env: {},
    openPath: async () => '',
    window: () => ({ isDestroyed: () => false }) as never,
    dialog: {
      showOpenDialog: async (_window: unknown, options: typeof pickerOptions) => {
        pickerOptions = options;
        return { canceled: true, filePaths: [] };
      },
    } as never,
  });
  await handle('mcpSetupBrowse', { client: 'claude', path: '' }, owner);
  assert.equal(pickerOptions!.title, 'Select Claude Code configuration');
  assert.deepEqual(pickerOptions!.filters[0].extensions, ['json']);
  assert.deepEqual(pickerOptions!.properties, ['openFile', 'showHiddenFiles']);
  await assert.rejects(
    handle(
      'mcpSetupPreview',
      {
        client: 'claude',
        files: [
          { id: 'configuration', path: path.join(directory, 'a.json') },
          { id: 'configuration', path: path.join(directory, 'b.json') },
        ],
      },
      owner,
    ),
  );
  const status = await handle('mcpSetupStatus', { client: 'claude' }, owner);
  assert.equal((status as { result: { state: string } }).result.state, 'missing');
  assert.deepEqual(await readdir(directory), []);
});

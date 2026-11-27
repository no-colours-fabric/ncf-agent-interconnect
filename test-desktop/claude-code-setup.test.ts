import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parse as parseJson } from 'jsonc-parser';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mcpInstructions } from '../desktop/core/instructions.js';
import { editMcpConfiguration } from '../desktop/core/mcp-setup-editors.js';
import { McpSetupService } from '../desktop/core/mcp-setup.js';
import { createMcpSetupHandler } from '../desktop/main/mcp-setup-ipc.js';
import { ClaudePermissionChanges } from '../desktop/renderer/ApplicationSetup.js';
import { ApplicationSetupFlow } from '../desktop/renderer/application-setup-model.js';
import { ClaudeSetupDialog } from '../desktop/renderer/McpSetup.js';
import { McpSetupFlow } from '../desktop/renderer/mcp-setup-model.js';
import { mcpSetupMessages } from '../desktop/renderer/i18n/mcp-setup.js';
import {
  claudeLaunchCommand,
  type McpSetupClient,
  type McpSetupInvoke,
} from '../desktop/shared/mcp-setup.js';

const owner = 'isolated-window';
const marketplace = '/isolated/NCF Агент 漢字/Integrations/claude-code';
const serverPrefix = 'mcp__plugin_ncf-agent-interconnect_ncf__';
const exactRules = [
  'agent_connect',
  'agent_read',
  'agent_send',
  'agent_history',
  'agents_list',
  'attachment_receive',
  'connection_events',
  'node_peers',
  'node_status',
  'agent_disconnect',
].map((name) => serverPrefix + name);
const [connectRule, readRule, sendRule] = exactRules;
const clearHistoryRule = serverPrefix + 'agent_clear_history';
const rulesMissingFromReadOnly = exactRules.filter((rule) => rule !== readRule);
const readOnlyUpgrade = [readRule, ...rulesMissingFromReadOnly];
const instructions = (client: McpSetupClient, root = marketplace) =>
  mcpInstructions(
    'http://127.0.0.1:42000/mcp',
    'fixture-token-never-live',
    client,
    'file:///isolated/opencode.js',
    undefined,
    undefined,
    root,
  );
const configuration = instructions('claude').configuration;
const edit = (source: string) => editMcpConfiguration('claude', source, configuration);

test('Claude Code settings gain the marketplace, both plugins and ten exact allow rules', () => {
  const generated = JSON.parse(configuration);
  assert.deepEqual(generated, {
    extraKnownMarketplaces: {
      'ncf-agent-interconnect': { source: { source: 'directory', path: marketplace } },
    },
    enabledPlugins: {
      'ncf-agent-interconnect@ncf-agent-interconnect': true,
      'ncf-agent-interconnect-gate@ncf-agent-interconnect': true,
    },
    permissions: { allow: exactRules },
  });
  assert.ok(!configuration.includes('fixture-token-never-live'));
  assert.ok(!('mcpServers' in generated));
  assert.equal(instructions('claude').launchCommand, claudeLaunchCommand);
  // Normal use needs no development flag.
  assert.equal(claudeLaunchCommand, 'claude');
  const created = edit('');
  assert.deepEqual(JSON.parse(created.content), generated);
  assert.deepEqual(
    created.changes.map((change) => change.action),
    Array(3 + exactRules.length).fill('add'),
  );
  assert.deepEqual(
    created.changes.slice(-exactRules.length),
    exactRules.map((rule) => ({
      scope: `permissions.allow ${rule}`,
      action: 'add',
    })),
  );
  assert.equal(created.requiresReplacement, false);
});

test('Claude automatic setup never allows clearing history or a wildcard', () => {
  const generated = JSON.parse(configuration);
  assert.ok(!generated.permissions.allow.includes(clearHistoryRule));
  assert.ok(generated.permissions.allow.every((rule: string) => !rule.includes('*')));
  for (const unsupported of [clearHistoryRule, serverPrefix + '*']) {
    generated.permissions.allow = [...exactRules.slice(0, -1), unsupported];
    assert.throws(
      () => editMcpConfiguration('claude', '', JSON.stringify(generated)),
      /generated Claude Code/,
    );
  }
});

test('Unrelated Claude Code settings, BOM, CRLF and other permissions survive; matching settings stay byte-for-byte', () => {
  const source =
    '﻿{\r\n  "model": "fixture",\r\n  "permissions": {\r\n    "allow": ["Bash(npm test:*)", "' +
    readRule +
    '"],\r\n    "ask": ["mcp__plugin_other_ncf__*"],\r\n    "deny": ["Read(./.env)", "mcp__plugin_ncf-agent-interconnect_ncf__agent_clear_history"]\r\n  },\r\n  "enabledPlugins": { "other@team": true },\r\n  "extraKnownMarketplaces": { "team": { "source": { "source": "github", "repo": "a/b" } } },\r\n  "hooks": {}\r\n}\r\n';
  const result = edit(source);
  assert.ok(result.content.startsWith('﻿'));
  assert.ok(result.content.startsWith('\uFEFF{\r\n  "model": "fixture",\r\n'));
  const parsed = parseJson(result.content.slice(1));
  assert.equal(parsed.model, 'fixture');
  assert.deepEqual(parsed.permissions.allow, ['Bash(npm test:*)', ...readOnlyUpgrade]);
  assert.deepEqual(parsed.permissions.ask, ['mcp__plugin_other_ncf__*']);
  assert.deepEqual(parsed.permissions.deny, [
    'Read(./.env)',
    'mcp__plugin_ncf-agent-interconnect_ncf__agent_clear_history',
  ]);
  assert.deepEqual(
    result.changes.slice(-exactRules.length).map((change) => change.action),
    exactRules.map((rule) => (rule === readRule ? 'unchanged' : 'add')),
  );
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

test('Claude automatic setup reports exact, server-wide and wildcard ask or deny conflicts', () => {
  const prefix = 'mcp__plugin_ncf-agent-interconnect_ncf';
  for (const [decision, restriction, tool] of [
    ['deny', sendRule, sendRule],
    ['ask', connectRule, connectRule],
    ['deny', prefix, connectRule],
    ['ask', `${prefix}__*`, connectRule],
    ['ask', 'mcp__*__agent_s*', sendRule],
    ['deny', serverPrefix + 'agent_disconnect', serverPrefix + 'agent_disconnect'],
    ['ask', serverPrefix + 'node_*', serverPrefix + 'node_peers'],
    ['deny', '*', connectRule],
  ]) {
    const settings = JSON.stringify({
      permissions: { allow: exactRules, [decision]: [restriction] },
    });
    assert.throws(() => edit(settings), {
      message: `Claude Code permissions.${decision} → ${tool}`,
    });
  }
  assert.throws(() => edit('{"permissions":{"ask":"invalid"}}'), /permissions\.ask/);
  assert.throws(() => edit('{"permissions":{"deny":[1]}}'), /permissions\.deny/);
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
  const legacy = JSON.parse(configuration);
  legacy.permissions.allow = [readRule];
  const source = JSON.stringify({ ...legacy, theme: 'dark' }, null, 2) + '\n';
  await writeFile(filename, source);
  assert.equal((await service.status('claude')).state, 'needs-update');
  const preview = await service.preview(owner, 'claude', [{ id: 'configuration', path: filename }]);
  assert.equal(preview.files[0].action, 'update');
  assert.equal(preview.requiresReplacement, false);
  assert.deepEqual(
    preview.files[0].changes
      .filter((change) => change.action === 'add')
      .map((change) => change.scope),
    rulesMissingFromReadOnly.map((rule) => `permissions.allow ${rule}`),
  );
  assert.equal(await readFile(filename, 'utf8'), source);
  const result = await service.apply(owner, preview.planId, false);
  assert.equal(result.status, 'applied');
  assert.equal(await readFile(result.files[0].backupPath!, 'utf8'), source);
  const written = parseJson(await readFile(filename, 'utf8'));
  assert.equal(written.theme, 'dark');
  assert.deepEqual(written.permissions.allow, readOnlyUpgrade);
  assert.equal((await service.status('claude')).state, 'configured');
  assert.equal((await service.status('claude')).remembered, true);
  const after = await readFile(filename, 'utf8');
  const filesBeforeRepeat = await readdir(path.dirname(filename));
  const repeat = await service.preview(owner, 'claude', [{ id: 'configuration', path: filename }]);
  assert.equal((await service.apply(owner, repeat.planId, false)).status, 'unchanged');
  assert.equal(await readFile(filename, 'utf8'), after);
  assert.deepEqual(await readdir(path.dirname(filename)), filesBeforeRepeat);
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

test('Claude permission conflicts leave the selected file untouched and invalidate older previews', async (t) => {
  const { directory, service } = await fixture(t);
  const filename = path.join(directory, '.claude', 'settings.json');
  const target = [{ id: 'configuration', path: filename }];
  await mkdir(path.dirname(filename));
  await writeFile(filename, '{}\n');
  const stale = await service.preview(owner, 'claude', target);
  const restricted = JSON.stringify({ permissions: { deny: [sendRule] } });
  await writeFile(filename, restricted);
  assert.equal((await service.apply(owner, stale.planId, false)).status, 'failed');
  await assert.rejects(service.preview(owner, 'claude', target), /permissions\.deny.*agent_send/);
  assert.equal((await service.status('claude')).state, 'unavailable');
  assert.equal(await readFile(filename, 'utf8'), restricted);
  assert.deepEqual(await readdir(path.dirname(filename)), ['settings.json']);
});

test('Claude setup with three rules previews and adds only the seven missing rules', async (t) => {
  const { directory, service } = await fixture(t);
  const filename = path.join(directory, '.claude', 'settings.json');
  await mkdir(path.dirname(filename));
  const previous = JSON.parse(configuration);
  previous.permissions.allow = [sendRule, readRule, connectRule];
  const source = JSON.stringify(previous, null, 2) + '\n';
  await writeFile(filename, source);

  assert.equal((await service.status('claude')).state, 'needs-update');
  const preview = await service.preview(owner, 'claude', [{ id: 'configuration', path: filename }]);
  assert.equal(preview.requiresReplacement, false);
  assert.deepEqual(
    preview.files[0].changes
      .filter((change) => change.action === 'add')
      .map((change) => change.scope),
    exactRules.slice(3).map((rule) => `permissions.allow ${rule}`),
  );
  assert.equal(await readFile(filename, 'utf8'), source);
  const result = await service.apply(owner, preview.planId, false);
  assert.equal(result.status, 'applied');
  assert.equal(await readFile(result.files[0].backupPath!, 'utf8'), source);
  assert.deepEqual(JSON.parse(await readFile(filename, 'utf8')).permissions.allow, [
    ...previous.permissions.allow,
    ...exactRules.slice(3),
  ]);
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

test('Claude renderer Apply and quick Connect persist the same exact rules through desktop IPC', async (t) => {
  const { directory } = await fixture(t);
  const filename = path.join(directory, '.claude', 'settings.json');
  const handle = createMcpSetupHandler({
    instructions: (client) => instructions(client),
    home: directory,
    stateDirectory: path.join(directory, '.app-state'),
    env: {},
    openPath: async () => '',
    window: () => null,
    dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
  });
  const invoke: McpSetupInvoke = async <T>(method: string, parameters?: unknown) =>
    ((await handle(method, parameters, owner)) as { result: T }).result;

  const manual = new McpSetupFlow('claude', invoke);
  await manual.begin();
  const markup = renderToStaticMarkup(
    React.createElement(ClaudeSetupDialog, {
      invoke,
      flow: manual,
      messages: mcpSetupMessages('en'),
      locale: 'en',
      inline: true,
    }),
  );
  assert.match(markup, /data-testid="mcp-path-configuration"/);
  assert.match(markup, /data-testid="mcp-apply"/);
  assert.ok(!markup.includes(mcpSetupMessages('en').create));
  for (const rule of exactRules) assert.ok(!markup.includes(rule));
  assert.deepEqual(await readdir(directory), []);
  manual.cancel();
  assert.deepEqual(await readdir(directory), []);
  await manual.begin();
  await manual.apply();
  assert.deepEqual(JSON.parse(await readFile(filename, 'utf8')).permissions.allow, exactRules);

  const quick = new ApplicationSetupFlow(invoke);
  const legacy = JSON.parse(configuration);
  legacy.permissions.allow = [readRule];
  await writeFile(filename, JSON.stringify(legacy));
  await quick.connect('claude');
  assert.equal(quick.getSnapshot().claude.phase, 'succeeded');
  assert.deepEqual(JSON.parse(await readFile(filename, 'utf8')).permissions.allow, readOnlyUpgrade);

  const previous = configuration.replace(marketplace, '/old/NCF/Integrations/claude-code');
  const replacement = JSON.stringify({
    ...JSON.parse(previous),
    permissions: { allow: [readRule] },
  });
  await writeFile(filename, replacement);
  const manualReplacement = new McpSetupFlow('claude', invoke);
  await manualReplacement.begin();
  assert.equal(manualReplacement.getSnapshot().preview?.requiresReplacement, true);
  const replacementMarkup = renderToStaticMarkup(
    React.createElement(ClaudeSetupDialog, {
      invoke,
      flow: manualReplacement,
      messages: mcpSetupMessages('en'),
      locale: 'en',
      inline: true,
    }),
  );
  assert.match(replacementMarkup, /type="checkbox"/);
  assert.match(
    replacementMarkup,
    /<button[^>]*(?:disabled[^>]*data-testid="mcp-apply"|data-testid="mcp-apply"[^>]*disabled)/,
  );
  for (const rule of exactRules) assert.ok(!replacementMarkup.includes(rule));
  manualReplacement.cancel();
  assert.equal(await readFile(filename, 'utf8'), replacement);
  quick.invalidateSucceeded('claude');
  await quick.connect('claude');
  const pending = quick.getSnapshot().claude;
  assert.equal(pending.phase, 'confirmation');
  const changes = renderToStaticMarkup(
    React.createElement(ClaudePermissionChanges, { file: pending.preview!.files[0] }),
  );
  for (const rule of rulesMissingFromReadOnly) assert.ok(changes.includes(rule));
  assert.ok(!changes.includes(readRule));
  assert.equal(await readFile(filename, 'utf8'), replacement);
  quick.cancel('claude');
  assert.equal(await readFile(filename, 'utf8'), replacement);
  await quick.connect('claude');
  await quick.confirm('claude');
  assert.equal(quick.getSnapshot().claude.phase, 'succeeded');
  assert.deepEqual(JSON.parse(await readFile(filename, 'utf8')).permissions.allow, readOnlyUpgrade);

  const blocked = JSON.stringify({ ...legacy, permissions: { ask: [sendRule] } });
  await writeFile(filename, blocked);
  quick.invalidateSucceeded('claude');
  await quick.connect('claude');
  assert.equal(quick.getSnapshot().claude.phase, 'failed');
  assert.match(quick.getSnapshot().claude.error!, /permissions\.ask.*agent_send/);
  assert.equal(await readFile(filename, 'utf8'), blocked);
});

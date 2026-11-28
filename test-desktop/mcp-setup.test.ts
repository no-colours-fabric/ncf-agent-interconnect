import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parse as parseJson } from 'jsonc-parser';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { mcpInstructions } from '../desktop/core/instructions.js';
import { editMcpConfiguration } from '../desktop/core/mcp-setup-editors.js';
import { McpSetupService } from '../desktop/core/mcp-setup.js';
import { createMcpSetupHandler } from '../desktop/main/mcp-setup-ipc.js';
import type { McpSetupClient } from '../desktop/shared/mcp-setup.js';
import { openCodeAllowedTools } from '../desktop/shared/mcp-setup.js';

const owner = 'isolated-window';
const url = 'http://127.0.0.1:42000/mcp';
const token = 'fixture-token-never-live';
const plugin = 'file:///isolated/NCF%20Interconnect/opencode.js';
const instructions = (client: McpSetupClient) =>
  mcpInstructions(
    url,
    token,
    client,
    plugin,
    JSON.stringify({
      mcpServers: {
        ncf_agent_interconnect: {
          command: 'fixture-runtime',
          args: ['fixture-bridge'],
          env: { ELECTRON_RUN_AS_NODE: '1' },
        },
      },
    }),
    undefined,
    '/isolated/claude-marketplace',
  );
test('Codex send setup preserves other hooks, is idempotent and flags a changed managed command for approval', () => {
  const generated = (folder: string) =>
    mcpInstructions(
      url,
      token,
      'codex',
      plugin,
      undefined,
      undefined,
      undefined,
      "ELECTRON_RUN_AS_NODE=1 '/fixture/electron' '/" +
        folder +
        "/codex-send-hook.js' '/fixture/Integrations'",
    ).configuration;
  const custom =
    '[[hooks.PostToolUse]]\nmatcher = "^mcp__ncf_agent_interconnect__agent_send$"\n[[hooks.PostToolUse.hooks]]\ntype = "command"\ncommand = "my-custom-command"\n';
  const first = editMcpConfiguration('codex', custom, generated('first'));
  assert.equal(first.requiresReplacement, false);
  assert.equal(
    editMcpConfiguration('codex', first.content, generated('first')).content,
    first.content,
  );
  const moved = editMcpConfiguration('codex', first.content, generated('second'));
  assert.ok(moved.requiresReplacement);
  const parsed = parseToml(moved.content).hooks as {
    PostToolUse: { hooks: { command: string }[] }[];
  };
  assert.equal(parsed.PostToolUse.length, 2);
  assert.equal(parsed.PostToolUse[0].hooks[0].command, 'my-custom-command');
  assert.match(parsed.PostToolUse[1].hooks[0].command, /second/);
});

const instructionsWithCursorPlugin = (client: McpSetupClient) => {
  const base = instructions(client);
  if (client !== 'cursor') return base;
  return {
    ...base,
    managedFiles: [
      {
        id: 'cursor-plugin-manifest',
        relativePath: [
          '.cursor',
          'plugins',
          'local',
          'ncf-agent-interconnect',
          '.cursor-plugin',
          'plugin.json',
        ],
        content: '{"name":"ncf-agent-interconnect"}\n',
      },
      {
        id: 'cursor-plugin-hooks',
        relativePath: [
          '.cursor',
          'plugins',
          'local',
          'ncf-agent-interconnect',
          'hooks',
          'hooks.json',
        ],
        content: '{"version":1,"hooks":{"stop":[]}}\n',
      },
    ],
  };
};

async function fixture(
  t: test.TestContext,
  options: Partial<ConstructorParameters<typeof McpSetupService>[0]> = {},
) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-mcp-setup-'));
  t.after(() => rm(directory, { force: true, recursive: true }));
  return {
    directory,
    service: new McpSetupService({
      instructions,
      home: directory,
      env: {},
      stateDirectory: path.join(directory, '.app-state'),
      ...options,
    }),
  };
}

test('Cursor JSONC preserves unrelated bytes, Unicode, BOM, comments and CRLF', () => {
  const source =
    '\uFEFF{\r\n\t// unrelated server\r\n\t"mcpServers": { "Другой": { "url": "https://example.invalid", "headers": { "Authorization": "private-other" } } },\r\n\t"other": true,\r\n}\r\n';
  const edit = editMcpConfiguration('cursor', source, instructions('cursor').configuration);
  assert.ok(edit.content.startsWith('\uFEFF'));
  assert.ok(edit.content.includes('// unrelated server\r\n'));
  assert.ok(
    edit.content.includes(
      '"Другой": { "url": "https://example.invalid", "headers": { "Authorization": "private-other" } }',
    ),
  );
  assert.ok(edit.content.includes('\r\n\t"other": true,'));
  assert.equal(
    parseJson(edit.content.slice(1)).mcpServers.ncf_agent_interconnect.headers.Authorization,
    'Bearer ' + token,
  );
  assert.equal(
    editMcpConfiguration('cursor', edit.content, instructions('cursor').configuration).content,
    edit.content,
  );
});

test('OpenCode v1 adds the server, plugin and exact tool permissions without replacing others', () => {
  const source =
    '{\n // kept\n "plugin": ["existing-plugin"],\n "mcp": {"other": {"type": "remote", "url": "https://example.invalid"}},\n "theme": "dark"\n}\n';
  const edit = editMcpConfiguration('opencode', source, instructions('opencode').configuration);
  const parsed = parseJson(edit.content);
  assert.deepEqual(parsed.plugin, ['existing-plugin', plugin]);
  assert.equal(parsed.mcp.other.url, 'https://example.invalid');
  assert.equal(parsed.theme, 'dark');
  assert.ok(edit.content.includes('// kept'));
  assert.equal(edit.changes.length, 12);
  assert.equal(Object.keys(parsed.permission).length, 10);
  assert.deepEqual(
    parsed.permission,
    Object.fromEntries(openCodeAllowedTools.map((tool) => [tool, 'allow'])),
  );
  assert.equal(parsed.permission.ncf_agent_interconnect_agent_clear_history, undefined);
  assert.equal(
    editMcpConfiguration('opencode', edit.content, instructions('opencode').configuration).content,
    edit.content,
  );
  assert.deepEqual(
    parseJson(editMcpConfiguration('opencode', '', instructions('opencode').configuration).content)
      .plugin,
    [plugin],
  );
});

test('OpenCode v1 upgrades an existing setup only on owner Apply and backs up the selected file', async (t) => {
  const { directory, service } = await fixture(t);
  const filename = path.join(directory, 'opencode.jsonc');
  const other = path.join(directory, 'other.jsonc');
  const selection = [{ id: 'configuration', path: filename }];
  const configuration = JSON.parse(instructions('opencode').configuration);
  configuration.permission = {
    bash: { '*': 'ask' },
    [openCodeAllowedTools[0]]: 'allow',
    corporate_query: 'deny',
  };
  const source = '// Keep this comment\n' + JSON.stringify(configuration, null, 2) + '\n';
  await writeFile(filename, source);
  await writeFile(other, '{}');

  const plan = await service.preview(owner, 'opencode', selection);
  assert.equal(plan.requiresReplacement, false);
  assert.equal(
    plan.files[0].changes.filter(
      ({ scope, action }) => scope.startsWith('permission.') && action === 'add',
    ).length,
    9,
  );
  assert.equal(await readFile(filename, 'utf8'), source);
  const result = await service.apply(owner, plan.planId, false);
  assert.equal(result.status, 'applied');
  assert.equal(await readFile(result.files[0].backupPath!, 'utf8'), source);
  const configured = await readFile(filename, 'utf8');
  const updated = parseJson(configured);
  assert.ok(configured.startsWith('// Keep this comment'));
  assert.deepEqual(updated.permission.bash, { '*': 'ask' });
  assert.equal(updated.permission.corporate_query, 'deny');
  assert.ok(openCodeAllowedTools.every((tool) => updated.permission[tool] === 'allow'));
  assert.equal(await readFile(other, 'utf8'), '{}');
  const repeated = await service.preview(owner, 'opencode', selection);
  assert.equal((await service.apply(owner, repeated.planId, false)).status, 'unchanged');
  assert.equal(await readFile(filename, 'utf8'), configured);
});

test('OpenCode v1 preserves effective restrictions, legacy tools and permission rule order', () => {
  const edit = (settings: object) =>
    editMcpConfiguration(
      'opencode',
      JSON.stringify(settings),
      instructions('opencode').configuration,
    );
  const tool = openCodeAllowedTools[0];
  assert.throws(() => edit({ permission: { [tool]: 'ask' } }), /ask rule.*agent_connect/);
  assert.throws(
    () =>
      edit({
        permission: {
          ncf_agent_interconnect_agent_connec_: 'deny',
          'ncf_agent_interconnect_agent_connec?': 'deny',
        },
      }),
    /deny rule.*agent_connect/,
  );
  assert.throws(() => edit({ tools: { [tool]: false } }), /deny rule.*agent_connect/);
  assert.throws(() => edit({ permission: { [tool]: 'allow', '*': 'ask' } }), /ask rule/);
  const noConflict = edit({ tools: { [tool]: false }, permission: { [tool]: { '*': 'allow' } } });
  assert.deepEqual(parseJson(noConflict.content).permission[tool], { '*': 'allow' });
  const scalar = edit({ permission: 'allow' });
  assert.equal(parseJson(scalar.content).permission['*'], 'allow');
});

test('Codex TOML preserves multiline strings, quoted sections, dates, large integers, other settings and comments', () => {
  const prefix =
    '\uFEFF# retain all unrelated source\r\nmodel = "fixture-model"\r\nnumber = 9223372036854775807\r\ndate = 2026-11-02\r\ntext = """\r\n[mcp_servers.ncf_agent_interconnect]\r\nnot a section\r\n"""\r\n\r\n[mcp_servers."Другой сервер"] # keep\r\nurl = "https://example.invalid"\r\n';
  const edit = editMcpConfiguration('codex', prefix, instructions('codex').configuration);
  for (const section of prefix.slice(1).split('\r\n\r\n'))
    assert.ok(edit.content.includes(section));
  assert.ok(edit.content.startsWith('\uFEFF'));
  assert.equal(parseToml(edit.content.slice(1)).mcp_servers.ncf_agent_interconnect.url, url);
  assert.equal(parseToml(edit.content.slice(1)).number, 9223372036854775807n);
  assert.equal(
    editMcpConfiguration('codex', edit.content, instructions('codex').configuration).content,
    edit.content,
  );
});

test('adding the parallel inbox preserves the configured server and requires review for a conflicting inbox', () => {
  const config = instructions('codex').configuration;
  const original =
    config.split('[mcp_servers.ncf_agent_interconnect_inbox]')[0] + 'tool_timeout_sec = 90\n';
  const restricted = original + 'disabled_tools = ["agent_read"]\n';
  assert.equal(editMcpConfiguration('codex', restricted, config).content, restricted);
  const edit = editMcpConfiguration('codex', original, config);
  assert.deepEqual(
    edit.changes.map((change) => change.action),
    ['unchanged', 'add'],
  );
  assert.equal(edit.requiresReplacement, false);
  const servers = parseToml(edit.content).mcp_servers;
  assert.equal(servers.ncf_agent_interconnect.tool_timeout_sec, 90);
  assert.deepEqual(servers.ncf_agent_interconnect_inbox.enabled_tools, ['agent_read']);
  assert.equal(servers.ncf_agent_interconnect_inbox.supports_parallel_tool_calls, true);
  assert.equal(servers.ncf_agent_interconnect_inbox.tools.agent_read.approval_mode, undefined);
  const guarded = config + 'tools.agent_read.approval_mode = "prompt"\nenabled = false\n';
  const rotated = editMcpConfiguration('codex', guarded, config.replaceAll(url, url + '/updated'));
  assert.equal(rotated.requiresReplacement, true);
  const updated = parseToml(rotated.content).mcp_servers.ncf_agent_interconnect_inbox;
  assert.equal(updated.enabled, false);
  assert.equal(updated.tools.agent_read.approval_mode, 'prompt');
  const conflict = editMcpConfiguration(
    'codex',
    edit.content.replace(/enabled_tools\s*=\s*\[[^\]]+\]/, 'enabled_tools = ["other"]'),
    config,
  );
  assert.equal(conflict.requiresReplacement, true);
  assert.deepEqual(
    conflict.changes.map((change) => change.action),
    ['unchanged', 'replace'],
  );
});

test('Codex replaces only the named server, including nested or inline header layouts', () => {
  for (const source of [
    '# model comment\nmodel="fixture"\n[mcp_servers."ncf_agent_interconnect"]\ncommand="old"\nargs=["--old"]\n[mcp_servers.ncf_agent_interconnect.http_headers]\nAuthorization="old-token"\n[mcp_servers.other]\nurl="https://other.invalid"\n',
    'model="fixture"\nmcp_servers = { ncf_agent_interconnect = { url = "https://old.invalid" }, other = { url = "https://other.invalid" } }\n',
  ]) {
    const edit = editMcpConfiguration('codex', source, instructions('codex').configuration);
    const parsed = parseToml(edit.content);
    assert.equal(edit.requiresReplacement, true);
    assert.equal(parsed.model, 'fixture');
    assert.deepEqual(
      parsed.mcp_servers.ncf_agent_interconnect,
      parseToml(instructions('codex').configuration).mcp_servers.ncf_agent_interconnect,
    );
    assert.equal(parsed.mcp_servers.other.url, 'https://other.invalid');
  }
});

test('malformed documents, structural conflicts and OpenCode v2 are rejected without source excerpts', () => {
  for (const client of ['cursor', 'opencode', 'codex'] as const)
    assert.throws(
      () =>
        editMcpConfiguration(client, 'SECRET = "unterminated', instructions(client).configuration),
      (error: Error) => !error.message.includes('SECRET'),
    );
  assert.throws(
    () => editMcpConfiguration('cursor', '{"mcpServers":[]}', instructions('cursor').configuration),
    /must be an object/,
  );
  assert.throws(
    () => editMcpConfiguration('opencode', '{"plugin":{}}', instructions('opencode').configuration),
    /array of strings/,
  );
  assert.throws(
    () =>
      editMcpConfiguration(
        'opencode',
        '{"mcp":{"servers":{}}}',
        instructions('opencode').configuration,
      ),
    /v2/,
  );
  assert.throws(
    () =>
      editMcpConfiguration('opencode', '{"plugins":[]}', instructions('opencode').configuration),
    /v2/,
  );
  assert.throws(
    () =>
      editMcpConfiguration(
        'cursor',
        '{"mcpServers":{},"mcpServers":{}}',
        instructions('cursor').configuration,
      ),
    /invalid JSON/,
  );
  assert.deepEqual(
    parseJson(editMcpConfiguration('cursor', ' \n\t', instructions('cursor').configuration).content)
      .mcpServers.ncf_agent_interconnect.url,
    url,
  );
});

test('preview and cancel never create directories or write configurations', async (t) => {
  const { directory, service } = await fixture(t);
  const filename = path.join(directory, '.hidden', 'new', 'mcp.json');
  const preview = await service.preview(owner, 'cursor', [{ id: 'configuration', path: filename }]);
  assert.equal(preview.files[0].action, 'create');
  assert.deepEqual(await readdir(directory), []);
  assert.ok(!JSON.stringify(preview).includes(token));
  service.discard(owner, preview.planId);
  await assert.rejects(service.apply(owner, preview.planId, false), /expired/);
  assert.deepEqual(await readdir(directory), []);
});

test('Apply creates files only at the selected path, with restrictive permissions and idempotent retry', async (t) => {
  const { directory, service } = await fixture(t);
  const filename = path.join(directory, '.hidden', 'профиль', 'mcp.json');
  const preview = await service.preview(owner, 'cursor', [{ id: 'configuration', path: filename }]);
  const result = await service.apply(owner, preview.planId, false);
  assert.equal(result.status, 'applied');
  assert.equal(result.files[0].status, 'created');
  assert.equal(
    parseJson(await readFile(filename, 'utf8')).mcpServers.ncf_agent_interconnect.url,
    url,
  );
  if (process.platform !== 'win32') assert.equal((await stat(filename)).mode & 0o777, 0o600);
  assert.deepEqual(await service.apply(owner, preview.planId, false), result);
  assert.deepEqual(await readdir(path.dirname(filename)), ['mcp.json']);
  const repeat = await service.preview(owner, 'cursor', [{ id: 'configuration', path: filename }]);
  assert.equal(repeat.files[0].action, 'unchanged');
  assert.equal((await service.apply(owner, repeat.planId, false)).status, 'unchanged');
});

test('Cursor Apply installs its managed plugin atomically while preview and cancel remain read-only', async (t) => {
  const { directory, service } = await fixture(t, { instructions: instructionsWithCursorPlugin });
  const configuration = path.join(directory, '.cursor', 'mcp.json');
  const plugin = path.join(directory, '.cursor', 'plugins', 'local', 'ncf-agent-interconnect');
  await mkdir(path.dirname(configuration), { recursive: true });
  await writeFile(
    path.join(directory, '.cursor', 'permissions.json'),
    '{"mcpAllowlist":["foreign:tool"],"terminalAllowlist":["git"]}\n',
  );
  const source = '{"mcpServers":{"other":{"url":"https://example.invalid"}}}\n';
  await writeFile(configuration, source);
  await mkdir(plugin, { recursive: true });
  await writeFile(path.join(plugin, 'owner-note.txt'), 'preserve this file');
  const preview = await service.preview(owner, 'cursor', [
    { id: 'configuration', path: configuration },
  ]);
  assert.equal(preview.files.length, 4);
  assert.equal(await readFile(configuration, 'utf8'), source);
  assert.deepEqual(await readdir(plugin), ['owner-note.txt']);
  service.discard(owner, preview.planId);
  assert.deepEqual(await readdir(plugin), ['owner-note.txt']);

  const applied = await service.apply(
    owner,
    (await service.preview(owner, 'cursor', [{ id: 'configuration', path: configuration }])).planId,
    false,
  );
  assert.equal(applied.status, 'applied');
  assert.deepEqual(applied.cursorPermission, { state: 'configured' });
  assert.equal(
    JSON.parse(await readFile(path.join(plugin, '.cursor-plugin', 'plugin.json'), 'utf8')).name,
    'ncf-agent-interconnect',
  );
  assert.equal(
    JSON.parse(await readFile(path.join(plugin, 'hooks', 'hooks.json'), 'utf8')).version,
    1,
  );
  assert.equal(await readFile(path.join(plugin, 'owner-note.txt'), 'utf8'), 'preserve this file');
  assert.equal(
    parseJson(await readFile(configuration, 'utf8')).mcpServers.other.url,
    'https://example.invalid',
  );
  assert.deepEqual(
    parseJson(await readFile(path.join(directory, '.cursor', 'permissions.json'), 'utf8'))
      .mcpAllowlist,
    ['foreign:tool', 'ncf_agent_interconnect:agent_send'],
  );
  assert.equal((await service.status('cursor')).state, 'configured');
  const repeated = await service.preview(owner, 'cursor', [
    { id: 'configuration', path: configuration },
  ]);
  assert.ok(repeated.files.every((file) => file.action === 'unchanged'));
  assert.equal((await service.apply(owner, repeated.planId, false)).status, 'unchanged');
  assert.deepEqual(
    parseJson(await readFile(path.join(directory, '.cursor', 'permissions.json'), 'utf8'))
      .mcpAllowlist,
    ['foreign:tool', 'ncf_agent_interconnect:agent_send'],
  );
});

test('Cursor managed plugin failure rolls back earlier configuration and plugin writes', async (t) => {
  const { directory, service } = await fixture(t, { instructions: instructionsWithCursorPlugin });
  const configuration = path.join(directory, '.cursor', 'mcp.json');
  const plugin = path.join(directory, '.cursor', 'plugins', 'local', 'ncf-agent-interconnect');
  const hooks = path.join(plugin, 'hooks', 'hooks.json');
  await mkdir(path.dirname(hooks), { recursive: true });
  await writeFile(
    path.join(directory, '.cursor', 'permissions.json'),
    '{"mcpAllowlist":["foreign:tool"]}\n',
  );
  await writeFile(hooks, '{"owner":"foreign"}\n');
  const preview = await service.preview(owner, 'cursor', [
    { id: 'configuration', path: configuration },
  ]);
  const hooksPreview = preview.files.find((file) => file.id === 'cursor-plugin-hooks')!;
  await writeFile(hooksPreview.backupPath!, 'backup collision');
  const result = await service.apply(owner, preview.planId, false);
  assert.equal(result.status, 'failed');
  await assert.rejects(readFile(configuration, 'utf8'), { code: 'ENOENT' });
  await assert.rejects(readFile(path.join(plugin, '.cursor-plugin', 'plugin.json'), 'utf8'), {
    code: 'ENOENT',
  });
  assert.equal(await readFile(hooks, 'utf8'), '{"owner":"foreign"}\n');
  assert.equal(await readFile(hooksPreview.backupPath!, 'utf8'), 'backup collision');
  assert.deepEqual(
    parseJson(await readFile(path.join(directory, '.cursor', 'permissions.json'), 'utf8'))
      .mcpAllowlist,
    ['foreign:tool'],
  );
});

test('Cursor Connect preserves its legacy setup when permission ownership is unconfirmed', async (t) => {
  const { directory, service } = await fixture(t, { instructions: instructionsWithCursorPlugin });
  const configuration = path.join(directory, '.cursor', 'mcp.json');
  await mkdir(path.dirname(configuration), { recursive: true });
  const missingPreview = await service.preview(owner, 'cursor', [
    { id: 'configuration', path: configuration },
  ]);
  assert.equal(
    missingPreview.files.some((file) => file.id === 'cursor-permissions'),
    false,
  );
  const missingResult = await service.apply(owner, missingPreview.planId, false);
  assert.equal(missingResult.status, 'applied');
  assert.deepEqual(missingResult.cursorPermission, { state: 'unconfirmed', reason: 'missing' });
  assert.ok(parseJson(await readFile(configuration, 'utf8')).mcpServers.ncf_agent_interconnect);
  await assert.rejects(readFile(path.join(directory, '.cursor', 'permissions.json'), 'utf8'), {
    code: 'ENOENT',
  });

  await rm(configuration);
  await writeFile(
    path.join(directory, '.cursor', 'permissions.json'),
    '{"terminalAllowlist":["git status"]}\n',
  );
  const idePreview = await service.preview(owner, 'cursor', [
    { id: 'configuration', path: configuration },
  ]);
  assert.equal(
    idePreview.files.some((file) => file.id === 'cursor-permissions'),
    false,
  );
  const ideResult = await service.apply(owner, idePreview.planId, false);
  assert.equal(ideResult.status, 'applied');
  assert.deepEqual(ideResult.cursorPermission, { state: 'unconfirmed', reason: 'ide-owned' });
  assert.equal(
    await readFile(path.join(directory, '.cursor', 'permissions.json'), 'utf8'),
    '{"terminalAllowlist":["git status"]}\n',
  );
  const status = await service.status('cursor');
  assert.equal(status.state, 'configured');
  assert.deepEqual(status.cursorPermission, { state: 'unconfirmed', reason: 'ide-owned' });
});

test('Cursor unsupported permission bytes do not block MCP setup or overwrite the file', async (t) => {
  const { directory, service } = await fixture(t, { instructions: instructionsWithCursorPlugin });
  const configuration = path.join(directory, '.cursor', 'mcp.json');
  const permissions = path.join(directory, '.cursor', 'permissions.json');
  await mkdir(path.dirname(configuration), { recursive: true });
  await writeFile(permissions, '{broken owner bytes');
  const preview = await service.preview(owner, 'cursor', [
    { id: 'configuration', path: configuration },
  ]);
  assert.equal(
    preview.files.some((file) => file.id === 'cursor-permissions'),
    false,
  );
  const result = await service.apply(owner, preview.planId, false);
  assert.equal(result.status, 'applied');
  assert.deepEqual(result.cursorPermission, { state: 'unconfirmed', reason: 'unsupported' });
  assert.equal(await readFile(permissions, 'utf8'), '{broken owner bytes');
  assert.ok(parseJson(await readFile(configuration, 'utf8')).mcpServers.ncf_agent_interconnect);
});

test('Cursor file-owned permission keeps the selected preview source fence', async (t) => {
  const { directory, service } = await fixture(t, { instructions: instructionsWithCursorPlugin });
  const configuration = path.join(directory, '.cursor', 'mcp.json');
  const permissions = path.join(directory, '.cursor', 'permissions.json');
  await mkdir(path.dirname(configuration), { recursive: true });
  await writeFile(permissions, '{"mcpAllowlist":["foreign:tool"]}\n');
  const preview = await service.preview(owner, 'cursor', [
    { id: 'configuration', path: configuration },
  ]);
  await writeFile(permissions, '{"mcpAllowlist":["owner:changed"]}\n');
  const result = await service.apply(owner, preview.planId, false);
  assert.equal(result.status, 'failed');
  assert.match(result.error!, /changed after preview/);
  await assert.rejects(readFile(configuration, 'utf8'), { code: 'ENOENT' });
  assert.equal(await readFile(permissions, 'utf8'), '{"mcpAllowlist":["owner:changed"]}\n');
});

test('previously configured Cursor offers Connect when a file-owned rule is pending', async (t) => {
  const { directory, service } = await fixture(t, { instructions: instructionsWithCursorPlugin });
  const configuration = path.join(directory, '.cursor', 'mcp.json');
  const permissions = path.join(directory, '.cursor', 'permissions.json');
  await mkdir(path.dirname(configuration), { recursive: true });
  const initial = await service.preview(owner, 'cursor', [
    { id: 'configuration', path: configuration },
  ]);
  assert.equal((await service.apply(owner, initial.planId, false)).status, 'applied');
  await writeFile(permissions, '{"mcpAllowlist":["foreign:tool"]}\n');

  const pending = await service.status('cursor');
  assert.equal(pending.state, 'not-configured');
  assert.deepEqual(pending.cursorPermission, { state: 'pending' });
  const preview = await service.preview(owner, 'cursor', [
    { id: 'configuration', path: configuration },
  ]);
  assert.equal(preview.requiresReplacement, false);
  assert.deepEqual(
    preview.files.map((file) => [file.id, file.action]),
    [
      ['configuration', 'unchanged'],
      ['cursor-permissions', 'update'],
      ['cursor-plugin-manifest', 'unchanged'],
      ['cursor-plugin-hooks', 'unchanged'],
    ],
  );
  const result = await service.apply(owner, preview.planId, false);
  assert.equal(result.status, 'applied');
  assert.deepEqual(result.cursorPermission, { state: 'configured' });
  assert.deepEqual(parseJson(await readFile(permissions, 'utf8')).mcpAllowlist, [
    'foreign:tool',
    'ncf_agent_interconnect:agent_send',
  ]);
  assert.equal((await service.status('cursor')).state, 'configured');
});

for (const platform of ['darwin', 'win32', 'linux'] as const)
  test(
    platform + ' applies an explicitly reviewed ChatGPT plan without creating a launcher',
    async (t) => {
      const { directory } = await fixture(t);
      const handle = createMcpSetupHandler({
        instructions,
        home: directory,
        stateDirectory: path.join(directory, '.app-state'),
        env: {},
        openPath: async () => '',
        window: () => null,
        dialog: {} as never,
        codexShortcut: {
          platform,
          installed: false,
          alternateUserData: true,
          userData: directory,
          appExecutable: directory,
          appPath: directory,
          appData: directory,
          home: directory,
          desktop: directory,
          dialog: {} as never,
          boundProfiles: () => [],
          reveal: () => {},
        },
      });
      const target = path.join(directory, 'config.toml');
      const plan = await handle(
        'mcpSetupPreview',
        { client: 'codex', files: [{ id: 'configuration', path: target }] },
        owner,
      );
      assert.ok(plan.handled);
      const { planId } = plan.result as { planId: string };
      await assert.rejects(
        handle('mcpSetupApply', { planId, confirmReplace: false }, 'another-window'),
      );
      await assert.rejects(stat(target), { code: 'ENOENT' });
      const applied = await handle('mcpSetupApply', { planId, confirmReplace: false }, owner);
      assert.ok(applied.handled);
      assert.equal((applied.result as { status: string }).status, 'applied');
      assert.match(await readFile(target, 'utf8'), /ncf_agent_interconnect/);
      assert.ok(!(await readdir(directory)).some((name) => name.endsWith('.app')));
    },
  );

test('replacement requires confirmation, preserves the original in a private backup and retains file permissions', async (t) => {
  const { directory, service } = await fixture(t);
  const filename = path.join(directory, 'config.toml');
  const source =
    '# user settings\nmodel="fixture"\n[mcp_servers.ncf_agent_interconnect]\nurl="https://old.invalid"\n';
  await writeFile(filename, source, { mode: 0o640 });
  const beforeMode = (await stat(filename)).mode & 0o777;
  const preview = await service.preview(owner, 'codex', [{ id: 'configuration', path: filename }]);
  assert.equal(preview.requiresReplacement, true);
  await assert.rejects(service.apply(owner, preview.planId, false), /Confirm replacement/);
  assert.equal(await readFile(filename, 'utf8'), source);
  const result = await service.apply(owner, preview.planId, true);
  assert.equal(result.status, 'applied');
  assert.equal(await readFile(result.files[0].backupPath!, 'utf8'), source);
  if (process.platform !== 'win32') {
    assert.equal((await stat(result.files[0].backupPath!)).mode & 0o777, 0o600);
    assert.equal((await stat(filename)).mode & 0o777, beforeMode);
  }
  assert.ok((await readFile(filename, 'utf8')).includes('# user settings'));
});

test('window ownership, cancelled plans, plan expiry and NCF endpoint changes prevent writing', async (t) => {
  let now = 0;
  let currentUrl = url;
  const { directory, service } = await fixture(t, {
    now: () => now,
    instructions: (client) => mcpInstructions(currentUrl, token, client, plugin),
  });
  const filename = path.join(directory, 'mcp.json');
  const plan = await service.preview(owner, 'cursor', [{ id: 'configuration', path: filename }]);
  await assert.rejects(service.apply('other-window', plan.planId, false), /another window/);
  service.discard('other-window', plan.planId);
  currentUrl = 'http://127.0.0.1:43000/mcp';
  const changed = await service.apply(owner, plan.planId, false);
  assert.equal(changed.status, 'failed');
  assert.match(changed.error!, /connection settings changed/);
  assert.deepEqual(await readdir(directory), []);
  const expired = await service.preview(owner, 'cursor', [{ id: 'configuration', path: filename }]);
  now = 10 * 60 * 1000;
  await assert.rejects(service.apply(owner, expired.planId, false), /expired/);
});

test('external changes and newly created files invalidate a preview without overwrite or backups', async (t) => {
  const { directory, service } = await fixture(t);
  const filename = path.join(directory, 'mcp.json');
  for (const initiallyExists of [false, true]) {
    await rm(filename, { force: true });
    if (initiallyExists) await writeFile(filename, '{}');
    const preview = await service.preview(owner, 'cursor', [
      { id: 'configuration', path: filename },
    ]);
    const changed = '{"owner":"changed outside the dialog"}';
    await writeFile(filename, changed);
    const result = await service.apply(owner, preview.planId, false);
    assert.equal(result.status, 'failed');
    assert.match(result.error!, /changed after preview/);
    assert.equal(await readFile(filename, 'utf8'), changed);
    assert.deepEqual(await readdir(directory), ['mcp.json']);
    assert.equal(result.files[0].backupPath, undefined);
    assert.deepEqual(await service.apply(owner, preview.planId, false), result);
  }
});

test('a backup collision fails without overwriting the configuration or the existing backup', async (t) => {
  const { directory, service } = await fixture(t);
  const filename = path.join(directory, 'mcp.json');
  const original = '{"other":true}\n';
  await writeFile(filename, original);
  const preview = await service.preview(owner, 'cursor', [{ id: 'configuration', path: filename }]);
  const backup = preview.files[0].backupPath!;
  await writeFile(backup, 'unrelated backup');
  const result = await service.apply(owner, preview.planId, false);
  assert.equal(result.status, 'failed');
  assert.equal(result.files[0].backupPath, undefined);
  assert.equal(await readFile(filename, 'utf8'), original);
  assert.equal(await readFile(backup, 'utf8'), 'unrelated backup');
  assert.equal((await readdir(directory)).length, 2);
});

test('invalid paths, non-files, oversized and non-UTF8 files are rejected before writing', async (t) => {
  const { directory, service } = await fixture(t);
  const preview = (filename: string) =>
    service.preview(owner, 'cursor', [{ id: 'configuration', path: filename }]);
  await assert.rejects(preview('relative.json'), /absolute/);
  await assert.rejects(preview(path.join(directory, 'notes.txt')), /configuration file/);
  const folder = path.join(directory, 'folder.json');
  await mkdir(folder);
  await assert.rejects(preview(folder), /regular/);
  const file = path.join(directory, 'bad.json');
  await writeFile(file, Buffer.from([255, 254, 0, 0]));
  await assert.rejects(preview(file), /UTF-8/);
  await writeFile(file, ' '.repeat(1024 * 1024 + 1));
  await assert.rejects(preview(file), /1 MiB/);
});

test(
  'symlinked files and a retargeted parent do not redirect Apply to another configuration',
  { skip: process.platform === 'win32' },
  async (t) => {
    const { directory, service } = await fixture(t);
    const target = path.join(directory, 'real.json');
    await writeFile(target, '{}');
    const alias = path.join(directory, 'alias.json');
    await symlink(target, alias);
    await assert.rejects(
      service.preview(owner, 'cursor', [{ id: 'configuration', path: alias }]),
      /symbolic link/,
    );
    const planned = path.join(directory, 'new', 'mcp.json');
    const preview = await service.preview(owner, 'cursor', [
      { id: 'configuration', path: planned },
    ]);
    const other = path.join(directory, 'other');
    await mkdir(other);
    await symlink(other, path.dirname(planned));
    const result = await service.apply(owner, preview.planId, false);
    assert.equal(result.status, 'failed');
    assert.deepEqual(await readdir(other), []);
  },
);

test('known paths use the selected home and explicit environment, without guessing the active instance', async (t) => {
  const { directory, service } = await fixture(t);
  assert.equal(
    (await service.defaults('cursor')).files[0].path,
    path.join(directory, '.cursor', 'mcp.json'),
  );
  assert.equal(
    (await service.defaults('codex')).files[0].path,
    path.join(directory, '.codex', 'config.toml'),
  );
  const config = path.join(directory, '.config', 'opencode', 'opencode.jsonc');
  await mkdir(path.dirname(config), { recursive: true });
  await writeFile(config, '{}');
  assert.equal((await service.defaults('opencode')).files[0].path, config);
  const custom = new McpSetupService({
    instructions,
    home: directory,
    stateDirectory: path.join(directory, '.app-state'),
    env: {
      CODEX_HOME: path.join(directory, 'profile'),
      OPENCODE_CONFIG: path.join(directory, 'custom.json'),
    },
  });
  assert.equal(
    (await custom.defaults('codex')).files[0].path,
    path.join(directory, 'profile', 'config.toml'),
  );
  assert.equal(
    (await custom.defaults('opencode')).files[0].alternatives[0],
    path.join(directory, 'custom.json'),
  );
});

test('OpenCode v1 configuration evidence uses known targets without writing or changing setup status', async (t) => {
  const { directory, service } = await fixture(t);
  const config = path.join(directory, '.config', 'opencode', 'opencode.json');
  const alternative = config + 'c';
  await mkdir(path.dirname(config), { recursive: true });
  assert.equal((await service.status('opencode')).openCodeV1Configuration, false);

  const v2 = '{"providers":{"other":{"package":"example"}},"mcp":{"servers":{}}}';
  await writeFile(config, v2);
  const v2Only = await service.status('opencode');
  assert.equal(v2Only.openCodeV1Configuration, false);
  assert.equal(v2Only.state, 'unavailable');

  await writeFile(
    alternative,
    '{ "$schema":"https://opencode.ai/config.json", "model":"other/example" }',
  );
  assert.equal((await service.status('opencode')).openCodeV1Configuration, false);
  await writeFile(alternative, '{"plugin":[],"plugin":[]}');
  assert.equal((await service.status('opencode')).openCodeV1Configuration, false);

  const v1 = '\uFEFF{\n  // Preserve the owner restriction\n  "permission": { "*": "deny" },\n}\n';
  await writeFile(alternative, v1);
  const separate = await service.status('opencode');
  assert.equal(separate.openCodeV1Configuration, true);
  assert.equal(separate.files[0].path, config);
  assert.equal(await readFile(alternative, 'utf8'), v1);

  await writeFile(config, v1);
  const restricted = await service.status('opencode');
  assert.equal(restricted.openCodeV1Configuration, true);
  assert.equal(restricted.state, 'unavailable');
  assert.match(restricted.files[0].error ?? '', /Existing OpenCode deny rule/);
  assert.equal(await readFile(config, 'utf8'), v1);

  for (const v1 of [
    '{"provider":{"other":{"options":{}}}}',
    '{"plugin":["example"]}',
    '{"tools":{"write":false}}',
    '{"mcp":{"other":{"type":"local","command":["fixture"]}}}',
  ]) {
    await writeFile(config, v1);
    assert.equal((await service.status('opencode')).openCodeV1Configuration, true);
    assert.equal(await readFile(config, 'utf8'), v1);
  }
  assert.deepEqual((await readdir(path.dirname(config))).sort(), [
    'opencode.json',
    'opencode.jsonc',
  ]);
  assert.deepEqual(await readdir(directory), ['.config']);
});

test('desktop IPC validates input and uses the native picker with hidden files; cancel is read-only', async (t) => {
  const { directory } = await fixture(t);
  let pickerOptions: unknown;
  const handle = createMcpSetupHandler({
    instructions,
    home: directory,
    stateDirectory: path.join(directory, '.app-state'),
    env: {},
    openPath: async () => '',
    window: () => ({ isDestroyed: () => false }) as never,
    dialog: {
      showOpenDialog: async (_window: unknown, options: unknown) => {
        pickerOptions = options;
        return { canceled: true, filePaths: [] };
      },
    } as never,
  });
  assert.deepEqual(await handle('unknownMethod', {}, owner), { handled: false });
  const result = await handle(
    'mcpSetupBrowse',
    { client: 'codex', path: path.join(directory, '.hidden', 'config.toml') },
    owner,
  );
  assert.deepEqual(result, { handled: true, result: null });
  assert.deepEqual((pickerOptions as { properties: string[] }).properties, [
    'openFile',
    'showHiddenFiles',
  ]);
  await handle('mcpSetupBrowse', { client: 'cursor', path: 'incomplete' }, owner);
  assert.equal(
    (pickerOptions as { defaultPath: string }).defaultPath,
    path.join(directory, '.cursor', 'mcp.json'),
  );
  await assert.rejects(
    handle('mcpSetupPreview', { client: 'cursor', files: [], content: 'arbitrary write' }, owner),
  );
  await assert.rejects(
    handle('mcpSetupApply', { planId: 'not-a-uuid', confirmReplace: false }, owner),
  );
  assert.deepEqual(await readdir(directory), []);
});

test('required settings with custom client options are left byte-for-byte unchanged', async (t) => {
  const { directory, service } = await fixture(t);
  for (const client of ['cursor', 'opencode', 'codex'] as const) {
    const filename = path.join(
      directory,
      client === 'codex' ? 'custom.config.toml' : client + '.json',
    );
    let source: string;
    if (client === 'codex')
      source = instructions(client).configuration.replace(
        '[mcp_servers.ncf_agent_interconnect]\n',
        '[mcp_servers.ncf_agent_interconnect]\nenabled_tools = ["agent_send"] # custom\n',
      );
    else {
      const config = JSON.parse(instructions(client).configuration);
      config[client === 'cursor' ? 'mcpServers' : 'mcp'].ncf_agent_interconnect.custom = 'keep';
      source = JSON.stringify(config, null, 4) + '\n';
    }
    await writeFile(filename, source);
    const before = await stat(filename);
    const preview = await service.preview(owner, client, [{ id: 'configuration', path: filename }]);
    assert.equal(preview.files[0].action, 'unchanged');
    assert.equal(preview.requiresReplacement, false);
    assert.equal(Object.hasOwn(preview.files[0], 'before'), false);
    assert.equal(Object.hasOwn(preview.files[0], 'after'), false);
    const result = await service.apply(owner, preview.planId, false);
    assert.equal(result.status, 'unchanged');
    assert.equal(await readFile(filename, 'utf8'), source);
    assert.equal((await stat(filename)).mtimeMs, before.mtimeMs);
    assert.equal((await service.status(client)).state, 'configured');
  }
});

test('ChatGPT distinguishes matching file contents from a usable profile and only saves an explicit selection', async (t) => {
  let running: string | undefined;
  const { directory, service } = await fixture(t, {
    runningCodexConfiguration: async () => running,
  });
  const home = await realpath(directory);
  const custom = path.join(home, 'Work', 'config.toml');
  const stock = path.join(home, '.codex', 'config.toml');
  const selected = path.join(directory, '.app-state', 'mcp-setup-paths.json');
  const source = '# preserve settings\n' + instructions('codex').configuration;
  for (const filename of [stock, custom]) {
    await mkdir(path.dirname(filename));
    await writeFile(filename, source, { mode: 0o600 });
  }
  const before = await stat(custom);
  if (process.platform !== 'win32') {
    const status = await service.status('codex');
    assert.equal(status.files[0].state, 'configured');
    assert.equal(status.state, 'not-configured');
  }
  running = custom;
  const live = await service.status('codex');
  assert.equal(live.state, 'configured');
  assert.equal(live.remembered, false);
  assert.equal(live.files[0].path, custom);
  const preview = await service.preview(owner, 'codex', [{ id: 'configuration', path: custom }]);
  assert.equal(preview.files[0].action, 'unchanged');
  await assert.rejects(stat(selected), { code: 'ENOENT' });
  assert.equal((await service.apply(owner, preview.planId, false)).status, 'unchanged');
  running = stock;
  const saved = await service.status('codex');
  assert.equal(saved.remembered, true);
  assert.equal(saved.files[0].path, custom);
  assert.equal(await readFile(custom, 'utf8'), source);
  assert.equal((await stat(custom)).mtimeMs, before.mtimeMs);
});

test('only the successful selected path is persisted and rechecked after restart without writing', async (t) => {
  const { directory, service } = await fixture(t);
  const selected = path.join(directory, 'another profile', 'custom.jsonc');
  const preview = await service.preview(owner, 'opencode', [
    { id: 'configuration', path: selected },
  ]);
  assert.equal((await service.status('opencode')).remembered, false);
  assert.equal((await service.apply(owner, preview.planId, false)).status, 'applied');
  const stateDirectory = path.join(directory, '.app-state');
  const stateFile = path.join(stateDirectory, 'mcp-setup-paths.json');
  const saved = JSON.parse(await readFile(stateFile, 'utf8'));
  assert.deepEqual(saved, { version: 1, paths: { opencode: preview.files[0].path } });
  assert.ok(!JSON.stringify(saved).includes(token));
  const restarted = new McpSetupService({ instructions, home: directory, env: {}, stateDirectory });
  assert.equal((await restarted.defaults('opencode')).files[0].path, preview.files[0].path);
  const before = await stat(selected);
  assert.equal((await restarted.status('opencode')).state, 'configured');
  await restarted.statusAll();
  assert.equal((await stat(selected)).mtimeMs, before.mtimeMs);
  assert.equal(await restarted.openablePath('opencode'), preview.files[0].path);
  await writeFile(selected, '{"mcp":{},"plugin":[]}');
  assert.equal((await restarted.status('opencode')).state, 'not-configured');
  await writeFile(selected, '{malformed-secret-line');
  const invalid = await restarted.status('opencode');
  assert.equal(invalid.state, 'unavailable');
  assert.ok(!JSON.stringify(invalid).includes('malformed-secret-line'));
  await rm(selected);
  assert.equal((await restarted.status('opencode')).state, 'missing');
  await assert.rejects(restarted.openablePath('opencode'), /does not exist/);
});

test('failed setup does not change the remembered path; missing or corrupt path storage never writes client files', async (t) => {
  const { directory, service } = await fixture(t);
  const selected = path.join(directory, 'custom.json');
  const preview = await service.preview(owner, 'cursor', [{ id: 'configuration', path: selected }]);
  await writeFile(selected, '{"newer":true}');
  assert.equal((await service.apply(owner, preview.planId, false)).status, 'failed');
  assert.equal((await service.status('cursor')).remembered, false);
  const stateDirectory = path.join(directory, '.app-state');
  await mkdir(stateDirectory);
  await writeFile(path.join(stateDirectory, 'mcp-setup-paths.json'), 'corrupt-saved-data');
  assert.equal((await service.status('cursor')).state, 'unavailable');
  const defaultPath = (await service.defaults('cursor')).files[0].path;
  const ready = await service.preview(owner, 'cursor', [
    { id: 'configuration', path: defaultPath },
  ]);
  const result = await service.apply(owner, ready.planId, false);
  assert.equal(result.status, 'applied');
  assert.match(result.warning!, /path could not be saved/);
  assert.equal(await readFile(selected, 'utf8'), '{"newer":true}');
});

test('main startup checks are read-only and system opening uses only the remembered client file', async (t) => {
  const { directory, service } = await fixture(t);
  const selected = path.join(directory, 'profile.config.toml');
  const preview = await service.preview(owner, 'codex', [{ id: 'configuration', path: selected }]);
  await service.apply(owner, preview.planId, false);
  const before = await stat(selected);
  let opened = '';
  const handler = createMcpSetupHandler({
    instructions,
    home: directory,
    env: {},
    stateDirectory: path.join(directory, '.app-state'),
    window: () => null,
    dialog: {} as never,
    openPath: async (filename) => {
      opened = filename;
      return '';
    },
  });
  const status = await handler('mcpSetupStatus', { client: 'codex' }, owner);
  assert.equal(status.handled && (status.result as { state: string }).state, 'configured');
  assert.equal((await stat(selected)).mtimeMs, before.mtimeMs);
  assert.deepEqual(await handler('mcpSetupOpen', { client: 'codex' }, owner), {
    handled: true,
    result: { opened: true },
  });
  assert.equal(opened, preview.files[0].path);
  await assert.rejects(
    handler('mcpSetupOpen', { client: 'codex', path: '/arbitrary/file' }, owner),
  );
});

test('AionUi owner Apply targets the real Cursor file with its bridge, preserving other settings and no-op bytes', async (t) => {
  const { service, directory } = await fixture(t);
  const filename = (await service.defaults('aionui')).files[0].path;
  assert.equal(filename, path.join(directory, '.cursor', 'mcp.json'));
  await mkdir(path.dirname(filename), { recursive: true });
  const original = JSON.stringify({
    other: 'keep',
    mcpServers: {
      foreign: { command: 'keep' },
      ncf_agent_interconnect: { url: 'http://127.0.0.1:1/mcp' },
    },
  });
  await writeFile(filename, original);
  const preview = await service.preview(owner, 'aionui', [{ id: 'configuration', path: filename }]);
  assert.equal(preview.requiresReplacement, true);
  assert.equal(await readFile(filename, 'utf8'), original);
  const applied = await service.apply(owner, preview.planId, true);
  assert.equal(applied.status, 'applied');
  const bytes = await readFile(filename, 'utf8');
  const parsed = JSON.parse(bytes);
  assert.equal(parsed.other, 'keep');
  assert.equal(parsed.mcpServers.foreign.command, 'keep');
  assert.equal(parsed.mcpServers.ncf_agent_interconnect.command, 'fixture-runtime');
  assert.ok(!('url' in parsed.mcpServers.ncf_agent_interconnect));
  const next = await service.preview(owner, 'aionui', [{ id: 'configuration', path: filename }]);
  assert.equal(next.files[0].action, 'unchanged');
  await service.apply(owner, next.planId, false);
  assert.equal(await readFile(filename, 'utf8'), bytes);
  assert.equal((await service.status('aionui')).state, 'configured');
});

test('quick Connect offers the open Mac profiles and keeps the selected profile after relaunch', async (t) => {
  const { directory } = await fixture(t);
  const base = await realpath(directory);
  const home = path.join(base, 'Home', 'config.toml'),
    work = path.join(base, 'Work', 'config.toml');
  let running = [home, work];
  const make = () =>
    createMcpSetupHandler({
      home: base,
      stateDirectory: path.join(base, 'state'),
      env: {},
      macSetupProfiles: async () => running,
      window: () => null,
      openPath: async () => '',
      dialog: {
        showOpenDialog: async () => {
          throw Error('unexpected picker');
        },
      },
      instructions,
    });
  const handler = make();
  const prepare = async (handle: ReturnType<typeof make>, params: object) => {
    const reply = await handle('codexSetupPrepare', params, owner);
    assert.ok(reply.handled);
    return reply.result as import('../desktop/shared/mcp-setup.js').CodexSetupPreparation;
  };
  assert.deepEqual(await prepare(handler, {}), { configurations: running });
  assert.deepEqual(await prepare(handler, { configuration: path.join(base, 'foreign.toml') }), {
    configurations: running,
  });
  const preview = await prepare(handler, { configuration: work });
  assert.ok('planId' in preview);
  assert.equal(preview.files[0].path, work);
  await handler('mcpSetupApply', { planId: preview.planId, confirmReplace: false }, owner);
  running = [home];
  const saved = await prepare(make(), {});
  assert.ok('planId' in saved);
  assert.equal(saved.files[0].path, work);
  await assert.rejects(stat(home), { code: 'ENOENT' });
});

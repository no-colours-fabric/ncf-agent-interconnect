import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parse as parseJson } from 'jsonc-parser';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { mcpInstructions } from '../desktop/core/instructions.js';
import { editMcpConfiguration } from '../desktop/core/mcp-setup-editors.js';
import { McpSetupService } from '../desktop/core/mcp-setup.js';
import { createMcpSetupHandler } from '../desktop/main/mcp-setup-ipc.js';
import type { McpSetupClient } from '../desktop/shared/mcp-setup.js';

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

test('OpenCode v1 adds both operations without duplicating plugins or replacing others', () => {
  const source =
    '{\n // kept\n "plugin": ["existing-plugin"],\n "mcp": {"other": {"type": "remote", "url": "https://example.invalid"}},\n "theme": "dark"\n}\n';
  const edit = editMcpConfiguration('opencode', source, instructions('opencode').configuration);
  const parsed = parseJson(edit.content);
  assert.deepEqual(parsed.plugin, ['existing-plugin', plugin]);
  assert.equal(parsed.mcp.other.url, 'https://example.invalid');
  assert.equal(parsed.theme, 'dark');
  assert.ok(edit.content.includes('// kept'));
  assert.equal(edit.changes.length, 2);
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
  const source = '{"mcpServers":{"other":{"url":"https://example.invalid"}}}\n';
  await writeFile(configuration, source);
  await mkdir(plugin, { recursive: true });
  await writeFile(path.join(plugin, 'owner-note.txt'), 'preserve this file');
  const preview = await service.preview(owner, 'cursor', [
    { id: 'configuration', path: configuration },
  ]);
  assert.equal(preview.files.length, 3);
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
  assert.equal((await service.status('cursor')).state, 'configured');
});

test('Cursor managed plugin failure rolls back earlier configuration and plugin writes', async (t) => {
  const { directory, service } = await fixture(t, { instructions: instructionsWithCursorPlugin });
  const configuration = path.join(directory, '.cursor', 'mcp.json');
  const plugin = path.join(directory, '.cursor', 'plugins', 'local', 'ncf-agent-interconnect');
  const hooks = path.join(plugin, 'hooks', 'hooks.json');
  await mkdir(path.dirname(hooks), { recursive: true });
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
});

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
      source = instructions(client).configuration + 'enabled_tools = ["agent_send"] # custom\n';
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

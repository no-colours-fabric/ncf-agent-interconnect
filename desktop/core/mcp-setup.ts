import { constants } from 'node:fs';
import { access, link, lstat, mkdir, open, realpath, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import type { McpInstructions } from '../shared/contracts.js';
import type {
  McpSetupApplyResult,
  McpSetupClient,
  McpSetupDefaults,
  McpSetupPreview,
  McpSetupTarget,
  McpSetupStatus,
} from '../shared/mcp-setup.js';
import { mcpSetupClients } from '../shared/mcp-setup.js';
import { editMcpConfiguration } from './mcp-setup-editors.js';
import { McpSetupPaths } from './mcp-setup-paths.js';

const maxBytes = 1024 * 1024;
const lifetime = 10 * 60 * 1000;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const errno = (error: unknown) => (error as NodeJS.ErrnoException).code;
class SetupError extends Error {}
function safeError(error: unknown): string {
  if (error instanceof SetupError) return error.message;
  if (['EACCES', 'EPERM', 'EROFS'].includes(errno(error) ?? ''))
    return 'The selected configuration or its directory is not writable';
  if (errno(error) === 'ENOSPC')
    return 'There is not enough disk space to update the configuration';
  return 'The configuration could not be updated; review the files and prepare a new preview';
}
interface Source {
  exists: boolean;
  content: string;
  stamp: string;
  mode: number;
}
interface PreparedFile {
  path: string;
  backupPath?: string;
  backupWritten?: boolean;
  source: Source;
  content: string;
}
interface Plan {
  owner: string;
  client: McpSetupClient;
  expires: number;
  configurationHash: string;
  preview: McpSetupPreview;
  files: PreparedFile[];
  applying: boolean;
  result?: McpSetupApplyResult;
}

export interface McpSetupOptions {
  instructions: (client: McpSetupClient) => Promise<McpInstructions> | McpInstructions;
  home?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  stateDirectory: string;
}

/** Plans are private to the trusted desktop interface, never MCP tools. */
export class McpSetupService {
  private readonly plans = new Map<string, Plan>();
  private readonly home: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly now: () => number;
  private writing = false;
  private readonly paths: McpSetupPaths;
  constructor(private readonly options: McpSetupOptions) {
    this.home = options.home ?? os.homedir();
    this.env = options.env ?? process.env;
    this.now = options.now ?? Date.now;
    this.paths = new McpSetupPaths(options.stateDirectory);
  }

  async defaults(client: McpSetupClient): Promise<McpSetupDefaults> {
    const remembered = await this.paths.get(client).catch(() => undefined);
    const codexHome =
      this.env.CODEX_HOME && path.isAbsolute(this.env.CODEX_HOME)
        ? this.env.CODEX_HOME
        : path.join(this.home, '.codex');
    const configHome =
      this.env.XDG_CONFIG_HOME && path.isAbsolute(this.env.XDG_CONFIG_HOME)
        ? this.env.XDG_CONFIG_HOME
        : path.join(this.home, '.config');
    // Claude Code keeps user settings in settings.json; its ~/.claude.json is never edited.
    const claudeHome =
      this.env.CLAUDE_CONFIG_DIR && path.isAbsolute(this.env.CLAUDE_CONFIG_DIR)
        ? this.env.CLAUDE_CONFIG_DIR
        : path.join(this.home, '.claude');
    const candidates =
      client === 'claude'
        ? [path.join(claudeHome, 'settings.json')]
        : client === 'cursor' || client === 'aionui'
          ? [path.join(this.home, '.cursor', 'mcp.json')]
          : client === 'codex'
            ? [path.join(codexHome, 'config.toml')]
            : [
                ...(this.env.OPENCODE_CONFIG ? [this.env.OPENCODE_CONFIG] : []),
                ...['opencode.json', 'opencode.jsonc'].map((name) =>
                  path.join(configHome, 'opencode', name),
                ),
              ];
    const paths = [
      ...new Set([...(remembered ? [remembered] : []), ...candidates.filter(path.isAbsolute)]),
    ];
    const existing: string[] = [];
    for (const file of paths) {
      try {
        if ((await lstat(file)).isFile()) existing.push(file);
      } catch (error) {
        if (errno(error) !== 'ENOENT') continue;
      }
    }
    return {
      client,
      files: [
        {
          id: 'configuration',
          path: remembered ?? existing[0] ?? paths[0],
          alternatives: paths,
          format: client === 'codex' ? 'toml' : 'jsonc',
        },
      ],
    };
  }

  async status(client: McpSetupClient): Promise<McpSetupStatus> {
    let filename = '';
    let remembered = false;
    try {
      remembered = !!(await this.paths.get(client));
      filename = (await this.defaults(client)).files[0].path;
      const source = await this.readSource(await this.canonicalPath(filename));
      if (!source.exists)
        return {
          client,
          remembered,
          state: 'missing',
          files: [{ id: 'configuration', path: filename, state: 'missing' }],
        };
      const instructions = await this.options.instructions(client);
      const edit = editMcpConfiguration(client, source.content, instructions.configuration);
      const state =
        edit.content === source.content
          ? 'configured'
          : edit.changes.some((change) => change.action !== 'add')
            ? 'needs-update'
            : 'not-configured';
      return { client, remembered, state, files: [{ id: 'configuration', path: filename, state }] };
    } catch (error) {
      return {
        client,
        remembered,
        state: 'unavailable',
        files: [
          {
            id: 'configuration',
            path: filename,
            state: 'unavailable',
            error:
              error instanceof Error && !errno(error)
                ? error.message
                : 'The configuration file could not be checked',
          },
        ],
      };
    }
  }

  async statusAll(): Promise<McpSetupStatus[]> {
    return Promise.all(mcpSetupClients.map((client) => this.status(client)));
  }

  async openablePath(client: McpSetupClient): Promise<string> {
    const filename = (await this.defaults(client)).files[0].path;
    const source = await this.readSource(await this.canonicalPath(filename));
    if (!source.exists) throw new SetupError('The configuration file does not exist');
    return filename;
  }

  resolvePath(input: string): string {
    const expanded = input === '~' ? this.home : input.replace(/^~[/\\]/, this.home + path.sep);
    if (!expanded || expanded.includes('\0') || !path.isAbsolute(expanded))
      throw new SetupError('Enter an absolute configuration file path');
    return path.normalize(expanded);
  }

  async preview(
    owner: string,
    client: McpSetupClient,
    targets: McpSetupTarget[],
  ): Promise<McpSetupPreview> {
    this.prune();
    if (!owner) throw new SetupError('The desktop interface session is missing');
    if (targets.length !== 1 || targets[0].id !== 'configuration')
      throw new SetupError('Select the configuration file for this client');
    const candidate = this.resolvePath(targets[0].path);
    const extensions =
      client === 'codex' ? ['.toml'] : client === 'claude' ? ['.json'] : ['.json', '.jsonc'];
    if (!extensions.includes(path.extname(candidate).toLowerCase()))
      throw new SetupError(`Select a ${extensions.join(' or ')} configuration file`);
    if (client === 'claude' && path.basename(candidate).toLowerCase() === '.claude.json')
      throw new SetupError(
        'Select the Claude Code settings.json file; ~/.claude.json is managed by Claude Code',
      );
    const filename = await this.canonicalPath(candidate);
    const source = await this.readSource(filename);
    const instructions = await this.options.instructions(client);
    let edit;
    try {
      edit = editMcpConfiguration(client, source.content, instructions.configuration);
    } catch (error) {
      throw new SetupError((error as Error).message);
    }
    const changed = edit.content !== source.content;
    const backupPath =
      changed && source.exists ? filename + '.ncf-backup-' + randomUUID() : undefined;
    const planId = randomUUID();
    const expires = this.now() + lifetime;
    const preview: McpSetupPreview = {
      client,
      planId,
      expiresAt: new Date(expires).toISOString(),
      requiresReplacement: edit.requiresReplacement,
      files: [
        {
          id: 'configuration',
          path: filename,
          backupPath,
          action: !changed ? 'unchanged' : source.exists ? 'update' : 'create',
          changes: edit.changes,
        },
      ],
    };
    if (this.plans.size >= 30)
      throw new SetupError('Too many setup previews are open; close an earlier dialog');
    this.plans.set(planId, {
      owner,
      client,
      expires,
      configurationHash: digest(instructions.configuration),
      preview,
      files: [{ path: filename, backupPath, source, content: edit.content }],
      applying: false,
    });
    return preview;
  }

  discard(owner: string, planId: string): void {
    const plan = this.plans.get(planId);
    if (plan?.owner === owner && !plan.applying) this.plans.delete(planId);
  }

  async apply(
    owner: string,
    planId: string,
    confirmReplace: boolean,
  ): Promise<McpSetupApplyResult> {
    this.prune();
    const plan = this.plans.get(planId);
    if (!plan || plan.owner !== owner)
      throw new SetupError(
        'This setup preview expired or belongs to another window; prepare a new preview',
      );
    if (plan.result) return plan.result;
    if (this.writing || plan.applying)
      throw new SetupError('A configuration update is already in progress');
    if (plan.preview.requiresReplacement && !confirmReplace)
      throw new SetupError('Confirm replacement of the existing NCF server entry');
    this.writing = true;
    plan.applying = true;
    const result: McpSetupApplyResult = { status: 'applied', files: [] };
    const written: PreparedFile[] = [];
    try {
      const instructions = await this.options.instructions(plan.client);
      if (digest(instructions.configuration) !== plan.configurationHash)
        throw new SetupError('The NCF connection settings changed; prepare a new preview');
      for (const file of plan.files) await this.assertCurrent(file);
      for (const file of plan.files) {
        if (file.content === file.source.content) {
          result.files.push({ path: file.path, status: 'unchanged' });
          continue;
        }
        await mkdir(path.dirname(file.path), { recursive: true, mode: 0o700 });
        await this.assertCurrent(file);
        if (file.backupPath) {
          await this.writeExclusive(file.backupPath, file.source.content, 0o600);
          file.backupWritten = true;
        }
        await this.replace(file, file.content, file.source);
        written.push(file);
        result.files.push({
          path: file.path,
          status: file.source.exists ? 'updated' : 'created',
          backupPath: file.backupPath,
        });
      }
      if (result.files.every((file) => file.status === 'unchanged')) result.status = 'unchanged';
      try {
        await this.paths.remember(plan.client, plan.files[0].path);
      } catch {
        result.warning = 'Settings are applied, but the configuration file path could not be saved';
      }
    } catch (error) {
      result.status = 'failed';
      result.error = safeError(error);
      for (const file of written.reverse()) {
        const item = result.files.find((item) => item.path === file.path)!;
        try {
          const current = await this.readSource(file.path);
          if (current.content !== file.content)
            throw new SetupError(
              'The file changed after writing; restore it manually from the backup',
            );
          if (file.source.exists) await this.replace(file, file.source.content, current);
          else await unlink(file.path);
          item.status = 'restored';
        } catch (restoreError) {
          item.status = 'failed';
          item.error = safeError(restoreError);
        }
      }
      for (const file of plan.files) {
        if (!result.files.some((item) => item.path === file.path))
          result.files.push({
            path: file.path,
            backupPath: file.backupWritten ? file.backupPath : undefined,
            status: 'failed',
            error: result.error,
          });
      }
    } finally {
      plan.applying = false;
      this.writing = false;
    }
    // An identical retry returns the recorded result, never another filesystem operation.
    plan.result = result;
    for (const file of plan.files) {
      file.content = '';
      file.source.content = '';
    }
    return result;
  }

  private prune(): void {
    for (const [id, plan] of this.plans)
      if (plan.expires <= this.now() && !plan.applying) this.plans.delete(id);
  }

  private async canonicalPath(filename: string): Promise<string> {
    const suffix = [path.basename(filename)];
    let directory = path.dirname(filename);
    for (;;) {
      try {
        const resolved = await realpath(directory);
        if (!(await lstat(resolved)).isDirectory())
          throw new SetupError('The parent path is not a directory');
        return path.join(resolved, ...suffix);
      } catch (error) {
        if (errno(error) !== 'ENOENT') throw error;
        const parent = path.dirname(directory);
        if (parent === directory)
          throw new SetupError('The configuration directory is unavailable');
        suffix.unshift(path.basename(directory));
        directory = parent;
      }
    }
  }

  private async readSource(filename: string): Promise<Source> {
    let info;
    try {
      info = await lstat(filename);
    } catch (error) {
      if (errno(error) === 'ENOENT')
        return { exists: false, content: '', stamp: 'missing', mode: 0o600 };
      throw error;
    }
    if (!info.isFile() || info.isSymbolicLink())
      throw new SetupError(
        'Select a regular configuration file; choose the target of a symbolic link directly',
      );
    if (info.nlink > 1)
      throw new SetupError('Hard-linked configuration files cannot be replaced safely');
    if (info.size > maxBytes)
      throw new SetupError('The configuration exceeds the 1 MiB setup limit');
    const flags = constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NOFOLLOW);
    const handle = await open(filename, flags);
    try {
      const opened = await handle.stat();
      if (opened.dev !== info.dev || opened.ino !== info.ino || !opened.isFile())
        throw new SetupError('The configuration changed while reading; prepare a new preview');
      const bytes = await handle.readFile();
      if (bytes.length > maxBytes)
        throw new SetupError('The configuration exceeds the 1 MiB setup limit');
      const content = bytes.toString('utf8');
      if (!Buffer.from(content).equals(bytes) || content.includes('\0'))
        throw new SetupError('The configuration must be a UTF-8 text file');
      const after = await handle.stat();
      if (after.mtimeMs !== info.mtimeMs || after.size !== info.size)
        throw new SetupError('The configuration changed while reading; prepare a new preview');
      return {
        exists: true,
        content,
        stamp: [info.dev, info.ino, info.mode, info.mtimeMs, digest(content)].join(':'),
        mode: info.mode & 0o777,
      };
    } finally {
      await handle.close();
    }
  }

  private async assertCurrent(file: PreparedFile): Promise<void> {
    if ((await this.canonicalPath(file.path)) !== file.path)
      throw new SetupError('The configuration directory changed; prepare a new preview');
    const current = await this.readSource(file.path);
    if (current.stamp !== file.source.stamp)
      throw new SetupError('The configuration changed after preview; prepare a new preview');
    if (file.content !== file.source.content) {
      let parent = path.dirname(file.path);
      for (;;) {
        try {
          await access(parent, constants.W_OK);
          break;
        } catch (error) {
          if (errno(error) !== 'ENOENT') throw error;
          const next = path.dirname(parent);
          if (next === parent) throw error;
          parent = next;
        }
      }
    }
  }

  private async writeExclusive(filename: string, content: string, mode: number): Promise<void> {
    const handle = await open(filename, 'wx', 0o600);
    let complete = false;
    try {
      await handle.writeFile(content, 'utf8');
      await handle.sync();
      await handle.chmod(mode);
      complete = true;
    } finally {
      await handle.close();
      if (!complete) await unlink(filename).catch(() => {});
    }
  }

  private async replace(file: PreparedFile, content: string, expected: Source): Promise<void> {
    const temporary = path.join(
      path.dirname(file.path),
      '.' + path.basename(file.path) + '.ncf-' + randomUUID() + '.tmp',
    );
    try {
      await this.writeExclusive(temporary, content, expected.mode);
      if ((await this.canonicalPath(file.path)) !== file.path)
        throw new SetupError('The configuration directory changed; prepare a new preview');
      const current = await this.readSource(file.path);
      if (current.stamp !== expected.stamp)
        throw new SetupError('The configuration changed after preview; prepare a new preview');
      if (expected.exists) await rename(temporary, file.path);
      else await link(temporary, file.path);
    } finally {
      // Cleanup failure must not turn an already committed rename/link into an uncertain write.
      await unlink(temporary).catch(() => {});
    }
  }
}

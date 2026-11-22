import { constants } from 'node:fs';
import { access, link, lstat, mkdir, open, realpath, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import type { McpInstructions } from '../shared/contracts.js';
import type {
  McpSetupApplyResult,
  McpSetupClient,
  McpSetupDefaults,
  McpSetupPreview,
  McpSetupTarget,
  McpSetupStatus,
  OpenCodeV2SetupTarget,
  OpenCodeV2SetupDefaults,
  OpenCodeV2SetupPreview,
  OpenCodeV2SetupStatus,
  OpenCodeV2SetupApplyResult,
  OpenCodeV2SetupAvailability,
} from '../shared/mcp-setup.js';
import { mcpSetupClients } from '../shared/mcp-setup.js';
import { codexMcpConfigurationMatches, editMcpConfiguration } from './mcp-setup-editors.js';
import { editOpenCodeV2Configuration, openCodeV2ConfigurationHash } from './mcp-setup-editors.js';
import {
  OpenCodeV2Auth,
  openCodeV2TargetSchema,
  type OpenCodeV2AuthDraft,
  type OpenCodeV2PrivateFiles,
} from './opencode-v2-auth.js';
import { McpSetupPaths } from './mcp-setup-paths.js';
import { editCursorPermissions } from './cursor-permissions.js';

const maxBytes = 1024 * 1024;
const lifetime = 10 * 60 * 1000;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const errno = (error: unknown) => (error as NodeJS.ErrnoException).code;
class SetupError extends Error {}
class V2SetupUnavailable extends SetupError {
  constructor(
    readonly reason: Extract<OpenCodeV2SetupAvailability, { state: 'unavailable' }>['reason'],
    message: string,
  ) {
    super(message);
  }
}
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
  id: string;
  path: string;
  backupPath?: string;
  backupWritten?: boolean;
  source: Source;
  content: string;
  changes?: McpSetupPreview['files'][number]['changes'];
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
  /** Trusted backend-only extension; never accepted from IPC parameters. */
  transaction?: {
    major: 2;
    edit: typeof editMcpConfiguration;
    stage: () => Promise<void>;
    commit: () => Promise<void>;
  };
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
    this.paths = new McpSetupPaths(options.stateDirectory, options.transaction?.major);
  }

  private managedFiles(
    instructions: McpInstructions,
  ): { id: string; path: string; content: string }[] {
    return (instructions.managedFiles ?? []).map((file) => {
      if (
        !/^[a-z0-9-]{1,80}$/.test(file.id) ||
        !file.relativePath.length ||
        file.relativePath.some(
          (part) =>
            !part ||
            part === '.' ||
            part === '..' ||
            part.includes('\0') ||
            part.includes('/') ||
            part.includes('\\'),
        )
      )
        throw new SetupError('The managed client integration path is invalid');
      const filename = path.resolve(this.home, ...file.relativePath);
      const root = path.resolve(this.home);
      if (filename === root || !filename.startsWith(root + path.sep))
        throw new SetupError('The managed client integration path is invalid');
      if (Buffer.byteLength(file.content) > maxBytes || file.content.includes('\0'))
        throw new SetupError('The managed client integration file is invalid');
      return { id: file.id, path: filename, content: file.content };
    });
  }

  private instructionHash(instructions: McpInstructions): string {
    return digest(
      JSON.stringify({
        configuration: instructions.configuration,
        managedFiles: instructions.managedFiles ?? [],
      }),
    );
  }

  private cursorPermissionRequired(instructions: McpInstructions): boolean {
    return (instructions.managedFiles ?? []).some((file) => file.id === 'cursor-plugin-manifest');
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
      const managedFiles = this.managedFiles(instructions);
      const edit = (this.options.transaction?.edit ?? editMcpConfiguration)(
        client,
        source.content,
        instructions.configuration,
      );
      let state: McpSetupStatus['state'] =
        edit.content === source.content
          ? 'configured'
          : edit.changes.some((change) => change.action !== 'add')
            ? 'needs-update'
            : 'not-configured';
      const files: McpSetupStatus['files'] = [{ id: 'configuration', path: filename, state }];
      if (client === 'cursor' && this.cursorPermissionRequired(instructions)) {
        const permissionsPath = await this.canonicalPath(
          path.join(this.home, '.cursor', 'permissions.json'),
        );
        const permissions = await this.readSource(permissionsPath);
        let permissionState: McpSetupStatus['state'] = 'unavailable';
        let permissionError: string | undefined;
        if (!permissions.exists) {
          permissionError =
            'Automatic replies are unavailable because Cursor permissions.json does not own the MCP allowlist';
        } else {
          try {
            permissionState = editCursorPermissions(permissions.content).changed
              ? 'not-configured'
              : 'configured';
          } catch (error) {
            permissionError = (error as Error).message;
          }
        }
        files.push({
          id: 'cursor-permissions',
          path: permissionsPath,
          state: permissionState,
          ...(permissionError ? { error: permissionError } : {}),
        });
        if (state === 'configured' && permissionState !== 'configured') state = permissionState;
      }
      for (const managed of managedFiles) {
        const installed = await this.readSource(await this.canonicalPath(managed.path));
        if (!installed.exists && state === 'configured') state = 'not-configured';
        else if (installed.exists && installed.content !== managed.content) state = 'needs-update';
      }
      return { client, remembered, state, files };
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

  /** Check the selected Codex file against this node without preparing or applying a change. */
  async configuredCodexFile(filename: string): Promise<string | null> {
    const resolved = this.resolvePath(filename);
    if (path.basename(resolved) !== 'config.toml') return null;
    const canonical = await this.canonicalPath(resolved);
    const source = await this.readSource(canonical);
    if (!source.exists) return null;
    const instructions = await this.options.instructions('codex');
    return codexMcpConfigurationMatches(source.content, instructions.configuration)
      ? canonical
      : null;
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
      edit = (this.options.transaction?.edit ?? editMcpConfiguration)(
        client,
        source.content,
        instructions.configuration,
      );
    } catch (error) {
      throw new SetupError((error as Error).message);
    }
    const changed = edit.content !== source.content;
    const backupPath =
      changed && source.exists ? filename + '.ncf-backup-' + randomUUID() : undefined;
    const files: PreparedFile[] = [
      { id: 'configuration', path: filename, backupPath, source, content: edit.content },
    ];
    if (client === 'cursor' && this.cursorPermissionRequired(instructions)) {
      const permissionsPath = await this.canonicalPath(
        path.join(this.home, '.cursor', 'permissions.json'),
      );
      const permissionsSource = await this.readSource(permissionsPath);
      if (!permissionsSource.exists)
        throw new SetupError(
          'Cursor setup was not changed. Automatic replies cannot be enabled safely because permissions.json does not own the MCP allowlist.',
        );
      let permissionEdit;
      try {
        permissionEdit = editCursorPermissions(permissionsSource.content);
      } catch (error) {
        throw new SetupError(`Cursor setup was not changed. ${(error as Error).message}.`);
      }
      files.push({
        id: 'cursor-permissions',
        path: permissionsPath,
        backupPath: permissionEdit.changed
          ? permissionsPath + '.ncf-backup-' + randomUUID()
          : undefined,
        source: permissionsSource,
        content: permissionEdit.content,
        changes: [
          {
            scope: 'mcpAllowlist',
            action: permissionEdit.changed ? 'add' : 'unchanged',
          },
        ],
      });
    }
    for (const managed of this.managedFiles(instructions)) {
      const managedPath = await this.canonicalPath(managed.path);
      if (files.some((file) => file.path === managedPath))
        throw new SetupError('The selected configuration conflicts with the managed integration');
      const managedSource = await this.readSource(managedPath);
      const managedChanged = managedSource.content !== managed.content;
      files.push({
        id: managed.id,
        path: managedPath,
        backupPath:
          managedChanged && managedSource.exists
            ? managedPath + '.ncf-backup-' + randomUUID()
            : undefined,
        source: managedSource,
        content: managed.content,
      });
    }
    const planId = randomUUID();
    const expires = this.now() + lifetime;
    const preview: McpSetupPreview = {
      client,
      planId,
      expiresAt: new Date(expires).toISOString(),
      requiresReplacement: edit.requiresReplacement,
      files: files.map((file) => ({
        id: file.id,
        path: file.path,
        backupPath: file.backupPath,
        action:
          file.content === file.source.content
            ? 'unchanged'
            : file.source.exists
              ? 'update'
              : 'create',
        changes:
          file.changes ??
          (file.id === 'configuration'
            ? edit.changes
            : [
                {
                  scope: file.id,
                  action:
                    file.content === file.source.content
                      ? ('unchanged' as const)
                      : file.source.exists
                        ? ('replace' as const)
                        : ('add' as const),
                },
              ]),
      })),
    };
    if (this.plans.size >= 30)
      throw new SetupError('Too many setup previews are open; close an earlier dialog');
    this.plans.set(planId, {
      owner,
      client,
      expires,
      configurationHash: this.instructionHash(instructions),
      preview,
      files,
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
      if (this.instructionHash(instructions) !== plan.configurationHash)
        throw new SetupError('The NCF connection settings changed; prepare a new preview');
      for (const file of plan.files) await this.assertCurrent(file);
      await this.options.transaction?.stage();
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
      await this.options.transaction?.commit();
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

  protected async canonicalPath(filename: string): Promise<string> {
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

  protected async readSource(filename: string): Promise<Source> {
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

interface V2SetupPlan {
  draft: OpenCodeV2AuthDraft;
  asset: string;
  instructions: McpInstructions;
  expires: number;
  result?: OpenCodeV2SetupApplyResult;
}

/** Distinct versioned setup with private provisioning inside the existing Apply transaction. */
export class OpenCodeV2SetupService extends McpSetupService {
  private readonly auth: OpenCodeV2Auth;
  private readonly selections = new Map<string, V2SetupPlan>();
  private readonly select: (plan: V2SetupPlan | undefined) => void;
  private operating = false;
  constructor(
    private readonly v2Options: McpSetupOptions & {
      asset?: () => Promise<string>;
      security?: OpenCodeV2PrivateFiles;
      checkpoint?: (phase: 'protected' | 'assets' | 'before-activate' | 'activated') => void;
    },
  ) {
    let selected: V2SetupPlan | undefined;
    let auth: OpenCodeV2Auth;
    const requireSelection = () => {
      if (!selected) throw new SetupError('The OpenCode v2 preview is unavailable');
      return selected;
    };
    super({
      ...v2Options,
      instructions: () => requireSelection().instructions,
      transaction: {
        major: 2,
        edit: (_client, source, configuration) =>
          editOpenCodeV2Configuration(source, configuration),
        stage: async () => {
          const plan = requireSelection();
          await auth.stage(plan.draft, plan.asset);
        },
        commit: async () => {
          const plan = requireSelection();
          await auth.activate(
            plan.draft,
            plan.asset,
            openCodeV2ConfigurationHash(plan.instructions.configuration),
          );
        },
      },
    });
    this.select = (plan) => {
      selected = plan;
    };
    this.auth = auth = new OpenCodeV2Auth(v2Options.stateDirectory, {
      security: v2Options.security,
      checkpoint: v2Options.checkpoint,
      configurationHash: async (filename) =>
        openCodeV2ConfigurationHash((await this.readSource(filename)).content),
    });
  }
  private async exclusive<T>(work: () => Promise<T>): Promise<T> {
    if (this.operating)
      throw new SetupError('An OpenCode v2 setup operation is already in progress');
    this.operating = true;
    try {
      return await work();
    } finally {
      this.select(undefined);
      this.operating = false;
    }
  }
  async canonicalTarget(raw: OpenCodeV2SetupTarget): Promise<OpenCodeV2SetupTarget> {
    const target = openCodeV2TargetSchema.parse(raw);
    return {
      ...target,
      configurationPath: await this.canonicalPath(this.resolvePath(target.configurationPath)),
      profilePath: await this.canonicalPath(
        path.join(this.resolvePath(target.profilePath), '.ncf-profile-marker'),
      ).then((value) => path.dirname(value)),
    };
  }
  async v2Defaults(): Promise<OpenCodeV2SetupDefaults> {
    const result = await this.defaults('opencode'),
      file = result.files[0];
    const raw: OpenCodeV2SetupTarget = {
      major: 2,
      installationId: null,
      installationPath: null,
      profilePath: path.dirname(file.path),
      configurationPath: file.path,
    };
    try {
      const canonical = await this.canonicalTarget(raw),
        target = (await this.auth.remembered(canonical.configurationPath)) ?? canonical;
      return {
        client: 'opencode-v2',
        target,
        alternatives: file.alternatives,
        setupAvailability: await this.v2Availability(target),
      };
    } catch {
      return {
        client: 'opencode-v2',
        target: raw,
        alternatives: file.alternatives,
        setupAvailability: { state: 'unavailable', reason: 'target-unresolved' },
      };
    }
  }
  private async v2Availability(
    target: OpenCodeV2SetupTarget,
  ): Promise<OpenCodeV2SetupAvailability> {
    try {
      await new McpSetupPaths(this.v2Options.stateDirectory, 2).get('opencode');
      const plan = await this.planFor(target),
        source = await this.readSource(target.configurationPath);
      try {
        editOpenCodeV2Configuration(source.content, plan.instructions.configuration);
      } catch (error) {
        throw new V2SetupUnavailable(
          (error as Error).message.includes('legacy v1') ? 'v1-collision' : 'target-unresolved',
          'The selected OpenCode configuration is unavailable',
        );
      }
      let parent = path.dirname(target.configurationPath);
      for (;;) {
        try {
          await access(parent, constants.W_OK);
          break;
        } catch (error) {
          if (errno(error) !== 'ENOENT')
            throw new V2SetupUnavailable(
              'target-unresolved',
              'The configuration directory is not writable',
            );
          const next = path.dirname(parent);
          if (next === parent) throw error;
          parent = next;
        }
      }
      return { state: 'available' };
    } catch (error) {
      return {
        state: 'unavailable',
        reason: error instanceof V2SetupUnavailable ? error.reason : 'private-state-unavailable',
      };
    }
  }
  private async planFor(target: OpenCodeV2SetupTarget): Promise<V2SetupPlan> {
    const legacy = await new McpSetupPaths(this.v2Options.stateDirectory).get('opencode');
    let collision = false;
    if (legacy) {
      const filename = await this.canonicalPath(this.resolvePath(legacy));
      collision = filename === target.configurationPath;
      if (!collision) {
        try {
          const [retained, selected] = await Promise.all([
            lstat(filename, { bigint: true }),
            lstat(target.configurationPath, { bigint: true }),
          ]);
          collision =
            retained.isFile() &&
            selected.isFile() &&
            retained.dev === selected.dev &&
            retained.ino === selected.ino;
        } catch (error) {
          if (errno(error) !== 'ENOENT') throw error;
        }
      }
    }
    if (collision)
      throw new V2SetupUnavailable(
        'v1-collision',
        'The selected configuration is retained by OpenCode v1; select its separate v2 configuration',
      );
    if (!(await this.auth.provisioningAvailable()))
      throw new V2SetupUnavailable(
        'secure-provision-unavailable',
        'The OpenCode v2 private-file protection is unavailable',
      );
    let descriptor: { url: string }, settings: { nodeId: string };
    try {
      descriptor = JSON.parse(
        await readFile(
          path.join(this.v2Options.stateDirectory, 'Integrations', 'node.json'),
          'utf8',
        ),
      ) as { url: string };
      settings = JSON.parse(
        await readFile(path.join(this.v2Options.stateDirectory, 'settings.json'), 'utf8'),
      ) as { nodeId: string };
    } catch {
      throw new V2SetupUnavailable(
        'node-unavailable',
        'Start NCF Agent Interconnect before setting up OpenCode v2',
      );
    }
    const nodeUrl = new URL(descriptor.url);
    if (
      nodeUrl.protocol !== 'http:' ||
      nodeUrl.hostname !== '127.0.0.1' ||
      nodeUrl.pathname !== '/mcp' ||
      nodeUrl.username ||
      nodeUrl.password ||
      nodeUrl.search ||
      nodeUrl.hash
    )
      throw new V2SetupUnavailable(
        'node-unavailable',
        'Start NCF Agent Interconnect before setting up OpenCode v2',
      );
    let asset: string;
    try {
      asset = await (this.v2Options.asset?.() ??
        readFile(new URL('../integrations/opencode-v2.js', import.meta.url), 'utf8'));
    } catch {
      throw new V2SetupUnavailable(
        'asset-unavailable',
        'The installed OpenCode v2 plugin asset is unavailable',
      );
    }
    let draft = await this.auth.prepare(target, settings.nodeId, nodeUrl.origin);
    if (draft.existing && draft.existing.assetHash !== digest(asset))
      draft = await this.auth.prepare(target, settings.nodeId, nodeUrl.origin, true);
    const { provision } = draft;
    const configuration = JSON.stringify({
      plugins: [
        {
          package: pathToFileURL(draft.generationDirectory).href,
          options: { targetId: provision.targetId, generation: provision.generation },
        },
      ],
      mcp: {
        servers: {
          ncf_agent_interconnect: {
            type: 'remote',
            url:
              nodeUrl.origin +
              '/integrations/opencode-v2/' +
              provision.targetId +
              '/' +
              provision.generation +
              '/mcp',
            headers: { Authorization: 'Bearer ' + provision.credential },
            oauth: false,
            disabled: false,
          },
        },
      },
    });
    return {
      draft,
      asset,
      expires: Date.now() + lifetime,
      instructions: {
        client: 'opencode-v2',
        location: target.configurationPath,
        text: 'Apply the OpenCode v2 integration to the selected configuration, then restart OpenCode. Connect using a name you choose. Configuration and native automatic delivery are verified separately.',
        configuration,
        testPrompt: 'Connect as agent <a name you choose>.',
      },
    };
  }
  async v2Preview(owner: string, raw: OpenCodeV2SetupTarget): Promise<OpenCodeV2SetupPreview> {
    return this.exclusive(async () => {
      for (const [id, plan] of this.selections)
        if (plan.expires <= Date.now()) this.selections.delete(id);
      const target = await this.canonicalTarget(raw),
        plan = await this.planFor(target);
      this.select(plan);
      const preview = await this.preview(owner, 'opencode', [
        { id: 'configuration', path: target.configurationPath },
      ]);
      this.selections.set(preview.planId, plan);
      return { ...preview, client: 'opencode-v2', target, targetId: plan.draft.provision.targetId };
    });
  }
  async v2Apply(
    owner: string,
    planId: string,
    raw: OpenCodeV2SetupTarget,
    confirmReplace: boolean,
  ): Promise<OpenCodeV2SetupApplyResult> {
    return this.exclusive(async () => {
      const plan = this.selections.get(planId);
      if (!plan || plan.expires <= Date.now())
        throw new SetupError('The OpenCode v2 preview expired; prepare a new preview');
      const target = await this.canonicalTarget(raw);
      if (JSON.stringify(target) !== JSON.stringify(plan.draft.target))
        throw new SetupError('The selected OpenCode v2 target changed; prepare a new preview');
      if (plan.result) return plan.result;
      this.select(plan);
      const result = await this.apply(owner, planId, confirmReplace);
      plan.result = { ...result, target, targetId: plan.draft.provision.targetId };
      return plan.result;
    });
  }
  v2Discard(owner: string, planId: string): void {
    this.discard(owner, planId);
    this.selections.delete(planId);
  }
  async v2Status(raw?: OpenCodeV2SetupTarget): Promise<OpenCodeV2SetupStatus> {
    let target: OpenCodeV2SetupTarget;
    try {
      target = raw ? await this.canonicalTarget(raw) : (await this.v2Defaults()).target;
    } catch {
      if (!raw) throw new SetupError('The OpenCode v2 target is unavailable');
      target = openCodeV2TargetSchema.parse(raw);
      return {
        client: 'opencode-v2',
        target,
        state: 'unavailable',
        remembered: false,
        setupAvailability: { state: 'unavailable', reason: 'target-unresolved' },
        files: [{ id: 'configuration', path: target.configurationPath, state: 'unavailable' }],
      };
    }
    const setupAvailability = await this.v2Availability(target);
    return this.exclusive(async () => {
      try {
        const source = await this.readSource(target.configurationPath);
        if (!source.exists)
          return {
            client: 'opencode-v2',
            target,
            setupAvailability,
            remembered: false,
            state: 'missing',
            files: [{ id: 'configuration', path: target.configurationPath, state: 'missing' }],
          };
        const row = await this.auth.current(target);
        if (!row)
          return {
            client: 'opencode-v2',
            target,
            setupAvailability,
            remembered: false,
            state: 'not-configured',
            files: [
              { id: 'configuration', path: target.configurationPath, state: 'not-configured' },
            ],
          };
        return {
          client: 'opencode-v2',
          target,
          setupAvailability,
          targetId: row.targetId,
          remembered: true,
          state: 'configured',
          files: [{ id: 'configuration', path: target.configurationPath, state: 'configured' }],
        };
      } catch {
        return {
          client: 'opencode-v2',
          target,
          setupAvailability,
          remembered: false,
          state: 'unavailable',
          files: [
            {
              id: 'configuration',
              path: target.configurationPath,
              state: 'unavailable',
              error:
                'The OpenCode v2 target could not be verified; review its configuration and prepare a new preview',
            },
          ],
        };
      }
    });
  }
  async v2Openable(raw: OpenCodeV2SetupTarget): Promise<string> {
    const target = await this.canonicalTarget(raw);
    if (!(await this.readSource(target.configurationPath)).exists)
      throw new SetupError('The configuration file does not exist');
    return target.configurationPath;
  }
}

import os from 'node:os';
import path from 'node:path';
import { mcpSetupClients, type McpSetupClient } from '../shared/mcp-setup.js';
import type {
  ApplicationInstallation,
  DiscoveryCoverage,
  DiscoveryPlatform,
  InstallationInstance,
} from '../shared/application-discovery.js';
import { discoveryCatalog, matchesDesktopMetadata } from './application-discovery-catalog.js';
import {
  asarManifest,
  DiscoveryError,
  errorReason,
  manifest,
  peIdentity,
  NativeDiscoveryFiles,
  type DiscoveryFiles,
} from './application-discovery-platforms.js';

export interface DiscoveryOptions {
  platform?: NodeJS.Platform;
  home?: string;
  env?: NodeJS.ProcessEnv;
  files?: DiscoveryFiles;
  now?: () => number;
}

export interface DiscoveryScan {
  platform: DiscoveryPlatform | 'unsupported';
  checkedAt: string;
  applications: ApplicationInstallation[];
}

/** Parses a desktop entry as data. It never evaluates shell syntax or field codes. */
export function desktopExecutable(text: string): string | undefined {
  const group = text
    .split(/\r?\n\[Desktop Entry\]\r?\n|^\[Desktop Entry\]\r?\n/)[1]
    ?.split(/\r?\n\[/)[0];
  if (!group) throw new DiscoveryError('invalid-metadata');
  const values = new Map(
    group
      .split(/\r?\n/)
      .filter((line) => !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)] as const;
      }),
  );
  if (values.get('Hidden') === 'true') return undefined;
  if (values.get('Type') !== 'Application') throw new DiscoveryError('invalid-metadata');
  const command = values.get('TryExec') ?? values.get('Exec');
  if (!command || /[\r\n\0]/.test(command)) throw new DiscoveryError('invalid-metadata');
  const match = command.match(/^(?:"((?:[^"\\]|\\["\\`$])+)"|([^\s"\\]+))(?:\s|$)/);
  const executable = match?.[1]?.replace(/\\(["\\`$])/g, '$1') ?? match?.[2];
  if (
    !executable ||
    executable.includes('%') ||
    ['env', 'sh', 'bash', 'flatpak', 'snap'].includes(executable)
  )
    throw new DiscoveryError('unsupported-package-format');
  return executable;
}

export class ApplicationDiscovery {
  private readonly platform;
  private readonly paths;
  private readonly home;
  private readonly env;
  private readonly files;
  private readonly now;
  private readonly custom = new Map<McpSetupClient, string>();
  constructor(options: DiscoveryOptions = {}) {
    this.platform = options.platform ?? process.platform;
    this.paths = this.platform === 'win32' ? path.win32 : path.posix;
    this.home = options.home ?? os.homedir();
    this.env = options.env ?? process.env;
    this.files = options.files ?? new NativeDiscoveryFiles(this.platform);
    this.now = options.now ?? Date.now;
  }

  choose(client: McpSetupClient, filename: string): void {
    if (!this.paths.isAbsolute(filename) || filename.length > 8192 || /[\0\r\n]/.test(filename))
      throw new Error('Select an absolute application installation path');
    this.custom.set(client, filename);
  }

  async scan(): Promise<DiscoveryScan> {
    const platform = ['darwin', 'win32', 'linux'].includes(this.platform)
      ? (this.platform as DiscoveryPlatform)
      : 'unsupported';
    return {
      platform,
      checkedAt: new Date(this.now()).toISOString(),
      applications: await Promise.all(mcpSetupClients.map((client) => this.detect(client))),
    };
  }

  private pathDirectories(): string[] {
    const inherited = (this.env.PATH ?? this.env.Path ?? '')
      .split(this.platform === 'win32' ? ';' : ':')
      .filter((entry) => this.paths.isAbsolute(entry) && !entry.startsWith('\\\\'));
    const defaults =
      this.platform === 'darwin'
        ? ['/opt/homebrew/bin', '/usr/local/bin']
        : this.platform === 'win32' && this.env.APPDATA
          ? [this.paths.join(this.env.APPDATA, 'npm')]
          : [];
    return [...new Set([...inherited, ...defaults])].slice(0, 64);
  }

  private async detect(client: McpSetupClient): Promise<ApplicationInstallation> {
    const descriptor = discoveryCatalog[client],
      instances: InstallationInstance[] = [],
      coverage: DiscoveryCoverage[] = [];
    const visited = new Set<string>();
    const deadline = this.now() + 12000;
    if (
      (this.env.PATH ?? this.env.Path ?? '').split(this.platform === 'win32' ? ';' : ':').length >
      64
    )
      coverage.push({
        source: 'Inherited PATH locations',
        state: 'partial',
        reason: 'limit-exceeded',
      });
    if (this.platform === 'linux' && (this.env.XDG_DATA_DIRS ?? '').split(':').length > 15)
      coverage.push({
        source: 'XDG application directories',
        state: 'partial',
        reason: 'limit-exceeded',
      });
    const probe = async (
      source: string,
      check: () => Promise<InstallationInstance | undefined>,
    ) => {
      const item: DiscoveryCoverage = { source, state: 'checked' };
      coverage.push(item);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        if (this.now() > deadline) throw new DiscoveryError('limit-exceeded');
        const instance = await Promise.race([
          check(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new DiscoveryError('limit-exceeded')),
              Math.max(1, deadline - this.now()),
            );
          }),
        ]);
        if (instance) {
          const key =
            this.platform === 'win32' ? instance.path.toLocaleLowerCase('en-US') : instance.path;
          if (!visited.has(key)) {
            visited.add(key);
            instances.push(instance);
          }
        }
      } catch (error) {
        item.state = 'partial';
        item.reason = errorReason(error);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    if (this.platform === 'darwin') {
      for (const directory of ['/Applications', this.paths.join(this.home, 'Applications')])
        for (const bundle of descriptor.bundles)
          await probe(this.paths.join(directory, bundle.name), () =>
            this.bundle(client, this.paths.join(directory, bundle.name)),
          );
    } else if (this.platform === 'win32') {
      if (!this.env.LOCALAPPDATA || !this.env.ProgramFiles)
        coverage.push({
          source: 'Windows installation roots',
          state: 'partial',
          reason: 'source-unavailable',
        });
      for (const directory of [
        ...new Set(
          [
            this.env.LOCALAPPDATA && this.paths.join(this.env.LOCALAPPDATA, 'Programs'),
            this.env.LOCALAPPDATA,
            this.env.ProgramFiles,
            this.env['ProgramFiles(x86)'],
          ].filter((value): value is string => !!value && this.paths.isAbsolute(value)),
        ),
      ])
        for (const install of descriptor.windows)
          await probe(this.paths.join(directory, install.directory), () =>
            this.desktop(client, this.paths.join(directory, install.directory), install.executable),
          );
      if (client === 'codex')
        await probe('Windows package: OpenAI.Codex', async () => {
          if (!this.files.windowsCodex) throw new DiscoveryError('source-unavailable');
          const found = await this.files.windowsCodex();
          for (const item of found) {
            if (
              !this.paths.isAbsolute(item.root) ||
              !item.executable.startsWith(item.root + this.paths.sep)
            )
              throw new DiscoveryError('invalid-metadata');
          }
          return found[0]
            ? { path: found[0].root, form: 'desktop', evidence: 'package-metadata' }
            : undefined;
        });
    } else if (this.platform === 'linux') {
      for (const install of descriptor.linux)
        await probe(install.directory, () =>
          this.desktop(client, install.directory, install.executable),
        );
      const roots = [
        ...new Set([
          this.env.XDG_DATA_HOME && this.paths.isAbsolute(this.env.XDG_DATA_HOME)
            ? this.env.XDG_DATA_HOME
            : this.paths.join(this.home, '.local/share'),
          ...(this.env.XDG_DATA_DIRS || '/usr/local/share:/usr/share')
            .split(':')
            .filter((value) => this.paths.isAbsolute(value)),
        ]),
      ].slice(0, 16);
      for (const entry of descriptor.desktopEntries) {
        // User desktop entries override the same ID in system directories.
        for (const root of roots) {
          const filename = this.paths.join(root, 'applications', entry);
          let exists = false;
          await probe(filename, async () => {
            const canonical = await this.files.canonical(filename);
            if (!canonical) return undefined;
            exists = true;
            if (!canonical.startsWith(this.paths.join(root, 'applications') + this.paths.sep))
              throw new DiscoveryError('unverified-identity');
            const text = await this.files.bytes(canonical, 65537);
            if (text.length > 65536) throw new DiscoveryError('limit-exceeded');
            const executable = desktopExecutable(text.toString('utf8'));
            return executable ? this.located(client, executable) : undefined;
          });
          if (exists) break;
        }
      }
    } else {
      coverage.push({ source: 'platform', state: 'partial', reason: 'source-unavailable' });
    }

    for (const command of descriptor.commands) {
      for (const directory of this.pathDirectories()) {
        for (const name of descriptor.npmNames) {
          for (const root of [
            this.paths.join(directory, 'node_modules', name),
            this.paths.join(directory, '../lib/node_modules', name),
          ])
            await probe(root, () => this.npm(client, root));
        }
        for (const extension of this.platform === 'win32' ? ['.exe', '.cmd'] : ['']) {
          const filename = this.paths.join(directory, command + extension);
          await probe(filename, () => this.located(client, filename));
        }
      }
    }
    if (client === 'claude') {
      const filename = this.paths.join(
        this.home,
        '.local',
        'bin',
        this.platform === 'win32' ? 'claude.exe' : 'claude',
      );
      await probe(filename, () => this.cli(client, filename, true));
    }
    if (client === 'opencode' && this.platform !== 'win32') {
      const filename = this.paths.join(this.home, '.opencode/bin/opencode');
      await probe(filename, () => this.cli(client, filename, true));
    }
    const custom = this.custom.get(client);
    if (custom) await probe(custom, () => this.located(client, custom));
    return {
      client,
      instances,
      coverage,
      status: instances.length
        ? 'detected'
        : coverage.some((source) => source.state === 'partial')
          ? 'unknown'
          : 'not-found-in-known-locations',
    };
  }

  private async bundle(
    client: McpSetupClient,
    filename: string,
  ): Promise<InstallationInstance | undefined> {
    const root = await this.files.canonical(filename);
    if (!root) return undefined;
    const infoPath = this.paths.join(root, 'Contents/Info.plist');
    const info = await this.files.canonical(infoPath);
    if (!info || !info.startsWith(root + this.paths.sep))
      throw new DiscoveryError('invalid-metadata');
    const metadata = await this.files.plist(info);
    if (
      !discoveryCatalog[client].bundles.some((bundle) => bundle.id === metadata.CFBundleIdentifier)
    )
      throw new DiscoveryError('unverified-identity');
    const executable = metadata.CFBundleExecutable;
    if (typeof executable !== 'string' || !executable || /[\\/\0]/.test(executable))
      throw new DiscoveryError('invalid-metadata');
    const runtime = await this.files.canonical(this.paths.join(root, 'Contents/MacOS', executable));
    if (
      !runtime ||
      !runtime.startsWith(root + this.paths.sep) ||
      !(await this.files.executable(runtime))
    )
      throw new DiscoveryError('missing-runtime');
    return { path: root, form: 'desktop', evidence: 'bundle' };
  }

  private async desktop(
    client: McpSetupClient,
    filename: string,
    executable?: string,
  ): Promise<InstallationInstance | undefined> {
    const root = await this.files.canonical(filename);
    if (!root) return undefined;
    if (/\.appimage$/i.test(root)) throw new DiscoveryError('unsupported-package-format');
    const runtime = executable
      ? await this.files.canonical(this.paths.join(root, executable))
      : root;
    if (!runtime || !(await this.files.executable(runtime)))
      throw new DiscoveryError('missing-runtime');
    const installation = executable ? root : this.paths.dirname(runtime);
    const product = await manifest(this.files, installation, 'resources/app/product.json');
    const metadata =
      product ??
      (await manifest(this.files, installation, 'resources/app/package.json')) ??
      (await asarManifest(this.files, installation));
    if (!metadata || !matchesDesktopMetadata(client, metadata)) {
      if (this.platform === 'win32' && executable) {
        const identity = await peIdentity(this.files, runtime);
        const expected = {
          cursor: [/^Cursor$/, /Anysphere/i],
          opencode: [/^OpenCode$/, /OpenCode|Anomaly|SST/i],
          codex: [/^(Codex|ChatGPT)$/, /OpenAI/i],
          aionui: [/^AionUi$/, /AionUi/i],
          claude: [/^Claude$/, /Anthropic/i],
        }[client];
        if (identity && expected[0].test(identity.product) && expected[1].test(identity.publisher))
          return { path: installation, form: 'desktop', evidence: 'product-metadata' };
      }
      if (this.platform === 'linux' && client === 'opencode') {
        const identity = await this.files.packageIdentity('opencode', runtime);
        if (identity && /OpenCode|Anomaly|SST/i.test(identity.publisher))
          return { path: installation, form: 'desktop', evidence: 'package-metadata' };
      }
      throw new DiscoveryError('unverified-identity');
    }
    return { path: installation, form: 'desktop', evidence: 'product-metadata' };
  }

  private async located(
    client: McpSetupClient,
    filename: string,
  ): Promise<InstallationInstance | undefined> {
    if (!this.paths.isAbsolute(filename)) {
      for (const directory of this.pathDirectories()) {
        const candidate = this.paths.join(directory, filename);
        if (await this.files.canonical(candidate)) return this.located(client, candidate);
      }
      throw new DiscoveryError('missing-runtime');
    }
    const canonical = await this.files.canonical(filename);
    if (!canonical) return undefined;
    if (/\.appimage$/i.test(canonical)) throw new DiscoveryError('unsupported-package-format');
    if (this.platform === 'darwin') {
      const bundle = canonical.match(/^(.*\.app)(?:\/|$)/)?.[1];
      if (bundle) return this.bundle(client, bundle);
    }
    if (discoveryCatalog[client].npmNames.length) {
      const cli = await this.cli(client, canonical, false);
      if (cli) return cli;
    }
    // Standard desktop shell launchers point into <install>/bin, not a CLI agent.
    if (this.paths.basename(this.paths.dirname(canonical)) === 'bin') {
      const root = this.paths.dirname(this.paths.dirname(canonical));
      const variants =
        this.platform === 'win32'
          ? discoveryCatalog[client].windows
          : discoveryCatalog[client].linux;
      for (const entry of variants) {
        if (await this.files.canonical(this.paths.join(root, entry.executable)))
          return this.desktop(client, root, entry.executable);
      }
    }
    return this.desktop(client, canonical);
  }

  private async cli(
    client: McpSetupClient,
    filename: string,
    nativeLayout: boolean,
  ): Promise<InstallationInstance | undefined> {
    const canonical = await this.files.canonical(filename);
    if (!canonical) return undefined;
    const nativeRoot =
      client === 'claude'
        ? this.paths.join(this.home, '.local/share/claude/versions')
        : this.paths.join(this.home, '.opencode/bin');
    const homebrewLayout =
      this.platform === 'darwin' &&
      (client === 'claude'
        ? /^\/(opt\/homebrew|usr\/local)\/Caskroom\/claude-code\/[^/]+\/claude$/.test(canonical)
        : /^\/(opt\/homebrew|usr\/local)\/Cellar\/opencode(?:-v2)?\/[^/]+\/bin\/opencode$/.test(
            canonical,
          ));
    if (
      (nativeLayout || canonical.startsWith(nativeRoot + this.paths.sep) || homebrewLayout) &&
      (await this.files.executable(canonical))
    ) {
      // A documented native installation layout corroborates the command name.
      if (canonical.startsWith(nativeRoot + this.paths.sep) || homebrewLayout)
        return { path: canonical, form: 'cli', evidence: 'native-install-layout' };
      if (client === 'claude' && this.platform === 'win32') {
        const identity = await peIdentity(this.files, canonical);
        if (identity && /Claude/.test(identity.product) && /Anthropic/.test(identity.publisher))
          return { path: canonical, form: 'cli', evidence: 'product-metadata' };
      }
    }
    let root = this.paths.dirname(canonical);
    for (let depth = 0; depth < 6; depth++, root = this.paths.dirname(root)) {
      if (
        discoveryCatalog[client].npmNames.some((name) =>
          root.endsWith(this.paths.sep + name.split('/').join(this.paths.sep)),
        )
      ) {
        const metadata = await manifest(this.files, root, 'package.json');
        if (
          metadata &&
          discoveryCatalog[client].npmNames.includes(String(metadata.name)) &&
          metadata.bin &&
          (await this.files.bytes(canonical, 2)).toString() === '#!'
        )
          return { path: root, form: 'cli', evidence: 'package-metadata' };
      }
    }
    if (nativeLayout) throw new DiscoveryError('unverified-identity');
    return undefined;
  }

  private async npm(
    client: McpSetupClient,
    directory: string,
  ): Promise<InstallationInstance | undefined> {
    const root = await this.files.canonical(directory);
    if (!root) return undefined;
    const metadata = await manifest(this.files, root, 'package.json');
    if (!metadata || !discoveryCatalog[client].npmNames.includes(String(metadata.name)))
      throw new DiscoveryError('unverified-identity');
    const command = discoveryCatalog[client].commands[0];
    const bin =
      typeof metadata.bin === 'string'
        ? metadata.bin
        : metadata.bin && typeof metadata.bin === 'object'
          ? (metadata.bin as Record<string, unknown>)[command]
          : undefined;
    if (typeof bin !== 'string' || this.paths.isAbsolute(bin))
      throw new DiscoveryError('invalid-metadata');
    const target = await this.files.canonical(this.paths.resolve(root, bin));
    if (!target || !target.startsWith(root + this.paths.sep))
      throw new DiscoveryError('missing-runtime');
    const header = await this.files.bytes(target, 2);
    if (header.toString() !== '#!' && !(await this.files.executable(target)))
      throw new DiscoveryError('missing-runtime');
    return { path: root, form: 'cli', evidence: 'package-metadata' };
  }
}

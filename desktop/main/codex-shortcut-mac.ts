import { execFile } from 'node:child_process';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  rmdir,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { codexShortcutDisplayName, type CodexShortcutResult } from '../shared/codex-shortcut.js';
import type { WakeCodexChat } from '../core/codex-queue.js';
import { codexQueueHome } from '../core/codex-queue.js';
import { discoveryCatalog } from '../core/application-discovery-catalog.js';

const execute = promisify(execFile);
const cliLocation = 'Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';
const shellWord = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";

function macCliWrapper(
  runtime: string,
  bridge: string,
  profile: string,
  { cli, desktopExecutable }: MacCodexInstall,
) {
  return [
    '#!/bin/sh',
    'set -eu',
    'resources=$(CDPATH="" cd -- "$(dirname -- "$0")" && pwd -P)',
    // Codex tools may invoke the shim with a scrubbed environment.
    'export NCF_CODEX_SHORTCUT_CLI=' + shellWord(cli),
    'export NCF_CODEX_SHORTCUT_PROFILE=' + shellWord(profile),
    'export NCF_CODEX_SHORTCUT_DESKTOP=' + shellWord(desktopExecutable),
    'export NCF_CODEX_SHORTCUT_NATIVE="$resources/../MacOS/CodexNCF"',
    'exec /usr/bin/env -u NODE_OPTIONS -u NODE_PATH ELECTRON_RUN_AS_NODE=1 ' +
      shellWord(runtime) +
      ' ' +
      shellWord(bridge) +
      ' "$@"',
    '',
  ].join('\n');
}

export interface MacCodexInstall {
  desktop: string;
  desktopExecutable: string;
  cli: string;
}

export async function findMacCodex(): Promise<MacCodexInstall | null | undefined> {
  const installs: MacCodexInstall[] = [];
  for (const { name, id } of discoveryCatalog.codex.bundles) {
    const desktop = path.join('/Applications', name);
    const cli = path.join(desktop, cliLocation);
    try {
      if ((await realpath(desktop)) !== desktop || (await realpath(cli)) !== cli) continue;
      const info = await lstat(cli);
      if (
        !info.isFile() ||
        !(info.mode & 0o111) ||
        info.mode & 0o022 ||
        ![0, process.getuid!()].includes(info.uid)
      )
        continue;
      const { stdout } = await execute(
        '/usr/libexec/PlistBuddy',
        ['-c', 'Print :CFBundleIdentifier', path.join(desktop, 'Contents/Info.plist')],
        { timeout: 3000 },
      );
      if (stdout.trim() !== id) continue;
      const executable = await execute(
        '/usr/libexec/PlistBuddy',
        ['-c', 'Print :CFBundleExecutable', path.join(desktop, 'Contents/Info.plist')],
        { timeout: 3000 },
      );
      const name = executable.stdout.trim();
      if (!/^[a-zA-Z0-9._ -]+$/.test(name) || name === '.' || name === '..') continue;
      const desktopExecutable = path.join(desktop, 'Contents/MacOS', name);
      const executableInfo = await lstat(desktopExecutable);
      if (
        executableInfo.isFile() &&
        executableInfo.mode & 0o111 &&
        (await realpath(desktopExecutable)) === desktopExecutable
      )
        installs.push({ desktop, desktopExecutable, cli });
    } catch {
      // Each supported installation location is independent.
    }
  }
  if (installs.length > 1) return null;
  return installs[0];
}

const desktopWitnessSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('notRunning') }).strict(),
  z.object({ state: z.literal('unavailable') }).strict(),
  z
    .object({
      state: z.literal('running'),
      profile: z.string().max(4096).refine(path.isAbsolute),
      desktopData: z.string().max(4096).refine(path.isAbsolute),
      process: z.string().regex(/^\d+:\d+:\d+$/),
    })
    .strict(),
]);
export type MacCodexDesktopWitness = z.infer<typeof desktopWitnessSchema>;

/** Use the bundled helper; ordinary execFile also supports the packaged ASAR asset. */
export async function inspectMacCodexDesktop(
  appPath: string,
  desktopExecutable: string,
  stockProfile: string,
  stockData: string,
): Promise<MacCodexDesktopWitness> {
  try {
    const { stdout } = await execute(
      path.join(appPath, 'build/assets/codex-mac-launcher'),
      ['--inspect-desktop', desktopExecutable, stockProfile, stockData],
      { timeout: 3000, maxBuffer: 16384 },
    );
    return desktopWitnessSchema.parse(JSON.parse(stdout));
  } catch {
    return { state: 'unavailable' };
  }
}

export function watchMacChatLaunches(appPath: string, launched: () => void): () => void {
  const helper = execFile(path.join(appPath, 'build/assets/codex-mac-launcher'), [
    '--watch-desktop-launches',
  ]);
  const lines = createInterface({ input: helper.stdout! });
  lines.on('line', (event) => {
    if (event === 'ready' || event === 'launch') launched();
  });
  helper.on('error', () => lines.close());
  return () => {
    lines.close();
    helper.stdin?.end();
  };
}

async function runningMacCodex(appPath: string, home: string, appData: string) {
  const install = await findMacCodex();
  if (!install) return;
  const owner = await inspectMacCodexDesktop(
    appPath,
    install.desktopExecutable,
    path.join(home, '.codex'),
    path.join(appData, 'Codex'),
  );
  if (owner.state === 'running') return { install, profile: owner.profile };
}

export async function runningMacCodexConfiguration(appPath: string, home: string, appData: string) {
  const running = await runningMacCodex(appPath, home, appData);
  return running && path.join(running.profile, 'config.toml');
}

export function macChatWake(appPath: string, home: string, appData: string): WakeCodexChat {
  return async (profile, current) => {
    const threadId = profile.threadId;
    if (!threadId || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(threadId)) return;
    if (!current()) return;
    const target = await codexQueueHome(profile.socket);
    const running = await runningMacCodex(appPath, home, appData);
    if (!running || running.profile !== target || !current())
      throw new Error('The bound ChatGPT profile is not running');
    // Launch Services receives only the verified thread UUID. The message and
    // its receipt stay in the bound profile, even if the app exits during open.
    await execute(
      '/usr/bin/open',
      ['-g', '-a', running.install.desktop, 'codex://threads/' + threadId],
      {
        timeout: 3000,
      },
    );
  };
}

export async function macShortcutDirectory(filename: string): Promise<string> {
  const canonical = await realpath(filename);
  const info = await lstat(canonical);
  if (!info.isDirectory() || info.uid !== process.getuid!() || info.mode & 0o022)
    throw new Error('Invalid Codex profile directory');
  return canonical;
}

export async function isMacCodexShortcut(filename: string): Promise<boolean> {
  try {
    if ((await macShortcutDirectory(filename)) !== filename) return false;
    const info = path.join(filename, 'Contents', 'Info.plist');
    if ((await realpath(info)) !== info) return false;
    const { stdout } = await execute(
      '/usr/libexec/PlistBuddy',
      ['-c', 'Print :CFBundleIdentifier', '-c', 'Print :CFBundleExecutable', info],
      { timeout: 3000, maxBuffer: 4096 },
    );
    const [identifier, executable] = stdout.trim().split('\n');
    if (
      !/^io\.github\.no-colours-fabric\.ncf-agent-interconnect\.codex\.[a-f0-9-]{36}$/.test(
        identifier,
      ) ||
      executable !== 'CodexNCF'
    )
      return false;
    await execute('/usr/bin/codesign', ['--verify', '--strict', filename], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

export async function macCodexDockShortcuts(home: string): Promise<string[]> {
  try {
    const { stdout } = await execute(
      '/usr/bin/plutil',
      [
        '-extract',
        'persistent-apps',
        'json',
        '-o',
        '-',
        path.join(home, 'Library', 'Preferences', 'com.apple.dock.plist'),
      ],
      { timeout: 3000, maxBuffer: 131072 },
    );
    const entries = z
      .array(
        z.object({
          'tile-data': z
            .object({ 'file-data': z.object({ _CFURLString: z.string() }).optional() })
            .optional(),
        }),
      )
      .parse(JSON.parse(stdout));
    return entries.flatMap((entry) => {
      const url = entry['tile-data']?.['file-data']?._CFURLString;
      if (!url?.startsWith('file:')) return [];
      try {
        return [fileURLToPath(url)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

interface MacShortcutOptions extends MacCodexInstall {
  destination: string;
  profile: string;
  desktopData: string;
  appExecutable: string;
  appPath: string;
  alreadyOpen: string;
  launchFailed: string;
}

function launcherIdentity({
  profile,
  desktopData,
  desktop,
  cli,
  appExecutable,
}: MacShortcutOptions) {
  return { profile, desktopData, desktop, cli, runtime: appExecutable };
}

/** Reuse only our signed, matching bundle in the private Dock directory. */
export async function verifyMacCodexShortcut(options: MacShortcutOptions): Promise<boolean> {
  try {
    const resources = path.join(options.destination, 'Contents', 'Resources');
    if ((await macShortcutDirectory(options.destination)) !== options.destination) return false;
    const manifest = path.join(resources, 'launch.json');
    const wrapper = path.join(resources, 'ncf-codex-cli');
    for (const filename of [manifest, wrapper]) {
      const stat = await lstat(filename);
      if (
        !stat.isFile() ||
        stat.nlink !== 1 ||
        stat.size > 32768 ||
        (await realpath(filename)) !== filename
      )
        return false;
    }
    const config: unknown = JSON.parse(await readFile(manifest, 'utf8'));
    if (!config || typeof config !== 'object') return false;
    if (
      !Object.entries(launcherIdentity(options)).every(
        ([key, value]) => (config as Record<string, unknown>)[key] === value,
      )
    )
      return false;
    const bridge = path.join(options.appPath, 'build/integrations/codex-shortcut-bridge.js');
    if (
      (await readFile(wrapper, 'utf8')) !==
      macCliWrapper(options.appExecutable, bridge, options.profile, options)
    )
      return false;
    await execute('/usr/bin/codesign', ['--verify', '--strict', options.destination], {
      timeout: 3000,
    });
    return true;
  } catch {
    return false;
  }
}

export async function createMacCodexShortcut(
  options: MacShortcutOptions,
): Promise<Extract<CodexShortcutResult, 'created' | 'alreadyExists' | 'failed'>> {
  const { destination, profile, appExecutable, appPath } = options;
  const parent = path.dirname(destination);
  const bridge = path.join(appPath, 'build/integrations/codex-shortcut-bridge.js');
  let stage: string | undefined;
  let reserved = false;
  try {
    if (!path.isAbsolute(destination) || path.extname(destination).toLowerCase() !== '.app')
      return 'failed';
    await lstat(bridge);
    const assets = path.join(appPath, 'build/assets');
    stage = await mkdtemp(path.join(parent, '.ncf-codex-shortcut-'));
    const bundle = path.join(stage, codexShortcutDisplayName + '.app');
    const contents = path.join(bundle, 'Contents');
    const resources = path.join(contents, 'Resources');
    const macOS = path.join(contents, 'MacOS');
    await mkdir(macOS, { recursive: true });
    await mkdir(resources);
    await Promise.all([
      writeFile(
        path.join(macOS, 'CodexNCF'),
        await readFile(path.join(assets, 'codex-mac-launcher')),
        { mode: 0o755 },
      ),
      writeFile(
        path.join(resources, 'icon.icns'),
        await readFile(path.join(assets, 'chatgpt-shortcut.icns')),
      ),
      writeFile(
        path.join(resources, 'ncf-codex-cli'),
        macCliWrapper(appExecutable, bridge, profile, options),
        { mode: 0o755 },
      ),
      writeFile(
        path.join(resources, 'launch.json'),
        JSON.stringify({
          ...launcherIdentity(options),
          alreadyOpen: options.alreadyOpen,
          launchFailed: options.launchFailed,
        }),
        { mode: 0o600 },
      ),
      writeFile(path.join(contents, 'Info.plist'), macShortcutPlist(randomUUID())),
    ]);
    await execute('/usr/bin/codesign', ['--force', '--sign', '-', bundle], { timeout: 15000 });
    try {
      await mkdir(destination, { mode: 0o700 });
      reserved = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return 'alreadyExists';
      throw error;
    }
    await rename(contents, path.join(destination, 'Contents'));
    reserved = false;
    return 'created';
  } catch {
    return 'failed';
  } finally {
    if (reserved) await rmdir(destination).catch(() => {});
    if (stage) await rm(stage, { recursive: true, force: true }).catch(() => {});
  }
}

function macShortcutPlist(id: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>io.github.no-colours-fabric.ncf-agent-interconnect.codex.${id}</string>
  <key>CFBundleName</key><string>${codexShortcutDisplayName}</string>
  <key>CFBundleDisplayName</key><string>${codexShortcutDisplayName}</string>
  <key>CFBundleExecutable</key><string>CodexNCF</string>
  <key>CFBundleIconFile</key><string>icon.icns</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSUIElement</key><true/>
</dict></plist>
`;
}

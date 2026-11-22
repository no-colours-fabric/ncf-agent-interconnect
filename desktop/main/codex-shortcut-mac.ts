import { execFile } from 'node:child_process';
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
import type { CodexShortcutResult } from '../shared/codex-shortcut.js';

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

export async function findMacCodex(): Promise<MacCodexInstall | undefined> {
  for (const desktop of ['/Applications/ChatGPT.app', '/Applications/Codex.app']) {
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
      if (stdout.trim() !== 'com.openai.codex') continue;
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
        return { desktop, desktopExecutable, cli };
    } catch {
      // Each supported installation location is independent.
    }
  }
}

export async function macShortcutDirectory(filename: string): Promise<string> {
  const canonical = await realpath(filename);
  const info = await lstat(canonical);
  if (!info.isDirectory() || info.uid !== process.getuid!() || info.mode & 0o022)
    throw new Error('Invalid Codex profile directory');
  return canonical;
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

export async function createMacCodexShortcut(
  options: MacShortcutOptions,
): Promise<Extract<CodexShortcutResult, 'created' | 'alreadyExists' | 'failed'>> {
  const { destination, profile, desktopData, appExecutable, appPath, desktop, cli } = options;
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
    const bundle = path.join(stage, 'Codex with NCF.app');
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
      writeFile(path.join(resources, 'icon.icns'), await readFile(path.join(assets, 'icon.icns'))),
      writeFile(
        path.join(resources, 'ncf-codex-cli'),
        macCliWrapper(appExecutable, bridge, profile, options),
        { mode: 0o755 },
      ),
      writeFile(
        path.join(resources, 'launch.json'),
        JSON.stringify({
          profile,
          desktopData,
          desktop,
          cli,
          runtime: appExecutable,
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
  <key>CFBundleName</key><string>Codex with NCF</string>
  <key>CFBundleExecutable</key><string>CodexNCF</string>
  <key>CFBundleIconFile</key><string>icon.icns</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSUIElement</key><true/>
</dict></plist>
`;
}

import { execFile } from 'node:child_process';
import { opendir, readlink, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { matchesDesktopMetadata } from '../core/application-discovery-catalog.js';
import { windowsChatgptProcesses } from './chatgpt-windows-version.js';
import type { InstallationInstance } from '../shared/application-discovery.js';
import { asarManifest, type DiscoveryFiles } from '../core/application-discovery-platforms.js';
import {
  chatgptCompatibility,
  type ChatgptCompatibility,
  type ChatgptRuntime,
} from '../shared/chatgpt-compatibility.js';

const execute = promisify(execFile);
const limits = { timeout: 4000, maxBuffer: 32768, windowsHide: true } as const;

// Read the chosen installation's bundle without depending on an open desktop.
export const macChatgptVersionQuery = [
  'ObjC.import("Foundation");',
  'function run(argv) {',
  'const bundle = $.NSBundle.bundleWithPath(argv[0]);',
  'if (ObjC.unwrap(bundle.bundleIdentifier) !== "com.openai.codex") throw Error("Unknown bundle");',
  'const slices = ObjC.deepUnwrap(bundle.executableArchitectures);',
  'return JSON.stringify({version: ObjC.unwrap(bundle.objectForInfoDictionaryKey("CFBundleShortVersionString")),',
  '  build: ObjC.unwrap(bundle.objectForInfoDictionaryKey("CFBundleVersion")),',
  '  architecture: slices.length === 1 ? ({"16777228":"arm64","16777223":"x64"})[String(slices[0])] : undefined});',
  '}',
].join('\n');

async function installedMacVersion(installation: string): Promise<ChatgptRuntime> {
  const { stdout } = await execute(
    '/usr/bin/osascript',
    ['-l', 'JavaScript', '-e', macChatgptVersionQuery, installation],
    limits,
  );
  return JSON.parse(stdout);
}

async function runningWindowsVersions(files: DiscoveryFiles): Promise<ChatgptRuntime[]> {
  if (!files.windowsCodex) return [];
  const system = process.env.SystemRoot ?? 'C:\\Windows';
  const packages = await files.windowsCodex();
  // A unique registered installation supplies its version without a running GUI
  // or a process query. Only multiple installations need runtime disambiguation.
  const running: unknown =
    packages.length === 1
      ? []
      : JSON.parse(
          (
            await execute(
              path.win32.join(system, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
              ['-NoProfile', '-NonInteractive', '-Command', windowsChatgptProcesses],
              limits,
            )
          ).stdout,
        );
  if (!Array.isArray(running) || running.length > 128) return [{}];
  const selected = selectWindowsDesktopPackages(packages, running);
  return Promise.all(
    selected.map(async (pkg) => {
      const version = await archiveVersion(files, path.win32.dirname(pkg.executable)).catch(
        () => ({}),
      );
      return { ...version, architecture: pkg.architecture };
    }),
  );
}

export function selectWindowsDesktopPackages<
  T extends { executable: string; packageFullName?: string },
>(packages: readonly T[], running: readonly unknown[]): readonly T[] {
  const matched = packages.filter((item) =>
    running.some((candidate) => sameWindowsDesktop(candidate, item)),
  );
  // CLI and helper processes do not make a unique registered desktop ambiguous.
  return matched.length || packages.length !== 1 ? matched : packages;
}

export function sameWindowsDesktop(
  candidate: unknown,
  install: { executable: string; packageFullName?: string },
): boolean {
  if (!candidate || typeof candidate !== 'object' || !install.packageFullName) return false;
  const { path: image, packageFullName } = candidate as Record<string, unknown>;
  return (
    typeof image === 'string' &&
    typeof packageFullName === 'string' &&
    image.toLowerCase() === install.executable.toLowerCase() &&
    packageFullName.toLowerCase() === install.packageFullName.toLowerCase()
  );
}

async function archiveVersion(files: DiscoveryFiles, root: string): Promise<ChatgptRuntime> {
  const metadata = await asarManifest(files, root);
  if (!metadata || !matchesDesktopMetadata('codex', metadata)) return {};
  return {
    version: typeof metadata.version === 'string' ? metadata.version : undefined,
    build: typeof metadata.codexBuildNumber === 'string' ? metadata.codexBuildNumber : undefined,
  };
}

async function runningLinuxVersions(files: DiscoveryFiles): Promise<ChatgptRuntime[]> {
  const roots = new Set<string>();
  const uid = process.getuid!();
  for await (const entry of await opendir('/proc')) {
    if (!/^\d+$/.test(entry.name)) continue;
    const proc = path.join('/proc', entry.name);
    const executable = await readlink(path.join(proc, 'exe')).catch(() => '');
    if (!/^\/.+\/(?:ChatGPT|chatgpt|Codex|codex)$/.test(executable)) continue;
    if ((await stat(proc).catch(() => undefined))?.uid !== uid) continue;
    roots.add(path.dirname(executable));
  }
  const results: ChatgptRuntime[] = [];
  for (const root of roots) {
    const candidate = await archiveVersion(files, root);
    if (candidate.version) results.push(candidate);
  }
  return results;
}

export async function detectChatgptCompatibility(
  files: DiscoveryFiles,
  platform = process.platform,
  installations: readonly InstallationInstance[] = [],
): Promise<ChatgptCompatibility> {
  let versions: ChatgptRuntime[] = [];
  const desktops = installations.filter((instance) => instance.form === 'desktop');
  const installation = desktops.length === 1 ? desktops[0].path : undefined;
  try {
    if (platform === 'darwin' && installation) versions = [await installedMacVersion(installation)];
    if (platform === 'win32') versions = await runningWindowsVersions(files);
    if (platform === 'linux') {
      versions = await runningLinuxVersions(files);
      if (!versions.length && installation) versions = [await archiveVersion(files, installation)];
    }
  } catch {
    // Unreadable runtime metadata must never block discovery of other applications.
  }
  const first = versions[0];
  const unambiguous =
    first &&
    versions.every(
      (v) =>
        v.version === first.version &&
        v.build === first.build &&
        v.architecture === first.architecture,
    );
  const runtime = unambiguous
    ? first
    : { architecture: platform === 'darwin' ? process.arch : undefined };
  if (
    platform === 'win32' &&
    !runtime.architecture &&
    os.arch() === 'x64' &&
    versions.every((v) => !v.architecture || v.architecture === 'x64')
  )
    return chatgptCompatibility(platform, { ...runtime, architecture: 'x64' });
  return chatgptCompatibility(platform, runtime);
}

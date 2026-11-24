import { execFile } from 'node:child_process';
import { opendir, readlink, stat } from 'node:fs/promises';
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

// NSRunningApplication does not launch ChatGPT or send it Apple events.
const macQuery = [
  'ObjC.import("AppKit");',
  'function run(argv) {',
  'const apps = $.NSRunningApplication.runningApplicationsWithBundleIdentifier("com.openai.codex");',
  'const result = [];',
  'function add(bundle, architecture) {',
  '  if (ObjC.unwrap(bundle.bundleIdentifier) !== "com.openai.codex") throw Error("Unknown bundle");',
  '  result.push({version: ObjC.unwrap(bundle.objectForInfoDictionaryKey("CFBundleShortVersionString")),',
  '    build: ObjC.unwrap(bundle.objectForInfoDictionaryKey("CFBundleVersion")),',
  '    architecture: ({"16777228":"arm64","16777223":"x64"})[String(architecture)]});',
  '}',
  'for (let i = 0; i < apps.count; i++) {',
  '  const app = apps.objectAtIndex(i); add($.NSBundle.bundleWithURL(app.bundleURL), app.executableArchitecture);',
  '}',
  'if (!apps.count && argv.length === 1) {',
  '  const bundle = $.NSBundle.bundleWithPath(argv[0]);',
  '  const slices = ObjC.deepUnwrap(bundle.executableArchitectures);',
  '  add(bundle, slices.length === 1 ? slices[0] : null);',
  '}',
  'return JSON.stringify(result); }',
].join('\n');

async function macVersions(installation?: string): Promise<ChatgptRuntime[]> {
  const { stdout } = await execute(
    '/usr/bin/osascript',
    ['-l', 'JavaScript', '-e', macQuery, ...(installation ? [installation] : [])],
    limits,
  );
  return JSON.parse(stdout);
}

async function runningWindowsVersions(files: DiscoveryFiles): Promise<ChatgptRuntime[]> {
  if (!files.windowsCodex) return [];
  const system = process.env.SystemRoot ?? 'C:\\Windows';
  const [packages, { stdout }] = await Promise.all([
    files.windowsCodex(),
    execute(
      path.win32.join(system, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
      ['-NoProfile', '-NonInteractive', '-Command', windowsChatgptProcesses],
      limits,
    ),
  ]);
  const running: unknown = JSON.parse(stdout);
  if (!Array.isArray(running) || running.length > 128) return [{}];
  if (!running.length && packages.length === 1) {
    const pkg = packages[0];
    return [await archiveVersion(files, path.win32.dirname(pkg.executable), pkg.architecture)];
  }
  const results: ChatgptRuntime[] = [];
  for (const item of packages) {
    if (running.some((p) => sameWindowsDesktop(p, item))) {
      results.push(
        await archiveVersion(files, path.win32.dirname(item.executable), item.architecture),
      );
    }
  }
  return results;
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

async function archiveVersion(
  files: DiscoveryFiles,
  root: string,
  architecture?: string,
): Promise<ChatgptRuntime> {
  const metadata = await asarManifest(files, root);
  if (!metadata || !matchesDesktopMetadata('codex', metadata)) return {};
  return {
    version: typeof metadata.version === 'string' ? metadata.version : undefined,
    build: typeof metadata.codexBuildNumber === 'string' ? metadata.codexBuildNumber : undefined,
    architecture,
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
    if (platform === 'darwin') versions = await macVersions(installation);
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
  return chatgptCompatibility(
    platform,
    unambiguous ? first : { architecture: platform === 'darwin' ? process.arch : undefined },
  );
}

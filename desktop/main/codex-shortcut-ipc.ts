import type { BrowserWindow, OpenDialogOptions, OpenDialogReturnValue } from 'electron';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { codexShortcutLocales, codexShortcutMessages } from '../shared/codex-shortcut-messages.js';
import {
  codexShortcutDestinations,
  codexShortcutDisplayName,
  codexShortcutDestinationsFor,
  type CodexShortcutCreateResult,
  type CodexShortcutDestination,
  type CodexShortcutDestinationResult,
  type CodexShortcutFailure,
  type CodexShortcutPlatform,
} from '../shared/codex-shortcut.js';
import {
  createMacCodexShortcut,
  findMacCodex,
  isMacCodexShortcut,
  macCodexDockShortcuts,
  inspectMacCodexDesktop,
  macShortcutDirectory,
  verifyMacCodexShortcut,
} from './codex-shortcut-mac.js';

import type {
  WindowsCodexShortcutContext,
  WindowsCodexShortcutRequest,
} from './codex-shortcut-windows.js';

const execute = promisify(execFile);
const createInput = z
  .object({
    locale: z.enum(codexShortcutLocales),
    destinations: z.array(z.enum(codexShortcutDestinations)).min(1).max(4),
  })
  .strict()
  .refine(({ destinations }) => new Set(destinations).size === destinations.length);

const cancelled = { state: 'cancelled' } as const;
const failed = (reason: CodexShortcutFailure = 'failed'): CodexShortcutCreateResult => ({
  state: 'failed',
  reason,
});

async function windowsProgramsDirectory(): Promise<string> {
  const executable = path.win32.join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'System32/WindowsPowerShell/v1.0/powershell.exe',
  );
  const { stdout } = await execute(
    executable,
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);' +
        '[Console]::Write([Environment]::GetFolderPath([Environment+SpecialFolder]::Programs))',
    ],
    { windowsHide: true, timeout: 5000, maxBuffer: 8192 },
  );
  if (!path.win32.isAbsolute(stdout) || /[\0\r\n]/.test(stdout))
    throw new Error('The current-user Programs folder is unavailable');
  return stdout;
}

interface CodexShortcutOptions {
  platform: NodeJS.Platform;
  installed: boolean;
  alternateUserData?: boolean;
  userData: string;
  appExecutable: string;
  appPath: string;
  appData: string;
  home: string;
  codexHome?: string;
  desktopDataOverride?: string;
  desktop: string;
  dialog: {
    showOpenDialog: (
      owner: BrowserWindow,
      options: OpenDialogOptions,
    ) => Promise<OpenDialogReturnValue>;
  };
  reveal: (filename: string) => void;
  window: () => BrowserWindow | null;
  configurationPath: () => Promise<string>;
  boundProfiles: () => readonly { socket?: string; codexQueue?: boolean }[];
  configuredFile: (filename: string) => Promise<string | null>;
}

function samePath(a: string, b: string, platform: CodexShortcutPlatform): boolean {
  return platform === 'windows' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function matchesStandardBinding(
  binding: ReturnType<CodexShortcutOptions['boundProfiles']>[number],
  profile: string,
  platform: CodexShortcutPlatform,
): boolean {
  if (!binding.socket) return false;
  if (platform === 'windows' && !binding.codexQueue)
    return binding.socket.toLowerCase() === String.raw`\\.\pipe\codex-ipc`;
  const expected =
    platform === 'windows'
      ? path.join(profile, 'app-server-control', 'app-server-control.sock')
      : path.join(profile, 'ipc', 'ipc.sock');
  return samePath(binding.socket, expected, platform);
}

async function privateDockDirectory(directory: string, canonical: typeof macShortcutDirectory) {
  await mkdir(directory, { mode: 0o700, recursive: true });
  const stat = await lstat(directory);
  if (
    !stat.isDirectory() ||
    (stat.mode & 0o077) !== 0 ||
    (await canonical(directory)) !== directory
  )
    throw new Error('The private Dock shortcut directory is unavailable');
}

export function codexShortcutPlatform(
  platform: NodeJS.Platform,
  installed: boolean,
  alternateUserData = false,
): CodexShortcutPlatform | null {
  if (!installed) return null;
  if (platform === 'darwin') return 'mac';
  return platform === 'win32' && !alternateUserData ? 'windows' : null;
}

export function createCodexShortcutHandler(
  options: CodexShortcutOptions,
  mac = {
    findMacCodex,
    isMacCodexShortcut,
    macCodexDockShortcuts,
    inspectMacCodexDesktop,
    createMacCodexShortcut,
    macShortcutDirectory,
    verifyMacCodexShortcut,
  },
  windows = {
    create: async (request: WindowsCodexShortcutRequest, context: WindowsCodexShortcutContext) =>
      (await import('./codex-shortcut-windows.js')).createWindowsCodexShortcut(request, context),
    programs: windowsProgramsDirectory,
    readLink: async (filename: string) =>
      (await import('electron')).shell.readShortcutLink(filename),
    verifyManifest: async (
      filename: string,
      expected: WindowsCodexShortcutContext & Omit<WindowsCodexShortcutRequest, 'destination'>,
    ): Promise<boolean> =>
      (await import('./codex-shortcut-windows.js')).verifyWindowsCodexShortcutManifest(
        filename,
        expected,
      ),
    desktopData: async (appData: string) =>
      (await import('./codex-shortcut-windows.js')).resolveWindowsCodexDesktopData(appData),
  },
) {
  let creating = false;
  let dockShortcut: string | undefined;

  async function resolveProfile(platform: CodexShortcutPlatform) {
    const standardProfile = path.join(options.home, '.codex');
    const standardData = path.join(options.appData, 'Codex');
    const install = platform === 'mac' ? await mac.findMacCodex() : undefined;
    if (platform === 'mac' && !install)
      return { reason: install === null ? 'profileUnavailable' : 'appMissing' } as const;
    const inspect = install
      ? () =>
          mac.inspectMacCodexDesktop(
            options.appPath,
            install.desktopExecutable,
            standardProfile,
            standardData,
          )
      : undefined;
    const witness = await inspect?.();
    if (witness?.state === 'unavailable') return { reason: 'profileUnavailable' } as const;
    const running = witness?.state === 'running' ? witness : undefined;
    const selectedConfig = running
      ? path.join(running.profile, 'config.toml')
      : await options.configurationPath();
    const profile = path.dirname(selectedConfig);
    if (path.basename(selectedConfig) !== 'config.toml')
      return { reason: 'profileUnavailable' } as const;
    const matchesSaved = () =>
      options
        .boundProfiles()
        .every((binding) => matchesStandardBinding(binding, profile, platform));
    if (!samePath(profile, running?.profile ?? standardProfile, platform))
      return { reason: 'profileUnavailable' } as const;
    if (
      !running &&
      ((options.codexHome && !samePath(options.codexHome, profile, platform)) || !matchesSaved())
    )
      return { reason: 'profileUnavailable' } as const;

    let desktopData: string;
    if (platform === 'mac') {
      const requestedData = running?.desktopData ?? standardData;
      const verified = await mac.macShortcutDirectory(requestedData).catch(() => null);
      if (
        verified !== requestedData ||
        (await mac.macShortcutDirectory(profile).catch(() => null)) !== profile
      )
        return { reason: 'profileUnavailable' } as const;
      desktopData = verified;
    } else {
      const resolved = await windows.desktopData(options.appData);
      if (resolved.state !== 'ready') return { reason: resolved.state } as const;
      desktopData = resolved.directory;
    }
    if (
      !running &&
      options.desktopDataOverride &&
      !samePath(options.desktopDataOverride, desktopData, platform)
    )
      return { reason: 'profileUnavailable' } as const;
    const current = async () => {
      const latest = await inspect?.();
      return running
        ? latest?.state === 'running' &&
            latest.process === running.process &&
            latest.profile === profile &&
            latest.desktopData === desktopData
        : latest?.state === witness?.state &&
            matchesSaved() &&
            (await options.configurationPath()) === selectedConfig;
    };
    return { profile, selectedConfig, desktopData, install, current };
  }

  return async (
    method: string,
    raw: unknown,
    preparedConfiguration?: string,
  ): Promise<
    | CodexShortcutPlatform
    | CodexShortcutCreateResult
    | CodexShortcutDestination[]
    | { configuration: string }
    | boolean
    | null
  > => {
    const platform = codexShortcutPlatform(
      options.platform,
      options.installed,
      options.alternateUserData,
    );
    if (method === 'codexShortcutPlatform') {
      z.object({}).strict().parse(raw);
      return platform;
    }
    if (method === 'codexShortcutConfiguration') {
      z.object({}).strict().parse(raw);
      if (!platform) return null;
      const resolved = await resolveProfile(platform);
      return 'reason' in resolved ? null : { configuration: resolved.selectedConfig };
    }
    if (method === 'codexShortcutLocations') {
      z.object({}).strict().parse(raw);
      if (!platform) return [];
      const extension = platform === 'mac' ? 'app' : 'lnk';
      const shortcutName = codexShortcutDisplayName + '.' + extension;
      const verifications = new Map<string, Promise<boolean>>();
      let profile: ReturnType<typeof resolveProfile> | undefined;
      const isExisting = async (filename: string): Promise<boolean> => {
        if (platform === 'mac') return mac.isMacCodexShortcut(filename);
        try {
          if (!(await lstat(filename)).isFile()) return false;
          const link = await windows.readLink(filename);
          if (!samePath(link.target, options.appExecutable, platform)) return false;
          const match = /^--launch-codex --launcher-manifest "([^"\r\n]+)"$/.exec(link.args ?? '');
          const manifestFile = match?.[1];
          if (!manifestFile || !path.isAbsolute(manifestFile)) return false;
          const normalized = path.normalize(manifestFile);
          if (normalized !== manifestFile) return false;
          const relative = path.relative(
            path.join(options.userData, 'codex-launchers'),
            normalized,
          );
          const [key, manifest, ...rest] = relative.split(path.sep);
          if (!/^[a-f0-9]{32}$/.test(key) || manifest !== 'manifest.json' || rest.length)
            return false;
          const cacheKey = normalized.toLowerCase();
          let verification = verifications.get(cacheKey);
          if (!verification) {
            profile ??= resolveProfile(platform);
            verification = profile.then((resolved) =>
              'reason' in resolved
                ? false
                : windows.verifyManifest(normalized, {
                    profile: resolved.profile,
                    desktopData: resolved.desktopData,
                    userData: options.userData,
                    appExecutable: options.appExecutable,
                    appPath: options.appPath,
                  }),
            );
            verifications.set(cacheKey, verification);
          }
          return await verification;
        } catch {
          return false;
        }
      };
      const folders =
        platform === 'mac'
          ? ([
              ['desktop', options.desktop],
              ['applications', path.join(options.home, 'Applications')],
            ] as const)
          : ([
              ['desktop', options.desktop],
              ['startMenu', await windows.programs().catch(() => undefined)],
            ] as const);
      const statuses = await Promise.all(
        folders.map(async ([location, folder]) => {
          if (folder && (await isExisting(path.join(folder, shortcutName)))) return location;
        }),
      );
      const existing: CodexShortcutDestination[] = statuses.filter(
        (location) => location !== undefined,
      );
      if (platform === 'mac') {
        for (const filename of await mac.macCodexDockShortcuts(options.home)) {
          if (path.basename(filename) === shortcutName && (await isExisting(filename))) {
            existing.push('dock');
            break;
          }
        }
      }
      return existing;
    }
    if (method === 'codexShortcutRevealDock') {
      z.object({}).strict().parse(raw);
      const owner = options.window();
      const destination = dockShortcut;
      if (platform !== 'mac' || !destination || !owner || owner.isDestroyed()) return false;
      const current = await lstat(destination).catch(() => null);
      if (
        !current?.isDirectory() ||
        dockShortcut !== destination ||
        owner.isDestroyed() ||
        options.window() !== owner
      )
        return false;
      options.reveal(destination);
      return true;
    }
    const { locale, destinations } = createInput.parse(raw);
    if (
      !platform ||
      creating ||
      destinations.some(
        (destination) => !codexShortcutDestinationsFor(platform).includes(destination),
      )
    )
      return failed();
    const owner = options.window();
    const isCurrent = () => owner && !owner.isDestroyed() && options.window() === owner;
    if (!owner || !isCurrent()) return cancelled;
    const copy = codexShortcutMessages(locale);
    creating = true;
    try {
      const extension = platform === 'mac' ? 'app' : 'lnk';
      const shortcutName = codexShortcutDisplayName + '.' + extension;
      let chosenFile: string | undefined;
      if (destinations.includes('custom')) {
        const folder = await options.dialog.showOpenDialog(owner, {
          title: copy.save,
          defaultPath: options.desktop,
          properties: ['openDirectory', 'createDirectory'],
        });
        if (folder.canceled || !path.isAbsolute(folder.filePaths[0] ?? '') || !isCurrent())
          return cancelled;
        chosenFile = path.join(folder.filePaths[0], shortcutName);
      }
      const resolution = await resolveProfile(platform);
      if ('reason' in resolution) return failed(resolution.reason);
      const { profile, selectedConfig, desktopData, install, current } = resolution;
      if (
        preparedConfiguration !== undefined
          ? !samePath(preparedConfiguration, selectedConfig, platform)
          : (await options.configuredFile(selectedConfig).catch(() => null)) !== selectedConfig
      )
        return failed('setupRequired');
      if (!(await current())) return failed('profileUnavailable');
      if (
        preparedConfiguration === undefined &&
        (await options.configuredFile(selectedConfig).catch(() => null)) !== selectedConfig
      )
        return failed('setupRequired');
      if (!isCurrent()) return cancelled;
      const launcher = {
        profile,
        desktopData,
        appExecutable: options.appExecutable,
        appPath: options.appPath,
      };
      const macConfig = install && {
        ...launcher,
        ...install,
        alreadyOpen: copy.alreadyOpen,
        launchFailed: copy.launchFailed,
      };
      const create = async (
        destination: string,
      ): Promise<CodexShortcutDestinationResult['result']> => {
        if (!isCurrent()) return 'failed';
        const request = { destination, ...launcher } satisfies WindowsCodexShortcutRequest;
        if (platform === 'windows') return windows.create(request, { userData: options.userData });
        try {
          await lstat(destination);
          return 'alreadyExists';
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        if (!isCurrent()) return 'failed';
        if (!macConfig) return 'appMissing';
        return mac.createMacCodexShortcut({ destination, ...macConfig });
      };
      dockShortcut = undefined;
      const results: CodexShortcutDestinationResult[] = [];
      for (const destination of destinations) {
        if (destination === 'dock') continue;
        let result: CodexShortcutDestinationResult['result'] = 'failed';
        try {
          let output = chosenFile;
          if (destination === 'desktop') output = path.join(options.desktop, shortcutName);
          if (destination === 'applications') {
            const applications = path.join(options.home, 'Applications');
            if (isCurrent()) await mkdir(applications, { recursive: true, mode: 0o700 });
            output = path.join(applications, shortcutName);
          }
          if (destination === 'startMenu')
            output = path.join(await windows.programs(), shortcutName);
          if (output) {
            result = await create(output);
            if (platform === 'mac' && result === 'created') dockShortcut ??= output;
          }
        } catch {
          // Each selected location reports its own outcome.
        }
        results.push({ destination, result });
      }
      if (destinations.includes('dock')) {
        if (!dockShortcut && macConfig && isCurrent()) {
          try {
            if ((await mac.macShortcutDirectory(options.userData)) !== options.userData)
              throw new Error('The application data directory is unavailable');
            const directory = path.join(options.userData, 'codex-dock');
            const key = createHash('sha256')
              .update(
                JSON.stringify([
                  profile,
                  desktopData,
                  macConfig.desktop,
                  options.appExecutable,
                  options.appPath,
                ]),
              )
              .digest('hex');
            const target = path.join(directory, key);
            await privateDockDirectory(directory, mac.macShortcutDirectory);
            await privateDockDirectory(target, mac.macShortcutDirectory);
            const destination = path.join(target, shortcutName);
            const result = await create(destination);
            if (
              result === 'created' ||
              (result === 'alreadyExists' &&
                (await mac.verifyMacCodexShortcut({ destination, ...macConfig })))
            )
              dockShortcut = destination;
          } catch {
            // Report the Dock action separately if its backing sequence fails.
          }
        }
        results.push({
          destination: 'dock',
          result: dockShortcut ? 'dockPending' : 'dockUnavailable',
        });
      } else {
        dockShortcut = undefined;
      }
      return { state: 'complete', destinations: results };
    } catch {
      return failed();
    } finally {
      creating = false;
    }
  };
}

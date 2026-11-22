import type {
  BrowserWindow,
  OpenDialogOptions,
  OpenDialogReturnValue,
  SaveDialogOptions,
  SaveDialogReturnValue,
} from 'electron';
import { execFile } from 'node:child_process';
import { lstat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { codexShortcutLocales, codexShortcutMessages } from '../shared/codex-shortcut-messages.js';
import {
  codexShortcutDestinations,
  codexShortcutDestinationsFor,
  type CodexShortcutCreateResult,
  type CodexShortcutDestinationResult,
  type CodexShortcutFailure,
  type CodexShortcutPlatform,
} from '../shared/codex-shortcut.js';
import type { McpSetupStatus } from '../shared/mcp-setup.js';
import {
  createMacCodexShortcut,
  findMacCodex,
  macShortcutDirectory,
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
  desktop: string;
  dialog: {
    showOpenDialog: (
      owner: BrowserWindow,
      options: OpenDialogOptions,
    ) => Promise<OpenDialogReturnValue>;
    showSaveDialog: (
      owner: BrowserWindow,
      options: SaveDialogOptions,
    ) => Promise<SaveDialogReturnValue>;
  };
  window: () => BrowserWindow | null;
  status: () => Promise<McpSetupStatus>;
  configuredFile: (filename: string) => Promise<string | null>;
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
  mac = { findMacCodex, createMacCodexShortcut, macShortcutDirectory },
  windows = {
    create: async (request: WindowsCodexShortcutRequest, context: WindowsCodexShortcutContext) =>
      (await import('./codex-shortcut-windows.js')).createWindowsCodexShortcut(request, context),
    programs: windowsProgramsDirectory,
  },
) {
  let creating = false;

  return async (
    method: string,
    raw: unknown,
  ): Promise<CodexShortcutPlatform | CodexShortcutCreateResult | null> => {
    const platform = codexShortcutPlatform(
      options.platform,
      options.installed,
      options.alternateUserData,
    );
    if (method === 'codexShortcutPlatform') {
      z.object({}).strict().parse(raw);
      return platform;
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
      const status = await options.status();
      const suggested = status.files[0]?.path;
      const explicitHome = options.codexHome;
      const explicitConfig =
        explicitHome && path.isAbsolute(explicitHome)
          ? path.join(explicitHome, 'config.toml')
          : undefined;
      let filename = suggested;
      if (
        status.state !== 'configured' ||
        !suggested ||
        (!status.remembered && suggested !== explicitConfig)
      ) {
        if (!isCurrent()) return cancelled;
        const selected = await options.dialog.showOpenDialog(owner, {
          title: copy.selectConfig,
          defaultPath: suggested || path.join(options.home, '.codex', 'config.toml'),
          properties: ['openFile', 'showHiddenFiles'],
          filters: [{ name: 'TOML', extensions: ['toml'] }],
        });
        if (selected.canceled || !selected.filePaths[0] || !isCurrent()) return cancelled;
        filename = selected.filePaths[0];
      }
      if (!filename) return failed('setupRequired');
      const configuration = await options.configuredFile(filename).catch(() => null);
      if (!configuration) return failed('setupRequired');
      const profileDirectory = path.dirname(configuration);
      const profile =
        platform === 'mac'
          ? await mac.macShortcutDirectory(profileDirectory).catch(() => null)
          : profileDirectory;
      if (!profile) return failed('profileUnavailable');
      const install = platform === 'mac' ? await mac.findMacCodex() : undefined;
      if (platform === 'mac' && !install) return failed('appMissing');
      if (!isCurrent()) return cancelled;
      const selected = await options.dialog.showOpenDialog(owner, {
        title: copy.selectData,
        message: profile,
        defaultPath:
          configuration === path.join(options.home, '.codex', 'config.toml')
            ? path.join(options.appData, 'Codex')
            : options.appData,
        properties: ['openDirectory', 'showHiddenFiles'],
      });
      if (selected.canceled || !selected.filePaths[0] || !isCurrent()) return cancelled;
      const desktopData =
        platform === 'mac'
          ? await mac.macShortcutDirectory(selected.filePaths[0]).catch(() => null)
          : selected.filePaths[0];
      if (!desktopData) return failed('profileUnavailable');
      if (!isCurrent()) return cancelled;
      const extension = platform === 'mac' ? 'app' : 'lnk';
      const shortcutName = 'Codex with NCF.' + extension;
      const dockOnly = destinations.length === 1 && destinations[0] === 'dock';
      let chosenFile: string | undefined;
      if (dockOnly || destinations.includes('custom')) {
        const saved = await options.dialog.showSaveDialog(owner, {
          title: copy.save,
          defaultPath: path.join(options.desktop, shortcutName),
          filters: [{ name: 'Codex with NCF', extensions: [extension] }],
        });
        if (saved.canceled || !saved.filePath || !isCurrent()) return cancelled;
        chosenFile = saved.filePath;
      }
      const current = await options.configuredFile(filename).catch(() => null);
      if (!isCurrent()) return cancelled;
      if (current !== configuration) return failed('setupRequired');
      const create = async (
        destination: string,
      ): Promise<CodexShortcutDestinationResult['result']> => {
        if (!isCurrent()) return 'failed';
        try {
          await lstat(destination);
          return 'alreadyExists';
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        if (!isCurrent()) return 'failed';
        const request = {
          destination,
          profile,
          desktopData,
          appExecutable: options.appExecutable,
          appPath: options.appPath,
        } satisfies WindowsCodexShortcutRequest;
        if (platform === 'windows') return windows.create(request, { userData: options.userData });
        if (!install) return 'appMissing';
        return mac.createMacCodexShortcut({
          ...request,
          ...install,
          alreadyOpen: copy.alreadyOpen,
          launchFailed: copy.launchFailed,
        });
      };
      const results: CodexShortcutDestinationResult[] = [];
      for (const destination of destinations) {
        if (destination === 'dock' && !dockOnly) continue;
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
          if (output) result = await create(output);
        } catch {
          // Each selected location reports its own outcome.
        }
        if (destination === 'dock' && result === 'created') result = 'dockPending';
        results.push({ destination, result });
      }
      if (!dockOnly && destinations.includes('dock')) {
        const created = results.some(({ result }) => result === 'created');
        results.push({ destination: 'dock', result: created ? 'dockPending' : 'dockUnavailable' });
      }
      return { state: 'complete', destinations: results };
    } catch {
      return failed();
    } finally {
      creating = false;
    }
  };
}

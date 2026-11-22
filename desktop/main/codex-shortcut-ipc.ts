import type {
  BrowserWindow,
  OpenDialogOptions,
  OpenDialogReturnValue,
  SaveDialogOptions,
  SaveDialogReturnValue,
} from 'electron';
import path from 'node:path';
import { z } from 'zod';
import { codexShortcutLocales, codexShortcutMessages } from '../shared/codex-shortcut-messages.js';
import type { CodexShortcutPlatform, CodexShortcutResult } from '../shared/codex-shortcut.js';
import type { McpSetupStatus } from '../shared/mcp-setup.js';
import {
  createMacCodexShortcut,
  findMacCodex,
  macShortcutDirectory,
} from './codex-shortcut-mac.js';

interface CodexShortcutOptions {
  platform: NodeJS.Platform;
  installed: boolean;
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
): CodexShortcutPlatform | null {
  return installed && platform === 'darwin' ? 'mac' : null;
}

export function createCodexShortcutHandler(
  options: CodexShortcutOptions,
  mac = { findMacCodex, createMacCodexShortcut, macShortcutDirectory },
) {
  let creating = false;

  return async (
    method: string,
    raw: unknown,
  ): Promise<CodexShortcutPlatform | CodexShortcutResult | null> => {
    const platform = codexShortcutPlatform(options.platform, options.installed);
    if (method === 'codexShortcutPlatform') {
      z.object({}).strict().parse(raw);
      return platform;
    }
    const { locale } = z
      .object({ locale: z.enum(codexShortcutLocales) })
      .strict()
      .parse(raw);
    if (!platform || creating) return 'failed';
    const owner = options.window();
    const isCurrent = () => owner && !owner.isDestroyed() && options.window() === owner;
    if (!owner || !isCurrent()) return 'cancelled';
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
        if (!isCurrent()) return 'cancelled';
        const selected = await options.dialog.showOpenDialog(owner, {
          title: copy.selectConfig,
          defaultPath: suggested || path.join(options.home, '.codex', 'config.toml'),
          properties: ['openFile', 'showHiddenFiles'],
          filters: [{ name: 'TOML', extensions: ['toml'] }],
        });
        if (selected.canceled || !selected.filePaths[0] || !isCurrent()) return 'cancelled';
        filename = selected.filePaths[0];
      }
      if (!filename) return 'setupRequired';
      const configuration = await options.configuredFile(filename).catch(() => null);
      if (!configuration) return 'setupRequired';
      const profile = await mac.macShortcutDirectory(path.dirname(configuration)).catch(() => null);
      if (!profile) return 'profileUnavailable';
      const install = await mac.findMacCodex();
      if (!install) return 'appMissing';
      if (!isCurrent()) return 'cancelled';
      const selected = await options.dialog.showOpenDialog(owner, {
        title: copy.selectData,
        message: profile,
        defaultPath:
          configuration === path.join(options.home, '.codex', 'config.toml')
            ? path.join(options.appData, 'Codex')
            : options.appData,
        properties: ['openDirectory', 'showHiddenFiles'],
      });
      if (selected.canceled || !selected.filePaths[0] || !isCurrent()) return 'cancelled';
      const desktopData = await mac.macShortcutDirectory(selected.filePaths[0]).catch(() => null);
      if (!desktopData) return 'profileUnavailable';
      if (!isCurrent()) return 'cancelled';
      const saved = await options.dialog.showSaveDialog(owner, {
        title: copy.save,
        defaultPath: path.join(options.desktop, 'Codex with NCF.app'),
        filters: [{ name: 'Codex with NCF', extensions: ['app'] }],
      });
      if (saved.canceled || !saved.filePath || !isCurrent()) return 'cancelled';
      const current = await options.configuredFile(filename).catch(() => null);
      if (!isCurrent()) return 'cancelled';
      if (current !== configuration) return 'setupRequired';
      return await mac.createMacCodexShortcut({
        ...install,
        destination: saved.filePath,
        profile,
        desktopData,
        appExecutable: options.appExecutable,
        appPath: options.appPath,
        alreadyOpen: copy.alreadyOpen,
        launchFailed: copy.launchFailed,
      });
    } catch {
      return 'failed';
    } finally {
      creating = false;
    }
  };
}

import type { BrowserWindow, Dialog } from 'electron';
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
  desktop: string;
  dialog: Pick<Dialog, 'showOpenDialog' | 'showSaveDialog'>;
  window: () => BrowserWindow | null;
  status: () => Promise<McpSetupStatus>;
}

export function codexShortcutPlatform(
  platform: NodeJS.Platform,
  installed: boolean,
): CodexShortcutPlatform | null {
  return installed && platform === 'darwin' ? 'mac' : null;
}

export function createCodexShortcutHandler(options: CodexShortcutOptions) {
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
      const configuration = status.files[0]?.path;
      if (status.state !== 'configured' || !status.remembered || !configuration)
        return 'setupRequired';
      if (path.basename(configuration) !== 'config.toml') return 'profileUnavailable';
      const profile = await macShortcutDirectory(path.dirname(configuration)).catch(() => null);
      if (!profile) return 'profileUnavailable';
      const install = await findMacCodex();
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
      const desktopData = await macShortcutDirectory(selected.filePaths[0]).catch(() => null);
      if (!desktopData) return 'profileUnavailable';
      if (!isCurrent()) return 'cancelled';
      const saved = await options.dialog.showSaveDialog(owner, {
        title: copy.save,
        defaultPath: path.join(options.desktop, 'Codex with NCF.app'),
        filters: [{ name: 'Codex with NCF', extensions: ['app'] }],
      });
      if (saved.canceled || !saved.filePath || !isCurrent()) return 'cancelled';
      const current = await options.status();
      if (!isCurrent()) return 'cancelled';
      if (
        !current.remembered ||
        current.state !== 'configured' ||
        current.files[0]?.path !== configuration
      )
        return 'setupRequired';
      return await createMacCodexShortcut({
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

import { createRequire } from 'node:module';
import { lstat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DesktopSessionDelivery, DeliveryAction } from '../shared/desktop-session-delivery.js';
import { resolveWindowsCodexDesktopData } from './codex-shortcut-windows.js';

export interface WindowsDesktopDeliveryOptions {
  userData: string;
  appExecutable: string;
  appPath: string;
  appData: string;
  installed: boolean;
  alternateUserData: boolean;
}
type Settings = { version: 1; enabled: boolean; pipeId: string; profile: string };
interface Runtime {
  readSettings(
    options: WindowsDesktopDeliveryOptions,
    verifyOwnership?: boolean,
  ): Promise<Settings | null>;
  saveSettings(options: WindowsDesktopDeliveryOptions, settings: Settings): Promise<void>;
  locations(options: WindowsDesktopDeliveryOptions): { broker: string };
  registry(
    options: WindowsDesktopDeliveryOptions,
    settings: Settings,
    action: 'status' | 'publish' | 'withdraw',
  ): Promise<{
    conflict: boolean;
    published: boolean;
    selectorOwned?: boolean;
    autorunOwned?: boolean;
  }>;
  broadcast(options: WindowsDesktopDeliveryOptions): Promise<void>;
  control(
    options: WindowsDesktopDeliveryOptions,
    settings: Settings,
    action: 'status' | 'stop' | 'disable',
  ): Promise<DesktopSessionDelivery>;
  start(
    options: WindowsDesktopDeliveryOptions,
    settings: Settings,
  ): Promise<DesktopSessionDelivery>;
}
interface Platform {
  canonical(filename: string, directory: boolean): Promise<string>;
  inspectPackage(): Promise<{ running: number }>;
}
interface Dependencies {
  runtime: Runtime;
  platform: Platform;
  metadata: (filename: string) => Promise<{ isFile(): boolean; isSymbolicLink(): boolean }>;
  stockData: typeof resolveWindowsCodexDesktopData;
  stockProfile: () => Promise<string>;
}
const require = createRequire(import.meta.url);
const runtime = require('../integrations/codex-windows-service.cjs') as Runtime;
const platform = require('../integrations/codex-windows-bridge.cjs') as Platform;
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const unavailable = (): DesktopSessionDelivery => ({ state: 'unavailable' });

/** This factory is called only behind the existing authenticated main-frame IPC boundary. */
export function createWindowsDesktopSessionDeliveryHandler(
  options: WindowsDesktopDeliveryOptions,
  selected: () => Promise<string | null>,
  dependencies: Dependencies = {
    runtime,
    platform,
    metadata: lstat,
    stockData: resolveWindowsCodexDesktopData,
    stockProfile: () => platform.canonical(path.join(homedir(), '.codex'), true),
  },
): (action: DeliveryAction, expected?: string) => Promise<DesktopSessionDelivery> {
  let writing: Promise<unknown> = Promise.resolve();
  async function perform(
    action: DeliveryAction,
    expected?: string,
  ): Promise<DesktopSessionDelivery> {
    if (!options.installed || options.alternateUserData || process.platform !== 'win32')
      return { state: 'unsupported' };
    try {
      const chosen = await selected();
      if (!chosen) return { state: action === 'status' ? 'configuration-required' : 'unavailable' };
      const profile = await dependencies.platform.canonical(chosen, true);
      // Windows background delivery supports the established default layout. An
      // override must never silently send another GUI profile to this server.
      const stock = await dependencies.stockProfile();
      if (!same(profile, stock)) return { state: 'unsupported' };
      const broker = await dependencies.metadata(dependencies.runtime.locations(options).broker);
      if (!broker.isFile() || broker.isSymbolicLink()) return unavailable();
      const settings = await dependencies.runtime.readSettings(options, action !== 'status');
      const ready = {
        state: 'ready',
        profile,
        scope: 'user',
        requiresClosedChatGPT: true,
      } as const;
      if (action === 'status') {
        if (!settings?.enabled) return ready;
        if (!same(settings.profile, profile)) return { state: 'conflict' };
        try {
          const status = await dependencies.runtime.control(options, settings, 'status');
          return (status.state === 'enabled' || status.state === 'ready') &&
            same(status.profile, profile)
            ? { ...status, requiresClosedChatGPT: true }
            : unavailable();
        } catch (error) {
          if (!(error instanceof Error) || error.message !== 'NCF_CHATGPT_SERVICE_ABSENT')
            return unavailable();
          // This is the saved opt-in setting, not a transport admission. Keep
          // Disable available after a worker loss; only the native core records receipt.
          return { ...ready, state: 'enabled' };
        }
      }
      if (!expected || !same(await dependencies.platform.canonical(expected, true), profile))
        return { state: 'conflict' };
      // Refuse before any state/registry write or worker start. The owner closes
      // ChatGPT; this API never terminates or restarts an application.
      if ((await dependencies.platform.inspectPackage()).running !== 0)
        return { state: 'close-required' };
      if ((await dependencies.stockData(options.appData, false)).state !== 'ready')
        return unavailable();
      if (settings?.enabled && !same(settings.profile, profile)) return { state: 'conflict' };
      if (action === 'disable') {
        if (!settings) return ready;
        try {
          const result = await dependencies.runtime.control(options, settings, 'disable');
          if (result.state !== 'ready') return result;
        } catch (error) {
          if (!(error instanceof Error) || error.message !== 'NCF_CHATGPT_SERVICE_ABSENT')
            return unavailable();
          // A stopped worker still has a reversible, explicitly owned selector.
          await dependencies.runtime.registry(options, settings, 'withdraw');
          await dependencies.runtime.broadcast(options);
          await dependencies.runtime.saveSettings(options, { ...settings, enabled: false });
        }
        return ready;
      }
      const next: Settings = settings
        ? { ...settings, enabled: true, profile }
        : { version: 1, enabled: true, profile, pipeId: randomUUID() };
      const registry = await dependencies.runtime.registry(options, next, 'status');
      if (registry.conflict) return { state: 'conflict' };
      await dependencies.runtime.saveSettings(options, next);
      const result = await dependencies.runtime.start(options, next);
      // A concurrent startup or a lost status reply cannot authorize withdrawing
      // another live instance's route. Only the worker that owns the pipe does so.
      return result.state === 'enabled' ? { ...result, requiresClosedChatGPT: true } : result;
    } catch {
      return unavailable();
    }
  }
  return (action, expected) => {
    if (action === 'status') return perform(action, expected);
    const operation = writing.then(() => perform(action, expected));
    writing = operation.catch(() => {});
    return operation;
  };
}

/** Restore only the service explicitly enabled by the owner; no client config is rewritten. */
export async function restoreWindowsDesktopSessionService(
  options: WindowsDesktopDeliveryOptions,
): Promise<boolean> {
  const settings = await runtime.readSettings(options);
  if (!settings?.enabled) return true;
  return (await runtime.start(options, settings)).state === 'enabled';
}

/** Called by the installer before it removes/replaces files, never by a timer. */
export async function stopWindowsDesktopSessionService(
  options: WindowsDesktopDeliveryOptions,
  disable = false,
): Promise<boolean> {
  const settings = await runtime.readSettings(options);
  if (!settings?.enabled) return true;
  try {
    return (
      (await runtime.control(options, settings, disable ? 'disable' : 'stop')).state === 'ready'
    );
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'NCF_CHATGPT_SERVICE_ABSENT') return false;
    // Missing control transport is not proof that the executable is unlocked.
    // The installer's existing Restart Manager check remains authoritative.
    if (disable) {
      await runtime.registry(options, settings, 'withdraw');
      await runtime.broadcast(options);
      await runtime.saveSettings(options, { ...settings, enabled: false });
    }
    return true;
  }
}

/** A local event invalidates cached availability; core still verifies the exact chat and owner. */
export function watchWindowsDesktopSessionLaunches(
  options: WindowsDesktopDeliveryOptions,
  changed: () => void,
): () => void {
  const directory = path.join(options.userData, 'ChatGPT Session Delivery');
  let inner: ReturnType<typeof watch> | undefined;
  let closed = false;
  let pending = false;
  let latest = 0;
  const refresh = () => {
    if (closed || pending) return;
    pending = true;
    void (async () => {
      const settings = await runtime.readSettings(options, false);
      if (!settings?.enabled) return;
      const file = path.join(directory, 'launch.json');
      const info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 2048) return;
      const value = JSON.parse(await readFile(file, 'utf8'));
      if (
        same(value.profile, settings.profile) &&
        Number.isSafeInteger(value.pid) &&
        Number.isSafeInteger(value.serverPid) &&
        Number.isSafeInteger(value.at) &&
        value.at > latest &&
        !closed
      ) {
        latest = value.at;
        changed();
      }
    })()
      .catch(() => {})
      .finally(() => {
        pending = false;
      });
  };
  const attach = () => {
    if (closed || inner) return;
    try {
      inner = watch(directory, (_event, name) => {
        if (String(name) === 'launch.json') refresh();
      });
    } catch {}
  };
  const outer = watch(options.userData, (_event, name) => {
    if (String(name) === 'ChatGPT Session Delivery') attach();
  });
  attach();
  return () => {
    closed = true;
    inner?.close();
    outer.close();
  };
}

import { execFile } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { macControlSocket } from '../core/codex-queue.js';
import { atomicJson } from '../core/settings.js';
import type { DesktopSessionDelivery } from '../shared/desktop-session-delivery.js';
import { findMacCodex, macShortcutDirectory } from './codex-shortcut-mac.js';

const execute = promisify(execFile);
const setting = 'CODEX_APP_SERVER_WS_URL';
const settingReceipt = z
  .object({ profile: z.string().min(1), url: z.string().startsWith('ws+unix://localhost/') })
  .strict();
const saved = settingReceipt.extend({ previous: settingReceipt.optional() });
const checkedDaemon = z.object({
  status: z.enum(['started', 'alreadyRunning']),
  cliVersion: z.string().min(1),
  appServerVersion: z.string().min(1),
  socketPath: z.string(),
});

export const macDeliveryHost = {
  async read() {
    const [session, uid] = await Promise.all(
      ['managername', 'manageruid'].map((command) =>
        execute('/bin/launchctl', [command], { timeout: 3000 }),
      ),
    );
    if (session.stdout.trim() !== 'Aqua' || uid.stdout.trim() !== String(process.getuid!()))
      throw new Error('Expected the current macOS GUI login');
    try {
      return (
        await execute('/bin/launchctl', ['getenv', setting], { timeout: 3000 })
      ).stdout.trimEnd();
    } catch (error) {
      const failure = error as Error & { code?: number; stderr?: string };
      if (failure.code === 1 && !failure.stderr?.trim()) return '';
      throw error;
    }
  },
  async publish(url: string) {
    await execute('/bin/launchctl', ['setenv', setting, url], { timeout: 3000 });
  },
  async clear() {
    await execute('/bin/launchctl', ['unsetenv', setting], { timeout: 3000 });
  },
  async start(profile: string) {
    const install = await findMacCodex();
    if (!install || (await macShortcutDirectory(profile)) !== profile)
      throw new Error('The selected desktop or profile is unavailable');
    await execute(
      '/usr/bin/codesign',
      [
        '--verify',
        '--strict',
        '-R=anchor apple generic and certificate leaf[subject.OU] = "2DC432GLL2"',
        install.desktop,
      ],
      { timeout: 20000 },
    );
    if (process.env.CODEX_SQLITE_HOME && path.resolve(process.env.CODEX_SQLITE_HOME) !== profile)
      throw new Error('The desktop uses a separate database location');
    const env = { ...process.env, CODEX_HOME: profile };
    const { stdout } = await execute(install.cli, ['app-server', 'daemon', 'start'], {
      env,
      cwd: profile,
      timeout: 30000,
      maxBuffer: 16384,
    });
    const info = checkedDaemon.parse(JSON.parse(stdout));
    if (
      info.cliVersion !== info.appServerVersion ||
      info.socketPath !== path.join(profile, 'app-server-control', 'app-server-control.sock')
    )
      throw new Error('The daemon identity or profile did not match');
    const socket = await macControlSocket(profile);
    const url = new URL('ws+unix://localhost' + socket + ':/rpc');
    if (url.pathname !== socket + ':/rpc' || url.search || url.hash)
      throw new Error('The local socket path cannot be represented by this desktop');
    return url.href;
  },
};

export function createMacSessionDelivery(
  directory: string,
  selected: () => Promise<string | null>,
  host = macDeliveryHost,
) {
  const file = path.join(directory, 'mac-session-delivery.json');
  async function receipt() {
    try {
      return saved.parse(JSON.parse(await readFile(file, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }
  let tail: Promise<unknown> = Promise.resolve();
  async function handle(
    action: 'status' | 'enable' | 'disable',
    expected?: string,
  ): Promise<DesktopSessionDelivery> {
    const record = await receipt();
    const current = await host.read();
    const prior = record?.previous?.url === current ? record.previous : record;
    if (action === 'disable' && prior && prior.profile === expected) {
      if (current === prior.url) await host.clear();
      if ((await host.read()) === prior.url)
        throw new Error('The login setting could not be cleared');
      await unlink(file);
      return handle('status');
    }
    if (current) {
      if (!prior || current !== prior.url) return { state: 'conflict' };
      if (action !== 'enable' || expected === prior.profile)
        return { state: 'enabled', scope: 'login', profile: prior.profile };
    }
    const profile = await selected();
    if (!profile) return { state: 'unavailable' };
    if (action !== 'enable' || expected !== profile)
      return { state: 'ready', scope: 'login', profile };
    const url = await host.start(profile);
    if ((await selected()) !== profile || (await host.read()) !== current) return handle('status');
    // Either side of an interrupted profile switch can still be disabled.
    await atomicJson(file, {
      profile,
      url,
      previous: current && prior ? { profile: prior.profile, url: prior.url } : undefined,
    });
    await host.publish(url);
    if ((await host.read()) !== url) throw new Error('The login setting could not be confirmed');
    if (current) await atomicJson(file, { profile, url });
    return { state: 'enabled', scope: 'login', profile };
  }
  return (action: 'status' | 'enable' | 'disable', expected?: string) => {
    const job = tail.then(() => handle(action, expected));
    tail = job.catch(() => {});
    return job;
  };
}

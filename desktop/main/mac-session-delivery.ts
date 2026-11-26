import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { open, realpath, unlink } from 'node:fs/promises';
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
  .object({
    profile: z.string().min(1),
    url: z.string().startsWith('ws+unix://localhost/'),
  })
  .strict();
const managedProcess = z
  .object({
    pid: z.number().int().min(2).max(0x7fffffff),
    executable: z.string().refine(path.isAbsolute),
    profile: z.string().refine(path.isAbsolute),
    marker: z.uuid(),
    startedAt: z.string().regex(/^\d+:\d+$/),
  })
  .strict();
type ManagedProcess = z.infer<typeof managedProcess>;
const saved = settingReceipt.extend({
  previous: settingReceipt.optional(),
  managed: z.array(managedProcess).optional(),
});
const checkedDaemon = z.object({
  status: z.enum(['started', 'alreadyRunning']),
  cliVersion: z.string().min(1),
  appServerVersion: z.string().min(1),
  socketPath: z.string(),
  pid: managedProcess.shape.pid.nullish(),
  managedCodexPath: managedProcess.shape.executable.nullish(),
});

export interface MacDeliveryHost {
  read(): Promise<string>;
  publish(url: string): Promise<void>;
  clear(): Promise<void>;
  chatgptRunning(): Promise<boolean>;
  start(profile: string): Promise<{ url: string; managed?: ManagedProcess }>;
  stop(managed: ManagedProcess): Promise<void>;
}

const macDeliverySelector = {
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
};

export function createMacDeliveryHost(appPath: string): MacDeliveryHost {
  const helper = path.join(appPath, 'build/assets/codex-mac-launcher');
  const processArgs = ({ pid, executable, profile, marker }: Omit<ManagedProcess, 'startedAt'>) => [
    String(pid),
    executable,
    profile,
    marker,
  ];
  async function stop(managed: ManagedProcess) {
    await execute(helper, ['--stop-delivery-process', ...processArgs(managed), managed.startedAt], {
      timeout: 10000,
    }).catch(() => {
      throw new Error('The managed delivery process has not confirmed exit');
    });
  }
  async function identify(pid: number, managedPath: string, profile: string, marker: string) {
    const executable = await realpath(managedPath);
    async function witness(candidate: string) {
      const owner = { pid, executable: candidate, profile, marker };
      const { stdout } = await execute(
        helper,
        ['--identify-delivery-process', ...processArgs(owner)],
        {
          timeout: 3000,
        },
      );
      return managedProcess.parse({ ...owner, startedAt: stdout.trim() });
    }
    try {
      return await witness(executable);
    } catch (error) {
      // The macOS vendor package may report its bin/codex launcher, which execs
      // the bundled CodexCLI binary in the same release directory.
      const releases = path.join(profile, 'packages/app-server-daemon/releases');
      if (
        !/^[^/]+\/bin\/codex$/.test(path.relative(releases, executable)) ||
        !executable.startsWith(releases + path.sep)
      )
        throw error;
      const candidate = path.join(
        path.dirname(path.dirname(executable)),
        'CodexCLI.app/Contents/MacOS/codex',
      );
      if ((await realpath(candidate)) !== candidate) throw error;
      return witness(candidate);
    }
  }
  return {
    ...macDeliverySelector,
    async chatgptRunning() {
      const { stdout } = await execute(helper, ['--chatgpt-running'], { timeout: 3000 });
      return z.enum(['running', 'closed']).parse(stdout.trim()) === 'running';
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
      const marker = randomUUID();
      const env = {
        ...process.env,
        CODEX_HOME: profile,
        NCF_MAC_DELIVERY_OWNER: marker,
      };
      const { stdout } = await execute(install.cli, ['app-server', 'daemon', 'start'], {
        env,
        cwd: profile,
        timeout: 30000,
        maxBuffer: 16384,
      });
      const info = checkedDaemon.parse(JSON.parse(stdout));
      let managed: ManagedProcess | undefined;
      if (info.status === 'started') {
        if (!info.pid || !info.managedCodexPath)
          throw new Error('The launched delivery process could not be identified');
        managed = await identify(info.pid, info.managedCodexPath, profile, marker).catch(() => {
          throw new Error('The launched delivery process could not be identified');
        });
      }
      try {
        if (
          info.cliVersion !== info.appServerVersion ||
          info.socketPath !== path.join(profile, 'app-server-control', 'app-server-control.sock')
        )
          throw new Error('The daemon identity or profile did not match');
        const socket = await macControlSocket(profile);
        const url = new URL('ws+unix://localhost' + socket + ':/rpc');
        if (url.pathname !== socket + ':/rpc' || url.search || url.hash)
          throw new Error('The local socket path cannot be represented by this desktop');
        return { url: url.href, managed };
      } catch (error) {
        if (managed) await stop(managed);
        throw error;
      }
    },
    stop,
  };
}

export function createMacSessionDelivery(
  directory: string,
  selected: () => Promise<string | null>,
  host: MacDeliveryHost,
) {
  const file = path.join(directory, 'mac-session-delivery.json');
  async function transition(
    state: 'enabled' | 'ready',
    profile: string,
    selectorChanged: boolean,
  ): Promise<DesktopSessionDelivery> {
    // If live state is unavailable, retain restart guidance after a changed selector.
    const restart = selectorChanged && (await host.chatgptRunning().catch(() => true));
    return { state, scope: 'login', profile, ...(restart ? { restartRequired: true } : {}) };
  }
  async function receipt() {
    try {
      const handle = await open(
        file,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const info = await handle.stat();
        const uid = process.getuid?.();
        if (
          !info.isFile() ||
          (uid !== undefined && (info.uid !== uid || (info.mode & 0o077) !== 0))
        )
          throw new Error('The background delivery record is not private');
        return saved.parse(JSON.parse(await handle.readFile('utf8')));
      } finally {
        await handle.close();
      }
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
      for (const process of record?.managed ?? []) await host.stop(process);
      const changed = (await host.read()) === prior.url;
      if (changed) await host.clear();
      const remaining = await host.read();
      if (remaining === prior.url) throw new Error('The login setting could not be cleared');
      await unlink(file);
      if (remaining) return { state: 'conflict' };
      return transition('ready', prior.profile, changed);
    }
    if (current) {
      if (!prior || current !== prior.url) return { state: 'conflict' };
      if (action !== 'enable' || expected === prior.profile)
        return { state: 'enabled', scope: 'login', profile: prior.profile };
    }
    const profile = await selected();
    if (!profile)
      return {
        state: action === 'status' ? 'configuration-required' : 'unavailable',
      };
    if (action !== 'enable' || expected !== profile)
      return { state: 'ready', scope: 'login', profile };
    const { url, managed: started } = await host.start(profile);
    const managed = [...(record?.managed ?? []), ...(started ? [started] : [])];
    // Either side of an interrupted profile switch can still be disabled.
    let stillSelected: boolean;
    try {
      stillSelected = (await selected()) === profile && (await host.read()) === current;
      if (stillSelected) {
        await atomicJson(file, {
          profile,
          url,
          previous: current && prior ? { profile: prior.profile, url: prior.url } : undefined,
          managed,
        });
      }
    } catch (error) {
      if (started) await host.stop(started);
      throw error;
    }
    if (!stillSelected) {
      if (started) await host.stop(started);
      return handle('status');
    }
    await host.publish(url);
    if ((await host.read()) !== url) throw new Error('The login setting could not be confirmed');
    if (current) await atomicJson(file, { profile, url, managed });
    return transition('enabled', profile, true);
  }
  return (action: 'status' | 'enable' | 'disable', expected?: string) => {
    const job = tail.then(() => handle(action, expected));
    tail = job.catch(() => {});
    return job;
  };
}

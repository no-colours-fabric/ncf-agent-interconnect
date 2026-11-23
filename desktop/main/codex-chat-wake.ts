import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { lstat, readdir, readlink, realpath } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { NativeDiscoveryFiles } from '../core/application-discovery-platforms.js';
import type { WakeCodexChat } from '../core/codex-queue.js';

const execute = promisify(execFile);

async function runningLinuxDesktop(): Promise<string | undefined> {
  const desktop = '/usr/lib/chatgpt/ChatGPT';
  const file = await lstat(desktop);
  if (
    !file.isFile() ||
    file.uid !== 0 ||
    file.mode & 0o022 ||
    (await realpath(desktop)) !== desktop
  )
    return;
  const uid = process.getuid!();
  for (const pid of await readdir('/proc')) {
    if (!/^\d+$/.test(pid)) continue;
    const proc = path.join('/proc', pid);
    if ((await readlink(path.join(proc, 'exe')).catch(() => '')) !== desktop) continue;
    if ((await lstat(proc).catch(() => undefined))?.uid === uid) return desktop;
  }
}

async function runningWindowsDesktop(): Promise<string | undefined> {
  const installs = await new NativeDiscoveryFiles().windowsCodex();
  if (installs.length !== 1) return;
  const desktop = installs[0].executable;
  const command = path.win32.join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'System32/WindowsPowerShell/v1.0/powershell.exe',
  );
  const script = [
    '$s=[Diagnostics.Process]::GetCurrentProcess().SessionId',
    '$n=[IO.Path]::GetFileNameWithoutExtension($env:NCF_STOCK_DESKTOP)',
    'if (Get-Process -Name $n -ErrorAction SilentlyContinue | Where-Object {$_.SessionId -eq $s -and $_.Path -eq $env:NCF_STOCK_DESKTOP}) {[Console]::Write("running")}',
  ].join('; ');
  const { stdout } = await execute(command, ['-NoProfile', '-NonInteractive', '-Command', script], {
    env: { ...process.env, NCF_STOCK_DESKTOP: desktop },
    timeout: 3000,
    maxBuffer: 128,
    windowsHide: true,
  });
  if (stdout === 'running') return desktop;
}

/** Open only the exact UUID after the bound profile's native queue confirms it.
 * Neither the message nor a connection credential crosses the desktop link. */
export const wakeStockChat: WakeCodexChat = async (profile, current) => {
  const id = profile.threadId;
  if (!id || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id) || !current())
    throw new Error('The bound chat is unavailable');
  const desktop =
    process.platform === 'win32'
      ? await runningWindowsDesktop()
      : process.platform === 'linux'
        ? await runningLinuxDesktop()
        : undefined;
  if (!desktop || !current()) throw new Error('The stock ChatGPT desktop is unavailable');
  const opener = spawn(desktop, ['codex://threads/' + id], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  await once(opener, 'spawn');
  opener.unref();
};

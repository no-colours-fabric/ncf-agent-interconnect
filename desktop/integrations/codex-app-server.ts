import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { lstat, mkdir, realpath } from 'node:fs/promises';
import { createConnection } from 'node:net';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket from 'ws';
import {
  bundledCodex,
  codexControlDirectory,
  ncfCodexControlSocket,
} from '../shared/codex-desktop.js';

const maximumDesktopFrame = 128 * 1024 * 1024;
const args = process.argv.slice(2);
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
delete environment.CODEX_CLI_PATH;

function serverArgs(socket: string): string[] | undefined {
  const index = args.indexOf('app-server');
  if (index < 0) return;
  const prefix = args.slice(0, index + 1);
  const tail = args.slice(index + 1);
  if (
    (tail[0] && !tail[0].startsWith('-')) ||
    tail.some((arg) =>
      ['--help', '-h', '--print-startup-config', '--startup-sign-out'].includes(arg),
    )
  )
    return;
  const server = [];
  for (let i = 0; i < tail.length; i++) {
    const arg = tail[i]!;
    if (arg === '--stdio') continue;
    if (arg === '--listen') {
      if (tail[++i] !== 'stdio://') return;
    } else if (arg.startsWith('--listen=')) {
      if (arg !== '--listen=stdio://') return;
    } else server.push(arg);
  }
  return [...prefix, ...server, '--listen', 'unix://' + socket];
}

async function connect(socket: string, child: ChildProcess): Promise<WebSocket> {
  const deadline = Date.now() + 12_000;
  while (child.exitCode === null && child.signalCode === null && Date.now() < deadline) {
    const ws = new WebSocket('ws://localhost/rpc', {
      createConnection: () => createConnection(socket),
      handshakeTimeout: 500,
      maxPayload: maximumDesktopFrame,
    });
    const ready = await new Promise<boolean>((resolve) => {
      ws.once('open', () => resolve(true));
      ws.once('error', () => resolve(false));
    });
    if (ready) return ws;
    ws.terminate();
    await delay(50);
  }
  throw new Error('The Codex App Server did not open its private socket');
}

async function bridge(commandLine: string[], socket: string): Promise<number> {
  const child = spawn(bundledCodex, commandLine, {
    env: environment,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const exited = once(child, 'close').then(([code]) => (typeof code === 'number' ? code : 0));
  const stop = () => child.kill();
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  process.stdin.once('end', stop);
  process.stdout.once('error', stop);
  let ws: WebSocket | undefined;
  let lines: ReturnType<typeof createInterface> | undefined;
  try {
    ws = await Promise.race([
      connect(socket, child),
      exited.then(() => {
        throw new Error('The Codex App Server stopped during startup');
      }),
    ]);
    const connection = ws;
    connection.on('error', stop);
    connection.once('close', stop);
    connection.on('message', (frame, binary) => {
      if (binary) {
        stop();
        return;
      }
      if (!process.stdout.write(frame.toString() + '\n')) {
        connection.pause();
        process.stdout.once('drain', () => connection.resume());
      }
    });
    lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
    const forward = async () => {
      for await (const line of lines!) {
        if (Buffer.byteLength(line) > maximumDesktopFrame)
          throw new Error('The Codex Desktop frame exceeds the bridge size limit');
        await new Promise<void>((resolve, reject) =>
          connection.send(line, (error) => (error ? reject(error) : resolve())),
        );
      }
    };
    return await Promise.race([exited, forward().then(() => exited)]);
  } finally {
    lines?.close();
    ws?.terminate();
    stop();
    process.removeListener('SIGTERM', stop);
    process.removeListener('SIGINT', stop);
    process.stdin.removeListener('end', stop);
    process.stdout.removeListener('error', stop);
  }
}

async function main() {
  if (process.platform !== 'darwin') throw new Error('The Codex Desktop bridge requires macOS');
  const uid = process.getuid!();
  const executable = await lstat(bundledCodex);
  if (
    !executable.isFile() ||
    ![0, uid].includes(executable.uid) ||
    (executable.mode & 0o022) !== 0 ||
    (await realpath(bundledCodex)) !== bundledCodex
  )
    throw new Error('The bundled Codex executable failed its ownership check');
  const profile = environment.CODEX_HOME;
  if (!profile || !path.isAbsolute(profile)) throw new Error('Select an existing Codex home');
  const home = await realpath(profile);
  const directory = path.join(home, codexControlDirectory);
  const socket = path.join(directory, ncfCodexControlSocket);
  const commandLine = serverArgs(socket);
  if (!commandLine) {
    const cli = spawn(bundledCodex, args, { env: environment, stdio: 'inherit' });
    const [code] = await once(cli, 'exit');
    return typeof code === 'number' ? code : 1;
  }
  const homeInfo = await lstat(home);
  if (
    home !== profile ||
    !homeInfo.isDirectory() ||
    homeInfo.uid !== uid ||
    (homeInfo.mode & 0o022) !== 0
  )
    throw new Error('The selected Codex home failed its ownership check');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (
    !info.isDirectory() ||
    info.uid !== uid ||
    (info.mode & 0o022) !== 0 ||
    (await realpath(directory)) !== directory
  )
    throw new Error('The Codex control directory failed its ownership check');
  const existing = await lstat(socket).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
      return false;
    },
  );
  if (existing) throw new Error('A Codex bridge already owns this profile socket');
  return bridge(commandLine, socket);
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Could not start the Codex bridge');
  process.exitCode = 1;
}

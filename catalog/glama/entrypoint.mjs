import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import {
  access,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  stat,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const application = fileURLToPath(new URL('../../', import.meta.url));
const children = [];
const state = {
  mode: 'production Electron --background',
  launcherPid: process.pid,
  uid: process.getuid?.(),
  gid: process.getgid?.(),
  status: 'starting',
  children,
};
let directory;
let environment;
let proxy;
let stopping;
let token;

function message(text) {
  process.stderr.write('[NCF Glama] ' + text + '\n');
}

function safeError(error) {
  const text = error instanceof Error ? error.message : String(error);
  return token ? text.split(token).join('[redacted]') : text;
}

async function report() {
  if (directory)
    await writeFile(path.join(directory, 'lifecycle.json'), JSON.stringify(state, null, 2) + '\n', {
      mode: 0o600,
    });
}

function child(command, args, options = {}) {
  if (stopping) throw new Error('Startup cancelled');
  const process = spawn(command, args, { env: environment, ...options });
  const record = {
    command: path.basename(command),
    pid: process.pid ?? null,
    started: new Date().toISOString(),
  };
  children.push(record);
  const exited = new Promise((resolve) => {
    const finish = (value) => {
      if (record.finished) return;
      Object.assign(record, value, { finished: new Date().toISOString() });
      resolve(record);
    };
    process.once('error', (error) => finish({ error: safeError(error) }));
    process.once('exit', (code, signal) => finish({ code, signal }));
  });
  return { process, record, exited };
}

async function stop(reason, code = 0) {
  if (stopping) return stopping;
  stopping = (async () => {
    state.reason = reason;
    state.status = 'closing';
    process.exitCode = code;
    await report().catch((error) => message('Lifecycle report: ' + safeError(error)));
    if (proxy) await proxy.close().catch((error) => message('Proxy close: ' + safeError(error)));
    // Only disposable children created by this invocation are signalled. This is
    // container cleanup, not evidence of the application's ordinary Quit action.
    for (const item of [electron, display, sessionBus]) {
      if (!item) continue;
      if (!item.record.finished) {
        item.record.cleanupSignal = 'SIGTERM';
        item.process.kill('SIGTERM');
      }
      await item.exited;
      await report().catch((error) => message('Lifecycle report: ' + safeError(error)));
    }
    state.status = code === 0 ? 'closed' : 'failed';
    await report();
    message('Cleanup completed; private diagnostics: ' + directory);
  })().catch((error) => {
    process.exitCode = 1;
    message('Cleanup failed: ' + safeError(error));
  });
  return stopping;
}

let electron;
let display;
let sessionBus;
process.once('SIGTERM', () => void stop('SIGTERM'));
process.once('SIGINT', () => void stop('SIGINT'));
process.stdin.once('end', () => void stop('stdio EOF'));
process.stdin.once('error', (error) => void stop('stdio error: ' + safeError(error), 1));

async function waitFor(check, label) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (stopping) throw new Error('Startup cancelled');
    for (const item of [electron, display, sessionBus])
      if (item?.record.finished) throw new Error(item.record.command + ' exited during startup');
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  state.startupTimeout = label;
  throw new Error('Startup timeout: ' + label);
}

async function proxyApi() {
  for (const segment of (process.env.PATH ?? '').split(path.delimiter)) {
    const executable = path.join(segment, 'mcp-proxy');
    try {
      await access(executable, constants.X_OK);
    } catch {
      continue;
    }
    const binary = await realpath(executable);
    const root = path.resolve(path.dirname(binary), '../..');
    const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    if (manifest.name !== 'mcp-proxy' || manifest.version !== '6.9.0')
      throw new Error('Expected the platform-installed mcp-proxy@6.9.0');
    const api = await import(pathToFileURL(path.join(root, manifest.main)).href);
    if (typeof api.startStdioServer !== 'function' || api.ServerType?.HTTPStream !== 'HTTPStream')
      throw new Error('The pinned proxy does not expose its documented HTTPStream API');
    return api;
  }
  throw new Error('The platform-installed mcp-proxy executable is missing');
}

async function main() {
  if (process.platform !== 'linux' || process.arch !== 'x64')
    throw new Error('This catalog configuration requires Linux x86_64');
  if (!process.getuid?.()) throw new Error('Run this entrypoint as the dedicated nonroot user');
  if (process.argv.length !== 2) throw new Error('No runtime arguments are accepted');
  process.umask(0o077);
  const manifest = JSON.parse(await readFile(path.join(application, 'package.json'), 'utf8'));
  if (manifest.devDependencies?.electron !== '45.1.0')
    throw new Error('The reviewed Electron runtime pin changed');
  const executable = path.join(application, 'node_modules/electron/dist/electron');
  const helper = await stat(path.join(path.dirname(executable), 'chrome-sandbox'));
  if (helper.uid !== 0 || helper.gid !== 0 || (helper.mode & 0o7777) !== 0o4755)
    throw new Error('The normal Chromium sandbox helper must be root:root 4755');
  const api = await proxyApi();
  directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-glama-'));
  environment = { ...process.env };
  for (const key of [
    'ELECTRON_RUN_AS_NODE',
    'ELECTRON_DISABLE_SANDBOX',
    'CHROME_DEVEL_SANDBOX',
    'NODE_OPTIONS',
  ])
    delete environment[key];
  if (os.homedir() !== '/home/ncf') throw new Error('Expected the dedicated catalog home');
  const persistent = path.join(os.homedir(), '.ncf-glama');
  await mkdir(persistent, { recursive: true, mode: 0o700 });
  const home = path.join(persistent, 'home');
  Object.assign(environment, {
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    XDG_DATA_HOME: path.join(home, '.local/share'),
    XDG_CACHE_HOME: path.join(home, '.cache'),
    XDG_STATE_HOME: path.join(home, '.local/state'),
    XDG_RUNTIME_DIR: path.join(directory, 'runtime'),
    TMPDIR: path.join(directory, 'tmp'),
    CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
    CODEX_HOME: path.join(home, '.codex'),
    OPENCODE_CONFIG_DIR: path.join(home, '.config/opencode'),
    DISPLAY: ':99',
    XAUTHORITY: path.join(directory, 'Xauthority'),
  });
  for (const name of [
    'HOME',
    'XDG_CONFIG_HOME',
    'XDG_DATA_HOME',
    'XDG_CACHE_HOME',
    'XDG_STATE_HOME',
    'XDG_RUNTIME_DIR',
    'TMPDIR',
  ])
    await mkdir(environment[name], { recursive: true, mode: 0o700 });
  const data = path.join(persistent, 'data');
  state.dataDirectory = data;
  const { SettingsFile } = await import(
    pathToFileURL(path.join(application, 'build/core/settings.js')).href
  );
  const settings = new SettingsFile(data);
  const existing = await access(settings.filename).then(
    () => true,
    (error) => {
      if (error.code !== 'ENOENT') throw error;
      return false;
    },
  );
  await settings.load();
  if (!existing) {
    settings.value.mcpPort = 0;
    settings.value.peerPort = 0;
    settings.value.listenHost = '127.0.0.1';
    settings.value.peers = [];
    await settings.save();
  }
  token = settings.value.localToken;
  await writeFile(environment.XAUTHORITY, '', { mode: 0o600, flag: 'wx' });
  const authority = child('xauth', ['-q', '-f', environment.XAUTHORITY], {
    stdio: ['pipe', 'ignore', 'ignore'],
  });
  authority.process.stdin.end('add :99 . ' + randomBytes(16).toString('hex') + '\n');
  await authority.exited;
  if (authority.record.code !== 0)
    throw new Error('Could not initialize private display authentication');
  try {
    await access('/tmp/.X11-unix/X99');
    throw new Error('The isolated display is already occupied');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const displayLog = await open(path.join(directory, 'xvfb.stderr.log'), 'wx', 0o600);
  display = child(
    'Xvfb',
    [':99', '-screen', '0', '1280x800x24', '-nolisten', 'tcp', '-auth', environment.XAUTHORITY],
    {
      stdio: ['ignore', 'ignore', displayLog.fd],
    },
  );
  await displayLog.close();
  await waitFor(
    async () =>
      access('/tmp/.X11-unix/X99').then(
        () => true,
        () => false,
      ),
    'private display',
  );
  const busLog = await open(path.join(directory, 'dbus.stderr.log'), 'wx', 0o600);
  sessionBus = child('dbus-daemon', ['--session', '--nofork', '--nopidfile', '--print-address=1'], {
    stdio: ['ignore', 'pipe', busLog.fd],
  });
  await busLog.close();
  let busAddress = '';
  sessionBus.process.stdout.on('data', (chunk) => {
    busAddress += chunk.toString();
  });
  await waitFor(() => busAddress.includes('\n'), 'private session bus');
  if (busAddress.length > 4096 || !busAddress.trim().startsWith('unix:'))
    throw new Error('Unexpected private session bus address');
  environment.DBUS_SESSION_BUS_ADDRESS = busAddress.trim();
  const stdout = await open(path.join(directory, 'electron.stdout.log'), 'wx', 0o600);
  const stderr = await open(path.join(directory, 'electron.stderr.log'), 'wx', 0o600);
  const args = [application, '--background', '--data-dir', data];
  state.electronArgs = args;
  state.sandbox = {
    helper: 'root:root 4755',
    actualMainArgvChecked: false,
    rendererAcceptance: false,
  };
  electron = child(executable, args, { stdio: ['ignore', stdout.fd, stderr.fd] });
  await Promise.all([stdout.close(), stderr.close()]);
  await report();
  message('Production Electron started; private diagnostics: ' + directory);
  const descriptor = await waitFor(async () => {
    try {
      return JSON.parse(await readFile(path.join(data, 'Integrations/node.json'), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }, 'application MCP descriptor');
  const url = new URL(descriptor.url);
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    url.pathname !== '/mcp' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    descriptor.token !== token ||
    !/^[a-f0-9]{64}$/.test(descriptor.token)
  )
    throw new Error('The application descriptor is not the expected private loopback endpoint');
  if (stopping) throw new Error('Startup cancelled');
  const mainArguments = (await readFile('/proc/' + electron.record.pid + '/cmdline', 'utf8'))
    .split('\0')
    .filter(Boolean);
  if (
    mainArguments.some((value) =>
      /^--(?:no-sandbox|disable-setuid-sandbox|disable-gpu)(?:=|$)/.test(value),
    )
  )
    throw new Error('Production sandbox runtime arguments were changed');
  state.actualMainArguments = mainArguments;
  state.sandbox.actualMainArgvChecked = true;
  proxy = await api.startStdioServer({
    serverType: api.ServerType.HTTPStream,
    upstreamProtocol: 'legacy',
    url: descriptor.url,
    transportOptions: { requestInit: { headers: { authorization: 'Bearer ' + token } } },
  });
  if (stopping) {
    await proxy.close();
    return;
  }
  const previousClose = proxy.onclose;
  proxy.onclose = () => {
    previousClose?.();
    void stop('proxy closed');
  };
  state.status = 'ready';
  await report();
  void electron.exited.then(() => {
    if (!stopping) void stop('Electron exited', 1);
  });
  void display.exited.then(() => {
    if (!stopping) void stop('Display exited', 1);
  });
  void sessionBus.exited.then(() => {
    if (!stopping) void stop('Session bus exited', 1);
  });
}

main().catch(async (error) => {
  message('Startup failed: ' + safeError(error));
  state.error = safeError(error);
  await report().catch(() => {});
  await stop('startup failure', 1);
});

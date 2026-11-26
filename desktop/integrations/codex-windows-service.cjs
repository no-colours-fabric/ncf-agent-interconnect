'use strict';
const fs = require('node:fs/promises');
const physicalFs = (() => {
  try {
    return require('original-fs').promises;
  } catch {
    return fs;
  }
})();
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createInterface } = require('node:readline');
const { EventEmitter } = require('node:events');
const { Duplex } = require('node:stream');
const { randomUUID } = require('node:crypto');
const { watch } = require('node:fs');
const bridge = require('./codex-windows-bridge.cjs');
const execute = promisify(execFile);
const runName = 'NCF ChatGPT Session Service';

function parseSettings(text) {
  const m = JSON.parse(text);
  if (
    !m ||
    Object.keys(m).sort().join(',') !== 'enabled,pipeId,profile,version' ||
    m.version !== 1 ||
    typeof m.enabled !== 'boolean' ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(m.pipeId) ||
    typeof m.profile !== 'string' ||
    !path.win32.isAbsolute(m.profile) ||
    !/^[a-z]:\\/i.test(m.profile) ||
    /[\0\r\n"]/.test(m.profile)
  )
    throw Error('NCF_CHATGPT_SERVICE_SETTINGS');
  return m;
}
function locations(options) {
  return {
    directory: path.join(options.userData, 'ChatGPT Session Delivery'),
    broker: path.join(options.appPath + '.unpacked', 'build', 'assets', 'codex-win-pipe.exe'),
    script: path.join(options.appPath, 'build', 'integrations', 'codex-windows-service.cjs'),
  };
}
function address(m) {
  return 'ws+unix://localhost//.\\pipe\\ncf-chatgpt-' + m.pipeId + ':/rpc';
}
function runCommand(options) {
  if (/["\0\r\n]/.test(options.appExecutable)) throw Error('NCF_CHATGPT_SERVICE_IMAGE');
  return '"' + options.appExecutable + '" --chatgpt-service';
}
async function readSettings(options, verifyOwnership = true) {
  const a = locations(options);
  try {
    await bridge.canonical(a.directory, true);
    if (verifyOwnership) await bridge.privatePath(a.directory, true);
    const file = path.join(a.directory, 'service.json');
    await bridge.canonical(file, false);
    if (verifyOwnership) await bridge.privatePath(file, false);
    const info = await physicalFs.lstat(file);
    if (info.size > 16384 || info.nlink !== 1) throw Error('NCF_CHATGPT_SERVICE_SETTINGS');
    return parseSettings(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
async function saveSettings(options, m) {
  parseSettings(JSON.stringify(m));
  const a = locations(options);
  try {
    await fs.mkdir(a.directory);
    await bridge.privatePath(a.directory, true, true);
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    await bridge.privatePath(a.directory, true);
  }
  const temporary = path.join(a.directory, randomUUID() + '.tmp');
  try {
    await fs.writeFile(temporary, JSON.stringify(m) + '\n', { flag: 'wx' });
    await bridge.privatePath(temporary, false, true);
    await fs.rename(temporary, path.join(a.directory, 'service.json'));
  } finally {
    await fs.unlink(temporary).catch(() => {});
  }
}
async function registry(options, m, action) {
  if (!['status', 'publish', 'withdraw'].includes(action))
    throw Error('NCF_CHATGPT_SERVICE_ACTION');
  return JSON.parse(
    await bridge.runPowerShell(
      String.raw`
$d=$env:NCF_LAUNCH_DATA|ConvertFrom-Json
$environment=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment',$d.action -ne 'status')
$run=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\Run',$d.action -ne 'status')
if (!$environment -and $d.action -eq 'publish') {$environment=[Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Environment')}
if (!$run -and $d.action -eq 'publish') {$run=[Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Software\Microsoft\Windows\CurrentVersion\Run')}
try {
  $oldEnv=if($environment){$environment.GetValue('CODEX_APP_SERVER_WS_URL',$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)}else{$null}
  $oldRun=if($run){$run.GetValue($d.runName,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)}else{$null}
  $foreign=($null -ne $oldEnv -and $oldEnv -cne $d.url) -or ($null -ne $oldRun -and $oldRun -cne $d.command)
  if ($d.action -eq 'publish' -and !$foreign) {
    try {
      if ($environment.GetValue('CODEX_APP_SERVER_WS_URL',$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) -cne $oldEnv -or $run.GetValue($d.runName,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) -cne $oldRun) {throw 'changed'}
      $run.SetValue($d.runName,$d.command,[Microsoft.Win32.RegistryValueKind]::String)
      if ($environment.GetValue('CODEX_APP_SERVER_WS_URL',$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) -cne $oldEnv) {throw 'changed'}
      $environment.SetValue('CODEX_APP_SERVER_WS_URL',$d.url,[Microsoft.Win32.RegistryValueKind]::String)
    } catch {
      if ($run.GetValue($d.runName,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) -ceq $d.command -and $null -eq $oldRun) {$run.DeleteValue($d.runName,$false)}
      if ($environment.GetValue('CODEX_APP_SERVER_WS_URL',$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) -ceq $d.url -and $null -eq $oldEnv) {$environment.DeleteValue('CODEX_APP_SERVER_WS_URL',$false)}
      throw
    }
  }
  if ($d.action -eq 'withdraw') {
    if ($null -ne $environment -and $environment.GetValue('CODEX_APP_SERVER_WS_URL',$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) -ceq $d.url) {$environment.DeleteValue('CODEX_APP_SERVER_WS_URL',$false)}
    if ($null -ne $run -and $run.GetValue($d.runName,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) -ceq $d.command) {$run.DeleteValue($d.runName,$false)}
  }
  [pscustomobject]@{conflict=$foreign;published=($oldEnv -ceq $d.url -and $oldRun -ceq $d.command);selectorOwned=($oldEnv -ceq $d.url);autorunOwned=($oldRun -ceq $d.command)}|ConvertTo-Json -Compress
} finally {if($environment){$environment.Dispose()};if($run){$run.Dispose()}}
`,
      { action, url: address(m), command: runCommand(options), runName },
      5000,
    ),
  );
}
async function broadcast(options) {
  // This notification contains no environment values and requests no elevation.
  await execute(locations(options).broker, ['--environment-changed'], {
    windowsHide: true,
    timeout: 3000,
    maxBuffer: 8192,
  });
}
async function control(options, m, action) {
  const { stdout } = await execute(
    locations(options).broker,
    ['--control', 'ncf-chatgpt-' + m.pipeId, action],
    { windowsHide: true, timeout: 25000, maxBuffer: 16384, encoding: 'utf8' },
  );
  const value = JSON.parse(stdout);
  if (value?.state === 'absent') throw Error('NCF_CHATGPT_SERVICE_ABSENT');
  return value;
}
async function validateRuntime(options, m) {
  if (
    path.basename(options.appPath).toLowerCase() !== 'app.asar' ||
    path.resolve(options.appExecutable).toLowerCase() !== process.execPath.toLowerCase()
  )
    throw Error('NCF_CHATGPT_SERVICE_RUNTIME');
  if (
    path.resolve(__dirname).toLowerCase() !==
    path.join(options.appPath, 'build', 'integrations').toLowerCase()
  )
    throw Error('NCF_CHATGPT_SERVICE_SOURCE');
  await bridge.canonical(options.userData, true);
  await bridge.canonical(options.appExecutable, false);
  await bridge.canonical(options.appPath, false);
  await bridge.canonical(m.profile, true);
  const a = locations(options);
  await bridge.canonical(a.broker, false);
  const stampFile = await bridge.canonical(
    path.join(path.dirname(options.appPath), 'ncf-launcher-identity.json'),
    false,
  );
  const stamp = JSON.parse(await fs.readFile(stampFile, 'utf8'));
  if (
    stamp.version !== 1 ||
    !/^[a-f0-9]{64}$/.test(stamp.pipeHash ?? '') ||
    (await bridge.fileHash(options.appPath)) !== stamp.asarHash ||
    (await bridge.fileHash(a.broker)) !== stamp.pipeHash ||
    (await bridge.fileHash(bridge.assets(options.appPath).helper)) !== stamp.helperHash
  )
    throw Error('NCF_CHATGPT_SERVICE_ASSET_IDENTITY');
  const pkg = await bridge.inspectPackage();
  await bridge.resolveVendor(pkg);
  const signature = JSON.parse(
    await bridge.runPowerShell(
      "$d=$env:NCF_LAUNCH_DATA|ConvertFrom-Json;$s=Get-AuthenticodeSignature -LiteralPath $d.image;[pscustomobject]@{valid=($s.Status -eq 'Valid');vendor=($s.SignerCertificate.Subject -match 'OpenAI OpCo')}|ConvertTo-Json -Compress",
      { image: path.join(pkg.root, 'app', 'ChatGPT.exe') },
    ),
  );
  if (!signature.valid || !signature.vendor) throw Error('NCF_CHATGPT_SERVICE_VENDOR');
  return pkg;
}
async function prepareControl(m) {
  const directory = path.join(m.profile, 'app-server-control');
  try {
    await fs.mkdir(directory);
    await bridge.privatePath(directory, true, true);
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    await bridge.privatePath(directory, true);
  }
}
async function startNow(options, m) {
  try {
    return await control(options, m, 'status');
  } catch (e) {
    if (e.message !== 'NCF_CHATGPT_SERVICE_ABSENT') return { state: 'unavailable' };
  }
  const pkg = await validateRuntime(options, m);
  if (pkg.running) return { state: 'close-required' };
  const a = locations(options);
  const child = spawn(
    options.appExecutable,
    [a.script, '--state', options.userData, '--app-path', options.appPath],
    {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      windowsHide: true,
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    },
  );
  child.on('error', () => {});
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('NCF_CHATGPT_SERVICE_STARTUP')), 20000);
      child.once('message', (value) => {
        clearTimeout(timer);
        resolve(value);
      });
      child.once('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.once('exit', () => {
        clearTimeout(timer);
        reject(Error('NCF_CHATGPT_SERVICE_EXIT'));
      });
    });
  } finally {
    child.disconnect?.();
    child.unref();
  }
}
const startups = new Map();
function start(options, m) {
  const key = path.resolve(options.userData).toLowerCase();
  let pending = startups.get(key);
  if (!pending) {
    pending = startNow(options, m);
    startups.set(key, pending);
    pending
      .finally(() => {
        if (startups.get(key) === pending) startups.delete(key);
      })
      .catch(() => {});
  }
  return pending;
}
async function run(options) {
  const m = await readSettings(options);
  if (!m?.enabled) return;
  const prior = await registry(options, m, 'status');
  if (prior.conflict) throw Error('NCF_CHATGPT_SERVICE_CONFLICT');
  const pkg = await validateRuntime(options, m),
    a = locations(options),
    helpers = new Map(),
    bus = new EventEmitter();
  if (pkg.running) {
    process.send?.({ state: 'close-required' });
    return;
  }
  await prepareControl(m);
  let endpointChanged = false;
  const watcher = watch(path.join(m.profile, 'app-server-control'), (_event, filename) => {
    if (String(filename) === 'app-server-control.sock') {
      endpointChanged = true;
      bus.emit('change');
    }
  });
  const broker = spawn(
    a.broker,
    [
      '--serve',
      'ncf-chatgpt-' + m.pipeId,
      path.join(pkg.root, 'app', 'ChatGPT.exe'),
      path.basename(pkg.root),
      m.profile,
      path.join(process.env.APPDATA, 'Codex'),
      options.appExecutable,
    ],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  let ready = false,
    serverPid,
    ended = false,
    advertised = false,
    stopping,
    gracefulStopping = false,
    serverStopped,
    serverLost = false,
    changing = false,
    modeEnabled = m.enabled,
    controlDone = new Set();
  const closing = new Promise((resolve) =>
    broker.once('close', (code) => {
      ended = true;
      bus.emit('change');
      resolve(code);
    }),
  );
  broker.on('error', () => {
    ended = true;
    bus.emit('change');
  });
  broker.stderr.on('data', () => {});
  process.once('disconnect', () => {
    if (!advertised) broker.stdin.end();
  });
  function send(value) {
    return broker.stdin.write(JSON.stringify(value) + '\n');
  }
  function within(check, ms, label) {
    if (check()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const update = () => {
        if (check()) {
          clearTimeout(timer);
          bus.off('change', update);
          resolve();
        } else if (ended) {
          clearTimeout(timer);
          bus.off('change', update);
          reject(Error(label));
        }
      };
      const timer = setTimeout(() => {
        bus.off('change', update);
        reject(Error(label));
      }, ms);
      bus.on('change', update);
      update();
    });
  }
  async function finish(preserve = false) {
    if (stopping) return stopping;
    return (stopping = (async () => {
      for (const helper of helpers.values()) helper.stdin.end();
      send({ kind: 'shutdown', preserve });
      const code = await closing;
      if (code !== 0) throw Error('NCF_CHATGPT_SERVICE_CLOSE');
    })());
  }
  createInterface({ input: broker.stdout }).on('line', (line) => {
    if (line.length > 196608) {
      broker.stdin.end();
      return;
    }
    const value = JSON.parse(line);
    if (value.kind === 'server') serverPid = value.pid;
    else if (value.kind === 'serverStopped') serverStopped = value.ok;
    else if (value.kind === 'serverExit') {
      if (!gracefulStopping) {
        serverLost = true;
        broker.stdin.end();
      }
    } else if (value.kind === 'ready') ready = true;
    else if (value.kind === 'open') {
      if (!Number.isSafeInteger(serverPid) || helpers.size >= 8) {
        send({ kind: 'close', id: value.id });
        return;
      }
      const helper = spawn(
        bridge.assets(options.appPath).helper,
        [path.join(m.profile, 'app-server-control', 'app-server-control.sock'), String(serverPid)],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      helpers.set(value.id, helper);
      helper.stderr.on('data', () => {});
      helper.on('error', () => send({ kind: 'close', id: value.id }));
      helper.stdin.on('error', () => send({ kind: 'close', id: value.id }));
      void fs
        .writeFile(
          path.join(a.directory, 'launch.json'),
          JSON.stringify({ profile: m.profile, pid: value.pid, serverPid, at: Date.now() }) + '\n',
        )
        .catch(() => {});
      helper.stdout.on('data', (bytes) => {
        if (!send({ kind: 'write', id: value.id, data: bytes.toString('base64') })) {
          helper.stdout.pause();
          broker.stdin.once('drain', () => helper.stdout.resume());
        }
      });
      helper.once('close', () => {
        helpers.delete(value.id);
        if (!ended) send({ kind: 'close', id: value.id });
      });
    } else if (value.kind === 'data') {
      const helper = helpers.get(value.id);
      if (!helper || typeof value.data !== 'string' || value.data.length > 87384) {
        send({ kind: 'close', id: value.id });
        return;
      }
      if (!helper.stdin.write(Buffer.from(value.data, 'base64'))) {
        broker.stdout.pause();
        helper.stdin.once('drain', () => broker.stdout.resume());
      }
    } else if (value.kind === 'close') {
      const helper = helpers.get(value.id);
      helper?.stdin.end();
    } else if (value.kind === 'controlDone') controlDone.add(value.id);
    else if (value.kind === 'control') {
      void (async () => {
        if (value.action === 'status') {
          send({
            kind: 'respond',
            id: value.id,
            value:
              changing || !advertised
                ? { state: 'unavailable' }
                : { state: modeEnabled ? 'enabled' : 'ready', profile: m.profile, scope: 'user' },
          });
          return;
        }
        if (changing) {
          send({ kind: 'respond', id: value.id, value: { state: 'unavailable' } });
          return;
        }
        if (value.active || helpers.size) {
          send({ kind: 'respond', id: value.id, value: { state: 'close-required' } });
          return;
        }
        changing = true;
        gracefulStopping = true;
        serverStopped = undefined;
        send({ kind: 'stopServer' });
        await within(
          () => typeof serverStopped === 'boolean',
          17000,
          'NCF_CHATGPT_SERVICE_GRACEFUL_STOP',
        );
        if (!serverStopped) {
          gracefulStopping = false;
          send({ kind: 'respond', id: value.id, value: { state: 'unavailable' } });
          return;
        }
        if (value.action === 'disable') {
          await registry(options, m, 'withdraw');
          await broadcast(options);
          await saveSettings(options, { ...m, enabled: false });
          modeEnabled = false;
          advertised = false;
        }
        send({
          kind: 'respond',
          id: value.id,
          value: { state: 'ready', profile: m.profile, scope: 'user' },
        });
        await within(() => controlDone.has(value.id), 3000, 'NCF_CHATGPT_SERVICE_CONTROL_ACK');
        await finish(value.action === 'stop');
      })()
        .catch(() => {
          if (!ended) send({ kind: 'respond', id: value.id, value: { state: 'unavailable' } });
        })
        .finally(() => {
          changing = false;
        });
    }
    bus.emit('change');
  });
  try {
    await within(
      () => ready && Number.isSafeInteger(serverPid) && endpointChanged,
      10000,
      'NCF_CHATGPT_SERVICE_PIPE',
    );
    const WebSocket = require('ws');
    // Probe through the unchanged authenticated AF_UNIX helper; never trust a socket filename.
    for (let attempt = 0; attempt < 4; attempt++) {
      const helper = spawn(
        bridge.assets(options.appPath).helper,
        [path.join(m.profile, 'app-server-control', 'app-server-control.sock'), String(serverPid)],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const closed = new Promise((resolve) => helper.once('close', resolve));
      let guard = '';
      helper.stderr.on('data', (bytes) => {
        guard = bytes.toString().match(/NCF_UDS_[A-Z_]+ code=-?\d+/)?.[0] ?? guard;
      });
      const stream = Duplex.from({ readable: helper.stdout, writable: helper.stdin });
      stream.setTimeout = stream.setNoDelay = stream.setKeepAlive = () => stream;
      helper.on('error', (e) => stream.destroy(e));
      helper.stdin.on('error', (e) => stream.destroy(e));
      const ws = new WebSocket('ws://localhost/rpc', {
        createConnection: () => stream,
        handshakeTimeout: 5000,
      });
      ws.on('error', () => {});
      try {
        await new Promise((resolve, reject) => {
          ws.once('open', resolve);
          ws.once('error', reject);
        });
        break;
      } catch (error) {
        ws.terminate();
        helper.stdin.end();
        await closed;
        // The helper proved that no connection, hence no request body, was released.
        if (
          !/^NCF_UDS_(CONNECT code=10061|DIRECTORY_OPEN code=(2|3))$/.test(guard) ||
          attempt === 3
        )
          throw error;
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
      } finally {
        ws.terminate();
        helper.stdin.end();
      }
    }
    const selected = await readSettings(options, false);
    if (
      !process.connected ||
      serverLost ||
      !selected?.enabled ||
      selected.pipeId !== m.pipeId ||
      selected.profile !== m.profile
    )
      throw Error('NCF_CHATGPT_SERVICE_STARTUP_CANCELLED');
    const publication = await registry(options, m, 'publish');
    if (publication.conflict) throw Error('NCF_CHATGPT_SERVICE_CONFLICT');
    const current = await readSettings(options, false);
    if (!current?.enabled || current.pipeId !== m.pipeId || current.profile !== m.profile) {
      await registry(options, m, 'withdraw');
      throw Error('NCF_CHATGPT_SERVICE_STARTUP_CANCELLED');
    }
    await broadcast(options);
    advertised = true;
    if (process.connected) process.send({ state: 'enabled', profile: m.profile, scope: 'user' });
    const code = await closing;
    if (code !== 0 || serverLost) throw Error('NCF_CHATGPT_SERVICE_EXIT');
  } finally {
    watcher.close();
    // Withdraw only our exact advertised route on an unexpected loss. An upgrade stop retains it.
    if (advertised && !stopping) {
      await registry(options, m, 'withdraw').catch(() => {});
      await broadcast(options).catch(() => {});
    }
    for (const helper of helpers.values()) helper.stdin.end();
    if (!ended) await finish().catch(() => {});
  }
}
module.exports = {
  parseSettings,
  locations,
  address,
  runCommand,
  readSettings,
  saveSettings,
  registry,
  broadcast,
  control,
  validateRuntime,
  start,
  run,
};
if (require.main === module) {
  const argv = process.argv.slice(2);
  if (
    argv.length !== 4 ||
    argv[0] !== '--state' ||
    argv[2] !== '--app-path' ||
    process.env.ELECTRON_RUN_AS_NODE !== '1'
  )
    process.exitCode = 1;
  else
    run({ userData: argv[1], appPath: argv[3], appExecutable: process.execPath }).catch(() => {
      if (process.connected) process.send({ state: 'unavailable' });
      process.exitCode = 1;
    });
}

// Physical identity checks must see app.asar as a file in Electron. Keep normal
// require() unchanged so the bridge and its dependencies still load inside ASAR.
const physicalFs = process.versions.electron ? require('original-fs') : require('node:fs');
const fs = physicalFs.promises;
const { createReadStream } = physicalFs;
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { once } = require('node:events');
const { Duplex } = require('node:stream');
const { createInterface } = require('node:readline');

const fields = [
  'version',
  'userData',
  'profile',
  'desktopData',
  'appExecutable',
  'appPath',
  'appExecutableHash',
  'asarHash',
  'shimHash',
  'helperHash',
  'stopHash',
  'packageVersion',
  'bundleKey',
  'originalCliHash',
];
const vendorNames = [
  'codex.exe',
  'codex-code-mode-host.exe',
  'codex-windows-sandbox-setup.exe',
  'codex-command-runner.exe',
];
const maximumFrame = 128 * 1024 * 1024;
const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const keyFor = (profile, desktopData) =>
  createHash('sha256')
    .update(profile.toLowerCase())
    .update('\0')
    .update(desktopData.toLowerCase())
    .digest('hex')
    .slice(0, 32);
const powershell = () =>
  path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );

async function runPowerShell(script, data, timeout = 15000) {
  const { stdout } = await promisify(execFile)(
    powershell(),
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(
        "$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';$env:PSModulePath=[IO.Path]::Combine($PSHOME,'Modules');" +
          script,
        'utf16le',
      ).toString('base64'),
    ],
    {
      windowsHide: true,
      timeout,
      maxBuffer: 32768,
      env: { ...process.env, NCF_LAUNCH_DATA: JSON.stringify(data) },
    },
  );
  return stdout.trim();
}

async function canonical(filename, directory) {
  if (
    typeof filename !== 'string' ||
    !/^[a-z]:[\\/]/i.test(filename) ||
    /[\0\r\n]/.test(filename) ||
    filename.slice(2).includes(':') ||
    !same(filename, path.normalize(filename))
  )
    throw Error('NCF_CODEX_PATH');
  const full = path.resolve(filename);
  if (!same(await fs.realpath(full), full)) throw Error('NCF_CODEX_ALIAS');
  let item = full;
  for (;;) {
    const info = await fs.lstat(item);
    if (info.isSymbolicLink()) throw Error('NCF_CODEX_REPARSE');
    if (
      item === full &&
      (info.isDirectory() !== directory || (!directory && (!info.isFile() || info.nlink !== 1)))
    )
      throw Error('NCF_CODEX_FILE');
    const parent = path.dirname(item);
    if (parent === item) break;
    item = parent;
  }
  return full;
}

async function fileHash(filename) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(filename)) digest.update(chunk);
  return digest.digest('hex');
}

async function verifyNoReparseChain(paths) {
  await runPowerShell(
    String.raw`
$d=$env:NCF_LAUNCH_DATA|ConvertFrom-Json
foreach ($p in $d.paths) {
  $cursor=[IO.Path]::GetFullPath($p)
  while ($cursor) {
    $item=Get-Item -LiteralPath $cursor -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {throw 'reparse'}
    $parent=[IO.Directory]::GetParent($cursor)
    if ($null -eq $parent) {break}
    $cursor=$parent.FullName
  }
}
[Console]::Out.Write('OK')`,
    { paths },
  );
}

// Only an NCF-owned launcher directory/file can be protected. Existing client files are read-only.
async function privatePath(filename, directory, protect = false) {
  await canonical(filename, directory);
  await runPowerShell(
    String.raw`
$d=$env:NCF_LAUNCH_DATA|ConvertFrom-Json
$i=Get-Item -LiteralPath $d.path -Force
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
if (([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {throw 'elevated'}
if (($i.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {throw 'reparse'}
$sections=[Security.AccessControl.AccessControlSections]::Owner -bor [Security.AccessControl.AccessControlSections]::Access
if ($i.GetAccessControl($sections).GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) {throw 'owner'}
if ($d.protect) {
  if ($d.directory) {$acl=[Security.AccessControl.DirectorySecurity]::new();$flags='ContainerInherit,ObjectInherit'}
  else {$acl=[Security.AccessControl.FileSecurity]::new();$flags='None'}
  $acl.SetAccessRuleProtection($true,$false)
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl',$flags,'None','Allow'))
  $i.SetAccessControl($acl)
}
$acl=$i.GetAccessControl($sections)
$rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
if (!$acl.AreAccessRulesProtected -or $rules.Count -ne 1) {throw 'rules'}
$r=$rules[0]
if ($r.IdentityReference.Value -ne $sid.Value -or $r.IsInherited -or $r.AccessControlType -ne 'Allow' -or $r.FileSystemRights -ne 'FullControl' -or $r.PropagationFlags -ne 'None') {throw 'rights'}
if ($d.directory -and $r.InheritanceFlags -ne 'ContainerInherit, ObjectInherit') {throw 'flags'}
if (!$d.directory -and $r.InheritanceFlags -ne 'None') {throw 'flags'}
[Console]::Out.Write('OK')`,
    { path: filename, directory, protect },
  );
}

async function inspectPackage(waitForExit = false) {
  const result = JSON.parse(
    await runPowerShell(
      String.raw`
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
if (([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {throw 'elevated'}
$packages=@(Get-AppxPackage -Name OpenAI.Codex)
if ($packages.Count -ne 1) {throw 'package'}
$p=$packages[0];$m=Get-AppxPackageManifest -Package $p.PackageFullName
$a=@($m.Package.Applications.Application|Where-Object {$_.Id -eq 'App'})
if ($p.PackageFamilyName -ne 'OpenAI.Codex_2p2nqsd0c76g0' -or $a.Count -ne 1 -or $a[0].Executable.Replace('\','/') -ne 'app/ChatGPT.exe' -or $a[0].EntryPoint -ne 'Windows.FullTrustApplication') {throw 'identity'}
if ($a[0].SelectNodes(".//*[local-name()='ExecutionAlias' and @Alias='chatgpt-desktop.exe']").Count -ne 1) {throw 'alias'}
$alias=Join-Path $env:LOCALAPPDATA ('Microsoft\WindowsApps\'+$p.PackageFamilyName+'\chatgpt-desktop.exe')
$i=Get-Item -LiteralPath $alias -Force
if ($i.Length -ne 0 -or ($i.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) {throw 'appexeclink'}
$session=[Diagnostics.Process]::GetCurrentProcess().SessionId
$running=@(Get-Process -Name ChatGPT -ErrorAction SilentlyContinue|Where-Object {$_.SessionId -eq $session})
$d=$env:NCF_LAUNCH_DATA|ConvertFrom-Json
if ($d.waitForExit -and $running.Count -gt 0) {
  $deadline=[DateTime]::UtcNow.AddSeconds(20)
  while ($running.Count -gt 0 -and [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 500
    $running=@(Get-Process -Name ChatGPT -ErrorAction SilentlyContinue|Where-Object {$_.SessionId -eq $session})
  }
}
[pscustomobject]@{version=[string]$p.Version;root=$p.InstallLocation;alias=$alias;running=$running.Count}|ConvertTo-Json -Compress`,
      { waitForExit },
      waitForExit ? 30000 : 15000,
    ),
  );
  if (
    !result ||
    typeof result.version !== 'string' ||
    !/^\d+\.\d+\.\d+\.\d+$/.test(result.version) ||
    typeof result.running !== 'number'
  )
    throw Error('NCF_CODEX_PACKAGE');
  await canonical(result.root, true);
  await canonical(path.join(result.root, 'app', 'ChatGPT.exe'), false);
  return result;
}

async function resolveVendor(packageInfo) {
  const source = path.join(packageInfo.root, 'app', 'resources');
  const digest = createHash('sha256');
  const components = [];
  for (const name of vendorNames) {
    const file = await canonical(path.join(source, name), false);
    const hash = await fileHash(file);
    const size = (await fs.stat(file)).size;
    components.push({ name, hash, size });
    digest.update(name).update('\0').update(hash).update('\0');
  }
  const bundleKey = digest.digest('hex').slice(0, 16);
  if (!process.env.LOCALAPPDATA) throw Error('NCF_CODEX_CACHE');
  const cache = await canonical(
    path.join(process.env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin', bundleKey),
    true,
  );
  await verifyNoReparseChain([
    ...vendorNames.map((name) => path.join(source, name)),
    ...vendorNames.map((name) => path.join(cache, name)),
  ]);
  for (const part of components) {
    const file = await canonical(path.join(cache, part.name), false);
    if ((await fs.stat(file)).size !== part.size || (await fileHash(file)) !== part.hash)
      throw Error('NCF_CODEX_CACHE_IDENTITY');
  }
  return {
    originalCli: path.join(cache, 'codex.exe'),
    originalCliHash: components[0].hash,
    bundleKey,
  };
}

function assets(appPath) {
  if (path.basename(appPath).toLowerCase() !== 'app.asar') throw Error('NCF_CODEX_PACKAGED_ONLY');
  return {
    bridge: path.join(appPath, 'build', 'integrations', 'codex-windows-bridge.cjs'),
    shim: path.join(appPath + '.unpacked', 'build', 'assets', 'codex-stdio-shim.exe'),
    helper: path.join(appPath + '.unpacked', 'build', 'assets', 'codex-win-socket.exe'),
    stop: path.join(appPath + '.unpacked', 'build', 'assets', 'codex-console-stop.exe'),
  };
}

function parseManifest(text) {
  if (Buffer.byteLength(text) > 32768) throw Error('NCF_CODEX_MANIFEST_SIZE');
  const m = JSON.parse(text);
  if (!m || Object.keys(m).sort().join() !== [...fields].sort().join() || m.version !== 1)
    throw Error('NCF_CODEX_MANIFEST');
  for (const name of fields.filter((f) => f !== 'version'))
    if (typeof m[name] !== 'string' || !m[name]) throw Error('NCF_CODEX_MANIFEST');
  for (const name of [
    'appExecutableHash',
    'asarHash',
    'shimHash',
    'helperHash',
    'stopHash',
    'originalCliHash',
  ])
    if (!/^[a-f0-9]{64}$/.test(m[name])) throw Error('NCF_CODEX_MANIFEST_HASH');
  if (!/^[a-f0-9]{16}$/.test(m.bundleKey) || !/^\d+\.\d+\.\d+\.\d+$/.test(m.packageVersion))
    throw Error('NCF_CODEX_MANIFEST_IDENTITY');
  return m;
}

async function validateManifest(filename, expected) {
  await canonical(filename, false);
  const m = parseManifest(await fs.readFile(filename, 'utf8'));
  const userData = await canonical(expected?.userData || m.userData, true);
  const root = path.join(userData, 'codex-launchers');
  const directory = path.join(root, keyFor(m.profile, m.desktopData));
  if (!same(filename, path.join(directory, 'manifest.json')) || !same(m.userData, userData))
    throw Error('NCF_CODEX_MANIFEST_SCOPE');
  await privatePath(root, true);
  await privatePath(directory, true);
  await privatePath(filename, false);
  for (const name of ['profile', 'desktopData']) await canonical(m[name], true);
  if (
    Buffer.byteLength(path.join(m.profile, 'app-server-control', 'app-server-control.sock')) >= 108
  )
    throw Error('NCF_CODEX_SOCKET_LENGTH');
  if (
    expected &&
    (!same(m.appExecutable, expected.appExecutable) || !same(m.appPath, expected.appPath))
  )
    throw Error('NCF_CODEX_NCF_IDENTITY');
  const a = assets(m.appPath);
  await verifyNoReparseChain([
    m.userData,
    m.profile,
    m.desktopData,
    m.appExecutable,
    m.appPath,
    a.shim,
    a.helper,
    a.stop,
    filename,
  ]);
  for (const [file, hash] of [
    [m.appExecutable, m.appExecutableHash],
    [m.appPath, m.asarHash],
    [a.shim, m.shimHash],
    [a.helper, m.helperHash],
    [a.stop, m.stopHash],
    [path.join(directory, 'codex-stdio-shim.exe'), m.shimHash],
  ]) {
    await canonical(file, false);
    if ((await fileHash(file)) !== hash) throw Error('NCF_CODEX_ASSET_IDENTITY');
  }
  const pkg = await inspectPackage();
  if (pkg.version !== m.packageVersion) throw Error('NCF_CODEX_VERSION_CHANGED');
  const vendor = await resolveVendor(pkg);
  if (vendor.bundleKey !== m.bundleKey || vendor.originalCliHash !== m.originalCliHash)
    throw Error('NCF_CODEX_VENDOR_CHANGED');
  return { m, a, pkg, vendor, directory };
}

function selectServerArgs(args, socket) {
  let index = 0;
  while (index < args.length && args[index].startsWith('-')) {
    if (['-c', '--config', '--enable', '--disable'].includes(args[index])) {
      if (++index >= args.length) return;
    } else if (
      !['--config=', '--enable=', '--disable='].some((prefix) => args[index].startsWith(prefix))
    )
      return;
    index++;
  }
  if (args[index] !== 'app-server') return;
  const tail = args.slice(index + 1);
  if (
    (tail[0] && !tail[0].startsWith('-')) ||
    tail.some((arg) =>
      ['--help', '-h', '--print-startup-config', '--startup-sign-out'].includes(arg),
    )
  )
    return;
  const forwarded = [];
  for (let i = 0; i < tail.length; i++) {
    const arg = tail[i];
    if (arg === '--stdio') continue;
    if (arg === '--listen') {
      if (tail[++i] !== 'stdio://') return;
    } else if (arg.startsWith('--listen=')) {
      if (arg !== '--listen=stdio://') return;
    } else forwarded.push(arg);
  }
  return [
    ...args.slice(0, index + 1),
    ...forwarded,
    '--listen',
    'unix://' + socket.replaceAll('\\', '/'),
  ];
}

function ownerServerArgs(args, socket, ownerMarker) {
  return ownerMarker === '1' ? selectServerArgs(args, socket) : undefined;
}

async function sendFragmented(ws, line) {
  const bytes = Buffer.from(line);
  if (bytes.length > maximumFrame) throw Error('NCF_CODEX_FRAME_LIMIT');
  for (let start = 0; start < Math.max(1, bytes.length); start += 1024 * 1024)
    await new Promise((resolve, reject) =>
      ws.send(
        bytes.subarray(start, start + 1024 * 1024),
        { binary: false, fin: start + 1024 * 1024 >= bytes.length },
        (error) => (error ? reject(error) : resolve()),
      ),
    );
}

async function runBridge(filename, args) {
  if (process.platform !== 'win32') throw Error('NCF_CODEX_WINDOWS_ONLY');
  const { m, a, vendor } = await validateManifest(filename);
  const environment = { ...process.env };
  for (const name of ['CODEX_CLI_PATH', 'ELECTRON_RUN_AS_NODE', 'NCF_CODEX_OWNER_LAUNCH'])
    delete environment[name];
  const socket = path.join(m.profile, 'app-server-control', 'app-server-control.sock');
  const serverArgs = ownerServerArgs(args, socket, process.env.NCF_CODEX_OWNER_LAUNCH);
  if (!serverArgs) {
    const child = spawn(vendor.originalCli, args, {
      env: environment,
      stdio: 'inherit',
      windowsHide: true,
    });
    const [code] = await once(child, 'exit');
    return typeof code === 'number' ? code : 1;
  }
  environment.CODEX_HOME = m.profile;
  const server = spawn(vendor.originalCli, serverArgs, {
    env: environment,
    stdio: ['pipe', 'ignore', 'inherit'],
    windowsHide: true,
  });
  const exited = once(server, 'exit').then(([code]) => (typeof code === 'number' ? code : 1));
  let connected, lines, stopping;
  const stop = () =>
    (stopping ||= (async () => {
      if (!server.pid || server.exitCode !== null || server.signalCode !== null) return;
      const cleanup = spawn(
        a.stop,
        [String(server.pid), String(process.pid), vendor.originalCli, process.execPath],
        { stdio: ['ignore', 'ignore', 'inherit'], windowsHide: true },
      );
      const [code] = await once(cleanup, 'exit');
      if (code !== 0) throw Error('NCF_CODEX_GRACEFUL_CLOSE_BLOCKED');
    })());
  const parentEnded = () => {
    connected?.ws.close();
    void stop().catch(() => {
      process.exitCode = 1;
    });
  };
  process.stdin.once('end', parentEnded);
  process.stdout.once('error', parentEnded);
  process.on('SIGINT', parentEnded);
  process.on('SIGTERM', parentEnded);
  try {
    const WebSocket = require('ws');
    const deadline = Date.now() + 30000;
    while (server.exitCode === null && server.signalCode === null && Date.now() < deadline) {
      const helper = spawn(a.helper, [socket, String(server.pid)], {
        env: environment,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let guard;
      helper.stderr.on('data', (data) => {
        guard = data.toString().match(/NCF_UDS_[A-Z_]+ code=-?\d+/)?.[0] || guard;
      });
      const stream = Duplex.from({ readable: helper.stdout, writable: helper.stdin });
      helper.on('error', (error) => stream.destroy(error));
      helper.stdin.on('error', (error) => stream.destroy(error));
      stream.setTimeout = stream.setNoDelay = stream.setKeepAlive = () => stream;
      const ws = new WebSocket('ws://localhost/rpc', {
        createConnection: () => stream,
        maxPayload: maximumFrame,
        perMessageDeflate: false,
      });
      const ready = await new Promise((resolve) => {
        let done = false;
        const finish = (value) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(value);
        };
        const timer = setTimeout(() => {
          ws.terminate();
          finish(false);
        }, 5000);
        ws.once('open', () => finish(true));
        ws.once('error', () => finish(false));
        ws.once('close', () => finish(false));
      });
      if (ready) {
        connected = { ws, helper };
        break;
      }
      ws.terminate();
      helper.stdin.end();
      if (guard && !/^NCF_UDS_(DIRECTORY_OPEN code=(2|3)|CONNECT code=10061)$/.test(guard))
        throw Error('NCF_CODEX_OWNER_GUARD');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!connected) throw Error('NCF_CODEX_STARTUP_BOUND');
    const { ws } = connected;
    ws.on('error', parentEnded);
    ws.once('close', parentEnded);
    ws.on('message', (frame, binary) => {
      if (binary) {
        parentEnded();
        return;
      }
      if (!process.stdout.write(frame.toString() + '\n')) {
        ws.pause();
        process.stdout.once('drain', () => ws.resume());
      }
    });
    lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
    const forward = (async () => {
      for await (const line of lines) await sendFragmented(ws, line);
      await stop();
      return exited;
    })();
    return await Promise.race([exited, forward]);
  } finally {
    lines?.close();
    connected?.ws.close();
    connected?.helper.stdin.end();
    try {
      await stop();
    } finally {
      server.stdin.end();
      process.stdin.removeListener('end', parentEnded);
      process.stdout.removeListener('error', parentEnded);
      process.removeListener('SIGINT', parentEnded);
      process.removeListener('SIGTERM', parentEnded);
      process.stdin.pause();
      process.stdin.destroy();
    }
  }
}

module.exports = {
  canonical,
  fileHash,
  keyFor,
  assets,
  privatePath,
  runPowerShell,
  inspectPackage,
  resolveVendor,
  parseManifest,
  validateManifest,
  selectServerArgs,
  ownerServerArgs,
  sendFragmented,
};
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] !== '--launcher-manifest' || args[2] !== '--') {
    console.error('NCF_CODEX_BRIDGE_ARGUMENTS');
    process.exitCode = 1;
  } else
    runBridge(args[1], args.slice(3))
      .then((code) => {
        process.exitCode = code;
      })
      .catch((error) => {
        console.error(
          /^NCF_CODEX_[A-Z_]+$/.test(error?.message || '')
            ? error.message
            : 'NCF_CODEX_BRIDGE_FAILED',
        );
        process.exitCode = 1;
      });
}

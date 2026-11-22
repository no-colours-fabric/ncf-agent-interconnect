import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  realpath,
  copyFile,
  rm,
  link,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import * as asar from '@electron/asar';
import {
  launchWindowsCodexFromArgs,
  windowsCodexLaunchArguments,
  createWindowsLauncherLink,
} from '../desktop/main/codex-shortcut-windows.js';

const bridge = createRequire(import.meta.url)('../desktop/integrations/codex-windows-bridge.cjs');
const isWindows = process.platform === 'win32';

test(
  'Electron physical ASAR checks use original-fs while module loading remains ASAR-aware',
  {
    skip: !isWindows,
    timeout: 15000,
  },
  async (t) => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'ncf-physical-asar-')));
    t.after(() => rm(root, { recursive: true, force: true }));
    const input = path.join(root, 'input');
    await mkdir(input);
    await writeFile(
      path.join(input, 'inside.cjs'),
      'module.exports = "ASAR module loading preserved";',
    );
    const archive = path.join(root, 'app.asar');
    await asar.createPackage(input, archive);
    const expected = createHash('sha256')
      .update(await readFile(archive))
      .digest('hex');
    const bridgeFile = fileURLToPath(
      new URL('../desktop/integrations/codex-windows-bridge.cjs', import.meta.url),
    );
    const electron =
      process.env.NCF_TEST_ELECTRON_EXECUTABLE ||
      fileURLToPath(new URL('../node_modules/electron/dist/electron.exe', import.meta.url));
    const worker = `
    const assert = require('node:assert/strict');
    const patched = require('node:fs');
    const original = require('original-fs');
    const bridge = require(${JSON.stringify(bridgeFile)});
    const archive = ${JSON.stringify(archive)};
    (async () => {
      assert.equal(patched.lstatSync(archive).isFile(),false);
      assert.equal(typeof original.promises.lstat,'function');
      assert.equal(typeof original.promises.realpath,'function');
      assert.equal((await original.promises.lstat(archive)).isFile(),true);
      assert.equal(await bridge.canonical(archive,false),archive);
      await assert.rejects(bridge.canonical(archive,true));
      assert.equal(await bridge.fileHash(archive),${JSON.stringify(expected)});
      assert.equal(require(archive + '/inside.cjs'),'ASAR module loading preserved');
      console.log(JSON.stringify({physicalAsar:true,wholeFileSha:true,promisesApi:true,normalAsarModules:true}));
    })().catch(error => {console.error(error.message);process.exitCode=1;});`;
    const result = await promisify(execFile)(electron, ['-e', worker], {
      cwd: root,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 32768,
    });
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      physicalAsar: true,
      wholeFileSha: true,
      promisesApi: true,
      normalAsarModules: true,
    });
  },
);

test(
  'Native shell shortcut creation is idempotent and does not replace a conflicting link',
  { skip: !isWindows },
  async (t) => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'ncf-native-link-')));
    t.after(() => rm(root, { recursive: true, force: true }));
    const exe = path.join(root, 'NCF fixture.exe');
    await writeFile(exe, 'synthetic; never executed');
    const manifest = path.join(root, 'manifest.json');
    await writeFile(manifest, '{}');
    const destination = path.join(root, 'Codex with NCF.lnk');
    assert.equal(await createWindowsLauncherLink(destination, exe, manifest), 'created');
    const first = await readFile(destination);
    assert.equal(await createWindowsLauncherLink(destination, exe, manifest), 'alreadyExists');
    assert.deepEqual(await readFile(destination), first);
    await assert.rejects(
      createWindowsLauncherLink(destination, exe, path.join(root, 'other.json')),
    );
    assert.deepEqual(await readFile(destination), first);
  },
);

test('Windows launch dispatch rejects malformed launch requests before services', async () => {
  const context = { userData: '', appExecutable: '', appPath: '' };
  assert.equal(await launchWindowsCodexFromArgs([], context), 'notHandled');
  for (const args of [
    ['--launch-codex'],
    ['--launcher-manifest', 'x'],
    ['extra', '--launch-codex', '--launcher-manifest', 'x'],
    ['--launch-codex', '--launcher-manifest', 'relative.json'],
  ]) {
    assert.equal(await launchWindowsCodexFromArgs(args, context), 'failed');
  }
  assert.throws(() => windowsCodexLaunchArguments('relative.json'));
  assert.throws(() => windowsCodexLaunchArguments(path.resolve('bad"name.json')));
});

test('Only the marked owner stdio server is redirected; auxiliary and explicit transports pass through', () => {
  const socket = 'C:\\private\\app-server-control\\app-server-control.sock';
  assert.equal(bridge.ownerServerArgs(['app-server'], socket, undefined), undefined);
  assert.equal(bridge.ownerServerArgs(['app-server'], socket, '0'), undefined);
  assert.deepEqual(
    bridge.ownerServerArgs(
      ['-c', 'key="app-server"', 'app-server', '--listen', 'stdio://'],
      socket,
      '1',
    ),
    [
      '-c',
      'key="app-server"',
      'app-server',
      '--listen',
      'unix://C:/private/app-server-control/app-server-control.sock',
    ],
  );
  for (const args of [
    ['--version'],
    ['exec', 'app-server'],
    ['-c', 'app-server'],
    ['app-server', 'proxy'],
    ['app-server', '--help'],
    ['app-server', '--listen=ws://localhost'],
    ['app-server', '--listen'],
  ])
    assert.equal(bridge.ownerServerArgs(args, socket, '1'), undefined);
});

test('Manifest rejects unknown command/script fields and invalid identity hashes', () => {
  const valid = {
    version: 1,
    userData: 'C:\\ncf',
    profile: 'C:\\codex',
    desktopData: 'C:\\desktop',
    appExecutable: 'C:\\ncf.exe',
    appPath: 'C:\\app.asar',
    appExecutableHash: 'a'.repeat(64),
    asarHash: 'b'.repeat(64),
    shimHash: 'c'.repeat(64),
    helperHash: 'd'.repeat(64),
    stopHash: 'e'.repeat(64),
    packageVersion: '26.1117.4957.0',
    bundleKey: 'a'.repeat(16),
    originalCliHash: 'f'.repeat(64),
  };
  assert.deepEqual(bridge.parseManifest(JSON.stringify(valid)), valid);
  assert.throws(() => bridge.parseManifest(JSON.stringify({ ...valid, command: 'arbitrary' })));
  assert.throws(() => bridge.parseManifest(JSON.stringify({ ...valid, asarHash: '' })));
  assert.throws(() => bridge.parseManifest(' '.repeat(32769)));
  assert.throws(() => bridge.assets('C:\\source'));
  assert.equal(
    bridge.keyFor('C:\\PROFILE', 'C:\\DESKTOP'),
    bridge.keyFor('c:\\profile', 'c:\\desktop'),
  );
});

test('Fragmented Unicode preserves the exact text across WebSocket boundaries', async () => {
  const text = '東京 🌙 — '.repeat(200000);
  const pieces: Buffer[] = [];
  const flags: boolean[] = [];
  await bridge.sendFragmented(
    {
      send(
        bytes: Buffer,
        options: { fin: boolean; binary: boolean },
        callback: (error?: Error) => void,
      ) {
        pieces.push(Buffer.from(bytes));
        flags.push(options.fin);
        assert.equal(options.binary, false);
        callback();
      },
    },
    text,
  );
  assert.equal(Buffer.concat(pieces).toString(), text);
  assert.ok(pieces.length > 1);
  assert.ok(flags.slice(0, -1).every((flag) => !flag));
  assert.equal(flags.at(-1), true);
});

test(
  'Windows private synthetic paths reject inherited ACL, reparse aliases and hardlinks',
  { skip: !isWindows },
  async (t) => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'ncf-shortcut-security-')));
    t.after(() => rm(root, { recursive: true, force: true }));
    const own = path.join(root, 'private');
    await mkdir(own);
    await assert.rejects(bridge.privatePath(own, true));
    await bridge.privatePath(own, true, true);
    await bridge.privatePath(own, true);
    const file = path.join(own, 'file');
    await writeFile(file, 'synthetic');
    await bridge.privatePath(file, false, true);
    await bridge.privatePath(file, false);
    const alias = path.join(root, 'junction');
    await promisify(execFile)(
      path.join(process.env.SystemRoot!, 'System32', 'cmd.exe'),
      ['/d', '/c', 'mklink', '/J', alias, own],
      { windowsHide: true },
    );
    await assert.rejects(bridge.canonical(path.join(alias, 'file'), false));
    await link(file, path.join(own, 'hardlink'));
    await assert.rejects(bridge.canonical(file, false));
  },
);

test(
  'Vendor resolver requires the exact existing four-file cache and never creates it',
  { skip: !isWindows },
  async (t) => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'ncf-vendor-cache-')));
    t.after(() => rm(root, { recursive: true, force: true }));
    const before = process.env.LOCALAPPDATA;
    process.env.LOCALAPPDATA = path.join(root, 'local');
    t.after(() => {
      if (before === undefined) delete process.env.LOCALAPPDATA;
      else process.env.LOCALAPPDATA = before;
    });
    const resources = path.join(root, 'app', 'resources');
    await mkdir(resources, { recursive: true });
    const names = [
      'codex.exe',
      'codex-code-mode-host.exe',
      'codex-windows-sandbox-setup.exe',
      'codex-command-runner.exe',
    ];
    const hash = createHash('sha256');
    for (const name of names) {
      await writeFile(path.join(resources, name), 'synthetic:' + name);
      hash
        .update(name)
        .update('\0')
        .update(await bridge.fileHash(path.join(resources, name)))
        .update('\0');
    }
    const key = hash.digest('hex').slice(0, 16);
    await assert.rejects(bridge.resolveVendor({ root }));
    const cache = path.join(process.env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin', key);
    await assert.rejects(readFile(path.join(cache, 'codex.exe')));
    await mkdir(cache, { recursive: true });
    for (const name of names) await copyFile(path.join(resources, name), path.join(cache, name));
    const result = await bridge.resolveVendor({ root });
    assert.equal(result.bundleKey, key);
    assert.equal(result.originalCli, path.join(cache, 'codex.exe'));
    await writeFile(path.join(cache, names[1]), 'tampered');
    await assert.rejects(bridge.resolveVendor({ root }));
  },
);

test(
  'Native shim validates private bootstrap and flushes Unicode before stdin EOF',
  { skip: !isWindows, timeout: 45000 },
  async (t) => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'ncf-shim-stream-')));
    t.after(() => rm(root, { recursive: true, force: true }));
    await bridge.privatePath(root, true, true);
    const compiler = path.join(
      process.env.SystemRoot!,
      'Microsoft.NET',
      'Framework64',
      'v4.0.30319',
      'csc.exe',
    );
    const shim = path.join(root, 'codex-stdio-shim.exe');
    const source = fileURLToPath(
      new URL('../desktop/integrations/codex-stdio-shim.cs', import.meta.url),
    );
    await promisify(execFile)(
      compiler,
      [
        '/nologo',
        '/target:exe',
        '/platform:x64',
        '/reference:System.Web.Extensions.dll',
        '/out:' + shim,
        source,
      ],
      { windowsHide: true },
    );
    await assert.rejects(promisify(execFile)(shim, ['--version'], { windowsHide: true }));
    const fixture = path.join(root, 'Fixture.cs');
    const executable = path.join(root, 'Fixture.exe');
    await writeFile(
      fixture,
      String.raw`using System;using System.Text;class Fixture {static int Main(string[] a){Console.InputEncoding=Encoding.UTF8;Console.OutputEncoding=new UTF8Encoding(false);if(Environment.GetEnvironmentVariable("ELECTRON_RUN_AS_NODE")!="1")return 21;Console.WriteLine("ready:"+a[a.Length-1]);string line=Console.ReadLine();Console.WriteLine(line);return 23;}}`,
    );
    await promisify(execFile)(
      compiler,
      ['/nologo', '/target:exe', '/platform:x64', '/out:' + executable, fixture],
      { windowsHide: true },
    );
    const asar = path.join(root, 'app.asar');
    await writeFile(asar, 'synthetic archive; not an Electron app');
    const manifest = path.join(root, 'manifest.json');
    const value = {
      appExecutable: executable,
      appPath: asar,
      appExecutableHash: await bridge.fileHash(executable),
      asarHash: await bridge.fileHash(asar),
      shimHash: await bridge.fileHash(shim),
    };
    await writeFile(manifest, JSON.stringify(value));
    await bridge.privatePath(manifest, false, true);
    const child = spawn(shim, ['space 東京 🌙 \\'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR },
    });
    let output = '';
    let errors = '';
    child.stderr.on('data', (data) => {
      errors += data.toString();
    });
    const seen = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('stdin was not flushed before EOF')), 10000);
      child.stdout.on('data', (data) => {
        output += data.toString('utf8');
        if (output.includes('reply 東京 🌙')) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once('error', reject);
    });
    const ended = new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    child.stdin.write('reply 東京 🌙\n');
    await seen; // The parent input has deliberately not reached EOF.
    child.stdin.end();
    assert.equal(await ended, 23);
    assert.equal(errors, '');
    assert.ok(output.includes('ready:space 東京 🌙 \\'));
    await writeFile(asar, 'changed');
    await assert.rejects(promisify(execFile)(shim, ['--version'], { windowsHide: true }));
  },
);

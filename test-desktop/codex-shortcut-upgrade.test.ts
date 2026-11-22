import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import {
  createWindowsCodexShortcut,
  launchWindowsCodexFromArgs,
  refreshWindowsCodexLauncher,
} from '../desktop/main/codex-shortcut-windows.js';

const bridge = createRequire(import.meta.url)('../desktop/integrations/codex-windows-bridge.cjs');
const approvedIcon = fileURLToPath(new URL('../desktop/assets/chatgpt-ncf.ico', import.meta.url));
const digest = (text: string) => createHash('sha256').update(text).digest('hex');

async function fixture(t: TestContext, upgrade = true) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'ncu-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const userData = path.join(root, 'ncf-data');
  const profile = path.join(root, 'p');
  const desktopData = path.join(root, 'desktop-data');
  const resources = path.join(root, 'installed', 'resources');
  const appPath = path.join(resources, 'app.asar');
  const appExecutable = path.join(root, 'installed', 'NCF.exe');
  const desktop = path.join(root, 'Desktop');
  const programs = path.join(root, 'Programs');
  for (const directory of [userData, profile, desktopData, resources, desktop, programs])
    await mkdir(directory, { recursive: true });
  await writeFile(appExecutable, 'synthetic NCF executable');
  await writeFile(appPath, 'old archive');
  const assets = bridge.assets(appPath);
  await mkdir(path.dirname(assets.shim), { recursive: true });
  for (const name of ['shim', 'helper', 'stop']) await writeFile(assets[name], 'old-' + name);
  await mkdir(path.join(resources, 'icons'));
  const icon = path.join(resources, 'icons', 'chatgpt-ncf.ico');
  await copyFile(approvedIcon, icon);
  const launchers = path.join(userData, 'codex-launchers');
  const directory = path.join(launchers, bridge.keyFor(profile, desktopData));
  for (const own of [launchers, directory]) {
    await mkdir(own);
    await bridge.privatePath(own, true, true);
  }
  const shim = path.join(directory, 'codex-stdio-shim.exe');
  await copyFile(assets.shim, shim);
  await bridge.privatePath(shim, false, true);
  const manifest = path.join(directory, 'manifest.json');
  const pkg = {
    version: '99.1.2.3',
    root: path.join(root, 'vendor'),
    alias: appExecutable,
    running: 0,
  };
  const vendor = {
    originalCli: path.join(root, 'vendor-cli'),
    originalCliHash: digest('vendor'),
    bundleKey: 'a'.repeat(16),
  };
  const value = {
    version: 1,
    userData,
    profile,
    desktopData,
    appExecutable,
    appPath,
    appExecutableHash: await bridge.fileHash(appExecutable),
    asarHash: await bridge.fileHash(appPath),
    shimHash: await bridge.fileHash(assets.shim),
    helperHash: await bridge.fileHash(assets.helper),
    stopHash: await bridge.fileHash(assets.stop),
    packageVersion: pkg.version,
    bundleKey: vendor.bundleKey,
    originalCliHash: vendor.originalCliHash,
  };
  await writeFile(manifest, JSON.stringify(value));
  await bridge.privatePath(manifest, false, true);
  const legacyLink = path.join(programs, 'Codex with NCF.lnk');
  await bridge.runPowerShell(
    String.raw`
$d=$env:NCF_LAUNCH_DATA|ConvertFrom-Json
$w=New-Object -ComObject WScript.Shell
$l=$w.CreateShortcut($d.link)
$l.TargetPath=$d.executable;$l.Arguments=$d.arguments;$l.WorkingDirectory=$d.directory
$l.Description='Open Codex with NCF Agent Interconnect';$l.Save()`,
    {
      link: legacyLink,
      executable: appExecutable,
      directory: path.dirname(appExecutable),
      arguments: `--launch-codex --launcher-manifest "${manifest}"`,
    },
  );
  const expected = { userData, appExecutable, appPath };
  const runtime = { inspectPackage: async () => pkg, resolveVendor: async () => vendor };
  const validate = bridge.validateManifest;
  t.mock.method(bridge, 'inspectPackage', runtime.inspectPackage);
  t.mock.method(bridge, 'resolveVendor', runtime.resolveVendor);
  t.mock.method(bridge, 'validateManifest', (file: string, context: typeof expected) =>
    validate(file, context, runtime),
  );
  await bridge.validateManifest(manifest, expected);
  if (upgrade) {
    await writeFile(appPath, 'new archive');
    for (const name of ['shim', 'helper', 'stop']) await writeFile(assets[name], 'new-' + name);
  }
  return {
    root,
    userData,
    profile,
    desktopData,
    appPath,
    appExecutable,
    assets,
    icon,
    directory,
    manifest,
    shim,
    legacyLink,
    desktop,
    expected,
    pkg,
  };
}

test(
  'Windows upgrade recreates a missing Desktop link while preserving the existing Programs link',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const f = await fixture(t);
    const legacyBytes = await readFile(f.legacyLink);
    await assert.rejects(
      bridge.validateManifest(f.manifest, f.expected),
      /NCF_CODEX_ASSET_IDENTITY/,
    );
    const destination = path.join(f.desktop, 'ChatGPT — NCF Agent Interconnect.lnk');
    assert.equal(
      await createWindowsCodexShortcut(
        {
          destination,
          profile: f.profile,
          desktopData: f.desktopData,
          appExecutable: f.appExecutable,
          appPath: f.appPath,
        },
        { userData: f.userData },
      ),
      'created',
    );
    const current = await bridge.validateManifest(f.manifest, f.expected);
    assert.equal(current.m.asarHash, await bridge.fileHash(f.appPath));
    assert.equal(current.m.shimHash, await bridge.fileHash(f.assets.shim));
    assert.deepEqual(await readFile(f.legacyLink), legacyBytes);
    const readback = JSON.parse(
      await bridge.runPowerShell(
        String.raw`
$d=$env:NCF_LAUNCH_DATA|ConvertFrom-Json
$l=(New-Object -ComObject WScript.Shell).CreateShortcut($d.link)
[pscustomobject]@{arguments=$l.Arguments;icon=$l.IconLocation;description=$l.Description}|ConvertTo-Json -Compress`,
        { link: destination },
      ),
    );
    assert.equal(readback.arguments, `--launch-codex --launcher-manifest "${f.manifest}"`);
    assert.equal(readback.icon, f.icon + ',0');
    assert.equal(readback.description, 'Open ChatGPT with NCF Agent Interconnect');
  },
);

test(
  'Windows stale legacy launch refreshes state before synthetic native alias dispatch',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const f = await fixture(t);
    const linkBytes = await readFile(f.legacyLink);
    // No Desktop is launched: the injected synthetic vendor alias is Node with
    // ignored stdin, which exits normally without reading or writing a profile.
    f.pkg.alias = process.execPath;
    assert.equal(
      await launchWindowsCodexFromArgs(
        ['--launch-codex', '--launcher-manifest', f.manifest],
        f.expected,
      ),
      'launched',
    );
    assert.equal(
      (await bridge.validateManifest(f.manifest, f.expected)).m.asarHash,
      await bridge.fileHash(f.appPath),
    );
    assert.deepEqual(await readFile(f.legacyLink), linkBytes);
  },
);

test(
  'Windows upgrade refuses a modified existing link before changing private state',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const f = await fixture(t);
    const oldManifest = await readFile(f.manifest);
    const oldShim = await readFile(f.shim);
    await bridge.runPowerShell(
      String.raw`
$d=$env:NCF_LAUNCH_DATA|ConvertFrom-Json
$l=(New-Object -ComObject WScript.Shell).CreateShortcut($d.link)
$l.Arguments='--foreign-arguments';$l.Save()`,
      { link: f.legacyLink },
    );
    const foreignBytes = await readFile(f.legacyLink);
    assert.equal(
      await createWindowsCodexShortcut(
        {
          destination: f.legacyLink,
          profile: f.profile,
          desktopData: f.desktopData,
          appExecutable: f.appExecutable,
          appPath: f.appPath,
        },
        { userData: f.userData },
      ),
      'failed',
    );
    assert.deepEqual(await readFile(f.manifest), oldManifest);
    assert.deepEqual(await readFile(f.shim), oldShim);
    assert.deepEqual(await readFile(f.legacyLink), foreignBytes);
  },
);

test(
  'Windows upgrade rejects changed shim and another selected profile',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const f = await fixture(t);
    const oldManifest = await readFile(f.manifest);
    const oldShim = await readFile(f.shim);
    await assert.rejects(
      refreshWindowsCodexLauncher(f.manifest, f.expected, {
        profile: f.desktopData,
        desktopData: f.profile,
      }),
      /NCF_CODEX_MANIFEST_SCOPE/,
    );
    assert.deepEqual(await readFile(f.manifest), oldManifest);
    await writeFile(f.shim, 'tampered shim');
    await assert.rejects(
      refreshWindowsCodexLauncher(f.manifest, f.expected),
      /NCF_CODEX_ASSET_IDENTITY/,
    );
    assert.deepEqual(await readFile(f.manifest), oldManifest);
    assert.notDeepEqual(await readFile(f.shim), oldShim);
  },
);

test(
  'Windows upgrade leaves state unchanged while Desktop is open',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const f = await fixture(t);
    const oldManifest = await readFile(f.manifest);
    const oldShim = await readFile(f.shim);
    f.pkg.running = 1;
    assert.equal(
      await createWindowsCodexShortcut(
        {
          destination: path.join(f.desktop, 'ChatGPT — NCF Agent Interconnect.lnk'),
          profile: f.profile,
          desktopData: f.desktopData,
          appExecutable: f.appExecutable,
          appPath: f.appPath,
        },
        { userData: f.userData },
      ),
      'closeToUpdate',
    );
    await assert.rejects(
      refreshWindowsCodexLauncher(f.manifest, f.expected),
      /NCF_CODEX_DESKTOP_RUNNING/,
    );
    assert.deepEqual(await readFile(f.manifest), oldManifest);
    assert.deepEqual(await readFile(f.shim), oldShim);
  },
);

test(
  'Windows current-state link creation remains available while Desktop is open',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const f = await fixture(t, false);
    const before = await readFile(f.manifest);
    f.pkg.running = 1;
    assert.equal(
      await createWindowsCodexShortcut(
        {
          destination: path.join(f.desktop, 'ChatGPT — NCF Agent Interconnect.lnk'),
          profile: f.profile,
          desktopData: f.desktopData,
          appExecutable: f.appExecutable,
          appPath: f.appPath,
        },
        { userData: f.userData },
      ),
      'created',
    );
    assert.deepEqual(await readFile(f.manifest), before);
  },
);

for (const phase of ['oldMoved', 'newPublished'] as const) {
  test(
    `Windows upgrade rolls back both files after ${phase}`,
    { skip: process.platform !== 'win32' },
    async (t) => {
      const f = await fixture(t);
      const oldManifest = await readFile(f.manifest);
      const oldShim = await readFile(f.shim);
      const linkBytes = await readFile(f.legacyLink);
      await assert.rejects(
        refreshWindowsCodexLauncher(f.manifest, f.expected, undefined, async (checkpoint) => {
          if (checkpoint === phase) throw new Error('synthetic-rollback');
        }),
        /synthetic-rollback/,
      );
      assert.deepEqual(await readFile(f.manifest), oldManifest);
      assert.deepEqual(await readFile(f.shim), oldShim);
      assert.deepEqual(await readFile(f.legacyLink), linkBytes);
      await assert.rejects(
        bridge.validateManifest(f.manifest, f.expected),
        /NCF_CODEX_ASSET_IDENTITY/,
      );
    },
  );
}

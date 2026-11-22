import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';

export type WindowsCodexShortcutRequest = {
  destination: string;
  profile: string;
  desktopData: string;
  appExecutable: string;
  appPath: string;
};
export type WindowsCodexShortcutContext = { userData: string };
export type WindowsCodexShortcutResult =
  'created' | 'alreadyExists' | 'appMissing' | 'profileUnavailable' | 'closeToUpdate' | 'failed';
type Manifest = Omit<WindowsCodexShortcutRequest, 'destination'> & {
  version: 1;
  userData: string;
  appExecutableHash: string;
  asarHash: string;
  shimHash: string;
  helperHash: string;
  stopHash: string;
  packageVersion: string;
  bundleKey: string;
  originalCliHash: string;
};
type Assets = { bridge: string; shim: string; helper: string; stop: string };
type PackageInfo = { version: string; root: string; alias: string; running: number };
type LauncherExpected = WindowsCodexShortcutContext & {
  appExecutable: string;
  appPath: string;
};
type ValidatedLauncher = { m: Manifest; pkg: PackageInfo; directory: string };
const bridge = createRequire(import.meta.url)('../integrations/codex-windows-bridge.cjs') as {
  canonical(file: string, directory: boolean): Promise<string>;
  fileHash(file: string): Promise<string>;
  keyFor(profile: string, desktopData: string): string;
  assets(appPath: string): Assets;
  privatePath(file: string, directory: boolean, protect?: boolean): Promise<void>;
  inspectPackage(waitForExit?: boolean): Promise<PackageInfo>;
  resolveVendor(info: PackageInfo): Promise<{
    originalCli: string;
    originalCliHash: string;
    bundleKey: string;
  }>;
  runPowerShell(script: string, data: unknown): Promise<string>;
  readOwnedManifest(
    file: string,
    expected: LauncherExpected,
  ): Promise<{
    m: Manifest;
    a: Assets;
    directory: string;
  }>;
  validateManifest(
    file: string,
    expected: WindowsCodexShortcutContext & {
      appExecutable: string;
      appPath: string;
    },
  ): Promise<ValidatedLauncher>;
};

const sameWindowsPath = (a: string, b: string) =>
  path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

/** Replace only private, proven launcher state; never accept old hashes for launch. */
export async function refreshWindowsCodexLauncher(
  manifest: string,
  expected: LauncherExpected,
  selection?: { profile: string; desktopData: string },
  checkpoint?: (phase: 'stageReady' | 'oldMoved' | 'newPublished') => Promise<void>,
): Promise<ValidatedLauncher> {
  const checkSelection = (m: Manifest) => {
    if (
      selection &&
      (!sameWindowsPath(selection.profile, m.profile) ||
        !sameWindowsPath(selection.desktopData, m.desktopData))
    )
      throw new Error('NCF_CODEX_MANIFEST_SCOPE');
  };
  try {
    const valid = await bridge.validateManifest(manifest, expected);
    checkSelection(valid.m);
    return valid;
  } catch (error) {
    if (
      ![
        'NCF_CODEX_ASSET_IDENTITY',
        'NCF_CODEX_VERSION_CHANGED',
        'NCF_CODEX_VENDOR_CHANGED',
      ].includes((error as Error).message)
    )
      throw error;
  }
  // Ownership, private ACL, schema, scope, no-reparse and the old local shim
  // must still be valid. An asset mismatch alone is not permission to overwrite.
  const old = await bridge.readOwnedManifest(manifest, expected);
  checkSelection(old.m);
  const pkg = await bridge.inspectPackage();
  if (pkg.running !== 0) throw new Error('NCF_CODEX_DESKTOP_RUNNING');
  const vendor = await bridge.resolveVendor(pkg);
  const value: Manifest = {
    ...old.m,
    appExecutableHash: await bridge.fileHash(expected.appExecutable),
    asarHash: await bridge.fileHash(expected.appPath),
    shimHash: await bridge.fileHash(old.a.shim),
    helperHash: await bridge.fileHash(old.a.helper),
    stopHash: await bridge.fileHash(old.a.stop),
    packageVersion: pkg.version,
    bundleKey: vendor.bundleKey,
    originalCliHash: vendor.originalCliHash,
  };
  const beforeHash = await bridge.fileHash(manifest);
  const stage = old.directory + '.stage-' + randomUUID();
  const backup = old.directory + '.backup-' + randomUUID();
  let movedOld = false;
  let published = false;
  await mkdir(stage);
  await bridge.privatePath(stage, true, true);
  try {
    const stagedShim = path.join(stage, 'codex-stdio-shim.exe');
    const stagedManifest = path.join(stage, 'manifest.json');
    await copyFile(old.a.shim, stagedShim, constants.COPYFILE_EXCL);
    await bridge.privatePath(stagedShim, false, true);
    await writeFile(stagedManifest, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
    await bridge.privatePath(stagedManifest, false, true);
    if ((await bridge.fileHash(stagedShim)) !== value.shimHash)
      throw new Error('NCF_CODEX_ASSET_IDENTITY');
    await checkpoint?.('stageReady');
    await bridge.readOwnedManifest(manifest, expected);
    if ((await bridge.fileHash(manifest)) !== beforeHash)
      throw new Error('NCF_CODEX_MANIFEST_CHANGED');
    const current = await bridge.inspectPackage();
    if (current.running !== 0) throw new Error('NCF_CODEX_DESKTOP_RUNNING');
    if (current.version !== pkg.version || current.root !== pkg.root || current.alias !== pkg.alias)
      throw new Error('NCF_CODEX_PACKAGE_CHANGED');
    // Renaming fails if a running shim pins this directory. Do not force it.
    await rename(old.directory, backup);
    movedOld = true;
    await checkpoint?.('oldMoved');
    await rename(stage, old.directory);
    published = true;
    await checkpoint?.('newPublished');
    const valid = await bridge.validateManifest(manifest, expected);
    checkSelection(valid.m);
    if (valid.pkg.running !== 0) throw new Error('NCF_CODEX_DESKTOP_RUNNING');
    return valid;
  } catch (error) {
    // Keep all private backups/staged files. Never delete profiles, links or
    // files needed by another process, including when rollback itself fails.
    if (published) await rename(old.directory, stage);
    if (movedOld) await rename(backup, old.directory);
    throw error;
  }
}

type WindowsDesktopData =
  { state: 'ready'; directory: string } | { state: 'appMissing' | 'profileUnavailable' };

/** Resolve only the stock Desktop data for the already verified Appx package. */
export async function resolveWindowsCodexDesktopData(appData: string): Promise<WindowsDesktopData> {
  if (process.platform !== 'win32') return { state: 'appMissing' };
  try {
    const pkg = await bridge.inspectPackage();
    await bridge.resolveVendor(pkg);
  } catch {
    return { state: 'appMissing' };
  }
  const localData = process.env.LOCALAPPDATA;
  if (!localData || !path.isAbsolute(localData) || !path.isAbsolute(appData))
    return { state: 'profileUnavailable' };
  // A package-private copy makes the ordinary roaming data ambiguous.
  // Leave a package-only layout unavailable until its exact launch path is proved.
  const privateData = path.join(
    localData,
    'Packages',
    'OpenAI.Codex_2p2nqsd0c76g0',
    'LocalCache',
    'Roaming',
    'Codex',
  );
  try {
    await lstat(privateData);
    return { state: 'profileUnavailable' };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return { state: 'profileUnavailable' };
  }
  try {
    return { state: 'ready', directory: await bridge.canonical(path.join(appData, 'Codex'), true) };
  } catch {
    return { state: 'profileUnavailable' };
  }
}

export function windowsCodexLaunchArguments(manifest: string): string[] {
  if (!path.isAbsolute(manifest) || /[\0\r\n"]/.test(manifest))
    throw new Error('NCF_CODEX_MANIFEST_ARGUMENT');
  return ['--launch-codex', '--launcher-manifest', manifest];
}

const approvedChatGptIconSha256 =
  '27beacd32fb50d66564f52537e92d3921dcc57d9cab869c082367f1c4f47bda5';

export async function windowsCodexShortcutIcon(appPath: string): Promise<string> {
  const archive = await bridge.canonical(appPath, false);
  if (path.basename(archive).toLowerCase() !== 'app.asar')
    throw new Error('NCF_CODEX_PACKAGED_ONLY');
  const icon = await bridge.canonical(
    path.join(path.dirname(archive), 'icons', 'chatgpt-ncf.ico'),
    false,
  );
  if ((await bridge.fileHash(icon)) !== approvedChatGptIconSha256)
    throw new Error('NCF_CHATGPT_ICON_IDENTITY');
  return icon;
}

export async function verifyWindowsCodexShortcutManifest(
  manifest: string,
  expected: WindowsCodexShortcutContext & Omit<WindowsCodexShortcutRequest, 'destination'>,
): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  try {
    const { m } = await bridge.validateManifest(manifest, expected);
    const [profile, desktopData] = await Promise.all([
      bridge.canonical(expected.profile, true),
      bridge.canonical(expected.desktopData, true),
    ]);
    return (
      path.resolve(m.profile).toLowerCase() === profile.toLowerCase() &&
      path.resolve(m.desktopData).toLowerCase() === desktopData.toLowerCase()
    );
  } catch {
    return false;
  }
}

const linkScript = String.raw`
$d=$env:NCF_LAUNCH_DATA|ConvertFrom-Json
$w=New-Object -ComObject WScript.Shell
if (Test-Path -LiteralPath $d.destination) {
  $i=Get-Item -LiteralPath $d.destination -Force
  if (($i.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {throw 'link-reparse'}
  $l=$w.CreateShortcut($d.destination)
  if ($l.TargetPath -ine $d.executable -or $l.Arguments -cne $d.arguments -or $l.IconLocation -ine $d.iconLocation -or $l.Description -cne 'Open ChatGPT with NCF Agent Interconnect') {throw 'link-conflict'}
  [Console]::Out.Write('alreadyExists');exit
}
# Reserve the destination exclusively before COM writes this own shortcut.
$f=[IO.File]::Open($d.destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$f.Close()
$l=$w.CreateShortcut($d.destination)
$l.TargetPath=$d.executable;$l.Arguments=$d.arguments;$l.WorkingDirectory=$d.directory
$l.Description='Open ChatGPT with NCF Agent Interconnect'
$l.IconLocation=$d.iconLocation
$l.Save()
$r=$w.CreateShortcut($d.destination)
if ($r.TargetPath -ine $d.executable -or $r.Arguments -cne $d.arguments -or $r.IconLocation -ine $d.iconLocation -or $r.Description -cne 'Open ChatGPT with NCF Agent Interconnect') {throw 'link-verification'}
[Console]::Out.Write('created')`;

async function inspectOwnedLauncherLink(
  destination: string,
  executable: string,
  manifest: string,
  icon: string,
): Promise<'missing' | 'current' | 'legacy'> {
  try {
    await lstat(destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
    throw error;
  }
  await bridge.canonical(destination, false);
  const result = await bridge.runPowerShell(
    String.raw`
$d=$env:NCF_LAUNCH_DATA|ConvertFrom-Json
$l=(New-Object -ComObject WScript.Shell).CreateShortcut($d.destination)
if ($l.TargetPath -ine $d.executable -or $l.Arguments -cne $d.arguments -or $l.WorkingDirectory -ine $d.directory) {throw 'link-conflict'}
if ($l.Description -ceq 'Open ChatGPT with NCF Agent Interconnect' -and $l.IconLocation -ieq $d.icon) {[Console]::Out.Write('current');exit}
if ($l.Description -ceq 'Open Codex with NCF Agent Interconnect' -and ($l.IconLocation -ceq ',0' -or $l.IconLocation -ieq ($d.executable+',0'))) {[Console]::Out.Write('legacy');exit}
throw 'link-conflict'`,
    {
      destination,
      executable,
      arguments: `--launch-codex --launcher-manifest "${manifest}"`,
      directory: path.dirname(executable),
      icon: icon + ',0',
    },
  );
  if (result !== 'current' && result !== 'legacy') throw new Error('NCF_CODEX_LINK_RESULT');
  return result;
}

// Fixed .lnk operation, also exercised against a disposable native shell link.
export async function createWindowsLauncherLink(
  destination: string,
  appExecutable: string,
  manifest: string,
  icon: string,
): Promise<'created' | 'alreadyExists'> {
  if (
    !path.isAbsolute(destination) ||
    path.extname(destination).toLowerCase() !== '.lnk' ||
    /[\0\r\n"]/.test(destination)
  )
    throw new Error('NCF_CODEX_LINK_PATH');
  await bridge.canonical(path.dirname(destination), true);
  await bridge.canonical(appExecutable, false);
  await bridge.canonical(icon, false);
  if ((await bridge.fileHash(icon)) !== approvedChatGptIconSha256)
    throw new Error('NCF_CHATGPT_ICON_IDENTITY');
  const args = windowsCodexLaunchArguments(manifest);
  const result = await bridge.runPowerShell(linkScript, {
    destination,
    executable: appExecutable,
    arguments: `${args[0]} ${args[1]} "${args[2]}"`,
    directory: path.dirname(appExecutable),
    iconLocation: `${icon},0`,
  });
  if (result !== 'created' && result !== 'alreadyExists') throw new Error('NCF_CODEX_LINK_RESULT');
  return result;
}

// The destination is an absolute .lnk filename selected by the shared handler.
// The explicit NCF userData argument is not the OS appData directory.
export async function createWindowsCodexShortcut(
  request: WindowsCodexShortcutRequest,
  context: WindowsCodexShortcutContext,
): Promise<WindowsCodexShortcutResult> {
  if (process.platform !== 'win32') return 'appMissing';
  let profile: string;
  let desktopData: string;
  try {
    profile = await bridge.canonical(request.profile, true);
    desktopData = await bridge.canonical(request.desktopData, true);
    if (
      Buffer.byteLength(path.join(profile, 'app-server-control', 'app-server-control.sock')) >= 108
    )
      return 'profileUnavailable';
  } catch {
    return 'profileUnavailable';
  }
  let pkg: PackageInfo;
  let vendor: Awaited<ReturnType<typeof bridge.resolveVendor>>;
  try {
    pkg = await bridge.inspectPackage();
    vendor = await bridge.resolveVendor(pkg);
  } catch {
    return 'appMissing';
  }
  try {
    const userData = await bridge.canonical(context.userData, true);
    const appExecutable = await bridge.canonical(request.appExecutable, false);
    const appPath = await bridge.canonical(request.appPath, false);
    const a = bridge.assets(appPath);
    const icon = await windowsCodexShortcutIcon(appPath);
    if (
      !path.isAbsolute(request.destination) ||
      path.extname(request.destination).toLowerCase() !== '.lnk' ||
      /[\0\r\n"]/.test(request.destination)
    )
      return 'failed';
    const parent = await bridge.canonical(path.dirname(request.destination), true);
    const destination = path.join(parent, path.basename(request.destination));
    const root = path.join(userData, 'codex-launchers');
    const directory = path.join(root, bridge.keyFor(profile, desktopData));
    const manifest = path.join(directory, 'manifest.json');
    const existingLink = await inspectOwnedLauncherLink(destination, appExecutable, manifest, icon);
    const linkHash = existingLink === 'missing' ? undefined : await bridge.fileHash(destination);
    for (const folder of [root, directory]) {
      try {
        await mkdir(folder);
        await bridge.privatePath(folder, true, true);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        await bridge.privatePath(folder, true);
      }
    }
    let exists = false;
    try {
      await lstat(manifest);
      exists = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (exists) {
      const { m } = await refreshWindowsCodexLauncher(
        manifest,
        { userData, appExecutable, appPath },
        { profile, desktopData },
      );
      if (m.profile !== profile || m.desktopData !== desktopData) return 'failed';
    } else {
      const value = {
        version: 1,
        userData,
        profile,
        desktopData,
        appExecutable,
        appPath,
        appExecutableHash: await bridge.fileHash(appExecutable),
        asarHash: await bridge.fileHash(appPath),
        shimHash: await bridge.fileHash(await bridge.canonical(a.shim, false)),
        helperHash: await bridge.fileHash(await bridge.canonical(a.helper, false)),
        stopHash: await bridge.fileHash(await bridge.canonical(a.stop, false)),
        packageVersion: pkg.version,
        bundleKey: vendor.bundleKey,
        originalCliHash: vendor.originalCliHash,
      };
      const shim = path.join(directory, 'codex-stdio-shim.exe');
      await copyFile(a.shim, shim, constants.COPYFILE_EXCL);
      await bridge.privatePath(shim, false, true);
      await writeFile(manifest, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
      await bridge.privatePath(manifest, false, true);
      await bridge.validateManifest(manifest, { userData, appExecutable, appPath });
    }
    if (existingLink !== 'missing') {
      await inspectOwnedLauncherLink(destination, appExecutable, manifest, icon);
      if ((await bridge.fileHash(destination)) !== linkHash) return 'failed';
      return 'alreadyExists';
    }
    return await createWindowsLauncherLink(destination, appExecutable, manifest, icon);
  } catch (error) {
    if ((error as Error).message === 'NCF_CODEX_DESKTOP_RUNNING') return 'closeToUpdate';
    return 'failed';
  }
}

// Called before services and the normal single-instance lock. A malformed launch
// request is handled as a failure and must never start the ordinary NCF service.
export async function launchWindowsCodexFromArgs(
  args: string[],
  context: WindowsCodexShortcutContext & { appExecutable: string; appPath: string },
): Promise<'launched' | 'notHandled' | 'failed'> {
  if (!args.some((arg) => arg === '--launch-codex' || arg === '--launcher-manifest'))
    return 'notHandled';
  if (
    process.platform !== 'win32' ||
    args.length !== 3 ||
    args[0] !== '--launch-codex' ||
    args[1] !== '--launcher-manifest'
  )
    return 'failed';
  try {
    windowsCodexLaunchArguments(args[2]);
    const { m, pkg, directory } = await refreshWindowsCodexLauncher(args[2], context);
    if (pkg.running !== 0) {
      const after = await bridge.inspectPackage(true);
      if (
        after.running !== 0 ||
        after.version !== m.packageVersion ||
        after.root !== pkg.root ||
        after.alias !== pkg.alias
      )
        return 'failed';
    }
    const environment = {
      ...process.env,
      CODEX_HOME: m.profile,
      CODEX_ELECTRON_USER_DATA_PATH: m.desktopData,
      CODEX_CLI_PATH: path.join(directory, 'codex-stdio-shim.exe'),
      NCF_CODEX_OWNER_LAUNCH: '1',
    };
    delete (environment as NodeJS.ProcessEnv).ELECTRON_RUN_AS_NODE;
    const child = spawn(pkg.alias, [], {
      env: environment,
      cwd: directory,
      windowsHide: false,
      stdio: 'ignore',
      detached: false,
    });
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    child.unref();
    // A spawn is not Desktop/tool/delivery acceptance; those are separate checks.
    return 'launched';
  } catch {
    return 'failed';
  }
}

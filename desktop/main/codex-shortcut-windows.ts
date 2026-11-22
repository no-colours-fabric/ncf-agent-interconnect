import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, writeFile } from 'node:fs/promises';
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
  'created' | 'alreadyExists' | 'appMissing' | 'profileUnavailable' | 'failed';
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
  validateManifest(
    file: string,
    expected: WindowsCodexShortcutContext & {
      appExecutable: string;
      appPath: string;
    },
  ): Promise<{ m: Manifest; pkg: PackageInfo; directory: string }>;
};

export function windowsCodexLaunchArguments(manifest: string): string[] {
  if (!path.isAbsolute(manifest) || /[\0\r\n"]/.test(manifest))
    throw new Error('NCF_CODEX_MANIFEST_ARGUMENT');
  return ['--launch-codex', '--launcher-manifest', manifest];
}

const linkScript = String.raw`
$d=$env:NCF_LAUNCH_DATA|ConvertFrom-Json
$w=New-Object -ComObject WScript.Shell
if (Test-Path -LiteralPath $d.destination) {
  $i=Get-Item -LiteralPath $d.destination -Force
  if (($i.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {throw 'link-reparse'}
  $l=$w.CreateShortcut($d.destination)
  if ($l.TargetPath -ine $d.executable -or $l.Arguments -cne $d.arguments) {throw 'link-conflict'}
  [Console]::Out.Write('alreadyExists');exit
}
# Reserve the destination exclusively before COM writes this own shortcut.
$f=[IO.File]::Open($d.destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$f.Close()
$l=$w.CreateShortcut($d.destination)
$l.TargetPath=$d.executable;$l.Arguments=$d.arguments;$l.WorkingDirectory=$d.directory
$l.Description='Open Codex with NCF Agent Interconnect'
$l.Save()
$r=$w.CreateShortcut($d.destination)
if ($r.TargetPath -ine $d.executable -or $r.Arguments -cne $d.arguments) {throw 'link-verification'}
[Console]::Out.Write('created')`;

// Fixed .lnk operation, also exercised against a disposable native shell link.
export async function createWindowsLauncherLink(
  destination: string,
  appExecutable: string,
  manifest: string,
): Promise<'created' | 'alreadyExists'> {
  if (
    !path.isAbsolute(destination) ||
    path.extname(destination).toLowerCase() !== '.lnk' ||
    /[\0\r\n"]/.test(destination)
  )
    throw new Error('NCF_CODEX_LINK_PATH');
  await bridge.canonical(path.dirname(destination), true);
  await bridge.canonical(appExecutable, false);
  const args = windowsCodexLaunchArguments(manifest);
  const result = await bridge.runPowerShell(linkScript, {
    destination,
    executable: appExecutable,
    arguments: `${args[0]} ${args[1]} "${args[2]}"`,
    directory: path.dirname(appExecutable),
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
    for (const folder of [root, directory]) {
      try {
        await mkdir(folder);
        await bridge.privatePath(folder, true, true);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        await bridge.privatePath(folder, true);
      }
    }
    const manifest = path.join(directory, 'manifest.json');
    let exists = false;
    try {
      await lstat(manifest);
      exists = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (exists) {
      const { m } = await bridge.validateManifest(manifest, { userData, appExecutable, appPath });
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
    return await createWindowsLauncherLink(destination, appExecutable, manifest);
  } catch {
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
    const { m, pkg, directory } = await bridge.validateManifest(args[2], context);
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

import { spawn } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';

/** Read-only WinRT subscriptions; the event payload never supplies runtime metadata. */
export const windowsChatgptInstallationEvents = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -TypeDefinition @'
using System;
public static class NcfPackageChange {
    private static readonly object gate = new object();
    private static object Property(object value, string name) {
        if (value == null) return null;
        var property = value.GetType().GetProperty(name);
        return property == null ? null : property.GetValue(value, null);
    }
    public static void Changed(object sender, object details) {
        try {
            var complete = Property(details, "IsComplete");
            if (complete is bool && !(bool)complete) return;
            var package = Property(details, "TargetPackage") ?? Property(details, "Package") ?? Property(details, "SourcePackage");
            var id = Property(package, "Id");
            if (!String.Equals(Property(id, "Name") as string, "OpenAI.Codex", StringComparison.Ordinal) ||
                !String.Equals(Property(id, "FamilyName") as string, "OpenAI.Codex_2p2nqsd0c76g0", StringComparison.Ordinal)) return;
            lock (gate) { Console.Out.WriteLine("changed"); Console.Out.Flush(); }
        } catch {
            // A callback cannot authorize metadata or application configuration.
        }
    }
}
'@
$catalog = [Windows.ApplicationModel.PackageCatalog,Windows.ApplicationModel,ContentType=WindowsRuntime]::OpenForCurrentUser()
$subscriptions = @()
try {
    foreach ($name in @('PackageInstalling','PackageUpdating','PackageUninstalling','PackageStatusChanged')) {
        $event = $catalog.GetType().GetEvent($name)
        $handler = [Delegate]::CreateDelegate($event.EventHandlerType, [NcfPackageChange].GetMethod('Changed'))
        $token = $event.GetAddMethod().Invoke($catalog, @($handler))
        $subscriptions += @{ Event = $event; Handler = $handler; Token = $token }
    }
    [Console]::WriteLine('ready')
    [Console]::Out.Flush()
    [Console]::In.ReadToEnd() | Out-Null
} finally {
    foreach ($subscription in $subscriptions) {
        $subscription.Event.GetRemoveMethod().Invoke($catalog, @($subscription.Token)) | Out-Null
    }
}
`;

interface Options {
  platform?: NodeJS.Platform;
  launch?: typeof spawn;
  unavailable?: () => void;
}

/** A package event only invalidates discovery; its normal identity checks still read the version. */
export function watchWindowsChatgptInstallation(
  changed: (reason: 'ready' | 'changed') => void,
  options: Options = {},
): () => void {
  if ((options.platform ?? process.platform) !== 'win32') return () => {};
  let disposed = false;
  let stop: (() => void) | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let delay = 1000;
  const listen = () => {
    if (disposed) return;
    let ended = false;
    const failed = () => {
      if (ended || disposed) return;
      ended = true;
      options.unavailable?.();
      // Reconnect a failed event stream, never periodically query package metadata.
      retry = setTimeout(listen, delay);
      delay = Math.min(delay * 2, 30000);
    };
    const command = path.win32.join(
      process.env.SystemRoot ?? 'C:\\Windows',
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    );
    try {
      const child = (options.launch ?? spawn)(
        command,
        [
          '-NoProfile',
          '-NonInteractive',
          '-EncodedCommand',
          Buffer.from(windowsChatgptInstallationEvents, 'utf16le').toString('base64'),
        ],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] },
      );
      const lines = createInterface({ input: child.stdout! });
      lines.on('line', (line) => {
        if (disposed || ended || (line !== 'ready' && line !== 'changed')) return;
        if (line === 'ready') delay = 1000;
        changed(line);
      });
      child.once('error', failed);
      child.once('exit', () => {
        lines.close();
        failed();
      });
      stop = () => {
        lines.close();
        // Only this private helper reads this stream. EOF unsubscribes and exits.
        child.stdin?.end();
      };
      child.stdin?.on('error', () => {});
    } catch {
      failed();
    }
  };
  listen();
  return () => {
    disposed = true;
    if (retry) clearTimeout(retry);
    stop?.();
  };
}

// Query only process image paths and MSIX identities in the current Windows session.
export const windowsChatgptProcesses = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$session = [Diagnostics.Process]::GetCurrentProcess().SessionId
$candidates = @(Get-Process -Name ChatGPT,Codex -ErrorAction SilentlyContinue | Where-Object { $_.SessionId -eq $session })
if ($candidates.Count -eq 0) { [Console]::Write('[]'); exit }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;
public static class NcfPackageIdentity {
    [DllImport("kernel32.dll", SetLastError=true)]
    private static extern SafeProcessHandle OpenProcess(uint access, bool inherit, int pid);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, ExactSpelling=true)]
    private static extern int GetPackageFullName(SafeProcessHandle process, ref uint length, StringBuilder name);
    public static string ForProcess(int pid) {
        using (var handle = OpenProcess(0x1000, false, pid)) { // PROCESS_QUERY_LIMITED_INFORMATION
            if (handle.IsInvalid) return null;
            uint length = 0;
            if (GetPackageFullName(handle, ref length, null) != 122 || length > 256 || length < 2)
                return null;
            var name = new StringBuilder((int)length);
            return GetPackageFullName(handle, ref length, name) == 0 ? name.ToString() : null;
        }
    }
}
'@
$images = @(foreach ($proc in $candidates) {
    $image = $proc.Path
    if ($image) {
        [PSCustomObject]@{ path = $image; packageFullName = [NcfPackageIdentity]::ForProcess($proc.Id) }
    }
})
ConvertTo-Json -InputObject $images -Compress
`;

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;

// Installer-only, read-only inventory. Never stop processes or change permissions.
internal static class NcfUpdatePreflight {
    [StructLayout(LayoutKind.Sequential)] struct UniqueProcess {
        public uint pid;
        public System.Runtime.InteropServices.ComTypes.FILETIME started;
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct ProcessInfo {
        public UniqueProcess process;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string appName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)] public string serviceName;
        public uint appType, status, session;
        [MarshalAs(UnmanagedType.Bool)] public bool restartable;
    }
    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    static extern int RmStartSession(out uint handle, uint flags, StringBuilder key);
    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    static extern int RmRegisterResources(uint handle, uint fileCount, string[] files, uint processCount, IntPtr processes, uint serviceCount, IntPtr services);
    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    static extern int RmGetList(uint handle, out uint needed, ref uint count, [In, Out] ProcessInfo[] processes, ref uint reasons);
    [DllImport("rstrtmgr.dll")] static extern int RmEndSession(uint handle);

    static readonly Dictionary<uint, string> blockers = new Dictionary<uint, string>();
    static readonly Stopwatch deadline = Stopwatch.StartNew();
    static string owner;
    static bool Same(string a, string b) { return String.Equals(a, b, StringComparison.OrdinalIgnoreCase); }
    static void Inspect(ManagementObject process, bool fileLock) {
        if (deadline.ElapsedMilliseconds > 9000) throw new InvalidOperationException();
        uint pid = Convert.ToUInt32(process["ProcessId"]);
        if (pid == (uint)Process.GetCurrentProcess().Id) return;
        using (var result = process.InvokeMethod("GetOwnerSid", null, null)) {
            if (result == null || Convert.ToUInt32(result["ReturnValue"]) != 0) throw new InvalidOperationException();
            if (!Same((string)result["Sid"], owner)) {
                if (fileLock) blockers[pid] = "An application is using NCF files";
                return;
            }
        }
        string command = ((string)process["CommandLine"] ?? "").Replace('\\', '/').ToLowerInvariant();
        string role = fileLock ? "An application is using NCF files" : "NCF Agent Interconnect";
        if (command.Contains("/integrations/cursor")) role = "Cursor integration - close Cursor";
        else if (command.Contains("/integrations/aion")) role = "AionUi integration - close AionUi";
        else if (command.Contains("/integrations/claude")) role = "Claude integration - close Claude Desktop / Claude Code";
        else if (command.Contains("/integrations/opencode")) role = "OpenCode integration - close OpenCode";
        else if (command.Contains("/integrations/codex") || command.Contains("codex-windows-bridge") || command.Contains("--launch-codex")) role = "ChatGPT integration - close ChatGPT";
        else if (command.Contains("/integrations/")) role = "NCF client integration - close the connected client";
        else if (command.Contains("--type=")) role = "NCF background component";
        blockers[pid] = role;
    }
    static ManagementObjectSearcher Query(string filter) {
        var options = new EnumerationOptions { Timeout = TimeSpan.FromSeconds(5), ReturnImmediately = false };
        return new ManagementObjectSearcher("root\\cimv2", "SELECT ProcessId, CommandLine FROM Win32_Process WHERE " + filter, options);
    }
    static void InspectLocks(string root) {
        var files = new List<string>();
        foreach (string relative in new [] { "NCF Agent Interconnect.exe", "resources/app.asar", "resources/app.asar.unpacked/build/assets/codex-stdio-shim.exe", "resources/app.asar.unpacked/build/assets/codex-win-socket.exe" }) {
            string file = Path.Combine(root, relative.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(file)) files.Add(file);
        }
        if (files.Count == 0) return;
        uint handle;
        if (RmStartSession(out handle, 0, new StringBuilder(33)) != 0) throw new InvalidOperationException();
        try {
            if (RmRegisterResources(handle, (uint)files.Count, files.ToArray(), 0, IntPtr.Zero, 0, IntPtr.Zero) != 0) throw new InvalidOperationException();
            uint needed, count = 0, reasons = 0;
            int error = RmGetList(handle, out needed, ref count, null, ref reasons);
            if (error == 0) return;
            if (error != 234 || needed > 128) throw new InvalidOperationException();
            var processes = new ProcessInfo[needed]; count = needed;
            if (RmGetList(handle, out needed, ref count, processes, ref reasons) != 0) throw new InvalidOperationException();
            for (int i = 0; i < count; i++) {
                uint pid = processes[i].process.pid;
                if (blockers.ContainsKey(pid)) continue;
                using (var search = Query("ProcessId=" + pid))
                using (var matches = search.Get())
                    foreach (ManagementObject process in matches) using (process) Inspect(process, true);
            }
        } finally { RmEndSession(handle); }
    }
    public static int Main(string[] args) {
        try {
            if (args.Length != 1 || !Path.IsPathRooted(args[0])) throw new InvalidOperationException();
            string root = Path.GetFullPath(args[0]);
            owner = WindowsIdentity.GetCurrent().User.Value;
            // Legacy uninstallers match this image name globally. Show the real
            // client roles before invoking them, including other copies owned by
            // this account, instead of killing/restarting MCP clients in a loop.
            using (var search = Query("Name='NCF Agent Interconnect.exe'"))
            using (var matches = search.Get())
                foreach (ManagementObject process in matches) using (process) Inspect(process, false);
            InspectLocks(root);
            if (blockers.Count == 0) return 0;
            Console.WriteLine("Before continuing, close NCF Agent Interconnect using Quit in its tray menu and close these connected applications/background tasks:");
            int lines = 0;
            foreach (var item in blockers) {
                if (++lines > 7) { Console.WriteLine("Additional NCF background components are still running."); break; }
                Console.WriteLine(item.Value + " (PID " + item.Key + ")");
            }
            Console.WriteLine("Closing ChatGPT alone does not stop Cursor or other client integrations. After closing them, click Retry. No installed files have been removed and no process has been terminated.");
            return 10;
        } catch {
            Console.WriteLine("Setup could not verify that NCF files are free. Close NCF from its tray menu and close connected applications (ChatGPT, Cursor, AionUi, Claude or OpenCode), then click Retry. Setup has not removed any installed files or terminated a process.");
            return 20;
        }
    }
}

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Security.Cryptography;
using System.Web.Script.Serialization;
using System.Text;

// Installer inventory and lightweight shell helpers. Never force-stop processes or change permissions.
internal static class NcfUpdatePreflight {
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    static extern void SHChangeNotify(uint eventId, uint flags, string item1, IntPtr item2);
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
    static string currentRoot;
    static readonly List<Process> ownServices = new List<Process>();
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
        string executable = (string)process["ExecutablePath"] ?? "";
        string ownScript = Path.Combine(currentRoot,"resources","app.asar","build","integrations","codex-windows-service.cjs").Replace('\\','/').ToLowerInvariant();
        if (!fileLock && Same(executable,Path.Combine(currentRoot,"NCF Agent Interconnect.exe")) && command.Contains(ownScript)) {
            // Only this installation's user-mode service is stopped by its authenticated control API.
            ownServices.Add(Process.GetProcessById((int)pid));
            return;
        }
        string filename=Path.GetFileName(executable);
        string role = fileLock && !String.IsNullOrWhiteSpace(filename) ? "Close " + filename : fileLock ? "An application is using NCF files" : "NCF Agent Interconnect";
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
        // Projected instances need their object path for GetOwnerSid invocation.
        return new ManagementObjectSearcher("root\\cimv2", "SELECT __PATH, ProcessId, CommandLine, ExecutablePath FROM Win32_Process WHERE " + filter, options);
    }
    static void InspectLocks(string root) {
        var files = new List<string>();
        foreach (string relative in new [] { "NCF Agent Interconnect.exe", "resources/app.asar", "resources/app.asar.unpacked/build/assets/codex-stdio-shim.exe", "resources/app.asar.unpacked/build/assets/codex-win-socket.exe", "resources/app.asar.unpacked/build/assets/codex-win-pipe.exe" }) {
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
    static bool StopOwnService(string root) {
        string executable=Path.Combine(root,"NCF Agent Interconnect.exe");
        string helper=Path.Combine(root,"resources","app.asar.unpacked","build","assets","codex-win-pipe.exe");
        if (!File.Exists(helper)) return ownServices.Count==0;
        string archive=Path.Combine(root,"resources","app.asar"),stampFile=Path.Combine(root,"resources","ncf-launcher-identity.json");
        if (!Same(FileVersionInfo.GetVersionInfo(executable).ProductName,"NCF Agent Interconnect") || !File.Exists(stampFile) || new FileInfo(stampFile).Length>4096) return false;
        var stamp=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(stampFile));
        if (!stamp.ContainsKey("pipeHash") || !Same((string)stamp["pipeHash"],Hash(helper)) || !Same((string)stamp["asarHash"],Hash(archive))) return false;
        var start=new ProcessStartInfo(executable,"--chatgpt-service-stop") { UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=root };
        start.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");
        using(var child=Process.Start(start)) { if(!child.WaitForExit(25000)||child.ExitCode!=0)return false; }
        foreach(var process in ownServices) using(process) { if(!process.WaitForExit(5000))return false; }
        return true;
    }
    static string Hash(string filename) { using(var input=new FileStream(filename,FileMode.Open,FileAccess.Read,FileShare.Read,1024*1024,FileOptions.SequentialScan)) using(var hash=new SHA256Cng()) return BitConverter.ToString(hash.ComputeHash(input)).Replace("-","").ToLowerInvariant(); }
    public static int Main(string[] args) {
        try {
            if (args.Length == 2 && args[0] == "--notify-shortcut-created") {
                if (!Path.IsPathRooted(args[1]) || !String.Equals(Path.GetExtension(args[1]), ".lnk", StringComparison.OrdinalIgnoreCase)) return 20;
                SHChangeNotify(0x00000002, 0x00002005, Path.GetFullPath(args[1]), IntPtr.Zero);
                return 0;
            }
            if (args.Length == 1 && args[0] == "--programs-directory") {
                Console.OutputEncoding = new UTF8Encoding(false);
                Console.Write(Environment.GetFolderPath(Environment.SpecialFolder.Programs));
                return 0;
            }
            if (args.Length != 1 || !Path.IsPathRooted(args[0])) throw new InvalidOperationException();
            string root = Path.GetFullPath(args[0]);
            currentRoot = root;
            owner = WindowsIdentity.GetCurrent().User.Value;
            // Legacy uninstallers match this image name globally. Show the real
            // client roles before invoking them, including other copies owned by
            // this account, instead of killing/restarting MCP clients in a loop.
            using (var search = Query("Name='NCF Agent Interconnect.exe'"))
            using (var matches = search.Get())
                foreach (ManagementObject process in matches) using (process) Inspect(process, false);
            if(blockers.Count==0&&!StopOwnService(root)) blockers[0]="ChatGPT background delivery - close ChatGPT before updating";
            // Restart Manager remains the final file-lock check after graceful service shutdown.
            deadline.Restart();
            InspectLocks(root);
            if (blockers.Count == 0) return 0;
            Console.WriteLine("Before continuing, close NCF Agent Interconnect using Quit in its tray menu and close these connected applications/background tasks:");
            int lines = 0;
            foreach (var item in blockers) {
                if (++lines > 7) { Console.WriteLine("Additional NCF background components are still running."); break; }
                Console.WriteLine(item.Value + " (PID " + item.Key + ")");
            }
            Console.WriteLine("Closing ChatGPT alone does not stop Cursor or other client integrations. After closing them, click Retry. No installed files have been removed and connected applications have not been force-closed.");
            return 10;
        } catch {
            Console.WriteLine("Setup could not verify that NCF files are free. Close NCF from its tray menu and close connected applications (ChatGPT, Cursor, AionUi, Claude or OpenCode), then click Retry. Setup has not removed any installed files or force-closed connected applications.");
            return 20;
        }
    }
}

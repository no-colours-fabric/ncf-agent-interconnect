using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Management;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

[assembly: AssemblyProduct("NCF Agent Interconnect")]
[assembly: AssemblyTitle("Isolated lifecycle fixture")]

// This fixture never loads vendor executables, working profiles or registry values.
// Reflection substitutes only the native process-construction boundary. The real
// console stop, private pipe, installer identity and Restart Manager methods run.
internal static class LifecycleFixture {
    [DllImport("kernel32.dll")] static extern bool FreeConsole();
    [DllImport("kernel32.dll")] static extern bool AllocConsole();
    [DllImport("kernel32.dll")] static extern IntPtr GetConsoleWindow();
    [DllImport("kernel32.dll")] static extern bool SetConsoleCtrlHandler(IntPtr handler, bool add);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window, int command);
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    static readonly BindingFlags Private = BindingFlags.Static | BindingFlags.NonPublic;
    static readonly ManualResetEvent End = new ManualResetEvent(false);
    static string Quote(string value) { return "\"" + value + "\""; }
    static string Root(string value) {
        string root = Path.GetFullPath(value);
        if (!File.Exists(Path.Combine(root, ".ncf-lifecycle-fixture"))) throw new Exception("Not a fixture root");
        return root;
    }
    static Type PipeType(string root) {
        var type = Assembly.LoadFile(Path.Combine(root, "resources", "app.asar.unpacked", "build", "assets", "codex-win-pipe.exe")).GetType("CodexWinPipe", true);
        type.GetField("user", Private).SetValue(null, WindowsIdentity.GetCurrent().User);
        return type;
    }
    static NamedPipeServerStream Pipe(Type type, string name, bool first = true) {
        return (NamedPipeServerStream)type.GetMethod("Pipe", Private).Invoke(null, new object[] { @"\\.\pipe\" + name, first });
    }
    static string ControlName() {
        string name = Environment.GetEnvironmentVariable("NCF_LIFECYCLE_PIPE");
        Guid id;
        if (name == null || !name.StartsWith("ncf-chatgpt-") || !Guid.TryParseExact(name.Substring(12), "D", out id)) throw new Exception("Fixture pipe scope");
        return name;
    }
    static Process Start(string image, string arguments) {
        return Process.Start(new ProcessStartInfo(image, arguments) {
            UseShellExecute = false, CreateNoWindow = false,
            RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
        });
    }
    static int WaitForQuit(string file) {
        Console.CancelKeyPress += (sender, e) => { e.Cancel = true; End.Set(); };
        using (var input = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.Read)) {
            Console.WriteLine("ready"); Console.Out.Flush();
            Task.Run(() => { Console.ReadLine(); End.Set(); });
            End.WaitOne();
        }
        return 0;
    }
    static int Server(string root, string mode) {
        Console.CancelKeyPress += (sender, e) => { e.Cancel = true; End.Set(); };
        Process host = null;
        try {
            if (mode == "owned" || mode == "foreign") {
                host = Start(Path.Combine(root, mode == "owned" ? "vendor" : "foreign", "codex-code-mode-host.exe"), "host " + Quote(root));
                if (!host.StandardOutput.ReadLineAsync().Wait(5000)) throw new Exception("Host readiness");
            }
            Console.WriteLine(Json.Serialize(new { ready = true, child = host == null ? 0 : host.Id })); Console.Out.Flush();
            Task.Run(() => { Console.ReadLine(); End.Set(); });
            End.WaitOne();
            return 0;
        } finally {
            if (host != null) {
                if (!host.HasExited) { host.StandardInput.WriteLine("quit"); host.StandardInput.Flush(); }
                if (!host.WaitForExit(5000)) throw new Exception("Fixture child did not exit gracefully");
                host.Dispose();
            }
        }
    }
    static int Worker(string root, string mode) {
        var heldArchive = new FileStream(Path.Combine(root, "resources", "app.asar"), FileMode.Open, FileAccess.Read, FileShare.Read);
        var writer = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true };
        FreeConsole(); if (!AllocConsole()) throw new Exception("Private console"); ShowWindow(GetConsoleWindow(), 0);
        if (!SetConsoleCtrlHandler(IntPtr.Zero, false)) throw new Exception("Console reset");
        var type = PipeType(root);
        string expectedHost = Path.Combine(root, "vendor", "codex-code-mode-host.exe");
        var field = type.GetField("codeModeHostPath", Private);
        if (field != null) field.SetValue(null, expectedHost);
        type.GetMethod("Pin", Private).Invoke(null, new object[] { expectedHost, false });
        Process server = Start(Path.Combine(root, "vendor", "codex.exe"), "server " + Quote(root) + " " + mode);
        if (!SetConsoleCtrlHandler(IntPtr.Zero, true)) throw new Exception("Console isolation");
        type.GetField("server", Private).SetValue(null, server);
        var ready = server.StandardOutput.ReadLineAsync();
        if (!ready.Wait(5000) || ready.Result == null) throw new Exception("Server readiness");
        Process wrongParent = null;
        if (mode == "wrong-parent") {
            wrongParent = Start(expectedHost, "host " + Quote(root));
            if (!wrongParent.StandardOutput.ReadLineAsync().Wait(5000)) throw new Exception("Unrelated host readiness");
        }
        NamedPipeServerStream active = null;
        NamedPipeClientStream client = null;
        var channels = type.GetField("channels", Private).GetValue(null);
        if (mode == "active") {
            string name = ControlName() + "-active";
            active = Pipe(type, name);
            var connected = active.WaitForConnectionAsync();
            client = new NamedPipeClientStream(".", name, PipeDirection.InOut);
            client.Connect(1000); connected.GetAwaiter().GetResult();
            channels.GetType().GetMethod("TryAdd").Invoke(channels, new object[] { "fixture-active", active });
        }
        var next = Pipe(type, ControlName() + "-control");
        writer.WriteLine(Json.Serialize(new { ready = true, server = server.Id, native = Json.DeserializeObject(ready.Result) }));
        try {
            for (;;) using (var pipe = next) {
                pipe.WaitForConnection();
                next = Pipe(type, ControlName() + "-control", false);
                var reader = new StreamReader(pipe, Encoding.UTF8, false, 4096, true);
                string action = reader.ReadLine(); bool exit = false;
                object answer;
                if (action == "status") answer = new { state = "enabled" };
                else if (action == "release-active") {
                    var values = new object[] { "fixture-active", null };
                    channels.GetType().GetMethod("TryRemove").Invoke(channels, values);
                    if (client != null) client.Dispose(); if (active != null) active.Dispose();
                    client = null; active = null; answer = new { released = true };
                } else if (action == "cleanup") {
                    if (wrongParent != null && !wrongParent.HasExited) { wrongParent.StandardInput.WriteLine("quit"); wrongParent.StandardInput.Flush(); if (!wrongParent.WaitForExit(5000)) throw new Exception("Unrelated fixture child cleanup"); }
                    if (!server.HasExited) { server.StandardInput.WriteLine("quit"); server.StandardInput.Flush(); }
                    if (!server.WaitForExit(5000)) throw new Exception("Fixture server cleanup");
                    answer = new { state = "ready" }; exit = true;
                } else if (action == "stop") {
                    var output = new MemoryStream(); type.GetField("output", Private).SetValue(null, output);
                    var input = new MemoryStream(Encoding.UTF8.GetBytes("{\"kind\":\"stopServer\"}\n{\"kind\":\"shutdown\",\"preserve\":true}\n"));
                    ((Task)type.GetMethod("Commands", Private).Invoke(null, new object[] { input })).GetAwaiter().GetResult();
                    bool stopped = Encoding.UTF8.GetString(output.ToArray()).Contains("\"ok\":true");
                    answer = new { state = stopped ? "ready" : active != null ? "close-required" : "unavailable" }; exit = stopped;
                } else throw new Exception("Fixture action");
                byte[] bytes = Encoding.UTF8.GetBytes(Json.Serialize(answer) + "\n");
                pipe.Write(bytes, 0, bytes.Length); pipe.Flush();
                if (exit) return 0;
            }
        } finally {
            next.Dispose();
            if (client != null) client.Dispose(); if (active != null) active.Dispose();
            if (wrongParent != null) { if (!wrongParent.HasExited) { wrongParent.StandardInput.WriteLine("quit"); wrongParent.StandardInput.Flush(); wrongParent.WaitForExit(5000); } wrongParent.Dispose(); }
            if (!server.HasExited) { server.StandardInput.WriteLine("quit"); server.StandardInput.Flush(); server.WaitForExit(5000); }
            server.Dispose();
            heldArchive.Dispose();
        }
    }
    static int StopCommand(string root) {
        var type = PipeType(root); var original = Console.Out; var capture = new StringWriter();
        try {
            Console.SetOut(capture);
            type.GetMethod("Control", Private).Invoke(null, new object[] { ControlName(), "stop" });
        } finally { Console.SetOut(original); }
        var result = Json.Deserialize<Dictionary<string, object>>(capture.ToString());
        return (string)result["state"] == "ready" || (string)result["state"] == "absent" ? 0 : 20;
    }
    static int Probe(string root, int pid) {
        var type = Assembly.LoadFile(Path.Combine(root, "resources", "tools", "ncf-update-preflight.exe")).GetType("NcfUpdatePreflight", true);
        type.GetField("owner", Private).SetValue(null, WindowsIdentity.GetCurrent().User.Value);
        type.GetField("currentRoot", Private).SetValue(null, root);
        string phase = "inventory";
        try {
            // Use the real projected WMI query, restricted to our known fixture PID.
            if (pid != 0) using (var query = (ManagementObjectSearcher)type.GetMethod("Query", Private).Invoke(null, new object[] { "ProcessId=" + pid }))
            using (var matches = query.Get()) foreach (ManagementObject process in matches) using (process)
                type.GetMethod("Inspect", Private).Invoke(null, new object[] { process, false });
            int recognized = ((ICollection)type.GetField("ownServices", Private).GetValue(null)).Count;
            phase = "service-stop";
            bool stopped = (bool)type.GetMethod("StopOwnService", Private).Invoke(null, new object[] { root });
            phase = "file-locks";
            type.GetMethod("InspectLocks", Private).Invoke(null, new object[] { root });
            var blockers = (Dictionary<uint, string>)type.GetField("blockers", Private).GetValue(null);
            var observed = new List<object>(); foreach (var row in blockers) observed.Add(new { pid = row.Key, role = row.Value });
            bool free;
            try { using (File.Open(Path.Combine(root, "resources", "app.asar"), FileMode.Open, FileAccess.ReadWrite, FileShare.None)) free = true; }
            catch (IOException) { free = false; }
            bool executableFree;
            try { using (File.Open(Path.Combine(root, "NCF Agent Interconnect.exe"), FileMode.Open, FileAccess.ReadWrite, FileShare.None)) executableFree = true; }
            catch (IOException) { executableFree = false; }
            Console.WriteLine(Json.Serialize(new { recognized, stopped, file = "resources/app.asar", exclusiveOpen = free, executableFree, blockers = observed }));
        } catch (Exception error) {
            Console.WriteLine(Json.Serialize(new { phase, error = error.GetBaseException().GetType().FullName }));
        }
        return 0;
    }
    static int CleanupWorker(string root, int pid) {
        using (var process = Process.GetProcessById(pid)) {
            if (!String.Equals(process.MainModule.FileName, Path.Combine(root, "NCF Agent Interconnect.exe"), StringComparison.OrdinalIgnoreCase)) throw new Exception("Fixture process identity");
            var type = PipeType(root);
            // Recover only this disposable child's one fixture endpoint, never an environment dump.
            string name = (string)type.GetMethod("Env", Private).Invoke(null, new object[] { process.Handle, "NCF_LIFECYCLE_PIPE" });
            Guid id; if (name == null || !name.StartsWith("ncf-chatgpt-") || !Guid.TryParseExact(name.Substring(12), "D", out id)) throw new Exception("Fixture endpoint");
            using (var pipe = new NamedPipeClientStream(".", name + "-control", PipeDirection.InOut)) {
                pipe.Connect(1000); byte[] text = Encoding.UTF8.GetBytes("cleanup\n"); pipe.Write(text, 0, text.Length); pipe.Flush();
                var response = new StreamReader(pipe).ReadLine(); if (response == null) throw new Exception("Fixture cleanup response");
            }
            if (!process.WaitForExit(5000)) throw new Exception("Fixture cleanup exit");
        }
        return 0;
    }
    public static int Main(string[] args) {
        try {
            Console.OutputEncoding = new UTF8Encoding(false);
            if (args.Length == 1 && args[0] == "--chatgpt-service-stop") return StopCommand(Root(Path.GetDirectoryName(Process.GetCurrentProcess().MainModule.FileName)));
            if (args.Length < 2) throw new Exception("Fixture arguments");
            string root = Root(args[1]);
            if (args[0] == "worker" && args.Length == 4) return Worker(root, args[2]);
            if (args[0] == "server" && args.Length == 3) return Server(root, args[2]);
            if (args[0] == "host" || args[0] == "busy") return WaitForQuit(Path.Combine(root, "resources", "app.asar"));
            if (args[0] == "probe" && args.Length == 3) return Probe(root, int.Parse(args[2]));
            if (args[0] == "cleanup-worker" && args.Length == 3) return CleanupWorker(root, int.Parse(args[2]));
            throw new Exception("Fixture mode");
        } catch (Exception error) { Console.Error.WriteLine(error.ToString()); return 30; }
    }
}

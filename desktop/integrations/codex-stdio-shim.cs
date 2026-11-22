using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using Microsoft.Win32.SafeHandles;

// Native CODEX_CLI_PATH entrypoint. The adjacent private manifest also works in
// auxiliary tool environments which do not inherit NCF or CODEX_HOME variables.
internal static class CodexStdioShim {
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool GetFileInformationByHandle(SafeFileHandle handle, out FileInformation information);
    [StructLayout(LayoutKind.Sequential)] struct FileInformation {
        public uint attributes; public System.Runtime.InteropServices.ComTypes.FILETIME creation, access, write;
        public uint volume, sizeHigh, sizeLow, links, indexHigh, indexLow;
    }
    static List<IDisposable> held = new List<IDisposable>();
    static string Full(string value) {
            if (String.IsNullOrEmpty(value) || value.Length < 3 || !Char.IsLetter(value[0]) || value[1] != ':' || value[2] != '\\' || value.IndexOf('\0') >= 0 || value.IndexOf(':', 2) >= 0 || value.IndexOf('\r') >= 0 || value.IndexOf('\n') >= 0)
            throw new InvalidOperationException();
            string full = Path.GetFullPath(value);
        if (!String.Equals(value.TrimEnd('\\'), full.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException();
        return full;
    }
    static void Pin(string filename, bool directory) {
        string full = Full(filename), cursor = full;
        bool first = true;
        while (true) {
            // Deny delete/rename while using this path; never follow a reparse point.
            var handle = CreateFile(cursor, 0x80, first && !directory ? 1u : 3u, IntPtr.Zero, 3, 0x02200000, IntPtr.Zero);
            if (handle.IsInvalid) { handle.Dispose(); throw new InvalidOperationException(); }
            held.Add(handle);
            FileInformation info;
            if (!GetFileInformationByHandle(handle, out info) || (info.attributes & 0x400) != 0) throw new InvalidOperationException();
            if (first && (((info.attributes & 0x10) != 0) != directory || (!directory && info.links != 1))) throw new InvalidOperationException();
            var parent = Directory.GetParent(cursor); if (parent == null) break;
            cursor = parent.FullName; first = false;
        }
    }
    static void Private(string filename, bool directory) {
        Pin(filename, directory);
        FileSystemSecurity acl = directory
            ? (FileSystemSecurity)new DirectoryInfo(filename).GetAccessControl(AccessControlSections.Owner | AccessControlSections.Access)
            : new FileInfo(filename).GetAccessControl(AccessControlSections.Owner | AccessControlSections.Access);
        var sid = WindowsIdentity.GetCurrent().User;
        var rules = acl.GetAccessRules(true, true, typeof(SecurityIdentifier));
        if (!sid.Equals(acl.GetOwner(typeof(SecurityIdentifier))) || !acl.AreAccessRulesProtected || rules.Count != 1) throw new InvalidOperationException();
        var rule = (FileSystemAccessRule)rules[0];
        var flags = directory ? InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit : InheritanceFlags.None;
        if (!sid.Equals(rule.IdentityReference) || rule.IsInherited || rule.AccessControlType != AccessControlType.Allow || rule.FileSystemRights != FileSystemRights.FullControl || rule.InheritanceFlags != flags || rule.PropagationFlags != PropagationFlags.None) throw new InvalidOperationException();
    }
    static string Hash(string file) {
        using (var input = File.OpenRead(file)) using (var hash = SHA256.Create())
            return BitConverter.ToString(hash.ComputeHash(input)).Replace("-", "").ToLowerInvariant();
    }
    static string Quote(string value) {
        var result = new StringBuilder("\""); int slashes = 0;
        foreach (char c in value) {
            if (c == '\\') { slashes++; continue; }
            if (c == '"') { result.Append('\\', slashes * 2 + 1); result.Append(c); }
            else { result.Append('\\', slashes); result.Append(c); }
            slashes = 0;
        }
        result.Append('\\', slashes * 2); return result.Append('"').ToString();
    }
    static async Task Forward(Stream source, Stream destination) {
        var buffer = new byte[65536]; int count;
        while ((count = await source.ReadAsync(buffer, 0, buffer.Length)) > 0) {
            await destination.WriteAsync(buffer, 0, count);
            await destination.FlushAsync();
        }
    }
    public static int Main(string[] args) {
        try {
            if (new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator)) throw new InvalidOperationException();
            string root = Full(AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\'));
            string manifest = Path.Combine(root, "manifest.json");
            Private(root, true); Private(manifest, false);
            if (new FileInfo(manifest).Length > 32768) throw new InvalidOperationException();
            var value = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(File.ReadAllText(manifest));
            string executable = Full((string)value["appExecutable"]), asar = Full((string)value["appPath"]);
            if (!String.Equals(Path.GetFileName(asar), "app.asar", StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException();
            Pin(executable, false); Pin(asar, false);
            Pin(Process.GetCurrentProcess().MainModule.FileName, false);
            if (Hash(executable) != (string)value["appExecutableHash"] || Hash(asar) != (string)value["asarHash"] || Hash(Process.GetCurrentProcess().MainModule.FileName) != (string)value["shimHash"]) throw new InvalidOperationException();
            string bridge = Path.Combine(asar, "build", "integrations", "codex-windows-bridge.cjs");
            var command = new StringBuilder(Quote(bridge)).Append(" --launcher-manifest ").Append(Quote(manifest)).Append(" --");
            foreach (var arg in args) command.Append(' ').Append(Quote(arg));
            var start = new ProcessStartInfo(executable, command.ToString()) {
                UseShellExecute=false, CreateNoWindow=true, RedirectStandardInput=true,
                RedirectStandardOutput=true, RedirectStandardError=true, WorkingDirectory=root
            };
            start.EnvironmentVariables["ELECTRON_RUN_AS_NODE"] = "1";
            using (var child = Process.Start(start)) {
                var input = Forward(Console.OpenStandardInput(), child.StandardInput.BaseStream);
                input.ContinueWith(task => { try { child.StandardInput.Close(); } catch { } });
                var output = child.StandardOutput.BaseStream.CopyToAsync(Console.OpenStandardOutput());
                var error = child.StandardError.BaseStream.CopyToAsync(Console.OpenStandardError());
                child.WaitForExit(); Task.WaitAll(output, error); return child.ExitCode;
            }
        } catch { Console.Error.WriteLine("NCF_CODEX_SHIM_VALIDATION_FAILED"); return 1; }
        finally { foreach (var handle in held) handle.Dispose(); }
    }
}

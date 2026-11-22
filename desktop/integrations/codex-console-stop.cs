using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;

internal static class ConsoleStop {
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool FreeConsole();
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool AttachConsole(uint pid);
    [DllImport("kernel32.dll",SetLastError=true)] static extern uint GetConsoleProcessList([Out] uint[] ids,uint count);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetConsoleCtrlHandler(IntPtr handler,bool add);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool GenerateConsoleCtrlEvent(uint kind,uint group);
    [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr handle,int type,ref BasicInfo info,int length,out int used);
    [StructLayout(LayoutKind.Sequential)] struct BasicInfo { public IntPtr reserved1,peb,reserved2,reserved3,pid,parent; }
    public static int Main(string[] args) {
        try {
            if(args.Length!=4) throw new ArgumentException("Expected exact PID, parent PID, executable path and owning runtime path.");
            int pid=int.Parse(args[0]), parent=int.Parse(args[1]);
            Process owned;
            try { owned=Process.GetProcessById(pid); } catch(ArgumentException) { return 0; }
            using(var target=owned) {
                if(!String.Equals(Path.GetFullPath(target.MainModule.FileName),Path.GetFullPath(args[2]),StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Own child image mismatch.");
                var basic=new BasicInfo(); int used;
                if(NtQueryInformationProcess(target.Handle,0,ref basic,Marshal.SizeOf(typeof(BasicInfo)),out used)!=0 || basic.parent.ToInt64()!=parent) throw new InvalidOperationException("Own child parent mismatch.");
                bool allowOwner=false;
                if(args.Length==4) {
                    using(var owner=Process.GetProcessById(parent)) {
                        if(!String.Equals(Path.GetFullPath(owner.MainModule.FileName),Path.GetFullPath(args[3]),StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Own controller image mismatch.");
                    }
                    var selfInfo=new BasicInfo();
                    if(NtQueryInformationProcess(Process.GetCurrentProcess().Handle,0,ref selfInfo,Marshal.SizeOf(typeof(BasicInfo)),out used)!=0 || selfInfo.parent.ToInt64()!=parent) throw new InvalidOperationException("Cleanup caller is not the owning controller.");
                    allowOwner=true;
                }
                FreeConsole();
                if(!AttachConsole((uint)pid)) throw new InvalidOperationException("Own child console unavailable; no forced fallback.");
                try {
                    var members=new uint[32]; uint count=GetConsoleProcessList(members,32);
                    if(count==0 || count>members.Length) throw new InvalidOperationException("Console membership unavailable.");
                    uint self=(uint)Process.GetCurrentProcess().Id;
                    for(int i=0;i<count;i++) if(members[i]!=(uint)pid && members[i]!=self && !(allowOwner && members[i]==(uint)parent)) throw new InvalidOperationException("Console contains another process; no signal sent.");
                    if(!SetConsoleCtrlHandler(IntPtr.Zero,true) || !GenerateConsoleCtrlEvent(0,0)) throw new InvalidOperationException("Console interrupt was not sent.");
                    if(!target.WaitForExit(15000)) throw new InvalidOperationException("Own child did not finish within the graceful bound; no forced fallback.");
                    return 0;
                } finally { FreeConsole(); }
            }
        } catch { Console.Error.WriteLine("NCF_CODEX_GRACEFUL_CLOSE_BLOCKED"); return 1; }
    }
}

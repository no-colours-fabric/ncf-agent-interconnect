using System;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Win32.SafeHandles;

internal sealed class GuardFailure : Exception {
    internal readonly string Category;
    internal readonly int NativeCode;
    internal GuardFailure(string category, int nativeCode=0) { Category=category; NativeCode=nativeCode; }
}
internal static class WinNative {
    internal const uint ReadControl=0x20000, ReadAttributes=0x80, ListDirectory=1, ShareRead=1, ShareWrite=2, ShareDelete=4;
    internal const uint BackupSemantics=0x02000000, OpenReparsePoint=0x00200000, Directory=0x10, Reparse=0x400;
    internal const int FileAllAccess=0x001F01FF;
    [StructLayout(LayoutKind.Sequential)] internal struct FileInfo {
        internal uint Attributes;
        internal System.Runtime.InteropServices.ComTypes.FILETIME Creation, Access, Write;
        internal uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow;
    }
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] internal static extern SafeFileHandle CreateFileW(string path,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
    [DllImport("kernel32.dll",SetLastError=true)] internal static extern bool GetFileInformationByHandle(SafeFileHandle file,out FileInfo info);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] internal static extern uint GetFinalPathNameByHandleW(SafeFileHandle file,StringBuilder path,uint count,uint flags);
    [DllImport("advapi32.dll",SetLastError=true)] internal static extern uint GetSecurityInfo(IntPtr handle,int objectType,uint information,out IntPtr owner,out IntPtr group,out IntPtr dacl,out IntPtr sacl,out IntPtr descriptor);
    [DllImport("advapi32.dll",SetLastError=true)] internal static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
    [DllImport("kernel32.dll")] internal static extern IntPtr LocalFree(IntPtr pointer);
    [DllImport("kernel32.dll",SetLastError=true)] internal static extern IntPtr OpenProcess(uint access,bool inherit,uint pid);
    [DllImport("kernel32.dll")] internal static extern IntPtr GetCurrentProcess();
    [DllImport("kernel32.dll",SetLastError=true)] internal static extern bool CloseHandle(IntPtr handle);
    [DllImport("advapi32.dll",SetLastError=true)] internal static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
    [DllImport("advapi32.dll",SetLastError=true)] internal static extern bool GetTokenInformation(IntPtr token,int kind,IntPtr information,int length,out int needed);
    [DllImport("ws2_32.dll")] internal static extern int WSAStartup(ushort version,IntPtr data);
    [DllImport("ws2_32.dll")] internal static extern int WSACleanup();
    [DllImport("ws2_32.dll")] internal static extern int WSAGetLastError();
    [DllImport("ws2_32.dll")] internal static extern IntPtr socket(int family,int type,int protocol);
    [DllImport("ws2_32.dll")] internal static extern int closesocket(IntPtr socket);
    [DllImport("ws2_32.dll")] internal static extern int connect(IntPtr socket,byte[] address,int length);
    [DllImport("ws2_32.dll")] internal static extern int bind(IntPtr socket,byte[] address,int length);
    [DllImport("ws2_32.dll")] internal static extern int listen(IntPtr socket,int backlog);
    [DllImport("ws2_32.dll")] internal static extern IntPtr accept(IntPtr socket,IntPtr address,IntPtr length);
    [DllImport("ws2_32.dll")] internal static extern int send(IntPtr socket,IntPtr buffer,int length,int flags);
    [DllImport("ws2_32.dll")] internal static extern int recv(IntPtr socket,byte[] buffer,int length,int flags);
    [DllImport("ws2_32.dll")] internal static extern int shutdown(IntPtr socket,int how);
    [DllImport("ws2_32.dll")] internal static extern int WSAIoctl(IntPtr socket,uint code,IntPtr input,uint inputLength,out uint pid,uint outputLength,out uint returned,IntPtr overlapped,IntPtr completion);
    internal static void FailWin(string category) { throw new GuardFailure(category,Marshal.GetLastWin32Error()); }
    internal static void FailSocket(string category) { throw new GuardFailure(category,WSAGetLastError()); }
    internal static byte[] Address(string value) {
        byte[] bytes=new UTF8Encoding(false,true).GetBytes(value);
        if(bytes.Length==0 || bytes.Length>=108) throw new GuardFailure("PATH_LENGTH");
        var address=new byte[110]; address[0]=1; Buffer.BlockCopy(bytes,0,address,2,bytes.Length); return address;
    }
    internal static string FinalPath(SafeFileHandle file) {
        var text=new StringBuilder(32768);
        uint count=GetFinalPathNameByHandleW(file,text,(uint)text.Capacity,0);
        if(count==0 || count>=text.Capacity) FailWin("CANONICAL_PATH");
        string value=text.ToString();
        if(value.StartsWith(@"\\?\UNC\",StringComparison.OrdinalIgnoreCase)) throw new GuardFailure("UNC_PATH");
        return value.StartsWith(@"\\?\",StringComparison.Ordinal)?value.Substring(4):value;
    }
    internal static SecurityIdentifier User(IntPtr token) {
        int needed; GetTokenInformation(token,1,IntPtr.Zero,0,out needed);
        if(needed<=0 || needed>65536) FailWin("TOKEN_USER");
        IntPtr data=Marshal.AllocHGlobal(needed);
        try { if(!GetTokenInformation(token,1,data,needed,out needed)) FailWin("TOKEN_USER"); return new SecurityIdentifier(Marshal.ReadIntPtr(data)); }
        finally { Marshal.FreeHGlobal(data); }
    }
    internal static void NonElevated(IntPtr token) {
        int needed; IntPtr data=Marshal.AllocHGlobal(4);
        try { if(!GetTokenInformation(token,20,data,4,out needed)) FailWin("TOKEN_ELEVATION"); if(Marshal.ReadInt32(data)!=0) throw new GuardFailure("ELEVATED_TOKEN"); }
        finally { Marshal.FreeHGlobal(data); }
    }
    internal static void ValidateDirectory(SafeFileHandle directory,SecurityIdentifier current) {
        FileInfo info;
        if(!GetFileInformationByHandle(directory,out info)) FailWin("DIRECTORY_METADATA");
        if((info.Attributes&Directory)==0) throw new GuardFailure("NOT_DIRECTORY");
        if((info.Attributes&Reparse)!=0) throw new GuardFailure("REPARSE_DIRECTORY");
        IntPtr owner,group,dacl,sacl,descriptor;
        uint status=GetSecurityInfo(directory.DangerousGetHandle(),1,1|4,out owner,out group,out dacl,out sacl,out descriptor);
        if(status!=0) throw new GuardFailure("DIRECTORY_SECURITY",(int)status);
        try {
            uint length=GetSecurityDescriptorLength(descriptor);
            if(length==0 || length>65536) throw new GuardFailure("SECURITY_DESCRIPTOR");
            byte[] bytes=new byte[length]; Marshal.Copy(descriptor,bytes,0,bytes.Length);
            var security=new RawSecurityDescriptor(bytes,0);
            if(security.Owner==null || !security.Owner.Equals(current)) throw new GuardFailure("DIRECTORY_OWNER");
            if((security.ControlFlags&ControlFlags.DiscretionaryAclProtected)==0 || security.DiscretionaryAcl==null || security.DiscretionaryAcl.Count!=1) throw new GuardFailure("DIRECTORY_DACL");
            var ace=security.DiscretionaryAcl[0] as CommonAce;
            if(ace==null || ace.AceType!=AceType.AccessAllowed || ace.AceFlags!=(AceFlags.ContainerInherit|AceFlags.ObjectInherit) || ace.AccessMask!=FileAllAccess || !ace.SecurityIdentifier.Equals(current)) throw new GuardFailure("DIRECTORY_ACE");
        } finally { LocalFree(descriptor); }
    }
    internal static void SendAll(IntPtr socket,byte[] bytes,int count) {
        var pinned=GCHandle.Alloc(bytes,GCHandleType.Pinned);
        try { int sent=0; while(sent<count) { int size=send(socket,IntPtr.Add(pinned.AddrOfPinnedObject(),sent),count-sent,0); if(size<=0) FailSocket("SEND"); sent+=size; } }
        finally { pinned.Free(); }
    }
}

internal static class CodexWinSocket {
    public static int Main(string[] args) {
        IntPtr currentToken=IntPtr.Zero,peerProcess=IntPtr.Zero,peerToken=IntPtr.Zero,socket=new IntPtr(-1);
        bool initialized=false;
        try {
            uint expectedPid=0;
            if(args.Length<1 || args.Length>2 || (args.Length==2 && (!uint.TryParse(args[1],out expectedPid) || expectedPid==0))) throw new GuardFailure("ARGUMENTS");
            string supplied=args[0].Replace('/','\\');
            if(supplied.Length<3 || !Char.IsLetter(supplied[0]) || supplied[1]!=':' || supplied[2]!='\\' || supplied.IndexOf('\0')>=0) throw new GuardFailure("ABSOLUTE_PATH");
            string full=Path.GetFullPath(supplied);
            if(!String.Equals(supplied,full,StringComparison.OrdinalIgnoreCase) || Path.GetFileName(full)!="app-server-control.sock") throw new GuardFailure("SOCKET_PATH");
            string parent=Path.GetDirectoryName(full);
            if(Path.GetFileName(parent)!="app-server-control") throw new GuardFailure("SOCKET_PARENT");
            string home=Path.GetDirectoryName(parent);
            if(!WinNative.OpenProcessToken(WinNative.GetCurrentProcess(),8,out currentToken)) WinNative.FailWin("CURRENT_TOKEN");
            WinNative.NonElevated(currentToken);
            SecurityIdentifier current=WinNative.User(currentToken);
            using(var homeHandle=WinNative.CreateFileW(home,WinNative.ReadAttributes,WinNative.ShareRead|WinNative.ShareWrite|WinNative.ShareDelete,IntPtr.Zero,3,WinNative.BackupSemantics,IntPtr.Zero)) {
                if(homeHandle.IsInvalid) WinNative.FailWin("HOME_OPEN");
                if(!String.Equals(WinNative.FinalPath(homeHandle),home,StringComparison.OrdinalIgnoreCase)) throw new GuardFailure("HOME_NOT_CANONICAL");
            }
            using(var directory=WinNative.CreateFileW(parent,WinNative.ReadControl|WinNative.ReadAttributes|WinNative.ListDirectory,WinNative.ShareRead|WinNative.ShareWrite,IntPtr.Zero,3,WinNative.BackupSemantics|WinNative.OpenReparsePoint,IntPtr.Zero)) {
                if(directory.IsInvalid) WinNative.FailWin("DIRECTORY_OPEN");
                WinNative.ValidateDirectory(directory,current);
                if(!String.Equals(WinNative.FinalPath(directory),parent,StringComparison.OrdinalIgnoreCase)) throw new GuardFailure("PARENT_NOT_CANONICAL");
                IntPtr startup=Marshal.AllocHGlobal(512);
                try { int code=WinNative.WSAStartup(0x0202,startup); if(code!=0) throw new GuardFailure("WSA_STARTUP",code); initialized=true; }
                finally { Marshal.FreeHGlobal(startup); }
                socket=WinNative.socket(1,1,0);
                if(socket==new IntPtr(-1)) WinNative.FailSocket("SOCKET_CREATE");
                byte[] address=WinNative.Address(full);
                var connected=Task.Factory.StartNew(()=>{if(WinNative.connect(socket,address,address.Length)!=0) WinNative.FailSocket("CONNECT");});
                if(!connected.Wait(5000)) throw new GuardFailure("CONNECT_TIMEOUT");
                uint peerPid,returned;
                if(WinNative.WSAIoctl(socket,0x58000100,IntPtr.Zero,0,out peerPid,4,out returned,IntPtr.Zero,IntPtr.Zero)!=0) WinNative.FailSocket("PEER_PID");
                if(peerPid==0 || (expectedPid!=0 && peerPid!=expectedPid)) throw new GuardFailure("PEER_PID_MISMATCH");
                peerProcess=WinNative.OpenProcess(0x1000,false,peerPid);
                if(peerProcess==IntPtr.Zero) WinNative.FailWin("PEER_PROCESS");
                if(!WinNative.OpenProcessToken(peerProcess,8,out peerToken)) WinNative.FailWin("PEER_TOKEN");
                if(!WinNative.User(peerToken).Equals(current)) throw new GuardFailure("PEER_USER");
                WinNative.NonElevated(peerToken);
                WinNative.NonElevated(currentToken);
                WinNative.ValidateDirectory(directory,current);
                IntPtr channel=socket;
                var input=Task.Factory.StartNew(()=>{
                    using(Stream source=Console.OpenStandardInput()) {
                        byte[] buffer=new byte[65536]; int count;
                        while((count=source.Read(buffer,0,buffer.Length))>0) WinNative.SendAll(channel,buffer,count);
                    }
                    if(WinNative.shutdown(channel,1)!=0) { int code=WinNative.WSAGetLastError(); if(code!=10057) throw new GuardFailure("HALF_CLOSE",code); }
                });
                var output=Task.Factory.StartNew(()=>{
                    using(Stream destination=Console.OpenStandardOutput()) {
                        byte[] buffer=new byte[65536]; int count;
                        while((count=WinNative.recv(channel,buffer,buffer.Length,0))>0) destination.Write(buffer,0,count);
                        if(count<0) WinNative.FailSocket("RECEIVE"); destination.Flush();
                    }
                });
                try {
                    int first=Task.WaitAny(input,output);
                    if(first==0) { input.GetAwaiter().GetResult(); output.GetAwaiter().GetResult(); }
                    else { output.GetAwaiter().GetResult(); if(input.IsCompleted) input.GetAwaiter().GetResult(); }
                }
                catch { WinNative.closesocket(socket);socket=new IntPtr(-1);throw; }
            }
            return 0;
        } catch(Exception error) {
            var aggregate=error as AggregateException;
            if(aggregate!=null) error=aggregate.Flatten().InnerExceptions[0];
            var guarded=error as GuardFailure;
            Console.Error.WriteLine(guarded!=null?"NCF_UDS_"+guarded.Category+" code="+guarded.NativeCode:"NCF_UDS_FAILURE type="+error.GetType().Name);
            return 1;
        } finally {
            if(socket!=new IntPtr(-1)) WinNative.closesocket(socket);
            if(initialized) WinNative.WSACleanup();
            if(peerToken!=IntPtr.Zero) WinNative.CloseHandle(peerToken);
            if(peerProcess!=IntPtr.Zero) WinNative.CloseHandle(peerProcess);
            if(currentToken!=IntPtr.Zero) WinNative.CloseHandle(currentToken);
        }
    }
}

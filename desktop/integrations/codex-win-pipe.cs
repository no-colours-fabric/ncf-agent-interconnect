using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using Microsoft.Win32;
using Microsoft.Win32.SafeHandles;

// Private, local-only transport. Payloads are opaque bytes; no model or chat selection occurs here.
internal static class CodexWinPipe {
    [StructLayout(LayoutKind.Sequential)] struct SecurityAttributes { public int Length; public IntPtr Descriptor; [MarshalAs(UnmanagedType.Bool)] public bool Inherit; }
    [StructLayout(LayoutKind.Sequential)] struct BasicProcess { public IntPtr Reserved1, Peb, Reserved2A, Reserved2B, Pid, Parent; }
    [StructLayout(LayoutKind.Sequential)] struct UnicodeString { public ushort Length, MaximumLength; public IntPtr Buffer; }
    [StructLayout(LayoutKind.Sequential)] struct FileInformation { public uint Attributes; public System.Runtime.InteropServices.ComTypes.FILETIME Creation,Access,Write; public uint Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow; }
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern SafeFileHandle CreateFileW(string name,uint access,uint share,IntPtr security,uint creation,uint flags,IntPtr template);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetFileInformationByHandle(SafeFileHandle handle,out FileInformation info);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern uint GetFileAttributesW(string name);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern SafePipeHandle CreateNamedPipeW(string name,uint openMode,uint pipeMode,uint maximum,uint output,uint input,uint timeout,ref SecurityAttributes attributes);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetNamedPipeClientProcessId(SafePipeHandle pipe,out uint pid);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetNamedPipeServerProcessId(SafePipeHandle pipe,out uint pid);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool WaitNamedPipeW(string name,uint timeout);
    [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint timeout);
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,uint pid);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr value);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern bool QueryFullProcessImageNameW(IntPtr process,uint flags,StringBuilder text,ref uint length);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern int GetPackageFullName(IntPtr process,ref uint length,StringBuilder text);
    [DllImport("kernel32.dll")] static extern bool GetProcessTimes(IntPtr process,out long created,out long exited,out long kernel,out long user);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool ReadProcessMemory(IntPtr process,IntPtr address,byte[] data,int size,out IntPtr read);
    [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr process,int kind,ref BasicProcess data,int size,out int used);
    [DllImport("ntdll.dll", EntryPoint="NtQueryInformationProcess")] static extern int QueryCommand(IntPtr process,int kind,IntPtr data,int size,out int used);
    [DllImport("advapi32.dll")] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
    [DllImport("advapi32.dll")] static extern bool GetTokenInformation(IntPtr token,int kind,IntPtr data,int size,out int needed);
    [DllImport("shell32.dll", CharSet=CharSet.Unicode)] static extern IntPtr CommandLineToArgvW(string command,out int count);
    [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr value);
    [DllImport("kernel32.dll")] static extern bool AllocConsole();
    [DllImport("kernel32.dll")] static extern bool FreeConsole();
    [DllImport("kernel32.dll")] static extern IntPtr GetConsoleWindow();
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window,int command);
    [DllImport("kernel32.dll")] static extern uint GetConsoleProcessList([Out] uint[] ids,uint count);
    [DllImport("kernel32.dll")] static extern bool SetConsoleCtrlHandler(IntPtr handler,bool add);
    [DllImport("kernel32.dll")] static extern bool GenerateConsoleCtrlEvent(uint kind,uint group);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr SendMessageTimeoutW(IntPtr window,uint message,IntPtr parameter,string text,uint flags,uint timeout,out IntPtr result);
    static readonly object outputLock=new object();
    static readonly JavaScriptSerializer json=new JavaScriptSerializer { MaxJsonLength=196608 };
    static readonly ConcurrentDictionary<string,NamedPipeServerStream> channels=new ConcurrentDictionary<string,NamedPipeServerStream>();
    static readonly ConcurrentDictionary<string,TaskCompletionSource<object>> responses=new ConcurrentDictionary<string,TaskCompletionSource<object>>();
    static readonly List<NamedPipeServerStream> listeners=new List<NamedPipeServerStream>();
    static readonly List<IDisposable> pins=new List<IDisposable>();
    static Stream output;
    static SecurityIdentifier user;
    static volatile bool stopping;
    static bool accepting=true;
    static readonly object lifecycle=new object();
    static Process server;
    static string image,package,profile,desktop,controllerImage;
    static string codeModeHostPath;
    static string advertisedRoute;
    static bool preserveRoute;
    static bool ownsRoute;
    static string stage="arguments";
    static string Full(string value) {
        if(String.IsNullOrWhiteSpace(value)||!Regex.IsMatch(value,@"^[A-Za-z]:\\")||value.IndexOf(':',2)>=0||value.IndexOfAny(new[]{'\0','\r','\n','"'})>=0)throw new Exception("PATH");
        string full=Path.GetFullPath(value).TrimEnd('\\');if(!String.Equals(full,value.TrimEnd('\\'),StringComparison.OrdinalIgnoreCase))throw new Exception("CANONICAL");return full;
    }
    static void Pin(string value,bool directory) {
        string at=Full(value);bool first=true;
        int depth=0;for(;;){var handle=CreateFileW(at,0x80,first&&!directory?1u:3u,IntPtr.Zero,3,0x02200000,IntPtr.Zero);if(handle.IsInvalid){int error=Marshal.GetLastWin32Error();handle.Dispose();
            // Windows denies opening the protected WindowsApps container itself.
            // The exact package, app, resources and asset handles are already pinned.
            // Preserve the container's no-reparse check through its read-only attributes.
            string container=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"WindowsApps");uint attributes=GetFileAttributesW(at);
            if(first||error!=5||!String.Equals(at,container,StringComparison.OrdinalIgnoreCase)||attributes==0xffffffff||(attributes&0x410)!=0x10)throw new Exception("PATH_HANDLE_"+depth+"_"+error);
        }else{pins.Add(handle);FileInformation info;if(!GetFileInformationByHandle(handle,out info)||(info.Attributes&0x400)!=0)throw new Exception("REPARSE");if(first&&(((info.Attributes&0x10)!=0)!=directory||(!directory&&info.Links!=1)))throw new Exception("PATH_KIND");}
            var parent=Directory.GetParent(at);if(parent==null)break;at=parent.FullName;first=false;depth++;}
    }
    static string Hash(string file){using(var input=new FileStream(file,FileMode.Open,FileAccess.Read,FileShare.Read,1024*1024,FileOptions.SequentialScan))using(var hash=new SHA256Cng())return BitConverter.ToString(hash.ComputeHash(input)).Replace("-","").ToLowerInvariant();}
    static string Quote(string value){return "\""+value.Replace("\"","\\\"")+"\"";}
    static void Emit(object value){lock(outputLock){byte[] bytes=Encoding.UTF8.GetBytes(json.Serialize(value)+"\n");output.Write(bytes,0,bytes.Length);output.Flush();}}
    static void SameUser(IntPtr process) {
        IntPtr token;if(!OpenProcessToken(process,8,out token))throw new Exception("TOKEN");
        try{using(var identity=new WindowsIdentity(token))if(!identity.User.Equals(user))throw new Exception("USER");IntPtr p=Marshal.AllocHGlobal(4);try{int needed;if(!GetTokenInformation(token,20,p,4,out needed)||Marshal.ReadInt32(p)!=0)throw new Exception("ELEVATION");}finally{Marshal.FreeHGlobal(p);}}
        finally{CloseHandle(token);}
    }
    static string Image(IntPtr process){var b=new StringBuilder(4096);uint n=(uint)b.Capacity;if(!QueryFullProcessImageNameW(process,0,b,ref n))throw new Exception("IMAGE");return Full(b.ToString());}
    static long Identity(IntPtr process,bool gui) {
        SameUser(process);if(!String.Equals(Image(process),gui?image:controllerImage,StringComparison.OrdinalIgnoreCase))throw new Exception("IMAGE");
        if(gui){uint length=0;if(GetPackageFullName(process,ref length,null)!=122||length>1024||length==0)throw new Exception("PACKAGE");var b=new StringBuilder((int)length);if(GetPackageFullName(process,ref length,b)!=0||b.ToString()!=package)throw new Exception("PACKAGE");}
        long created,exited,kernel,cpu;if(!GetProcessTimes(process,out created,out exited,out kernel,out cpu)||created<=0||created>DateTime.UtcNow.ToFileTimeUtc())throw new Exception("START");return created;
    }
    static BasicProcess Basic(IntPtr process){var data=new BasicProcess();int used;if(NtQueryInformationProcess(process,0,ref data,Marshal.SizeOf(typeof(BasicProcess)),out used)!=0)throw new Exception("PARENT");return data;}
    static byte[] Read(IntPtr process,long address,int count){var data=new byte[count];IntPtr read;if(!ReadProcessMemory(process,new IntPtr(address),data,count,out read)||read.ToInt64()!=count)throw new Exception("PROCESS_READ");return data;}
    static string Env(IntPtr process,string key) {
        // Read bounded UTF-16 entries without logging, exporting or retaining the environment block.
        long parameters=BitConverter.ToInt64(Read(process,Basic(process).Peb.ToInt64()+0x20,8),0);
        long environment=BitConverter.ToInt64(Read(process,parameters+0x80,8),0);var entry=new StringBuilder();
        for(int offset=0;offset<131072;offset+=2){char c=(char)BitConverter.ToUInt16(Read(process,environment+offset,2),0);if(c=='\0'){if(entry.Length==0)return null;string s=entry.ToString();entry.Clear();if(s.StartsWith(key+"=",StringComparison.OrdinalIgnoreCase))return s.Substring(key.Length+1);}else{entry.Append(c);if(entry.Length>32768)throw new Exception("ENV_BOUND");}}
        throw new Exception("ENV_BOUND");
    }
    static bool MainProcess(IntPtr process){IntPtr p=Marshal.AllocHGlobal(65536);try{int used;if(QueryCommand(process,60,p,65536,out used)!=0)throw new Exception("COMMAND");var s=(UnicodeString)Marshal.PtrToStructure(p,typeof(UnicodeString));string command=Marshal.PtrToStringUni(s.Buffer,s.Length/2);int count;IntPtr argv=CommandLineToArgvW(command,out count);if(argv==IntPtr.Zero)throw new Exception("COMMAND");try{for(int i=1;i<count;i++){string arg=Marshal.PtrToStringUni(Marshal.ReadIntPtr(argv,i*IntPtr.Size));if(arg=="--type"||arg.StartsWith("--type=",StringComparison.OrdinalIgnoreCase))return false;if(arg=="--profile"||arg.StartsWith("--profile=",StringComparison.OrdinalIgnoreCase))throw new Exception("PROFILE_ARGUMENT");if(arg=="--user-data-dir"){if(++i>=count)throw new Exception("DATA_ARGUMENT");arg="--user-data-dir="+Marshal.PtrToStringUni(Marshal.ReadIntPtr(argv,i*IntPtr.Size));}if(arg.StartsWith("--user-data-dir=",StringComparison.OrdinalIgnoreCase)&&!String.Equals(Full(arg.Substring(16)),desktop,StringComparison.OrdinalIgnoreCase))throw new Exception("DATA_ARGUMENT");}return true;}finally{LocalFree(argv);}}finally{Marshal.FreeHGlobal(p);}}
    static void MatchProfile(IntPtr main) {
        string home=Env(main,"CODEX_HOME");if(String.IsNullOrWhiteSpace(home)){string owner=Env(main,"USERPROFILE");if(String.IsNullOrWhiteSpace(owner))throw new Exception("PROFILE");home=Path.Combine(owner,".codex");}
        if(!String.Equals(Full(home),profile,StringComparison.OrdinalIgnoreCase))throw new Exception("PROFILE");
        string data=Env(main,"CODEX_ELECTRON_USER_DATA_PATH");if(String.IsNullOrWhiteSpace(data)){string roaming=Env(main,"APPDATA");if(String.IsNullOrWhiteSpace(roaming))throw new Exception("DATA");data=Path.Combine(roaming,"Codex");}
        if(!String.Equals(Full(data),desktop,StringComparison.OrdinalIgnoreCase))throw new Exception("DATA");
        if(!String.IsNullOrWhiteSpace(Env(main,"CODEX_CLI_PATH")))throw new Exception("CLI_OVERRIDE");
        if(!String.IsNullOrWhiteSpace(Env(main,"CODEX_SQLITE_HOME")))throw new Exception("DATABASE_OVERRIDE");
    }
    static void VerifyGui(uint pid) {
        IntPtr peer=OpenProcess(0x1410,false,pid),main=IntPtr.Zero;if(peer==IntPtr.Zero)throw new Exception("PEER");
        try{long peerStart=Identity(peer,true);if(MainProcess(peer)){MatchProfile(peer);return;}uint parent=(uint)Basic(peer).Parent.ToInt64();main=OpenProcess(0x1410,false,parent);if(main==IntPtr.Zero||Identity(main,true)>peerStart||!MainProcess(main))throw new Exception("LINEAGE");MatchProfile(main);}
        finally{if(main!=IntPtr.Zero)CloseHandle(main);CloseHandle(peer);}
    }
    static string Name(string name){if(!Regex.IsMatch(name,@"^ncf-chatgpt-[a-f0-9-]{36}$"))throw new Exception("PIPE_NAME");return @"\\.\pipe\"+name;}
    static void Acl(PipeStream pipe){var acl=pipe.GetAccessControl();var rules=acl.GetAccessRules(true,true,typeof(SecurityIdentifier));if(!acl.AreAccessRulesProtected||!acl.GetOwner(typeof(SecurityIdentifier)).Equals(user)||rules.Count!=1)throw new Exception("DACL");var rule=rules[0] as PipeAccessRule;if(rule==null||rule.IsInherited||rule.AccessControlType!=AccessControlType.Allow||rule.PipeAccessRights!=PipeAccessRights.FullControl||!rule.IdentityReference.Equals(user))throw new Exception("ACE");}
    static NamedPipeServerStream Pipe(string name,bool first){var acl=new PipeSecurity();acl.SetOwner(user);acl.SetAccessRuleProtection(true,false);acl.AddAccessRule(new PipeAccessRule(user,PipeAccessRights.FullControl,AccessControlType.Allow));byte[] bytes=acl.GetSecurityDescriptorBinaryForm();IntPtr p=Marshal.AllocHGlobal(bytes.Length);try{Marshal.Copy(bytes,0,p,bytes.Length);var sa=new SecurityAttributes{Length=Marshal.SizeOf(typeof(SecurityAttributes)),Descriptor=p};var handle=CreateNamedPipeW(name,3u|0x40000000u|(first?0x00080000u:0),8u,16,65536,65536,0,ref sa);if(handle.IsInvalid){handle.Dispose();throw new Exception("PIPE_CREATE");}var pipe=new NamedPipeServerStream(PipeDirection.InOut,true,false,handle);Acl(pipe);lock(listeners)listeners.Add(pipe);return pipe;}finally{Marshal.FreeHGlobal(p);}}
    static async Task ServeGui(NamedPipeServerStream next,string name){for(;;){var pipe=next;await pipe.WaitForConnectionAsync();if(stopping)return;next=Pipe(name,false);Task.Run(async()=>{string id=Guid.NewGuid().ToString();try{uint pid;if(!GetNamedPipeClientProcessId(pipe.SafePipeHandle,out pid))throw new Exception("PEER");VerifyGui(pid);lock(lifecycle){if(!accepting||channels.Count>=8)throw new Exception("CAPACITY");if(!channels.TryAdd(id,pipe))throw new Exception("CHANNEL");}Emit(new{kind="open",id,pid});var b=new byte[65536];int count;while((count=await pipe.ReadAsync(b,0,b.Length))>0)Emit(new{kind="data",id,data=Convert.ToBase64String(b,0,count)});}catch{Emit(new{kind="rejected",id});}finally{NamedPipeServerStream ignored;channels.TryRemove(id,out ignored);pipe.Dispose();lock(listeners)listeners.Remove(pipe);Emit(new{kind="close",id});}});}}
    static async Task ServeControl(NamedPipeServerStream next,string name){for(;;){var pipe=next;await pipe.WaitForConnectionAsync();if(stopping)return;next=Pipe(name,false);Task.Run(async()=>{string id=Guid.NewGuid().ToString();try{uint pid;if(!GetNamedPipeClientProcessId(pipe.SafePipeHandle,out pid))throw new Exception("CONTROL_PEER");IntPtr peer=OpenProcess(0x1000,false,pid);if(peer==IntPtr.Zero)throw new Exception("CONTROL_PEER");try{SameUser(peer);string actual=Image(peer),self=Full(Process.GetCurrentProcess().MainModule.FileName);if(!String.Equals(actual,controllerImage,StringComparison.OrdinalIgnoreCase)&&!String.Equals(actual,self,StringComparison.OrdinalIgnoreCase))throw new Exception("CONTROL_IMAGE");}finally{CloseHandle(peer);}var reader=new StreamReader(pipe,new UTF8Encoding(false),false,4096,true);string action=await reader.ReadLineAsync();if(action!="status"&&action!="stop"&&action!="disable")throw new Exception("CONTROL_ACTION");var response=new TaskCompletionSource<object>();responses[id]=response;Emit(new{kind="control",id,action,active=channels.Count});if(await Task.WhenAny(response.Task,Task.Delay(20000))!=response.Task)throw new Exception("CONTROL_TIMEOUT");byte[] bytes=Encoding.UTF8.GetBytes(json.Serialize(await response.Task)+"\n");await pipe.WriteAsync(bytes,0,bytes.Length);await pipe.FlushAsync();Emit(new{kind="controlDone",id});}catch{}finally{TaskCompletionSource<object> ignored;responses.TryRemove(id,out ignored);pipe.Dispose();lock(listeners)listeners.Remove(pipe);}});}}
    static string VendorCli() {
        string resources=Path.Combine(Path.GetDirectoryName(image),"resources");var names=new[]{"codex.exe","codex-code-mode-host.exe","codex-windows-sandbox-setup.exe","codex-command-runner.exe"};var hashes=new List<string>();var input=new StringBuilder();foreach(string name in names){stage="package-"+name;string file=Path.Combine(resources,name);Pin(file,false);string hash=Hash(file);hashes.Add(hash);input.Append(name).Append('\0').Append(hash).Append('\0');}
        string key;using(var hash=SHA256.Create())key=BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(input.ToString()))).Replace("-","").ToLowerInvariant().Substring(0,16);
        stage="cache";string cache=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"OpenAI","Codex","bin",key);Pin(cache,true);for(int i=0;i<names.Length;i++){stage="cache-"+names[i];string file=Path.Combine(cache,names[i]);Pin(file,false);if(Hash(file)!=hashes[i])throw new Exception("CLI_IDENTITY");}codeModeHostPath=Path.Combine(cache,"codex-code-mode-host.exe");return Path.Combine(cache,"codex.exe");
    }
    static void StartServer() {
        string cli=VendorCli();Pin(profile,true);Pin(desktop,true);string directory=Path.Combine(profile,"app-server-control");Pin(directory,true);
        // A separate hidden console makes Ctrl+C target exactly this broker and its verified CLI.
        FreeConsole();if(!AllocConsole())throw new Exception("CONSOLE");ShowWindow(GetConsoleWindow(),0);
        // A detached controller starts a new process group with Ctrl+C ignored.
        // Reset that inherited process attribute before spawning our CLI; only
        // the broker itself ignores Ctrl+C after the child has been created.
        if(!SetConsoleCtrlHandler(IntPtr.Zero,false))throw new Exception("CONSOLE_HANDLER");
        string endpoint=Path.Combine(directory,"app-server-control.sock");if(Encoding.UTF8.GetByteCount(endpoint)>=108)throw new Exception("SOCKET_LENGTH");
        var s=new ProcessStartInfo(cli,"app-server --listen "+Quote("unix://"+endpoint.Replace('\\','/'))){UseShellExecute=false,CreateNoWindow=false,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,WorkingDirectory=profile};s.EnvironmentVariables["CODEX_HOME"]=profile;
        foreach(string key in new[]{"CODEX_CLI_PATH","CODEX_SQLITE_HOME","CODEX_APP_SERVER_WS_URL","CODEX_APP_SERVER_FORCE_CLI","CODEX_APP_SERVER_USE_LOCAL_DAEMON","ELECTRON_RUN_AS_NODE"})s.EnvironmentVariables.Remove(key);
        server=Process.Start(s);if(!SetConsoleCtrlHandler(IntPtr.Zero,true))throw new Exception("CONSOLE_HANDLER");server.OutputDataReceived+=(sender,e)=>{};server.ErrorDataReceived+=(sender,e)=>{};server.BeginOutputReadLine();server.BeginErrorReadLine();Emit(new{kind="server",pid=server.Id});server.EnableRaisingEvents=true;server.Exited+=(sender,e)=>{try{Emit(new{kind="serverExit",code=server.ExitCode});}catch{}};
    }
    static bool StopServer(){
        if(server==null||server.HasExited)return true;
        var children=new List<IntPtr>();
        try {
            var pids=new uint[32];uint count=GetConsoleProcessList(pids,32);if(count==0||count>32)return false;
            long serverStarted,exited,kernel,cpu;if(!GetProcessTimes(server.Handle,out serverStarted,out exited,out kernel,out cpu))return false;
            for(int i=0;i<count;i++) {
                if(pids[i]==(uint)Process.GetCurrentProcess().Id||pids[i]==(uint)server.Id)continue;
                // Only the already pinned vendor asset, directly created by our
                // live server, may share its graceful shutdown. Never walk ancestors.
                if(codeModeHostPath==null)return false;
                IntPtr child=OpenProcess(0x101400,false,pids[i]);if(child==IntPtr.Zero)return false;children.Add(child);
                SameUser(child);long started;
                if(!String.Equals(Image(child),codeModeHostPath,StringComparison.OrdinalIgnoreCase)||
                    Basic(child).Parent.ToInt64()!=server.Id||
                    !GetProcessTimes(child,out started,out exited,out kernel,out cpu)||
                    started<serverStarted||started>DateTime.UtcNow.ToFileTimeUtc())return false;
            }
            var current=new uint[32];uint size=GetConsoleProcessList(current,32);if(size!=count)return false;
            for(int i=0;i<size;i++)if(Array.IndexOf(pids,current[i],0,(int)count)<0)return false;
            if(!GenerateConsoleCtrlEvent(0,0))return false;
            var wait=Stopwatch.StartNew();if(!server.WaitForExit(15000))return false;
            foreach(IntPtr child in children)if(WaitForSingleObject(child,(uint)Math.Max(0,15000-wait.ElapsedMilliseconds))!=0)return false;
            return true;
        } catch {return false;}
        finally {foreach(IntPtr child in children)CloseHandle(child);}
    }
    static void WithdrawOwnedRoute(){if(!ownsRoute||preserveRoute||advertisedRoute==null)return;try{using(var key=Registry.CurrentUser.OpenSubKey("Environment",true)){if(key!=null&&String.Equals(key.GetValue("CODEX_APP_SERVER_WS_URL",null,RegistryValueOptions.DoNotExpandEnvironmentNames) as string,advertisedRoute,StringComparison.Ordinal))key.DeleteValue("CODEX_APP_SERVER_WS_URL",false);}IntPtr result;SendMessageTimeoutW(new IntPtr(0xffff),0x1a,IntPtr.Zero,"Environment",2,1000,out result);}catch{}}
    static async Task Commands(Stream input){using(var reader=new StreamReader(input,new UTF8Encoding(false),false,65536,true)){string line;while((line=await reader.ReadLineAsync())!=null){if(line.Length>196608)throw new Exception("FRAME_BOUND");var value=json.Deserialize<Dictionary<string,object>>(line);string kind=(string)value["kind"];if(kind=="shutdown"){object keep;preserveRoute=value.TryGetValue("preserve",out keep)&&keep is bool&&(bool)keep;return;}if(kind=="stopServer"){bool allowed;lock(lifecycle){allowed=channels.Count==0;if(allowed)accepting=false;}bool ok=allowed&&StopServer();if(!ok)lock(lifecycle)accepting=true;Emit(new{kind="serverStopped",ok});continue;}string id=(string)value["id"];if(kind=="respond"){TaskCompletionSource<object> promise;if(responses.TryGetValue(id,out promise))promise.TrySetResult(value["value"]);continue;}NamedPipeServerStream pipe;if(!channels.TryGetValue(id,out pipe))continue;if(kind=="close"){pipe.Dispose();continue;}if(kind!="write")throw new Exception("FRAME_KIND");string raw=(string)value["data"];if(raw.Length>87384)throw new Exception("FRAME_BOUND");byte[] bytes=Convert.FromBase64String(raw);try{var write=pipe.WriteAsync(bytes,0,bytes.Length);if(await Task.WhenAny(write,Task.Delay(5000))!=write){pipe.Dispose();continue;}await write;}catch{pipe.Dispose();}}}}
    static bool Absent(string name){if(!WaitNamedPipeW(Name(name)+"-control",0)){int error=Marshal.GetLastWin32Error();return error==2||error==3;}return false;}
    static int Control(string name,string action){
        if(action!="status"&&action!="stop"&&action!="disable")throw new Exception("ACTION");
        if(Absent(name)){Console.WriteLine("{\"state\":\"absent\"}");return 0;}
        using(var pipe=new NamedPipeClientStream(".",name+"-control",PipeDirection.InOut,PipeOptions.Asynchronous)){
            try{pipe.Connect(1000);}catch(TimeoutException){if(Absent(name)){Console.WriteLine("{\"state\":\"absent\"}");return 0;}throw;}
            Acl(pipe);uint pid;if(!GetNamedPipeServerProcessId(pipe.SafePipeHandle,out pid))throw new Exception("SERVER");
            IntPtr peer=OpenProcess(0x101000,false,pid);
            try{
                if(peer==IntPtr.Zero)throw new Exception("SERVER");SameUser(peer);
                if(!String.Equals(Image(peer),Full(Process.GetCurrentProcess().MainModule.FileName),StringComparison.OrdinalIgnoreCase))throw new Exception("SERVER_IMAGE");
                byte[] bytes=Encoding.UTF8.GetBytes(action+"\n");pipe.Write(bytes,0,bytes.Length);pipe.Flush();
                var reader=new StreamReader(pipe,Encoding.UTF8);var read=reader.ReadLineAsync();if(!read.Wait(20000)||read.Result==null||read.Result.Length>16384)throw new Exception("RESPONSE");
                var result=json.Deserialize<Dictionary<string,object>>(read.Result);
                if(action!="status"&&(string)result["state"]=="ready"&&WaitForSingleObject(peer,5000)!=0)throw new Exception("STOP_NOT_COMPLETE");
                Console.WriteLine(read.Result);return 0;
            }finally{if(peer!=IntPtr.Zero)CloseHandle(peer);}
        }
    }
    public static int Main(string[] args){Stream input=Console.OpenStandardInput();output=Console.OpenStandardOutput();try{using(var identity=WindowsIdentity.GetCurrent()){user=identity.User;SameUser(Process.GetCurrentProcess().Handle);}
        if(args.Length==1&&args[0]=="--environment-changed"){IntPtr result;SendMessageTimeoutW(new IntPtr(0xffff),0x1a,IntPtr.Zero,"Environment",2,1000,out result);return 0;}
        if(args.Length==3&&args[0]=="--control"){Name(args[1]);return Control(args[1],args[2]);}
        if(args.Length==6&&args[0]=="--inspect"){image=Full(args[2]);package=args[3];profile=Full(args[4]);desktop=Full(args[5]);VerifyGui(uint.Parse(args[1]));Emit(new{verified=true});return 0;}
        if(args.Length==3&&args[0]=="--verify-assets"){image=Full(args[1]);package=args[2];VendorCli();Emit(new{verified=true});return 0;}
        if(args.Length!=7||args[0]!="--serve")throw new Exception("ARGUMENTS");string name=Name(args[1]);advertisedRoute="ws+unix://localhost//.\\pipe\\"+args[1]+":/rpc";image=Full(args[2]);package=args[3];profile=Full(args[4]);desktop=Full(args[5]);controllerImage=Full(args[6]);
        if(!Regex.IsMatch(package,@"^OpenAI\.Codex_\d+\.\d+\.\d+\.\d+_x64__2p2nqsd0c76g0$")||!String.Equals(image,Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"WindowsApps",package,"app","ChatGPT.exe"),StringComparison.OrdinalIgnoreCase))throw new Exception("PACKAGE_PATH");
        IntPtr parent=OpenProcess(0x1000,false,(uint)Basic(Process.GetCurrentProcess().Handle).Parent.ToInt64());try{if(parent==IntPtr.Zero)throw new Exception("CONTROLLER");Identity(parent,false);}finally{if(parent!=IntPtr.Zero)CloseHandle(parent);}
        var gui=Pipe(name,true);var ctl=Pipe(name+"-control",true);ownsRoute=true;StartServer();Emit(new{kind="ready"});Task.WhenAny(Commands(input),ServeGui(gui,name),ServeControl(ctl,name+"-control")).GetAwaiter().GetResult().GetAwaiter().GetResult();return StopServer()?0:2;
    }catch(Exception error){try{Emit(new{kind="failure",code="NCF_CHATGPT_PRIVATE_SERVICE",stage,detail=Regex.IsMatch(error.Message,@"^[A-Z_0-9]+$")?error.Message:error.GetType().Name});}catch{}return 1;}
    finally{stopping=true;WithdrawOwnedRoute();lock(listeners)foreach(var pipe in listeners)try{pipe.Dispose();}catch{}if(server!=null&&!server.HasExited)StopServer();foreach(var pin in pins)pin.Dispose();}}
}

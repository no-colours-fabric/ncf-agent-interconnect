#import <AppKit/AppKit.h>
#import <libproc.h>
#import <limits.h>
#import <signal.h>
#import <unistd.h>
#import <sys/stat.h>
#import <sys/sysctl.h>

static BOOL ownerDirectory(NSString *path) {
    if (![path isAbsolutePath]) return NO;
    const char *filename = path.fileSystemRepresentation;
    struct stat info;
    return lstat(filename, &info) == 0 && S_ISDIR(info.st_mode) &&
        info.st_uid == getuid() && (info.st_mode & 0022) == 0 &&
        [path isEqualToString:path.stringByResolvingSymlinksInPath];
}

static BOOL verifiedDesktop(pid_t pid, const char *expected, struct proc_bsdinfo *info) {
    char executable[PROC_PIDPATHINFO_MAXSIZE];
    return pid > 1 && proc_pidpath(pid, executable, sizeof executable) > 0 &&
        strcmp(executable, expected) == 0 &&
        proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, info, sizeof *info) == sizeof *info &&
        info->pbi_pid == pid && info->pbi_uid == getuid() && info->pbi_ruid == getuid() &&
        kill(pid, 0) == 0;
}

static BOOL sameProcessIdentity(const struct proc_bsdinfo *before, const struct proc_bsdinfo *after) {
    return before->pbi_pid == after->pbi_pid && before->pbi_ppid == after->pbi_ppid &&
        before->pbi_uid == after->pbi_uid && before->pbi_ruid == after->pbi_ruid &&
        before->pbi_start_tvsec == after->pbi_start_tvsec &&
        before->pbi_start_tvusec == after->pbi_start_tvusec;
}

static NSString *canonicalAperitif(NSString *desktop) {
    char canonical[PATH_MAX];
    if (![desktop isAbsolutePath] || !realpath(desktop.fileSystemRepresentation, canonical) ||
        strcmp(canonical, desktop.fileSystemRepresentation) != 0) return nil;
    NSString *macOS = desktop.stringByDeletingLastPathComponent;
    NSString *contents = macOS.stringByDeletingLastPathComponent;
    if (![macOS.lastPathComponent isEqualToString:@"MacOS"] ||
        ![contents.lastPathComponent isEqualToString:@"Contents"]) return nil;
    NSString *framework = [contents stringByAppendingPathComponent:@"Frameworks/Codex Framework.framework"];
    NSString *suffix = @"/Helpers/Codex (Aperitif).app/Contents/MacOS/Codex (Aperitif)";
    NSString *candidate = [framework stringByAppendingFormat:@"/Versions/Current%@", suffix];
    if (!realpath(candidate.fileSystemRepresentation, canonical)) return nil;
    NSString *resolved = [[NSFileManager defaultManager] stringWithFileSystemRepresentation:canonical length:strlen(canonical)];
    NSString *prefix = [framework stringByAppendingString:@"/Versions/"];
    if (![resolved hasPrefix:prefix] || ![resolved hasSuffix:suffix] ||
        resolved.length <= prefix.length + suffix.length) return nil;
    NSString *version = [resolved substringWithRange:NSMakeRange(prefix.length,
        resolved.length - prefix.length - suffix.length)];
    if (!version.length || [version containsString:@"/"] ||
        [version isEqualToString:@"."] || [version isEqualToString:@".."]) return nil;
    struct stat info;
    if (lstat(canonical, &info) != 0 || !S_ISREG(info.st_mode) || !(info.st_mode & 0111) ||
        (info.st_mode & 0022) != 0 || (info.st_uid != 0 && info.st_uid != getuid())) return nil;
    return resolved;
}

static BOOL matchDesktopParent(pid_t pid, NSString *desktop) {
    struct proc_bsdinfo before, after;
    if (verifiedDesktop(pid, desktop.fileSystemRepresentation, &before))
        return verifiedDesktop(pid, desktop.fileSystemRepresentation, &after) &&
            sameProcessIdentity(&before, &after);
    NSString *helper = canonicalAperitif(desktop);
    if (!helper || !verifiedDesktop(pid, helper.fileSystemRepresentation, &before)) return NO;
    pid_t main = before.pbi_ppid;
    struct proc_bsdinfo mainBefore, mainAfter;
    // Exactly one vendor helper hop is allowed, never an ancestor search.
    return main > 1 && verifiedDesktop(main, desktop.fileSystemRepresentation, &mainBefore) &&
        verifiedDesktop(pid, helper.fileSystemRepresentation, &after) &&
        sameProcessIdentity(&before, &after) && after.pbi_ppid == main &&
        verifiedDesktop(main, desktop.fileSystemRepresentation, &mainAfter) &&
        sameProcessIdentity(&mainBefore, &mainAfter);
}

// Copy only selected launch values. The kernel argument buffer never leaves this process.
static BOOL rememberValue(NSString *__strong *value, const char *bytes) {
    NSString *next = [NSString stringWithUTF8String:bytes];
    if (!next.length || (*value && ![*value isEqualToString:next])) return NO;
    *value = next;
    return YES;
}

static NSDictionary *desktopLaunchPair(pid_t pid, NSString *executable, NSString *stockProfile,
                                      NSString *stockData) {
    struct proc_bsdinfo before, after;
    if (!verifiedDesktop(pid, executable.fileSystemRepresentation, &before)) return nil;
    int mib[] = {CTL_KERN, KERN_PROCARGS2, pid};
    const size_t capacity = 1024 * 1024;
    NSMutableData *buffer = [NSMutableData dataWithLength:capacity];
    char *bytes = buffer.mutableBytes;
    size_t size = capacity;
    if (!bytes || sysctl(mib, 3, bytes, &size, NULL, 0) != 0 || size <= sizeof(int) ||
        size > capacity) return nil;
    const char *end = bytes + size;
    int argc;
    memcpy(&argc, bytes, sizeof argc);
    const char *cursor = memchr(bytes + sizeof argc, 0, size - sizeof argc);
    if (!cursor || argc < 1 || argc > 4096) return nil;
    while (cursor < end && !*cursor) ++cursor;
    NSString *flagData = nil, *envData = nil, *envHome = nil;
    const char flag[] = "--user-data-dir=";
    BOOL nextIsData = NO;
    for (int i = 0; i < argc; ++i) {
        const char *zero = memchr(cursor, 0, end - cursor);
        if (!zero) return nil;
        if (nextIsData) {
            if (!rememberValue(&flagData, cursor)) return nil;
            nextIsData = NO;
        } else if (!strcmp(cursor, "--user-data-dir")) {
            nextIsData = YES;
        } else if (!strncmp(cursor, flag, sizeof flag - 1)) {
            if (!rememberValue(&flagData, cursor + sizeof flag - 1)) return nil;
        }
        cursor = zero + 1;
    }
    if (nextIsData || cursor == end || !*cursor) return nil;
    const char homeKey[] = "CODEX_HOME=";
    const char dataKey[] = "CODEX_ELECTRON_USER_DATA_PATH=";
    const char variantKey[] = "CODEX_ELECTRON_AGENT_RUN_ID=";
    while (cursor < end && *cursor) {
        const char *zero = memchr(cursor, 0, end - cursor);
        if (!zero) return nil;
        if (!strncmp(cursor, homeKey, sizeof homeKey - 1)) {
            if (!rememberValue(&envHome, cursor + sizeof homeKey - 1)) return nil;
        } else if (!strncmp(cursor, dataKey, sizeof dataKey - 1)) {
            if (!rememberValue(&envData, cursor + sizeof dataKey - 1)) return nil;
        } else if (!strncmp(cursor, variantKey, sizeof variantKey - 1)) {
            return nil;
        }
        cursor = zero + 1;
    }
    // Stock Codex sets Electron userData from its own override or the stock location.
    // A command-line flag alone cannot prove that the application used another location.
    NSString *profile = envHome ?: stockProfile;
    NSString *data = envData ?: stockData;
    if ((!envData && ![profile isEqualToString:stockProfile]) ||
        (flagData && ![flagData isEqualToString:data]) ||
        !ownerDirectory(profile) || !ownerDirectory(data) ||
        !verifiedDesktop(pid, executable.fileSystemRepresentation, &after) ||
        before.pbi_start_tvsec != after.pbi_start_tvsec ||
        before.pbi_start_tvusec != after.pbi_start_tvusec) return nil;
    NSString *process = [NSString stringWithFormat:@"%d:%llu:%llu",
        pid, (unsigned long long)before.pbi_start_tvsec,
        (unsigned long long)before.pbi_start_tvusec];
    return @{@"state": @"running", @"profile": profile, @"desktopData": data, @"process": process};
}

static int inspectDesktop(const char *target, const char *home, const char *data) {
    @autoreleasepool {
        NSString *expected = [NSString stringWithUTF8String:target];
        NSString *stockProfile = [NSString stringWithUTF8String:home];
        NSString *stockData = [NSString stringWithUTF8String:data];
        NSArray *applications = [NSRunningApplication runningApplicationsWithBundleIdentifier:@"com.openai.codex"];
        NSDictionary *result = applications.count ? @{@"state": @"unavailable"} : @{@"state": @"notRunning"};
        if (applications.count == 1) {
            NSRunningApplication *application = applications.firstObject;
            if (!application.terminated && [application.executableURL.path isEqualToString:expected]) {
                NSDictionary *pair = desktopLaunchPair(application.processIdentifier, expected, stockProfile, stockData);
                if (pair) result = pair;
            }
        }
        NSData *json = [NSJSONSerialization dataWithJSONObject:result options:0 error:NULL];
        return json && fwrite(json.bytes, 1, json.length, stdout) == json.length ? 0 : 1;
    }
}

static BOOL desktopProfileIsOpen(NSString *path) {
    NSString *lock = [path stringByAppendingPathComponent:@"SingletonLock"];
    NSString *target = [[NSFileManager defaultManager] destinationOfSymbolicLinkAtPath:lock error:NULL];
    NSString *suffix = [[target componentsSeparatedByString:@"-"] lastObject];
    pid_t pid = suffix.intValue;
    return pid > 0 && (kill(pid, 0) == 0 || errno == EPERM);
}

static void fail(NSDictionary *configuration, NSString *messageKey) {
    if (@available(macOS 14, *)) [NSApp activate];
    else [NSApp activateIgnoringOtherApps:YES];
    NSAlert *alert = [[NSAlert alloc] init];
    alert.messageText = [NSBundle.mainBundle objectForInfoDictionaryKey:@"CFBundleDisplayName"] ?: @"Codex with NCF";
    alert.informativeText = configuration[messageKey] ?: @"";
    alert.alertStyle = NSAlertStyleWarning;
    [alert runModal];
    exit(1);
}

static NSString *createOwnerMarker(void) {
    NSString *template = [NSTemporaryDirectory() stringByAppendingPathComponent:@"ncf-codex-owner-XXXXXX"];
    char *filename = strdup(template.fileSystemRepresentation);
    if (!filename) return nil;
    int descriptor = mkstemp(filename);
    NSString *path = descriptor < 0 ? nil : [[NSFileManager defaultManager]
        stringWithFileSystemRepresentation:filename length:strlen(filename)];
    if (descriptor >= 0) close(descriptor);
    free(filename);
    return path;
}

int main(int argc, const char *argv[]) {
    if (argc == 5 && strcmp(argv[1], "--inspect-desktop") == 0)
        return inspectDesktop(argv[2], argv[3], argv[4]);
    if (argc == 4 && strcmp(argv[1], "--match-desktop-process") == 0) {
        char *end = NULL;
        long pid = strtol(argv[2], &end, 10);
        if (!end || *end || pid < 2 || pid > INT_MAX) return 1;
        @autoreleasepool {
            NSString *desktop = [NSString stringWithUTF8String:argv[3]];
            return desktop && matchDesktopParent((pid_t)pid, desktop) ? 0 : 1;
        }
    }
    @autoreleasepool {
        [NSApplication sharedApplication];
        [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
        NSURL *resources = NSBundle.mainBundle.resourceURL;
        NSData *contents = [NSData dataWithContentsOfURL:
            [resources URLByAppendingPathComponent:@"launch.json"]];
        NSDictionary *config = contents ? [NSJSONSerialization JSONObjectWithData:contents options:0 error:NULL] : nil;
        if (![config isKindOfClass:NSDictionary.class]) return 1;
        NSString *profile = config[@"profile"];
        NSString *desktopData = config[@"desktopData"];
        NSString *runtime = config[@"runtime"];
        NSString *cli = config[@"cli"];
        NSString *desktop = config[@"desktop"];
        NSString *wrapper = [resources URLByAppendingPathComponent:@"ncf-codex-cli"].path;
        NSFileManager *files = NSFileManager.defaultManager;

        if (!ownerDirectory(profile) || !ownerDirectory(desktopData) ||
            ![files isExecutableFileAtPath:runtime] || ![files isExecutableFileAtPath:cli] ||
            ![files isExecutableFileAtPath:wrapper] ||
            ![[NSBundle bundleWithPath:desktop].bundleIdentifier isEqualToString:@"com.openai.codex"])
            fail(config, @"launchFailed");
        NSString *socket = [profile stringByAppendingPathComponent:@"app-server-control/app-server-control.sock"];
        struct stat endpoint;
        if (desktopProfileIsOpen(desktopData) || lstat(socket.fileSystemRepresentation, &endpoint) == 0)
            fail(config, @"alreadyOpen");

        NSString *marker = createOwnerMarker();
        if (!marker) fail(config, @"launchFailed");
        NSWorkspaceOpenConfiguration *launch = [NSWorkspaceOpenConfiguration configuration];
        launch.createsNewApplicationInstance = YES;
        launch.arguments = @[[@"--user-data-dir=" stringByAppendingString:desktopData]];
        launch.environment = @{
            @"CODEX_HOME": profile,
            @"CODEX_ELECTRON_USER_DATA_PATH": desktopData,
            @"CODEX_CLI_PATH": wrapper,
            @"NCF_CODEX_SHORTCUT_OWNER_MARKER": marker,
        };
        [NSWorkspace.sharedWorkspace openApplicationAtURL:[NSURL fileURLWithPath:desktop]
            configuration:launch completionHandler:^(NSRunningApplication *application, NSError *error) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    if (error || !application) {
                        [files removeItemAtPath:marker error:NULL];
                        fail(config, @"launchFailed");
                    }
                    exit(0);
                });
            }];
        [NSApp run];
    }
    return 1;
}

#import <AppKit/AppKit.h>
#import <libproc.h>
#import <limits.h>
#import <signal.h>
#import <unistd.h>
#import <sys/stat.h>

static BOOL ownerDirectory(NSString *path) {
    if (![path isAbsolutePath]) return NO;
    const char *filename = path.fileSystemRepresentation;
    struct stat info;
    return lstat(filename, &info) == 0 && S_ISDIR(info.st_mode) &&
        info.st_uid == getuid() && (info.st_mode & 0022) == 0 &&
        [path isEqualToString:path.stringByResolvingSymlinksInPath];
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
    alert.messageText = @"Codex with NCF";
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
    if (argc == 4 && strcmp(argv[1], "--match-desktop-process") == 0) {
        char *end = NULL;
        long pid = strtol(argv[2], &end, 10);
        char executable[PROC_PIDPATHINFO_MAXSIZE];
        if (!end || *end || pid < 2 || pid > INT_MAX ||
            proc_pidpath((int)pid, executable, sizeof executable) <= 0)
            return 1;
        return strcmp(executable, argv[3]) == 0 ? 0 : 1;
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

# Build and verify on Windows

Windows x64 packages are built natively. For a routine release, run the packaged
runtime check and one isolated packaged smoke. The extended manual cases below
are for affected installer/runtime changes or a concrete failure, not every
release. Packages are unsigned. Follow the [short release cycle](binary-release.md).

Build from the same source revision and version as the matching macOS release.
Use a Windows machine with Node.js 22.12
or later, npm and the native architecture you intend to package.

GitHub source archives include `SOURCE_REVISION`; the packaged verification
report records this revision without requiring a Git checkout.

In PowerShell, from the extracted source directory:

```powershell
npm ci
npm run build:release -- --win
```

The release command checks types, runs core tests, builds the app, creates the
installer, generates local checksums and verifies the packaged runtime. If the
same source already passed its shared checks, add `--skip-source-checks` to avoid
repeating the type/core test pass. Keep
its terminal output locally for diagnosis. `release/verification.json` records
the version, platform, architecture and installed-runtime checks.

## Extended native checks (when affected)

1. Install the generated EXE under a regular user account. Check the application
   name, English UI, tray menu and selected installation directory.
2. Start the installed app from a directory unrelated to the source checkout.
   Confirm it does not require Node.js, npm or source files.
3. Configure a test MCP client through its setup dialog and explicit Apply. Use
   a disposable profile rather than replacing a working client configuration.
4. Connect two differently named agents and exchange local messages with no
   remote peers. Check receipt counters and persistent history.
5. Exchange a file with spaces and non-ASCII characters in its name. Open and
   save the verified copy. Check that the original is unchanged.
6. Move an occupied agent name after explicit approval. Check that the old chat
   is revoked and notified and the new chat retains history.
7. Close the window and verify the node still exchanges messages. Quit and
   restart the app, then check restoration.
8. If a remote node is available, explicitly pair it and exchange a message and
   attachment. Record which client adapters were actually exercised.
9. Uninstall through the normal system flow. Record app-data retention and the
   behavior of optional Start at login.

For an automated packaged GUI check:

```powershell
$env:INTERCONNECT_TEST_EXECUTABLE = (Resolve-Path '.\release\win-unpacked\NCF Agent Interconnect.exe').Path
npm run test:ui
```

On ARM64, use the actual `win-arm64-unpacked` path. The GUI check uses temporary
data and synthetic messages; it does not contact live agents.

## Return a build

Upload only the current EXE installer. Keep any generated ZIP, checksums,
verification report and logs locally. Send the coordinator a short status with
the source revision and any failure or material limitation; do not create an
extra public acceptance packet. Never include app data, pairing codes, tokens,
private keys or real message history. After the combined release is published,
remove older uploaded assets while preserving tags and release descriptions.

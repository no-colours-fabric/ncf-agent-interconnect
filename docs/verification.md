# Verification

Release verification distinguishes product-core checks from client and operating
system checks. A capability is not treated as verified merely because a tool
returned success.

## Automated coverage

The product suite covers isolated local and remote exchange, multiple peers,
case-insensitive agent identity, approved transfers and revocation, full history,
readiness cursors, file hashes, idempotent retries, concurrent receipt, restart
recovery and adapter busy/idle behavior.

The OpenCode fixture uses the bundled plugin and a simulated SDK session host.
The Codex fixture implements the expected local desktop IPC frames. Both inspect
the exact body, attachment links and From/Reply-To envelope sent to the target.
These fixtures do not invoke a live model.

The installed-runtime verifier extracts the packaged app outside the source
checkout, loads the shipped integration and checks real MCP exchange using the
bundled Electron/Node runtime. A separate Electron GUI test checks rendering,
native file-operation boundaries, receipt counters and close-to-tray behavior.

## Platform and client limits

- macOS Apple Silicon is the initial packaged target. Build reports and package
  checksums accompany its release.
- Windows x64 installer and ZIP builds, shipped-runtime verification and isolated
  packaged GUI checks are covered. Interactive installation/uninstallation and
  Start at login still require manual smoke checks. Windows packages are unsigned.
- OpenCode support targets the v1 plugin/SDK contract. OpenCode v2 is not claimed.
- Codex Desktop delivery is experimental and version-dependent. Protocol fixture
  coverage does not establish support for every installed desktop version.
- Standard MCP clients can send and receive through tools. Idle wake-up needs a
  client adapter; Cursor has no reactive adapter in this release.

Release notes should list checks actually completed for their exact source
revision, runtime and platform. Keep private client configuration and live
conversations outside test artifacts and public reports.

# Windows field integration of one-click ChatGPT setup

NCF Agent Interconnect is the product and project. NCF abbreviates No Colours Fabric.

## Source custody and scope

The owner uses one existing Windows profile and requested field testing instead
of work on hypothetical profile switches. The current installed alpha-2 and its
working chats are left unchanged. The integration worktree starts from
9937373fc8385c0083de13800275f67eb21d4ee6, which fixes automatic recovery of the
original legacy chat bindings on top of e4b07bed562c536a595152b6fbdc0cdd891103be.

Superman's source patch from cfeb3c6284ad401d69c1a1352702a135a30f556e relative to
ed851c9 has SHA256 23e827f1541a34af27b51ebdea47a81618bf37b7563c76bd85d2097b55dfe5e8.
It applied cleanly except that the intentionally excluded mac-session-delivery.ts
and its Mac test are not present in the Windows base. Those native Mac files remain
with their Mac writer. The other sixteen paths were imported, including the common
profile discovery declarations required by IPC. The existing Windows native factory
in main/index.ts remains wired to createWindowsDesktopSessionDeliveryHandler.
No Mac runtime claim follows from Windows compilation.

Bob reserved Windows alpha-5 and authorized one native compile/NSIS plus packaged
verification after the combined source is clean and scoped checks pass. The local
Windows timestamp belongs to the start of that build. Alpha-2 installers are retained.
Installation remains the owner's action; no live profile, Pair, registry or ChatGPT
process is changed during integration.

## Before-Apply availability gap

Static integration review found that the selected-profile callback requires matching
configuredCodexFile contents. Before first Apply, the native Windows handler therefore
returned unsupported for a missing selection. The shared control hid unsupported before
it could show its draft switch. The original browser fixture returned ready in that
case, so it did not model the real backend response.

Superman explicitly assigned this Windows correction and the needed common contract
handling to Luna. The backend now returns configuration-required for status with no
configured selection. Enable/Disable in the same condition return unavailable, with
zero writes or service starts. A nonpackaged runtime, alternate NCF userData or nonstock
selected profile remains unsupported. No native setup prerequisite is relaxed.

The common union distinguishes configuration-required from unsupported. The existing
localized staged offer can therefore be shown before Apply on the supported Windows
backend, while platforms without an implementation keep the control hidden. A stale
configured form uses the existing localized unavailable summary rather than exposing
the internal state name. The post-Apply delivery helper refuses to enable when a status
still requires configuration. No new translation fallback or user-facing technical
error string is introduced.

## Scoped observations

The Windows integration test runs the real ApplicationSetupFlow, IPC handler,
configuration writer and Windows backend together with only service/native transport
substituted. It uses an isolated single default-profile layout and no picker. It proves:

- Before Apply, status reports configuration-required and no config file, saved service
  setting or service start is produced.
- Connect applies that exact profile and then requests delivery. If ChatGPT is running,
  close-required is returned before native writes. After the simulated close, a separate
  Connect retries only delivery, without repeating Apply; config bytes and mtime match.
- A foreign selector blocks native enable without saving or starting a service. Removing
  that synthetic conflict permits an explicit retry without a second config write.
- Successful status no longer requests Connect, and explicit Disable remains accessible.

The native backend fixture also verifies null selected with zero mutations and rejects
an unsupported selected profile. Fifteen affected native/contract tests and TypeScript
passed after the availability correction. The earlier combined setup/legacy run passed
56 tests; the selected Codex/ChatGPT IPC suite passed nine. No OpenCode investigation or
new OpenCode test was run. The existing queue/adapter recovery source checks remain
73 passed and one platform skip from the unchanged 9937373 correction.

The headless Chrome fixture passed Applications, Overview, Startup and Manual setup,
including the actual Windows configuration-required reply, absence of early enable,
the Apply-to-enable order, close-required retry, status-only recovery, and hidden
unsupported. It uses isolated routed fixture content, not a working client window.
Superman's final two-file patch restores the original ApplicationRows header and
shared ManualSetupButton, without redesigning other cards. Its SHA256 is
a9875163915cf81779357d3fa0aa83bdb7a408b46b78affe05c9353ff632b7fb.
The combined Chrome scenario passed after that patch. A restricted Node test-runner
launch initially failed with spawn EPERM before running its rendering tests; the
failed check then passed all 24 rendering tests in the normal native execution
environment, without UAC or changes to the test assertions.

Working-profile restart, automatic wake of the old chats, active-turn delivery, browser
availability and actual installation remain owner acceptance of the next installer.

# Verification

LLM-optimized documentation: [llms.txt](../llms.txt).

Release verification distinguishes product-core checks from client and operating
system checks. A capability is not treated as verified merely because a tool
returned success.

## Automated coverage

The product suite covers isolated local and remote exchange, multiple peers,
case-insensitive agent identity, approved transfers and revocation, full history,
readiness cursors, file hashes, idempotent retries, concurrent receipt, restart
recovery and adapter busy/idle behavior.

Pairing tests cover mutual authentication, transcript and proof mutations,
attempt and expiry bounds, concurrent claims, write failures, interrupted commits
and confirmation retries. Presence tests cover push directories, stale sockets
and snapshots, transport evidence, shared sessions and legacy peer compatibility.
These checks do not constitute an independent cryptographic audit.

The OpenCode fixture uses the bundled plugin and a simulated SDK session host.
The existing Codex fixture implements the compatible older local desktop IPC
frames and inspects the complete Incoming body, attachment links and reply route.
It does not prove the separate new macOS Codex notification-and-read path. These
fixtures do not invoke a live model.

The installed-runtime verifier extracts the packaged app outside the source
checkout, loads the shipped integration and checks real MCP exchange using the
bundled Electron/Node runtime. A separate Electron GUI test checks rendering,
native file-operation boundaries, receipt counters and close-to-tray behavior.

## Platform and client limits

- NCF Agent Interconnect 1.0.0 provides Apple Silicon and Intel macOS DMGs and
  a Windows x64 installer. The Apple Silicon package was installed and exercised
  on a Mac. The Intel package was checked for layout and architecture. The
  Windows verifier and the installed-app smoke passed on a hosted x64 Windows
  runner. There is no new Linux installer.
- OpenCode v1 retains its bundled exact-chat plugin. OpenCode v2 has separate
  setup and source-level checks; live v2 client delivery was not verified for
  0.19.0. Do not infer either version's readiness from installation detection.
- Codex Desktop delivery is experimental and version-dependent. Compatible
  older IPC provides full Incoming in the exact chat. The new macOS path offers
  an exact-chat notification without content; `agent_read` returns text and
  attachment links and records receipt. An isolated bundled Codex
  `0.171.0-alpha.13` check covered retained 0.19 binding/history, one-time
  exact-chat confirmation, wrong-chat and replay rejection, a first bind under
  a free name after explicit Apply, and wake/read/receipt. An installed 1.0.0
  Apple Silicon build also passed a two-way exchange through two previously
  bound macOS Codex Desktop chats, including native notices and read receipts.
  That exchange covers the tested desktop build; it does not establish wider
  macOS compatibility or Windows Codex delivery.
- Cursor has a bundled plugin for open exact chats, including unselected chats.
  AionUi support is limited to Cursor Agent after owner authorization and a
  live bridge. Client and platform results have the narrower scopes recorded
  in [application-specific setup](mcp-clients.md).
- Claude Code's full Incoming uses compatible mods. Its Linux Desktop and
  terminal evidence is frontend-specific; live Claude behavior on macOS and
  Windows was not verified for 0.19.0. See the [Claude Code guide](claude-code-adapter.md).
- Standard MCP clients can send and read through tools. Idle notification or
  automatic full-content delivery requires a supported client integration.

Release notes should list checks actually completed for their exact source
revision, runtime and platform. Keep private client configuration and live
conversations outside test artifacts and public reports.

Remote-directory acceptance also requires the two-computer native scenarios in
[agent presence](agent-presence.md). A source-mode harness result is marked
`packaged: false` and does not satisfy that requirement.

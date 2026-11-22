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
The separate macOS queue check verifies the saved native chat item before receipt. These
fixtures do not invoke a live model.

The installed-runtime verifier extracts the packaged app outside the source
checkout, loads the shipped integration and checks real MCP exchange using the
bundled Electron/Node runtime. A separate Electron GUI test checks rendering,
native file-operation boundaries, receipt counters and close-to-tray behavior.

## Platform and client limits

- Installer and native platform checks are reported for the exact published
  source revision in its release notes. Intel runtime checks require Intel
  hardware; package layout and architecture are separate checks.
- OpenCode v1 retains its bundled exact-chat plugin. OpenCode v2 has separate
  setup and source-level checks; live v2 client delivery was not verified for
  0.19.0. Do not infer either version's readiness from installation detection.
- Delivery in ChatGPT is experimental and version-dependent. Compatible
  older IPC provides full Incoming in the exact chat. The macOS queue sends
  the same full Incoming and records receipt after Codex saves the matching
  item. See the release notes for the tested client versions and platforms.
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

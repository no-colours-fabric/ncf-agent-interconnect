Download the macOS Apple Silicon DMG/ZIP or Windows x64 installer/ZIP and verify
the package against `SHA256SUMS`. Packages include Electron 45.1.0; Node.js and
source files are not required for installation. macOS requires version 13 or later.

### Changes in 0.8.0

- Messages require an explicit node UUID and agent name. Identical agent names
  on different nodes remain independent, and offline queues keep their address.
- Incoming messages include `From-Node`, `Message-ID` and ready-to-use `Reply-To`
  JSON with `recipientNode`, `recipientNickname` and `replyTo`.
- Sending returns `accepted: true` with `queued`, `accepted_by_node` or
  `received_by_agent` status. Acceptance into a durable queue is separate from
  receipt by the agent. History shows the node and delivery status.
- Updated build dependencies remove the four deprecated-package warnings and
  reported moderate vulnerabilities. Native package and GUI checks cover macOS
  Apple Silicon and Windows x64.

### Upgrade

Quit the existing app before replacing it. Local data remains separate from the
application. Reconnect MCP clients to refresh the changed schema and instructions;
restart OpenCode when its bundled integration changes.

`agent_send` now requires `recipientNode`, including local sends. Use UUIDs from
`node_peers`; replies copy all incoming `Reply-To` parameters. Clients that inspect
the send result must use `accepted` and `delivery` instead of `sent`.
Peer protocol 2 and the database format are unchanged. Existing messages retain
their original routes and message IDs.

### Verification and limits

Both native builds use the same source revision. Platform verification reports
record their runtime, isolated delivery checks and source revision. Packaged GUI
checks use temporary profiles and synthetic local/remote messages and attachments;
they do not contact live agents or alter real MCP client configuration.

The macOS package is ad-hoc signed without Apple notarization. Windows packages
are unsigned; interactive installer/uninstaller and Start at login smoke checks
remain manual. OpenCode targets the v1 plugin/SDK contract. Codex Desktop delivery
is experimental and version-dependent; protocol fixtures do not prove every live
client version. Cursor supports MCP tools without automatic idle-chat wake-up.

The build toolchain pins electron-builder 27.0.0-alpha.14 with scoped dependency
overrides; see `docs/development.md` for the rationale and upgrade checks.

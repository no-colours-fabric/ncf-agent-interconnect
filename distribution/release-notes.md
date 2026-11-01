Download the macOS Apple Silicon DMG/ZIP or Windows x64 installer/ZIP and verify
the package against `SHA256SUMS`. Packages include Electron 45.1.0; Node.js and
source files are not required for installation. macOS requires version 13 or later.

### Changes

- Agents and Remote nodes show names and client availability from explicitly
  paired nodes. Updates follow client arrival, departure and reconnection.
  `agents_list` exposes the directory with full addresses and explicit
  unavailable, syncing and unsupported states.
- `agent_disconnect` releases the current chat binding while preserving history.
  A name also used on another node produces an advisory warning and remains
  available locally.
- Pair computers with an eight-character code containing case-insensitive letters
  and digits. Codes expire after ten minutes and allow five attempts. Mutual PAKE
  authentication pins certificates automatically without sending the code or
  permanent peer credential over the network.
- Pairing commits use queued settings transactions, idempotent confirmation and
  explicit conflict or uncertainty results during overlapping attempts, stop and
  write failure. Existing paired connections and stored history are preserved.

- Messages require an explicit node UUID and agent name. Identical agent names
  on different nodes remain independent, and offline queues keep their address.
- Incoming messages include `From-Node`, `Message-ID` and ready-to-use `Reply-To`
  JSON with `recipientNode`, `recipientNickname` and `replyTo`.
- Sending returns `accepted: true` with `queued`, `accepted_by_node` or
  `received_by_agent` status. Acceptance into a durable queue is separate from
  receipt by the agent. History shows the node and delivery status.
- Updated build dependencies remove the four deprecated-package warnings and
  reported moderate vulnerabilities.

### Upgrade

Quit the existing app before replacing it. Local data remains separate from the
application. Reconnect MCP clients to refresh the changed schema and instructions;
restart OpenCode when its bundled integration changes.

Both computers need short-code pairing support to create a new connection. The
old certificate-bearing access-code format is no longer accepted. Previously
paired nodes keep their credentials and continue exchanging protocol 2 messages;
older nodes show an unsupported agent directory. Reconnect MCP clients to expose
`agents_list` and `agent_disconnect`.

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
The remote-directory acceptance scenarios use the packaged applications on two
computers. Refer to the accompanying reports for the scenarios actually completed.

The macOS package is ad-hoc signed without Apple notarization. Windows packages
are unsigned; interactive installer/uninstaller and Start at login smoke checks
remain manual. OpenCode targets the v1 plugin/SDK contract. Codex Desktop delivery
is experimental and version-dependent; protocol fixtures do not prove every live
client version. Cursor supports MCP tools without automatic idle-chat wake-up.

The build toolchain pins electron-builder 27.0.0-alpha.14 with scoped dependency
overrides; see `docs/development.md` for the rationale and upgrade checks.
The application pairing protocol has not received an independent cryptographic
audit; its suite and recovery semantics are documented in `docs/pairing.md`.

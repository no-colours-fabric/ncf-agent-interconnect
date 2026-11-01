Download the macOS Apple Silicon DMG/ZIP or Windows x64 installer/ZIP and verify
the files against the accompanying SHA256SUMS. Packages include Electron 45.1.0;
Node.js, npm and a source checkout are not required. macOS requires version 13 or
later.

### Changes in 0.11.0

- Startup waits for the service and IPC before opening a window, including early
  activate, second-instance and tray requests.
- Agents has separate local and remote tabs with independent drafts and exact
  sender/recipient selection. Normal UI displays computer names; transport keeps
  full node identities. Remote-node directories use compact agent rows.
- Incoming messages carry a short persistent reply reference instead of routing
  UUID headers. `agent_send(connectionId, replyRef, text)` replies to the original
  exact sender/message. Legacy explicit addresses remain compatible.
- Taking an occupied name offers preserving history or starting fresh. Each mode
  has its own confirmation. Delete a selected agent and history, or all local
  agents and history, from Local agents. The new `agent_clear_history` MCP tool
  requires an explicit human request and preview confirmation.
- Cleanup revokes old bindings while preserving uncertain admission evidence,
  foreign delivered history, shared or modified files and user exports. Stale
  asynchronous work cannot recreate deleted history or use a recreated name.
- Applications groups each connection with its agents, delivery impact and
  guidance. Technical identifiers and raw diagnostics stay in expandable details.
  A client release differs from an unconfirmed connection; neither means task
  completion.
- Codex shows the local time of its last successful exact-owner verification.
  Historical verification is not continuous liveness. Older responses cannot
  replace newer connection health or trigger stale delivery/recovery. A recovered
  connection does not repeat an earlier uncertain input.
- All interface changes retain the fifteen-language selector and original user
  names, message text and filenames.

### Upgrade

Quit the existing node and back up its stopped user-data directory before
replacing the application. Formats 1 and 2 migrate atomically to storage format 3.
Older application binaries reject format 3 rather than ignore deletion markers
and agent identities. Keep the stopped backup to restore an older version. Never
open the same profile in two instances.

Reconnect MCP clients to obtain the eleven-tool schema and updated instructions.
Restart OpenCode when updating its bundled integration. Existing peer pairing,
protocol 2 messages, original routes and message IDs remain compatible.

Deletion affects local agent records and MCP history. Client transcripts, remote
copies and queues remain. Submitted messages and opened/exported files cannot be
recalled; a previously unknown incoming message may create a new unbound mailbox.
Check the exact chat before repeating an input whose admission is uncertain.

### Verification and limits

Native platform reports record the exact source revision and completed runtime
checks. Packaged GUI checks use temporary profiles and synthetic messages/files,
without contacting live agents or changing real client configuration. Consult the
reports for checks actually completed; source tests and renderer fixtures alone
are not native package verification.

macOS packages are ad-hoc signed without Apple notarization. Windows packages are
unsigned. Interactive installation/uninstallation and Start at login remain
manual checks unless explicitly recorded otherwise. Codex Desktop integration is
experimental and version-dependent; a missing owner is not proof of a closed chat
or restored delivery. OpenCode uses the v1 plugin/SDK contract, including frontends
that load that instance's plugin. Standard MCP clients do not automatically wake
idle chats.

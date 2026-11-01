# Changelog

## 0.11.0 — 2026-11-01

- Defer window creation until the node service and IPC are ready, preserving early
  open requests and explicit tabs.
- Separate local and remote agents, message histories, senders and drafts. Show
  computer names in normal UI and compact remote-node agent lists.
- Replace verbose incoming routing headers with a short persistent reply reference
  while preserving exact routing and legacy reply parameters.
- Add explicitly confirmed occupied-name reset and selected/all local agent
  deletion through the UI and the new `agent_clear_history` MCP tool.
- Preserve foreign admission evidence, uncertain dispatch, shared files and source
  identity across reset, cleanup, concurrent operations and same-name recreation.
- Group Applications by connection, keep diagnostics in details and distinguish
  client release, unconfirmed transport, unsupported input and uncertain admission.
- Show historical Codex verification time without asserting current liveness.
  Prevent older exchanges and stopped adapters from replacing newer health or
  triggering stale recovery and delivery.

Storage formats 1 and 2 migrate atomically to format 3. Older binaries reject the
new format; back up a stopped node before upgrading. Reconnect MCP clients for
the eleven-tool schema. Peer protocol 2 and existing paired routes remain intact.

## 0.10.0 — 2026-11-01

Combined distribution of localization and the routing, directory and pairing
changes documented in the source checkpoints below.

- Add a persistent sidebar language selector with English fallback and fifteen
  interface languages. MCP instructions and user content keep their original
  language. Profile-storage failures leave the app usable.
- Preserve literal dollar signs and placeholder-like text in translated labels
  containing user names or filenames. Keep header controls visible with long
  translated strings at the supported minimum window size.

## 0.9.0 — 2026-11-01

Source checkpoint. Binary publication was deferred to combine localization with
the verified transport, routing and pairing changes in one distribution.

- Show agents from explicitly paired nodes in the desktop UI and through the new
  `agents_list` MCP tool. Directory updates follow client arrivals, departures and
  node reconnections; unavailable and unsupported peers remain explicit.
- Add `agent_disconnect` to release a chat binding while preserving its history.
  Matching agent names on other nodes produce a warning and do not block a name.
- Replace certificate-bearing access codes with eight case-insensitive letters
  and digits. A code expires after ten minutes, permits five attempts and
  authorizes one peer through mutual PAKE authentication and automatic TLS pinning.
- Preserve committed pairing results across an identical confirmation retry;
  reject overlapping authorization changes and report interrupted writes without
  silently repeating an uncertain admission.
- Preserve visible message history and attachment controls when the selected
  agent is clicked again.

New pairing requires short-code support on both computers. Existing paired
connections, protocol 2 messages and saved history remain compatible. Reconnect
MCP clients to discover the two additional tools. See [pairing](docs/pairing.md)
and [agent presence](docs/agent-presence.md) for behavior and verification limits.

## 0.8.0 — 2026-11-01

- Require the recipient node UUID and agent name for every message, including
  local delivery. Replies carry the original sender's node, name and message ID.
- Return `accepted: true` with `queued`, `accepted_by_node` or `received_by_agent`
  delivery status instead of the ambiguous `sent: true` result. Display nodes
  and receipt status in history. Existing stored messages keep their routes.
- Update the build toolchain and scoped glob/minimatch dependencies to remove
  deprecated installation dependencies and reported moderate vulnerabilities.
- Verify native macOS Apple Silicon and Windows x64 packages, and fix Electron
  UI tooling when `ELECTRON_RUN_AS_NODE` is inherited.

Reconnect MCP clients after updating to refresh the changed tool schema and
instructions. Peer protocol 2 and the persistent database format are unchanged.

## 0.7.0 — 2026-10-30

Initial public release of NCF Agent Interconnect.

- Standalone tray application with an English React and Material UI interface.
- One local node for multiple AI clients and user-named agents.
- Local exchange without remote peers, and explicitly paired remote TLS nodes.
- Persistent message history, verified attachments and automatic receipt tracking.
- User-approved agent-name transfer between chats with preserved history.
- Manual MCP setup snippets for Cursor, OpenCode and Codex.
- Bundled OpenCode v1 plugin for exact-chat delivery and an experimental
  Codex Desktop adapter.
- Explicit sender and Reply-To fields in incoming agent messages.
- Native package builder with isolated installed-runtime verification.

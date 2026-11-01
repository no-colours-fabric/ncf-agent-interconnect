# Changelog

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

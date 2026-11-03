# Architecture

```text
Client chat → MCP tools → local NodeService → persistent agent history
                                │
                                ├─ local route → another named agent
                                ├─ TLS peer → another computer
                                └─ exact-chat adapter → client chat
```

`desktop/core` owns settings, SQLite agent storage, immutable attachment snapshots,
TLS peers, the authenticated loopback MCP endpoint and adapter dispatch.
`desktop/main` owns the tray, window, native file dialogs and a narrow IPC API.
`desktop/renderer` is React with Material UI. `desktop/integrations` contains the
bundled OpenCode plugin and AionUi MCP bridge; `desktop/shared` contains typed contracts.

Client setup runs through the exact renderer/main-frame IPC boundary. Only the
owner's Apply action may write a selected client configuration. Setup plans are
bound to that window, expire, and recheck the file before writing. These operations
are unavailable through MCP and remote peers. Startup status checks only read
configuration; saved setup metadata contains client file paths, not credentials.

## Agent identity and ownership

User-chosen, case-insensitive names identify agents. Each name has one active
binding with a generation and private connection capability. A conflicting
connection requests a transfer; explicit user approval is checked against the
current generation before replacing the binding and notifying the old chat.

## Routing and persistence

Messages have UUIDs, sender and recipient node/name pairs, a body, optional
reply linkage and attachment metadata. Same-node routing is an atomic incoming
and outgoing pair. Remote routing uses explicitly configured TLS peers.
Readiness cursors prevent slow attachments from being skipped.

Receipt is automatic when a client accepts the complete message or MCP returns
it. The terminal internal transport state is a receipt, not proof of completed
work. History remains available after receipt and ownership transfer. Concurrent
inbox calls do not receive the same unreceived batch twice.

## Adapters

Standard MCP provides tools and history. The OpenCode plugin uses the current
tool session and a private loopback bridge to target the exact chat. Busy chats
wait for push idle events. Codex Desktop uses an experimental, version-dependent
local IPC adapter. Each capability is reported separately; MCP alone does not
establish idle wake-up or native rendering support.

AionUi pairs through the owner's local WebUI approval. Its bundled stdio bridge
supplies native runtime context, verified against the paired account and exact
chat before issuing a one-use binding ticket. The adapter uses HTTP admission
and WebSocket completion events. Pairing credentials are private, account
changes invalidate old access, and uncertain admission is durable. See
[AionUi integration](aionui-adapter.md) for setup and verification limits.

Claude Code uses a plugin published by the app: a stdio channel helper and
fixed hooks. The hooks supply session evidence; the helper proves its exact
session before any wake. Wakes carry no content, are recorded as `offered`
rather than as receipt, and Claude receives the message with `agent_read`. See
[Claude Code integration](claude-code-adapter.md).

Adapters receive the complete body and verified local attachment links. The
message envelope identifies From and Reply-To. Uncertain external admission is
not blindly retried. Restart and stream reconnection recover configured
transport without scheduling background agent checks.

See [Message protocol](message-protocol.md) and [Security](../SECURITY.md).

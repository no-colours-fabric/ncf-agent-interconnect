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
bundled OpenCode plugin; `desktop/shared` contains typed contracts.

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

Adapters receive the complete body and verified local attachment links. The
message envelope identifies From and Reply-To. Uncertain external admission is
not blindly retried. Restart and stream reconnection recover configured
transport without scheduling background agent checks.

See [Message protocol](message-protocol.md) and [Security](../SECURITY.md).

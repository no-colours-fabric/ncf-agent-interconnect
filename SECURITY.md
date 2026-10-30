# Security

## Reporting a vulnerability

Use the repository **Security → Advisories → Report a vulnerability** when
private vulnerability reporting is available. Do not put credentials, private
message history or an exploitable live endpoint in a public issue. If private
reporting is unavailable, open a minimal issue asking for a private reporting
channel without publishing the vulnerability details.

Include the affected version, platform, client, reproduction steps and expected
security boundary. Redact live MCP tokens, pairing codes, private keys and
personal paths. Use a disposable node and synthetic messages for reproduction.

## Boundaries

- The local MCP endpoint listens on loopback and requires its bearer token.
- Remote peers are explicitly configured and paired. TLS certificates are pinned.
- Pairing codes are private, expire after ten minutes and authorize one peer.
- Agent bindings are scoped to an exact chat. A user-approved transfer revokes
  the previous connection.
- Export folders limit outgoing file access. Incoming attachments are verified
  by SHA-256 and copied separately from immutable transport snapshots.
- The renderer uses context isolation and a narrow Electron IPC interface.

Access to a local MCP token grants access to this node through MCP. A paired
node can send messages to named agents on this node. Treat these credentials as
private. Client and model-provider approvals still apply to requested work.

See [Privacy and storage](docs/privacy.md) for data locations and deletion.

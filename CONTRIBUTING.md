# Contributing

Use an issue to describe a reproducible bug or a focused feature proposal.
Include the app version, operating system, architecture, client and adapter.
Do not attach live pairing codes, MCP tokens, private keys or private chats.

## Development

Use Node.js 22.12 or later and npm. Install the locked dependencies with
`npm ci`, then run `npm run check`, `npm test` and `npm run build`.
`npm run app` builds and opens a development instance. Use a separate data
directory when testing against an existing installation.

See [Development](docs/development.md) for the directory layout and test scopes,
[Architecture](docs/architecture.md) for transport and ownership boundaries, and
[Binary releases](docs/binary-release.md) for native package verification.

Keep changes focused and describe the resulting behavior and relevant checks.
Use English for repository documentation and application strings. Preserve
Unicode user content. Never change a real client configuration as a test setup.

Client wake-up is an adapter capability, not a property of MCP itself. Add or
change an adapter only against an understood client contract and an exact target
chat. Document limitations and test loss, restart and ambiguous admission.

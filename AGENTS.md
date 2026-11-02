# Development guide

NCF Agent Interconnect is a standalone Electron message hub for AI agents.
The application owns transport, persistent history and client adapters. Users
configure supported MCP clients through client-specific setup dialogs. Only
the owner's Apply action may write the selected client configuration file.

## Language and structure

- Write public documentation, UI text, errors, tool instructions and comments in English.
- Preserve user messages, filenames and agent names in their original language.
  Keep Unicode and case-insensitive identity tests.
- Keep the typed core in `desktop/core`, Electron boundaries in `desktop/main`,
  React + Material UI in `desktop/renderer`, and contracts in `desktop/shared`.
- Keep each client integration behind its adapter. Address the exact bound chat;
  never select a recent or arbitrary chat as a substitute.

## Product invariants

- The user chooses agent names. Moving an occupied name requires explicit user
  approval and revokes the previous binding.
- Local agents can exchange messages without remote peers. Remote nodes require
  an explicit address and pairing code.
- Record receipt automatically when a message is returned through MCP or admitted
  to its exact client chat. Receipt is not task completion.
- Preserve history, attachments, message IDs and restart recovery. Do not blindly
  repeat an external request whose admission is uncertain.
- Client setup may update the selected configuration only after the owner's Apply
  action. Preserve unrelated settings and leave matching entries unchanged.
  Startup checks are read-only. Development and tests use isolated configuration
  files and must not modify real client configuration.
- Do not launch arbitrary agent commands or add scheduled agent polling. Network
  keepalive and event-stream reconnection belong to transport recovery.
- Keep tokens, private keys and node state out of logs and public fixtures.

Use `npm run format` for the shared source style.

## Validation

```sh
npm ci
npm run check
npm test
npm run build
npm run test:ui
```

Run checks appropriate to the change. Tests use isolated nodes and profiles; do
not contact live agents or change their state. Build release packages natively
on their target operating system with `npm run build:release -- --mac` or
`npm run build:release -- --win`. A successful cross-platform source check is not
a native platform verification. Report verification limits accurately.

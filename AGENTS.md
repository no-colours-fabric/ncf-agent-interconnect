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

## Interface conventions

- Outlined controls use permanent, unscaled labels above the complete border.
  Empty, focused and filled states do not move the label. Ordinary single-line
  inputs are 44 px high; preserve multiline rows/autosize and larger code fields.
- Keep dark/light selection in the renderer profile and retain unsaved form
  state when changing the theme. Use the shared semantic materials and tokens.
- Notifications use a flat inverse surface with a uniform border, without
  gradients, highlights or shadows. Preserve accessible roles and close actions.

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

## Routine releases

- Keep the release cycle short: one shared source check/test pass, one native
  package build and one packaged smoke per available native test platform,
  then publish.
  Reuse successful checks for unchanged source and dependencies. Do not repeat
  the full suite before and inside the release builder.
- Run additional locale, history, attachment, adapter and installer checks only
  for affected changes or a concrete failure. After a test-harness correction,
  rerun its failed check on the same binary; do not rebuild unchanged software.
- Publish three installers: macOS Apple Silicon DMG, macOS Intel DMG and
  Windows x64 EXE. No Universal package. Build both macOS architectures on macOS
  with matching Electron runtimes. Run native acceptance
  on the available Apple Silicon Mac and Windows machine. An Intel runtime test
  is not required and must not block publication; state that it was not run.
- Do not upload ZIP alternatives, reports, checksum manifests, screenshots or
  README copies as routine release assets. Keep diagnostics locally and put
  short changes and material limitations in the release description.
- After the new release is published with all required installers, remove
  uploaded assets from older releases. Keep their Git tags, source history and
  release descriptions. Never remove the last available installers before the
  replacement is published successfully.
- Check the final version, platform filenames and upload completion once.
  Repeat digest/download inspections only for a transfer error or a concrete
  integrity concern. Do not add repeated status checks or approval rounds.
- After publication, remove completed task/release worktrees and their temporary
  local and origin `codex/*` branches. Include detached worktrees and temporary
  publisher/staging repositories in this inventory. Check integration by ancestry or patch
  equivalence, including cherry-picked changes. Preserve `main`, release tags,
  unfinished work, uncommitted data and directories required by running previews.
  Retain necessary standalone QA history in a compact local bundle before removing
  its branches. Keep private profiles outside disposable worktrees, and record any
  cleanup exceptions. Coordinate cleanup across the native build machines.

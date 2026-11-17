# Development guide

LLM-optimized documentation: [llms.txt](llms.txt).

NCF Agent Interconnect is a standalone Electron message hub for AI agents.
The application owns transport, persistent history and client adapters. Users
configure supported MCP clients through client-specific setup dialogs. Client
configuration writes require the owner's explicit Apply or automatic-setup
Connect action for that selected application. Replacing existing settings still
requires separate confirmation.

## Project and brand naming

- `NCF Agent Interconnect` is the name of the application and project.
- `NCF` is the abbreviation of our brand, `No Colours Fabric`.
- Preserve these exact names and distinguish the product name from the brand in
  documentation, UI, prototypes, articles, listings and project communication.
- Include this rule when onboarding or handing off work to agents on this project.
  Notify only the current project team; do not broadcast it to unrelated agents.

## Language and structure

- Write public documentation, tool instructions and source comments in English.
- Provide professional-quality, context-appropriate translations for all new or
  changed product-controlled UI text in every supported locale (currently 15;
  see `desktop/renderer/i18n/index.ts`). Include actions, help, dialogs, empty,
  loading, error and diagnostic states, tooltips and accessibility labels.
  English is the source locale, not a fallback for another supported locale.
  Preserve literal product/client names, placeholders and existing localized
  name-transfer and history guidance. Raw user content and technical diagnostic
  data retain their original language; user-facing summaries remain localized.
- Preserve user messages, filenames and agent names in their original language.
  Keep Unicode and case-insensitive identity tests.
- Keep the typed core in `desktop/core`, Electron boundaries in `desktop/main`,
  React + Material UI in `desktop/renderer`, and contracts in `desktop/shared`.
- Keep each client integration behind its adapter. Address the exact bound chat;
  never select a recent or arbitrary chat as a substitute.

## Product invariants

- Preserve all existing application capabilities and user workflows across the
  entire product. This applies to every change, redesign and prototype, not only
  the feature or example mentioned in feedback. Simplifying presentation must not
  remove or make actions, settings, help, states or recovery paths inaccessible.
- For redesigns and prototypes, inventory existing capabilities and show where
  each remains accessible. Mark schematic or out-of-scope areas explicitly;
  schematic presentation does not authorize removal in the implemented product.
  Removing or reducing a capability requires an explicit owner decision.
- The user chooses agent names. Moving an occupied name requires explicit user
  approval and revokes the previous binding.
- Local agents can exchange messages without remote peers. Remote nodes require
  an explicit address and pairing code.
- Record receipt automatically when a message is returned through MCP or admitted
  to its exact client chat. Receipt is not task completion.
- Preserve history, attachments, message IDs and restart recovery. Do not blindly
  repeat an external request whose admission is uncertain.
- Client setup may update the selected configuration only after the owner's
  explicit Apply or application-setup Connect action. Replacement requires a
  separate confirmation. Preserve unrelated settings and leave matching entries
  unchanged. Startup checks are read-only. Development and tests use isolated
  configuration files and must not modify real client configuration.
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

## Release numbering

- Use MAJOR.MINOR.PATCH. PATCH is for compatible fixes without new product
  capabilities. Backward-compatible new capabilities require MINOR and reset
  PATCH to zero. Incompatible stable public contract changes require MAJOR.
- Before 1.0, do not hide features or incompatible changes in PATCH. Incompatible
  changes require at least MINOR and explicit compatibility notes. Promotion to
  1.0 is a deliberate owner decision.
- Classify the actual source scope and choose the version before freezing or
  building. Release count does not determine the version. Keep package and lock
  root versions, runtime metadata, distribution README, notes, installer names
  and Git tag consistent. Do not repeat unchanged source checks just to renumber;
  repeat only the packaging or metadata verification the change requires.

## Routine releases

- Keep the release cycle short: one shared source check/test pass, one native
  package build and one packaged smoke per available native test platform,
  then publish.
  Reuse successful checks for unchanged source and dependencies. Do not repeat
  the full suite before and inside the release builder.
- Run additional locale, history, attachment, adapter and installer checks only
  for affected changes or a concrete failure. After a test-harness correction,
  rerun its failed check on the same binary; do not rebuild unchanged software.
- Publish four installers: macOS Apple Silicon DMG, macOS Intel DMG,
  Windows x64 EXE and Linux x86_64 AppImage. No Universal package. Build both macOS architectures on macOS
  with matching Electron runtimes. Run native acceptance
  on the available Apple Silicon Mac, Windows and Linux machines. Build Linux packages on Linux. An Intel runtime test
  is not required and must not block publication; state that it was not run.
- When a release changes the interface, include images demonstrating the changes
  in its release description. Actual UI images from one operating system are
  sufficient. Keep private data out of the images; the four installers remain
  the routine release assets.
- Prioritize completing and publishing substantial features. Schedule small
  improvements between substantial feature releases; do not let them repeatedly
  interrupt implementation, extend a frozen release or block a larger feature.
  Give isolated writers coherent implementation stages and coordinate actual
  shared changes instead of requiring approval for every small step.
- After every MINOR version update, replace documentation screenshots with actual
  screenshots from that version. The key frames are Applications and Remote nodes.
  Do not reuse older-version screenshots or substitute prototypes. Coordinate
  capture, docs updates and public verification within the minor-release workflow.
- Do not upload ZIP alternatives, reports, checksum manifests, screenshots or
  README copies as routine release assets. Keep diagnostics locally and put
  short changes and material limitations in the release description.
- Starting with the next release, retain built installers in the primary
  repository checkout's `release/<version>/` on each native build machine.
  On this Mac, use `/Users/a.prokopenko/dev/agent-interconnect-mcp/release/<version>/`;
  use the corresponding repository-root directory on Windows and Linux.
  Copy installers out of disposable worktrees before removing them. These
  version directories are owner-managed: never automatically delete or replace
  their contents, and exclude them from release/worktree cleanup. Clean temporary
  build/evidence archives such as `.local/windows-evidence-archive` after retaining
  the installers and any necessary compact QA history. Export installers and compact
  QA from disposable CI runners before their teardown; retain the downloaded
  installers in the primary version directory.
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

# Next-round interface corrections for 1.1.0

## Baseline

Source `054f7dbb84b7799838ae16ee972d689815994f12`, from the accepted OpenCode
v2 candidate on alpha 9. Verification used macOS 26.5.2 on Apple Silicon,
Node 22.12.0, Electron 45.1.0 and isolated Chromium fixtures.

## Behavior and verification

- **#2, Agents.** The unknown application uses the same 24 × 24 px
  box, 2 px image padding and radius token as a known logo. A
  2 px border encloses the question mark. The localized accessible name
  remains on the icon. Server-rendered checks retain sorting and typed
  remote application identity. An isolated Electron run inspected the
  border, dimensions, padding and radius in the actual Agents table.
- **#5/#20, Storage.** Settings shows one Storage heading and a row
  with Attachments and total size on the left and cleanup on the right.
  The shared explicit-confirmation dialog adds All for the chosen scope.
  Numeric ages retain the exclusive receipt-date cutoff. The new
  `olderThanDays: 'all'` value omits only the age predicate. Using the
  existing no-cutoff usage query directly would include ready messages.
  The removal path still selects processed incoming messages, checks the
  exact selected mailbox incarnation, verifies owned copies and preserves
  other references and history. A two-node loopback test exercised both
  scopes, recent files, the age boundary, repeat confirmation, pending
  receipt, shared and edited copies, and retained filenames. Isolated
  Electron checked Settings row alignment, keyboard selection, Cancel,
  actual IPC removal, zero storage and retained history.
- **#25/#28, ChatGPT.** The existing common modal accepts the optional
  `restartRequired` flag from a successful write to the exact delivery
  profile. A status read cannot request a restart. The existing Mac
  acknowledgement after a successful configuration write remains.
  Modal confirmation is required and restores focus to the current card
  or manual switch. Overview and Applications derive the warning and
  action from the same verified delivery state as the manual switch.
  The warning additionally requires a detected ChatGPT and a version
  strictly above 26.1111.71704. Chromium exercised the 26.1120.50957
  configured profile, keyboard enable and disable, both warning surfaces,
  manual focus, exact profile choice, Connect with an explicit restart
  result, no-op, failed/refused/cancelled setup, cutoff and missing
  detection. The success flag uses the same response shape agreed with
  the macOS lifecycle owner. Native production restart signaling belongs
  to the platform integrations.
- **#27, sidebar.** Actual renderer checks at 720 and 1280 px confirmed
  Start/Stop with Enter and Space, distinct state colors, 44 px targets
  and right alignment beside the status.
- **#34, manual pairing.** The normal renderer awaited approval cancellation
  before committing every character, including when no request existed.
  React restored the controlled value in the meantime and moved the caret
  to the end. Both entry paths now share a field that commits ordinary edits
  synchronously. With an approval pending, it commits only after accepted
  cancellation and restores the captured insertion position. Chromium
  exercised edits at the start and middle of IP, port and URL, including
  after cancellation of a waiting approval. Address parsing and the pairing
  request shape are unchanged.

## Boundaries

TypeScript, scoped formatting and diff checks ran with 57 targeted tests
passing and 12 Windows-only tests skipped on macOS. Desktop Settings and Agents
ran in an isolated Electron profile against synthetic data. ChatGPT restart and
cross-surface state ran with typed simulated responses rather than changing an
installed ChatGPT profile. No installer packaging, publication, production
profile changes or platform lifecycle integration were exercised. All changed
strings are supplied for 15 locales.

See [attachment history and cleanup](attachment-lifecycle.md) and
[ChatGPT delivery integration](chatgpt-delivery-release-integration-2026-11-26.md).

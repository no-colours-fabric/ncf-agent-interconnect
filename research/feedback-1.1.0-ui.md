# 1.1.0 interface feedback

The starting point was `f9d9cf0d3bef08f874db5e6177b4a2d61d356dd2`. Earlier
application-column and peer compatibility findings are in
[Agent table sorting and application identity](agents-table-application-directory.md).

## Agents table and history

- The application value remains available to sorting and is exposed through the
  icon accessible name and tooltip. The older-node fallback is a question mark
  with a localized accessible name. Column allocation uses a bounded flexible
  width for the last-message column and leaves the remaining width to the node
  name. Wrapping is enabled in headers and body cells.
- The desktop timeline must apply the attachment predicate before pagination.
  Filtering only the already rendered window misses older matches. An
  attachment is present when its saved envelope has metadata, even after file
  cleanup sets its ledger reference to unavailable. The renderer keeps that
  file name and uses the existing unavailable label in place of file actions.
  The MCP history, delivery state, and receipt behavior are unchanged.
- The attachment filter controls only the selected local chat, starts off when
  a chat opens, and separates its history result from the unfiltered view.
  Earlier in-flight results cannot overwrite a new mode.
- A 250-message SQLite service test covered sparse matches, cursor direction,
  exact mailbox, retained metadata and unavailable file actions. A separate
  Chromium fixture used generated histories and mocked desktop history IPC to
  exercise the keyboard filter and view pagination.

## Startup and Overview

- One responsive track definition works for both surfaces. A visible ChatGPT
  warning makes the card use two tracks starting at the three-column threshold;
  the layout uses the same presentation predicate as the notice. With one or
  two tracks the card stays at ordinary width. Incomplete rows center while
  preserving order and normal track width. Overview centers the title and
  command guidance; within the ChatGPT card, equal gaps separate the warning
  from status and applicable guidance.
- Direct Vite dev loading of the temporary browser fixture bypassed CommonJS
  dependency bundling. A Vite-built fixture served by Playwright route
  interception exercised the actual renderer and CSS without a real node
  or profile. The browser verification and SQLite tests did not exercise
  native installers or installed application detection.

The Startup regression also checked the exact Cursor, ChatGPT 26.1120.50957,
and AionUi with Cursor Agent order. At one and two columns all cards kept one
track. At three and six columns the warning used two tracks. Both version
numbers in the notice and its download link occupied single text fragments
on every measured EN, RU, and DE viewport. Keyboard focus could move from the
download link to Connect without invoking either action.

## Per-agent received storage

- A second change adds the sortable storage column and uses the shared Settings
  cleanup dialog. The desktop usage call returns deduplicated byte counts.
  The UI associates each count with the local stable key and incarnation.
  A remote namesake and a replacement incarnation have no matching local value.
  A measured zero remains distinguishable from missing usage.
- The row action submits only the exact local identity and selected age. The
  UI closes a dialog whose original identity disappears. The backend owns the
  final stale-scope check. Success and failure both trigger a storage refresh
  and invalidate loaded history so the display can re-read retained file metadata.
- The isolated Chrome fixture used the shared dialog source and mock desktop
  IPC. It exercised keyboard sorting, age selection, confirmation, focus restore,
  the two namesakes, the refreshed zero count and history, and replacing the
  selected incarnation before confirmation. A narrow German header wrapped
  inside the table. No real files or agents were removed.

## Table, storage, and Applications follow-up

The starting point was `f5a2f92e3fd88eb83b7dbaee8263454dc7c68da4`.

- With automatic table layout, equal declared widths redistributed differently
  between Messages and Attachments at narrow sizes. Fixed 152 px tracks keep
  them equal. The table scrolls below 960 px. The longest word in each heading,
  its padding, and the sort icon fit at the minimum; headings break at spaces.
  In Chrome the narrowest tested date track was 150 px, and it grew to 181 px
  before the node name track changed width. Application image padding is 2 px
  with an independent 8 px horizontal inset on its table cell.
- The Settings summary uses the reported total, which can differ from a sum
  of per-agent usage. Both views use decimal units with localized numbers and
  unit symbols. Choosing the unit from the raw bytes before truncating to two
  decimals keeps values such as 999,999 bytes below the megabyte threshold.
  The table continues sorting the unformatted byte counts.
- A Chrome renderer fixture measured the table in all 15 locales at 650,
  995, and 1400 px. It exercised keyboard sorting across a unit boundary, the
  per-agent action delegate, and Settings cleanup with the all-agent scope.
  Computed gaps around the ChatGPT warning were 12 px at both 560 and 1240 px
  in Applications. A verified version rendered no warning.
- The fixture used synthetic data and mocked IPC. The existing packaged
  smoke selector now waits for the total without expecting an agent entry.
  Native packaging and native smoke execution were outside this verification.

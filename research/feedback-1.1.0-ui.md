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

# Agent table sorting and application identity

## Starting point

Issues #7, #9 and #10 in 1.1.0, based on `d0d8eb506cedb17c51792ffc9ef96ba3c1a97df4`.
The Agents table showed the local binding's client string and no corresponding remote value.
Agents on different nodes can have the same canonical name.

## Findings and implementation

- An optional field in the new reader does not make it safe to send the field to old nodes.
  Their directory-entry schema rejects extra keys. The original feature header is also compared
  for exact equality, so appending a second value would disable the original directory.
- The upgrade retains `agent-directory-v1` and independently negotiates
  `x-ncf-directory-application: 1`. A link without the extension receives the original entry
  shape. Transport protocol 2, pairing and message delivery are unchanged.
- The application identifier comes from a bound, supported adapter. Labels, chat identifiers
  and connection identifiers are outside the directory entry. The receiving node associates
  the published value with the exact peer directory entry. Missing values have a neutral
  localized presentation. A typed identifier maps to an existing product name and logo.
- Sorting compares the visible names, normalized timestamps or numeric message totals.
  Missing values remain at the end in both directions, while a measured zero sorts as zero.
  Equal values use a deterministic name and row-identity tie break. The sort works on the
  rows supplied to the table. It does not mutate the caller's filtered rows.
- Row identity and presence are independent under R-0018. The stable key keeps the row and
  history associated with the same mailbox, while directory presence follows the current
  canonical nickname.

## Verification

- The table and presence suites passed 19 tests on the assigned base. Two isolated loopback
  nodes advertised different applications for Unicode namesakes, sent a normal message, and
  repeated the scenario with only the original directory capability. The legacy-mode fixture
  asserts the exact legacy field set in both directions. No earlier installer was run.
- Static rendering covered all 15 locales and visually displayed names with decorative
  logos, plus the localized fallback for a peer with no application field. A focused
  Chromium fixture checked Enter, Space, `aria-sort`, focus retention, filtering and row
  actions. Serving the test bundle and assets from an intercepted origin avoided the
  relative-URL failure of an inline module on a blank page.
- The default command sandbox could not open loopback sockets or launch Chromium. The
  successful runs used isolated node data and an isolated browser context.
- Native installers and a live hub were outside this verification.

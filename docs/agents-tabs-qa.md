# Agents tabs source QA

Product commit: `dff8e4bfac49098ef9535fba6ea33aa506b2e689`.
Base: `2322ee551486537fe56c87d10e4391b4d2755f09`.
Platform: macOS ARM64, Electron 45.1.0. Date: November 1, 2026 (Europe/Moscow).

## GUI launch results

All three invocations used
`node --experimental-sqlite scripts/test-desktop-ui-agents-tabs.mjs` from the
isolated `.local/agents-tabs` worktree.

| Execution                         | Context                      | Result                                                                                                                                             |
| --------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session 76165, test process 91047 | Restricted sandbox           | **FAIL**, exit 1 during `electron.launch`, before `firstWindow` or any UI scenario actions. Playwright reported `Process failed to launch!`.       |
| Session 60841, test process 92574 | Approved `require_escalated` | **PASS**, exit 0; complete isolated scenario, no renderer page errors.                                                                             |
| Session 5526, test process 94144  | Approved `require_escalated` | **PASS**, exit 0; complete isolated scenario including the explicit remote-node picker and updated synthetic screenshots, no renderer page errors. |

Coordinator Bob matched the failed launch to crash report
`4485CEA8-0649-43EE-88B8-18736A1C76E1`: Electron process 91835, parent 91047,
launch at 18:00:09.1996 and abort at 18:00:10.9037 Moscow time. The reported
stack aborted in `_RegisterApplication` / `NSApplication`. Both processes had
exited; the remaining crash-report window was not closed by this agent.

The successful runs support a dependency on launch context. They do not turn
the initial failed launch into a pass or establish a defect in the installed
application. No automatic launch retries or security-control changes were used.
Both successful runs were started before Bob's instruction to stop further GUI launches.

## Source and scenario coverage

- `npm run check`: passed (types and formatting).
- `npm run build`: passed; Vite emitted its bundle-size warning above 500 kB.
- Targeted history and localization tests: 18 passed, none failed.
- `git diff --check`: passed.
- GUI scenarios: default and keyboard tabs; independent drafts; local-only send;
  explicit local sender and full remote address; same-name peers and separate
  owner histories; raw pagination after an empty filtered page; Network-to-Remote
  navigation; no send or receipt changes from navigation; preserved reselected
  history; literal Unicode attachment names and verified open/save; English,
  Russian, German and French; supported 1050 by 700 window layout.

Profiles, nodes, messages and attachment files were temporary test fixtures.
No live agents or real client configurations were used for these UI checks.
Screenshots under `release/agents-tabs-*.png` contain synthetic fixture data.

## Diagnostic follow-up limits

The subsequent documentation and launch-diagnostic changes were checked with
`node --check` and Prettier only. Electron was not launched again, so the new
failure diagnostic was not exercised against another GUI failure. No native
release packages, Windows checks, installed-app verification, LAN verification,
publishing or integration acceptance are claimed.

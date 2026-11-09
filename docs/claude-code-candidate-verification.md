# Claude Code adapter candidate: verification

This is the submitter's verification of the integrated Claude Code adapter
candidate. It covers the source review, the packaged runtime and a focused
native campaign. It is not a release and not platform acceptance on macOS or
Windows.

## Identity and ancestry

- **BASE:** `ed82d93029f7c8264645de2c03303bf8776a517d`. Its ancestry is
  `273b91b` → `5515bc4` → `ed82d93`.
- **Branch:** `codex/claude-code-candidate`.
- **HEAD and TREE:** see `HEAD_SHA` and `TREE_SHA` in the archive.

Logical commits:

| Group                               | Commits                                                                                                                                                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source defect corrections           | `50000eb` (G1–G4 in the research prototype), `c4525c0` (wake child awaits a late native lease), `3d4593a` (coalesce arrivals into the queued notice), `c8aa41d` (owner-approved transfer from a Claude Code chat, a BASE defect) |
| Installed integration and setup     | `956266b` (mod and gate plugins, wake stream, claims, setup, status, 15 locales), `06309a0` (setup text names the fixed hooks and mods)                                                                                          |
| Receipt, store, writer and recovery | `bf9dfaa` (delivery attempts, fences, frame-write commit, recovery)                                                                                                                                                              |
| Verification and documentation      | `c57b5a3` (product guide, packaged README), `55bc058` (packaged verification), and the final evidence and documentation commit                                                                                                   |

## Changed shared boundaries and compatibility

- **Storage.** The agent store moves from format 3 to format 4 and adds the
  tables `claude_deliveries` and `claude_delivery_items`. The migration is
  additive. An older application refuses format 4, as it already does for any
  unknown format.
- **`AgentStore.history`.** It gains an optional `unfenced` filter, which is
  off by default.
- **`AgentStore.recordDelivery`.** It refuses IDs fenced by a Claude Code
  delivery. Other adapters never hold such IDs.
- **Automatic dispatch eligibility.** It skips fenced IDs. This is the only
  change for other adapters, and it applies only to messages under a Claude
  attempt, for example after a transfer.
- **MCP tool registration.** A handler can receive the admitted Claude permit
  and return a private delivery attempt, which goes to the helper in `_meta`.
  Non-Claude clients are unchanged.
- **`agent_read` and `agent_history`.** Through an admitted Claude Code call
  they use the delivery attempt path. For other clients they keep their
  behaviour, except that fenced IDs are skipped or listed without content.
- **New integration routes.** All are behind the local bearer token:
  - `/integrations/claude/wake/stream`
  - `/integrations/claude/wake/claim`
  - `/integrations/claude/wake/start`
  - `/integrations/claude/wake/dropped`
  - `/integrations/claude/delivery`
- **Claude helper.** The stdio transport resolves a frame only on the write
  callback. The helper commits, cancels or marks a delivery uncertain, and a new
  `--wake-stream` mode exists.
- **Published Claude marketplace.** It now carries a second plugin
  (`ncf-agent-interconnect-gate`), the main plugin depends on it with an exact
  version, and the main plugin has a hooks module.
- **Claude setup.** Apply enables both plugins, and the launch command is plain
  `claude`.
- **Not changed.** Remote wire protocol, other adapters' delivery and receipt,
  pairing.

## Source findings from ed82d93

| Finding                        | Resolution                                                                                                                                                                                                                                                             | Evidence                                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| G1 gate lifecycle race         | The decision is taken after the last await. Evidence I/O happens before the start check or after the decision, never awaited in between. The product gate has no evidence I/O at all.                                                                                  | `research/claude-first-wake/tests/gate.test.ts`: 12 tests drive the real hooks with barriers. Six of them fail against the ed82d93 gate.        |
| G2 notice-to-claim association | The node composes each notice with a random wake reference. The mod submits that exact text, and the gate names it by the SHA-256 of `e.text`, only for `next.origin.plugin` equal to the NCF plugin. A superseded notice is refused without spending the fresh claim. | Research `claims.test.ts` (exact sequence, replays, concurrent starts, stale helper, transfer, forged text); product `claude-code-wake.test.ts` |
| G3 claim exhaustion            | Finished and expired claims are reclaimed. A bounded tombstone map keeps replay answers. The quota counts active claims only and fails closed.                                                                                                                         | Controlled-clock test: 300 completed and 300 expired claims, then a fresh claim; quota refusal without eviction                                 |
| G4 evidence table              | 2a and 7b are corrected and invalid attempts stay invalid.                                                                                                                                                                                                             | `research/claude-first-wake/CONTINUATION-REPORT.md`                                                                                             |

## Source and packaged checks

| Check                                                                                                                                   | Revision   | Result                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| `npm run check` (typecheck and Prettier)                                                                                                | final HEAD | see `VERIFICATION.md` in the archive                                                      |
| `npm test` (full desktop suite, one run)                                                                                                | final HEAD | see `VERIFICATION.md` in the archive                                                      |
| Claude tests, `node --experimental-sqlite --import tsx --test --test-concurrency=1 test-desktop/claude-code-*.test.ts`                  | `c8aa41d`  | 83 of 84 pass; the BASE cold-backlog test failed under suite load and passes in isolation |
| Research tests (gate, claims, endpoint)                                                                                                 | `50000eb`  | 27/27; mod kit 9/9; gate kit 2/2                                                          |
| `npm run build`, then `electron-builder --publish never --linux` (the existing AppImage target), then `node scripts/verify-release.mjs` | final HEAD | see `VERIFICATION.md`                                                                     |

`verify-release.mjs` runs the packaged Electron runtime against an extracted
`app.asar`. The Claude part checks the following:

- hooks apply the node's `updatedInput` proof;
- no `session_event` tool is exposed;
- the generated plugins (dependency with exact version, modules, gate);
- the packaged `--wake-stream` child delivers a claim line without message
  text;
- claim consumption and the gate start by text hash;
- `agent_read` through the packaged bridge commits receipt only after its frame
  write.

## Native campaign

**Environment:**

- Linux x86_64 with Claude Code 2.1.319, native install, claude.ai personal
  account, no organization policy.
- An installed copy of the packaged runtime from the stated revision, started
  with an isolated `--data-dir`.
- A dedicated `CLAUDE_CONFIG_DIR`, configured only by the owner's **Apply** in
  the product UI. No development flags, no `--plugin-dir`, no manual JSON
  except the deliberate gate-off negative case, which was restored byte for
  byte.

**Interaction:** owner keystrokes were sent through tmux. The owner answered
dialogs and approved the transfer.

**Evidence:** `docs/evidence/claude-code-candidate-native.json` holds sanitized
transcript rows (turn origin, `tool_use` suffixes, returned synthetic IDs),
delivery attempt states and key client debug lines.

**Revision reuse:**

- `3d4593a` → `c8aa41d` changed only the `claudeCall` check for `agent_connect`
  and the setup text. Cases on `3d4593a` therefore stay valid for the final
  revision.
- Cases on `c4525c0` that the coalescing change could affect (isolation,
  pagination) were repeated on `c8aa41d`.
- Prototype evidence from the research branch is not counted for the installed
  runtime.

| Required case                                                                                                                         | Status                           | Revision                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| First already-pending wake after exact launch or resume, no receiver action, no second arrival                                        | PASS, with one FAIL observation  | 3d4593a, c8aa41d          | K5 B and C, K11 A and C, K14 A, B and C: plugin-origin notice, `agent_read`, attempt committed. **K5 A FAIL:** the gate started the notice, but the bridge refused `agent_read` ("native Claude Code session is not verified") when MCP connected 2.4 s before `SessionStart:resume`. No receipt, the message stayed ready and the next exact resume delivered it. Root cause not determined; a dev reproduction of the same order passed. |
| Later arrival                                                                                                                         | PASS                             | c4525c0, 3d4593a, c8aa41d | K1, K12, K16                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Independent A/B/C isolation                                                                                                           | PASS                             | c4525c0, c8aa41d          | K2, K15: only A woke; B and C have 0 plugin rows                                                                                                                                                                                                                                                                                                                                                                                           |
| Busy work, coalescing, pagination                                                                                                     | PASS                             | 3d4593a, c8aa41d          | K6: 5 arrivals during busy work, one notice, one read. K15: 52 messages, all committed exactly once over several notice turns while arrivals continued. K4 (c4525c0) showed every arrival queueing a notice; fixed in `3d4593a`.                                                                                                                                                                                                           |
| Unchanged draft                                                                                                                       | PASS                             | c4525c0, 3d4593a          | K3 (notice with a draft present), K8 (drop with a draft)                                                                                                                                                                                                                                                                                                                                                                                   |
| Pending permission and question dialogs                                                                                               | PASS                             | 3d4593a                   | K9: the notice was queued at 17:59:03.720 during the question, passed the Bash permission, and ran at 18:00:35.410 after the owner's turn                                                                                                                                                                                                                                                                                                  |
| Explicit Stop/Esc; dropped or refused notices without resurrection                                                                    | PASS                             | 3d4593a, c8aa41d          | K7: dropped by Esc, no resubmission, explicit read later committed, next arrival woke again. K8: gate drop (`backlog-read`) with a draft. K15: one gate check failed closed (`HooksError`) and nothing was lost.                                                                                                                                                                                                                           |
| Pending work during `/clear`, `/resume` and `/branch`                                                                                 | PASS (safe unbound)              | 3d4593a                   | K10: the stream ended, there were no plugin rows in the new contexts, the binding was not moved and messages stayed ready. K11: recovery by exact `--resume` delivered them. A notice queued exactly across the transition is covered by synthetic gate and claim tests.                                                                                                                                                                   |
| Helper or node restart and approved transfer at the query, queue and read-release boundaries                                          | PARTIAL                          | 3d4593a, c8aa41d          | Node restart with live chats PASS (K12). Approved transfer PASS (K16): the former chat's read was refused with no receipt and the new chat woke. Boundary races: synthetic (`claims.test.ts`, `claude-code-wake.test.ts`, `claude-code-receipt.test.ts`). Native helper restart (`/mcp` Reconnect): NOT_RUN, not induced.                                                                                                                  |
| Exact native tool-use and result IDs; supported receipt boundary; no false receipt or replay for failed, withheld or concurrent reads | PASS                             | all                       | Evidence JSON: per read, the `tool_use` suffix, returned IDs and the committed attempt. Refused reads in K5 A and K16 B produced no attempt. Concurrent and withheld reads are synthetic.                                                                                                                                                                                                                                                  |
| Installed plugin ordering; disabled or missing gate                                                                                   | PASS (disabled); missing NOT_RUN | c4525c0, 3d4593a          | K0: the NCF module loads before the gate module. K13: the vendor CLI refuses to disable the required gate; with the gate set false by hand, the NCF plugin is `dependency-unsatisfied` and not loaded. A missing gate was not induced natively.                                                                                                                                                                                            |

## Limits and open items

- **Unexplained K5 A failure.** See the case table. It is an availability
  defect, not an authority, data-loss or false-receipt defect, and is not
  fixed. Recovery: resume the chat again, or use `/mcp` Reconnect.
- **First launch after Apply.** It can still use a previously known marketplace
  location, because Claude Code reconciles it in the background. The
  documented restart or `/reload-plugins` applies it (K0).
- **Unresolved uncertain deliveries.** They are fenced and inspectable: the
  owner's history shows the message error, and `AgentStore.claudeUncertain`
  lists them. There is no owner control to release them yet.
- **Automatic wake needs Claude Code mods.** Safe mode, policy and Desktop WSL
  leave it unavailable, and status says so. One chat bound to two agent names
  is refused as ambiguous, so it gets no wake.
- **System notices.** `agent_moved` notices reach Claude Code only through the
  legacy channel or `connection_events`, not through the mod.
- **Desktop shell.** On this Linux session the candidate app showed no tray
  icon. After SIGTERM it closed its service but the Electron process did not
  exit. That is pre-existing main-process code, not compared with BASE.
- **Not run:** macOS, Windows, Claude Desktop, organization policy, a second
  account, and a native installer (the AppImage target was built and its
  unpacked runtime used; the AppImage itself was not installed).

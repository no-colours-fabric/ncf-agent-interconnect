# Claude Code first wake: continuation report (r2)

Campaign `ncfcr-20261109-r2`, 2026-11-09. Continuation of the research at
`5515bc487c111f563a038158bac58a39f42392c6`, which descends from the original
BASE `273b91b8d62c3bf2c8fd57b7b345b660187dc3fa`. All changes are under
`research/claude-first-wake`. Production code, settings and receipt semantics
are unchanged: `git diff 273b91b HEAD -- desktop test-desktop scripts
package.json package-lock.json` is empty. `REPORT.md` and
`evidence/native-campaign.json` from the first packet are unchanged.

This is developer research. It is not a release, not product F11 acceptance
and not receipt acceptance.

## Outcome

**Corrected isolated implementation with focused native evidence, and one
reproducible host limitation together with the supported way around it.**

1. The confirmed lifecycle race in the mod is fixed. Controlled tests cover
   every stale path and show zero submissions.
2. A research-only, node-owned, one-use **wake claim** replaces the advisory
   ticket. It is bound to:
   - the exact native session and the node incarnation;
   - the helper id, epoch and generation;
   - the native lease nonce;
   - the binding connection, adapter and generation;
   - the captured backlog IDs.

   It is revalidated before consumption and again before the queued notice
   starts a turn.

3. **Host limitation.** A mod's own `prompt.submit` hook never sees that mod's
   own `$.prompt.submit`. That holds in the test kit and natively on 2.1.318 and
   2.1.319. Hooks of a plugin loaded _after_ the submitter do see it, with
   `next.origin.plugin` naming the submitter. Natively, `prompt.submit` for a
   queued mod prompt fires **at dequeue**, right before `turn.start`. The
   pre-turn fence therefore lives in a separate plugin, `ncf-first-wake-gate`
   (one hooks module per plugin is a validator rule). Native cases confirm that
   it drops stale, revoked and already-read notices at the start boundary.
4. All required native acceptance cases were exercised, except the items marked
   `NOT_RUN` below, each with its reason.

## Implementation (research only)

| Path                         | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mod/hooks/register.js`      | Candidate mod. `session.start` allocates the lifecycle scope synchronously, before any `await`, and replaces the previous one. Each continuation checks `current(own)` after every asynchronous step and immediately before `$.prompt.submit`. Order of work: one query, consume the claim, submit one fixed notice with plugin attribution (never `asUser`). Never retries. Reports `query-failed`, `fenced`, `claim:<reason>`, `dropped:<reason>` or `turn-started`.                                                                                                                                                           |
| `gate-mod/hooks/gate.js`     | Pre-turn gate, loaded after the mod. Gates only prompts with `next.origin.plugin === 'ncf-first-wake-research'` and the notice prefix. Drops the notice when the lifecycle ended, when the session id differs, or when the node start check fails. A registration `.catch` fails closed. Owner prompts pass unchanged.                                                                                                                                                                                                                                                                                                           |
| `fixture-node.ts`            | `WakeClaims`. A claim is issued in the same synchronous step as the snapshot that found the backlog. It is consumed once with an asynchronous native-lease read followed by a synchronous recheck and state change in the same tick. `start` runs once, by claim id or as the single consumed claim of the exact session. A newer answer for a session voids its unfinished claims. Each query answers once, also under nested change events (bug found natively, fixed in `8df6ea9`). `--control` adds research barriers released by observed native events, synthetic second arrivals and a synthetic owner-approved transfer. |
| `probe-mod/hooks/observe.js` | Instrumentation only. Reports session, turn, prompt-origin, draft-presence, dialog and tool-check events without any text.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `harness/`                   | Launch, sender, control and reload-runner scripts used for the native runs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Neither the claim nor the gate reads, receipts or hides messages, or suppresses
Channels offers. The notice carries no content. Every read still passes the
unchanged native proof, call permit and tool admission. Wake suppression,
message receipt and task completion remain separate facts.

### Boundary between claim, submit, queue and turn

| Step                                                                                      | Fence                                                                                                                                                                                                                                    | Evidence                                                                         |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Answer issued                                                                             | Claim bound to session, incarnation, helper, lease, binding and backlog                                                                                                                                                                  | `claims.test.ts`, every native case                                              |
| Consumed, right before submit                                                             | Asynchronous lease read, then synchronous revalidation and consumption in one tick; foreign, missing, expired and replayed claims fail without spending the owner's right; concurrent consumers produce exactly one winner               | `claims.test.ts`                                                                 |
| Submit until dequeue (the prompt waits until idle)                                        | Not fenceable from the submitting mod: it has no prompt id and no cancel. Esc removes the queued prompt (`dropped: the prompt was removed from the queue before it ran`) and nothing repeats it. A module reload is deferred until idle. | L2, L1                                                                           |
| Dequeue, right before the turn                                                            | Gate (later plugin) asks the node to start the claim once, with full revalidation. A revoked binding, revoked lease, new incarnation, ended lifecycle or already-read backlog drops the notice.                                          | N3-retry (`backlog-read`), L8 (`revoked:binding`), L1/L3/L5/ISO (`gate:started`) |
| Gate check until model tool call (18–64 ms to `turn.start`, then seconds to `agent_read`) | Not fenced by the gate. Message content still requires the unchanged native proof and binding checks: a stale session's `agent_read` is refused.                                                                                         | L8 explicit read                                                                 |

**Unsupported boundary.** The host offers no fence that binds a submitted mod
prompt atomically to "this turn starts only if the node still agrees". The
last host-visible point is the later plugin's `prompt.submit` at dequeue.
Another HTTP round trip cannot close the window between that check and the
model's tool call. Message content stays protected by the product's existing
admission checks, not by the claim.

**Concrete resolution options.**

- _Product path, needs approval:_ ship the mod and the gate as two plugins and
  order them with the documented manifest `dependencies` ("a mod runs before
  the mods it lists"). The `--plugin-dir` order used here is observed but not
  documented. Ordering of installed plugins through `dependencies` was not
  exercised.
- _Host request:_ a per-submission predicate or cancel for `$.prompt.submit`,
  for example `submit({ text, signal })` plus a dequeue-time hook in the
  submitting mod, would remove the second plugin.

## Native results

Environment for all cases:

- Linux x86_64, native install, claude.ai personal account without organization
  policy;
- dedicated `CLAUDE_CONFIG_DIR`;
- isolated source fixture node with loopback, ephemeral ports and no peers;
- Node.js 26.9.0;
- Mods enabled by default: no `--safe-mode`, `disableAllHooks` or managed
  allow-only settings;
- plugins loaded with `--plugin-dir` in the order mod, gate, observer;
- no development channel unless stated.

The vendor's native auto-updater moved the client from 2.1.318 to 2.1.319 at
14:47:31Z, during N1. N1 ran on 2.1.318, every later case on 2.1.319. This was
not initiated by the research.

Sessions are aliased:

- `SESSION-B` is `rr-Борис` in `folder-ab`;
- `SESSION-A` is `rr-Анна` in `folder-ab`;
- `SESSION-C` is `rr-Вера` in `folder-c`.

Per-case node journal, aliased session ids, claim/epoch/incarnation prefixes,
native turn origin, `agent_read` tool-use correlation and returned IDs are in
`evidence/native-campaign-r2.json`. From L2 onwards, owner prompts, Esc,
`/clear` and drafts were typed with `tmux send-keys` into the isolated session.
Folder trust, permission approvals and question answers were given by the owner.

| #   | Required case                                                                                               | Status                               | Revision                                                        | Evidence summary                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Mod-only already-pending exact resume, corrected revision                                                   | PASS                                 | dbb3311 (2.1.318); also 0dada12 and 8df6ea9 with gate (2.1.319) | N1: claim consumed, plugin-origin turn, `agent_read` returned both pending IDs. No receiver input, no second arrival, no channel. Repeated with the gate in reload1, reload2, L5, L3 and ISO (`gate:started`).                                                                                                                                                                                                                                    |
| 2   | Exact isolation A/B/C, same folder does not select                                                          | PASS                                 | 8df6ea9                                                         | ISO: 52 probes for A only. A, B and C were live together. Only A woke. B (same folder) and C ended with `deadline:none-pending` and have 0 transcript rows.                                                                                                                                                                                                                                                                                       |
| 2a  | Helper ambiguity                                                                                            | PASS (native incidental + synthetic) | dbb3311                                                         | N3 attempt 1 (operator error): two live processes for SESSION-B gave `deadline:no-route` and no wake; the message stayed intact. Synthetic ambiguity test passes.                                                                                                                                                                                                                                                                                 |
| 2b  | Stale ownership                                                                                             | PASS                                 | 8df6ea9                                                         | L6: the old binding is kept after `/clear`, with no move to the new session. L8: after the transfer the stale SESSION-B read is refused ("This connection belongs to another Claude Code chat").                                                                                                                                                                                                                                                  |
| 3   | Busy work and a second arrival                                                                              | PASS, with an extra turn identified  | 42f69b7, 8df6ea9                                                | N3-retry: the notice was queued behind a busy channel turn; the synthetic second arrival came during the turn. The channel turn read both IDs, a channel `queued_command` caused one extra empty read, and the queued mod notice was dropped at dequeue with `backlog-read`, so no mod turn ran. L1: an arrival after consumption joined the notice's single read (3 IDs). L2/L3: the notice was queued behind owner turns without changing them. |
| 4   | Draft                                                                                                       | PASS                                 | 8df6ea9                                                         | L5: the notice started with the draft `DRAFT 漢字 keep me exactly` present and left it byte-identical. Plugin-attributed.                                                                                                                                                                                                                                                                                                                         |
| 5   | Pending permission and question dialogs                                                                     | PASS                                 | 8df6ea9                                                         | L3: the notice was queued at the `AskUserQuestion` ask and stayed queued for 76 s through the question and a Bash permission dialog. Both dialogs were answered by the owner. The notice ran only after `turn.complete`.                                                                                                                                                                                                                          |
| 6   | Stop/Esc; refused or dropped submission                                                                     | PASS                                 | 8df6ea9                                                         | L2: the queued notice was dropped by Esc with `removed from the queue`, the turn ended `isAborted`, there was no gate run and no retry. The message stayed `ready`. A later explicit owner read returned exactly that ID. Refused-call reason (`session was stopped`) was not separately produced natively; it is covered by the kit test.                                                                                                        |
| 7   | Session end and in-process `/clear` while pending                                                           | PASS                                 | 8df6ea9                                                         | L6: query held, `/clear` gave `session.end clear`, the snapshot found `no-route` and the mod reported `fenced`. Nothing was sent to new session `c4e854a7`, there was no nickname transfer, and the message waited. The supported fresh lifecycle is exit plus `claude --resume <exact id>`: L3 woke the L6 message that way.                                                                                                                     |
| 7a  | In-process `/resume` and `/branch`                                                                          | NOT_RUN (native)                     | —                                                               | Same `session.end` path (`reason: resume`). Covered by kit tests of `session.end` at each await. Budget was prioritised for the dialog, Stop and isolation cases.                                                                                                                                                                                                                                                                                 |
| 7b  | Session end while a query is pending                                                                        | PASS                                 | 0dada12                                                         | N3b attempts 1–3: the client abandoned the held query at the documented 30 s `$.http.fetch` limit, the mod reported `query-failed`, and nothing was submitted. Kit tests cover end at each step.                                                                                                                                                                                                                                                  |
| 8   | Approved binding transfer at the claim / queued-submit boundary                                             | PASS                                 | 8df6ea9                                                         | L8: the transfer came after consumption and before dequeue, and the gate dropped the notice with `revoked:binding`. No turn, message `ready`, stale read refused.                                                                                                                                                                                                                                                                                 |
| 8a  | Helper replacement and node restart at the boundaries                                                       | PASS (synthetic); NOT_RUN (native)   | —                                                               | `claims.test.ts`: a new helper epoch gives `revoked:helper`, `SessionEnd` gives `revoked:helper` at start, a restarted node gives `unknown`. No supported way to replace only the helper of a live native session was used; the node was restarted only between runs.                                                                                                                                                                             |
| 8b  | Replay and concurrent claims                                                                                | PASS (synthetic)                     | —                                                               | Exactly one consumer and one starter win; replays return `replayed`; foreign sessions cannot spend or probe a claim.                                                                                                                                                                                                                                                                                                                              |
| 9   | Pending before subscription, arrival during subscribe/snapshot, later arrival, multiple pending, pagination | PASS                                 | 8df6ea9                                                         | Pending before: N1, ISO. Arrival before a held snapshot: N3-retry (synthetic arrival in the claim's backlog) and the synthetic test. Later arrival: L1 (joined the read), synthetic (no new answer, no self-loop; one query per load observed natively). Pagination: ISO with read 1 = 50 IDs (`hasMore`, `nextCursor 144`) and read 2 (`after 144`) = 2 IDs, all 52 in node order, none duplicated.                                              |

Attempts that exercised nothing are kept as evidence, not counted as passes:

- N3 attempt 1 (operator error);
- N3 attempt 2 (owner input too late);
- N3b attempts 1–3 (30 s fetch limit; the positional prompt with `--resume` did
  not start a turn);
- reload 1 and 2 (a marker file or an mtime-only touch does not reload a module);
- the L1 launch wake, which failed closed because of the fixture re-entrancy bug,
  later fixed.

Budget: set before the runs at 20 launches and 80 probes. After the barrier
redesigns it was raised once to 22 launches, with the reason recorded. Used:
20 launches, 70 probes (67 fixture-sender probes and 3 synthetic second arrivals).

### Native timing facts

| Fact                                    | Value                                                                                                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt.submit` for a queued mod notice | fires at dequeue: 8.3 s after submit in N3-retry, 76 s in L3; 47 ms after `turn.complete`                                                                                        |
| Gate start check to `turn.start`        | 18–64 ms (L1, L3, L5, ISO)                                                                                                                                                       |
| Channel registration race, F11 pattern  | offer written 47 ms before `Channel notifications registered` in N3 attempt 2; no channel turn. This adds to FB2 (14 ms). Supports the race hypothesis; not a frame-level trace. |
| Dropped notice display                  | `Prompt dropped by a hook: <reason>`; input box left empty (N3-retry, L8). A drop while a draft is present was not tested.                                                       |

## Duplicates

- **Mod plus channel.** In N3-retry the mod's duplicate was suppressed only
  because the node recorded every captured ID as `processed`, after the
  channel turn's `agent_read`. It was not suppressed because a claim was
  consumed or a turn reported started.
- **Channel's own duplicate.** A second notification arrived as a
  `queued_command` and caused one empty read. This is BASE product behaviour and
  is unchanged.
- **No suppression of Channels offers.** Suppressing them would need a product
  change and was not attempted.
- **Arrivals after the claim.** A notice dropped as `backlog-read` does not
  announce messages that arrived after its claim. Live arrivals remain the
  Channels path's job, as in BASE.

## Receipt limits

Separate facts in this campaign:

- the node's `processed/admitted` state;
- answer, claim, gate verdict and `turn-started` reports;
- native `tool_result` rows with returned IDs.

The first two are not independent receipt proofs. The transcript `tool_result`
rows are the client-side witness of the content handed to the model for these
runs. They show nothing about model understanding or task completion. No host
witness experiment was added, because the transcript correlation already
supplies session, `tool_use` and returned-ID correlation. The internal-read
receipt gap remains a separate local task.

## Verification

See `VERIFICATION.md` in the archive. Targeted results at HEAD:

- research endpoint and claim tests 13/13;
- mod kit 9/9;
- gate kit 2/2;
- `claude plugin validate` passes for all three plugins;
- research typecheck clean;
- `npm run check` clean on a pristine checkout.

The previously reported `npm test` result of 383/386 is **not** an overall PASS.
It has three failures: two pairing tests and the BASE cold-backlog test
(`AbortError`, 2 of 3 isolated passes). Product code is unchanged, so the full
suite was not repeated.

## Limits

- Linux terminal only, one account, Claude Code 2.1.318 and 2.1.319.
- Not run: macOS, Windows, Desktop, VS Code, organization policy, WSL.
  Terminal results do not cover those frontends.
- The source fixture node was used, not an installed package.
- Plugin order relied on `--plugin-dir` order. `dependencies` ordering of
  installed plugins is unverified.
- The 30 s `$.http.fetch` limit bounds the single query, so the node deadline
  must stay below it (25 s here).
- Native busy, dialog and Stop cases used event-released barriers. Every race
  used deterministic barriers; none used sleeps for correctness.

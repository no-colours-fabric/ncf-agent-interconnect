# Local corrective audit of Claude candidate d329e99

Base: `d329e9958e6464887995f16928fd3b92f7216fd5`.
Corrective branch: `codex/claude-candidate-diagnostics`.
This is a source/synthetic correction and diagnostic handoff. The original
candidate's Linux native evidence is historical evidence, not a native run of
these changes. No local Claude subscription, vendor process or real profile
was used. Main and the separate inactive receipt foundation were preserved.

An independent subagent audit looked for counterevidence before changes. The
following findings were confirmed rather than accepted solely from the earlier
review. Deterministic baseline counterexamples were exercised for cancellation,
core fences, initial bootstrap and Unicode decoding.

| Finding | Disposition and correction                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Evidence                                                                                                                                                                        |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1      | Status promotion from a gate start was unjustified and removed. A separate source bootstrap defect was reproduced: a private lease lock during initial helper construction permanently poisoned the helper. Fresh helpers now wait for that already-running writer through filesystem events, then pin their first valid lease. Corruption, deadline and later incarnation changes still deny. The native K5 cause is **not established**, so native first-resume acceptance stays open. | `claude-code-bootstrap-lock.test.ts`: 4 cases; `claude-code-wake.test.ts`: gate-start remains unverified.                                                                       |
| C2      | Real SDK cancellation discarded a read response, but reusing its ID committed an unrelated frame. The regression failed on the original code. The bridge now captures the SDK abort lifecycle, checks the exact result digest after SDK validation, cleans unwritten attempts, and never commits an unrelated/error frame.                                                                                                                                                               | `claude-code-bridge-delivery.test.ts`: actual SDK cancellation and request-ID reuse.                                                                                            |
| C3      | The writer and commit lacked final captured authority. Writer validation now checks current call/native and the exact node-owned attempt; commit revalidates captured binding, mailbox and native request scope. Revocation during a possible write yields uncertainty.                                                                                                                                                                                                                  | Bridge regressions: revoke before writer has zero content frames; revoke during completion leaves uncertain; exact happy path commits. Core final-validation and receipt cases. |
| C4      | New Claude reservation accepted earlier dispatching/uncertain content. Both states are now refused without overwriting the prior dispatch outcome.                                                                                                                                                                                                                                                                                                                                       | `claude-code-core-guards.test.ts`: original missing rejection, corrected rejection.                                                                                             |
| C5      | Reverse attachment/materialization and final adapter-admission fences were missing. Rechecked after materialization, before adapter admission and through its `isCurrent` callback; a fence failure does not overwrite the protected outcome.                                                                                                                                                                                                                                            | Core reverse-attachment barrier and final adapter callback tests.                                                                                                               |
| C6      | Per-chunk UTF-8 decoding corrupted 20 of 46 byte splits in a Unicode notice. A bounded streaming decoder now preserves exact text/hash and rejects malformed/truncated frames.                                                                                                                                                                                                                                                                                                           | `claude-code-stream-decoder.test.ts`: every byte split, byte-at-a-time, hash and invalid/oversized/truncated inputs.                                                            |
| C7      | Same-helper transport replacement bypassed the old disconnect callback. Retirement now captures the old epoch before replacement and marks only its issued attempts uncertain.                                                                                                                                                                                                                                                                                                           | Core same-helper replacement with an outstanding attempt.                                                                                                                       |
| C8      | Filtering fences before pagination presented an uncertain inbox as empty. Unread paths now return an explicit blocked error for a fenced selected page. History retains contentless placeholders and owner UI history remains available.                                                                                                                                                                                                                                                 | Core all-fenced read; updated receipt assertions and unchanged ordinary MCP status/receipt checks.                                                                              |

## Verification and reuse

New core baseline regressions initially failed 0/4 against the original product
code, then passed 4/4 after corrections. Expanded core guards passed 6/6;
affected existing receipt tests passed 7/7. New bridge tests passed 4/4, and
five affected existing helper authority tests passed 5/5. Bootstrap tests
passed 4/4; Unicode decoder tests passed 2/2. Diagnostic privacy and redirected
file tests passed 2/2, including after log hardening.

The final root check of proof, wake, status and diagnostic files passed 21/21.
This includes unchanged native-lease revocation and ordering checks and the
updated no-promotion assertion. These are scoped results with overlapping
cases, not a claimed single full-suite count. Earlier successful source checks
were reused for unchanged areas. Typecheck, scoped formatting, `git diff
--check` and `npm run build` passed. The build reports the existing large-renderer
chunk warning. The full suite, native package builds and live Claude tests were
not repeated. The prior 396/399 full-suite result remains non-PASS with its
reported baseline failures.

## Deliberate limits

The last node authorization check and the subsequent operating-system pipe
write cannot be made an atomic cross-process action by another HTTP request.
Revocation may race a write that already began. The correction preserves
uncertainty and does not claim that such content was never sent. A valid write
that cannot be confirmed before authority expires may also remain uncertain;
it is not silently replayed or force-released. Full-frame local handoff does
not prove native persistence, model observation or task completion.

Diagnostic logs are bounded and metadata-only. Read
[build instructions and three manual cases](claude-code-diagnostic-testing.md)
before native testing. Native K5 reproduction, actual plugin behavior on the
corrective build, packaged macOS/Linux behavior and user observations remain
for manual validation. No release publication is authorized by this branch.

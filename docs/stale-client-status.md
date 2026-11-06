# Client connection status: released, unconfirmed and last verified

LLM-optimized documentation: [llms.txt](../llms.txt).

This document explains the honest status model for application connections in
the Clients view. The core rule: each status states exactly what is confirmed and
never invents a root cause, a closed chat or a completed task.

## Distinct concepts

- **Route eligibility** (`AdapterState.capabilities.wakeIdle/exactSession`) is the
  operational flag used by service delivery. A successful exact-owner check can
  establish it, and a current exchange failure can revoke it. It is never derived
  from the age of a verification timestamp.
- **Transport error / timeout** means delivery to that exact chat is currently not
  confirmed. The cause is unknown; this is presented as `Connection not confirmed`,
  warning only if it affects a current binding, otherwise neutral.
- **Client release** (`AdapterState.released`, OpenCode only) means the client
  integration confirmed the connection ended. The binding and its history remain;
  automatic delivery is currently unavailable. A release does not mean the model
  finished or the chat was closed. It is not a technical failure.
- **Historical verification** (`AdapterState.lastOwnerVerifiedAt`, Codex only) is a
  runtime ISO timestamp recorded when an exact-owner probe confirmed
  `supportsUntrustedAppInput` before any external submission. It is an observation,
  not a receipt, and not proof of current liveness. Codex never derives a release,
  closure or task completion from thread existence, `notLoaded`, socket errors,
  missing owner/capability, PID or an old profile.

## Ordering policy

- `uncertain` is always above `released` and `last verified`. It stays a warning
  issue and never allows an automatic retry without checking the exact chat.
- For Codex summaries, `verifiedAll`/`verifiedSome` mean _previously verified_, not
  `Connected`. A Codex-ready row without any `lastOwnerVerifiedAt` is
  `Connection not confirmed`. The local verification time appears in the ordinary
  row and technical details. Current errors or missing capabilities take priority
  over the historical timestamp. OpenCode retains its existing presentation.
- Each actually started exchange, including delivery, receives a new revision.
  Coalesced `start()` calls share one exchange. Only the newest-started revision
  in the current lifecycle can publish verification metadata, shared health,
  capability changes or transport notifications. `stop()` invalidates the
  lifecycle before aborting work; obsolete results still reach their original
  callers, but cannot publish shared state or schedule recovery.
- Metadata/evidence updates never emit a separate transport `idle`/drain trigger;
  they reuse existing exchange/status notifications. Transport eligibility and the
  service delivery gate are unchanged.

## Invariants

- A successful later probe can restore transport readiness and refresh historical
  evidence. It does not turn a prior `uncertain` dispatch into admitted, issue a
  receipt or resubmit the input.
- A late result from an older probe or stopped adapter cannot overwrite a newer
  diagnostic or publish a fresh status. The original admission is always returned
  to its caller/store.
- No freshness timers, additional polling, or `wakeIdle=false` based on time. A
  queued message can still reach `deliver()`, whose exact-owner preflight is the
  allowed fresh check. The existing failure-recovery timer waits for a coalesced
  older probe to settle and rechecks the current lifecycle and failure state. It
  must neither lose the recovery attempt nor run after stop or replacement.
- Evidence is runtime only: it is not persisted to settings/DB and not published to
  peer directories.

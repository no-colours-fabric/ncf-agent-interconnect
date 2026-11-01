# Client connection status: released, unconfirmed and last verified

This document explains the honest status model for application connections in
the Clients view. The core rule: each status states exactly what is confirmed and
never invents a root cause, a closed chat or a completed task.

## Distinct concepts

- **Route eligibility** (`AdapterState.capabilities.wakeIdle/exactSession`) is the
  operational flag used by service delivery. It changes only on a real successful
  admission/delivery or on a confirmed failure. It is never derived from time.
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
  `Connection not confirmed`. OpenCode keeps its live automatic-delivery status.
- Metadata/evidence updates never emit a separate transport `idle`/drain trigger;
  they reuse existing exchange/status notifications. Transport eligibility and the
  service delivery gate are unchanged.

## Invariants

- A successful later probe updates only the evidence timestamp; it does not turn a
  prior `uncertain` dispatch into admitted, issue a receipt or resubmit the input.
- A late result from an older probe or stopped adapter cannot overwrite a newer
  diagnostic or publish a fresh status. The original admission is always returned
  to its caller/store.
- No TTL timers, network polling, or `wakeIdle=false` based on time. A queued
  message can still reach `deliver()`, whose exact-owner preflight is the allowed
  fresh check.
- Evidence is runtime only: it is not persisted to settings/DB and not published to
  peer directories.

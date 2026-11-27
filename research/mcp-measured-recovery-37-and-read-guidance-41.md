# Feedback 37 and 41: MCP recovery and automatic delivery guidance

27 November 2026. NCF Agent Interconnect 1.1.0. NCF is the abbreviation of No Colours Fabric.

Base `85c72c355c3e934fdf2c86bfabb87d918c163674`. Source and regression commit `e75a03675a3b2a4b8f8b4d8d9d5f80378a8ee316` on `codex/feedback-37-41-mcp`.

Prior evidence: [attachment lifecycle](attachment-lifecycle.md). Three additional QA records are local coordination artifacts. Their paths in the coordination checkout are:

- `research/feedback-37-loopback-agent-follow-up-2026-11-27.md`
- `research/mcp-qa37-offline-and-data-source-failures-2026-11-27.md`
- `research/feedback-37-independent-evidence-review-2026-11-27.md`

## Server cases

- `agent_history`: the first page produces a real positive cursor. A subsequent raw lookup temporarily hides a persisted row from the second page. The real handler returns `history_page_unavailable` with `resumeAfter` equal to the supplied cursor, no messages and no `nextCursor`. Incoming and outgoing rows stay ready. After visibility returns, reading from the same cursor returns the page and records receipt. A separate real store clear writes the exact message/direction tombstone and returns `message_cleared`. A different raw sequence under the same message ID returns `history_row_replaced` without receipt. The Claude helper path was separately exercised with a failure after reservation. The failed result has no receipt capability, and a later successful page records receipt only after the helper's completed-frame report.
- `attachment_stage`: a regular file obstructs the temporary attachment root before any per-slot create. The handler returns `attachment_stage_storage_unavailable`. No path or ledger row is issued. Removing the obstruction permits one successful retry with the same arguments and exactly one registered empty file. A failure in ledger registration after a second creation returns `attachment_stage_outcome_unverified`, no path and no retry action. Once per-slot creation has been issued, the implementation stays conservative about filesystem or registration errors.
- `connection_events`: a real transfer records an event. The second lookup, in the handler after its admission lookup, fails once. `connection_events_unavailable` has no events or new cursor. Reusing the prior cursor returns the original event. The successful call after its ID returns an explicit empty list. The old binding stays revoked.
- `agents_list` and `node_peers`: failures inside their data sources return `directory_unavailable` and `peer_list_unavailable` with read-only `node_status` and no pagination/address data from the failed result. Continuation uses a cursor from a successful page. Invalid and stale cursors retain the fresh-listing path. Listing failure or an offline status alone cannot establish that pairing is absent.
- `agent_read`: initialization instructions, catalog and `llms.txt` give precedence to working automatic delivery directly in the bound chat. Unavailable automatic delivery and MCP-only clients retain inbox reads, including a single event-driven wait, with polling prohibited. The server behavior of the tool is unchanged.

## Verification

macOS arm64, Node 22.12.0, SDK 1.32.2. The tests hit the real Streamable HTTP MCP server on loopback with disposable profiles and controlled dependencies. They do not measure model interpretation. Installed clients, native package builds and the full suite were outside this run. The existing HTTP handoff still aborts when its final release fence rejects a prepared response. The typed history guidance covers tool responses produced by the server handler. A transport loss has no guaranteed MCP result.

```sh
node --experimental-sqlite --import tsx --import ./test-desktop/network-test-isolation.ts \
  --test --test-concurrency=1 test-desktop/mcp-measured-recovery.test.ts
node --experimental-sqlite --import tsx --import ./test-desktop/network-test-isolation.ts \
  --test --test-concurrency=1 \
  --test-name-pattern='MCP history|held .* history|raw sequence differs|an armed MCP read|bundled stdio bridge|A Claude read records|explicit clear cancels read/materialize|event-fed|directory' \
  test-desktop/{compact-replies,delivery-reservation,agent-clear,automatic-delivery,aionui-bridge,claude-code-receipt,presence}.test.ts
npm run typecheck
./node_modules/.bin/prettier --check desktop/core/{attachment-provenance,mcp-agent-guidance,mcp-http,service}.ts \
  test-desktop/{mcp-measured-recovery,compact-replies,claude-code-receipt}.test.ts \
  research/mcp-measured-recovery-37-and-read-guidance-41.md
git diff --check
```

The main test file passed six cases. The selected existing-file run passed seventeen cases, including the new Claude case. Both processes exited 0 with zero failures or skips. Type checking, scoped formatting and whitespace checks passed. Raw TAP: `/private/tmp/ncf-37-41-measured-final.tap` and `/private/tmp/ncf-37-41-guards.tap`.

## Directory follow-up

Source and regression commit `edceabd07918b4d154d15317efc2aeccce3277c2`. A confirmed invalid or stale cursor returns `nextAction: agents_list` with the same filters and no cursor. A rejected node UUID returns `nextAction: node_peers` and requires the exact intended UUID from a successful listing. An unverified source failure still returns `nextAction: node_status`.

The follow-up passed three isolated Streamable HTTP tests, including cursor recovery both with and without a selected node, recovery from a rejected UUID and failure of either list source. Type, scoped format and diff checks passed. Raw TAP: `/private/tmp/ncf-37-41-directory-followup-final.tap`.

```sh
node --experimental-sqlite --import tsx --import ./test-desktop/network-test-isolation.ts   --test --test-concurrency=1   --test-name-pattern='MCP directory and peer source failures|MCP agents_list'   test-desktop/mcp-measured-recovery.test.ts
npm run typecheck
./node_modules/.bin/prettier --check desktop/core/mcp-agent-guidance.ts   test-desktop/mcp-measured-recovery.test.ts
git diff --check
```

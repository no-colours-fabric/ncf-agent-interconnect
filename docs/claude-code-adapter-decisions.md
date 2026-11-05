# Claude Code adapter: decision log

Decisions taken while implementing the interactive Claude Code adapter.
Vendor facts cite the Claude Code documentation as read on 2026-11-03. The
local reference binary is Claude Code 2.1.309; it is used only for
`claude plugin validate` in an isolated home, never for a live session.

## D1. Delivery: Channels wake, then `agent_read`

The channel notification carries no message body, sender text or attachment.
It says that messages are waiting for the named agent and that Claude should
call `agent_read` and continue while `hasMore` is true. Receipt is recorded only
by the existing `NodeService.read` → `AgentStore.recordDelivery` path.
Permission relay (`claude/channel/permission`) is not declared.

Source: response §2; channels reference: "Claude Code doesn't acknowledge
notifications".

## D2. Protocol revision

The SDK stays pinned at 1.32.2. Its latest supported revision is `2025-11-25`.
On the v2 runtime, Claude Code registers a channel only for a server that does
not negotiate `2026-07-28`, so the helper relies on the SDK's own negotiation.
`MCP_PROTOCOL_NEGOTIATION` is never set. A regression test pins this.

## D3. Session identity evidence

Claude Code exposes the session identity only through trusted sources:

- **E1.** `CLAUDE_CODE_SESSION_ID` in the helper environment. Claude Code sets
  it for stdio MCP subprocesses at spawn, and the helper keeps the spawn value.
  It may hold the startup ID after `--continue` or after `--resume` without an
  ID.
- **E2.** Command hooks of the installed plugin. They post their stdin payload
  to the node with the app-owned `node.json` credential:
  - `SessionStart` for every source (no matcher);
  - `SessionEnd`;
  - `PreToolUse` for this plugin's MCP tools.
- **E3.** `mcp_tool` hooks for `SessionStart` and `SessionEnd`. They call the
  helper's session-event tool over the exact stdio transport. Claude Code skips
  them at launch, so they cover `/clear`, compaction and in-process switches.

A helper is the route of session S only after one of these proofs:

- **P1 (launch / reconnect).** The E1 value equals S, and the node has an
  active S from E2: a SessionStart was seen and no SessionEnd since. No other
  live helper may claim S. The active-session list is persisted with the route proofs,
  so a helper reconnected after a node restart, for example through `/mcp`
  Reconnect, proves its chat without a new hook.
- **P2 (switch).** E3 reports S on the helper's transport, and E2 has a
  matching unconsumed SessionStart for S.
- **P3 (tool call).** See D4.
- **P4 (node restart, helper alive).** The helper reconnects with its
  in-memory secret and its session generation. The node holds a persisted proof
  for the same helper, secret hash, session and generation.

Any session change seen by the helper (E3) or the node (E2 SessionEnd)
immediately removes the old route before a new one is admitted. Two live
helpers that claim the same session make that session ambiguous, and no wake is
sent. Workspace, title, PID, transcript and model-supplied IDs are never used.

## D4. PreToolUse correlation by exact input instead of injected token

**This deviates from response §3,** which asks PreToolUse to inject a node-issued
`contextToken`. According to the hooks reference, `updatedInput` is combined with
`permissionDecision` `allow` or `ask`:

- `allow` would let the hook approve every NCF call;
- `ask` would prompt on every call, including `agent_read`;
- behaviour without a decision is undocumented.

Approved by the owner on 2026-11-03: the hook never changes input or
permissions. It posts `session_id`, `tool_name` and a canonical SHA-256 of
`tool_input` to the node, which stores a one-use record with a short lifetime.

Before forwarding a call, the helper presents its own canonical hash of the
received arguments. A unique match proves that this transport carries this
session (P3). The record is consumed and checked against the helper that made
the call.

The node refuses a call when:

- no record matches;
- more than one matches;
- the record names a different session than a connectionId bound to another
  Claude chat.

A model-supplied `contextToken` is removed by the helper. For `agent_connect`,
the node issues an ordinary one-use `ClientContexts` ticket to the helper after
P3, so the model never sees it.

## D5. Ledger

- `offered` is a persisted dispatch state with an offer epoch, the identifier
  of the helper stream lifecycle.
- A wake-only adapter's in-flight state is `offering`. On restart it becomes a
  stale `offered`, never `uncertain`, because no content was transmitted.
- Redispatch skips a current offer. It re-offers after a proven lifecycle
  change, or after a read that leaves ready messages behind. This is event
  driven and uses no timer.
- Clearing history still treats any dispatch row as possible admission
  evidence. This is conservative and unchanged.

## D6. Coalescing

A wake covers the messages already queued for the binding when it was sent,
for example a backlog after a restart or transport loss. A message that
arrives later gets its own wake. `agent_read` clears the outstanding wake
before it queries the inbox, and a read that leaves ready messages triggers
one new wake.

On-site run ncfcc-20261105-r1 (T05) showed why later arrivals must not be
coalesced. A model saw an event but did not read, and every later message
was then folded into that ignored wake, so the idle chat was never woken
again.

## D7. Automatic status

`delivery: automatic` is reported only after a wake in the current Claude
process was followed by `agent_read` from the same proven session. Until then
the adapter is `checking`: the route is proven, but channel registration is
unconfirmed. Without the development-channels flag, wakes are dropped
silently. Messages stay queued and no receipt is written.

## D8. Setup

The Claude Code user `settings.json` (`$CLAUDE_CONFIG_DIR/settings.json` or
`~/.claude/settings.json`) is the one selected file. `~/.claude.json` is never
edited. Apply adds:

- `extraKnownMarketplaces["ncf-agent-interconnect"]`, a `directory` source
  pointing at the published marketplace;
- `enabledPlugins["ncf-agent-interconnect@ncf-agent-interconnect"] = true`;
- `permissions.allow`, gaining exactly
  `mcp__plugin_ncf-agent-interconnect_ncf__agent_read`.

The plugin name avoids the reserved `claude-` prefix. The qualified tool name
follows the documented form and stays marked unverified until a loaded plugin
confirms it. One file is enough, so the setup target schema is not extended.

## D9. Runtime launch

- **MCP server.** The plugin runs `process.execPath` with the bundled helper
  and `env.ELECTRON_RUN_AS_NODE=1`.
- **Hooks on macOS and Linux.** Hooks have no `env` field, so they use exec
  form `/usr/bin/env ELECTRON_RUN_AS_NODE=1 <execPath> <hook.js> …`, with no
  shell.
- **Hooks on Windows.** They use `shell: "powershell"` with single-quoted
  literals: quotes are doubled, and no user value is interpolated.

All paths come from the installed app at publish time.

## D10. Out of scope

The following are not part of this delivery:

- socket cross-session messaging;
- monitors;
- `asyncRewake`;
- a terminal-input or SDK fallback;
- permission relay;
- changes to the version or release configuration.

# Claude Code adapter: decision log

Decisions taken while implementing the interactive Claude Code adapter.
The local P1 correction updates the native-authority and call-proof decisions
on 2026-11-05. Earlier on-site observations belong to the submitted candidate;
they do not establish acceptance of the corrected source. Delivery/recovery
findings R3–R7 remain a separate review stage.

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

## D3. Native authority after the local P1 correction

The original hash-correlation and public session-event design was rejected by
source review. This section describes the local first-stage correction, not a
claim of native client acceptance.

- The helper keeps the host-provided `CLAUDE_CODE_SESSION_ID` fixed at spawn.
  Workspace, title, PID, transcript, model identifiers and undocumented MCP
  metadata do not choose a chat.
- Installed command hooks persist a private native lease beside the app-owned
  node descriptor before attempting HTTP. A lease has a session, incarnation
  nonce and active/revoked state. Missing, corrupt or conflicting evidence
  cannot produce a positive route.
- A helper pins its native incarnation. It does not adopt a new nonce when it
  reconnects. The node checks the current durable lease at attachment, wake and
  call validation; persisted helper routes do not override revocation.
- `SessionEnd` for the old session is the exact fencing signal. A new
  `SessionStart` with a different UUID is not evidence about an old helper.
  Successful local revocation remains effective if its HTTP notification fails.
- There is no model-visible lifecycle authority: `session_event` cannot start,
  end or replace a route, and it is no longer a generated MCP-tool hook.

The current payload does not document a trusted correspondence between a
surviving old helper and an arbitrary new in-process session. Therefore a
`/clear` or in-process `/resume` does not retarget that helper or move the agent
name. A fresh helper through the owner's normal client lifecycle is required.
This is an explicit functional limitation of stage one, not completed recovery
acceptance. A missing old-session signal cannot be repaired by guessing from a
new session ID. Simultaneous hook persistence/communication failure is not
claimed as a proven offline-clear path.

## D4. One-use proof injected without a permission decision

The previous decision that hash equality could establish transport identity is
superseded. Hashes now check argument integrity only and never change
`proven` or `claim`.

The command `PreToolUse` hook reads the session only from its host payload. The
node issues an opaque one-use proof only for a unique already-native-proven
helper. It binds the native session, helper identity, transport epoch,
generation, native lease nonce, tool, original argument hash and short lifetime.
The hook returns the complete original arguments plus this proof through
`hookSpecificOutput.updatedInput`. Any model-provided proof is overwritten.

No `permissionDecision`, `allow`, `ask` or permission bypass is added. The
helper presents the proof for node validation, removes it from ordinary tool
arguments and forwards only a verified request. For connect, the subsequent
node context ticket retains the same lease: validation repeats after async
adapter setup and immediately before the ticket is consumed into a binding.
Missing, foreign, expired, replayed or old-incarnation proofs fail before route
mutation, context-ticket issuance or forwarding.

### Current-call authority across asynchronous work

Preflight also issues a private current-call permit for every forwarded tool.
The bridge revalidates the captured helper, epoch, session, generation, native
incarnation and unique route after MCP connection/setup and before releasing a
result. Checking only a still-active native nonce is insufficient: the node may
have replaced the helper while that nonce remains unchanged.

The bridge overwrites only its own private metadata capability. At the node,
admission hashes the actual raw tool arguments before Zod defaults and reserves
the permit once for the real server MCP-session key and JSON-RPC request ID.
The callback synchronously checks that same request scope and full authority
immediately before invoking its handler and after its awaited result. Neither
identity comes from client metadata. Init, list and ping retain their original
paths; other adapters do not use this private admission boundary.

Validation before sending/returning does not consume admission again. A route
replacement or ambiguity invalidates the affected permit; it cannot revive
when the route becomes unique again. Admission is the authorization
linearization point. Already admitted effects are not undone or replayed if
authority is later lost: content is withheld and the outcome is reported as
unconfirmed. This does not change receipt or ledger semantics.

Official contract checked on 2026-11-05:
[PreToolUse decision control](https://code.claude.com/docs/en/hooks#pretooluse-decision-control)
documents updated input without a permission decision and replacement of the
whole input. [UpdatedInput in auto mode](https://code.claude.com/docs/en/hooks#pretooluse-updatedinput-in-auto-mode)
warns that auto mode can reject rewritten calls and can drop a later rewrite
on an exact retry. Auto-mode compatibility is **NOT_TESTED**; the correction
must not introduce `allow` to work around it. No native Claude process is used
by the first-stage source regressions.

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

## D6a. Renewal after a finished turn

The plugin also has an observation-only `Stop` command hook. When a turn of a
proven session ends and a message of that session is still offered in the
current helper lifecycle, the node announces it once more. Each message is
renewed at most once per lifecycle, so a model that keeps deferring cannot
cause a loop. The hook forwards only the event and session ID, never the
assistant text, prints nothing and never blocks the stop.

On-site run ncfcc-20261105-r1 (T05, T06) showed that a model can see a
channel event during a turn and defer it until the owner asks. Without a
later event the message then stays unread. A timer is forbidden; the end of
the turn is the documented host event that makes a renewal safe.

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

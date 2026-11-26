# MCP chat actions and recovery guidance (feedback 36 and 37)

## Scope and starting point

Base `054f7dbb84b7799838ae16ee972d689815994f12`, NCF Agent Interconnect
`1.1.0-alpha-9-20261126T192806`. NCF abbreviates the No Colours Fabric brand.
The goal is to make chat commands discoverable after ChatGPT reconnects and
give agents a concrete next action when an MCP result is incomplete or refused.
This follows the existing recovery boundary in
[ChatGPT connection recovery](chatgpt-agent-connect-native-recovery-15.md).

The reported failure was a rename refusal in the same Codex chat after a
restart. Calling `agent_connect` there with the current name and its saved
connection ID restored the session. A subsequent `agent_rename` applied the new
name. In source, `createAgentMcp` holds the Codex connection evidence in a
session-local set. On another MCP session the ID may still own a stored binding
and the native thread metadata may still match while the set is empty. That
condition previously produced the same refusal as an unverified chat.

## Contract and rejected approaches

- Publish the direct-human action rules in MCP initialize instructions and in
  the descriptions of `agent_connect`, `agent_rename` and `agent_disconnect`.
  Initialize alone leaves a gap for clients that present only the tool catalog.
- Keep rename authorization unchanged. An exact Codex binding with consistent
  native metadata but no current MCP session evidence receives
  `codex_rename_reconnect_required`. Its recovery is connect with the current
  name and existing ID, then rename with the new name after `connected`.
  Missing or conflicting thread metadata, another chat and an invalid binding
  do not receive that recovery. A directory row cannot supply the proof.
- Keep results additive where guidance is needed and preserve the existing
  read/history pages and native handoff. MCP conflict offers keep the caller's
  transfer choices and private offer tokens. The other chat's `currentOwner`
  metadata is omitted at the MCP boundary. There is no consumer of that field in
  the in-repository MCP integrations.
- Repeating an operation automatically would make an unknown outcome appear to
  be a known failure. The recovery guidance instead checks history, existing
  state, setup or human approval as appropriate. Unknown internal exceptions
  use a bounded explanation without echoing native text, paths or foreign IDs.
  The SDK still rejects invalid input against the existing tool schemas.

## Inventory

| Tool                  | Condition and next step                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node_status`         | Inspect local readiness. For OpenCode v2 `instance-route-required`, use the configured instance route or ask the owner to verify setup. Status alone cannot verify chat ownership.                                                                |
| `node_peers`          | Use the explicit local or paired node ID. A missing peer requires owner pairing or repair.                                                                                                                                                        |
| `agents_list`         | Follow `nextCursor` with the same filters. Restart without a cursor after a stale page. A missing row in an incomplete directory does not establish absence.                                                                                      |
| `agent_connect`       | Use the human-selected name and this chat's saved ID if known. Follow a specific recovery result. A live confirmation must arrive in the exact chat before its deadline. Transfer and reset require the chosen offer token and explicit approval. |
| `agent_rename`        | Use the current ID and the human's requested name. In a verified Codex chat requiring session recovery, connect with the old name first. An unchanged result is already complete. A conflict preserves the name.                                  |
| `agent_disconnect`    | Use this chat's current ID. If that exact ID is already inactive, report it. An unknown outcome calls for checking the binding, since connecting can create a binding.                                                                            |
| `agent_read`          | One event-driven read when appropriate. Let a pending read finish. Withheld content stays with the existing attempt.                                                                                                                              |
| `agent_history`       | Paginate using `nextCursor` as `after`. Use the outgoing ID to check a send whose outcome is unknown.                                                                                                                                             |
| `agent_send`          | Resolve the exact incoming reply route or explicit destination. Accepted messages stay with their existing queue and ID. When the outcome is unknown, check outgoing history before repeating.                                                    |
| `attachment_stage`    | Use a basename with extension. Write into the returned slot before sending its path. An unknown result does not justify guessing a path or creating repeated slots.                                                                               |
| `attachment_receive`  | Use the exact envelope and attachment IDs with this chat's connection. If no verified copy is available, check the original message before asking for a fresh file.                                                                               |
| `connection_events`   | Use the ID issued to this chat, even if revoked, and the last event ID as `after`. An `agent_moved` event ends use of the old connection.                                                                                                         |
| `agent_clear_history` | Require the owner-approved scope, current preview and its operation ID. Obtain fresh approval after a rejected preview. Ask the owner to verify the app state after an unknown outcome.                                                           |

## Verification

macOS arm64, Node `22.12.0`, MCP SDK `1.32.2`, TypeScript `7.0.2`. Tests use
temporary node profiles, loopback Streamable HTTP, isolated Codex IPC fixtures
and OpenCode fixtures. The Codex case closes the first MCP client, initializes
a new MCP session, inspects both guidance carriers and exercises tool calls for
an unbound chat and the persisted exact chat. It verifies rename recovery with
the original ID, unchanged binding, refusal on wrong/conflicting metadata,
conflicting and already-current names, and disconnect. The send case persists
one outgoing row, then injects a lost result and checks that history finds the
same ID and body. The error reply omits the injected private details.

Across the targeted runs, 11 distinct final-source cases passed. They cover
Codex recovery and exact transfer, MCP catalog and foreign binding redaction,
local routing, one saved uncertain send, attachments and receipt, clear/reset
confirmation, and OpenCode v1/v2 exact-session restrictions. Initial checks
caught loss of the text-only `agent_moved` marker and two test issues (SDK
return type and capitalization in a match). The marker is retained and the
affected cases passed after the corrections. TypeScript, scoped Prettier and
Git whitespace checks passed.

This establishes what the server exposes and how the instructed operations
behave across a fresh MCP session. The installed ChatGPT GUI, an application
Quit/relaunch, natural-language tool selection by a live model, packaging and
the full suite were outside these checks. Working profiles and the release
branch were untouched.

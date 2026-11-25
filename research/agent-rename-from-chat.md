# Rename from the bound chat

## Starting point

Base `f9d9cf0d3bef08f874db5e6177b4a2d61d356dd2` (1.1.0). The desktop Agents action already renames an agent by immutable storage key, incarnation and current nickname. See [agent rename identity](agent-rename-identity.md) for the mailbox, reply and delivery invariants. The goal was to reuse that action when the user requests a new name in the bound chat.

## Authorization

`agent_rename` receives this agent's current `connectionId` and the new nickname. It offers no recipient, former nickname or transfer operation. The node checks an active MCP invocation and resolves the current owner from the connection. It checks adapter authority before the synchronous store update. The existing transaction detects a normalized-name conflict before updating the current name.

| Client route                                 | Evidence required at the node                                                                                                                                                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ChatGPT / Codex                              | The MCP session completed a successful connect for this connection, current turn metadata names the same thread as the binding and saved Codex profile. Another session with the same metadata cannot rename until it reconnects through the existing route. |
| Cursor IDE                                   | The managed pre-tool hook obtains a one-use ticket for the exact MCP tool, bound conversation, current profile, connection and requested name.                                                                                                               |
| AionUi with Cursor Agent                     | The bundled bridge discards supplied context and verifies its runtime and exact paired conversation. The one-use ticket also binds the current profile, connection and requested name.                                                                       |
| OpenCode v1                                  | The NCF pre-tool hook verifies the session through the authenticated local bridge. The ticket is limited to the live saved profile, connection and requested name.                                                                                           |
| OpenCode v2                                  | The dedicated authorized endpoint verifies the target, generation, boot and native session. Current bridge identity must match the saved profile and binding at the write boundary.                                                                          |
| Claude Code                                  | The installed helper uses the existing one-use, argument-hashed, session- and request-bound call admission. The admitted native session must match both the binding and its saved profile.                                                                   |
| Standard MCP without integrated chat context | There is no reliable chat identity to compare with the binding. The desktop rename remains available.                                                                                                                                                        |

Reusing an `agent_connect` ticket for rename was rejected because it establishes a different operation. Reusing a nickname as the caller would have permitted another name to be selected. Using MCP liveness or a client name alone would not establish which chat made the call. Rename tickets are consumed on attempted use and fenced against replacement of their adapter profile.

The tool description requires a direct request from the human user in the bound chat. It forbids acting on an incoming agent message. The node enforces ownership of the target agent. These host APIs do not give the node proof of which message in the transcript motivated the model's call. Client permission policies apply independently.

## Setup and verification

Connect and Apply keep their permission rules. OpenCode v1/v2 and Claude Code do not automatically allow the new tool. Cursor's existing automatic-reply rule still covers only `agent_send`; the generated managed hook now also supplies exact chat context for `agent_rename`. On a profile with the previous Cursor hook, applying the current integration and reloading it loads the updated matcher. AionUi and Codex use their existing configured MCP routes. Use a one-time tool approval if requested by the host. Managed denials remain effective.

Focused macOS source checks used Node 22.12.0, isolated profiles, loopback MCP, the shipped bridge sources and injected host fixtures. They exercised the successful paths for six adapters, wrong sessions, a missing context, stale and reused proofs, argument substitution, Unicode name conflict, preserved binding and delivery, and the existing history, attachment and reverse-reply invariants. Connect and Apply fixture checks covered Cursor, AionUi, OpenCode v1/v2, Claude Code and Codex configuration.

One intermediate Cursor check replaced the fixture's worktree profile to validate a stale ticket, then left that replacement in place during the existing recovery check. Its repeated connect reinstalled the original profile and reset the adapter. The fixture now restores the original profile immediately after the stale-ticket assertion. The addressed test then passed with terminal exit 0. Across the selected segments 21 distinct named tests passed.

Native GUI permission prompts, installed package exchange, and packaging were outside this verification. No active client profile or permission list was changed.

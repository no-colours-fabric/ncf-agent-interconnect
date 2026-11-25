# Cursor native chat reactivity and restart recovery

Research dates: 2 and 5 November 2026. Environment: macOS, Cursor stable
3.27.22 and 3.28.7, Node.js 22.12.0. Native checks used disposable chats and
synthetic messages in a temporary workspace. An owner-approved signed-in
profile was used where the separate macOS profile could not start without a
default keychain. The research was separate from the shipped adapter.

## Problem and starting point

Determine whether an external event can reach the exact connected native chat
and start a response while another chat remains selected. Establish separately
what survives a window reload or full application restart. Success requires
observing the expected message or reply in the target transcript and checking
that a control chat remains untouched. A queued event, successful callback,
or returned hook response is insufficient evidence of native admission.

## MCP Apps depend on the mounted view

On 3.27.22 and again on 3.28.7, an MCP App could submit via `ui/message` to the
native IDE chat while its view was mounted. The host selected the chat using
its own `composerId`. A bounded 3.27.22 busy-turn test queued incoming content
and delivered it after the original 120-line response finished. On 3.28.7 the
mounted chat also responded with Finder in the foreground, distinguishing
application focus from chat-tab selection.

Selecting another chat disposed of the App controller and closed the WebSocket
even while the target tab remained open. The pending message arrived only after
returning to the target tab. Agents Window recognized the exact chat binding
but displayed the MCP tool result as text and did not mount the App. Delivery
there remained queued until the IDE card was reopened. An independent
background socket would keep the event available, but this experiment found no
way to submit it to that exact chat after the host removed the view.

Two integration details were observed. Synchronous layout-effect initialization
completed a handshake that passive initialization had missed in one run. A
binding resource also restored startup when the native result notification
omitted the expected `_meta`. Two callback timeouts still produced native
replies, so their outcomes were recorded as uncertain and were never replayed.
The installed 3.28.7 bundles contained Desktop Bridge submission commands, but
the tested profile did not expose the bridge. The study did not establish a
supported exact-native-chat submission route through the public extension API;
ACP's managed CLI sessions were a separate surface.

## Stop hooks can reach unselected chats

On 3.28.7, a project hook obtained the exact conversation identity in an
authorized disposable chat. After the response finished, a `stop` hook held an
authenticated loopback request to an isolated node. An incoming event released
the wait with `followup_message`. Cursor then submitted the follow-up to that
same chat, and the next response opened a new wait. The flow depended on a live
wait for the target chat and did not use scheduled polling.

Two open, unselected IDE chats and one independent Agents Window chat received
ten synthetic messages in total with one expected reply per message. One IDE
chat received seven messages, including a queued sequence, exercising the
configured continuation policy beyond the default five follow-ups. One event
arrived after 172,857 ms of waiting. An existing selected observer chat retained
selection and received no message. An empty Agents Window draft behaved
differently: the first delivery switched its view to the target chat.

An extracted, workspace-scoped plugin repeated the independent Agents Window
result. Native hook discovery worked only after adding `version: 1` to its hooks
schema. A long wait first disconnected after 300,955 ms due to the Node.js
`fetch` response-header deadline of 300,000 ms, shorter than the fixture's
630,000 ms cancellation deadline. Switching to Node.js HTTP with one explicit
cancellation deadline allowed delivery after 378,246 ms, followed by another
native wait. Those measurements bound the tested interval; they establish no
maximum Cursor wait or overnight reliability.

## Restart and recovery scenarios

| Scenario                                                              | Native observation                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Renderer/window reload with the research listener still running       | The plugin registered again. Returning a follow-up to the old wait produced no native message or reply.                                                                                                                                                                                                |
| Normal application quit and launch                                    | The original process exited and a new process restored the same chat and transcript. The stale wait again produced no native message or reply.                                                                                                                                                         |
| `workspaceOpen` after either restart                                  | The helper retrieved the exact saved binding from an isolated NCF SQLite store. Returning experimental `conversation_id`, `session_id`, and `followup_message` alongside `pluginPaths` did not start the chat. After the full restart, no native reply appeared during over 78 seconds of observation. |
| Select the restored target tab without sending a message              | No agent hook fired, no fresh wait appeared, and the queued event remained pending.                                                                                                                                                                                                                    |
| Send an ordinary reconnect message in the same chat and let it finish | A fresh `stop` wait accepted delivery. Hidden-chat delivery resumed in the IDE and Agents Window after restarting, with one matching reply per confirmed event. Uncertain attempts through stale waits were not replayed.                                                                              |

Saved identity and a still-open HTTP request did not establish that the native
conversation could accept a follow-up. A new turn rearmed the tested route.
The study did not exercise an extension-based tab-selection listener or
establish that such a listener could resume exact-chat delivery. See the
[current Cursor user guidance](../docs/mcp-clients.md) for the supported
recovery procedure.

## Verification limits

Transcript observations, isolated protocol checks, and inspection of installed
bundles support different conclusions. Background delivery was established for
open unselected chats with a fresh stop-hook wait. Delivery to closed chats,
minimized-window behavior, indefinite waits, Windows, and a production receipt
contract were outside this study. The fixtures did not test production history,
attachments, pairing, or name transfer.

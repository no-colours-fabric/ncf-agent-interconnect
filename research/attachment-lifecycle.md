# Attachment history, cleanup and transfers

## Issue #12 — Unavailable attachment in agent history

The release branch at `d21566c` reads each history page from the mailbox store before preparing its attachments. Both the standard MCP response and the Claude helper route aggregated attachment failures into a tool error. A missing blob made history, including its continuation cursor, inaccessible.

Two isolated MCP fixtures removed one synthetic blob from a page that also contained a verified attachment and a separate message without attachments. A third message followed on the next page. Both routes failed with `The verified attachment is unavailable` on the baseline. With the fix, history preserves both pages, their IDs, message text and order, and the exact original Unicode filename. The unavailable attachment has `status: "unavailable"` and no `localPath`. The available attachment retains its verified local path. The incoming presentation prints the unavailable name as plain text without a link.

The history path still runs its binding, reservation and response checks. Live `agent_read`, explicit file retrieval and native push still require full attachment preparation. The Claude fixture uses an authenticated synthetic helper and exercises the MCP route and delivery report; installed Claude Code was not run. See [Claude Code native integration](claude-code-native-integration.md) for prior helper verification.

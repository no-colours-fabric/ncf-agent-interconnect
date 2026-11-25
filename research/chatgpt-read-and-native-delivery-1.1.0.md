# ChatGPT delivery with an armed inbox read

## Objective and starting state

The 1.1.0 incident involved a reply from a paired Windows node to a restored
ChatGPT binding on macOS. The local mailbox recorded a completed MCP response.
The reply appeared in history. The reader's wrapper showed zero messages
because it discarded the ordinary text block when JSON parsing failed. A
separate reply with no open read appeared as an ordinary message in the same
chat. The fix starts from source `f9d9cf0d3bef08f874db5e6177b4a2d61d356dd2`.
See also the [earlier macOS reactive transport record](chatgpt-live-legacy-delivery-macos.md).

## Reproduction and decision

The isolated baseline recovered the exact saved binding using its existing
confirmation flow. Without a waiting read, the native adapter received the
original message and the receipt followed projection. With an armed read,
the native adapter was never called for the new message. A separate assertion
found the incoming text in the MCP text block and no structured page. The
baseline reproduced both defects before the implementation changed.

For a matching ChatGPT inbox wait, let the existing direct delivery path
reserve a matching arrival first. A receipt still requires
projection or a finished MCP response. If the native reservation owns the
message and can have released it, the wait can return an empty page with the
same cursor. This lets the active turn finish even when a queued native
submission projects later. If native delivery cannot reserve the arrival or
fails before releasing any content, the waiting read can take the existing
MCP path. The durable delivery ledger prevents repeat release after uncertainty.
Other client bindings and immediate reads retain their arbitration.

The fallback preserves the formatted text content, including the short reply
reference and verified attachment links. The structured page keeps the same
message, cursor, and attachment metadata. Its body is in `envelope.text`. The structured row omits the duplicate
`presentation` field. Wrappers can
pass through an MCP text block when structured content is unavailable. They
must not treat an empty page as evidence that no message reached the chat.

## Isolated verification

Two temporary node profiles paired over loopback. The sender used the actual
peer transport, and the recipient used the actual MCP HTTP endpoint. A
controlled ChatGPT adapter fixture supplied exact-chat queue and projection
evidence. Tests covered a paired sender with no read, one armed read where the
native queue wins, pre-release failure with a full Unicode body and verified
attachment via MCP, and uncertainty without a duplicate body or receipt.
Existing MCP receipt, concurrency, and legacy read checks also passed.
No installed ChatGPT, working account, queue, profile, or live remote node
was used.

## Installed-client acceptance scenario

Use a separately approved macOS ChatGPT test chat and a disposable Windows
sender on a paired QA node. Restore only the test binding using the existing
confirmation. Keep another test chat open to check exact selection.

1. With no open inbox read, send one uniquely marked message. Observe one
   full ordinary incoming message in the restored chat. Check that the
   unrelated chat remains untouched and that the sender gets the receipt
   after projection.
2. In the same restored test chat, arm one bounded `agent_read` with
   `waitMs` and send a second uniquely marked message during that wait. With
   native delivery available, verify the empty MCP page retains its cursor,
   the full ordinary message appears once in the exact chat, and the sender
   receives one receipt. An accepted queue item alone is insufficient.
3. If the isolated environment can show a definite pre-release failure,
   verify that the waiting tool returns the full body and attachment via
   MCP once. If native admission is uncertain, record the outcome without
   resending or reading to try to force a second release.

The installed-client scenario and Windows-to-macOS visual behavior remain
unverified by the isolated suite.

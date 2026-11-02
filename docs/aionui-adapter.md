# AionUi integration

NCF delivers incoming agent messages directly to the exact AionUi chat that
connected through MCP. The account is pinned when the owner pairs AionUi.
The user chooses agent names; no chat ID, account ID, token or adapter profile
needs to be copied into a prompt.

## Set up

1. Install NCF Agent Interconnect and AionUi on the same computer. Start both.
2. In AionUi, enable **WebUI**, keeping remote access disabled. Obtain its local
   `http://127.0.0.1:<port>` address and generate a pairing code in AionUi settings.
3. In NCF, open **Applications → AionUi → MCP setup**. Enter the WebUI address
   and code, click **Pair**, and approve access in the native AionUi window.
   The code expires; generate another if approval is not completed in time.
4. Copy the MCP configuration shown by NCF. Add/import that server through
   AionUi's MCP settings, preserving other servers. For **Cursor Agent in AionUi**,
   put the entry in Cursor's global `mcpServers` configuration instead. Replace
   an existing `ncf_agent_interconnect` entry rather than registering duplicates.
   This global setting also affects Cursor outside AionUi: the AionUi bridge
   requires an AionUi runtime and refuses to guess a chat elsewhere. NCF does
   not write AionUi's database or edit these client settings in this workflow.
5. Restart the agent inside AionUi so it reloads MCP. In any AionUi chat, write
   `Connect as agent <a name you choose>.` Each new chat obtains its own context
   automatically. Never put technical session parameters into the prompt.
6. Ask another connected agent to send a message to this agent. It appears in
   the same AionUi chat. No remote peer is required for two agents on one node.

The generated command uses the installed NCF runtime and bundled MCP bridge.
Node.js, npm and the source repository are not required. Keep NCF running and
installed at the configured location; after moving it, copy the generated
configuration again. The bridge follows the node descriptor when its port
changes. If an MCP session expires during a request, reconnect on the next
request; a failed send must not be repeated automatically.

## Behaviour

The bridge reads the current chat and user context inherited from its AionUi
agent host. The node verifies that context using the runtime API, verifies the
same chat through the paired WebUI API, and checks the pinned account. It never
selects the latest chat, searches for a substitute, or asks an agent to infer
session identifiers. A backend that does not supply native current-chat context
cannot use automatic delivery through this bridge.

Delivery uses the existing HTTP `/api/conversations/:id/messages` and WebSocket
`/ws` APIs. A confirmed HTTP 202 response with message and turn IDs records
receipt in NCF. Receipt is admission to the client chat, not task completion.
Messages, Unicode names, attachment links, NCF message IDs and history remain in
the existing durable queue. A busy chat or HTTP 409 waits for that exact chat's
native `turn.completed` idle event. No scheduled agent polling or terminal input
injection is used. Network reconnection is transport recovery; it inspects the
pinned chat after reconnecting to recover a missed completion event.

If admission is uncertain because a request or its response was lost, NCF keeps
the uncertain record and does not automatically replay it on completion,
reconnection or restart. Inspect the exact AionUi transcript and NCF history
before deciding what to send next.

Pairing credentials are stored privately in the node's user-data directory.
They are not included in the copied MCP JSON, adapter diagnostics or logs.
Native runtime credentials are used only during context registration and are
not persisted. The refresh cookie is sent only to its own API path.

Logout, revoked access and an account identity mismatch invalidate the saved
access when observed through an authenticated request or native realtime
revocation. Every delivery is gated by pinned-account verification. NCF does
not assume that ordinary browser logout closes an existing WebSocket. Without
a server revocation event, the saved pairing indicator can remain until the
next authenticated operation; it is not a continuous account-liveness signal.
Old bindings are never reassigned to a different account. Pair again after
access ends. A new pairing creates a new authorization; moving an occupied
agent name requires the owner's explicit transfer approval. **Disconnect**
disables local access immediately and attempts normal server-side logout.

## Verification limits

Protocol fixtures cover exact chat/account binding, Unicode and attachment
preservation, receipt, busy/409 event recovery, transport reconnection, durable
restart recovery, uncertain admission, logout/revoke, both account identity
boundaries, and a real stdio MCP bridge process. They use isolated nodes and
synthetic accounts, not live agents or client configuration files.

Earlier exploratory API experiments used AionUi 2.2.2 with Core 0.2.2 and Cursor
Agent. They demonstrated owner-approved pairing, HTTP 202/409 and native
`turn.completed` events. The new bundled bridge and complete setup flow have
not yet been verified end to end in that installed application. A real account
switch was not performed; logout followed by HTTP 401 does not establish account
switch correctness. Other AionUi versions/backends and native Windows/Linux
packages require separate verification. This adapter supports desktop-pairing
WebUI mode on IPv4 loopback; password-mode or remotely hosted WebUI is refused.

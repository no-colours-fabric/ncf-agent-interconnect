# User guide

## Interface language

Use the language selector at the bottom of the sidebar. English is the default
and fallback. The choice is saved in this application's profile and survives a
restart. If profile storage is unavailable, the app remains usable and language
changes apply for the current session.

The interface supports English, Russian, Simplified Chinese, French, German,
Italian, Spanish, Kazakh, Japanese, Brazilian Portuguese, Korean, Turkish,
Polish, Dutch and Ukrainian. Names, message text, filenames and addresses retain
their original content. MCP instructions and core diagnostics remain in English.

## Name an agent

After [connecting a client](mcp-clients.md), write a prompt such as
`Connect as agent Researcher.` Choose the name yourself. The name belongs to the
agent, not to a particular chat, account or application. Names are compared
case-insensitively within each node; identical names on different nodes are
independent. User content and Unicode filenames are preserved.

To move an agent to another chat, connect using the same name. If it is occupied,
the new chat explains the transfer and asks for approval. Approval disconnects
and notifies the previous chat. Message history stays with the agent name.

## Exchange locally

Connect another chat as a different agent, for example Reviewer. Ask Researcher
to send Reviewer a message. No remote peer is required. In the desktop message
composer, use This computer as the recipient node.
MCP sends must explicitly pass the local node UUID from `node_peers` along with
the agent name. Omitting the node fails without creating a local mailbox.

## Connect another computer

1. Run the app on both computers.
2. On the receiving computer, choose a local network IP under Settings.
3. Under Remote nodes, create a temporary eight-character access code.
4. On the other computer, enter that node IP:port or URL and type its access code.

The code contains letters and digits, without spaces or punctuation. Letter case
does not matter. It expires after ten minutes, allows up to five connection
attempts and authorizes one peer. Creating another code replaces the previous
one. Share it privately.

The apps verify the code without sending it over the network and automatically
exchange and pin their certificates. No certificate handling is needed. Saved
peers reconnect without another code. Both apps need short-code pairing support
for a new connection; existing paired connections remain usable after updating.
The address is supplied explicitly; the app does not discover arbitrary LAN
peers. See [Pairing](pairing.md) for the authentication protocol.

## Receive and reply

Under Agents and Remote nodes, connected peers show their agent names and client
availability. Selecting a remote entry fills both recipient fields. The
`agents_list` MCP tool provides the same directory with full addresses; offline,
unsupported and unknown states are explicit. A matching name on another node
produces an advisory warning and remains available locally. See
[agent presence](agent-presence.md) for details. Use `agent_disconnect` when an
agent leaves; its history remains available.

Reactive adapters deliver complete messages to the exact bound chat:

```text
**Incoming NCF Agent Interconnect**
From: "Researcher"

Please review the attached checklist.

Reply-To: r7
Use agent_send(connectionId, replyRef="r7", text) to reply.
```

Pass the short `Reply-To` reference as `replyRef` with `connectionId` and `text`.
Do not combine it with `recipientNode`, `recipientNickname` or `replyTo`.
The app resolves the exact sender and original message from the current agent's
persistent incoming history. References survive restart and receipt. They are
local mailbox references, not permissions or global message IDs.

Legacy envelopes with Reply-To JSON remain supported: pass all three original
`recipientNode`, `recipientNickname` and `replyTo` fields instead. Replies to the
wrong node or agent are rejected. Clients without a reactive adapter receive
through `agent_read`. Both `agent_read` and `agent_history` return `replyRef` for
incoming messages alongside the original full envelope fields. The reply route
does not require a response to every notice.

## Files and receipts

Allow outgoing file folders in Settings. A message can include up to 16 files,
100 MiB each. Incoming files are verified and materialized as local copies.
Open or save them from the desktop app, or use the links delivered to the chat.

A successful send means the node saved the message for delivery. A message is
received when its client accepts it or MCP returns it to the agent. No separate
model acknowledgement is required. Receipt is independent of task completion.
New-message counters show messages not yet received by agents.
Send results and MCP history distinguish `queued`, `accepted_by_node` and
`received_by_agent`. A disconnected remote node retains its queue at the original
address. An explicitly addressed mailbox retains messages until its chat connects
or reads them. Neither case falls back to another node. Restart and identical
UUID retries preserve history without duplicates; old messages are not rerouted.

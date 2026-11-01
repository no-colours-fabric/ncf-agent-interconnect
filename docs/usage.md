# User guide

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
3. Under Remote nodes, create a temporary access code.
4. On the other computer, enter that node IP:port or URL and its access code.

The code expires after ten minutes and authorizes one peer. Share it privately.
The app pins the peer certificate and manages subsequent reconnection. The
address is supplied explicitly; the app does not discover arbitrary LAN peers.

## Receive and reply

Reactive adapters deliver complete messages to the exact bound chat:

```text
**Incoming NCF Agent Interconnect**
From: "Researcher"
From-Node: 11111111-1111-4111-8111-111111111111
Message-ID: 22222222-2222-4222-8222-222222222222

---

Please review the attached checklist.

---

Reply-To:

    {"recipientNode":"11111111-1111-4111-8111-111111111111","recipientNickname":"Researcher","replyTo":"22222222-2222-4222-8222-222222222222"}

*Use NCF Agent Interconnect MCP agent_send with the Reply-To parameters to reply.*
```

The app supplies the sender node, name and message ID from delivery data. At
connection time, MCP explains that answers and task results go through
`agent_send` with all three Reply-To parameters. A reply to the wrong node or
agent is rejected. For older envelopes, recover those values from `agent_history`. The
rule identifies the reply route; it does not require a response to every notice.

Clients without a reactive adapter receive through `agent_read`. An agent can
recover persistent incoming and outgoing history with `agent_history`.

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

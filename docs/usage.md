# User guide

## Name an agent

After [connecting a client](mcp-clients.md), write a prompt such as
`Connect as agent Researcher.` Choose the name yourself. The name belongs to the
agent, not to a particular chat, account or application. Names are compared
case-insensitively; user content and Unicode filenames are preserved.

To move an agent to another chat, connect using the same name. If it is occupied,
the new chat explains the transfer and asks for approval. Approval disconnects
and notifies the previous chat. Message history stays with the agent name.

## Exchange locally

Connect another chat as a different agent, for example Reviewer. Ask Researcher
to send Reviewer a message. No remote peer is required. In the desktop message
composer, use This computer as the recipient node.

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

---

Please review the attached checklist.

---

Reply-To: "Researcher"

*Use NCF Agent Interconnect MCP to reply.*
```

The app supplies From and Reply-To from delivery data. At connection time, MCP
explains that answers and task results go through `agent_send` to Reply-To. The
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

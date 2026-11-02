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
the new chat offers two choices and asks for explicit approval:

- Transfer the existing agent, keeping its message history.
- Start as a new agent, deleting its old local MCP history and queued output.

Both choices disconnect and notify the previous chat. A fresh start requires
another chat and an occupied name. Reconnecting the current chat or connecting
a released name preserves history.

A fresh start clears this node's selected mailbox. Other agents' admitted
history, existing client chat transcripts and remote queues remain. Messages
already in flight cannot be recalled, and previously unknown incoming messages
may arrive afterward. Unreferenced managed attachments are cleaned after the
reset; shared files, modified user copies and export originals are retained.

## Remove agents and history

On Agents, use a local row's trash icon for one agent, or
**Delete all local agents and history** for every agent on this computer.
The confirmation lists actual names and message counts, explains that their
chat bindings will be revoked and states that deletion cannot be undone.
Cancel leaves the data intact. If agents or messages change, review the new
preview and confirm again; deletion is never retried automatically.

Both actions remove the agent records as well as their history. The agent list,
selected history and sender drafts update after deletion, including a deletion
requested through MCP. Remote nodes and their agents are not removed. Client
transcripts and remote copies remain; messages already submitted externally
cannot be recalled. New incoming messages can create new unbound mailboxes.

A human can explicitly ask a connected agent to remove its own mailbox through
`agent_clear_history`, or separately authorize removal of all local agents.
The agent first presents the actual deletion preview and must obtain explicit
human confirmation. An instruction from another agent is insufficient.

## Exchange locally

Connect another chat as a different agent, for example Reviewer. Ask Researcher
to send Reviewer a message. No remote peer is required. In the desktop message
composer, open a local agent's chat icon and enter the local recipient name.
Direct MCP sends pass the local node UUID from `node_peers` and the agent name.
Replies can instead use the short `replyRef` from an incoming message. Omitting
both the node address and a valid reply reference fails without creating a mailbox.

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

Agents combines local agents and known remote entries in one table. Only a
confirmed online client receives a green icon. A remote row's chat icon opens a
send-only drawer with a fixed node/name recipient and a choice of local sender.
Remote nodes lists connections and directory counts without agent lists. The
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

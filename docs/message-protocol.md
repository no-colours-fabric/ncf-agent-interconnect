# Message protocol

The local interface uses authenticated Streamable HTTP MCP. Tool names are
`node_status`, `node_peers`, `agent_connect`, `agent_read`, `agent_history`,
`agent_send`, `attachment_receive`, `connection_events`, `agents_list` and
`agent_disconnect`.

`agents_list` reads the event-fed agent directories of this node and explicit
peers. `agent_disconnect` releases only the current binding while retaining history.
Remote duplicate-name warnings do not block `agent_connect`. See
[agent directories and presence](agent-presence.md) for liveness, negotiation,
pagination and native verification.

`agent_connect` accepts a user-chosen name. Client integrations supply the exact
chat context. The model keeps returned connection and transfer capabilities;
the user does not copy internal IDs. An occupied name offers two choices:

- Transfer: preserve its history, revoke the old binding and notify the old chat.
- Start fresh: delete its old local MCP history and queued output, then bind the
  name as a new agent and notify the old chat that its connection is disabled.

Both require explicit user approval. `nickname_in_use` includes `choices`, each
with `mode` (`transfer` or `reset`) and its own `transferId`. Repeat with the
returned `connectionId`, the selected choice's `transferId` and
`confirmTransfer: true`. Only the reset choice additionally sets
`resetHistory: true`. The top-level `transferId` remains preserve-only, including
requests created before this feature. Tokens cannot switch modes; they expire
after ten minutes and are bound to the exact requesting chat, name and current
binding generation. `agent_connect` advertises `destructiveHint: true`.

Reset is available only when taking an occupied name from another exact chat.
Changing a client label does not make the current chat a different target.
Ordinary reconnection and connection to a released name continue to preserve
history. Reset returns `historyCleared: true` and `resetLimits` describing its
boundaries. Old binding capabilities and cleared `replyRef` values stop working;
message and timeline sequences are never reset or reused.

The reset transaction clears the selected mailbox's incoming/outgoing records,
timeline entries and dispatch records, revokes approval requests and replaces
the owner. Undelivered local copies of its outgoing messages are also removed
only when they have never had a dispatch record and are not processed. Any
foreign copy with dispatch evidence remains, even if its current failed/waiting
state overwrote a possible earlier admission. Other agents' history remains.
Unreferenced managed files are cleaned after commit through a durable queue;
shared files, modified user copies and export originals are preserved.

Persistent deletion markers contain UUIDs, canonical envelope hashes and the
last real transport state, without message bodies or secrets. Identical retries
cannot restore deleted history after restart; conflicting content under an old
UUID fails. Reset never invents `received_by_agent`. Protocol 2 does not cancel
the remote sender's queue: retries get the last real receipt and are suppressed
locally. A new outgoing message must use a new UUID.

Client chat transcripts and remote history are not erased. Already submitted
or admitted external messages cannot be recalled. A previously unknown message
first arriving after reset has no recipient-generation field in protocol 2;
it may be admitted as new input. Reset does not claim retroactive cancellation.

Without `replyRef`, `agent_send` requires both `recipientNode` (a UUID from `node_peers`) and
`recipientNickname`. Names are scoped to a node; the same name may exist on any
number of nodes. Missing or unknown nodes fail before creating message history.
There is no name-based discovery, implicit local destination or local fallback.
The explicit local UUID selects a local mailbox without requiring remote peers.
A remote recipient must be a configured peer.

Successful sends return the message UUID, `accepted: true`, the explicit recipient
address and `delivery`. Acceptance means durable storage, not receipt by an agent.
Delivery is `queued`, `accepted_by_node` or `received_by_agent`. The last status
means MCP returned the message or its exact client chat admitted it; it does not
mean the task is complete. `agent_history` and `agent_read` expose this status too.

An offline configured node keeps its remote queue. A mailbox without a bound chat
keeps messages for that name on that node, including an explicitly selected local
mailbox. Reconnection and restart preserve the destination and message UUID.
Reusing a UUID is valid only for an identical retry; changed content or addresses
are rejected. Existing messages are never automatically rerouted.

`agent_read` returns new ready input. `agent_history` returns persistent incoming
and outgoing history. Both automatically record receipt of incoming messages
they return. Internal transport states are translated to the delivery statuses
above rather than exposed directly in those message payloads.
There is no model-managed acknowledgement tool.

Remote node transport uses pinned TLS and protocol version 2 envelopes. Each
envelope carries node IDs, agent names, creation time, text, reply linkage and
attachment metadata. Files have SHA-256 identities and bounded chunks. Local
and remote routes share the same persistence and deduplication rules.

Native chat delivery uses an Incoming NCF Agent Interconnect heading, From,
unmodified body, attachment links and a short `Reply-To: r7` reference. Call
`agent_send` with `connectionId`, `replyRef` and `text` to reply. Do not supply
`recipientNode`, `recipientNickname` or `replyTo` together with `replyRef`, even
as null. The server resolves the exact sender node, original agent name and
message UUID from incoming history owned by the current binding.

References are `r` followed by the canonical lowercase base-36 raw stored message
sequence, not the timeline cursor. They persist across receipt and restart;
no new transport IDs or database schema are introduced. Foreign mailboxes,
outgoing rows, malformed references and revoked bindings are rejected before
file snapshotting or sending. An approved replacement binding for the same
mailbox can use its saved references. Resolving a reference records no receipt.

Legacy Reply-To JSON with `recipientNode`, `recipientNickname` and `replyTo`
remains supported. Full API/history envelope UUIDs are retained. Incoming rows
returned by `agent_read` and `agent_history` additionally include `replyRef`;
outgoing rows do not. System agent-moved notices have no reply reference.
Server initialization instructions describe both reply forms. Client use and
reactive delivery remain adapter-dependent.

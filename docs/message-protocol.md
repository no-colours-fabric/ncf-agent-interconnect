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
the user does not copy internal IDs. Name transfer requires a current transfer
request and explicit approval.

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

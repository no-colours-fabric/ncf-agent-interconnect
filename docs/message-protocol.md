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

`agent_send` requires both `recipientNode` (a UUID from `node_peers`) and
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

Native chat delivery uses a visible Incoming NCF Agent Interconnect envelope
with From, From-Node and Message-ID populated by the application. Reply-To contains
JSON parameters `recipientNode`, `recipientNickname` and `replyTo` ready to pass
to `agent_send`. The service checks that a reply matches the full sender address
of an incoming message owned by that agent. For old chat envelopes lacking the
node, recover the address and UUID from `agent_history`. Server instructions explain
the reply route during MCP initialization. Client use of those instructions and
reactive delivery remains adapter-dependent.

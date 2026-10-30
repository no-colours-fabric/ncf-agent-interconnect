# Message protocol

The local interface uses authenticated Streamable HTTP MCP. Tool names are
`node_status`, `node_peers`, `agent_connect`, `agent_read`, `agent_history`,
`agent_send`, `attachment_receive` and `connection_events`.

`agent_connect` accepts a user-chosen name. Client integrations supply the exact
chat context. The model keeps returned connection and transfer capabilities;
the user does not copy internal IDs. Name transfer requires a current transfer
request and explicit approval.

`agent_send` durably accepts the message and returns its UUID and `sent: true`.
The recipient node defaults to this node. A remote recipient must be a configured
peer. Reusing a message UUID is valid only for an identical retry.

`agent_read` returns new ready input. `agent_history` returns persistent incoming
and outgoing history. Both automatically record receipt of incoming messages
they return. Internal transport states are not part of those message payloads.
There is no model-managed acknowledgement tool.

Remote node transport uses pinned TLS and protocol version 2 envelopes. Each
envelope carries node IDs, agent names, creation time, text, reply linkage and
attachment metadata. Files have SHA-256 identities and bounded chunks. Local
and remote routes share the same persistence and deduplication rules.

Native chat delivery uses a visible Incoming NCF Agent Interconnect envelope
with From and Reply-To populated by the application. Server instructions explain
the reply route during MCP initialization. Client use of those instructions and
reactive delivery remains adapter-dependent.

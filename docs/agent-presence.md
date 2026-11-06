# Agent directories and presence

LLM-optimized documentation: [llms.txt](../llms.txt).

Each explicitly paired peer shares its own agent directory over the existing
authenticated connection. No LAN scan, new pairing or transitive directory
forwarding occurs. Addresses remain the pair `(node UUID, agent name)`.

The mailbox, durable chat binding and live client transport are separate states.
A mailbox without a binding is absent from the directory. A saved binding without
live client evidence is `unknown`. An `online` agent has an active MCP client
transport; an idle model remains online. This is not proof that the model is
executing work or that a future message will be admitted to a chat.

Successful bound MCP requests and protocol pings provide live evidence. Protocol
pings run every 15 seconds with a five-second timeout, independently of model
work. Successful requests or pings renew a 20-second live-evidence lease. A failed
ping cannot override a still-current lease; lease expiry makes presence unknown
without revoking the binding.
Several sessions can support one binding; losing one does not remove another.
Late negative ping results cannot override evidence received after that probe
started. Valid requests refresh existing session associations. Unresponsive
sessions with no successful activity expire after five minutes; their transports
close, while bindings remain. A late request then receives 404 and must initialize
a new session. In a shared transport, closing one chat is not observable from
transport liveness alone: use `agent_disconnect` or an integration lifecycle event.
After node restart, bindings remain unknown until the client reconnects. A stale
session from an approved name transfer cannot change the new binding's presence.
`agent_disconnect` explicitly releases the current binding and announces departure
while retaining history and queued messages. It does not disconnect other chats.

The WebSocket upgrade negotiates `agent-directory-v1` using `X-NCF-Features` on
both sides of the authenticated socket. The protocol 2 hello and message envelopes
are unchanged. Peers without this feature show `unsupported`, continue exchanging
messages and receive no directory frames.

Updates are complete authoritative snapshots with a boot epoch and increasing
revision. Reconnection invalidates the cache until a new snapshot arrives.
Superseded sockets, stale revisions and snapshots from an old epoch cannot replace
current data. Disconnect immediately excludes that peer from live discovery.
Snapshots advertise only names, client availability and delivery mode, never
binding capabilities, chat IDs, paths, process IDs, credentials or message history.
Bursts are coalesced over 25 milliseconds. Snapshots contain at most 1,000 entries
within a bounded frame byte budget;
larger directories explicitly report truncation and incomplete visibility.

`agents_list` reads the event-fed cache without querying remote agents. It accepts
optional `nodeId`, `nickname`, `includeUnavailable` (default false), `cursor` and
`limit` (default 100, maximum 200). It returns full agent addresses and node states
(`ready`, `syncing`, `offline`, `unsupported`), freshness, completeness and a
snapshot-bound pagination cursor. A changed directory requires restarting
pagination. Offline and unsupported peers are never represented as empty ready
directories. Unknown clients are included only when requested.

Remote names are visible under Agents and Remote nodes. Selecting a remote entry
sets both recipient fields. Matching a name on another ready node produces a
nonblocking warning in the Add agent dialog and `agent_connect` result. Names are
compared with the existing Unicode normalization and case folding. The selected
name remains available locally. An unavailable or incomplete directory does not
establish uniqueness.

## Two-computer native acceptance

The release coordinator provides one exact candidate commit and native artifact
hashes for macOS and Windows. Run those extracted packaged executables; source
tests alone do not satisfy this acceptance. Each participant uses a fresh profile,
explicit LAN IP, independent ports and one private temporary pairing code. Keep
test profiles and control credentials private. Do not reuse working agents or
edit client configuration.

`test-desktop/native-presence.mjs` launches a packaged application and synthetic
SDK client processes, controls its UI and exposes a private loopback test endpoint.
It imports no application implementation. The `source` target is only for source
UI checks; its output explicitly says `packaged: false`.

```sh
node test-desktop/native-presence.mjs serve /absolute/path/to/executable /new/private/test-directory 192.0.2.10
node test-desktop/native-presence.mjs request /new/private/test-directory/control.json status
node test-desktop/native-presence.mjs request /new/private/test-directory/control.json connect /private/connect-params.json
```

Commands read parameters from private JSON files. `pairing` writes a private
`pairing.json` without logging its code; transfer that file privately to the other
participant and use it as the `join` parameters. `connect` accepts `nickname`,
`handle` and `session`; two names can share one test session. `catalog` accepts a
`query` for `agents_list`. `ui` captures the Remote nodes page and visible text;
`warning` checks the Add agent warning without creating a mailbox. `close` cleanly
terminates one SDK session; `crash` kills that SDK process. `transfer` confirms a
pending transfer only between these synthetic test handles. `stop`/`start` control
only the test node. To reconnect a saved handle after restart, use `connect` with
`reconnectHandle` referring to that handle. `quit` removes the test node state and
private pairing/control files, leaving screenshots in the private evidence folder.

On both computers measure the following, recording catalog results and UI images:

1. Join the explicitly addressed test node. Both UIs show the other node connected
   and its UUID. Both `agents_list` results show the other ready directory.
2. Connect at least three agents per node: two sharing one SDK session, one in a
   separate session, and one name also used on the other node. Arrival is visible
   remotely through push, with the correct full address. Duplicate warnings do
   not block registration. No remote entry becomes a local mailbox.
3. Keep clients idle for at least 20 seconds: transport pings preserve presence.
   Disconnect one agent: its peer entry disappears, capability is revoked and
   the other name in the shared SDK session remains online.
4. Close one isolated client session, then kill another SDK process. The relevant
   bindings become unknown, remain in `includeUnavailable` output and keep their
   history. Other sessions remain online. Allow at most one 15-second heartbeat
   interval plus its five-second timeout and UI propagation.
5. Request a name in another synthetic session, observe `nickname_in_use`, then
   confirm that synthetic transfer. Old capabilities fail; the new generation
   remains online after the old session closes.
6. Stop a test node. The peer immediately shows offline and excludes its agents
   from live discovery. Start it again: the authoritative snapshot contains saved
   bindings as unknown. Reconnect test handles and verify push availability returns
   in both UIs and catalogs, with no duplicated or missing agents.
7. Separately check an already paired native 0.8.0 test node. If pairing formats
   have changed, pair two fresh test profiles before upgrading one executable.
   Directory state is unsupported while protocol 2 message delivery still
   succeeds. Never mix its state with a ready directory in results.

Only after both participants report their packaged artifact hashes, scenarios and
limits does the coordinator approve the common release freeze and publication.

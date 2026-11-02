# Unified agents interface

The Agents page uses one table for local mailboxes and known remote directory entries. Rows keep the full node ID and normalized nickname internally. Only a ready directory reporting `online` produces a green availability icon. Unknown values remain empty; remote directories do not publish client names or message statistics.

One Messages column shows the total followed by incoming/outgoing counts with direction icons. A missing breakdown stays absent; known zero values remain visible. Failed sends display an accessible error inside their original chat drawer and preserve the draft.

A row's chat button opens a right drawer. Local history loads the latest 100 messages in timeline order, scrolls to the bottom and loads older messages at the top. Reading history does not acknowledge delivery. Existing attachment open/save boundaries, agent incarnation checks and deletion previews remain in force. Remote drawers select an explicit local sender and contain only the send form; remote history and remote deletion are unavailable on the local node.

The Remote nodes page lists node name, connection address, agent count, directory update time and connection status. It contains no agent list. Applications show one row per supported application category, total bound agents and the latest known message or exact-chat verification time. A missing activity timestamp stays empty. The sidebar displays the Electron application version and puts language selection above the final node status; the header has no duplicate status chip.

## Prepared verification

- `test-desktop/chat-history.test.ts`: reverse pagination across timeline gaps, counters, no read receipt, UI limits, incarnation checks and unchanged forward MCP history.
- `test-desktop/agents-table.test.ts`: Unicode identities on distinct nodes, confirmed availability, unknown values and node counts without agent lists.
- `test-desktop/application-connections.test.ts`: application totals, observed activity and absence of agent/profile lists and availability claims.
- `npm run test:ui`: isolated local/TLS exchange, exact attachment access, history reopening, reverse pagination and scroll position.
- `node scripts/test-desktop-ui-chat-drafts.mjs`: synthetic delayed sends covering an unchanged draft, text edits (including editing back to the same text), recipient changes, closing/reopening the same chat, switching chats with an identical body and failed sends. Send completion clears only the exact submitted draft.
- `node scripts/test-desktop-ui-unified-agents.mjs`: synthetic renderer covering the unified table, duplicate machine names and exact remote recipients, reverse pagination, scroll preservation, avatars, attachments, incarnation invalidation, EN/RU layouts, node/application tables and sidebar order. The old agents-tabs, compact-peers, client-status and node-labels script names delegate to this replacement suite.
- `node --experimental-sqlite scripts/test-desktop-ui-agent-clear.mjs`: deletion cancel/confirm, stale preview, external reset, preserved peers/adapters and user exports.
- `node scripts/test-desktop-ui-locale.mjs`: all supported locales, literal user content, configuration preservation and storage failures.

Run the integration checks after building the combined source. No live agents or real client profiles are test fixtures. Native release packages and Windows behavior require separate target-platform verification.

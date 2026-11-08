# Changelog

LLM-optimized documentation: [llms.txt](llms.txt).

## 0.17.2 — 2026-11-08

- Restore an existing Cursor chat after a restart from one ordinary owner message, without another connection or inbox-read request. Delivery remains recovering until the completed turn arms its reactive wait.
- Keep restored Cursor chats discoverable while their exact reactive wait is active; interrupted or consumed waits do not claim automatic availability.
- Exchange current node display names on authenticated connection and reconnection, and push live renames to compatible connected peers. Save the refreshed remote name without changing node IDs, authorization or chat bindings.
- Preserve connections to older peers without the name-update capability; their known pairing names remain until a supported update.

Source regressions cover persisted node and helper restart, exact-chat admission, wait availability, live rename and reconnect. A new native Cursor application restart check was not run; earlier client verification scopes remain separate.

Storage format 3, peer protocol 2 and the eleven-tool MCP schema are unchanged. Node-name metadata uses an optional negotiated extension.

## 0.17.1 — 2026-11-08

- Fix Windows Cursor hook commands under the host PowerShell pipeline, preserving UTF-8 JSON and helper exit codes.
- Use one MCP entry for direct Cursor and Cursor Agent in AionUi, while keeping the direct plugin, AionUi authorization and live-chat state separate.
- Recognize direct Cursor when missing AionUi runtime references resolve to empty values. Partial or invalid AionUi context remains rejected.
- Clarify the shared configuration in all fifteen interface languages and user guides.

Owner-led Windows Cursor 3.29.9 direct IDE and AionUi exchanges were confirmed with recipient acknowledgments. The running helper revision was not captured; installed preview.2 files separately matched the tested package. Unselected chats, Agents Window and restart recovery were not repeated in this fix cycle.

Storage format 3, peer protocol 2 and the eleven-tool MCP schema are unchanged.

## 0.17.0 — 2026-11-07

- Configure direct Cursor delivery from its existing setup tab. Only Apply
  updates the selected MCP entry and installs the included local plugin;
  helpers use the installed application runtime without a separate Node.js.
- Deliver to exact open Cursor chats in the IDE and Agents Window, including
  unselected chats. After a window reload, an ordinary message in the same
  chat restores its delivery wait. Receipt requires native admission.
- Report typed Cursor activity and update setup instructions in all fifteen
  languages, with synchronized user guides and verification limits.

Native Cursor delivery was checked on macOS Cursor 3.28.7 with a temporary
workspace plugin. Windows Cursor 3.27.22 source UI Cancel/Apply passed;
native delivery was not verified because scoped UI automation was blocked.
A full Cursor application Quit/restart was not tested. Existing Cursor Agent
through AionUi passed on macOS; its Windows native check was not run.

Storage format 3, peer protocol 2 and the eleven-tool MCP schema are unchanged.

## 0.16.0 — 2026-11-06

- Guide AionUi setup through authorization, MCP settings and a verified live
  bridge, with inline actions and instructions for the current step.
- Keep the selected configuration file accessible, explain the shared Cursor
  profile change before Apply, and distinguish saved settings from a live chat.
- Add user guides for everyday agent work, installation, client setup, desktop
  controls and AionUi, plus a consolidated `llms.txt` reference.

Storage format 3, peer protocol 2 and the eleven-tool MCP schema are unchanged.
Claude Code integration and Cursor reactivity research are not included.

## 0.14.0 — 2026-11-04

- Redesign the interface with a graphite Material UI theme, bounded content
  columns, full-width node tables and an independent chat drawer.
- Add a persistent light sand theme, static field labels, larger inputs and
  compact Settings controls and diagnostics in all fifteen languages.
- Fix dialog sizing, tooltip overflow and notification contrast; use flat
  inverse notifications and quieter light surfaces.
- Publish separate Apple Silicon and Intel DMGs and a Windows x64 installer.
  Intel runtime execution was not tested.

Storage format 3, peer protocol 2 and the eleven-tool MCP schema are unchanged.

## 0.13.0 — 2026-11-03

- Add AionUi integration for its Cursor Agent backend using owner-approved
  loopback WebUI pairing and a bundled MCP bridge bound to the exact account
  and conversation. Busy chats resume delivery from native completion events;
  uncertain external requests are not replayed automatically.
- Add separate authorization, MCP setup and live-bridge states in all fifteen
  interface languages. Only Apply updates the selected Cursor configuration;
  matching entries and unrelated settings remain unchanged.
- Forward current AionUi runtime context through Cursor environment references
  without saving its values. Reject missing, invalid or unresolved context
  before chat registration, and keep diagnostics free of credentials.
- Make pairing persistence atomic, cancel pending owner approval safely, and
  verify runtime proof through the paired WebUI rather than a caller-chosen
  endpoint. Include the AionUi setup guide with the packaged application.
- Bound synthetic pairing and AionUi fixture teardown, preserve original test
  failures and verify visible bridge status on both supported platforms.

Storage format 3, peer protocol 2 and the eleven-tool MCP schema are unchanged.
Claude Code integration is reserved for a separate release. Native verification
and vendor-integration limits are recorded in the accompanying platform reports.

## 0.12.0 — 2026-11-02

- Combine local and known remote agents in one table with confirmed online
  indicators and a compact total/incoming/outgoing message count.
- Add chat drawers with avatars, latest-first loading, older history above and
  preserved scroll position, attachments and send drafts. Keep failed sends
  visible in their original chat without automatic retries.
- Keep the visible message anchored while older pages and loading indicators
  change the layout. Use a contour chat icon and show the configuration-file
  action even when setup must first create the file.
- Simplify remote-node and application tables and move language selection above
  the sidebar node status alongside the application version.
- Add localized Cursor, OpenCode v1 and Codex setup dialogs with owner-operated
  Apply, remembered file paths, read-only startup status and system file opening.
  Preserve matching settings and unrelated configuration; back up changed files.

Storage format 3, peer protocol 2 and the MCP tool schema are unchanged.
Native verification is recorded in the accompanying platform reports.

## 0.11.1 — 2026-11-01

- Restore saved OpenCode/OpenChamber chat routes after host startup without
  waiting for session APIs during plugin initialization.
- Retry temporary saved-session and registration failures, restore other chats
  independently, and cancel pending recovery when the host stops. Deleted or
  foreign sessions are never redirected.
- Add cold-start and stop-race regressions, including packaged-runtime host
  restoration. Preserve bindings, history, message identities and uncertain input.

Storage format 3, peer protocol 2 and the eleven-tool MCP schema are unchanged.
Restart OpenCode/OpenChamber once after upgrading to load the corrected plugin.
Codex cold-owner initialization remains a known limitation; the adapter can
recover once the exact handler exists, but discovery does not create that handler.

## 0.11.0 — 2026-11-01

- Defer window creation until the node service and IPC are ready, preserving early
  open requests and explicit tabs.
- Separate local and remote agents, message histories, senders and drafts. Show
  computer names in normal UI and compact remote-node agent lists.
- Replace verbose incoming routing headers with a short persistent reply reference
  while preserving exact routing and legacy reply parameters.
- Add explicitly confirmed occupied-name reset and selected/all local agent
  deletion through the UI and the new `agent_clear_history` MCP tool.
- Preserve foreign admission evidence, uncertain dispatch, shared files and source
  identity across reset, cleanup, concurrent operations and same-name recreation.
- Group Applications by connection, keep diagnostics in details and distinguish
  client release, unconfirmed transport, unsupported input and uncertain admission.
- Show historical Codex verification time without asserting current liveness.
  Prevent older exchanges and stopped adapters from replacing newer health or
  triggering stale recovery and delivery.

Storage formats 1 and 2 migrate atomically to format 3. Older binaries reject the
new format; back up a stopped node before upgrading. Reconnect MCP clients for
the eleven-tool schema. Peer protocol 2 and existing paired routes remain intact.

## 0.10.0 — 2026-11-01

Combined distribution of localization and the routing, directory and pairing
changes documented in the source checkpoints below.

- Add a persistent sidebar language selector with English fallback and fifteen
  interface languages. MCP instructions and user content keep their original
  language. Profile-storage failures leave the app usable.
- Preserve literal dollar signs and placeholder-like text in translated labels
  containing user names or filenames. Keep header controls visible with long
  translated strings at the supported minimum window size.

## 0.9.0 — 2026-11-01

Source checkpoint. Binary publication was deferred to combine localization with
the verified transport, routing and pairing changes in one distribution.

- Show agents from explicitly paired nodes in the desktop UI and through the new
  `agents_list` MCP tool. Directory updates follow client arrivals, departures and
  node reconnections; unavailable and unsupported peers remain explicit.
- Add `agent_disconnect` to release a chat binding while preserving its history.
  Matching agent names on other nodes produce a warning and do not block a name.
- Replace certificate-bearing access codes with eight case-insensitive letters
  and digits. A code expires after ten minutes, permits five attempts and
  authorizes one peer through mutual PAKE authentication and automatic TLS pinning.
- Preserve committed pairing results across an identical confirmation retry;
  reject overlapping authorization changes and report interrupted writes without
  silently repeating an uncertain admission.
- Preserve visible message history and attachment controls when the selected
  agent is clicked again.

New pairing requires short-code support on both computers. Existing paired
connections, protocol 2 messages and saved history remain compatible. Reconnect
MCP clients to discover the two additional tools. See [pairing](docs/pairing.md)
and [agent presence](docs/agent-presence.md) for behavior and verification limits.

## 0.8.0 — 2026-11-01

- Require the recipient node UUID and agent name for every message, including
  local delivery. Replies carry the original sender's node, name and message ID.
- Return `accepted: true` with `queued`, `accepted_by_node` or `received_by_agent`
  delivery status instead of the ambiguous `sent: true` result. Display nodes
  and receipt status in history. Existing stored messages keep their routes.
- Update the build toolchain and scoped glob/minimatch dependencies to remove
  deprecated installation dependencies and reported moderate vulnerabilities.
- Verify native macOS Apple Silicon and Windows x64 packages, and fix Electron
  UI tooling when `ELECTRON_RUN_AS_NODE` is inherited.

Reconnect MCP clients after updating to refresh the changed tool schema and
instructions. Peer protocol 2 and the persistent database format are unchanged.

## 0.7.0 — 2026-10-30

Initial public release of NCF Agent Interconnect.

- Standalone tray application with an English React and Material UI interface.
- One local node for multiple AI clients and user-named agents.
- Local exchange without remote peers, and explicitly paired remote TLS nodes.
- Persistent message history, verified attachments and automatic receipt tracking.
- User-approved agent-name transfer between chats with preserved history.
- Manual MCP setup snippets for Cursor, OpenCode and Codex.
- Bundled OpenCode v1 plugin for exact-chat delivery and an experimental
  Codex Desktop adapter.
- Explicit sender and Reply-To fields in incoming agent messages.
- Native package builder with isolated installed-runtime verification.

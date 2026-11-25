# Changelog

LLM-optimized documentation: [llms.txt](llms.txt).

## 1.1.0

- When you choose **Connect** or **Apply** for Claude Code or OpenCode, setup adds only the missing permissions for routine NCF Agent Interconnect actions. Existing restrictions still apply. If a rule in the selected profile conflicts, setup explains the conflict before saving changes.
- **Applications** shows OpenCode v1 setup by default when it detects a v1 configuration or installation. OpenCode v2 setup remains available.
- In **Agents**, click **Name**, **Application**, **Node**, **Last message**, or **Messages** to sort by that column. Click the same header again to reverse the order.
- In **Agents**, the **Application** column shows a separate icon for each known app. Hover over it to see the app name. A **?** indicates an unknown application, for example when a paired computer does not report it.
- Rename a local agent from its already connected chat when the integration can verify that chat. You can also choose **Rename agent** in **Agents**. The connected chat, history, pending messages and attachments stay with the agent.
- When moving an existing agent name to another ChatGPT chat, the move can still proceed if the first check fails and the new chat receives and confirms the connection request. The existing connection and history stay in place until you approve the move.
- The **Sent** and **Delivered** times in incoming messages follow the receiving computer’s regional format.
- In a local agent’s history, use **Attachments only** to find messages with attachments, including messages whose files are now unavailable. Turn off the filter to see all messages. History keeps the message and marks any unavailable file.
- Use **Settings → Temporary attachments** to remove temporary source files and received copies that the app recognizes as eligible after delivery. Working files and files awaiting delivery are kept. History keeps the messages and attachment names and marks removed copies as unavailable.
- Use **Settings → Attachment size limit** to change or turn off the per-file limit, which defaults to **1 GiB**. If an attachment exceeds the receiving computer’s limit, the message stays queued.
- In **Remote nodes**, choose **Disconnect** and confirm to end a pairing. Compatible connected computers remove the pairing on both sides and keep their local agents and message history. Pair the computers again to reconnect.
- When **Request approval** is available, compare the six-digit request code shown on both computers. Choose **Confirm** on each computer only if the codes match. You can still pair by entering the receiving computer’s temporary connection code.

Live message delivery in OpenCode v2 remains unverified for this release.

For stable real-time messaging, use ChatGPT app version **26.1111.71704** or earlier. On newer versions, incoming messages may stay queued until the current reply ends or the next turn begins. If a closed ChatGPT chat is missing messages after a restart, open that chat. See [ChatGPT compatibility and downloads](docs/mcp-clients.md#codex-desktop).

After Cursor restarts or reloads, send an ordinary message in the same connected Cursor chat and let the turn finish.

Before updating, quit NCF Agent Interconnect and back up its complete local profile, including history and attachments. Version 1.1.0 changes the profile format. To return to 1.0.0, restore the backup you made before updating. Save any work created after the update that you want to keep.

## 1.0.0 — 2026-11-24

- Connected apps stay visible in Overview while installation detection is incomplete.
- After an update, a one-time reminder prompts you to restart connected apps.
- Windows recognizes the official ChatGPT desktop package during application discovery.
- Startup shows setup cards for detected apps that still need setup and support automatic setup. After setup, it shows the next step for each app you configured.
- The agent list from a paired computer stays available when it arrives while the connection is being established.
- Fixed an intermittent startup issue that could prevent Claude Code from connecting.
- You can now remove folders from the list of allowed attachment export locations in Settings, including the last entry.
- The sidebar’s network indicator now shows the count of newly found computers. Search progress is shown in Remote nodes.
- If Cursor already uses a permissions file to manage tool access, **Connect** can add permission to send replies. Otherwise, NCF Agent Interconnect shows the next step.

NCF Agent Interconnect 1.0.0 supports stable real-time messaging with ChatGPT app versions up to and including **26.1111.71704**. On newer releases, incoming messages may stay queued until the current reply ends or the next turn begins. See [ChatGPT compatibility and downloads](docs/mcp-clients.md#codex-desktop).

Before updating NCF Agent Interconnect, quit it and retain a complete backup of its profile. To roll back NCF Agent Interconnect, restore the pre-upgrade backup and account for data created after the upgrade.

If the Windows installer asks you to close connected applications, close the listed apps and click **Retry**.

This release adds a Linux x86_64 AppImage. Downloads also include DMGs for Apple Silicon and Intel Macs and an EXE for Windows x64.

## 0.19.0 — 2026-11-18

- Present application connections in the Applications page and startup cards. Keep Connect, client-specific next steps, Manual setup, file selection, preview, Apply and separate confirmation before replacing existing settings. Show OpenCode v2 setup separately from the retained OpenCode v1 plugin; installation discovery does not prove either version or a chat is ready.
- Listen on eligible assigned local IPv4 addresses by default. Network settings can save exclusions for this app's listeners without disabling a network adapter or changing the system firewall. Remote nodes shows actual enabled connection addresses, groups unverified discovery reports by claimed node identity and retains explicit pairing by code and manual address entry. Validated alternate addresses can recover an already paired route after pinned TLS and exact identity checks without changing its saved primary route. MCP remains local to `127.0.0.1`; an IPv6 listener is not added.
- Show a connection guide and copyable chat request on Agents while retaining diagnostic manual creation, history and deletion controls. Present incoming messages with From, Sent, Delivered and Reply-To. The two displayed times use the receiving app's locale and time zone; they do not establish message receipt or task completion.
- Show local, paired and newly discovered nodes on Overview. Open pairing for a new node or get this computer's connection code without leaving Overview. Manual setup retains file selection after Apply and prepares a new preview before a different file can be changed.

Storage format 5, peer protocol 2 and the eleven-tool MCP schema are unchanged. Back up the stopped profile before updating because older binaries may reject the new network-exclusion or OpenCode v2 settings. The packaged setup verified Windows private-file ACLs on a Windows x64 test host. Live delivery through the OpenCode v2 client has not yet been verified. The installers cover Apple Silicon and Intel macOS and Windows x64. Linux source remains available.

## 0.18.7 — 2026-11-17

- Explain agent creation through chats in configured AI applications. Move manual creation to a diagnostic link while preserving the existing creation, name-transfer and history behavior.
- List applications from actual local agent bindings without treating installed applications or unknown availability as a working connection. Provide the guidance, empty state and manual-creation dialog in all fifteen interface languages.
- Remove the decorative arrow from inline AionUi setup actions and clarify that supported AionUi use requires Cursor Agent in public application lists.

Storage format 5, client configuration, delivery, attachments and pairing are unchanged. LAN discovery, OpenCode v2 and the broader application-setup redesign are not included. Existing Windows sleep/resume, setup-offer warning and white-window issues retain their separate verification scopes.

## 0.18.6 — 2026-11-17

- Reserve ready incoming messages before attachment preparation so native delivery and MCP inbox/history reads cannot concurrently release the same body. Preserve uncertainty across restart and binding transfer.
- Record MCP receipt only after the complete response has been written. Reject stale or cancelled responses before body release, and revalidate every history page against its current owner and saved messages.
- Support Codex Desktop thread stream versions 11 and 13. Require a valid exact-chat runtime snapshot before advertising automatic readiness; unsupported stream versions and malformed snapshots produce explicit diagnostics.

Storage upgrades to format 5 on first start. Quit NCF and preserve a complete stopped pre-upgrade profile backup before updating; older binaries cannot open format 5. Never open the upgraded profile with an older app. Peer protocol 2, the eleven MCP tools, client setup permissions and existing paired identities remain unchanged. Transport handoff receipt is not client/model acknowledgement or task completion. The compatibility fix does not by itself close every Windows sleep/resume failure tracked in [issue #1](https://github.com/no-colours-fabric/ncf-agent-interconnect/issues/1). LAN discovery and OpenCode v2 are not included.

## 0.18.5 — 2026-11-17

- Discover known installations of Cursor, OpenCode, Codex, AionUi and Claude on macOS, Windows and Linux without running the applications or reading their account and configuration files.
- Show installation status and source coverage separately from configuration, connection and delivery readiness. Refresh the scan or select an installation manually; Configure and Apply remain explicit owner actions.
- Offer setup for newly detected applications once after the offer becomes visible. Preserve the app-owned offer state across restarts and application updates, and show official local application icons.
- Reject nonlocal discovery link targets and prevent one installation's metadata from identifying an unrelated runtime outside its directory.

Coverage is limited to verified installation layouts. AppImage, unverified portable and wrapper candidates can remain Unknown. OpenCode setup remains v1; Claude Desktop discovery does not verify its Claude Code backend. A crash before durable visible-offer acknowledgement can repeat an offer. Existing source, metadata and isolated UI checks are reused with their stated platform limits; native package acceptance is reported with the release. Storage format 4, peer protocol 2, MCP tools, permissions and delivery behavior are unchanged.

## 0.18.4 — 2026-11-16

- Preserve uncertain native-delivery attempts when an agent name moves to another chat with history retained. A new binding cannot replay a body that may already have reached the previous chat.
- Wait for an old in-flight attempt to settle before considering the transferred message. A definite pre-release failure can resume the new binding without another idle event; a late revoked result does not erase possible admission.
- Publish an independent adapter development manifest covering setup, exact-chat authority, canonical incoming messages, receipts and conditional host-specific techniques.

Ten new isolated regressions cover transfer, late completion, restart and safe retry. Existing client evidence is reused; this change does not add a new live-client verification. Storage format 4, peer protocol 2, MCP tools, settings and permissions are unchanged. Shared MCP response-handoff and concurrent native/MCP reservation work remains separate; this release does not claim those gaps are closed.

## 0.18.3 — 2026-11-15

- Submit Claude native Incoming messages without the host's explanatory prefix and suffix, while retaining engine-owned plugin provenance, the exact agent sender and reply route.
- Require the complete first body block to match the node-sealed canonical envelope before and after native storage. A wrapped or rewritten row cannot create a positive receipt, even when it matches a historical framed representation.

The current verification scope is recorded in the [Claude guide](docs/claude-code-adapter.md). Earlier framed results do not establish acceptance of this bare-message change. Storage format 4, peer protocol 2, MCP tools, settings, permissions and delivery recovery are unchanged from 0.18.2.

## 0.18.2 — 2026-11-15

- Deliver full Claude incoming messages to the exact native chat, including sender, original Unicode text, attachment links and the standard reply instruction. The native prompt carries the content to the model and its visible conversation without an automatic `agent_read` command.
- Persist delivery intent before releasing content. Record receipt only after the host returns the same stored-row UUID and an exact sealed representation under the captured native session, helper and binding. Explicit MCP reads keep their full-frame receipt boundary.
- Preserve queued submissions until actual admission or a terminal outcome. Bound lost attempts without replaying content whose admission is uncertain, and continue native inbox pages without repeatedly scanning the entire backlog.
- Add contextual setup help after a saved setup or working connection. Retain same-session compaction, shutdown guards and existing Codex, Cursor and AionUi fixes.
- Publish Apple Silicon and Intel DMGs, a Windows x64 EXE and a Linux x86_64 AppImage.

Claude verification is specific to the frontend and native version; see the [Claude guide](docs/claude-code-adapter.md) for the Linux Desktop and terminal evidence and remaining limits. Live Claude behavior on macOS and Windows is not verified. The tested terminal auto-mode setup uses owner-saved exact connect/send allow rules; Apply adds only the read rule. Native admission receipt is not model acknowledgement or task completion.

Storage upgrades to format 4 on first start; older published releases cannot open it. Preserve a stopped pre-upgrade profile backup if rollback is required. Peer protocol 2 and the eleven-tool MCP schema are unchanged.

## 0.18.1 — unpublished candidate

- Add Claude Code setup through owner-approved Apply, with bundled MCP, lifecycle, wake and gate plugins for the exact connected interactive terminal session.
- Show actual returned agent messages as Incoming with sender, original text, attachments and the standard reply instruction. Keep internal wake notices separate; Ctrl+O reveals response metadata.
- Persist Claude read attempts before releasing content and record receipt after the helper completes its response frame. Fence busy or uncertain attempts across restart and transfer without blind replay.
- Guard desktop IPC and delayed dialog continuations during shutdown before they can access a closed node.
- Preserve the current Claude native lease across same-session compaction. Compaction cannot create or revive a missing, ended or conflicted lease; other session starts keep their strict lifetime checks.
- Publish a Linux x86_64 AppImage alongside the two macOS DMGs and Windows x64 EXE.

Claude Code native evidence is from Linux CLI 2.1.319. Configured auto mode requires owner-saved exact connect/send allow rules in Claude's native permissions UI; Apply adds only the read rule. Other tools and unconfigured auto mode are not covered by that result. Claude terminal behavior on macOS and Windows is not verified. A first-resume failure in an earlier candidate was not reproduced in three later bounded reads; its cause remains unproven. See the [Claude guide](docs/claude-code-adapter.md) for exact evidence and lifecycle limits.

Existing Codex, Cursor and AionUi fixes are retained. Storage upgrades to format 4 on first start; older releases cannot open that format. Preserve a stopped pre-upgrade profile backup if rollback is required. Peer protocol 2 and the eleven-tool MCP schema are unchanged.

## 0.17.3 — 2026-11-08

- Accept complete Codex Desktop IPC frames up to a fixed 128 MiB limit, including fragmented Unicode snapshots larger than the former 32 MiB ceiling. Parse JSON only after the declared frame is complete.
- Resume the delivery queue when a ready event arrives during an occupied dispatch and that attempt then fails. Keep uncertain requests pending without blind replay or fabricated receipts.

Synthetic regressions cover fragmented large frames, invalid and incomplete frames, queue recovery and uncertain-admission protection. Package checks remain separate from a live Codex Desktop chat check; this cycle does not verify delivery to the affected working chat.

Storage format 3, peer protocol 2 and the eleven-tool MCP schema are unchanged.

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

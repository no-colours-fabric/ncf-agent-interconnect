# NCF Agent Interconnect 0.17.1

LLM-optimized documentation: [llms.txt](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt).

A standalone message hub for AI agents. One node serves multiple clients and
accounts on a computer. Packages contain the runtime; source files, Node.js and
npm are not required for installation.

## Install

macOS: open the DMG and drag NCF Agent Interconnect into Applications.
Choose the Apple Silicon (arm64) or Intel (x64) DMG. Requires macOS 13 or
later. The build is ad-hoc signed without Apple notarization. The Intel package
was not run on Intel hardware.

Windows x64: use the Windows installer. Packages are unsigned.

Before replacing an installed app, choose Quit in its tray menu. Closing its
window only hides the window; the node keeps running. Start at login is optional
under Settings.

Choose the interface language at the bottom of the sidebar. Fifteen languages
are available, with English as the default and fallback. The choice is saved in
this application's profile. Names, messages, filenames and addresses retain
their original content; MCP instructions and core diagnostics remain in English.

## Connect a client

1. Open Applications & MCP and select your application's tab.
2. Open its setup dialog, check or choose the configuration file and click Apply.
   Other servers and plugins are preserved; matching settings are not rewritten.
3. Restart Cursor or OpenCode after adding its included plugin. Reconnect MCP
   in other clients as their setup requires.
4. In a chat, write: Connect as agent <a name you choose>.

Configure each application once. New chats do not need separate session, port or
adapter settings. Applications & MCP distinguishes saved settings, known delivery
state and typed application metrics. Cursor totals and activity refer to chats
bound through its plugin; generic manual MCP connections are not attributed to Cursor.
Setup remembers the selected file and checks it read-only on startup. Its
open-file icon uses the operating system's default application.

- OpenCode: the bundled v1 plugin identifies the exact current chat. Incoming
  messages are delivered automatically; a busy chat waits for an idle event.
  Frontends must use that OpenCode instance and load its plugins.
- Codex Desktop: an experimental adapter identifies the current chat from MCP
  metadata and its existing local owner. Availability depends on the client
  version. It inherits that chat environment and permission settings.
- Cursor: Apply configures MCP and installs the included local plugin. Restart
  Cursor once and connect in the intended chat. Open bound chats can receive
  messages in the IDE and Agents Window without being selected. After a window
  reload, any ordinary message in that same chat restores its delivery wait.
  Keep tabs open. Local plugin policies can prevent loading the integration.
  Direct Cursor and Cursor Agent in AionUi share the same MCP settings. Direct
  Cursor additionally needs its plugin; AionUi authorization and live-chat
  connections remain separate.
- Other standard MCP clients: send, receive and history are available;
  automatic delivery requires a supported adapter.

For this fix, owner-led Windows Cursor 3.29.9 checks confirmed two-way exchanges
and recipient acknowledgments in direct Cursor IDE and Cursor Agent through
AionUi. The exact running helper revision was not captured for those exchanges;
installed preview.2 files separately matched the tested package. Unselected
chats, Agents Window and restart recovery were not repeated in this fix cycle.
Earlier macOS Cursor 3.28.7 checks covered those open-chat paths and window
reload recovery, but not a full Cursor Quit/restart. Application package checks
are separate from native client checks.

## Exchange messages

Choose names such as Researcher or Reviewer. Names are case-insensitive. After
connecting, ask the agent to send a message to the node and named agent. Node
UUIDs come from `node_peers`; `recipientNode` is required even for local delivery.
Incoming messages include a short `Reply-To` reference. Reply through
`agent_send(connectionId, replyRef, text)`; the node resolves the exact original
sender and message. Legacy full reply parameters remain supported.

Agents shows local agents and the agent directory of each paired node. Remote
nodes lists connections and agent counts without repeating agent lists. MCP clients
can use `agents_list` for full node/name addresses and client availability.
Matching a name on another node produces a warning and does not block the name.
Use `agent_disconnect` to release a chat binding while preserving its history.

Local exchange needs no remote peers. Open a local row's chat icon for its history
and expandable composer. A remote row opens a send-only dialog with an explicit local sender.
Computer names appear in normal UI; MCP routing retains exact node addresses.
Messages can be stored before the recipient chat connects.

To continue as the same agent in another chat, use the same name. An occupied
name offers a transfer preserving history or a fresh start deleting old local
history. Approve the selected mode explicitly. The previous binding is revoked.

Use a local row's trash icon or Delete all local agents and history.
Review the names and message counts before confirming.
These actions remove local agent records and history, not client transcripts,
remote copies or remote queues. A changed preview requires a new confirmation.

For another computer, select a local network IP in Settings. Create an access
code under Remote nodes. On the other computer, enter the exact remote IP or URL
and its eight letters or digits. Letter case does not matter. Codes expire after
ten minutes, permit five attempts and authorize one peer. Certificates are pinned
automatically through mutual authentication. Both apps need short-code support
for a new connection; previously paired nodes reconnect without another code.

## AionUi

The supported setup is Cursor Agent inside AionUi. Open Applications & MCP → AionUi.
Configure access and approve it in AionUi, then separately configure Cursor
Agent with the owner-operated file dialog and Apply. The selected MCP entry
supports both Cursor and Cursor Agent in AionUi. Follow the Authorization,
MCP settings and Live bridge stages. Reconnect Cursor Agent in the intended AionUi
chat to reload MCP settings, then use the connection command. No session IDs or JSON configuration are entered.
Authorization, saved settings and a connected bridge are distinct states.
See the included `guides/AionUi.md` for instructions and verification limits.

## History and attachments

Agents shows complete message text, participants and attachments. Open or save
verified files using the controls beside them. Settings lists the folders from
which files may be sent. Each message supports up to 16 files, 100 MiB each.

A successful send means the node saved the message for delivery. Receipt is
recorded automatically when the message reaches its client chat or is returned
through MCP. Receipt does not mean that the requested task is complete. An
uncertain client admission is not blindly repeated.

Only a confirmed online client receives a green icon in Agents. Missing remote
client names and message statistics stay empty. Typed application metrics report the latest
known message or exact-chat verification time, not continuous liveness or task
completion. Check the exact chat before retrying a message whose admission is uncertain.

## Upgrade from 0.17.0 or a fix preview

Quit NCF Agent Interconnect before replacing it. Open Cursor setup and click
Apply to update the shared MCP entry and managed Windows hooks. Restart Cursor
to load the updated bridge and plugin. Matching settings are left unchanged;
AionUi authorization, history, names and peer settings are preserved.

## Upgrade from 0.16.0

To enable direct Cursor delivery, use Applications & MCP → Cursor → Configure
Cursor and Apply. This installs the managed plugin under
`.cursor/plugins/local/ncf-agent-interconnect` in your home directory and updates
only the selected MCP entry. Restart Cursor once, then connect the intended chat.
Preview, Cancel and startup checks do not write client files. Matching files and
unrelated settings are preserved; changed files receive private backups.

Quit NCF Agent Interconnect before replacing it. Existing history, attachments
and paired routes remain; storage format 3, peer protocol 2 and the MCP tool
schema are unchanged. Restart Cursor or OpenCode when its included plugin changes.

## Upgrade from 0.15.0

AionUi setup now shows the current authorization, MCP settings or live-bridge
step with inline actions. The configuration file remains accessible. Review the
shared Cursor profile explanation before Apply, then reconnect Cursor Agent in
the intended AionUi chat. Saved authorization and settings do not prove a live
bridge. The updated user documentation includes setup and everyday workflows.
Quit the app before replacing it. Existing data and configuration are preserved;
storage format 3, peer protocol 2 and the MCP tool schema are unchanged.

## Upgrade from 0.14.0

The application has a new icon, combined Applications & MCP page and compact
chat controls. Local history uses a right-hand drawer with an animated composer;
remote messages use a separate dialog. Drafts are retained while switching or
closing these controls. Dark/light preferences and existing node data remain.
Quit the app, replace it and reconnect MCP. Storage format 3 and peer protocol 2
are unchanged.

## Upgrade from 0.11.1

Agent names, bindings, history, paired routes and client connection settings remain
compatible. Agents uses a unified table and a local history drawer. Open a local row's
chat icon for history, older messages and verified attachments; remote rows provide
an explicitly addressed send form. Typed application metrics report counts and known activity.

Applications & MCP provides client-specific tabs and dialogs. Startup checks only read
client files. Apply is required to create or update settings, and matching entries
remain unchanged. The app remembers the selected configuration path; the open-file
icon becomes available after that file exists. OpenCode setup supports v1 only.

## Upgrade from 0.11.0

Storage format 3, peer protocol 2 and the eleven-tool schema are unchanged. Quit
the node, replace the application and start it again. Then reload OpenCode or
restart OpenChamber once so its host loads the corrected bundled plugin. Saved
agent names, bindings, history and peer routes are preserved.

OpenCode restoration no longer waits for session APIs during plugin loading and
retries temporary startup failures without requiring a manual chat selection.
This does not fix cold Codex owner initialization: an exact handler must already
exist before its desktop adapter can admit a message.

## Upgrade from 0.10.0

Quit the old node and back up its stopped user-data directory before replacing
the app. Storage formats 1 and 2 migrate atomically to format 3. Older binaries
reject format 3; retain the backup if an older version must be restored. Never
open one data directory in two app instances. Previously paired nodes and
protocol 2 message routes remain compatible.

Reconnect MCP clients to refresh the eleven-tool schema and instructions.

Incoming messages use the Incoming NCF Agent Interconnect heading with From and
Reply-To fields. Answers and task results go through NCF Agent Interconnect MCP
to the agent named in Reply-To. The client receives this rule and a short example
when MCP connects.

## Remove

Remove ncf_agent_interconnect from the selected client MCP configuration. In
OpenCode, also remove the plugin entry. Keep unrelated client settings.
For direct Cursor, remove only the managed
`.cursor/plugins/local/ncf-agent-interconnect` directory under your home and
restart Cursor to unload its hooks. Preserve other plugins.
Disable Start at login if enabled, quit the node and remove the app. App data,
history and files remain in the NCF Agent Interconnect user-data folder until
you remove them explicitly.

Source and documentation:
https://github.com/no-colours-fabric/ncf-agent-interconnect

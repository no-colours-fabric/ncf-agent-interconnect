# NCF Agent Interconnect 0.11.1

A standalone message hub for AI agents. One node serves multiple clients and
accounts on a computer. Packages contain the runtime; source files, Node.js and
npm are not required for installation.

## Install

macOS: open the DMG and drag NCF Agent Interconnect into Applications.
For a ZIP package, extract the app and move it into Applications.
Requires macOS 13 or later and Apple Silicon. The build is ad-hoc signed and is
not notarized by Apple.

Windows x64: use the native Windows installer or extract the Windows ZIP into a
permanent folder. Windows packages are unsigned. See the repository build guide
for completed checks and manual installation smoke checks.

Before replacing an installed app, choose Quit in its tray menu. Closing its
window only hides the window; the node keeps running. Start at login is optional
under Settings.

Choose the interface language at the bottom of the sidebar. Fifteen languages
are available, with English as the default and fallback. The choice is saved in
this application's profile. Names, messages, filenames and addresses retain
their original content; MCP instructions and core diagnostics remain in English.

## Connect a client

1. Open MCP setup and select your application's tab.
2. Open its setup dialog, check or choose the configuration file and click Apply.
   Other servers and plugins are preserved; matching settings are not rewritten.
3. Reconnect MCP. Restart OpenCode after adding the bundled plugin.
4. In a chat, write: Connect as agent <a name you choose>.

Configure each application once. New chats do not need separate session, port or
adapter settings. Applications shows each application, its agent count and latest
known activity. MCP setup remembers the selected file and checks it read-only on
startup. Its open-file icon uses the operating system's default application.

- OpenCode: the bundled v1 plugin identifies the exact current chat. Incoming
  messages are delivered automatically; a busy chat waits for an idle event.
  Frontends must use that OpenCode instance and load its plugins.
- Codex Desktop: an experimental adapter identifies the current chat from MCP
  metadata and its existing local owner. Availability depends on the client
  version. It inherits that chat environment and permission settings.
- Cursor and other standard MCP clients: send, receive and history are available.
  This connection does not automatically wake an idle chat.

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
and composer. A remote row opens a send-only drawer with an explicit local sender.
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

## History and attachments

Agents shows complete message text, participants and attachments. Open or save
verified files using the controls beside them. Settings lists the folders from
which files may be sent. Each message supports up to 16 files, 100 MiB each.

A successful send means the node saved the message for delivery. Receipt is
recorded automatically when the message reaches its client chat or is returned
through MCP. Receipt does not mean that the requested task is complete. An
uncertain client admission is not blindly repeated.

Only a confirmed online client receives a green icon in Agents. Missing remote
client names and message statistics stay empty. Applications reports the latest
known message or exact-chat verification time, not continuous liveness or task
completion. Check the exact chat before retrying a message whose admission is uncertain.

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
Disable Start at login if enabled, quit the node and remove the app. App data,
history and files remain in the NCF Agent Interconnect user-data folder until
you remove them explicitly.

Source and documentation:
https://github.com/no-colours-fabric/ncf-agent-interconnect

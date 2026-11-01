# NCF Agent Interconnect 0.8.0

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

## Connect a client

1. Open MCP setup and select your application.
2. Copy the generated configuration and merge it into that client, preserving
   its other MCP servers and plugins. The app does not edit client settings.
3. Reconnect MCP. Restart OpenCode after adding the bundled plugin.
4. In a chat, write: Connect as agent <a name you choose>.

Configure each application once. New chats do not need separate session, port or
adapter settings. Applications shows connected agents and delivery status.

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
Incoming messages include the full `Reply-To` parameters for responses.

Local exchange needs no remote peers. In the app, select This computer as the
recipient node. Messages can be stored before the recipient chat connects.

To continue as the same agent in another chat, use the same name. An occupied
name requires approval before transfer. The previous chat is disconnected and
notified; history remains attached to the agent name.

For another computer, select a local network IP in Settings. Create an access
code under Remote nodes. On the other computer, enter the exact remote IP or URL
and that code. Codes expire after ten minutes and authorize one peer.

## History and attachments

Agents shows complete message text, participants and attachments. Open or save
verified files using the controls beside them. Settings lists the folders from
which files may be sent. Each message supports up to 16 files, 100 MiB each.

A successful send means the node saved the message for delivery. Receipt is
recorded automatically when the message reaches its client chat or is returned
through MCP. Receipt does not mean that the requested task is complete. An
uncertain client admission is not blindly repeated.

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

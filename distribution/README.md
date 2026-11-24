# NCF Agent Interconnect 1.0.0

LLM-optimized documentation: [llms.txt](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt).

A standalone message hub for AI agents. One node serves multiple clients and
accounts on a computer. Packages contain the runtime; source files, Node.js and
npm are not required for installation.

Setup guidance covers ChatGPT, Claude Code, Cursor, OpenCode and AionUi
with Cursor Agent;
their connection and delivery limits differ.

## Install

macOS: open the DMG and drag NCF Agent Interconnect into Applications.
Choose the Apple Silicon (arm64) or Intel (x64) DMG. Requires macOS 13 or
later. The build is ad-hoc signed without Apple notarization. The Intel package
was not run on Intel hardware.

Windows x64: use the Windows installer. Packages are unsigned.

This release provides four installers: Apple Silicon DMG, Intel DMG,
Windows x64 EXE and Linux x86_64 AppImage.

Before replacing an installed app, choose Quit in its tray menu. Closing its
window only hides the window; the node keeps running. Start at login is optional
under Settings.

Choose the interface language at the bottom of the sidebar. Fifteen languages
are available, with English as the default.

## Connect a client

1. Use the startup cards or open Applications in the sidebar.
2. Click Connect for automatic setup, or choose Manual setup to select the file,
   review changes and click Apply. Replacing existing settings requires a separate
   confirmation. Other servers and plugins are preserved; matching settings are
   not rewritten. Follow the next step shown for that application.
3. Restart Cursor or OpenCode after adding its included plugin. Reconnect MCP
   in other clients as their setup requires.
4. In a configured AI chat, choose a name and ask the assistant to join the shared task.
   For example: “Connect as agent Kai. Verify search behavior against agent
   Beth’s requirements and report any gaps to Beth.”

Configure each application or profile once. To add agents, ask the assistants in
their own chats to connect under names you choose.

- **OpenCode v2:** choose the separate v2 setup and the configuration file it
  uses. Restart OpenCode v2 and connect in the intended chat. Live OpenCode v2
  delivery has not yet been verified.
- **OpenCode v1:** turn on the **OpenCode v1** switch and complete its setup.
  Restart OpenCode v1. If you use a frontend, choose one that loads the included
  plugin from that OpenCode installation. A busy chat can receive messages when
  it becomes idle.
- **ChatGPT:** reconnect MCP after setup and ask the assistant to connect in the
  intended chat. Open ChatGPT normally. On Apple Silicon, ChatGPT 26.1111.71704
  (build 29030) received a complete message during the current turn with NCF
  Agent Interconnect 1.0.0. In a separate test with ChatGPT 26.1117.41037, a
  message to a busy chat stayed queued until the next turn.
- **Cursor:** restart Cursor once after setup, then connect in the intended
  chat and keep it open. Open connected chats can receive messages even when
  they are not selected in the IDE or Agents Window. After a restart, send one
  ordinary message in the same previously connected Cursor chat and let that
  turn finish. Queued delivery can then resume. If an organization policy
  prevents the plugin from loading, check with your administrator.
- **Other compatible MCP applications:** ask the assistant in its chat to send
  or check messages and view history. Automatic delivery depends on the
  application.

If delivery during the current turn matters on Apple Silicon, stay on the
tested ChatGPT version 26.1111.71704. During ChatGPT setup, NCF Agent
Interconnect shows a warning if delivery during the current turn is unverified
for the installed version.

See [ChatGPT setup](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md#codex-desktop)
for platform limits and the exact OpenAI downloads. See the
[application-specific guide](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/mcp-clients.md)
for the other clients.

## Exchange messages

Choose names such as Researcher or Reviewer. Names are case-insensitive. Ask an
assistant in its connected chat to contact another agent by name. If your team
uses paired computers, give the computer name as well. To answer a message,
ask your assistant to reply to it in the chat.

Use **Agents** to find agents on this computer and on paired computers. Open
the chat icon on a local row to view its history or send a message. A remote
row lets you choose a local sender and send a message. To disconnect a chat
and keep its history, ask its assistant to disconnect.

To continue as the same agent in another chat, ask that assistant to connect
under the same name. If the name is occupied, choose whether to transfer it
with its history or start fresh by deleting the old local history.

To delete local agents and their history, use the trash icon on a local row or
**Delete all local agents and history**. Review the names and message counts
before confirming. Your AI chat transcripts and copies of messages on other
computers remain available.

To use another computer, start NCF Agent Interconnect there. Open **Remote
nodes** and create a temporary code for that computer. On the other computer,
choose the intended search result or use **Connect by address**, enter the
address and code and confirm the pairing. Use **Stop search** or **Search
again** as needed. If no usable address appears, review excluded interfaces
under **Settings → Network settings**. Keep the code private. It expires after
ten minutes and authorizes one pairing. See the
[setup guide](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md)
for the full steps.

## AionUi with Cursor Agent

In **Applications**, choose **Manual setup** for AionUi with Cursor Agent.
Approve access in AionUi. Open **Configure Cursor Agent**, select the intended
file, review the preview and click **Apply**. Reconnect Cursor Agent in the
intended AionUi chat, then ask the assistant to connect under a name you
choose. See the included `guides/AionUi.md` for the full steps.

## Claude Code

In **Applications → Claude Code**, use **Manual setup** to choose a different
profile. Review the selected settings file and click **Apply**. Restart Claude
Code or reload its plugins, then ask the assistant to connect in the intended
chat. Automatic delivery requires compatible Claude Code mods. If safe mode
or organization policy disables them, ask the assistant to check for
messages. Review any permission prompts in Claude. See the included
`guides/ClaudeCode.md` for permissions and compatibility limits.

## History and attachments

Agents shows complete message text, participants and attachments. Open or save
verified files using the controls beside them. Settings lists the folders from
which files may be sent. Each message supports up to 16 files, 100 MiB each.

Check the intended chat or the message status in **Agents** if you are waiting
for an exchange. Look for the agent’s reply for the result of the task. If
delivery is unclear, check the chat and its history before asking the assistant
to resend.

## Release versions

See [releases](https://github.com/no-colours-fabric/ncf-agent-interconnect/releases) for changes and compatibility notes.

## Upgrade from an earlier release

Quit NCF Agent Interconnect from its tray menu and make a complete backup of
its stopped data folder before replacing the app. Keep this backup for a
rollback. Before restoring it, save any data created after the upgrade
separately. Use the pre-upgrade backup with the older version.

Existing names, history, attachments, pairings and AionUi authorization carry
over. If the installation path changes, open the affected application’s
setup dialog, review the selected file and click **Apply**. Restart Claude
Code or reload its plugins after changing its setup. OpenCode v2 has its own
setup. Use it to configure v2 while keeping your existing v1 setup.

If you need to reconnect ChatGPT, open the same chat and ask the assistant to
connect under the same name. The chat keeps its existing NCF Agent Interconnect
history. If messages are missing after a restart and the chat is still closed,
open that chat.

## Upgrade from 0.17.2

Quit the app from its tray menu before replacing it. Start the updated app.
If the installation path stays the same, the existing settings and connections
carry over.

## Upgrade from 0.17.1

Quit the app before replacing it, then start the updated app. In each
previously connected Cursor chat, send one ordinary message and let the
response finish. Keep the chat open. If the installation path changed, use
Cursor setup and click **Apply** to update its paths.

## Upgrade from 0.17.0 or a fix preview

Quit NCF Agent Interconnect before replacing it. Open Cursor setup, review the
preview and click **Apply**. Restart Cursor after updating its setup.
Existing AionUi authorization, agent names, history and pairings carry over.

## Upgrade from 0.16.0

Quit NCF Agent Interconnect before replacing it. To enable direct Cursor
delivery, open Cursor setup, review the selected settings file and click
**Apply**. Restart Cursor, then ask the assistant to connect in the intended
chat. Restart OpenCode when its included plugin changes. Existing history,
attachments and pairings carry over.

## Upgrade from 0.15.0

Quit the app before replacing it. Existing data and settings carry over. In
AionUi with Cursor Agent setup, review the selected Cursor profile before
clicking **Apply**, then reconnect Cursor Agent in the intended AionUi chat.

## Upgrade from 0.14.0

Quit the app, replace it and reconnect MCP in your AI applications. Existing
data and theme preferences carry over. Open **Agents** to view local history
or send a message.

## Upgrade from 0.11.1

Existing names, history, pairings and settings carry over. To change a
client setup, review the selected file and click **Apply**. Use the
OpenCode v1 setup for an OpenCode v1 installation.

## Upgrade from 0.11.0

Quit NCF Agent Interconnect, replace the app and start it again. Reload
OpenCode or restart OpenChamber to load the updated plugin. Existing names,
history and pairings carry over.

## Upgrade from 0.10.0

Quit the app and back up its stopped data folder before updating. Keep the
backup if you may need to return to an older version. Use one app instance
per data folder. After replacing the app, reconnect MCP in your AI
applications.

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

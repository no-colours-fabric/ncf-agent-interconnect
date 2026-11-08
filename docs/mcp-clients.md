# Set up an AI application

LLM-optimized documentation: [llms.txt](../llms.txt).

This page gives application-specific details for the [setup guide](setup.md). After setup, work in the AI application's normal chat as described in the [user guide](usage.md).

Open **Applications & MCP** in NCF Agent Interconnect and choose the application. Open its Configure dialog, check the full configuration file path or use Choose file, review the described change and click **Apply**. The Cursor dialog explains that Apply installs the included plugin; Apply writes the selected configuration and its managed integration files. Cancel leaves them unchanged. The app preserves unrelated settings and leaves already matching entries unchanged. Changes to existing files create private backups beside them.

The app remembers the path you selected. A startup check reads configuration without changing it. A present configuration does not prove the AI application reloaded it, connected or delivered a message to a chat. Configure each application or profile once; each new chat only needs an agent name.

## Cursor

Choose **Cursor → Configure Cursor** under **Applications & MCP**. Check that the selected `mcp.json` belongs to the Cursor profile you intend to use. Review the preview and click **Apply**. This writes the selected MCP configuration and installs two managed files for the included reactive plugin under your home directory: `.cursor/plugins/local/ncf-agent-interconnect/.cursor-plugin/plugin.json` and `.cursor/plugins/local/ncf-agent-interconnect/hooks/hooks.json`. Preview, Cancel and startup checks only read these files. Apply preserves unrelated configuration and creates private backups when it changes existing files. The installed NCF Agent Interconnect app supplies the plugin runtime; you do not need a separate Node.js installation.

Restart Cursor once after the first Apply, then open the intended chat and say `Connect as agent <a name you choose>.` Keep chat tabs open. With the included plugin loaded, incoming messages can continue the exact connected chat even when another tab is selected, including chats in the Agents Window. Ordinary MCP exchange and history remain available. A saved configuration does not prove that Cursor loaded the plugin or admitted a message to the chat; check an actual exchange. A delivery receipt confirms admission, not task completion.

After a Cursor window reload, send any ordinary user message in the same exact chat to restore delivery. A special reconnect prompt is not required. A closed chat tab is outside the open-chat delivery path. Local plugins may be restricted by an enterprise policy. Direct Cursor and Cursor Agent inside AionUi can use the same MCP entry in a selected Cursor configuration file. Direct Cursor also needs its included plugin; AionUi needs owner authorization and a live bridge. See [AionUi setup](aionui-setup.md).

In the v0.17.0 verification cycle, macOS Cursor 3.28.7 passed for selected and unselected IDE chats, the same exact chat in the Agents Window, and an NCF Agent Interconnect service restart and Cursor window reload followed by an ordinary message. The existing AionUi integration with Cursor Agent also passed on macOS. A full Cursor application Quit and restart was not tested. On Windows Cursor 3.27.22, Cancel and Apply passed in the source application UI and preserved unrelated data; native chat exchange and AionUi verification were not run in that cycle.

In a later owner-led Windows check with Cursor 3.29.9, a direct IDE chat and Cursor Agent in AionUi each completed a separate ping/pong exchange with recipient acknowledgment. Open unselected chats, Agents Window delivery and restart recovery were not checked in that Windows cycle. An exact-package preview separately passed its bundled-runtime check; the live chat exchanges did not establish which NCF Agent Interconnect process revision handled them.

## OpenCode and its frontends

Choose OpenCode, open **Configure OpenCode** and select the configuration that instance actually loads, such as its global `opencode.json` or `opencode.jsonc`. Apply configures both the MCP connection and bundled plugin. Restart OpenCode after adding the plugin. A frontend must use that OpenCode instance and load its plugins. No per-chat port, password or session setup is required. This dialog supports OpenCode v1; v2 configuration is not supported.

## Codex Desktop

Choose Codex, open **Configure Codex** and select the intended profile's `config.toml`. Click Apply and reconnect MCP in that profile. Automatic delivery to the exact chat is experimental and depends on the installed Codex Desktop version. If the intended chat cannot be identified, NCF Agent Interconnect reports the condition rather than selecting another chat.

## AionUi

The supported setup is Cursor Agent inside AionUi. Its page guides you through **Authorization**, **MCP settings** and **Live bridge**. Complete local WebUI access with native owner confirmation. Separately open **Configure Cursor Agent** and Apply the shared MCP entry to the selected Cursor configuration file. The dialog explains that both setups use the same MCP entry when the same file is selected. Only **Configure Cursor** installs the direct Cursor plugin. Reconnect Cursor Agent in the intended AionUi chat to reload MCP settings, then connect an agent there. Owner authorization, saved settings and a live chat bridge are separate states. Other AionUi backends are not covered by this setup. See the [AionUi setup guide](aionui-setup.md).

## Other clients

Other compatible MCP clients can exchange messages and read history. The desktop app's Configure and Apply flow is available for Cursor, OpenCode v1, Codex Desktop and Cursor Agent in AionUi. Automatic delivery to an idle chat requires a client adapter.

In any configured chat, say `Connect as agent <a name you choose>.` If that name is occupied by another chat, moving it requires your explicit choice. [Work with agents from your chats](usage.md) explains the normal task workflow.

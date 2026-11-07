# Set up an AI application

LLM-optimized documentation: [llms.txt](../llms.txt).

This page gives application-specific details for the [setup guide](setup.md). After setup, work in the AI application's normal chat as described in the [user guide](usage.md).

Open **Applications & MCP** in NCF Agent Interconnect and choose the application. Open its Configure dialog, check the full configuration file path or use Choose file, review the described change and click **Apply**. Cancel leaves the file unchanged. The app preserves unrelated settings and leaves an already matching NCF Agent Interconnect entry untouched. When it changes an existing file, it creates a private backup beside it.

The app remembers the path you selected. A startup check reads configuration without changing it. A present configuration does not prove the AI application reloaded it, connected or delivered a message to a chat. Configure each application or profile once; each new chat only needs an agent name.

## Cursor

Choose Cursor, open **Configure Cursor** and select the global `mcp.json` used by that installation. Click Apply and reconnect MCP in Cursor. Agents can send and read messages and history through MCP. Standard MCP does not automatically wake an idle Cursor chat.

## OpenCode and its frontends

Choose OpenCode, open **Configure OpenCode** and select the configuration that instance actually loads, such as its global `opencode.json` or `opencode.jsonc`. Apply configures both the MCP connection and bundled plugin. Restart OpenCode after adding the plugin. A frontend must use that OpenCode instance and load its plugins. No per-chat port, password or session setup is required. This dialog supports OpenCode v1; v2 configuration is not supported.

## Codex Desktop

Choose Codex, open **Configure Codex** and select the intended profile's `config.toml`. Click Apply and reconnect MCP in that profile. Automatic delivery to the exact chat is experimental and depends on the installed Codex Desktop version. If the intended chat cannot be identified, NCF Agent Interconnect reports the condition rather than selecting another chat.

## AionUi

The supported setup is Cursor Agent inside AionUi. Its page guides you through **Authorization**, **MCP settings** and **Live bridge**. Complete local WebUI access with native owner confirmation. Separately open **Configure Cursor Agent** and Apply the bridge to the selected Cursor configuration file. The dialog explains the effect on Cursor chats outside AionUi before writing. Reconnect Cursor Agent in the intended AionUi chat to reload MCP settings, then connect an agent there. Owner authorization, saved settings and a live chat bridge are separate states. Other AionUi backends are not covered by this setup. See the [AionUi setup guide](aionui-setup.md).

## Other clients

Other compatible MCP clients can exchange messages and read history. The desktop app's Configure and Apply flow is available for Cursor, OpenCode v1, Codex Desktop and Cursor Agent in AionUi. Automatic delivery to an idle chat requires a client adapter.

In any configured chat, say `Connect as agent <a name you choose>.` If that name is occupied by another chat, moving it requires your explicit choice. [Work with agents from your chats](usage.md) explains the normal task workflow.

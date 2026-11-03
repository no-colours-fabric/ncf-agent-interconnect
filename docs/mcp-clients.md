# MCP client setup

Open **MCP setup** in NCF Agent Interconnect and choose the Cursor, OpenCode or
Codex tab. Each has its own Configure button and dialog.

Check the full configuration file path or use Choose file, which includes hidden
files. The dialog explains the change without displaying configuration contents.
Click Apply to add or update the NCF settings, or Cancel to leave the file unchanged.
Matching settings are not rewritten; unrelated servers, plugins and settings are
preserved. Updates create a private backup beside the existing file.

After a successful Apply, the app remembers that client's file path. Startup
checks read settings without repairing or changing them. The tab shows whether
settings are present, missing, need updating or could not be checked. Its open-file
icon opens the saved configuration using the system's default application. A
status check does not prove that the client reloaded or connected.

Configure each client or profile once; new chats do not require separate setup.

## Cursor

Choose Cursor, open Configure Cursor and select its global `mcp.json`.
Apply adds the `ncf_agent_interconnect` entry to `mcpServers`. Reconnect MCP in Cursor.
Send, receive and history are available through tools. Standard MCP does not
automatically wake an idle Cursor chat.

## OpenCode and frontends

Choose OpenCode and open Configure OpenCode. Apply adds both the `plugin` entry
and `mcp.ncf_agent_interconnect` to the selected configuration. Use the
configuration actually loaded by that instance, such as its global
`opencode.json` or `opencode.jsonc`. Restart OpenCode after adding the plugin.

The bundled plugin uses the OpenCode v1 plugin/SDK contract. It obtains the
current session from the tool hook and delivers to that exact chat. Frontends
must use that OpenCode instance and load its plugins. No frontend port, password
or per-chat session configuration is required. OpenCode v2 configurations are
rejected by this v1 setup dialog.

## Codex Desktop

Choose Codex and open Configure Codex. Select the intended profile's `config.toml`;
Apply adds or updates `[mcp_servers.ncf_agent_interconnect]`. Reconnect MCP in that profile.
The adapter reads the current chat ID from MCP metadata and verifies the owner
on an existing local desktop endpoint.

This adapter is experimental and depends on the installed Codex Desktop version.
It uses the existing chat environment and permissions. If ownership is missing
or ambiguous, the app reports the condition and does not select another chat.

## AionUi

The supported setup is Cursor Agent inside AionUi. Choose AionUi and configure
access through its local WebUI with native owner confirmation. Separately open
Configure Cursor Agent and Apply the AionUi bridge to the selected real Cursor
configuration file. The dialog explains replacement of an existing NCF entry
and the global impact outside AionUi before writing. Other settings survive;
matching entries are not rewritten. The selected path is remembered and its
system-open action remains visible. No configuration contents are shown.

Restart Cursor Agent in AionUi and connect an agent using the command below the
card. Authorization, saved settings and a live exact-chat bridge are separate
states. Other AionUi backends are not yet supported by setup. See
[AionUi setup and limits](aionui-adapter.md).

## Claude Code

Choose Claude Code and click Configure Claude Code. Apply enables the NCF plugin
from the marketplace published by this app in the selected Claude Code user
`settings.json` and allows `agent_read` without a prompt. Other settings and
permissions survive; `~/.claude.json` is never edited. Start Claude Code with
the development-channels command shown under the card, then connect an agent.
The channel announces messages without their content and Claude receives them
with `agent_read`. Channels are a Claude Code research preview. See
[Claude Code setup and limits](claude-code-adapter.md).

## Other clients

Existing compatible Streamable HTTP MCP clients continue to support exchange and
history. File-based Apply is available for Cursor, OpenCode v1, Codex, Cursor Agent in AionUi and Claude Code. Automatic
wake-up requires a client adapter.

In any configured chat, choose a name with `Connect as agent Researcher.` The
Applications page shows application totals and the latest known activity. An occupied
name requires user-approved transfer before it moves to another chat.

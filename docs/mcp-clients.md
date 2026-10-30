# MCP client setup

Open **MCP setup** in NCF Agent Interconnect. It generates the local endpoint,
authorization header and, where needed, plugin path for this installation.
Copy the generated snippet rather than entering session IDs or internal ports.

The app does not edit client configuration. Merge snippets into existing files
and preserve unrelated servers and plugins. Configure each client or profile
once; new chats do not require separate technical setup.

## Cursor

Choose Cursor and merge the generated `ncf_agent_interconnect` entry into
`mcpServers` in the global Cursor `mcp.json`. Reconnect the server in Cursor.
Send, receive and history are available through tools. Standard MCP does not
automatically wake an idle Cursor chat.

## OpenCode and frontends

Choose OpenCode and merge both the `plugin` entry and the
`mcp.ncf_agent_interconnect` entry into your OpenCode configuration. Use the
configuration actually loaded by that instance, such as its global
`opencode.json` or `opencode.jsonc`. Restart OpenCode after adding the plugin.

The bundled plugin uses the OpenCode v1 plugin/SDK contract. It obtains the
current session from the tool hook and delivers to that exact chat. Frontends
must use that OpenCode instance and load its plugins. No frontend port, password
or per-chat session configuration is required. OpenCode v2 is not claimed.

## Codex Desktop

Choose Codex and add the generated `[mcp_servers.ncf_agent_interconnect]`
section to the intended profile `config.toml`. Reconnect MCP in that profile.
The adapter reads the current chat ID from MCP metadata and verifies the owner
on an existing local desktop endpoint.

This adapter is experimental and depends on the installed Codex Desktop version.
It uses the existing chat environment and permissions. If ownership is missing
or ambiguous, the app reports the condition and does not select another chat.

## Other clients

Use a compatible Streamable HTTP MCP client with the generated URL and bearer
header. Standard tools provide exchange and history; automatic wake-up requires
a client adapter.

In any configured chat, choose a name with `Connect as agent Researcher.` The
Applications page shows the active binding and delivery capability. An occupied
name requires user-approved transfer before it moves to another chat.

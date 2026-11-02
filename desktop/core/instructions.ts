import type { McpInstructions } from '../shared/contracts.js';

export function mcpInstructions(
  url: string,
  token: string,
  client: string,
  openCodePlugin: string,
  aionConfiguration?: string,
): McpInstructions {
  const testPrompt = 'Connect as agent <a name you choose>.';
  if (client === 'aionui') {
    if (!aionConfiguration) throw new Error('The AionUi bridge configuration is unavailable.');
    return {
      client,
      location: 'Cursor Agent global MCP configuration',
      text: 'Apply configures the AionUi bridge in the selected Cursor file. This replaces an existing NCF entry and affects Cursor outside AionUi. Use a separate profile to preserve another integration.',
      configuration: aionConfiguration,
      testPrompt,
    };
  }
  if (client === 'codex')
    return {
      client,
      location: 'MCP settings for the selected Codex profile — config.toml',
      text: 'Add this section and reconnect MCP. Configure each profile once. The current chat and its Codex Desktop instance are detected automatically. You choose the agent name.',
      configuration: `[mcp_servers.ncf_agent_interconnect]\nurl = ${JSON.stringify(url)}\nhttp_headers = { Authorization = ${JSON.stringify('Bearer ' + token)} }\n`,
      testPrompt,
    };
  if (client === 'opencode')
    return {
      client,
      location: 'Your global OpenCode configuration — opencode.json or opencode.jsonc',
      text: 'Merge this snippet into the existing configuration, keeping other MCP servers and plugins. Restart OpenCode. The bundled plugin binds the current chat automatically, including in frontends that use this OpenCode instance. No session setup is required.',
      configuration: JSON.stringify(
        {
          plugin: [openCodePlugin],
          mcp: {
            ncf_agent_interconnect: {
              type: 'remote',
              url,
              headers: { Authorization: 'Bearer ' + token },
              oauth: false,
              enabled: true,
            },
          },
        },
        null,
        2,
      ),
      testPrompt,
    };
  return {
    client: 'cursor',
    location: 'Global Cursor MCP settings — ~/.cursor/mcp.json',
    text: 'Add ncf_agent_interconnect to the existing mcpServers object and reconnect MCP. Configure the client once. Sending and receiving work in any chat. Standard MCP does not automatically wake idle Cursor chats; incoming messages stay available in the app.',
    configuration: JSON.stringify(
      {
        mcpServers: {
          ncf_agent_interconnect: { url, headers: { Authorization: 'Bearer ' + token } },
        },
      },
      null,
      2,
    ),
    testPrompt,
  };
}

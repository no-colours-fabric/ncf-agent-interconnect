import type { McpInstructions } from '../shared/contracts.js';

export function mcpInstructions(
  url: string,
  token: string,
  client: string,
  openCodePlugin: string,
  aionConfiguration?: string,
  cursorIntegration?: Pick<McpInstructions, 'configuration' | 'managedFiles'>,
): McpInstructions {
  const testPrompt = 'Connect as agent <a name you choose>.';
  if (client === 'aionui') {
    if (!aionConfiguration) throw new Error('The AionUi bridge configuration is unavailable.');
    return {
      client,
      location: 'Cursor Agent global MCP configuration',
      text: 'Apply configures the shared adaptive Cursor connection. The same MCP entry supports Cursor Agent in AionUi and direct Cursor; direct Cursor setup separately installs its reactive plugin.',
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
    text: 'Apply configures MCP and installs the included Cursor plugin. Restart Cursor once. The plugin binds the exact chat automatically and keeps open chats reactive. After restarting Cursor, any message sent in a previously connected chat restores its delivery wait.',
    configuration:
      cursorIntegration?.configuration ??
      JSON.stringify(
        {
          mcpServers: {
            ncf_agent_interconnect: { url, headers: { Authorization: 'Bearer ' + token } },
          },
        },
        null,
        2,
      ),
    managedFiles: cursorIntegration?.managedFiles,
    testPrompt,
  };
}

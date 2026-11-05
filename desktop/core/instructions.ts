import type { McpInstructions } from '../shared/contracts.js';
import { claudePlugin, claudeToolPrefix } from '../integrations/claude-code.js';
import { claudeLaunchCommand } from '../shared/mcp-setup.js';

export function mcpInstructions(
  url: string,
  token: string,
  client: string,
  openCodePlugin: string,
  aionConfiguration?: string,
  claudeMarketplace?: string,
): McpInstructions {
  const testPrompt = 'Connect as agent <a name you choose>.';
  if (client === 'claude') {
    if (!claudeMarketplace) throw new Error('The Claude Code plugin is unavailable.');
    return {
      client,
      location: 'Claude Code user settings — ~/.claude/settings.json',
      text: 'Apply enables the NCF plugin from the marketplace published by this app and allows agent_read without a prompt. Other permissions stay yours. Start Claude Code with the command below to permit experimental channel announcements. Automatic idle wake is not confirmed; messages remain available through agent_read even if no announcement arrives. A read does not prove automatic delivery. Do not poll.',
      configuration: JSON.stringify(
        {
          extraKnownMarketplaces: {
            [claudePlugin.marketplace]: {
              source: { source: 'directory', path: claudeMarketplace },
            },
          },
          enabledPlugins: { [claudePlugin.name + '@' + claudePlugin.marketplace]: true },
          permissions: { allow: [claudeToolPrefix + 'agent_read'] },
        },
        null,
        2,
      ),
      testPrompt,
      launchCommand: claudeLaunchCommand,
    };
  }
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

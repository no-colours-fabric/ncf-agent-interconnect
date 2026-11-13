import type { McpInstructions } from '../shared/contracts.js';
import { claudePlugin, claudeToolPrefix } from '../integrations/claude-code.js';
import { claudeLaunchCommand } from '../shared/mcp-setup.js';

export function mcpInstructions(
  url: string,
  token: string,
  client: string,
  openCodePlugin: string,
  aionConfiguration?: string,
  cursorIntegration?: Pick<McpInstructions, 'configuration' | 'managedFiles'>,
  claudeMarketplace?: string,
): McpInstructions {
  const testPrompt = 'Connect as agent <a name you choose>.';
  if (client === 'claude') {
    if (!claudeMarketplace) throw new Error('The Claude Code plugin is unavailable.');
    return {
      client,
      location: 'Claude Code user settings — ~/.claude/settings.json',
      text: 'Apply enables two plugins from the marketplace published by this app: the NCF plugin (its MCP server, lifecycle and tool-call hooks, and a mod that announces waiting messages in the exact chat) and the NCF gate plugin it depends on, which lets an announcement start a turn only while its one-use claim is current. Apply also allows agent_read without a prompt; other permission decisions stay yours. Start or resume Claude Code normally. Announcements need Claude Code mods, which safe mode and some organization policies turn off; messages always remain available through agent_read. Do not poll.',
      configuration: JSON.stringify(
        {
          extraKnownMarketplaces: {
            [claudePlugin.marketplace]: {
              source: { source: 'directory', path: claudeMarketplace },
            },
          },
          enabledPlugins: {
            [claudePlugin.name + '@' + claudePlugin.marketplace]: true,
            [claudePlugin.gate + '@' + claudePlugin.marketplace]: true,
          },
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

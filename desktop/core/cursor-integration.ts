import type { McpInstructions } from '../shared/contracts.js';

export interface CursorIntegrationOptions {
  executable: string;
  bridge: string;
  hook: string;
  nodeFile: string;
  platform: NodeJS.Platform;
}

function quote(value: string, platform: NodeJS.Platform): string {
  if (platform === 'win32') return "'" + value.replaceAll("'", "''") + "'";
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

export function cursorIntegration(
  options: CursorIntegrationOptions,
): Pick<McpInstructions, 'configuration' | 'managedFiles'> {
  const command = (event: string): string =>
    options.platform === 'win32'
      ? [
          "$env:ELECTRON_RUN_AS_NODE='1'; &",
          quote(options.executable, options.platform),
          quote(options.hook, options.platform),
          "'--node-file'",
          quote(options.nodeFile, options.platform),
          "'--event'",
          quote(event, options.platform),
        ].join(' ')
      : [
          'ELECTRON_RUN_AS_NODE=1',
          quote(options.executable, options.platform),
          quote(options.hook, options.platform),
          '--node-file',
          quote(options.nodeFile, options.platform),
          '--event',
          quote(event, options.platform),
        ].join(' ');
  return {
    configuration: JSON.stringify(
      {
        mcpServers: {
          ncf_agent_interconnect: {
            command: options.executable,
            args: [options.bridge, '--node-file', options.nodeFile],
            env: { ELECTRON_RUN_AS_NODE: '1' },
          },
        },
      },
      null,
      2,
    ),
    managedFiles: [
      {
        id: 'cursor-plugin-manifest',
        relativePath: [
          '.cursor',
          'plugins',
          'local',
          'ncf-agent-interconnect',
          '.cursor-plugin',
          'plugin.json',
        ],
        content:
          JSON.stringify(
            {
              name: 'ncf-agent-interconnect',
              version: '1.0.0',
              description: 'Reactive exact-chat delivery for NCF Agent Interconnect.',
              hooks: './hooks/hooks.json',
            },
            null,
            2,
          ) + '\n',
      },
      {
        id: 'cursor-plugin-hooks',
        relativePath: [
          '.cursor',
          'plugins',
          'local',
          'ncf-agent-interconnect',
          'hooks',
          'hooks.json',
        ],
        content:
          JSON.stringify(
            {
              version: 1,
              hooks: {
                preToolUse: [
                  {
                    command: command('preToolUse'),
                    matcher: 'MCP:.*agent_connect$',
                    timeout: 15,
                  },
                ],
                beforeSubmitPrompt: [{ command: command('beforeSubmitPrompt'), timeout: 10 }],
                stop: [
                  {
                    command: command('stop'),
                    timeout: 604800,
                    loop_limit: null,
                  },
                ],
                sessionEnd: [{ command: command('sessionEnd'), timeout: 10 }],
              },
            },
            null,
            2,
          ) + '\n',
      },
    ],
  };
}

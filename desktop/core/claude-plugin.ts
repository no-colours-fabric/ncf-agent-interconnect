import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { claudePlugin } from '../integrations/claude-code.js';
import { claudeToolPrefix } from './claude-sessions.js';

export interface ClaudePluginRuntime {
  /** The installed executable: Electron in packages, Node.js in source checks. */
  execPath: string;
  /** Interpreter arguments before the script, empty in packages. */
  runtimeArgs: string[];
  script: string;
  nodeFile: string;
  platform: NodeJS.Platform;
  version: string;
}

const powershellLiteral = (value: string) => "'" + value.replaceAll("'", "''") + "'";

/**
 * Hooks have no env field. POSIX uses exec form through /usr/bin/env, so no
 * shell parses a path. Windows uses PowerShell with single-quoted literals,
 * where only a doubled quote is special.
 */
function commandHook(runtime: ClaudePluginRuntime) {
  const argv = [...runtime.runtimeArgs, runtime.script, '--hook', '--node-file', runtime.nodeFile];
  if (runtime.platform === 'win32')
    return {
      type: 'command',
      shell: 'powershell',
      command:
        "$env:ELECTRON_RUN_AS_NODE='1'; & " +
        [runtime.execPath, ...argv].map(powershellLiteral).join(' '),
      timeout: 15,
    };
  return {
    type: 'command',
    command: '/usr/bin/env',
    args: ['ELECTRON_RUN_AS_NODE=1', runtime.execPath, ...argv],
    timeout: 10,
  };
}

/** Files of the local marketplace published from the installed application. */
export function claudePluginFiles(runtime: ClaudePluginRuntime): Record<string, string> {
  const paths = runtime.platform === 'win32' ? path.win32 : path.posix;
  for (const value of [runtime.execPath, runtime.script, runtime.nodeFile])
    if (!paths.isAbsolute(value) || /[\0\r\n]/.test(value) || value.includes('${'))
      throw new Error('The installed NCF path cannot be used by the Claude Code plugin');
  const hook = commandHook(runtime);
  const server = `plugin:${claudePlugin.name}:${claudePlugin.server}`;
  const sessionEvent = (event: 'start' | 'end') => ({
    type: 'mcp_tool',
    server,
    tool: 'session_event',
    input: { event, session_id: '${session_id}' },
  });
  const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
  return {
    '.claude-plugin/marketplace.json': json({
      name: claudePlugin.marketplace,
      owner: { name: 'NCF Agent Interconnect' },
      description: 'Published by the installed NCF Agent Interconnect application.',
      plugins: [
        {
          name: claudePlugin.name,
          source: './plugin',
          description: 'Connects this Claude Code chat to NCF Agent Interconnect.',
        },
      ],
    }),
    'plugin/.claude-plugin/plugin.json': json({
      name: claudePlugin.name,
      displayName: 'NCF Agent Interconnect',
      version: runtime.version,
      description:
        'Messages for agents connected through NCF Agent Interconnect, announced by a channel and received with agent_read.',
      author: { name: 'no-colours-fabric' },
      license: 'BSD-3-Clause',
      mcpServers: {
        [claudePlugin.server]: {
          command: runtime.execPath,
          args: [...runtime.runtimeArgs, runtime.script, '--node-file', runtime.nodeFile],
          env: { ELECTRON_RUN_AS_NODE: '1' },
        },
      },
      channels: [{ server: claudePlugin.server, displayName: 'NCF Agent Interconnect' }],
    }),
    'plugin/hooks/hooks.json': json({
      description: 'Trusted current-chat evidence for NCF Agent Interconnect.',
      hooks: {
        SessionStart: [{ hooks: [hook, sessionEvent('start')] }],
        SessionEnd: [{ hooks: [hook, sessionEvent('end')] }],
        PreToolUse: [{ matcher: claudeToolPrefix.replace(/__$/, '__.*'), hooks: [hook] }],
      },
    }),
  };
}

/** Writes changed files only, each through a private temporary file. */
export async function publishClaudePlugin(
  root: string,
  files: Record<string, string>,
): Promise<void> {
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, ...relative.split('/'));
    const current = await readFile(target, 'utf8').catch(() => undefined);
    if (current === content) continue;
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    const temporary = target + '.' + randomUUID() + '.tmp';
    await writeFile(temporary, content, { mode: 0o600, flag: 'wx' });
    await rename(temporary, target);
  }
}

import type { McpSetupClient } from '../shared/mcp-setup.js';

interface ApplicationDescriptor {
  bundles: { name: string; id: string }[];
  windows: { directory: string; executable: string }[];
  linux: { directory: string; executable: string }[];
  desktopEntries: string[];
  packageNames: string[];
  npmNames: string[];
  commands: string[];
}

/** Installation identities only. No adapter capability or provider inference. */
export const discoveryCatalog: Record<McpSetupClient, ApplicationDescriptor> = {
  cursor: {
    bundles: [{ name: 'Cursor.app', id: 'com.todesktop.230313mzl4w4u92' }],
    windows: [{ directory: 'cursor', executable: 'Cursor.exe' }],
    linux: [{ directory: '/usr/share/cursor', executable: 'cursor' }],
    desktopEntries: ['cursor.desktop', 'co.anysphere.cursor.desktop'],
    packageNames: ['cursor'],
    npmNames: [],
    commands: ['cursor'],
  },
  opencode: {
    bundles: [{ name: 'OpenCode.app', id: 'ai.opencode.desktop' }],
    windows: [{ directory: 'OpenCode', executable: 'OpenCode.exe' }],
    linux: [
      { directory: '/opt/OpenCode', executable: 'ai.opencode' },
      { directory: '/opt/opencode', executable: 'opencode-desktop' },
      { directory: '/usr/lib/opencode', executable: 'opencode-desktop' },
    ],
    desktopEntries: [
      'ai.opencode.desktop.desktop',
      'ai.opencode.desktop',
      'opencode-desktop.desktop',
      'opencode.desktop',
    ],
    packageNames: ['opencode'],
    npmNames: ['opencode-ai', '@opencode/cli'],
    commands: ['opencode'],
  },
  codex: {
    bundles: [
      { name: 'Codex.app', id: 'com.openai.codex' },
      { name: 'ChatGPT.app', id: 'com.openai.codex' },
    ],
    windows: [
      { directory: 'Codex', executable: 'Codex.exe' },
      { directory: 'ChatGPT', executable: 'ChatGPT.exe' },
    ],
    linux: [
      { directory: '/opt/ChatGPT', executable: 'chatgpt' },
      { directory: '/opt/Codex', executable: 'codex' },
      { directory: '/usr/lib/chatgpt', executable: 'chatgpt' },
    ],
    desktopEntries: ['codex.desktop', 'chatgpt.desktop', 'com.openai.codex.desktop'],
    packageNames: ['chatgpt', 'codex'],
    npmNames: [],
    commands: [],
  },
  aionui: {
    bundles: [{ name: 'AionUi.app', id: 'com.aionui.app' }],
    windows: [{ directory: 'AionUi', executable: 'AionUi.exe' }],
    linux: [
      { directory: '/opt/AionUi', executable: 'AionUi' },
      { directory: '/opt/aionui', executable: 'aionui' },
    ],
    desktopEntries: ['aionui.desktop', 'AionUi.desktop', 'com.aionui.app.desktop'],
    packageNames: ['aionui'],
    npmNames: [],
    commands: [],
  },
  claude: {
    bundles: [{ name: 'Claude.app', id: 'com.anthropic.claudefordesktop' }],
    windows: [{ directory: 'Claude', executable: 'Claude.exe' }],
    linux: [
      { directory: '/opt/Claude', executable: 'claude' },
      { directory: '/opt/claude', executable: 'claude' },
    ],
    desktopEntries: ['claude.desktop', 'com.anthropic.claudefordesktop.desktop'],
    packageNames: ['claude-code'],
    npmNames: ['@anthropic-ai/claude-code'],
    commands: ['claude'],
  },
};

export function matchesDesktopMetadata(
  client: McpSetupClient,
  metadata: Record<string, unknown>,
): boolean {
  if (client === 'cursor')
    return metadata.applicationName === 'cursor' && metadata.nameShort === 'Cursor';
  if (client === 'opencode')
    return metadata.name === '@opencode/desktop' || metadata.name === 'opencode-desktop';
  if (client === 'codex')
    return metadata.name === 'openai-codex-electron' && metadata.author === 'OpenAI';
  if (client === 'aionui') return metadata.name === 'AionUi' && metadata.productName === 'AionUi';
  return metadata.name === 'claude-desktop' || metadata.name === '@anthropic-ai/claude-desktop';
}

export const mcpSetupClients = ['cursor', 'opencode', 'codex', 'aionui', 'claude'] as const;
/** Claude Code starts normally; the NCF mod announces messages without development flags. */
export const claudeLaunchCommand = 'claude';
export type McpSetupClient = (typeof mcpSetupClients)[number];
export type McpSetupApplication = McpSetupClient;
export type McpSetupFormat = 'jsonc' | 'toml';

export interface McpSetupTarget {
  id: string;
  path: string;
}
export interface McpSetupFile extends McpSetupTarget {
  format: McpSetupFormat;
  alternatives: string[];
}
export interface McpSetupDefaults {
  client: McpSetupClient;
  files: McpSetupFile[];
}
export interface McpSetupFilePreview extends McpSetupTarget {
  action: 'create' | 'update' | 'unchanged';
  backupPath?: string;
  changes: { scope: string; action: 'add' | 'replace' | 'unchanged' }[];
}
export interface McpSetupPreview {
  client: McpSetupClient;
  planId: string;
  expiresAt: string;
  files: McpSetupFilePreview[];
  requiresReplacement: boolean;
}
export interface McpSetupApplyResult {
  status: 'applied' | 'unchanged' | 'failed';
  files: {
    path: string;
    status: 'created' | 'updated' | 'unchanged' | 'restored' | 'failed';
    backupPath?: string;
    error?: string;
  }[];
  error?: string;
  warning?: string;
}
export type McpSetupFileStatus =
  'configured' | 'not-configured' | 'needs-update' | 'missing' | 'unavailable';
export interface McpSetupStatus {
  client: McpSetupClient;
  remembered: boolean;
  state: McpSetupFileStatus;
  files: (McpSetupTarget & { state: McpSetupFileStatus; error?: string })[];
}
export type McpSetupInvoke = <T = unknown>(method: string, params?: unknown) => Promise<T>;

export const mcpSetupMethods = [
  'mcpSetupDefaults',
  'mcpSetupBrowse',
  'mcpSetupPreview',
  'mcpSetupApply',
  'mcpSetupDiscard',
  'mcpSetupStatus',
  'mcpSetupOpen',
] as const;

/** Explicit v2 selection; installation evidence never grants runtime authority. */
export interface OpenCodeV2SetupTarget {
  major: 2;
  installationId: string | null;
  installationPath: string | null;
  profilePath: string;
  configurationPath: string;
}
export interface OpenCodeV2SetupDefaults {
  client: 'opencode-v2';
  target: OpenCodeV2SetupTarget;
  alternatives: string[];
}
export interface OpenCodeV2SetupPreview extends Omit<McpSetupPreview, 'client'> {
  client: 'opencode-v2';
  target: OpenCodeV2SetupTarget;
  /** Nonsecret logical target identity, never a credential or proof of a live bridge. */
  targetId: string;
}
export interface OpenCodeV2SetupStatus extends Omit<McpSetupStatus, 'client'> {
  client: 'opencode-v2';
  target: OpenCodeV2SetupTarget;
  targetId?: string;
}
export interface OpenCodeV2SetupApplyResult extends McpSetupApplyResult {
  target: OpenCodeV2SetupTarget;
  targetId: string;
}
/** Separate IPC prevents an explicit v2 target from entering legacy v1 setup. */
export const openCodeV2SetupMethods = [
  'opencodeV2SetupDefaults',
  'opencodeV2SetupBrowse',
  'opencodeV2SetupPreview',
  'opencodeV2SetupApply',
  'opencodeV2SetupDiscard',
  'opencodeV2SetupStatus',
  'opencodeV2SetupOpen',
] as const;
export interface OpenCodeV2SetupRequests {
  opencodeV2SetupDefaults: Record<string, never>;
  opencodeV2SetupBrowse: { target: OpenCodeV2SetupTarget };
  opencodeV2SetupPreview: { target: OpenCodeV2SetupTarget };
  opencodeV2SetupApply: {
    planId: string;
    target: OpenCodeV2SetupTarget;
    confirmReplace: boolean;
  };
  opencodeV2SetupDiscard: { planId: string };
  opencodeV2SetupStatus: { target?: OpenCodeV2SetupTarget };
  opencodeV2SetupOpen: { target: OpenCodeV2SetupTarget };
}

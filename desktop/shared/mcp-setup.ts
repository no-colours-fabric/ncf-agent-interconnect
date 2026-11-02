export const mcpSetupClients = ['cursor', 'opencode', 'codex', 'aionui'] as const;
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

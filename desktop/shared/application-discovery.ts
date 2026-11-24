import type { McpSetupClient } from './mcp-setup.js';
import type { ChatgptCompatibility } from './chatgpt-compatibility.js';

export type DiscoveryPlatform = 'darwin' | 'win32' | 'linux';
export type InstallationStatus = 'detected' | 'not-found-in-known-locations' | 'unknown';
export type DiscoveryReason =
  | 'access-denied'
  | 'invalid-metadata'
  | 'unsupported-package-format'
  | 'unverified-identity'
  | 'missing-runtime'
  | 'source-unavailable'
  | 'limit-exceeded';

export interface InstallationInstance {
  path: string;
  form: 'desktop' | 'cli';
  evidence: 'bundle' | 'product-metadata' | 'package-metadata' | 'native-install-layout';
}

export interface DiscoveryCoverage {
  source: string;
  state: 'checked' | 'partial';
  reason?: DiscoveryReason;
}

export interface ApplicationInstallation {
  client: McpSetupClient;
  status: InstallationStatus;
  instances: InstallationInstance[];
  coverage: DiscoveryCoverage[];
}

export interface ApplicationDiscoverySnapshot {
  chatgptCompatibility?: ChatgptCompatibility;
  checkedAt: string;
  platform: DiscoveryPlatform | 'unsupported';
  applications: ApplicationInstallation[];
  offers: McpSetupClient[];
  stateError: boolean;
}

export const applicationNames: Record<McpSetupClient, string> = {
  cursor: 'Cursor',
  opencode: 'OpenCode',
  codex: 'ChatGPT',
  aionui: 'AionUi',
  claude: 'Claude Code',
};

export const applicationDiscoveryMethods = [
  'applicationDiscovery',
  'applicationDiscoveryRefresh',
  'applicationDiscoveryChoose',
  'applicationDiscoveryOffered',
] as const;

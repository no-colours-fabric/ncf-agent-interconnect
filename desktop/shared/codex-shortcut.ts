import type { McpSetupApplyResult } from './mcp-setup.js';

export const codexShortcutDisplayName = 'ChatGPT — NCF Agent Interconnect';

export type CodexShortcutPlatform = 'mac' | 'windows';

export type CodexShortcutResult =
  | 'created'
  | 'cancelled'
  | 'setupRequired'
  | 'appMissing'
  | 'profileUnavailable'
  | 'alreadyExists'
  | 'failed';

export const codexShortcutDestinations = [
  'desktop',
  'applications',
  'startMenu',
  'dock',
  'custom',
] as const;
export type CodexShortcutDestination = (typeof codexShortcutDestinations)[number];

export function codexShortcutDestinationsFor(
  platform: CodexShortcutPlatform,
): readonly CodexShortcutDestination[] {
  return platform === 'mac'
    ? ['desktop', 'applications', 'dock', 'custom']
    : ['desktop', 'startMenu', 'custom'];
}

export type CodexShortcutFailure = 'setupRequired' | 'appMissing' | 'profileUnavailable' | 'failed';

export interface CodexShortcutDestinationResult {
  destination: CodexShortcutDestination;
  result: Exclude<CodexShortcutResult, 'cancelled'> | 'dockPending' | 'dockUnavailable';
}

export type CodexShortcutCreateResult =
  | { state: 'cancelled' }
  | { state: 'failed'; reason: CodexShortcutFailure }
  | { state: 'complete'; destinations: CodexShortcutDestinationResult[] };

export interface CodexShortcutConnectionResult {
  shortcut: CodexShortcutCreateResult;
  setup: McpSetupApplyResult | null;
}

export function hasCodexShortcutLaunchFlags(args: readonly string[]): boolean {
  return args.some(
    (arg) =>
      arg === '--launch-codex' ||
      arg.startsWith('--launch-codex=') ||
      arg === '--launcher-manifest' ||
      arg.startsWith('--launcher-manifest='),
  );
}

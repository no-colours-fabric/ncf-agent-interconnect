import type { DiscoveredLanNode, LanDiscoveryUnavailable } from './lan-discovery.js';

export interface LanSearchNode extends DiscoveredLanNode {
  /** An accepted response in this run, rather than an entry retained from a prior run. */
  observedInRun: boolean;
  newlyFound: boolean;
  lastSeenAgoMs: number;
}

/** UI-only observations; never a paired-node or authenticated directory. */
export interface LanSearchSnapshot {
  phase: 'stopped' | 'searching' | 'complete' | 'unavailable';
  reason: LanDiscoveryUnavailable | null;
  runId: number;
  durationMs: number;
  elapsedMs: number;
  foundCount: number;
  nodes: LanSearchNode[];
  /** Acknowledge only these exact keys after their rows have actually been displayed. */
  unseenKeys: string[];
}

import type { DiscoveredLanNode, LanDiscoveryUnavailable } from './lan-discovery.js';

export interface LanSearchNode extends DiscoveredLanNode {
  /** An accepted response in this run, rather than an entry retained from a prior run. */
  observedInRun: boolean;
  newlyFound: boolean;
  lastSeenAgoMs: number;
  /** Unverified observations for one claimed UUID; never an authenticated peer identity. */
  endpoints?: readonly LanSearchNode[];
}

/** Group presentation independently of trust, retaining a stable first-observed row key. */
export function groupLanSearchNodes(nodes: readonly LanSearchNode[]): LanSearchNode[] {
  const groups = new Map<string, LanSearchNode[]>();
  const rowKeys = new Map<string, string>();
  for (const node of nodes) {
    for (const endpoint of node.endpoints ?? [node]) {
      const id = endpoint.nodeId.toLowerCase();
      const values = groups.get(id) ?? [];
      if (!rowKeys.has(id)) rowKeys.set(id, node.key);
      if (!groups.has(id)) groups.set(id, values);
      const previous = values.findIndex((value) => value.address === endpoint.address);
      const copy = { ...endpoint };
      delete copy.endpoints;
      if (previous < 0) values.push(copy);
      else if (copy.lastSeenAgoMs < values[previous].lastSeenAgoMs) values[previous] = copy;
    }
  }
  return [...groups.values()]
    .map((endpoints) => {
      const key = rowKeys.get(endpoints[0].nodeId.toLowerCase())!;
      const sorted = [...endpoints].sort(
        (a, b) => a.lastSeenAgoMs - b.lastSeenAgoMs || a.address.localeCompare(b.address, 'en'),
      );
      return {
        ...sorted[0],
        key,
        observedInRun: endpoints.some((value) => value.observedInRun),
        newlyFound: endpoints.every((value) => value.newlyFound),
        ...(endpoints.length > 1 ? { endpoints: sorted } : {}),
      };
    })
    .sort((a, b) => a.nodeId.localeCompare(b.nodeId, 'en'));
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

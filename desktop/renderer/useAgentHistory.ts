import { useEffect, useState } from 'react';
import type { Snapshot } from '../shared/contracts.js';
import { agentCacheKey, visibleAgentHistory } from './agent-clear-model.js';
import { nicknameKey } from '../shared/contracts.js';
import { loadAgentHistory, type HistoryPage } from './agent-history.js';

export function useAgentHistory({
  owner,
  snapshot,
  historySize,
  active,
  address = '',
  onError,
}: {
  owner: string;
  snapshot: Snapshot | null;
  historySize: number;
  active: boolean;
  address?: string;
  onError: (error: string) => void;
}): HistoryPage {
  const agent = owner
    ? snapshot?.agents.find((agent) => agent.key === nicknameKey(owner))
    : undefined;
  const cacheKey = agentCacheKey(agent);
  const [history, setHistory] = useState<HistoryPage & { owner: string }>({
    owner: '',
    messages: [],
    nextCursor: 0,
    hasMore: false,
  });
  useEffect(() => {
    if (!owner || !active || !cacheKey) return;
    let cancelled = false;
    void loadAgentHistory(
      owner,
      historySize,
      (params) =>
        window.interconnect.invoke<HistoryPage>('history', {
          ...params,
          ...(agent?.incarnation ? { incarnation: agent.incarnation } : {}),
        }),
      () => cancelled,
    )
      .then((page) => {
        if (page && !cancelled) setHistory({ ...page, owner: cacheKey });
      })
      .catch((error: Error) => {
        if (!cancelled) onError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [owner, cacheKey, snapshot, historySize, active, address, onError]);
  return visibleAgentHistory(history, cacheKey);
}

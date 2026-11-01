import { useEffect, useState } from 'react';
import type { Snapshot } from '../shared/contracts.js';
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
  const [history, setHistory] = useState<HistoryPage & { owner: string }>({
    owner: '',
    messages: [],
    nextCursor: 0,
    hasMore: false,
  });
  useEffect(() => {
    if (!owner || !active) return;
    let cancelled = false;
    void loadAgentHistory(
      owner,
      historySize,
      (params) => window.interconnect.invoke<HistoryPage>('history', params),
      () => cancelled,
    )
      .then((page) => {
        if (page && !cancelled) setHistory({ ...page, owner });
      })
      .catch((error: Error) => {
        if (!cancelled) onError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [owner, snapshot, historySize, active, address, onError]);
  return history.owner === owner ? history : { messages: [], nextCursor: 0, hasMore: false };
}

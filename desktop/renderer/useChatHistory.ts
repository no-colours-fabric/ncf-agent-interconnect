import { useEffect, useRef, useState } from 'react';
import { nicknameKey, type ChatHistoryPage, type Snapshot } from '../shared/contracts.js';
import { agentCacheKey, visibleAgentHistory } from './agent-clear-model.js';

export async function loadChatHistory(
  size: number,
  read: (params: { before?: number; limit: number }) => Promise<ChatHistoryPage>,
  cancelled: () => boolean,
): Promise<ChatHistoryPage | null> {
  let messages: ChatHistoryPage['messages'] = [];
  let before: number | undefined;
  let hasMore = true;
  while (hasMore && messages.length < size) {
    const page = await read({
      ...(before ? { before } : {}),
      limit: Math.min(200, size - messages.length),
    });
    if (cancelled()) return null;
    if (
      page.hasMore &&
      (!page.messages.length ||
        page.nextCursor <= 0 ||
        (before !== undefined && page.nextCursor >= before))
    )
      throw new Error('Message history cursor did not move backwards');
    messages = [...page.messages, ...messages];
    before = page.nextCursor;
    hasMore = page.hasMore;
  }
  return { messages, nextCursor: before ?? 0, hasMore };
}

export function useChatHistory({
  owner,
  snapshot,
  size,
  active,
  attachmentsOnly,
  onError,
}: {
  owner: string;
  snapshot: Snapshot | null;
  size: number;
  active: boolean;
  attachmentsOnly: boolean;
  onError: (error: string) => void;
}): ChatHistoryPage & { loading: boolean } {
  const agent = owner
    ? snapshot?.agents.find((value) => nicknameKey(value.nickname) === nicknameKey(owner))
    : undefined;
  const agentKey = agentCacheKey(agent);
  const cacheKey = agentKey && `${agentKey}:${attachmentsOnly}`;
  const opened = useRef({ key: cacheKey, count: agent?.messageCount ?? 0 });
  if (opened.current.key !== cacheKey)
    opened.current = { key: cacheKey, count: agent?.messageCount ?? 0 };
  const windowSize = size + Math.max(0, (agent?.messageCount ?? 0) - opened.current.count);
  const [history, setHistory] = useState<ChatHistoryPage & { owner: string }>({
    owner: '',
    messages: [],
    nextCursor: 0,
    hasMore: false,
  });
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!active || !owner || !cacheKey) return;
    let cancelled = false;
    setLoading(true);
    void loadChatHistory(
      windowSize,
      (params) =>
        window.interconnect.invoke<ChatHistoryPage>('chatHistory', {
          nickname: owner,
          incarnation: agent?.incarnation,
          attachmentsOnly,
          ...params,
        }),
      () => cancelled,
    )
      .then((page) => {
        if (page && !cancelled) setHistory({ ...page, owner: cacheKey });
      })
      .catch((error: Error) => {
        if (!cancelled) onError(error.message);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setSettledKey(cacheKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [owner, cacheKey, snapshot, windowSize, active, attachmentsOnly, onError]);
  return {
    ...visibleAgentHistory(history, cacheKey),
    loading: active && (loading || settledKey !== cacheKey),
  };
}

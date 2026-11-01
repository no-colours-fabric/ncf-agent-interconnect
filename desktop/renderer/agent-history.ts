import { nicknameKey, nicknameSchema, type Message } from '../shared/contracts.js';

export interface HistoryPage {
  messages: Message[];
  nextCursor: number;
  hasMore: boolean;
}

export async function loadAgentHistory(
  owner: string,
  size: number,
  read: (params: { nickname: string; after: number; limit: number }) => Promise<HistoryPage>,
  cancelled: () => boolean,
): Promise<HistoryPage | null> {
  const messages: Message[] = [];
  let nextCursor = 0;
  let hasMore = true;
  while (hasMore && messages.length < size) {
    const page = await read({
      nickname: owner,
      after: nextCursor,
      limit: Math.min(200, size - messages.length),
    });
    if (cancelled()) return null;
    if (page.hasMore && page.nextCursor <= nextCursor)
      throw new Error('Message history cursor did not advance');
    messages.push(...page.messages);
    nextCursor = page.nextCursor;
    hasMore = page.hasMore;
  }
  return { messages, nextCursor, hasMore };
}

export function draftNicknameKey(nickname: string): string | null {
  const parsed = nicknameSchema.safeParse(nickname.trim());
  return parsed.success ? nicknameKey(parsed.data) : null;
}

export function remoteConversation(messages: Message[], node: string, nickname: string): Message[] {
  const key = draftNicknameKey(nickname);
  if (!node || !key) return [];
  return messages.filter(({ direction, envelope }) =>
    direction === 'in'
      ? envelope.fromNode === node && nicknameKey(envelope.fromNickname) === key
      : envelope.toNode === node && nicknameKey(envelope.toNickname) === key,
  );
}

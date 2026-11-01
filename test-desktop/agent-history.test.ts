import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  loadAgentHistory,
  remoteConversation,
  draftNicknameKey,
} from '../desktop/renderer/agent-history.js';
import type { Message } from '../desktop/shared/contracts.js';

const local = randomUUID(),
  first = randomUUID(),
  second = randomUUID();
function message(sequence: number, node = first, direction: Message['direction'] = 'in'): Message {
  return {
    sequence,
    direction,
    state: 'ready',
    error: null,
    envelope: {
      protocol: 2,
      id: randomUUID(),
      fromNode: direction === 'in' ? node : local,
      toNode: direction === 'in' ? local : node,
      fromNickname: direction === 'in' ? 'ЗУБР' : 'Owner',
      toNickname: direction === 'in' ? 'Owner' : 'зубр',
      createdAt: new Date().toISOString(),
      text: 'History entry ' + sequence,
      replyTo: null,
      attachments: [],
    },
  };
}

test('remote history matches the directional counterpart by node and Unicode nickname key', () => {
  const incoming = message(1),
    outgoing = message(2, first, 'out');
  const otherPeer = message(3, second),
    wrongDirection = message(4, second, 'out');
  wrongDirection.envelope.fromNode = first;
  wrongDirection.envelope.fromNickname = 'зубр';
  assert.deepEqual(
    remoteConversation([incoming, otherPeer, outgoing, wrongDirection], first, 'Зубр'),
    [incoming, outgoing],
  );
  const unicode = message(5);
  unicode.envelope.fromNickname = 'Cafe\u0301';
  assert.deepEqual(remoteConversation([unicode], first, 'CAFÉ'), [unicode]);
  for (const invalid of ['', ' ', '\n', 'a'.repeat(121)]) {
    assert.equal(draftNicknameKey(invalid), null);
    assert.deepEqual(remoteConversation([incoming], first, invalid), []);
  }
});

test('raw cursor and hasMore survive an empty filtered page and interleaved sequence gaps', async () => {
  const unrelated = Array.from({ length: 100 }, (_, index) => message(index * 7 + 1, second));
  const matching = message(900);
  const calls: { nickname: string; after: number; limit: number }[] = [];
  const read = async (params: { nickname: string; after: number; limit: number }) => {
    calls.push(params);
    return params.after === 0
      ? { messages: unrelated, nextCursor: 694, hasMore: true }
      : { messages: [matching], nextCursor: 900, hasMore: false };
  };
  const page = await loadAgentHistory('Exact owner', 100, read, () => false);
  assert.ok(page);
  assert.deepEqual(remoteConversation(page.messages, first, 'зубр'), []);
  assert.equal(page.hasMore, true);
  assert.equal(page.nextCursor, 694);
  calls.length = 0;
  const expanded = await loadAgentHistory('Exact owner', 200, read, () => false);
  assert.ok(expanded);
  assert.deepEqual(calls, [
    { nickname: 'Exact owner', after: 0, limit: 200 },
    { nickname: 'Exact owner', after: 694, limit: 100 },
  ]);
  assert.deepEqual(remoteConversation(expanded.messages, first, 'зубр'), [matching]);
  assert.equal(expanded.hasMore, false);
});

test('a nonadvancing raw cursor fails instead of repeatedly requesting history', async () => {
  let calls = 0;
  await assert.rejects(
    loadAgentHistory(
      'Owner',
      200,
      async () => {
        calls++;
        return { messages: [], nextCursor: 0, hasMore: true };
      },
      () => false,
    ),
    /cursor did not advance/,
  );
  assert.equal(calls, 1);
});

test('cancelling an outstanding owner or address request discards its page', async () => {
  let cancelled = false,
    calls = 0;
  const result = await loadAgentHistory(
    'Old owner',
    200,
    async () => {
      calls++;
      cancelled = true;
      return { messages: [message(1)], nextCursor: 1, hasMore: true };
    },
    () => cancelled,
  );
  assert.equal(result, null);
  assert.equal(calls, 1);
});

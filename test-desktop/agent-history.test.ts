import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  loadAgentHistory,
  remoteConversation,
  draftNicknameKey,
} from '../desktop/renderer/agent-history.js';
import type { Message } from '../desktop/shared/contracts.js';
import { NodeService } from '../desktop/core/service.js';
import type { ResponseInvocation } from '../desktop/core/mcp-response-handoff.js';

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

test('MCP history preserves its page and gives each incoming row one node-formatted presentation', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-history-presentation-'));
  const delivered = [Date.UTC(2026, 10, 17, 12, 35, 7), Date.UTC(2026, 10, 17, 12, 36, 8)];
  let clockCalls = 0;
  const service = new NodeService(directory, {
    presentationNow: () => delivered[clockCalls++]!,
    messageDisplayContext: () => ({ locale: 'en-GB', timeZone: 'UTC' }),
  });
  await service.open();
  t.after(async () => {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  const receiver = service.connect({ nickname: 'Receiver', client: 'MCP' });
  const sender = service.connect({ nickname: 'Sender', client: 'MCP' });
  if (receiver.status !== 'connected' || sender.status !== 'connected') throw new Error('fixture');
  await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: receiver.nickname,
    text: 'Incoming history body 漢字',
  });
  await service.send({
    connectionId: receiver.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: sender.nickname,
    text: 'Outgoing history body',
  });

  type PresentedPage = {
    messages: {
      direction: 'in' | 'out';
      presentation?: string;
      envelope: { createdAt: string; text: string };
    }[];
    nextCursor: number;
    hasMore: boolean;
  };
  const read = async () => {
    let completion:
      { release(): void; complete(): void; abort(possibleWrite: boolean): void } | undefined;
    const invocation = {
      service: service.deliveryIncarnation,
      transport: randomUUID(),
      session: randomUUID(),
      nonce: randomUUID(),
      id: randomUUID(),
      result: undefined,
      assertCurrent() {},
      associate(value: typeof completion) {
        completion = value;
      },
    } as unknown as ResponseInvocation;
    const page = (await service.read(
      receiver.binding.connectionId,
      0,
      50,
      false,
      invocation,
    )) as PresentedPage;
    invocation.result = {
      content: [{ type: 'text', text: JSON.stringify(page) }],
      structuredContent: page as unknown as Record<string, unknown>,
    };
    completion!.release();
    completion!.complete();
    return page;
  };

  const firstPage = await read();
  const firstIncoming = firstPage.messages.find((row) => row.direction === 'in')!;
  const firstOutgoing = firstPage.messages.find((row) => row.direction === 'out')!;
  assert.match(firstIncoming.presentation!, /Sent: .+\nDelivered: 17\/11\/2026, 12:35:07/);
  assert.match(firstIncoming.presentation!, /Reply-To "Sender": r[0-9a-z]+/);
  assert.equal(firstOutgoing.presentation, undefined);
  const sentLine = firstIncoming.presentation!.match(/^Sent: .+$/m)![0];

  const secondPage = await read();
  const secondIncoming = secondPage.messages.find((row) => row.direction === 'in')!;
  assert.ok(secondIncoming.presentation!.includes(sentLine));
  assert.match(secondIncoming.presentation!, /Delivered: 17\/11\/2026, 12:36:08/);
  assert.equal(clockCalls, 2);
  assert.equal(secondPage.nextCursor, firstPage.nextCursor);
  assert.equal(secondPage.hasMore, firstPage.hasMore);
});

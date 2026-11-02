import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentStore } from '../desktop/core/agent-store.js';
import { NodeService } from '../desktop/core/service.js';
import { loadChatHistory } from '../desktop/renderer/useChatHistory.js';
import type { Envelope } from '../desktop/shared/contracts.js';

const node = randomUUID();
const envelope = (index: number, owner = 'Owner Ж'): Envelope => ({
  protocol: 2,
  id: randomUUID(),
  fromNode: node,
  toNode: node,
  fromNickname: owner,
  toNickname: 'Recipient',
  createdAt: new Date(Date.UTC(2026, 10, 1, 0, 0, index)).toISOString(),
  text: 'Message ' + index,
  attachments: [],
  replyTo: null,
});

test('latest history pages run backwards over timeline gaps and display chronologically without marking receipt', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-chat-page-'));
  const store = new AgentStore(directory);
  try {
    store.ensure('Empty');
    for (let index = 1; index <= 250; index++) {
      store.insertLocal(envelope(index), true);
      store.insertLocal(envelope(index, 'Other'), true);
    }
    const latest = store.chatHistory('owner ж', undefined, 100);
    assert.equal(latest.messages[0].envelope.text, 'Message 151');
    assert.equal(latest.messages.at(-1)?.envelope.text, 'Message 250');
    assert.equal(latest.hasMore, true);
    const middle = store.chatHistory('owner ж', latest.nextCursor, 100);
    const oldest = store.chatHistory('owner ж', middle.nextCursor, 100);
    assert.equal(oldest.hasMore, false);
    const messages = [...oldest.messages, ...middle.messages, ...latest.messages];
    assert.equal(new Set(messages.map((message) => message.sequence)).size, 250);
    assert.deepEqual(
      messages.map((message) => message.envelope.text),
      Array.from({ length: 250 }, (_, index) => 'Message ' + (index + 1)),
    );
    const incoming = store.chatHistory('recipient', undefined, 20);
    assert.ok(incoming.messages.every((message) => message.state === 'ready'));
    assert.equal(store.list().find((agent) => agent.key === 'recipient')?.unread, 500);
    const owner = store.list().find((agent) => agent.key === 'owner ж')!;
    assert.equal(owner.incomingCount, 0);
    assert.equal(owner.outgoingCount, 250);
    assert.equal(owner.lastMessageAt, envelope(250).createdAt);
    assert.equal(store.list().find((agent) => agent.key === 'empty')?.lastMessageAt, null);
    assert.deepEqual(store.chatHistory('empty'), { messages: [], nextCursor: 0, hasMore: false });
    const self = envelope(999, 'Self');
    self.toNickname = 'SELF';
    store.insertLocal(self, true);
    const selfHistory = store.chatHistory('self');
    assert.equal(selfHistory.messages.length, 2);
    assert.deepEqual(
      new Set(selfHistory.messages.map((message) => message.direction)),
      new Set(['in', 'out']),
    );
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('loader fetches the requested newest window and rejects a stalled reverse cursor or cancelled owner', async () => {
  const calls: unknown[] = [];
  const message = (sequence: number) => ({
    envelope: envelope(sequence),
    sequence,
    direction: 'out' as const,
    state: 'queued' as const,
    error: null,
  });
  const result = await loadChatHistory(
    3,
    async (params) => {
      calls.push(params);
      return params.before
        ? { messages: [message(1)], nextCursor: 1, hasMore: false }
        : { messages: [message(5), message(9)], nextCursor: 5, hasMore: true };
    },
    () => false,
  );
  assert.deepEqual(calls, [{ limit: 3 }, { before: 5, limit: 1 }]);
  assert.deepEqual(
    result?.messages.map((message) => message.sequence),
    [1, 5, 9],
  );
  await assert.rejects(
    loadChatHistory(
      3,
      async () => ({ messages: [message(5)], nextCursor: 5, hasMore: true }),
      () => false,
    ),
    /backwards/,
  );
  assert.equal(
    await loadChatHistory(
      3,
      async () => ({ messages: [message(5)], nextCursor: 5, hasMore: true }),
      () => true,
    ),
    null,
  );
});

test('chat UI operation validates limits and incarnation without changing MCP forward history semantics', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-chat-ipc-'));
  const service = new NodeService(directory);
  service.store = new AgentStore(directory);
  try {
    const key = service.store.ensure('Owner');
    const incarnation = service.store.list()[0].incarnation;
    service.store.insertLocal(envelope(1, 'Owner'), true);
    const page = (await service.userCall('chatHistory', {
      nickname: 'OWNER',
      incarnation,
      limit: 1,
    })) as { messages: unknown[] };
    assert.equal(page.messages.length, 1);
    await assert.rejects(
      service.userCall('chatHistory', { nickname: 'Owner', incarnation: randomUUID() }),
      /changed/,
    );
    for (const input of [{ limit: 201 }, { before: 0 }, { after: 1 }])
      await assert.rejects(service.userCall('chatHistory', { nickname: 'Owner', ...input }));
    assert.equal(service.store.history(key, 0, 100).messages.length, 1);
  } finally {
    service.store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

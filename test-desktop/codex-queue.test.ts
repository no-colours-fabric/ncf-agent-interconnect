import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { CodexQueueAdapter } from '../desktop/core/codex-queue.js';
import type { EventInput } from '../desktop/core/adapters.js';
import type { AdapterProfile } from '../desktop/shared/contracts.js';

function fixture() {
  const threadId = randomUUID();
  const profile: AdapterProfile = {
    id: randomUUID(),
    label: 'Codex',
    kind: 'codex-desktop',
    codexQueue: true,
    threadId,
  };
  const input: EventInput = {
    nickname: 'Recipient',
    binding: {
      adapterId: profile.id,
      chatId: threadId,
      client: 'Codex',
      connectionId: randomUUID(),
      generation: 1,
    },
    messageId: randomUUID(),
    message: { fromNode: randomUUID(), fromNickname: 'Sender', text: 'PRIVATE_MESSAGE', files: [] },
    replyRef: 'r1',
  };
  return { profile, threadId, input };
}

test('offers a Codex wake to the verified saved chat without releasing the message', async (t) => {
  const { profile, threadId, input } = fixture();
  const queued: object[] = [];
  const adapter = new CodexQueueAdapter(
    profile,
    () => {},
    async (_profile, _signal, operation) =>
      operation(async (method, params) => {
        assert.equal((params as { threadId: string }).threadId, threadId);
        if (method === 'thread/read') return { thread: { id: threadId, ephemeral: false } };
        if (method === 'thread/queue/list') return { data: [] };
        assert.equal(method, 'thread/queue/add');
        queued.push(params);
        return {
          queuedSubmission: {
            id: randomUUID(),
            clientUserMessageId: (params as { clientUserMessageId: string }).clientUserMessageId,
          },
        };
      }),
  );
  t.after(() => adapter.stop());
  await adapter.start();
  assert.equal(adapter.status().state, 'ready');
  assert.equal(adapter.status().capabilities.receiveActive, false);
  assert.deepEqual(await adapter.deliver({ ...input, sequence: 1, backlogUntil: 2 }), {
    state: 'offered',
  });
  assert.deepEqual(await adapter.deliver({ ...input, sequence: 2, backlogUntil: 2 }), {
    state: 'offered',
  });
  assert.equal(queued.length, 1);
  assert.match(JSON.stringify(queued[0]), /agent_read/);
  assert.doesNotMatch(JSON.stringify(queued[0]), /PRIVATE_MESSAGE|Sender/);
  assert.equal(adapter.offerCurrent(), true);

  const otherChat = { ...input, binding: { ...input.binding, chatId: randomUUID() } };
  assert.equal((await adapter.deliver(otherChat)).state, 'failed');
  assert.equal((await adapter.deliver({ ...input, isCurrent: () => false })).state, 'revoked');
  assert.equal(queued.length, 1);
});

test('leaves an ambiguous Codex wake unconfirmed and rejects a changed thread', async (t) => {
  const { profile, threadId, input } = fixture();
  let validThread = true;
  let submissions = 0;
  const adapter = new CodexQueueAdapter(
    profile,
    () => {},
    async (_profile, _signal, operation) =>
      operation(async (method) => {
        if (method === 'thread/read')
          return { thread: { id: validThread ? threadId : randomUUID(), ephemeral: false } };
        if (method === 'thread/queue/list') return { data: [] };
        assert.equal(method, 'thread/queue/add');
        submissions++;
        return { queuedSubmission: { id: randomUUID(), clientUserMessageId: randomUUID() } };
      }),
  );
  t.after(() => adapter.stop());
  await adapter.start();
  assert.equal((await adapter.deliver(input)).state, 'uncertain');
  validThread = false;
  assert.equal((await adapter.deliver(input)).state, 'failed');
  assert.equal(submissions, 1);
});

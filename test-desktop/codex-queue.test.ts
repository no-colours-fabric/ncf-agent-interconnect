import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { CodexQueueAdapter } from '../desktop/core/codex-queue.js';
import type { EventInput } from '../desktop/core/adapters.js';
import {
  codexQueueWitness,
  contentHash,
  type DeliveryAttempt,
} from '../desktop/core/delivery-attempt.js';
import type { AdapterProfile } from '../desktop/shared/contracts.js';

async function fixture(t: TestContext) {
  const directory = await mkdtemp(path.join(tmpdir(), 'ncf-codex-projection-'));
  const transcript = path.join(directory, 'rollout.jsonl');
  await writeFile(transcript, '');
  const threadId = randomUUID();
  const profile: AdapterProfile = {
    id: randomUUID(),
    label: 'Codex',
    kind: 'codex-desktop',
    codexQueue: true,
    threadId,
  };
  const binding = {
    adapterId: profile.id,
    chatId: threadId,
    client: 'Codex',
    connectionId: randomUUID(),
    generation: 1,
  };
  const attempt: DeliveryAttempt = {
    id: randomUUID(),
    ids: [randomUUID()],
    meta: {
      version: 1,
      transport: 'native',
      phase: 'reserved',
      owner: { ...binding, agentKey: 'recipient', incarnation: randomUUID() },
      lifecycle: { service: randomUUID(), transport: randomUUID() },
      payloadHash: null,
      membersHash: '',
      created: 0,
      updated: 0,
    },
  };
  const body =
    '**Incoming NCF Agent Interconnect**\nFrom: "Sender"\n\nСообщение 東京\n\nAttachments:\n- [test file](</tmp/test file.txt>)\n\nReply-To: r1';
  const input: EventInput = {
    nickname: 'Recipient',
    binding,
    messageId: attempt.ids[0]!,
    message: { fromNode: randomUUID(), fromNickname: 'Sender', text: 'Сообщение 東京', files: [] },
    replyRef: 'r1',
    presentMessage: () => ({ text: body, deliveredAt: 0 }),
    deliveryAttempt: attempt,
    beforeRelease: (text, host) => {
      assert.equal(text, body);
      assert.deepEqual(host, {
        messageId: attempt.id,
        runtime: codexQueueWitness,
        session: threadId,
      });
      assert.equal(attempt.meta.phase, 'reserved');
      Object.assign(attempt.meta, { phase: 'issued', host, payloadHash: contentHash(text) });
    },
  };
  const queued: object[] = [];
  let projection: object[] = [];
  let validThread = true;
  let matchingAck = true;
  const adapter = new CodexQueueAdapter(
    profile,
    () => {},
    async (_profile, _signal, operation) =>
      operation(async (method, params) => {
        assert.equal((params as { threadId: string }).threadId, threadId);
        if (method === 'thread/read')
          return {
            thread: {
              id: validThread ? threadId : randomUUID(),
              ephemeral: false,
              path: transcript,
            },
          };
        if (method === 'thread/queue/list') return { data: [] };
        if (method === 'thread/items/list') return { data: projection };
        assert.equal(method, 'thread/queue/add');
        queued.push(params);
        assert.equal(attempt.meta.phase, 'issued');
        return {
          queuedSubmission: {
            id: randomUUID(),
            clientUserMessageId: matchingAck ? attempt.id : randomUUID(),
          },
        };
      }),
    async (_profile, _threadId, value) => {
      assert.equal(value, transcript);
      return transcript;
    },
  );
  t.after(async () => {
    await adapter.stop();
    await rm(directory, { recursive: true, force: true });
  });
  const setProjection = async (clientId: string, text: string, completedAtMs = 1) => {
    projection = [
      {
        item: {
          type: 'userMessage',
          id: randomUUID(),
          clientId,
          content: [{ type: 'text', text }],
          completedAtMs,
        },
      },
    ];
    await writeFile(transcript, randomUUID());
  };
  return {
    adapter,
    input,
    attempt,
    queued,
    body,
    setProjection,
    changeThread: () => {
      validThread = false;
    },
    loseAck: () => {
      matchingAck = false;
    },
  };
}

test('queues the full Codex Incoming and admits only the persisted exact client ID and content', async (t) => {
  const { adapter, input, attempt, queued, body, setProjection } = await fixture(t);
  await adapter.start();
  assert.equal(adapter.status().capabilities.nativeDisplay, true);
  assert.deepEqual(await adapter.deliver(input), { state: 'queued' });
  assert.deepEqual(queued, [
    {
      threadId: input.binding.chatId,
      clientUserMessageId: attempt.id,
      input: [{ type: 'text', text: body, text_elements: [] }],
    },
  ]);
  let receipts = 0;
  adapter.observeDelivery(
    attempt,
    () => true,
    () => receipts++,
  );
  await delay(250);
  assert.equal(receipts, 0);
  await setProjection(randomUUID(), body);
  await delay(250);
  assert.equal(receipts, 0);
  await setProjection(attempt.id, body + ' modified');
  await delay(250);
  assert.equal(receipts, 0);
  await setProjection(attempt.id, body);
  const deadline = Date.now() + 3000;
  while (!receipts && Date.now() < deadline) await delay(25);
  assert.equal(receipts, 1);
  await setProjection(attempt.id, body);
  await delay(250);
  assert.equal(receipts, 1);
  assert.equal(
    (await adapter.deliver({ ...input, binding: { ...input.binding, chatId: randomUUID() } }))
      .state,
    'failed',
  );
  assert.equal((await adapter.deliver({ ...input, isCurrent: () => false })).state, 'revoked');
  assert.equal(queued.length, 1);
});

test('an ambiguous queue submission retains the exact projection witness and never retries', async (t) => {
  const { adapter, input, attempt, queued, body, setProjection, changeThread, loseAck } =
    await fixture(t);
  await adapter.start();
  loseAck();
  assert.equal((await adapter.deliver(input)).state, 'uncertain');
  let receipts = 0;
  adapter.observeDelivery(
    attempt,
    () => true,
    () => receipts++,
  );
  await delay(250);
  assert.equal(receipts, 0);
  await setProjection(attempt.id, body);
  const deadline = Date.now() + 3000;
  while (!receipts && Date.now() < deadline) await delay(25);
  assert.equal(receipts, 1);
  changeThread();
  assert.equal((await adapter.deliver(input)).state, 'failed');
  assert.equal(queued.length, 1);
});

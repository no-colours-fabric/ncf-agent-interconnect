import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import {
  CodexQueueAdapter,
  CodexRpcRejection,
  codexQueueHome,
  codexQueueLocator,
  codexTranscriptMatchesThread,
} from '../desktop/core/codex-queue.js';
import type { EventInput } from '../desktop/core/adapters.js';
import {
  codexQueueWitness,
  contentHash,
  type DeliveryAttempt,
} from '../desktop/core/delivery-attempt.js';
import type { AdapterProfile } from '../desktop/shared/contracts.js';

test(
  'Windows queue discovery binds only a canonical local profile and never stats its socket',
  {
    skip: process.platform !== 'win32',
  },
  async (t) => {
    const home = await mkdtemp(path.join(tmpdir(), 'ncf-win-codex-home-'));
    t.after(() => rm(home, { recursive: true, force: true }));
    const locator = codexQueueLocator(home);
    assert.equal(locator, path.join(home, 'app-server-control', 'app-server-control.sock'));
    assert.equal(path.relative(await codexQueueHome(locator), home), '');
    await assert.rejects(codexQueueHome('\\\\.\\pipe\\codex-ipc'));
    await assert.rejects(codexQueueHome(path.join(home, 'app-server-control', 'other.sock')));
  },
);

async function fixture(t: TestContext, shared = false) {
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
  const steered: object[] = [];
  const started: object[] = [];
  const queuedId = randomUUID();
  const activeTurn = randomUUID();
  let threadState = shared ? 'active' : 'notLoaded';
  let latestTurn = { id: activeTurn, status: 'inProgress' };
  let queueStartError: CodexRpcRejection | undefined;
  let projection: object[] = [];
  let validThread = true;
  let matchingAck = true;
  let expiredTurn = false;
  const session: NonNullable<ConstructorParameters<typeof CodexQueueAdapter>[2]> = async (
    _profile,
    _signal,
    operation,
  ) =>
    operation(async (method, params) => {
      assert.equal((params as { threadId: string }).threadId, threadId);
      if (method === 'thread/read')
        return {
          thread: {
            id: validThread ? threadId : randomUUID(),
            ephemeral: false,
            path: transcript,
            status: { type: threadState },
          },
        };
      if (method === 'thread/queue/list') return { data: [] };
      if (method === 'thread/items/list') return { data: projection };
      if (method === 'thread/turns/list') return { data: [latestTurn] };
      assert.equal(attempt.meta.phase, 'issued');
      if (method === 'turn/steer') {
        steered.push(params);
        if (expiredTurn) throw new CodexRpcRejection(-32600, 'no active turn to steer');
        return { turnId: matchingAck ? activeTurn : randomUUID() };
      }
      if (method === 'thread/queue/start') {
        started.push(params);
        if (queueStartError) throw queueStartError;
        return { turn: { id: randomUUID(), status: 'inProgress' } };
      }
      assert.equal(method, 'thread/queue/add');
      queued.push(params);
      return {
        queuedSubmission: {
          id: queuedId,
          clientUserMessageId: matchingAck ? attempt.id : randomUUID(),
        },
      };
    });
  const adapter = new CodexQueueAdapter(
    profile,
    () => {},
    session,
    async (_profile, _threadId, value) => {
      assert.equal(value, transcript);
      return transcript;
    },
    shared ? session : undefined,
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
    steered,
    started,
    queuedId,
    activeTurn,
    body,
    setProjection,
    changeThread: () => {
      validThread = false;
    },
    expireTurn: () => {
      expiredTurn = true;
    },
    interrupt: () => {
      threadState = 'idle';
      latestTurn = { id: activeTurn, status: 'interrupted' };
    },
    rejectQueueStart: (reason: string) => {
      queueStartError = new CodexRpcRejection(-32600, reason);
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

test('commits a queued Codex message manually steered with one trailing line feed', async (t) => {
  const { adapter, input, attempt, body, setProjection } = await fixture(t);
  await adapter.start();
  assert.deepEqual(await adapter.deliver(input), { state: 'queued' });
  let receipts = 0;
  adapter.observeDelivery(
    attempt,
    () => true,
    () => receipts++,
  );
  await setProjection(randomUUID(), body + '\n');
  await delay(250);
  assert.equal(receipts, 0);
  await setProjection(attempt.id, body + '\n\n');
  await delay(250);
  assert.equal(receipts, 0);
  await setProjection(attempt.id, body + '\n');
  const deadline = Date.now() + 3000;
  while (!receipts && Date.now() < deadline) await delay(25);
  assert.equal(receipts, 1);
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

test('steers a verified active Codex turn and waits for the saved native item', async (t) => {
  const { adapter, input, attempt, queued, steered, activeTurn, body, setProjection } =
    await fixture(t, true);
  await adapter.start();
  assert.equal(adapter.status().capabilities.receiveActive, true);
  assert.equal((await adapter.deliver(input)).state, 'queued');
  assert.deepEqual(steered, [
    {
      threadId: input.binding.chatId,
      expectedTurnId: activeTurn,
      clientUserMessageId: attempt.id,
      input: [{ type: 'text', text: body, text_elements: [] }],
    },
  ]);
  assert.deepEqual(queued, []);
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
});

test('a mismatched active-turn response cannot duplicate a possible release into the queue', async (t) => {
  const { adapter, input, queued, steered, loseAck } = await fixture(t, true);
  await adapter.start();
  loseAck();
  assert.equal((await adapter.deliver(input)).state, 'uncertain');
  assert.equal(steered.length, 1);
  assert.deepEqual(queued, []);
});

test('starts only the new full Incoming after an explicit interruption on the owning App Server', async (t) => {
  const {
    adapter,
    input,
    attempt,
    body,
    queued,
    steered,
    started,
    queuedId,
    interrupt,
    setProjection,
  } = await fixture(t, true);
  interrupt();
  await adapter.start();
  assert.deepEqual(await adapter.deliver(input), { state: 'queued' });
  assert.deepEqual(started, [{ threadId: input.binding.chatId, queuedSubmissionId: queuedId }]);
  assert.equal(steered.length, 0);
  assert.equal(queued.length, 1);
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
});

test('leaves one queued Incoming when a concurrent turn prevents its explicit start', async (t) => {
  const { adapter, input, started, queued, interrupt, rejectQueueStart } = await fixture(t, true);
  interrupt();
  rejectQueueStart('thread already has an active or pending turn');
  await adapter.start();
  assert.deepEqual(await adapter.deliver(input), { state: 'queued' });
  assert.equal(started.length, 1);
  assert.equal(queued.length, 1);
});

test('does not retry an ambiguous explicit Codex queue start', async (t) => {
  const { adapter, input, started, queued, interrupt, rejectQueueStart } = await fixture(t, true);
  interrupt();
  rejectQueueStart('unknown error');
  await adapter.start();
  assert.equal((await adapter.deliver(input)).state, 'uncertain');
  assert.equal(started.length, 1);
  assert.equal(queued.length, 1);
});

test('a definite expired-turn rejection queues the same delivery attempt once', async (t) => {
  const { adapter, input, attempt, steered, queued, expireTurn } = await fixture(t, true);
  await adapter.start();
  expireTurn();
  assert.equal((await adapter.deliver(input)).state, 'queued');
  assert.equal(steered.length, 1);
  assert.equal(queued.length, 1);
  assert.equal((queued[0] as { clientUserMessageId?: string }).clientUserMessageId, attempt.id);
});

test('matches the exact chat in legacy and suffixed Codex rollout names', () => {
  const thread = randomUUID();
  const other = randomUUID();
  const prefix = 'rollout-2026-11-21T16-10-00-';
  assert.equal(codexTranscriptMatchesThread(prefix + thread + '.jsonl', thread), true);
  assert.equal(
    codexTranscriptMatchesThread(prefix + thread + '_' + other + '.jsonl', thread),
    true,
  );
  assert.equal(
    codexTranscriptMatchesThread(prefix + other + '_' + thread + '.jsonl', thread),
    false,
  );
  assert.equal(codexTranscriptMatchesThread(prefix + thread + '_unexpected.jsonl', thread), false);
});

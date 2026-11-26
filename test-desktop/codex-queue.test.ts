import { canNavigateToQueuedChat } from '../desktop/main/codex-chat-wake.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { link, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
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
  'Windows control recovery preserves the exact chat and never writes input',
  {
    skip: process.platform !== 'win32',
  },
  async (t) => {
    async function fixture(t: TestContext, wrongThread = false) {
      const directory = await mkdtemp(path.join(tmpdir(), 'ncf-control-recovery-'));
      const home = await realpath(directory);
      const control = path.join(home, 'app-server-control');
      await mkdir(control);
      const threadId = randomUUID();
      const profile: AdapterProfile = {
        id: randomUUID(),
        kind: 'codex-desktop',
        label: 'Codex',
        codexQueue: true,
        socket: codexQueueLocator(home),
        threadId,
      };
      let available = false;
      let connections = 0;
      let ready!: () => void;
      let checked!: () => void;
      const readiness = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const rechecked = new Promise<void>((resolve) => {
        checked = resolve;
      });
      const methods: string[] = [];
      const adapter = new CodexQueueAdapter(
        profile,
        () => {
          if (connections > 1) checked();
          if (adapter.status().state === 'ready') ready();
        },
        undefined,
        async () => path.join(home, 'synthetic-transcript.jsonl'),
        async (actual, signal, operation) => {
          assert.equal(actual, profile);
          assert.equal(signal.aborted, false);
          connections++;
          if (!available) throw new Error('Synthetic owner is not ready yet');
          return operation(async (method, params) => {
            methods.push(method);
            assert.equal((params as { threadId: string }).threadId, threadId);
            if (method === 'thread/read')
              return {
                thread: {
                  id: wrongThread ? randomUUID() : threadId,
                  ephemeral: false,
                  path: path.join(home, 'synthetic-transcript.jsonl'),
                  status: { type: 'active' },
                },
              };
            assert.ok(method === 'thread/queue/list' || method === 'thread/items/list');
            return { data: [] };
          });
        },
      );
      t.after(async () => {
        await adapter.stop();
        await rm(directory, { recursive: true, force: true });
      });
      return {
        adapter,
        profile,
        control,
        readiness,
        rechecked,
        methods,
        available: () => {
          available = true;
        },
        connections: () => connections,
      };
    }
    const within = (promise: Promise<void>) =>
      Promise.race([
        promise,
        delay(2500).then(() => {
          throw new Error('Recovery did not complete');
        }),
      ]);
    await t.test('a startup failure recovers without reconnecting the binding', async (t) => {
      const f = await fixture(t);
      await f.adapter.start();
      assert.equal(f.adapter.status().state, 'error');
      f.available();
      await within(f.readiness);
      assert.equal(f.adapter.profile, f.profile);
      assert.equal(f.adapter.status().capabilities.receiveActive, true);
      assert.deepEqual(f.methods, ['thread/read', 'thread/queue/list', 'thread/items/list']);
    });
    await t.test(
      'an endpoint change revalidates the exact owner instead of trusting readiness',
      async (t) => {
        const f = await fixture(t, true);
        await f.adapter.start();
        f.available();
        await writeFile(path.join(f.control, 'app-server-control.sock'), 'synthetic endpoint');
        await within(f.rechecked);
        assert.equal(f.adapter.status().state, 'error');
        assert.deepEqual(f.methods, ['thread/read']);
      },
    );
    await t.test('stop cancels queued reconnects and endpoint observation', async (t) => {
      const f = await fixture(t);
      await f.adapter.start();
      await f.adapter.stop();
      const before = f.connections();
      f.available();
      await writeFile(path.join(f.control, 'app-server-control.sock'), 'synthetic endpoint');
      await delay(400);
      assert.equal(f.connections(), before);
      assert.deepEqual(f.methods, []);
    });
    await t.test('reconnects are bounded and a later endpoint event can recover', async (t) => {
      const f = await fixture(t);
      await f.adapter.start();
      await delay(4700);
      assert.equal(f.connections(), 4);
      await delay(400);
      assert.equal(f.connections(), 4);
      f.available();
      await writeFile(path.join(f.control, 'app-server-control.sock'), 'synthetic endpoint');
      await within(f.readiness);
      assert.equal(f.adapter.status().state, 'ready');
      assert.equal(f.adapter.profile, f.profile);
    });
  },
);

test(
  'Windows queue discovery binds only a canonical local profile and never stats its socket',
  {
    skip: process.platform !== 'win32',
  },
  async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'ncf-win-codex-home-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const home = await realpath(directory);
    const locator = codexQueueLocator(home);
    assert.equal(locator, path.join(home, 'app-server-control', 'app-server-control.sock'));
    assert.equal(path.relative(await codexQueueHome(locator), home), '');
    if (path.relative(home, directory))
      await assert.rejects(codexQueueHome(codexQueueLocator(directory)));
    await assert.rejects(codexQueueHome('\\\\.\\pipe\\codex-ipc'));
    await assert.rejects(codexQueueHome(path.join(home, 'app-server-control', 'other.sock')));
  },
);

test(
  'Windows transcript verification accepts only a verbatim spelling of the exact canonical local file',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'ncf-win-transcript-'));
    const outside = await mkdtemp(path.join(tmpdir(), 'ncf-win-transcript-outside-'));
    t.after(async () => {
      await rm(directory, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    });
    const home = await realpath(directory);
    const sessions = path.join(home, 'sessions');
    await mkdir(sessions);
    const threadId = randomUUID();
    const filename = 'rollout-2026-11-22T00-00-00-' + threadId + '.jsonl';
    const transcript = path.join(sessions, filename);
    await writeFile(transcript, '');
    const profile: AdapterProfile = {
      id: randomUUID(),
      kind: 'codex-desktop',
      label: 'Codex',
      codexQueue: true,
      socket: codexQueueLocator(home),
      threadId,
    };
    async function stateFor(returnedPath: string) {
      const adapter = new CodexQueueAdapter(
        profile,
        () => {},
        undefined,
        undefined,
        async (_profile, _signal, operation) =>
          operation(async (method) => {
            if (method === 'thread/read')
              return {
                thread: {
                  id: threadId,
                  ephemeral: false,
                  path: returnedPath,
                  status: { type: 'idle' },
                },
              };
            if (method === 'thread/queue/list' || method === 'thread/items/list')
              return { data: [] };
            throw new Error('Unexpected synthetic operation');
          }),
      );
      try {
        await adapter.start();
        return adapter.status().state;
      } finally {
        await adapter.stop();
      }
    }
    assert.equal(await stateFor(transcript), 'ready');
    assert.equal(await stateFor(path.toNamespacedPath(transcript)), 'ready');
    const external = path.join(await realpath(outside), filename);
    await writeFile(external, '');
    assert.equal(await stateFor(path.toNamespacedPath(external)), 'error');
    const wrongThread = path.join(
      sessions,
      'rollout-2026-11-22T00-00-00-' + randomUUID() + '.jsonl',
    );
    await writeFile(wrongThread, '');
    assert.equal(await stateFor(path.toNamespacedPath(wrongThread)), 'error');
    assert.equal(await stateFor('\\\\?\\GLOBALROOT\\Device\\' + filename), 'error');
    await link(transcript, path.join(sessions, 'second-link.jsonl'));
    assert.equal(await stateFor(path.toNamespacedPath(transcript)), 'error');
  },
);

async function fixture(
  t: TestContext,
  shared = false,
  wake?: ConstructorParameters<typeof CodexQueueAdapter>[5],
) {
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
  const resumed: object[] = [];
  const queuedId = randomUUID();
  const activeTurn = randomUUID();
  let threadState = shared ? 'active' : 'notLoaded';
  let latestTurn = { id: activeTurn, status: 'inProgress' };
  let queueStartError: CodexRpcRejection | undefined;
  let projection: object[] = [];
  let validThread = true;
  let matchingAck = true;
  let echo = false;
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
      if (method === 'thread/queue/list') return { data: queued };
      if (method === 'thread/items/list') return { data: projection };
      if (method === 'thread/turns/list') return { data: [latestTurn] };
      assert.equal(attempt.meta.phase, 'issued');
      if (method === 'thread/resume') {
        assert.equal(threadState, 'notLoaded');
        resumed.push(params);
        threadState = 'active';
        return { thread: { id: threadId } };
      }
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
          ...(echo ? { input: (params as { input: unknown }).input } : {}),
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
    shared
      ? session
      : async () => {
          throw new Error('No shared owner');
        },
    wake,
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
    resumed,
    unload: () => {
      threadState = 'notLoaded';
    },
    queuedId,
    activeTurn,
    body,
    setProjection,
    echoInput: () => {
      echo = true;
    },
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

test('wakes a verified queued submission on desktop launch without resending or recording receipt', async (t) => {
  let target: string | undefined;
  let wakeCount = 0;
  const { adapter, attempt, input, queued, body, setProjection } = await fixture(
    t,
    false,
    async (profile, current) => {
      assert.ok(current());
      target = profile.threadId;
      wakeCount++;
    },
  );
  await adapter.start();
  assert.deepEqual(await adapter.deliver(input), { state: 'queued' });
  const row = queued[0] as { clientUserMessageId: string };
  row.clientUserMessageId = randomUUID();
  let receipts = 0;
  adapter.observeDelivery(
    attempt,
    () => true,
    () => receipts++,
  );
  await delay(250);
  assert.equal(wakeCount, 0);
  row.clientUserMessageId = attempt.id;
  adapter.desktopLaunched();
  await delay(250);
  assert.equal(target, input.binding.chatId);
  assert.equal(wakeCount, 1);
  assert.equal(receipts, 0);
  adapter.desktopLaunched();
  await delay(250);
  assert.equal(wakeCount, 2);
  assert.equal(queued.length, 1);
  queued.splice(0);
  await setProjection(attempt.id, body);
  await delay(250);
  assert.equal(receipts, 1);
  assert.equal(wakeCount, 2);
});

test('resumes an unloaded chat on its owner only for the verified head, without navigating or sending twice', async (t) => {
  const navigate = t.mock.fn(async () => {});
  const f = await fixture(t, true, navigate);
  f.unload();
  f.echoInput();
  await f.adapter.start();
  assert.equal((await f.adapter.deliver(f.input)).state, 'queued');
  const other = { ...f.queued[0], clientUserMessageId: randomUUID() };
  f.queued.unshift(other);
  let receipts = 0;
  f.adapter.observeDelivery(
    f.attempt,
    () => true,
    () => receipts++,
  );
  await delay(250);
  assert.equal(f.resumed.length, 0);
  f.queued.shift();
  const row = f.queued[0] as { input: { text: string }[] };
  row.input[0]!.text = f.body + '\n';
  f.adapter.desktopLaunched();
  await delay(250);
  assert.equal(f.resumed.length, 0);
  row.input[0]!.text = f.body;
  f.adapter.desktopLaunched();
  await delay(250);
  assert.deepEqual(f.resumed, [{ threadId: f.input.binding.chatId, excludeTurns: true }]);
  assert.equal(navigate.mock.callCount(), 0);
  assert.equal(receipts, 0);
  f.adapter.desktopLaunched();
  await f.setProjection(f.attempt.id, f.body);
  await delay(250);
  assert.equal(f.resumed.length, 1);
  assert.equal(f.queued.length, 1);
  assert.equal(receipts, 1);
});

test('a warm queue wake preserves other loaded desktop chats, independently of the sender', async (t) => {
  const home = await mkdtemp(path.join(tmpdir(), 'ncf-stock-focus-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  assert.equal(await canNavigateToQueuedChat(home, 'delivery'), false);
  const locks = path.join(home, 'thread-writer-locks');
  await mkdir(locks);
  await writeFile(path.join(locks, '.coordination.lock'), '');
  assert.equal(await canNavigateToQueuedChat(home, 'delivery'), true);
  await writeFile(path.join(locks, randomUUID() + '.lock'), '');
  assert.equal(await canNavigateToQueuedChat(home, 'delivery'), false);
  assert.equal(await canNavigateToQueuedChat(home, 'launch'), true);
});

test('a fresh exact queue echo wakes the desktop immediately and is not a receipt', async (t) => {
  let wakes = 0;
  const f = await fixture(t, false, async (profile, current) => {
    assert.equal(profile.threadId, f.input.binding.chatId);
    assert.ok(current());
    wakes++;
  });
  f.echoInput();
  await f.adapter.start();
  assert.equal((await f.adapter.deliver(f.input)).state, 'queued');
  assert.equal(wakes, 1);
  let receipts = 0;
  f.adapter.observeDelivery(
    f.attempt,
    () => true,
    () => receipts++,
  );
  await delay(200);
  assert.equal(wakes, 1);
  assert.equal(receipts, 0);
  f.adapter.desktopLaunched();
  await delay(200);
  assert.equal(wakes, 2);
  assert.equal(f.queued.length, 1);
  await f.setProjection(f.attempt.id, f.body);
  await delay(250);
  assert.equal(receipts, 1);
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

test('Codex confirmation uses exact owner input and never replaces an uncertain submission', async (t) => {
  for (const scenario of ['active', 'stopped', 'idle', 'standard', 'uncertain'] as const) {
    await t.test(scenario, async (t) => {
      const threadId = randomUUID();
      const turnId = randomUUID();
      const submissionId = randomUUID();
      const methods: string[] = [];
      let payload: Record<string, unknown> | undefined;
      let reads = 0;
      const session: NonNullable<ConstructorParameters<typeof CodexQueueAdapter>[2]> = async (
        _profile,
        _signal,
        operation,
      ) =>
        operation(async (method, raw) => {
          const params = raw as Record<string, unknown>;
          assert.equal(params.threadId, threadId);
          methods.push(method);
          if (method === 'thread/read') {
            reads++;
            return {
              thread: {
                id: threadId,
                ephemeral: false,
                status: {
                  type:
                    scenario === 'standard'
                      ? 'notLoaded'
                      : scenario === 'stopped' || scenario === 'idle'
                        ? 'idle'
                        : 'active',
                },
                path: '/fixture/transcript',
              },
            };
          }
          if (method === 'thread/queue/list') return { data: [], nextCursor: null };
          if (method === 'thread/turns/list')
            return {
              data: [
                {
                  id: turnId,
                  status:
                    scenario === 'stopped'
                      ? 'interrupted'
                      : scenario === 'idle'
                        ? 'completed'
                        : 'inProgress',
                },
              ],
            };
          if (method === 'turn/steer') {
            payload = params;
            assert.equal(params.expectedTurnId, turnId);
            if (scenario === 'uncertain') throw new Error('Connection closed after write');
            return { turnId };
          }
          if (method === 'thread/queue/add') {
            payload = params;
            return {
              queuedSubmission: {
                id: submissionId,
                clientUserMessageId: params.clientUserMessageId,
              },
            };
          }
          assert.equal(method, 'thread/queue/start');
          assert.equal(params.queuedSubmissionId, submissionId);
          return { turn: { id: turnId, status: 'inProgress' } };
        });
      const adapter = new CodexQueueAdapter(
        { id: randomUUID(), kind: 'codex-desktop', label: 'Codex', threadId },
        () => {},
        session,
        async () => '/fixture/transcript',
        scenario === 'standard'
          ? async () => {
              throw new Error('No shared owner');
            }
          : session,
      );
      t.after(() => adapter.stop());
      const token = randomUUID();
      const result = await adapter.challenge(token, () => true);
      assert.equal(
        result.state,
        scenario === 'standard' || scenario === 'idle'
          ? 'queued'
          : scenario === 'uncertain'
            ? 'uncertain'
            : 'dispatched',
      );
      assert.ok(reads > 0);
      assert.match(JSON.stringify(payload), new RegExp(token));
      assert.ok(!JSON.stringify(result).includes(token));
      const writes = methods.filter((method) =>
        ['turn/steer', 'thread/queue/add', 'thread/queue/start'].includes(method),
      );
      assert.deepEqual(
        writes,
        scenario === 'stopped'
          ? ['thread/queue/add', 'thread/queue/start']
          : scenario === 'standard' || scenario === 'idle'
            ? ['thread/queue/add']
            : ['turn/steer'],
      );
    });
  }
});

test('Codex confirmation recognizes only its exact queued or persisted input', async (t) => {
  const threadId = randomUUID();
  const queueId = randomUUID();
  let state = 'notLoaded';
  let queue: { input: unknown; clientUserMessageId: unknown } | undefined;
  let items: object[] = [];
  let submissions = 0;
  let nextPage = false;
  const session: NonNullable<ConstructorParameters<typeof CodexQueueAdapter>[2]> = async (
    _profile,
    _signal,
    operation,
  ) =>
    operation(async (method, raw) => {
      const params = raw as Record<string, unknown>;
      assert.equal(params.threadId, threadId);
      if (method === 'thread/read')
        return {
          thread: {
            id: threadId,
            ephemeral: false,
            path: '/fixture/transcript',
            status: { type: state },
          },
        };
      if (method === 'thread/queue/list') {
        if (nextPage && !params.cursor) return { data: [], nextCursor: '24' };
        if (nextPage) assert.equal(params.cursor, '24');
        return { data: queue ? [queue] : [], nextCursor: null };
      }
      if (method === 'thread/items/list') return { data: items, nextCursor: null };
      assert.equal(method, 'thread/queue/add');
      submissions++;
      queue = { input: params.input, clientUserMessageId: params.clientUserMessageId };
      return { queuedSubmission: { id: queueId, clientUserMessageId: queue.clientUserMessageId } };
    });
  const wake = t.mock.fn(async (profile: AdapterProfile, current: () => boolean) => {
    assert.equal(profile.threadId, threadId);
    assert.ok(current());
  });
  const adapter = new CodexQueueAdapter(
    { id: randomUUID(), kind: 'codex-desktop', label: 'Codex', threadId },
    () => {},
    session,
    async () => '/fixture/transcript',
    session,
    wake,
  );
  t.after(() => adapter.stop());

  const offer = await adapter.challenge(randomUUID(), () => true);
  assert.equal(offer.state, 'queued');
  if (!('witness' in offer) || !queue) throw new Error('Missing fixture confirmation');
  const original = queue;
  nextPage = true;
  assert.equal((await adapter.challenge(randomUUID(), () => true)).state, 'blocked');
  assert.equal(submissions, 1);
  assert.equal(await adapter.observeConfirmation(offer.witness), 'queued');

  const initialWakes = wake.mock.callCount();
  await adapter.observeConfirmation(offer.witness, () => false);
  await adapter.observeConfirmation({ ...offer.witness, messageId: randomUUID() }, () => true);
  await adapter.observeConfirmation({ ...offer.witness, payloadHash: 'different' }, () => true);
  assert.equal(wake.mock.callCount(), initialWakes);
  assert.equal(await adapter.observeConfirmation(offer.witness, () => true), 'queued');
  assert.equal(wake.mock.callCount(), initialWakes + 1);
  queue = undefined;
  state = 'active';
  assert.equal(await adapter.observeConfirmation(offer.witness), 'unknown');
  state = 'idle';
  const item = {
    id: randomUUID(),
    type: 'userMessage',
    clientId: offer.witness.messageId,
    completedAtMs: 100,
    content: original.input,
  };
  items = [
    { item: { ...item, clientId: randomUUID() } },
    { item: { ...item, content: [{ type: 'text', text: 'Unrelated content' }] } },
    { item: { ...item, completedAtMs: null } },
  ];
  assert.equal(await adapter.observeConfirmation(offer.witness), 'missing');
  items.push({ item });
  assert.deepEqual(await adapter.observeConfirmation(offer.witness, () => true), {
    admittedAt: 100,
  });
  assert.equal(wake.mock.callCount(), initialWakes + 1);
  assert.equal(submissions, 1);
});

test('connect diagnostics identify the first unavailable native operation without exposing its input', async (t) => {
  for (const [method, stage] of [
    ['initialize', 'app_server'],
    ['thread/read', 'chat'],
    ['thread/queue/list', 'queue'],
    ['thread/items/list', 'history'],
    ['transcript', 'transcript'],
    ['thread/turns/list', 'turn'],
  ]) {
    await t.test(method, async () => {
      const threadId = randomUUID();
      const fail = () => {
        throw Error('private native diagnostic');
      };
      const session: NonNullable<ConstructorParameters<typeof CodexQueueAdapter>[2]> = async (
        _p,
        _signal,
        operation,
      ) => {
        if (method === 'initialize') fail();
        return operation(async (rpc) => {
          if (rpc === method) fail();
          if (rpc === 'thread/read')
            return {
              thread: {
                id: threadId,
                ephemeral: false,
                status: { type: 'active' },
                path: 'synthetic',
              },
            };
          if (!['thread/items/list', 'thread/queue/list', 'thread/turns/list'].includes(rpc))
            throw Error('Unexpected submission');
          return { data: [] };
        });
      };
      const adapter = new CodexQueueAdapter(
        { id: randomUUID(), threadId, label: 'Fixture', kind: 'codex-desktop' },
        () => {},
        session,
        async () => (method === 'transcript' ? fail() : 'synthetic'),
        session,
      );
      try {
        if (stage !== 'turn') {
          await adapter.start();
          assert.throws(
            () => adapter.requireReady(),
            (error: unknown) =>
              error instanceof Error &&
              'stage' in error &&
              error.stage === stage &&
              !error.message.includes('private'),
          );
        }
        if (stage !== 'history') {
          const outcome = await adapter.challenge(randomUUID(), () => true);
          assert.deepEqual(outcome, { state: 'failed', stage });
        }
      } finally {
        await adapter.stop();
      }
    });
  }
});

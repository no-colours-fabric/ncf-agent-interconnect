import { expect, test } from 'claude-code/testing';

const settle = async () => {
  for (let i = 0; i < 2000; i++) await Promise.resolve();
};

const sessionA = 'b5e1a3f2-0000-4000-8000-000000000001';
const sessionB = 'b5e1a3f2-0000-4000-8000-000000000002';
const claim = 'c'.repeat(64);

// A stub answer the test releases explicitly: a deterministic barrier, not a timer.
function gate<T>() {
  let open: (value: T) => void = () => {};
  const wait = new Promise<T>((resolve) => (open = resolve));
  return { wait, open };
}

type Answer = Promise<Record<string, unknown>> | Record<string, unknown>;
interface Options {
  sessionId?: () => Promise<string> | string;
  descriptor?: () => Promise<string> | string;
  pending?: () => Answer;
  consume?: () => Answer;
  start?: () => Answer;
  drop?: string;
  // Holds the mod's own submission like a prompt queued until the session is idle.
  queue?: Promise<void>;
}

function fixture(on, options: Options = {}) {
  // What actually reached Claude Code after every prompt.submit hook.
  const delivered: { text: string; asUser?: boolean }[] = [];
  const reports: Record<string, unknown>[] = [];
  const routes: string[] = [];
  on('session.start', ($, e) => e);
  on('session.end', ($, e) => e);
  on('session.id', async () => ({ value: await (options.sessionId?.() ?? sessionA) }));
  on('env.get', () => ({ value: '/fixture/research-first-wake.json' }));
  on('fs.read', async () => ({
    value:
      (await options.descriptor?.()) ??
      JSON.stringify({ url: 'http://127.0.0.1:1', token: 'fixture' }),
  }));
  on('http.fetch', async ($, e) => {
    const route = String(e.url).replace('http://127.0.0.1:1', '');
    routes.push(route);
    const body = JSON.parse(e.init.body);
    let value: Record<string, unknown> = {};
    if (route === '/first-wake/result') reports.push(body);
    else if (route === '/first-wake/pending')
      value = (await options.pending?.()) ?? { wake: true, nickname: 'Боб', claim };
    else if (route === '/first-wake/claim')
      value = (await options.consume?.()) ?? { consumed: true };
    else if (route === '/first-wake/start') value = (await options.start?.()) ?? { started: true };
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(value) } };
  });
  // The kit sends the mod's own $.prompt.submit straight to this stub, without
  // the mod's prompt.submit hook. A test fires $.prompt.submit itself to model
  // the engine dequeuing that prompt through every prompt.submit hook.
  let queue = options.queue;
  on('prompt.submit', async ($, e) => {
    delivered.push({ text: e.text, asUser: e.asUser });
    const held = queue;
    queue = undefined;
    if (held) await held;
    return options.drop ? { drop: options.drop } : { text: e.text };
  });
  return { delivered, reports, routes };
}

const end = ($, reason = 'clear') =>
  $.session.end({ cwd: '/fixture', sessionId: sessionA, reason });

test('a current start consumes the claim and submits one plugin notice', async ($, on) => {
  const f = fixture(on, { pending: () => ({ wake: true, nickname: 'Боб "漢字"', claim }) });
  await $.session.start({ cwd: '/fixture' });
  await settle();
  expect(f.delivered.length).toBe(1);
  expect(f.delivered[0].asUser).toBeUndefined();
  expect(f.delivered[0].text).toContain('"Боб \\"漢字\\""');
  expect(f.delivered[0].text).toContain('no message content');
  expect(f.routes).toEqual(['/first-wake/pending', '/first-wake/claim', '/first-wake/result']);
  expect(f.reports.map((r) => r.outcome)).toEqual(['turn-started']);
});

test('an end while the session id is pending submits nothing and asks nothing', async ($, on) => {
  const id = gate<string>();
  const f = fixture(on, { sessionId: () => id.wait });
  await $.session.start({ cwd: '/fixture' });
  await settle();
  await end($);
  id.open(sessionA);
  await settle();
  expect(f.delivered.length).toBe(0);
  expect(f.routes).toEqual([]);
});

test('an end while the descriptor is read submits nothing', async ($, on) => {
  const descriptor = gate<string>();
  const f = fixture(on, { descriptor: () => descriptor.wait });
  await $.session.start({ cwd: '/fixture' });
  await settle();
  await end($, 'resume');
  descriptor.open(JSON.stringify({ url: 'http://127.0.0.1:1', token: 'fixture' }));
  await settle();
  expect(f.delivered.length).toBe(0);
  expect(f.routes).toEqual([]);
});

test('an end during the pending query submits nothing', async ($, on) => {
  const pending = gate<Record<string, unknown>>();
  const f = fixture(on, { pending: () => pending.wait });
  await $.session.start({ cwd: '/fixture' });
  await settle();
  await end($);
  pending.open({ wake: true, nickname: 'Боб', claim });
  await settle();
  expect(f.delivered.length).toBe(0);
  expect(f.routes).toEqual(['/first-wake/pending', '/first-wake/result']);
  expect(f.reports.map((r) => r.outcome)).toEqual(['fenced']);
});

test('an end while the claim is being consumed submits nothing', async ($, on) => {
  const consume = gate<Record<string, unknown>>();
  const f = fixture(on, { consume: () => consume.wait });
  await $.session.start({ cwd: '/fixture' });
  await settle();
  await end($, 'prompt_input_exit');
  consume.open({ consumed: true });
  await settle();
  expect(f.delivered.length).toBe(0);
  expect(f.reports.map((r) => r.outcome)).toEqual(['fenced']);
});

test('a delayed answer from a previous start never replaces the newer lifecycle', async ($, on) => {
  const first = gate<Record<string, unknown>>();
  const second = gate<Record<string, unknown>>();
  const answers = [() => first.wait, () => second.wait];
  const ids = [sessionA, sessionB];
  const f = fixture(on, { pending: () => answers.shift()!(), sessionId: () => ids.shift()! });
  await $.session.start({ cwd: '/fixture' });
  await settle();
  await $.session.start({ cwd: '/fixture' });
  await settle();
  first.open({ wake: true, nickname: 'Старый', claim });
  await settle();
  expect(f.delivered.length).toBe(0);
  // The newer lifecycle is still current and its own wake goes through once.
  second.open({ wake: true, nickname: 'Новый', claim });
  await settle();
  expect(f.delivered.length).toBe(1);
  expect(f.delivered[0].text).toContain('"Новый"');
  expect(f.reports.map((r) => [r.sessionId, r.outcome])).toEqual([
    [sessionA, 'fenced'],
    [sessionB, 'turn-started'],
  ]);
});

test('no wake, an invalid name, a missing claim or a refused claim submits nothing', async ($, on) => {
  const answers = [
    { wake: false, reason: 'deadline:none-pending', claim: null },
    { wake: true, nickname: 'line\nbreak', claim },
    { wake: true, nickname: 'Боб', claim: null },
    { wake: true, nickname: 'Боб', claim },
  ];
  const f = fixture(on, {
    pending: () => answers.shift()!,
    consume: () => ({ consumed: false, reason: 'revoked:helper' }),
  });
  for (let i = 0; i < 4; i++) {
    await $.session.start({ cwd: '/fixture' });
    await settle();
  }
  expect(f.delivered.length).toBe(0);
  expect(f.reports.map((r) => r.outcome)).toEqual([
    'not-submitted:deadline:none-pending',
    'not-submitted:no-wake',
    'not-submitted:no-wake',
    'claim:revoked:helper',
  ]);
});

test('a dequeued notice passes the start check once and a replay is dropped', async ($, on) => {
  const queued = gate<void>();
  const f = fixture(on, { queue: queued.wait });
  await $.session.start({ cwd: '/fixture' });
  await settle();
  expect(f.delivered.length).toBe(1);
  const text = f.delivered[0].text;
  // Dequeue: the mod's own hook revalidates the lifecycle and the claim.
  const passed = await $.prompt.submit({ text });
  expect(passed.drop).toBeUndefined();
  expect(f.delivered.length).toBe(2);
  // The same notice again (a replay) is not the pending notice any more.
  const replay = await $.prompt.submit({ text });
  expect(String(replay.drop)).toContain('ended session lifecycle');
  queued.open();
  await settle();
  expect(f.reports.map((r) => r.outcome)).toEqual([
    'prompt-hook:engine',
    'start-check:started',
    'prompt-hook:engine',
    'turn-started',
  ]);
});

test('a refused start check drops the dequeued notice and fences the lifecycle', async ($, on) => {
  const queued = gate<void>();
  const f = fixture(on, {
    queue: queued.wait,
    start: () => ({ started: false, reason: 'revoked:binding' }),
  });
  await $.session.start({ cwd: '/fixture' });
  await settle();
  const result = await $.prompt.submit({ text: f.delivered[0].text });
  expect(String(result.drop)).toContain('withdrawn: claim:revoked:binding');
  expect(f.delivered.length).toBe(1);
  expect(f.reports.map((r) => r.outcome)).toEqual([
    'prompt-hook:engine',
    'start-check:claim:revoked:binding',
  ]);
});

test('an end while the notice is queued drops it', async ($, on) => {
  const queued = gate<void>();
  const f = fixture(on, { queue: queued.wait });
  await $.session.start({ cwd: '/fixture' });
  await settle();
  await end($);
  const ended = await $.prompt.submit({ text: f.delivered[0].text });
  expect(String(ended.drop)).toContain('ended session lifecycle');
  expect(f.delivered.length).toBe(1);
});

test('an end during the start check drops the dequeued notice', async ($, on) => {
  const queued = gate<void>();
  const start = gate<Record<string, unknown>>();
  const f = fixture(on, { queue: queued.wait, start: () => start.wait });
  await $.session.start({ cwd: '/fixture' });
  await settle();
  const pending = $.prompt.submit({ text: f.delivered[0].text });
  await settle();
  await end($);
  start.open({ started: true });
  const result = await pending;
  expect(String(result.drop)).toContain('withdrawn: fenced');
  expect(f.delivered.length).toBe(1);
});

test('a notice from an ended lifecycle is dropped and an unrelated prompt passes', async ($, on) => {
  const f = fixture(on, {});
  const result = await $.prompt.submit({
    text: 'NCF Agent Interconnect messages were already waiting for agent "Боб" when this session started.',
  });
  expect(String(result.drop)).toContain('ended session lifecycle');
  await $.prompt.submit({ text: 'an ordinary owner prompt' });
  expect(f.delivered.map((d) => d.text)).toEqual(['an ordinary owner prompt']);
});

test('a dropped submission is reported once and never retried', async ($, on) => {
  const drop = 'the prompt was removed from the queue before it ran';
  on('turn.complete', ($, e) => ({ text: '' }));
  const f = fixture(on, { drop });
  await $.session.start({ cwd: '/fixture' });
  await settle();
  await $.turn.complete({ cwd: '/fixture', answer: '', text: '' });
  await settle();
  expect(f.delivered.length).toBe(1);
  expect(f.reports.map((r) => r.outcome)).toEqual(['dropped:' + drop]);
});

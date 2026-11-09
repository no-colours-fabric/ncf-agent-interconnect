import { expect, test } from 'claude-code/testing';

const settle = async () => {
  for (let i = 0; i < 2000; i++) await Promise.resolve();
};

const sessionA = 'b5e1a3f2-0000-4000-8000-000000000001';
const sessionB = 'b5e1a3f2-0000-4000-8000-000000000002';
const claim = 'c'.repeat(64);
const notice = (nickname: string) =>
  'NCF Agent Interconnect messages were already waiting for agent ' +
  JSON.stringify(nickname) +
  ' when this session started. Call agent_read for this agent now. Wake reference 00ff.';

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
  drop?: string;
  // Makes the pending query reject, like the 30 second $.http.fetch limit.
  queryFails?: boolean;
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
    if (route === '/first-wake/pending' && options.queryFails) return { deny: 'timed out' };
    const body = JSON.parse(e.init.body);
    let value: Record<string, unknown> = {};
    if (route === '/first-wake/result') reports.push(body);
    else if (route === '/first-wake/pending')
      value = (await options.pending?.()) ?? {
        wake: true,
        nickname: 'Боб',
        claim,
        notice: notice('Боб'),
      };
    else if (route === '/first-wake/claim')
      value = (await options.consume?.()) ?? { consumed: true };
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(value) } };
  });
  on('prompt.submit', ($, e) => {
    delivered.push({ text: e.text, asUser: e.asUser });
    return options.drop ? { drop: options.drop } : { text: e.text };
  });
  return { delivered, reports, routes };
}

const end = ($, reason = 'clear') =>
  $.session.end({ cwd: '/fixture', sessionId: sessionA, reason });

test('a current start consumes the claim and submits one plugin notice', async ($, on) => {
  const f = fixture(on, {
    pending: () => ({ wake: true, nickname: 'Боб "漢字"', claim, notice: notice('Боб "漢字"') }),
  });
  await $.session.start({ cwd: '/fixture' });
  await settle();
  expect(f.delivered.length).toBe(1);
  expect(f.delivered[0].asUser).toBeUndefined();
  expect(f.delivered[0].text).toContain('"Боб \\"漢字\\""');
  expect(f.delivered[0].text).toBe(notice('Боб "漢字"'));
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
  pending.open({ wake: true, nickname: 'Боб', claim, notice: notice('Боб') });
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
  first.open({ wake: true, nickname: 'Старый', claim, notice: notice('Старый') });
  await settle();
  expect(f.delivered.length).toBe(0);
  // The newer lifecycle is still current and its own wake goes through once.
  second.open({ wake: true, nickname: 'Новый', claim, notice: notice('Новый') });
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
    { wake: true, nickname: 'line\nbreak', claim, notice: notice('line\nbreak') },
    { wake: true, nickname: 'Боб', claim: null, notice: notice('Боб') },
    { wake: true, nickname: 'Боб', claim, notice: notice('Боб') },
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

test('a failed pending query is reported and submits nothing', async ($, on) => {
  const f = fixture(on, { queryFails: true });
  await $.session.start({ cwd: '/fixture' });
  await settle();
  expect(f.delivered.length).toBe(0);
  expect(f.reports.map((r) => r.outcome)).toEqual(['query-failed']);
});

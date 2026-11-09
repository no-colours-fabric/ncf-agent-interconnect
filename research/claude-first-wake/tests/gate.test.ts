// G1: the gate's actual asynchronous path, driven through its real hooks with
// explicit barriers. Run explicitly:
// node --experimental-sqlite --import tsx --test research/claude-first-wake/tests/gate.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error The research gate is a plain ES module without declarations.
import { register } from '../gate-mod/hooks/gate.js';

type Hook = (...args: any[]) => any;
const hooks = new Map<string, Hook>();
let fallback: Hook | undefined;
register((name: string, hook: Hook) => {
  hooks.set(name, hook);
  return { catch: (handler: Hook) => void (name === 'prompt.submit' && (fallback = handler)) };
});

const session = 'b5e1a3f2-0000-4000-8000-000000000001';
const notice =
  'NCF Agent Interconnect messages were already waiting for agent "Боб" when this session started. Wake reference 0011.';

function gate<T = void>() {
  let open!: (value: T) => void;
  let fail!: (error: Error) => void;
  const wait = new Promise<T>((resolve, reject) => {
    open = resolve;
    fail = reject;
  });
  return { wait, open, fail };
}

// The mods API surface the gate uses; each route answers through a test barrier.
function host(routes: Record<string, () => Promise<Record<string, unknown>>>) {
  const calls: string[] = [];
  const $ = {
    env: { get: async () => '/fixture/descriptor.json' },
    fs: { read: async () => JSON.stringify({ url: 'http://127.0.0.1:1', token: 'fixture' }) },
    session: { id: async () => session },
    http: {
      fetch: async (url: string, init: { body: string }) => {
        const route = url.replace('http://127.0.0.1:1', '');
        calls.push(route + ' ' + init.body);
        const body = await (routes[route] ?? (async () => ({})))();
        return { ok: true, status: 200, text: JSON.stringify(body) };
      },
    },
  };
  return { $, calls };
}

const settle = async () => {
  for (let i = 0; i < 50; i++) await new Promise(setImmediate);
};

async function submit($: unknown) {
  let forwarded = 0;
  const next = Object.assign(
    async (e: unknown) => {
      forwarded++;
      return e;
    },
    { origin: { plugin: 'ncf-first-wake-research', tier: 'user' } },
  );
  const result = hooks.get('prompt.submit')!($, { text: notice }, next);
  return { result, forwarded: () => forwarded };
}

const start = async ($: unknown) =>
  hooks.get('session.start')!($, { cwd: '/fixture' }, async (e: unknown) => e);
const end = async ($: unknown) =>
  hooks.get('session.end')!($, { cwd: '/fixture', reason: 'clear' }, async (e: unknown) => e);

test('a current notice whose exact claim starts is forwarded once, naming the notice by hash', async () => {
  const { $, calls } = host({ '/first-wake/start': async () => ({ started: true }) });
  await start($);
  await settle();
  const run = await submit($);
  assert.deepEqual(await run.result, { text: notice });
  assert.equal(run.forwarded(), 1);
  const startCall = calls.find((call) => call.startsWith('/first-wake/start'))!;
  assert.match(startCall, /"notice":"[0-9a-f]{64}"/);
  assert.doesNotMatch(startCall, /Боб/);
});

for (const outcome of ['succeeds', 'fails'] as const)
  for (const change of ['end', 'replacement start'] as const)
    test(`${change} while the evidence report ${outcome} forwards nothing`, async () => {
      const reported = gate<Record<string, unknown>>();
      let checking = true;
      const { $, calls } = host({
        '/first-wake/result': async () => {
          if (!checking) return {};
          checking = false;
          return reported.wait;
        },
        '/first-wake/start': async () => ({ started: true }),
      });
      await start($);
      await settle();
      const run = await submit($);
      await settle();
      if (change === 'end') await end($);
      else await start($);
      if (outcome === 'succeeds') reported.open({});
      else reported.fail(new Error('report failed'));
      const result = await run.result;
      assert.equal(run.forwarded(), 0);
      assert.match(String(result.drop), /ended session lifecycle/);
      assert.equal(calls.filter((call) => call.startsWith('/first-wake/start')).length, 0);
    });

for (const outcome of ['started', 'refused'] as const)
  for (const change of ['end', 'replacement start'] as const)
    test(`${change} while the start check is answered ${outcome} forwards nothing`, async () => {
      const answered = gate<Record<string, unknown>>();
      const { $ } = host({ '/first-wake/start': () => answered.wait });
      await start($);
      await settle();
      const run = await submit($);
      await settle();
      if (change === 'end') await end($);
      else await start($);
      answered.open(outcome === 'started' ? { started: true } : { started: false, reason: 'x' });
      const result = await run.result;
      assert.equal(run.forwarded(), 0);
      assert.match(String(result.drop), /ended session lifecycle/);
    });

test('the post-decision report never holds or changes forwarding', async () => {
  const late = gate<Record<string, unknown>>();
  let reports = 0;
  const { $ } = host({
    '/first-wake/result': async () => (++reports === 2 ? late.wait : {}),
    '/first-wake/start': async () => ({ started: true }),
  });
  await start($);
  await settle();
  const run = await submit($);
  assert.deepEqual(await run.result, { text: notice });
  assert.equal(run.forwarded(), 1);
  late.fail(new Error('report failed late'));
  await settle();
  assert.equal(run.forwarded(), 1);
});

test('a refused start check and a notice from no lifecycle are dropped', async () => {
  const { $ } = host({
    '/first-wake/start': async () => ({ started: false, reason: 'revoked:binding' }),
  });
  await start($);
  await settle();
  const refused = await submit($);
  assert.match(String((await refused.result).drop), /revoked:binding/);
  assert.equal(refused.forwarded(), 0);
  await end($);
  const orphan = await submit($);
  assert.match(String((await orphan.result).drop), /ended session lifecycle/);
  assert.equal(orphan.forwarded(), 0);
});

test('the registration catch handler drops a notice whose check failed', async () => {
  let forwarded = 0;
  const next = Object.assign(async () => void forwarded++, {
    origin: { plugin: 'ncf-first-wake-research' },
    called: false,
    error: { kind: 'throw' },
  });
  const result = await fallback!({}, { text: notice }, next);
  assert.match(String(result.drop), /check throw/);
  assert.equal(forwarded, 0);
});

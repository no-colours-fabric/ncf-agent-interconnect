import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ClaudeSessions, claudeToolPrefix } from '../desktop/core/claude-sessions.js';
import { canonicalInputHash } from '../desktop/integrations/claude-code.js';
import { updateNativeLease } from '../desktop/integrations/claude-native-lease.js';

async function fixture(
  t: TestContext,
  options: { now?: () => number; callLifetime?: number } = {},
) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-claude-call-'));
  const nodeFile = path.join(directory, 'Integrations', 'node.json');
  const sessions = new ClaudeSessions(directory, options);
  await sessions.load();
  t.after(async () => {
    await sessions.close();
    await rm(directory, { recursive: true, force: true });
  });
  const attach = async (hello: {
    helperId: string;
    secret: string;
    spawnSession: string;
    session: string;
    generation: number;
    nativeLeaseNonce: string;
  }) => {
    const helper = await sessions.attach(hello, { write: () => true, end() {} });
    return { hello, helper };
  };
  const active = async () => {
    const session = randomUUID();
    const native = await updateNativeLease(nodeFile, session, 'SessionStart');
    await sessions.hook({
      event: 'SessionStart',
      sessionId: session,
      nativeLeaseNonce: native.nonce,
    });
    return attach({
      helperId: randomUUID(),
      secret: randomBytes(32).toString('hex'),
      spawnSession: session,
      session,
      generation: 0,
      nativeLeaseNonce: native.nonce,
    });
  };
  const permit = async (
    target: Awaited<ReturnType<typeof attach>>,
    tool = 'agent_read',
    args: Record<string, unknown> = { connectionId: randomUUID() },
  ) => {
    const inputHash = canonicalInputHash(args);
    const proof = await sessions.hook({
      event: 'PreToolUse',
      sessionId: target.hello.session,
      nativeLeaseNonce: target.hello.nativeLeaseNonce,
      tool: claudeToolPrefix + tool,
      inputHash,
    });
    const { lease } = await sessions.correlate({
      helperId: target.hello.helperId,
      secret: target.hello.secret,
      tool,
      inputHash,
      contextToken: proof.contextToken,
    });
    return { tool, inputHash, lease, callToken: sessions.issueCall(lease, tool, inputHash) };
  };
  const validate = (
    target: Awaited<ReturnType<typeof attach>>,
    callToken: string,
    phase: 'forward' | 'return',
  ) =>
    sessions.validateCall({
      helperId: target.hello.helperId,
      secret: target.hello.secret,
      callToken,
      phase,
    });
  return { sessions, nodeFile, active, attach, permit, validate };
}

test('Only one request is admitted; forward and return checks do not consume its authority', async (t) => {
  const f = await fixture(t);
  const a = await f.active();
  const p = await f.permit(a);
  const key = randomUUID();
  assert.deepEqual(await f.validate(a, p.callToken, 'forward'), { valid: true });
  assert.deepEqual(await f.validate(a, p.callToken, 'forward'), { valid: true });
  await assert.rejects(f.validate(a, p.callToken, 'return'));
  f.sessions.admitCall(p.callToken, p.tool, p.inputHash, key, 7);
  f.sessions.assertCall(p.callToken, p.tool, key, 7);
  assert.throws(() => f.sessions.admitCall(p.callToken, p.tool, p.inputHash, key, 7));
  await assert.rejects(f.validate(a, p.callToken, 'forward'));
  f.sessions.assertCall(p.callToken, p.tool, key, 7);
  assert.deepEqual(await f.validate(a, p.callToken, 'return'), { valid: true });
  assert.deepEqual(await f.validate(a, p.callToken, 'return'), { valid: true });
});

test('Wrong raw tool or input cannot consume an issued permit', async (t) => {
  const f = await fixture(t);
  const a = await f.active();
  const p = await f.permit(a, 'agent_read', { connectionId: randomUUID(), limit: 2 });
  const key = randomUUID();
  assert.throws(() => f.sessions.admitCall(p.callToken, 'agent_send', p.inputHash, key, 'request'));
  assert.throws(() =>
    f.sessions.admitCall(p.callToken, p.tool, canonicalInputHash({ limit: 50 }), key, 'request'),
  );
  assert.deepEqual(await f.validate(a, p.callToken, 'forward'), { valid: true });
  f.sessions.admitCall(p.callToken, p.tool, p.inputHash, key, 'request');
  f.sessions.assertCall(p.callToken, p.tool, key, 'request');
});

test('Admitted authority is scoped to the server-owned session, request ID and tool', async (t) => {
  const f = await fixture(t);
  const a = await f.active();
  const p = await f.permit(a);
  const key = randomUUID();
  f.sessions.admitCall(p.callToken, p.tool, p.inputHash, key, 7);
  assert.throws(() => f.sessions.assertCall(p.callToken, p.tool, randomUUID(), 7));
  assert.throws(() => f.sessions.assertCall(p.callToken, p.tool, key, '7'));
  assert.throws(() => f.sessions.assertCall(p.callToken, p.tool, key, 8));
  assert.throws(() => f.sessions.assertCall(p.callToken, 'agent_send', key, 7));
  f.sessions.assertCall(p.callToken, p.tool, key, 7);
  assert.deepEqual(await f.validate(a, p.callToken, 'return'), { valid: true });
});

test('A foreign helper or wrong secret cannot validate or burn another helper permit', async (t) => {
  const f = await fixture(t);
  const a = await f.active();
  const b = await f.active();
  const p = await f.permit(a);
  await assert.rejects(f.validate(b, p.callToken, 'forward'));
  await assert.rejects(
    f.sessions.validateCall({
      helperId: a.hello.helperId,
      secret: 'f'.repeat(64),
      callToken: p.callToken,
      phase: 'forward',
    }),
  );
  assert.deepEqual(await f.validate(a, p.callToken, 'forward'), { valid: true });
  const key = randomUUID();
  f.sessions.admitCall(p.callToken, p.tool, p.inputHash, key, 'owner');
  await assert.rejects(f.validate(b, p.callToken, 'return'));
  f.sessions.assertCall(p.callToken, p.tool, key, 'owner');
});

test('Replacing the transport revokes old permits despite an unchanged native session and nonce', async (t) => {
  const f = await fixture(t);
  const a = await f.active();
  const p = await f.permit(a);
  const admitted = await f.permit(a);
  const key = randomUUID();
  f.sessions.admitCall(admitted.callToken, admitted.tool, admitted.inputHash, key, 1);
  const replacement = await f.attach(a.hello);
  assert.notEqual(replacement.helper.epoch, a.helper.epoch);
  await assert.rejects(f.validate(replacement, p.callToken, 'forward'));
  assert.throws(() => f.sessions.assertCall(admitted.callToken, admitted.tool, key, 1));
  assert.throws(() => f.sessions.issueCall(p.lease, p.tool, p.inputHash));
  const fresh = await f.permit(replacement);
  assert.deepEqual(await f.validate(replacement, fresh.callToken, 'forward'), { valid: true });
});

test('Transient duplicate helpers permanently revoke pre-existing permits', async (t) => {
  const f = await fixture(t);
  const a = await f.active();
  const pending = await f.permit(a);
  const admitted = await f.permit(a);
  const key = randomUUID();
  f.sessions.admitCall(admitted.callToken, admitted.tool, admitted.inputHash, key, 1);
  const twin = await f.attach({
    ...a.hello,
    helperId: randomUUID(),
    secret: randomBytes(32).toString('hex'),
  });
  assert.equal(f.sessions.route(a.hello.session).ambiguous, true);
  f.sessions.detach(twin.helper);
  assert.equal(f.sessions.route(a.hello.session).helper, a.helper);
  await assert.rejects(f.validate(a, pending.callToken, 'forward'));
  assert.throws(() =>
    f.sessions.admitCall(pending.callToken, pending.tool, pending.inputHash, key, 2),
  );
  assert.throws(() => f.sessions.assertCall(admitted.callToken, admitted.tool, key, 1));
  const fresh = await f.permit(a);
  assert.deepEqual(await f.validate(a, fresh.callToken, 'forward'), { valid: true });
});

test('Native revocation without HTTP blocks admission and cannot revive on a later lease', async (t) => {
  const f = await fixture(t);
  const a = await f.active();
  const p = await f.permit(a);
  await updateNativeLease(f.nodeFile, a.hello.session, 'SessionEnd');
  assert.throws(() => f.sessions.admitCall(p.callToken, p.tool, p.inputHash, randomUUID(), 1));
  await updateNativeLease(f.nodeFile, a.hello.session, 'SessionStart');
  await assert.rejects(f.validate(a, p.callToken, 'forward'));
  assert.throws(() => f.sessions.issueCall(p.lease, p.tool, p.inputHash));
});

test('Authority lost while an admitted handler runs withholds its result without replaying the handler', async (t) => {
  const f = await fixture(t);
  const a = await f.active();
  const p = await f.permit(a);
  const key = randomUUID();
  f.sessions.admitCall(p.callToken, p.tool, p.inputHash, key, 1);
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => (finish = resolve));
  let handlerRuns = 0;
  const result = (async () => {
    f.sessions.assertCall(p.callToken, p.tool, key, 1);
    handlerRuns++;
    await pending;
    f.sessions.assertCall(p.callToken, p.tool, key, 1);
    return 'private fixture result';
  })();
  await updateNativeLease(f.nodeFile, a.hello.session, 'SessionEnd');
  finish();
  await assert.rejects(result);
  await assert.rejects(f.validate(a, p.callToken, 'return'));
  assert.equal(handlerRuns, 1);
});

test('Asynchronous validation cannot outlive transport revocation', async (t) => {
  const f = await fixture(t);
  const a = await f.active();
  const p = await f.permit(a);
  const checking = f.validate(a, p.callToken, 'forward');
  f.sessions.detach(a.helper);
  await assert.rejects(checking);
  const replacement = await f.attach(a.hello);
  await assert.rejects(f.validate(replacement, p.callToken, 'forward'));
});

test('Permits expire and the bounded registry reclaims expired entries without authorizing them', async (t) => {
  let now = 100;
  const f = await fixture(t, { now: () => now, callLifetime: 20 });
  const a = await f.active();
  const p = await f.permit(a);
  for (let index = 1; index < 512; index++) f.sessions.issueCall(p.lease, p.tool, p.inputHash);
  assert.throws(() => f.sessions.issueCall(p.lease, p.tool, p.inputHash));
  now += 21;
  await assert.rejects(f.validate(a, p.callToken, 'forward'));
  const fresh = f.sessions.issueCall(p.lease, p.tool, p.inputHash);
  assert.deepEqual(await f.validate(a, fresh, 'forward'), { valid: true });
});

test('Connect compound authority rejects a mixed raw ticket without burning either call permit', async (t) => {
  const f = await fixture(t);
  const a = await f.active();
  const b = await f.active();
  const proofA = await f.permit(a);
  const proofB = await f.permit(b);
  const contextA = randomUUID();
  const contextB = randomUUID();
  const inputHash = canonicalInputHash({ nickname: 'User-selected agent' });
  assert.throws(() => f.sessions.issueCall(proofA.lease, 'agent_connect', inputHash));
  assert.throws(() =>
    f.sessions.issueCall(proofA.lease, 'agent_connect', inputHash, 'not-a-node-ticket'),
  );
  assert.throws(() => f.sessions.issueCall(proofA.lease, 'agent_read', inputHash, contextA));
  const callA = f.sessions.issueCall(proofA.lease, 'agent_connect', inputHash, contextA);
  const callB = f.sessions.issueCall(proofB.lease, 'agent_connect', inputHash, contextB);
  const key = randomUUID();
  assert.throws(() => f.sessions.admitCall(callA, 'agent_connect', inputHash, key, 1, contextB));
  assert.throws(() => f.sessions.admitCall(callA, 'agent_connect', inputHash, key, 1));
  assert.deepEqual(await f.validate(a, callA, 'forward'), { valid: true });
  assert.deepEqual(await f.validate(b, callB, 'forward'), { valid: true });
  f.sessions.admitCall(callA, 'agent_connect', inputHash, key, 1, contextA);
  f.sessions.admitCall(callB, 'agent_connect', inputHash, key, 2, contextB);
  f.sessions.assertCall(callA, 'agent_connect', key, 1, contextA);
  f.sessions.assertCall(callB, 'agent_connect', key, 2, contextB);
});

test('Connect compound authority checks the same ticket before the handler and after its await', async (t) => {
  const f = await fixture(t);
  const a = await f.active();
  const proof = await f.permit(a);
  const contextA = randomUUID();
  const contextB = randomUUID();
  const inputHash = canonicalInputHash({ nickname: 'Exact connect' });
  const call = f.sessions.issueCall(proof.lease, 'agent_connect', inputHash, contextA);
  const key = randomUUID();
  f.sessions.admitCall(call, 'agent_connect', inputHash, key, 1, contextA);
  let handlers = 0;
  const beforeHandler = (actual: unknown) => {
    f.sessions.assertCall(call, 'agent_connect', key, 1, actual);
    handlers++;
  };
  assert.throws(() => beforeHandler(contextB));
  assert.throws(() => beforeHandler(undefined));
  assert.equal(handlers, 0);
  beforeHandler(contextA);
  await Promise.resolve();
  // The generic connect ticket can already be consumed. This check only compares provenance.
  assert.throws(() => f.sessions.assertCall(call, 'agent_connect', key, 1, contextB));
  assert.throws(() => f.sessions.assertCall(call, 'agent_connect', key, 1));
  f.sessions.assertCall(call, 'agent_connect', key, 1, contextA);
  assert.equal(handlers, 1);
  assert.deepEqual(await f.validate(a, call, 'return'), { valid: true });
  assert.deepEqual(await f.validate(a, call, 'return'), { valid: true });
});

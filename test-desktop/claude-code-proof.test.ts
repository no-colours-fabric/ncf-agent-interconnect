import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ClaudeSessions, claudeToolPrefix } from '../desktop/core/claude-sessions.js';
import { canonicalInputHash } from '../desktop/integrations/claude-code.js';
import { readNativeLease, updateNativeLease } from '../desktop/integrations/claude-native-lease.js';

interface Hello {
  helperId: string;
  secret: string;
  spawnSession: string | null;
  session: string | null;
  generation: number;
  nativeLeaseNonce: string | null;
}

async function fixture(
  t: TestContext,
  options: { now?: () => number; toolLifetime?: number } = {},
) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-claude-proof-'));
  const nodeFile = path.join(directory, 'Integrations', 'node.json');
  let sessions = new ClaudeSessions(directory, options);
  await sessions.load();
  t.after(async () => {
    await sessions.close();
    await rm(directory, { recursive: true, force: true });
  });
  const f = {
    directory,
    nodeFile,
    get sessions() {
      return sessions;
    },
    async native(sessionId: string, event: 'SessionStart' | 'SessionEnd', notify = true) {
      const lease = await updateNativeLease(nodeFile, sessionId, event);
      if (notify) await sessions.hook({ event, sessionId, nativeLeaseNonce: lease.nonce });
      return lease;
    },
    async attachHello(hello: Hello) {
      const frames: Record<string, unknown>[] = [];
      const helper = await sessions.attach(hello, {
        write(line) {
          frames.push(JSON.parse(line));
          return true;
        },
        end() {},
      });
      return { hello, helper, frames };
    },
    async attach(sessionId: string, nonce?: string | null) {
      return f.attachHello({
        helperId: randomUUID(),
        secret: randomBytes(32).toString('hex'),
        spawnSession: sessionId,
        session: sessionId,
        generation: 0,
        nativeLeaseNonce:
          nonce === undefined
            ? ((await readNativeLease(nodeFile, sessionId))?.nonce ?? null)
            : nonce,
      });
    },
    async toolHook(sessionId: string, args: Record<string, unknown>, tool = 'agent_connect') {
      const lease = await readNativeLease(nodeFile, sessionId);
      return sessions.hook({
        event: 'PreToolUse',
        sessionId,
        nativeLeaseNonce: lease?.nonce ?? null,
        tool: claudeToolPrefix + tool,
        inputHash: canonicalInputHash(args),
      });
    },
    async proof(sessionId: string, args: Record<string, unknown>, tool = 'agent_connect') {
      const result = await f.toolHook(sessionId, args, tool);
      assert.equal(typeof result.contextToken, 'string');
      return result.contextToken!;
    },
    call(
      target: { hello: Hello },
      args: Record<string, unknown>,
      token?: string,
      tool = 'agent_connect',
    ) {
      return sessions.correlate({
        helperId: target.hello.helperId,
        secret: target.hello.secret,
        tool,
        inputHash: canonicalInputHash(args),
        ...(token ? { contextToken: token } : {}),
      });
    },
    async reload() {
      await sessions.close();
      sessions = new ClaudeSessions(directory, options);
      await sessions.load();
    },
  };
  return f;
}

test('A lone matching foreign tool proof cannot retarget a natively proven helper', async (t) => {
  const f = await fixture(t);
  const [a, b] = [randomUUID(), randomUUID()];
  await f.native(a, 'SessionStart');
  await f.native(b, 'SessionStart');
  const helperA = await f.attach(a);
  const helperB = await f.attach(b);
  const args = { nickname: 'One exact chat' };
  const token = await f.proof(a, args);
  await assert.rejects(f.call(helperB, args, token));
  assert.equal(f.sessions.route(a).helper, helperA.helper);
  assert.equal(f.sessions.route(b).helper, helperB.helper);
  assert.equal(helperB.helper.proven, b);
  assert.equal((await f.call(helperA, args, token)).helper, helperA.helper);

  const unproven = randomUUID();
  await assert.rejects(f.toolHook(unproven, args));
  await assert.rejects(f.call(helperB, args));
  assert.equal(f.sessions.route(unproven).helper, undefined);
  assert.equal(helperB.helper.proven, b);
});

test('Only an own, unexpired, one-use proof for the exact tool and input is accepted', async (t) => {
  let now = 100;
  const f = await fixture(t, { now: () => now, toolLifetime: 20 });
  const session = randomUUID();
  await f.native(session, 'SessionStart');
  const helper = await f.attach(session);
  const args = { nickname: 'Owner-selected name' };
  await assert.rejects(f.call(helper, args));
  await assert.rejects(f.call(helper, args, randomUUID()));
  const wrongInput = await f.proof(session, args);
  await assert.rejects(f.call(helper, { nickname: 'Another input' }, wrongInput));
  const wrongTool = await f.proof(session, args);
  await assert.rejects(f.call(helper, args, wrongTool, 'agent_disconnect'));
  const expired = await f.proof(session, args);
  now += 21;
  await assert.rejects(f.call(helper, args, expired));
  const valid = await f.proof(session, args);
  const correlated = await f.call(helper, args, valid);
  assert.equal(correlated.helper, helper.helper);
  assert.equal(correlated.session, session);
  await f.sessions.validateCurrent(correlated.lease);
  await assert.rejects(
    f.sessions.validateCurrent({
      ...correlated.lease,
      generation: correlated.lease.generation + 1,
    }),
  );
  await assert.rejects(f.call(helper, args, valid));
});

test('Transport replacement invalidates an old proof; generation changes cannot replace its authority', async (t) => {
  const f = await fixture(t);
  const session = randomUUID();
  await f.native(session, 'SessionStart');
  const original = await f.attach(session);
  const args = { nickname: 'Exact transport' };
  const oldProof = await f.proof(session, args);
  f.sessions.detach(original.helper);
  const reconnected = await f.attachHello(original.hello);
  assert.notEqual(reconnected.helper.epoch, original.helper.epoch);
  await assert.rejects(f.call(reconnected, args, oldProof));
  assert.equal(f.sessions.route(session).helper, reconnected.helper);
  const own = await f.proof(session, args);
  assert.equal((await f.call(reconnected, args, own)).helper, reconnected.helper);
  const changed = await f.attachHello({
    ...original.hello,
    generation: original.hello.generation + 1,
  });
  assert.equal(changed.helper.proven, null);
  assert.equal(f.sessions.route(session).helper, undefined);
  await assert.rejects(f.toolHook(session, args));
});

test('Model-supplied start and end events cannot adopt or revoke a foreign native session', async (t) => {
  const f = await fixture(t);
  const [a, b] = [randomUUID(), randomUUID()];
  await f.native(a, 'SessionStart');
  await f.native(b, 'SessionStart');
  const own = await f.attach(b);
  for (const session of [a, null]) {
    await assert.rejects(async () =>
      f.sessions.helperSession({
        helperId: own.hello.helperId,
        secret: own.hello.secret,
        session,
        generation: own.hello.generation + 1,
      }),
    );
    assert.equal(f.sessions.route(a).helper, undefined);
    assert.equal(f.sessions.route(b).helper, own.helper);
    assert.equal(own.helper.proven, b);
  }
});

test('Native bootstrap works across HTTP ordering and pins one late initial lease', async (t) => {
  const f = await fixture(t);
  const [before, after, absent] = [randomUUID(), randomUUID(), randomUUID()];
  await f.native(before, 'SessionStart');
  const hookFirst = await f.attach(before);
  assert.equal(f.sessions.route(before).helper, hookFirst.helper);

  const lease = await f.native(after, 'SessionStart', false);
  const helperFirst = await f.attach(after);
  await f.sessions.hook({ event: 'SessionStart', sessionId: after, nativeLeaseNonce: lease.nonce });
  assert.equal(f.sessions.route(after).helper, helperFirst.helper);

  const withoutLease = await f.attach(absent, null);
  assert.equal(f.sessions.route(absent).helper, undefined);
  await assert.rejects(f.toolHook(absent, { nickname: 'No tool-driven adoption' }));
  const initial = await f.native(absent, 'SessionStart');
  assert.equal(f.sessions.route(absent).helper, withoutLease.helper);
  assert.equal(withoutLease.helper.nativeLeaseNonce, initial.nonce);
  assert.deepEqual(
    withoutLease.frames.filter((frame) => frame.type === 'native-lease'),
    [{ type: 'native-lease', session: absent, nonce: initial.nonce }],
  );
  await assert.rejects(f.attachHello(withoutLease.hello));
  f.sessions.detach(withoutLease.helper);
  const fresh = await f.attach(absent);
  assert.equal(f.sessions.route(absent).helper, fresh.helper);
});

test('Duplicate helpers with one current native lease are ambiguous and cannot issue tool authority', async (t) => {
  const f = await fixture(t);
  const session = randomUUID();
  await f.native(session, 'SessionStart');
  const first = await f.attach(session);
  const twin = await f.attach(session);
  assert.equal(f.sessions.route(session).ambiguous, true);
  assert.equal(f.sessions.route(session).helper, undefined);
  await assert.rejects(f.toolHook(session, { nickname: 'Ambiguous' }));
  f.sessions.detach(twin.helper);
  assert.equal(f.sessions.route(session).helper, first.helper);
  await assert.rejects(
    f.sessions.attach(
      { ...first.hello, helperId: randomUUID(), secret: randomBytes(32).toString('hex') },
      {
        write() {
          throw new Error('The helper stream closed');
        },
        end() {},
      },
    ),
  );
  assert.equal(f.sessions.route(session).helper, first.helper);
  const afterFailure = { nickname: 'Still exact' };
  const ownProof = await f.proof(session, afterFailure);
  assert.equal((await f.call(first, afterFailure, ownProof)).helper, first.helper);
});

test('A durable native End revokes delivery even when HTTP is lost and old node routes are reloaded', async (t) => {
  const f = await fixture(t);
  const session = randomUUID();
  await f.native(session, 'SessionStart');
  const target = await f.attach(session);
  const args = { nickname: 'Ended chat' };
  const token = await f.proof(session, args);
  const correlated = await f.call(target, args, token);
  await f.native(session, 'SessionEnd', false);
  await assert.rejects(f.sessions.validateCurrent(correlated.lease));
  assert.equal(f.sessions.send(target.helper, { type: 'wake', nickname: 'Ended chat' }), false);
  assert.equal(f.sessions.route(session).helper, undefined);
  await assert.rejects(f.call(target, args, token));
  await f.reload();
  const old = await f.attachHello(target.hello);
  assert.equal(f.sessions.route(session).helper, undefined);
  assert.equal(old.helper.proven, null);
});

test('A pinned old nonce stays revoked after a fresh Start, and the same helper cannot refresh it', async (t) => {
  const f = await fixture(t);
  const session = randomUUID();
  const previous = await f.native(session, 'SessionStart');
  const target = await f.attach(session);
  await f.native(session, 'SessionEnd', false);
  const current = await f.native(session, 'SessionStart');
  assert.notEqual(current.nonce, previous.nonce);
  f.sessions.detach(target.helper);
  const pinned = await f.attachHello(target.hello);
  assert.equal(pinned.helper.proven, null);
  await assert.rejects(f.attachHello({ ...target.hello, nativeLeaseNonce: current.nonce }));
  assert.equal(f.sessions.route(session).helper, undefined);
  f.sessions.detach(pinned.helper);
  const fresh = await f.attach(session);
  assert.equal(f.sessions.route(session).helper, fresh.helper);
});

test('Interrupted or failed native persistence denies an old positive lease instead of resurrecting it', async (t) => {
  const f = await fixture(t);
  const session = randomUUID();
  await f.native(session, 'SessionStart');
  const target = await f.attach(session);
  const filename = path.join(path.dirname(f.nodeFile), 'claude-native', session + '.json');
  const positive = await readFile(filename, 'utf8');
  await writeFile(filename, '{invalid', { mode: 0o600 });
  await assert.rejects(updateNativeLease(f.nodeFile, session, 'SessionEnd'));
  await writeFile(filename, positive, { mode: 0o600 });
  await access(filename + '.lock');
  await assert.rejects(readNativeLease(f.nodeFile, session));
  assert.equal(f.sessions.send(target.helper, { type: 'wake' }), false);
  await f.reload();
  const restored = await f.attachHello(target.hello);
  assert.equal(restored.helper.proven, null);

  const interrupted = randomUUID();
  await f.native(interrupted, 'SessionStart');
  const lock = path.join(path.dirname(f.nodeFile), 'claude-native', interrupted + '.json.lock');
  await mkdir(lock, { mode: 0o700 });
  await assert.rejects(readNativeLease(f.nodeFile, interrupted));
  await assert.rejects(updateNativeLease(f.nodeFile, interrupted, 'SessionEnd'));
  await access(lock);
});

test('Repeated native Starts and reordered HTTP lifecycle callbacks never restore old authority', async (t) => {
  const f = await fixture(t);
  const session = randomUUID();
  const start = await f.native(session, 'SessionStart');
  const target = await f.attach(session);
  const repeated = await f.native(session, 'SessionStart', false);
  assert.equal(repeated.active, false);
  assert.equal(repeated.conflicted, true);
  await assert.rejects(
    f.sessions.hook({ event: 'SessionStart', sessionId: session, nativeLeaseNonce: start.nonce }),
  );
  assert.equal(f.sessions.route(session).helper, undefined);
  const end = await f.native(session, 'SessionEnd');
  const next = await f.native(session, 'SessionStart');
  f.sessions.detach(target.helper);
  const fresh = await f.attach(session);
  await assert.rejects(
    f.sessions.hook({ event: 'SessionEnd', sessionId: session, nativeLeaseNonce: end.nonce }),
  );
  await assert.rejects(
    f.sessions.hook({ event: 'SessionStart', sessionId: session, nativeLeaseNonce: start.nonce }),
  );
  assert.equal((await readNativeLease(f.nodeFile, session))?.nonce, next.nonce);
  assert.equal(f.sessions.route(session).helper, fresh.helper);
  assert.equal(target.helper.proven, null);
});

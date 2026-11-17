import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { setImmediate as tick } from 'node:timers/promises';
import {
  createOpenCodeV2Plugin,
  startOpenCodeV2,
  openCodeV2HostMessageId,
  openCodeV2Prompt,
  openCodeV2PayloadHash,
  parseOpenCodeV2Command,
  parseOpenCodeV2Provision,
  parseOpenCodeV2Evidence,
  type OpenCodeV2Dependencies,
  type OpenCodeV2Owner,
  type OpenCodeV2Command,
} from '../desktop/integrations/opencode-v2.js';
import {
  Deferred,
  OpenCodeV2HostFixture,
  OpenCodeV2NodeFixture,
} from './fixtures/opencode-v2-host.js';
import type { PinnedEvent } from './fixtures/opencode-v2-contracts.js';

function owner(chatId: string): OpenCodeV2Owner {
  return {
    agentKey: 'fixture-agent',
    incarnation: randomUUID(),
    connectionId: randomUUID(),
    generation: 1,
    adapterId: randomUUID(),
    chatId,
  };
}
async function runtime(
  t: TestContext,
  options: OpenCodeV2Dependencies = {},
  host = new OpenCodeV2HostFixture(),
) {
  const peer = new OpenCodeV2NodeFixture();
  host.context.options = {
    targetId: peer.provision.targetId,
    generation: peer.provision.generation,
  };
  const handle = await startOpenCodeV2(host.context, peer.provision, {
    timeoutMs: 1000,
    ...options,
    register: peer.register,
  });
  t.after(async () => {
    await handle.dispose();
    await peer.close();
  });
  await peer.connect();
  return { host, peer, handle };
}
async function identity(peer: OpenCodeV2NodeFixture, sessionID: string) {
  const nonce = randomUUID();
  const reply = await peer.command({
    kind: 'identity',
    scope: peer.scope,
    nonce,
    sessionID,
    expiresAt: Date.now() + 30_000,
  });
  assert.equal(reply.status, 200);
  assert.equal(reply.value.kind, 'identity');
  assert.equal(reply.value.nonce, nonce);
  return nonce;
}
async function bind(peer: OpenCodeV2NodeFixture, captured: OpenCodeV2Owner) {
  const nonce = await identity(peer, captured.chatId);
  const reply = await peer.command({ kind: 'bind', scope: peer.scope, nonce, owner: captured });
  assert.equal(reply.status, 200);
  assert.equal(reply.value.kind, 'arming');
}
function submit(
  peer: OpenCodeV2NodeFixture,
  captured: OpenCodeV2Owner,
  armId: string,
  text = 'Canonical 漢字 text',
) {
  const attemptId = randomUUID(),
    hostMessageId = openCodeV2HostMessageId(attemptId);
  const prompt = openCodeV2Prompt(captured.chatId, hostMessageId, text);
  return {
    kind: 'submit' as const,
    scope: peer.scope,
    nonce: randomUUID(),
    owner: captured,
    armId,
    attemptId,
    hostMessageId,
    text,
    outboundHash: openCodeV2PayloadHash(prompt),
  };
}

test('strict codec preserves native IDs and hashes all five actual outbound fields', () => {
  const peer = new OpenCodeV2NodeFixture();
  const captured = owner('ses中文');
  peer.scope = {
    protocol: 2,
    nodeId: peer.provision.nodeId,
    targetId: peer.provision.targetId,
    generation: peer.provision.generation,
    bootId: randomUUID(),
    nodeEpoch: randomUUID(),
  };
  const command = submit(peer, captured, randomUUID(), 'opaque\n漢字\u0000text');
  assert.deepEqual(parseOpenCodeV2Command(command), command);
  assert.equal(command.hostMessageId, 'msg_' + command.attemptId);
  assert.throws(() => parseOpenCodeV2Command({ ...command, credential: 'do-not-echo' }));
  assert.throws(() => parseOpenCodeV2Command({ ...command, hostMessageId: command.attemptId }));
  assert.throws(() => parseOpenCodeV2Command({ ...command, outboundHash: 'b'.repeat(64) }));
  assert.throws(() =>
    openCodeV2PayloadHash({
      ...openCodeV2Prompt(captured.chatId, command.hostMessageId, 'x'),
      resume: false,
    } as never),
  );
  assert.throws(() =>
    parseOpenCodeV2Provision({ ...peer.provision, nodeUrl: 'https://example.com' }),
  );
  assert.throws(() => parseOpenCodeV2Evidence({ kind: 'projected', scope: peer.scope }));
});

test('setup returns the cleanup FUNCTION consumed by the pinned Promise adapter', async (t) => {
  const host = new OpenCodeV2HostFixture(),
    peer = new OpenCodeV2NodeFixture();
  host.context.options = {
    targetId: peer.provision.targetId,
    generation: peer.provision.generation,
  };
  const plugin = createOpenCodeV2Plugin({
    loadProvision: async () => peer.provision,
    register: peer.register,
  });
  const cleanup = await plugin.setup(host.context);
  assert.equal(typeof cleanup, 'function');
  t.after(async () => {
    await cleanup();
    await peer.close();
  });
  await peer.connect();
  const id = host.addSession();
  host.busy.add(id);
  await bind(peer, owner(id));
  assert.equal(host.waitCalls, 1);
  // Faithful adapter behavior: only a function is called; {dispose} would be ignored.
  if (typeof cleanup === 'function') await cleanup();
  assert.equal(host.events.ended, true);
  assert.equal(host.rpcDisposals, 1);
  await cleanup();
  assert.equal(host.rpcDisposals, 1);
});

test('one dispatcher observes the exact barrier; foreign nonce/workspace do not arm', async (t) => {
  const host = new OpenCodeV2HostFixture(),
    peer = new OpenCodeV2NodeFixture();
  host.context.options = {
    targetId: peer.provision.targetId,
    generation: peer.provision.generation,
  };
  host.holdBarrier = true;
  const starting = startOpenCodeV2(host.context, peer.provision, {
    register: peer.register,
    timeoutMs: 1000,
  });
  await tick();
  const emission = host.rpcEmits[0];
  assert.ok(emission);
  host.events.publish({
    id: 'evt_foreign',
    created: 1,
    type: ('rpc.' + emission.definition.id + '.' + emission.name) as PinnedEvent['type'],
    location: { directory: host.workspace },
    data: { nonce: randomUUID() },
  });
  host.events.publish({
    id: 'evt_wrong_workspace',
    created: 1,
    type: ('rpc.' + emission.definition.id + '.' + emission.name) as PinnedEvent['type'],
    location: { directory: '/foreign' },
    data: emission.data,
  });
  await tick();
  assert.equal(peer.registration, undefined);
  host.emitBarrier();
  const handle = await starting;
  t.after(() => handle.dispose());
  assert.equal(host.events.consumers, 1);
  assert.equal(host.events.maxConcurrentNext, 1);
});

test('missing barrier fails closed and disposes its native stream registration', async () => {
  const host = new OpenCodeV2HostFixture(),
    peer = new OpenCodeV2NodeFixture();
  host.context.options = {
    targetId: peer.provision.targetId,
    generation: peer.provision.generation,
  };
  host.holdBarrier = true;
  await assert.rejects(
    startOpenCodeV2(host.context, peer.provision, {
      register: peer.register,
      timeoutMs: 20,
    }),
    /V2_BARRIER_TIMEOUT/,
  );
  assert.equal(peer.registration, undefined);
  assert.equal(host.events.ended, true);
  assert.equal(host.rpcDisposals, 1);
});

test('identity while busy never waits; only binding commit starts async receive wait', async (t) => {
  const { host, peer } = await runtime(t);
  const id = host.addSession(),
    captured = owner(id);
  host.busy.add(id);
  await identity(peer, id);
  assert.equal(host.waitCalls, 0);
  await bind(peer, captured);
  assert.equal(host.waitCalls, 1);
  assert.equal(host.prompts.length, 0);
  assert.equal(
    peer.evidence.some((event) => event.kind === 'ready'),
    false,
  );
});

test('canonical opaque body submits once and joins early committed Delivered with direct User', async (t) => {
  const { host, peer } = await runtime(t);
  const id = host.addSession('ses_Тайд漢字'),
    captured = owner(id);
  await bind(peer, captured);
  const ready = await peer.wait('ready');
  const returned = new Deferred<ReturnType<typeof host.user>>();
  const entered = new Deferred<void>();
  host.promptResult = async (input) => {
    host.delivered(input.sessionID, input.id!);
    entered.resolve();
    return returned.promise;
  };
  const text =
    '**Incoming NCF Agent Interconnect**\nFrom: "Sender"\n\nТекст 漢字\n\nReply-To: r1\nUse agent_send(connectionId, replyRef="r1", text) to reply.';
  const command = submit(peer, captured, ready.armId, text);
  const sending = peer.command(command);
  await entered.promise;
  await tick();
  assert.equal(
    peer.evidence.some((event) => event.kind === 'projected'),
    false,
  );
  returned.resolve(host.user(host.prompts[0]));
  assert.equal((await sending).value.kind, 'submitted');
  const projected = await peer.wait('projected');
  assert.equal(projected.hostMessageId, command.hostMessageId);
  assert.equal(projected.attemptId, command.attemptId);
  assert.deepEqual(host.prompts, [openCodeV2Prompt(id, command.hostMessageId, text)]);
  host.delivered(id, command.hostMessageId);
  await tick();
  assert.equal(peer.evidence.filter((event) => event.kind === 'projected').length, 1);
  assert.equal((await peer.command(command)).status, 409);
  assert.equal(host.prompts.length, 1);
  assert.equal(JSON.stringify(peer.evidence).includes(peer.provision.credential), false);
  assert.equal(JSON.stringify(peer.evidence).includes(text), false);
});

test('normal busy after issued content does not erase its exact witness', async (t) => {
  const { host, peer } = await runtime(t);
  const id = host.addSession(),
    captured = owner(id);
  await bind(peer, captured);
  const ready = await peer.wait('ready');
  host.promptResult = async (input) => {
    host.status(id, 'busy');
    host.delivered(id, input.id!);
    return host.user(input);
  };
  const command = submit(peer, captured, ready.armId);
  assert.equal((await peer.command(command)).value.kind, 'submitted');
  assert.equal((await peer.wait('projected')).attemptId, command.attemptId);
  assert.equal(host.prompts.length, 1);
});

test('preflight busy is proven not-released; no native prompt call', async (t) => {
  const { host, peer } = await runtime(t);
  const id = host.addSession(),
    captured = owner(id);
  await bind(peer, captured);
  const ready = await peer.wait('ready');
  const entered = new Deferred<void>(),
    release = new Deferred<void>();
  host.beforeGet = async () => {
    entered.resolve();
    await release.promise;
  };
  const sending = peer.command(submit(peer, captured, ready.armId));
  await entered.promise;
  host.status(id, 'busy');
  await peer.wait('revoked', (event) => event.reasonCode === 'V2_RECEIVE_CHANGED');
  release.resolve();
  assert.equal((await sending).value.kind, 'not-released');
  assert.equal(host.prompts.length, 0);
});

test('concurrent duplicate arm cannot obtain false not-released after another submit', async (t) => {
  const { host, peer } = await runtime(t);
  const id = host.addSession(),
    captured = owner(id);
  await bind(peer, captured);
  const ready = await peer.wait('ready');
  const entered = new Deferred<void>(),
    release = new Deferred<void>();
  host.beforeGet = async () => {
    entered.resolve();
    await release.promise;
  };
  const command = submit(peer, captured, ready.armId);
  const first = peer.command(command);
  await entered.promise;
  const second = await peer.command({ ...command, nonce: randomUUID() });
  assert.equal(second.status, 409);
  release.resolve();
  assert.equal((await first).value.kind, 'submitted');
  await peer.wait('projected');
  assert.equal(host.prompts.length, 1);
  assert.equal(
    peer.evidence.some((event) => event.kind === 'not-released'),
    false,
  );
});

test('post-hook rewrite or legacy data wrapper never produces projected evidence', async (t) => {
  for (const mode of ['rewrite', 'wrapper', 'metadata'] as const) {
    const { host, peer, handle } = await runtime(t);
    const id = host.addSession(),
      captured = owner(id);
    await bind(peer, captured);
    const ready = await peer.wait('ready');
    host.promptResult = async (input) => {
      host.delivered(id, input.id!);
      const row = host.user(input);
      if (mode === 'rewrite') row.payload.text = 'host wrapper ' + row.payload.text;
      if (mode === 'metadata') row.payload.metadata = { instructions: 'extra' };
      return mode === 'wrapper' ? ({ data: row } as never) : row;
    };
    assert.equal((await peer.command(submit(peer, captured, ready.armId))).value.kind, 'uncertain');
    await tick();
    assert.equal(
      peer.evidence.some((event) => event.kind === 'projected'),
      false,
    );
    assert.equal(host.prompts.length, 1);
    await handle.dispose();
  }
});

test('post-invocation rejection and timeout stay uncertain without resubmission', async (t) => {
  for (const mode of ['reject', 'timeout'] as const) {
    const { host, peer, handle } = await runtime(t, { timeoutMs: 30 });
    const id = host.addSession(),
      captured = owner(id);
    await bind(peer, captured);
    const ready = await peer.wait('ready');
    host.promptResult =
      mode === 'reject'
        ? async () => {
            throw new Error('host rejected after possible release');
          }
        : () => new Promise(() => {});
    const command = submit(peer, captured, ready.armId);
    assert.equal((await peer.command(command)).value.kind, 'uncertain');
    assert.equal((await peer.command(command)).status, 409);
    assert.equal(host.prompts.length, 1);
    await handle.dispose();
  }
});

test('foreign session/ID and noncommitted event cannot satisfy exact evidence join', async (t) => {
  const { host, peer } = await runtime(t);
  const id = host.addSession(),
    captured = owner(id);
  await bind(peer, captured);
  const ready = await peer.wait('ready');
  host.promptResult = async (input) => host.user(input);
  const command = submit(peer, captured, ready.armId);
  await peer.command(command);
  host.delivered('ses_foreign', command.hostMessageId);
  host.delivered(id, 'msg_' + randomUUID());
  await tick();
  assert.equal(
    peer.evidence.some((event) => event.kind === 'projected'),
    false,
  );
  host.delivered(id, command.hostMessageId);
  assert.equal((await peer.wait('projected')).hostMessageId, command.hostMessageId);
});

test('stream death revokes authority; late return never rearms or projects', async (t) => {
  const { host, peer } = await runtime(t);
  const id = host.addSession(),
    captured = owner(id);
  await bind(peer, captured);
  const ready = await peer.wait('ready');
  const entered = new Deferred<void>(),
    returned = new Deferred<ReturnType<typeof host.user>>();
  host.promptResult = async () => {
    entered.resolve();
    return returned.promise;
  };
  const command = submit(peer, captured, ready.armId);
  const pending = peer.command(command);
  await entered.promise;
  host.events.close();
  await peer.wait('revoked', (event) => event.reasonCode === 'V2_STREAM_ENDED');
  returned.resolve(host.user(host.prompts[0]));
  assert.equal((await pending).value.kind, 'uncertain');
  assert.equal(
    peer.evidence.some((event) => event.kind === 'projected'),
    false,
  );
  assert.equal((await peer.command(command)).status, 409);
  assert.equal(host.prompts.length, 1);
});

test('delete during pending bind invalidates its proof before owner adoption', async (t) => {
  const { host, peer } = await runtime(t);
  const id = host.addSession(),
    captured = owner(id);
  const nonce = await identity(peer, id);
  const entered = new Deferred<void>(),
    release = new Deferred<void>();
  host.beforeGet = async () => {
    entered.resolve();
    await release.promise;
  };
  const binding = peer.command({ kind: 'bind', scope: peer.scope, owner: captured, nonce });
  await entered.promise;
  host.events.publish({
    id: 'evt_delete',
    created: 1,
    type: 'session.deleted',
    location: { directory: host.workspace },
    data: { sessionID: id },
  });
  await tick();
  release.resolve();
  assert.equal((await binding).status, 409);
  assert.equal(host.waitCalls, 0);
  assert.equal(
    peer.evidence.some((event) => event.kind === 'ready'),
    false,
  );
});

test('uncancellable timed-out wait stays budgeted; no replacement before actual settle', async (t) => {
  const { host, peer } = await runtime(t, { timeoutMs: 30, maxWaits: 1 });
  const id = host.addSession(),
    captured = owner(id);
  host.busy.add(id);
  await bind(peer, captured);
  await peer.wait('revoked', (event) => event.reasonCode === 'V2_WAIT_TIMEOUT');
  for (let i = 0; i < 3; i++)
    assert.equal(
      (await peer.command({ kind: 'arm', scope: peer.scope, owner: captured, nonce: randomUUID() }))
        .status,
      200,
    );
  assert.equal(host.waitCalls, 1);
  host.status(id, 'idle');
  await peer.wait('ready');
  assert.equal(host.waitCalls, 2);
  assert.equal(host.prompts.length, 0);
});

test('retired-session churn cannot evict uncancellable waits to bypass global cap', async (t) => {
  const { host, peer } = await runtime(t, { maxWaits: 2 });
  for (const id of ['ses_A', 'ses_B']) {
    host.addSession(id);
    host.busy.add(id);
    const captured = owner(id);
    await bind(peer, captured);
    await peer.command({ kind: 'revoke', scope: peer.scope, owner: captured, nonce: randomUUID() });
  }
  const id = host.addSession('ses_C'),
    captured = owner(id);
  host.busy.add(id);
  await bind(peer, captured);
  assert.equal(host.waitCalls, 2);
  const started = new Deferred<void>();
  host.onWait = (sessionID) => {
    if (sessionID === id) started.resolve();
  };
  host.waits[0].result.resolve();
  await started.promise;
  assert.equal(host.waitCalls, 3);
  assert.equal(
    peer.evidence.some((event) => event.kind === 'ready'),
    false,
  );
  assert.equal(host.prompts.length, 0);
});

test('dispose is bounded when native wait never settles', async (t) => {
  const { host, peer, handle } = await runtime(t);
  const id = host.addSession(),
    captured = owner(id);
  host.busy.add(id);
  await bind(peer, captured);
  assert.equal(host.waitCalls, 1);
  const timeout = new Deferred<void>();
  const timer = setTimeout(
    () => timeout.reject(new Error('dispose awaited uncancellable host wait')),
    500,
  );
  try {
    await Promise.race([handle.dispose(), timeout.promise]);
  } finally {
    clearTimeout(timer);
  }
  assert.equal(host.events.ended, true);
  assert.equal(host.rpcDisposals, 1);
  host.waits[0].result.resolve();
  await tick();
  assert.equal(
    peer.evidence.some((event) => event.kind === 'ready'),
    false,
  );
});

test('wrong auth/target/generation/boot/owner fail closed before native submission', async (t) => {
  const { host, peer } = await runtime(t);
  const id = host.addSession(),
    captured = owner(id);
  await bind(peer, captured);
  const ready = await peer.wait('ready');
  const command = submit(peer, captured, ready.armId);
  assert.equal((await peer.command(command, 'wrong-credential')).status, 401);
  for (const key of ['targetId', 'generation', 'bootId', 'nodeEpoch'] as const)
    assert.equal(
      (await peer.command({ ...command, scope: { ...command.scope, [key]: randomUUID() } })).status,
      409,
    );
  assert.equal(
    (await peer.command({ ...command, owner: { ...captured, incarnation: randomUUID() } })).status,
    409,
  );
  assert.equal((await peer.command({ ...command, unknown: true })).status, 409);
  assert.equal(host.prompts.length, 0);
});

test('unsupported pin and invalid registration never leave an armed component', async () => {
  const host = new OpenCodeV2HostFixture(),
    peer = new OpenCodeV2NodeFixture();
  host.context.options = {
    targetId: peer.provision.targetId,
    generation: peer.provision.generation,
  };
  host.context.app.version = '1.9.0';
  await assert.rejects(
    startOpenCodeV2(host.context, peer.provision, { register: peer.register }),
    /V2_HOST_UNSUPPORTED/,
  );
  assert.equal(host.events.consumers, 0);
  host.context.app.version = '2.3.0';
  await assert.rejects(
    startOpenCodeV2(host.context, peer.provision, {
      register: async (request) => ({ ...(await peer.register(request)), targetId: randomUUID() }),
    }),
    /V2_REGISTRATION_MISMATCH/,
  );
  assert.equal(host.events.ended, true);
  assert.equal(host.rpcDisposals, 1);
});

test('expired identity proof is rejected after a delayed bind snapshot', async (t) => {
  let clock = 1000;
  const { host, peer } = await runtime(t, { now: () => clock });
  const id = host.addSession(),
    captured = owner(id),
    nonce = randomUUID();
  assert.equal(
    (
      await peer.command({
        kind: 'identity',
        scope: peer.scope,
        nonce,
        sessionID: id,
        expiresAt: 2000,
      })
    ).status,
    200,
  );
  const entered = new Deferred<void>(),
    release = new Deferred<void>();
  host.beforeGet = async () => {
    entered.resolve();
    await release.promise;
  };
  const binding = peer.command({ kind: 'bind', scope: peer.scope, owner: captured, nonce });
  await entered.promise;
  clock = 2001;
  release.resolve();
  assert.equal((await binding).status, 409);
  assert.equal(host.waitCalls, 0);
});

test('queued projection timeout retains exact facts for a later current-scope join', async (t) => {
  const { host, peer } = await runtime(t, { timeoutMs: 30 });
  const id = host.addSession(),
    captured = owner(id);
  await bind(peer, captured);
  const ready = await peer.wait('ready');
  host.promptResult = async (input) => host.user(input);
  const command = submit(peer, captured, ready.armId);
  assert.equal((await peer.command(command)).value.kind, 'submitted');
  await peer.wait('uncertain', (event) => event.reasonCode === 'V2_PROMPT_TIMEOUT');
  assert.equal(host.prompts.length, 1);
  host.delivered(id, command.hostMessageId);
  const proof = await peer.wait('projected');
  assert.equal(proof.attemptId, command.attemptId);
  assert.equal(proof.hostMessageId, command.hostMessageId);
  // Only evidence is returned: this fixture has no node receipt writer.
  assert.equal(host.prompts.length, 1);
});

test('active uncertain attempts enforce capacity without releasing another body', async (t) => {
  const { host, peer } = await runtime(t, { maxAttempts: 1, timeoutMs: 30 });
  const a = host.addSession('ses_capacity_A'),
    b = host.addSession('ses_capacity_B');
  const firstOwner = owner(a),
    secondOwner = owner(b);
  await bind(peer, firstOwner);
  const firstArm = await peer.wait('ready', (event) => event.owner.chatId === a);
  await bind(peer, secondOwner);
  const secondArm = await peer.wait('ready', (event) => event.owner.chatId === b);
  host.promptResult = () => new Promise(() => {});
  assert.equal(
    (await peer.command(submit(peer, firstOwner, firstArm.armId))).value.kind,
    'uncertain',
  );
  const reply = await peer.command(submit(peer, secondOwner, secondArm.armId));
  assert.equal(reply.value.kind, 'not-released');
  assert.equal(reply.value.reasonCode, 'V2_ATTEMPT_CAPACITY');
  assert.equal(host.prompts.length, 1);
});

for (const retirement of ['revoke', 'delete'] as const)
  test(`authority ${retirement} frees retired attempt capacity without accepting late facts`, async (t) => {
    const { host, peer } = await runtime(t, { maxAttempts: 1 });
    const a = host.addSession('ses_retired_A'),
      b = host.addSession('ses_current_B');
    const firstOwner = owner(a),
      secondOwner = owner(b);
    await bind(peer, firstOwner);
    const firstArm = await peer.wait('ready', (event) => event.owner.chatId === a);
    const entered = new Deferred<void>(),
      returned = new Deferred<ReturnType<typeof host.user>>();
    host.promptResult = async (input) => {
      if (input.sessionID === a) {
        entered.resolve();
        return returned.promise;
      }
      host.delivered(input.sessionID, input.id!);
      return host.user(input);
    };
    const firstCommand = submit(peer, firstOwner, firstArm.armId);
    const pending = peer.command(firstCommand);
    await entered.promise;
    if (retirement === 'revoke')
      assert.equal(
        (
          await peer.command({
            kind: 'revoke',
            scope: peer.scope,
            owner: firstOwner,
            nonce: randomUUID(),
          })
        ).status,
        200,
      );
    else
      host.events.publish({
        id: 'evt_delete_issued',
        created: 1,
        type: 'session.deleted',
        location: { directory: host.workspace },
        data: { sessionID: a },
      });
    await peer.wait('uncertain', (event) => event.attemptId === firstCommand.attemptId);
    await peer.wait('revoked', (event) => event.owner.chatId === a);
    const afterRetirement = peer.evidence.length;
    await bind(peer, secondOwner);
    const secondArm = await peer.wait('ready', (event) => event.owner.chatId === b);
    const secondCommand = submit(peer, secondOwner, secondArm.armId);
    const secondReply = await peer.command(secondCommand);
    // Settle the old native call even if the capacity assertion exposes the baseline defect.
    host.delivered(a, firstCommand.hostMessageId);
    returned.resolve(host.user(host.prompts[0]));
    assert.equal((await pending).value.kind, 'uncertain');
    await tick();
    assert.equal(secondReply.value.kind, 'submitted');
    assert.equal((await peer.wait('projected')).attemptId, secondCommand.attemptId);
    assert.equal(
      peer.evidence
        .slice(afterRetirement)
        .some(
          (event) =>
            (event.kind === 'projected' && event.attemptId === firstCommand.attemptId) ||
            (event.kind === 'ready' && event.owner.chatId === a),
        ),
      false,
    );
    assert.equal((await peer.command(firstCommand)).status, 409);
    assert.equal(host.prompts.length, 2);
  });

test('retired native prompts stay budgeted until actual settlement releases exactly one slot', async (t) => {
  const limits: OpenCodeV2Dependencies = {
    maxAttempts: 1,
    maxNativePrompts: 2,
    timeoutMs: 30,
  };
  const { host, peer, handle } = await runtime(t, limits);
  const returns: Deferred<ReturnType<typeof host.user>>[] = [];
  host.promptResult = () => {
    const result = new Deferred<ReturnType<typeof host.user>>();
    returns.push(result);
    return result.promise;
  };
  t.after(() => {
    for (const [index, result] of returns.entries()) result.resolve(host.user(host.prompts[index]));
  });
  async function prepare(id: string) {
    const captured = owner(host.addSession(id));
    await bind(peer, captured);
    const arm = await peer.wait('ready', (event) => event.owner.chatId === id);
    return { captured, command: submit(peer, captured, arm.armId) };
  }
  const retired: Awaited<ReturnType<typeof prepare>>[] = [];
  for (const id of ['ses_native_A', 'ses_native_B']) {
    const prepared = await prepare(id);
    assert.equal((await peer.command(prepared.command)).value.kind, 'uncertain');
    await peer.command({
      kind: 'revoke',
      scope: peer.scope,
      owner: prepared.captured,
      nonce: randomUUID(),
    });
    retired.push(prepared);
  }
  const third = await prepare('ses_native_C');
  const blocked = await peer.command(third.command);
  assert.equal(blocked.value.kind, 'not-released');
  assert.equal(blocked.value.reasonCode, 'V2_NATIVE_PROMPT_CAPACITY');
  assert.equal(host.prompts.length, 2);
  const afterRetirement = peer.evidence.length;
  host.delivered(retired[0].captured.chatId, retired[0].command.hostMessageId);
  returns[0].resolve(host.user(host.prompts[0]));
  await tick();
  await peer.command({
    kind: 'arm',
    scope: peer.scope,
    owner: third.captured,
    nonce: randomUUID(),
  });
  const arm = await peer.wait(
    'ready',
    (event) => event.owner.chatId === third.captured.chatId,
    afterRetirement,
  );
  assert.equal(
    (await peer.command(submit(peer, third.captured, arm.armId))).value.kind,
    'uncertain',
  );
  assert.equal(host.prompts.length, 3);
  await peer.command({
    kind: 'revoke',
    scope: peer.scope,
    owner: third.captured,
    nonce: randomUUID(),
  });
  const fourth = await prepare('ses_native_D');
  const stillBlocked = await peer.command(fourth.command);
  assert.equal(stillBlocked.value.kind, 'not-released');
  assert.equal(stillBlocked.value.reasonCode, 'V2_NATIVE_PROMPT_CAPACITY');
  assert.equal(host.prompts.length, 3);
  assert.equal(
    peer.evidence
      .slice(afterRetirement)
      .some(
        (event) =>
          event.kind === 'projected' ||
          (event.kind === 'ready' &&
            retired.some((item) => item.captured.chatId === event.owner.chatId)),
      ),
    false,
  );
  await handle.dispose();
});

test('provisioning and registration errors never expose supplied credentials', async () => {
  const host = new OpenCodeV2HostFixture(),
    peer = new OpenCodeV2NodeFixture();
  host.context.options = {
    targetId: peer.provision.targetId,
    generation: peer.provision.generation,
  };
  const plugin = createOpenCodeV2Plugin({
    loadProvision: async () => {
      throw new Error(peer.provision.credential);
    },
  });
  await assert.rejects(plugin.setup(host.context), /^Error: V2_PROVISION_UNAVAILABLE$/);
  assert.equal(host.events.consumers, 0);
  await assert.rejects(
    startOpenCodeV2(host.context, peer.provision, {
      register: async () => {
        throw new Error(peer.provision.credential);
      },
    }),
    /^Error: V2_REGISTRATION_UNAVAILABLE$/,
  );
  assert.equal(host.events.ended, true);
  assert.equal(host.rpcDisposals, 1);
});

test('invalid dependency limits fail closed instead of widening state budgets', async () => {
  const host = new OpenCodeV2HostFixture(),
    peer = new OpenCodeV2NodeFixture();
  host.context.options = {
    targetId: peer.provision.targetId,
    generation: peer.provision.generation,
  };
  await assert.rejects(
    startOpenCodeV2(host.context, peer.provision, {
      maxWaits: Number.NaN,
      register: peer.register,
    }),
    /V2_INVALID_INTEGER/,
  );
  assert.equal(host.events.consumers, 0);
});

test('default private registration uses scoped auth and bounds the response before decoding', async (t) => {
  for (const oversized of [false, true]) {
    const host = new OpenCodeV2HostFixture(),
      peer = new OpenCodeV2NodeFixture();
    host.context.options = {
      targetId: peer.provision.targetId,
      generation: peer.provision.generation,
    };
    let requests = 0;
    const server = http.createServer((request, response) => {
      void (async () => {
        requests++;
        assert.equal(request.url, '/integrations/opencode-v2/register');
        assert.equal(request.headers.authorization, 'Bearer ' + peer.provision.credential);
        let value = '';
        for await (const chunk of request) value += chunk.toString();
        const accepted = await peer.register(JSON.parse(value));
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(oversized ? 'x'.repeat(8193) : JSON.stringify(accepted));
      })().catch((error) => {
        response.destroy(error);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    peer.provision.nodeUrl = 'http://127.0.0.1:' + address.port;
    let handle: Awaited<ReturnType<typeof startOpenCodeV2>> | undefined;
    t.after(async () => {
      await handle?.dispose();
      server.closeAllConnections();
      if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    });
    if (oversized) {
      await assert.rejects(
        startOpenCodeV2(host.context, peer.provision),
        /V2_REGISTRATION_UNAVAILABLE/,
      );
      assert.equal(host.events.ended, true);
    } else {
      handle = await startOpenCodeV2(host.context, peer.provision);
      await handle.dispose();
    }
    assert.equal(requests, 1);
  }
});

test('unsettled registration has bounded startup and disposes its listener and dispatcher', async () => {
  const host = new OpenCodeV2HostFixture(),
    peer = new OpenCodeV2NodeFixture();
  host.context.options = {
    targetId: peer.provision.targetId,
    generation: peer.provision.generation,
  };
  let signal: AbortSignal | undefined;
  await assert.rejects(
    startOpenCodeV2(host.context, peer.provision, {
      timeoutMs: 20,
      register: async (_request, _provision, currentSignal) => {
        signal = currentSignal;
        return new Promise(() => {});
      },
    }),
    /V2_REGISTRATION_UNAVAILABLE/,
  );
  assert.equal(signal?.aborted, true);
  assert.equal(host.events.ended, true);
  assert.equal(host.rpcDisposals, 1);
});

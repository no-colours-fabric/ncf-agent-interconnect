import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { claudeFixture, FakeHelper } from './claude-code-fixture.js';
import { claudeCallMetaKey } from '../desktop/integrations/claude-code.js';

test('A native revocation while Claude adapter setup awaits prevents context-ticket issuance', async (t) => {
  const f = await claudeFixture(t);
  const session = randomUUID();
  await f.hook('SessionStart', session, { source: 'startup' });
  const helper = new FakeHelper(f, session);
  await helper.attach();
  t.after(() => helper.detach());
  let entered!: () => void;
  let release!: () => void;
  const installing = new Promise<void>((resolve) => (entered = resolve));
  const blocked = new Promise<void>((resolve) => (release = resolve));
  const install = f.service.installAdapter.bind(f.service);
  f.service.installAdapter = async (profile) => {
    await install(profile);
    if (profile.kind === 'claude-code') {
      entered();
      await blocked;
    }
  };
  t.after(() => release());
  const args = { nickname: 'Setup boundary 漢字' };
  const proof = await f.preTool(session, 'agent_connect', args);
  const pending = helper.verify('agent_connect', args, proof);
  await installing;
  await f.hook('SessionEnd', session, { reason: 'clear' });
  release();
  const result = await pending;
  assert.equal(result.status, 400);
  assert.equal(result.body.contextToken, undefined);
  assert.equal(result.body.callToken, undefined);
  assert.ok(!f.service.store.list().some((agent) => agent.nickname === args.nickname));
  assert.equal(f.service.claude.route(session).helper, undefined);
});

test('A native revocation after ticket issuance is rejected at connect consumption', async (t) => {
  const f = await claudeFixture(t);
  const session = randomUUID();
  await f.hook('SessionStart', session, { source: 'startup' });
  const helper = new FakeHelper(f, session);
  await helper.attach();
  t.after(() => helper.detach());
  const args = { nickname: 'Consumption boundary' };
  const proof = await f.preTool(session, 'agent_connect', args);
  const verified = await helper.verify('agent_connect', args, proof);
  assert.equal(verified.status, 200);
  assert.equal(typeof verified.body.contextToken, 'string');
  assert.equal(typeof verified.body.callToken, 'string');
  await f.hook('SessionEnd', session, { reason: 'clear' });
  // Exercise ticket consumption rather than rejection by the separate MCP call-permit gate.
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(
      f.service.connectAutomatic(
        { ...args, contextToken: String(verified.body.contextToken) },
        { client: 'Claude Code' },
      ),
    );
  }
  assert.ok(!f.service.store.list().some((agent) => agent.nickname === args.nickname));
});

test('A context ticket cannot cross a helper transport epoch', async (t) => {
  const f = await claudeFixture(t);
  const session = randomUUID();
  await f.hook('SessionStart', session, { source: 'startup' });
  const helper = new FakeHelper(f, session);
  await helper.attach();
  t.after(() => helper.detach());
  const args = { nickname: 'Epoch boundary' };
  const proof = await f.preTool(session, 'agent_connect', args);
  const verified = await helper.verify('agent_connect', args, proof);
  assert.equal(verified.status, 200);
  assert.equal(typeof verified.body.contextToken, 'string');
  assert.equal(typeof verified.body.callToken, 'string');
  await helper.detach();
  await helper.attach();
  await assert.rejects(
    f.service.connectAutomatic(
      { ...args, contextToken: String(verified.body.contextToken) },
      { client: 'Claude Code' },
    ),
  );
  assert.ok(!f.service.store.list().some((agent) => agent.nickname === args.nickname));
});

test('Claude Code rename uses the admitted tool arguments and exact native session', async (t) => {
  const f = await claudeFixture(t);
  const session = randomUUID();
  const other = randomUUID();
  await f.hook('SessionStart', session, { source: 'startup' });
  await f.hook('SessionStart', other, { source: 'startup' });
  const helper = new FakeHelper(f, session);
  const foreign = new FakeHelper(f, other);
  await helper.attach();
  t.after(() => helper.detach());
  await foreign.attach();
  t.after(() => foreign.detach());
  const connected = await f.connect(helper, session, 'Claude previous');
  const client = await f.mcp();
  const args = { connectionId: connected.binding.connectionId as string, nickname: 'Claude новое' };
  const proofFor = async (owner: FakeHelper, chat: string) =>
    owner.verify('agent_rename', args, await f.preTool(chat, 'agent_rename', args));
  assert.equal((await proofFor(foreign, other)).status, 400);
  const approved = await proofFor(helper, session);
  assert.equal(approved.status, 200);
  const call = (arguments_: Record<string, unknown>, token: unknown) =>
    client.callTool({
      name: 'agent_rename',
      arguments: arguments_,
      _meta: { [claudeCallMetaKey]: token },
    });
  await assert.rejects(call({ ...args, nickname: 'Substituted' }, approved.body.callToken));
  const next = await proofFor(helper, session);
  assert.equal(next.status, 200);
  assert.deepEqual((await call(args, next.body.callToken)).structuredContent, {
    status: 'renamed',
    nickname: args.nickname,
  });
  assert.deepEqual(f.service.store.assertOwner(args.connectionId).binding, connected.binding);
  await assert.rejects(call(args, next.body.callToken));
});

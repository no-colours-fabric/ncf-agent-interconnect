import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { claudeFixture, FakeHelper } from './claude-code-fixture.js';

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
  await f.hook('SessionEnd', session, { reason: 'clear' });
  const client = await f.mcp();
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await client.callTool({
      name: 'agent_connect',
      arguments: { ...args, contextToken: verified.body.contextToken },
    });
    assert.equal(result.isError, true);
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
  await helper.detach();
  await helper.attach();
  const client = await f.mcp();
  const result = await client.callTool({
    name: 'agent_connect',
    arguments: { ...args, contextToken: verified.body.contextToken },
  });
  assert.equal(result.isError, true);
  assert.ok(!f.service.store.list().some((agent) => agent.nickname === args.nickname));
});

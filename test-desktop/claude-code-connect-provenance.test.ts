import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { claudeCallMetaKey } from '../desktop/integrations/claude-code.js';
import { claudeFixture, FakeHelper, type ClaudeFixture } from './claude-code-fixture.js';

interface Capability {
  callToken: string;
  contextToken: string;
}
interface Connected {
  status: string;
  binding?: { connectionId: string; chatId: string; generation: number };
}

async function helper(t: TestContext, f: ClaudeFixture, session: string) {
  await f.hook('SessionStart', session, { source: 'startup' });
  const result = new FakeHelper(f, session);
  await result.attach();
  t.after(() => result.detach());
  return result;
}

async function preflight(
  f: ClaudeFixture,
  target: FakeHelper,
  session: string,
  args: Record<string, unknown>,
): Promise<Capability> {
  const proof = await f.preTool(session, 'agent_connect', args);
  const result = await target.verify('agent_connect', args, proof);
  assert.equal(result.status, 200);
  const { callToken, contextToken } = result.body;
  assert.ok(typeof callToken === 'string');
  assert.ok(typeof contextToken === 'string');
  return { callToken, contextToken };
}

function connect(client: Client, args: Record<string, unknown>, capability: Capability) {
  return client.callTool({
    name: 'agent_connect',
    arguments: { ...args, contextToken: capability.contextToken },
    _meta: { [claudeCallMetaKey]: capability.callToken },
  });
}

async function rejected(client: Client, args: Record<string, unknown>, capability: Capability) {
  let result: Awaited<ReturnType<typeof connect>>;
  try {
    result = await connect(client, args, capability);
  } catch (error) {
    assert.ok(error instanceof StreamableHTTPError);
    assert.equal(error.code, 400);
    return;
  }
  assert.equal(result.isError, true, 'Mixed connect authorities must be rejected');
}

async function accepted(client: Client, args: Record<string, unknown>, capability: Capability) {
  const result = await connect(client, args, capability);
  assert.notEqual(result.isError, true);
  assert.ok(result.structuredContent);
  return result.structuredContent as unknown as Connected;
}

test('A connect permit cannot consume another session ticket or bind its name; both own rights survive', async (t) => {
  const f = await claudeFixture(t);
  const [a, b] = [randomUUID(), randomUUID()];
  const helperA = await helper(t, f, a);
  const helperB = await helper(t, f, b);
  const args = { nickname: 'Compound authority 漢字' };
  const ownA = await preflight(f, helperA, a, args);
  const ownB = await preflight(f, helperB, b, args);
  assert.notEqual(ownA.callToken, ownB.callToken);
  assert.notEqual(ownA.contextToken, ownB.contextToken);
  const client = await f.mcp();

  await rejected(client, args, { callToken: ownA.callToken, contextToken: ownB.contextToken });
  assert.ok(!f.service.store.list().some((agent) => agent.nickname === args.nickname));
  assert.equal(f.service.claude.route(a).helper?.id, helperA.id);
  assert.equal(f.service.claude.route(b).helper?.id, helperB.id);

  const connectedB = await accepted(client, args, ownB);
  assert.equal(connectedB.status, 'connected');
  const binding = f.service.store.list().find((agent) => agent.nickname === args.nickname)?.binding;
  assert.ok(binding);
  assert.equal(binding.chatId, b);
  const previewA = await accepted(client, args, ownA);
  assert.equal(previewA.status, 'nickname_in_use');
  assert.deepEqual(
    f.service.store.list().find((agent) => agent.nickname === args.nickname)?.binding,
    binding,
  );
  assert.equal(f.service.claude.route(a).helper?.id, helperA.id);
  assert.equal(f.service.claude.route(b).helper?.id, helperB.id);
});

test('Two preflights in the same session retain exact ticket associations and remain usable after a mix', async (t) => {
  const f = await claudeFixture(t);
  const session = randomUUID();
  const target = await helper(t, f, session);
  const args = { nickname: 'Same session, separate calls' };
  const first = await preflight(f, target, session, args);
  const second = await preflight(f, target, session, args);
  assert.notEqual(first.callToken, second.callToken);
  assert.notEqual(first.contextToken, second.contextToken);
  const client = await f.mcp();

  await rejected(client, args, { callToken: first.callToken, contextToken: second.contextToken });
  assert.ok(!f.service.store.list().some((agent) => agent.nickname === args.nickname));
  assert.equal(f.service.claude.route(session).helper?.id, target.id);
  const one = await accepted(client, args, first);
  const two = await accepted(client, args, second);
  assert.equal(one.status, 'connected');
  assert.equal(two.status, 'connected');
  assert.ok(one.binding);
  assert.ok(two.binding);
  assert.equal(one.binding.connectionId, two.binding.connectionId);
  assert.equal(one.binding.generation, two.binding.generation);
  assert.equal(
    f.service.store.list().find((agent) => agent.nickname === args.nickname)?.binding?.chatId,
    session,
  );
});

test('Own connect pairs accept omitted and explicit default options through actual MCP admission', async (t) => {
  const f = await claudeFixture(t);
  const session = randomUUID();
  const target = await helper(t, f, session);
  const client = await f.mcp();
  const nickname = 'Defaulted connect options';
  let connectionId: string | undefined;
  for (const args of [{ nickname }, { nickname, confirmTransfer: false, resetHistory: false }]) {
    const own = await preflight(f, target, session, args);
    const result = await accepted(client, args, own);
    assert.equal(result.status, 'connected');
    assert.ok(result.binding);
    connectionId ??= result.binding.connectionId;
    assert.equal(result.binding.connectionId, connectionId);
    assert.equal(f.service.claude.route(session).helper?.id, target.id);
    assert.equal(
      f.service.store.list().find((agent) => agent.nickname === nickname)?.binding?.chatId,
      session,
    );
  }
});

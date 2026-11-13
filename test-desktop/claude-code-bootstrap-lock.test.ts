import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { startClaudeBridge } from '../desktop/integrations/claude-code.js';
import { readInitialNativeLease } from '../desktop/integrations/claude-native-lease.js';
import { claudeFixture } from './claude-code-fixture.js';
import { until } from './aionui-fixture.js';

async function bridge(
  t: test.TestContext,
  f: Awaited<ReturnType<typeof claudeFixture>>,
  session: string,
) {
  const [clientTransport, bridgeTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'bootstrap-fixture', version: '1' });
  const pending = startClaudeBridge(
    f.nodeFile,
    { CLAUDE_CODE_SESSION_ID: session },
    bridgeTransport,
  );
  return {
    async connect() {
      const helper = await pending;
      t.after(async () => {
        await client.close();
        await helper.close();
      });
      await client.connect(clientTransport);
      return { client, helper };
    },
  };
}

test('A fresh bridge waits for a private initial lease write before attaching and remains usable', async (t) => {
  const f = await claudeFixture(t);
  const session = randomUUID();
  const directory = path.join(path.dirname(f.nodeFile), 'claude-native');
  const filename = path.join(directory, session + '.json');
  const lock = filename + '.lock';
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await mkdir(lock, { mode: 0o700 });
  const pending = await bridge(t, f, session);
  const nonce = randomUUID();
  // The private writer completes the initial lease before releasing its lock.
  await writeFile(
    filename,
    JSON.stringify({ version: 1, sessionId: session, nonce, active: true }),
    { mode: 0o600 },
  );
  await rm(lock, { recursive: true });
  const { client, helper } = await pending.connect();
  await until(() => f.service.claude.route(session).helper?.id === helper.helperId);
  const args = { nickname: 'Initial lease 漢字' };
  const proof = await f.preTool(session, 'agent_connect', args);
  const result = await client.callTool({
    name: 'agent_connect',
    arguments: { ...args, contextToken: proof },
  });
  assert.equal(result.isError, undefined, JSON.stringify(result));
  assert.equal(
    f.service.store.list().some((agent) => agent.nickname === args.nickname),
    true,
  );
});

test('A corrupt initial lease stays denied even if a later file becomes valid', async (t) => {
  const f = await claudeFixture(t);
  const session = randomUUID();
  const directory = path.join(path.dirname(f.nodeFile), 'claude-native');
  const filename = path.join(directory, session + '.json');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(filename, 'corrupt', { mode: 0o600 });
  const pending = await bridge(t, f, session);
  const { client } = await pending.connect();
  await writeFile(
    filename,
    JSON.stringify({ version: 1, sessionId: session, nonce: randomUUID(), active: true }),
    { mode: 0o600 },
  );
  const result = await client.callTool({
    name: 'agent_connect',
    arguments: { nickname: 'Corrupt must deny' },
  });
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result), /native Claude Code session is not verified/);
  assert.equal(
    f.service.store.list().some((agent) => agent.nickname === 'Corrupt must deny'),
    false,
  );
});

test('An already pinned helper cannot adopt a replacement lease of the same native UUID', async (t) => {
  const f = await claudeFixture(t);
  const session = randomUUID();
  await f.hook('SessionStart', session);
  const { client, helper } = await (await bridge(t, f, session)).connect();
  await until(() => f.service.claude.route(session).helper?.id === helper.helperId);
  const args = { nickname: 'Replacement must deny' };
  const proof = await f.preTool(session, 'agent_connect', args);
  await f.hook('SessionEnd', session, { reason: 'clear' });
  await f.hook('SessionStart', session, { source: 'resume' });
  const result = await client.callTool({
    name: 'agent_connect',
    arguments: { ...args, contextToken: proof },
  });
  assert.equal(result.isError, true);
  assert.equal(
    f.service.store.list().some((agent) => agent.nickname === args.nickname),
    false,
  );
});

test('An abandoned initial lease lock expires as unavailable, without authorizing or deleting it', async (t) => {
  const f = await claudeFixture(t);
  const session = randomUUID();
  const directory = path.join(path.dirname(f.nodeFile), 'claude-native');
  const lock = path.join(directory, session + '.json.lock');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await mkdir(lock, { mode: 0o700 });
  await assert.rejects(readInitialNativeLease(f.nodeFile, session, 25), /lease is unavailable/);
});

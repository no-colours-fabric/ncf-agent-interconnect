import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { claudeCallMetaKey } from '../desktop/integrations/claude-code.js';
import {
  applicationStatus,
  connectionPresentation,
} from '../desktop/renderer/application-status.js';
import { until } from './aionui-fixture.js';
import { claudeFixture, FakeHelper, type ClaudeFixture } from './claude-code-fixture.js';

function assertUnknownDelivery(f: ClaudeFixture, connectionId: string): void {
  const agent = f.service.store
    .list()
    .find((value) => value.binding?.connectionId === connectionId);
  assert.ok(agent?.binding);
  const state = f.service.adapters.get(agent.binding.adapterId).status();
  assert.equal(state.kind, 'claude-code');
  assert.equal(state.state, 'manual');
  // Without the mod's wake stream, automatic wake is reported unavailable, not working.
  assert.match(String(state.error), /^Automatic wake is unavailable in this chat/);
  assert.equal(state.capabilities.wakeIdle, true);
  assert.equal(state.capabilities.exactSession, true);
  const snapshot = f.service.snapshot();
  const entry = snapshot.directories
    .find((directory) => directory.local)
    ?.agents.find((value) => value.nickname === agent.nickname);
  assert.equal(entry?.availability, 'online');
  assert.equal(entry?.delivery, 'unknown');
  const presentation = applicationStatus('claude-code', snapshot);
  assert.equal(presentation.summary, 'notConfirmed');
  // The unavailable automatic wake is shown to the owner as the reason.
  assert.equal(presentation.issues.length, 1);
  assert.equal(connectionPresentation(state, true).status, 'clientsNotConfirmed');
}

async function readThroughMcp(
  f: ClaudeFixture,
  helper: FakeHelper,
  session: string,
  connectionId: string,
) {
  const args = { connectionId };
  const proof = await f.preTool(session, 'agent_read', args);
  const verified = await helper.verify('agent_read', args, proof);
  assert.equal(verified.status, 200);
  assert.ok(typeof verified.body.callToken === 'string');
  const client = await f.mcp();
  return client.callTool({
    name: 'agent_read',
    arguments: args,
    _meta: { [claudeCallMetaKey]: verified.body.callToken },
  });
}

test('Claude missing, failed, empty and successful manual reads never promote automatic delivery', async (t) => {
  const f = await claudeFixture(t);
  const session = randomUUID();
  await f.hook('SessionStart', session, { source: 'startup' });
  const helper = new FakeHelper(f, session);
  await helper.attach();
  const connected = await f.connect(helper, session, 'Боб');
  assert.ok(!('delivery' in connected));
  const connectionId = connected.binding.connectionId as string;
  assertUnknownDelivery(f, connectionId);

  const missing = await helper.verify('agent_read', { connectionId });
  assert.equal(missing.status, 400);
  assertUnknownDelivery(f, connectionId);
  const empty = await readThroughMcp(f, helper, session, connectionId);
  assert.equal(empty.isError, undefined);
  assert.equal((empty.structuredContent as { messages: unknown[] }).messages.length, 0);
  assertUnknownDelivery(f, connectionId);

  const file = path.join(f.directory, 'status 漢字.txt');
  await writeFile(file, 'A harmless status fixture.');
  f.service.files.exportRoots = [f.directory];
  const sender = f.service.connect({ nickname: 'Отправитель', client: 'MCP' });
  if (sender.status !== 'connected') throw new Error('The fixture sender did not connect');
  const sent = await f.service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Боб',
    text: 'Status fixture',
    files: [file],
  });
  await until(() => helper.wakes().length === 1);
  const originalMaterialize = f.service.files.materialize;
  f.service.files.materialize = async () => {
    throw new Error('Synthetic attachment preparation failure');
  };
  try {
    const failed = await readThroughMcp(f, helper, session, connectionId);
    assert.equal(failed.isError, true);
    assert.equal(f.service.store.get(sent.id, 'in')?.state, 'ready');
    assertUnknownDelivery(f, connectionId);
  } finally {
    f.service.files.materialize = originalMaterialize;
  }
  const page = await readThroughMcp(f, helper, session, connectionId);
  assert.equal(page.isError, undefined);
  assert.ok(
    (page.structuredContent as { messages: { envelope: { id: string } }[] }).messages.some(
      (message) => message.envelope.id === sent.id,
    ),
  );
  assert.equal(f.service.store.get(sent.id, 'in')?.state, 'processed');
  assert.equal(f.service.store.get(sent.id, 'out')?.state, 'processed');
  assert.equal(f.service.claude.route(session).helper?.confirmed, false);
  assertUnknownDelivery(f, connectionId);
});

test('A stored Claude confirmed flag does not become automatic-delivery authority after recovery', async (t) => {
  const f = await claudeFixture(t);
  const session = randomUUID();
  await f.hook('SessionStart', session, { source: 'startup' });
  const helper = new FakeHelper(f, session);
  await helper.attach();
  const connected = await f.connect(helper, session, 'Боб');
  const active = f.service.claude.route(session).helper;
  assert.ok(active);
  f.service.claude.confirm(active);
  const filename = path.join(f.directory, 'claude-routes.json');
  await until(() => {
    try {
      const saved = JSON.parse(readFileSync(filename, 'utf8')) as {
        routes: { helperId: string; confirmed: boolean }[];
      };
      return saved.routes.some((route) => route.helperId === helper.id && route.confirmed);
    } catch {
      return false;
    }
  });
  assertUnknownDelivery(f, connected.binding.connectionId);
  await f.restart();
  await helper.attach();
  const recovered = await f.connect(helper, session, 'Боб');
  assert.ok(!('delivery' in recovered));
  assert.equal(f.service.claude.route(session).helper?.confirmed, true);
  assertUnknownDelivery(f, recovered.binding.connectionId);
});

test('Generic MCP clients retain their ordinary delivery description and message receipt', async (t) => {
  const f = await claudeFixture(t);
  const client = new Client({ name: 'Generic MCP fixture', version: '1' });
  t.after(() => client.close());
  await client.connect(
    new StreamableHTTPClientTransport(new URL(f.service.snapshot().mcpUrl), {
      requestInit: { headers: { authorization: 'Bearer ' + f.service.settings.value.localToken } },
    }),
  );
  const response = await client.callTool({ name: 'agent_connect', arguments: { nickname: 'Ева' } });
  assert.equal(response.isError, undefined);
  const connected = response.structuredContent as {
    binding: { connectionId: string };
    delivery: { automatic: boolean; description: string };
  };
  assert.equal(connected.delivery.automatic, false);
  assert.match(connected.delivery.description, /standard MCP/);
  const sender = f.service.connect({ nickname: 'Отправитель', client: 'MCP' });
  if (sender.status !== 'connected') throw new Error('The fixture sender did not connect');
  const sent = await f.service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Ева',
    text: 'Ordinary MCP message',
  });
  const read = await client.callTool({
    name: 'agent_read',
    arguments: { connectionId: connected.binding.connectionId },
  });
  assert.equal(read.isError, undefined);
  assert.equal(f.service.store.get(sent.id, 'in')?.state, 'processed');
  assert.equal(f.service.store.get(sent.id, 'out')?.state, 'processed');
  const entry = f.service
    .snapshot()
    .directories[0].agents.find((value) => value.nickname === 'Ева');
  assert.equal(entry?.delivery, 'mcp');
});

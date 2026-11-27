import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { pairingNode } from './pairing-node-fixture.js';

async function fixture(t: test.TestContext) {
  const service = await pairingNode(t);
  const client = new Client({ name: 'MCP recovery fixture', version: '1' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
      requestInit: { headers: { authorization: 'Bearer ' + service.settings.value.localToken } },
    }),
  );
  t.after(() => client.close());
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args }) as Promise<CallToolResult>;
  const owner = (nickname: string) => {
    const result = service.connect({ nickname, client: 'MCP' });
    if (result.status !== 'connected') throw new Error('Fixture binding failed');
    return result.binding.connectionId;
  };
  return { service, client, call, owner };
}

function refused(result: CallToolResult, status: string, nextAction?: string) {
  assert.equal(result.isError, true);
  const body = result.structuredContent;
  assert.equal(body?.status, status);
  assert.equal(body?.nextAction, nextAction);
  assert.equal(typeof body?.description, 'string');
  assert.deepEqual(result.content, [{ type: 'text', text: body?.description }]);
  return body!;
}

test('MCP history withholds a temporarily invisible row and resumes from the last successful cursor', async (t) => {
  const { service, call, owner } = await fixture(t);
  const connectionId = owner('Receiver');
  const sender = owner('Sender');
  const send = (text: string) =>
    service.send({
      connectionId: sender,
      recipientNode: service.settings.value.nodeId,
      recipientNickname: 'Receiver',
      text,
    });
  const first = await send('First page');
  const second = await send('Temporary private row');
  const third = await send('Following private row');
  const initial = await call('agent_history', { connectionId, limit: 1 });
  assert.ok(!initial.isError);
  const after = initial.structuredContent?.nextCursor;
  assert.ok(typeof after === 'number' && after > 0);
  assert.equal(service.store.get(first.id, 'out')?.state, 'processed');

  const get = service.store.get.bind(service.store);
  let faults = 0;
  service.store.get = (id, direction) => {
    if (id === third.id && direction === 'in' && faults === 0) {
      faults++;
      assert.equal(get(id, direction)?.state, 'ready');
      return undefined;
    }
    return direction === 'in' || direction === 'out' ? get(id, direction) : get(id);
  };
  const args = { connectionId, after, limit: 2 };
  const failed = await call('agent_history', args);
  const error = refused(failed, 'history_page_unavailable', 'agent_history');
  assert.equal(faults, 1);
  assert.equal(error.resumeAfter, after);
  assert.match(
    String(error.description),
    /page was withheld.*No receipt.*cursor was not advanced.*last successful nextCursor/,
  );
  assert.ok(!('messages' in error) && !('nextCursor' in error));
  assert.ok(!JSON.stringify(failed).includes('private row'));
  for (const id of [second.id, third.id]) {
    assert.equal(get(id, 'in')?.state, 'ready');
    assert.equal(get(id, 'out')?.state, 'ready');
    assert.equal(service.store.deliveryFenced(id), false);
    assert.equal(service.store.clearedState(id, 'in'), undefined);
  }
  const recovered = await call('agent_history', args);
  assert.ok(!recovered.isError);
  const page = recovered.structuredContent as {
    messages: { envelope: { id: string } }[];
    nextCursor: number;
  };
  assert.deepEqual(
    page.messages.map((row) => row.envelope.id),
    [second.id, third.id],
  );
  assert.ok(page.nextCursor > after);
  for (const id of [second.id, third.id]) assert.equal(get(id, 'out')?.state, 'processed');
});

test('MCP history reports a proved clear without releasing the remaining page or changing its cursor', async (t) => {
  const { service, call, owner } = await fixture(t);
  const connectionId = owner('Receiver');
  const sender = owner('Sender');
  const other = owner('Other');
  const send = (connectionId: string, text: string) =>
    service.send({
      connectionId,
      recipientNode: service.settings.value.nodeId,
      recipientNickname: 'Receiver',
      text,
    });
  const removed = await send(sender, 'Deleted private row');
  const retained = await send(other, 'Retained private row');
  const history = service.store.history.bind(service.store);
  let cleared = false;
  service.store.history = (...args) => {
    const page = history(...args);
    if (!cleared && page.messages.some((row) => row.envelope.id === removed.id)) {
      cleared = true;
      const request = { channel: 'interface' as const, session: 'fixture-clear' };
      const preview = service.clearAgents({ scope: 'agent', nickname: 'Sender' }, request);
      if (preview.status !== 'confirmation_required') throw new Error('Fixture clear preview');
      assert.equal(
        service.clearAgents(
          { scope: 'agent', nickname: 'Sender', operationId: preview.operationId, confirm: true },
          request,
        ).status,
        'cleared',
      );
    }
    return page;
  };
  const failed = await call('agent_history', { connectionId });
  const error = refused(failed, 'message_cleared', 'agent_history');
  assert.equal(cleared, true);
  assert.equal(error.resumeAfter, 0);
  assert.match(String(error.description), /The message was cleared.*page was withheld/);
  assert.ok(!('messages' in error) && !('nextCursor' in error));
  assert.ok(!JSON.stringify(failed).includes('private row'));
  assert.ok(service.store.clearedState(removed.id, 'in'));
  assert.equal(service.store.get(removed.id, 'in'), undefined);
  assert.equal(service.store.get(retained.id, 'out')?.state, 'ready');
  assert.equal(service.store.assertOwner(connectionId).nickname, 'Receiver');
  const recovered = await call('agent_history', { connectionId, after: 0 });
  assert.ok(!recovered.isError);
  const page = recovered.structuredContent as { messages: { envelope: { id: string } }[] };
  assert.deepEqual(
    page.messages.map((row) => row.envelope.id),
    [retained.id],
  );
  assert.equal(service.store.get(retained.id, 'out')?.state, 'processed');
});

test('MCP staging separates a failed storage check from an unverified outcome after creating a slot', async (t) => {
  const { service, call, owner } = await fixture(t);
  const connectionId = owner('Sender');
  const root = path.join(service.directory, 'Temporary Attachments');
  const ledger = () => service.store.db.prepare('SELECT * FROM staged_attachment_sources').all();
  const args = { connectionId, name: 'report.txt' };
  await writeFile(root, 'Fixture obstruction');
  const failed = await call('attachment_stage', args);
  const safe = refused(failed, 'attachment_stage_storage_unavailable', 'attachment_stage');
  assert.match(String(safe.description), /No slot was created.*After the owner restores.*once/);
  assert.ok(!('localPath' in safe) && !JSON.stringify(failed).includes(root));
  assert.equal(await readFile(root, 'utf8'), 'Fixture obstruction');
  assert.deepEqual(ledger(), []);

  await rm(root);
  await mkdir(root);
  const released = await call('attachment_stage', args);
  assert.ok(!released.isError);
  const localPath = released.structuredContent?.localPath;
  assert.equal(typeof localPath, 'string');
  assert.equal(await readFile(String(localPath), 'utf8'), '');
  assert.equal((await readdir(root)).length, 1);
  assert.equal(ledger().length, 1);

  let faults = 0;
  service.store.attachments.registerSource = () => {
    faults++;
    throw new Error(root);
  };
  const lost = await call('attachment_stage', { connectionId, name: 'unknown.txt' });
  const unknown = refused(lost, 'attachment_stage_outcome_unverified');
  assert.match(
    String(unknown.description),
    /slot may already exist.*Do not guess a path or repeat/,
  );
  assert.ok(!('localPath' in unknown) && !JSON.stringify(lost).includes(root));
  assert.equal(faults, 1);
  assert.equal((await readdir(root)).length, 2);
  assert.equal(ledger().length, 1);
});

test('MCP events distinguish interrupted retrieval from a successful empty page of a revoked binding', async (t) => {
  const { service, call } = await fixture(t);
  const args = { nickname: 'Movable', client: 'MCP', chatId: 'original' };
  const original = service.connect(args);
  if (original.status !== 'connected') throw new Error('Fixture original');
  const replacement = { ...args, chatId: 'replacement' };
  const offer = service.connect(replacement);
  if (offer.status !== 'nickname_in_use') throw new Error('Fixture transfer offer');
  assert.equal(
    service.connect({
      ...replacement,
      connectionId: offer.connectionId,
      transferId: offer.transferId,
      confirmTransfer: true,
    }).status,
    'connected',
  );
  const connectionId = original.binding.connectionId;
  const events = service.store.events.bind(service.store);
  const originalEvents = events(connectionId);
  assert.equal(originalEvents.length, 1);
  assert.equal(originalEvents[0]?.type, 'agent_moved');
  let calls = 0;
  const internal = 'private backend fixture detail';
  service.store.events = (id, after) => {
    if (id === connectionId && ++calls === 2) throw new Error(internal);
    return events(id, after);
  };
  const failed = await call('connection_events', { connectionId, after: 0 });
  const error = refused(failed, 'connection_events_unavailable', 'connection_events');
  assert.equal(calls, 2);
  assert.match(
    String(error.description),
    /No events were returned.*cursor was not advanced.*last successfully returned event id/,
  );
  assert.ok(!('events' in error) && !('nextCursor' in error));
  assert.ok(!JSON.stringify(failed).includes(internal));
  assert.deepEqual(events(connectionId), originalEvents);
  const resumed = await call('connection_events', { connectionId, after: 0 });
  assert.ok(!resumed.isError);
  assert.deepEqual(resumed.structuredContent, { events: originalEvents });
  const empty = await call('connection_events', { connectionId, after: originalEvents[0]!.id });
  assert.ok(!empty.isError);
  assert.deepEqual(empty.structuredContent, { events: [] });
  assert.throws(() => service.store.assertOwner(connectionId), /agent_moved/);
});

test('MCP directory and peer source failures direct the agent to read-only node status', async (t) => {
  const { service, call, owner } = await fixture(t);
  const nodeId = service.settings.value.nodeId;
  owner('First');
  const dirArgs = { nodeId, includeUnavailable: true, limit: 1 };
  owner('Second');
  const first = await call('agents_list', dirArgs);
  assert.ok(!first.isError);
  const nextCursor = first.structuredContent?.nextCursor;
  assert.equal(typeof nextCursor, 'string');
  const list = service.listAgents.bind(service);
  let dirFaults = 0;
  service.listAgents = (args) => {
    if (++dirFaults === 1) throw new Error('private directory fixture detail');
    return list(args);
  };
  const secondArgs = { ...dirArgs, cursor: nextCursor };
  const missing = refused(
    await call('agents_list', secondArgs),
    'directory_unavailable',
    'node_status',
  );
  assert.match(String(missing.description), /No directory page.*node_status.*no arguments/);
  assert.ok(!('nextCursor' in missing) && !('agents' in missing));

  const snapshot = service.snapshot.bind(service);
  let peerFaults = 0;
  service.snapshot = () => {
    if (++peerFaults === 1) throw new Error('private peer fixture detail');
    return snapshot();
  };
  const peers = refused(await call('node_peers'), 'peer_list_unavailable', 'node_status');
  assert.match(
    String(peers.description),
    /No peer list.*does not establish that pairing is absent.*node_status/,
  );
  assert.ok(!('peers' in peers));
  assert.equal(dirFaults, 1);
  assert.equal(peerFaults, 1);
  const status = await call('node_status');
  assert.ok(!status.isError);
  assert.equal(status.structuredContent?.nodeId, nodeId);
  assert.deepEqual((await call('node_peers')).structuredContent?.peers, []);
  const second = await call('agents_list', secondArgs);
  assert.ok(!second.isError);
  assert.equal(second.structuredContent?.nextCursor, null);
  owner('Third');
  const stale = refused(
    await call('agents_list', secondArgs),
    'directory_page_unavailable',
    'node_status',
  );
  assert.match(String(stale.description), /snapshot changed.*same filters and no cursor/);
  const invalid = refused(
    await call('agents_list', { ...dirArgs, cursor: 'not-a-directory-cursor' }),
    'directory_page_unavailable',
    'node_status',
  );
  assert.match(String(invalid.description), /cursor is invalid.*same filters and no cursor/);
});

test('MCP initialization and agent_read catalog prioritize direct delivery and retain the MCP fallback', async (t) => {
  const { client, call, owner } = await fixture(t);
  const catalog = await client.listTools();
  const tool = catalog.tools.find((schema) => schema.name === 'agent_read');
  for (const text of [client.getInstructions(), tool?.description]) {
    assert.match(text ?? '', /automatic delivery is working.*directly in the bound chat/);
    assert.match(text ?? '', /fallback if automatic delivery is unavailable or has failed/);
    assert.match(text ?? '', /Clients without automatic delivery can receive.*MCP.*agent_read/);
    assert.match(text ?? '', /Do not poll/);
  }
  assert.match(client.getInstructions() ?? '', /When using this fallback to await a reply/);
  const connectionId = owner('MCP reader');
  const result = await call('agent_read', { connectionId });
  assert.ok(!result.isError);
  assert.deepEqual(result.structuredContent, { messages: [], nextCursor: 0, hasMore: false });
});

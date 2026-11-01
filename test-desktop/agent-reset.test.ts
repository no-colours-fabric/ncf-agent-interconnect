import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { AgentStore, type ConnectInput, type ConnectResult } from '../desktop/core/agent-store.js';
import { NodeService } from '../desktop/core/service.js';
import { FileStore } from '../desktop/core/files.js';
import { agentMessageText, type EventInput } from '../desktop/core/adapters.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { nicknameKey, type Envelope } from '../desktop/shared/contracts.js';

async function storage(t: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-reset-'));
  let store = new AgentStore(directory);
  t.after(async () => {
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  return {
    directory,
    get store() {
      return store;
    },
    reopen() {
      store.close();
      store = new AgentStore(directory);
    },
  };
}
const binding = (nickname = 'Филипп'): ConnectInput => ({
  nickname,
  client: 'MCP',
  chatId: randomUUID(),
  adapterId: randomUUID(),
});
function connected(result: ConnectResult) {
  assert.equal(result.status, 'connected');
  if (result.status !== 'connected') throw new Error();
  return result;
}
function pending(result: ConnectResult) {
  assert.equal(result.status, 'nickname_in_use');
  if (result.status !== 'nickname_in_use') throw new Error();
  return result;
}
function confirm(request: ReturnType<typeof pending>, reset = true): ConnectInput {
  return {
    nickname: request.nickname,
    ...request.requestingChat,
    connectionId: request.connectionId,
    transferId: request.choices.find((choice) => choice.mode === (reset ? 'reset' : 'transfer'))!
      .transferId,
    confirmTransfer: true,
    resetHistory: reset,
  };
}
const envelope = (toNickname = 'Филипп'): Envelope => ({
  protocol: 2,
  id: randomUUID(),
  fromNode: randomUUID(),
  toNode: randomUUID(),
  fromNickname: 'Автор',
  toNickname,
  createdAt: new Date().toISOString(),
  text: 'Старая переписка\nUnicode Straße',
  replyTo: null,
  attachments: [],
});

test('reset tokens are mode-bound, exact-chat-bound and never grant legacy preserve approval destructive rights', async (t) => {
  const f = await storage(t),
    input = binding(),
    old = connected(f.store.connect(input));
  const message = envelope();
  f.store.insert(message, 'in');
  const request = pending(f.store.connect(binding('ФИЛИПП')));
  assert.equal(request.transferId, request.choices[0].transferId);
  assert.throws(
    () => f.store.connect({ ...confirm(request), transferId: request.transferId }),
    /selected history mode/,
  );
  assert.throws(
    () => f.store.connect({ ...confirm(request), resetHistory: false }),
    /selected history mode/,
  );
  assert.throws(
    () => f.store.connect({ ...confirm(request), chatId: randomUUID() }),
    /binding changed/,
  );
  assert.throws(
    () => f.store.connect({ ...input, client: 'Spoofed', resetHistory: true }),
    /another chat/,
  );
  assert.throws(
    () => f.store.connect({ ...confirm(request), confirmTransfer: true, transferId: undefined }),
    /transferId/,
  );
  assert.ok(f.store.get(message.id, 'in'));
  assert.ok(f.store.assertOwner(old.binding.connectionId));
  f.reopen();
  const fresh = connected(f.store.connect(confirm(request)));
  assert.equal(fresh.historyCleared, true);
  assert.equal(fresh.binding.generation, 2);
  assert.throws(() => f.store.assertOwner(old.binding.connectionId), /agent_moved/);
  assert.equal(f.store.events(old.binding.connectionId)[0].historyCleared, true);
  assert.throws(() => f.store.connect(confirm(request)), /another chat|transferId/);
  assert.equal(f.store.list().length, 1);
});

test('format 1 migration is atomic, idempotent and keeps legacy requests preserve-only', async (t) => {
  const f = await storage(t);
  connected(f.store.connect(binding()));
  const request = pending(f.store.connect(binding()));
  const message = envelope();
  f.store.insert(message, 'in');
  f.store.ready(message.id);
  f.store.db
    .exec(`CREATE TABLE legacy_transfers AS SELECT id,key,generation,requester,details,expires,consumed FROM transfers WHERE mode='transfer';
    DROP TABLE transfers; ALTER TABLE legacy_transfers RENAME TO transfers;
    DROP TABLE cleared_messages; DROP TABLE file_cleanup; PRAGMA user_version=1;`);
  f.reopen();
  assert.equal(
    (f.store.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
    2,
  );
  assert.throws(
    () => f.store.connect({ ...confirm(request), transferId: request.transferId }),
    /selected history mode/,
  );
  assert.equal(connected(f.store.connect(confirm(request, false))).historyCleared, undefined);
  assert.ok(f.store.get(message.id, 'in'));
  f.reopen();
  assert.ok(f.store.get(message.id, 'in'));
});

test('reset clears owned rows and safe local output only, preserves foreign admission and never reuses short references', async (t) => {
  const f = await storage(t),
    old = connected(f.store.connect(binding()));
  const incoming = envelope(),
    outgoing = { ...envelope('Коллега'), fromNickname: 'Филипп' };
  const file = { id: 'a'.repeat(64), name: 'план.txt', size: 3 };
  incoming.attachments = [file];
  f.store.insert(incoming, 'in');
  f.store.ready(incoming.id);
  const sequence = f.store.get(incoming.id, 'in')!.sequence;
  f.store.dispatch(incoming.id, old.binding.connectionId, 'uncertain');
  f.store.insert(outgoing, 'out');
  const retained: string[] = [],
    removed: string[] = [];
  const colleague = connected(f.store.connect(binding('Коллега')));
  for (const state of ['waiting', 'dispatching', 'uncertain', 'admitted', 'processed']) {
    const local = { ...envelope('Коллега'), fromNickname: 'Филипп' };
    local.toNode = local.fromNode;
    f.store.insertLocal(local, true);
    if (state === 'processed') f.store.recordDelivery(colleague.binding.connectionId, [local.id]);
    else f.store.dispatch(local.id, colleague.binding.connectionId, state);
    (state === 'waiting' ? removed : retained).push(local.id);
  }
  const foreignOutgoing = { ...envelope(), fromNickname: 'Коллега' };
  foreignOutgoing.toNode = foreignOutgoing.fromNode;
  f.store.insertLocal(foreignOutgoing, true);
  const fresh = connected(f.store.connect(confirm(pending(f.store.connect(binding('филипп'))))));
  assert.equal(f.store.history(nicknameKey('Филипп')).messages.length, 0);
  assert.equal(f.store.incomingBySequence(nicknameKey('Филипп'), sequence), undefined);
  assert.equal(f.store.get(outgoing.id, 'out'), undefined);
  assert.equal(f.store.dispatchState(incoming.id), null);
  for (const id of retained) assert.ok(f.store.get(id, 'in'));
  for (const id of removed) assert.equal(f.store.get(id, 'in'), undefined);
  assert.equal(
    f.store.get(foreignOutgoing.id, 'out')!.state,
    'ready',
    'reset must not fabricate agent receipt',
  );
  assert.equal(f.store.fileCleanup().length, 1);
  assert.equal(f.store.attachmentReferenced(file.id), false);
  assert.equal(f.store.insert(incoming, 'in'), false);
  assert.throws(
    () => f.store.insert({ ...incoming, text: 'Different' }, 'in'),
    /different content/,
  );
  assert.throws(
    () => f.store.insert({ ...incoming, fromNickname: 'Новый автор' }, 'out'),
    /different content/,
  );
  assert.throws(
    () => f.store.insert({ ...incoming, toNickname: 'ФИЛИПП' }, 'in'),
    /different content/,
  );
  f.store.ready(incoming.id);
  f.store.dispatch(incoming.id, old.binding.connectionId, 'failed');
  assert.equal(f.store.dispatchState(incoming.id), null);
  f.reopen();
  assert.equal(f.store.clearedState(incoming.id, 'in'), 'ready');
  assert.equal(f.store.insert(incoming, 'in'), false);
  const next = envelope();
  f.store.insert(next, 'in');
  f.store.ready(next.id);
  assert.ok(f.store.get(next.id, 'in')!.sequence > sequence);
  assert.ok(f.store.assertOwner(fresh.binding.connectionId));
});

test('failed reset rolls back history, cleanup, tombstones, approval and binding; stale or expired requests cannot reset', async (t) => {
  const f = await storage(t),
    old = connected(f.store.connect(binding()));
  const message = envelope();
  message.attachments = [{ id: 'a'.repeat(64), name: 'old.txt', size: 1 }];
  f.store.insert(message, 'in');
  const request = pending(f.store.connect(binding()));
  f.store.db.exec(
    "CREATE TRIGGER reject_binding BEFORE UPDATE ON agents BEGIN SELECT RAISE(ABORT, 'Simulated failure'); END",
  );
  assert.throws(() => f.store.connect(confirm(request)), /Simulated failure/);
  assert.ok(f.store.get(message.id, 'in'));
  assert.equal(f.store.clearedState(message.id, 'in'), undefined);
  assert.deepEqual(f.store.fileCleanup(), []);
  assert.ok(f.store.assertOwner(old.binding.connectionId));
  assert.deepEqual(f.store.events(old.binding.connectionId), []);
  f.store.db.exec('DROP TRIGGER reject_binding');
  const stale = pending(f.store.connect(binding()));
  connected(f.store.connect(confirm(request, false)));
  assert.throws(() => f.store.connect(confirm(stale)), /binding changed/);
  const expired = pending(f.store.connect(binding()));
  f.store.db.prepare('UPDATE transfers SET expires=0 WHERE id=?').run(confirm(expired).transferId!);
  assert.throws(() => f.store.connect(confirm(expired)), /transferId/);
  assert.ok(f.store.get(message.id, 'in'));
});

test('fresh start cannot target an unbound name or the current exact chat', async (t) => {
  const f = await storage(t),
    input = binding();
  assert.throws(() => f.store.connect({ ...input, resetHistory: true }), /another chat/);
  assert.equal(f.store.list().length, 0);
  const old = connected(f.store.connect(input));
  assert.throws(
    () => f.store.connect({ ...input, client: 'Renamed client', resetHistory: true }),
    /another chat/,
  );
  f.store.disconnect(old.binding.connectionId);
  assert.throws(() => f.store.connect({ ...binding(), resetHistory: true }), /another chat/);
  assert.equal(connected(f.store.connect(input)).binding.generation, 2);
});

test('failed format migration leaves the prior version and no partially created reset tables', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-reset-migration-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'agents.sqlite');
  const prior = new DatabaseSync(filename);
  // A conflicting legacy schema forces ALTER TABLE to fail after CREATE statements.
  prior.exec('CREATE TABLE transfers(id TEXT,mode TEXT); PRAGMA user_version=1');
  prior.close();
  assert.throws(() => new AgentStore(directory), /duplicate column/);
  const inspected = new DatabaseSync(filename);
  try {
    assert.equal(
      (inspected.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
      1,
    );
    assert.equal(
      inspected.prepare("SELECT 1 FROM sqlite_master WHERE name='cleared_messages'").get(),
      undefined,
    );
    assert.equal(
      inspected.prepare("SELECT 1 FROM sqlite_master WHERE name='file_cleanup'").get(),
      undefined,
    );
  } finally {
    inspected.close();
  }
});

async function until(check: () => boolean, timeout = 4000): Promise<void> {
  const end = Date.now() + timeout;
  while (!check()) {
    if (Date.now() > end) throw new Error('Reset test barrier timed out');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
async function bounded<T>(operation: Promise<T>): Promise<T> {
  let timer!: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Reset operation timed out')), 4000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
function gate() {
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered = false;
  return {
    release,
    get entered() {
      return entered;
    },
    async wait() {
      entered = true;
      await bounded(blocked);
    },
  };
}

async function node(t: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-reset-node-'));
  const service = new NodeService(directory);
  // Keep every test listener on ephemeral ports, independently of running applications.
  await service.settings.load();
  service.settings.value.mcpPort = 0;
  service.settings.value.peerPort = 0;
  await service.settings.save();
  await service.open();
  t.after(async () => {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  return service;
}
function reset(service: NodeService, nickname = 'Филипп') {
  return connected(
    service.connect(confirm(pending(service.connect({ nickname, client: 'New chat' })))),
  );
}
async function mcp(t: test.TestContext, service: NodeService) {
  const client = new Client({ name: 'reset-test', version: '1' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
      requestInit: { headers: { Authorization: 'Bearer ' + service.settings.value.localToken } },
    }),
  );
  t.after(() => client.close());
  return client;
}
const page = (value: unknown) => value as { messages: { envelope: Envelope; replyRef?: string }[] };
const internal = (service: NodeService) =>
  service as unknown as {
    flush(peerId: string): Promise<void>;
    receive(
      peerId: string,
      frame:
        | { type: 'message'; envelope: Envelope }
        | { type: 'receipt'; id: string; state: 'processed' },
    ): Promise<void>;
    drainAdapters(): void;
    drainIncoming(): Promise<void>;
    drainFileCleanup(): void;
  };

test('MCP advertises two choices; reset revokes old tools, clears refs, preserves foreign history and accepts new messages', async (t) => {
  const service = await node(t),
    first = await mcp(t, service),
    second = await mcp(t, service);
  const catalog = await first.listTools();
  assert.equal(
    catalog.tools.find((tool) => tool.name === 'agent_connect')!.annotations?.destructiveHint,
    true,
  );
  assert.ok(
    catalog.tools
      .filter((tool) => tool.name !== 'agent_connect')
      .every((tool) => tool.annotations?.destructiveHint === false),
  );
  const callConnect = async (client: Client, args: Record<string, unknown>) =>
    (await client.callTool({ name: 'agent_connect', arguments: args }))
      .structuredContent as unknown as ConnectResult;
  const old = connected(await callConnect(first, { nickname: 'Филипп' }));
  const sender = connected(service.connect({ nickname: 'Автор', client: 'MCP' }));
  const message = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Филипп',
    text: 'Old',
  });
  const history = page(await service.read(old.binding.connectionId));
  const ref = history.messages[0].replyRef!;
  const request = pending(await callConnect(second, { nickname: 'ФИЛИПП' }));
  const args = confirm(request);
  const fresh = connected(
    await callConnect(second, {
      nickname: args.nickname,
      connectionId: args.connectionId,
      transferId: args.transferId,
      confirmTransfer: true,
      resetHistory: true,
    }),
  );
  assert.equal(fresh.historyCleared, true);
  assert.match(fresh.resetLimits!, /remote queues.*In-flight/);
  assert.equal(page(await service.read(fresh.binding.connectionId)).messages.length, 0);
  assert.throws(
    () => service.resolveReplyAddress(fresh.binding.connectionId, { replyRef: ref }),
    /does not identify/,
  );
  for (const name of ['agent_read', 'agent_history', 'agent_disconnect', 'agent_send']) {
    const result = await first.callTool({
      name,
      arguments: {
        connectionId: old.binding.connectionId,
        ...(name === 'agent_send'
          ? {
              recipientNode: service.settings.value.nodeId,
              recipientNickname: 'Автор',
              text: 'Old capability',
            }
          : {}),
      },
    });
    assert.equal(result.isError, true, name);
    assert.match(JSON.stringify(result.content), /agent_moved/);
  }
  assert.ok(service.store.get(message.id, 'out'));
  const next = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'филипп',
    text: 'New',
  });
  const received = page(await service.read(fresh.binding.connectionId, 0, 50, true)).messages;
  assert.equal(received[0].envelope.id, next.id);
  assert.notEqual(received[0].replyRef, ref);
});

test('reset during source snapshot rejects old sends and cleans orphan snapshots after releasing the lease', async (t) => {
  const service = await node(t),
    old = connected(service.connect({ nickname: 'Филипп', client: 'MCP' }));
  const filename = path.join(service.settings.value.exportRoots[0], 'snapshot.txt');
  await writeFile(filename, 'snapshot data');
  const barrier = gate(),
    snapshot = service.files.snapshot.bind(service.files);
  let blob = '';
  service.files.snapshot = async (filename) => {
    const file = await snapshot(filename);
    blob = service.files.blob(file.id);
    await barrier.wait();
    return file;
  };
  const sending = service.send({
    connectionId: old.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Other',
    text: 'Cancelled',
    files: [filename],
  });
  const rejected = assert.rejects(sending, /agent_moved/);
  try {
    await until(() => barrier.entered);
    reset(service);
  } finally {
    barrier.release();
  }
  await rejected;
  await until(() => service.store.fileCleanup().length === 0);
  await assert.rejects(access(blob));
  assert.equal(service.store.pending('out').length, 0);
  assert.equal(await readFile(filename, 'utf8'), 'snapshot data');
});

test('reset during MCP materialize waits for siblings and prevents old read or file capability returning cleared rows', async (t) => {
  const service = await node(t),
    old = connected(service.connect({ nickname: 'Филипп', client: 'MCP' }));
  const filename = path.join(service.settings.value.exportRoots[0], 'materialize.txt');
  await writeFile(filename, 'prepared data');
  const sent = await service.send({
    connectionId: old.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Филипп',
    text: 'Self',
    files: [filename],
  });
  const file = service.store.get(sent.id, 'in')!.envelope.attachments[0];
  const barrier = gate(),
    materialize = service.files.materialize.bind(service.files);
  service.files.materialize = async (...args) => {
    const copy = await materialize(...args);
    await barrier.wait();
    return copy;
  };
  const reading = assert.rejects(service.read(old.binding.connectionId), /agent_moved/);
  const receiving = assert.rejects(
    service.receiveFile(old.binding.connectionId, sent.id, file.id),
    /agent_moved/,
  );
  try {
    await until(() => barrier.entered);
    reset(service);
    assert.ok(service.store.fileCleanup().length);
  } finally {
    barrier.release();
  }
  await Promise.all([reading, receiving]);
  await until(() => service.store.fileCleanup().length === 0);
  assert.equal(service.store.get(sent.id), undefined);
  assert.equal(service.store.dispatchState(sent.id), null);
  await assert.rejects(access(path.join(service.directory, 'Received', sent.id)));
});

test('native pre-submit reset does not block new generation, resurrect dispatch or repeat uncertain admission', async (t) => {
  const service = await node(t),
    old = connected(service.connect({ nickname: 'Филипп', client: 'MCP' }));
  const sender = connected(service.connect({ nickname: 'Автор', client: 'MCP' }));
  const adapter = service.adapters.get(old.binding.adapterId),
    status = adapter.status.bind(adapter);
  adapter.status = () => ({
    ...status(),
    capabilities: { ...status().capabilities, wakeIdle: true },
  });
  const barrier = gate(),
    admitted: string[] = [],
    notices: string[] = [];
  let first = true;
  adapter.deliver = async (input: EventInput) => {
    if (input.systemEvent) {
      notices.push(agentMessageText(input));
      return { state: 'admitted' };
    }
    if (first) {
      first = false;
      await barrier.wait();
    }
    if (!input.isCurrent?.()) return { state: 'revoked' };
    admitted.push(input.messageId);
    return { state: 'admitted' };
  };
  const sent = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Филипп',
    text: 'Blocked old',
  });
  try {
    await until(() => barrier.entered);
    const fresh = reset(service);
    const next = await service.send({
      connectionId: sender.binding.connectionId,
      recipientNode: service.settings.value.nodeId,
      recipientNickname: 'Филипп',
      text: 'Fresh',
    });
    await until(() => admitted.includes(next.id));
    assert.ok(!admitted.includes(sent.id));
    assert.ok(service.store.assertOwner(fresh.binding.connectionId));
    await until(() => notices.some((text) => text.includes('history was deleted')));
  } finally {
    barrier.release();
  }
  await until(() => service.store.dispatchState(sent.id) === null);
  assert.ok(!admitted.includes(sent.id));
  let attempts = 0;
  adapter.deliver = async (input) => {
    if (!input.systemEvent) attempts++;
    return { state: 'uncertain' };
  };
  const uncertain = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Филипп',
    text: 'Uncertain',
  });
  await until(() => service.store.dispatchState(uncertain.id)?.state === 'uncertain');
  internal(service).drainAdapters();
  internal(service).drainAdapters();
  assert.equal(attempts, 1);
});

test('reset during a flush stops remaining queued output; late receipts cannot restore it', async (t) => {
  const service = await node(t);
  connected(service.connect({ nickname: 'Филипп', client: 'MCP' }));
  const peerId = randomUUID(),
    first = {
      ...envelope('Remote'),
      fromNickname: 'Филипп',
      fromNode: service.settings.value.nodeId,
      toNode: peerId,
    },
    second = {
      ...envelope('Remote'),
      fromNickname: 'Филипп',
      fromNode: service.settings.value.nodeId,
      toNode: peerId,
    };
  service.store.insert(first, 'out');
  service.store.insert(second, 'out');
  const barrier = gate(),
    submitted: string[] = [];
  service.network.message = async (message) => {
    submitted.push(message.id);
    await barrier.wait();
  };
  const flushing = internal(service).flush(peerId);
  try {
    await until(() => barrier.entered);
    reset(service);
  } finally {
    barrier.release();
  }
  await flushing;
  assert.deepEqual(submitted, [first.id]);
  await internal(service).receive(peerId, { type: 'receipt', id: first.id, state: 'processed' });
  assert.equal(service.store.get(first.id, 'out'), undefined);
  assert.equal(service.store.clearedState(first.id, 'out'), 'queued');
  assert.equal(service.store.get(second.id, 'out'), undefined);
});

test('reset during incoming attachment preparation cannot notify or resurrect the old row', async (t) => {
  const service = await node(t);
  connected(service.connect({ nickname: 'Филипп', client: 'MCP' }));
  const message = {
    ...envelope(),
    toNode: service.settings.value.nodeId,
    attachments: [{ id: 'b'.repeat(64), name: 'pending.txt', size: 1 }],
  };
  service.store.insert(message, 'in');
  const barrier = gate(),
    notifications: unknown[] = [];
  service.files.receive = async () => {
    await barrier.wait();
  };
  service.network.receipt = async () => {};
  service.mcp.notify = (event) => {
    notifications.push(event);
  };
  const receiving = internal(service).drainIncoming();
  try {
    await until(() => barrier.entered);
    reset(service);
  } finally {
    barrier.release();
  }
  await receiving;
  assert.equal(service.store.get(message.id, 'in'), undefined);
  assert.equal(service.store.dispatchState(message.id), null);
  assert.ok(!JSON.stringify(notifications).includes(message.id));
});

test('managed cleanup preserves shared blobs, foreign copies, modified copies and export originals', async (t) => {
  const service = await node(t),
    old = connected(service.connect({ nickname: 'Филипп', client: 'MCP' }));
  const other = connected(service.connect({ nickname: 'Другой', client: 'MCP' }));
  const filename = path.join(service.settings.value.exportRoots[0], 'shared.txt');
  await writeFile(filename, 'Shared original');
  const self = async (connectionId: string, nickname: string) =>
    service.send({
      connectionId,
      recipientNode: service.settings.value.nodeId,
      recipientNickname: nickname,
      text: 'File',
      files: [filename],
    });
  const sent = await self(old.binding.connectionId, 'Филипп'),
    foreign = await self(other.binding.connectionId, 'Другой');
  const file = service.store.get(sent.id, 'in')!.envelope.attachments[0];
  const copy = (
    (await service.receiveFile(old.binding.connectionId, sent.id, file.id)) as { localPath: string }
  ).localPath;
  await writeFile(copy, 'User modification');
  const verified = (
    (await service.receiveFile(old.binding.connectionId, sent.id, file.id)) as { localPath: string }
  ).localPath;
  const foreignCopy = (
    (await service.receiveFile(other.binding.connectionId, foreign.id, file.id)) as {
      localPath: string;
    }
  ).localPath;
  reset(service);
  await until(() => service.store.fileCleanup().length === 0);
  assert.equal(await readFile(copy, 'utf8'), 'User modification');
  await assert.rejects(access(verified));
  assert.equal(await readFile(foreignCopy, 'utf8'), 'Shared original');
  assert.equal(await service.files.exists(file), true);
  reset(service, 'Другой');
  await until(() => service.store.fileCleanup().length === 0);
  await assert.rejects(access(service.files.blob(file.id)));
  await assert.rejects(access(foreignCopy));
  assert.equal(await readFile(filename, 'utf8'), 'Shared original');
});

test('failed cleanup remains durable and resumes after node restart without deleting shared data', async (t) => {
  const service = await node(t),
    old = connected(service.connect({ nickname: 'Филипп', client: 'MCP' }));
  const filename = path.join(service.settings.value.exportRoots[0], 'retry.txt');
  await writeFile(filename, 'Retry cleanup');
  const sent = await service.send({
    connectionId: old.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Филипп',
    text: 'Old',
    files: [filename],
  });
  const file = service.store.get(sent.id, 'in')!.envelope.attachments[0];
  let attempts = 0;
  service.files.cleanup = async () => {
    attempts++;
    throw new Error('Simulated deletion failure');
  };
  reset(service);
  await until(() => attempts > 0);
  assert.equal(service.store.fileCleanup().length, 1);
  assert.equal(await service.files.exists(file), true);
  await service.close();
  const reopened = new NodeService(service.directory);
  try {
    await reopened.open();
    await until(() => reopened.store.fileCleanup().length === 0);
    await assert.rejects(access(reopened.files.blob(file.id)));
  } finally {
    await reopened.close();
  }
  assert.equal(await readFile(filename, 'utf8'), 'Retry cleanup');
});

test('file barrier lets dependent chunk readers finish before exclusive cleanup, without deadlock', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-reset-lock-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const files = new FileStore(directory, []),
    barrier = gate();
  const events: string[] = [];
  const reading = files.withLease(async () => {
    events.push('reader');
    await barrier.wait();
  });
  try {
    await until(() => barrier.entered);
    const cleanup = files.exclusive(async () => {
      events.push('cleanup');
    });
    const chunk = files.withLease(async () => {
      events.push('chunk');
    });
    await bounded(chunk);
    assert.deepEqual(events, ['reader', 'chunk']);
    barrier.release();
    await Promise.all([reading, cleanup]);
    assert.deepEqual(events, ['reader', 'chunk', 'cleanup']);
  } finally {
    barrier.release();
  }
});

test('remote replay after reset/restart remains suppressed and cannot report false agent receipt; foreign same-name mailbox survives', async (t) => {
  const a = await node(t),
    b = await node(t);
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  const sender = connected(a.connect({ nickname: 'Филипп', client: 'MCP' }));
  connected(b.connect({ nickname: 'Филипп', client: 'MCP' }));
  const sent = await a.send({
    connectionId: sender.binding.connectionId,
    recipientNode: b.settings.value.nodeId,
    recipientNickname: 'Филипп',
    text: 'Remote old',
  });
  await until(() => b.store.get(sent.id, 'in')?.state === 'ready');
  const original = a.store.get(sent.id, 'out')!.envelope;
  const fresh = reset(b);
  let retries = 0;
  const receipt = b.network.receipt.bind(b.network);
  b.network.receipt = async (...args) => {
    if (args[1] === sent.id) {
      retries++;
      assert.notEqual(args[2], 'processed');
    }
    await receipt(...args);
  };
  await a.network.message(original);
  await until(() => retries > 0);
  assert.equal(b.store.get(sent.id, 'in'), undefined);
  assert.ok(a.store.get(sent.id, 'out'));
  assert.ok(a.store.assertOwner(sender.binding.connectionId));
  await b.close();
  const reopened = new NodeService(b.directory);
  try {
    await reopened.open();
    let retried = false;
    const insert = reopened.store.insert.bind(reopened.store);
    reopened.store.insert = (...args) => {
      const result = insert(...args);
      if (args[0].id === sent.id) retried = true;
      return result;
    };
    await until(
      () =>
        a.snapshot().peers[0]?.connected === true &&
        reopened.snapshot().peers[0]?.connected === true,
    );
    await a.network.message(original);
    await until(() => retried);
    assert.equal(reopened.store.get(sent.id, 'in'), undefined);
    assert.equal(page(await reopened.read(fresh.binding.connectionId)).messages.length, 0);
    assert.notEqual(a.store.get(sent.id, 'out')!.state, 'processed');
  } finally {
    await reopened.close();
  }
});

test('a failed materialize waits for still-writing siblings before reset cleanup can take the exclusive lease', async (t) => {
  const service = await node(t),
    old = connected(service.connect({ nickname: 'Филипп', client: 'MCP' }));
  const root = service.settings.value.exportRoots[0],
    first = path.join(root, 'first.txt'),
    second = path.join(root, 'second.txt');
  await writeFile(first, 'First');
  await writeFile(second, 'Second');
  const sent = await service.send({
    connectionId: old.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Филипп',
    text: 'Both',
    files: [first, second],
  });
  const barrier = gate(),
    materialize = service.files.materialize.bind(service.files);
  service.files.materialize = async (id, file) => {
    if (file.name === 'first.txt') throw new Error('Simulated materialize failure');
    await barrier.wait();
    return materialize(id, file);
  };
  let settled = false;
  const reading = service.read(old.binding.connectionId);
  void reading.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  const rejected = assert.rejects(reading, /Simulated materialize failure/);
  try {
    await until(() => barrier.entered);
    reset(service);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(settled, false);
    assert.ok(service.store.fileCleanup().length);
  } finally {
    barrier.release();
  }
  await rejected;
  await until(() => service.store.fileCleanup().length === 0);
  await assert.rejects(access(path.join(service.directory, 'Received', sent.id)));
});

test('a failed snapshot waits for sibling results and durably cleans successful orphan blobs', async (t) => {
  const service = await node(t),
    old = connected(service.connect({ nickname: 'Филипп', client: 'MCP' }));
  const root = service.settings.value.exportRoots[0],
    filename = path.join(root, 'sibling.txt');
  await writeFile(filename, 'Sibling');
  const barrier = gate(),
    snapshot = service.files.snapshot.bind(service.files);
  let blob = '',
    settled = false;
  service.files.snapshot = async (file) => {
    if (file.endsWith('missing.txt')) throw new Error('Simulated snapshot failure');
    const result = await snapshot(file);
    blob = service.files.blob(result.id);
    await barrier.wait();
    return result;
  };
  const sending = service.send({
    connectionId: old.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Other',
    text: 'Both',
    files: [path.join(root, 'missing.txt'), filename],
  });
  void sending.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  const rejected = assert.rejects(sending, /Simulated snapshot failure/);
  try {
    await until(() => barrier.entered);
    reset(service);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(settled, false);
  } finally {
    barrier.release();
  }
  await rejected;
  await until(() => service.store.fileCleanup().length === 0);
  await assert.rejects(access(blob));
});

test('stable adapter session identity blocks self-reset despite changed client labels or adapter IDs', async (t) => {
  const service = await node(t),
    old = connected(service.connect({ nickname: 'Филипп', client: 'MCP' }));
  const profile = service.settings.value.adapters.find(
    (profile) => profile.id === old.binding.adapterId,
  )!;
  // Simulate duplicate verified profiles for one host session without starting an external adapter.
  const duplicate = {
    ...profile,
    id: randomUUID(),
    kind: 'opencode-http' as const,
    sessionId: old.binding.chatId,
    workspace: service.directory,
  };
  Object.assign(profile, {
    kind: 'opencode-http',
    sessionId: old.binding.chatId,
    workspace: service.directory,
  });
  service.settings.value.adapters.push(duplicate);
  assert.throws(
    () =>
      service.connect({
        nickname: 'ФИЛИПП',
        client: 'Changed label',
        chatId: old.binding.chatId,
        adapterId: duplicate.id,
        resetHistory: true,
      }),
    /another exact chat/,
  );
  assert.ok(service.store.assertOwner(old.binding.connectionId));
});

test('UI send captured from an occupied source cannot continue as its replacement after reset', async (t) => {
  const service = await node(t);
  connected(service.connect({ nickname: 'Филипп', client: 'MCP' }));
  const filename = path.join(service.settings.value.exportRoots[0], 'ui.txt');
  await writeFile(filename, 'UI snapshot');
  const barrier = gate(),
    snapshot = service.files.snapshot.bind(service.files);
  service.files.snapshot = async (file) => {
    const result = await snapshot(file);
    await barrier.wait();
    return result;
  };
  const rejected = assert.rejects(
    service.userCall('send', {
      nickname: 'Филипп',
      recipientNode: service.settings.value.nodeId,
      recipientNickname: 'Other',
      text: 'Old source',
      files: [filename],
    }),
    /agent_moved/,
  );
  try {
    await until(() => barrier.entered);
    reset(service);
  } finally {
    barrier.release();
  }
  await rejected;
  await until(() => service.store.fileCleanup().length === 0);
  assert.equal(service.store.pending('out').length, 0);
});

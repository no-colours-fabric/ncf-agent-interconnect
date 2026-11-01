import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { AgentStore, type ConnectResult } from '../desktop/core/agent-store.js';
import { NodeService } from '../desktop/core/service.js';
import {
  nicknameKey,
  type AgentClearPreview,
  type AgentClearResponse,
  type Envelope,
} from '../desktop/shared/contracts.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const ui = (session = 'window-a') => ({ channel: 'interface' as const, session });
function preview(response: AgentClearResponse): AgentClearPreview {
  assert.equal(response.status, 'confirmation_required');
  if (response.status !== 'confirmation_required') throw new Error();
  return response;
}
function connected(response: ConnectResult) {
  assert.equal(response.status, 'connected');
  if (response.status !== 'connected') throw new Error();
  return response;
}
const bind = (nickname = 'Филипп') => ({
  nickname,
  client: 'Test',
  chatId: randomUUID(),
  adapterId: randomUUID(),
});
const envelope = (nickname = 'Филипп'): Envelope => ({
  protocol: 2,
  id: randomUUID(),
  fromNode: randomUUID(),
  toNode: randomUUID(),
  fromNickname: 'Автор',
  toNickname: nickname,
  createdAt: new Date().toISOString(),
  text: 'Private fixture body',
  replyTo: null,
  attachments: [],
});
async function storage(t: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-clear-'));
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
function remove(store: AgentStore, nickname: string) {
  const p = preview(store.clearAgents({ scope: 'agent', nickname }, ui()));
  return store.clearAgents(
    { scope: 'agent', nickname, operationId: p.operationId, confirm: true },
    ui(),
  );
}
async function node(t: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-clear-node-')),
    service = new NodeService(directory);
  await service.settings.load();
  service.settings.value.peerPort = 0;
  service.settings.value.mcpPort = 0;
  await service.settings.save();
  await service.open();
  t.after(async () => {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  return service;
}
async function mcp(t: test.TestContext, service: NodeService) {
  const client = new Client({ name: 'clear-test', version: '1' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
      requestInit: { headers: { Authorization: 'Bearer ' + service.settings.value.localToken } },
    }),
  );
  t.after(() => client.close());
  return client;
}
async function until(check: () => boolean) {
  const end = Date.now() + 4000;
  while (!check()) {
    if (Date.now() > end) throw new Error('Clear fixture timed out');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
function gate() {
  let release!: () => void,
    entered = false;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    release,
    get entered() {
      return entered;
    },
    async wait() {
      entered = true;
      let timer!: ReturnType<typeof setTimeout>;
      try {
        await Promise.race([
          blocked,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Clear barrier timed out')), 4000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

test('clear preview is private, mode/channel/requester bound and never deletes before confirmation', async (t) => {
  const f = await storage(t),
    owner = connected(f.store.connect(bind())),
    other = connected(f.store.connect(bind('Другой')));
  f.store.insert(envelope(), 'in');
  const requester = {
    channel: 'mcp' as const,
    session: 'session-a',
    connectionId: owner.binding.connectionId,
  };
  const p = preview(f.store.clearAgents({ scope: 'agent' }, requester));
  assert.deepEqual(p.targets, [{ nickname: 'Филипп', messageCount: 1 }]);
  for (const secret of [
    owner.binding.connectionId,
    owner.binding.chatId,
    owner.binding.adapterId,
    'Private fixture body',
    'incarnation',
    'fingerprint',
  ])
    assert.ok(!JSON.stringify(p).includes(secret));
  assert.equal(f.store.list().length, 2);
  assert.throws(
    () =>
      f.store.clearAgents({ scope: 'all', operationId: p.operationId, confirm: true }, requester),
    /requester, scope or target/,
  );
  assert.throws(
    () => f.store.clearAgents({ scope: 'agent', nickname: 'Другой' }, requester),
    /own mailbox/,
  );
  assert.throws(
    () =>
      f.store.clearAgents(
        { scope: 'agent', operationId: p.operationId, confirm: true },
        { ...requester, session: 'session-b' },
      ),
    /requester/,
  );
  assert.throws(
    () =>
      f.store.clearAgents(
        { scope: 'agent', operationId: p.operationId, confirm: true },
        { ...requester, connectionId: other.binding.connectionId },
      ),
    /requester/,
  );
  assert.throws(
    () =>
      f.store.clearAgents(
        { scope: 'agent', nickname: 'Филипп', operationId: p.operationId, confirm: true },
        ui(),
      ),
    /requester/,
  );
  const uiPreview = preview(f.store.clearAgents({ scope: 'agent', nickname: 'Филипп' }, ui()));
  assert.throws(
    () =>
      f.store.clearAgents(
        { scope: 'agent', operationId: uiPreview.operationId, confirm: true },
        requester,
      ),
    /requester/,
  );
  assert.throws(
    () =>
      f.store.clearAgents(
        { scope: 'agent', nickname: 'Филипп', operationId: uiPreview.operationId, confirm: true },
        ui('other-window'),
      ),
    /requester/,
  );
  assert.equal(
    f.store.clearAgents({ scope: 'agent', operationId: p.operationId, confirm: true }, requester)
      .status,
    'cleared',
  );
  assert.equal(f.store.list().length, 1);
  assert.throws(() => f.store.assertOwner(owner.binding.connectionId), /agent_moved/);
  assert.ok(f.store.assertOwner(other.binding.connectionId));
  assert.throws(
    () =>
      f.store.clearAgents({ scope: 'agent', operationId: p.operationId, confirm: true }, requester),
    /agent_moved/,
  );
});

test('strict clear snapshot rejects new messages, replaced identities and changed ALL target sets', async (t) => {
  const f = await storage(t);
  f.store.ensure('Филипп');
  const p = preview(f.store.clearAgents({ scope: 'agent', nickname: 'Филипп' }, ui()));
  f.store.insert(envelope(), 'in');
  assert.throws(
    () =>
      f.store.clearAgents(
        { scope: 'agent', nickname: 'Филипп', operationId: p.operationId, confirm: true },
        ui(),
      ),
    /clear_preview_stale/,
  );
  const p2 = preview(f.store.clearAgents({ scope: 'agent', nickname: 'Филипп' }, ui()));
  const old = f.store.sourceStamp('Филипп');
  remove(f.store, 'Филипп');
  f.store.ensure('Филипп');
  assert.notEqual(f.store.sourceStamp('Филипп').incarnation, old.incarnation);
  assert.equal(f.store.sourceStamp('Филипп').generation, old.generation);
  assert.throws(
    () =>
      f.store.clearAgents(
        { scope: 'agent', nickname: 'Филипп', operationId: p2.operationId, confirm: true },
        ui(),
      ),
    /clear_preview_stale/,
  );
  const all = preview(f.store.clearAgents({ scope: 'all' }, ui()));
  f.store.ensure('New');
  assert.throws(
    () => f.store.clearAgents({ scope: 'all', operationId: all.operationId, confirm: true }, ui()),
    /clear_preview_stale/,
  );
  const all2 = preview(f.store.clearAgents({ scope: 'all' }, ui()));
  remove(f.store, 'New');
  assert.throws(
    () => f.store.clearAgents({ scope: 'all', operationId: all2.operationId, confirm: true }, ui()),
    /clear_preview_stale/,
  );
});

test('receipt-only changes keep the same clear snapshot; binding changes require another confirmation', async (t) => {
  const f = await storage(t),
    owner = connected(f.store.connect(bind()));
  const message = envelope();
  f.store.insert(message, 'in');
  f.store.ready(message.id);
  const p = preview(f.store.clearAgents({ scope: 'agent', nickname: 'Филипп' }, ui()));
  f.store.recordDelivery(owner.binding.connectionId, [message.id]);
  assert.equal(
    f.store.clearAgents(
      { scope: 'agent', nickname: 'Филипп', operationId: p.operationId, confirm: true },
      ui(),
    ).status,
    'cleared',
  );
  const next = connected(f.store.connect(bind())),
    p2 = preview(f.store.clearAgents({ scope: 'agent', nickname: 'Филипп' }, ui()));
  f.store.disconnect(next.binding.connectionId);
  assert.throws(
    () =>
      f.store.clearAgents(
        { scope: 'agent', nickname: 'Филипп', operationId: p2.operationId, confirm: true },
        ui(),
      ),
    /clear_preview_stale/,
  );
});

test('clear tokens expire, are bounded, cannot survive restart or clear a recreated name twice', async (t) => {
  const f = await storage(t);
  f.store.ensure('Филипп');
  const p = preview(f.store.clearAgents({ scope: 'agent', nickname: 'Филипп' }, ui()));
  t.mock.method(Date, 'now', () => Date.parse(p.expiresAt) + 1);
  assert.throws(
    () =>
      f.store.clearAgents(
        { scope: 'agent', nickname: 'Филипп', operationId: p.operationId, confirm: true },
        ui(),
      ),
    /clear_preview_expired/,
  );
  t.mock.restoreAll();
  const restart = preview(f.store.clearAgents({ scope: 'all' }, ui()));
  f.reopen();
  assert.throws(
    () =>
      f.store.clearAgents({ scope: 'all', operationId: restart.operationId, confirm: true }, ui()),
    /clear_preview_expired/,
  );
  const consumed = preview(f.store.clearAgents({ scope: 'all' }, ui()));
  f.store.clearAgents({ scope: 'all', operationId: consumed.operationId, confirm: true }, ui());
  f.store.ensure('Филипп');
  assert.throws(
    () =>
      f.store.clearAgents({ scope: 'all', operationId: consumed.operationId, confirm: true }, ui()),
    /clear_preview_expired/,
  );
  for (let i = 0; i < 128; i++) f.store.clearAgents({ scope: 'all' }, ui());
  assert.throws(() => f.store.clearAgents({ scope: 'all' }, ui()), /Too many pending/);
});

test('clear transaction rollback preserves identity, history, approvals, cleanup and revocation state', async (t) => {
  const f = await storage(t),
    owner = connected(f.store.connect(bind())),
    message = envelope();
  message.attachments = [{ id: 'a'.repeat(64), name: 'fixture.txt', size: 1 }];
  f.store.insert(message, 'in');
  const p = preview(f.store.clearAgents({ scope: 'agent', nickname: 'Филипп' }, ui())),
    stamp = f.store.sourceStamp('Филипп');
  f.store.db.exec(
    "CREATE TRIGGER reject_clear BEFORE DELETE ON agents BEGIN SELECT RAISE(ABORT, 'Simulated clear failure'); END",
  );
  const input = {
    scope: 'agent' as const,
    nickname: 'Филипп',
    operationId: p.operationId,
    confirm: true,
  };
  assert.throws(() => f.store.clearAgents(input, ui()), /Simulated clear failure/);
  assert.deepEqual(f.store.sourceStamp('Филипп'), stamp);
  assert.ok(f.store.get(message.id));
  assert.equal(f.store.clearedState(message.id, 'in'), undefined);
  assert.deepEqual(f.store.fileCleanup(), []);
  assert.deepEqual(f.store.events(owner.binding.connectionId), []);
  f.store.db.exec('DROP TRIGGER reject_clear');
  assert.equal(f.store.clearAgents(input, ui()).status, 'cleared');
});

test('single clear preserves foreign dispatched history and raw refs; ALL deletes only local agents and keeps adapters/peers', async (t) => {
  const service = await node(t),
    source = connected(service.connect({ nickname: 'Source', client: 'Test' })),
    target = connected(service.connect({ nickname: 'Target', client: 'Test' }));
  const filename = path.join(service.settings.value.exportRoots[0], 'shared.txt');
  await writeFile(filename, 'Shared');
  const sent = await service.send({
    connectionId: source.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Target',
    text: 'Foreign evidence',
    files: [filename],
  });
  service.store.dispatch(sent.id, target.binding.connectionId, 'failed');
  const sequence = service.store.get(sent.id, 'in')!.sequence,
    file = service.store.get(sent.id, 'in')!.envelope.attachments[0];
  const copy = (
    (await service.receiveFile(target.binding.connectionId, sent.id, file.id)) as {
      localPath: string;
    }
  ).localPath;
  const settingsHash = () =>
    createHash('sha256').update(JSON.stringify(service.settings.value)).digest('hex');
  const settings = settingsHash();
  const p = preview(service.clearAgents({ scope: 'agent', nickname: 'Source' }, ui()));
  service.clearAgents(
    { scope: 'agent', nickname: 'Source', operationId: p.operationId, confirm: true },
    ui(),
  );
  await until(() => service.store.fileCleanup().length === 0);
  assert.equal(
    service.store.list().some((agent) => agent.nickname === 'Source'),
    false,
  );
  assert.equal(
    service.store.incomingBySequence(nicknameKey('Target'), sequence)!.envelope.id,
    sent.id,
  );
  await access(copy);
  assert.equal(await service.files.exists(file), true);
  const all = preview(service.clearAgents({ scope: 'all' }, ui()));
  service.clearAgents({ scope: 'all', operationId: all.operationId, confirm: true }, ui());
  await until(() => service.store.fileCleanup().length === 0);
  assert.deepEqual(service.store.list(), []);
  assert.equal(settingsHash(), settings);
  await assert.rejects(access(copy));
  await assert.rejects(access(service.files.blob(file.id)));
  await access(filename);
});

test('revoked integration restore cannot recreate a cleared record, including after restart', async (t) => {
  const f = await storage(t),
    input = bind(),
    owner = connected(f.store.connect(input));
  const oldMessage = envelope(input.nickname);
  f.store.insert(oldMessage, 'in');
  f.store.ready(oldMessage.id);
  remove(f.store, input.nickname);
  assert.equal(f.store.insert(oldMessage, 'in'), false);
  assert.throws(
    () => f.store.connect({ ...input, connectionId: owner.binding.connectionId }),
    /agent_moved/,
  );
  assert.deepEqual(f.store.list(), []);
  f.reopen();
  assert.equal(f.store.insert(oldMessage, 'in'), false);
  assert.throws(
    () => f.store.connect({ ...input, connectionId: owner.binding.connectionId }),
    /agent_moved/,
  );
  assert.deepEqual(f.store.list(), []);
  const fresh = connected(f.store.connect(input));
  assert.notEqual(fresh.binding.connectionId, owner.binding.connectionId);
});

test('incarnation migration from format 2 preserves identity until reset or explicit delete/recreate', async (t) => {
  const f = await storage(t),
    owner = connected(f.store.connect(bind()));
  f.store.db
    .exec(`CREATE TABLE legacy_agents(key TEXT PRIMARY KEY,nickname TEXT NOT NULL,binding TEXT,generation INTEGER NOT NULL DEFAULT 0);
    INSERT INTO legacy_agents SELECT key,nickname,binding,generation FROM agents; DROP TABLE agents; ALTER TABLE legacy_agents RENAME TO agents; PRAGMA user_version=2;`);
  f.reopen();
  const original = f.store.sourceStamp('Филипп');
  assert.ok(original.incarnation);
  f.reopen();
  assert.deepEqual(f.store.sourceStamp('Филипп'), original);
  const candidate = bind(),
    pending = f.store.connect(candidate);
  if (pending.status !== 'nickname_in_use') throw new Error();
  connected(
    f.store.connect({
      ...candidate,
      connectionId: pending.connectionId,
      transferId: pending.transferId,
      confirmTransfer: true,
    }),
  );
  assert.equal(f.store.sourceStamp('Филипп').incarnation, original.incarnation);
  const reset = f.store.connect(bind());
  if (reset.status !== 'nickname_in_use') throw new Error();
  connected(
    f.store.connect({
      nickname: 'Филипп',
      ...reset.requestingChat,
      connectionId: reset.connectionId,
      transferId: reset.choices.find((choice) => choice.mode === 'reset')!.transferId,
      confirmTransfer: true,
      resetHistory: true,
    }),
  );
  assert.notEqual(f.store.sourceStamp('Филипп').incarnation, original.incarnation);
  assert.throws(() => f.store.assertOwner(owner.binding.connectionId), /agent_moved/);
});

test('MCP clear is the eleventh tool, targets only the requester mailbox and binds confirmation to the server session', async (t) => {
  const service = await node(t),
    first = await mcp(t, service),
    second = await mcp(t, service);
  const catalog = await first.listTools();
  assert.equal(catalog.tools.length, 11);
  assert.equal(
    catalog.tools.find((tool) => tool.name === 'agent_clear_history')!.annotations?.destructiveHint,
    true,
  );
  const owner = connected(
    (await first.callTool({ name: 'agent_connect', arguments: { nickname: 'Филипп' } }))
      .structuredContent as unknown as ConnectResult,
  );
  service.store.ensure('Other');
  const p = preview(
    (
      await first.callTool({
        name: 'agent_clear_history',
        arguments: { connectionId: owner.binding.connectionId },
      })
    ).structuredContent as unknown as AgentClearResponse,
  );
  const foreign = await second.callTool({
    name: 'agent_clear_history',
    arguments: {
      connectionId: owner.binding.connectionId,
      scope: 'agent',
      operationId: p.operationId,
      confirm: true,
    },
  });
  assert.equal(foreign.isError, true);
  const arbitrary = await first.callTool({
    name: 'agent_clear_history',
    arguments: { connectionId: owner.binding.connectionId, nickname: 'Other' },
  });
  assert.equal(arbitrary.isError, true);
  const result = await first.callTool({
    name: 'agent_clear_history',
    arguments: {
      connectionId: owner.binding.connectionId,
      operationId: p.operationId,
      confirm: true,
    },
  });
  assert.equal((result.structuredContent as { status: string }).status, 'cleared');
  assert.deepEqual(
    service.store.list().map((agent) => agent.nickname),
    ['Other'],
  );
  const restore = await first.callTool({
    name: 'agent_connect',
    arguments: { nickname: 'Филипп', connectionId: owner.binding.connectionId },
  });
  assert.equal(restore.isError, true);
  assert.deepEqual(
    service.store.list().map((agent) => agent.nickname),
    ['Other'],
  );
  const replacement = connected(
    (await first.callTool({ name: 'agent_connect', arguments: { nickname: 'Филипп' } }))
      .structuredContent as unknown as ConnectResult,
  );
  const all = preview(
    (
      await first.callTool({
        name: 'agent_clear_history',
        arguments: { connectionId: replacement.binding.connectionId, scope: 'all' },
      })
    ).structuredContent as unknown as AgentClearResponse,
  );
  assert.equal(all.agentCount, 2);
  const cleared = await first.callTool({
    name: 'agent_clear_history',
    arguments: {
      connectionId: replacement.binding.connectionId,
      scope: 'all',
      operationId: all.operationId,
      confirm: true,
    },
  });
  assert.equal((cleared.structuredContent as { status: string }).status, 'cleared');
  assert.deepEqual(service.store.list(), []);
});

test('delete/recreate with identical unbound generation cannot revive a pending UI send', async (t) => {
  const service = await node(t);
  service.store.ensure('Source');
  service.store.ensure('Target');
  const filename = path.join(service.settings.value.exportRoots[0], 'pending.txt');
  await writeFile(filename, 'Staged');
  const stamp = service.store.sourceStamp('Source'),
    barrier = gate(),
    snapshot = service.files.snapshot.bind(service.files);
  let blob = '';
  service.files.snapshot = async (file) => {
    const attachment = await snapshot(file);
    blob = service.files.blob(attachment.id);
    await barrier.wait();
    return attachment;
  };
  const rejected = assert.rejects(
    service.userCall('send', {
      nickname: 'Source',
      recipientNode: service.settings.value.nodeId,
      recipientNickname: 'Target',
      text: 'Old incarnation',
      files: [filename],
    }),
    /source agent binding changed/,
  );
  try {
    await until(() => barrier.entered);
    const p = preview(service.clearAgents({ scope: 'agent', nickname: 'Source' }, ui()));
    service.clearAgents(
      { scope: 'agent', nickname: 'Source', operationId: p.operationId, confirm: true },
      ui(),
    );
    service.store.ensure('Source');
    assert.equal(service.store.sourceStamp('Source').generation, stamp.generation);
    assert.notEqual(service.store.sourceStamp('Source').incarnation, stamp.incarnation);
  } finally {
    barrier.release();
  }
  await rejected;
  await until(() => service.store.fileCleanup().length === 0);
  assert.equal(service.store.history(nicknameKey('Source')).messages.length, 0);
  assert.equal(service.store.history(nicknameKey('Target')).messages.length, 0);
  await assert.rejects(access(blob));
});

test('explicit clear cancels read/materialize work and same-name recreation cannot return its old attachments', async (t) => {
  const service = await node(t),
    owner = connected(service.connect({ nickname: 'Филипп', client: 'Test' }));
  const filename = path.join(service.settings.value.exportRoots[0], 'read-clear.txt');
  await writeFile(filename, 'Old read');
  const sent = await service.send({
    connectionId: owner.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Филипп',
    text: 'Old',
    files: [filename],
  });
  const file = service.store.get(sent.id, 'in')!.envelope.attachments[0],
    barrier = gate(),
    materialize = service.files.materialize.bind(service.files);
  service.files.materialize = async (...args) => {
    const copy = await materialize(...args);
    await barrier.wait();
    return copy;
  };
  const reading = assert.rejects(service.read(owner.binding.connectionId), /agent_moved/);
  let externalCalls = 0;
  const opening = assert.rejects(
    service.withUserAttachment(sent.id, file.id, async () => {
      externalCalls++;
    }),
    /cleared/,
  );
  try {
    await until(() => barrier.entered);
    const p = preview(service.clearAgents({ scope: 'agent', nickname: 'Филипп' }, ui()));
    service.clearAgents(
      { scope: 'agent', nickname: 'Филипп', operationId: p.operationId, confirm: true },
      ui(),
    );
    connected(service.connect({ nickname: 'Филипп', client: 'New explicit connection' }));
  } finally {
    barrier.release();
  }
  await Promise.all([reading, opening]);
  await until(() => service.store.fileCleanup().length === 0);
  assert.equal(externalCalls, 0);
  assert.equal(service.store.history(nicknameKey('Филипп')).messages.length, 0);
  await assert.rejects(access(path.join(service.directory, 'Received', sent.id)));
});

test('explicit clear during native pre-submit cannot admit old messages or block a recreated binding', async (t) => {
  const service = await node(t),
    owner = connected(service.connect({ nickname: 'Филипп', client: 'Test' })),
    sender = connected(service.connect({ nickname: 'Автор', client: 'Test' }));
  const adapter = service.adapters.get(owner.binding.adapterId),
    status = adapter.status.bind(adapter),
    barrier = gate();
  adapter.status = () => ({
    ...status(),
    capabilities: { ...status().capabilities, wakeIdle: true },
  });
  const admitted: string[] = [];
  let first = true;
  adapter.deliver = async (input) => {
    if (input.systemEvent) return { state: 'admitted' };
    if (first) {
      first = false;
      await barrier.wait();
    }
    if (!input.isCurrent?.()) return { state: 'revoked' };
    admitted.push(input.messageId);
    return { state: 'admitted' };
  };
  const old = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Филипп',
    text: 'Old pre-submit',
  });
  try {
    await until(() => barrier.entered);
    const p = preview(service.clearAgents({ scope: 'agent', nickname: 'Филипп' }, ui()));
    service.clearAgents(
      { scope: 'agent', nickname: 'Филипп', operationId: p.operationId, confirm: true },
      ui(),
    );
    const replacement = connected(service.connect({ nickname: 'Филипп', client: 'New' }));
    const fresh = await service.send({
      connectionId: sender.binding.connectionId,
      recipientNode: service.settings.value.nodeId,
      recipientNickname: 'Филипп',
      text: 'New pre-submit',
    });
    await until(() => admitted.includes(fresh.id));
    assert.ok(!admitted.includes(old.id));
    assert.ok(service.store.assertOwner(replacement.binding.connectionId));
  } finally {
    barrier.release();
  }
  assert.equal(service.store.dispatchState(old.id), null);
  assert.ok(!admitted.includes(old.id));
});

test('stale UI sender and history incarnations cannot recreate or read a cleared mailbox', async (t) => {
  const service = await node(t);
  service.store.ensure('Source');
  const incarnation = service.store.sourceStamp('Source').incarnation!;
  const p = preview(service.clearAgents({ scope: 'agent', nickname: 'Source' }, ui()));
  service.clearAgents(
    { scope: 'agent', nickname: 'Source', operationId: p.operationId, confirm: true },
    ui(),
  );
  const args = {
    nickname: 'Source',
    sourceIncarnation: incarnation,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Target',
    text: 'Old selected source',
  };
  await assert.rejects(service.userCall('send', args), /selected source agent changed/);
  assert.deepEqual(service.store.list(), []);
  service.store.ensure('Source');
  await assert.rejects(service.userCall('send', args), /selected source agent changed/);
  await assert.rejects(
    service.userCall('history', { nickname: 'Source', incarnation }),
    /selected agent changed/,
  );
});

test('stop/start invalidates interface previews even when targets remain unchanged', async (t) => {
  const service = await node(t);
  service.store.ensure('Филипп');
  const p = preview(service.clearAgents({ scope: 'agent', nickname: 'Филипп' }, ui()));
  await service.stop();
  await service.start();
  assert.throws(
    () =>
      service.clearAgents(
        { scope: 'agent', nickname: 'Филипп', operationId: p.operationId, confirm: true },
        ui(),
      ),
    /clear_preview_expired/,
  );
  assert.equal(service.store.list().length, 1);
});

test('empty and Unicode unbound agent records are removed; an empty ALL confirmation is harmless', async (t) => {
  const f = await storage(t);
  f.store.ensure('Straße');
  const p = preview(f.store.clearAgents({ scope: 'agent', nickname: 'STRASSE' }, ui()));
  assert.deepEqual(p.targets, [{ nickname: 'Straße', messageCount: 0 }]);
  assert.equal(
    f.store.clearAgents(
      { scope: 'agent', nickname: 'straße', operationId: p.operationId, confirm: true },
      ui(),
    ).status,
    'cleared',
  );
  const all = preview(f.store.clearAgents({ scope: 'all' }, ui()));
  assert.equal(all.agentCount, 0);
  assert.equal(
    f.store.clearAgents({ scope: 'all', operationId: all.operationId, confirm: true }, ui()).status,
    'cleared',
  );
  assert.deepEqual(f.store.list(), []);
});

test('an empty incarnation cannot be cleared by a token issued for a deleted empty record with the same generation', async (t) => {
  const f = await storage(t);
  f.store.ensure('Филипп');
  const old = f.store.sourceStamp('Филипп'),
    p = preview(f.store.clearAgents({ scope: 'agent', nickname: 'Филипп' }, ui()));
  remove(f.store, 'Филипп');
  f.store.ensure('Филипп');
  const fresh = f.store.sourceStamp('Филипп');
  assert.equal(fresh.generation, old.generation);
  assert.equal(fresh.connectionId, old.connectionId);
  assert.notEqual(fresh.incarnation, old.incarnation);
  assert.equal(f.store.list()[0].messageCount, 0);
  assert.throws(
    () =>
      f.store.clearAgents(
        { scope: 'agent', nickname: 'Филипп', operationId: p.operationId, confirm: true },
        ui(),
      ),
    /clear_preview_stale/,
  );
  assert.equal(f.store.list().length, 1);
});

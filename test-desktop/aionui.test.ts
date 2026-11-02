import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readFile, stat, writeFile, rename, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NodeService } from '../desktop/core/service.js';
import { AionUiSessions } from '../desktop/core/aionui-sessions.js';
import { AionCookies, aionUrl } from '../desktop/core/aionui-api.js';
import { aionFixture, until } from './aionui-fixture.js';
import { ownNode, temporaryNode } from './aionui-lifecycle.js';
import type { ConnectResult } from '../desktop/core/agent-store.js';

async function setup(t: test.TestContext) {
  const fixture = await aionFixture(t);
  const service = await temporaryNode(fixture.scope);
  const directory = service.directory;
  await service.userCall('aionUiPair', { url: fixture.url, code: fixture.code });
  const connect = async (
    chat = 'fixture-chat-a',
    nickname = 'Тигр 漢字',
    transfer: Record<string, unknown> = {},
  ) => {
    const ticket = await service.contexts.registerAionUi(fixture.context(chat));
    return service.connectAutomatic({ nickname, ...transfer, ...ticket }, { client: 'AionUi' });
  };
  return { ...fixture, service, directory, connect };
}
function connected(result: ConnectResult) {
  assert.equal(result.status, 'connected');
  if (result.status !== 'connected') throw new Error('Expected a connected fixture');
  return result.binding;
}

test('AionUi binds the native exact chat, preserves Unicode, attachments, IDs and automatic local receipt', async (t) => {
  const f = await setup(t);
  const recipient = connected(await f.connect());
  assert.equal(recipient.chatId, 'fixture-chat-a');
  const sender = connected(f.service.connect({ nickname: 'Боб', client: 'fixture' }));
  const filename = path.join(f.directory, 'Files', 'Пример 漢字.txt');
  await writeFile(filename, 'fixture attachment');
  const id = randomUUID();
  await f.service.send({
    connectionId: sender.connectionId,
    id,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'тигр 漢字',
    text: 'Первая строка\nSecond line',
    files: [filename],
  });
  await until(() => f.service.store.dispatchState(id)?.state === 'admitted');
  assert.equal(f.posts.length, 1);
  assert.equal(f.posts[0].chat, 'fixture-chat-a');
  assert.match(f.posts[0].content, /From: "Боб"/);
  assert.match(f.posts[0].content, /Первая строка\nSecond line/);
  assert.match(f.posts[0].content, /Пример 漢字/);
  assert.match(f.posts[0].content, /Reply-To: r[0-9a-z]+/);
  assert.equal(f.service.store.get(id, 'in')?.state, 'processed');
  assert.equal(f.service.store.get(id, 'in')?.envelope.id, id);
  assert.equal(f.service.store.list().find((a) => a.nickname === 'Тигр 漢字')?.unread, 0);
  assert.deepEqual(f.service.snapshot().peers, []);
  const exposed = JSON.stringify(f.service.snapshot());
  for (const value of [
    f.runtimeToken,
    f.session,
    'fixture-user-a',
    'fixture-account-a',
    'fixture-chat-a',
    'private-account-fixture',
  ])
    assert.ok(!exposed.includes(value));
  const credentials = await stat(path.join(f.directory, 'aionui-credentials.json'));
  assert.ok(credentials.isFile());
  // Windows stat.mode does not describe NTFS DACLs.
  if (process.platform !== 'win32') assert.equal(credentials.mode & 0o777, 0o600);
  else t.diagnostic('Windows credential DACL privacy requires separate evidence.');
  const settings = await readFile(path.join(f.directory, 'settings.json'), 'utf8');
  assert.ok(!settings.includes(f.session));
  assert.ok(!settings.includes(f.runtimeToken));
});

test('confirmed busy/409 waits for the exact native completion event, including unrelated queue activity', async (t) => {
  const f = await setup(t);
  await f.connect();
  const sender = connected(f.service.connect({ nickname: 'Sender', client: 'fixture' }));
  f.state.reply = 409;
  const a = await f.service.send({
    connectionId: sender.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Тигр 漢字',
    text: 'first',
  });
  await until(() => f.service.store.dispatchState(a.id)?.state === 'waiting');
  assert.equal(f.posts.length, 1);
  const reads = f.reads.length;
  const b = await f.service.send({
    connectionId: sender.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Тигр 漢字',
    text: 'second',
  });
  await new Promise((r) => setTimeout(r, 70));
  assert.equal(f.posts.length, 1);
  assert.equal(f.reads.length, reads);
  f.complete('fixture-chat-b');
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(f.posts.length, 1);
  f.state.reply = 202;
  f.complete();
  await until(() => f.service.store.dispatchState(a.id)?.state === 'admitted');
  assert.equal(f.posts.length, 2);
  assert.notEqual(f.service.store.dispatchState(b.id)?.state, 'admitted');
  f.complete();
  await until(() => f.service.store.dispatchState(b.id)?.state === 'admitted');
  assert.equal(f.posts.length, 3);
});

test('uncertain admission is durable and never replayed by completion, reconnect or node restart', async (t) => {
  const f = await setup(t);
  await f.connect();
  const sender = connected(f.service.connect({ nickname: 'Sender', client: 'fixture' }));
  f.state.drop = true;
  const sent = await f.service.send({
    connectionId: sender.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Тигр 漢字',
    text: 'uncertain fixture',
  });
  await until(() => f.service.store.dispatchState(sent.id)?.state === 'uncertain');
  assert.equal(f.posts.length, 1);
  f.state.drop = false;
  f.complete();
  await f.service.stop();
  await f.service.start();
  f.complete();
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(f.posts.length, 1);
  assert.equal(f.service.store.dispatchState(sent.id)?.state, 'uncertain');
  const next = await f.service.send({
    connectionId: sender.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Тигр 漢字',
    text: 'new independently queued message',
  });
  await until(() => f.service.store.dispatchState(next.id)?.state === 'admitted');
  assert.equal(f.posts.length, 2);
  assert.equal(f.service.store.dispatchState(sent.id)?.state, 'uncertain');
});

test('logout, revoke and account change stop old bindings without selecting any substitute chat', async (t) => {
  for (const boundary of ['logout', 'owner-change', 'core-change', 'realtime-revoke'] as const) {
    await t.test(boundary, async (t) => {
      const f = await setup(t);
      const result = await f.connect();
      const binding = connected(result);
      if (boundary === 'logout') f.state.authenticated = false;
      if (boundary === 'owner-change') f.state.accountId = 'fixture-account-b';
      if (boundary === 'core-change') f.state.userId = 'fixture-user-b';
      if (boundary === 'realtime-revoke') {
        f.state.authenticated = false;
        f.emit({
          name: 'realtime.error',
          data: { code: 'REALTIME_AUTH_EXPIRED', private: f.runtimeToken },
        });
        await until(() => f.service.aionui.status().state === 'revoked');
      }
      const sender = connected(f.service.connect({ nickname: 'Sender', client: 'fixture' }));
      const sent = await f.service.send({
        connectionId: sender.connectionId,
        recipientNode: f.service.settings.value.nodeId,
        recipientNickname: 'Тигр 漢字',
        text: 'must remain local',
      });
      await until(() => f.service.store.dispatchState(sent.id)?.state === 'revoked');
      assert.equal(f.posts.length, 0);
      assert.equal(f.service.aionui.status().state, 'revoked');
      await assert.rejects(f.service.contexts.registerAionUi(f.context()), /access ended/);
      assert.ok(f.service.adapters.get(binding.adapterId).status().released);
      const exposed = JSON.stringify(f.service.snapshot());
      assert.ok(!exposed.includes(f.runtimeToken));
      assert.ok(!exposed.includes('private-account'));
    });
  }
});

test('exact context rejects missing/foreign chats and accounts; occupied names require explicit transfer approval', async (t) => {
  const f = await setup(t);
  await assert.rejects(
    f.service.connectAutomatic({ nickname: 'No native context' }, { client: 'AionUi' }),
    /bundled MCP bridge/,
  );
  await assert.rejects(
    f.service.contexts.registerAionUi({ ...f.context(), userId: 'fixture-other-user' }),
    /not been paired/,
  );
  await assert.rejects(
    f.service.contexts.registerAionUi(f.context('fixture-missing-chat')),
    /could not be verified/,
  );
  f.state.wrongChat = true;
  await assert.rejects(f.connect(), /could not be verified/);
  f.state.wrongChat = false;
  const first = connected(await f.connect());
  const duplicate = await f.connect('fixture-chat-b', 'ТИГР 漢字');
  assert.equal(duplicate.status, 'nickname_in_use');
  if (duplicate.status !== 'nickname_in_use') return;
  assert.equal(
    f.service.store.list().find((a) => a.key === 'тигр 漢字')?.binding?.connectionId,
    first.connectionId,
  );
  const moved = await f.connect('fixture-chat-b', 'ТИГР 漢字', {
    connectionId: duplicate.connectionId,
    transferId: duplicate.transferId,
    confirmTransfer: true,
  });
  assert.equal(connected(moved).chatId, 'fixture-chat-b');
  assert.throws(() => f.service.store.assertOwner(first.connectionId));
  const ticket = await f.service.contexts.registerAionUi(f.context());
  f.state.authenticated = false;
  await assert.rejects(
    f.service.connectAutomatic({ nickname: 'Expired ticket', ...ticket }, { client: 'AionUi' }),
    /access ended/,
  );
});

test('private pairing survives restart, refresh stays in the pinned account and re-pairing never revives old profiles', async (t) => {
  const f = await setup(t);
  const old = connected(await f.connect());
  const restored = new AionUiSessions(f.directory);
  f.scope.cancelWith(() => restored.cancelPair());
  f.scope.consumer({ label: 'restored session cleanup', close: () => restored.close() });
  await f.scope.start('restored session load', () => restored.load());
  await restored.verify(restored.current().id);
  f.state.expire = true;
  await restored.verify(restored.current().id);
  assert.equal(f.state.refreshes, 1);
  f.state.accountId = 'fixture-account-b';
  f.state.userId = 'fixture-user-b';
  await f.service.userCall('aionUiPair', { url: f.url, code: f.code });
  assert.ok(f.service.adapters.get(old.adapterId).status().released);
  const next = await f.connect('fixture-chat-a', 'New account fixture');
  assert.notEqual(connected(next).adapterId, old.adapterId);
});

test('only loopback URLs and scoped cookies are accepted; diagnostics never contain API payloads', async (t) => {
  for (const value of [
    'https://127.0.0.1',
    'http://localhost:25808',
    'http://192.168.1.2:25808',
    'http://user:secret@127.0.0.1',
    'http://127.0.0.1/path',
    'http://127.0.0.1/?secret=1',
  ])
    assert.throws(() => aionUrl(value));
  const jar = new AionCookies();
  const headers = new Headers();
  headers.append('set-cookie', 'aionui-refresh=fixture; Path=/api/auth/refresh; HttpOnly');
  headers.append('set-cookie', 'aionui-session=fixture; Path=/; HttpOnly');
  jar.accept(headers);
  assert.equal(jar.header('/ws'), 'aionui-session=fixture');
  assert.ok(jar.header('/api/auth/refresh').includes('aionui-refresh=fixture'));
  assert.ok(!jar.header('/api/auth/refresh-other').includes('aionui-refresh='));
  const f = await setup(t);
  f.state.pairApproved = false;
  await assert.rejects(f.service.aionui.pair({ url: f.url, code: f.code }), /not approved/);
  assert.equal(f.service.aionui.status().state, 'paired');
  const status = await f.service.userCall('aionUiStatus');
  assert.deepEqual(Object.keys(status as object).sort(), ['bridgeConnected', 'state', 'url']);
  const instructions = await f.service.userCall('aionUiInstructions');
  assert.ok(!('configuration' in (instructions as object)));
  const config = JSON.parse(f.service.clientInstructions('aionui').configuration);
  assert.equal(config.mcpServers.ncf_agent_interconnect.env.ELECTRON_RUN_AS_NODE, '1');
});

test('WebSocket transport reconnects and recovers a missed idle event without polling an agent', async (t) => {
  const f = await setup(t);
  const binding = connected(await f.connect());
  const sender = connected(f.service.connect({ nickname: 'Sender', client: 'fixture' }));
  f.chats.set('fixture-chat-a', true);
  const sent = await f.service.send({
    connectionId: sender.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Тигр 漢字',
    text: 'recover on transport reconnect',
  });
  await until(() => f.service.store.dispatchState(sent.id)?.state === 'waiting');
  const reads = f.reads.length;
  for (const socket of f.sockets) socket.terminate();
  f.chats.set('fixture-chat-a', false);
  await until(() => f.service.store.dispatchState(sent.id)?.state === 'admitted', 5000);
  assert.equal(f.posts.length, 1);
  assert.equal(f.service.adapters.get(binding.adapterId).status().state, 'ready');
  assert.ok(
    f.reads.length <= reads + 2,
    'recovery performs bounded inspection, not scheduled chat polling',
  );
});

test('a fresh node instance restores saved pairing and the durable waiting queue', async (t) => {
  const f = await setup(t);
  await f.connect();
  const sender = connected(f.service.connect({ nickname: 'Sender', client: 'fixture' }));
  f.chats.set('fixture-chat-a', true);
  const sent = await f.service.send({
    connectionId: sender.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Тигр 漢字',
    text: 'restart recovery fixture',
  });
  await until(() => f.service.store.dispatchState(sent.id)?.state === 'waiting');
  await f.service.close();
  f.chats.set('fixture-chat-a', false);
  const next = new NodeService(f.directory);
  let opening: Promise<void> | undefined;
  const observe = ownNode(f.scope, next, () => opening);
  opening = f.scope.call('restored node opening', async () => {
    await next.open();
    observe();
  });
  await f.scope.start('restored node open', () => opening!);
  await until(() => next.store.dispatchState(sent.id)?.state === 'admitted');
  assert.equal(f.posts.length, 1);
  assert.equal(f.posts[0].chat, 'fixture-chat-a');
});

test('normal access-token expiry reauthenticates only the pinned account and reconnects the push transport', async (t) => {
  const f = await setup(t);
  const binding = connected(await f.connect());
  f.state.expire = true;
  f.emit({ name: 'realtime.error', data: { code: 'REALTIME_AUTH_EXPIRED', recoverable: false } });
  await until(
    () =>
      f.state.refreshes === 1 &&
      f.service.adapters.get(binding.adapterId).status().state === 'ready',
    5000,
  );
  assert.equal(f.service.aionui.status().state, 'paired');
  assert.equal(f.posts.length, 0);
  assert.equal(
    f.service.store.list().find((a) => a.nickname === 'Тигр 漢字')?.binding?.connectionId,
    binding.connectionId,
  );
});

test('an invalid setup URL does not leave pairing locked and endpoints cannot expose credentials', async (t) => {
  const f = await setup(t);
  await assert.rejects(
    f.service.aionui.pair({ url: 'http://192.168.1.2', code: f.code }),
    /must use/,
  );
  await f.service.aionui.pair({ url: f.url, code: f.code });
  const endpoint = new URL('/integrations/aionui/context', f.service.snapshot().mcpUrl);
  const denied = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(f.context()),
  });
  assert.equal(denied.status, 401);
  await denied.body?.cancel();
  const authorization = 'Bearer ' + f.service.settings.value.localToken;
  const ownerOnly = await fetch(new URL('/integrations/aionui/pair', endpoint), {
    method: 'POST',
    headers: { authorization },
    body: '{}',
  });
  assert.equal(ownerOnly.status, 404);
  await ownerOnly.body?.cancel();
  const invalid = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ ...f.context(), runtimeToken: { private: f.runtimeToken } }),
  });
  assert.equal(invalid.status, 400);
  assert.ok(!(await invalid.text()).includes(f.runtimeToken));
});

test('runtime proof is validated by the paired WebUI Core, never a caller-selected loopback server', async (t) => {
  const f = await setup(t);
  let fakeRequests = 0;
  const fake = http.createServer((_req, res) => {
    fakeRequests++;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        success: true,
        data: {
          id: 'fixture-chat-b',
          runtime: { state: 'idle', can_send_message: true, pending_confirmations: 0 },
        },
      }),
    );
  });
  fake.on('error', (error) => f.scope.recordFailure(error));
  f.scope.transport({
    label: 'forged proof server close',
    close: () =>
      new Promise<void>((resolve, reject) => {
        fake.close((error) =>
          error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING'
            ? reject(error)
            : resolve(),
        );
        fake.closeAllConnections();
      }),
    force: () => fake.closeAllConnections(),
  });
  await f.scope.start(
    'forged proof server listen',
    () =>
      new Promise<void>((resolve, reject) => {
        fake.once('error', reject);
        fake.listen(0, '127.0.0.1', resolve);
      }),
  );
  const fakeUrl = 'http://127.0.0.1:' + (fake.address() as { port: number }).port;
  await assert.rejects(
    f.service.contexts.registerAionUi({
      ...f.context('fixture-chat-b'),
      baseUrl: fakeUrl,
      runtimeToken: 'invalid-runtime-token',
    }),
    /could not be verified/,
  );
  assert.equal(fakeRequests, 0);
  assert.equal(f.service.settings.value.adapters.filter((a) => a.kind === 'aionui').length, 0);
  assert.ok(f.proofs.length > 0);
  assert.ok(
    f.proofs.every((proof) => !proof.hasCoreJwt && proof.hasFrontendCookie && !proof.accepted),
  );
  assert.notEqual(
    f.context().baseUrl,
    f.url,
    'native Core and owner-paired WebUI use distinct ports',
  );
  connected(await f.connect('fixture-chat-b', 'Native context'));
  assert.ok(f.proofs.at(-1)?.accepted);
  assert.ok(f.proofs.every((proof) => !proof.hasCoreJwt && proof.hasFrontendCookie));
});

test('failed first pairing persistence publishes no usable authorization and a retry commits durably', async (t) => {
  const f = await aionFixture(t);
  let directory: string | undefined;
  f.scope.file({
    label: 'session data removal',
    close: async () => {
      if (directory) await rm(directory, { recursive: true, force: true });
    },
  });
  directory = await f.scope.start('session data', () =>
    mkdtemp(path.join(os.tmpdir(), 'ncf-aionui-save-isolated-')),
  );
  const sessions = new AionUiSessions(directory);
  f.scope.cancelWith(() => sessions.cancelPair());
  f.scope.consumer({ label: 'session cleanup', close: () => sessions.close() });
  const filename = path.join(directory, 'aionui-credentials.json');
  await mkdir(filename);
  await assert.rejects(sessions.pair({ url: f.url, code: f.code }), /could not be saved/);
  assert.equal(sessions.status().state, 'not-paired');
  assert.throws(() => sessions.current(), /access ended/);
  await rm(filename, { recursive: true });
  await sessions.pair({ url: f.url, code: f.code });
  const persisted = JSON.parse(await readFile(filename, 'utf8'));
  assert.equal(sessions.current().id, persisted.id);
  assert.equal(sessions.status().state, 'paired');
  const restored = new AionUiSessions(directory);
  f.scope.cancelWith(() => restored.cancelPair());
  f.scope.consumer({ label: 'restored session cleanup', close: () => restored.close() });
  await f.scope.start('restored session load', () => restored.load());
  assert.equal(restored.current().id, persisted.id);
});

test('failed replacement persistence preserves the old active binding and retries without publishing an unsaved candidate', async (t) => {
  const f = await setup(t);
  const binding = connected(await f.connect());
  const old = f.service.aionui.current().id;
  const access = f.service.aionui.access(old);
  const filename = path.join(f.directory, 'aionui-credentials.json');
  await rename(filename, filename + '.original');
  await mkdir(filename);
  await assert.rejects(f.service.aionui.pair({ url: f.url, code: f.code }), /could not be saved/);
  assert.equal(f.service.aionui.current().id, old);
  assert.equal(f.service.aionui.status().state, 'paired');
  assert.ok(!access.signal.aborted);
  assert.equal(f.service.adapters.get(binding.adapterId).status().state, 'ready');
  await rm(filename, { recursive: true });
  await rename(filename + '.original', filename);
  assert.equal(JSON.parse(await readFile(filename, 'utf8')).id, old);
  await f.service.aionui.pair({ url: f.url, code: f.code });
  const next = f.service.aionui.current().id;
  assert.notEqual(next, old);
  assert.ok(access.signal.aborted);
  assert.equal(JSON.parse(await readFile(filename, 'utf8')).id, next);
  const restored = new AionUiSessions(f.directory);
  f.scope.cancelWith(() => restored.cancelPair());
  f.scope.consumer({ label: 'restored session cleanup', close: () => restored.close() });
  await f.scope.start('restored session load', () => restored.load());
  assert.equal(restored.current().id, next);
});

test('cancelling pending owner approval preserves the old authorization and permits a fresh pairing', async (t) => {
  const f = await setup(t);
  const previous = f.service.aionui.current().id;
  const count = f.state.pairRequests;
  const release = f.holdPair();
  const pending = f.service.aionui.pair({ url: f.url, code: f.code });
  await until(() => f.state.pairRequests > count);
  f.service.aionui.cancelPair();
  await assert.rejects(pending);
  release();
  assert.equal(f.service.aionui.current().id, previous);
  await f.service.aionui.pair({ url: f.url, code: f.code });
  assert.notEqual(f.service.aionui.current().id, previous);
});

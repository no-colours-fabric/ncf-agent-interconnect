import test from 'node:test';
import assert from 'node:assert/strict';
import http, { type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OpenCodeAdapter } from '../desktop/core/adapters.js';
import { NodeService } from '../desktop/core/service.js';

async function fixture(t: test.TestContext) {
  const streams = new Set<ServerResponse>(),
    prompts: { parts: { type: string; text: string }[] }[] = [],
    sessionId = 'ses_test',
    state = { busy: false, reply: 204, statusReply: 200, reads: 0, wrongSession: false };
  const server = http.createServer(async (req, res) => {
    if (req.url === '/event') {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write(': connected\r\n\r\n');
      streams.add(res);
      req.once('close', () => streams.delete(res));
      return;
    }
    res.setHeader('content-type', 'application/json');
    if (req.url === '/session/' + sessionId && req.method === 'GET') {
      state.reads++;
      res.end(JSON.stringify({ id: state.wrongSession ? 'other' : sessionId }));
      return;
    }
    if (req.url === '/session/status') {
      res.writeHead(state.statusReply);
      res.end(JSON.stringify({ [sessionId]: { type: state.busy ? 'busy' : 'idle' } }));
      return;
    }
    if (req.url === '/session/' + sessionId + '/prompt_async') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      prompts.push(JSON.parse(Buffer.concat(chunks).toString()));
      res.writeHead(state.reply);
      res.end();
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  t.after(async () => {
    for (const res of streams) res.end();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  });
  return {
    streams,
    prompts,
    state,
    sessionId,
    baseUrl: 'http://127.0.0.1:' + (server.address() as { port: number }).port,
    emitIdle: () => {
      for (const res of streams)
        res.write(
          'data: ' +
            JSON.stringify({
              type: 'session.status',
              properties: { sessionID: sessionId, status: { type: 'idle' } },
            }) +
            '\r\n\r\n',
        );
    },
  };
}
const event = () => ({
  message: {
    fromNode: '11111111-1111-4111-8111-111111111111',
    fromNickname: 'Коллега',
    text: 'Текст поручения\nВторая строка',
    files: [],
  },
  nickname: 'Тема',
  messageId: randomUUID(),
  binding: {
    connectionId: randomUUID(),
    client: 'OpenCode',
    chatId: 'ses_test',
    adapterId: randomUUID(),
    generation: 1,
  },
});

test('official API adapter targets one exact session, queues busy work, and consumes push idle without polling', async (t) => {
  const f = await fixture(t);
  let idle = 0;
  const adapter = new OpenCodeAdapter(
    {
      id: randomUUID(),
      label: 'OpenCode',
      kind: 'opencode-http',
      baseUrl: f.baseUrl,
      sessionId: f.sessionId,
    },
    () => {},
    () => {
      idle++;
    },
  );
  t.after(() => adapter.stop());
  await adapter.start();
  assert.equal(adapter.status().state, 'ready');
  f.state.busy = true;
  assert.equal((await adapter.deliver(event())).state, 'waiting');
  assert.equal(f.prompts.length, 0);
  const end = Date.now() + 1000;
  while (!f.streams.size && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
  f.state.busy = false;
  f.emitIdle();
  const until = Date.now() + 1000;
  while (!idle && Date.now() < until) await new Promise((r) => setTimeout(r, 10));
  assert.equal(idle, 1);
  assert.equal(f.state.reads, 1);
  const input = event();
  assert.equal((await adapter.deliver(input)).state, 'admitted');
  const prompt = f.prompts[0].parts[0].text;
  assert.ok(prompt.includes('From: "Коллега"'));
  assert.ok(prompt.includes('Текст поручения'));
  assert.ok(!prompt.includes(input.binding.connectionId));
  assert.ok(!prompt.includes('agent_read'));
  assert.ok(!prompt.includes('permissions'));
  assert.ok(!prompt.includes('autoApprove'));
  assert.equal((await adapter.deliver({ ...event(), isCurrent: () => false })).state, 'revoked');
  assert.equal(f.prompts.length, 1);
});

test('transport recovery retries a failed status lookup but never repeats an uncertain admitted request', async (t) => {
  const f = await fixture(t),
    directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-adapter-reconnect-')),
    service = new NodeService(directory);
  await service.open();
  t.after(async () => {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  const adapterId = randomUUID();
  await service.installAdapter({
    id: adapterId,
    label: 'OpenCode',
    kind: 'opencode-http',
    baseUrl: f.baseUrl,
    sessionId: f.sessionId,
  });
  service.connect({ nickname: 'Получатель', client: 'OpenCode', chatId: f.sessionId, adapterId });
  const sender = service.connect({ nickname: 'Отправитель', client: 'MCP' });
  if (sender.status !== 'connected') throw new Error();
  const until = async (check: () => boolean) => {
    const deadline = Date.now() + 5000;
    while (!check()) {
      if (Date.now() > deadline) throw new Error('Transport did not recover');
      await new Promise((r) => setTimeout(r, 10));
    }
  };
  f.state.statusReply = 503;
  const first = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Получатель',
    text: 'После временной ошибки',
  });
  await until(() => service.store.dispatchState(first.id)?.state === 'failed');
  assert.equal(f.prompts.length, 0);
  f.state.statusReply = 200;
  await until(() => service.store.dispatchState(first.id)?.state === 'admitted');
  assert.equal(f.prompts.length, 1);
  await until(() => service.store.get(first.id, 'in')?.state === 'processed');
  f.state.reply = 503;
  const second = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Получатель',
    text: 'Приём неизвестен',
  });
  await until(() => service.store.dispatchState(second.id)?.state === 'uncertain');
  assert.equal(f.prompts.length, 2);
  assert.equal(service.store.get(second.id, 'in')?.state, 'ready');
  f.state.reply = 204;
  await until(() => service.adapters.get(adapterId).status().state === 'ready');
  assert.equal(service.store.dispatchState(second.id)?.state, 'uncertain');
  assert.equal(f.prompts.length, 2);
});

test('adapter refuses a different returned session and does not post prompts to it', async (t) => {
  const f = await fixture(t);
  f.state.wrongSession = true;
  const adapter = new OpenCodeAdapter(
    {
      id: randomUUID(),
      label: 'OpenCode',
      kind: 'opencode-http',
      baseUrl: f.baseUrl,
      sessionId: f.sessionId,
    },
    () => {},
    () => {},
  );
  await adapter.start();
  assert.equal(adapter.status().state, 'error');
  assert.equal((await adapter.deliver(event())).state, 'failed');
  assert.equal(f.prompts.length, 0);
  await adapter.stop();
});

test('server failure after posting is uncertain and revocation notifications use the old exact session', async (t) => {
  const f = await fixture(t),
    adapter = new OpenCodeAdapter(
      {
        id: randomUUID(),
        label: 'OpenCode',
        kind: 'opencode-http',
        baseUrl: f.baseUrl,
        sessionId: f.sessionId,
      },
      () => {},
      () => {},
    );
  t.after(() => adapter.stop());
  await adapter.start();
  f.state.reply = 503;
  assert.equal((await adapter.deliver(event())).state, 'uncertain');
  assert.equal(adapter.status().state, 'uncertain');
  await adapter.stop();
  f.state.reply = 204;
  const replacement = new OpenCodeAdapter(
    {
      id: randomUUID(),
      label: 'OpenCode',
      kind: 'opencode-http',
      baseUrl: f.baseUrl,
      sessionId: f.sessionId,
    },
    () => {},
    () => {},
  );
  await replacement.start();
  t.after(() => replacement.stop());
  const input = event();
  const systemEvent = {
    id: 1,
    connectionId: input.binding.connectionId,
    binding: input.binding,
    type: 'agent_moved' as const,
    nickname: input.nickname,
    text: 'Пользователь перевёл беседу в другой чат.',
    createdAt: new Date().toISOString(),
  };
  assert.equal(
    (
      await replacement.deliver({
        nickname: input.nickname,
        messageId: input.messageId,
        binding: input.binding,
        systemEvent,
      })
    ).state,
    'admitted',
  );
  assert.match(JSON.stringify(f.prompts[1]), /was moved to another chat/);
});

test('local delivery wakes the recipient adapter once with no peers and never targets the sender chat', async (t) => {
  const f = await fixture(t),
    directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-local-adapter-')),
    service = new NodeService(directory);
  await service.open();
  t.after(async () => {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  const adapterId = randomUUID();
  await service.installAdapter({
    id: adapterId,
    label: 'Получатель',
    kind: 'opencode-http',
    baseUrl: f.baseUrl,
    sessionId: f.sessionId,
  });
  const a = service.connect({ nickname: 'Отправитель', client: 'Cursor' }),
    b = service.connect({
      nickname: 'Получатель',
      client: 'OpenCode',
      chatId: f.sessionId,
      adapterId,
    });
  if (a.status !== 'connected' || b.status !== 'connected') throw new Error();
  const args = {
    id: randomUUID(),
    connectionId: a.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'ПОЛУЧАТЕЛЬ',
    text: 'Событие только локальному получателю',
  };
  await service.send(args);
  const deadline = Date.now() + 2000;
  while (service.store.dispatchState(args.id)?.state !== 'admitted') {
    if (Date.now() > deadline) throw new Error('Local adapter was not admitted');
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.equal(f.prompts.length, 1);
  const prompt = f.prompts[0].parts[0].text;
  assert.ok(prompt.includes('From: "Отправитель"'));
  assert.ok(prompt.includes(args.text));
  assert.ok(!prompt.includes(b.binding.connectionId));
  assert.ok(!prompt.includes(a.binding.connectionId));
  await service.send(args);
  assert.equal(f.prompts.length, 1);
  assert.deepEqual(service.snapshot().peers, []);
});

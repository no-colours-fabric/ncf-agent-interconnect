import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { NodeService } from '../desktop/core/service.js';
import { NCFAgentInterconnect } from '../desktop/integrations/opencode.js';
import type { ConnectResult } from '../desktop/core/agent-store.js';

async function until(check: () => boolean): Promise<void> {
  const end = Date.now() + 5000;
  while (!check()) {
    if (Date.now() > end) throw new Error('Automatic delivery timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}
async function fixture(t: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-auto-')),
    service = new NodeService(directory);
  await service.open();
  const client = new Client({ name: 'opencode', version: '1' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
      requestInit: { headers: { authorization: 'Bearer ' + service.settings.value.localToken } },
    }),
  );
  const workspace = path.join(directory, 'project'),
    known = new Set(['ses_first', 'ses_second', 'ses_third']);
  const unavailable = new Set<string>();
  const foreign = new Set<string>(),
    sessionReads = new Map<string, number>();
  const states: Record<string, { type: string }> = {},
    prompts: { id: string; text: string }[] = [];
  const sdk = {
    session: {
      get: async (options: Record<string, unknown>) => {
        const id = (options.path as { id: string }).id;
        sessionReads.set(id, (sessionReads.get(id) ?? 0) + 1);
        if (unavailable.has(id))
          return { error: { message: 'starting' }, response: new Response(null, { status: 503 }) };
        return known.has(id)
          ? { data: { id, directory: foreign.has(id) ? path.join(directory, 'other') : workspace } }
          : { error: { message: 'missing' }, response: new Response(null, { status: 404 }) };
      },
      status: async () => ({ data: states }),
      promptAsync: async (options: Record<string, unknown>) => {
        const id = (options.path as { id: string }).id,
          body = options.body as { parts: { text: string }[] };
        prompts.push({ id, text: body.parts[0].text });
        return { data: undefined };
      },
    },
  };
  const hosts: Awaited<ReturnType<typeof NCFAgentInterconnect>>[] = [];
  const startHost = async () => {
    const host = await NCFAgentInterconnect(
      { directory: workspace, client: sdk },
      { descriptor: path.join(directory, 'Integrations', 'node.json') },
    );
    hosts.push(host);
    return host;
  };
  let host = await startHost();
  const connect = async (
    sessionID: string,
    nickname: string,
    transfer: Record<string, unknown> = {},
  ) => {
    const output = { args: { nickname, ...transfer } as Record<string, unknown> };
    await host['tool.execute.before'](
      { tool: 'ncf_agent_interconnect_agent_connect', sessionID },
      output,
    );
    return client.callTool({ name: 'agent_connect', arguments: output.args });
  };
  t.after(async () => {
    for (const host of hosts) await host.event({ event: { type: 'server.instance.disposed' } });
    await client.close();
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  return {
    service,
    client,
    connect,
    states,
    prompts,
    known,
    unavailable,
    foreign,
    sessionReads,
    sdk,
    directory,
    get host() {
      return host;
    },
    async restartHost() {
      await host.event({ event: { type: 'server.instance.disposed' } });
      host = await startHost();
    },
  };
}
function connected(
  result: Record<string, unknown>,
): Extract<ConnectResult, { status: 'connected' }> {
  assert.ok(!result.isError, JSON.stringify(result));
  const body = result.structuredContent as ConnectResult;
  assert.equal(body.status, 'connected');
  if (body.status !== 'connected') throw new Error();
  return body;
}

test('one OpenCode integration connects any chat without user session settings and wakes only the exact recipient', async (t) => {
  const f = await fixture(t),
    a = connected(await f.connect('ses_first', 'Автор')),
    b = connected(await f.connect('ses_second', 'Проверяющий'));
  assert.equal(a.binding.client, 'OpenCode');
  assert.notEqual(a.binding.adapterId, b.binding.adapterId);
  const again = connected(await f.connect('ses_first', 'АВТОР'));
  assert.equal(again.binding.connectionId, a.binding.connectionId);
  f.states.ses_second = { type: 'busy' };
  const message = await f.service.send({
    connectionId: a.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'проверяющий',
    text: 'Доставить локально',
  });
  await until(() => f.service.store.dispatchState(message.id)?.state === 'waiting');
  assert.equal(f.prompts.length, 0);
  f.states.ses_second = { type: 'idle' };
  await f.host.event({
    event: {
      type: 'session.status',
      properties: { sessionID: 'ses_second', status: { type: 'idle' } },
    },
  });
  await until(() => f.service.store.dispatchState(message.id)?.state === 'admitted');
  assert.deepEqual(
    f.prompts.map((p) => p.id),
    ['ses_second'],
  );
  assert.equal(
    f.prompts[0].text,
    `**Incoming NCF Agent Interconnect**\nFrom: "Автор"\n\nДоставить локально\n\nReply-To: ${'r' + f.service.store.get(message.id, 'in')!.sequence.toString(36)}\nUse agent_send(connectionId, replyRef="${'r' + f.service.store.get(message.id, 'in')!.sequence.toString(36)}", text) to reply.`,
  );
  assert.ok(!f.prompts[0].text.includes(b.binding.connectionId));
  assert.ok(!f.prompts[0].text.includes(a.binding.connectionId));
  assert.deepEqual(f.service.snapshot().peers, []);
  assert.equal(
    JSON.parse(await readFile(path.join(f.directory, 'Integrations', 'node.json'), 'utf8')).url,
    f.service.snapshot().mcpUrl,
  );
  await assert.rejects(f.service.userCall('saveAdapter', {}), /Unknown interface operation/);
  const missingPlugin = await f.client.callTool({
    name: 'agent_connect',
    arguments: { nickname: 'Без плагина' },
  });
  assert.equal(missingPlugin.isError, true);
  assert.match(JSON.stringify(missingPlugin), /plugin/);
});

test('queued messages and attachment links arrive as complete chat messages without model tool calls or confirmations', async (t) => {
  const f = await fixture(t),
    a = connected(await f.connect('ses_first', 'Автор')),
    b = connected(await f.connect('ses_second', 'Получатель'));
  const filename = path.join(f.service.settings.value.exportRoots[0], 'план [версия 1].txt');
  await writeFile(filename, 'Содержимое плана');
  f.states.ses_second = { type: 'busy' };
  const first = await f.service.send({
    connectionId: a.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Получатель',
    text: 'Изучи план.\nПодготовь расчёт.',
    files: [filename],
  });
  const second = await f.service.send({
    connectionId: a.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Получатель',
    text: 'Сравни два варианта.',
  });
  await until(() => f.service.store.dispatchState(first.id)?.state === 'waiting');
  assert.equal(f.prompts.length, 0);
  // An old notification could have been admitted without delivering its body.
  // The unread message must still be delivered under the current contract.
  f.service.store.dispatch(first.id, b.binding.connectionId, 'admitted');
  f.states.ses_second = { type: 'idle' };
  await f.host.event({ event: { type: 'session.idle', properties: { sessionID: 'ses_second' } } });
  await until(
    () =>
      f.service.snapshot().agents.find((agent) => agent.nickname === 'Получатель')!.unread === 0,
  );
  assert.deepEqual(
    f.prompts.map((prompt) => prompt.id),
    ['ses_second', 'ses_second'],
  );
  assert.ok(
    f.prompts[0].text.startsWith(
      `**Incoming NCF Agent Interconnect**\nFrom: "Автор"\n\nИзучи план.\nПодготовь расчёт.\n\nAttachments:\n- [`,
    ),
  );
  const target = f.prompts[0].text.match(/\]\(<([^>]+)>\)/)![1];
  assert.equal(await readFile(target, 'utf8'), 'Содержимое плана');
  assert.equal(
    f.prompts[1].text,
    `**Incoming NCF Agent Interconnect**\nFrom: "Автор"\n\nСравни два варианта.\n\nReply-To: ${'r' + f.service.store.get(second.id, 'in')!.sequence.toString(36)}\nUse agent_send(connectionId, replyRef="${'r' + f.service.store.get(second.id, 'in')!.sequence.toString(36)}", text) to reply.`,
  );
  for (const prompt of f.prompts)
    for (const noise of [
      'agent_read',
      'message_ack',
      'untrusted_input',
      'Системное событие',
      b.binding.connectionId,
    ])
      assert.ok(!prompt.text.replace(/\]\(<[^>]+>\)/g, ']').includes(noise));
  assert.equal(f.service.store.get(first.id, 'out')!.state, 'processed');
  assert.equal(f.service.store.get(second.id, 'out')!.state, 'processed');
  await f.service.send({
    id: second.id,
    connectionId: a.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Получатель',
    text: 'Сравни два варианта.',
  });
  assert.equal(f.prompts.length, 2);
});

test('automatic transfer needs user consent, revokes the old chat and notifies its exact OpenCode session', async (t) => {
  const f = await fixture(t),
    old = connected(await f.connect('ses_first', 'Дизайнер'));
  const candidate = await f.connect('ses_third', 'ДИЗАЙНЕР'),
    pending = candidate.structuredContent as unknown as ConnectResult;
  assert.equal(pending.status, 'nickname_in_use');
  if (pending.status !== 'nickname_in_use') throw new Error();
  assert.equal(f.service.store.assertOwner(old.binding.connectionId).nickname, 'Дизайнер');
  assert.equal((await f.connect('ses_third', 'Дизайнер', { confirmTransfer: true })).isError, true);
  const moved = connected(
    await f.connect('ses_third', 'дизайнер', {
      connectionId: pending.connectionId,
      transferId: pending.transferId,
      confirmTransfer: true,
    }),
  );
  assert.equal(moved.binding.chatId, 'ses_third');
  assert.equal(moved.binding.generation, 2);
  assert.throws(() => f.service.store.assertOwner(old.binding.connectionId), /agent_moved/);
  await until(() => f.prompts.some((p) => p.text.includes('was moved to another chat')));
  assert.equal(
    f.prompts.find((p) => p.text.includes('was moved to another chat'))!.id,
    'ses_first',
  );
  const sender = f.service.connect({ nickname: 'Пользователь', client: 'MCP' });
  if (sender.status !== 'connected') throw new Error();
  const message = await f.service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Дизайнер',
    text: 'Новое задание',
  });
  await until(() => f.service.store.dispatchState(message.id)?.state === 'admitted');
  assert.equal(f.prompts.at(-1)!.id, 'ses_third');
});

test('OpenCode host and node restart restore the existing agent without reconfiguration or nickname transfer', async (t) => {
  const f = await fixture(t),
    binding = connected(await f.connect('ses_second', 'Воевода')).binding;
  await f.restartHost();
  const identity = f.service.snapshot().agents.find((a) => a.nickname === 'Воевода')!;
  assert.deepEqual(identity.binding, binding);
  const sender = f.service.connect({ nickname: 'Отправитель', client: 'MCP' });
  if (sender.status !== 'connected') throw new Error();
  const first = await f.service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Воевода',
    text: 'После перезапуска клиента',
  });
  await until(() => f.service.store.dispatchState(first.id)?.state === 'admitted');
  await f.service.stop();
  await f.service.start();
  const second = await f.service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Воевода',
    text: 'После перезапуска узла',
  });
  await until(() => f.service.store.dispatchState(second.id)?.state === 'admitted');
  assert.deepEqual(
    f.prompts.map((p) => p.id),
    ['ses_second', 'ses_second'],
  );
  assert.deepEqual(
    f.service.snapshot().agents.find((a) => a.nickname === 'Воевода')!.binding,
    binding,
  );
});

test('OpenCode startup retries temporarily unavailable saved chats without a tool call or UI activation', async (t) => {
  const f = await fixture(t),
    first = connected(await f.connect('ses_first', 'Поздний чат')).binding,
    second = connected(await f.connect('ses_second', 'Готовый чат')).binding;
  f.unavailable.add('ses_first');
  await f.restartHost();
  await until(() => f.service.adapters.get(second.adapterId).status().state === 'ready');
  assert.equal(f.service.adapters.get(first.adapterId).status().released, true);
  assert.equal(f.service.adapters.get(second.adapterId).status().state, 'ready');
  const sender = f.service.connect({ nickname: 'Источник', client: 'MCP' });
  if (sender.status !== 'connected') throw new Error();
  const message = await f.service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: f.service.settings.value.nodeId,
    recipientNickname: 'Поздний чат',
    text: 'Deliver after host initialization without opening this chat.',
  });
  assert.equal(f.prompts.length, 0);
  assert.equal(f.service.store.get(message.id, 'in')?.state, 'ready');
  // Only the host API becomes available. No connect tool, UI or idle event.
  f.unavailable.delete('ses_first');
  await until(() => f.service.store.get(message.id, 'in')?.state === 'processed');
  assert.deepEqual(
    f.prompts.map((prompt) => prompt.id),
    ['ses_first'],
  );
  assert.deepEqual(f.service.store.assertOwner(first.connectionId).binding, first);
  assert.deepEqual(f.service.store.assertOwner(second.connectionId).binding, second);
});

test('OpenCode plugin initialization does not wait for session APIs that require plugins to finish loading', async (t) => {
  const f = await fixture(t),
    binding = connected(await f.connect('ses_first', 'Сохранённый чат')).binding,
    get = f.sdk.session.get;
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.sdk.session.get = async (options) => {
    await ready;
    return get(options);
  };
  const restarting = f.restartHost().then(() => {
    release();
  });
  let timer: NodeJS.Timeout | undefined;
  const initialized = await Promise.race([
    restarting.then(() => true),
    new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), 500);
    }),
  ]);
  release();
  clearTimeout(timer);
  await restarting;
  assert.equal(
    initialized,
    true,
    'plugin loading must finish before waiting for the host session API',
  );
  await until(() => f.service.adapters.get(binding.adapterId).status().state === 'ready');
  assert.deepEqual(f.service.store.assertOwner(binding.connectionId).binding, binding);
});

test('OpenCode restoration skips deleted and foreign chats without retrying or redirecting them', async (t) => {
  const f = await fixture(t),
    missing = connected(await f.connect('ses_first', 'Удалённый чат')).binding,
    foreign = connected(await f.connect('ses_second', 'Другой проект')).binding,
    healthy = connected(await f.connect('ses_third', 'Готовый чат')).binding;
  f.known.delete('ses_first');
  f.foreign.add('ses_second');
  await f.restartHost();
  await until(() => f.service.adapters.get(healthy.adapterId).status().state === 'ready');
  const reads = new Map(f.sessionReads);
  await new Promise((resolve) => setTimeout(resolve, 1750));
  assert.deepEqual(f.sessionReads, reads);
  for (const binding of [missing, foreign]) {
    assert.equal(f.service.adapters.get(binding.adapterId).status().released, true);
    assert.deepEqual(f.service.store.assertOwner(binding.connectionId).binding, binding);
  }
  assert.equal(f.prompts.length, 0);
});

test('one failed OpenCode registration does not prevent other saved chats restoring', async (t) => {
  const f = await fixture(t),
    first = connected(await f.connect('ses_first', 'Первый')).binding,
    second = connected(await f.connect('ses_second', 'Второй')).binding,
    install = f.service.installAdapter.bind(f.service);
  let blocked = true;
  f.service.installAdapter = async (profile) => {
    if (blocked && profile.sessionId === 'ses_first') throw new Error('Test host is starting');
    await install(profile);
  };
  await f.restartHost();
  await until(() => f.service.adapters.get(second.adapterId).status().state === 'ready');
  assert.equal(f.service.adapters.get(first.adapterId).status().released, true);
  blocked = false;
  await until(() => f.service.adapters.get(first.adapterId).status().state === 'ready');
  for (const binding of [first, second])
    assert.deepEqual(f.service.store.assertOwner(binding.connectionId).binding, binding);
});

test('stopping an OpenCode plugin cancels pending startup recovery', async (t) => {
  const f = await fixture(t),
    binding = connected(await f.connect('ses_first', 'Остановленный')).binding;
  f.unavailable.add('ses_first');
  await f.restartHost();
  await until(() => (f.sessionReads.get('ses_first') ?? 0) >= 3);
  await f.host.event({ event: { type: 'server.instance.disposed' } });
  const reads = new Map(f.sessionReads);
  f.unavailable.delete('ses_first');
  await new Promise((resolve) => setTimeout(resolve, 1750));
  assert.deepEqual(f.sessionReads, reads);
  assert.equal(f.service.adapters.get(binding.adapterId).status().released, true);
  assert.equal(f.prompts.length, 0);
});

test('stopping during OpenCode host initialization prevents a late session registration', async (t) => {
  const f = await fixture(t),
    binding = connected(await f.connect('ses_first', 'Поздняя регистрация')).binding,
    get = f.sdk.session.get;
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    started = new Promise<void>((resolve) => {
      entered = resolve;
    });
  f.sdk.session.get = async (options) => {
    entered();
    await gate;
    return get(options);
  };
  await f.restartHost();
  await started;
  const stopping = f.host.event({ event: { type: 'server.instance.disposed' } });
  release();
  await stopping;
  assert.equal(f.service.adapters.get(binding.adapterId).status().released, true);
  assert.deepEqual(f.service.store.assertOwner(binding.connectionId).binding, binding);
  assert.equal(f.prompts.length, 0);
});

test('OpenCode context tickets are one-use and unavailable to unauthenticated browser requests', async (t) => {
  const f = await fixture(t),
    output = { args: { nickname: 'Тест' } as Record<string, unknown> };
  await f.host['tool.execute.before'](
    { tool: 'ncf_agent_interconnect_agent_connect', sessionID: 'ses_first' },
    output,
  );
  connected(await f.client.callTool({ name: 'agent_connect', arguments: output.args }));
  assert.equal(
    (await f.client.callTool({ name: 'agent_connect', arguments: output.args })).isError,
    true,
  );
  const endpoint = new URL('/integrations/opencode', f.service.snapshot().mcpUrl);
  assert.equal((await fetch(endpoint, { method: 'POST', body: '{}' })).status, 401);
  assert.equal(
    (
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + f.service.settings.value.localToken,
          origin: 'https://foreign.invalid',
        },
        body: '{}',
      })
    ).status,
    401,
  );
  await assert.rejects(
    f.host['tool.execute.before'](
      { tool: 'ncf_agent_interconnect_agent_connect', sessionID: 'ses_foreign' },
      { args: { nickname: 'Чужой' } },
    ),
    /unavailable/,
  );
});

test('a second live OpenCode runtime does not silently take an agent already connected to the same session', async (t) => {
  const f = await fixture(t),
    old = connected(await f.connect('ses_first', 'Дизайнер'));
  const workspace = path.join(f.directory, 'project');
  const sdk = {
    session: {
      get: async () => ({ data: { id: 'ses_first', directory: workspace } }),
      status: async () => ({ data: {} }),
      promptAsync: async () => ({}),
    },
  };
  const second = await NCFAgentInterconnect(
    { directory: workspace, client: sdk },
    { descriptor: path.join(f.directory, 'Integrations', 'node.json') },
  );
  t.after(() => second.event({ event: { type: 'server.instance.disposed' } }));
  const output = { args: { nickname: 'Дизайнер' } as Record<string, unknown> };
  await second['tool.execute.before'](
    { tool: 'ncf_agent_interconnect_agent_connect', sessionID: 'ses_first' },
    output,
  );
  const result = await f.client.callTool({ name: 'agent_connect', arguments: output.args });
  assert.equal((result.structuredContent as { status: string }).status, 'nickname_in_use');
  assert.deepEqual(f.service.store.assertOwner(old.binding.connectionId).binding, old.binding);
});

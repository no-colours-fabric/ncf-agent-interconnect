import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { EventEmitter, once } from 'node:events';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';

const binary = process.argv[2];
const inboxMode = process.argv[3] === '--ncf-inbox';
const pluginMode = process.argv[3] === '--plugin-queue';
const modifiers = process.argv.slice(4);
const holdReasoning = modifiers.includes('--hold-reasoning');
const maxBody = modifiers.includes('--max-body');
if (
  !binary ||
  !path.isAbsolute(binary) ||
  (pluginMode
    ? modifiers.length !== Number(holdReasoning) + Number(maxBody)
    : process.argv.length !== (inboxMode ? 4 : 3))
) {
  throw new Error(
    'Usage: node scripts/probe-codex-incoming.mjs /absolute/path/to/codex [--ncf-inbox | --plugin-queue [--hold-reasoning] [--max-body]]',
  );
}
let hub;
let sender;
let recipient;
let resumeTarget;
const root = await realpath(await mkdtemp(path.join(tmpdir(), 'ncf-codex-incoming-')));
const [home, profile, workspace] = ['home', 'profile', 'workspace'].map((name) =>
  path.join(root, name),
);
const clients = [];
let phase;
let environment;
let plugin;
if (pluginMode) {
  const { PluginQueueProbe } = await import('./fixtures/codex-plugin-queue.mjs');
  plugin = new PluginQueueProbe();
}
const tools = [
  {
    name: 'hold',
    annotations: { readOnlyHint: true, openWorldHint: false },
    description: 'Wait for the local fixture.',
    inputSchema: { type: 'object', properties: {} },
  },
];
const input = (text) => [{ type: 'text', text, text_elements: [] }];

function handleMcp(request, reply) {
  if (request.id === undefined) return reply.writeHead(202).end();
  let result;
  switch (request.method) {
    case 'initialize':
      result = {
        protocolVersion: '2025-06-18',
        serverInfo: { name: 'ncf_probe', version: '1' },
        capabilities: { tools: {} },
      };
      break;
    case 'tools/list':
      result = { tools };
      break;
    case 'tools/call':
      assert.equal(request.params.name, 'hold');
      assert.ok(phase?.mode === 'tool' || phase?.mode === 'inbox');
      phase.started.resolve();
      return phase.release.promise.then(() =>
        reply.writeHead(200, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: request.id,
            result: { content: [{ type: 'text', text: 'Tool completed.' }] },
          }),
        ),
      );
    default:
      return reply.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32601, message: 'Unsupported fixture method' },
        }),
      );
  }
  reply
    .writeHead(200, { 'Content-Type': 'application/json' })
    .end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
}

async function handleModel(request, reply) {
  const active = phase;
  const initial = active && !active.requests.length;
  active?.requests.push(request);
  if (active && !initial) active.modelAt = performance.now();
  if (active?.mode === 'plugin' && !initial) active.nextModel.resolve(active.modelAt);
  const response = {
    id: 'resp_' + randomUUID(),
    object: 'response',
    model: 'gpt-5.1',
    output: [],
    created_at: Math.floor(Date.now() / 1000),
    status: 'in_progress',
  };
  let sequence = 0;
  reply.writeHead(200, { 'Content-Type': 'text/event-stream' });
  const emit = (type, fields) =>
    reply.write(
      'event: ' +
        type +
        '\ndata: ' +
        JSON.stringify({ type, sequence_number: sequence++, ...fields }) +
        '\n\n',
    );
  emit('response.created', { response });
  if (active?.mode === 'plugin') {
    // Keep reasoning across one model boundary while the plugin signal and native queue are active.
    const item = { type: 'reasoning', id: 'rs_' + randomUUID(), summary: [] };
    emit('response.output_item.added', { output_index: 0, item });
    const delta = () =>
      emit('response.reasoning_summary_text.delta', {
        output_index: 0,
        item_id: item.id,
        summary_index: 0,
        delta: '.',
      });
    delta();
    const timer = setInterval(() => {
      if (!reply.destroyed) delta();
    }, 150);
    try {
      if (initial) await active.boundary.promise;
      else await active.release.promise;
    } finally {
      clearInterval(timer);
    }
    if (reply.destroyed) return;
    const done = { ...item, summary: [{ type: 'summary_text', text: 'Fixture.' }] };
    emit('response.output_item.done', { output_index: 0, item: done });
    response.output = [done];
  } else if (initial && active.mode === 'stream') {
    const item = {
      type: 'message',
      role: 'assistant',
      id: 'msg_fixture',
      content: [],
      status: 'in_progress',
    };
    const part = { type: 'output_text', text: '', annotations: [] };
    emit('response.output_item.added', { output_index: 0, item });
    emit('response.content_part.added', {
      output_index: 0,
      content_index: 0,
      item_id: item.id,
      part,
    });
    emit('response.output_text.delta', {
      output_index: 0,
      content_index: 0,
      item_id: item.id,
      delta: 'Streaming',
    });
    // Keep producing real deltas until the observation ends or the host preempts the stream.
    let output = 'Streaming';
    const timer = setInterval(() => {
      if (!reply.destroyed) {
        output += '.';
        emit('response.output_text.delta', {
          output_index: 0,
          content_index: 0,
          item_id: item.id,
          delta: '.',
        });
      }
    }, 150);
    try {
      await active.release.promise;
    } finally {
      clearInterval(timer);
    }
    if (reply.destroyed) return;
    const final = { ...item, status: 'completed', content: [{ ...part, text: output }] };
    emit('response.output_item.done', { output_index: 0, item: final });
    response.output = [final];
  } else if (initial) {
    const item = {
      type: 'function_call',
      id: 'fc_fixture',
      call_id: 'call_fixture',
      name: 'hold',
      namespace: 'mcp__ncf_probe',
      arguments: '{}',
      status: 'completed',
    };
    emit('response.output_item.done', { output_index: 0, item });
    response.output = [item];
    if (active.mode === 'inbox') {
      const read = {
        ...item,
        id: 'fc_inbox',
        call_id: 'call_inbox',
        namespace: 'mcp__ncf_agent_interconnect_inbox',
        name: 'agent_read',
        arguments: JSON.stringify({ connectionId: recipient.binding.connectionId, waitMs: 10000 }),
      };
      response.output.push(read);
      emit('response.output_item.done', { output_index: 1, item: read });
    }
  }
  emit('response.completed', { response: { ...response, status: 'completed' } });
  reply.end();
}

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'POST' || !['/mcp', '/v1/responses', plugin?.route].includes(req.url))
      return res.writeHead(404).end();
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (plugin && req.url === plugin.route) plugin.handle(request, res);
    else if (req.url === '/mcp') await handleMcp(request, res);
    else await handleModel(request, res);
  } catch (error) {
    if (!res.headersSent) res.writeHead(500);
    res.end();
    console.error('Fixture error:', error.message);
  }
});
server.on('connect', (_req, socket) => socket.destroy());

function startClient() {
  const child = spawn(binary, ['app-server', '--stdio'], {
    cwd: workspace,
    env: environment,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const changes = new EventEmitter();
  const history = [];
  let next = 0;
  let closed = false;
  let diagnostics = '';
  child.stderr.setEncoding('utf8').on('data', (s) => {
    diagnostics = (diagnostics + s).slice(-1024);
  });
  const exit = new Promise((resolve) => {
    child.once('error', (error) => {
      diagnostics = error.message;
    });
    child.once('close', () => {
      closed = true;
      changes.emit('change');
      resolve();
    });
  });
  clients.push({ child, exit });
  createInterface({ input: child.stdout }).on('line', (line) => {
    const message = JSON.parse(line);
    message.observedAt = performance.now();
    history.push(message);
    changes.emit('change');
  });
  async function wait(predicate) {
    const signal = AbortSignal.timeout(15000);
    for (;;) {
      const found = history.find(predicate);
      if (found) return found;
      if (closed) throw new Error('Test App Server exited: ' + diagnostics);
      await once(changes, 'change', { signal });
    }
  }
  async function request(method, params, allowError = false) {
    const id = ++next;
    child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    const reply = await wait((event) => event.id === id);
    if (reply.error && !allowError) throw new Error(method + ': ' + JSON.stringify(reply.error));
    return reply;
  }
  async function initialize() {
    await request('initialize', {
      clientInfo: { name: 'ncf_incoming_probe', version: '1' },
      capabilities: { experimentalApi: true },
    });
    child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
  }
  return { request, wait, initialize, history };
}

function includesText(value, text) {
  if (typeof value === 'string') return value === text;
  return (
    value && typeof value === 'object' && Object.values(value).some((v) => includesText(v, text))
  );
}

async function measure(owner, sidecar, tid, other, mode) {
  const id = randomUUID();
  const text =
    'Incoming NCF Agent Interconnect\nID ' +
    id +
    '\n' +
    'Русский текст 東京 abcdefghijklmnop\n'.repeat(216) +
    '\nAttachments\n- fixture.txt\nReply-To fixture\nEnd ' +
    id;
  phase = {
    mode,
    started: Promise.withResolvers(),
    release: Promise.withResolvers(),
    requests: [],
  };
  const turn = (
    await owner.request('turn/start', { threadId: tid, input: input('Exercise ' + mode) })
  ).result.turn.id;
  if (mode === 'stream')
    await owner.wait((e) => e.method === 'item/agentMessage/delta' && e.params.turnId === turn);
  else
    await Promise.race([
      phase.started.promise,
      delay(15000, undefined, { ref: false }).then(() => {
        const toolItems = owner.history
          .filter((e) => e.params?.turnId === turn && e.method === 'item/completed')
          .map((e) => ({
            type: e.params.item.type,
            tool: e.params.item.tool,
            error: e.params.item.error,
          }));
        const namespace = phase?.requests[0]?.tools
          ?.filter((t) => JSON.stringify(t).includes('mcp__ncf_probe'))
          .map((t) => t.name);
        throw new Error('Test tool did not start: ' + JSON.stringify({ toolItems, namespace }));
      }),
    ]);
  const params = {
    threadId: tid,
    expectedTurnId: turn,
    clientUserMessageId: id,
    input: input(text),
  };
  let start = performance.now();
  const otherConnection = await sidecar.request('turn/steer', params, true);
  // If the external client succeeds, do not replay its message through the owner.
  if (otherConnection.error) {
    start = performance.now();
    assert.equal((await owner.request('turn/steer', params)).result.turnId, turn);
  } else {
    assert.equal(otherConnection.result.turnId, turn);
  }
  const ownerAckMs = otherConnection.error ? Math.round(performance.now() - start) : null;
  const matches = (item) =>
    item?.type === 'userMessage' && item.clientId === id && includesText(item.content, text);
  const count = async (target) =>
    (await owner.request('thread/items/list', { threadId: target, limit: 100 })).result.data.filter(
      (row) => matches(row.item),
    ).length;
  const completed = (e) => e.method === 'turn/completed' && e.params.turn.id === turn;
  await delay(2000);
  const liveEvent = owner.history.find(
    (e) =>
      e.method === 'item/started' &&
      e.params.threadId === tid &&
      e.params.turnId === turn &&
      matches(e.params.item),
  );
  const historyDuringActivity = await count(tid);
  phase.release.resolve();
  await owner.wait(completed);
  const itemIndex = owner.history.findIndex(
    (e) => e.method === 'item/started' && e.params.turnId === turn && matches(e.params.item),
  );
  const historyAfter = await count(tid);
  const foreignItems = await count(other);
  const modelReceived = phase.requests.some((req) => includesText(req.input, text));
  const result = {
    mode,
    bytes: Buffer.byteLength(text),
    externalError: otherConnection.error ?? null,
    ownerAckMs,
    liveItem: Boolean(liveEvent),
    liveMs: liveEvent ? Math.round(liveEvent.observedAt - start) : null,
    historyDuringActivity,
    historyAfter,
    foreignItems,
    modelReceived,
    sameTurn: itemIndex >= 0 && itemIndex < owner.history.findIndex(completed),
  };
  phase = undefined;
  return result;
}

function containsBody(value, body) {
  if (typeof value === 'string') {
    if (value.includes(body)) return true;
    // The runtime may serialize content blocks into a function_call_output string.
    if (!value.startsWith('[') && !value.startsWith('{')) return false;
    try {
      return containsBody(JSON.parse(value), body);
    } catch {
      return false;
    }
  }
  return (
    value != null &&
    typeof value === 'object' &&
    Object.values(value).some((entry) => containsBody(entry, body))
  );
}

async function measureInbox(owner, target, other, text) {
  phase = {
    mode: 'inbox',
    started: Promise.withResolvers(),
    armed: Promise.withResolvers(),
    release: Promise.withResolvers(),
    requests: [],
  };
  const turn = (
    await owner.request('turn/start', {
      threadId: target,
      input: input('Receive during independent work.'),
    })
  ).result.turn.id;
  await Promise.race([
    Promise.all([phase.started.promise, phase.armed.promise]),
    delay(12000, undefined, { ref: false }).then(() => {
      throw new Error('The two test tools did not overlap');
    }),
  ]);
  const started = performance.now();
  const sent = await hub.send({
    connectionId: sender.binding.connectionId,
    recipientNode: hub.settings.value.nodeId,
    recipientNickname: 'Recipient',
    text,
  });
  assert.ok(sent.accepted);
  const event = await owner.wait(
    (e) =>
      e.method === 'item/completed' &&
      e.params.threadId === target &&
      e.params.turnId === turn &&
      e.params.item.tool === 'agent_read',
  );
  const item = event.params.item;
  assert.equal(item.status, 'completed');
  assert.ok(
    containsBody(item.result, text),
    'Full body missing from live item during independent tool',
  );
  assert.ok(containsBody(item.result, sent.id), 'Envelope ID missing from live item');
  const itemMs = Math.round(event.observedAt - started);
  phase.release.resolve();
  await owner.wait((e) => e.method === 'turn/completed' && e.params.turn.id === turn);
  const entries = async (id) =>
    (await owner.request('thread/items/list', { threadId: id, limit: 100 })).result.data.filter(
      (row) => containsBody(row.item.result, text),
    ).length;
  const savedFullItems = await entries(target);
  if (Buffer.byteLength(text) < 64 * 1024) assert.equal(savedFullItems, 1);
  else assert.ok(savedFullItems <= 1);
  assert.equal(await entries(other), 0);
  assert.ok(
    phase.requests.slice(1).some((req) => containsBody(req.input, text)),
    'Next model input lost content',
  );
  assert.equal(hub.store.get(sent.id, 'out').state, 'processed');
  assert.equal(hub.store.get(sent.id, 'in').envelope.text, text);
  console.log(
    JSON.stringify({
      mode: 'inbox',
      bytes: Buffer.byteLength(text),
      itemMs,
      modelMs: Math.round(phase.modelAt - started),
      savedFullItems,
      otherItems: 0,
    }),
  );
  phase = undefined;
}

try {
  await Promise.all([home, profile, workspace].map((p) => mkdir(p, { recursive: true })));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = 'http://127.0.0.1:' + server.address().port;
  environment = {
    HOME: home,
    USERPROFILE: home,
    APPDATA: home,
    LOCALAPPDATA: home,
    CODEX_HOME: profile,
    XDG_CONFIG_HOME: home,
    XDG_DATA_HOME: home,
    XDG_CACHE_HOME: home,
    TMPDIR: root,
    TEMP: root,
    TMP: root,
    PATH: process.env.PATH ?? '',
    LANG: 'en_US.UTF-8',
    FIXTURE_KEY: 'fixture-only',
    NO_PROXY: '127.0.0.1,localhost',
    no_proxy: '127.0.0.1,localhost',
  };
  if (process.env.SystemRoot) environment.SystemRoot = process.env.SystemRoot;
  for (const key of [
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'ALL_PROXY',
    'http_proxy',
    'https_proxy',
    'all_proxy',
  ])
    environment[key] = url;
  let inboxConfiguration = '';
  if (inboxMode || pluginMode) {
    const { NodeService } = await import('../build/core/service.js');
    const { mcpInstructions } = await import('../build/core/instructions.js');
    hub = new NodeService(path.join(root, 'hub'), {
      codexSockets: () => [],
      wakeCodexChat: async (bound, current) => {
        if (current() && resumeTarget) await resumeTarget(bound.threadId);
      },
    });
    await hub.settings.load();
    hub.settings.value.peerPort = 0;
    hub.settings.value.mcpPort = 0;
    await hub.settings.save();
    await hub.open();
    sender = hub.connect({ client: 'MCP', nickname: 'Sender' });
    // Observe the real MCP handler before sending. The normal HTTP response records receipt.
    if (inboxMode) {
      const read = hub.readOnArrival.bind(hub);
      hub.readOnArrival = (...args) => {
        const waiting = read(...args);
        phase?.armed?.resolve();
        return waiting;
      };
    }
    inboxConfiguration = mcpInstructions(
      hub.snapshot().mcpUrl,
      hub.settings.value.localToken,
      'codex',
      '',
    ).configuration;
  }
  await writeFile(
    path.join(profile, 'config.toml'),
    [
      'model_provider = "fixture"',
      'model = "gpt-5.1"',
      'approval_policy = "never"',
      'sandbox_mode = "read-only"',
      '[model_providers.fixture]',
      'name = "Local test fixture"',
      'base_url = "' + url + '/v1"',
      'env_key = "FIXTURE_KEY"',
      'wire_api = "responses"',
      'supports_websockets = false',
      'request_max_retries = 0',
      'stream_max_retries = 0',
      inboxConfiguration,
      // The last generated section is the restricted inbox in this disposable profile.
      ...(inboxMode ? ['tools.agent_read.approval_mode = "approve"'] : []),
      '[mcp_servers.ncf_probe]',
      'url = "' + url + '/mcp"',
      'required = true',
      '[projects.' + JSON.stringify(workspace) + ']',
      'trust_level = "trusted"',
      '[analytics]',
      'enabled = false',
      '[feedback]',
      'enabled = false',
      '',
    ].join('\n'),
  );
  if (plugin) await plugin.install({ binary, root, workspace, environment, url });
  const owner = startClient(),
    sidecar = inboxMode || pluginMode ? null : startClient();
  await Promise.all([owner.initialize(), sidecar?.initialize()]);
  if (plugin) await plugin.trust(owner, root, workspace);
  const startThread = async () =>
    (await owner.request('thread/start', { cwd: workspace })).result.thread.id;
  const other = await startThread();
  const seed = (
    await owner.request('turn/start', {
      threadId: other,
      input: input('Isolated negative control.'),
    })
  ).result.turn.id;
  await owner.wait((e) => e.method === 'turn/completed' && e.params.turn.id === seed);
  const tid = await startThread();
  if (inboxMode || pluginMode) {
    // Flush a real transcript before binding the exact profile through the stock adapter.
    const seedTarget = (
      await owner.request('turn/start', { threadId: tid, input: input('Seed target history.') })
    ).result.turn.id;
    await owner.wait((e) => e.method === 'turn/completed' && e.params.turn.id === seedTarget);
    const { codexQueueLocator } = await import('../build/core/codex-queue.js');
    const adapterId = randomUUID();
    await hub.installAdapter({
      kind: 'codex-desktop',
      id: adapterId,
      threadId: tid,
      label: 'Fixture',
      codexQueue: true,
      socket: codexQueueLocator(profile),
    });
    assert.equal(
      hub.adapters.get(adapterId).status().state,
      'ready',
      'The installed package could not verify the exact chat',
    );
    recipient = hub.connect({ client: 'Codex', nickname: 'Recipient', chatId: tid, adapterId });
  }
  if (plugin) {
    phase = {
      mode: 'plugin',
      boundary: Promise.withResolvers(),
      nextModel: Promise.withResolvers(),
      release: Promise.withResolvers(),
      requests: [],
    };
    const result = await plugin.measure({
      owner,
      hub,
      sender,
      tid,
      other,
      phase,
      containsBody,
      holdReasoning,
      maxBody,
    });
    console.log(JSON.stringify(result));
    if (!result.withinDeadline) process.exitCode = 2;
  } else if (inboxMode) {
    const id = randomUUID();
    for (const text of [
      id + '\n' + 'Русский текст 東京\n'.repeat(400) + id,
      id + '界'.repeat(65_536 - id.length * 2) + id,
    ]) {
      await measureInbox(owner, tid, other, text);
    }
    clients[0].child.stdin.end();
    await clients[0].exit;
    const restarted = startClient();
    await restarted.initialize();
    let wake;
    resumeTarget = (target) => {
      assert.equal(target, tid);
      // Simulate the desktop's native deep-link handler with the public host call.
      return (wake ??= restarted.request('thread/resume', { threadId: target }));
    };
    const body = 'Restart ' + id + '\n' + '界'.repeat(65000) + id;
    const start = performance.now();
    const sent = await hub.send({
      connectionId: sender.binding.connectionId,
      recipientNode: hub.settings.value.nodeId,
      recipientNickname: 'Recipient',
      text: body,
    });
    assert.ok(sent.accepted);
    const matches = (item) => item?.type === 'userMessage' && containsBody(item.content, body);
    const event = await restarted.wait(
      (e) => e.method === 'item/started' && e.params.threadId === tid && matches(e.params.item),
    );
    await restarted.wait(
      (e) => e.method === 'turn/completed' && e.params.turn.id === event.params.turnId,
    );
    const entries = async (target) =>
      (
        await restarted.request('thread/items/list', { threadId: target, limit: 100 })
      ).result.data.filter((r) => matches(r.item)).length;
    assert.equal(await entries(tid), 1);
    assert.equal(await entries(other), 0);
    assert.equal(
      (await restarted.request('thread/queue/list', { threadId: tid, limit: 10 })).result.data
        .length,
      0,
    );
    await Promise.race([
      (async () => {
        while (hub.store.get(sent.id, 'out').state !== 'processed') await once(hub, 'change');
      })(),
      delay(8000, undefined, { ref: false }).then(() => {
        throw new Error('Native receipt missing');
      }),
    ]);
    console.log(
      JSON.stringify({
        mode: 'restart',
        hostResume: 'fixture',
        bytes: Buffer.byteLength(body),
        itemMs: Math.round(event.observedAt - start),
        savedFullItems: 1,
        otherItems: 0,
        queued: 0,
      }),
    );
  } else
    for (const mode of ['stream', 'tool']) {
      const result = await measure(owner, sidecar, tid, other, mode);
      console.log(JSON.stringify(result));
      assert.equal(result.foreignItems, 0, 'Message crossed chat boundaries');
      assert.equal(result.historyAfter, 1, 'Expected the full message exactly once');
      assert.ok(
        result.modelReceived && result.sameTurn,
        'Owner did not deliver to the active turn',
      );
      if (result.externalError || !result.liveItem || result.historyDuringActivity !== 1)
        process.exitCode = 2;
    }
} finally {
  phase?.boundary?.resolve();
  phase?.release.resolve();
  plugin?.close();
  for (const { child } of clients) child.stdin.end();
  const exited = Promise.all(clients.map((c) => c.exit));
  await Promise.race([exited, delay(2000, undefined, { ref: false })]);
  for (const { child } of clients)
    if (child.exitCode === null && child.signalCode === null) child.kill();
  await exited;
  server.closeAllConnections();
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  if (hub) await hub.close();
  await rm(root, { recursive: true, force: true });
}

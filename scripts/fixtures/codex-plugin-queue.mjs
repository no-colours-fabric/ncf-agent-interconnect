import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const name = 'ncf.message';
const ext = 'io.modelcontextprotocol/events';
const eventServer = 'ncf_event_probe';
const manifest = {
  name: 'ncf-queue-probe',
  version: '0.0.1',
  description: 'Isolated native queue and MCP Events acceptance fixture',
  mcpServers: './.mcp.json',
};
const pluginId = manifest.name + '@ncf-fixture';
const schema = {
  type: 'object',
  properties: { threadId: { type: 'string' } },
  required: ['threadId'],
};
const occurrence = {
  type: 'object',
  properties: { ...schema.properties, text: { type: 'string' } },
  required: ['threadId', 'text'],
};
const descriptor = { name, inputSchema: schema, payloadSchema: occurrence, delivery: ['push'] };
const capabilities = { tools: {}, extensions: { [ext]: {} } };
const serverInfo = { name: eventServer, version: '1' };
const execute = promisify(execFile);
const writeJson = (file, data) => writeFile(file, JSON.stringify(data));
const toolText = (text) => ({ content: [{ type: 'text', text }] });

function within(promise, reason) {
  return Promise.race([
    promise,
    delay(15000, undefined, { ref: false }).then(() => {
      throw new Error(reason);
    }),
  ]);
}

export class PluginQueueProbe {
  route = '/events-fixture/' + randomUUID();
  armed = Promise.withResolvers();
  received = Promise.withResolvers();
  command = '"' + process.execPath + '" "${PLUGIN_ROOT}/hooks/wait.mjs"';

  async install({ binary, root, workspace, environment, url }) {
    const market = path.join(root, 'market');
    const plugin = path.join(market, 'plugins', manifest.name);
    const catalog = path.join(market, '.agents/plugins');
    for (const dir of [catalog, path.join(plugin, '.codex-plugin'), path.join(plugin, 'hooks')])
      await mkdir(dir, { recursive: true });
    await writeJson(path.join(catalog, 'marketplace.json'), {
      name: 'ncf-fixture',
      plugins: [
        {
          name: manifest.name,
          source: { source: 'local', path: './plugins/' + manifest.name },
          policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
          category: 'Developer Tools',
        },
      ],
    });
    await writeJson(path.join(plugin, '.codex-plugin/plugin.json'), manifest);
    const endpoint = url + this.route;
    await writeJson(path.join(plugin, '.mcp.json'), {
      mcpServers: { [eventServer]: { url: endpoint } },
    });
    const action = { type: 'command', command: this.command, timeout: 24 };
    await writeJson(path.join(plugin, 'hooks/hooks.json'), {
      hooks: {
        UserPromptSubmit: [{ hooks: [{ ...action, async: true }] }],
        Stop: [{ hooks: [action] }],
      },
    });
    await writeJson(path.join(plugin, 'hooks/endpoint.json'), endpoint);
    await copyFile(
      new URL('./codex-queue-hook.mjs', import.meta.url),
      path.join(plugin, 'hooks/wait.mjs'),
    );
    for (const args of [
      ['plugin', 'marketplace', 'add', market, '--json'],
      ['plugin', 'add', pluginId, '--json'],
    ])
      await execute(binary, args, { env: environment, cwd: workspace, timeout: 25000 });
  }

  async trust(owner, root, workspace) {
    const list = async () =>
      (await owner.request('hooks/list', { cwds: [workspace] })).result.data
        .flatMap((r) => r.hooks)
        .filter((h) => h.pluginId === pluginId);
    const hooks = await list();
    assert.equal(hooks.length, 2, 'Expected both hooks from the installed fixture');
    const entries = {};
    for (const h of hooks) {
      assert.equal(h.source, 'plugin');
      assert(h.command === this.command || h.command.endsWith('/hooks/wait.mjs"'));
      assert(h.sourcePath.startsWith(root + path.sep));
      entries[h.key] = { trusted_hash: h.currentHash };
    }
    await owner.request('config/batchWrite', {
      edits: [{ keyPath: 'hooks.state', value: entries, mergeStrategy: 'upsert' }],
      reloadUserConfig: true,
    });
    assert((await list()).every((h) => h.trustStatus === 'trusted'));
  }

  handle(request, reply) {
    const { id, method, params = {} } = request;
    if (id === undefined) return reply.writeHead(202).end();
    const send = (packet) => {
      if (
        packet.result &&
        params._meta?.['io.modelcontextprotocol/protocolVersion'] === '2026-07-28'
      )
        packet.result.resultType = 'complete';
      return reply
        .writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify({ jsonrpc: '2.0', id, ...packet }));
    };
    const args = params.arguments ?? {};
    switch (method) {
      case 'initialize':
        return send({ result: { protocolVersion: '2025-06-18', serverInfo, capabilities } });
      case 'server/discover':
        return send({ result: { supportedVersions: ['2026-07-28'], serverInfo, capabilities } });
      case 'tools/list':
        return send({
          result: {
            tools: [
              {
                name: 'test_read_pending',
                description: 'Read the event body for the current fixture turn',
                inputSchema: schema,
              },
              {
                name: 'test_state',
                description: 'Check the addressed fixture thread',
                inputSchema: schema,
              },
              {
                name: 'test_hook_received',
                description: 'Record event arrival for this fixture',
                inputSchema: {
                  ...occurrence,
                  properties: { ...occurrence.properties, eventId: { type: 'string' } },
                  required: [...occurrence.required, 'eventId'],
                },
              },
            ],
          },
        });
      case 'tools/call':
        if (params.name === 'test_read_pending' && args.threadId === this.target)
          return send({ result: toolText(this.pendingText ?? '') });
        if (params.name === 'test_state')
          return send({ result: toolText(this.target === args.threadId ? 'armed' : 'idle') });
        if (
          params.name === 'test_hook_received' &&
          this.target === args.threadId &&
          args.eventId === this.messageId &&
          args.text === this.body
        ) {
          this.received.resolve(performance.now());
          return send({ result: toolText('received') });
        }
        break;
      case 'events/list':
        return send({ result: { events: [descriptor] } });
      case 'events/stream':
        if (params.name !== name || args.threadId !== this.target || !this.target || this.stream)
          break;
        this.stream = { reply, id };
        reply.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
        this.notify('active', { cursor: null, truncated: false, heartbeatMs: 15000 });
        this.armed.resolve();
        return;
    }
    return send({ error: { code: -32602, message: 'Unsupported fixture request or target' } });
  }

  notify(suffix, params) {
    const { id, reply } = this.stream;
    const data = {
      jsonrpc: '2.0',
      method: 'notifications/events/' + suffix,
      params: { ...params, _meta: { 'io.modelcontextprotocol/subscriptionId': id } },
    };
    reply.write('event: message\ndata: ' + JSON.stringify(data) + '\n\n');
  }

  close() {
    this.stream?.reply.end();
  }

  async measure({ owner, hub, sender, tid, other, phase, containsBody, holdReasoning, maxBody }) {
    this.target = tid;
    this.messageId = randomUUID();
    const prefix = 'NCF ' + this.messageId + '\n';
    const suffix = 'End ' + this.messageId;
    const middle = 'Полное сообщение 東京\n'.repeat(24);
    this.body =
      prefix +
      (maxBody ? middle.padEnd(65_536 - prefix.length - suffix.length, '界') : middle) +
      suffix;
    const status = (await owner.request('mcpServerStatus/list', { threadId: tid })).result.data;
    const selected = status.find((s) => Object.hasOwn(s.tools, 'test_state'));
    assert(selected, 'Fixture MCP server was not discovered');
    const reach = await owner.request('mcpServer/tool/call', {
      threadId: tid,
      server: selected.name,
      tool: 'test_state',
      arguments: { threadId: tid },
    });
    assert.equal(reach.result.content[0].text, 'armed');
    const stream = await owner.request(
      'mcpServer/event/stream/start',
      {
        threadId: tid,
        server: selected.name,
        name,
        arguments: { threadId: tid },
        subscriptionId: 'fixture-stream',
      },
      true,
    );
    const client = new Client({ name: 'ncf_fixture_sender', version: '1' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(hub.snapshot().mcpUrl), {
        requestInit: {
          headers: { Authorization: 'Bearer ' + hub.settings.value.localToken },
        },
      }),
    );
    // Emit only after NCF has persisted the addressed incoming envelope.
    const publishSaved = () => {
      if (!this.stream || this.pendingText !== undefined) return;
      const saved = hub.store.get(this.messageId, 'in');
      if (!saved) return;
      this.pendingText = saved.envelope.text;
      this.notify('event', {
        name,
        eventId: saved.envelope.id,
        cursor: saved.envelope.id,
        timestamp: new Date().toISOString(),
        data: { threadId: tid, text: this.pendingText },
      });
    };
    hub.on('change', publishSaved);
    let boundaryTimer;
    try {
      const turn = (
        await owner.request('turn/start', {
          threadId: tid,
          input: [
            {
              type: 'text',
              text: 'Reason across a model boundary in this fixture.',
              text_elements: [],
            },
          ],
        })
      ).result.turn.id;
      await within(
        Promise.all([
          this.armed.promise,
          owner.wait(
            (e) => e.method === 'item/reasoning/summaryTextDelta' && e.params.turnId === turn,
          ),
        ]),
        'Plugin did not subscribe during reasoning',
      );
      const start = performance.now();
      const sent = await client.callTool({
        name: 'agent_send',
        arguments: {
          connectionId: sender.binding.connectionId,
          recipientNode: hub.settings.value.nodeId,
          recipientNickname: 'Recipient',
          id: this.messageId,
          text: this.body,
        },
      });
      assert(!sent.isError, 'NCF MCP send failed');
      const saved = hub.store.get(this.messageId, 'in');
      assert.equal(saved.envelope.text, this.body);
      const hookMs = Math.round(
        (await within(this.received.promise, 'Plugin hook did not receive this event')) - start,
      );
      boundaryTimer = setTimeout(phase.boundary.resolve, holdReasoning ? 6500 : 0);
      await delay(Math.max(0, 5100 - (performance.now() - start)));
      const matches = (i) => i?.type === 'userMessage' && containsBody(i.content, this.body);
      const observed = owner.history.find(
        (e) =>
          e.method === 'item/started' &&
          e.params.threadId === tid &&
          e.params.turnId === turn &&
          matches(e.params.item),
      );
      const beforeDeadline = Boolean(observed && observed.observedAt - start <= 5000);
      const completed = (e) => e.method === 'turn/completed' && e.params.turn.id === turn;
      const active = !owner.history.some(completed);
      const snapshot = (await owner.request('thread/items/list', { threadId: tid, limit: 60 }))
        .result.data;
      const queue = (await owner.request('thread/queue/list', { threadId: tid, limit: 20 })).result
        .data;
      const included = phase.requests.slice(1).some((r) => containsBody(r.input, this.body));
      const samplesAtCheck = phase.requests.length;
      const nextModelAt = await within(phase.nextModel.promise, 'Missing next model request');
      assert(!owner.history.some(completed), 'The next model request was in another turn');
      const nextModelFull = containsBody(phase.requests[1].input, this.body);
      // The queued message must get a normal response after the original measurement ends.
      this.target = undefined;
      phase.release.resolve();
      await owner.wait(completed);
      const admission = await owner.wait(
        (e) => e.method === 'item/started' && e.params.threadId === tid && matches(e.params.item),
      );
      await owner.wait(
        (e) => e.method === 'turn/completed' && e.params.turn.id === admission.params.turnId,
      );
      const count = async (threadId) =>
        (await owner.request('thread/items/list', { threadId, limit: 60 })).result.data.filter(
          (r) => matches(r.item),
        ).length;
      assert.equal(await count(tid), 1);
      assert.equal(await count(other), 0);
      return {
        mode: 'plugin-queue',
        characters: this.body.length,
        nativeEventStream: stream.error?.message ?? 'accepted',
        hookMs,
        modelHadFullBodyAtCheck: included,
        nextModelFullBodyMs: nextModelFull ? Math.round(nextModelAt - start) : null,
        holdReasoning,
        modelRequestCountAtCheck: samplesAtCheck,
        originalStillActiveAtCheck: active,
        fullSavedAtCheck: snapshot.filter((r) => matches(r.item)).length,
        nativeQueuedAtCheck: queue.some((q) => containsBody(q.input, this.body)),
        withinDeadline: beforeDeadline,
        ordinaryItemMs: Math.round(admission.observedAt - start),
        sameTurn: admission.params.turnId === turn,
        fullTargetItems: 1,
        controlItems: 0,
      };
    } finally {
      clearTimeout(boundaryTimer);
      hub.off('change', publishSaved);
      this.target = undefined;
      phase.boundary.resolve();
      phase.release.resolve();
      await client.close();
    }
  }
}

import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { LATEST_PROTOCOL_VERSION, type JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  McpResponseHandoff,
  type ResponseInvocation,
} from '../desktop/core/mcp-response-handoff.js';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const closed = async (scope: ResponseInvocation) => {
  if (scope.controller.signal.aborted) return;
  await new Promise<void>((resolve) =>
    scope.controller.signal.addEventListener('abort', () => resolve(), { once: true }),
  );
};
type Plan = {
  prepare?: ReturnType<typeof deferred>;
  returned?: ReturnType<typeof deferred>;
  queued?: ReturnType<typeof deferred>;
  sink?: ReturnType<typeof deferred>;
  partial?: boolean;
  split?: boolean;
  corrupt?: boolean;
  mixed?: boolean;
};

async function fixture(
  t: TestContext,
  json: boolean,
  limits?: { frameBytes?: number; invocations?: number },
) {
  const hub = new McpResponseHandoff(randomUUID(), limits),
    sessionKey = randomUUID();
  const mcp = new McpServer({ name: 'production-handoff-fixture', version: '1' });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => 'fixture-session',
    enableJsonResponse: json,
  });
  hub.wrap(transport, sessionKey);
  const plans = new Map<string, Plan>(),
    scopes = new Map<string, ResponseInvocation>();
  const sealed = new Map<string, JSONRPCMessage>(),
    requests = new Set<http.ClientRequest>();
  const gates: ReturnType<typeof deferred>[] = [];
  const effects = { callbacks: 0, reads: 0, release: 0, complete: 0, abort: [] as boolean[] };
  const key = (id: string | number) => JSON.stringify([typeof id, id]);
  for (const name of ['read', 'status'])
    mcp.registerTool(name, { inputSchema: { value: z.string() } }, async (args, extra) => {
      effects.callbacks++;
      const scope = hub.context.getStore();
      assert.ok(scope);
      assert.equal(scope.id, extra.requestId);
      const plan = plans.get(key(scope.id));
      await plan?.prepare?.promise;
      scope.assertCurrent();
      if (name === 'read') {
        effects.reads++;
        scope.associate({
          release: () => {
            effects.release++;
          },
          complete: () => {
            effects.complete++;
          },
          abort: (possible) => {
            effects.abort.push(possible);
          },
        });
      }
      if (plan?.mixed)
        await transport.send(
          {
            jsonrpc: '2.0',
            method: 'notifications/message',
            params: { level: 'info', data: 'notification 漢字' },
          },
          { relatedRequestId: scope.id },
        );
      const result = hub.seal(scope, {
        content: [{ type: 'text', text: args.value }],
        _meta: { user: 'kept' },
        structuredContent: { body: args.value },
      });
      sealed.set(key(scope.id), { jsonrpc: '2.0', id: scope.id, result });
      plan?.returned?.resolve();
      await plan?.queued?.promise;
      return result;
    });
  await mcp.connect(transport);
  const server = http.createServer((req, res) => {
    void (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString());
      if (body.method !== 'tools/call') {
        await transport.handleRequest(req, res, body);
        return;
      }
      const plan = plans.get(key(body.id));
      if (plan?.partial) {
        const write = res.write.bind(res);
        res.write = ((chunk: Buffer, callback?: (error?: Error | null) => void) =>
          write(chunk.subarray(0, 17), () => {
            res.destroy();
            callback?.();
          })) as typeof res.write;
      }
      const scope = hub.begin(transport, sessionKey, body.id, res);
      scopes.set(key(body.id), scope);
      // Test-only stream faults remain above the production gate. The real SDK,
      // Hono and actual ServerResponse still execute; transport.send is not mocked.
      if (plan?.sink || plan?.split || plan?.corrupt) {
        const write = res.write.bind(res),
          end = res.end.bind(res);
        const proxy = new Writable({
          write(chunk: Buffer, _encoding, callback) {
            void (async () => {
              await plan?.sink?.promise;
              if (plan?.corrupt) chunk = Buffer.concat([Buffer.from([255]), chunk]);
              if (plan?.split) {
                for (const byte of chunk)
                  await new Promise<void>((resolve, reject) =>
                    write(Buffer.from([byte]), (e) => (e ? reject(e) : resolve())),
                  );
                callback();
              } else write(chunk, callback);
            })().catch(callback);
          },
          final(callback) {
            end(callback);
          },
        });
        proxy.on('error', () => res.destroy());
        proxy.on('drain', () => res.emit('drain'));
        res.write = proxy.write.bind(proxy) as typeof res.write;
        res.end = ((...args: Parameters<Writable['end']>) => {
          proxy.end(...args);
          return res;
        }) as typeof res.end;
      }
      await hub.context.run(scope, () => transport.handleRequest(req, res, body));
    })().catch(() => res.destroy());
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = new URL('http://127.0.0.1:' + (server.address() as { port: number }).port + '/mcp');
  let session: string | undefined;
  const post = (body: unknown, protocol = LATEST_PROTOCOL_VERSION) => {
    let request!: http.ClientRequest;
    const result = new Promise<{ body: string; headers: http.IncomingHttpHeaders }>((resolve) => {
      const chunks: Buffer[] = [];
      let headers: http.IncomingHttpHeaders = {},
        settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve({ body: Buffer.concat(chunks).toString(), headers });
        }
      };
      request = http.request(url, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
          'mcp-protocol-version': protocol,
          ...(session ? { 'mcp-session-id': session } : {}),
        },
      });
      requests.add(request);
      request.on('error', done);
      request.on('close', () => {
        requests.delete(request);
        done();
      });
      request.on('response', (response) => {
        headers = response.headers;
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', done);
        response.on('aborted', done);
        response.on('error', done);
      });
      request.end(JSON.stringify(body));
    });
    return { result, abort: () => request.destroy() };
  };
  const init = await post({
    jsonrpc: '2.0',
    id: 'initialize',
    method: 'initialize',
    params: {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'private-wire', version: '1' },
    },
  }).result;
  session = String(init.headers['mcp-session-id']);
  await post({ jsonrpc: '2.0', method: 'notifications/initialized' }).result;
  t.after(async () => {
    for (const gate of gates) gate.resolve();
    hub.close();
    for (const request of requests) request.destroy();
    await mcp.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  return {
    hub,
    transport,
    scopes,
    sealed,
    effects,
    gate() {
      const gate = deferred();
      gates.push(gate);
      return gate;
    },
    call(
      name: string,
      id: string | number,
      value: unknown = 'Body ncf/response-handoff 漢字',
      plan: Plan = {},
    ) {
      plans.set(key(id), plan);
      return post({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name, arguments: { value } },
      });
    },
    scope(id: string | number) {
      const scope = scopes.get(key(id));
      assert.ok(scope);
      return scope;
    },
    response(id: string | number) {
      const response = sealed.get(key(id));
      assert.ok(response);
      return structuredClone(response);
    },
    invalidProtocol(id: string | number) {
      return post(
        {
          jsonrpc: '2.0',
          id,
          method: 'tools/call',
          params: { name: 'read', arguments: { value: 'Must not be read' } },
        },
        'unsupported-version',
      );
    },
  };
}

for (const json of [true, false]) {
  const mode = json ? 'JSON' : 'SSE';
  test(
    `${mode} production sink handles Node writes, split UTF-8 and one local completion`,
    { timeout: 10000 },
    async (t) => {
      const f = await fixture(t, json);
      const wire = await f.call('read', 1, undefined, { split: true, mixed: !json }).result;
      assert.match(wire.body, /Body ncf\/response-handoff 漢字/);
      assert.ok(!wire.body.includes(f.scope(1).nonce));
      assert.ok(!wire.body.includes('"ncf/response-handoff":'));
      assert.match(wire.body, /"user":"kept"/);
      assert.equal(f.effects.complete, 1);
      assert.equal(f.effects.release, 1);
    },
  );
  for (const [name, args] of [
    ['unknown', 'x'],
    ['read', 7],
  ] as const)
    test(
      `${mode} SDK ${name === 'unknown' ? 'unknown tool' : 'schema error'} survives cancelled-ID reuse with zero callback effects`,
      { timeout: 10000 },
      async (t) => {
        const f = await fixture(t, json),
          returned = f.gate(),
          queued = f.gate();
        const old = f.call('read', 'reused', 'Old unread body', { returned, queued });
        await returned.promise;
        const oldScope = f.scope('reused'),
          oldResponse = f.response('reused');
        old.abort();
        await old.result;
        await closed(oldScope);
        assert.equal(oldScope.controller.signal.aborted, true);
        const before = { ...f.effects };
        const wire = await f.call(name, 'reused', args).result;
        assert.match(wire.body, /"isError":true/);
        assert.ok(!wire.body.includes('Old unread body'));
        assert.equal(f.effects.callbacks, before.callbacks);
        assert.equal(f.effects.reads, before.reads);
        assert.equal(f.effects.complete, 0);
        assert.ok(!wire.body.includes(oldScope.nonce));
        await assert.rejects(() => f.transport.send(oldResponse));
        queued.resolve();
      },
    );
  test(
    `${mode} cancel after enqueue before sink writes no unread bytes`,
    { timeout: 10000 },
    async (t) => {
      const f = await fixture(t, json),
        returned = f.gate(),
        sink = f.gate();
      const call = f.call('read', 'cancel-before-write', 'Unread body', { returned, sink });
      await returned.promise;
      await tick();
      call.abort();
      await call.result;
      await closed(f.scope('cancel-before-write'));
      sink.resolve();
      await tick();
      assert.equal(f.effects.complete, 0);
      assert.equal(f.effects.release, 0);
      assert.equal(f.scope('cancel-before-write').response.destroyed, true);
    },
  );
  test(
    `${mode} partial response close preserves possible-write uncertainty`,
    { timeout: 10000 },
    async (t) => {
      const f = await fixture(t, json);
      const wire = await f.call('read', 'partial', 'Unread body', { partial: true }).result;
      assert.ok(wire.body.length <= 17);
      assert.equal(f.effects.complete, 0);
      assert.deepEqual(f.effects.abort, [true]);
    },
  );
  test(
    `${mode} invalid UTF-8 fails before any complete response`,
    { timeout: 10000 },
    async (t) => {
      const f = await fixture(t, json);
      const wire = await f.call('read', 'utf8', 'Unread body', { corrupt: true }).result;
      assert.equal(wire.body, '');
      assert.equal(f.effects.complete, 0);
      assert.deepEqual(f.effects.abort, [false]);
    },
  );
  test(
    `${mode} service replacement rejects old capability before current bytes`,
    { timeout: 10000 },
    async (t) => {
      const old = await fixture(t, json),
        returned = old.gate(),
        queued = old.gate();
      const pending = old.call('read', 5, 'Old body', { returned, queued });
      await returned.promise;
      const previous = old.response(5);
      old.hub.close();
      await pending.result;
      const next = await fixture(t, json);
      await assert.rejects(() => next.transport.send(previous));
      const wire = await next.call('status', 5, 'New status').result;
      assert.match(wire.body, /New status/);
      assert.ok(!wire.body.includes('Old body'));
      assert.equal(old.effects.complete, 0);
      assert.equal(next.effects.complete, 0);
      queued.resolve();
    },
  );
  test(
    `${mode} numeric and string IDs stay distinct; completed handles are retired`,
    { timeout: 10000 },
    async (t) => {
      const f = await fixture(t, json),
        returned = f.gate(),
        queued = f.gate();
      const numeric = f.call('read', 123, 'Numeric body', { returned, queued });
      await returned.promise;
      const text = await f.call('status', '123', 'String status').result;
      assert.match(text.body, /String status/);
      assert.equal(f.scope(123).complete, false);
      assert.equal(f.scope('123').complete, true);
      assert.equal(f.effects.complete, 0);
      queued.resolve();
      assert.match((await numeric.result).body, /Numeric body/);
      assert.equal(f.effects.complete, 1);
      assert.equal((Reflect.get(f.hub, 'active') as Map<unknown, unknown>).size, 0);
      assert.equal((Reflect.get(f.hub, 'capabilities') as Map<unknown, unknown>).size, 0);
      await assert.rejects(() => f.transport.send(f.response(123)));
    },
  );
  test(
    `${mode} cancellation before preparation causes zero read effects`,
    { timeout: 10000 },
    async (t) => {
      const f = await fixture(t, json),
        prepare = f.gate();
      const call = f.call('read', 'before-prepare', 'Unread body', { prepare });
      while (!f.scopes.has(JSON.stringify(['string', 'before-prepare']))) await tick();
      const scope = f.scope('before-prepare');
      call.abort();
      await call.result;
      await closed(scope);
      prepare.resolve();
      await tick();
      assert.equal(f.effects.reads, 0);
      assert.equal(f.effects.complete, 0);
      assert.equal(f.effects.release, 0);
    },
  );
  test(
    `${mode} bounded result rejection stays an SDK error without receipt`,
    { timeout: 10000 },
    async (t) => {
      const f = await fixture(t, json, { frameBytes: 1024 });
      const wire = await f.call('read', 'too-large', 'x'.repeat(2048)).result;
      assert.match(wire.body, /"isError":true/);
      assert.ok(!wire.body.includes('x'.repeat(2048)));
      assert.equal(f.effects.complete, 0);
      assert.equal(f.effects.release, 0);
      assert.deepEqual(f.effects.abort, [false]);
    },
  );
  test(
    `${mode} invocation capacity rejects before business effects and releases on cancellation`,
    { timeout: 10000 },
    async (t) => {
      const f = await fixture(t, json, { invocations: 1 }),
        returned = f.gate(),
        queued = f.gate();
      const first = f.call('read', 1, 'Held body', { returned, queued });
      await returned.promise;
      const before = f.effects.callbacks;
      const overflow = await f.call('status', 2).result;
      assert.equal(overflow.body, '');
      assert.equal(f.effects.callbacks, before);
      first.abort();
      await first.result;
      await closed(f.scope(1));
      const normal = await f.call('status', 3, 'Fresh status').result;
      assert.match(normal.body, /Fresh status/);
      assert.equal(f.effects.complete, 0);
      queued.resolve();
    },
  );
  test(
    `${mode} a response larger than the Writable high-water mark completes once`,
    { timeout: 10000 },
    async (t) => {
      const f = await fixture(t, json),
        body = '漢字'.repeat(50000);
      const wire = await f.call('read', 'backpressure', body).result;
      assert.ok(wire.body.includes(body));
      assert.equal(f.effects.complete, 1);
      assert.equal(f.effects.release, 1);
    },
  );
  test(
    `${mode} actual SDK HTTP validation error remains a non-receipt response`,
    { timeout: 10000 },
    async (t) => {
      const f = await fixture(t, json);
      const wire = await f.invalidProtocol('bad-protocol').result;
      assert.match(wire.body, /"error":/);
      assert.match(wire.body, /"id":null/);
      assert.ok(!wire.body.includes('Must not be read'));
      assert.equal(f.effects.callbacks, 0);
      assert.equal(f.effects.reads, 0);
      assert.equal(f.effects.complete, 0);
    },
  );
}

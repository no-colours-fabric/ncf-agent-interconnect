import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  parseOpenCodeV2Evidence,
  parseOpenCodeV2Provision,
  type OpenCodeV2Evidence,
  type OpenCodeV2Provision,
  type OpenCodeV2Registration,
  type OpenCodeV2Scope,
} from '../../desktop/core/opencode-v2-protocol.js';
import type {
  PinnedContext,
  PinnedEvent,
  PinnedInboxUser,
  PinnedPromptInput,
  PinnedRpcDefinition,
  PinnedSessionInfo,
} from './opencode-v2-contracts.js';

export class Deferred<T> {
  readonly promise: Promise<T>;
  resolve!: (value: T) => void;
  reject!: (error: Error) => void;
  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

/** Lazy, single-consumer public-event fixture; no host/account process. */
class Events {
  readonly queue: PinnedEvent[] = [];
  readonly pending: Deferred<IteratorResult<PinnedEvent>>[] = [];
  consumers = 0;
  concurrentNext = 0;
  maxConcurrentNext = 0;
  armed = false;
  ended = false;
  selected = new Set<string>();

  publish(event: PinnedEvent): void {
    if (!this.armed || this.ended || !this.selected.has(event.type)) return;
    const pending = this.pending.shift();
    if (pending) pending.resolve({ done: false, value: structuredClone(event) });
    else this.queue.push(structuredClone(event));
  }

  close(error?: Error): void {
    this.ended = true;
    for (const pending of this.pending.splice(0)) {
      if (error) pending.reject(error);
      else pending.resolve({ done: true, value: undefined });
    }
  }

  subscribe: PinnedContext['event']['subscribe'] = (options) => {
    this.selected = new Set(options?.types);
    return {
      [Symbol.asyncIterator]: () => {
        this.consumers++;
        assert.equal(this.consumers, 1, 'the host stream must have only one dispatcher');
        options?.signal?.addEventListener('abort', () => this.close(), { once: true });
        return {
          next: async () => {
            this.armed = true;
            this.concurrentNext++;
            this.maxConcurrentNext = Math.max(this.maxConcurrentNext, this.concurrentNext);
            try {
              if (this.ended) return { done: true, value: undefined };
              const value = this.queue.shift();
              if (value) return { done: false, value };
              const pending = new Deferred<IteratorResult<PinnedEvent>>();
              this.pending.push(pending);
              return await pending.promise;
            } finally {
              this.concurrentNext--;
            }
          },
          return: async () => {
            this.close();
            return { done: true, value: undefined };
          },
        };
      },
    };
  };
}

export class OpenCodeV2HostFixture {
  readonly events = new Events();
  readonly sessions = new Map<string, PinnedSessionInfo>();
  readonly prompts: PinnedPromptInput[] = [];
  readonly waits: { sessionID: string; result: Deferred<void> }[] = [];
  readonly rpcEmits: {
    definition: PinnedRpcDefinition;
    name: string;
    data: Record<string, unknown>;
  }[] = [];
  readonly busy = new Set<string>();
  readonly context: PinnedContext;
  holdBarrier = false;
  waitCalls = 0;
  rpcDisposals = 0;
  onWait?: (sessionID: string) => void;
  promptResult?: (input: PinnedPromptInput) => Promise<PinnedInboxUser>;
  beforeGet?: () => Promise<void>;
  private sequence = 0;
  private routeTransform?: Parameters<PinnedContext['mcp']['transform']>[0];

  route(remote: { type: string; url: string; headers: Record<string, string> }) {
    const entry = structuredClone(remote);
    this.routeTransform?.({
      get: (name) => (name === 'ncf_agent_interconnect' ? entry : undefined),
      update: (name, change) => {
        assert.equal(name, 'ncf_agent_interconnect');
        change(entry);
      },
    });
    return entry;
  }

  constructor(readonly workspace = '/isolated/opencode-v2') {
    this.context = {
      app: { name: 'opencode', version: '2.3.0', channel: 'test' },
      location: { directory: workspace },
      options: {},
      mcp: {
        transform: async (callback) => {
          this.routeTransform = callback;
          return {
            dispose: async () => {
              this.routeTransform = undefined;
            },
          };
        },
      },
      event: { subscribe: this.events.subscribe },
      rpc: {
        register: async (definition, handlers) => {
          assert.deepEqual(handlers, {});
          return {
            dispose: async () => {
              this.rpcDisposals++;
            },
            events: {
              emit: async (name, data) => {
                assert.ok(definition.events[name], 'only registered RPC event names are supported');
                this.rpcEmits.push({ definition, name, data: structuredClone(data) });
                if (!this.holdBarrier) this.emitBarrier(this.rpcEmits.length - 1);
              },
            },
          };
        },
      },
      session: {
        get: async ({ sessionID }) => {
          await this.beforeGet?.();
          const info = this.sessions.get(sessionID);
          if (!info) throw new Error('Session not found');
          return structuredClone(info);
        },
        wait: async ({ sessionID }) => {
          if (!this.sessions.has(sessionID)) throw new Error('Session not found');
          this.waitCalls++;
          this.onWait?.(sessionID);
          if (!this.busy.has(sessionID)) return;
          const result = new Deferred<void>();
          this.waits.push({ sessionID, result });
          await result.promise;
        },
        prompt: async (input) => {
          assert.ok(input.id?.startsWith('msg_'), 'the pinned ID schema requires msg_');
          assert.ok(input.sessionID.startsWith('ses'), 'the pinned session schema requires ses');
          assert.ok(this.sessions.has(input.sessionID));
          this.prompts.push(structuredClone(input));
          if (this.promptResult) return this.promptResult(input);
          this.delivered(input.sessionID, input.id!);
          return this.user(input);
        },
      },
    };
  }

  addSession(sessionID = 'ses_fixture'): string {
    this.sessions.set(sessionID, {
      id: sessionID,
      projectID: 'project-fixture',
      location: { directory: this.workspace },
      time: { created: 1, updated: 1 },
    });
    return sessionID;
  }

  emitBarrier(index = 0): void {
    const item = this.rpcEmits[index];
    assert.ok(item);
    this.events.publish({
      id: 'evt_' + randomUUID(),
      created: Date.now(),
      type: ('rpc.' + item.definition.id + '.' + item.name) as PinnedEvent['type'],
      location: { directory: this.workspace },
      data: structuredClone(item.data),
    });
  }

  status(sessionID: string, type: 'busy' | 'idle' | 'retry'): void {
    if (type === 'idle') {
      this.busy.delete(sessionID);
      for (const wait of this.waits.filter((item) => item.sessionID === sessionID))
        wait.result.resolve();
    } else this.busy.add(sessionID);
    this.events.publish({
      id: 'evt_' + randomUUID(),
      created: Date.now(),
      type: 'session.status',
      location: { directory: this.workspace },
      data: { sessionID, status: { type } },
    });
  }

  delivered(sessionID: string, inboxID: string): void {
    this.events.publish({
      id: 'evt_' + randomUUID(),
      created: Date.now(),
      type: 'session.inbox.delivered',
      location: { directory: this.workspace },
      durable: { aggregateID: sessionID, seq: ++this.sequence, version: 1 },
      data: { sessionID, inboxID },
    });
  }

  user(input: PinnedPromptInput): PinnedInboxUser {
    return {
      id: input.id!,
      sessionID: input.sessionID,
      type: 'user',
      time: { created: Date.now() },
      delivery: input.delivery ?? 'steer',
      payload: { text: input.text },
    };
  }
}

type EvidenceOf<K extends OpenCodeV2Evidence['kind']> = OpenCodeV2Evidence & { kind: K };

/** Injected node peer: only private loopback protocol, no NCF service/receipt writer. */
export class OpenCodeV2NodeFixture {
  readonly provision: OpenCodeV2Provision = {
    protocol: 2,
    nodeId: randomUUID(),
    nodeUrl: 'http://127.0.0.1:1',
    targetId: randomUUID(),
    generation: randomUUID(),
    credential: 'a'.repeat(64),
  };
  registration?: OpenCodeV2Registration;
  scope!: OpenCodeV2Scope;
  readonly evidence: OpenCodeV2Evidence[] = [];
  readonly waiters = new Set<() => void>();
  private controller = new AbortController();
  private reading?: Promise<void>;
  private response?: Response;

  register = async (request: OpenCodeV2Registration): Promise<OpenCodeV2Scope> => {
    this.registration = request;
    this.scope = {
      protocol: 2,
      nodeId: request.nodeId,
      targetId: request.targetId,
      generation: request.generation,
      bootId: request.bootId,
      nodeEpoch: randomUUID(),
    };
    return this.scope;
  };

  async connect(): Promise<void> {
    assert.ok(this.registration);
    this.response = await fetch(this.registration.bridgeUrl + '/events', {
      headers: { authorization: 'Bearer ' + this.registration.bridgeCredential },
      signal: this.controller.signal,
    });
    assert.equal(this.response.status, 200);
    const reader = this.response.body!.getReader();
    this.reading = (async () => {
      let pending = '';
      const decoder = new TextDecoder('utf-8', { fatal: true });
      while (true) {
        const item = await reader.read();
        if (item.done) return;
        pending += decoder.decode(item.value, { stream: true });
        assert.ok(pending.length < 1024 * 1024);
        let end: number;
        while ((end = pending.indexOf('\n\n')) >= 0) {
          const frame = pending.slice(0, end);
          pending = pending.slice(end + 2);
          if (!frame.startsWith('data: ')) continue;
          this.evidence.push(parseOpenCodeV2Evidence(JSON.parse(frame.slice(6))));
          for (const check of this.waiters) check();
        }
      }
    })();
    // Teardown aborts the reader; no unhandled rejection while a test is asserting.
    void this.reading.catch(() => {});
  }

  async command(value: unknown, credential = this.registration!.bridgeCredential) {
    assert.ok(this.registration);
    const response = await fetch(this.registration.bridgeUrl + '/command', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + credential, 'content-type': 'application/json' },
      body: JSON.stringify(value),
      signal: AbortSignal.timeout(2000),
    });
    return { status: response.status, value: (await response.json()) as Record<string, unknown> };
  }

  wait<K extends OpenCodeV2Evidence['kind']>(
    kind: K,
    predicate: (value: EvidenceOf<K>) => boolean = () => true,
    after = 0,
  ): Promise<EvidenceOf<K>> {
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout;
      const check = () => {
        const found = this.evidence
          .slice(after)
          .find((value) => value.kind === kind && predicate(value as EvidenceOf<K>));
        if (!found) return;
        clearTimeout(timer);
        this.waiters.delete(check);
        resolve(found as EvidenceOf<K>);
      };
      timer = setTimeout(() => {
        this.waiters.delete(check);
        reject(new Error('Expected injected protocol evidence: ' + kind));
      }, 1000);
      this.waiters.add(check);
      check();
    });
  }

  async close(): Promise<void> {
    this.controller.abort();
    await this.reading?.catch(() => {});
  }
}

/** New product-source fixtures only; imports/setup remain lazy for first-five tests. */
export async function openCodeV2ProductFixture(
  t: import('node:test').TestContext,
  options: {
    timeoutMs?: number;
    legacy?: boolean;
    beforeRegistration?: (
      service: import('../../desktop/core/service.js').NodeService,
      registration: OpenCodeV2Registration,
    ) => Promise<void>;
  } = {},
) {
  const { mkdtemp, readFile, realpath, rm } = await import('node:fs/promises');
  const path = await import('node:path'),
    os = await import('node:os');
  const { fileURLToPath } = await import('node:url');
  const { NodeService } = await import('../../desktop/core/service.js');
  const { SettingsFile } = await import('../../desktop/core/settings.js');
  const { OpenCodeV2SetupService } = await import('../../desktop/core/mcp-setup.js');
  const { startOpenCodeV2 } = await import('../../desktop/integrations/opencode-v2.js');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } =
    await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ncf-v2-product-')));
  const settings = new SettingsFile(directory);
  await settings.load();
  settings.value.peerPort = 0;
  settings.value.mcpPort = 0;
  await settings.save();
  const service = new NodeService(directory, {
    codexSockets: () => [],
    lanDiscovery: { interfaces: () => [] },
  });
  let handle: Awaited<ReturnType<typeof startOpenCodeV2>> | undefined;
  const clients: InstanceType<typeof Client>[] = [];
  t.after(async () => {
    for (const client of clients) await client.close().catch(() => {});
    await handle?.dispose();
    if (service.store) await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  await service.open();
  const target = {
    major: 2 as const,
    installationId: null,
    installationPath: null,
    profilePath: directory,
    configurationPath: path.join(directory, 'opencode-v2.json'),
  };
  const setup = new OpenCodeV2SetupService({
    stateDirectory: directory,
    home: directory,
    env: {},
    instructions: () => {
      throw new Error('No legacy setup');
    },
    asset: async () => 'export default {};',
  });
  const preview = await setup.v2Preview('isolated-window', target);
  const result = await setup.v2Apply('isolated-window', preview.planId, target, false);
  assert.equal(result.status, 'applied');
  const configuration = JSON.parse(await readFile(target.configurationPath, 'utf8'));
  const provision = parseOpenCodeV2Provision(
    JSON.parse(
      await readFile(
        path.join(fileURLToPath(configuration.plugins[0].package), 'ncf-target.json'),
        'utf8',
      ),
    ),
  );
  const host = new OpenCodeV2HostFixture();
  host.context.options = configuration.plugins[0].options;
  handle = await startOpenCodeV2(host.context, provision, {
    timeoutMs: options.timeoutMs ?? 1000,
    ...(options.beforeRegistration || options.legacy
      ? {
          register: async (request: OpenCodeV2Registration) => {
            await options.beforeRegistration?.(service, request);
            const wire = { ...request };
            if (options.legacy) delete wire.instanceCredential;
            const response = await fetch(provision.nodeUrl + '/integrations/opencode-v2/register', {
              method: 'POST',
              headers: {
                authorization: 'Bearer ' + provision.credential,
                'content-type': 'application/json',
              },
              body: JSON.stringify(wire),
            });
            assert.equal(response.status, 200);
            return (await response.json()) as OpenCodeV2Scope;
          },
        }
      : {}),
  });
  const connectHost = async (instance?: OpenCodeV2HostFixture) => {
    const client = new Client({ name: 'OpenCode', version: '2.3.0-source-fixture' });
    clients.push(client);
    const entry = configuration.mcp.servers.ncf_agent_interconnect;
    const remote = instance ? instance.route(entry) : entry;
    await client.connect(
      new StreamableHTTPClientTransport(new URL(remote.url), {
        requestInit: { headers: remote.headers },
      }),
    );
    return client;
  };
  const client = await connectHost(options.legacy ? undefined : host);
  const call = (sessionID: string, name: string, args: Record<string, unknown>) =>
    client.callTool({ name, arguments: args, _meta: { 'ai.opencode/sessionID': sessionID } });
  return {
    directory,
    service,
    host,
    client,
    connectHost,
    provision,
    configuration,
    handle,
    call,
    setup,
    target,
  };
}

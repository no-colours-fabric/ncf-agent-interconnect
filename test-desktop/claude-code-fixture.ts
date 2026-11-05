import type test from 'node:test';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { NodeService } from '../desktop/core/service.js';
import { claudeToolPrefix } from '../desktop/core/claude-sessions.js';
import { canonicalInputHash, claudeCallMetaKey } from '../desktop/integrations/claude-code.js';
import { readNativeLease, updateNativeLease } from '../desktop/integrations/claude-native-lease.js';

export { canonicalInputHash };

/** A synthetic helper speaking the node side of the helper protocol; no Claude Code is involved. */
export class FakeHelper {
  readonly id = randomUUID();
  readonly secret = randomBytes(32).toString('hex');
  lines: Record<string, unknown>[] = [];
  generation = 0;
  private controller?: AbortController;
  private reading?: Promise<void>;
  private nativeLeaseNonce?: string;
  private leasePinned = false;
  constructor(
    readonly f: ClaudeFixture,
    public spawnSession: string | null,
    public session: string | null = spawnSession,
    private readonly leaseOverride?: string,
  ) {}
  wakes(): string[] {
    return this.lines.filter((line) => line.type === 'wake').map((line) => String(line.nickname));
  }
  async attach(): Promise<void> {
    if (!this.leasePinned) {
      this.nativeLeaseNonce =
        this.leaseOverride ??
        (this.spawnSession
          ? (await readNativeLease(this.f.nodeFile, this.spawnSession))?.nonce
          : undefined);
      this.leasePinned = true;
    }
    this.controller = new AbortController();
    const controller = this.controller;
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(this.f.url('/integrations/claude/helper'), {
        method: 'POST',
        headers: this.f.headers(),
        body: JSON.stringify({
          helperId: this.id,
          secret: this.secret,
          spawnSession: this.spawnSession,
          session: this.session,
          generation: this.generation,
          nativeLeaseNonce: this.nativeLeaseNonce ?? null,
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error('Helper stream refused');
      let settled = false;
      let ready!: () => void;
      let failed!: (error: Error) => void;
      const started = new Promise<void>((resolve, reject) => {
        ready = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        failed = (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        };
      });
      this.reading = (async () => {
        let buffer = '';
        try {
          for await (const chunk of response.body!) {
            buffer += Buffer.from(chunk).toString();
            let end: number;
            while ((end = buffer.indexOf('\n')) >= 0) {
              const line = JSON.parse(buffer.slice(0, end)) as Record<string, unknown>;
              buffer = buffer.slice(end + 1);
              if (line.type === 'error') {
                failed(new Error('Helper stream refused the native lease'));
                return;
              }
              if (line.type === 'native-lease') {
                if (
                  line.session !== this.spawnSession ||
                  typeof line.nonce !== 'string' ||
                  (this.nativeLeaseNonce && this.nativeLeaseNonce !== line.nonce)
                ) {
                  failed(new Error('Helper stream changed its pinned native lease'));
                  return;
                }
                this.nativeLeaseNonce = line.nonce;
                continue;
              }
              if (line.type === 'ready') ready();
              else if (line.type !== 'ping') this.lines.push(line);
            }
          }
        } catch (error) {
          failed(error instanceof Error ? error : new Error('Helper stream failed'));
        } finally {
          failed(new Error('Helper stream ended before ready'));
        }
      })();
      await started;
    } catch (error) {
      controller.abort();
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  async detach(): Promise<void> {
    this.controller?.abort();
    await this.reading;
  }
  /** What the helper does before forwarding a tool call it received from Claude Code. */
  verify(tool: string, args: Record<string, unknown>, contextToken?: string) {
    const original = { ...args };
    delete original.contextToken;
    return this.f.post('/integrations/claude/call', {
      helperId: this.id,
      secret: this.secret,
      tool,
      inputHash: canonicalInputHash(original),
      ...(contextToken ? { contextToken } : {}),
      ...(typeof args.connectionId === 'string' ? { connectionId: args.connectionId } : {}),
    });
  }
}

export interface ClaudeFixture {
  service: NodeService;
  directory: string;
  nodeFile: string;
  url(route: string): URL;
  headers(): Record<string, string>;
  post(route: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }>;
  hook(
    event: string,
    session: string,
    extra?: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  preTool(session: string, tool: string, args: Record<string, unknown>): Promise<string>;
  connect(helper: FakeHelper, session: string, nickname: string): Promise<Record<string, any>>;
  restart(): Promise<NodeService>;
  mcp(): Promise<Client>;
}

export async function claudeFixture(t: test.TestContext): Promise<ClaudeFixture> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-claude-'));
  let service = new NodeService(directory);
  const clients: Client[] = [];
  t.after(async () => {
    await Promise.allSettled(clients.map((client) => client.close()));
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  const open = async () => {
    await service.settings.load();
    Object.assign(service.settings.value, {
      mcpPort: 0,
      peerPort: 0,
      listenHost: '127.0.0.1',
      peers: [],
    });
    await service.settings.save();
    await service.open();
  };
  await open();
  const f: ClaudeFixture = {
    get service() {
      return service;
    },
    directory,
    nodeFile: path.join(directory, 'Integrations', 'node.json'),
    url: (route) => new URL(route, service.snapshot().mcpUrl),
    headers: () => ({
      'content-type': 'application/json',
      authorization: 'Bearer ' + service.settings.value.localToken,
    }),
    async post(route, body) {
      const response = await fetch(f.url(route), {
        method: 'POST',
        headers: f.headers(),
        body: JSON.stringify(body),
      });
      return { status: response.status, body: (await response.json()) as Record<string, unknown> };
    },
    async hook(event, session, extra = {}) {
      const lease =
        event === 'SessionStart' || event === 'SessionEnd'
          ? await updateNativeLease(f.nodeFile, session, event)
          : await readNativeLease(f.nodeFile, session);
      const result = await f.post('/integrations/claude/hook', {
        event,
        sessionId: session,
        nativeLeaseNonce: lease?.nonce ?? null,
        ...extra,
      });
      if (result.status !== 200) throw new Error('Hook refused: ' + JSON.stringify(result.body));
      return result.body;
    },
    async preTool(session, tool, args) {
      const original = { ...args };
      delete original.contextToken;
      const result = await f.hook('PreToolUse', session, {
        tool: claudeToolPrefix + tool,
        inputHash: canonicalInputHash(original),
      });
      if (typeof result.contextToken !== 'string')
        throw new Error('The native hook did not receive a tool proof');
      return result.contextToken;
    },
    async mcp() {
      const client = new Client({ name: 'Claude Code', version: 'fixture' });
      await client.connect(
        new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
          requestInit: {
            headers: { authorization: 'Bearer ' + service.settings.value.localToken },
          },
        }),
      );
      clients.push(client);
      return client;
    },
    async connect(helper, session, nickname) {
      const args = { nickname };
      const proof = await f.preTool(session, 'agent_connect', args);
      const verified = await helper.verify('agent_connect', args, proof);
      if (verified.status !== 200) throw new Error(String(verified.body.error));
      if (typeof verified.body.callToken !== 'string')
        throw new Error('The native helper did not receive a call permit');
      if (typeof verified.body.contextToken !== 'string')
        throw new Error('The native helper did not receive a connection ticket');
      const client = await f.mcp();
      const result = await client.callTool({
        name: 'agent_connect',
        arguments: { ...args, contextToken: verified.body.contextToken },
        _meta: { [claudeCallMetaKey]: verified.body.callToken },
      });
      if (result.isError) throw new Error(JSON.stringify(result.content));
      return result.structuredContent as Record<string, any>;
    },
    async restart() {
      await Promise.allSettled(clients.splice(0).map((client) => client.close()));
      await service.close();
      service = new NodeService(directory);
      await open();
      return service;
    },
  };
  return f;
}

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

import type test from 'node:test';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { NodeService } from '../desktop/core/service.js';
import { claudeToolPrefix } from '../desktop/core/claude-sessions.js';
import { canonicalInputHash } from '../desktop/integrations/claude-code.js';

export { canonicalInputHash };

/** A synthetic helper speaking the node side of the helper protocol; no Claude Code is involved. */
export class FakeHelper {
  readonly id = randomUUID();
  readonly secret = randomBytes(32).toString('hex');
  lines: Record<string, unknown>[] = [];
  generation = 0;
  private controller?: AbortController;
  private reading?: Promise<void>;
  constructor(
    readonly f: ClaudeFixture,
    public spawnSession: string | null,
    public session: string | null = spawnSession,
  ) {}
  wakes(): string[] {
    return this.lines.filter((line) => line.type === 'wake').map((line) => String(line.nickname));
  }
  async attach(): Promise<void> {
    this.controller = new AbortController();
    const response = await fetch(this.f.url('/integrations/claude/helper'), {
      method: 'POST',
      headers: this.f.headers(),
      body: JSON.stringify({
        helperId: this.id,
        secret: this.secret,
        spawnSession: this.spawnSession,
        session: this.session,
        generation: this.generation,
      }),
      signal: this.controller.signal,
    });
    if (!response.ok || !response.body) throw new Error('Helper stream refused');
    let ready!: () => void;
    const started = new Promise<void>((resolve) => (ready = resolve));
    this.reading = (async () => {
      let buffer = '';
      try {
        for await (const chunk of response.body!) {
          buffer += Buffer.from(chunk).toString();
          let end: number;
          while ((end = buffer.indexOf('\n')) >= 0) {
            const line = JSON.parse(buffer.slice(0, end)) as Record<string, unknown>;
            buffer = buffer.slice(end + 1);
            if (line.type === 'ready') ready();
            else if (line.type !== 'ping') this.lines.push(line);
          }
        }
      } catch {
        // Aborted by the test.
      }
    })();
    await started;
  }
  async detach(): Promise<void> {
    this.controller?.abort();
    await this.reading;
  }
  async switchSession(session: string | null): Promise<void> {
    this.session = session;
    this.generation++;
    await this.f.post('/integrations/claude/session', {
      helperId: this.id,
      secret: this.secret,
      session,
      generation: this.generation,
    });
  }
  /** What the helper does before forwarding a tool call it received from Claude Code. */
  verify(tool: string, args: Record<string, unknown>) {
    return this.f.post('/integrations/claude/call', {
      helperId: this.id,
      secret: this.secret,
      tool,
      inputHash: canonicalInputHash(args),
      ...(typeof args.connectionId === 'string' ? { connectionId: args.connectionId } : {}),
    });
  }
}

export interface ClaudeFixture {
  service: NodeService;
  directory: string;
  url(route: string): URL;
  headers(): Record<string, string>;
  post(route: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }>;
  hook(event: string, session: string, extra?: Record<string, unknown>): Promise<void>;
  preTool(session: string, tool: string, args: Record<string, unknown>): Promise<void>;
  connect(helper: FakeHelper, session: string, nickname: string): Promise<Record<string, any>>;
  restart(): Promise<NodeService>;
  mcp(): Promise<Client>;
}

export async function claudeFixture(t: test.TestContext): Promise<ClaudeFixture> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect-claude-'));
  let service = new NodeService(directory);
  await service.open();
  const clients: Client[] = [];
  t.after(async () => {
    await Promise.allSettled(clients.map((client) => client.close()));
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  const f: ClaudeFixture = {
    get service() {
      return service;
    },
    directory,
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
      const result = await f.post('/integrations/claude/hook', {
        event,
        sessionId: session,
        ...extra,
      });
      if (result.status !== 200) throw new Error('Hook refused: ' + JSON.stringify(result.body));
    },
    async preTool(session, tool, args) {
      await f.hook('PreToolUse', session, {
        tool: claudeToolPrefix + tool,
        inputHash: canonicalInputHash(args),
      });
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
      await f.preTool(session, 'agent_connect', args);
      const verified = await helper.verify('agent_connect', args);
      if (verified.status !== 200) throw new Error(String(verified.body.error));
      const client = await f.mcp();
      const result = await client.callTool({
        name: 'agent_connect',
        arguments: { ...args, contextToken: verified.body.contextToken },
      });
      if (result.isError) throw new Error(JSON.stringify(result.content));
      return result.structuredContent as Record<string, any>;
    },
    async restart() {
      await Promise.allSettled(clients.splice(0).map((client) => client.close()));
      await service.close();
      service = new NodeService(directory);
      await service.open();
      return service;
    },
  };
  return f;
}

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

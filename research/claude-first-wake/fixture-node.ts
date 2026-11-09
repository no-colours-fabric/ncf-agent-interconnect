// Research fixture, not a product component. It runs one isolated headless
// NodeService (own data directory, loopback, ephemeral ports, no peers) and an
// experimental loopback endpoint that the first-wake research mod queries.
//
// POST /first-wake/pending {sessionId} answers once, as soon as the exact native
// session has (a) a bound Claude Code agent, (b) unread ready messages and
// (c) a unique proven helper route with a current native lease. It subscribes
// before taking its first snapshot, so an arrival between them is not missed.
// A deadline is a resource limit and is reported as such, never as a wake.
//
// Usage: node --experimental-sqlite --import tsx fixture-node.ts --data <dir>
import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { NodeService } from '../../desktop/core/service.js';
import { secretMatches } from '../../desktop/core/peer.js';

const deadlineMs = () => Number(process.env.NCF_FIRST_WAKE_DEADLINE_MS ?? 20000);

export async function prepareSettings(directory: string): Promise<void> {
  const file = path.join(directory, 'settings.json');
  try {
    await readFile(file);
    return;
  } catch {
    // Created below.
  }
  const files = path.join(directory, 'Files');
  await mkdir(files, { recursive: true, mode: 0o700 });
  await writeFile(
    file,
    JSON.stringify({
      version: 1,
      nodeId: randomUUID(),
      nodeLabel: 'Isolated first-wake research node',
      localToken: randomBytes(32).toString('hex'),
      mcpPort: 0,
      peerPort: 0,
      listenHost: '127.0.0.1',
      exportRoots: [files],
      peers: [],
      adapters: [{ id: randomUUID(), kind: 'manual', label: 'Standard MCP' }],
    }),
    { mode: 0o600, flag: 'wx' },
  );
}

export interface FirstWakeAnswer {
  wake: boolean;
  nickname?: string;
  ticket: string | null;
  reason?: string;
  ids?: string[];
}

/** The pending snapshot for one exact native session. */
export function snapshot(service: NodeService, sessionId: string): FirstWakeAnswer | string {
  const profiles = service.settings.value.adapters.filter(
    (profile) => profile.kind === 'claude-code' && profile.sessionId === sessionId,
  );
  const agents = service.store
    .list()
    .filter((agent) => profiles.some((profile) => profile.id === agent.binding?.adapterId));
  if (!agents.length) return 'no-binding';
  if (agents.length > 1) return 'ambiguous-binding';
  const route = service.claude.route(sessionId);
  if (route.ambiguous) return 'ambiguous-route';
  if (!route.helper) return 'no-route';
  const agent = agents[0];
  const ready = service.store.history(agent.key, 0, 200, true).messages;
  if (!ready.length) return 'none-pending';
  return {
    wake: true,
    nickname: agent.nickname,
    ticket: randomUUID(),
    ids: ready.map((message) => message.envelope.id),
  };
}

export async function startFirstWakeEndpoint(
  service: NodeService,
  journal: string,
): Promise<{ url: string; close: () => Promise<void> }> {
  const log = (entry: Record<string, unknown>) =>
    appendFile(journal, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n', {
      mode: 0o600,
    });
  const body = async (req: http.IncomingMessage) => {
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > 16384) throw new Error('too large');
      chunks.push(Buffer.from(chunk));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  };
  const server = http.createServer((req, res) => {
    void (async () => {
      const reply = (status: number, value: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify(value));
      };
      if (
        req.method !== 'POST' ||
        req.headers.origin ||
        !secretMatches(req.headers.authorization, 'Bearer ' + service.settings.value.localToken)
      )
        return reply(401, { error: 'unauthorized' });
      if (req.url === '/first-wake/result') {
        const input = z
          .object({
            sessionId: z.uuid(),
            ticket: z.string().nullable(),
            outcome: z.string().max(4200),
          })
          .strict()
          .parse(await body(req));
        await log({ event: 'mod-result', ...input });
        return reply(200, {});
      }
      if (req.url !== '/first-wake/pending') return reply(404, { error: 'not found' });
      const { sessionId } = z
        .object({ sessionId: z.uuid() })
        .strict()
        .parse(await body(req));
      await log({ event: 'mod-query', sessionId });
      // Subscribe first, then take the snapshot: no arrival can fall between them.
      const answer = await new Promise<FirstWakeAnswer>((resolve) => {
        let last = 'pending';
        const check = () => {
          const value = snapshot(service, sessionId);
          if (typeof value === 'string') {
            last = value;
            if (value === 'no-binding' || value.startsWith('ambiguous'))
              finish({ wake: false, reason: value, ticket: null });
            return;
          }
          finish(value);
        };
        const finish = (value: FirstWakeAnswer) => {
          clearTimeout(timer);
          service.off('change', check);
          service.claude.off('change', check);
          resolve(value);
        };
        service.on('change', check);
        service.claude.on('change', check);
        const timer = setTimeout(
          () => finish({ wake: false, reason: 'deadline:' + last, ticket: null }),
          deadlineMs(),
        );
        check();
      });
      await log({ event: 'mod-answer', sessionId, ...answer });
      const { ids: _ids, ...visible } = answer;
      reply(200, visible);
    })().catch((error) => {
      if (!res.headersSent) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  return {
    url: 'http://127.0.0.1:' + port,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

if (process.argv[1]?.endsWith('fixture-node.ts')) {
  const index = process.argv.indexOf('--data');
  const directory = path.resolve(process.argv[index + 1] ?? '');
  if (index < 0 || !process.argv[index + 1]) throw new Error('--data <directory> is required');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await prepareSettings(directory);
  const service = new NodeService(directory);
  await service.open();
  const endpoint = await startFirstWakeEndpoint(
    service,
    path.join(directory, 'first-wake-journal.jsonl'),
  );
  // Research evidence: dispatch transitions with timestamps, driven by node events.
  const seen = new Map<string, string>();
  const journal = path.join(directory, 'first-wake-journal.jsonl');
  service.on('change', () => {
    for (const agent of service.store.list()) {
      for (const message of service.store.history(agent.key, 0, 200, false).messages) {
        if (message.direction !== 'in') continue;
        const state =
          message.state + '/' + (service.store.dispatchState(message.envelope.id)?.state ?? '-');
        if (seen.get(message.envelope.id) === state) continue;
        seen.set(message.envelope.id, state);
        void appendFile(
          journal,
          JSON.stringify({
            at: new Date().toISOString(),
            event: 'dispatch',
            id: message.envelope.id,
            state,
          }) + '\n',
          { mode: 0o600 },
        );
      }
    }
  });
  await writeFile(
    path.join(directory, 'research-first-wake.json'),
    JSON.stringify({ url: endpoint.url, token: service.settings.value.localToken }),
    { mode: 0o600 },
  );
  process.stdout.write(
    JSON.stringify({ ready: true, mcp: service.snapshot().mcpUrl, endpoint: endpoint.url }) + '\n',
  );
  const stop = async () => {
    await endpoint.close();
    await service.close();
    process.exit(0);
  };
  process.once('SIGTERM', () => void stop());
  process.once('SIGINT', () => void stop());
}

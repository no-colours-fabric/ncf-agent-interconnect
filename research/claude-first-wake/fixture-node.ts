// Research fixture, not a product component. It runs one isolated headless
// NodeService (own data directory, loopback, ephemeral ports, no peers) and an
// experimental loopback endpoint that the first-wake research mod queries.
//
// POST /first-wake/pending {sessionId} answers once, as soon as the exact native
// session has (a) a bound Claude Code agent, (b) unread ready messages and
// (c) a unique proven helper route with a current native lease. It subscribes
// before taking its first snapshot, so an arrival between them is not missed.
// A wake answer carries a one-use claim; /first-wake/claim consumes it right
// before the mod submits and /first-wake/start confirms it right before the
// queued notice starts a turn. A deadline is a resource limit, never a wake.
// Nothing here reads, receipts or suppresses messages or Channels offers.
//
// Usage: node --experimental-sqlite --import tsx fixture-node.ts --data <dir> [--control]
// --control adds research barriers for native experiments: /fixture/hold arms a
// barrier before the snapshot that /fixture/observe releases on a native event
// reported by the observer mod (or /fixture/release by hand), optionally with
// synthetic second arrivals; /fixture/transfer and transferOnConsume perform a
// synthetic owner-approved name transfer.
import http from 'node:http';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { NodeService } from '../../desktop/core/service.js';
import { secretMatches } from '../../desktop/core/peer.js';
import type { ClaudeProofLease } from '../../desktop/core/claude-sessions.js';

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
  claim: string | null;
  expiresAt?: string;
  reason?: string;
}

/**
 * A research-only, node-owned, one-use right to submit one wake notice. It is
 * bound to the exact native session, this node incarnation, the helper
 * lifecycle with its native lease, the agent binding and the backlog captured
 * when it was issued. It authorizes a notice, never message content: every read
 * still passes the unchanged native proof and tool-admission checks.
 */
export interface WakeClaim {
  id: string;
  session: string;
  incarnation: string;
  lease: ClaudeProofLease;
  binding: { agentKey: string; connectionId: string; adapterId: string; generation: number };
  backlog: string[];
  digest: string;
  nickname: string;
  claimBy: number;
  startBy: number;
  state: 'issued' | 'consumed' | 'started' | 'void';
}

interface Pending {
  nickname: string;
  agentKey: string;
  binding: WakeClaim['binding'];
  lease: ClaudeProofLease;
  backlog: string[];
}

const claimMs = () => Number(process.env.NCF_FIRST_WAKE_CLAIM_MS ?? 15000);
const startMs = () => Number(process.env.NCF_FIRST_WAKE_START_MS ?? 600000);

function unread(service: NodeService, agentKey: string): string[] {
  const ids: string[] = [];
  let after = 0;
  for (;;) {
    const page = service.store.history(agentKey, after, 200, true);
    ids.push(...page.messages.map((message) => message.envelope.id));
    if (!page.hasMore) return ids;
    after = page.nextCursor;
  }
}

/** The pending snapshot for one exact native session, or the reason there is none. */
export function snapshot(service: NodeService, sessionId: string): Pending | string {
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
  const helper = route.helper;
  if (!helper || helper.proven !== sessionId || !helper.nativeLeaseNonce) return 'no-route';
  const agent = agents[0];
  const backlog = unread(service, agent.key);
  if (!backlog.length) return 'none-pending';
  const binding = agent.binding!;
  return {
    nickname: agent.nickname,
    agentKey: agent.key,
    binding: {
      agentKey: agent.key,
      connectionId: binding.connectionId,
      adapterId: binding.adapterId,
      generation: binding.generation,
    },
    lease: Object.freeze({
      helperId: helper.id,
      epoch: helper.epoch,
      generation: helper.generation,
      session: sessionId,
      nativeLeaseNonce: helper.nativeLeaseNonce,
    }),
    backlog,
  };
}

/** The nickname bound to this exact native session, if exactly one. */
function boundNickname(service: NodeService, sessionId: string): string | null {
  const profiles = service.settings.value.adapters.filter(
    (profile) => profile.kind === 'claude-code' && profile.sessionId === sessionId,
  );
  const agents = service.store
    .list()
    .filter((agent) => profiles.some((profile) => profile.id === agent.binding?.adapterId));
  return agents.length === 1 ? agents[0].nickname : null;
}

const digest = (ids: string[]) => createHash('sha256').update(ids.join('\n')).digest('hex');

export class WakeClaims {
  readonly incarnation = randomUUID();
  private readonly claims = new Map<string, WakeClaim>();
  constructor(
    private readonly service: NodeService,
    private readonly now: () => number = Date.now,
  ) {}
  /** Issued synchronously from the snapshot that found the backlog. */
  issue(session: string, pending: Pending): WakeClaim {
    const now = this.now();
    for (const [id, claim] of this.claims)
      if (claim.state === 'void' || (claim.state === 'issued' && claim.claimBy <= now))
        this.claims.delete(id);
    if (this.claims.size >= 256) throw new Error('too many claims');
    const claim: WakeClaim = {
      id: randomBytes(32).toString('hex'),
      session,
      incarnation: this.incarnation,
      lease: pending.lease,
      binding: pending.binding,
      backlog: pending.backlog,
      digest: digest(pending.backlog),
      nickname: pending.nickname,
      claimBy: now + claimMs(),
      startBy: 0,
      state: 'issued',
    };
    this.claims.set(claim.id, claim);
    return claim;
  }
  /** Why this claim no longer describes the current lifecycle, or null. Synchronous. */
  private stale(claim: WakeClaim): string | null {
    if (claim.incarnation !== this.incarnation) return 'incarnation';
    try {
      this.service.claude.validateCurrentSync(claim.lease);
    } catch {
      return 'revoked:helper';
    }
    const profile = this.service.settings.value.adapters.find(
      (item) => item.id === claim.binding.adapterId,
    );
    if (profile?.kind !== 'claude-code' || profile.sessionId !== claim.session)
      return 'revoked:profile';
    const agent = this.service.store.list().find((item) => item.key === claim.binding.agentKey);
    const binding = agent?.binding;
    if (
      !binding ||
      binding.connectionId !== claim.binding.connectionId ||
      binding.adapterId !== claim.binding.adapterId ||
      binding.generation !== claim.binding.generation
    )
      return 'revoked:binding';
    if (!claim.backlog.some((id) => this.service.store.get(id, 'in')?.state === 'ready'))
      return 'backlog-read';
    return null;
  }
  private find(session: string, id: string): WakeClaim | string {
    const claim = this.claims.get(id);
    if (!claim) return 'unknown';
    // A foreign session never learns about or spends another session's claim.
    if (claim.session !== session) return 'unknown';
    return claim;
  }
  /** Consume once. Every failure leaves the backlog untouched. */
  async consume(session: string, id: string): Promise<{ ok: boolean; reason?: string }> {
    const found = this.find(session, id);
    if (typeof found === 'string') return { ok: false, reason: found };
    if (found.state !== 'issued') return { ok: false, reason: 'replayed' };
    // The native lease file is read asynchronously, then everything is rechecked
    // synchronously in the same tick as the state change.
    try {
      await this.service.claude.validateCurrent(found.lease);
    } catch {
      // Rechecked below.
    }
    return this.transition(found, 'issued', 'consumed');
  }
  /** The queued notice is about to start a turn. Same checks, once. */
  async start(session: string, id: string): Promise<{ ok: boolean; reason?: string }> {
    const found = this.find(session, id);
    if (typeof found === 'string') return { ok: false, reason: found };
    if (found.state !== 'consumed') return { ok: false, reason: 'replayed' };
    try {
      await this.service.claude.validateCurrent(found.lease);
    } catch {
      // Rechecked below.
    }
    return this.transition(found, 'consumed', 'started');
  }
  private transition(
    claim: WakeClaim,
    from: WakeClaim['state'],
    to: WakeClaim['state'],
  ): { ok: boolean; reason?: string } {
    if (claim.state !== from) return { ok: false, reason: 'replayed' };
    const now = this.now();
    if (from === 'issued' ? claim.claimBy <= now : claim.startBy <= now) {
      claim.state = 'void';
      return { ok: false, reason: 'expired' };
    }
    const reason = this.stale(claim);
    if (reason) {
      claim.state = 'void';
      return { ok: false, reason };
    }
    claim.state = to;
    if (to === 'consumed') claim.startBy = now + startMs();
    return { ok: true };
  }
  get(id: string): WakeClaim | undefined {
    return this.claims.get(id);
  }
}

export async function startFirstWakeEndpoint(
  service: NodeService,
  journal: string,
  options: { control?: boolean; claims?: WakeClaims } = {},
): Promise<{ url: string; claims: WakeClaims; close: () => Promise<void> }> {
  const claims = options.claims ?? new WakeClaims(service);
  // Research control: a barrier before the snapshot, released by an observed
  // native event or by the operator, never by a timer.
  let gate: { wait: Promise<void>; open: () => void } | null = null;
  let armed: { trigger: string; send: number; transferOnConsume: boolean } | null = null;
  let senderConnection: string | null = null;
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
  const claimInput = z.object({ sessionId: z.uuid(), claim: z.string().regex(/^[0-9a-f]{64}$/) });
  // A synthetic owner-approved transfer of the name to a manual MCP chat.
  const transfer = (nickname: string): string => {
    const target = {
      nickname,
      client: 'MCP',
      chatId: randomUUID(),
      adapterId: service.settings.value.adapters.find((item) => item.kind === 'manual')!.id,
    };
    const request = service.connect(target);
    if (request.status !== 'nickname_in_use') return request.status;
    return service.connect({
      ...target,
      connectionId: request.connectionId,
      transferId: request.transferId,
      confirmTransfer: true,
    }).status;
  };
  // The fixture's own synthetic sender, reconnected through an approved transfer.
  const sender = (): string => {
    if (senderConnection) return senderConnection;
    const target = { nickname: 'rr-Fixture-sender', client: 'MCP', chatId: randomUUID() };
    let result = service.connect(target);
    if (result.status === 'nickname_in_use')
      result = service.connect({
        ...target,
        connectionId: result.connectionId,
        transferId: result.transferId,
        confirmTransfer: true,
      });
    if (result.status !== 'connected') throw new Error('fixture sender unavailable');
    senderConnection = result.binding.connectionId;
    return senderConnection;
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
            claim: z.string().nullable(),
            outcome: z.string().max(4200),
          })
          .strict()
          .parse(await body(req));
        await log({ event: 'mod-result', ...input });
        return reply(200, {});
      }
      if (req.url === '/first-wake/claim' || req.url === '/first-wake/start') {
        const input = claimInput.strict().parse(await body(req));
        const consuming = req.url === '/first-wake/claim';
        const result = consuming
          ? await claims.consume(input.sessionId, input.claim)
          : await claims.start(input.sessionId, input.claim);
        await log({
          event: consuming ? 'claim-consume' : 'claim-start',
          sessionId: input.sessionId,
          claim: input.claim,
          ...result,
        });
        // Research boundary: an approved transfer after consumption, before the
        // mod receives the answer and submits its notice.
        if (consuming && result.ok && armed?.transferOnConsume) {
          armed = null;
          const nickname = claims.get(input.claim)?.nickname;
          if (nickname)
            await log({ event: 'fixture-transfer', nickname, status: transfer(nickname) });
        }
        return reply(
          200,
          consuming
            ? { consumed: result.ok, reason: result.reason }
            : { started: result.ok, reason: result.reason },
        );
      }
      if (options.control && req.url === '/fixture/observe') {
        const input = z
          .object({
            sessionId: z.uuid(),
            event: z.string().max(64),
            detail: z.record(z.string(), z.union([z.string().max(200), z.boolean()])),
          })
          .strict()
          .parse(await body(req));
        await log({
          event: 'observed',
          native: input.event,
          sessionId: input.sessionId,
          ...input.detail,
        });
        const fire =
          armed &&
          gate &&
          ((armed.trigger === 'turn.start' && input.event === 'turn.start') ||
            (armed.trigger === 'draft' &&
              input.event === 'draft' &&
              input.detail.present === true) ||
            (armed.trigger === 'ask' &&
              input.event === 'tool.check' &&
              input.detail.decision === 'ask') ||
            (armed.trigger === 'question' && input.event === 'question') ||
            (armed.trigger === 'session.end' && input.event === 'session.end'));
        if (fire) {
          const count = armed!.send;
          armed = armed!.transferOnConsume ? { ...armed!, trigger: 'none', send: 0 } : null;
          // Second arrivals are stored before the held query takes its snapshot.
          const nickname = boundNickname(service, input.sessionId);
          for (let index = 0; index < count && nickname; index++) {
            const sent = await service.send({
              connectionId: sender(),
              recipientNode: service.settings.value.nodeId,
              recipientNickname: nickname,
              text:
                'Synthetic second arrival ' + (index + 1) + ' (' + new Date().toISOString() + ')',
            });
            await log({ event: 'fixture-send', id: sent.id });
          }
          gate!.open();
          gate = null;
          await log({ event: 'fixture-release', on: input.event });
        }
        return reply(200, {});
      }
      if (options.control && req.url?.startsWith('/fixture/')) {
        const input = z
          .object({
            nickname: z.string().max(120).optional(),
            trigger: z
              .enum(['manual', 'turn.start', 'draft', 'ask', 'question', 'session.end'])
              .optional(),
            send: z.number().int().min(0).max(5).optional(),
            transferOnConsume: z.boolean().optional(),
          })
          .strict()
          .parse(await body(req));
        if (req.url === '/fixture/hold') {
          let open!: () => void;
          const wait = new Promise<void>((resolve) => (open = resolve));
          gate = { wait, open };
          armed = {
            trigger: input.trigger ?? 'manual',
            send: input.send ?? 0,
            transferOnConsume: input.transferOnConsume ?? false,
          };
          await log({ event: 'fixture-hold', ...armed });
          return reply(200, {});
        } else if (req.url === '/fixture/arm') {
          // No barrier: only the transfer after the next consumption.
          armed = { trigger: 'none', send: 0, transferOnConsume: input.transferOnConsume ?? false };
          await log({ event: 'fixture-arm', ...armed });
          return reply(200, {});
        } else if (req.url === '/fixture/release') {
          gate?.open();
          gate = null;
          armed = null;
        } else if (req.url === '/fixture/transfer' && input.nickname) {
          const status = transfer(input.nickname);
          await log({ event: 'fixture-transfer', nickname: input.nickname, status });
          return reply(200, { status });
        } else return reply(404, { error: 'not found' });
        await log({ event: 'fixture-' + req.url.slice('/fixture/'.length) });
        return reply(200, {});
      }
      if (req.url !== '/first-wake/pending') return reply(404, { error: 'not found' });
      const { sessionId } = z
        .object({ sessionId: z.uuid() })
        .strict()
        .parse(await body(req));
      await log({ event: 'mod-query', sessionId, held: !!gate });
      if (gate) await gate.wait;
      // Subscribe first, then take the snapshot: no arrival can fall between them.
      // The claim is issued in the same synchronous step as the snapshot that found it.
      const answer = await new Promise<{ answer: FirstWakeAnswer; claim?: WakeClaim }>(
        (resolve) => {
          let last = 'pending';
          const check = () => {
            const value = snapshot(service, sessionId);
            if (typeof value === 'string') {
              last = value;
              if (value === 'no-binding' || value.startsWith('ambiguous'))
                finish({ answer: { wake: false, reason: value, claim: null } });
              return;
            }
            const claim = claims.issue(sessionId, value);
            finish({
              answer: {
                wake: true,
                nickname: value.nickname,
                claim: claim.id,
                expiresAt: new Date(claim.claimBy).toISOString(),
              },
              claim,
            });
          };
          const finish = (value: { answer: FirstWakeAnswer; claim?: WakeClaim }) => {
            clearTimeout(timer);
            service.off('change', check);
            service.claude.off('change', check);
            resolve(value);
          };
          service.on('change', check);
          service.claude.on('change', check);
          const timer = setTimeout(
            () => finish({ answer: { wake: false, reason: 'deadline:' + last, claim: null } }),
            deadlineMs(),
          );
          check();
        },
      );
      await log({
        event: 'mod-answer',
        sessionId,
        ...answer.answer,
        ...(answer.claim
          ? {
              ids: answer.claim.backlog,
              digest: answer.claim.digest,
              epoch: answer.claim.lease.epoch,
              helperGeneration: answer.claim.lease.generation,
              bindingGeneration: answer.claim.binding.generation,
              incarnation: answer.claim.incarnation,
            }
          : {}),
      });
      reply(200, answer.answer);
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
    claims,
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
    { control: process.argv.includes('--control') },
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

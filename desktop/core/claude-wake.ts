import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AdapterProfile } from '../shared/contracts.js';
import type { AgentStore } from './agent-store.js';
import type { ClaudeProofLease, ClaudeSessions } from './claude-sessions.js';

/**
 * Wake claims for the installed Claude Code mod path. A claim is a node-owned,
 * one-use right to submit one wake notice in one exact native session. It is
 * bound to this node incarnation, the helper lifecycle with its native lease,
 * the agent binding and the backlog captured when it was issued. It authorizes
 * a notice, never message content: every read still passes the native proof,
 * call permit and tool admission, and nothing here reads, receipts or hides
 * messages.
 */
export interface WakeClaim {
  id: string;
  session: string;
  incarnation: string;
  lease: ClaudeProofLease;
  binding: { agentKey: string; connectionId: string; adapterId: string; generation: number };
  backlog: string[];
  nickname: string;
  /** The exact notice text the mod submits; the gate names it by its hash. */
  notice: string;
  noticeHash: string;
  claimBy: number;
  startBy: number;
  state: 'issued' | 'consumed' | 'started' | 'void';
}

export interface WakePending {
  nickname: string;
  binding: WakeClaim['binding'];
  lease: ClaudeProofLease;
  backlog: string[];
}

/** What the claims need from the node, without a dependency on NodeService. */
export interface WakeAuthority {
  claude: Pick<ClaudeSessions, 'route' | 'validateCurrent' | 'validateCurrentSync'>;
  profiles(): AdapterProfile[];
  store: Pick<AgentStore, 'list' | 'get' | 'history'>;
}

export const wakeNoticePrefix = 'NCF Agent Interconnect messages are waiting for agent ';

/** One notice per claim: the random reference makes the text, and its hash, unique. */
export function wakeNoticeText(nickname: string, reference: string): string {
  return (
    wakeNoticePrefix +
    JSON.stringify(nickname) +
    ' in this chat. Call agent_read for this agent now and continue with nextCursor while hasMore is true. This notice contains no message content. Wake reference ' +
    reference +
    '.'
  );
}

export const wakeNoticeHash = (text: string) =>
  createHash('sha256').update(text, 'utf8').digest('hex');

function unread(store: WakeAuthority['store'], agentKey: string): string[] {
  const ids: string[] = [];
  let after = 0;
  for (;;) {
    const page = store.history(agentKey, after, 200, true);
    ids.push(...page.messages.map((message) => message.envelope.id));
    if (!page.hasMore) return ids;
    after = page.nextCursor;
  }
}

/** The pending backlog of one exact native session, or the reason there is none. */
export function wakePending(authority: WakeAuthority, sessionId: string): WakePending | string {
  const profiles = authority
    .profiles()
    .filter((profile) => profile.kind === 'claude-code' && profile.sessionId === sessionId);
  const agents = authority.store
    .list()
    .filter((agent) => profiles.some((profile) => profile.id === agent.binding?.adapterId));
  if (!agents.length) return 'no-binding';
  if (agents.length > 1) return 'ambiguous-binding';
  const route = authority.claude.route(sessionId);
  if (route.ambiguous) return 'ambiguous-route';
  const helper = route.helper;
  if (!helper || helper.proven !== sessionId || !helper.nativeLeaseNonce) return 'no-route';
  const agent = agents[0];
  const backlog = unread(authority.store, agent.key);
  if (!backlog.length) return 'none-pending';
  const binding = agent.binding!;
  return {
    nickname: agent.nickname,
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

const activeLimit = 256;
const tombstoneLimit = 1024;

export class WakeClaims {
  readonly incarnation = randomUUID();
  private readonly claims = new Map<string, WakeClaim>();
  /** Bounded memory of finished claims and notices, so a replay reads as one. */
  private readonly finished = new Map<string, string>();
  constructor(
    private readonly authority: WakeAuthority,
    private readonly now: () => number = Date.now,
    private readonly lifetimes: { claim: number; start: number } = {
      claim: 15000,
      start: 600000,
    },
  ) {}
  private finish(claim: WakeClaim, state: 'started' | 'void', reason: string): void {
    claim.state = state;
    this.claims.delete(claim.id);
    for (const key of [claim.id, claim.noticeHash]) {
      this.finished.delete(key);
      this.finished.set(key, state === 'started' ? 'replayed' : reason);
    }
    while (this.finished.size > tombstoneLimit)
      this.finished.delete(this.finished.keys().next().value!);
  }
  /** Reclaim expired authority; active authority is never evicted. */
  private reclaim(): void {
    const now = this.now();
    for (const claim of [...this.claims.values()])
      if (
        (claim.state === 'issued' && claim.claimBy <= now) ||
        (claim.state === 'consumed' && claim.startBy <= now)
      )
        this.finish(claim, 'void', 'expired');
  }
  /** Issued synchronously from the snapshot that found the backlog. */
  issue(session: string, pending: WakePending): WakeClaim {
    this.reclaim();
    // A new wake for this session supersedes its earlier unfinished claims.
    for (const claim of [...this.claims.values()])
      if (claim.session === session) this.finish(claim, 'void', 'superseded');
    if (this.claims.size >= activeLimit) throw new Error('Too many active wake claims');
    const now = this.now();
    const notice = wakeNoticeText(pending.nickname, randomBytes(12).toString('hex'));
    const claim: WakeClaim = {
      id: randomBytes(32).toString('hex'),
      session,
      incarnation: this.incarnation,
      lease: pending.lease,
      binding: pending.binding,
      backlog: pending.backlog,
      nickname: pending.nickname,
      notice,
      noticeHash: wakeNoticeHash(notice),
      claimBy: now + this.lifetimes.claim,
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
      this.authority.claude.validateCurrentSync(claim.lease);
    } catch {
      return 'revoked:helper';
    }
    const profile = this.authority.profiles().find((item) => item.id === claim.binding.adapterId);
    if (profile?.kind !== 'claude-code' || profile.sessionId !== claim.session)
      return 'revoked:profile';
    const binding = this.authority.store
      .list()
      .find((item) => item.key === claim.binding.agentKey)?.binding;
    if (
      !binding ||
      binding.connectionId !== claim.binding.connectionId ||
      binding.adapterId !== claim.binding.adapterId ||
      binding.generation !== claim.binding.generation
    )
      return 'revoked:binding';
    // The notice tells Claude to read until nothing is left, so it stays useful
    // while any message of this agent is unread and not already being delivered.
    if (!this.authority.store.history(claim.binding.agentKey, 0, 1, true, true).messages.length)
      return 'backlog-read';
    return null;
  }
  /**
   * A notice of this session is queued in Claude Code and still current: a
   * later arrival is covered by it instead of queueing another notice.
   */
  queued(session: string): boolean {
    this.reclaim();
    return [...this.claims.values()].some(
      (claim) => claim.session === session && claim.state === 'consumed' && !this.stale(claim),
    );
  }
  /** Claude Code dropped the submitted notice (Stop, Esc or a refusal); it is never resubmitted. */
  dropped(session: string, id: string): boolean {
    const found = this.claims.get(id);
    if (!found || found.session !== session || found.state !== 'consumed') return false;
    this.finish(found, 'void', 'dropped');
    return true;
  }
  private refusal(key: string): string {
    return this.finished.get(key) ?? 'unknown';
  }
  /** Consume once, by claim id, in the session it was issued to. */
  async consume(session: string, id: string): Promise<{ ok: boolean; reason?: string }> {
    this.reclaim();
    const found = this.claims.get(id);
    // A foreign session never learns about or spends another session's claim.
    if (!found || found.session !== session) return { ok: false, reason: this.refusal(id) };
    if (found.state !== 'issued') return { ok: false, reason: 'replayed' };
    try {
      await this.authority.claude.validateCurrent(found.lease);
    } catch {
      // Rechecked below.
    }
    return this.transition(found, 'issued', 'consumed');
  }
  /**
   * The queued notice is about to start a turn: the gate names the exact notice
   * by its text hash, so an older notice can never start a newer claim.
   */
  async start(session: string, hash: string): Promise<{ ok: boolean; reason?: string }> {
    this.reclaim();
    const found = [...this.claims.values()].find(
      (claim) => claim.noticeHash === hash && claim.session === session,
    );
    if (!found) return { ok: false, reason: this.refusal(hash) };
    if (found.state !== 'consumed') return { ok: false, reason: 'not-consumed' };
    try {
      await this.authority.claude.validateCurrent(found.lease);
    } catch {
      // Rechecked below.
    }
    return this.transition(found, 'consumed', 'started');
  }
  private transition(
    claim: WakeClaim,
    from: WakeClaim['state'],
    to: 'consumed' | 'started',
  ): { ok: boolean; reason?: string } {
    if (claim.state !== from || this.claims.get(claim.id) !== claim)
      return { ok: false, reason: 'replayed' };
    const now = this.now();
    if (from === 'issued' ? claim.claimBy <= now : claim.startBy <= now) {
      this.finish(claim, 'void', 'expired');
      return { ok: false, reason: 'expired' };
    }
    const reason = this.stale(claim);
    if (reason) {
      this.finish(claim, 'void', reason);
      return { ok: false, reason };
    }
    if (to === 'started') this.finish(claim, 'started', 'replayed');
    else {
      claim.state = 'consumed';
      claim.startBy = now + this.lifetimes.start;
    }
    return { ok: true };
  }
  get(id: string): WakeClaim | undefined {
    return this.claims.get(id);
  }
  /** Active claims only; finished ones are reclaimed. */
  get size(): number {
    this.reclaim();
    return this.claims.size;
  }
}

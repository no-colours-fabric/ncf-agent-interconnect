import type { AdapterProfile, AdapterState } from '../shared/contracts.js';
import {
  agentMessageText,
  type Admission,
  type AgentAdapter,
  type EventInput,
} from './adapters.js';
import type { ClaudeHelper, ClaudeSessions } from './claude-sessions.js';

/**
 * Offers node-owned content to one exact Claude Code session. The installed
 * main/gate modules admit a full incoming prompt and report its stored row.
 * Offers alone never create receipt. Without the current native content stream,
 * keep the inbox available for explicit MCP reads; never replace delivery with
 * an automatic instruction telling the model to read it.
 */
export class ClaudeCodeAdapter implements AgentAdapter {
  readonly wakeOnly = true;
  private offers = new Map<string, { lifecycleKey: string; connectionId: string }>();
  private stopped = false;
  private routed?: string;
  private renewed = new Map<string, { lifecycleKey: string; connectionId: string }>();
  private revision = 0;
  /** Selection eligibility changed without a mailbox or helper lifecycle change. */
  get offerRevision(): number {
    return this.revision;
  }
  get nativeIncomingAvailable(): boolean {
    return this.sessions.wakeSink(this.profile.sessionId)?.nativeIncoming === 1;
  }
  private readonly listener = () => this.observe();
  /** A dropped notice no longer covers the backlog; nothing is announced until the next event. */
  private readonly wakeDropped = (session: string, connectionId?: string) => {
    if (session !== this.profile.sessionId) return;
    const helper = this.current().helper;
    if (connectionId) helper?.outstanding.delete(connectionId);
    else helper?.outstanding.clear();
    for (const [id, offer] of this.offers)
      if (helper && (!connectionId || offer.connectionId === connectionId)) this.offers.delete(id);
    this.revision++;
  };
  /**
   * After a turn ends, a message still offered in this lifecycle is announced
   * once more: the model may have seen the event mid-turn and deferred it.
   * Each message is renewed at most once per binding and helper lifecycle,
   * so a model that keeps deferring cannot cause a loop.
   */
  private readonly turnEnded = (session: string) => {
    if (session !== this.profile.sessionId) return;
    const helper = this.current().helper;
    if (!helper) return;
    const lifecycleKey = this.lifecycle(helper);
    let renew = false;
    for (const [id, offer] of this.offers) {
      const renewal = this.renewed.get(id);
      if (
        offer.lifecycleKey !== lifecycleKey ||
        (renewal?.lifecycleKey === lifecycleKey && renewal.connectionId === offer.connectionId)
      )
        continue;
      this.renewed.set(id, { lifecycleKey, connectionId: offer.connectionId });
      this.offers.delete(id);
      helper.outstanding.delete(offer.connectionId);
      renew = true;
    }
    if (renew) {
      this.revision++;
      this.idle();
    }
  };
  constructor(
    readonly profile: AdapterProfile,
    private readonly sessions: ClaudeSessions,
    private readonly changed: () => void,
    private readonly idle: () => void,
  ) {}
  private current(): { helper?: ClaudeHelper; ambiguous: boolean } {
    if (this.stopped || !this.profile.sessionId) return { ambiguous: false };
    return this.sessions.route(this.profile.sessionId);
  }
  private lifecycle(helper: ClaudeHelper): string {
    // A wake stream attaching or leaving starts a new offer lifecycle, so the
    // backlog announced before it is offered again through it.
    return [
      helper.id,
      helper.epoch,
      helper.generation,
      helper.nativeLeaseNonce,
      this.sessions.wakeSink(helper.proven)?.id ?? '',
    ].join(':');
  }
  private observe(): void {
    const route = this.current();
    const lifecycleKey = route.helper ? this.lifecycle(route.helper) : undefined;
    if (lifecycleKey !== this.routed) {
      this.routed = lifecycleKey;
      if (lifecycleKey) this.idle();
    }
    this.changed();
  }
  status(): AdapterState {
    const route = this.current();
    const base = {
      id: this.profile.id,
      label: this.profile.label,
      kind: 'claude-code' as const,
      capabilities: {
        // Permit experimental wake attempts; this is not evidence of idle wake.
        wakeIdle: true,
        receiveActive: false,
        nativeDisplay: false,
        exactSession: true,
      },
    };
    if (route.ambiguous)
      return {
        ...base,
        state: 'error',
        error:
          'More than one Claude Code process claims this chat; channel notifications are paused',
      };
    if (!route.helper)
      return {
        ...base,
        state: 'error',
        error: 'This Claude Code chat is not connected through the NCF plugin',
      };
    // A gate verdict proves permission to submit a wake, not the client's
    // ability to read it (the first-resume bootstrap remains under diagnosis).
    // Keep delivery unverified until there is a supported native readiness proof.
    const sink = this.sessions.wakeSink(route.helper.proven);
    return {
      ...base,
      state: 'manual',
      error: sink
        ? 'Automatic wake is set up in this chat but not verified yet; messages remain available through agent_read'
        : 'Automatic wake is unavailable in this chat: the NCF mod is not running (Claude Code safe mode, an organization policy or an older client). Messages remain available through agent_read',
    };
  }
  async start(): Promise<void> {
    this.sessions.on('change', this.listener);
    this.sessions.on('turnEnded', this.turnEnded);
    this.sessions.on('wakeDropped', this.wakeDropped);
    const helper = this.current().helper;
    this.routed = helper ? this.lifecycle(helper) : undefined;
  }
  async deliver(input: EventInput): Promise<Admission> {
    const route = this.current();
    if (!route.helper)
      return {
        state: 'waiting',
        error: route.ambiguous
          ? 'The Claude Code chat is ambiguous'
          : 'Claude Code is not connected',
      };
    const helper = route.helper;
    if (!input.systemEvent && this.sessions.wakeSink(helper.proven)?.nativeIncoming !== 1)
      return {
        state: 'waiting',
        error:
          'The native incoming-message mod is unavailable; reconnect the NCF plugin in this exact chat',
      };
    const lifecycleKey = this.lifecycle(helper);
    if (input.isCurrent && !input.isCurrent()) return { state: 'revoked' };
    const key = input.binding.connectionId;
    // A wake covers messages already queued when it was sent. A later arrival
    // gets its own wake, so an ignored or dropped event cannot stall the inbox.
    const covered = helper.outstanding.get(key);
    if (
      !input.systemEvent &&
      covered !== undefined &&
      (input.sequence === undefined || input.sequence <= covered)
    ) {
      this.offers.set(input.messageId, { lifecycleKey, connectionId: key });
      return { state: 'offered' };
    }
    const viaMod = input.systemEvent ? 'none' : this.sessions.sendWake(helper, key);
    if (viaMod === 'failed')
      return { state: 'failed', error: 'The NCF wake stream is unavailable' };
    const sent = input.systemEvent
      ? this.sessions.send(helper, { type: 'notice', text: agentMessageText(input) })
      : viaMod === 'sent';
    if (!sent) return { state: 'failed', error: 'The Claude Code helper disconnected' };
    if (!input.systemEvent)
      helper.outstanding.set(
        key,
        Math.max(covered ?? 0, input.backlogUntil ?? input.sequence ?? Number.MAX_SAFE_INTEGER),
      );
    this.offers.set(input.messageId, { lifecycleKey, connectionId: key });
    return { state: 'offered' };
  }
  offerCurrent(messageId: string): boolean {
    const offer = this.offers.get(messageId);
    const helper = this.current().helper;
    return !!offer && !!helper && offer.lifecycleKey === this.lifecycle(helper);
  }
  /** A newly ready message may predate the physical sequence covered by an earlier wake. */
  messageReady(connectionId: string): void {
    this.current().helper?.outstanding.delete(connectionId);
  }
  /** Continue a native page without invalidating or recensus of unchanged ready rows. */
  nativeCommitted(connectionId: string, ids: string[], remaining: boolean): void {
    for (const id of ids) {
      if (this.offers.get(id)?.connectionId === connectionId) this.offers.delete(id);
      if (this.renewed.get(id)?.connectionId === connectionId) this.renewed.delete(id);
    }
    const helper = this.current().helper;
    if (!helper) return;
    helper.outstanding.delete(connectionId);
    // This commit is the event. The issuer captures a fresh bounded private
    // page under the same current connection; it never replays fenced content.
    if (remaining && this.sessions.wakeSink(helper.proven)?.nativeIncoming === 1)
      this.sessions.sendWake(helper, connectionId);
  }

  /** Called before agent_read queries the inbox, so later arrivals get a new wake. */
  beforeRead(connectionId: string): void {
    this.current().helper?.outstanding.delete(connectionId);
  }
  /** A read that leaves ready messages offers once more; this is event driven, not polling. */
  afterRead(connectionId: string, remaining: boolean): void {
    if (!remaining) {
      for (const [id, offer] of this.offers)
        if (offer.connectionId === connectionId) this.offers.delete(id);
      for (const [id, renewal] of this.renewed)
        if (renewal.connectionId === connectionId) this.renewed.delete(id);
      return;
    }
    const helper = this.current().helper;
    if (!helper) return;
    let removed = false;
    for (const [id, offer] of this.offers)
      if (offer.connectionId === connectionId) {
        this.offers.delete(id);
        removed = true;
      }
    if (removed) this.revision++;
    this.idle();
  }
  async stop(): Promise<void> {
    this.stopped = true;
    this.sessions.off('change', this.listener);
    this.sessions.off('turnEnded', this.turnEnded);
    this.sessions.off('wakeDropped', this.wakeDropped);
    this.offers.clear();
    this.renewed.clear();
    this.changed();
  }
}

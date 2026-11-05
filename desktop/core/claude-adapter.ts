import type { AdapterProfile, AdapterState } from '../shared/contracts.js';
import {
  agentMessageText,
  type Admission,
  type AgentAdapter,
  type EventInput,
} from './adapters.js';
import type { ClaudeHelper, ClaudeSessions } from './claude-sessions.js';

/**
 * Wake-only delivery to one exact Claude Code session. A channel notification
 * is never acknowledged by Claude Code, so an offer is not a receipt: the
 * message stays queued until agent_read returns it.
 */
export class ClaudeCodeAdapter implements AgentAdapter {
  readonly wakeOnly = true;
  private offers = new Map<string, { epoch: string; connectionId: string }>();
  private stopped = false;
  private routed?: string;
  private readonly listener = () => this.observe();
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
  private observe(): void {
    const route = this.current();
    const epoch = route.helper?.epoch;
    if (epoch !== this.routed) {
      this.routed = epoch;
      if (epoch) this.idle();
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
        error: 'More than one Claude Code process claims this chat; automatic delivery is paused',
      };
    if (!route.helper)
      return {
        ...base,
        state: 'error',
        error: 'This Claude Code chat is not connected through the NCF plugin',
      };
    if (!route.helper.confirmed)
      return {
        ...base,
        state: 'checking',
        error:
          'Channel delivery is not confirmed yet; messages remain available through agent_read',
      };
    return { ...base, state: 'ready', error: null };
  }
  async start(): Promise<void> {
    this.sessions.on('change', this.listener);
    this.routed = this.current().helper?.epoch;
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
      this.offers.set(input.messageId, { epoch: helper.epoch, connectionId: key });
      return { state: 'offered' };
    }
    const sent = this.sessions.send(
      helper,
      input.systemEvent
        ? { type: 'notice', text: agentMessageText(input) }
        : { type: 'wake', nickname: input.nickname },
    );
    if (!sent) return { state: 'failed', error: 'The Claude Code helper disconnected' };
    if (!input.systemEvent)
      helper.outstanding.set(
        key,
        Math.max(covered ?? 0, input.backlogUntil ?? input.sequence ?? Number.MAX_SAFE_INTEGER),
      );
    this.offers.set(input.messageId, { epoch: helper.epoch, connectionId: key });
    return { state: 'offered' };
  }
  offerCurrent(messageId: string): boolean {
    const offer = this.offers.get(messageId);
    return !!offer && offer.epoch === this.current().helper?.epoch;
  }
  /** Called before agent_read queries the inbox, so later arrivals get a new wake. */
  beforeRead(connectionId: string): void {
    this.current().helper?.outstanding.delete(connectionId);
  }
  /** A read that leaves ready messages offers once more; this is event driven, not polling. */
  afterRead(connectionId: string, remaining: boolean): void {
    if (!remaining) return;
    const helper = this.current().helper;
    if (!helper) return;
    for (const [id, offer] of this.offers)
      if (offer.connectionId === connectionId) this.offers.delete(id);
    this.idle();
  }
  async stop(): Promise<void> {
    this.stopped = true;
    this.sessions.off('change', this.listener);
    this.offers.clear();
    this.changed();
  }
}

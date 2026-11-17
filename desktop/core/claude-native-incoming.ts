import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { AdapterProfile, Message } from '../shared/contracts.js';
import { nicknameKey } from '../shared/contracts.js';
import type { AgentMessageInput } from './adapters.js';
import type { AgentStore } from './agent-store.js';
import type { ClaudeSessions } from './claude-sessions.js';
import type { WakeClaim, WakeClaims } from './claude-wake.js';
import {
  formatAgentMessagePresentation,
  type MessageDisplayContext,
} from './message-presentation.js';
import {
  nativeClaudeBodyLimit,
  nativeClaudeHash,
  nativeClaudeRowHash,
  nativeClaudeTransport,
  nativeClaudeTrigger,
} from './claude-native-content.js';

const sessionId = z.uuid().transform((value) => value.toLowerCase());
const key = z.string().regex(/^[a-f0-9]{64}$/);
const prepareSchema = z.object({ sessionId, claim: key }).strict();
const admitSchema = z
  .object({ sessionId, delivery: z.uuid(), nativeLeaseNonce: z.uuid() })
  .strict();
const reportSchema = z
  .object({
    sessionId,
    delivery: z.uuid(),
    reportKey: key,
    phase: z.enum(['stored', 'dropped', 'uncertain', 'not-submitted']),
    storedRowId: z.string().min(1).max(200).optional(),
    representationHash: key.optional(),
  })
  .strict();
const sameSecret = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

interface Operation {
  id: string;
  claim: WakeClaim;
  requestScope: string;
  reportKeyHash: string;
  sinkId: string;
  gated: boolean;
  admitting: boolean;
  body: string;
  receiverContext: string;
  retired: boolean;
  expiresAt: number;
  cleanup(): void;
}

interface Authority {
  claude: Pick<
    ClaudeSessions,
    'wakeSink' | 'validateCurrentSync' | 'validateCurrent' | 'wakeDropped'
  >;
  claims: WakeClaims;
  store(): AgentStore;
  profiles(): AdapterProfile[];
  ready(): boolean;
  presentationNow(): number;
  messageDisplayContext(): MessageDisplayContext;
  materialize(message: Message): Promise<AgentMessageInput['files']>;
  committed(connectionId: string, ids: string[]): Promise<void>;
  changed?(): void;
  trace?(id: string, state: 'reserved' | 'issued' | 'cancelled' | 'uncertain' | 'committed'): void;
}

interface NativePrepared {
  delivery: string;
  reportKey: string;
  trigger: string;
  envelopeHash: string;
  representationHashes: string[];
  expiresAt: number;
}

/** Claude-private native admissions using the existing durable receipt ledger. */
export class ClaudeNativeIncoming {
  private operations = new Map<string, Operation>();
  constructor(private readonly authority: Authority) {}

  private current(operation: Operation, requireClaim = false): void {
    const { claude, claims } = this.authority;
    if (
      !this.authority.ready() ||
      operation.retired ||
      operation.expiresAt <= Date.now() ||
      this.operations.get(operation.id) !== operation ||
      claude.wakeSink(operation.claim.session)?.id !== operation.sinkId ||
      (requireClaim && claims.get(operation.claim.id) !== operation.claim)
    )
      throw new Error('The native Claude Code delivery scope is no longer current');
    const captured = this.authority.store().claudeDelivery(operation.id);
    if (
      !captured ||
      !['reserved', 'issued'].includes(captured.state) ||
      captured.scope.transport !== nativeClaudeTransport ||
      captured.scope.requestScope !== operation.requestScope ||
      captured.scope.reportKeyHash !== operation.reportKeyHash ||
      captured.connectionId !== operation.claim.binding.connectionId ||
      captured.scope.sinkId !== operation.sinkId ||
      captured.scope.incarnation !== claims.incarnation ||
      captured.scope.claimHash !== nativeClaudeHash(operation.claim.id) ||
      captured.helperId !== operation.claim.lease.helperId ||
      captured.scope.session !== operation.claim.session ||
      captured.scope.epoch !== operation.claim.lease.epoch ||
      captured.scope.generation !== operation.claim.lease.generation ||
      captured.scope.nativeLeaseNonce !== operation.claim.lease.nativeLeaseNonce
    )
      throw new Error('The captured native Claude Code request scope changed');
    claude.validateCurrentSync(operation.claim.lease);
    const owner = this.authority.store().assertOwner(operation.claim.binding.connectionId);
    const profile = this.authority
      .profiles()
      .find((value) => value.id === operation.claim.binding.adapterId);
    if (
      owner.key !== operation.claim.binding.agentKey ||
      owner.binding.generation !== operation.claim.binding.generation ||
      profile?.kind !== 'claude-code' ||
      profile.sessionId !== operation.claim.session
    )
      throw new Error('The native Claude Code delivery binding changed');
    this.authority.store().assertClaudeDeliveryCurrent(operation.id);
  }

  private async validate(operation: Operation, requireClaim = false): Promise<void> {
    this.current(operation, requireClaim);
    await this.authority.claude.validateCurrent(operation.claim.lease);
    this.current(operation, requireClaim);
  }

  private retire(operation: Operation): void {
    operation.retired = true;
    operation.cleanup();
    if (this.operations.get(operation.id) === operation) this.operations.delete(operation.id);
    this.authority.changed?.();
  }

  /** A transport loss never authorizes replay or a positive receipt. */
  private lost(operation: Operation): void {
    if (operation.retired) return;
    const store = this.authority.store();
    const attempt = store.claudeDelivery(operation.id);
    if (attempt?.state === 'reserved')
      store.cancelClaudeDelivery(operation.id, 'Native preparation ended before content release');
    else if (attempt?.state === 'issued')
      store.uncertainClaudeDelivery(operation.id, 'Native content admission was not confirmed');
    const state = store.claudeDelivery(operation.id)?.state;
    if (state === 'cancelled' || state === 'uncertain') this.authority.trace?.(operation.id, state);
    this.authority.claims.dropped(operation.claim.session, operation.claim.id);
    this.retire(operation);
    this.authority.claude.wakeDropped(
      operation.claim.session,
      operation.claim.binding.connectionId,
    );
  }

  /** No new ownership is inferred from a reconnect, route change or revoked stream. */
  observe(): void {
    for (const operation of [...this.operations.values()]) {
      try {
        this.current(operation);
      } catch {
        this.lost(operation);
      }
    }
  }

  queued(session: string, connectionId?: string): boolean {
    this.observe();
    return [...this.operations.values()].some(
      (operation) =>
        !operation.retired &&
        operation.claim.session === session &&
        (!connectionId || operation.claim.binding.connectionId === connectionId),
    );
  }

  async prepare(raw: unknown, signal: AbortSignal): Promise<NativePrepared> {
    const input = prepareSchema.parse(raw);
    if (!this.authority.ready() || signal.aborted)
      throw new Error('The node is not ready for native Claude Code delivery');
    const claim = this.authority.claims.get(input.claim);
    if (!claim || claim.session !== input.sessionId || !claim.sinkId)
      throw new Error('The native Claude Code prepare capability is unavailable');
    if (this.authority.claude.wakeSink(input.sessionId)?.id !== claim.sinkId)
      throw new Error('The native Claude Code stream was replaced');
    if (this.queued(input.sessionId, claim.binding.connectionId))
      throw new Error('A native Claude Code delivery is already in progress');
    const consumed = await this.authority.claims.consume(input.sessionId, input.claim);
    if (!consumed.ok) throw new Error('The native Claude Code prepare capability was refused');
    try {
      return await this.prepareClaim(claim, signal);
    } catch (error) {
      if (this.authority.claims.dropped(input.sessionId, input.claim))
        this.authority.claude.wakeDropped(input.sessionId, claim.binding.connectionId);
      throw error;
    }
  }

  private async prepareClaim(claim: WakeClaim, signal: AbortSignal): Promise<NativePrepared> {
    if (!claim.sinkId) throw new Error('The native Claude Code stream is unavailable');
    const store = this.authority.store();
    const messages: Message[] = [];
    let estimatedSize = 0;
    for (const id of claim.backlog) {
      const row = store.get(id, 'in');
      if (
        !row ||
        row.state !== 'ready' ||
        nicknameKey(row.envelope.toNickname) !== claim.binding.agentKey ||
        store.claudeFenced(id) ||
        ['dispatching', 'uncertain'].includes(store.dispatchState(id)?.state ?? '')
      )
        continue;
      const size = row.envelope.text.length + row.envelope.attachments.length * 16384 + 2048;
      if (
        messages.length >= 20 ||
        (messages.length > 0 && estimatedSize + size > nativeClaudeBodyLimit)
      )
        break;
      messages.push(row);
      estimatedSize += size;
    }
    if (!messages.length) {
      throw new Error('Message delivery is in progress or uncertain; content is not repeated');
    }
    const reportKey = randomBytes(32).toString('hex');
    const requestScope = randomUUID();
    const reportKeyHash = nativeClaudeHash(reportKey);
    const id = store.reserveClaudeDelivery({
      connectionId: claim.binding.connectionId,
      ids: messages.map((message) => message.envelope.id),
      helperId: claim.lease.helperId,
      scope: {
        transport: nativeClaudeTransport,
        ...claim.lease,
        requestScope,
        reportKeyHash,
        sinkId: claim.sinkId,
        claimHash: nativeClaudeHash(claim.id),
        incarnation: claim.incarnation,
      },
    });
    const operation: Operation = {
      id,
      claim,
      requestScope,
      reportKeyHash,
      sinkId: claim.sinkId,
      gated: false,
      admitting: false,
      body: '',
      receiverContext: '',
      retired: false,
      expiresAt: claim.startBy,
      cleanup: () => {
        signal.removeEventListener('abort', aborted);
        clearTimeout(deadline);
      },
    };
    const aborted = () => this.lost(operation);
    // One-shot retirement only: no wake, polling, replay or release of INTENT.
    // Existing consumed-claim expiry bounds both lost prepare and lost reports.
    const deadline = setTimeout(
      () => this.lost(operation),
      Math.max(0, operation.expiresAt - Date.now()),
    );
    deadline.unref();
    this.operations.set(id, operation);
    this.authority.trace?.(id, 'reserved');
    signal.addEventListener('abort', aborted, { once: true });
    try {
      this.current(operation, true);
      if (signal.aborted) throw new Error('The native Claude Code request was cancelled');
      const owner = store.assertOwner(claim.binding.connectionId);
      const prepared: { message: Message; files: AgentMessageInput['files']; replyRef: string }[] =
        [];
      for (const message of messages) {
        const files = await this.authority.materialize(message);
        this.current(operation, true);
        const current = store.get(message.envelope.id, 'in');
        if (!current || current.state !== 'ready')
          throw new Error('The message changed or was cleared');
        prepared.push({ message, files, replyRef: 'r' + current.sequence.toString(36) });
      }
      const deliveredAt = this.authority.presentationNow();
      const display = this.authority.messageDisplayContext();
      const texts = prepared.map(({ message, files, replyRef }) =>
        formatAgentMessagePresentation({
          fromNickname: message.envelope.fromNickname,
          sentAt: message.envelope.createdAt,
          deliveredAt,
          locale: display.locale,
          timeZone: display.timeZone,
          text: message.envelope.text,
          files,
          replyRef,
        }),
      );
      const body = texts.join('\n\n');
      if (body.length > nativeClaudeBodyLimit)
        throw new Error('The native Claude Code message is too large');
      const receiverContext =
        'NCF current-chat identity: ' +
        JSON.stringify({
          nickname: owner.nickname,
          connectionId: owner.binding.connectionId,
          delivery: id,
        }) +
        '. Use this connection only in this exact chat; never transfer an occupied name without owner approval.';
      const envelopeHash = nativeClaudeHash(body);
      // Model-only context may be a separate row. The stored canonical body is
      // itself bound to one potentially admitted attempt by the durable unique
      // envelope index; an earlier body can never spend a later attempt's IDs.
      const representationHashes = [
        nativeClaudeRowHash(body),
        nativeClaudeRowHash(body, receiverContext),
        nativeClaudeRowHash(body, undefined, false),
        nativeClaudeRowHash(body, receiverContext, false),
      ];
      await this.validate(operation, true);
      this.current(operation, true);
      if (signal.aborted) throw new Error('The native Claude Code request was cancelled');
      store.sealClaudeNativeDelivery(id, envelopeHash, representationHashes);
      operation.body = body;
      operation.receiverContext = receiverContext;
      return {
        delivery: id,
        reportKey,
        trigger: nativeClaudeTrigger + id,
        envelopeHash,
        representationHashes,
        expiresAt: operation.expiresAt,
      };
    } catch (error) {
      this.lost(operation);
      throw error;
    }
  }

  /** The separate native gate replaces this exact trigger before host admission. */
  async admit(raw: unknown): Promise<{ body: string; receiverContext: string }> {
    const input = admitSchema.parse(raw);
    const operation = this.operations.get(input.delivery);
    if (
      !operation ||
      operation.claim.session !== input.sessionId ||
      operation.claim.lease.nativeLeaseNonce !== input.nativeLeaseNonce
    )
      throw new Error('The native Claude Code admission does not belong to this session');
    // Reject a duplicate before any await; it must not invalidate the first call.
    if (operation.admitting || operation.gated)
      throw new Error('The native Claude Code admission has already been used');
    operation.admitting = true;
    try {
      await this.validate(operation, true);
      const started = this.authority.claims.startPrepared(operation.claim);
      this.current(operation);
      if (!started.ok) throw new Error('The native Claude Code admission was revoked');
      // No body has left the node before durable INTENT. Cancellation of a
      // prepared trigger therefore never releases possibly admitted content.
      this.authority.store().issueClaudeDelivery(operation.id);
      this.authority.trace?.(operation.id, 'issued');
      operation.gated = true;
      return { body: operation.body, receiverContext: operation.receiverContext };
    } catch (error) {
      this.lost(operation);
      throw error;
    }
  }

  /** Final synchronous check after service wrappers and immediately before HTTP writes body. */
  validateRelease(raw: unknown): void {
    const input = admitSchema.parse(raw);
    const operation = this.operations.get(input.delivery);
    if (
      !operation ||
      !operation.gated ||
      operation.claim.session !== input.sessionId ||
      operation.claim.lease.nativeLeaseNonce !== input.nativeLeaseNonce
    )
      throw new Error('The native Claude Code content release is no longer authorized');
    this.current(operation);
    if (this.authority.store().claudeDelivery(operation.id)?.state !== 'issued')
      throw new Error('The native Claude Code content has no durable write intent');
  }

  async report(raw: unknown): Promise<{ state: string }> {
    const input = reportSchema.parse(raw);
    const store = this.authority.store();
    const attempt = store.claudeDelivery(input.delivery);
    if (
      !attempt ||
      attempt.scope.transport !== nativeClaudeTransport ||
      attempt.scope.session !== input.sessionId ||
      typeof attempt.scope.reportKeyHash !== 'string' ||
      !sameSecret(attempt.scope.reportKeyHash, nativeClaudeHash(input.reportKey))
    )
      throw new Error('The native Claude Code report does not belong to this delivery');
    if (attempt.state === 'committed' && input.phase === 'stored') {
      store.commitClaudeDelivery(input.delivery, {
        storedRowId: input.storedRowId ?? '',
        representationHash: input.representationHash ?? '',
      });
      return { state: 'committed' };
    }
    const operation = this.operations.get(input.delivery);
    if (!operation) throw new Error('The native Claude Code delivery cannot be resumed');
    if (input.phase === 'stored') {
      const expected = attempt.scope.nativePrompt as { representationHashes?: unknown } | undefined;
      if (
        !operation.gated ||
        !input.storedRowId ||
        /[\x00-\x1f\x7f]/.test(input.storedRowId) ||
        !Array.isArray(expected?.representationHashes) ||
        !expected.representationHashes.includes(input.representationHash)
      )
        throw new Error('The stored Claude Code row does not match this delivery');
    }
    try {
      await this.validate(operation);
      this.current(operation);
    } catch (error) {
      if (input.phase === 'stored' && store.claudeDelivery(input.delivery)?.state === 'committed') {
        store.commitClaudeDelivery(input.delivery, {
          storedRowId: input.storedRowId ?? '',
          representationHash: input.representationHash ?? '',
        });
        return { state: 'committed' };
      }
      this.lost(operation);
      throw error;
    }
    // Invalid/mixed witness metadata must not cancel an otherwise current
    // operation. The store transaction either commits its own IDs or rolls back.
    if (input.phase === 'stored') {
      if (!operation.gated) throw new Error('The native Claude Code row has no admitted request');
      const ids = store.commitClaudeDelivery(input.delivery, {
        storedRowId: input.storedRowId ?? '',
        representationHash: input.representationHash ?? '',
      });
      this.authority.trace?.(input.delivery, 'committed');
      this.retire(operation);
      await this.authority.committed(attempt.connectionId, ids);
    } else if ((input.phase === 'dropped' || input.phase === 'not-submitted') && !operation.gated) {
      store.cancelClaudeDelivery(input.delivery, 'The native host did not admit the prompt');
      this.authority.trace?.(input.delivery, 'cancelled');
      this.authority.claims.dropped(input.sessionId, operation.claim.id);
      this.retire(operation);
      this.authority.claude.wakeDropped(input.sessionId, operation.claim.binding.connectionId);
    } else {
      this.lost(operation);
    }
    return { state: store.claudeDelivery(input.delivery)?.state ?? 'unknown' };
  }
}

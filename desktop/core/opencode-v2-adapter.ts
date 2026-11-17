import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import type { AdapterProfile, AdapterState } from '../shared/contracts.js';
import type { AgentAdapter, Admission, EventInput } from './adapters.js';
import { agentMessageText } from './adapters.js';
import { OpenCodeV2Auth } from './opencode-v2-auth.js';
import {
  parseOpenCodeV2Evidence,
  openCodeV2HostMessageId,
  openCodeV2Prompt,
  openCodeV2PayloadHash,
  type OpenCodeV2Scope,
  type OpenCodeV2Owner,
  type OpenCodeV2Evidence,
  type OpenCodeV2Command,
  type OpenCodeV2Registration,
} from './opencode-v2-protocol.js';

const registrationSchema = z
  .object({
    protocol: z.literal(2),
    nodeId: z.uuid(),
    targetId: z.uuid(),
    generation: z.uuid(),
    bootId: z.uuid(),
    workspace: z.string().min(1).max(4000),
    appVersion: z.literal('2.3.0'),
    bridgeUrl: z.url(),
    bridgeCredential: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const same = isDeepStrictEqual;
interface Bridge {
  registration: OpenCodeV2Registration;
  credential: string;
  scope: OpenCodeV2Scope;
  abort: AbortController;
  events: EventEmitter;
  active: boolean;
  ready: boolean;
  requests: number;
}
export interface OpenCodeV2Invocation {
  readonly nonce: string;
  readonly sessionID: string;
  readonly scope: OpenCodeV2Scope;
  assertCurrent(): void;
  onRevoke(callback: () => void): () => void;
}
export interface OpenCodeV2Identity extends OpenCodeV2Invocation {
  readonly bridge: Bridge;
}
async function boundedJSON(response: Response): Promise<unknown> {
  if (!response.ok || !response.body) throw new Error('V2_BRIDGE_UNAVAILABLE');
  const reader = response.body.getReader();
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > 16384) throw new Error('V2_BRIDGE_RESPONSE_LIMIT');
      chunks.push(next.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
}

/** Per-boot transport/authority only; durable attempts stay in the common dispatch ledger. */
export class OpenCodeV2Bridges {
  private readonly bridges = new Map<string, Bridge>();
  private readonly ambiguous = new Map<string, string>();
  private requests = 0;
  private unobserve?: () => void;
  constructor(
    readonly auth: OpenCodeV2Auth,
    private readonly node: () => { id: string; epoch: string; ready: boolean },
    private readonly profileRetired?: (id: string) => void,
  ) {}
  start(): void {
    this.unobserve?.();
    this.unobserve = this.auth.observe((id) => {
      const bridge = this.bridges.get(id);
      if (bridge) this.retire(bridge);
    });
  }
  sessionEnded(profile: AdapterProfile): void {
    profile.released = true;
    this.profileRetired?.(profile.id);
  }
  private current(bridge: Bridge): boolean {
    const node = this.node();
    return (
      node.ready &&
      bridge.active &&
      bridge.ready &&
      !bridge.abort.signal.aborted &&
      node.id === bridge.scope.nodeId &&
      node.epoch === bridge.scope.nodeEpoch &&
      this.bridges.get(bridge.scope.targetId) === bridge &&
      this.ambiguous.get(bridge.scope.targetId) !== bridge.scope.generation
    );
  }
  private retire(bridge: Bridge): void {
    if (!bridge.active) return;
    bridge.active = false;
    bridge.abort.abort();
    for (const listener of bridge.events.listeners('closed')) {
      try {
        listener();
      } catch {
        /* Every independent listener must observe revocation. */
      }
    }
    bridge.events.removeAllListeners();
    if (this.bridges.get(bridge.scope.targetId) === bridge)
      this.bridges.delete(bridge.scope.targetId);
  }
  async register(raw: unknown, credential: string): Promise<OpenCodeV2Scope> {
    const input = registrationSchema.parse(raw),
      node = this.node();
    if (!node.ready || input.nodeId !== node.id) throw new Error('V2_NODE_UNAVAILABLE');
    await this.auth.authenticate(input.targetId, input.generation, credential);
    if (!this.node().ready || this.node().epoch !== node.epoch)
      throw new Error('V2_NODE_UNAVAILABLE');
    const url = new URL(input.bridgeUrl);
    if (
      url.protocol !== 'http:' ||
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error('V2_BRIDGE_ADDRESS');
    const old = this.bridges.get(input.targetId);
    if (this.ambiguous.get(input.targetId) === input.generation)
      throw new Error('V2_BRIDGE_AMBIGUOUS');
    if (old && old.active && old.scope.nodeEpoch === node.epoch) {
      if (same(old.registration, input)) {
        if (!old.ready) throw new Error('V2_BRIDGE_REGISTERING');
        return old.scope;
      }
      this.ambiguous.set(input.targetId, input.generation);
      this.retire(old);
      throw new Error('V2_BRIDGE_AMBIGUOUS');
    }
    if (this.bridges.size >= 128) throw new Error('V2_BRIDGE_CAPACITY');
    const bridge: Bridge = {
      registration: input,
      credential,
      scope: {
        protocol: 2,
        nodeId: node.id,
        targetId: input.targetId,
        generation: input.generation,
        bootId: input.bootId,
        nodeEpoch: node.epoch,
      },
      abort: new AbortController(),
      events: new EventEmitter(),
      active: true,
      ready: false,
      requests: 0,
    };
    this.bridges.set(input.targetId, bridge);
    const headerTimer = setTimeout(() => bridge.abort.abort(), 5000);
    headerTimer.unref();
    try {
      const response = await fetch(new URL('/events', url), {
        headers: { authorization: 'Bearer ' + input.bridgeCredential },
        redirect: 'error',
        signal: bridge.abort.signal,
      });
      clearTimeout(headerTimer);
      if (
        !response.ok ||
        !response.body ||
        !this.node().ready ||
        this.node().epoch !== node.epoch ||
        this.bridges.get(input.targetId) !== bridge ||
        bridge.abort.signal.aborted
      )
        throw new Error('V2_BRIDGE_UNAVAILABLE');
      bridge.ready = true;
      const reader = response.body.getReader();
      void (async () => {
        let buffer = '';
        const decoder = new TextDecoder('utf-8', { fatal: true });
        try {
          for (;;) {
            const item = await reader.read();
            if (item.done) break;
            buffer += decoder.decode(item.value, { stream: true });
            if (Buffer.byteLength(buffer) > 1024 * 1024) throw new Error('V2_BRIDGE_FRAME_LIMIT');
            let end: number;
            while ((end = buffer.indexOf('\n\n')) >= 0) {
              const frame = buffer.slice(0, end);
              if (Buffer.byteLength(frame) > 32768) throw new Error('V2_BRIDGE_FRAME_LIMIT');
              buffer = buffer.slice(end + 2);
              if (!frame.startsWith('data: ')) continue;
              const event = parseOpenCodeV2Evidence(JSON.parse(frame.slice(6)));
              if (!this.current(bridge) || !same(event.scope, bridge.scope))
                throw new Error('V2_BRIDGE_SCOPE');
              bridge.events.emit('evidence', event);
            }
            if (Buffer.byteLength(buffer) > 32768) throw new Error('V2_BRIDGE_FRAME_LIMIT');
          }
        } catch {
          /* Any stream loss revokes current authority; never reconnect a content call. */
        } finally {
          await reader.cancel().catch(() => {});
          this.retire(bridge);
        }
      })();
      return bridge.scope;
    } catch {
      clearTimeout(headerTimer);
      this.retire(bridge);
      throw new Error('V2_BRIDGE_UNAVAILABLE');
    }
  }
  private get(targetId: string, generation?: string): Bridge {
    const bridge = this.bridges.get(targetId);
    if (
      !bridge ||
      !this.current(bridge) ||
      (generation !== undefined && bridge.scope.generation !== generation)
    )
      throw new Error('V2_BRIDGE_UNAVAILABLE');
    return bridge;
  }
  async authenticate(targetId: string, generation: string, credential: string): Promise<void> {
    await this.auth.authenticate(targetId, generation, credential);
  }
  async command(
    identity: OpenCodeV2Identity,
    command: OpenCodeV2Command,
    beforeSend?: () => void,
  ): Promise<OpenCodeV2Evidence | { revoked: true }> {
    const bridge = identity.bridge;
    identity.assertCurrent();
    if (!same(command.scope, bridge.scope) || bridge.requests >= 32 || this.requests >= 128)
      throw new Error('V2_BRIDGE_CAPACITY');
    bridge.requests++;
    this.requests++;
    try {
      await this.auth.authenticate(
        bridge.scope.targetId,
        bridge.scope.generation,
        bridge.credential,
      );
      identity.assertCurrent();
      const body = JSON.stringify(command);
      beforeSend?.();
      const response = await fetch(new URL('/command', bridge.registration.bridgeUrl), {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + bridge.registration.bridgeCredential,
          'content-type': 'application/json',
        },
        body,
        redirect: 'error',
        signal: AbortSignal.any([bridge.abort.signal, AbortSignal.timeout(12000)]),
      });
      const raw = await boundedJSON(response);
      identity.assertCurrent();
      if (
        command.kind === 'revoke' &&
        raw &&
        typeof raw === 'object' &&
        (raw as { revoked?: unknown }).revoked === true
      )
        return { revoked: true };
      const evidence = parseOpenCodeV2Evidence(raw);
      if (!same(evidence.scope, bridge.scope)) throw new Error('V2_BRIDGE_SCOPE');
      return evidence;
    } finally {
      bridge.requests--;
      this.requests--;
    }
  }
  async identity(
    targetId: string,
    generation: string,
    sessionID: string,
  ): Promise<OpenCodeV2Identity> {
    if (!sessionID.startsWith('ses') || sessionID.length > 200)
      throw new Error('V2_SESSION_UNAVAILABLE');
    const bridge = this.get(targetId, generation),
      nonce = randomUUID();
    const identity: OpenCodeV2Identity = {
      nonce,
      sessionID,
      scope: bridge.scope,
      bridge,
      assertCurrent: () => {
        if (!this.current(bridge)) throw new Error('V2_SCOPE_UNAVAILABLE');
      },
      onRevoke: (callback) => {
        bridge.events.on('closed', callback);
        return () => {
          bridge.events.off('closed', callback);
        };
      },
    };
    const result = await this.command(identity, {
      kind: 'identity',
      scope: bridge.scope,
      nonce,
      sessionID,
      expiresAt: Date.now() + 30000,
    });
    if (
      !('kind' in result) ||
      result.kind !== 'identity' ||
      result.nonce !== nonce ||
      result.sessionID !== sessionID ||
      result.workspace !== bridge.registration.workspace
    )
      throw new Error('V2_SESSION_UNAVAILABLE');
    return identity;
  }
  listen(
    profile: AdapterProfile,
    callback: (evidence: OpenCodeV2Evidence) => void,
    closed: () => void,
  ): () => void {
    const bridge = this.get(profile.setupTargetId!);
    if (bridge.scope.bootId !== profile.instanceId) throw new Error('V2_SCOPE_UNAVAILABLE');
    bridge.events.on('evidence', callback);
    bridge.events.on('closed', closed);
    return () => {
      bridge.events.off('evidence', callback);
      bridge.events.off('closed', closed);
    };
  }
  close(): void {
    this.unobserve?.();
    this.unobserve = undefined;
    for (const bridge of [...this.bridges.values()]) this.retire(bridge);
    this.ambiguous.clear();
  }
}

interface Pending {
  command: Extract<OpenCodeV2Command, { kind: 'submit' }>;
  input: EventInput;
  resolve: (result: Admission) => void;
  timer: NodeJS.Timeout;
  uncertain: boolean;
}
/** Node-side exact-session v2 adapter. It never owns an inbox or a receipt ledger. */
export class OpenCodeV2Adapter implements AgentAdapter {
  readonly contentGate = true;
  readonly wakeOnly = false;
  private state: AdapterState;
  private identity?: OpenCodeV2Identity;
  private owner?: OpenCodeV2Owner;
  private arm?: Extract<OpenCodeV2Evidence, { kind: 'ready' }>;
  private unlisten?: () => void;
  private pending?: Pending;
  private stopped = false;
  constructor(
    readonly profile: AdapterProfile,
    private readonly bridges: OpenCodeV2Bridges,
    private readonly changed: () => void,
    private readonly idle: () => void,
  ) {
    this.state = {
      id: profile.id,
      label: profile.label,
      kind: 'opencode-v2',
      state: 'recovering',
      error: null,
      capabilities: {
        wakeIdle: false,
        receiveActive: false,
        nativeDisplay: true,
        exactSession: true,
      },
    };
  }
  status(): AdapterState {
    return structuredClone(this.state);
  }
  private unavailable(): void {
    this.arm = undefined;
    this.state.state = 'error';
    this.state.error = 'The OpenCode v2 receive path is unavailable';
    this.state.capabilities.wakeIdle = false;
    this.state.capabilities.receiveActive = false;
    if (this.pending) {
      this.pending.resolve({ state: 'uncertain' });
      clearTimeout(this.pending.timer);
      this.pending = undefined;
    }
    if (!this.stopped) this.changed();
  }
  async start(): Promise<void> {
    if (this.profile.released) {
      this.state.released = true;
      this.unavailable();
      return;
    }
    try {
      this.attach();
    } catch {
      this.unavailable();
    }
  }
  private attach(): void {
    this.unlisten?.();
    this.unlisten = undefined;
    this.unlisten = this.bridges.listen(
      this.profile,
      (event) => {
        try {
          this.evidence(event);
        } catch {
          this.unavailable();
        }
      },
      () => this.unavailable(),
    );
  }
  async bind(identity: OpenCodeV2Identity, owner: OpenCodeV2Owner): Promise<void> {
    identity.assertCurrent();
    if (
      this.stopped ||
      this.profile.released ||
      identity.scope.bootId !== this.profile.instanceId ||
      identity.scope.targetId !== this.profile.setupTargetId ||
      identity.sessionID !== this.profile.sessionId ||
      owner.chatId !== this.profile.sessionId ||
      owner.adapterId !== this.profile.id
    )
      throw new Error('V2_SCOPE_UNAVAILABLE');
    this.identity = identity;
    this.owner = owner;
    this.arm = undefined;
    // Persisted adapters start before an external bridge can register. Reattach
    // before bind can publish any evidence, replacing exactly our old listeners.
    this.attach();
    const result = await this.bridges.command(identity, {
      kind: 'bind',
      scope: identity.scope,
      nonce: identity.nonce,
      owner,
    });
    identity.assertCurrent();
    if (!('kind' in result) || result.kind !== 'arming' || !same(result.owner, owner))
      throw new Error('V2_BIND_UNAVAILABLE');
  }
  private evidence(event: OpenCodeV2Evidence): void {
    if (
      this.stopped ||
      !this.identity ||
      !this.owner ||
      !same(event.scope, this.identity.scope) ||
      !('owner' in event) ||
      !same(event.owner, this.owner)
    )
      return;
    try {
      this.identity.assertCurrent();
    } catch {
      this.unavailable();
      return;
    }
    if (event.kind === 'ready') {
      this.arm = event;
      this.state.state = 'ready';
      this.state.error = null;
      this.state.capabilities.wakeIdle = true;
      this.state.capabilities.receiveActive = true;
      this.changed();
      this.idle();
      return;
    }
    if (event.kind === 'revoked') {
      if (event.reasonCode === 'V2_SESSION_ENDED') {
        this.bridges.sessionEnded(this.profile);
        this.state.released = true;
      }
      this.arm = undefined;
      this.state.capabilities.wakeIdle = false;
      this.state.capabilities.receiveActive = false;
      this.state.state = 'recovering';
      this.changed();
      return;
    }
    const pending = this.pending;
    if (
      !pending ||
      !('attemptId' in event) ||
      event.attemptId !== pending.command.attemptId ||
      event.hostMessageId !== pending.command.hostMessageId ||
      event.nonce !== pending.command.nonce ||
      event.outboundHash !== pending.command.outboundHash
    )
      return;
    if (event.kind === 'submitted') pending.input.onHostAccepted?.();
    if (event.kind === 'projected') {
      if (event.canonicalHash !== createCanonicalHash(pending.command.text)) return;
      // The node verifies the same durable attempt/current owner before the sole commit.
      if (pending.input.isCurrent?.() === false) return;
      if (pending.uncertain)
        pending.input.onNativeProjected?.({
          host: {
            messageId: event.hostMessageId,
            runtime: nativeRuntime(event.scope),
            session: event.owner.chatId,
          },
          payloadHash: event.outboundHash,
        });
      clearTimeout(pending.timer);
      this.pending = undefined;
      pending.resolve({ state: 'admitted' });
      void this.bridges
        .command(this.identity, {
          kind: 'arm',
          scope: this.identity.scope,
          owner: this.owner,
          nonce: randomUUID(),
        })
        .catch(() => this.unavailable());
    } else if (event.kind === 'uncertain') {
      pending.uncertain = true;
      pending.resolve({ state: 'uncertain' });
    } else if (event.kind === 'not-released') {
      clearTimeout(pending.timer);
      this.pending = undefined;
      pending.resolve({ state: 'failed', definiteNoBody: true });
    }
  }
  async deliver(input: EventInput): Promise<Admission> {
    const identity = this.identity,
      owner = this.owner,
      arm = this.arm;
    if (
      this.stopped ||
      !identity ||
      !owner ||
      !arm ||
      this.pending ||
      !input.deliveryAttempt ||
      input.systemEvent
    )
      return { state: 'waiting', definiteNoBody: true };
    if (!same(owner, input.deliveryAttempt.meta.owner) || input.isCurrent?.() === false)
      return { state: 'revoked', definiteNoBody: true };
    const text = agentMessageText(input),
      attemptId = input.deliveryAttempt.id,
      hostMessageId = openCodeV2HostMessageId(attemptId);
    const prompt = openCodeV2Prompt(owner.chatId, hostMessageId, text),
      outboundHash = openCodeV2PayloadHash(prompt);
    const command: Extract<OpenCodeV2Command, { kind: 'submit' }> = {
      kind: 'submit',
      scope: identity.scope,
      nonce: randomUUID(),
      owner,
      armId: arm.armId,
      attemptId,
      hostMessageId,
      text,
      outboundHash,
    };
    try {
      identity.assertCurrent();
      await this.bridges.authenticate(
        identity.scope.targetId,
        identity.scope.generation,
        identity.bridge.credential,
      );
      identity.assertCurrent();
      if (input.isCurrent?.() === false) return { state: 'revoked', definiteNoBody: true };
    } catch {
      return { state: 'failed', definiteNoBody: true };
    }
    this.arm = undefined;
    this.state.capabilities.wakeIdle = false;
    this.state.capabilities.receiveActive = false;
    this.state.state = 'recovering';
    this.changed();
    return new Promise<Admission>((resolve) => {
      let issued = false;
      const timer = setTimeout(() => {
        if (this.pending?.command === command) this.pending.uncertain = true;
        resolve({ state: 'uncertain' });
        this.state.state = 'uncertain';
        this.changed();
      }, 13000);
      timer.unref();
      this.pending = { command, input, resolve, timer, uncertain: false };
      void this.bridges
        .command(identity, command, () => {
          identity.assertCurrent();
          if (this.stopped || input.isCurrent?.() === false)
            throw new Error('V2_SCOPE_UNAVAILABLE');
          // No await separates this durable node CAS from the bridge content write.
          input.beforeRelease?.(JSON.stringify(prompt), {
            messageId: hostMessageId,
            runtime: nativeRuntime(identity.scope),
            session: owner.chatId,
          });
          issued = true;
        })
        .then(
          (result) => {
            try {
              if ('kind' in result) this.evidence(result);
            } catch {
              this.unavailable();
            }
          },
          () => {
            if (!issued) {
              if (this.pending?.command === command) {
                clearTimeout(this.pending.timer);
                this.pending = undefined;
              }
              resolve({ state: 'failed', definiteNoBody: true });
              return;
            }
            if (this.pending?.command === command) this.pending.uncertain = true;
            resolve({ state: 'uncertain' });
          },
        );
    });
  }
  async stop(): Promise<void> {
    this.stopped = true;
    this.unlisten?.();
    this.unlisten = undefined;
    if (this.identity && this.owner)
      void this.bridges
        .command(this.identity, {
          kind: 'revoke',
          scope: this.identity.scope,
          owner: this.owner,
          nonce: randomUUID(),
        })
        .catch(() => {});
    this.unavailable();
  }
}
import { createHash } from 'node:crypto';
const createCanonicalHash = (text: string) =>
  createHash('sha256').update(JSON.stringify({ text })).digest('hex');
export const nativeRuntime = (scope: OpenCodeV2Scope): string =>
  scope.targetId + ':' + scope.generation + ':' + scope.bootId;

import { EventEmitter } from 'node:events';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { atomicJson } from './settings.js';
import { claudeToolPrefix } from '../integrations/claude-code.js';
import { readNativeLease, readNativeLeaseSync } from '../integrations/claude-native-lease.js';

export { claudeToolPrefix };

const sessionId = z.uuid().transform((value) => value.toLowerCase());
const secret = z.string().regex(/^[a-f0-9]{64}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const helperHelloSchema = z
  .object({
    helperId: z.uuid(),
    secret,
    spawnSession: sessionId.nullable(),
    session: sessionId.nullable(),
    generation: z.number().int().nonnegative(),
    nativeLeaseNonce: z.uuid().nullable(),
  })
  .strict();
export const helperCallSchema = z
  .object({
    helperId: z.uuid(),
    secret,
    tool: z.string().min(1).max(128),
    inputHash: hash,
    contextToken: z.uuid(),
    connectionId: z.uuid().optional(),
  })
  .strict();
export const hookSchema = z
  .object({
    event: z.enum(['SessionStart', 'SessionEnd', 'PreToolUse', 'Stop']),
    sessionId,
    nativeLeaseNonce: z.uuid().nullable(),
    source: z.string().max(40).optional(),
    reason: z.string().max(40).optional(),
    tool: z.string().max(200).optional(),
    inputHash: hash.optional(),
  })
  .strict();
const holderSchema = z
  .object({
    helperId: z.uuid(),
    secretHash: hash,
    spawnSession: sessionId,
    nativeLeaseNonce: z.uuid(),
  })
  .strict();
const routeSchema = holderSchema
  .extend({
    generation: z.number().int().nonnegative(),
    confirmed: z.boolean(),
  })
  .strict();
const routesSchema = z
  .object({
    version: z.literal(2),
    holders: z.array(holderSchema).max(4096),
    routes: z.array(routeSchema).max(4096),
  })
  .strict();
type Holder = z.infer<typeof holderSchema>;
type Route = z.infer<typeof routeSchema>;

export interface HelperWriter {
  write(line: string): boolean;
  end(): void;
}
export interface ClaudeHelper {
  id: string;
  secretHash: string;
  /** Changes for every helper-node stream; offers belong to one lifecycle. */
  epoch: string;
  writer: HelperWriter;
  spawnSession: string | null;
  claim: string | null;
  generation: number;
  nativeLeaseNonce: string | null;
  bootstrapPending: boolean;
  proven: string | null;
  confirmed: boolean;
  publishing: boolean;
  outstanding: Map<string, number>;
}
/** Revalidate this authorization snapshot after asynchronous work and at ticket consumption. */
export interface ClaudeProofLease {
  readonly helperId: string;
  readonly epoch: string;
  readonly generation: number;
  readonly session: string;
  readonly nativeLeaseNonce: string;
}
interface ToolProof {
  lease: ClaudeProofLease;
  tool: string;
  hash: string;
  expires: number;
}
interface CallPermit {
  lease: ClaudeProofLease;
  tool: string;
  hash: string;
  expires: number;
  state: 'issued' | 'admitted';
  /** The node-generated connect ticket from this exact preflight, not the hook proof. */
  expectedConnectTicket?: string;
  sessionKey?: string;
  requestId?: string | number;
}
const callValidationSchema = z
  .object({
    helperId: z.uuid(),
    secret,
    callToken: z.uuid(),
    phase: z.enum(['forward', 'return']),
  })
  .strict();
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const unproven = () =>
  new Error('The native Claude Code chat could not be verified. Reconnect MCP from this chat.');

/** Native spawn identity and a durable lease authorize a route. Tool input never selects it. */
export class ClaudeSessions extends EventEmitter {
  private helpers = new Map<string, ClaudeHelper>();
  private holders = new Map<string, Holder>();
  private routes: Route[] = [];
  private proofs = new Map<string, ToolProof>();
  private calls = new Map<string, CallPermit>();
  private persisting: Promise<boolean> = Promise.resolve(true);
  private unavailable = false;
  private readonly filename: string;
  private readonly nodeFile: string;
  private heartbeat?: NodeJS.Timeout;
  constructor(
    directory: string,
    private readonly options: {
      now?: () => number;
      toolLifetime?: number;
      callLifetime?: number;
    } = {},
  ) {
    super();
    this.filename = path.join(directory, 'claude-routes.json');
    this.nodeFile = path.join(directory, 'Integrations', 'node.json');
  }
  private now(): number {
    return this.options.now?.() ?? Date.now();
  }
  async load(): Promise<void> {
    try {
      const saved = routesSchema.parse(JSON.parse(await readFile(this.filename, 'utf8')));
      this.holders = new Map(saved.holders.map((value) => [value.helperId, value]));
      this.routes = saved.routes;
    } catch (error) {
      this.routes = [];
      this.holders.clear();
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.unavailable = true;
    }
  }
  private persist(): Promise<boolean> {
    const attached = [...this.helpers.values()]
      .filter((helper) => helper.proven && helper.nativeLeaseNonce && helper.spawnSession)
      .map((helper) => ({
        helperId: helper.id,
        secretHash: helper.secretHash,
        spawnSession: helper.spawnSession!,
        nativeLeaseNonce: helper.nativeLeaseNonce!,
        generation: helper.generation,
        confirmed: helper.confirmed,
      }));
    const detached = this.routes.filter((route) => !this.helpers.has(route.helperId));
    this.routes = [...attached, ...detached];
    const data = { version: 2 as const, holders: [...this.holders.values()], routes: this.routes };
    this.persisting = this.persisting.then(async () => {
      try {
        await atomicJson(this.filename, data);
        return true;
      } catch {
        this.unavailable = true;
        this.emit('problem', 'Claude Code routes could not be saved');
        return false;
      }
    });
    return this.persisting;
  }
  private authenticate(helperId: string, value: string): ClaudeHelper {
    const helper = this.helpers.get(helperId);
    if (!helper || !same(helper.secretHash, digest(value)))
      throw new Error('The Claude Code helper is not connected');
    return helper;
  }
  private fence(helper: ClaudeHelper): void {
    helper.proven = null;
    helper.claim = null;
    helper.bootstrapPending = false;
    helper.confirmed = false;
    helper.publishing = false;
    helper.outstanding.clear();
    this.routes = this.routes.filter((route) => route.helperId !== helper.id);
    for (const [token, proof] of this.proofs)
      if (proof.lease.helperId === helper.id) this.proofs.delete(token);
    this.invalidateCalls(helper.id);
  }
  private invalidateCalls(helperId: string): void {
    for (const [token, permit] of this.calls)
      if (permit.lease.helperId === helperId) this.calls.delete(token);
  }
  private invalidateAmbiguousCalls(session: string): void {
    const helpers = [...this.helpers.values()].filter(
      (helper) => helper.proven === session && this.nativeCurrent(helper),
    );
    if (helpers.length < 2) return;
    for (const [token, permit] of this.calls)
      if (permit.lease.session === session) this.calls.delete(token);
  }
  private nativeCurrent(helper: ClaudeHelper, allowPublishing = false): boolean {
    if (
      this.unavailable ||
      (helper.publishing && !allowPublishing) ||
      !helper.proven ||
      helper.proven !== helper.spawnSession ||
      helper.claim !== helper.spawnSession ||
      !helper.nativeLeaseNonce
    )
      return false;
    try {
      const lease = readNativeLeaseSync(this.nodeFile, helper.proven);
      return !!lease?.active && !lease.conflicted && lease.nonce === helper.nativeLeaseNonce;
    } catch {
      return false;
    }
  }
  private snapshot(helper: ClaudeHelper): ClaudeProofLease {
    if (!helper.proven || !helper.nativeLeaseNonce) throw unproven();
    return Object.freeze({
      helperId: helper.id,
      epoch: helper.epoch,
      generation: helper.generation,
      session: helper.proven,
      nativeLeaseNonce: helper.nativeLeaseNonce,
    });
  }
  private matches(lease: ClaudeProofLease): boolean {
    const helper = this.helpers.get(lease.helperId);
    return (
      !!helper &&
      helper.epoch === lease.epoch &&
      helper.generation === lease.generation &&
      helper.proven === lease.session &&
      helper.claim === lease.session &&
      helper.spawnSession === lease.session &&
      helper.nativeLeaseNonce === lease.nativeLeaseNonce &&
      this.route(lease.session).helper === helper
    );
  }
  async validateCurrent(lease: ClaudeProofLease): Promise<void> {
    if (!this.matches(lease)) throw unproven();
    const native = await readNativeLease(this.nodeFile, lease.session);
    if (
      !native?.active ||
      native.conflicted ||
      native.nonce !== lease.nativeLeaseNonce ||
      !this.matches(lease)
    )
      throw unproven();
  }
  validateCurrentSync(lease: ClaudeProofLease): void {
    if (!this.matches(lease)) throw unproven();
  }
  /** A private permit for one exact server request, separate from connection tickets. */
  issueCall(
    lease: ClaudeProofLease,
    tool: string,
    inputHash: string,
    connectTicket?: string,
  ): string {
    const name = z.string().min(1).max(128).parse(tool);
    const integrity = hash.parse(inputHash);
    if (
      name === 'agent_connect'
        ? !z.uuid().safeParse(connectTicket).success
        : connectTicket !== undefined
    )
      throw unproven();
    this.validateCurrentSync(lease);
    const now = this.now();
    for (const [token, permit] of this.calls)
      if (permit.expires <= now || !this.matches(permit.lease)) this.calls.delete(token);
    if (this.calls.size >= 512) throw unproven();
    const callToken = randomUUID();
    this.calls.set(callToken, {
      lease: Object.freeze({ ...lease }),
      tool: name,
      hash: integrity,
      expires: now + (this.options.callLifetime ?? 60000),
      state: 'issued',
      ...(name === 'agent_connect' ? { expectedConnectTicket: connectTicket } : {}),
    });
    return callToken;
  }
  private connectTicketMatches(permit: CallPermit, actual: unknown): boolean {
    if (permit.tool !== 'agent_connect') return true;
    return (
      permit.expectedConnectTicket !== undefined &&
      typeof actual === 'string' &&
      z.uuid().safeParse(actual).success &&
      same(permit.expectedConnectTicket, actual)
    );
  }
  private assertPermitCurrent(callToken: string, permit: CallPermit): void {
    if (
      this.calls.get(callToken) !== permit ||
      permit.expires <= this.now() ||
      !this.matches(permit.lease)
    ) {
      if (this.calls.get(callToken) === permit) this.calls.delete(callToken);
      throw unproven();
    }
  }
  async validateCall(raw: unknown): Promise<{ valid: true }> {
    const input = callValidationSchema.parse(raw);
    const helper = this.authenticate(input.helperId, input.secret);
    const permit = this.calls.get(input.callToken);
    if (!permit || permit.lease.helperId !== helper.id) throw unproven();
    this.assertPermitCurrent(input.callToken, permit);
    if (permit.state !== (input.phase === 'forward' ? 'issued' : 'admitted')) throw unproven();
    try {
      await this.validateCurrent(permit.lease);
    } catch {
      if (this.calls.get(input.callToken) === permit) this.calls.delete(input.callToken);
      throw unproven();
    }
    this.assertPermitCurrent(input.callToken, permit);
    if (permit.state !== (input.phase === 'forward' ? 'issued' : 'admitted')) throw unproven();
    return { valid: true };
  }
  /** Linearize admission before the handler's first asynchronous operation. */
  admitCall(
    callToken: string,
    tool: string,
    inputHash: string,
    sessionKey: string,
    requestId: string | number,
    connectTicket?: unknown,
  ): void {
    const permit = this.calls.get(callToken);
    if (
      !permit ||
      permit.state !== 'issued' ||
      permit.tool !== tool ||
      !same(permit.hash, inputHash) ||
      !this.connectTicketMatches(permit, connectTicket) ||
      !this.requestIdentity(sessionKey, requestId)
    )
      throw unproven();
    this.assertPermitCurrent(callToken, permit);
    permit.sessionKey = sessionKey;
    permit.requestId = requestId;
    permit.state = 'admitted';
  }
  private requestIdentity(sessionKey: string, requestId: string | number): boolean {
    return (
      typeof sessionKey === 'string' &&
      sessionKey.length > 0 &&
      ((typeof requestId === 'string' && requestId.length > 0) ||
        (typeof requestId === 'number' && Number.isFinite(requestId)))
    );
  }
  /** Check the admitted server-owned request immediately before and after its handler. */
  assertCall(
    callToken: string,
    tool: string,
    sessionKey: string,
    requestId: string | number,
    connectTicket?: unknown,
  ): void {
    const permit = this.calls.get(callToken);
    if (
      !permit ||
      permit.state !== 'admitted' ||
      permit.tool !== tool ||
      permit.sessionKey !== sessionKey ||
      permit.requestId !== requestId ||
      !this.connectTicketMatches(permit, connectTicket) ||
      !this.requestIdentity(sessionKey, requestId)
    )
      throw unproven();
    this.assertPermitCurrent(callToken, permit);
  }
  private async bootstrap(helper: ClaudeHelper, expectedNonce?: string | null): Promise<boolean> {
    if (
      this.unavailable ||
      this.helpers.get(helper.id) !== helper ||
      !helper.spawnSession ||
      helper.claim !== helper.spawnSession ||
      helper.generation !== 0
    )
      return false;
    const lease = await readNativeLease(this.nodeFile, helper.spawnSession).catch(() => null);
    if (
      !lease?.active ||
      lease.conflicted ||
      (expectedNonce !== undefined && lease.nonce !== expectedNonce) ||
      this.helpers.get(helper.id) !== helper
    )
      return false;
    const capture = helper.nativeLeaseNonce === null;
    if (capture && (!helper.bootstrapPending || this.holders.has(helper.id))) return false;
    if (!capture && helper.nativeLeaseNonce !== lease.nonce) return false;
    if (!this.holders.has(helper.id) && this.holders.size >= 4096) throw unproven();
    helper.nativeLeaseNonce = lease.nonce;
    helper.bootstrapPending = false;
    helper.proven = helper.spawnSession;
    helper.publishing = true;
    this.holders.set(helper.id, {
      helperId: helper.id,
      secretHash: helper.secretHash,
      spawnSession: helper.spawnSession,
      nativeLeaseNonce: lease.nonce,
    });
    const route = this.routes.find((value) => value.helperId === helper.id);
    helper.confirmed = !!(
      route &&
      route.nativeLeaseNonce === lease.nonce &&
      route.generation === helper.generation &&
      route.confirmed
    );
    if (!(await this.persist()) || !this.nativeCurrent(helper, true)) {
      this.fence(helper);
      return false;
    }
    // Pin before change listeners can offer a wake.
    if (capture)
      helper.writer.write(
        JSON.stringify({ type: 'native-lease', session: helper.spawnSession, nonce: lease.nonce }) +
          '\n',
      );
    helper.publishing = false;
    this.invalidateAmbiguousCalls(helper.spawnSession);
    return true;
  }
  async attach(raw: unknown, writer: HelperWriter): Promise<ClaudeHelper> {
    const hello = helperHelloSchema.parse(raw);
    if (this.unavailable || hello.session !== hello.spawnSession) throw unproven();
    const secretHash = digest(hello.secret);
    const previous = this.helpers.get(hello.helperId),
      holder = this.holders.get(hello.helperId);
    if (
      (previous &&
        (!same(previous.secretHash, secretHash) ||
          previous.spawnSession !== hello.spawnSession ||
          previous.nativeLeaseNonce !== hello.nativeLeaseNonce)) ||
      (holder &&
        (!same(holder.secretHash, secretHash) ||
          holder.spawnSession !== hello.spawnSession ||
          holder.nativeLeaseNonce !== hello.nativeLeaseNonce))
    )
      throw unproven();
    if (previous) {
      this.invalidateCalls(previous.id);
      previous.writer.end();
    }
    const helper: ClaudeHelper = {
      id: hello.helperId,
      secretHash,
      epoch: randomUUID(),
      writer,
      spawnSession: hello.spawnSession,
      claim: hello.session,
      generation: hello.generation,
      nativeLeaseNonce: hello.nativeLeaseNonce,
      bootstrapPending: !holder && hello.nativeLeaseNonce === null && hello.generation === 0,
      proven: null,
      confirmed: false,
      publishing: false,
      outstanding: new Map(),
    };
    this.helpers.set(helper.id, helper);
    try {
      await this.bootstrap(helper);
      writer.write(JSON.stringify({ type: 'ready', epoch: helper.epoch }) + '\n');
      this.emit('change');
      this.startHeartbeat();
      return helper;
    } catch {
      this.detach(helper);
      try {
        writer.end();
      } catch {
        // A failed stream has no authority and must not replace a newer helper.
      }
      throw unproven();
    }
  }
  detach(helper: ClaudeHelper): void {
    if (this.helpers.get(helper.id) !== helper) return;
    this.helpers.delete(helper.id);
    helper.outstanding.clear();
    for (const [token, proof] of this.proofs)
      if (proof.lease.helperId === helper.id) this.proofs.delete(token);
    this.invalidateCalls(helper.id);
    this.emit('change');
  }
  /** Model-visible lifecycle calls have no authority, including revocation authority. */
  helperSession(_raw: unknown): never {
    throw new Error('Session changes require native Claude Code lifecycle evidence.');
  }
  async hook(raw: unknown): Promise<{ recorded: true; contextToken?: string }> {
    const input = hookSchema.parse(raw);
    const native = await readNativeLease(this.nodeFile, input.sessionId);
    if (input.event === 'SessionEnd') {
      if (!native || native.active || native.nonce !== input.nativeLeaseNonce || this.unavailable)
        throw unproven();
      for (const helper of this.helpers.values())
        if (helper.spawnSession === input.sessionId) this.fence(helper);
      this.routes = this.routes.filter((route) => route.spawnSession !== input.sessionId);
      await this.persist();
      this.emit('change');
      return { recorded: true };
    }
    if (
      !native?.active ||
      native.conflicted ||
      native.nonce !== input.nativeLeaseNonce ||
      this.unavailable
    )
      throw unproven();
    if (input.event === 'SessionStart') {
      for (const helper of this.helpers.values())
        if (helper.bootstrapPending && helper.spawnSession === input.sessionId)
          await this.bootstrap(helper, input.nativeLeaseNonce);
      this.emit('change');
      return { recorded: true };
    }
    const { helper } = this.route(input.sessionId);
    if (!helper || helper.nativeLeaseNonce !== input.nativeLeaseNonce) throw unproven();
    if (input.event === 'Stop') {
      this.emit('turnEnded', input.sessionId);
      return { recorded: true };
    }
    if (!input.tool?.startsWith(claudeToolPrefix) || !input.inputHash) throw unproven();
    const lease = this.snapshot(helper);
    await this.validateCurrent(lease);
    const now = this.now();
    for (const [token, proof] of this.proofs) if (proof.expires <= now) this.proofs.delete(token);
    if (this.proofs.size >= 512) throw unproven();
    const contextToken = randomUUID();
    this.proofs.set(contextToken, {
      lease,
      tool: input.tool.slice(claudeToolPrefix.length),
      hash: input.inputHash,
      expires: now + (this.options.toolLifetime ?? 30000),
    });
    return { recorded: true, contextToken };
  }
  async correlate(
    raw: unknown,
  ): Promise<{ helper: ClaudeHelper; session: string; lease: ClaudeProofLease }> {
    const input = helperCallSchema.parse(raw);
    const helper = this.authenticate(input.helperId, input.secret);
    const proof = this.proofs.get(input.contextToken);
    if (
      !proof ||
      proof.expires <= this.now() ||
      proof.lease.helperId !== helper.id ||
      proof.tool !== input.tool ||
      !same(proof.hash, input.inputHash)
    )
      throw unproven();
    this.proofs.delete(input.contextToken);
    await this.validateCurrent(proof.lease);
    return { helper, session: proof.lease.session, lease: proof.lease };
  }
  route(session: string): { helper?: ClaudeHelper; ambiguous: boolean } {
    const proven = [...this.helpers.values()].filter(
      (helper) => helper.proven === session && this.nativeCurrent(helper),
    );
    if (proven.length > 1) return { ambiguous: true };
    return { helper: proven[0], ambiguous: false };
  }
  send(helper: ClaudeHelper, message: Record<string, unknown>): boolean {
    if (this.helpers.get(helper.id) !== helper) return false;
    if (message.type !== 'ping' && this.route(helper.proven ?? '').helper !== helper) return false;
    try {
      helper.writer.write(JSON.stringify(message) + '\n');
      return true;
    } catch {
      this.detach(helper);
      return false;
    }
  }
  confirm(helper: ClaudeHelper): void {
    if (helper.confirmed || this.route(helper.proven ?? '').helper !== helper) return;
    helper.confirmed = true;
    void this.persist();
    this.emit('change');
  }
  private startHeartbeat(): void {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(() => {
      for (const helper of [...this.helpers.values()]) this.send(helper, { type: 'ping' });
    }, 15000);
    this.heartbeat.unref();
  }
  async close(): Promise<void> {
    clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    for (const helper of [...this.helpers.values()]) {
      this.helpers.delete(helper.id);
      helper.writer.end();
    }
    this.proofs.clear();
    this.calls.clear();
    await this.persisting;
  }
}

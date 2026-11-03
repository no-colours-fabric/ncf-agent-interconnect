import { EventEmitter } from 'node:events';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { atomicJson } from './settings.js';

/** Qualified tool-name prefix of the plugin server; see desktop/integrations/claude-code.ts. */
export const claudeToolPrefix = 'mcp__plugin_ncf-agent-interconnect_ncf__';

const sessionId = z.uuid();
const secret = z.string().regex(/^[a-f0-9]{64}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const helperHelloSchema = z
  .object({
    helperId: z.uuid(),
    secret,
    spawnSession: sessionId.nullable(),
    session: sessionId.nullable(),
    generation: z.number().int().nonnegative(),
  })
  .strict();
export const helperSessionSchema = z
  .object({
    helperId: z.uuid(),
    secret,
    session: sessionId.nullable(),
    generation: z.number().int().positive(),
  })
  .strict();
export const helperCallSchema = z
  .object({
    helperId: z.uuid(),
    secret,
    tool: z.string().min(1).max(128),
    inputHash: hash,
    connectionId: z.uuid().optional(),
  })
  .strict();
export const hookSchema = z
  .object({
    event: z.enum(['SessionStart', 'SessionEnd', 'PreToolUse']),
    sessionId,
    source: z.string().max(40).optional(),
    reason: z.string().max(40).optional(),
    tool: z.string().max(200).optional(),
    inputHash: hash.optional(),
  })
  .strict();
const routesSchema = z
  .object({
    version: z.literal(1),
    routes: z
      .array(
        z
          .object({
            helperId: z.uuid(),
            secretHash: hash,
            session: sessionId,
            generation: z.number().int().nonnegative(),
            confirmed: z.boolean(),
          })
          .strict(),
      )
      .max(64),
  })
  .strict();
type Route = z.infer<typeof routesSchema>['routes'][number];

export interface HelperWriter {
  write(line: string): boolean;
  end(): void;
}
export interface ClaudeHelper {
  id: string;
  secretHash: string;
  /** Changes for every helper↔node stream; offers belong to one lifecycle. */
  epoch: string;
  writer: HelperWriter;
  spawnSession: string | null;
  claim: string | null;
  generation: number;
  proven: string | null;
  /** A wake in this Claude process was followed by agent_read from the proven session. */
  confirmed: boolean;
  outstanding: Set<string>;
}
interface SessionRecord {
  active: boolean;
  starts: number;
  seen: number;
}
interface ToolRecord {
  session: string;
  tool: string;
  hash: string;
  expires: number;
}

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Trusted Claude Code session evidence. A helper becomes the route of a
 * session only through documented host signals: its spawn environment,
 * command hooks, hook-driven session events on its own transport, a matching
 * PreToolUse record, or a persisted proof for the same live helper. Nothing is
 * inferred from a workspace, title, PID, transcript or a model-supplied value.
 */
export class ClaudeSessions extends EventEmitter {
  private helpers = new Map<string, ClaudeHelper>();
  private sessions = new Map<string, SessionRecord>();
  private tools: ToolRecord[] = [];
  private routes: Route[] = [];
  private persisting: Promise<void> = Promise.resolve();
  private readonly filename: string;
  private heartbeat?: NodeJS.Timeout;
  constructor(
    directory: string,
    private readonly options: { now?: () => number; toolLifetime?: number } = {},
  ) {
    super();
    this.filename = path.join(directory, 'claude-routes.json');
  }
  private now(): number {
    return this.options.now?.() ?? Date.now();
  }
  async load(): Promise<void> {
    try {
      this.routes = routesSchema.parse(JSON.parse(await readFile(this.filename, 'utf8'))).routes;
    } catch {
      // A missing or unreadable proof file only means that routes must be proven again.
      this.routes = [];
    }
  }
  private persist(): Promise<void> {
    const routes = [...this.helpers.values()]
      .filter((helper) => helper.proven)
      .map((helper) => ({
        helperId: helper.id,
        secretHash: helper.secretHash,
        session: helper.proven!,
        generation: helper.generation,
        confirmed: helper.confirmed,
      }));
    // Keep proofs of helpers that are temporarily detached, for node or transport restarts.
    const detached = this.routes.filter((route) => !this.helpers.has(route.helperId));
    this.routes = [...routes, ...detached].slice(0, 64);
    const data = { version: 1 as const, routes: this.routes };
    this.persisting = this.persisting
      .then(() => atomicJson(this.filename, data))
      .catch(() => {
        this.emit('problem', 'Claude Code routes could not be saved');
      });
    return this.persisting;
  }
  private session(id: string): SessionRecord {
    let record = this.sessions.get(id);
    if (!record) {
      record = { active: false, starts: 0, seen: this.now() };
      this.sessions.set(id, record);
      if (this.sessions.size > 1024)
        this.sessions.delete(
          [...this.sessions.entries()].sort((a, b) => a[1].seen - b[1].seen)[0][0],
        );
    }
    record.seen = this.now();
    return record;
  }
  private authenticate(helperId: string, value: string): ClaudeHelper {
    const helper = this.helpers.get(helperId);
    if (!helper || !same(helper.secretHash, digest(value)))
      throw new Error('The Claude Code helper is not connected');
    return helper;
  }
  private fence(helper: ClaudeHelper): void {
    if (!helper.proven) return;
    helper.proven = null;
    helper.outstanding.clear();
  }
  private claimants(session: string): ClaudeHelper[] {
    return [...this.helpers.values()].filter(
      (helper) => helper.proven === session || helper.claim === session,
    );
  }
  /** P1/P2: a claimed session is proven only by matching host evidence. */
  private evaluate(helper: ClaudeHelper): boolean {
    if (helper.proven || !helper.claim) return false;
    const record = this.sessions.get(helper.claim);
    if (!record?.active) return false;
    const launch = helper.generation === 0 && helper.claim === helper.spawnSession;
    if (!launch && record.starts < 1) return false;
    if (record.starts > 0) record.starts--;
    helper.proven = helper.claim;
    return true;
  }
  private reevaluate(): void {
    let changed = false;
    for (const helper of this.helpers.values()) changed = this.evaluate(helper) || changed;
    if (changed) void this.persist();
    this.emit('change');
  }
  attach(raw: unknown, writer: HelperWriter): ClaudeHelper {
    const hello = helperHelloSchema.parse(raw);
    const secretHash = digest(hello.secret);
    const previous = this.helpers.get(hello.helperId);
    if (previous) {
      if (!same(previous.secretHash, secretHash))
        throw new Error('The Claude Code helper identity is invalid');
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
      proven: null,
      confirmed: false,
      outstanding: new Set(),
    };
    // P4: the same live helper, unchanged session generation, persisted proof.
    const route = this.routes.find((value) => value.helperId === hello.helperId);
    if (
      route &&
      same(route.secretHash, secretHash) &&
      route.session === hello.session &&
      route.generation === hello.generation
    ) {
      helper.proven = route.session;
      helper.confirmed = route.confirmed;
      this.session(route.session).active = true;
    }
    this.helpers.set(helper.id, helper);
    writer.write(JSON.stringify({ type: 'ready', epoch: helper.epoch }) + '\n');
    this.evaluate(helper);
    void this.persist();
    this.emit('change');
    this.startHeartbeat();
    return helper;
  }
  detach(helper: ClaudeHelper): void {
    if (this.helpers.get(helper.id) !== helper) return;
    this.helpers.delete(helper.id);
    helper.outstanding.clear();
    this.emit('change');
  }
  /** E3: a hook-driven session event on the helper's own transport. */
  helperSession(raw: unknown): { accepted: true } {
    const input = helperSessionSchema.parse(raw);
    const helper = this.authenticate(input.helperId, input.secret);
    if (input.generation <= helper.generation) return { accepted: true };
    this.fence(helper);
    helper.claim = input.session;
    helper.generation = input.generation;
    this.routes = this.routes.filter((route) => route.helperId !== helper.id);
    this.evaluate(helper);
    void this.persist();
    this.emit('change');
    return { accepted: true };
  }
  /** E2: command hook payload posted with the app-owned node credential. */
  hook(raw: unknown): { recorded: true } {
    const input = hookSchema.parse(raw);
    const record = this.session(input.sessionId);
    if (input.event === 'SessionStart') {
      record.active = true;
      record.starts = Math.min(record.starts + 1, 8);
    } else if (input.event === 'SessionEnd') {
      record.active = false;
      record.starts = 0;
      for (const helper of this.helpers.values())
        if (helper.proven === input.sessionId || helper.claim === input.sessionId) {
          this.fence(helper);
          if (helper.claim === input.sessionId) helper.claim = null;
        }
      this.routes = this.routes.filter((route) => route.session !== input.sessionId);
      void this.persist();
    } else {
      if (!input.tool?.startsWith(claudeToolPrefix) || !input.inputHash) return { recorded: true };
      record.active = true;
      const now = this.now();
      this.tools = this.tools.filter((value) => value.expires > now).slice(-511);
      this.tools.push({
        session: input.sessionId,
        tool: input.tool,
        hash: input.inputHash,
        expires: now + (this.options.toolLifetime ?? 600000),
      });
    }
    this.reevaluate();
    return { recorded: true };
  }
  /**
   * P3: the helper presents the hash of the exact arguments it received. A
   * unique PreToolUse record of the same tool and input proves which session
   * this transport serves. The record is consumed.
   */
  correlate(raw: unknown): { helper: ClaudeHelper; session: string } {
    const input = helperCallSchema.parse(raw);
    const helper = this.authenticate(input.helperId, input.secret);
    const now = this.now();
    this.tools = this.tools.filter((value) => value.expires > now);
    const matches = this.tools.filter(
      (value) => value.tool === claudeToolPrefix + input.tool && value.hash === input.inputHash,
    );
    const sessions = new Set(matches.map((value) => value.session));
    if (sessions.size !== 1)
      throw new Error(
        sessions.size
          ? 'Two Claude Code chats made the same request at once. Repeat it in this chat.'
          : 'The NCF Claude Code hooks did not confirm this chat. Restart Claude Code after setup.',
      );
    this.tools.splice(this.tools.indexOf(matches[0]), 1);
    const session = matches[0].session;
    if (helper.proven !== session) {
      this.fence(helper);
      helper.proven = session;
      helper.claim = session;
      this.session(session).active = true;
      void this.persist();
      this.emit('change');
    }
    return { helper, session };
  }
  /** Exactly one live helper must hold the proven route; ambiguity sends nothing. */
  route(session: string): { helper?: ClaudeHelper; ambiguous: boolean } {
    const proven = [...this.helpers.values()].filter((helper) => helper.proven === session);
    if (proven.length > 1 || (proven.length === 1 && this.claimants(session).length > 1))
      return { ambiguous: true };
    return { helper: proven[0], ambiguous: false };
  }
  send(helper: ClaudeHelper, message: Record<string, unknown>): boolean {
    if (this.helpers.get(helper.id) !== helper) return false;
    try {
      // A false return means buffered output, not a lost line.
      helper.writer.write(JSON.stringify(message) + '\n');
      return true;
    } catch {
      this.detach(helper);
      return false;
    }
  }
  confirm(helper: ClaudeHelper): void {
    if (helper.confirmed) return;
    helper.confirmed = true;
    void this.persist();
    this.emit('change');
  }
  private startHeartbeat(): void {
    if (this.heartbeat) return;
    // Transport keepalive only; it never reads inboxes or prompts a model.
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
    this.tools = [];
    await this.persisting;
  }
}

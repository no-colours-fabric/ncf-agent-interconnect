import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, lstat } from 'node:fs/promises';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export const OPEN_CODE_V2_PROTOCOL = 2 as const;
export const OPEN_CODE_V2_PIN = Object.freeze({
  version: '2.3.0',
  commit: 'a6b15d33daf6ab7d35569f6d711fdb630b9f04e7',
} as const);

const MAX_BYTES = 2 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const scopeKeys = ['protocol', 'nodeId', 'targetId', 'generation', 'bootId', 'nodeEpoch'];
const ownerKeys = ['agentKey', 'incarnation', 'connectionId', 'generation', 'adapterId', 'chatId'];

export interface OpenCodeV2Provision {
  protocol: 2;
  nodeId: string;
  nodeUrl: string;
  targetId: string;
  generation: string;
  credential: string;
}
export interface OpenCodeV2Scope {
  protocol: 2;
  nodeId: string;
  targetId: string;
  generation: string;
  bootId: string;
  nodeEpoch: string;
}
export interface OpenCodeV2Owner {
  agentKey: string;
  incarnation: string;
  connectionId: string;
  generation: number;
  adapterId: string;
  chatId: string;
}
export interface OpenCodeV2Prompt {
  sessionID: string;
  id: string;
  text: string;
  delivery: 'queue';
  resume: true;
}
interface HostEvent {
  id: string;
  created: number;
  type: string;
  location?: { directory: string; workspaceID?: string };
  durable?: { aggregateID: string; seq: number; version: 1 };
  data: Record<string, unknown>;
}
interface SessionInfo {
  id: string;
  projectID: string;
  location: { directory: string; workspaceID?: string };
  time: { created: number };
}
interface InboxUser {
  id: string;
  sessionID: string;
  type: 'user';
  time: { created: number };
  delivery: 'steer' | 'queue';
  payload: {
    text: string;
    files?: readonly unknown[];
    agents?: readonly unknown[];
    skills?: readonly unknown[];
    metadata?: Record<string, unknown>;
  };
}
interface RpcDefinition {
  id: string;
  methods: Readonly<Record<string, never>>;
  events: Readonly<
    Record<
      string,
      {
        schema: {
          type: 'object';
          properties: Readonly<Record<string, { type: 'string' }>>;
          required: readonly string[];
          additionalProperties: false;
        };
      }
    >
  >;
}
type HostEventType =
  | 'location.shutdown'
  | 'session.inbox.delivered'
  | 'session.status'
  | 'session.idle'
  | 'session.deleted'
  | 'session.moved'
  | 'session.revert.committed'
  | 'session.compaction.started'
  | 'session.compaction.ended'
  | `rpc.${string}`;
export interface OpenCodeV2Context {
  app: { name: string; version: string; channel: string };
  location: { directory: string; workspaceID?: string; project?: { id: string } };
  options: Readonly<Record<string, unknown>>;
  mcp: {
    transform(
      callback: (editor: OpenCodeV2McpEditor) => void,
    ): Promise<{ dispose(): Promise<void> }>;
  };
  session: {
    get(input: { sessionID: string }): Promise<SessionInfo>;
    wait(input: { sessionID: string }): Promise<void>;
    prompt(input: OpenCodeV2Prompt): Promise<InboxUser>;
  };
  event: {
    subscribe(options: {
      types: readonly HostEventType[];
      signal?: AbortSignal;
    }): AsyncIterable<HostEvent>;
  };
  rpc: {
    register(
      definition: RpcDefinition,
      handlers: Readonly<Record<string, never>>,
    ): Promise<{
      dispose(): Promise<void>;
      events: { emit(name: string, data: Record<string, unknown>): Promise<void> };
    }>;
  };
}

interface RemoteEntry {
  type: string;
  url?: string;
  headers?: Record<string, string>;
}
export interface OpenCodeV2McpEditor {
  get(name: string): RemoteEntry | undefined;
  update(name: string, change: (entry: RemoteEntry) => void): void;
}

type Scoped = { scope: OpenCodeV2Scope; nonce: string };
export type OpenCodeV2Command =
  | (Scoped & { kind: 'identity'; sessionID: string; expiresAt: number })
  | (Scoped & { kind: 'bind' | 'arm' | 'revoke'; owner: OpenCodeV2Owner })
  | (Scoped & {
      kind: 'submit';
      owner: OpenCodeV2Owner;
      armId: string;
      attemptId: string;
      hostMessageId: string;
      text: string;
      outboundHash: string;
    });

interface EvidenceBase {
  scope: OpenCodeV2Scope;
  authorityRevision: number;
  receiveRevision: number;
}
export type OpenCodeV2Evidence =
  | (EvidenceBase & {
      kind: 'identity';
      nonce: string;
      sessionID: string;
      projectID: string;
      workspace: string;
    })
  | (EvidenceBase & {
      kind: 'arming';
      owner: OpenCodeV2Owner;
      nonce: string;
    })
  | (EvidenceBase & {
      kind: 'ready';
      owner: OpenCodeV2Owner;
      armId: string;
    })
  | (EvidenceBase & {
      kind: 'revoked';
      owner: OpenCodeV2Owner;
      reasonCode: string;
    })
  | (EvidenceBase & {
      kind: 'not-released' | 'uncertain';
      owner: OpenCodeV2Owner;
      nonce: string;
      attemptId: string;
      hostMessageId: string;
      outboundHash: string;
      reasonCode: string;
    })
  | (EvidenceBase & {
      kind: 'submitted';
      owner: OpenCodeV2Owner;
      nonce: string;
      attemptId: string;
      hostMessageId: string;
      outboundHash: string;
      canonicalHash: string;
    })
  | (EvidenceBase & {
      kind: 'projected';
      owner: OpenCodeV2Owner;
      nonce: string;
      attemptId: string;
      hostMessageId: string;
      outboundHash: string;
      canonicalHash: string;
      nativeEvent: { id: string; seq: number };
    });

export interface OpenCodeV2Registration {
  protocol: 2;
  nodeId: string;
  targetId: string;
  generation: string;
  bootId: string;
  workspace: string;
  appVersion: '2.3.0';
  bridgeUrl: string;
  bridgeCredential: string;
  instanceCredential?: string;
}
export interface OpenCodeV2Dependencies {
  loadProvision?: () => Promise<unknown>;
  register?: (
    request: OpenCodeV2Registration,
    provision: OpenCodeV2Provision,
    signal?: AbortSignal,
  ) => Promise<OpenCodeV2Scope>;
  now?: () => number;
  timeoutMs?: number;
  maxWaits?: number;
  maxAttempts?: number;
  maxNativePrompts?: number;
}
export interface OpenCodeV2Handle {
  dispose(): Promise<void>;
}

function fail(code: string): never {
  throw new Error(code);
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('V2_INVALID_OBJECT');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype) fail('V2_INVALID_OBJECT');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, expected: readonly string[]): void {
  if (
    Object.keys(value).length !== expected.length ||
    Object.keys(value).some((key) => !expected.includes(key))
  )
    fail('V2_INVALID_FIELDS');
}
function text(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value.length || value.length > max) fail('V2_INVALID_TEXT');
  return value;
}
function uuid(value: unknown): string {
  const result = text(value, 36);
  if (!UUID.test(result)) fail('V2_INVALID_UUID');
  return result;
}
function hash(value: unknown): string {
  const result = text(value, 64);
  if (!HASH.test(result)) fail('V2_INVALID_HASH');
  return result;
}
function session(value: unknown): string {
  const result = text(value);
  if (!result.startsWith('ses')) fail('V2_INVALID_SESSION');
  return result;
}
function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    fail('V2_INVALID_INTEGER');
  return value;
}
function owner(value: unknown): OpenCodeV2Owner {
  const raw = object(value);
  keys(raw, ownerKeys);
  if (integer(raw.generation) === 0) fail('V2_INVALID_GENERATION');
  return {
    agentKey: text(raw.agentKey),
    incarnation: uuid(raw.incarnation),
    connectionId: uuid(raw.connectionId),
    generation: integer(raw.generation),
    adapterId: uuid(raw.adapterId),
    chatId: session(raw.chatId),
  };
}
function scope(value: unknown): OpenCodeV2Scope {
  const raw = object(value);
  keys(raw, scopeKeys);
  if (raw.protocol !== 2) fail('V2_INVALID_PROTOCOL');
  return {
    protocol: 2,
    nodeId: uuid(raw.nodeId),
    targetId: uuid(raw.targetId),
    generation: uuid(raw.generation),
    bootId: uuid(raw.bootId),
    nodeEpoch: uuid(raw.nodeEpoch),
  };
}
function loopback(value: unknown): string {
  const raw = text(value, 1000);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail('V2_INVALID_ENDPOINT');
  }
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    !url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    fail('V2_INVALID_ENDPOINT');
  return url.origin;
}
function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function credentialEqual(value: unknown, expected: string): boolean {
  if (typeof value !== 'string') return false;
  const left = Buffer.from(value),
    right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function parseOpenCodeV2Provision(value: unknown): OpenCodeV2Provision {
  const raw = object(value);
  keys(raw, ['protocol', 'nodeId', 'nodeUrl', 'targetId', 'generation', 'credential']);
  if (raw.protocol !== 2) fail('V2_INVALID_PROTOCOL');
  return {
    protocol: 2,
    nodeId: uuid(raw.nodeId),
    nodeUrl: loopback(raw.nodeUrl),
    targetId: uuid(raw.targetId),
    generation: uuid(raw.generation),
    credential: hash(raw.credential),
  };
}
export function openCodeV2HostMessageId(attemptId: string): string {
  return 'msg_' + uuid(attemptId);
}
export function openCodeV2Prompt(
  sessionID: string,
  hostMessageId: string,
  canonicalText: string,
): OpenCodeV2Prompt {
  session(sessionID);
  if (!hostMessageId.startsWith('msg_') || !UUID.test(hostMessageId.slice(4)))
    fail('V2_INVALID_HOST_ID');
  if (typeof canonicalText !== 'string' || Buffer.byteLength(canonicalText) > MAX_BYTES)
    fail('V2_INVALID_BODY');
  return { sessionID, id: hostMessageId, text: canonicalText, delivery: 'queue', resume: true };
}
export function openCodeV2PayloadHash(input: OpenCodeV2Prompt): string {
  keys(object(input), ['sessionID', 'id', 'text', 'delivery', 'resume']);
  if (input.delivery !== 'queue' || input.resume !== true) fail('V2_INVALID_PROMPT_MODE');
  return digest(JSON.stringify(openCodeV2Prompt(input.sessionID, input.id, input.text)));
}
export function parseOpenCodeV2Command(value: unknown): OpenCodeV2Command {
  const raw = object(value);
  const common = { scope: scope(raw.scope), nonce: uuid(raw.nonce) };
  if (raw.kind === 'identity') {
    keys(raw, ['kind', 'scope', 'nonce', 'sessionID', 'expiresAt']);
    return {
      ...common,
      kind: 'identity',
      sessionID: session(raw.sessionID),
      expiresAt: integer(raw.expiresAt),
    };
  }
  if (raw.kind === 'bind' || raw.kind === 'arm' || raw.kind === 'revoke') {
    keys(raw, ['kind', 'scope', 'nonce', 'owner']);
    return { ...common, kind: raw.kind, owner: owner(raw.owner) };
  }
  if (raw.kind !== 'submit') fail('V2_INVALID_COMMAND');
  keys(raw, [
    'kind',
    'scope',
    'nonce',
    'owner',
    'armId',
    'attemptId',
    'hostMessageId',
    'text',
    'outboundHash',
  ]);
  const capturedOwner = owner(raw.owner),
    attemptId = uuid(raw.attemptId);
  const hostMessageId = text(raw.hostMessageId);
  if (hostMessageId !== openCodeV2HostMessageId(attemptId)) fail('V2_INVALID_HOST_ID');
  const prompt = openCodeV2Prompt(capturedOwner.chatId, hostMessageId, raw.text as string);
  const outboundHash = hash(raw.outboundHash);
  if (openCodeV2PayloadHash(prompt) !== outboundHash) fail('V2_INVALID_PAYLOAD_HASH');
  return {
    ...common,
    kind: 'submit',
    owner: capturedOwner,
    armId: uuid(raw.armId),
    attemptId,
    hostMessageId,
    text: prompt.text,
    outboundHash,
  };
}

export function parseOpenCodeV2Evidence(value: unknown): OpenCodeV2Evidence {
  const raw = object(value);
  const base = {
    scope: scope(raw.scope),
    authorityRevision: integer(raw.authorityRevision),
    receiveRevision: integer(raw.receiveRevision),
  };
  const baseKeys = ['kind', 'scope', 'authorityRevision', 'receiveRevision'];
  if (raw.kind === 'identity') {
    keys(raw, [...baseKeys, 'nonce', 'sessionID', 'projectID', 'workspace']);
    return {
      ...base,
      kind: 'identity',
      nonce: uuid(raw.nonce),
      sessionID: session(raw.sessionID),
      projectID: text(raw.projectID),
      workspace: text(raw.workspace, 4000),
    };
  }
  const capturedOwner = owner(raw.owner);
  if (raw.kind === 'arming') {
    keys(raw, [...baseKeys, 'owner', 'nonce']);
    return { ...base, kind: 'arming', owner: capturedOwner, nonce: uuid(raw.nonce) };
  }
  if (raw.kind === 'ready') {
    keys(raw, [...baseKeys, 'owner', 'armId']);
    return { ...base, kind: 'ready', owner: capturedOwner, armId: uuid(raw.armId) };
  }
  if (raw.kind === 'revoked') {
    keys(raw, [...baseKeys, 'owner', 'reasonCode']);
    return { ...base, kind: 'revoked', owner: capturedOwner, reasonCode: text(raw.reasonCode) };
  }
  const attempt = {
    owner: capturedOwner,
    nonce: uuid(raw.nonce),
    attemptId: uuid(raw.attemptId),
    hostMessageId: text(raw.hostMessageId),
    outboundHash: hash(raw.outboundHash),
  };
  if (attempt.hostMessageId !== openCodeV2HostMessageId(attempt.attemptId))
    fail('V2_INVALID_HOST_ID');
  const attemptKeys = [...baseKeys, 'owner', 'nonce', 'attemptId', 'hostMessageId', 'outboundHash'];
  if (raw.kind === 'not-released' || raw.kind === 'uncertain') {
    keys(raw, [...attemptKeys, 'reasonCode']);
    return { ...base, ...attempt, kind: raw.kind, reasonCode: text(raw.reasonCode) };
  }
  const canonicalHash = hash(raw.canonicalHash);
  if (raw.kind === 'submitted') {
    keys(raw, [...attemptKeys, 'canonicalHash']);
    return { ...base, ...attempt, kind: 'submitted', canonicalHash };
  }
  if (raw.kind !== 'projected') fail('V2_INVALID_EVIDENCE');
  keys(raw, [...attemptKeys, 'canonicalHash', 'nativeEvent']);
  const nativeEvent = object(raw.nativeEvent);
  keys(nativeEvent, ['id', 'seq']);
  return {
    ...base,
    ...attempt,
    kind: 'projected',
    canonicalHash,
    nativeEvent: { id: text(nativeEvent.id), seq: integer(nativeEvent.seq) },
  };
}

interface Arm {
  id: string;
  receiveRevision: number;
  authorityRevision: number;
  consumed: boolean;
}
interface BoundSession {
  owner: OpenCodeV2Owner;
  projectID: string;
  created: number;
  authorityRevision: number;
  receiveRevision: number;
  requested: boolean;
  arm?: Arm;
  attempt?: Attempt;
  preflight?: string;
}
interface Attempt {
  command: Extract<OpenCodeV2Command, { kind: 'submit' }>;
  bound: BoundSession;
  authorityRevision: number;
  receiveRevision: number;
  returned: boolean;
  projected: boolean;
  failed: boolean;
  event?: { id: string; seq: number };
  canonicalHash: string;
  timer?: NodeJS.Timeout;
}
interface IdentityProof {
  sessionID: string;
  projectID?: string;
  created?: number;
  valid: boolean;
  expires: number;
  pending: boolean;
  consumed?: boolean;
}
interface Wait {
  bound: BoundSession;
  receiveRevision: number;
  expired: boolean;
  timer?: NodeJS.Timeout;
}

async function readProvision(): Promise<unknown> {
  try {
    const filename = new URL('./ncf-target.json', import.meta.url);
    const info = await lstat(filename);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 4096)
      fail('V2_PROVISION_UNAVAILABLE');
    if (
      process.platform !== 'win32' &&
      ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.())
    )
      fail('V2_PROVISION_UNAVAILABLE');
    return JSON.parse(await readFile(filename, 'utf8'));
  } catch {
    return fail('V2_PROVISION_UNAVAILABLE');
  }
}
async function registerNode(
  request: OpenCodeV2Registration,
  provision: OpenCodeV2Provision,
  signal?: AbortSignal,
): Promise<OpenCodeV2Scope> {
  const response = await fetch(provision.nodeUrl + '/integrations/opencode-v2/register', {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + provision.credential,
      'content-type': 'application/json',
    },
    body: JSON.stringify(request),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
      : AbortSignal.timeout(10_000),
    redirect: 'error',
  });
  if (!response.ok) fail('V2_REGISTRATION_UNAVAILABLE');
  const reader = response.body?.getReader();
  if (!reader) fail('V2_REGISTRATION_UNAVAILABLE');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 8192) {
        await reader.cancel();
        fail('V2_REGISTRATION_UNAVAILABLE');
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  return scope(JSON.parse(raw));
}
async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const value of request) {
    const chunk = Buffer.from(value);
    size += chunk.length;
    if (size > 16 * 1024 * 1024) fail('V2_REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
}
function json(response: ServerResponse, status: number, value: unknown): void {
  if (response.writableEnded || response.destroyed) return;
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
}

export async function startOpenCodeV2(
  context: OpenCodeV2Context,
  rawProvision: unknown,
  dependencies: OpenCodeV2Dependencies = {},
): Promise<OpenCodeV2Handle> {
  const provision = parseOpenCodeV2Provision(rawProvision);
  if (
    context.app.version !== OPEN_CODE_V2_PIN.version ||
    typeof context.session.wait !== 'function' ||
    typeof context.event.subscribe !== 'function' ||
    typeof context.mcp?.transform !== 'function' ||
    typeof context.rpc.register !== 'function'
  )
    fail('V2_HOST_UNSUPPORTED');
  const options = object(context.options);
  keys(options, ['targetId', 'generation']);
  if (options.targetId !== provision.targetId || options.generation !== provision.generation)
    fail('V2_TARGET_MISMATCH');
  const workspace = text(context.location.directory, 4000);
  const now = dependencies.now ?? Date.now;
  const timeout = Math.min(Math.max(integer(dependencies.timeoutMs ?? 10_000), 1), 60_000);
  const maxWaits = Math.min(Math.max(integer(dependencies.maxWaits ?? 64), 1), 64);
  const maxAttempts = Math.min(Math.max(integer(dependencies.maxAttempts ?? 64), 1), 64);
  const maxNativePrompts = Math.min(Math.max(integer(dependencies.maxNativePrompts ?? 64), 1), 64);
  const bootId = randomUUID(),
    bridgeCredential = randomBytes(32).toString('hex');
  const abort = new AbortController();
  const sessions = new Map<string, BoundSession>();
  // Uncancellable host waits remain here until actual settlement, even after revoke.
  const waits = new Map<string, Wait>();
  const attempts = new Map<string, Attempt>();
  // Retired authority does not cancel host calls; release slots only on actual settlement.
  let nativePrompts = 0;
  const pendingSubmits = new Set<string>();
  const proofs = new Map<string, IdentityProof>();
  const requests = new Set<ServerResponse>();
  let currentScope: OpenCodeV2Scope | undefined;
  let eventResponse: ServerResponse | undefined;
  let closed = false,
    nativeArmed = false,
    authoritySerial = 0;
  let registration: Awaited<ReturnType<OpenCodeV2Context['rpc']['register']>> | undefined;
  let route: Awaited<ReturnType<OpenCodeV2Context['mcp']['transform']>> | undefined;
  let server: http.Server | undefined;
  let closing: Promise<void> | undefined;
  let rejectBarrier: ((error: Error) => void) | undefined;
  let resolveBarrier: (() => void) | undefined;
  const barrierNonce = randomUUID();
  const rpcId = 'ncf.agent-interconnect.opencode-v2.' + bootId;
  const barrierType = ('rpc.' + rpcId + '.barrier') as `rpc.${string}`;

  const active = (bound: BoundSession): boolean =>
    !closed &&
    nativeArmed &&
    !!eventResponse &&
    !eventResponse.destroyed &&
    !eventResponse.writableEnded &&
    sessions.get(bound.owner.chatId) === bound;
  const base = (bound: BoundSession): EvidenceBase => ({
    scope: currentScope!,
    authorityRevision: bound.authorityRevision,
    receiveRevision: bound.receiveRevision,
  });
  const captured = (attempt: Attempt) => ({
    scope: currentScope!,
    authorityRevision: attempt.authorityRevision,
    receiveRevision: attempt.receiveRevision,
    owner: attempt.command.owner,
    nonce: attempt.command.nonce,
    attemptId: attempt.command.attemptId,
    hostMessageId: attempt.command.hostMessageId,
    outboundHash: attempt.command.outboundHash,
  });
  const attemptCurrent = (attempt: Attempt): boolean =>
    active(attempt.bound) && attempt.bound.authorityRevision === attempt.authorityRevision;
  const publish = (value: OpenCodeV2Evidence): void => {
    const parsed = parseOpenCodeV2Evidence(value);
    if (!eventResponse || eventResponse.destroyed || eventResponse.writableEnded) return;
    if (eventResponse.writableLength > 512 * 1024) {
      const previous = eventResponse;
      eventResponse = undefined;
      revokeAll('V2_CHANNEL_OVERFLOW');
      previous.end();
      return;
    }
    eventResponse.write('data: ' + JSON.stringify(parsed) + '\n\n');
  };
  const uncertain = (
    attempt: Attempt,
    reasonCode: string,
    invalidWitness = true,
  ): OpenCodeV2Evidence => {
    attempt.failed ||= invalidWitness;
    const result: OpenCodeV2Evidence = { kind: 'uncertain', ...captured(attempt), reasonCode };
    publish(result);
    return result;
  };
  const revoke = (bound: BoundSession, reasonCode: string): void => {
    bound.authorityRevision = ++authoritySerial;
    bound.receiveRevision++;
    bound.requested = false;
    if (bound.arm) bound.arm.consumed = true;
    if (bound.attempt) {
      const attempt = bound.attempt;
      uncertain(attempt, reasonCode);
      if (attempt.timer) clearTimeout(attempt.timer);
      if (attempts.get(attempt.command.attemptId) === attempt)
        attempts.delete(attempt.command.attemptId);
      bound.attempt = undefined;
    }
    publish({ kind: 'revoked', ...base(bound), owner: bound.owner, reasonCode });
    sessions.delete(bound.owner.chatId);
  };
  const revokeAll = (reason: string): void => {
    for (const proof of proofs.values()) proof.valid = false;
    for (const bound of [...sessions.values()]) revoke(bound, reason);
  };
  const finish = (attempt: Attempt): void => {
    if (
      attempt.projected ||
      attempt.failed ||
      !attempt.returned ||
      !attempt.event ||
      !attemptCurrent(attempt)
    )
      return;
    attempt.projected = true;
    if (attempt.timer) clearTimeout(attempt.timer);
    publish({
      kind: 'projected',
      ...captured(attempt),
      canonicalHash: attempt.canonicalHash,
      nativeEvent: attempt.event,
    });
    attempts.delete(attempt.command.attemptId);
    if (attempt.bound.attempt === attempt) {
      attempt.bound.attempt = undefined;
      pump();
    }
  };
  const snapshot = async (sessionID: string): Promise<SessionInfo> => {
    const info = await context.session.get({ sessionID });
    if (
      info.id !== sessionID ||
      info.location?.directory !== workspace ||
      (info.location.workspaceID !== undefined &&
        info.location.workspaceID !== context.location.workspaceID) ||
      (context.location.project !== undefined && info.projectID !== context.location.project.id) ||
      typeof info.projectID !== 'string' ||
      !info.projectID ||
      !Number.isSafeInteger(info.time?.created)
    )
      fail('V2_SESSION_MISMATCH');
    return info;
  };
  const pump = (): void => {
    if (closed || !nativeArmed || !eventResponse || eventResponse.writableEnded) return;
    for (const bound of sessions.values()) {
      const id = bound.owner.chatId;
      if (
        !bound.requested ||
        bound.attempt ||
        bound.preflight ||
        waits.has(id) ||
        waits.size >= maxWaits
      )
        continue;
      bound.requested = false;
      const wait: Wait = { bound, receiveRevision: bound.receiveRevision, expired: false };
      waits.set(id, wait);
      wait.timer = setTimeout(() => {
        wait.expired = true;
        if (active(bound)) {
          bound.receiveRevision++;
          if (bound.arm) bound.arm.consumed = true;
          publish({
            kind: 'revoked',
            ...base(bound),
            owner: bound.owner,
            reasonCode: 'V2_WAIT_TIMEOUT',
          });
        }
      }, timeout);
      wait.timer.unref();
      void Promise.resolve()
        .then(() => context.session.wait({ sessionID: id }))
        .then(
          () => {
            if (wait.expired || !active(bound) || wait.receiveRevision !== bound.receiveRevision)
              return;
            const arm: Arm = {
              id: randomUUID(),
              consumed: false,
              authorityRevision: bound.authorityRevision,
              receiveRevision: bound.receiveRevision,
            };
            bound.arm = arm;
            publish({ kind: 'ready', ...base(bound), owner: bound.owner, armId: arm.id });
          },
          () => {
            if (active(bound)) {
              bound.receiveRevision++;
              publish({
                kind: 'revoked',
                ...base(bound),
                owner: bound.owner,
                reasonCode: 'V2_WAIT_UNAVAILABLE',
              });
            }
          },
        )
        .finally(() => {
          if (wait.timer) clearTimeout(wait.timer);
          if (waits.get(id) === wait) waits.delete(id);
          // Only a latched current bind/arm/native idle trigger requests another wait.
          pump();
        });
    }
  };
  const dispatch = (event: HostEvent): void => {
    if (closed) return;
    if (
      event.type === barrierType &&
      event.data?.nonce === barrierNonce &&
      event.location?.directory === workspace
    ) {
      nativeArmed = true;
      resolveBarrier?.();
      return;
    }
    if (event.type === 'location.shutdown') {
      if (event.location?.directory && event.location.directory !== workspace) return;
      if (
        event.location?.workspaceID &&
        event.location.workspaceID !== context.location.workspaceID
      )
        return;
      nativeArmed = false;
      revokeAll('V2_LOCATION_ENDED');
      return;
    }
    const id = event.data?.sessionID;
    if (typeof id !== 'string') return;
    if (event.location?.directory && event.location.directory !== workspace) return;
    if (
      event.type === 'session.deleted' ||
      event.type === 'session.moved' ||
      event.type === 'session.revert.committed'
    ) {
      for (const proof of proofs.values()) if (proof.sessionID === id) proof.valid = false;
      const bound = sessions.get(id);
      if (bound) revoke(bound, 'V2_SESSION_ENDED');
      return;
    }
    if (event.type === 'session.inbox.delivered') {
      for (const attempt of attempts.values()) {
        if (
          attempt.command.owner.chatId !== id ||
          attempt.command.hostMessageId !== event.data.inboxID ||
          !attemptCurrent(attempt)
        )
          continue;
        if (
          !event.durable ||
          event.durable.aggregateID !== id ||
          event.durable.version !== 1 ||
          !Number.isSafeInteger(event.durable.seq) ||
          event.durable.seq < 0 ||
          typeof event.id !== 'string' ||
          !event.id
        ) {
          uncertain(attempt, 'V2_DELIVERED_INVALID');
          continue;
        }
        if (!attempt.event) attempt.event = { id: event.id, seq: event.durable.seq };
        finish(attempt);
      }
      return;
    }
    const bound = sessions.get(id);
    if (!bound) return;
    if (
      event.type === 'session.status' ||
      event.type === 'session.idle' ||
      event.type === 'session.compaction.started' ||
      event.type === 'session.compaction.ended'
    ) {
      bound.receiveRevision++;
      if (
        event.type !== 'session.idle' &&
        !(event.type === 'session.status' && object(event.data.status).type === 'idle')
      )
        publish({
          kind: 'revoked',
          ...base(bound),
          owner: bound.owner,
          reasonCode: 'V2_RECEIVE_CHANGED',
        });
      if (
        event.type === 'session.idle' ||
        (event.type === 'session.status' && object(event.data.status).type === 'idle')
      )
        bound.requested = true;
      pump();
    }
  };
  const dispose = (): Promise<void> => {
    if (closing) return closing;
    closed = true;
    nativeArmed = false;
    rejectBarrier?.(new Error('V2_DISPOSED'));
    revokeAll('V2_DISPOSED');
    for (const wait of waits.values()) if (wait.timer) clearTimeout(wait.timer);
    for (const attempt of attempts.values()) if (attempt.timer) clearTimeout(attempt.timer);
    abort.abort();
    eventResponse?.end();
    for (const response of requests) json(response, 503, { error: 'V2_DISPOSED' });
    closing = (async () => {
      await route?.dispose();
      await registration?.dispose();
      if (server?.listening)
        await new Promise<void>((resolve, reject) => {
          server!.close((error) => (error ? reject(error) : resolve()));
          server!.closeIdleConnections();
          server!.closeAllConnections();
        });
      // Never await uncancellable native waits or an already issued host prompt.
    })();
    return closing;
  };
  const execute = async (
    command: OpenCodeV2Command,
    isRequestCurrent: () => boolean,
  ): Promise<OpenCodeV2Evidence | { revoked: true }> => {
    if (closed || !nativeArmed || !currentScope || !same(command.scope, currentScope))
      fail('V2_SCOPE_UNAVAILABLE');
    if (command.kind === 'identity') {
      for (const [key, proof] of proofs) {
        if (proof.expires <= now()) {
          proof.valid = false;
          if (!proof.pending) proofs.delete(key);
        }
      }
      if (
        command.expiresAt <= now() ||
        command.expiresAt > now() + 60_000 ||
        proofs.has(command.nonce) ||
        proofs.size >= 512
      )
        fail('V2_NONCE_UNAVAILABLE');
      const proof: IdentityProof = {
        sessionID: command.sessionID,
        expires: command.expiresAt,
        valid: true,
        pending: true,
      };
      proofs.set(command.nonce, proof);
      let info: SessionInfo;
      try {
        info = await snapshot(command.sessionID);
      } catch {
        proof.valid = false;
        throw new Error('V2_SESSION_UNAVAILABLE');
      } finally {
        proof.pending = false;
      }
      if (closed || !nativeArmed || !proof.valid || proof.expires <= now() || !isRequestCurrent())
        fail('V2_SCOPE_UNAVAILABLE');
      proof.projectID = info.projectID;
      proof.created = info.time.created;
      const result: OpenCodeV2Evidence = {
        kind: 'identity',
        scope: currentScope,
        authorityRevision: authoritySerial,
        receiveRevision: 0,
        nonce: command.nonce,
        sessionID: command.sessionID,
        projectID: info.projectID,
        workspace,
      };
      return result;
    }
    if (command.kind === 'bind') {
      const proof = proofs.get(command.nonce);
      if (
        !proof?.valid ||
        proof.pending ||
        proof.consumed ||
        proof.expires <= now() ||
        proof.sessionID !== command.owner.chatId ||
        !proof.projectID ||
        sessions.size >= 64
      )
        fail('V2_BIND_UNAVAILABLE');
      proof.pending = true;
      proof.consumed = true;
      let info: SessionInfo;
      try {
        info = await snapshot(command.owner.chatId);
      } finally {
        proof.pending = false;
        if (proofs.get(command.nonce) === proof) proofs.delete(command.nonce);
      }
      if (
        closed ||
        !nativeArmed ||
        !proof.valid ||
        proof.expires <= now() ||
        info.projectID !== proof.projectID ||
        info.time.created !== proof.created ||
        !isRequestCurrent()
      )
        fail('V2_BIND_UNAVAILABLE');
      const previous = sessions.get(command.owner.chatId);
      if (previous) revoke(previous, 'V2_OWNER_REPLACED');
      const bound: BoundSession = {
        owner: command.owner,
        projectID: info.projectID,
        created: info.time.created,
        authorityRevision: ++authoritySerial,
        receiveRevision: 0,
        requested: true,
      };
      sessions.set(command.owner.chatId, bound);
      pump();
      return { kind: 'arming', ...base(bound), owner: bound.owner, nonce: command.nonce };
    }
    const bound = sessions.get(command.owner.chatId);
    if (!bound || !active(bound) || !same(command.owner, bound.owner)) fail('V2_OWNER_UNAVAILABLE');
    if (command.kind === 'revoke') {
      revoke(bound, 'V2_OWNER_REVOKED');
      return { revoked: true };
    }
    if (command.kind === 'arm') {
      bound.requested = true;
      pump();
      return { kind: 'arming', ...base(bound), owner: bound.owner, nonce: command.nonce };
    }
    if (command.kind !== 'submit') fail('V2_INVALID_COMMAND');
    const arm = bound.arm;
    if (
      !arm ||
      arm.id !== command.armId ||
      arm.consumed ||
      bound.attempt ||
      bound.preflight ||
      attempts.has(command.attemptId) ||
      pendingSubmits.has(command.attemptId)
    )
      fail('V2_ARM_UNAVAILABLE');
    const noBody = (reasonCode: string): OpenCodeV2Evidence => {
      arm.consumed = true;
      const value: OpenCodeV2Evidence = {
        kind: 'not-released',
        ...base(bound),
        owner: bound.owner,
        nonce: command.nonce,
        attemptId: command.attemptId,
        hostMessageId: command.hostMessageId,
        outboundHash: command.outboundHash,
        reasonCode,
      };
      publish(value);
      return value;
    };
    if (
      arm.receiveRevision !== bound.receiveRevision ||
      arm.authorityRevision !== bound.authorityRevision
    )
      return noBody('V2_ARM_CHANGED');
    if (attempts.size + pendingSubmits.size >= maxAttempts) return noBody('V2_ATTEMPT_CAPACITY');
    if (nativePrompts >= maxNativePrompts) return noBody('V2_NATIVE_PROMPT_CAPACITY');
    const authority = bound.authorityRevision;
    bound.preflight = command.nonce;
    pendingSubmits.add(command.attemptId);
    let info: SessionInfo;
    try {
      info = await snapshot(bound.owner.chatId);
    } catch {
      if (!active(bound) || bound.authorityRevision !== authority) fail('V2_SCOPE_UNAVAILABLE');
      return noBody('V2_PREFLIGHT_UNAVAILABLE');
    } finally {
      if (bound.preflight === command.nonce) bound.preflight = undefined;
      pendingSubmits.delete(command.attemptId);
    }
    if (!active(bound) || bound.authorityRevision !== authority) fail('V2_SCOPE_UNAVAILABLE');
    if (info.projectID !== bound.projectID || info.time.created !== bound.created)
      fail('V2_SESSION_MISMATCH');
    if (arm.consumed || bound.attempt) fail('V2_ARM_UNAVAILABLE');
    if (arm.receiveRevision !== bound.receiveRevision) return noBody('V2_ARM_CHANGED');
    if (attempts.size >= maxAttempts) return noBody('V2_ATTEMPT_CAPACITY');
    if (nativePrompts >= maxNativePrompts) return noBody('V2_NATIVE_PROMPT_CAPACITY');
    if (!isRequestCurrent()) return noBody('V2_REQUEST_CANCELLED');
    const input = openCodeV2Prompt(bound.owner.chatId, command.hostMessageId, command.text);
    const attempt: Attempt = {
      command,
      bound,
      authorityRevision: authority,
      receiveRevision: ++bound.receiveRevision,
      returned: false,
      projected: false,
      failed: false,
      canonicalHash: digest(JSON.stringify({ text: command.text })),
    };
    arm.consumed = true;
    bound.attempt = attempt;
    bound.requested = false;
    attempts.set(command.attemptId, attempt);
    // No await separates the final local arm CAS from the sole native invocation.
    let returned: Promise<InboxUser>;
    nativePrompts++;
    try {
      returned = context.session.prompt(input);
    } catch {
      nativePrompts--;
      return uncertain(attempt, 'V2_PROMPT_UNCERTAIN');
    }
    const validate = returned
      .finally(() => {
        nativePrompts--;
      })
      .then((value) => {
        if (!attemptCurrent(attempt)) fail('V2_SCOPE_UNAVAILABLE');
        const raw = object(value),
          payload = object(raw.payload);
        keys(raw, ['id', 'sessionID', 'type', 'time', 'delivery', 'payload']);
        const time = object(raw.time);
        keys(time, ['created']);
        integer(time.created);
        if (
          raw.id !== command.hostMessageId ||
          raw.sessionID !== bound.owner.chatId ||
          raw.type !== 'user' ||
          raw.delivery !== 'queue' ||
          payload.text !== command.text
        )
          fail('V2_POSTHOOK_MISMATCH');
        if (
          Object.keys(payload).some(
            (key) => !['text', 'files', 'agents', 'skills', 'metadata'].includes(key),
          )
        )
          fail('V2_POSTHOOK_MISMATCH');
        for (const key of ['files', 'agents', 'skills'])
          if (payload[key] !== undefined && (!Array.isArray(payload[key]) || payload[key].length))
            fail('V2_POSTHOOK_MISMATCH');
        if (payload.metadata !== undefined && Object.keys(object(payload.metadata)).length)
          fail('V2_POSTHOOK_MISMATCH');
        attempt.returned = true;
        publish({ kind: 'submitted', ...captured(attempt), canonicalHash: attempt.canonicalHash });
        finish(attempt);
        return {
          kind: 'submitted',
          ...captured(attempt),
          canonicalHash: attempt.canonicalHash,
        } as OpenCodeV2Evidence;
      })
      .catch(() => uncertain(attempt, 'V2_PROMPT_UNCERTAIN'));
    const timed = new Promise<OpenCodeV2Evidence>((resolve) => {
      attempt.timer = setTimeout(
        () => resolve(uncertain(attempt, 'V2_PROMPT_TIMEOUT', false)),
        timeout,
      );
      attempt.timer.unref();
    });
    const result = await Promise.race([validate, timed]);
    if (attempt.timer && (attempt.projected || attempt.failed)) clearTimeout(attempt.timer);
    return result;
  };

  try {
    registration = await context.rpc.register(
      {
        id: rpcId,
        methods: {},
        events: {
          barrier: {
            schema: {
              type: 'object',
              properties: { nonce: { type: 'string' } },
              required: ['nonce'],
              additionalProperties: false,
            },
          },
        },
      },
      {},
    );
    const barrier = new Promise<void>((resolve, reject) => {
      resolveBarrier = resolve;
      rejectBarrier = reject;
    });
    const iterable = context.event.subscribe({
      types: [
        barrierType,
        'location.shutdown',
        'session.inbox.delivered',
        'session.status',
        'session.idle',
        'session.deleted',
        'session.moved',
        'session.revert.committed',
        'session.compaction.started',
        'session.compaction.ended',
      ],
      signal: abort.signal,
    });
    void (async () => {
      try {
        for await (const event of iterable) dispatch(event);
      } catch {
        rejectBarrier?.(new Error('V2_STREAM_UNAVAILABLE'));
      } finally {
        nativeArmed = false;
        revokeAll('V2_STREAM_ENDED');
        rejectBarrier?.(new Error('V2_STREAM_UNAVAILABLE'));
      }
    })();
    void registration.events
      .emit('barrier', { nonce: barrierNonce })
      .catch(() => rejectBarrier?.(new Error('V2_BARRIER_UNAVAILABLE')));
    let barrierTimer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        barrier,
        new Promise<never>((_, reject) => {
          barrierTimer = setTimeout(() => reject(new Error('V2_BARRIER_TIMEOUT')), timeout);
        }),
      ]);
    } finally {
      if (barrierTimer) clearTimeout(barrierTimer);
    }
    if (closed || !nativeArmed) fail('V2_STREAM_UNAVAILABLE');
    server = http.createServer({ maxHeaderSize: 8192 }, (request, response) => {
      if (closed || requests.size >= 32) {
        response.setHeader('connection', 'close');
        json(response, 503, { error: 'V2_BRIDGE_CAPACITY' });
        return;
      }
      requests.add(response);
      response.once('close', () => requests.delete(response));
      void (async () => {
        const address = server!.address();
        const port = address && typeof address !== 'string' ? address.port : 0;
        if (
          request.headers.origin !== undefined ||
          request.headers.host !== '127.0.0.1:' + port ||
          !credentialEqual(request.headers.authorization, 'Bearer ' + bridgeCredential)
        ) {
          response.setHeader('connection', 'close');
          json(response, 401, { error: 'V2_AUTH' });
          return;
        }
        if (request.method === 'GET' && request.url === '/events') {
          if (eventResponse && !eventResponse.destroyed) {
            json(response, 409, { error: 'V2_CONSUMER_EXISTS' });
            return;
          }
          eventResponse = response;
          response.writeHead(200, {
            'content-type': 'text/event-stream',
            'cache-control': 'no-store',
          });
          response.write(': connected\n\n');
          pump();
          response.once('close', () => {
            if (eventResponse !== response) return;
            eventResponse = undefined;
            revokeAll('V2_CHANNEL_ENDED');
          });
          return;
        }
        if (request.method !== 'POST' || request.url !== '/command') {
          json(response, 404, { error: 'V2_ROUTE' });
          return;
        }
        const command = parseOpenCodeV2Command(await body(request));
        const result = await execute(command, () => !response.destroyed && !response.writableEnded);
        json(response, 200, result);
      })().catch(() => json(response, 409, { error: 'V2_COMMAND_UNAVAILABLE' }));
    });
    server.requestTimeout = 10_000;
    await new Promise<void>((resolve, reject) => {
      server!.once('error', reject);
      server!.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') fail('V2_BRIDGE_UNAVAILABLE');
    const request: OpenCodeV2Registration = {
      protocol: 2,
      nodeId: provision.nodeId,
      targetId: provision.targetId,
      generation: provision.generation,
      bootId,
      workspace,
      appVersion: '2.3.0',
      bridgeUrl: 'http://127.0.0.1:' + address.port,
      bridgeCredential,
      instanceCredential: randomBytes(32).toString('hex'),
    };
    let registered: OpenCodeV2Scope;
    let registrationTimer: NodeJS.Timeout | undefined;
    try {
      registered = await Promise.race([
        (dependencies.register ?? registerNode)(request, provision, abort.signal),
        new Promise<never>((_, reject) => {
          registrationTimer = setTimeout(
            () => reject(new Error('V2_REGISTRATION_UNAVAILABLE')),
            timeout,
          );
        }),
      ]);
    } catch {
      fail('V2_REGISTRATION_UNAVAILABLE');
    } finally {
      if (registrationTimer) clearTimeout(registrationTimer);
    }
    currentScope = scope(registered);
    if (
      closed ||
      !nativeArmed ||
      currentScope.nodeId !== provision.nodeId ||
      currentScope.targetId !== provision.targetId ||
      currentScope.generation !== provision.generation ||
      currentScope.bootId !== bootId
    )
      fail('V2_REGISTRATION_MISMATCH');
    const endpoint =
      provision.nodeUrl +
      '/integrations/opencode-v2/' +
      provision.targetId +
      '/' +
      provision.generation;
    route = await context.mcp.transform((editor) => {
      const name = 'ncf_agent_interconnect';
      const entry = editor.get(name);
      if (
        entry?.type !== 'remote' ||
        entry.url !== endpoint + '/mcp' ||
        entry.headers?.Authorization !== 'Bearer ' + provision.credential
      )
        return;
      editor.update(name, (remote) => {
        remote.url = endpoint + '/' + bootId + '/mcp';
        remote.headers = {
          ...remote.headers,
          'x-ncf-opencode-instance': request.instanceCredential!,
        };
      });
    });
    return { dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
}

export function createOpenCodeV2Plugin(dependencies: OpenCodeV2Dependencies = {}) {
  return {
    id: 'ncf-agent-interconnect-opencode-v2',
    setup: async (context: OpenCodeV2Context): Promise<() => Promise<void>> => {
      let provision: unknown;
      try {
        provision = await (dependencies.loadProvision ?? readProvision)();
      } catch {
        fail('V2_PROVISION_UNAVAILABLE');
      }
      const handle = await startOpenCodeV2(context, provision, dependencies);
      // The pinned Promise adapter accepts a cleanup function, not a {dispose} object.
      return () => handle.dispose();
    },
  };
}

const OpenCodeV2Plugin = createOpenCodeV2Plugin();
export default OpenCodeV2Plugin;

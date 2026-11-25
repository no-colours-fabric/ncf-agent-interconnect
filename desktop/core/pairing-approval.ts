import {
  createHash,
  randomBytes,
  randomUUID,
  sign,
  timingSafeEqual,
  verify,
  X509Certificate,
} from 'node:crypto';
import { z } from 'zod';
import type { IncomingPairApproval, PairApprovalDecision } from '../shared/pairing-approval.js';
import { certificateDer, PairingError, type PairedIdentity } from './pairing.js';

export const approvalPath = '/pair-approval/v2';
const domain = 'ncf-pair-approval/v2';
const lifetime = 120_000;
const challengeLifetime = 12_000;
const limit = 32;
const hex = z.string().regex(/^[0-9a-f]{64}$/);
const id = z.uuid().refine((value) => value === value.toLowerCase());
export const approvalIdentity = z
  .object({
    nodeId: id,
    label: z.string().min(1).max(120),
    certificate: z.string().min(1).max(20000),
  })
  .strict();
type Identity = z.infer<typeof approvalIdentity>;
export const approvalChallenge = z.object({ id, identity: approvalIdentity }).strict();
type Challenge = z.infer<typeof approvalChallenge>;
const approvalAuth = z.object({ id, token: hex });
const prepare = z.object({ phase: z.literal('prepare'), commitment: hex }).strict();
const request = approvalAuth
  .extend({
    phase: z.literal('request'),
    identity: approvalIdentity,
    signature: z.string().regex(/^[A-Za-z0-9_-]{1,2048}$/),
  })
  .strict();
const status = approvalAuth.extend({ phase: z.literal('status') }).strict();
const commit = approvalAuth.extend({ phase: z.literal('commit') }).strict();
const cancel = approvalAuth
  .extend({ phase: z.literal('cancel'), identity: approvalIdentity })
  .strict();
const inputSchema = z.discriminatedUnion('phase', [prepare, request, status, commit, cancel]);

export const approvalStatus = z.discriminatedUnion('state', [
  z.object({ state: z.enum(['waiting', 'shown', 'dismissed', 'suppressed', 'paired']) }).strict(),
  z.object({ state: z.literal('approved'), secret: hex }).strict(),
]);
type Status = z.infer<typeof approvalStatus>;
type Auth = z.infer<typeof approvalAuth>;

export function approvalIdentityKey(identity: Identity): string {
  const digest = createHash('sha256').update(certificateDer(identity.certificate)).digest('hex');
  return identity.nodeId + ':' + digest;
}

function transcript(challenge: Challenge, requester: Identity, token: string): Buffer {
  return Buffer.from(
    JSON.stringify([
      domain,
      challenge.id,
      approvalIdentityKey(challenge.identity),
      challenge.identity.label,
      approvalIdentityKey(requester),
      requester.label,
      token,
    ]),
  );
}

export function approvalCommitment(identity: Identity, token: string): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        domain + '/commitment',
        approvalIdentityKey(identity),
        identity.label,
        token,
      ]),
    )
    .digest('hex');
}

export function approvalComparisonCode(
  challenge: Challenge,
  identity: Identity,
  token: string,
): string {
  const digest = createHash('sha256')
    .update(transcript(challenge, identity, token))
    .digest();
  return String(Number(digest.readBigUInt64BE() % 1_000_000n)).padStart(6, '0');
}

export function signApprovalRequest(
  challenge: Challenge,
  identity: Identity,
  key: string,
  token: string,
) {
  return {
    phase: 'request',
    id: challenge.id,
    token,
    identity,
    signature: sign('sha256', transcript(challenge, identity, token), key).toString('base64url'),
  };
}

interface Request {
  identity: Identity;
  key: string;
  token: string;
  comparisonCode: string;
  address: string;
  state: Status['state'];
  secret?: string;
  saving?: Promise<void>;
  deciding?: boolean;
}
interface Session {
  challenge: Challenge;
  commitment: string;
  expires: number;
  address: string;
  available: () => boolean;
  request?: Request;
}

export class PairApprovalHost {
  private sessions = new Map<string, Session>();
  private deadline?: NodeJS.Timeout;
  constructor(
    private readonly options: {
      identity: () => Identity;
      isSuppressed: (key: string) => boolean;
      suppress: (key: string) => Promise<void>;
      checkIdentity: (identity: Identity) => void;
      changed: () => void;
    },
  ) {}

  private schedule(): void {
    clearTimeout(this.deadline);
    if (!this.sessions.size) return;
    const next = Math.min(...[...this.sessions.values()].map((session) => session.expires));
    this.deadline = setTimeout(
      () => {
        this.prune();
        this.schedule();
        this.options.changed();
      },
      Math.max(1, next - Date.now()),
    );
    this.deadline.unref();
  }

  private prune(): void {
    for (const [id, session] of this.sessions)
      if (session.expires <= Date.now() || !session.available()) this.sessions.delete(id);
  }

  reset(): void {
    this.sessions.clear();
    clearTimeout(this.deadline);
  }

  forgetPeer(nodeId: string): void {
    for (const [id, session] of this.sessions)
      if (session.request?.identity.nodeId === nodeId) this.sessions.delete(id);
    this.schedule();
  }

  next(): IncomingPairApproval | undefined {
    this.prune();
    for (const { challenge, request } of this.sessions.values()) {
      if (
        request?.state !== 'waiting' &&
        request?.state !== 'shown' &&
        request?.state !== 'approved'
      )
        continue;
      return {
        id: challenge.id,
        label: request.identity.label,
        address: request.address,
        comparisonCode: request.comparisonCode,
      };
    }
  }

  displayed(id: string): boolean {
    if (this.next()?.id !== id) return false;
    const request = this.sessions.get(id)!.request!;
    if (request.state === 'waiting') request.state = 'shown';
    return true;
  }

  async decide(id: string, decision: PairApprovalDecision): Promise<void> {
    this.prune();
    const request = this.sessions.get(id)?.request;
    if (!request) return;
    if (request.state === 'approved' && decision === 'dismiss' && !request.saving) {
      request.state = 'dismissed';
      request.secret = undefined;
      this.options.changed();
      return;
    }
    if (request.state !== 'waiting' && request.state !== 'shown') return;
    if (request.deciding && decision !== 'dismiss')
      throw new PairingError('A decision is already being saved', 409);
    if (decision === 'dismiss') request.state = 'dismissed';
    else {
      if (request.state !== 'shown')
        throw new PairingError('This request is no longer displayed', 409);
      if (decision === 'suppress') {
        request.deciding = true;
        try {
          await this.options.suppress(request.key);
        } finally {
          request.deciding = false;
        }
        for (const entry of this.sessions.values())
          if (
            entry.request?.key === request.key &&
            (entry.request.state === 'waiting' || entry.request.state === 'shown')
          )
            entry.request.state = 'suppressed';
      } else {
        this.options.checkIdentity(request.identity);
        request.secret = randomBytes(32).toString('hex');
        request.state = 'approved';
      }
    }
    this.options.changed();
  }

  async handle(
    raw: unknown,
    address: string,
    available: () => boolean,
    admit: (identity: PairedIdentity, guard: () => void) => Promise<void>,
  ): Promise<Challenge | Status> {
    const result = inputSchema.safeParse(raw);
    if (!result.success) throw new PairingError('Invalid connection approval request');
    const input = result.data;
    this.prune();
    if (input.phase === 'prepare') {
      const prepared = [...this.sessions.values()].filter((session) => !session.request);
      if (
        this.sessions.size >= limit ||
        prepared.filter((session) => session.address === address).length >= 4
      )
        throw new PairingError('Too many connection approval requests', 429);
      const challenge = {
        id: randomUUID(),
        identity: approvalIdentity.parse(this.options.identity()),
      };
      this.sessions.set(challenge.id, {
        challenge,
        commitment: input.commitment,
        expires: Date.now() + challengeLifetime,
        address,
        available,
      });
      this.schedule();
      return challenge;
    }

    const session = this.sessions.get(input.id);
    if (!session) throw new PairingError('The connection request expired or was closed', 410);
    const matchesCommitment = (identity: Identity, token: string) =>
      timingSafeEqual(
        Buffer.from(session.commitment, 'hex'),
        Buffer.from(approvalCommitment(identity, token), 'hex'),
      );
    if (input.phase === 'request') {
      if (session.request) return this.state(session.request, input);
      if (input.identity.nodeId === session.challenge.identity.nodeId)
        throw new PairingError('This address belongs to this node');
      if (
        !matchesCommitment(input.identity, input.token) ||
        !verify(
          'sha256',
          transcript(session.challenge, input.identity, input.token),
          new X509Certificate(input.identity.certificate).publicKey,
          Buffer.from(input.signature, 'base64url'),
        )
      )
        throw new PairingError('The requesting node could not be verified', 401);
      this.options.checkIdentity(input.identity);
      const key = approvalIdentityKey(input.identity);
      const duplicate = [...this.sessions.values()].some(
        ({ request }) =>
          request?.key === key && ['waiting', 'shown', 'approved'].includes(request.state),
      );
      if (duplicate)
        throw new PairingError('This node already has an active connection request', 409);
      const suppressed = this.options.isSuppressed(key);
      session.request = {
        identity: input.identity,
        key,
        address,
        token: input.token,
        comparisonCode: approvalComparisonCode(session.challenge, input.identity, input.token),
        state: suppressed ? 'suppressed' : 'waiting',
      };
      session.expires = Date.now() + lifetime;
      // Queue by verified request arrival, so completing an older challenge cannot displace a visible window.
      this.sessions.delete(input.id);
      this.sessions.set(input.id, session);
      this.schedule();
      if (!suppressed) this.options.changed();
      return { state: suppressed ? 'suppressed' : 'waiting' };
    }
    const entry = session.request;
    if (!entry) {
      // Cancellation can overtake the signed request on a different TLS connection.
      if (input.phase === 'cancel' && matchesCommitment(input.identity, input.token)) {
        this.sessions.delete(input.id);
        this.schedule();
        return { state: 'dismissed' };
      }
      throw new PairingError('The requesting node could not be verified', 401);
    }
    const current = this.state(entry, input);
    if (input.phase === 'status') return current;
    if (input.phase === 'cancel') {
      if (!entry.saving && current.state !== 'paired') {
        entry.state = 'dismissed';
        entry.secret = undefined;
        this.options.changed();
      }
      return { state: entry.state === 'paired' ? 'paired' : 'dismissed' };
    }
    if (current.state === 'paired') return current;
    if (current.state !== 'approved')
      throw new PairingError('The owner has not approved this connection', 409);
    const guard = () => {
      if (
        this.sessions.get(input.id) !== session ||
        Date.now() >= session.expires ||
        !session.available() ||
        !available()
      )
        throw new PairingError('The connection request is no longer available', 409);
      this.options.checkIdentity(entry.identity);
    };
    guard();
    entry.saving ??= admit({ ...entry.identity, secret: current.secret }, guard)
      .then(() => {
        entry.state = 'paired';
        entry.secret = undefined;
        this.options.changed();
      })
      .finally(() => {
        entry.saving = undefined;
      });
    await entry.saving;
    return { state: 'paired' };
  }

  private state(entry: Request, auth: Auth): Status {
    if (!timingSafeEqual(Buffer.from(entry.token, 'hex'), Buffer.from(auth.token, 'hex')))
      throw new PairingError('The requesting node could not be verified', 401);
    return entry.state === 'approved'
      ? { state: 'approved', secret: entry.secret! }
      : { state: entry.state };
  }
}

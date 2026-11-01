import {
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  randomUUID,
  timingSafeEqual,
  X509Certificate,
} from 'node:crypto';
import { SRP, SrpClient, SrpServer } from 'fast-srp-hap';
import { z } from 'zod';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const lifetime = 10 * 60 * 1000;
const attemptLimit = 5;
const receiptLimit = 16;
const domain = 'ncf-pair/v3';
// Application PAKE: SRP-6a, RFC 5054 3072-bit group, SHA-256, HAP proofs.
const suite = 'srp6a-3072-sha256-hap';
const params = SRP.params[3072];
const modulus = params.N.toBuffer(384);
const username = Buffer.from(domain, 'ascii');
const hex = (bytes: number) => z.string().regex(new RegExp(`^[a-f0-9]{${bytes * 2}}$`));
const macSchema = hex(32);
const identitySchema = z
  .object({
    nodeId: z.uuid(),
    label: z.string().min(1).max(120),
    certificate: z.string().min(1).max(20000),
  })
  .strict();
export type PairIdentity = z.infer<typeof identitySchema>;
export type PairedIdentity = PairIdentity & { secret: string };
type Admit = (identity: PairedIdentity, beforeWrite: () => void) => Promise<void>;
const startSchema = z.object({ phase: z.literal('start'), identity: identitySchema }).strict();
const challengeSchema = z
  .object({
    version: z.literal(3),
    suite: z.literal(suite),
    sessionId: z.uuid(),
    salt: hex(32),
    publicKey: hex(384),
    identity: identitySchema,
  })
  .strict();
type Challenge = z.infer<typeof challengeSchema>;
const proveSchema = z
  .object({
    phase: z.literal('prove'),
    sessionId: z.uuid(),
    publicKey: hex(384),
    proof: macSchema,
    mac: macSchema,
  })
  .strict();
type Prove = z.infer<typeof proveSchema>;
const proofSchema = z.object({ proof: macSchema, mac: macSchema }).strict();
type Proof = z.infer<typeof proofSchema>;
const confirmSchema = z
  .object({ phase: z.literal('confirm'), sessionId: z.uuid(), mac: macSchema })
  .strict();
type Confirm = z.infer<typeof confirmSchema>;
const receiptSchema = z.object({ mac: macSchema }).strict();
type Receipt = z.infer<typeof receiptSchema>;

export class PairingError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
function invalid(): PairingError {
  return new PairingError('The access code or pairing verification is incorrect', 401);
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new PairingError('Invalid pairing request or response');
  return result.data;
}
export function normalizeAccessCode(value: string): string {
  // Validate ASCII before case conversion; Unicode case expansion is not a code.
  const trimmed = value.trim();
  if (!/^[A-HJ-NP-Za-hj-np-z2-9]{8}$/.test(trimmed))
    throw new PairingError('Enter the 8-letter or digit access code from the other computer');
  return trimmed.toUpperCase();
}
export function certificateDer(certificate: string): string {
  try {
    return new X509Certificate(certificate).raw.toString('base64');
  } catch {
    throw new PairingError('Invalid node certificate');
  }
}
function transcript(challenge: Challenge, identity: PairIdentity, publicKey: string): string {
  return JSON.stringify([
    domain,
    suite,
    challenge.sessionId,
    challenge.salt,
    publicKey,
    challenge.publicKey,
    identity.nodeId,
    identity.label,
    certificateDer(identity.certificate),
    challenge.identity.nodeId,
    challenge.identity.label,
    certificateDer(challenge.identity.certificate),
  ]);
}
function derive(key: Buffer, context: string, purpose: string): Buffer {
  return Buffer.from(
    hkdfSync(
      'sha256',
      key,
      createHash('sha256').update(context).digest(),
      `${domain}/${purpose}`,
      32,
    ),
  );
}
function mac(key: Buffer, context: string, role: string, proofs: string[]): string {
  return createHmac('sha256', derive(key, context, role))
    .update(JSON.stringify([domain, role, context, proofs]))
    .digest('hex');
}
function equal(actual: string, expected: string): boolean {
  return (
    actual.length === expected.length &&
    timingSafeEqual(Buffer.from(actual, 'ascii'), Buffer.from(expected, 'ascii'))
  );
}
function publicValue(value: string): Buffer {
  const bytes = Buffer.from(value, 'hex');
  if (bytes.every((byte) => byte === 0) || Buffer.compare(bytes, modulus) >= 0) throw invalid();
  return bytes;
}
function privateValue(): Buffer {
  let bytes: Buffer;
  do {
    bytes = randomBytes(32);
  } while (bytes[0] === 0);
  return bytes;
}
interface Session {
  challenge: Challenge;
  identity: PairIdentity;
  server: SrpServer;
  request?: string;
  proof?: Proof;
  context?: string;
  key?: Buffer;
  proofs?: string[];
  commit?: Promise<Receipt>;
}
interface Code {
  password: string;
  expires: number;
  attempts: number;
  sessions: Map<string, Session>;
  claimant?: string;
}
interface Committed {
  request: Confirm;
  receipt: Receipt;
  expires: number;
}

export class PairingHost {
  private active?: Code;
  private receipts = new Map<string, Committed>();
  private committing = new Map<string, { request: Confirm; promise: Promise<Receipt> }>();
  private generation = 0;
  constructor(private readonly identity: () => PairIdentity) {}
  createCode(): { code: string; expiresAt: string } {
    this.prune();
    const code = Array.from(randomBytes(8), (value) => alphabet[value & 31]).join('');
    this.active = {
      password: code,
      expires: Date.now() + lifetime,
      attempts: 0,
      sessions: new Map(),
    };
    return { code, expiresAt: new Date(this.active.expires).toISOString() };
  }
  reset(): void {
    this.generation++;
    this.active = undefined;
    this.receipts.clear();
    this.committing.clear();
  }
  private prune(): void {
    if (this.active && Date.now() >= this.active.expires) this.active = undefined;
    for (const [id, receipt] of this.receipts)
      if (Date.now() >= receipt.expires) this.receipts.delete(id);
  }
  private code(): Code {
    this.prune();
    if (!this.active)
      throw new PairingError(
        'The access code is expired or unavailable. Create a new code on the other computer.',
        401,
      );
    return this.active;
  }
  async handle(input: unknown, admit: Admit): Promise<unknown> {
    this.prune();
    const phase = input && typeof input === 'object' && 'phase' in input ? input.phase : undefined;
    if (phase === 'confirm') return this.confirm(input, admit);
    if (phase === 'prove') return this.prove(input);
    // Charge malformed starts too, before validation or expensive SRP work.
    const active = this.code();
    if (active.claimant)
      throw new PairingError('The access code has already been used. Create a new code.', 409);
    if (active.attempts >= attemptLimit)
      throw new PairingError(
        'Too many connection attempts. Create a new access code on the other computer.',
        429,
      );
    active.attempts++;
    const request = parse(startSchema, input);
    const own = parse(identitySchema, this.identity());
    if (request.identity.nodeId === own.nodeId)
      throw new PairingError('The access code belongs to this node');
    certificateDer(request.identity.certificate);
    const salt = randomBytes(32);
    const server = new SrpServer(
      params,
      { username, salt, password: Buffer.from(active.password, 'ascii') },
      privateValue(),
    );
    const challenge: Challenge = {
      version: 3,
      suite,
      sessionId: randomUUID(),
      salt: salt.toString('hex'),
      publicKey: server.computeB().toString('hex'),
      identity: own,
    };
    active.sessions.set(challenge.sessionId, { challenge, identity: request.identity, server });
    return challenge;
  }
  private session(input: unknown): { active: Code; session: Session } {
    const active = this.code();
    const id =
      input && typeof input === 'object' && 'sessionId' in input ? input.sessionId : undefined;
    const session = typeof id === 'string' ? active.sessions.get(id) : undefined;
    if (!session)
      throw new PairingError(
        'The pairing session expired or was replaced. Create a new access code.',
        409,
      );
    return { active, session };
  }
  private prove(input: unknown): Proof {
    const { active, session } = this.session(input);
    const id = session.challenge.sessionId;
    try {
      const request = parse(proveSchema, input);
      const encoded = JSON.stringify(request);
      if (session.request) {
        if (session.request !== encoded) throw invalid();
        return session.proof!;
      }
      session.server.setA(publicValue(request.publicKey));
      const key = session.server.computeK();
      const context = transcript(session.challenge, session.identity, request.publicKey);
      // Verify our constant-time MAC before the library's string-based proof check.
      if (!equal(request.mac, mac(key, context, 'client', [request.proof]))) throw invalid();
      session.server.checkM1(Buffer.from(request.proof, 'hex'));
      const proof = session.server.computeM2().toString('hex');
      session.key = key;
      session.context = context;
      session.proofs = [request.proof, proof];
      session.proof = { proof, mac: mac(key, context, 'server', session.proofs) };
      session.request = encoded;
      return session.proof;
    } catch (error) {
      // A started session permits one guess, even if its proof is malformed.
      if (!session.request) active.sessions.delete(id);
      if (error instanceof PairingError) throw error;
      throw invalid();
    }
  }
  private async confirm(input: unknown, admit: Admit): Promise<Receipt> {
    const request = parse(confirmSchema, input);
    const committed = this.receipts.get(request.sessionId);
    if (committed) {
      if (!equal(request.mac, committed.request.mac)) throw invalid();
      return committed.receipt;
    }
    const pending = this.committing.get(request.sessionId);
    if (pending) {
      if (!equal(request.mac, pending.request.mac)) throw invalid();
      return pending.promise;
    }
    const { active, session } = this.session(request);
    if (!session.key || !session.context || !session.proofs) throw invalid();
    const { key, context, proofs } = session;
    if (!equal(request.mac, mac(key, context, 'confirm', proofs))) throw invalid();
    if (active.claimant && active.claimant !== request.sessionId)
      throw new PairingError('The access code has already been used. Create a new code.', 409);
    if (session.commit) return session.commit;
    if (this.committing.size >= receiptLimit)
      throw new PairingError(
        'Too many connections are being saved. Retry after the current attempts finish.',
        429,
      );
    active.claimant = request.sessionId;
    const generation = this.generation;
    let writeBegun = false;
    const beforeWrite = () => {
      if (
        generation !== this.generation ||
        (!writeBegun && (this.active !== active || Date.now() >= active.expires))
      )
        throw new PairingError(
          'Pairing was canceled before saving. Create a new access code.',
          409,
        );
      writeBegun = true;
    };
    const receipt = { mac: mac(key, context, 'committed', proofs) };
    session.commit = (async () => {
      try {
        await admit(
          {
            ...session.identity,
            secret: derive(key, context, 'peer-secret').toString('hex'),
          },
          beforeWrite,
        );
      } catch (error) {
        active.claimant = undefined;
        session.commit = undefined;
        if (error instanceof PairingError) throw error;
        throw new PairingError(
          'The node could not save this connection. Retry with the same code or create a new code.',
          503,
        );
      }
      active.sessions.clear();
      active.password = '';
      if (generation !== this.generation)
        throw new PairingError(
          'Pairing confirmation is uncertain because the node stopped during saving. Create a new access code.',
          409,
        );
      this.prune();
      if (this.receipts.size >= receiptLimit)
        this.receipts.delete(this.receipts.keys().next().value!);
      this.receipts.set(request.sessionId, { request, receipt, expires: active.expires });
      return receipt;
    })();
    const entry = { request, promise: session.commit };
    this.committing.set(request.sessionId, entry);
    const release = () => {
      if (this.committing.get(request.sessionId) === entry)
        this.committing.delete(request.sessionId);
    };
    void session.commit.then(release, release);
    return session.commit;
  }
}

export class PairingClient {
  private readonly password: string;
  private challenge?: Challenge;
  private client?: SrpClient;
  private key?: Buffer;
  private context?: string;
  private proofs?: string[];
  constructor(
    code: string,
    private readonly identity: PairIdentity,
  ) {
    this.password = normalizeAccessCode(code);
    certificateDer(identity.certificate);
  }
  start(): z.infer<typeof startSchema> {
    return { phase: 'start', identity: this.identity };
  }
  prove(input: unknown, observedCertificate: string): Prove {
    const challenge = parse(challengeSchema, input);
    if (challenge.identity.nodeId === this.identity.nodeId)
      throw new PairingError('The access code belongs to this node');
    if (certificateDer(challenge.identity.certificate) !== certificateDer(observedCertificate))
      throw new PairingError('The remote node certificate changed during pairing');
    const publicKeyBytes = publicValue(challenge.publicKey);
    const client = new SrpClient(
      params,
      Buffer.from(challenge.salt, 'hex'),
      username,
      Buffer.from(this.password, 'ascii'),
      privateValue(),
      true,
    );
    try {
      client.setB(publicKeyBytes);
    } catch {
      throw invalid();
    }
    const publicKey = client.computeA().toString('hex');
    const proof = client.computeM1().toString('hex');
    this.challenge = challenge;
    this.client = client;
    this.key = client.computeK();
    this.context = transcript(challenge, this.identity, publicKey);
    this.proofs = [proof];
    return {
      phase: 'prove',
      sessionId: challenge.sessionId,
      publicKey,
      proof,
      mac: mac(this.key, this.context, 'client', [proof]),
    };
  }
  confirm(input: unknown): Confirm {
    const response = parse(proofSchema, input);
    if (!this.challenge || !this.client || !this.key || !this.context || !this.proofs)
      throw invalid();
    const proofs = [this.proofs[0], response.proof];
    if (!equal(response.mac, mac(this.key, this.context, 'server', proofs))) throw invalid();
    try {
      this.client.checkM2(Buffer.from(response.proof, 'hex'));
    } catch {
      throw invalid();
    }
    this.proofs = proofs;
    return {
      phase: 'confirm',
      sessionId: this.challenge.sessionId,
      mac: mac(this.key, this.context, 'confirm', proofs),
    };
  }
  finish(input: unknown): PairedIdentity {
    const receipt = parse(receiptSchema, input);
    if (!this.challenge || !this.key || !this.context || this.proofs?.length !== 2) throw invalid();
    if (!equal(receipt.mac, mac(this.key, this.context, 'committed', this.proofs))) throw invalid();
    return {
      ...this.challenge.identity,
      secret: derive(this.key, this.context, 'peer-secret').toString('hex'),
    };
  }
  certificate(): string {
    if (!this.challenge) throw invalid();
    return this.challenge.identity.certificate;
  }
  nodeId(): string {
    if (!this.challenge) throw invalid();
    return this.challenge.identity.nodeId;
  }
}

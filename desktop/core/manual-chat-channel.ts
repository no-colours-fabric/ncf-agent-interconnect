import { createHash, createPublicKey, randomUUID, verify } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import type { NodeService } from './service.js';
import { changedSender } from './chat-send.js';
import { nicknameKey, type Binding } from '../shared/contracts.js';
const fingerprint = (der: Buffer) => createHash('sha256').update(der).digest('hex');
const proofSchema = z
  .object({
    key: z.string().regex(/^[0-9a-f]{64}$/),
    chat: z.string().min(1).max(300),
    grantId: z.uuid(),
    nonce: z.uuid(),
    time: z.number().int().safe(),
    sig: z.string().regex(/^[A-Za-z0-9_-]{86}$/),
  })
  .strict();
type Grant = {
  revision: string;
  public_key: string;
  external_chat: string;
  binding: string;
  generation: number;
};

/** Called only by the owner's local provisioning command. No MCP method grants this authority. */
export function authorizeManualChat(
  db: DatabaseSync,
  nickname: string,
  expectedChat: string,
  externalChat: string,
  publicKeyPem: string,
) {
  z.string().min(1).max(300).parse(externalChat);
  const key = createPublicKey(publicKeyPem);
  if (key.asymmetricKeyType !== 'ed25519')
    throw new Error('An Ed25519 chat public key is required');
  const der = key.export({ format: 'der', type: 'spki' });
  const row = db.prepare('SELECT binding FROM agents WHERE name_key=?').get(nicknameKey(nickname));
  if (!row?.binding) throw new Error('The selected binding is unavailable');
  const binding = JSON.parse(String(row.binding)) as Binding;
  if (binding.chatId !== expectedChat) throw new Error('The selected chat changed');
  const grant = { fingerprint: fingerprint(der), grantId: randomUUID() };
  // A new owner or binding generation invalidates this grant on every send.
  db.prepare(
    'INSERT INTO manual_send_grants(key,revision,public_key,external_chat,binding,generation) VALUES (?,?,?,?,?,?)',
  ).run(
    grant.fingerprint,
    grant.grantId,
    der.toString('base64'),
    externalChat,
    binding.connectionId,
    binding.generation,
  );
  return grant;
}
export type ManualAuthority = { binding: Binding; current: () => void };
export class ManualChatChannels {
  private readonly used = new Map<string, number>();
  constructor(private readonly service: NodeService) {}
  authenticate(header: unknown, session: string | undefined, bytes: Buffer): ManualAuthority {
    if (typeof header !== 'string' || header.length > 2500 || !session) throw changedSender();
    const proof = proofSchema.parse(JSON.parse(Buffer.from(header, 'base64url').toString('utf8')));
    const now = Date.now();
    if (Math.abs(now - proof.time) > 30000) throw changedSender();
    const read = () =>
      this.service.store.db
        .prepare(
          'SELECT revision,public_key,external_chat,binding,generation FROM manual_send_grants WHERE key=?',
        )
        .get(proof.key) as Grant | undefined;
    const grant = read();
    if (!grant || grant.revision !== proof.grantId || grant.external_chat !== proof.chat)
      throw changedSender();
    const data = JSON.stringify([
      'ncf.manual.send.v1',
      this.service.settings.value.nodeId,
      session,
      proof.grantId,
      proof.chat,
      proof.nonce,
      proof.time,
      createHash('sha256').update(bytes).digest('hex'),
    ]);
    const der = Buffer.from(grant.public_key, 'base64');
    if (
      fingerprint(der) !== proof.key ||
      !verify(
        null,
        Buffer.from(data),
        createPublicKey({ key: der, type: 'spki', format: 'der' }),
        Buffer.from(proof.sig, 'base64url'),
      )
    )
      throw changedSender();
    for (const [id, expiry] of this.used) if (expiry < now) this.used.delete(id);
    const replay = proof.key + '/' + proof.nonce;
    if (this.used.has(replay) || this.used.size >= 8192) throw changedSender();
    this.used.set(replay, proof.time + 30000);
    const binding = this.service.store.assertOwner(grant.binding).binding;
    const current = () => {
      const row = read();
      const owner = this.service.store.bindingForChat(
        binding.client,
        binding.chatId,
        binding.adapterId,
      );
      if (
        !row ||
        row.revision !== grant.revision ||
        row.binding !== grant.binding ||
        row.generation !== grant.generation ||
        row.public_key !== grant.public_key ||
        row.external_chat !== proof.chat ||
        !owner ||
        owner.connectionId !== binding.connectionId ||
        owner.generation !== grant.generation ||
        !this.service.settings.value.adapters.some(
          (p) => p.kind === 'manual' && p.id === binding.adapterId,
        )
      )
        throw changedSender();
    };
    current();
    return { binding, current };
  }
}

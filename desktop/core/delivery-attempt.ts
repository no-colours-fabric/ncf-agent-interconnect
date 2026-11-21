import { createHash } from 'node:crypto';
import { z } from 'zod';

export const codexQueueWitness = 'codex-queue';

const text = z.string().min(1).max(200);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const deliveryPhase = z.enum([
  'reserved',
  'sealed',
  'issued',
  'host-accepted',
  'committed',
  'cancelled',
  'uncertain',
]);
export type DeliveryPhase = z.infer<typeof deliveryPhase>;
export const deliveryMetadata = z
  .object({
    version: z.literal(1),
    transport: z.enum(['native', 'mcp-response']),
    phase: deliveryPhase,
    owner: z
      .object({
        agentKey: text,
        incarnation: z.uuid(),
        connectionId: z.uuid(),
        generation: z.number().int().positive(),
        adapterId: z.uuid(),
        chatId: text,
      })
      .strict(),
    lifecycle: z.object({ service: z.uuid(), transport: z.uuid() }).strict(),
    invocation: z
      .object({
        session: z.uuid(),
        nonce: z.uuid(),
        requestId: z.union([z.string().max(256), z.number().finite()]),
      })
      .strict()
      .optional(),
    host: z.object({ messageId: text, runtime: text, session: text }).strict().optional(),
    payloadHash: hash.nullable(),
    membersHash: hash,
    created: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
  })
  .strict();
export type DeliveryMetadata = z.infer<typeof deliveryMetadata>;
export interface DeliveryAttempt {
  id: string;
  ids: string[];
  meta: DeliveryMetadata;
}
export const contentHash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
export const membersHash = (ids: readonly string[]): string =>
  contentHash(JSON.stringify([...ids].sort()));
export function encodeDelivery(meta: DeliveryMetadata): string {
  const value = JSON.stringify(deliveryMetadata.parse(meta));
  if (Buffer.byteLength(value) > 8192) throw new Error('Delivery metadata is too large');
  return value;
}
export function decodeDelivery(value: unknown): DeliveryMetadata {
  if (typeof value !== 'string' || Buffer.byteLength(value) > 8192)
    throw new Error('Invalid delivery metadata');
  return deliveryMetadata.parse(JSON.parse(value));
}
export function coarseDelivery(phase: DeliveryPhase): string {
  if (phase === 'committed') return 'admitted';
  if (phase === 'cancelled') return 'failed';
  if (phase === 'uncertain') return 'uncertain';
  return 'dispatching';
}
export const activeDelivery = (phase: DeliveryPhase): boolean =>
  !['committed', 'cancelled'].includes(phase);

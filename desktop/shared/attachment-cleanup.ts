import { z } from 'zod';

export const receivedAttachmentAges = [7, 30, 90, 365] as const;
export type ReceivedAttachmentAge = (typeof receivedAttachmentAges)[number];

const agentIdentity = { key: z.string().min(1), incarnation: z.uuid() };
const age = z.literal(receivedAttachmentAges);
export const removeReceivedAttachmentsSchema = z.discriminatedUnion('scope', [
  z.strictObject({ scope: z.literal('all'), olderThanDays: age }),
  z.strictObject({ scope: z.literal('agent'), ...agentIdentity, olderThanDays: age }),
]);

export type RemoveReceivedAttachments = z.infer<typeof removeReceivedAttachmentsSchema>;
export type ReceivedAttachmentScope =
  | { scope: 'all' }
  | {
      scope: 'agent';
      key: string;
      incarnation: string;
    };

export interface ReceivedAttachmentUsage {
  agents: { key: string; incarnation: string; nickname: string; bytes: number }[];
  totalBytes: number;
}

export interface ReceivedAttachmentCleanupResult {
  removed: number;
  preserved: number;
}

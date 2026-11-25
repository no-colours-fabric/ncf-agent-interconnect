import { z } from 'zod';

export const bytesPerMiB = 1024 * 1024;
export const legacyAttachmentLimitMiB = 100;
export const defaultAttachmentLimitMiB = 1024;
export const maxAttachmentLimitMiB = Math.floor(Number.MAX_SAFE_INTEGER / bytesPerMiB);
export const attachmentLimitSchema = z
  .number()
  .int()
  .positive()
  .max(maxAttachmentLimitMiB)
  .nullable();
export type AttachmentLimit = z.infer<typeof attachmentLimitSchema>;

export const exceedsAttachmentLimit = (bytes: number, limit: AttachmentLimit): boolean =>
  !Number.isSafeInteger(bytes) || bytes < 0 || (limit !== null && bytes > limit * bytesPerMiB);

export const localAttachmentLimitError = 'The file exceeds this computer’s attachment size limit';

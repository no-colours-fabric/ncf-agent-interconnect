import { createHash } from 'node:crypto';
/** Canonical public send arguments, including the schema default for files. */
export function sendInputHash(args: Record<string, unknown>): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        args.recipientNode,
        args.recipientNickname,
        args.replyRef,
        args.replyTo,
        args.text,
        args.files ?? [],
        args.id,
      ]),
    )
    .digest('hex');
}

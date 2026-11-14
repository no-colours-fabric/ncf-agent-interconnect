import { createHash } from 'node:crypto';

export const nativeClaudeSource = 'ncf-agent-interconnect';
export const nativeClaudeTransport = 'native-prompt-v1';
// Native UserMessage rendering clips at 100,000 characters. Keep the full
// canonical body and footer below that ceiling instead of silently truncating.
export const nativeClaudeBodyLimit = 90000;
export const nativeClaudeTrigger = 'NCF native incoming admission: ';
export const nativeClaudeHash = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

/** Expected default idle attribution; a different host representation fails closed. */
export function nativeClaudeFrame(body: string): string {
  return (
    `The ${nativeClaudeSource} plugin sent a message:\n` +
    body +
    "\n\nThis is how Claude Code surfaces a prompt a plugin submits between turns — it starts this turn in the user's place. Address the message above."
  );
}

export function nativeClaudeRowHash(body: string, context?: string, framed = true): string {
  const content = [{ type: 'text', text: framed ? nativeClaudeFrame(body) : body }];
  if (context !== undefined) content.push({ type: 'text', text: context });
  return nativeClaudeHash(JSON.stringify({ type: 'user', role: 'user', isMeta: false, content }));
}

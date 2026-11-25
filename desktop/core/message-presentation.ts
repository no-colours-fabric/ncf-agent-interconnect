export interface MessageDisplayContext {
  locale: string;
  timeZone: string;
}

export interface MessagePresentationFile {
  name: string;
  localPath: string;
}

export interface AgentMessagePresentationInput extends MessageDisplayContext {
  fromNickname: string;
  sentAt: string;
  deliveredAt: number;
  text: string;
  files: readonly MessagePresentationFile[];
  replyRef: string;
}

export interface ValidatedMessageDisplayContext {
  locale: string;
  timeZone: string;
}

const replyReference = /^r[1-9a-z][0-9a-z]{0,10}$/;

function boundedText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string' || !value.length || value.length > maximum)
    throw new Error(`Invalid ${field}`);
  return value;
}

export function validateMessageDisplayContext(
  input: MessageDisplayContext,
): ValidatedMessageDisplayContext {
  const locale = boundedText(input.locale, 'message display locale', 100);
  let canonicalLocale: string;
  try {
    const canonical = Intl.getCanonicalLocales(locale);
    if (canonical.length !== 1 || Intl.DateTimeFormat.supportedLocalesOf(canonical).length !== 1)
      throw new Error();
    canonicalLocale = canonical[0]!;
  } catch {
    throw new Error('Invalid message display locale');
  }
  const timeZone = boundedText(input.timeZone, 'message display time zone', 200);
  try {
    const canonicalTimeZone = new Intl.DateTimeFormat(canonicalLocale, {
      timeZone,
    }).resolvedOptions().timeZone;
    if (!canonicalTimeZone) throw new Error();
    return { locale: canonicalLocale, timeZone: canonicalTimeZone };
  } catch {
    throw new Error('Invalid message display time zone');
  }
}

export function defaultMessageDisplayContext(systemLocale?: string): MessageDisplayContext {
  const { locale, timeZone } = new Intl.DateTimeFormat().resolvedOptions();
  if (systemLocale) {
    try {
      return validateMessageDisplayContext({ locale: systemLocale.replaceAll('_', '-'), timeZone });
    } catch {
      // An unavailable system locale falls back to the runtime locale.
    }
  }
  return { locale, timeZone };
}

export function formatAgentMessageTimestamp(
  value: string | number,
  display: MessageDisplayContext,
): string {
  const context = validateMessageDisplayContext(display);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid message timestamp');
  return date.toLocaleString(context.locale, { timeZone: context.timeZone });
}

const markdownName = (value: string): string => value.replace(/[\\`*_{}\[\]<>#!|]/g, '\\$&');

export function formatAgentMessagePresentation(input: AgentMessagePresentationInput): string {
  const fromNickname = boundedText(input.fromNickname, 'agent nickname', 120);
  if (fromNickname !== fromNickname.trim() || /[\x00-\x1f\x7f]/.test(fromNickname))
    throw new Error('Invalid agent nickname');
  if (typeof input.text !== 'string' || !input.text.length || input.text.length > 65536)
    throw new Error('Invalid message text');
  if (!Number.isSafeInteger(input.deliveredAt) || input.deliveredAt < 0)
    throw new Error('Invalid message timestamp');
  if (!replyReference.test(input.replyRef)) throw new Error('Invalid reply reference');
  if (!Array.isArray(input.files) || input.files.length > 16)
    throw new Error('Invalid message attachments');

  const display = validateMessageDisplayContext(input);
  const sent = formatAgentMessageTimestamp(input.sentAt, display);
  const delivered = formatAgentMessageTimestamp(input.deliveredAt, display);
  const attachments = input.files.length
    ? '\n\nAttachments:\n' +
      input.files
        .map((file) => {
          const name = boundedText(file.name, 'attachment name', 255);
          if (/[\\/\x00-\x1f]/.test(name)) throw new Error('Invalid attachment name');
          const path = boundedText(file.localPath, 'attachment path', 16384)
            .replaceAll('\\', '/')
            .replace(/[<>\r\n]/g, (character) => encodeURIComponent(character));
          return `- [${markdownName(name)}](<${path}>)`;
        })
        .join('\n')
    : '';
  const sender = markdownName(JSON.stringify(fromNickname));
  return `**Incoming NCF Agent Interconnect**\nFrom: ${sender}\nSent: ${sent}\nDelivered: ${delivered}\n\n${input.text}${attachments}\n\nReply-To ${sender}: ${input.replyRef}\nUse agent_send(connectionId, replyRef="${input.replyRef}", text) to reply.`;
}

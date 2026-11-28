import { randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { NodeService } from './service.js';
import type { Binding } from '../shared/contracts.js';
import { changedSender, sendFromChat, type Outgoing } from './chat-send.js';
import { sendInputHash } from '../integrations/send-hash.js';
import { agentToolFailure, SendChatRequired } from './mcp-agent-guidance.js';

type Outcome = Record<string, unknown>;
interface Attempt {
  thread: string;
  binding?: Binding;
  epoch: string;
  hash: string;
  args: Outgoing;
  size: number;
  notice?: Promise<Outcome>;
  code?: string;
  id: string;
  expires: number;
  completion?: Promise<Outcome>;
}
const hookEvent = z
  .object({
    thread: z.uuid(),
    receipt: z.uuid(),
    input: z.record(z.string(), z.unknown()),
    toolUseId: z.string().min(1).max(256),
  })
  .strict();

/** The MCP caller receives one half. Only the installed runtime hook sees the
 * same response together with the native session and actual tool arguments. */
export class CodexSends {
  private readonly attempts = new Map<string, Attempt>();
  constructor(private readonly service: NodeService) {}
  clear() {
    this.attempts.clear();
  }
  begin(thread: string, args: Outgoing) {
    const now = Date.now();
    for (const [key, item] of this.attempts)
      if (item.expires <= now && !item.completion) this.attempts.delete(key);
    const size = Buffer.byteLength(JSON.stringify(args));
    if (
      this.attempts.size >= 512 ||
      [...this.attempts.values()].reduce((sum, item) => sum + item.size, size) > 8 * 1024 * 1024
    )
      throw new SendChatRequired(
        'send_chat_unverified',
        'Too many outstanding confirmations. Wait for the current operation to finish.',
      );
    const receipt = randomUUID(),
      id = args.id ?? randomUUID();
    const binding = this.service.store.bindingForChat('Codex', thread);
    this.attempts.set(receipt, {
      thread,
      binding,
      epoch: this.service.deliveryIncarnation,
      hash: sendInputHash(args),
      args: structuredClone(args),
      size,
      id,
      expires: now + 300000,
    });
    setTimeout(() => this.attempts.delete(receipt), 300000).unref();
    return {
      status: 'awaiting_chat_confirmation',
      id,
      receipt,
      description:
        'Use the result supplied by the ChatGPT send hook. If it is absent, make the next call once to finish this same send.',
      nextCall: { name: 'agent_connect', arguments: { sendReceipt: receipt } },
    };
  }
  async resume(thread: string | undefined, receipt: string, token?: string): Promise<Outcome> {
    const attempt = this.attempts.get(receipt);
    if (
      !attempt ||
      attempt.thread !== thread ||
      attempt.expires <= Date.now() ||
      attempt.epoch !== this.service.deliveryIncarnation
    )
      throw changedSender();
    const profile = this.service.settings.value.adapters.find(
      (p) =>
        p.kind === 'codex-desktop' && p.threadId === thread && p.id === attempt.binding?.adapterId,
    );
    if (!profile || !attempt.binding)
      throw new SendChatRequired(
        'send_chat_unbound',
        'Connect this chat with agent_connect using its owner-chosen nickname.',
      );
    const valid = () => {
      const current = this.service.store.bindingForChat('Codex', attempt.thread, profile.id);
      return (
        this.service.integrationsReady &&
        attempt.epoch === this.service.deliveryIncarnation &&
        current?.connectionId === attempt.binding?.connectionId &&
        current?.generation === attempt.binding?.generation &&
        this.service.settings.value.adapters.includes(profile) &&
        attempt.expires > Date.now()
      );
    };
    if (!valid()) throw changedSender();
    if (attempt.completion) return attempt.completion;
    if (token) {
      if (!attempt.code || !timingSafeEqual(Buffer.from(token), Buffer.from(attempt.code)))
        throw changedSender();
      return this.finish({
        thread,
        receipt,
        input: attempt.args,
        toolUseId: 'native-confirmation',
      });
    }
    if (attempt.notice) return attempt.notice;
    if (
      [...this.attempts.values()].some(
        (other) =>
          other !== attempt &&
          other.thread === thread &&
          other.notice &&
          !other.completion &&
          other.expires > Date.now(),
      )
    )
      throw new SendChatRequired(
        'send_chat_unverified',
        'Finish the pending send confirmation for this chat first.',
      );
    const code = randomUUID();
    attempt.code = code;
    attempt.notice = (async () => {
      try {
        const offer = await this.service.offerSendProof(profile, code, valid);
        if (attempt.completion) return attempt.completion;
        if (offer.state === 'failed' || offer.state === 'blocked') {
          delete attempt.code;
          return {
            status: 'send_confirmation_unavailable',
            description: 'Enable the NCF send hook in this ChatGPT profile to send from this chat.',
          };
        }
        return {
          status: 'awaiting_native_confirmation',
          id: attempt.id,
          description:
            'Wait for the NCF send confirmation in this chat. Use the code from that notice with this original receipt.',
          expiresAt: new Date(attempt.expires).toISOString(),
        };
      } catch {
        return {
          status: 'send_confirmation_unavailable',
          description: 'Open NCF setup for this ChatGPT profile and apply the send hook.',
        };
      }
    })();
    return attempt.notice;
  }
  async finish(raw: unknown): Promise<Outcome> {
    const event = hookEvent.parse(raw);
    const item = this.attempts.get(event.receipt);
    if (
      !item ||
      item.thread !== event.thread ||
      item.hash !== sendInputHash(event.input) ||
      item.expires <= Date.now()
    )
      throw changedSender();
    const current = () => {
      if (
        !this.service.integrationsReady ||
        item.epoch !== this.service.deliveryIncarnation ||
        item.expires <= Date.now()
      )
        throw changedSender();
      const owner = this.service.store.bindingForChat('Codex', item.thread);
      if (
        owner?.connectionId !== item.binding?.connectionId ||
        owner?.generation !== item.binding?.generation ||
        owner?.adapterId !== item.binding?.adapterId
      )
        throw changedSender();
    };
    current();
    if (item.completion) return item.completion;
    const perform = async () => {
      try {
        const profile = this.service.settings.value.adapters.find(
          (p) =>
            p.kind === 'codex-desktop' &&
            p.threadId === item.thread &&
            p.id === item.binding?.adapterId,
        );
        const binding = this.service.chatSender('Codex', item.thread, profile);
        return {
          ...(await sendFromChat(this.service, binding, { ...item.args, id: item.id }, () => {
            current();
            if (!profile || !this.service.settings.value.adapters.includes(profile))
              throw changedSender();
          })),
        };
      } catch (error) {
        return agentToolFailure('agent_send', error, { id: item.id }, true);
      }
    };
    item.completion = perform();
    return item.completion;
  }
}

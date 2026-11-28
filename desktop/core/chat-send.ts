import { randomUUID } from 'node:crypto';
import type { Binding } from '../shared/contracts.js';
import type { NodeService } from './service.js';
import {
  agentToolFailure,
  SendChatRequired,
  SendNotStored,
  UnverifiedSend,
} from './mcp-agent-guidance.js';

export type Outgoing = {
  id?: string;
  text: string;
  files?: string[];
  replyRef?: string;
  recipientNode?: string;
  recipientNickname?: string;
  replyTo?: string | null;
};
export const changedSender = () =>
  new SendChatRequired(
    'send_chat_changed',
    'The original sending chat could not be verified. To recover its binding, call agent_connect in that chat with its last confirmed nickname and recoverOnly=true.',
  );
export async function sendFromChat(
  service: NodeService,
  binding: Binding,
  args: Outgoing,
  verify: () => void,
) {
  const epoch = service.deliveryIncarnation;
  const current = () => {
    if (!service.integrationsReady || service.deliveryIncarnation !== epoch) throw changedSender();
    verify();
    const actual = service.store.bindingForChat(binding.client, binding.chatId, binding.adapterId);
    if (
      !actual ||
      actual.connectionId !== binding.connectionId ||
      actual.generation !== binding.generation
    )
      throw changedSender();
  };
  current();
  const address = service.resolveReplyAddress(binding.connectionId, args);
  const id = args.id ?? randomUUID();
  let writeAttempted = false;
  try {
    return await service.send(
      { ...args, ...address, id, connectionId: binding.connectionId },
      current,
      () => {
        writeAttempted = true;
      },
    );
  } catch (error) {
    if (
      error instanceof SendChatRequired ||
      agentToolFailure('agent_send', error, args, true).status !== 'send_outcome_unverified'
    )
      throw error;
    current();
    if (!writeAttempted) throw new SendNotStored(id);
    throw new UnverifiedSend(id, binding.connectionId);
  }
}

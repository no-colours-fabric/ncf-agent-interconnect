import { generateKeyPairSync } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { authorizeManualChat } from '../../build/core/manual-chat-channel.js';
import { dedicatedChatFetch } from '../../build/integrations/manual-chat.js';
export function fixtureChat(directory, nodeId) {
  let source;
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    fetch: dedicatedChatFetch({ nodeId, current: () => source }),
    bind(owner) {
      const chat = owner.binding.chatId;
      const db = new DatabaseSync(path.join(directory, 'agents.sqlite'));
      try {
        const { grantId } = authorizeManualChat(
          db,
          owner.nickname,
          chat,
          chat,
          publicKey.export({ type: 'spki', format: 'pem' }),
        );
        source = { chat, grantId, privateKey };
      } finally {
        db.close();
      }
    },
  };
}

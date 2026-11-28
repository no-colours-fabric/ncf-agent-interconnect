import { generateKeyPairSync } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { TestContext } from 'node:test';
import type { NodeService } from '../../desktop/core/service.js';
import { authorizeManualChat } from '../../desktop/core/manual-chat-channel.js';
import { dedicatedChatFetch } from '../../desktop/integrations/manual-chat.js';
import type { Binding } from '../../desktop/shared/contracts.js';
export async function dedicatedClient(
  t: TestContext,
  service: NodeService,
  owner: { nickname: string; binding: Binding },
) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const chat = owner.binding.chatId;
  const { grantId } = authorizeManualChat(
    service.store.db,
    owner.nickname,
    chat,
    chat,
    publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  );
  const c = new Client({ name: owner.binding.client, version: '1' });
  await c.connect(
    new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
      requestInit: { headers: { authorization: 'Bearer ' + service.settings.value.localToken } },
      fetch: dedicatedChatFetch({
        nodeId: service.settings.value.nodeId,
        current: () => ({ chat, grantId, privateKey }),
      }),
    }),
  );
  t.after(() => c.close());
  return c;
}

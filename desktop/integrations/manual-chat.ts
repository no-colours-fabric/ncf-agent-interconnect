import { createHash, createPublicKey, randomUUID, sign, type KeyObject } from 'node:crypto';

export interface DedicatedChat {
  nodeId: string;
  /** The host supplies the current native chat and its exclusive signing key for this invocation. */
  current: () => { chat: string; grantId: string; privateKey: KeyObject } | undefined;
}
export function dedicatedChatFetch(authority: DedicatedChat): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const session = request.headers.get('mcp-session-id');
    if (request.method !== 'POST' || !session) return fetch(request);
    const source = authority.current();
    const bytes = Buffer.from(await request.clone().arrayBuffer());
    const call = JSON.parse(bytes.toString('utf8'));
    if (call?.method === 'tools/call' && call.params?.name === 'agent_send') {
      if (!source) throw new Error('The host has no dedicated chat signing key for this request.');
      const { chat, grantId, privateKey } = source;
      const key = createHash('sha256')
        .update(createPublicKey(privateKey).export({ type: 'spki', format: 'der' }))
        .digest('hex');
      const nonce = randomUUID(),
        time = Date.now();
      const data = JSON.stringify([
        'ncf.manual.send.v1',
        authority.nodeId,
        session,
        grantId,
        chat,
        nonce,
        time,
        createHash('sha256').update(bytes).digest('hex'),
      ]);
      const sig = sign(null, Buffer.from(data), privateKey).toString('base64url');
      request.headers.set(
        'x-ncf-chat-proof',
        Buffer.from(JSON.stringify({ key, grantId, chat, nonce, time, sig })).toString('base64url'),
      );
    }
    return fetch(request);
  };
}

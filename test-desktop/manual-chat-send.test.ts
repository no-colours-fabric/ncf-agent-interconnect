import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { NodeService } from '../desktop/core/service.js';
import { authorizeManualChat } from '../desktop/core/manual-chat-channel.js';
import { dedicatedChatFetch } from '../desktop/integrations/manual-chat.js';
test('fresh SDK session after node restart signs only the authorized chat and cannot write after revocation', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-manual-send-'));
  let service = new NodeService(directory);
  const clients: Client[] = [];
  t.after(async () => {
    await Promise.allSettled(clients.map((c) => c.close()));
    await service.close();
    await rm(directory, { force: true, recursive: true });
  });
  await service.settings.load();
  service.settings.value.mcpPort = 0;
  service.settings.value.peerPort = 0;
  await service.settings.save();
  await service.open();
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  let nativeChat = 'chat-X';
  let grantId: string;
  const signed = dedicatedChatFetch({
    nodeId: service.settings.value.nodeId,
    current: () => ({ chat: nativeChat, grantId, privateKey }),
  });
  const open = async (sign = false) => {
    const c = new Client({ name: 'SDK host', version: '1' });
    clients.push(c);
    await c.connect(
      new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
        requestInit: { headers: { authorization: 'Bearer ' + service.settings.value.localToken } },
        ...(sign && { fetch: signed }),
      }),
    );
    return c;
  };
  const first = await open();
  const binding = service.connect({ nickname: 'X', client: 'SDK host' });
  if (binding.status !== 'connected') throw Error('fixture');
  const args = {
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Y',
    text: '一次 / Ω',
    id: randomUUID(),
  };
  const unsupported = await first.callTool({ name: 'agent_send', arguments: args });
  assert.equal(
    (unsupported.structuredContent as { status: string }).status,
    'send_chat_unverified',
  );
  assert.ok(
    (
      await first.callTool({
        name: 'agent_send',
        arguments: { ...args, connectionId: binding.binding.connectionId },
      })
    ).isError,
  );
  assert.doesNotMatch(JSON.stringify(unsupported), new RegExp(binding.binding.connectionId));
  const grant = authorizeManualChat(
    service.store.db,
    binding.nickname,
    binding.binding.chatId,
    nativeChat,
    publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  );
  grantId = grant.grantId;
  await first.close();
  await service.close();
  service = new NodeService(directory);
  await service.open();
  const fresh = await open(true);
  const send = (arguments_: Record<string, unknown>) =>
    fresh.callTool({ name: 'agent_send', arguments: arguments_ });
  nativeChat = 'chat-Y';
  assert.ok((await send(args)).isError);
  assert.equal(service.store.get(args.id, 'out'), undefined);
  nativeChat = 'chat-X';
  const sent = await send(args);
  assert.ok(!sent.isError, JSON.stringify(sent));
  assert.ok(!(await send(args)).isError);
  assert.equal(service.store.history(service.store.keyForNickname('X')!).messages.length, 1);
  const next = { ...args, id: randomUUID() };
  let entered!: () => void;
  const authorized = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const original = service.send.bind(service);
  service.send = (...params) => {
    entered();
    return original(...params);
  };
  let pending: ReturnType<typeof send> | undefined;
  await service.files.exclusive(async () => {
    pending = send(next);
    await authorized;
    service.store.db.prepare('DELETE FROM manual_send_grants WHERE key=?').run(grant.fingerprint);
  });
  assert.equal(
    ((await pending!).structuredContent as { status: string }).status,
    'send_chat_changed',
  );
  assert.ok((await send(next)).isError);
  assert.equal(service.store.get(next.id, 'out'), undefined);

  const replacementGrant = authorizeManualChat(
    service.store.db,
    'x',
    binding.binding.chatId,
    nativeChat,
    publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  );
  assert.ok((await send(next)).isError);
  assert.equal(service.store.get(next.id, 'out'), undefined);
  grantId = replacementGrant.grantId;
  const offer = service.connect({ nickname: 'X', client: 'Replacement fixture' });
  if (offer.status !== 'nickname_in_use') throw new Error('Expected transfer offer');
  const moved = service.connect({
    ...offer.requestingChat,
    nickname: 'X',
    connectionId: offer.connectionId,
    transferId: offer.choices.find((choice) => choice.mode === 'transfer')!.transferId,
    confirmTransfer: true,
  });
  assert.equal(moved.status, 'connected');
  assert.ok((await send(next)).isError);
  assert.equal(service.store.get(next.id, 'out'), undefined);
  assert.equal(service.store.history(service.store.keyForNickname('X')!).messages.length, 1);
});

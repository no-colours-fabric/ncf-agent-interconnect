import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { NodeService } from '../desktop/core/service.js';
import type { Attachment, ChatHistoryPage } from '../desktop/shared/contracts.js';
import { mcpRead } from './fixtures/mcp-read.js';
import { pairingNode } from './pairing-node-fixture.js';
import { until } from './aionui-fixture.js';

function connected(service: NodeService, nickname: string) {
  const agent = service.connect({ nickname, client: 'MCP' });
  if (agent.status !== 'connected') throw new Error('Fixture owner unavailable');
  return agent.binding.connectionId;
}

type History = {
  messages: {
    envelope: { id: string; text: string };
    files: (Attachment & { localPath?: string; status?: string })[];
  }[];
};

test('Explicit cleanup removes only transferred temporary sources and verified managed copies across peers', async (t) => {
  const sender = await pairingNode(t);
  const receiver = await pairingNode(t);
  await sender.network.join(receiver.snapshot().peerUrl, receiver.network.accessCode().code);
  const sourceId = connected(sender, 'Source');
  const receiverId = connected(receiver, 'Recipient');
  const mcp = new Client({ name: 'Attachment fixture', version: '1' });
  t.after(() => mcp.close());
  await mcp.connect(
    new StreamableHTTPClientTransport(new URL(sender.snapshot().mcpUrl), {
      requestInit: { headers: { authorization: 'Bearer ' + sender.settings.value.localToken } },
    }),
  );
  const temporary = async (name: string, bytes: string) => {
    const result = await mcp.callTool({
      name: 'attachment_stage',
      arguments: { connectionId: sourceId, name },
    });
    assert.equal(result.isError ?? false, false, JSON.stringify(result.content));
    const localPath = (result.structuredContent as { localPath?: unknown } | undefined)?.localPath;
    assert.equal(typeof localPath, 'string');
    await writeFile(localPath as string, bytes);
    return localPath as string;
  };
  const exact = await temporary('временный 漢字.txt', 'shared digest');
  const edited = await temporary('edited.txt', 'edit me after delivery');
  const waiting = await temporary('waiting.txt', 'still queued for the agent');
  const normal = path.join(sender.settings.value.exportRoots[0], 'ordinary.txt');
  await writeFile(normal, 'shared digest');
  const send = (nickname: string, text: string, files: string[]) =>
    sender.send({
      connectionId: sourceId,
      recipientNode: receiver.settings.value.nodeId,
      recipientNickname: nickname,
      text,
      files,
    });
  const one = await send('Recipient', 'Temporary message', [exact, edited]);
  const two = await send('Recipient', 'Ordinary file with the same digest', [normal]);
  const queued = await send('Offline mailbox', 'Pending delivery', [waiting]);
  await until(() =>
    [one, two, queued].every(({ id }) => sender.store.get(id, 'out')?.state === 'ready'),
  );
  const clean = (node: NodeService, kind: 'sources' | 'received') =>
    node.userCall('cleanTemporaryAttachments', { kind });
  assert.deepEqual(await clean(sender, 'sources'), { removed: 0, preserved: 0 });
  assert.deepEqual(await clean(receiver, 'received'), { removed: 0, preserved: 0 });
  assert.equal(await readFile(exact, 'utf8'), 'shared digest');
  assert.equal(await readFile(waiting, 'utf8'), 'still queued for the agent');

  const roundTrip = (await mcpRead(receiver, receiverId)) as History;
  const original = roundTrip.messages.find(({ envelope }) => envelope.id === one.id)!;
  const ordinary = roundTrip.messages.find(({ envelope }) => envelope.id === two.id)!;
  const [managedCopy, editedCopy] = original.files;
  assert.equal(await readFile(managedCopy.localPath!, 'utf8'), 'shared digest');
  assert.equal(await readFile(ordinary.files[0].localPath!, 'utf8'), 'shared digest');
  await until(() => sender.store.get(one.id, 'out')?.state === 'processed');
  await writeFile(edited, 'source working edits');
  await writeFile(editedCopy.localPath!, 'recipient working edits');
  assert.deepEqual(await clean(sender, 'sources'), { removed: 1, preserved: 1 });
  assert.deepEqual(await clean(receiver, 'received'), { removed: 1, preserved: 1 });
  await assert.rejects(readFile(exact), { code: 'ENOENT' });
  await assert.rejects(readFile(managedCopy.localPath!), { code: 'ENOENT' });
  assert.equal(await readFile(edited, 'utf8'), 'source working edits');
  assert.equal(await readFile(editedCopy.localPath!, 'utf8'), 'recipient working edits');
  assert.equal(await readFile(waiting, 'utf8'), 'still queued for the agent');
  assert.equal(await readFile(normal, 'utf8'), 'shared digest');

  const after = (await mcpRead(receiver, receiverId)) as History;
  const first = after.messages.find(({ envelope }) => envelope.id === one.id)!;
  const other = after.messages.find(({ envelope }) => envelope.id === two.id)!;
  assert.equal(first.envelope.text, 'Temporary message');
  assert.deepEqual(first.files[0], {
    id: managedCopy.id,
    size: managedCopy.size,
    name: 'временный 漢字.txt',
    status: 'unavailable',
  });
  assert.equal(await readFile(other.files[0].localPath!, 'utf8'), 'shared digest');
  await assert.rejects(receiver.receiveFile(receiverId, one.id, managedCopy.id), /unavailable/);
  const ui = (await receiver.userCall('chatHistory', { nickname: 'Recipient' })) as ChatHistoryPage;
  assert.deepEqual(
    ui.messages.find(({ envelope }) => envelope.id === one.id)?.unavailableAttachments,
    [managedCopy.id],
  );
  assert.equal(
    ui.messages.find(({ envelope }) => envelope.id === two.id)?.unavailableAttachments,
    undefined,
  );
});

test('Local temporary attachment cleanup follows the same mailbox after a rename', async (t) => {
  const service = await pairingNode(t);
  const sender = connected(service, 'Source');
  const recipient = connected(service, 'Recipient');
  const { localPath } = await service.stageAttachment(sender, 'temporary.txt');
  await writeFile(localPath, 'Local temporary contents');
  const { id } = await service.send({
    connectionId: sender,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Recipient',
    text: 'Local attachment',
    files: [localPath],
  });
  const owner = service.store.list().find(({ nickname }) => nickname === 'Recipient')!;
  assert.deepEqual(
    await service.userCall('renameAgent', {
      key: owner.key,
      incarnation: owner.incarnation,
      currentNickname: owner.nickname,
      nickname: 'Renamed recipient',
    }),
    { status: 'renamed' },
  );
  const before = (await mcpRead(service, recipient)) as History;
  const file = before.messages.find(({ envelope }) => envelope.id === id)!.files[0];
  assert.equal(await readFile(file.localPath!, 'utf8'), 'Local temporary contents');
  await until(() => service.store.get(id, 'out')?.state === 'processed');
  for (const kind of ['sources', 'received'] as const)
    assert.deepEqual(await service.userCall('cleanTemporaryAttachments', { kind }), {
      removed: 1,
      preserved: 0,
    });
  await assert.rejects(readFile(localPath), { code: 'ENOENT' });
  await assert.rejects(readFile(file.localPath!), { code: 'ENOENT' });
  const ui = (await service.userCall('chatHistory', {
    nickname: 'Renamed recipient',
  })) as ChatHistoryPage;
  const row = ui.messages.find(({ envelope }) => envelope.id === id);
  assert.equal(row?.envelope.text, 'Local attachment');
  assert.deepEqual(row?.unavailableAttachments, [file.id]);
});

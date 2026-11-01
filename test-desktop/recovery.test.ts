import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NodeService } from '../desktop/core/service.js';
import { FileStore } from '../desktop/core/files.js';

async function until(check: () => boolean): Promise<void> {
  const end = Date.now() + 7000;
  while (!check()) {
    if (Date.now() > end) throw new Error('Recovery timed out');
    await new Promise((r) => setTimeout(r, 15));
  }
}
test('queued file snapshot and binding survive a complete sender restart while recipient is offline', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'interconnect recovery '));
  let a = new NodeService(path.join(root, 'a')),
    b = new NodeService(path.join(root, 'b'));
  t.after(async () => {
    await a.close();
    await b.close();
    await rm(root, { recursive: true, force: true });
  });
  await a.open();
  await b.open();
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  await until(() => a.snapshot().peers[0]?.connected === true);
  const owner = a.connect({ nickname: 'Отправитель', client: 'A' }),
    receiver = b.connect({ nickname: 'Получатель', client: 'B' });
  if (owner.status !== 'connected' || receiver.status !== 'connected') throw new Error();
  await b.stop();
  await until(() => !a.snapshot().peers[0].connected);
  const file = path.join(a.settings.value.exportRoots[0], 'снимок.txt');
  await writeFile(file, 'Исходный снимок');
  const sent = await a.send({
    connectionId: owner.binding.connectionId,
    recipientNode: b.settings.value.nodeId,
    recipientNickname: 'Получатель',
    text: 'Офлайн-доставка',
    files: [file],
  });
  assert.equal(sent.accepted, true);
  assert.equal(sent.delivery, 'queued');
  assert.equal(sent.recipientNode, b.settings.value.nodeId);
  assert.ok(!a.store.list().some((agent) => agent.nickname === 'Получатель'));
  assert.equal(a.store.get(sent.id, 'out')?.state, 'queued');
  await writeFile(file, 'Исходник уже изменён');
  const directory = a.directory;
  await a.close();
  a = new NodeService(directory);
  await a.open();
  await b.start();
  await until(() => b.store.get(sent.id)?.state === 'ready');
  const stored = b.store.get(sent.id)!;
  assert.equal(stored.envelope.toNode, b.settings.value.nodeId);
  assert.equal(stored.envelope.fromNode, a.settings.value.nodeId);
  const copy = (await b.receiveFile(
    receiver.binding.connectionId,
    sent.id,
    stored.envelope.attachments[0].id,
  )) as { localPath: string };
  assert.equal(await readFile(copy.localPath, 'utf8'), 'Исходный снимок');
  assert.equal(a.store.assertOwner(owner.binding.connectionId).nickname, 'Отправитель');
});

test('rapid start/stop requests are serialized and the same saved MCP address remains usable', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect lifecycle ')),
    service = new NodeService(directory);
  await service.open();
  t.after(async () => {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  const address = service.snapshot().mcpUrl;
  await Promise.all([service.stop(), service.start(), service.stop(), service.start()]);
  assert.equal(service.running, true);
  assert.equal(service.snapshot().mcpUrl, address);
  assert.equal((await fetch(address)).status, 401);
});

test('an offline extra export root does not disable valid roots', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'interconnect roots '));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const files = new FileStore(directory, [directory, path.join(directory, 'removed-drive')]);
  await files.init();
  const file = path.join(directory, 'allowed.txt');
  await writeFile(file, 'valid');
  assert.equal((await files.snapshot(file)).name, 'allowed.txt');
});

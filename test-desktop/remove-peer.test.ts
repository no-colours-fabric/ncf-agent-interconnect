import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { pairingNode } from './pairing-node-fixture.js';
import { SettingsFile } from '../desktop/core/settings.js';
import type { NodeService } from '../desktop/core/service.js';

async function connected(service: NodeService, id: string): Promise<void> {
  for (let index = 0; index < 150; index++) {
    if (service.snapshot().peers.some((peer) => peer.id === id && peer.connected)) return;
    await delay(20);
  }
  assert.fail('The expected loopback peer did not connect');
}

test('removing the confirmed connected node preserves other links, agents and history', async (t) => {
  const [local, selected, other] = await Promise.all([
    pairingNode(t),
    pairingNode(t),
    pairingNode(t),
  ]);
  const selectedId = selected.snapshot().nodeId;
  const otherId = other.snapshot().nodeId;
  await local.network.join(selected.snapshot().peerUrl, selected.network.accessCode().code);
  await local.network.join(other.snapshot().peerUrl, other.network.accessCode().code);
  await Promise.all([connected(local, selectedId), connected(local, otherId)]);
  await local.userCall('registerAgent', { nickname: 'Sender' });
  await local.userCall('registerAgent', { nickname: 'Receiver' });
  await local.userCall('send', {
    nickname: 'Sender',
    recipientNode: local.snapshot().nodeId,
    recipientNickname: 'Receiver',
    text: 'History remains',
  });
  const agents = local.snapshot().agents.map(({ nickname }) => nickname);
  const history = await local.userCall('history', { nickname: 'Sender' });
  const removal = local
    .snapshot({ lanDiscovery: true })
    .peers.find((peer) => peer.id === selectedId)!;
  assert.ok(removal.removalToken);
  assert.equal(
    local.snapshot().peers.some((peer) => peer.removalToken),
    false,
  );
  await assert.rejects(
    local.userCall('removePeer', { nodeId: otherId, token: removal.removalToken }),
    /selected connection changed/,
  );
  assert.equal(local.snapshot().peers.length, 2);
  assert.deepEqual(
    await local.userCall('removePeer', { nodeId: selectedId, token: removal.removalToken }),
    { removed: true },
  );

  for (let index = 0; index < 150 && selected.snapshot().peers[0]?.connected; index++)
    await delay(20);
  assert.equal(selected.snapshot().peers[0]?.connected, false);
  assert.deepEqual(
    local.snapshot().peers.map((peer) => [peer.id, peer.connected]),
    [[otherId, true]],
  );
  const durable = await new SettingsFile(local.settings.directory).load();
  assert.deepEqual(
    durable.peers.map((peer) => peer.id),
    [otherId],
  );
  assert.deepEqual(
    local.snapshot().agents.map(({ nickname }) => nickname),
    agents,
  );
  assert.deepEqual(await local.userCall('history', { nickname: 'Sender' }), history);
  await local.stop();
  await local.start();
  await connected(local, otherId);
  assert.equal(
    local.snapshot().peers.some((peer) => peer.id === selectedId),
    false,
  );

  await local.network.join(selected.snapshot().peerUrl, selected.network.accessCode().code);
  await connected(local, selectedId);
  await assert.rejects(
    local.userCall('removePeer', { nodeId: selectedId, token: removal.removalToken }),
    /selected connection changed/,
  );
  assert.equal(local.snapshot().peers.find((peer) => peer.id === selectedId)?.connected, true);
});

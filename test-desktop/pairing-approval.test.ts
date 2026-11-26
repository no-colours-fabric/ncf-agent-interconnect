import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import type { NodeService } from '../desktop/core/service.js';
import {
  approvalPath,
  approvalChallenge,
  approvalCommitment,
  signApprovalRequest,
} from '../desktop/core/pairing-approval.js';
import type { OutgoingPairApproval } from '../desktop/shared/pairing-approval.js';
import { pairingNode, pairingNodeResources } from './pairing-node-fixture.js';

const peers = (node: NodeService) => node.settings.value.peers;
const begin = (first: NodeService, second: NodeService, id: string, expectedNodeId?: string) =>
  first.userCall('requestPeerApproval', {
    id,
    address: second.snapshot().peerUrl,
    expectedNodeId,
  }) as Promise<OutgoingPairApproval>;
function pending(state: OutgoingPairApproval, phase: 'waiting' | 'shown'): string {
  assert.ok(state.state === phase);
  assert.match(state.comparisonCode, /^[0-9]{6}$/);
  return state.comparisonCode;
}
const progress = (first: NodeService, id: string) =>
  first.userCall('peerApprovalProgress', { id }) as Promise<OutgoingPairApproval>;

test('dismissal creates no trust, a retry gets a new dialog, and approval pairs the exact nodes', async (t) => {
  const [a, b] = await Promise.all([pairingNode(t), pairingNode(t)]);
  const id = randomUUID();
  const aId = a.snapshot().nodeId;
  const bId = b.snapshot().nodeId;
  await assert.rejects(begin(a, b, randomUUID(), randomUUID()), /does not match/);
  assert.equal(b.network.approvalHost.next(), undefined);
  const firstCode = pending(await begin(a, b, id, bId), 'waiting');
  const first = b.network.approvalHost.next()!;
  assert.equal(first.label, a.snapshot().nodeLabel);
  assert.equal(first.comparisonCode, firstCode);
  assert.equal(pending(await progress(a, id), 'waiting'), firstCode);
  await assert.rejects(b.network.approvalHost.decide(first.id, 'confirm'), /no longer displayed/);
  assert.equal(b.network.approvalHost.displayed(randomUUID()), false);
  assert.equal(b.network.approvalHost.displayed(first.id), true);
  assert.equal(pending(await progress(a, id), 'shown'), firstCode);
  await b.network.approvalHost.decide(first.id, 'dismiss');
  assert.deepEqual(await progress(a, id), { state: 'dismissed' });
  assert.equal(b.network.approvalHost.next(), undefined);
  assert.equal(peers(a).length + peers(b).length, 0);

  const retry = randomUUID();
  const retryCode = pending(await begin(a, b, retry, bId), 'waiting');
  const incoming = b.network.approvalHost.next()!;
  assert.notEqual(incoming.id, first.id);
  assert.equal(incoming.comparisonCode, retryCode);
  await b.network.approvalHost.decide(first.id, 'confirm');
  assert.equal(b.network.approvalHost.next()?.id, incoming.id);
  b.network.approvalHost.displayed(incoming.id);
  assert.equal(pending(await progress(a, retry), 'shown'), retryCode);
  assert.equal(peers(a).length + peers(b).length, 0);
  await b.network.approvalHost.decide(incoming.id, 'confirm');
  assert.equal(peers(a).length + peers(b).length, 0);
  assert.equal(b.network.approvalHost.next()?.comparisonCode, retryCode);
  const result = await progress(a, retry);
  assert.equal(b.network.approvalHost.next(), undefined);
  assert.equal(result.state, 'paired');
  assert.equal(peers(a)[0].id, bId);
  assert.equal(peers(a)[0].address, b.snapshot().peerUrl);
  assert.equal(peers(b)[0].id, aId);
  assert.equal(peers(a)[0].secret, peers(b)[0].secret);
});

test('suppression survives restart, applies to the exact certificate, and code pairing clears it', async (t) => {
  const [a, b] = await Promise.all([pairingNode(t), pairingNode(t)]);
  const impostor = await pairingNode(t, a.snapshot().nodeId);
  const id = randomUUID();
  pending(await begin(a, b, id), 'waiting');
  const first = b.network.approvalHost.next()!;
  b.network.approvalHost.displayed(first.id);
  await b.network.approvalHost.decide(first.id, 'suppress');
  assert.deepEqual(await progress(a, id), { state: 'suppressed' });
  assert.equal(b.network.approvalHost.next(), undefined);
  await b.stop();
  await b.start();
  assert.deepEqual(await begin(a, b, randomUUID()), { state: 'suppressed' });
  assert.equal(b.network.approvalHost.next(), undefined);

  const other = randomUUID();
  const code = pending(await begin(impostor, b, other), 'waiting');
  assert.equal(b.network.approvalHost.next()?.comparisonCode, code);
  await b.network.approvalHost.decide(b.network.approvalHost.next()!.id, 'dismiss');
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  assert.equal(b.settings.value.pairApprovalSuppressions, undefined);
  assert.equal(
    JSON.parse(await readFile(b.settings.filename, 'utf8')).pairApprovalSuppressions,
    undefined,
  );
  await assert.rejects(begin(impostor, b, randomUUID()), /does not match the verified connection/);
  assert.equal(b.network.approvalHost.next(), undefined);

  await a.stop();
  await a.start();
  pending(await begin(a, b, randomUUID()), 'waiting');
  assert.ok(b.network.approvalHost.next());
});

test('a canceled requester has no pairing and a 404 receiver still supports code pairing', async (t) => {
  const [a, b] = await Promise.all([pairingNode(t), pairingNode(t)]);
  const pending = randomUUID();
  const canceledCode = await begin(a, b, pending);
  assert.equal(canceledCode.state, 'waiting');
  const incoming = b.network.approvalHost.next()!;
  b.network.approvalHost.displayed(incoming.id);
  await b.network.approvalHost.decide(incoming.id, 'confirm');
  assert.deepEqual(await a.userCall('cancelPeerApproval', { id: pending }), { canceled: true });
  assert.deepEqual(await progress(a, pending), { state: 'dismissed' });

  const [server] = pairingNodeResources(b).servers;
  const [original] = server.listeners('request');
  server.removeListener('request', original);
  server.on('request', (req, res) => {
    if (req.url === approvalPath) res.writeHead(404).end('Not found');
    else original.call(server, req, res);
  });
  assert.deepEqual(await begin(a, b, randomUUID()), { state: 'unsupported' });
  assert.equal(peers(a).length + peers(b).length, 0);
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  assert.equal(peers(a).length + peers(b).length, 2);
});

test('a certificate without its private key cannot raise an approval window', async (t) => {
  const [real, wrong, receiver] = await Promise.all([
    pairingNode(t),
    pairingNode(t),
    pairingNode(t),
  ]);
  const realIdentity = {
    nodeId: real.snapshot().nodeId,
    label: real.snapshot().nodeLabel,
    certificate: await readFile(path.join(real.settings.directory, 'node-cert.pem'), 'utf8'),
  };
  const wrongKey = await readFile(path.join(wrong.settings.directory, 'node-key.pem'), 'utf8');
  const endpoint = new URL(receiver.snapshot().peerUrl);
  endpoint.protocol = 'https:';
  endpoint.pathname = approvalPath;
  const post = (body: unknown): Promise<{ code: number; body: unknown }> =>
    new Promise((resolve, reject) => {
      const req = https.request(
        endpoint,
        { method: 'POST', rejectUnauthorized: false, agent: false },
        (res) => {
          let value = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            value += chunk;
          });
          res.on('end', () => resolve({ code: res.statusCode!, body: JSON.parse(value) }));
          res.on('error', reject);
        },
      );
      req.on('error', reject).end(JSON.stringify(body));
    });
  const token = randomBytes(32).toString('hex');
  const prepared = () =>
    post({ phase: 'prepare', commitment: approvalCommitment(realIdentity, token) });
  const challenge = approvalChallenge.parse((await prepared()).body);
  const proof = signApprovalRequest(challenge, realIdentity, wrongKey, token);
  assert.equal((await post(proof)).code, 401);
  const realKey = await readFile(path.join(real.settings.directory, 'node-key.pem'), 'utf8');
  const changedToken = randomBytes(32).toString('hex');
  assert.equal(
    (await post(signApprovalRequest(challenge, realIdentity, realKey, changedToken))).code,
    401,
  );
  assert.equal(
    (await post({ phase: 'cancel', id: challenge.id, identity: realIdentity, token: changedToken }))
      .code,
    401,
  );
  assert.deepEqual(
    await post({ phase: 'cancel', id: challenge.id, identity: realIdentity, token }),
    { code: 200, body: { state: 'dismissed' } },
  );
  assert.equal(
    (await post(signApprovalRequest(challenge, realIdentity, realKey, token))).code,
    410,
  );
  assert.equal(receiver.network.approvalHost.next(), undefined);
  assert.equal(peers(receiver).length, 0);
});

test('local outbound code pairing clears only the suppression for the selected identity', async (t) => {
  const [requester, receiver, other] = await Promise.all([
    pairingNode(t),
    pairingNode(t),
    pairingNode(t),
  ]);
  for (const source of [requester, other]) {
    pending(await begin(source, receiver, randomUUID()), 'waiting');
    const current = receiver.network.approvalHost.next()!;
    receiver.network.approvalHost.displayed(current.id);
    await receiver.network.approvalHost.decide(current.id, 'suppress');
  }
  assert.equal(receiver.settings.value.pairApprovalSuppressions?.length, 2);
  await receiver.network.join(requester.snapshot().peerUrl, requester.network.accessCode().code);
  assert.equal(receiver.settings.value.pairApprovalSuppressions?.length, 1);
  assert.deepEqual(await begin(other, receiver, randomUUID()), { state: 'suppressed' });
  pending(await begin(requester, receiver, randomUUID()), 'waiting');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rename, rm, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import selfsigned from 'selfsigned';
import { SRP } from 'fast-srp-hap';
import {
  PairingClient,
  PairingHost,
  normalizeAccessCode,
  type PairIdentity,
  type PairedIdentity,
} from '../desktop/core/pairing.js';
import { NodeService } from '../desktop/core/service.js';
import { SettingsFile } from '../desktop/core/settings.js';
import type { Peer } from '../desktop/shared/contracts.js';

const certs = await Promise.all(
  [1, 2, 3].map(() =>
    selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
      keyType: 'ec',
      curve: 'P-256',
      algorithm: 'sha256',
    }),
  ),
);
const identities: PairIdentity[] = certs.map((cert, i) => ({
  nodeId: randomUUID(),
  label: `Test node ${i}`,
  certificate: cert.cert,
}));
const [hostIdentity, clientIdentity, otherIdentity] = identities;
const noop = async () => {};
const changed = (value: string) => (value[0] === 'a' ? 'b' : 'a') + value.slice(1);
type StartResult = Awaited<ReturnType<PairingHost['handle']>> & {
  sessionId: string;
  publicKey: string;
  salt: string;
  identity: PairIdentity;
};
async function prepare(host: PairingHost, code: string, identity = clientIdentity) {
  const client = new PairingClient(code, identity);
  const challenge = (await host.handle(client.start(), noop)) as StartResult;
  const request = client.prove(challenge, hostIdentity.certificate);
  const proof = (await host.handle(request, noop)) as { proof: string; mac: string };
  const confirm = client.confirm(proof);
  return { client, challenge, request, proof, confirm };
}
function fixture() {
  const host = new PairingHost(() => hostIdentity);
  const code = host.createCode().code;
  return { host, code };
}

test('eight ASCII symbols are case-insensitive; Unicode expansion and punctuation are rejected', () => {
  assert.equal(normalizeAccessCode('  abcdef23\n'), 'ABCDEF23');
  for (const code of [
    'ABCDEF2',
    'ABCDEF234',
    'ABCD-234',
    'ABCD 234',
    'ABCDE012',
    'ABCDEF2О',
    'ＡBCDEF23',
    'abcdeß2',
    'ABCDEI23',
  ])
    assert.throws(() => normalizeAccessCode(code), /8-letter/);
  const { host } = fixture();
  for (let i = 0; i < 32; i++) assert.match(host.createCode().code, /^[A-HJ-NP-Z2-9]{8}$/);
});

test('mutual proofs precede admission and both nodes derive the same private peer credential', async () => {
  const { host, code } = fixture();
  const prepared = await prepare(host, code.toLowerCase());
  let admitted: PairedIdentity | undefined;
  const receipt = await host.handle(prepared.confirm, async (identity) => {
    admitted = identity;
  });
  const peer = prepared.client.finish(receipt);
  assert.equal(peer.secret, admitted!.secret);
  assert.equal(peer.nodeId, hostIdentity.nodeId);
  assert.equal(admitted!.nodeId, clientIdentity.nodeId);
  const wire = JSON.stringify([
    prepared.client.start(),
    prepared.challenge,
    prepared.request,
    prepared.proof,
    prepared.confirm,
    receipt,
  ]);
  assert.ok(!wire.includes(code));
  assert.ok(!wire.includes(peer.secret));
  await assert.rejects(
    host.handle(new PairingClient(code, otherIdentity).start(), noop),
    /already been used/,
  );
});

test('a wrong code has no admission and only one proof guess per started session', async () => {
  const { host, code } = fixture();
  const wrong = (code[0] === 'A' ? 'B' : 'A') + code.slice(1);
  const client = new PairingClient(wrong, clientIdentity);
  const challenge = (await host.handle(client.start(), noop)) as StartResult;
  const request = client.prove(challenge, hostIdentity.certificate);
  await assert.rejects(
    host.handle(request, async () => {
      assert.fail('wrong code admitted');
    }),
    /incorrect/,
  );
  await assert.rejects(host.handle(request, noop), /session expired/);
});

test('all starts share a five-attempt budget, including malformed and concurrent requests', async () => {
  const { host, code } = fixture();
  await assert.rejects(host.handle({ phase: 'start' }, noop), /Invalid pairing/);
  const start = new PairingClient(code, clientIdentity).start();
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () => host.handle(start, noop)),
  );
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 4);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  await assert.rejects(host.handle(start, noop), /Too many connection attempts/);
  host.createCode();
  await host.handle(start, noop);
});

test('code expiry, replacement and stop invalidate uncommitted sessions', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000000 });
  const { host, code } = fixture();
  const first = await prepare(host, code);
  host.createCode();
  await assert.rejects(host.handle(first.confirm, noop), /session expired/);
  const second = await prepare(host, host.createCode().code);
  t.mock.timers.tick(600000);
  await assert.rejects(host.handle(second.confirm, noop), /expired or unavailable/);
  const third = await prepare(host, host.createCode().code);
  host.reset();
  await assert.rejects(host.handle(third.confirm, noop), /expired or unavailable/);
});

test('transcript binds both node IDs, labels, certificates, session ID and salt', async () => {
  const mutations = [
    (challenge: StartResult) => {
      challenge.identity.nodeId = randomUUID();
    },
    (challenge: StartResult) => {
      challenge.identity.label += ' changed';
    },
    (challenge: StartResult) => {
      challenge.identity.certificate = otherIdentity.certificate;
    },
    (challenge: StartResult) => {
      challenge.salt = changed(challenge.salt);
    },
    (challenge: StartResult) => {
      challenge.sessionId = randomUUID();
    },
  ];
  for (const mutate of mutations) {
    const { host, code } = fixture();
    const client = new PairingClient(code, clientIdentity);
    const original = (await host.handle(client.start(), noop)) as StartResult;
    const challenge = structuredClone(original);
    mutate(challenge);
    const request = client.prove(challenge, challenge.identity.certificate);
    await assert.rejects(host.handle(request, noop), /incorrect|session expired/);
  }
  for (const field of ['nodeId', 'label', 'certificate'] as const) {
    const { host, code } = fixture();
    const client = new PairingClient(code, clientIdentity);
    const start = client.start();
    start.identity = { ...start.identity, [field]: otherIdentity[field] };
    const challenge = (await host.handle(start, noop)) as StartResult;
    await assert.rejects(
      host.handle(client.prove(challenge, hostIdentity.certificate), noop),
      /incorrect/,
    );
  }
  const { host, code } = fixture();
  const client = new PairingClient(code, clientIdentity);
  const challenge = await host.handle(client.start(), noop);
  assert.throws(() => client.prove(challenge, otherIdentity.certificate), /certificate changed/);
});

test('zero, out-of-range, malformed and oversized SRP public values are rejected', async () => {
  const values = [
    '0'.repeat(768),
    SRP.params[3072].N.toBuffer(384).toString('hex'),
    'f'.repeat(768),
    '1',
    'g'.repeat(768),
    '1'.repeat(770),
  ];
  for (const publicKey of values) {
    const { host, code } = fixture();
    const client = new PairingClient(code, clientIdentity);
    const challenge = (await host.handle(client.start(), noop)) as StartResult;
    assert.throws(
      () => client.prove({ ...challenge, publicKey }, hostIdentity.certificate),
      /incorrect|Invalid pairing/,
    );
    const request = client.prove(challenge, hostIdentity.certificate);
    await assert.rejects(host.handle({ ...request, publicKey }, noop), /incorrect|Invalid pairing/);
    await assert.rejects(host.handle(request, noop), /session expired/);
  }
});

test('tampered proofs, MAC reflection and cross-session substitution are rejected', async () => {
  const { host, code } = fixture();
  const prepared = await prepare(host, code);
  assert.deepEqual(await host.handle(prepared.request, noop), prepared.proof);
  await assert.rejects(
    host.handle({ ...prepared.request, proof: changed(prepared.request.proof) }, noop),
    /incorrect/,
  );
  await assert.rejects(
    host.handle({ ...prepared.request, mac: changed(prepared.request.mac) }, noop),
    /incorrect/,
  );
  assert.throws(
    () => prepared.client.confirm({ ...prepared.proof, proof: changed(prepared.proof.proof) }),
    /incorrect/,
  );
  assert.throws(
    () => prepared.client.confirm({ ...prepared.proof, mac: prepared.request.mac }),
    /incorrect/,
  );
  await assert.rejects(
    host.handle({ ...prepared.confirm, mac: prepared.proof.mac }, noop),
    /incorrect/,
  );
  const second = await prepare(host, code, otherIdentity);
  await assert.rejects(
    host.handle({ ...prepared.request, sessionId: second.challenge.sessionId }, noop),
    /incorrect/,
  );
  const receipt = (await host.handle(prepared.confirm, noop)) as { mac: string };
  assert.throws(() => prepared.client.finish({ mac: prepared.proof.mac }), /incorrect/);
  assert.throws(() => prepared.client.finish({ mac: changed(receipt.mac) }), /incorrect/);
});

test('identical concurrent confirmation commits once; changed confirmation never repeats admission', async () => {
  const { host, code } = fixture();
  const { client, confirm } = await prepare(host, code);
  let admissions = 0,
    release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const admit = async () => {
    admissions++;
    await barrier;
  };
  const first = host.handle(confirm, admit),
    duplicate = host.handle(confirm, admit);
  assert.equal(admissions, 1);
  release();
  const receipts = await Promise.all([first, duplicate]);
  assert.deepEqual(receipts[0], receipts[1]);
  client.finish(receipts[0]);
  host.createCode();
  assert.deepEqual(await host.handle(confirm, admit), receipts[0]);
  await assert.rejects(host.handle({ ...confirm, mac: changed(confirm.mac) }, admit), /incorrect/);
  assert.equal(admissions, 1);
});

test('two valid claimers race for one atomic claim; failed persistence can be retried safely', async () => {
  const { host, code } = fixture();
  const first = await prepare(host, code),
    second = await prepare(host, code, otherIdentity);
  let admissions = 0;
  const results = await Promise.allSettled(
    [first, second].map((prepared) =>
      host.handle(prepared.confirm, async () => {
        admissions++;
        await Promise.resolve();
      }),
    ),
  );
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(admissions, 1);
  const retry = fixture(),
    prepared = await prepare(retry.host, retry.code);
  await assert.rejects(
    retry.host.handle(prepared.confirm, async () => {
      throw new Error('isolated write failure');
    }),
    /could not save/,
  );
  let saved = 0;
  await retry.host.handle(prepared.confirm, async () => {
    saved++;
  });
  assert.equal(saved, 1);
});

test('server restart forgets recovery sessions and never repeats a committed admission', async () => {
  const { host, code } = fixture();
  const prepared = await prepare(host, code);
  let saved = 0;
  await host.handle(prepared.confirm, async () => {
    saved++;
  });
  host.reset();
  host.createCode();
  await assert.rejects(
    host.handle(prepared.confirm, async () => {
      saved++;
    }),
    /session expired/,
  );
  assert.equal(saved, 1);
});

async function settings(t: test.TestContext): Promise<SettingsFile> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-pair-settings-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const result = new SettingsFile(directory);
  await result.load();
  return result;
}
const peer = (identity: PairIdentity): Peer => ({
  id: identity.nodeId,
  label: identity.label,
  certificate: identity.certificate,
  address: '',
  secret: 'ab'.repeat(32),
});

test('queued peer transactions preserve concurrent upserts and ordinary settings saves', async (t) => {
  const file = await settings(t);
  file.value.nodeLabel = 'Before';
  const before = file.save();
  const first = file.savePeers((current) => [...current, peer(clientIdentity)]);
  file.value.nodeLabel = 'After';
  const after = file.save();
  const second = file.savePeers((current) => [...current, peer(otherIdentity)]);
  await Promise.all([before, first, after, second]);
  assert.equal(file.value.peers.length, 2);
  assert.equal(file.value.nodeLabel, 'After');
  const stored = JSON.parse(await readFile(file.filename, 'utf8'));
  assert.equal(stored.peers.length, 2);
  assert.equal(stored.nodeLabel, 'After');
});

test('validation and write failures preserve old settings; the queue recovers and copies inputs', async (t) => {
  const file = await settings(t),
    original = peer(clientIdentity);
  await file.savePeers(() => [original]);
  original.secret = 'ff'.repeat(32);
  assert.notEqual(file.value.peers[0].secret, original.secret);
  const before = await readFile(file.filename, 'utf8');
  await assert.rejects(
    file.savePeers((current) => {
      current[0].secret = 'invalid';
      return [...current];
    }),
  );
  assert.equal(await readFile(file.filename, 'utf8'), before);
  assert.equal(file.value.peers[0].secret, 'ab'.repeat(32));
  const moved = file.directory + '-moved';
  await rename(file.directory, moved);
  await mkdir(file.directory);
  await mkdir(file.filename);
  await assert.rejects(file.savePeers(() => [peer(otherIdentity)]));
  assert.equal(file.value.peers[0].id, clientIdentity.nodeId);
  assert.equal(await readFile(path.join(moved, 'settings.json'), 'utf8'), before);
  await rm(file.directory, { recursive: true, force: true });
  await rename(moved, file.directory);
  await file.savePeers((current) => [...current, peer(otherIdentity)]);
  assert.equal(file.value.peers.length, 2);
});

async function node(t: test.TestContext): Promise<NodeService> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-pair-node-'));
  const file = new SettingsFile(directory);
  await file.load();
  file.value.peerPort = 0;
  await file.save();
  const service = new NodeService(file.directory);
  await service.open();
  t.after(async () => {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  return service;
}
async function until(check: () => unknown): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Isolated pairing check timed out');
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}

test('real nodes pair with lowercase code, rotate an active credential, and reconnect after restart', async (t) => {
  const a = await node(t),
    b = await node(t);
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code.toLowerCase());
  await until(() => a.snapshot().peers[0]?.connected && b.snapshot().peers[0]?.connected);
  const oldSecret = a.settings.value.peers[0].secret;
  const oldPeer = structuredClone(a.settings.value.peers[0]);
  const bad = b.network.accessCode().code;
  await assert.rejects(
    a.network.join(b.snapshot().peerUrl, (bad[0] === 'A' ? 'B' : 'A') + bad.slice(1)),
    /incorrect/,
  );
  assert.deepEqual(a.settings.value.peers[0], oldPeer);
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  await until(() => a.snapshot().peers[0]?.connected && b.snapshot().peers[0]?.connected);
  assert.notEqual(a.settings.value.peers[0].secret, oldSecret);
  assert.equal(a.settings.value.peers[0].secret, b.settings.value.peers[0].secret);
  assert.equal(a.settings.value.peers.length, 1);
  assert.equal(b.settings.value.peers.length, 1);
  const pin = a.settings.value.peers[0].certificate;
  await b.stop();
  await b.start();
  await until(() => a.snapshot().peers[0]?.connected && b.snapshot().peers[0]?.connected);
  assert.equal(a.settings.value.peers[0].certificate, pin);
});

test('a lost final HTTP response retries the identical session without a second server commit', async (t) => {
  const a = await node(t),
    b = await node(t);
  const save = b.settings.savePeers.bind(b.settings);
  let commits = 0;
  b.settings.savePeers = async (update) => {
    commits++;
    await save(update);
  };
  const request = a.network as unknown as { pairRequest: (...args: unknown[]) => Promise<unknown> };
  const original = request.pairRequest.bind(a.network);
  let dropped = false;
  request.pairRequest = async (...args) => {
    const result = await original(...args);
    if ((args[1] as { phase: string }).phase === 'confirm' && !dropped) {
      dropped = true;
      b.network.accessCode();
      throw new Error('Isolated lost final response');
    }
    return result;
  };
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  assert.equal(commits, 1);
  assert.equal(a.settings.value.peers[0].secret, b.settings.value.peers[0].secret);
});

test('failed server persistence leaves the existing authenticated connection unchanged', async (t) => {
  const a = await node(t),
    b = await node(t);
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  await until(() => a.snapshot().peers[0]?.connected && b.snapshot().peers[0]?.connected);
  const oldA = structuredClone(a.settings.value.peers),
    oldB = structuredClone(b.settings.value.peers);
  const oldDisk = await readFile(b.settings.filename, 'utf8');
  const save = b.settings.savePeers;
  b.settings.savePeers = async () => {
    throw new Error('Isolated write failure');
  };
  await assert.rejects(
    a.network.join(b.snapshot().peerUrl, b.network.accessCode().code),
    /could not save/,
  );
  assert.deepEqual(a.settings.value.peers, oldA);
  assert.deepEqual(b.settings.value.peers, oldB);
  assert.equal(await readFile(b.settings.filename, 'utf8'), oldDisk);
  assert.equal(a.snapshot().peers[0].connected, true);
  assert.equal(b.snapshot().peers[0].connected, true);
  b.settings.savePeers = save;
});

test('a throwing post-commit reconnect cannot release the claim or repeat admission on retry', async (t) => {
  const a = await node(t),
    b = await node(t);
  const save = b.settings.savePeers.bind(b.settings);
  let commits = 0,
    reconnects = 0;
  b.settings.savePeers = async (update) => {
    commits++;
    await save(update);
  };
  b.network.reconnectPeer = () => {
    reconnects++;
    throw new Error('Isolated reconnect listener failure');
  };
  const request = a.network as unknown as { pairRequest: (...args: unknown[]) => Promise<unknown> };
  const original = request.pairRequest.bind(a.network);
  let dropped = false;
  request.pairRequest = async (...args) => {
    const result = await original(...args);
    if ((args[1] as { phase: string }).phase === 'confirm' && !dropped) {
      dropped = true;
      throw new Error('Isolated lost committed response');
    }
    return result;
  };
  const code = b.network.accessCode().code;
  await a.network.join(b.snapshot().peerUrl, code);
  assert.equal(commits, 1);
  assert.equal(reconnects, 1);
  assert.equal(a.settings.value.peers[0].secret, b.settings.value.peers[0].secret);
  assert.ok(b.snapshot().errors.some((error) => error.includes('authorized, but its connection')));
  await assert.rejects(a.network.join(b.snapshot().peerUrl, code), /already been used/);
});

test('restart after server commit reports uncertainty and a fresh explicit pairing recovers', async (t) => {
  const a = await node(t),
    b = await node(t);
  const request = a.network as unknown as { pairRequest: (...args: unknown[]) => Promise<unknown> };
  const original = request.pairRequest.bind(a.network);
  let dropped = false,
    confirmations = 0;
  request.pairRequest = async (...args) => {
    const isConfirm = (args[1] as { phase: string }).phase === 'confirm';
    if (isConfirm) confirmations++;
    const response = await original(...args);
    if (isConfirm && !dropped) {
      dropped = true;
      await b.stop();
      await b.start();
      throw new Error('Isolated lost response followed by restart');
    }
    return response;
  };
  await assert.rejects(
    a.network.join(b.snapshot().peerUrl, b.network.accessCode().code),
    /confirmation is uncertain/,
  );
  assert.equal(confirmations, 2);
  assert.equal(a.settings.value.peers.length, 0);
  assert.equal(b.settings.value.peers.length, 1);
  request.pairRequest = original;
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  assert.equal(a.settings.value.peers[0].secret, b.settings.value.peers[0].secret);
  assert.equal(b.settings.value.peers.length, 1);
});

test('client persistence failure after remote commit is explicit and recoverable', async (t) => {
  const a = await node(t),
    b = await node(t);
  const save = a.settings.savePeers;
  a.settings.savePeers = async () => {
    throw new Error('Isolated client write failure');
  };
  await assert.rejects(
    a.network.join(b.snapshot().peerUrl, b.network.accessCode().code),
    /remote node authorized.*could not save/,
  );
  assert.equal(a.settings.value.peers.length, 0);
  assert.equal(b.settings.value.peers.length, 1);
  a.settings.savePeers = save;
  await a.network.join(b.snapshot().peerUrl, b.network.accessCode().code);
  assert.equal(a.settings.value.peers[0].secret, b.settings.value.peers[0].secret);
  assert.equal(b.settings.value.peers.length, 1);
});

test('HTTP parsing is bounded and pairing endpoints reject browser origins', async (t) => {
  const service = await node(t);
  const endpoint = new URL(service.snapshot().peerUrl);
  endpoint.protocol = 'https:';
  endpoint.pathname = '/pair';
  const send = (body: string, headers = {}) =>
    new Promise<number>((resolve, reject) => {
      const req = https.request(
        endpoint,
        { method: 'POST', rejectUnauthorized: false, headers },
        (res) => {
          res.resume();
          res.on('end', () => resolve(res.statusCode!));
        },
      );
      req.on('error', reject);
      req.end(body);
    });
  assert.equal(await send('x'.repeat(24001)), 413);
  assert.equal(await send('{}', { origin: 'https://untrusted.invalid' }), 404);
  service.network.accessCode();
  assert.equal(await send('{'), 400);
});

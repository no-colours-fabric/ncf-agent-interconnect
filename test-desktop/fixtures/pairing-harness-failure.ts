import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { PairingHarness, bidirectionalGates, type PairRequestTarget } from '../pairing-harness.js';
import { pairingNode } from '../pairing-node-fixture.js';

// Deliberately failing child cases: the parent requires a FAIL summary, not a timeout.
for (const phase of ['start', 'prove', 'confirm']) {
  for (const side of [0, 1]) {
    const label = `${phase}-${side}`;
    test('early pairing failure ' + label, { timeout: 20000 }, async (t) => {
      const cleanups: (() => Promise<void>)[] = [];
      const context = { after: (callback: () => Promise<void>) => cleanups.push(callback) };
      const services: Awaited<ReturnType<typeof pairingNode>>[] = [];
      const originals: PairRequestTarget['pairRequest'][] = [];
      t.after(async () => {
        for (const cleanup of cleanups.reverse()) await cleanup();
        for (const [index, service] of services.entries()) {
          assert.equal(service.network.server?.listening, false);
          assert.equal(
            (service.network as unknown as PairRequestTarget).pairRequest,
            originals[index],
          );
          await assert.rejects(access(service.directory), { code: 'ENOENT' });
        }
        t.diagnostic('cleanup-complete ' + label);
      });
      services.push(await pairingNode(context), await pairingNode(context));
      const [a, b] = services;
      const networks = services.map((service) => service.network as unknown as PairRequestTarget);
      originals.push(...networks.map((network) => network.pairRequest));
      const failure = Object.assign(new Error('Injected connect EADDRINUSE ' + label), {
        code: 'EADDRINUSE',
      });
      const harness = new PairingHarness();
      try {
        await harness.run(async (scope) => {
          const otherWaiting = scope.barrier();
          const failedNetwork = networks[side];
          scope.restore(() => {
            failedNetwork.pairRequest = originals[side];
          });
          failedNetwork.pairRequest = async (...args) => {
            if ((args[1] as { phase: string }).phase === phase) {
              await otherWaiting.promise;
              throw failure;
            }
            return originals[side].apply(failedNetwork, args);
          };
          bidirectionalGates(scope, networks, (index, currentPhase, stage) => {
            if (index === side) return;
            if (
              (phase === 'start' && currentPhase === 'prove' && stage === 'request') ||
              (phase !== 'start' && currentPhase === 'confirm' && stage === 'response')
            )
              otherWaiting.release();
          });
          const codes = [a.network.accessCode().code, b.network.accessCode().code];
          await Promise.allSettled([
            scope.watch(a.network.join(b.snapshot().peerUrl, codes[1]), /being paired/),
            scope.watch(b.network.join(a.snapshot().peerUrl, codes[0]), /being paired/),
          ]);
          assert.fail('A transport failure must not become a successful scenario');
        }, 5000);
      } catch (error) {
        assert.equal(error, failure, 'Preserve the original transport error in the failing test');
        t.diagnostic('original-error-preserved ' + label);
        throw error;
      }
    });
  }
}

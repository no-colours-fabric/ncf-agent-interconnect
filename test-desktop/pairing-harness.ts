import test, { type TestContext } from 'node:test';

export interface PairingBarrier {
  promise: Promise<void>;
  release(): void;
}
interface Gate extends PairingBarrier {
  reject(error: unknown): void;
}

export async function withDeadline<T>(
  operation: Promise<T>,
  timeout: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(label + ' timed out')), timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Owns artificial test waits; an I/O failure must never be hidden behind a gate. */
export class PairingHarness {
  private gates = new Set<Gate>();
  private operations = new Set<Promise<unknown>>();
  private restores: (() => void)[] = [];
  private firstFailure: { error: unknown } | undefined;
  private rejectFailure!: (error: unknown) => void;
  private failure = new Promise<never>((_resolve, reject) => {
    this.rejectFailure = reject;
  });
  private finished = false;
  constructor() {
    void this.failure.catch(() => {});
  }
  barrier(): PairingBarrier {
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    // Cancellation may precede the test's await of an arrival gate.
    void promise.catch(() => {});
    const gate: Gate = {
      promise,
      release: () => {
        this.gates.delete(gate);
        resolve();
      },
      reject: (error) => {
        this.gates.delete(gate);
        reject(error);
      },
    };
    this.gates.add(gate);
    if (this.firstFailure) gate.reject(this.firstFailure.error);
    else if (this.finished) gate.reject(new Error('The pairing test has finished'));
    return gate;
  }
  watch<T>(operation: Promise<T>, expectedFailure?: RegExp): Promise<T> {
    this.operations.add(operation);
    void operation.then(
      () => this.operations.delete(operation),
      (error) => {
        this.operations.delete(operation);
        if (!expectedFailure?.test(error instanceof Error ? error.message : String(error)))
          this.fail(error);
      },
    );
    return operation;
  }
  restore(callback: () => void): void {
    this.restores.push(callback);
  }
  call<T>(operation: () => Promise<T>, expectedFailure?: RegExp): Promise<T> {
    return this.watch(
      Promise.resolve().then(() => {
        if (this.firstFailure) throw this.firstFailure.error;
        if (this.finished) throw new Error('The pairing test has finished');
        return operation();
      }),
      expectedFailure,
    );
  }
  private cancel(error: unknown): void {
    for (const gate of [...this.gates]) gate.reject(error);
  }
  private fail(error: unknown): void {
    if (this.firstFailure || this.finished) return;
    this.firstFailure = { error };
    this.cancel(error);
    this.rejectFailure(error);
  }
  async run<T>(body: (harness: PairingHarness) => Promise<T>, timeout = 10000): Promise<T> {
    let result: T | undefined;
    let failure: { error: unknown } | undefined;
    try {
      result = await withDeadline(
        Promise.race([Promise.resolve().then(() => body(this)), this.failure]),
        timeout,
        'Pairing scenario',
      );
    } catch (error) {
      this.fail(error);
      failure = this.firstFailure ?? { error };
    } finally {
      if (!failure && this.operations.size) {
        failure = { error: new Error('Pairing scenario finished with unfinished operations') };
      }
      this.finished = true;
      this.cancel(failure?.error ?? new Error('The pairing test has finished'));
      try {
        await withDeadline(
          Promise.allSettled([...this.operations]),
          timeout,
          'Pairing operation cleanup',
        );
      } catch (error) {
        if (failure)
          failure = {
            error: new AggregateError(
              [failure.error, error],
              'Pairing failed and operation cleanup did not finish',
            ),
          };
        else failure = { error };
      } finally {
        for (const restore of this.restores.reverse()) {
          try {
            restore();
          } catch (error) {
            failure = {
              error: failure
                ? new AggregateError([failure.error, error], 'Pairing override cleanup failed')
                : error,
            };
          }
        }
      }
    }
    if (failure) throw failure.error;
    return result as T;
  }
}

export function pairingTest(
  name: string,
  body: (t: TestContext, harness: PairingHarness) => Promise<void>,
): void {
  test(name, { timeout: 25000 }, async (t) => {
    const harness = new PairingHarness();
    await harness.run((scope) => body(t, scope));
  });
}

export interface PairRequestTarget {
  pairRequest: (...args: unknown[]) => Promise<unknown>;
}

/** Keep the original race ordering, but observe real I/O before waiting for its sibling. */
export function bidirectionalGates(
  harness: PairingHarness,
  networks: PairRequestTarget[],
  reached?: (index: number, phase: string, stage: 'request' | 'response') => void,
): void {
  const proving = harness.barrier(),
    responses = harness.barrier();
  let proveCount = 0,
    responseCount = 0;
  networks.forEach((network, index) => {
    const original = network.pairRequest;
    harness.restore(() => {
      network.pairRequest = original;
    });
    network.pairRequest = async (...args) => {
      const phase = (args[1] as { phase: string }).phase;
      reached?.(index, phase, 'request');
      if (phase === 'prove') {
        if (++proveCount === 2) proving.release();
        await proving.promise;
      }
      try {
        return await harness.call(() => original.apply(network, args), /being paired/);
      } finally {
        if (phase === 'confirm') {
          reached?.(index, phase, 'response');
          if (++responseCount === 2) responses.release();
          await responses.promise;
        }
      }
    };
  });
}

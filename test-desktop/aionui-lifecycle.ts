import type { TestContext } from 'node:test';
import type { ChildProcess } from 'node:child_process';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Socket } from 'node:net';
import type http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { NodeService } from '../desktop/core/service.js';
import { withDeadline } from './pairing-harness.js';

export class FixtureCancelled extends Error {
  constructor() {
    super('The owned AionUi fixture operation was cancelled');
  }
}
interface Resource {
  label: string;
  close: () => Promise<unknown>;
  force?: () => void;
  budget?: number;
}
export interface FixtureBarrier {
  entered: Promise<void>;
  wait(signal?: AbortSignal): Promise<void>;
  release(): void;
}

/** Test-only ownership. Deadline failures survive force cleanup; no global handles are touched. */
export class AionLifecycle {
  closing = false;
  private failure?: unknown;
  private unexpected: unknown[] = [];
  private operations = new Map<Promise<unknown>, string>();
  private gates = new Set<(error: unknown) => void>();
  private cancelers: (() => void)[] = [];
  private consumers: Resource[] = [];
  private transports: Resource[] = [];
  private files: Resource[] = [];
  private closingTask?: Promise<void>;
  private failureSignal: Promise<never>;
  private rejectFailure!: (error: unknown) => void;
  private cancellation = new FixtureCancelled();
  readonly phases: string[] = [];
  private trace: (label: string) => void = () => {};
  details: () => unknown = () => this.snapshot();
  constructor(
    t: Pick<TestContext, 'after'> & Partial<Pick<TestContext, 'diagnostic'>>,
    private readonly budget = 5000,
  ) {
    this.failureSignal = new Promise<never>((_, reject) => {
      this.rejectFailure = reject;
    });
    void this.failureSignal.catch(() => {});
    if (process.env.NCF_AION_FIXTURE_TRACE === '1' && t.diagnostic)
      this.trace = (label) =>
        t.diagnostic!('AionUi fixture ' + label + ' ' + JSON.stringify(this.details()));
    // Registered before any listen/open/connect or temporary directory creation.
    t.after(() => this.close());
  }
  snapshot() {
    return { closing: this.closing, operations: this.operations.size, gates: this.gates.size };
  }
  recordFailure(error: unknown): void {
    this.fail(error);
  }
  private fail(error: unknown): void {
    if (!this.unexpected.includes(error)) this.unexpected.push(error);
    if (this.failure !== undefined) return;
    this.failure = error;
    for (const reject of [...this.gates]) reject(error);
    this.rejectFailure(error);
  }
  watch<T>(
    label: string,
    operation: Promise<T>,
    expected?: (error: unknown) => boolean,
  ): Promise<T> {
    this.operations.set(operation, label);
    void operation.then(
      () => this.operations.delete(operation),
      (error) => {
        this.operations.delete(operation);
        if (!expected?.(error)) this.fail(error);
      },
    );
    return operation;
  }
  call<T>(
    label: string,
    body: () => Promise<T>,
    expected?: (error: unknown) => boolean,
  ): Promise<T> {
    return this.watch(
      label,
      Promise.resolve().then(() => {
        if (this.closing) throw this.cancellation;
        if (this.failure !== undefined) throw this.failure;
        return body();
      }),
      expected,
    );
  }
  async start<T>(label: string, body: () => Promise<T>): Promise<T> {
    this.trace('startup begin ' + label);
    try {
      const result = await withDeadline(
        this.call(label, body),
        10000,
        'AionUi fixture startup: ' + label,
      );
      this.trace('startup end ' + label);
      return result;
    } catch (error) {
      this.trace('startup failed ' + label);
      this.fail(error);
      throw error;
    }
  }
  controller(): AbortController {
    const controller = new AbortController();
    this.cancelWith(() => controller.abort(new FixtureCancelled()));
    return controller;
  }
  cancelWith(callback: () => void): void {
    this.cancelers.push(callback);
    if (this.closing) callback();
  }
  consumer(resource: Resource): void {
    this.consumers.push(resource);
  }
  transport(resource: Resource): void {
    this.transports.push(resource);
  }
  file(resource: Resource): void {
    this.files.push(resource);
  }
  barrier(label: string): FixtureBarrier {
    let resolve!: () => void,
      reject!: (error: unknown) => void,
      arrive!: () => void,
      rejectArrival!: (error: unknown) => void;
    let settled = false,
      arrived = false;
    const entered = new Promise<void>((done, fail) => {
      arrive = () => {
        arrived = true;
        done();
        if (settled) this.gates.delete(cancel);
      };
      rejectArrival = fail;
    });
    void entered.catch(() => {});
    const promise = new Promise<void>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    void promise.catch(() => {});
    const cancel = (error: unknown) => {
      this.gates.delete(cancel);
      rejectArrival(error);
      if (settled) return;
      settled = true;
      reject(error);
    };
    this.gates.add(cancel);
    if (this.closing) cancel(this.cancellation);
    else if (this.failure !== undefined) cancel(this.failure);
    return {
      entered,
      release: () => {
        if (settled) return;
        settled = true;
        if (arrived) this.gates.delete(cancel);
        resolve();
      },
      wait: async (signal) => {
        arrive();
        if (signal?.aborted) throw this.cancellation;
        let remove: (() => void) | undefined;
        const abort = new Promise<never>((_, fail) => {
          if (signal) signal.addEventListener('abort', onAbort, { once: true });
          function onAbort() {
            fail(new FixtureCancelled());
          }
          // Removed in the finally below through the captured callback.
          remove = () => signal?.removeEventListener('abort', onAbort);
        });
        try {
          await withDeadline(
            Promise.race([promise, abort]),
            10000,
            'AionUi fixture barrier: ' + label,
          );
        } finally {
          remove?.();
        }
      },
    };
  }
  private async phase(resource: Resource, errors: unknown[]): Promise<boolean> {
    this.phases.push(resource.label);
    this.trace('cleanup begin ' + resource.label);
    const pending = Promise.resolve().then(resource.close);
    try {
      await withDeadline(
        pending,
        resource.budget ?? this.budget,
        'AionUi fixture ' + resource.label,
      );
      this.trace('cleanup end ' + resource.label);
      return true;
    } catch (error) {
      this.trace('cleanup failed ' + resource.label);
      errors.push(
        error instanceof Error && error.message.endsWith('timed out')
          ? error
          : new Error('AionUi fixture ' + resource.label + ' failed', { cause: error }),
      );
      if (error instanceof Error && error.message.endsWith('timed out'))
        errors.push(
          new Error(
            'AionUi fixture phase ' +
              resource.label +
              ' resources: ' +
              JSON.stringify(this.details()),
          ),
        );
      try {
        resource.force?.();
      } catch (forceError) {
        errors.push(forceError);
      }
      try {
        await withDeadline(pending, this.budget, 'AionUi fixture forced ' + resource.label);
        return true;
      } catch (forcedError) {
        if (forcedError !== error) errors.push(forcedError);
        return false;
      }
    }
  }
  async run<T>(body: () => Promise<T>): Promise<T> {
    let result: T | undefined, original: unknown;
    try {
      result = await withDeadline(
        Promise.race([
          this.watch('scenario body', Promise.resolve().then(body)),
          this.failureSignal,
        ]),
        15000,
        'AionUi fixture scenario',
      );
      if (this.operations.size)
        throw new Error('AionUi scenario finished with unfinished operations');
    } catch (error) {
      original = error;
      this.fail(error);
    }
    try {
      await this.close();
    } catch (error) {
      if (original === undefined) throw error;
      if (error === original) throw error;
      throw new AggregateError([original, error], 'AionUi scenario and cleanup failed');
    }
    if (original !== undefined) throw original;
    return result as T;
  }
  close(): Promise<void> {
    return (this.closingTask ??= (async () => {
      this.closing = true;
      const errors: unknown[] = [];
      for (const reject of [...this.gates]) reject(this.cancellation);
      for (const cancel of this.cancelers) {
        try {
          cancel();
        } catch (error) {
          errors.push(error);
        }
      }
      // Consumers begin stopping while APIs still exist, before any listener is destroyed.
      const stopped = await Promise.all(
        [...this.consumers].reverse().map((resource) => this.phase(resource, errors)),
      );
      const closed = await Promise.all(
        [...this.transports].reverse().map((resource) => this.phase(resource, errors)),
      );
      const drained = await this.phase(
        {
          label: 'operation drain',
          close: async () => {
            while (this.operations.size) await Promise.allSettled([...this.operations.keys()]);
            // watch() records each rejected result under its explicit expected-error policy.
            if (this.gates.size) throw new Error('AionUi fixture drain left owned gates');
          },
        },
        errors,
      );
      if (stopped.every(Boolean) && closed.every(Boolean) && drained) {
        for (const file of [...this.files].reverse()) await this.phase(file, errors);
      } else
        errors.push(new Error('AionUi temporary data retained because owned work did not drain'));
      this.trace('cleanup finished');
      const unique = [...new Set([...this.unexpected, ...errors])];
      if (unique.length === 1) throw unique[0];
      if (unique.length) throw new AggregateError(unique, 'AionUi fixture cleanup failed');
    })());
  }
}

/** Owns only this temporary node's listeners/sockets, not installed applications. */
export function ownNode(
  scope: AionLifecycle,
  service: NodeService,
  opening: () => Promise<unknown> | undefined = () => undefined,
): () => void {
  const sockets = new Set<Socket>();
  const servers = () =>
    [
      service.network?.server,
      (service.mcp as unknown as { server?: http.Server } | undefined)?.server,
    ].filter((server): server is http.Server => !!server);
  const force = () => {
    for (const socket of sockets) socket.destroy();
    for (const server of servers()) {
      if (server.listening) server.close(() => {});
      server.closeAllConnections();
    }
  };
  scope.cancelWith(() => service.aionui.cancelPair());
  scope.consumer({
    label: 'NodeService cleanup',
    close: async () => {
      const starting = opening();
      if (starting) {
        const [result] = await Promise.allSettled([starting]);
        if (result.status === 'rejected') scope.recordFailure(result.reason);
      }
      if (service.store) await service.close();
      else await service.aionui.close();
    },
    force,
  });
  return () => {
    for (const server of servers())
      server.on('connection', (socket: Socket) => {
        sockets.add(socket);
        socket.once('close', () => sockets.delete(socket));
      });
  };
}
export async function temporaryNode(
  scope: AionLifecycle,
  prefix = 'ncf-aionui-isolated-',
): Promise<NodeService> {
  let directory: string | undefined;
  scope.file({
    label: 'temporary node data removal',
    close: async () => {
      if (directory) await rm(directory, { recursive: true, force: true });
    },
  });
  directory = await scope.start('temporary node data', () =>
    mkdtemp(path.join(os.tmpdir(), prefix)),
  );
  // GUI consumers import the API fixture without enabling Node 22 SQLite.
  // Load the node implementation only when this test explicitly owns a node.
  const { NodeService } = await scope.start(
    'NodeService module',
    () => import('../desktop/core/service.js'),
  );
  const service = new NodeService(directory);
  let opening: Promise<void> | undefined;
  const observe = ownNode(scope, service, () => opening);
  opening = scope.call('node opening', async () => {
    await service.settings.load();
    service.settings.value.peerPort = 0;
    await service.settings.save();
    await service.open();
    observe();
  });
  await scope.start('node open', () => opening!);
  return service;
}

/** Captures the SDK child object owned by this transport, never a process by name. */
export function ownStdio(
  scope: AionLifecycle,
  client: Client,
  transport: StdioClientTransport,
): () => boolean {
  let child: ChildProcess | undefined,
    closed: Promise<void> | undefined,
    finished = false;
  const capture = () => {
    if (child) return;
    child = (transport as unknown as { _process?: ChildProcess })._process;
    if (!child) return;
    closed = new Promise<void>((resolve) => {
      if (child!.exitCode !== null || child!.signalCode !== null) {
        finished = true;
        resolve();
      } else
        child!.once('close', () => {
          finished = true;
          resolve();
        });
    });
  };
  scope.consumer({
    label: 'stdio MCP child cleanup',
    close: async () => {
      capture();
      await client.close();
      await transport.close();
      if (closed) await closed;
    },
    force: () => {
      capture();
      child?.kill('SIGKILL');
    },
  });
  return () => {
    capture();
    return !!child && finished;
  };
}

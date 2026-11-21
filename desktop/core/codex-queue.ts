import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { watch, type FSWatcher } from 'node:fs';
import { lstat, realpath } from 'node:fs/promises';
import { createConnection } from 'node:net';
import path from 'node:path';
import WebSocket from 'ws';
import type { AdapterProfile, AdapterState } from '../shared/contracts.js';
import {
  bundledCodex,
  codexControlDirectory,
  codexControlSocket,
  ncfCodexControlSocket,
} from '../shared/codex-desktop.js';
import {
  agentMessageText,
  type Admission,
  type AgentAdapter,
  type EventInput,
} from './adapters.js';
import { codexQueueWitness, contentHash, type DeliveryAttempt } from './delivery-attempt.js';

const maximumFrameBytes = 2 * 1024 * 1024;
const operationTimeout = 8000;
const projectionPageSize = 4;
const projectionPageLimit = 32;

type Projection = {
  payloadHash: string;
  isCurrent: () => boolean;
  admit: () => void;
};

type QueueCall = (method: string, params: object) => Promise<Record<string, unknown>>;
type QueueSession = <T>(
  profile: AdapterProfile,
  signal: AbortSignal,
  operation: (call: QueueCall) => Promise<T>,
) => Promise<T>;

type QueueOperation<T> = (call: QueueCall, shared: boolean) => Promise<T>;

type RpcConnection = {
  send: (line: string) => void;
  receive: (listener: (frame: string) => void) => void;
  fail: () => void;
};

export class CodexRpcRejection extends Error {
  constructor(
    readonly code: unknown,
    readonly reason: unknown,
  ) {
    super('Codex app-server rejected the request');
  }

  expiredTurn(expected: string): boolean {
    if (this.code !== -32600 || typeof this.reason !== 'string') return false;
    const mismatch = /^expected active turn id `([a-f0-9-]{36})` but found `[a-f0-9-]{36}`$/i.exec(
      this.reason,
    );
    return this.reason === 'no active turn to steer' || mismatch?.[1] === expected;
  }
}

async function exchange<T>(
  signal: AbortSignal,
  connection: RpcConnection,
  operation: (call: QueueCall) => Promise<T>,
): Promise<T> {
  let requestId = 0;
  let pending: ((reply: Record<string, unknown>) => void) | undefined;
  connection.receive((frame) => {
    try {
      const reply = JSON.parse(frame) as Record<string, unknown>;
      if (reply && typeof reply === 'object') pending?.(reply);
    } catch {
      connection.fail();
    }
  });
  const call: QueueCall = (method, params) =>
    new Promise((resolve, reject) => {
      signal.throwIfAborted();
      const id = ++requestId;
      const abort = () => reject(new Error('Codex app-server did not confirm the request'));
      signal.addEventListener('abort', abort, { once: true });
      pending = (reply) => {
        if (reply.id !== id) return;
        signal.removeEventListener('abort', abort);
        pending = undefined;
        if (reply.error && typeof reply.error === 'object') {
          const error = reply.error as Record<string, unknown>;
          reject(new CodexRpcRejection(error.code, error.message));
        } else if (reply.error || !reply.result || typeof reply.result !== 'object')
          reject(new Error('Codex app-server did not return a result'));
        else resolve(reply.result as Record<string, unknown>);
      };
      connection.send(JSON.stringify({ id, method, params }));
    });
  await call('initialize', {
    clientInfo: { name: 'ncf_agent_interconnect', title: 'NCF Agent Interconnect', version: '1' },
    capabilities: { experimentalApi: true },
  });
  connection.send(JSON.stringify({ method: 'initialized' }));
  return operation(call);
}

export async function codexQueueHome(socket: string | undefined): Promise<string> {
  if (
    process.platform !== 'darwin' ||
    !socket ||
    !path.isAbsolute(socket) ||
    path.basename(socket) !== 'ipc.sock' ||
    path.basename(path.dirname(socket)) !== 'ipc'
  )
    throw new Error('The saved Codex binding does not identify a local macOS profile');
  const directory = path.dirname(socket);
  const home = path.dirname(directory);
  const uid = process.getuid!();
  for (const entry of [home, directory]) {
    const info = await lstat(entry).catch((error: NodeJS.ErrnoException) => {
      if (entry === directory && error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (!info) continue;
    if (
      !info.isDirectory() ||
      info.uid !== uid ||
      (info.mode & 0o022) !== 0 ||
      (await realpath(entry)) !== entry
    )
      throw new Error('The saved Codex profile failed its ownership check');
  }
  return home;
}

async function codexTranscript(
  profile: AdapterProfile,
  threadId: string,
  transcript: unknown,
): Promise<string> {
  const home = await codexQueueHome(profile.socket);
  if (typeof transcript !== 'string' || !path.isAbsolute(transcript))
    throw new Error('Codex did not expose the saved chat transcript');
  const [scope] = path.relative(home, transcript).split(path.sep);
  if (
    (scope !== 'sessions' && scope !== 'archived_sessions') ||
    !path.basename(transcript).endsWith('-' + threadId + '.jsonl') ||
    (await realpath(transcript)) !== transcript
  )
    throw new Error('Codex returned a transcript outside the saved profile');
  const stat = await lstat(transcript);
  if (!stat.isFile() || stat.uid !== process.getuid!() || (stat.mode & 0o022) !== 0)
    throw new Error('The saved Codex transcript failed its ownership check');
  return transcript;
}

const appServerSession: QueueSession = async (profile, stopped, operation) => {
  const home = await codexQueueHome(profile.socket);
  const uid = process.getuid!();
  const executable = await lstat(bundledCodex);
  if (
    !executable.isFile() ||
    ![0, uid].includes(executable.uid) ||
    (executable.mode & 0o022) !== 0 ||
    (await realpath(bundledCodex)) !== bundledCodex
  )
    throw new Error('The bundled Codex executable failed its ownership check');
  const lifetime = new AbortController();
  const signal = AbortSignal.any([stopped, lifetime.signal, AbortSignal.timeout(operationTimeout)]);
  signal.throwIfAborted();
  const env = { ...process.env, CODEX_HOME: home };
  // Select the already-bound profile, independent of the environment inherited by NCF.
  delete (env as NodeJS.ProcessEnv).CODEX_SQLITE_HOME;
  const child = spawn(bundledCodex, ['app-server', '--listen', 'stdio://'], {
    cwd: home,
    env,
    stdio: ['pipe', 'pipe', 'ignore'],
    signal,
  });
  const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
  const disconnected = () =>
    lifetime.abort(new Error('Codex app-server closed the queue connection'));
  child.on('error', disconnected);
  child.stdin.on('error', disconnected);
  child.once('close', disconnected);
  try {
    return await exchange(
      signal,
      {
        send: (line) => child.stdin.write(line + '\n'),
        receive: (listener) => {
          let buffer = Buffer.alloc(0);
          child.stdout.on('data', (chunk: Buffer) => {
            buffer = Buffer.concat([buffer, chunk]);
            let next: number;
            while ((next = buffer.indexOf(10)) !== -1) {
              const frame = buffer.subarray(0, next);
              buffer = buffer.subarray(next + 1);
              if (frame.length > maximumFrameBytes) {
                disconnected();
                return;
              }
              listener(frame.toString('utf8'));
            }
            if (buffer.length > maximumFrameBytes) disconnected();
          });
        },
        fail: disconnected,
      },
      operation,
    );
  } finally {
    // Abort only the app-server child created for this operation.
    lifetime.abort();
    const force = setTimeout(() => child.kill('SIGKILL'), 1000);
    await closed;
    clearTimeout(force);
  }
};

const sharedAppServerSession: QueueSession = async (profile, stopped, operation) => {
  const home = await codexQueueHome(profile.socket);
  const uid = process.getuid!();
  const directory = path.join(home, codexControlDirectory);
  const bridgedSocket = path.join(directory, ncfCodexControlSocket);
  const socketPath = await lstat(bridgedSocket).then(
    () => bridgedSocket,
    (error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
      return path.join(directory, codexControlSocket);
    },
  );
  const directoryInfo = await lstat(directory);
  if (
    !directoryInfo.isDirectory() ||
    directoryInfo.uid !== uid ||
    (directoryInfo.mode & 0o022) !== 0 ||
    (await realpath(directory)) !== directory
  )
    throw new Error('The local Codex control directory failed its ownership check');

  const alias = await lstat(socketPath);
  const endpoint = await realpath(socketPath);
  if (alias.isSymbolicLink()) {
    // Codex places long Unix socket paths under a private, same-user daemon directory.
    const temporary = path.join(await realpath('/tmp'), 'codex-daemon-' + uid);
    if (endpoint !== path.join(temporary, contentHash(socketPath)))
      throw new Error('The local Codex control socket has an unexpected target');
    const info = await lstat(temporary);
    if (!info.isDirectory() || info.uid !== uid || (info.mode & 0o077) !== 0)
      throw new Error('The local Codex daemon directory failed its ownership check');
  } else if (endpoint !== socketPath) {
    throw new Error('The local Codex control socket has an unexpected target');
  }
  const info = await lstat(endpoint);
  if (alias.uid !== uid || !info.isSocket() || info.uid !== uid || (info.mode & 0o077) !== 0)
    throw new Error('The local Codex control socket failed its ownership check');

  const lifetime = new AbortController();
  const signal = AbortSignal.any([stopped, lifetime.signal, AbortSignal.timeout(operationTimeout)]);
  signal.throwIfAborted();
  const ws = new WebSocket('ws://localhost/rpc', {
    createConnection: () => createConnection(endpoint),
    maxPayload: maximumFrameBytes,
    handshakeTimeout: 2000,
  });
  const disconnected = () => lifetime.abort(new Error('The Codex control connection closed'));
  ws.on('error', disconnected);
  ws.once('close', disconnected);
  try {
    await new Promise<void>((resolve, reject) => {
      signal.throwIfAborted();
      const abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      ws.once('open', () => {
        signal.removeEventListener('abort', abort);
        resolve();
      });
    });
    return await exchange(
      signal,
      {
        send: (line) => ws.send(line),
        receive: (listener) => {
          ws.on('message', (frame, binary) => {
            if (binary) disconnected();
            else listener(frame.toString());
          });
        },
        fail: disconnected,
      },
      operation,
    );
  } finally {
    ws.terminate();
  }
};

export class CodexQueueAdapter implements AgentAdapter {
  readonly contentGate = true;
  readonly wakeOnly = false;
  private readonly controller = new AbortController();
  private readonly jobs = new Set<Promise<unknown>>();
  private state: AdapterState['state'] = 'checking';
  private error: string | null = null;
  private transcript?: string;
  private sharedOwner = false;
  private watcher?: FSWatcher;
  private readonly projections = new Map<string, Projection>();
  private projectionTimer?: ReturnType<typeof setTimeout>;
  private projecting = false;
  private projectionChanged = false;

  constructor(
    readonly profile: AdapterProfile,
    private readonly changed: () => void,
    private readonly session: QueueSession = appServerSession,
    private readonly resolveTranscript = codexTranscript,
    private readonly ownerSession: QueueSession = sharedAppServerSession,
  ) {}

  status(): AdapterState {
    return {
      id: this.profile.id,
      label: this.profile.label,
      kind: 'codex-desktop',
      capabilities: {
        wakeIdle: this.state === 'ready',
        receiveActive: this.state === 'ready' && this.sharedOwner,
        nativeDisplay: this.state === 'ready',
        exactSession: this.state === 'ready',
      },
      state: this.state,
      error: this.error,
    };
  }

  private run<T>(operation: QueueOperation<T>): Promise<T> {
    const signal = this.controller.signal;
    const job = (async () => {
      let began = false;
      try {
        return await this.ownerSession(this.profile, signal, (call) => {
          began = true;
          return operation(call, true);
        });
      } catch (error) {
        // Once an operation has started, the server may have accepted content.
        if (began || signal.aborted) throw error;
      }
      return this.session(this.profile, signal, (call) => operation(call, false));
    })();
    this.jobs.add(job);
    return job.finally(() => this.jobs.delete(job));
  }

  private async verifyThread(call: QueueCall) {
    const threadId = this.profile.threadId;
    if (!threadId) throw new Error('The saved Codex chat is missing');
    const result = await call('thread/read', { threadId, includeTurns: false });
    const thread = result.thread as
      | { id?: unknown; ephemeral?: unknown; path?: unknown; status?: { type?: unknown } }
      | undefined;
    if (thread?.id !== threadId || thread.ephemeral !== false)
      throw new Error('Codex did not confirm the saved chat in this profile');
    return { id: threadId, path: thread.path, state: thread.status?.type };
  }

  private async enqueue(
    call: QueueCall,
    threadId: string,
    text: string,
    clientUserMessageId: string = randomUUID(),
  ): Promise<void> {
    const response = await call('thread/queue/add', {
      threadId,
      clientUserMessageId,
      input: [{ type: 'text', text, text_elements: [] }],
    });
    const submission = response.queuedSubmission as
      { id?: unknown; clientUserMessageId?: unknown } | undefined;
    if (
      typeof submission?.id !== 'string' ||
      !submission.id ||
      submission.clientUserMessageId !== clientUserMessageId
    )
      throw new Error('Codex did not confirm the queue submission');
  }

  async challenge(
    token: string,
    isCurrent: () => boolean,
  ): Promise<'sent' | 'uncertain' | 'failed'> {
    let submitting = false;
    try {
      await this.run(async (call) => {
        const { id: threadId } = await this.verifyThread(call);
        this.controller.signal.throwIfAborted();
        if (!isCurrent()) throw new Error('The Codex connection request changed');
        submitting = true;
        await this.enqueue(
          call,
          threadId,
          'NCF Agent Interconnect connection confirmation. If you requested an NCF connection from this chat, call agent_connect with the nickname you requested and the contextToken below. Keep the code internal. If you did not request a connection, ignore this message.\n\ncontextToken: ' +
            token,
        );
      });
      return 'sent';
    } catch {
      return submitting ? 'uncertain' : 'failed';
    }
  }

  private async projectionPage(call: QueueCall, threadId: string, cursor?: string) {
    const result = await call('thread/items/list', {
      threadId,
      limit: projectionPageSize,
      sortDirection: 'desc',
      ...(cursor === undefined ? {} : { cursor }),
    });
    if (!Array.isArray(result.data)) throw new Error('Codex did not confirm transcript access');
    return result;
  }

  async start(): Promise<void> {
    try {
      await this.run(async (call, shared) => {
        const thread = await this.verifyThread(call);
        const response = await call('thread/queue/list', { threadId: thread.id, limit: 1 });
        if (!Array.isArray(response.data)) throw new Error('Codex did not confirm queue support');
        await this.projectionPage(call, thread.id);
        this.transcript = await this.resolveTranscript(this.profile, thread.id, thread.path);
        this.sharedOwner = shared && (thread.state === 'active' || thread.state === 'idle');
      });
      if (this.controller.signal.aborted) return;
      this.state = 'ready';
      this.error = null;
    } catch {
      if (this.controller.signal.aborted) return;
      this.state = 'error';
      this.error = 'The saved Codex chat, its input queue or its transcript is unavailable';
    }
    this.changed();
  }

  observeDelivery(attempt: DeliveryAttempt, isCurrent: () => boolean, admit: () => void): void {
    const { host, payloadHash, owner } = attempt.meta;
    if (
      this.state !== 'ready' ||
      this.controller.signal.aborted ||
      !host ||
      !payloadHash ||
      host.runtime !== codexQueueWitness ||
      host.messageId !== attempt.id ||
      host.session !== this.profile.threadId ||
      owner.chatId !== host.session ||
      owner.adapterId !== this.profile.id ||
      this.projections.has(host.messageId)
    )
      return;
    this.projections.set(host.messageId, { payloadHash, isCurrent, admit });
    this.ensureWatcher();
    // The item may have been persisted before observation was registered.
    this.scheduleProjection();
  }

  private ensureWatcher(): void {
    if (this.watcher || !this.transcript) return;
    try {
      const watcher = watch(this.transcript, { persistent: false }, (event) => {
        if (this.watcher !== watcher) return;
        if (event === 'rename') {
          watcher.close();
          this.watcher = undefined;
        }
        this.scheduleProjection();
      });
      this.watcher = watcher;
      watcher.once('error', () => {
        watcher.close();
        if (this.watcher === watcher) this.watcher = undefined;
      });
    } catch {
      // The immediate check can still confirm a persisted item.
    }
  }

  private scheduleProjection(): void {
    if (this.controller.signal.aborted || !this.projections.size) return;
    if (this.projecting) {
      this.projectionChanged = true;
      return;
    }
    if (this.projectionTimer) return;
    this.projectionTimer = setTimeout(() => {
      this.projectionTimer = undefined;
      this.projecting = true;
      const job = this.run(async (call) => {
        const thread = await this.verifyThread(call);
        if (thread.path !== this.transcript) {
          this.transcript = await this.resolveTranscript(this.profile, thread.id, thread.path);
          this.watcher?.close();
          this.watcher = undefined;
        }
        this.ensureWatcher();
        for (const [id, projection] of this.projections)
          if (!projection.isCurrent()) this.projections.delete(id);
        let cursor: string | undefined;
        for (let page = 0; page < projectionPageLimit && this.projections.size; page++) {
          const { data, nextCursor } = await this.projectionPage(call, thread.id, cursor);
          for (const entry of data as { item?: unknown }[]) this.project(entry?.item);
          if (typeof nextCursor !== 'string' || !nextCursor || nextCursor === cursor) break;
          cursor = nextCursor;
        }
      }).catch(() => {});
      void job.finally(() => {
        this.projecting = false;
        if (!this.projections.size) {
          this.watcher?.close();
          this.watcher = undefined;
        }
        if (this.projectionChanged) {
          this.projectionChanged = false;
          this.scheduleProjection();
        }
      });
    }, 100);
    this.projectionTimer.unref?.();
  }

  private project(item: unknown): void {
    if (!item || typeof item !== 'object') return;
    const { id, type, clientId, completedAtMs, content } = item as Record<string, unknown>;
    if (
      typeof id !== 'string' ||
      !id ||
      type !== 'userMessage' ||
      typeof clientId !== 'string' ||
      typeof completedAtMs !== 'number' ||
      !Number.isFinite(completedAtMs) ||
      !Array.isArray(content) ||
      content.length !== 1 ||
      content[0]?.type !== 'text' ||
      typeof content[0]?.text !== 'string'
    )
      return;
    const projection = this.projections.get(clientId);
    if (!projection || contentHash(content[0].text) !== projection.payloadHash) return;
    if (projection.isCurrent()) projection.admit();
    this.projections.delete(clientId);
  }

  async deliver(input: EventInput): Promise<Admission> {
    if (
      this.state !== 'ready' ||
      input.binding.adapterId !== this.profile.id ||
      input.binding.chatId !== this.profile.threadId
    )
      return { state: 'failed', error: 'The saved Codex chat is unavailable' };
    if (this.controller.signal.aborted || (input.isCurrent && !input.isCurrent()))
      return { state: 'revoked' };
    let submitting = false;
    try {
      return await this.run(async (call, shared) => {
        const thread = await this.verifyThread(call);
        const threadId = thread.id;
        let activeTurn: string | undefined;
        if (shared && thread.state === 'active' && !input.systemEvent) {
          const { data } = await call('thread/turns/list', {
            threadId,
            limit: 1,
            sortDirection: 'desc',
          });
          const turn = Array.isArray(data) ? data[0] : undefined;
          if (turn?.status === 'inProgress' && typeof turn.id === 'string' && turn.id)
            activeTurn = turn.id;
        }
        if (this.controller.signal.aborted || (input.isCurrent && !input.isCurrent()))
          return { state: 'revoked' };
        const text = agentMessageText(input);
        if (input.systemEvent) {
          submitting = true;
          await this.enqueue(call, threadId, text);
          return { state: 'offered' };
        }
        if (!input.deliveryAttempt || !input.beforeRelease)
          return { state: 'failed', error: 'The native delivery attempt is unavailable' };
        const messageId = input.deliveryAttempt.id;
        input.beforeRelease(text, { messageId, runtime: codexQueueWitness, session: threadId });
        submitting = true;
        if (activeTurn) {
          try {
            const result = await call('turn/steer', {
              threadId,
              expectedTurnId: activeTurn,
              clientUserMessageId: messageId,
              input: [{ type: 'text', text, text_elements: [] }],
            });
            if (result.turnId !== activeTurn)
              throw new Error('Codex did not confirm the active turn');
            return { state: 'queued' };
          } catch (error) {
            // Only the host's explicit precondition failure proves that Steer did not admit the body.
            if (
              !(error instanceof CodexRpcRejection) ||
              !error.expiredTurn(activeTurn) ||
              this.controller.signal.aborted ||
              (input.isCurrent && !input.isCurrent())
            )
              throw error;
          }
        }
        await this.enqueue(call, threadId, text, messageId);
        return { state: 'queued' };
      });
    } catch {
      return {
        state: submitting ? 'uncertain' : 'failed',
        error: submitting
          ? 'Codex did not confirm the queued message'
          : 'The saved Codex chat is unavailable',
      };
    }
  }

  async stop(): Promise<void> {
    this.controller.abort();
    clearTimeout(this.projectionTimer);
    this.watcher?.close();
    this.watcher = undefined;
    this.projections.clear();
    await Promise.allSettled([...this.jobs]);
  }
}

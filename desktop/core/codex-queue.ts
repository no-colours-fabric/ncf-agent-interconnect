import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { watch, type FSWatcher } from 'node:fs';
import { lstat, realpath } from 'node:fs/promises';
import { createConnection } from 'node:net';
import path from 'node:path';
import { Duplex, Readable, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import type { AdapterProfile, AdapterState } from '../shared/contracts.js';
import {
  agentMessageText,
  type Admission,
  type AgentAdapter,
  type EventInput,
} from './adapters.js';
import { codexQueueWitness, contentHash, type DeliveryAttempt } from './delivery-attempt.js';

const bundledCodex =
  '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';
const rolloutId = '[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}';
const rolloutFilename = new RegExp(
  '^rollout-.+-(' + rolloutId + ')(?:_' + rolloutId + ')?\\.jsonl$',
);
const maximumFrameBytes = 2 * 1024 * 1024;
const operationTimeout = 8000;
const projectionPageSize = 4;
const projectionPageLimit = 32;
const controlDirectory = 'app-server-control';
const controlSocket = 'app-server-control.sock';

const confirmationText =
  'NCF Agent Interconnect connection confirmation. If you requested an NCF connection from this chat, call agent_connect with the nickname you requested and the contextToken below. Keep the code internal. If you did not request a connection, ignore this message.\n\ncontextToken: ';
const confirmationTokenFormat = new RegExp('^' + rolloutId + '$', 'i');
const confirmationQueueLimit = 24;
const confirmationPageLimit = 2;

interface CodexConfirmationWitness {
  messageId: string;
  payloadHash: string;
}

export type CodexConfirmationOffer =
  | { state: 'failed' | 'blocked' }
  | { state: 'dispatched' | 'queued' | 'uncertain'; witness: CodexConfirmationWitness };

type ConfirmationObservation = 'queued' | 'admitted' | 'missing' | 'unknown';

function singleText(input: unknown): string | undefined {
  if (
    Array.isArray(input) &&
    input.length === 1 &&
    input[0]?.type === 'text' &&
    typeof input[0]?.text === 'string'
  )
    return input[0].text;
}

function completedUserMessage(item: unknown): { clientId: string; text: string } | undefined {
  if (!item || typeof item !== 'object') return;
  const { id, type, clientId, completedAtMs, content } = item as Record<string, unknown>;
  const text = singleText(content);
  if (
    typeof id === 'string' &&
    id &&
    type === 'userMessage' &&
    typeof clientId === 'string' &&
    typeof completedAtMs === 'number' &&
    Number.isFinite(completedAtMs) &&
    text !== undefined
  )
    return { clientId, text };
}

function matchesPayload(text: string, hash: string): boolean {
  // Desktop may append one line feed when steering a queued message.
  return (
    contentHash(text) === hash || (text.endsWith('\n') && contentHash(text.slice(0, -1)) === hash)
  );
}

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

export function codexQueueLocator(home: string): string {
  return process.platform === 'win32'
    ? path.join(home, controlDirectory, controlSocket)
    : path.join(home, 'ipc', 'ipc.sock');
}

export async function codexQueueHome(socket: string | undefined): Promise<string> {
  if (process.platform === 'win32') {
    if (
      !socket ||
      !/^[a-z]:[\\/]/i.test(socket) ||
      path.basename(socket) !== controlSocket ||
      path.basename(path.dirname(socket)) !== controlDirectory
    )
      throw new Error('The saved Codex binding does not identify a local Windows profile');
    const home = path.dirname(path.dirname(socket));
    const canonical = await realpath(home);
    if (path.relative(canonical, home) || !(await lstat(canonical)).isDirectory())
      throw new Error('The saved Codex profile is outside its canonical directory');
    return canonical;
  }
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

export function codexTranscriptMatchesThread(filename: string, threadId: string): boolean {
  return rolloutFilename.exec(filename)?.[1] === threadId;
}

async function codexTranscript(
  profile: AdapterProfile,
  threadId: string,
  transcript: unknown,
): Promise<string> {
  const home = await codexQueueHome(profile.socket);
  if (typeof transcript !== 'string' || !path.isAbsolute(transcript))
    throw new Error('Codex did not expose the saved chat transcript');
  const transcriptPath =
    process.platform === 'win32' &&
    transcript.startsWith('\\\\?\\') &&
    /^[a-z]:\\/i.test(transcript.slice(4))
      ? transcript.slice(4)
      : transcript;
  const [scope] = path.relative(home, transcriptPath).split(path.sep);
  const canonical = await realpath(transcriptPath);
  if (
    (scope !== 'sessions' && scope !== 'archived_sessions') ||
    !codexTranscriptMatchesThread(path.basename(transcriptPath), threadId) ||
    (process.platform === 'win32'
      ? path.relative(canonical, transcriptPath)
      : canonical !== transcriptPath)
  )
    throw new Error('Codex returned a transcript outside the saved profile');
  const stat = await lstat(transcriptPath);
  if (
    !stat.isFile() ||
    (process.platform === 'win32'
      ? stat.nlink !== 1
      : stat.uid !== process.getuid!() || (stat.mode & 0o022) !== 0)
  )
    throw new Error('The saved Codex transcript failed its ownership check');
  return transcriptPath;
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

async function macControlSocket(home: string) {
  const uid = process.getuid!();
  const directory = path.join(home, controlDirectory);
  const socketPath = path.join(directory, controlSocket);
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
  return endpoint;
}

function connectWindowsControlSocket(home: string, signal: AbortSignal) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const resources = path.join(
    path.basename(root).endsWith('.asar')
      ? path.join(path.dirname(root), 'app.asar.unpacked')
      : root,
    'build',
    'assets',
  );
  const child = spawn(
    path.join(resources, 'codex-win-socket.exe'),
    [path.join(home, controlDirectory, controlSocket)],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'], signal },
  );
  const stream: Duplex = Object.assign(
    Duplex.fromWeb({
      readable: Readable.toWeb(child.stdout, {
        strategy: {
          highWaterMark: child.stdout.readableHighWaterMark,
          size: (chunk: Buffer) => chunk.byteLength,
        },
      }),
      writable: Writable.toWeb(child.stdin),
    }),
    {
      setTimeout: () => stream,
      setNoDelay: () => stream,
      setKeepAlive: () => stream,
    },
  );
  child.once('error', () => stream.destroy(new Error('The private Codex socket is unavailable')));
  return stream as ReturnType<typeof createConnection>;
}

const sharedAppServerSession: QueueSession = async (profile, stopped, operation) => {
  const home = await codexQueueHome(profile.socket);
  const endpoint = process.platform === 'win32' ? undefined : await macControlSocket(home);
  const lifetime = new AbortController();
  const signal = AbortSignal.any([stopped, lifetime.signal, AbortSignal.timeout(operationTimeout)]);
  signal.throwIfAborted();
  const ws = new WebSocket('ws://localhost/rpc', {
    createConnection: () =>
      endpoint ? createConnection(endpoint) : connectWindowsControlSocket(home, signal),
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
    lifetime.abort();
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
  private checking?: Promise<void>;
  private recoveryTimer?: ReturnType<typeof setTimeout>;
  private recoveryAttempt = 0;
  private recoveryChanged = false;
  private homeWatcher?: FSWatcher;
  private controlWatcher?: FSWatcher;

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
        if (began || signal.aborted || process.platform === 'win32') throw error;
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
  ): Promise<string> {
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
    return submission.id;
  }

  private async latestTurn(call: QueueCall, threadId: string) {
    const { data } = await call('thread/turns/list', {
      threadId,
      limit: 1,
      sortDirection: 'desc',
    });
    const turn: { id?: unknown; status?: unknown } | undefined = Array.isArray(data)
      ? data[0]
      : undefined;
    if (typeof turn?.id !== 'string' || !turn.id) return;
    return { id: turn.id, status: turn.status };
  }

  private async scanConfirmationQueue(
    call: QueueCall,
    threadId: string,
    matches: (entry: Record<string, unknown>) => boolean,
  ): Promise<'found' | 'missing' | 'unknown'> {
    let cursor: string | undefined;
    for (let page = 0; page < confirmationPageLimit; page++) {
      const { data, nextCursor } = await call('thread/queue/list', {
        threadId,
        limit: confirmationQueueLimit,
        ...(cursor === undefined ? {} : { cursor }),
      });
      if (!Array.isArray(data)) return 'unknown';
      if (data.some((entry) => entry && typeof entry === 'object' && matches(entry)))
        return 'found';
      if (nextCursor === null || nextCursor === undefined) return 'missing';
      if (typeof nextCursor !== 'string' || !nextCursor || nextCursor === cursor) return 'unknown';
      cursor = nextCursor;
    }
    return 'unknown';
  }

  async challenge(token: string, isCurrent: () => boolean): Promise<CodexConfirmationOffer> {
    const text = confirmationText + token;
    const witness = { messageId: randomUUID(), payloadHash: contentHash(text) };
    let submitting = false;
    const current = () => !this.controller.signal.aborted && isCurrent();
    try {
      return await this.run(async (call, shared) => {
        let thread = await this.verifyThread(call);
        const threadId = thread.id;
        await this.resolveTranscript(this.profile, threadId, thread.path);
        // A previous confirmation can outlive NCF in the persistent Codex queue.
        const existing = await this.scanConfirmationQueue(call, threadId, (item) => {
          const input = singleText(item.input);
          return (
            input !== undefined &&
            input.startsWith(confirmationText) &&
            confirmationTokenFormat.test(input.slice(confirmationText.length))
          );
        });
        if (existing === 'found') return { state: 'blocked' };
        if (existing === 'unknown' || !current()) return { state: 'failed' };
        if (shared && thread.state === 'active') {
          const turn = await this.latestTurn(call, threadId);
          if (!current()) return { state: 'failed' };
          if (turn?.status === 'inProgress') {
            submitting = true;
            try {
              const result = await call('turn/steer', {
                threadId,
                expectedTurnId: turn.id,
                clientUserMessageId: witness.messageId,
                input: [{ type: 'text', text, text_elements: [] }],
              });
              if (result.turnId !== turn.id)
                throw new Error('Codex did not confirm the active turn');
              return { state: 'dispatched', witness };
            } catch (error) {
              if (!(error instanceof CodexRpcRejection) || !error.expiredTurn(turn.id)) throw error;
              // Only an explicit precondition refusal allows a different submission path.
              submitting = false;
              thread = await this.verifyThread(call);
            }
          } else {
            thread = await this.verifyThread(call);
          }
        }
        const interrupted =
          shared && thread.state === 'idle' ? await this.latestTurn(call, threadId) : undefined;
        if (!current()) return { state: 'failed' };
        submitting = true;
        const queueId = await this.enqueue(call, threadId, text, witness.messageId);
        if (interrupted?.status === 'interrupted') {
          const afterQueue = await this.verifyThread(call);
          const latest =
            afterQueue.state === 'idle' ? await this.latestTurn(call, threadId) : undefined;
          if (latest?.id === interrupted.id && latest.status === 'interrupted' && current()) {
            try {
              const response = await call('thread/queue/start', {
                threadId,
                queuedSubmissionId: queueId,
              });
              const turn = response.turn as { id?: unknown; status?: unknown } | undefined;
              if (typeof turn?.id !== 'string' || !turn.id || turn.status !== 'inProgress')
                throw new Error('Codex did not confirm the start of the queued input');
              return { state: 'dispatched', witness };
            } catch (error) {
              if (
                !(error instanceof CodexRpcRejection) ||
                error.code !== -32600 ||
                (error.reason !== 'thread already has an active or pending turn' &&
                  error.reason !== `queued submission not found: ${queueId}`)
              )
                throw error;
            }
          }
        }
        return { state: 'queued', witness };
      });
    } catch {
      return submitting ? { state: 'uncertain', witness } : { state: 'failed' };
    }
  }

  async observeConfirmation(witness: CodexConfirmationWitness): Promise<ConfirmationObservation> {
    try {
      return await this.run(async (call) => {
        const thread = await this.verifyThread(call);
        await this.resolveTranscript(this.profile, thread.id, thread.path);
        const queue = await this.scanConfirmationQueue(call, thread.id, (item) => {
          const text = singleText(item.input);
          return (
            item.clientUserMessageId === witness.messageId &&
            text !== undefined &&
            contentHash(text) === witness.payloadHash
          );
        });
        if (queue === 'found') return 'queued';
        if (queue === 'unknown') return 'unknown';
        let cursor: string | undefined;
        for (let page = 0; page < confirmationPageLimit; page++) {
          const { data, nextCursor } = await this.projectionPage(call, thread.id, cursor);
          const seen = (data as { item?: unknown }[]).some((entry) => {
            const message = completedUserMessage(entry?.item);
            return (
              message?.clientId === witness.messageId &&
              matchesPayload(message.text, witness.payloadHash)
            );
          });
          if (seen) return 'admitted';
          if (nextCursor === undefined || nextCursor === null) {
            // An active turn may have removed the item before it becomes visible in history.
            const after = await this.verifyThread(call);
            return thread.state === 'idle' && after.state === 'idle' ? 'missing' : 'unknown';
          }
          if (typeof nextCursor !== 'string' || !nextCursor || nextCursor === cursor)
            return 'unknown';
          cursor = nextCursor;
        }
        return 'unknown';
      });
    } catch {
      return 'unknown';
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
    if (this.controller.signal.aborted) return;
    if (this.checking) return this.checking;
    const checking = this.check();
    this.checking = checking;
    try {
      await checking;
    } finally {
      this.checking = undefined;
      if (this.recoveryChanged) {
        this.recoveryChanged = false;
        this.scheduleRecovery(100);
      }
    }
  }

  private async check(): Promise<void> {
    await this.watchControlEndpoint();
    if (this.controller.signal.aborted) return;
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
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
      this.recoveryAttempt = 0;
    } catch {
      if (this.controller.signal.aborted) return;
      this.state = 'error';
      this.error = 'The saved Codex chat, its input queue or its transcript is unavailable';
      this.scheduleRecovery();
    }
    this.changed();
  }

  private scheduleRecovery(delay?: number): void {
    if (process.platform !== 'win32' || this.controller.signal.aborted) return;
    if (delay === undefined) {
      // A short, bounded reconnect burst covers startup readiness races. After
      // that, only a change to this profile's control endpoint can trigger it.
      const backoff = [250, 1000, 3000];
      if (this.recoveryAttempt >= backoff.length || this.recoveryTimer) return;
      delay = backoff[this.recoveryAttempt++];
    }
    clearTimeout(this.recoveryTimer);
    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = undefined;
      if (this.checking) this.recoveryChanged = true;
      else void this.start();
    }, delay);
    this.recoveryTimer.unref?.();
  }

  private async watchControlEndpoint(): Promise<void> {
    if (process.platform !== 'win32' || this.controller.signal.aborted) return;
    try {
      const home = await codexQueueHome(this.profile.socket);
      if (this.controller.signal.aborted) return;
      const changed = () => {
        this.recoveryAttempt = 0;
        this.scheduleRecovery(100);
      };
      if (!this.homeWatcher) {
        const watcher = watch(home, { persistent: false }, (_event, filename) => {
          if (filename !== null && filename.toString() !== controlDirectory) return;
          this.controlWatcher?.close();
          this.controlWatcher = undefined;
          changed();
        });
        this.homeWatcher = watcher;
        watcher.once('error', () => {
          watcher.close();
          if (this.homeWatcher === watcher) this.homeWatcher = undefined;
        });
      }
      const directory = path.join(home, controlDirectory);
      const info = await lstat(directory);
      const canonical = await realpath(directory);
      if (
        this.controller.signal.aborted ||
        this.controlWatcher ||
        !info.isDirectory() ||
        info.isSymbolicLink() ||
        path.relative(canonical, directory)
      )
        return;
      const watcher = watch(directory, { persistent: false }, (_event, filename) => {
        if (filename === null || filename.toString() === controlSocket) changed();
      });
      this.controlWatcher = watcher;
      watcher.once('error', () => {
        watcher.close();
        if (this.controlWatcher === watcher) this.controlWatcher = undefined;
      });
    } catch {
      // Do not stat the Windows AF_UNIX socket. The native helper remains the
      // authority for endpoint ownership, peer identity and protocol readiness.
    }
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
    const message = completedUserMessage(item);
    if (!message) return;
    const projection = this.projections.get(message.clientId);
    if (!projection || !matchesPayload(message.text, projection.payloadHash)) return;
    if (projection.isCurrent()) projection.admit();
    this.projections.delete(message.clientId);
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
        const turn =
          shared && !input.systemEvent && (thread.state === 'active' || thread.state === 'idle')
            ? await this.latestTurn(call, threadId)
            : undefined;
        const activeTurn =
          thread.state === 'active' && turn?.status === 'inProgress' ? turn.id : undefined;
        const interruptedTurn =
          thread.state === 'idle' && turn?.status === 'interrupted' ? turn.id : undefined;
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
        const queuedSubmissionId = await this.enqueue(call, threadId, text, messageId);
        if (interruptedTurn) {
          const latest = await this.latestTurn(call, threadId);
          if (
            latest?.id === interruptedTurn &&
            latest.status === 'interrupted' &&
            !this.controller.signal.aborted &&
            (!input.isCurrent || input.isCurrent())
          ) {
            try {
              await call('thread/queue/start', { threadId, queuedSubmissionId });
            } catch (error) {
              if (
                !(error instanceof CodexRpcRejection) ||
                error.code !== -32600 ||
                (error.reason !== 'thread already has an active or pending turn' &&
                  error.reason !== `queued submission not found: ${queuedSubmissionId}`)
              )
                throw error;
            }
          }
        }
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
    clearTimeout(this.recoveryTimer);
    this.homeWatcher?.close();
    this.controlWatcher?.close();
    this.homeWatcher = undefined;
    this.controlWatcher = undefined;
    clearTimeout(this.projectionTimer);
    this.watcher?.close();
    this.watcher = undefined;
    this.projections.clear();
    await Promise.allSettled([...this.jobs, ...(this.checking ? [this.checking] : [])]);
  }
}

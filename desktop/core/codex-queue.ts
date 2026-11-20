import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import type { AdapterProfile, AdapterState } from '../shared/contracts.js';
import {
  agentMessageText,
  type Admission,
  type AgentAdapter,
  type EventInput,
} from './adapters.js';

const bundledCodex =
  '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';
const maximumFrameBytes = 2 * 1024 * 1024;
const operationTimeout = 8000;
const wakeText =
  'NCF Agent Interconnect has incoming messages for this chat. Use agent_read with this chat’s existing NCF connection to receive unread messages. Continue reading if there are more messages.';

type QueueCall = (method: string, params: object) => Promise<Record<string, unknown>>;
type QueueSession = <T>(
  profile: AdapterProfile,
  signal: AbortSignal,
  operation: (call: QueueCall) => Promise<T>,
) => Promise<T>;

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
    const info = await lstat(entry);
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
  let buffer = Buffer.alloc(0);
  let pending: ((reply: Record<string, unknown>) => void) | undefined;
  child.stdout.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    let next: number;
    while ((next = buffer.indexOf(10)) !== -1) {
      const frame = buffer.subarray(0, next);
      buffer = buffer.subarray(next + 1);
      try {
        if (frame.length > maximumFrameBytes) throw new Error();
        const reply = JSON.parse(frame.toString('utf8')) as Record<string, unknown>;
        if (reply && typeof reply === 'object') pending?.(reply);
      } catch {
        disconnected();
        return;
      }
    }
    if (buffer.length > maximumFrameBytes) disconnected();
  });

  let requestId = 0;
  const call: QueueCall = (method, params) =>
    new Promise((resolve, reject) => {
      signal.throwIfAborted();
      const id = ++requestId;
      const abort = () => reject(new Error('Codex app-server did not confirm the queue request'));
      signal.addEventListener('abort', abort, { once: true });
      pending = (reply) => {
        if (reply.id !== id) return;
        signal.removeEventListener('abort', abort);
        pending = undefined;
        if (reply.error || !reply.result || typeof reply.result !== 'object')
          reject(new Error('Codex app-server rejected the queue request'));
        else resolve(reply.result as Record<string, unknown>);
      };
      child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  try {
    await call('initialize', {
      clientInfo: { name: 'ncf_agent_interconnect', title: 'NCF Agent Interconnect', version: '1' },
      capabilities: { experimentalApi: true },
    });
    child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    return await operation(call);
  } finally {
    // Abort only the app-server child created for this operation.
    lifetime.abort();
    const force = setTimeout(() => child.kill('SIGKILL'), 1000);
    await closed;
    clearTimeout(force);
  }
};

export class CodexQueueAdapter implements AgentAdapter {
  readonly wakeOnly = true;
  private readonly controller = new AbortController();
  private readonly jobs = new Set<Promise<unknown>>();
  private state: AdapterState['state'] = 'checking';
  private error: string | null = null;
  private offer?: { connectionId: string; through: number };

  constructor(
    readonly profile: AdapterProfile,
    private readonly changed: () => void,
    private readonly session: QueueSession = appServerSession,
  ) {}

  status(): AdapterState {
    return {
      id: this.profile.id,
      label: this.profile.label,
      kind: 'codex-desktop',
      capabilities: {
        wakeIdle: this.state === 'ready',
        receiveActive: false,
        nativeDisplay: false,
        exactSession: this.state === 'ready',
      },
      state: this.state,
      error: this.error,
    };
  }

  private run<T>(operation: (call: QueueCall) => Promise<T>): Promise<T> {
    const job = this.session(this.profile, this.controller.signal, operation);
    this.jobs.add(job);
    return job.finally(() => this.jobs.delete(job));
  }

  private async verifyThread(call: QueueCall): Promise<string> {
    const threadId = this.profile.threadId;
    if (!threadId) throw new Error('The saved Codex chat is missing');
    const result = await call('thread/read', { threadId, includeTurns: false });
    const thread = result.thread as { id?: unknown; ephemeral?: unknown } | undefined;
    if (thread?.id !== threadId || thread.ephemeral !== false)
      throw new Error('Codex did not confirm the saved chat in this profile');
    return threadId;
  }

  async start(): Promise<void> {
    try {
      await this.run(async (call) => {
        const threadId = await this.verifyThread(call);
        const response = await call('thread/queue/list', { threadId, limit: 1 });
        if (!Array.isArray(response.data)) throw new Error('Codex did not confirm queue support');
      });
      if (this.controller.signal.aborted) return;
      this.state = 'ready';
      this.error = null;
    } catch {
      if (this.controller.signal.aborted) return;
      this.state = 'error';
      this.error = 'The saved Codex chat or its input queue is unavailable';
    }
    this.changed();
  }

  // The offer is persisted by NCF. Do not enqueue a second wake on a restart.
  offerCurrent(): boolean {
    return true;
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
    const sequence = 'sequence' in input ? input.sequence : undefined;
    const backlog = 'backlogUntil' in input ? input.backlogUntil : undefined;
    const connectionId = input.binding.connectionId;
    if (
      sequence !== undefined &&
      this.offer?.connectionId === connectionId &&
      sequence <= this.offer.through
    )
      return { state: 'offered' };
    let submitting = false;
    try {
      return await this.run(async (call) => {
        const threadId = await this.verifyThread(call);
        if (this.controller.signal.aborted || (input.isCurrent && !input.isCurrent()))
          return { state: 'revoked' };
        const clientUserMessageId = randomUUID();
        // This is only a wake signal. The exact NCF connection reads the content.
        submitting = true;
        const response = await call('thread/queue/add', {
          threadId,
          clientUserMessageId,
          input: [
            {
              type: 'text',
              text: input.systemEvent ? agentMessageText(input) : wakeText,
              text_elements: [],
            },
          ],
        });
        const submission = response.queuedSubmission as
          { id?: unknown; clientUserMessageId?: unknown } | undefined;
        if (
          typeof submission?.id !== 'string' ||
          submission.clientUserMessageId !== clientUserMessageId
        )
          throw new Error('Codex did not confirm the wake signal');
        const through = backlog ?? sequence;
        if (through !== undefined) this.offer = { connectionId, through };
        return { state: 'offered' };
      });
    } catch {
      return {
        state: submitting ? 'uncertain' : 'failed',
        error: submitting
          ? 'Codex did not confirm the wake signal'
          : 'The saved Codex chat is unavailable',
      };
    }
  }

  async stop(): Promise<void> {
    this.controller.abort();
    await Promise.allSettled([...this.jobs]);
  }
}

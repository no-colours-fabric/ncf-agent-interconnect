import net from 'node:net';
import { existsSync, lstatSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import type { AdapterProfile, AdapterState } from '../shared/contracts.js';
import {
  agentMessageText,
  type Admission,
  type AgentAdapter,
  type EventInput,
} from './adapters.js';

// Version-dependent local desktop IPC, deliberately separate from the public
// Codex app-server protocol. Never launch a router or read an account's tokens.
export function codexEndpoints(): string[] {
  if (process.platform === 'win32') return ['\\\\.\\pipe\\codex-ipc'];
  const homes = new Set(
    [process.env.CODEX_HOME, path.join(os.homedir(), '.codex')].filter((v): v is string => !!v),
  );
  for (const name of readdirSync(os.homedir()))
    if (name.startsWith('.codex')) homes.add(path.join(os.homedir(), name));
  return [...homes]
    .map((home) => path.join(home, 'ipc', 'ipc.sock'))
    .filter((socket) => existsSync(socket));
}
export function codexEndpoint(explicit?: string): string {
  if (explicit) return explicit;
  if (process.platform === 'win32') return '\\\\.\\pipe\\codex-ipc';
  if (process.env.CODEX_HOME) return path.join(process.env.CODEX_HOME, 'ipc', 'ipc.sock');
  const sockets = codexEndpoints();
  if (sockets.length > 1)
    throw new Error('The integration must identify the owner of the current Codex chat');
  return sockets[0] ?? path.join(os.homedir(), '.codex', 'ipc', 'ipc.sock');
}

export async function discoverCodex(
  threadId: string,
  endpoints = codexEndpoints(),
): Promise<string> {
  const results = await Promise.all(
    [...new Set(endpoints)].slice(0, 32).map(async (socket) => {
      try {
        return (
          await codexExchange({
            id: randomUUID(),
            label: 'Codex',
            kind: 'codex-desktop',
            threadId,
            socket,
          })
        ).state === 'admitted'
          ? socket
          : null;
      } catch {
        return null;
      }
    }),
  );
  const owners = results.filter((value): value is string => !!value);
  if (owners.length !== 1)
    throw new Error(
      owners.length
        ? 'Multiple Codex instances claimed the same chat. Automatic routing is ambiguous.'
        : 'The current chat is unavailable through the Codex Desktop integration. Messages are saved; this client version has not confirmed chat delivery.',
    );
  return owners[0];
}

interface Wire {
  type: string;
  requestId?: string;
  method?: string;
  sourceClientId?: string;
  version?: number;
  resultType?: string;
  handledByClientId?: string;
  error?: unknown;
  result?: { clientId?: string; supportsUntrustedAppInput?: boolean };
  params?: {
    conversationId?: string;
    hostId?: string;
    change?: {
      type?: string;
      conversationState?: { threadRuntimeStatus?: { type?: string } };
      patches?: { path?: unknown[]; value?: unknown }[];
    };
  };
}

// Exact-chat snapshots can exceed the former 32 MiB ceiling. Keep a fixed
// allocation bound for the same-user local socket instead of accepting an
// untrusted length prefix without a limit.
export const CODEX_IPC_MAX_FRAME_BYTES = 128 * 1024 * 1024;

export async function codexExchange(
  profile: AdapterProfile,
  input?: EventInput,
  signal?: AbortSignal,
  timeoutMs = 5000,
  onVerified?: () => void,
): Promise<Admission> {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(profile.threadId ?? ''))
    throw new Error('An exact Codex chat UUID is required');
  const endpoint = codexEndpoint(profile.socket),
    threadId = profile.threadId!;
  if (process.platform === 'win32') {
    if (!endpoint.startsWith('\\\\.\\pipe\\'))
      throw new Error('Codex IPC must use a local named pipe');
  } else {
    if (!path.isAbsolute(endpoint))
      throw new Error('Provide an absolute path to the local Codex socket');
    const entry = lstatSync(endpoint),
      directory = lstatSync(path.dirname(endpoint));
    if (
      !entry.isSocket() ||
      entry.uid !== process.getuid!() ||
      !directory.isDirectory() ||
      directory.uid !== process.getuid!() ||
      directory.mode & 0o022
    )
      throw new Error('The local Codex socket ownership check failed');
  }
  return new Promise<Admission>((resolve) => {
    let settled = false,
      submitted = false,
      following = false,
      clientId = 'initializing-client',
      owner = '';
    const header = Buffer.allocUnsafe(4);
    let headerBytes = 0,
      frame: Buffer<ArrayBufferLike> | undefined,
      frameBytes = 0,
      timer: NodeJS.Timeout;
    const initializeId = randomUUID(),
      discoverId = randomUUID(),
      admissionId = randomUUID();
    const connection = net.createConnection(endpoint);
    const write = (message: object): void => {
      const bytes = Buffer.from(JSON.stringify(message)),
        frame = Buffer.alloc(bytes.length + 4);
      frame.writeUInt32LE(bytes.length);
      bytes.copy(frame, 4);
      connection.write(frame);
    };
    const broadcast = (value: boolean): void =>
      write({
        type: 'broadcast',
        sourceClientId: clientId,
        targetClientIds: [owner],
        method: 'thread-stream-following-changed',
        version: 1,
        params: { hostId: 'local', conversationId: threadId, following: value },
      });
    const finish = (state: Admission['state'], error?: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      headerBytes = 0;
      frame = undefined;
      frameBytes = 0;
      signal?.removeEventListener('abort', abort);
      if (following && connection.writable) broadcast(false);
      connection.end();
      connection.destroy();
      resolve({ state, ...(error ? { error } : {}) });
    };
    const fail = (reason: string): void => finish(submitted ? 'uncertain' : 'failed', reason);
    const abort = (): void => fail('The Codex connection stopped before confirming receipt');
    const arm = (): void => {
      clearTimeout(timer);
      timer = setTimeout(() => fail('Codex IPC: request timed out'), timeoutMs);
    };
    const request = (
      method: string,
      requestId: string,
      version: number,
      params: object,
      targetClientId?: string,
    ): void => {
      arm();
      write({
        type: 'request',
        sourceClientId: clientId,
        targetClientId,
        method,
        requestId,
        version,
        params,
        timeoutMs,
      });
    };
    const submit = (runtime: unknown): void => {
      if (!input || settled || submitted || !['idle', 'active'].includes(String(runtime))) return;
      if (input.isCurrent && !input.isCurrent()) {
        finish('revoked');
        return;
      }
      const text = agentMessageText(input);
      submitted = true;
      if (runtime === 'active') {
        const clientUserMessageId = randomUUID();
        request(
          'thread-follower-steer-turn',
          admissionId,
          1,
          {
            conversationId: threadId,
            input: [{ type: 'text', text, text_elements: [] }],
            clientUserMessageId,
            attachments: [],
            restoreMessage: {
              id: clientUserMessageId,
              text,
              createdAt: Date.now(),
              context: {
                prompt: text,
                addedFiles: [],
                fileAttachments: [],
                imageAttachments: [],
                ideContext: null,
              },
            },
          },
          owner,
        );
        return;
      }
      request(
        'thread-follower-start-turn',
        admissionId,
        2,
        {
          conversationId: threadId,
          turnStart: {
            request: { threadId, input: [{ type: 'text', text, text_elements: [] }] },
            context: { inheritThreadSettings: true },
          },
        },
        owner,
      );
    };
    const receive = (message: Wire): void => {
      if (message.type === 'client-discovery-request') {
        write({
          type: 'client-discovery-response',
          requestId: message.requestId,
          response: { canHandle: false },
        });
        return;
      }
      if (message.type === 'request') {
        write({
          type: 'response',
          requestId: message.requestId,
          resultType: 'error',
          error: 'no-handler-for-request',
        });
        return;
      }
      if (message.type === 'response' && message.requestId === initializeId) {
        if (message.resultType !== 'success' || typeof message.result?.clientId !== 'string') {
          fail('Codex rejected IPC initialization');
          return;
        }
        clientId = message.result.clientId;
        request('thread-owner-discovery', discoverId, 1, {
          hostId: 'local',
          conversationId: threadId,
        });
        return;
      }
      if (message.type === 'response' && message.requestId === discoverId) {
        if (message.resultType !== 'success') {
          fail('Codex owner discovery failed for this exact chat');
          return;
        }
        if (typeof message.handledByClientId !== 'string' || !message.handledByClientId.trim()) {
          fail('Codex did not identify a handler for this exact chat');
          return;
        }
        if (message.result?.supportsUntrustedAppInput !== true) {
          fail(
            message.result?.supportsUntrustedAppInput === false
              ? 'The handler for this Codex chat does not support external input'
              : 'The handler for this Codex chat did not confirm external input support',
          );
          return;
        }
        // Exact-owner proof validated: record the historical evidence before
        // any external submission. This is an observation, not a receipt.
        onVerified?.();
        if (!input) {
          finish('admitted');
          return;
        }
        owner = message.handledByClientId;
        following = true;
        broadcast(true);
        arm();
        return;
      }
      if (
        message.type === 'broadcast' &&
        message.sourceClientId === owner &&
        message.method === 'thread-stream-state-changed' &&
        message.version === 11 &&
        message.params?.conversationId === threadId &&
        message.params.hostId === 'local'
      ) {
        const change = message.params.change;
        if (change?.type === 'snapshot')
          submit(change.conversationState?.threadRuntimeStatus?.type);
        if (change?.type === 'patches' && Array.isArray(change.patches))
          for (const patch of change.patches) {
            if (
              patch.path?.length === 1 &&
              patch.path[0] === 'threadRuntimeStatus' &&
              typeof patch.value === 'object' &&
              patch.value !== null &&
              'type' in patch.value
            )
              submit(patch.value.type);
            if (
              patch.path?.length === 2 &&
              patch.path[0] === 'threadRuntimeStatus' &&
              patch.path[1] === 'type'
            )
              submit(patch.value);
          }
      }
      if (message.type === 'response' && message.requestId === admissionId) {
        if (message.resultType === 'success') finish('admitted');
        else fail('Codex did not confirm message receipt: ' + String(message.error).slice(0, 160));
      }
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    arm();
    connection.once('connect', () =>
      request('initialize', initializeId, 0, {
        clientType: input
          ? 'ncf-agent-interconnect-event-adapter'
          : 'ncf-agent-interconnect-readonly-probe',
      }),
    );
    connection.on('data', (data) => {
      if (settled) return;
      const chunk = typeof data === 'string' ? Buffer.from(data) : data;
      let offset = 0;
      while (!settled && offset < chunk.length) {
        if (!frame) {
          const copied = chunk.copy(header, headerBytes, offset, offset + (4 - headerBytes));
          headerBytes += copied;
          offset += copied;
          if (headerBytes < 4) continue;
          const length = header.readUInt32LE(0);
          headerBytes = 0;
          if (!length || length > CODEX_IPC_MAX_FRAME_BYTES) {
            fail('Invalid Codex IPC frame');
            return;
          }
          frame = Buffer.allocUnsafe(length);
          frameBytes = 0;
        }
        const copied = chunk.copy(frame, frameBytes, offset, offset + (frame.length - frameBytes));
        frameBytes += copied;
        offset += copied;
        if (frameBytes < frame.length) continue;
        const bytes = frame;
        frame = undefined;
        frameBytes = 0;
        try {
          const value: unknown = JSON.parse(bytes.toString('utf8'));
          if (!value || typeof value !== 'object' || !('type' in value)) throw new Error();
          receive(value as Wire);
        } catch {
          fail('Invalid Codex IPC message');
          return;
        }
      }
    });
    connection.on('error', (e: NodeJS.ErrnoException) =>
      fail('Codex IPC: ' + (e.code ?? 'connection-error')),
    );
    connection.on('close', () => fail('The Codex IPC connection was closed'));
  });
}

export class CodexDesktopAdapter implements AgentAdapter {
  private controller = new AbortController();
  private jobs = new Set<Promise<Admission>>();
  private state: AdapterState;
  private retry?: NodeJS.Timeout;
  private stopped = false;
  private starting?: Promise<void>;
  private generation = 0;
  private exchangeSeq = 0;
  private currentRevision = 0;
  constructor(
    readonly profile: AdapterProfile,
    readonly changed: () => void,
  ) {
    this.state = {
      id: profile.id,
      label: profile.label,
      kind: 'codex-desktop',
      state: 'checking',
      error: null,
      capabilities: {
        wakeIdle: false,
        receiveActive: false,
        nativeDisplay: false,
        exactSession: false,
      },
    };
  }
  status(): AdapterState {
    return { ...this.state, capabilities: { ...this.state.capabilities } };
  }
  private availability(available: boolean): void {
    this.state.capabilities = {
      wakeIdle: available,
      receiveActive: available,
      nativeDisplay: false,
      exactSession: available,
    };
  }
  private recordVerified(revision: number, generation: number): void {
    // Historical exact-owner observation. Only the newest-started exchange of
    // the current lifecycle may publish it; a late older callback cannot
    // overwrite a newer diagnostic or evidence, and nothing applies after stop.
    if (!this.current(revision, generation)) return;
    this.state.lastOwnerVerifiedAt = new Date().toISOString();
  }
  private beginExchange(): { generation: number; revision: number } {
    const revision = ++this.exchangeSeq;
    this.currentRevision = revision;
    return { generation: this.generation, revision };
  }
  private current(revision: number, generation: number): boolean {
    return (
      !this.stopped &&
      !this.controller.signal.aborted &&
      generation === this.generation &&
      revision === this.currentRevision
    );
  }
  private async exchange(input?: EventInput): Promise<{
    result: Admission;
    generation: number;
    revision: number;
  }> {
    const { generation, revision } = this.beginExchange();
    const job = codexExchange(this.profile, input, this.controller.signal, 5000, () =>
      this.recordVerified(revision, generation),
    ).catch((e) => ({
      state: 'failed' as const,
      error: (e as Error).message,
    }));
    this.jobs.add(job);
    try {
      return { result: await job, generation, revision };
    } finally {
      this.jobs.delete(job);
    }
  }
  private reconnect(): void {
    if (!this.controller.signal.aborted && !this.retry) {
      const generation = this.generation,
        revision = this.currentRevision;
      this.retry = setTimeout(() => {
        this.retry = undefined;
        // A failed delivery may overtake an older pending probe. Wait for that
        // coalesced start to settle so this existing recovery attempt is not
        // lost, and retry only if the current lifecycle still needs recovery.
        void (async () => {
          await this.starting;
          if (
            !this.current(revision, generation) ||
            !['error', 'uncertain'].includes(this.state.state)
          )
            return;
          await this.start();
        })();
      }, 3000);
      this.retry.unref();
    }
  }
  start(): Promise<void> {
    if (!this.starting)
      this.starting = (async () => {
        if (this.controller.signal.aborted) return;
        clearTimeout(this.retry);
        this.retry = undefined;
        const { result, generation, revision } = await this.exchange();
        // Only the newest-started exchange of the current lifecycle may change
        // shared health. A late older probe cannot override a newer failure.
        if (!this.current(revision, generation)) return;
        this.state.state = result.state === 'admitted' ? 'ready' : 'error';
        this.state.error = result.error ?? null;
        this.availability(result.state === 'admitted');
        if (result.state !== 'admitted') this.reconnect();
        this.changed();
      })().finally(() => {
        this.starting = undefined;
      });
    return this.starting;
  }
  async deliver(input: EventInput): Promise<Admission> {
    if (this.stopped || this.controller.signal.aborted || this.state.state !== 'ready')
      return { state: 'failed', error: this.state.error ?? 'The Codex adapter is disconnected' };
    const { result, generation, revision } = await this.exchange(input);
    // An admission (even late uncertain) always returns to its caller; only
    // shared health updates are gated on being the newest-started exchange.
    if (
      this.current(revision, generation) &&
      (result.state === 'failed' || result.state === 'uncertain')
    ) {
      this.state.state = result.state === 'uncertain' ? 'uncertain' : 'error';
      this.state.error = result.error ?? null;
      this.availability(false);
      this.changed();
      this.reconnect();
    }
    return result;
  }
  async stop(): Promise<void> {
    this.stopped = true;
    this.generation++;
    clearTimeout(this.retry);
    this.controller.abort();
    await this.starting;
    await Promise.allSettled([...this.jobs]);
  }
}

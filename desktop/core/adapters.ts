import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  AdapterProfile,
  AdapterState,
  Attachment,
  Binding,
  SystemEvent,
} from '../shared/contracts.js';
import { AionUiAdapter } from './aionui-adapter.js';
import type { AionUiSessions } from './aionui-sessions.js';
import { CodexDesktopAdapter } from './codex-adapter.js';

export type Admission = {
  state: 'admitted' | 'waiting' | 'failed' | 'uncertain' | 'revoked';
  error?: string;
};
export interface AgentMessageInput {
  fromNode: string;
  fromNickname: string;
  text: string;
  files: (Attachment & { localPath: string })[];
}
export type EventInput = {
  nickname: string;
  binding: Binding;
  messageId: string;
  isCurrent?: () => boolean;
} & (
  | { message: AgentMessageInput; replyRef: string; systemEvent?: never }
  | { systemEvent: SystemEvent; message?: never }
);
const markdownName = (text: string): string => text.replace(/[\\`*_{}\[\]<>#!|]/g, '\\$&');
export function agentMessageText(input: EventInput): string {
  if (input.systemEvent)
    return input.systemEvent.agentRemoved
      ? `Agent ${markdownName(input.nickname)} and its local MCP history were removed by the user. This connection is disabled.`
      : input.systemEvent.historyCleared
        ? `Agent ${markdownName(input.nickname)} was reset by the user. Its previous MCP history was deleted. This connection is disabled.`
        : `Agent ${markdownName(input.nickname)} was moved to another chat by the user. This connection is disabled.`;
  const { fromNickname, text, files } = input.message;
  const attachments = files.length
    ? '\n\nAttachments:\n' +
      files
        .map((file) => {
          const target = file.localPath
            .replaceAll('\\', '/')
            .replace(/[<>\r\n]/g, (character) => encodeURIComponent(character));
          return `- [${markdownName(file.name)}](<${target}>)`;
        })
        .join('\n')
    : '';
  const sender = markdownName(JSON.stringify(fromNickname));
  return `**Incoming NCF Agent Interconnect**\nFrom: ${sender}\n\n${text}${attachments}\n\nReply-To: ${input.replyRef}\nUse agent_send(connectionId, replyRef="${input.replyRef}", text) to reply.`;
}
// An adapter admits an event to an exact existing session. It does not execute
// arbitrary CLI commands and does not infer permission from peer text.
export interface AgentAdapter {
  status(): AdapterState;
  start(): Promise<void>;
  deliver(input: EventInput): Promise<Admission>;
  stop(): Promise<void>;
}
const capabilities = {
  wakeIdle: false,
  receiveActive: false,
  nativeDisplay: false,
  exactSession: false,
};
class ManualAdapter implements AgentAdapter {
  constructor(readonly profile: AdapterProfile) {}
  status(): AdapterState {
    return {
      id: this.profile.id,
      label: this.profile.label,
      kind: 'manual',
      capabilities,
      state: 'manual',
      error: null,
    };
  }
  async start(): Promise<void> {}
  async deliver(): Promise<Admission> {
    return { state: 'waiting' };
  }
  async stop(): Promise<void> {}
}

type CursorHookResponse = { followup_message?: string };
type CursorWaiter = {
  resolve: (value: CursorHookResponse) => void;
};
type CursorAdmission = {
  id: string;
  isCurrent?: () => boolean;
  resolve: (value: Admission) => void;
  timer: NodeJS.Timeout;
};

/** Event-driven exact-chat delivery through Cursor's native Agent hooks. */
export class CursorHookAdapter implements AgentAdapter {
  private state: AdapterState;
  private waiter?: CursorWaiter;
  private admission?: CursorAdmission;
  private stopped = false;
  constructor(
    readonly profile: AdapterProfile,
    readonly changed: () => void,
    readonly idle: () => void,
  ) {
    this.state = {
      id: profile.id,
      label: profile.label,
      kind: 'cursor-hook',
      capabilities: {
        wakeIdle: true,
        receiveActive: true,
        nativeDisplay: true,
        exactSession: true,
      },
      state: 'checking',
      error: null,
    };
  }
  status(): AdapterState {
    return { ...this.state };
  }
  async start(): Promise<void> {
    if (this.stopped) return;
    this.state.state = 'error';
    this.state.error = 'Send any message in this Cursor chat to restore delivery';
    this.changed();
  }
  activate(): void {
    if (this.stopped) return;
    const changed = this.state.state !== 'ready' || this.state.error !== null;
    this.state.state = 'ready';
    this.state.error = null;
    if (changed) this.changed();
  }
  acknowledge(admissionId?: string): void {
    this.activate();
    if (!admissionId || this.admission?.id !== admissionId) return;
    const admission = this.admission;
    this.admission = undefined;
    clearTimeout(admission.timer);
    admission.resolve(
      admission.isCurrent && !admission.isCurrent() ? { state: 'revoked' } : { state: 'admitted' },
    );
    this.idle();
  }
  wait(status: string | undefined, signal: AbortSignal): Promise<CursorHookResponse> {
    if (status !== 'completed' || this.stopped || signal.aborted) return Promise.resolve({});
    this.activate();
    this.waiter?.resolve({});
    return new Promise<CursorHookResponse>((resolve) => {
      const waiter = { resolve };
      this.waiter = waiter;
      const close = () => {
        if (this.waiter !== waiter) return;
        this.waiter = undefined;
        resolve({});
        if (!this.admission) {
          this.state.state = 'error';
          this.state.error = 'Send any message in this Cursor chat to restore delivery';
          this.changed();
        }
      };
      signal.addEventListener('abort', close, { once: true });
      this.idle();
    });
  }
  end(): void {
    this.waiter?.resolve({});
    this.waiter = undefined;
    if (this.admission) {
      const admission = this.admission;
      this.admission = undefined;
      clearTimeout(admission.timer);
      admission.resolve({
        state: 'uncertain',
        error: 'Cursor closed before confirming message admission',
      });
    }
    if (!this.stopped) {
      this.state.state = 'error';
      this.state.error = 'Send any message in this Cursor chat to restore delivery';
      this.changed();
    }
  }
  async deliver(input: EventInput): Promise<Admission> {
    if (this.stopped) return { state: 'failed', error: 'The Cursor integration is disconnected' };
    if (!this.waiter || this.admission) return { state: 'waiting' };
    if (input.isCurrent && !input.isCurrent()) return { state: 'revoked' };
    const waiter = this.waiter;
    this.waiter = undefined;
    const admissionId = randomUUID();
    const text = `${agentMessageText(input)}\n\nNCF-Admission-ID: ${admissionId}`;
    return new Promise<Admission>((resolve) => {
      const timer = setTimeout(() => {
        if (this.admission?.id !== admissionId) return;
        this.admission = undefined;
        resolve({
          state: 'uncertain',
          error: 'Cursor did not confirm native message admission',
        });
      }, 30000);
      timer.unref();
      this.admission = { id: admissionId, isCurrent: input.isCurrent, resolve, timer };
      waiter.resolve({ followup_message: text });
    });
  }
  async stop(): Promise<void> {
    this.stopped = true;
    this.end();
    this.state.state = 'error';
    this.state.error = 'The Cursor integration is disconnected';
    this.changed();
  }
}

export class OpenCodeAdapter implements AgentAdapter {
  private state: AdapterState;
  private controller = new AbortController();
  private streamTask?: Promise<void>;
  private streamController?: AbortController;
  private starting?: Promise<void>;
  private retry?: NodeJS.Timeout;
  constructor(
    readonly profile: AdapterProfile,
    readonly changed: () => void,
    readonly idle: () => void,
  ) {
    this.state = {
      id: profile.id,
      label: profile.label,
      kind: 'opencode-http',
      capabilities: { ...capabilities, wakeIdle: true, exactSession: true },
      state: 'checking',
      error: null,
      released: profile.released === true,
    };
  }
  status(): AdapterState {
    return { ...this.state };
  }
  private reconnect(): void {
    if (!this.controller.signal.aborted && !this.retry) {
      this.retry = setTimeout(() => {
        this.retry = undefined;
        void this.start();
      }, 3000);
      this.retry.unref();
    }
  }
  private failure(state: 'failed' | 'uncertain', error: string): Admission {
    this.state.state = state === 'uncertain' ? 'uncertain' : 'error';
    this.state.error = error;
    this.changed();
    this.reconnect();
    return { state, error };
  }
  private url(route: string): URL {
    const url = new URL(this.profile.baseUrl ?? '');
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hash ||
      url.search
    )
      throw new Error('Invalid OpenCode API address');
    if (url.protocol === 'http:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Unencrypted HTTP is only allowed for local OpenCode');
    url.pathname = url.pathname.replace(/\/$/, '') + route;
    return url;
  }
  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      ...(this.profile.password
        ? {
            authorization:
              'Basic ' +
              Buffer.from(
                (this.profile.username ?? 'opencode') + ':' + this.profile.password,
              ).toString('base64'),
          }
        : {}),
    };
  }
  private async request(route: string, init: RequestInit = {}): Promise<Response> {
    return fetch(this.url(route), {
      ...init,
      headers: this.headers(),
      redirect: 'error',
      signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(10000)]),
    });
  }
  start(): Promise<void> {
    if (!this.starting)
      this.starting = this.startNow().finally(() => {
        this.starting = undefined;
      });
    return this.starting;
  }
  private async startNow(): Promise<void> {
    if (this.controller.signal.aborted) return;
    if (this.profile.released) {
      // The client released the connection; keep the raw diagnostic for
      // details but surface this as a released fact, not a transport error.
      this.state.state = 'error';
      this.state.error = 'OpenCode is disconnected';
      this.state.released = true;
      this.changed();
      return;
    }
    clearTimeout(this.retry);
    this.retry = undefined;
    this.streamController?.abort();
    await this.streamTask;
    try {
      if (!this.profile.sessionId)
        throw new Error('The OpenCode integration did not provide the current chat');
      const res = await this.request('/session/' + encodeURIComponent(this.profile.sessionId));
      if (!res.ok) throw new Error('OpenCode API v1: session unavailable (' + res.status + ')');
      const body = (await res.json()) as { id?: string };
      if (body.id !== this.profile.sessionId)
        throw new Error('OpenCode returned a different session');
      const stream = (this.streamController = new AbortController());
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          stream.abort();
          reject(new Error('The OpenCode event stream did not connect'));
        }, 10000);
        this.streamTask = this.subscribe(stream.signal, (error) => {
          clearTimeout(timeout);
          if (error) reject(error);
          else resolve();
        });
      });
      this.state.state = 'ready';
      this.state.error = null;
      this.state.released = false;
    } catch (e) {
      if (!this.controller.signal.aborted) {
        this.state.state = 'error';
        this.state.error = (e as Error).message;
        this.state.released = false;
        this.reconnect();
      }
    }
    this.changed();
  }
  private async subscribe(signal: AbortSignal, connected: (error?: Error) => void): Promise<void> {
    try {
      const response = await fetch(this.url('/event'), {
        headers: this.headers(),
        redirect: 'error',
        signal: AbortSignal.any([signal, this.controller.signal]),
      });
      if (!response.ok || !response.body)
        throw new Error('The OpenCode event stream is unavailable');
      connected();
      let buffer = '';
      const decoder = new TextDecoder();
      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, { stream: true });
        if (buffer.length > 1024 * 1024) throw new Error('The OpenCode event frame is too large');
        let end: number;
        let delimiter: RegExpMatchArray | null;
        while ((delimiter = buffer.match(/\r?\n\r?\n/)) !== null) {
          end = delimiter.index!;
          const frame = buffer.slice(0, end);
          buffer = buffer.slice(end + delimiter[0].length);
          const data = frame
            .split(/\r?\n/)
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5).trim())
            .join('\n');
          if (!data) continue;
          const event = JSON.parse(data) as {
            type?: string;
            properties?: { sessionID?: string; status?: { type?: string } };
          };
          if (
            event.properties?.sessionID === this.profile.sessionId &&
            ((event.type === 'session.status' && event.properties?.status?.type === 'idle') ||
              event.type === 'session.idle')
          )
            this.idle();
        }
      }
      if (!this.controller.signal.aborted && !signal.aborted)
        throw new Error('The OpenCode event stream was closed');
    } catch (e) {
      connected(e as Error);
      if (!this.controller.signal.aborted && !signal.aborted) {
        this.state.state = 'error';
        this.state.error = (e as Error).message;
        this.changed();
        // Reconnect the push stream; no periodic agent polling.
        this.reconnect();
      }
    }
  }
  async deliver(input: EventInput): Promise<Admission> {
    if (this.state.state !== 'ready')
      return { state: 'failed', error: this.state.error ?? 'The adapter is disconnected' };
    try {
      const status = await this.request('/session/status');
      if (!status.ok) return this.failure('failed', 'Could not determine whether OpenCode is busy');
      const states = (await status.json()) as Record<string, { type?: string }>;
      if (states[this.profile.sessionId!]?.type === 'busy') return { state: 'waiting' };
    } catch (e) {
      return this.failure('failed', (e as Error).message);
    }
    if (input.isCurrent && !input.isCurrent()) return { state: 'revoked' };
    try {
      const text = agentMessageText(input);
      const response = await this.request(
        '/session/' + encodeURIComponent(this.profile.sessionId!) + '/prompt_async',
        { method: 'POST', body: JSON.stringify({ parts: [{ type: 'text', text }] }) },
      );
      if ([409, 429].includes(response.status)) return { state: 'waiting' };
      if (!response.ok)
        return this.failure(
          response.status >= 500 ? 'uncertain' : 'failed',
          'OpenCode rejected the message: ' + response.status,
        );
      return { state: 'admitted' };
    } catch (e) {
      return this.failure('uncertain', (e as Error).message);
    }
  }
  async stop(): Promise<void> {
    clearTimeout(this.retry);
    this.controller.abort();
    this.streamController?.abort();
    await this.starting;
    await this.streamTask;
    this.state.state = 'error';
    this.state.error = 'OpenCode is disconnected';
    this.state.released = this.profile.released === true;
    this.changed();
  }
}

export class AdapterRegistry extends EventEmitter {
  private adapters = new Map<string, AgentAdapter>();
  constructor(private readonly aionui?: AionUiSessions) {
    super();
  }
  async configure(profiles: AdapterProfile[]): Promise<void> {
    await this.close();
    await Promise.all(profiles.map((profile) => this.add(profile)));
    this.emit('idle');
  }
  async add(profile: AdapterProfile): Promise<void> {
    await this.adapters.get(profile.id)?.stop();
    const changed = () => {
        this.emit('change');
        if (this.adapters.get(profile.id)?.status().state === 'ready') this.emit('idle');
      },
      idle = () => this.emit('idle');
    const adapter =
      profile.kind === 'manual'
        ? new ManualAdapter(profile)
        : profile.kind === 'codex-desktop'
          ? new CodexDesktopAdapter(profile, changed)
          : profile.kind === 'cursor-hook'
            ? new CursorHookAdapter(profile, changed, idle)
            : profile.kind === 'aionui'
              ? new AionUiAdapter(profile, this.aionui!, changed, idle)
              : new OpenCodeAdapter(profile, changed, idle);
    this.adapters.set(profile.id, adapter);
    await adapter.start();
  }
  states(): AdapterState[] {
    return [...this.adapters.values()].map((a) => a.status());
  }
  get(id: string): AgentAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error('Adapter not found');
    return adapter;
  }
  async close(): Promise<void> {
    await Promise.all([...this.adapters.values()].map((a) => a.stop()));
    this.adapters.clear();
  }
}

import WebSocket from 'ws';
import { z } from 'zod';
import type { AdapterProfile, AdapterState } from '../shared/contracts.js';
import {
  agentMessageText,
  type Admission,
  type AgentAdapter,
  type EventInput,
} from './adapters.js';
import { AionUiError, AionUiRevoked, aionJson, conversationSchema } from './aionui-api.js';
import type { AionUiSessions } from './aionui-sessions.js';

const accepted = z.object({
  success: z.literal(true),
  data: z.object({ msg_id: z.string().min(1).max(200), turn_id: z.string().min(1).max(200) }),
});
export class AionUiAdapter implements AgentAdapter {
  private state: AdapterState;
  private socket?: WebSocket;
  private retry?: NodeJS.Timeout;
  private heartbeat?: NodeJS.Timeout;
  private starting?: Promise<void>;
  private stopped = false;
  private blocked = false;
  private idleVersion = 0;
  private serial: Promise<unknown> = Promise.resolve();
  private readonly revoked = (id: string) => {
    if (id === this.profile.aionConnectionId) this.fail(new AionUiRevoked());
  };
  constructor(
    readonly profile: AdapterProfile,
    private readonly sessions: AionUiSessions,
    private readonly changed: () => void,
    private readonly idle: () => void,
  ) {
    this.state = {
      id: profile.id,
      label: profile.label,
      kind: 'aionui',
      capabilities: {
        wakeIdle: true,
        receiveActive: false,
        nativeDisplay: true,
        exactSession: true,
      },
      state: 'checking',
      error: null,
    };
    sessions.on('revoked', this.revoked);
  }
  status(): AdapterState {
    return { ...this.state, capabilities: { ...this.state.capabilities } };
  }
  private id(): string {
    if (!this.profile.aionConnectionId || !this.profile.sessionId) throw new AionUiRevoked();
    return this.profile.aionConnectionId;
  }
  private route(): string {
    return '/api/conversations/' + encodeURIComponent(this.profile.sessionId!);
  }
  private fail(error: unknown): void {
    if (this.stopped || (this.state.released && !(error instanceof AionUiRevoked))) return;
    clearInterval(this.heartbeat);
    this.state.state = 'error';
    this.state.error =
      error instanceof AionUiRevoked
        ? error.message
        : 'The local AionUi connection is unavailable.';
    this.state.released = error instanceof AionUiRevoked;
    if (this.state.released) {
      clearTimeout(this.retry);
      this.retry = undefined;
    }
    this.socket?.terminate();
    this.changed();
    if (!(error instanceof AionUiRevoked) && !this.retry) {
      this.retry = setTimeout(() => {
        this.retry = undefined;
        void this.start();
      }, 3000);
      this.retry.unref();
    }
  }
  start(): Promise<void> {
    if (!this.starting)
      this.starting = this.startNow().finally(() => {
        this.starting = undefined;
      });
    return this.starting;
  }
  private async inspect(): Promise<boolean> {
    const id = this.id();
    await this.sessions.verify(id);
    const { http, signal } = this.sessions.access(id);
    const response = await http.request(this.route(), {}, signal);
    if ([401, 403].includes(response.status)) {
      await this.sessions.revoke(id);
      throw new AionUiRevoked();
    }
    if (response.status === 404) throw new AionUiRevoked();
    const chat = conversationSchema.safeParse(await aionJson(response));
    if (!response.ok || !chat.success || chat.data.data.id !== this.profile.sessionId)
      throw new AionUiError('The exact AionUi chat is unavailable.');
    this.sessions.access(id);
    this.state.lastOwnerVerifiedAt = new Date().toISOString();
    return (
      chat.data.data.runtime.can_send_message &&
      chat.data.data.runtime.state === 'idle' &&
      chat.data.data.runtime.pending_confirmations === 0
    );
  }
  private async startNow(): Promise<void> {
    if (this.stopped) return;
    clearTimeout(this.retry);
    this.retry = undefined;
    const previous = this.socket;
    this.socket = undefined;
    previous?.terminate();
    clearInterval(this.heartbeat);
    try {
      await this.sessions.verify(this.id());
      await this.subscribe();
      const version = this.idleVersion;
      const canSend = await this.inspect();
      this.blocked = !canSend && version === this.idleVersion;
      if (this.stopped) return;
      this.state.state = 'ready';
      this.state.error = null;
      this.state.released = false;
      this.changed();
    } catch (error) {
      this.fail(error);
    }
  }
  private async subscribe(): Promise<void> {
    const { http, signal, userId } = this.sessions.access(this.id());
    const ws = (this.socket = new WebSocket(http.url.replace('http:', 'ws:') + '/ws', {
      headers: { cookie: http.cookies.header('/ws'), 'user-agent': 'NCF Agent Interconnect' },
      handshakeTimeout: 10000,
      maxPayload: 1024 * 1024,
      followRedirects: false,
    }));
    const abort = () => ws.terminate();
    signal.addEventListener('abort', abort, { once: true });
    let alive = true;
    ws.on('pong', () => {
      alive = true;
    });
    ws.on('message', (raw) => {
      if (this.socket !== ws || this.stopped) return;
      let event: { name?: string; data?: Record<string, unknown> };
      try {
        event = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!event || typeof event !== 'object') return;
      if (event.name === 'ping') {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ name: 'pong', data: {} }));
        return;
      }
      if (event.name === 'realtime.error') {
        // Reconnect through normal pinned-account authentication. Auth expiry
        // and transport backpressure must not silently replace the account.
        this.fail(new AionUiError('AionUi realtime authentication or transport ended.'));
        return;
      }
      if (event.data?.user_id && event.data.user_id !== userId) {
        void this.sessions.revoke(this.id()).catch(() => {});
        return;
      }
      if (
        event.name === 'turn.completed' &&
        event.data?.user_id === userId &&
        event.data.conversation_id === this.profile.sessionId
      ) {
        const runtime = event.data.runtime as
          | { can_send_message?: boolean; pending_confirmations?: number; state?: string }
          | undefined;
        if (
          runtime?.state === 'idle' &&
          runtime.can_send_message === true &&
          runtime.pending_confirmations === 0
        ) {
          this.blocked = false;
          this.idleVersion++;
          setImmediate(() => {
            if (!this.stopped && this.socket === ws) this.idle();
          });
        }
      }
    });
    ws.on('error', () => {
      if (this.socket === ws)
        this.fail(
          signal.aborted ? new AionUiRevoked() : new AionUiError('AionUi transport failed.'),
        );
    });
    ws.on('close', () => {
      signal.removeEventListener('abort', abort);
      if (this.socket !== ws) return;
      clearInterval(this.heartbeat);
      this.fail(signal.aborted ? new AionUiRevoked() : new AionUiError('AionUi transport closed.'));
    });
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => {
        if (signal.aborted || this.stopped) {
          ws.terminate();
          reject(new AionUiRevoked());
        } else resolve();
      });
      ws.once('error', () => reject(new AionUiError('AionUi transport failed.')));
      ws.once('close', () =>
        reject(signal.aborted ? new AionUiRevoked() : new AionUiError('AionUi transport closed.')),
      );
    });
    this.heartbeat = setInterval(() => {
      if (!alive) {
        ws.terminate();
        return;
      }
      alive = false;
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30000);
    this.heartbeat.unref();
  }
  deliver(input: EventInput): Promise<Admission> {
    const operation = this.serial.then(() => this.deliverNow(input));
    this.serial = operation.catch(() => {});
    return operation;
  }
  private async deliverNow(input: EventInput): Promise<Admission> {
    if (this.stopped || this.state.released) return { state: 'revoked' };
    if (this.state.state !== 'ready')
      return {
        state: 'failed',
        error: this.state.error ?? 'The AionUi connection is unavailable.',
      };
    if (this.blocked) return { state: 'waiting' };
    const beforeInspect = this.idleVersion;
    try {
      if (!(await this.inspect())) {
        this.blocked = beforeInspect === this.idleVersion;
        if (!this.blocked) setImmediate(() => this.idle());
        return { state: 'waiting' };
      }
    } catch (error) {
      this.fail(error);
      return {
        state: error instanceof AionUiRevoked ? 'revoked' : 'failed',
        error: this.state.error!,
      };
    }
    if (this.stopped || this.state.released || (input.isCurrent && !input.isCurrent()))
      return { state: 'revoked' };
    if (this.state.state !== 'ready' || this.socket?.readyState !== WebSocket.OPEN)
      return { state: 'failed', error: 'The AionUi realtime connection is unavailable.' };
    const version = this.idleVersion;
    try {
      const { http, signal } = this.sessions.access(this.id());
      const response = await http.request(
        this.route() + '/messages',
        { method: 'POST', body: JSON.stringify({ content: agentMessageText(input) }) },
        signal,
      );
      if (response.status === 409) {
        this.blocked = version === this.idleVersion;
        if (!this.blocked) setImmediate(() => this.idle());
        return { state: 'waiting' };
      }
      if ([401, 403].includes(response.status)) {
        await this.sessions.revoke(this.id());
        return { state: 'revoked', error: new AionUiRevoked().message };
      }
      if (response.status !== 202) {
        if (response.status >= 500 || response.ok)
          throw new AionUiError('AionUi admission is uncertain.');
        return { state: 'failed', error: 'AionUi rejected the message.' };
      }
      if (!accepted.safeParse(await aionJson(response)).success)
        throw new AionUiError('AionUi admission is uncertain.');
      this.blocked = version === this.idleVersion;
      return { state: 'admitted' };
    } catch {
      if (!this.state.released) this.fail(new AionUiError('AionUi transport failed.'));
      this.state.state = 'uncertain';
      this.state.error =
        'AionUi admission is uncertain. The message will not be repeated automatically.';
      this.changed();
      return { state: 'uncertain', error: this.state.error };
    }
  }
  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.retry);
    clearInterval(this.heartbeat);
    this.sessions.off('revoked', this.revoked);
    this.socket?.terminate();
    await this.starting;
    await this.serial;
  }
}

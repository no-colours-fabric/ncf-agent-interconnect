import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { NodeService } from './service.js';
import { aionId, aionUrl, aionJson, AionUiError, conversationSchema } from './aionui-api.js';
import type { AdapterProfile } from '../shared/contracts.js';
import { CursorHookAdapter } from './adapters.js';

const registration = z
  .object({
    workspace: z.string().min(1).max(4000),
    instanceId: z.uuid(),
    hostPid: z.number().int().positive(),
    baseUrl: z.url(),
    password: z.string().regex(/^[a-f0-9]{64}$/),
    sessionId: z
      .string()
      .regex(/^ses_[a-zA-Z0-9_-]+$/)
      .max(200)
      .optional(),
  })
  .strict();
const cursorContext = z
  .object({
    conversationId: z.uuid(),
    workspaceRoots: z.array(z.string().min(1).max(4000)).max(32).default([]),
    toolName: z.string().min(1).max(300),
  })
  .strict();
const cursorHook = z
  .object({
    event: z.enum(['beforeSubmitPrompt', 'stop', 'sessionEnd']),
    conversationId: z.uuid(),
    admissionId: z.uuid().optional(),
    status: z.enum(['completed', 'aborted', 'error']).optional(),
  })
  .strict();
export interface ClientContext {
  client: string;
  chatId: string;
  adapterId: string;
}

// Credentials and exact session IDs come from the installed host integration,
// never from a user's settings form or from a model guessing a session.
export class ClientContexts {
  private tickets = new Map<string, { context: ClientContext; expires: number }>();
  private setup: Promise<unknown> = Promise.resolve();
  constructor(private readonly service: NodeService) {}
  private issue(context: ClientContext): string {
    const now = Date.now();
    for (const [key, value] of this.tickets) if (value.expires < now) this.tickets.delete(key);
    if (this.tickets.size >= 512) this.tickets.delete(this.tickets.keys().next().value!);
    const contextToken = randomUUID();
    this.tickets.set(contextToken, { context, expires: now + 60000 });
    return contextToken;
  }
  private cursorAdapter(profile: AdapterProfile): CursorHookAdapter {
    const adapter = this.service.adapters.get(profile.id);
    if (!(adapter instanceof CursorHookAdapter))
      throw new Error('The Cursor integration is unavailable');
    return adapter;
  }
  async registerCursor(raw: unknown): Promise<{ contextToken: string }> {
    if (!this.service.integrationsReady)
      throw new Error('The node is not ready to accept connections');
    const input = cursorContext.parse(raw);
    if (!['agent_connect', 'ncf_agent_interconnect_agent_connect'].includes(input.toolName))
      throw new Error('The Cursor context is only available for agent_connect');
    const work = this.setup.then(async () => {
      if (!this.service.integrationsReady)
        throw new Error('The node is not ready to accept connections');
      const profiles = this.service.settings.value.adapters;
      const profile = profiles.find(
        (candidate) =>
          candidate.kind === 'cursor-hook' && candidate.sessionId === input.conversationId,
      );
      const updated: AdapterProfile = {
        id: profile?.id ?? randomUUID(),
        label: 'Cursor',
        kind: 'cursor-hook',
        sessionId: input.conversationId,
        ...(input.workspaceRoots[0] ? { workspace: input.workspaceRoots[0] } : {}),
      };
      if (!profile || JSON.stringify(profile) !== JSON.stringify(updated))
        await this.service.installAdapter(updated);
      const adapter = this.cursorAdapter(updated);
      adapter.activate();
      return {
        contextToken: this.issue({
          client: 'Cursor',
          chatId: input.conversationId,
          adapterId: updated.id,
        }),
      };
    });
    this.setup = work.catch(() => {});
    return work;
  }
  async handleCursorHook(raw: unknown, signal: AbortSignal): Promise<Record<string, unknown>> {
    if (!this.service.integrationsReady) return {};
    const input = cursorHook.parse(raw);
    const profile = this.service.settings.value.adapters.find(
      (candidate) =>
        candidate.kind === 'cursor-hook' && candidate.sessionId === input.conversationId,
    );
    if (!profile) return {};
    const adapter = this.cursorAdapter(profile);
    if (input.event === 'beforeSubmitPrompt') {
      adapter.acknowledge(input.admissionId);
      return {};
    }
    if (input.event === 'sessionEnd') {
      adapter.end();
      return {};
    }
    return adapter.wait(input.status, signal);
  }
  async registerOpenCode(raw: unknown): Promise<unknown> {
    if (!this.service.integrationsReady)
      throw new Error('The node is not ready to accept connections');
    const input = registration.parse(raw),
      url = new URL(input.baseUrl);
    if (
      url.protocol !== 'http:' ||
      url.hostname !== '127.0.0.1' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error('The OpenCode integration must use the loopback interface');
    const inspect = async (
      profile: Pick<AdapterProfile, 'baseUrl' | 'password'>,
      route: string,
    ): Promise<unknown> => {
      const response = await fetch(new URL(route, profile.baseUrl), {
        headers: {
          authorization: 'Basic ' + Buffer.from('opencode:' + profile.password).toString('base64'),
        },
        redirect: 'error',
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok) throw new Error('The OpenCode integration is unavailable');
      return response.json();
    };
    const identity = (await inspect(input, '/identity')) as {
      instanceId?: string;
      workspace?: string;
    };
    if (identity.instanceId !== input.instanceId || identity.workspace !== input.workspace)
      throw new Error('The OpenCode integration identity could not be verified');
    if (!input.sessionId)
      return {
        sessions: [
          ...new Set(
            this.service.settings.value.adapters
              .filter((a) => a.kind === 'opencode-http' && a.workspace === input.workspace)
              .map((a) => a.sessionId!),
          ),
        ],
      };
    const session = (await inspect(input, '/session/' + encodeURIComponent(input.sessionId))) as {
      id?: string;
    };
    if (session.id !== input.sessionId)
      throw new Error('The integration returned a different chat');
    const work = this.setup.then(async () => {
      if (!this.service.integrationsReady)
        throw new Error('The node is not ready to accept connections');
      const profiles = this.service.settings.value.adapters;
      let profile = profiles.find(
        (a) =>
          a.kind === 'opencode-http' &&
          a.sessionId === input.sessionId &&
          a.workspace === input.workspace &&
          a.instanceId === input.instanceId,
      );
      if (!profile) {
        // Reconnect a stopped host. A second live host is a different binding
        // and must go through normal user-approved nickname transfer.
        for (const candidate of profiles.filter(
          (a) =>
            a.kind === 'opencode-http' &&
            a.sessionId === input.sessionId &&
            a.workspace === input.workspace,
        )) {
          let exited = false;
          if (candidate.hostPid) {
            try {
              process.kill(candidate.hostPid, 0);
            } catch (error) {
              exited = (error as NodeJS.ErrnoException).code === 'ESRCH';
            }
          }
          if (candidate.released || exited) {
            profile = candidate;
            break;
          }
        }
      }
      const updated: AdapterProfile = {
        id: profile?.id ?? randomUUID(),
        label: 'OpenCode',
        kind: 'opencode-http',
        ...input,
        released: false,
      };
      const changed = !profile || JSON.stringify(profile) !== JSON.stringify(updated);
      if (changed) await this.service.installAdapter(updated);
      else if (this.service.adapters.get(profile!.id).status().state === 'error')
        await this.service.installAdapter(updated);
      const context = { client: 'OpenCode', chatId: input.sessionId!, adapterId: updated.id };
      return { contextToken: this.issue(context) };
    });
    this.setup = work.catch(() => {});
    return work;
  }
  async registerAionUi(raw: unknown): Promise<{ contextToken: string }> {
    if (!this.service.integrationsReady)
      throw new AionUiError('The node is not ready to accept connections.');
    const parsed = z
      .object({
        baseUrl: z.string().max(2000),
        userId: aionId,
        sessionId: aionId,
        runtimeToken: z.string().min(1).max(8192),
      })
      .strict()
      .safeParse(raw);
    if (!parsed.success) throw new AionUiError('The AionUi runtime context is invalid.');
    const input = parsed.data;
    aionUrl(input.baseUrl);
    const work = this.setup.then(async () => {
      const connection = this.service.aionui.current();
      await this.service.aionui.verify(connection.id);
      const access = this.service.aionui.access(connection.id);
      if (input.userId !== access.userId)
        throw new AionUiError('This AionUi account has not been paired.');
      const route = '/api/conversations/' + encodeURIComponent(input.sessionId);
      const runtime = await access.http.runtimeProof(route, input, access.signal);
      const native = conversationSchema.safeParse(await aionJson(runtime));
      if (!runtime.ok || !native.success || native.data.data.id !== input.sessionId)
        throw new AionUiError('The AionUi runtime could not be verified.');
      const response = await access.http.request(route, {}, access.signal);
      const chat = conversationSchema.safeParse(await aionJson(response));
      if (!response.ok || !chat.success || chat.data.data.id !== input.sessionId)
        throw new AionUiError('The exact AionUi chat is unavailable.');
      this.service.aionui.access(connection.id);
      if (!this.service.integrationsReady)
        throw new AionUiError('The node is not ready to accept connections.');
      const profile = this.service.settings.value.adapters.find(
        (a) =>
          a.kind === 'aionui' &&
          a.aionConnectionId === connection.id &&
          a.sessionId === input.sessionId,
      );
      const id = profile?.id ?? randomUUID();
      if (!profile || this.service.adapters.get(id).status().state !== 'ready')
        await this.service.installAdapter({
          id,
          label: 'AionUi',
          kind: 'aionui',
          aionConnectionId: connection.id,
          sessionId: input.sessionId,
        });
      this.service.aionui.access(connection.id);
      if (this.service.adapters.get(id).status().state !== 'ready')
        throw new AionUiError('The AionUi realtime connection is unavailable.');
      return {
        contextToken: this.issue({ client: 'AionUi', chatId: input.sessionId, adapterId: id }),
      };
    });
    this.setup = work.catch(() => {});
    return work;
  }
  consume(token: string): ClientContext {
    const ticket = this.tickets.get(token);
    this.tickets.delete(token);
    if (!ticket || ticket.expires < Date.now())
      throw new Error('The chat context expired. Reconnect from this chat.');
    return ticket.context;
  }
  async releaseOpenCode(raw: unknown): Promise<{ released: true }> {
    const { instanceId } = z.object({ instanceId: z.uuid() }).strict().parse(raw);
    const profiles = this.service.settings.value.adapters.filter(
      (a) => a.kind === 'opencode-http' && a.instanceId === instanceId,
    );
    for (const profile of profiles) profile.released = true;
    await this.service.settings.save();
    await Promise.all(profiles.map((profile) => this.service.adapters.get(profile.id).stop()));
    this.service.emit('change');
    return { released: true };
  }
  clear(): void {
    this.tickets.clear();
  }
}

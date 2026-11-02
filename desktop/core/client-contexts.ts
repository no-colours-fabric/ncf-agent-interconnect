import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { NodeService } from './service.js';
import { aionId, aionUrl, aionJson, AionUiError, conversationSchema } from './aionui-api.js';
import type { AdapterProfile } from '../shared/contracts.js';

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
      const now = Date.now();
      for (const [key, value] of this.tickets) if (value.expires < now) this.tickets.delete(key);
      if (this.tickets.size >= 512) this.tickets.delete(this.tickets.keys().next().value!);
      const contextToken = randomUUID();
      this.tickets.set(contextToken, { context, expires: now + 60000 });
      return { contextToken };
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
    const baseUrl = aionUrl(input.baseUrl);
    const work = this.setup.then(async () => {
      const connection = this.service.aionui.current();
      await this.service.aionui.verify(connection.id);
      const access = this.service.aionui.access(connection.id);
      if (input.userId !== access.userId)
        throw new AionUiError('This AionUi account has not been paired.');
      const route = '/api/conversations/' + encodeURIComponent(input.sessionId);
      let runtime: Response;
      try {
        runtime = await fetch(baseUrl + route, {
          headers: {
            'x-aionui-runtime-token': input.runtimeToken,
            'x-aionui-user-id': input.userId,
            'x-aionui-conversation-id': input.sessionId,
          },
          redirect: 'error',
          signal: AbortSignal.any([access.signal, AbortSignal.timeout(5000)]),
        });
      } catch {
        throw new AionUiError('The AionUi runtime could not be verified.');
      }
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
      const now = Date.now();
      for (const [key, value] of this.tickets) if (value.expires < now) this.tickets.delete(key);
      if (this.tickets.size >= 512) this.tickets.delete(this.tickets.keys().next().value!);
      const contextToken = randomUUID();
      this.tickets.set(contextToken, {
        context: { client: 'AionUi', chatId: input.sessionId, adapterId: id },
        expires: now + 60000,
      });
      return { contextToken };
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

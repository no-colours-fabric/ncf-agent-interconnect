import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { atomicJson } from './settings.js';
import {
  AionCookies,
  AionHttp,
  AionUiError,
  AionUiRevoked,
  aionId,
  aionJson,
  aionUrl,
  authSchema,
  userSchema,
  cookieSchema,
} from './aionui-api.js';
import type { AionUiSetupState } from '../shared/aionui.js';

const credentialSchema = z
  .object({
    version: z.literal(1),
    id: z.uuid(),
    url: z.string(),
    accountId: aionId,
    userId: aionId,
    revoked: z.boolean(),
    cookies: z.array(cookieSchema).max(64),
  })
  .strict();
type Credential = z.infer<typeof credentialSchema>;
interface Active {
  record: Credential;
  http: AionHttp;
  controller: AbortController;
  verifying?: Promise<void>;
}
export class AionUiSessions extends EventEmitter {
  private active?: Active;
  private saving = Promise.resolve();
  private pairing = false;
  private pairController?: AbortController;
  private stopped = false;
  private epoch = 0;
  constructor(private readonly directory: string) {
    super();
  }
  private get filename(): string {
    return path.join(this.directory, 'aionui-credentials.json');
  }
  async load(): Promise<void> {
    try {
      const parsed = credentialSchema.safeParse(JSON.parse(await readFile(this.filename, 'utf8')));
      if (!parsed.success) throw new AionUiError('The saved AionUi connection is invalid.');
      this.activate(parsed.data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new AionUiError('The saved AionUi connection could not be read.');
    }
  }
  private activate(record: Credential): Active {
    const active: Active = { record, http: undefined!, controller: new AbortController() };
    active.http = new AionHttp(record.url, new AionCookies(record.cookies), async () => {
      record.cookies = active.http.cookies.snapshot();
      await this.save();
    });
    if (record.revoked) active.controller.abort();
    this.active = active;
    return active;
  }
  private persist(work: () => Promise<void>): Promise<void> {
    const operation = this.saving.then(work);
    this.saving = operation.catch(() => {});
    return operation.catch((error) => {
      if (error instanceof AionUiError) throw error;
      throw new AionUiError('The AionUi connection could not be saved.');
    });
  }
  private save(): Promise<void> {
    const active = this.active;
    if (!active) return Promise.resolve();
    const record = structuredClone(active.record);
    return this.persist(async () => {
      // A refresh on an old connection cannot overwrite a later pairing commit.
      if (this.active === active) await atomicJson(this.filename, record);
    });
  }
  status(): AionUiSetupState {
    return {
      state: !this.active ? 'not-paired' : this.active.record.revoked ? 'revoked' : 'paired',
      url: this.active?.record.url ?? 'http://127.0.0.1:25808',
    };
  }
  async pair(raw: unknown): Promise<AionUiSetupState> {
    const parsed = z
      .object({ url: z.string().max(2000), code: z.string().min(1).max(100) })
      .strict()
      .safeParse(raw);
    if (!parsed.success) throw new AionUiError('Enter the AionUi address and pairing code.');
    if (this.pairing || this.stopped)
      throw new AionUiError('AionUi setup is already running or unavailable.');
    const http = new AionHttp(aionUrl(parsed.data.url));
    this.pairing = true;
    const epoch = ++this.epoch;
    const controller = (this.pairController = new AbortController());
    try {
      const response = await http.request(
        '/auth/pair',
        {
          method: 'POST',
          body: JSON.stringify({ code: parsed.data.code }),
        },
        controller.signal,
      );
      const result = z
        .object({ status: z.literal('approved') })
        .safeParse(await aionJson(response));
      if (!response.ok || !result.success)
        throw new AionUiError(
          'Pairing was not approved. Generate a new code in AionUi and confirm access in its desktop window.',
        );
      const identity = await this.identity(http, controller.signal);
      if (this.stopped || epoch !== this.epoch)
        throw new AionUiError('AionUi setup is unavailable.');
      const candidate: Credential = {
        version: 1,
        id: randomUUID(),
        url: http.url,
        ...identity,
        revoked: false,
        cookies: http.cookies.snapshot(),
      };
      await this.persist(async () => {
        const check = () => {
          if (this.stopped || epoch !== this.epoch)
            throw new AionUiError('AionUi setup is unavailable.');
        };
        check();
        // Keep the previous authorization active until the candidate is durable.
        // A failed rename must neither revoke it nor publish the candidate.
        await atomicJson(this.filename, candidate, check);
        if (this.stopped || epoch !== this.epoch) {
          if (this.active) await atomicJson(this.filename, this.active.record);
          else await unlink(this.filename);
          throw new AionUiError('AionUi setup is unavailable.');
        }
        const previous = this.active;
        this.activate(candidate);
        previous?.controller.abort();
        previous?.http.cookies.clear();
        if (previous) {
          previous.record.cookies = [];
          this.emit('revoked', previous.record.id);
        }
        this.emit('change');
      });
      return this.status();
    } catch (error) {
      http.cookies.clear();
      if (error instanceof AionUiError) throw error;
      throw new AionUiError('AionUi pairing failed.');
    } finally {
      this.pairing = false;
      if (this.pairController === controller) this.pairController = undefined;
    }
  }
  private async identity(
    http: AionHttp,
    signal?: AbortSignal,
  ): Promise<{ accountId: string; userId: string }> {
    const status = await http.request('/auth/status', {}, signal);
    if ([401, 403].includes(status.status)) throw new AionUiRevoked();
    if (!status.ok) throw new AionUiError('The local AionUi API is unavailable.');
    const body = await aionJson(status);
    if (body && typeof body === 'object' && 'authenticated' in body && body.authenticated === false)
      throw new AionUiRevoked();
    const auth = authSchema.safeParse(body);
    if (!auth.success) throw new AionUiError('AionUi desktop-pairing WebUI is required.');
    const response = await http.request('/api/auth/user', {}, signal);
    if ([401, 403].includes(response.status)) throw new AionUiRevoked();
    if (!response.ok) throw new AionUiError('The local AionUi API is unavailable.');
    const user = userSchema.safeParse(await aionJson(response));
    if (!user.success) throw new AionUiError('AionUi returned an invalid account response.');
    return { accountId: auth.data.user.id, userId: user.data.user.id };
  }
  current(): { id: string; userId: string } {
    const active = this.active;
    if (!active || active.record.revoked || this.stopped) throw new AionUiRevoked();
    return { id: active.record.id, userId: active.record.userId };
  }
  access(id: string): { http: AionHttp; signal: AbortSignal; userId: string } {
    const active = this.active;
    if (!active || active.record.id !== id || active.record.revoked || this.stopped)
      throw new AionUiRevoked();
    return { http: active.http, signal: active.controller.signal, userId: active.record.userId };
  }
  async verify(id: string): Promise<void> {
    this.access(id);
    const active = this.active!;
    if (!active.verifying)
      active.verifying = this.verifyNow(active).finally(() => {
        active.verifying = undefined;
      });
    await active.verifying;
    this.access(id);
  }
  private async verifyNow(active: Active): Promise<void> {
    let identity: { accountId: string; userId: string };
    try {
      try {
        identity = await this.identity(active.http, active.controller.signal);
      } catch (error) {
        if (!(error instanceof AionUiRevoked)) throw error;
        // Refresh only this paired session. A revoked WebUI session cannot authenticate it.
        const refresh = await active.http.request(
          '/api/auth/refresh',
          { method: 'POST', body: '{}' },
          active.controller.signal,
        );
        if (!refresh.ok) throw new AionUiRevoked();
        identity = await this.identity(active.http, active.controller.signal);
      }
      if (
        identity.accountId !== active.record.accountId ||
        identity.userId !== active.record.userId
      )
        throw new AionUiRevoked();
    } catch (error) {
      if (error instanceof AionUiRevoked) {
        await this.revoke(active.record.id);
        throw error;
      }
      throw new AionUiError('The local AionUi API is unavailable.');
    }
  }
  async revoke(id: string): Promise<void> {
    const active = this.active;
    if (!active || active.record.id !== id || active.record.revoked) return;
    active.record.revoked = true;
    active.record.cookies = [];
    active.http.cookies.clear();
    active.controller.abort();
    this.emit('revoked', id);
    this.emit('change');
    await this.save();
  }
  cancelPair(): void {
    this.epoch++;
    this.pairController?.abort();
  }
  async disconnect(): Promise<AionUiSetupState> {
    this.cancelPair();
    const active = this.active;
    if (active && !active.record.revoked) {
      // Disable locally before attempting best-effort server-side logout.
      const http = new AionHttp(active.record.url, new AionCookies(active.http.cookies.snapshot()));
      await this.revoke(active.record.id);
      await http.request('/auth/logout', { method: 'POST', body: '{}' }).catch(() => {});
      http.cookies.clear();
    }
    return this.status();
  }
  async close(): Promise<void> {
    this.stopped = true;
    this.cancelPair();
    this.active?.controller.abort();
    await this.saving;
  }
}

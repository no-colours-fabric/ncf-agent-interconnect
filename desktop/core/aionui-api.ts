import { z } from 'zod';

export class AionUiError extends Error {}
export class AionUiRevoked extends AionUiError {
  constructor() {
    super('AionUi access ended. Pair again from Applications.');
  }
}
export const aionId = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9_-]+$/);
export function aionUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AionUiError('Enter the local AionUi WebUI address.');
  }
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new AionUiError(
      'AionUi must use http://127.0.0.1 with no path, credentials or URL parameters.',
    );
  return url.origin;
}
export const cookieSchema = z
  .object({
    name: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    value: z
      .string()
      .max(8192)
      .regex(/^[\x21-\x3a\x3c-\x7e]*$/),
    path: z.string().startsWith('/').max(1000),
    expires: z.number().optional(),
  })
  .strict();
export type AionCookie = z.infer<typeof cookieSchema>;
export class AionCookies {
  constructor(private values: AionCookie[] = []) {}
  header(route: string): string {
    return this.values
      .filter(
        (c) =>
          (!c.expires || c.expires > Date.now()) &&
          (route === c.path || route.startsWith(c.path.endsWith('/') ? c.path : c.path + '/')),
      )
      .sort((a, b) => b.path.length - a.path.length)
      .map((c) => c.name + '=' + c.value)
      .join('; ');
  }
  csrf(): string | undefined {
    const value = this.values.find(
      (c) => c.name === 'aionui-csrf-token' && (!c.expires || c.expires > Date.now()),
    )?.value;
    if (!value) return;
    try {
      return decodeURIComponent(value);
    } catch {
      throw new AionUiError('AionUi returned invalid credentials.');
    }
  }
  accept(headers: Headers): boolean {
    let changed = false;
    for (const line of headers.getSetCookie()) {
      if (line.length > 16384) throw new AionUiError('AionUi returned invalid credentials.');
      const [field, ...attributes] = line.split(';');
      const split = field.indexOf('=');
      if (split < 1) continue;
      const options = new Map(
        attributes.map((item) => {
          const [key, ...value] = item.trim().split('=');
          return [key.toLowerCase(), value.join('=')] as const;
        }),
      );
      if (options.has('domain') || options.has('secure')) continue;
      const cookie = cookieSchema.safeParse({
        name: field.slice(0, split),
        value: field.slice(split + 1),
        path: options.get('path') || '/',
        ...(options.has('max-age')
          ? { expires: Date.now() + Number(options.get('max-age')) * 1000 }
          : options.has('expires')
            ? { expires: Date.parse(options.get('expires')!) }
            : {}),
      });
      if (!cookie.success) throw new AionUiError('AionUi returned invalid credentials.');
      this.values = this.values.filter(
        (c) => c.name !== cookie.data.name || c.path !== cookie.data.path,
      );
      if ((!cookie.data.expires || cookie.data.expires > Date.now()) && cookie.data.value)
        this.values.push(cookie.data);
      if (this.values.length > 64) throw new AionUiError('AionUi returned invalid credentials.');
      changed = true;
    }
    return changed;
  }
  snapshot(): AionCookie[] {
    return structuredClone(this.values);
  }
  clear(): void {
    this.values = [];
  }
}
export async function aionJson(response: Response): Promise<unknown> {
  if (!response.body) throw new AionUiError('AionUi returned an invalid response.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > 1024 * 1024) {
      await response.body.cancel().catch(() => {});
      throw new AionUiError('AionUi returned an invalid response.');
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AionUiError('AionUi returned an invalid response.');
  }
}
export class AionHttp {
  readonly url: string;
  constructor(
    url: string,
    readonly cookies = new AionCookies(),
    private readonly changed: () => Promise<void> = async () => {},
  ) {
    this.url = aionUrl(url);
  }
  async request(route: string, init: RequestInit = {}, signal?: AbortSignal): Promise<Response> {
    try {
      const csrf = this.cookies.csrf();
      const response = await fetch(this.url + route, {
        ...init,
        headers: {
          'content-type': 'application/json',
          'user-agent': 'NCF Agent Interconnect',
          cookie: this.cookies.header(route),
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        redirect: 'error',
        signal: AbortSignal.any([
          AbortSignal.timeout(route === '/auth/pair' ? 90000 : 10000),
          ...(signal ? [signal] : []),
        ]),
      });
      if (this.cookies.accept(response.headers)) await this.changed();
      return response;
    } catch (error) {
      if (error instanceof AionUiError) throw error;
      throw new AionUiError('The local AionUi API is unavailable.');
    }
  }
}
export const authSchema = z.object({
  mode: z.literal('desktopPairing'),
  authenticated: z.literal(true),
  user: z.object({ id: aionId }),
});
export const userSchema = z.object({ user: z.object({ id: aionId }) });
export const conversationSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: aionId,
    runtime: z.object({
      state: z.string(),
      can_send_message: z.boolean(),
      pending_confirmations: z.number().int().nonnegative(),
    }),
  }),
});

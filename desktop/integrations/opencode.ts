import http, { type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

type Reply = { data?: unknown; error?: unknown; response?: Response };
type Method = (options: Record<string, unknown>) => Promise<Reply>;
interface Context {
  directory: string;
  client: { session: { get: Method; status: Method; promptAsync: Method } };
}
interface Descriptor {
  url: string;
  token: string;
}

// This file is shipped with the app and loaded once by OpenCode. No shell,
// shell permissions, private OpenChamber API, or credentials of OpenCode.
export const NCFAgentInterconnect = async (context: Context, options?: { descriptor?: string }) => {
  const descriptor = options?.descriptor ?? new URL('./node.json', import.meta.url);
  const instanceId = randomUUID(),
    password = randomBytes(32).toString('hex');
  const authorization = 'Basic ' + Buffer.from('opencode:' + password).toString('base64');
  const sessions = new Set<string>(),
    streams = new Set<ServerResponse>();
  let stopped = false,
    retry: NodeJS.Timeout | undefined,
    restoring: Promise<void> | undefined;
  const query = { directory: context.directory };
  const sessionGet = async (id: string): Promise<unknown> => {
    if (!/^ses_[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid OpenCode chat context');
    const result = await context.client.session.get({
      path: { id },
      query,
      signal: AbortSignal.timeout(10000),
    });
    const data = result.data as { id?: string; directory?: string } | undefined;
    if (result.error || data?.id !== id || (data.directory && data.directory !== context.directory))
      throw new Error('The current OpenCode chat is unavailable');
    return data;
  };
  const scheduleRestore = () => {
    if (!stopped && !retry) {
      retry = setTimeout(() => {
        retry = undefined;
        void restore().catch(scheduleRestore);
      }, 1500);
      retry.unref();
    }
  };
  const server = http.createServer((request, response) => {
    void (async () => {
      const supplied = Buffer.from(request.headers.authorization ?? ''),
        expected = Buffer.from(authorization);
      if (
        request.headers.origin ||
        request.headers.host !== '127.0.0.1:' + port ||
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      ) {
        response.writeHead(401);
        response.end();
        return;
      }
      const route = new URL(request.url ?? '/', baseUrl);
      response.setHeader('cache-control', 'no-store');
      const json = (status: number, value: unknown) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(value));
      };
      if (request.method === 'GET' && route.pathname === '/identity') {
        json(200, { instanceId, workspace: context.directory });
        return;
      }
      if (request.method === 'GET' && route.pathname === '/event') {
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.write(': connected\n\n');
        streams.add(response);
        request.socket.unref();
        response.on('close', () => {
          streams.delete(response);
          if (!streams.size) scheduleRestore();
        });
        return;
      }
      if (request.method === 'GET' && route.pathname === '/session/status') {
        const result = await context.client.session.status({
          query,
          signal: AbortSignal.timeout(10000),
        });
        if (result.error || !result.data) {
          json(503, { error: 'OpenCode did not report its status' });
          return;
        }
        const states = result.data as Record<string, unknown>;
        json(
          200,
          Object.fromEntries(
            [...sessions].filter((id) => id in states).map((id) => [id, states[id]]),
          ),
        );
        return;
      }
      const match = route.pathname.match(/^\/session\/(ses_[a-zA-Z0-9_-]+)(\/prompt_async)?$/),
        id = match?.[1];
      if (!id || !sessions.has(id)) {
        json(404, { error: 'The chat is not registered by the integration' });
        return;
      }
      if (request.method === 'GET' && !match![2]) {
        json(200, await sessionGet(id));
        return;
      }
      if (request.method === 'POST' && match![2]) {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of request) {
          size += (chunk as Buffer).length;
          if (size > 128 * 1024) {
            json(413, {});
            return;
          }
          chunks.push(Buffer.from(chunk));
        }
        const body = JSON.parse(Buffer.concat(chunks).toString()) as {
          parts?: { type: string; text: string }[];
        };
        if (
          !Array.isArray(body.parts) ||
          body.parts.length !== 1 ||
          body.parts[0]?.type !== 'text' ||
          typeof body.parts[0].text !== 'string'
        ) {
          json(400, {});
          return;
        }
        const result = await context.client.session.promptAsync({
          path: { id },
          query,
          body: { parts: body.parts },
          signal: AbortSignal.timeout(10000),
        });
        if (result.error) {
          json(
            result.response?.status && result.response.status >= 400 ? result.response.status : 503,
            { error: 'OpenCode did not confirm message receipt' },
          );
          return;
        }
        response.writeHead(204);
        response.end();
        return;
      }
      json(404, {});
    })().catch(() => {
      if (!response.headersSent) response.writeHead(503);
      response.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  server.unref();
  const port = (server.address() as { port: number }).port,
    baseUrl = 'http://127.0.0.1:' + port + '/';
  const nodeCall = async (
    route: string,
    body: unknown,
  ): Promise<{ sessions?: string[]; contextToken?: string }> => {
    const node = JSON.parse(await readFile(descriptor, 'utf8')) as Descriptor,
      url = new URL(node.url);
    if (
      url.protocol !== 'http:' ||
      url.hostname !== '127.0.0.1' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^[a-f0-9]{64}$/.test(node.token)
    )
      throw new Error('Invalid NCF Agent Interconnect node address');
    url.pathname = route;
    const response = await fetch(url, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + node.token, 'content-type': 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(route.endsWith('/release') ? 2000 : 15000),
      body: JSON.stringify(body),
    });
    if (!response.ok)
      throw new Error('The NCF Agent Interconnect node is unavailable. Start the app.');
    return response.json() as Promise<{ sessions?: string[]; contextToken?: string }>;
  };
  const register = (sessionId?: string) =>
    nodeCall('/integrations/opencode', {
      baseUrl,
      password,
      instanceId,
      hostPid: process.pid,
      workspace: context.directory,
      ...(sessionId ? { sessionId } : {}),
    });
  const restore = (): Promise<void> => {
    if (!restoring)
      restoring = (async () => {
        const result = await register();
        for (const id of result.sessions ?? []) {
          try {
            await sessionGet(id);
          } catch {
            continue;
          } // Deleted/foreign session: never redirect it.
          sessions.add(id);
          await register(id);
        }
      })().finally(() => {
        restoring = undefined;
      });
    return restoring;
  };
  await restore().catch(scheduleRestore);
  const close = async () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(retry);
    await nodeCall('/integrations/opencode/release', { instanceId }).catch(() => {});
    for (const response of streams) response.end();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
  return {
    'tool.execute.before': async (
      input: { tool: string; sessionID: string },
      output: { args: Record<string, unknown> },
    ) => {
      if (input.tool !== 'ncf_agent_interconnect_agent_connect') return;
      delete output.args.contextToken;
      await sessionGet(input.sessionID);
      sessions.add(input.sessionID);
      const registration = await register(input.sessionID);
      if (!registration.contextToken)
        throw new Error('The integration did not confirm the current chat');
      output.args.contextToken = registration.contextToken;
    },
    event: async ({
      event,
    }: {
      event: { type: string; properties?: { sessionID?: string; status?: { type?: string } } };
    }) => {
      if (event.type === 'server.instance.disposed') {
        await close();
        return;
      }
      if (
        event.properties?.sessionID &&
        sessions.has(event.properties.sessionID) &&
        (event.type === 'session.idle' ||
          (event.type === 'session.status' && event.properties.status?.type === 'idle'))
      ) {
        const frame = 'data: ' + JSON.stringify(event) + '\n\n';
        for (const response of streams) response.write(frame);
      }
    },
  };
};

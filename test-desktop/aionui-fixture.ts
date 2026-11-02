import http from 'node:http';
import { randomBytes } from 'node:crypto';
import type test from 'node:test';
import WebSocket, { WebSocketServer } from 'ws';

export async function aionFixture(t: Pick<test.TestContext, 'after'>) {
  const session = randomBytes(24).toString('hex'),
    runtimeToken = randomBytes(24).toString('hex'),
    code = randomBytes(6).toString('hex');
  const chats = new Map([
    ['fixture-chat-a', false],
    ['fixture-chat-b', false],
  ]);
  const posts: { chat: string; content: string }[] = [];
  const reads: string[] = [];
  const proofs: {
    chat: string;
    hasCoreJwt: boolean;
    hasFrontendCookie: boolean;
    accepted: boolean;
  }[] = [];
  const state = {
    pairRequests: 0,
    authenticated: true,
    accountId: 'fixture-account-a',
    userId: 'fixture-user-a',
    wrongChat: false,
    reply: 202,
    drop: false,
    pairApproved: true,
    refreshes: 0,
    expire: false,
  };
  let pairGate: Promise<void> | undefined;
  const sockets = new Set<WebSocket>();
  const runtime = (chat: string) => ({
    state: chats.get(chat) ? 'running' : 'idle',
    can_send_message: !chats.get(chat),
    pending_confirmations: 0,
  });
  const send = (res: http.ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const cookieValue = (req: http.IncomingMessage, name: string) =>
    req.headers.cookie
      ?.split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(name + '='))
      ?.slice(name.length + 1);
  // Match the native boundary: the WebUI gates its own frontend cookie and
  // transparently forwards /api to a distinct Core. Core JWT takes priority
  // over runtime headers, so proof must exclude that JWT to test the token.
  const core = http.createServer(async (req, res) => {
    const url = req.url ?? '';
    if (url === '/api/auth/refresh') {
      state.refreshes++;
      if (!state.authenticated || cookieValue(req, 'aionui-refresh') !== session) {
        send(res, 401, {});
        return;
      }
      state.expire = false;
      send(res, 200, { success: true });
      return;
    }
    const jwt = cookieValue(req, 'aionui-session');
    const native =
      req.headers['x-aionui-runtime-token'] === runtimeToken &&
      req.headers['x-aionui-user-id'] === state.userId;
    const authenticated = jwt
      ? jwt === session && state.authenticated && !state.expire
      : native && state.authenticated;
    if (req.headers['x-aionui-runtime-token'])
      proofs.push({
        chat: String(req.headers['x-aionui-conversation-id']),
        hasCoreJwt: !!jwt,
        hasFrontendCookie: cookieValue(req, 'aionui-webhost-session') === session,
        accepted: authenticated,
      });
    if (!authenticated) {
      send(res, 401, { error: 'private-server-error-' + runtimeToken });
      return;
    }
    if (url === '/api/auth/user') {
      if (!jwt) {
        send(res, 401, {});
        return;
      }
      send(res, 200, {
        user: { id: state.userId, email: 'private-account-fixture@example.invalid' },
      });
      return;
    }
    const match = /^\/api\/conversations\/([^/]+)(\/messages)?$/.exec(url);
    if (!match) {
      send(res, 404, {});
      return;
    }
    const chat = decodeURIComponent(match[1]);
    if (!jwt && req.headers['x-aionui-conversation-id'] !== chat) {
      send(res, 403, {});
      return;
    }
    if (!chats.has(chat)) {
      send(res, 404, {});
      return;
    }
    if (!match[2]) {
      reads.push(chat);
      send(res, 200, {
        success: true,
        data: { id: state.wrongChat ? 'fixture-wrong-chat' : chat, runtime: runtime(chat) },
      });
      return;
    }
    if (req.headers['x-csrf-token'] !== session) {
      send(res, 403, {});
      return;
    }
    let raw = '';
    for await (const chunk of req) raw += chunk;
    posts.push({ chat, content: JSON.parse(raw).content });
    if (state.drop) {
      res.destroy();
      return;
    }
    if (state.reply === 202) chats.set(chat, true);
    send(
      res,
      state.reply,
      state.reply === 202
        ? {
            success: true,
            data: {
              msg_id: 'fixture-message-' + posts.length,
              turn_id: 'fixture-turn-' + posts.length,
              runtime: runtime(chat),
            },
          }
        : { success: false, code: 'CONFLICT', error: 'private-server-error-' + runtimeToken },
    );
  });
  await new Promise<void>((resolve) => core.listen(0, '127.0.0.1', resolve));
  const corePort = (core.address() as { port: number }).port;
  const coreUrl = 'http://127.0.0.1:' + corePort;
  const server = http.createServer(async (req, res) => {
    const url = req.url ?? '';
    if (url === '/auth/pair') {
      state.pairRequests++;
      let raw = '';
      for await (const chunk of req) raw += chunk;
      if (!state.pairApproved || JSON.parse(raw).code !== code) {
        send(res, 200, { status: 'denied' });
        return;
      }
      await pairGate;
      res.setHeader('set-cookie', [
        `aionui-webhost-session=${session}; Path=/; HttpOnly; SameSite=Strict`,
        `aionui-session=${session}; Path=/; HttpOnly`,
        `aionui-refresh=${session}; Path=/api/auth/refresh; HttpOnly`,
        `aionui-csrf-token=${session}; Path=/`,
      ]);
      send(res, 200, { status: 'approved' });
      return;
    }
    const paired = cookieValue(req, 'aionui-webhost-session') === session && state.authenticated;
    if (url === '/auth/status') {
      send(res, 200, {
        mode: 'desktopPairing',
        authenticated: paired && !state.expire,
        user:
          paired && !state.expire
            ? { id: state.accountId, email: 'private-account-fixture@example.invalid' }
            : undefined,
      });
      return;
    }
    if (url === '/auth/logout') {
      state.authenticated = false;
      send(res, 200, { success: true });
      return;
    }
    if (!paired) {
      send(res, 401, {});
      return;
    }
    if (!url.startsWith('/api/')) {
      send(res, 404, {});
      return;
    }
    const proxy = http.request(
      {
        host: '127.0.0.1',
        port: corePort,
        path: url,
        method: req.method,
        headers: { ...req.headers, host: '127.0.0.1:' + corePort },
      },
      (upstream) => {
        res.writeHead(upstream.statusCode ?? 502, upstream.headers);
        upstream.pipe(res);
      },
    );
    proxy.on('error', () => {
      if (!res.headersSent) send(res, 502, {});
      else res.destroy();
    });
    req.pipe(proxy);
  });
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    if (
      req.url !== '/ws' ||
      !state.authenticated ||
      cookieValue(req, 'aionui-webhost-session') !== session
    ) {
      socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n');
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      sockets.add(ws);
      ws.on('close', () => sockets.delete(ws));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
  t.after(async () => {
    for (const socket of sockets) socket.terminate();
    wss.close();
    server.closeAllConnections();
    core.closeAllConnections();
    await Promise.all([
      new Promise<void>((resolve) => server.close(() => resolve())),
      new Promise<void>((resolve) => core.close(() => resolve())),
    ]);
  });
  const emit = (event: unknown) => {
    for (const socket of sockets) socket.send(JSON.stringify(event));
  };
  return {
    url,
    coreUrl,
    code,
    state,
    chats,
    posts,
    reads,
    proofs,
    sockets,
    runtimeToken,
    session,
    emit,
    holdPair: () => {
      let release!: () => void;
      pairGate = new Promise<void>((resolve) => {
        release = () => {
          pairGate = undefined;
          resolve();
        };
      });
      return release;
    },
    context: (chat = 'fixture-chat-a') => ({
      baseUrl: coreUrl,
      userId: state.userId,
      sessionId: chat,
      runtimeToken,
    }),
    complete: (chat = 'fixture-chat-a', userId = state.userId) => {
      chats.set(chat, false);
      emit({
        name: 'turn.completed',
        data: {
          user_id: userId,
          conversation_id: chat,
          session_id: chat,
          turn_id: 'fixture-turn',
          runtime: runtime(chat),
          canSendMessage: true,
        },
      });
    },
  };
}
export async function until(assertion: () => boolean, timeout = 5000): Promise<void> {
  const limit = Date.now() + timeout;
  while (!assertion()) {
    if (Date.now() > limit)
      throw new Error('The isolated fixture did not reach the expected state.');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

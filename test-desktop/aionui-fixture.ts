import http from 'node:http';
import { randomBytes } from 'node:crypto';
import type test from 'node:test';
import type { Socket } from 'node:net';
import { AionLifecycle, FixtureCancelled, type FixtureBarrier } from './aionui-lifecycle.js';
import WebSocket, { WebSocketServer } from 'ws';

export async function aionFixture(
  t: Pick<test.TestContext, 'after'>,
  options: {
    afterCoreListen?: () => Promise<void>;
    inspect?: (snapshot: () => Record<string, unknown>) => void;
  } = {},
) {
  const scope = new AionLifecycle(t);
  const rawSockets = new Set<Socket>();
  const proxySockets = new Set<Socket>();
  const proxyRequests = new Set<http.ClientRequest>();
  const proxyResponses = new Set<http.IncomingMessage>();
  const handlers = new Set<Promise<unknown>>();
  const controllers = new Set<AbortController>();
  const listeners = new Map<string, http.Server>();
  const snapshot = () => ({
    ...scope.snapshot(),
    coreListening: listeners.get('Core')?.listening ?? false,
    webuiListening: listeners.get('WebUI')?.listening ?? false,
    handlers: handlers.size,
    proxyRequests: proxyRequests.size,
    proxyResponses: proxyResponses.size,
    proxySockets: proxySockets.size,
    tcpSockets: rawSockets.size,
    webSockets: [...listeners.keys()].length ? wssClients() : 0,
  });
  let wssClients = () => 0;
  scope.details = snapshot;
  options.inspect?.(snapshot);
  scope.transport({
    label: 'owned socket drain',
    close: async () => {
      await until(
        () =>
          !rawSockets.size &&
          !proxySockets.size &&
          !proxyRequests.size &&
          !proxyResponses.size &&
          !handlers.size &&
          !wssClients() &&
          ![...listeners.values()].some((server) => server.listening),
      );
    },
    force: () => {
      for (const socket of rawSockets) socket.destroy();
      for (const socket of proxySockets) socket.destroy();
    },
  });
  const agent = new http.Agent({ keepAlive: false });
  scope.cancelWith(() => {
    for (const controller of controllers) controller.abort(new FixtureCancelled());
  });
  const expectedAbort = (error: unknown, signal: AbortSignal) =>
    error instanceof FixtureCancelled ||
    (signal.aborted &&
      ['ECONNRESET', 'ERR_STREAM_PREMATURE_CLOSE', 'ABORT_ERR'].includes(
        (error as NodeJS.ErrnoException).code ?? '',
      ));
  const makeServer = (
    label: string,
    handler: (
      req: http.IncomingMessage,
      res: http.ServerResponse,
      signal: AbortSignal,
    ) => Promise<void>,
  ) => {
    const server = http.createServer((req, res) => {
      if (scope.closing) {
        res.destroy();
        return;
      }
      const controller = new AbortController();
      controllers.add(controller);
      const abort = () => {
        if (!res.writableFinished) controller.abort(new FixtureCancelled());
      };
      req.once('aborted', abort);
      res.once('close', abort);
      const task = scope.call(
        label + ' handler',
        () => handler(req, res, controller.signal),
        (error) => expectedAbort(error, controller.signal),
      );
      handlers.add(task);
      const finish = () => {
        handlers.delete(task);
        controllers.delete(controller);
        req.off('aborted', abort);
        res.off('close', abort);
      };
      void task.then(finish, (error) => {
        finish();
        if (expectedAbort(error, controller.signal) || scope.closing) res.destroy();
        else {
          if (!res.headersSent) {
            res.writeHead(500);
            res.end();
          } else res.destroy();
        }
      });
    });
    listeners.set(label, server);
    const owned = new Set<Socket>();
    server.on('connection', (socket: Socket) => {
      owned.add(socket);
      rawSockets.add(socket);
      socket.once('close', () => {
        owned.delete(socket);
        rawSockets.delete(socket);
      });
      if (scope.closing) socket.destroy();
    });
    const force = () => {
      server.closeAllConnections();
      for (const socket of owned) socket.destroy();
    };
    let closeTask: Promise<void> | undefined;
    const close = () =>
      (closeTask ??= new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING')
            reject(error);
          else resolve();
        });
        force();
      }));
    server.on('listening', () => {
      if (scope.closing) {
        server.close(() => {});
        force();
      }
    });
    scope.transport({ label: label + ' HTTP close', close, force });
    return server;
  };
  const listen = (server: http.Server, label: string) =>
    scope.start(
      label,
      () =>
        new Promise<void>((resolve, reject) => {
          const failed = (error: Error) => reject(error);
          server.once('error', failed);
          server.listen(0, '127.0.0.1', () => {
            server.off('error', failed);
            resolve();
          });
        }),
    );
  scope.transport({
    label: 'handler drain',
    close: async () => {
      await Promise.allSettled([...handlers]);
      if (handlers.size) throw new Error('AionUi fixture handler drain left active handlers');
    },
  });
  const stopProxy = () => {
    for (const request of proxyRequests) request.destroy(new FixtureCancelled());
    for (const response of proxyResponses) response.destroy(new FixtureCancelled());
    agent.destroy();
    for (const socket of proxySockets) socket.destroy();
  };
  scope.transport({
    label: 'proxy cleanup',
    close: async () => {
      stopProxy();
      await until(() => !proxyRequests.size && !proxyResponses.size && !proxySockets.size);
    },
    force: stopProxy,
  });
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
  let pairGate: FixtureBarrier | undefined;
  let proxyGate: FixtureBarrier | undefined;
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
  const core = makeServer('Core', async (req, res, signal) => {
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
    await proxyGate?.wait(signal);
    if (scope.closing || signal.aborted) throw new FixtureCancelled();
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
  await listen(core, 'Core listen');
  if (options.afterCoreListen) await scope.start('after Core listen', options.afterCoreListen);
  const corePort = (core.address() as { port: number }).port;
  const coreUrl = 'http://127.0.0.1:' + corePort;
  const server = makeServer('WebUI', async (req, res, signal) => {
    const url = req.url ?? '';
    if (url === '/auth/pair') {
      state.pairRequests++;
      let raw = '';
      for await (const chunk of req) raw += chunk;
      if (!state.pairApproved || JSON.parse(raw).code !== code) {
        send(res, 200, { status: 'denied' });
        return;
      }
      await pairGate?.wait(signal);
      if (scope.closing || signal.aborted) throw new FixtureCancelled();
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
    await new Promise<void>((resolve, reject) => {
      let upstream: http.IncomingMessage | undefined;
      const proxy = http.request(
        {
          host: '127.0.0.1',
          port: corePort,
          path: url,
          method: req.method,
          headers: { ...req.headers, host: '127.0.0.1:' + corePort },
          agent,
        },
        (response) => {
          upstream = response;
          proxyResponses.add(response);
          response.once('close', () => proxyResponses.delete(response));
          response.once('error', (error) => {
            if (
              (state.drop &&
                ['ECONNRESET', 'ERR_STREAM_PREMATURE_CLOSE'].includes(
                  (error as NodeJS.ErrnoException).code ?? '',
                )) ||
              expectedAbort(error, signal)
            ) {
              res.destroy();
              resolve();
            } else reject(error);
          });
          if (signal.aborted || scope.closing) {
            response.destroy(new FixtureCancelled());
            return;
          }
          res.writeHead(response.statusCode ?? 502, response.headers);
          response.pipe(res);
        },
      );
      proxyRequests.add(proxy);
      proxy.on('socket', (socket) => {
        proxySockets.add(socket);
        socket.once('close', () => proxySockets.delete(socket));
      });
      const abort = () => {
        proxy.destroy(new FixtureCancelled());
        upstream?.destroy(new FixtureCancelled());
      };
      signal.addEventListener('abort', abort, { once: true });
      proxy.once('error', (error) => {
        if (
          (state.drop &&
            ['ECONNRESET', 'ERR_STREAM_PREMATURE_CLOSE'].includes(
              (error as NodeJS.ErrnoException).code ?? '',
            )) ||
          expectedAbort(error, signal)
        ) {
          res.destroy();
          resolve();
        } else {
          reject(error);
          res.destroy();
        }
      });
      proxy.once('close', () => {
        proxyRequests.delete(proxy);
        signal.removeEventListener('abort', abort);
        resolve();
      });
      req.pipe(proxy);
      if (signal.aborted || scope.closing) abort();
    });
  });
  const wss = new WebSocketServer({ noServer: true });
  wssClients = () => sockets.size;
  const stopWs = () => {
    for (const socket of sockets) socket.terminate();
  };
  scope.transport({
    label: 'WebSocket close',
    close: () =>
      new Promise<void>((resolve, reject) => {
        wss.close((error) => (error ? reject(error) : resolve()));
        stopWs();
      }),
    force: stopWs,
  });
  server.on('upgrade', (req, socket, head) => {
    if (
      scope.closing ||
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
  await listen(server, 'WebUI listen');
  const url = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
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
    scope,
    close: () => scope.close(),
    snapshot,
    holdPair: () => {
      const gate = (pairGate = scope.barrier('held Pair'));
      return Object.assign(
        () => {
          if (pairGate === gate) pairGate = undefined;
          gate.release();
        },
        { entered: gate.entered },
      );
    },
    holdProxy: () => {
      const gate = (proxyGate = scope.barrier('held proxy'));
      return Object.assign(
        () => {
          if (proxyGate === gate) proxyGate = undefined;
          gate.release();
        },
        { entered: gate.entered },
      );
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

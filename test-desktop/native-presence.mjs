import { _electron as electron } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import path from 'node:path';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

// This harness only controls a fresh test profile and synthetic SDK clients.
const [mode, target, rootArg, listenIp = '127.0.0.1'] = process.argv.slice(2);
if (mode === 'worker') {
  let client, transport;
  process.on('message', async ({ id, action, params }) => {
    try {
      let result;
      if (action === 'initialize') {
        transport = new StreamableHTTPClientTransport(new URL(params.url), {
          requestInit: { headers: { authorization: 'Bearer ' + params.token } },
        });
        client = new Client({ name: 'native-presence-sdk', version: '1' });
        await client.connect(transport);
        result = { connected: true };
      } else if (action === 'call') result = await client.callTool(params);
      else if (action === 'close') {
        await transport.terminateSession();
        await client.close();
        result = { closed: true };
      } else throw new Error('Unknown worker action');
      process.send?.({ id, result });
    } catch (error) {
      process.send?.({ id, error: error.message });
    }
  });
} else if (mode === 'request') {
  const control = JSON.parse(await readFile(target, 'utf8'));
  // request <control.json> <action> [params.json]
  const actualParams = process.argv[5] ? JSON.parse(await readFile(process.argv[5], 'utf8')) : {};
  const response = await fetch(control.url, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + control.token, 'content-type': 'application/json' },
    body: JSON.stringify({ action: rootArg, params: actualParams }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  console.log(JSON.stringify(result));
} else if (mode === 'serve') {
  if (!target || !rootArg)
    throw new Error(
      'serve requires an executable path, fresh private directory and explicit local IP',
    );
  const root = path.resolve(rootArg),
    profile = path.join(root, 'profile');
  await mkdir(root, { recursive: false, mode: 0o700 });
  const require = createRequire(import.meta.url),
    packaged = target !== 'source';
  const launchEnv = { ...process.env };
  delete launchEnv.ELECTRON_RUN_AS_NODE;
  const application = await electron.launch({
    executablePath: packaged ? path.resolve(target) : require('electron'),
    args: [...(packaged ? [] : [process.cwd()]), '--data-dir', profile],
    cwd: root,
    env: launchEnv,
    timeout: 30000,
  });
  const page = await application.firstWindow();
  await page.getByText('Connect agents', { exact: true }).waitFor();
  const invoke = (method, params = {}) =>
    page.evaluate(({ method, params }) => window.interconnect.invoke(method, params), {
      method,
      params,
    });
  await invoke('saveNode', {
    nodeLabel: 'Native presence ' + process.platform,
    listenHost: listenIp,
  });
  const sessions = new Map(),
    agents = new Map();
  async function session(name = 'default') {
    if (sessions.has(name)) return sessions.get(name);
    const settings = JSON.parse(await readFile(path.join(profile, 'settings.json'), 'utf8'));
    const child = fork(fileURLToPath(import.meta.url), ['worker'], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    const pending = new Map();
    child.on('message', (message) => {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(message.error));
      else request.resolve(message.result);
    });
    child.on('exit', () => {
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error('SDK client exited'));
      }
      pending.clear();
    });
    const worker = {
      child,
      request: (action, params = {}) =>
        new Promise((resolve, reject) => {
          const id = randomUUID(),
            timer = setTimeout(() => {
              pending.delete(id);
              reject(new Error('SDK client request timed out'));
            }, 15000);
          pending.set(id, { resolve, reject, timer });
          child.send({ id, action, params });
        }),
    };
    await worker.request('initialize', {
      url: `http://127.0.0.1:${settings.mcpPort}/mcp`,
      token: settings.localToken,
    });
    sessions.set(name, worker);
    return worker;
  }
  async function call(sessionName, name, args) {
    const result = await (await session(sessionName)).request('call', { name, arguments: args });
    if (result.isError)
      throw new Error(
        result.content.find((value) => value.type === 'text')?.text ?? 'MCP tool failed',
      );
    return result.structuredContent;
  }
  async function shutdown() {
    for (const worker of sessions.values()) worker.child.kill();
    sessions.clear();
    await application.close();
    await rm(profile, { recursive: true, force: true });
    await rm(path.join(root, 'pairing.json'), { force: true });
    await rm(path.join(root, 'control.json'), { force: true });
  }
  async function command(action, params) {
    if (action === 'status') {
      const snapshot = await invoke('snapshot');
      return {
        packaged,
        version: await application.evaluate(({ app }) => app.getVersion()),
        nodeId: snapshot.nodeId,
        peerUrl: snapshot.peerUrl,
        peers: snapshot.peers,
        directories: snapshot.directories ?? [],
        agents: snapshot.agents.map((agent) => ({
          nickname: agent.nickname,
          bound: !!agent.binding,
          unread: agent.unread,
        })),
      };
    }
    if (action === 'pairing') {
      const snapshot = await invoke('snapshot'),
        code = await invoke('accessCode');
      const filename = path.join(root, 'pairing.json');
      await writeFile(
        filename,
        JSON.stringify({
          address: snapshot.peerUrl,
          code: code.code,
          nodeId: snapshot.nodeId,
          expiresAt: code.expiresAt,
        }),
        { mode: 0o600 },
      );
      return {
        file: filename,
        address: snapshot.peerUrl,
        nodeId: snapshot.nodeId,
        expiresAt: code.expiresAt,
      };
    }
    if (action === 'join')
      return invoke('connectPeer', { address: params.address, code: params.code });
    if (action === 'connect') {
      const handle = params.handle ?? params.nickname,
        sessionName = params.session ?? 'default';
      const previous = agents.get(params.reconnectHandle),
        args = { nickname: params.nickname };
      if (previous) args.connectionId = previous.result.binding.connectionId;
      const result = await call(sessionName, 'agent_connect', args);
      agents.set(handle, { session: sessionName, result });
      return {
        handle,
        status: result.status,
        nickname: result.nickname,
        generation: result.binding?.generation,
        warnings: result.warnings ?? [],
      };
    }
    if (action === 'transfer') {
      const agent = agents.get(params.handle);
      if (agent?.result.status !== 'nickname_in_use')
        throw new Error('No pending transfer for this test handle');
      const result = await call(agent.session, 'agent_connect', {
        nickname: agent.result.nickname,
        connectionId: agent.result.connectionId,
        transferId: agent.result.transferId,
        confirmTransfer: true,
      });
      agent.result = result;
      return {
        handle: params.handle,
        status: result.status,
        generation: result.binding?.generation,
      };
    }
    if (action === 'disconnect') {
      const agent = agents.get(params.handle);
      if (!agent?.result.binding) throw new Error('Unknown connected test handle');
      return call(agent.session, 'agent_disconnect', {
        connectionId: agent.result.binding.connectionId,
      });
    }
    if (action === 'send' || action === 'read') {
      const agent = agents.get(params.handle);
      if (!agent?.result.binding) throw new Error('Unknown connected test handle');
      return call(agent.session, action === 'send' ? 'agent_send' : 'agent_read', {
        connectionId: agent.result.binding.connectionId,
        ...(action === 'send'
          ? {
              recipientNode: params.recipientNode,
              recipientNickname: params.recipientNickname,
              text: params.text,
            }
          : {}),
      });
    }
    if (action === 'close' || action === 'crash') {
      const worker = sessions.get(params.session ?? 'default');
      if (!worker) throw new Error('Unknown test client session');
      if (action === 'close') await worker.request('close');
      worker.child.kill(action === 'crash' ? 'SIGKILL' : 'SIGTERM');
      sessions.delete(params.session ?? 'default');
      return { closed: true, mode: action };
    }
    if (action === 'catalog')
      return call(params.session ?? 'observer', 'agents_list', params.query ?? {});
    if (action === 'ui') {
      await page.getByRole('button', { name: 'Remote nodes', exact: true }).click();
      const snapshot = await invoke('snapshot'),
        directories = [];
      for (const directory of (snapshot.directories ?? []).filter((value) => !value.local))
        directories.push({
          nodeId: directory.nodeId,
          text: await page.getByTestId('directory-' + directory.nodeId).innerText(),
        });
      if (directories.length)
        await page.getByTestId('directory-' + directories[0].nodeId).scrollIntoViewIfNeeded();
      const screenshot = path.join(root, 'presence-' + Date.now() + '.png');
      await page.screenshot({ path: screenshot });
      return { directories, screenshot };
    }
    if (action === 'warning') {
      await page.getByRole('button', { name: 'Agents', exact: true }).click();
      await page.getByRole('button', { name: 'Add agent', exact: true }).click();
      await page.getByRole('textbox', { name: 'Agent name', exact: true }).fill(params.nickname);
      if (params.expectWarning) await page.getByRole('dialog').getByRole('alert').first().waitFor();
      const warnings = await page.getByRole('dialog').getByRole('alert').allTextContents();
      const enabled = await page.getByRole('button', { name: 'Add', exact: true }).isEnabled();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      return { warnings, addEnabled: enabled };
    }
    if (action === 'choose') {
      await page.getByRole('button', { name: 'Agents', exact: true }).click();
      await page
        .getByTestId('directory-' + params.nodeId)
        .getByText(params.nickname, { exact: true })
        .click();
      const node = await page
        .getByRole('combobox', { name: 'Recipient node', exact: true })
        .locator('..')
        .locator('input')
        .inputValue();
      const nickname = await page
        .getByRole('textbox', { name: 'Recipient agent name', exact: true })
        .inputValue();
      return { recipientNode: node, recipientNickname: nickname };
    }
    if (action === 'stop') {
      const result = await invoke('stop');
      for (const worker of sessions.values()) worker.child.kill();
      sessions.clear();
      return result;
    }
    if (action === 'start') return invoke(action);
    if (action === 'quit') {
      setTimeout(() => {
        server.close();
        void shutdown();
      }, 100);
      return { closing: true };
    }
    throw new Error('Unknown native test action');
  }
  const token = randomBytes(32).toString('hex');
  const server = http.createServer((request, response) => {
    void (async () => {
      const auth = request.headers.authorization ?? '',
        expected = 'Bearer ' + token;
      if (
        request.method !== 'POST' ||
        request.headers.origin ||
        Buffer.byteLength(auth) !== Buffer.byteLength(expected) ||
        !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
      ) {
        response.writeHead(401);
        response.end('{}');
        return;
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 65536) throw new Error('Test request too large');
        chunks.push(chunk);
      }
      const { action, params = {} } = JSON.parse(Buffer.concat(chunks).toString());
      const result = await command(action, params);
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(result));
    })().catch((error) => {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: error.message }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const control = path.join(root, 'control.json');
  await writeFile(
    control,
    JSON.stringify({ url: `http://127.0.0.1:${server.address().port}`, token }),
    { mode: 0o600 },
  );
  console.log(JSON.stringify({ control, packaged, ready: true }));
  process.once('SIGTERM', () => {
    server.close();
    void shutdown();
  });
} else throw new Error('Use serve, request or worker');

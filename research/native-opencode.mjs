import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as tcpServer } from 'node:net';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { transform } from 'esbuild';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { NodeService } from '../desktop/core/service.js';
import { SettingsFile } from '../desktop/core/settings.js';
import { OpenCodeV2SetupService } from '../desktop/core/mcp-setup.js';
const [binary, mode = 'default', scenario = 'standard'] = process.argv.slice(2);
if (
  !binary ||
  !path.isAbsolute(binary) ||
  !['direct', 'default'].includes(mode) ||
  !['standard', 'deep'].includes(scenario)
)
  throw Error('Usage: native-opencode.mjs /absolute/path/to/opencode default|direct [deep]');
const exe = binary;
const deep = scenario === 'deep';
const dir = await mkdtemp(path.join(tmpdir(), 'opra-native-')),
  project = path.join(dir, 'first'),
  other = path.join(dir, 'second');
const state = path.join(dir, 'node'),
  configDir = path.join(dir, 'config', 'opencode'),
  configPath = path.join(configDir, 'opencode.json');
for (const p of [
  project,
  other,
  state,
  configDir,
  ...['home', 'data', 'cache', 'state', 'runtime', 'tmp'].map((x) => path.join(dir, x)),
])
  await mkdir(p, { recursive: true, mode: 0o700 });
const env = {
  HOME: path.join(dir, 'home'),
  PATH: '/usr/bin:/bin',
  TMPDIR: path.join(dir, 'tmp'),
  XDG_CONFIG_HOME: path.join(dir, 'config'),
  XDG_DATA_HOME: path.join(dir, 'data'),
  XDG_CACHE_HOME: path.join(dir, 'cache'),
  XDG_STATE_HOME: path.join(dir, 'state'),
  XDG_RUNTIME_DIR: path.join(dir, 'runtime'),
  OPENCODE_CONFIG: configPath,
  OPENCODE_DISABLE_AUTOUPDATE: '1',
  OPENCODE_DISABLE_MODELS_FETCH: '1',
  OPENCODE_PASSWORD: 'opra-fixture-only',
  OPENCODE_SERVER_PASSWORD: 'opra-fixture-only',
  QA_MOCK_KEY: 'fixture',
  HTTP_PROXY: 'http://127.0.0.1:9',
  HTTPS_PROXY: 'http://127.0.0.1:9',
  ALL_PROXY: 'http://127.0.0.1:9',
  NO_PROXY: 'localhost,127.0.0.1',
};
const logs = [];
const requests = [];
let host, service;
let busySeen = () => {},
  releaseBusy,
  allowTransfer = false,
  transferCount = 0,
  conflictCount = 0;
const busyGate = new Promise((resolve) => {
  releaseBusy = resolve;
});
const children = new Set();
const localSpawn = (args, cwd = project) => {
  const child = spawn(exe, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
};
async function until(check, ms = 18000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await delay(100);
  }
  throw Error('Timed out waiting for ' + String(check).slice(0, 110));
}
const mock = createServer(async (req, res) => {
  let body = '';
  for await (const c of req) body += c;
  let input;
  try {
    input = JSON.parse(body);
  } catch {
    res.writeHead(404);
    res.end();
    return;
  }
  const messages = input.messages ?? [],
    last = messages.at(-1);
  const names = (input.tools ?? []).map((t) => t.function?.name);
  const current = JSON.stringify(last?.content ?? '');
  if (last?.role === 'user' && current.includes('OPRA_HOLD_BUSY') && names.length) {
    busySeen();
    await busyGate;
  }
  const nick = /OPRA_BIND_([A-Z]+)/.exec(current)?.[1];
  let tool, args;
  const nativeTool = (parameters) => {
    if (names.includes('ncf_agent_interconnect_agent_connect')) {
      tool = 'ncf_agent_interconnect_agent_connect';
      args = parameters;
    } else if (names.includes('execute')) {
      tool = 'execute';
      args = {
        code:
          'return await tools.ncf_agent_interconnect.agent_connect(' +
          JSON.stringify(parameters) +
          ')',
      };
    }
  };
  if (last?.role === 'user' && nick) nativeTool({ nickname: 'QA ' + nick });
  if (last?.role === 'tool' && current.includes('nickname_in_use')) {
    conflictCount++;
    if (allowTransfer) {
      const detail = JSON.parse(last.content);
      const choice = detail.choices.find((c) => c.mode === 'transfer');
      assert.ok(choice, 'transfer choice returned');
      nativeTool({
        nickname: detail.nickname,
        connectionId: detail.connectionId,
        transferId: choice.transferId,
        confirmTransfer: true,
      });
      transferCount++;
    }
  }
  requests.push({
    kind: tool ?? 'text',
    incoming: last?.role === 'user' && current.includes('QA exact session message'),
  });
  const id = 'chatcmpl-qa' + requests.length;
  const fn = tool ? { name: tool, arguments: JSON.stringify(args) } : undefined;
  if (!input.stream) {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        id,
        object: 'chat.completion',
        model: 'mock',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'QA complete' },
            finish_reason: 'stop',
          },
        ],
      }),
    );
    return;
  }
  res.setHeader('Content-Type', 'text/event-stream');
  const send = (delta, finish_reason = null) =>
    res.write(
      'data: ' +
        JSON.stringify({
          id,
          object: 'chat.completion.chunk',
          created: 1,
          model: 'mock',
          choices: [{ index: 0, delta, finish_reason }],
        }) +
        '\n\n',
    );
  send(
    tool
      ? {
          role: 'assistant',
          tool_calls: [{ index: 0, id: 'call_' + randomUUID(), type: 'function', function: fn }],
        }
      : { role: 'assistant', content: 'QA complete' },
  );
  send({}, tool ? 'tool_calls' : 'stop');
  res.end('data: [DONE]\n\n');
});
const localPort = async () => {
  const s = tcpServer();
  s.listen(0, '127.0.0.1');
  await once(s, 'listening');
  const port = s.address().port;
  await new Promise((ok) => s.close(ok));
  return port;
};
async function run(cwd, id, word) {
  const child = localSpawn(
    ['run', '--server', base, '--session', id, '--model', 'round/mock', '--format', 'json', word],
    cwd,
  );
  child.stderr.resume();
  child.stdout.resume();
  const timer = setTimeout(() => child.kill(), 85000);
  try {
    const [code] = await once(child, 'exit');
    if (code !== 0) throw Error('OpenCode run exited with ' + code);
  } finally {
    clearTimeout(timer);
  }
}
let base = '';
async function startHost(port) {
  host = localSpawn(['serve', '--hostname', '127.0.0.1', '--port', String(port), '--print-logs']);
  for (const p of [host.stdout, host.stderr])
    p.on('data', (x) => logs.push(...x.toString().split('\n').filter(Boolean)));
  await until(async () => {
    try {
      const r = await fetch(base + '/api/health');
      return r.status < 500;
    } catch {
      return false;
    }
  });
}

try {
  const banner = execFileSync(exe, ['--version'], {
    env,
    cwd: project,
    encoding: 'utf8',
    timeout: 10000,
  }).trim();
  const version = /^(?:opencode\s+)?v?(2\.\d+\.\d+)$/i.exec(banner)?.[1];
  assert.ok(version, 'Expected a stable OpenCode v2 CLI');
  mock.listen(0, '127.0.0.1');
  await once(mock, 'listening');
  const initial = {
    model: 'round/mock',
    providers: {
      round: {
        env: ['QA_MOCK_KEY'],
        package: '@opencode/ai/providers/openai-compatible',
        settings: { baseURL: 'http://127.0.0.1:' + mock.address().port + '/v1' },
        models: {
          mock: {
            capabilities: { tools: true, input: ['text'], output: ['text'] },
            limit: { context: 32768, output: 1024 },
          },
        },
      },
    },
  };
  await writeFile(configPath, JSON.stringify(initial), { mode: 0o600 });
  const settings = new SettingsFile(state);
  await settings.load();
  settings.value.mcpPort = 0;
  settings.value.peerPort = 0;
  await settings.save();
  service = new NodeService(state, {
    codexSockets: () => [],
    lanDiscovery: { interfaces: () => [] },
  });
  await service.open();
  const asset = (
    await transform(
      await readFile(new URL('../desktop/integrations/opencode-v2.ts', import.meta.url), 'utf8'),
      { loader: 'ts', format: 'esm', target: 'es2022' },
    )
  ).code;
  const setup = new OpenCodeV2SetupService({
    stateDirectory: state,
    home: dir,
    env: {},
    instructions: () => {
      throw Error('v1 setup unexpected');
    },
    asset: async () => asset,
  });
  const target = {
    major: 2,
    installationId: null,
    installationPath: null,
    profilePath: configDir,
    configurationPath: configPath,
  };
  const preview = await setup.v2Preview('qa', target);
  const applied = await setup.v2Apply('qa', preview.planId, target, false);
  assert.equal(applied.status, 'applied');
  if (mode === 'direct') {
    const extra = path.join(dir, 'qa-direct');
    await mkdir(extra);
    await writeFile(
      path.join(extra, 'package.json'),
      JSON.stringify({ name: 'qa-direct', type: 'module', exports: './index.js' }),
    );
    await writeFile(
      path.join(extra, 'index.js'),
      "export default { id: 'qa-direct', async setup(ctx) {const r=await ctx.mcp.transform(e=>{if(e.get('ncf_agent_interconnect'))e.update('ncf_agent_interconnect',v=>{v.codemode=false})});return ()=>r.dispose()} }",
    );
    const configuration = JSON.parse(await readFile(configPath, 'utf8'));
    configuration.plugins.push({ package: pathToFileURL(extra).href, options: {} });
    await writeFile(configPath, JSON.stringify(configuration));
  }
  const port = await localPort();
  base = 'http://127.0.0.1:' + port;
  await startHost(port);
  await run(project, 'ses_opraqa_a', 'QA_WARMUP');
  await until(() =>
    logs.some((l) => l.includes('mcp connected') && l.includes(project.split('/').at(-1))),
  );
  await run(project, 'ses_opraqa_a', 'OPRA_BIND_FIRST');
  assert.ok(service.store.bindingForNickname('QA FIRST'), 'first binding');
  await run(other, 'ses_opraqa_b', 'QA_WARMUP');
  await until(() =>
    logs.some((l) => l.includes('mcp connected') && l.includes(other.split('/').at(-1))),
  );
  await run(other, 'ses_opraqa_b', 'OPRA_BIND_SECOND');
  assert.ok(service.store.bindingForNickname('QA SECOND'), 'second binding');
  await run(project, 'ses_opraqa_c', 'OPRA_BIND_SIBLING');
  assert.ok(service.store.bindingForNickname('QA SIBLING'), 'same-directory sibling');
  const a = service.store.bindingForNickname('QA FIRST'),
    b = service.store.bindingForNickname('QA SECOND');
  assert.equal(a.chatId, 'ses_opraqa_a');
  assert.equal(b.chatId, 'ses_opraqa_b');
  assert.notEqual(a.adapterId, b.adapterId);
  const sibling = service.store.bindingForNickname('QA SIBLING');
  assert.equal(sibling.chatId, 'ses_opraqa_c');
  assert.notEqual(sibling.adapterId, a.adapterId);
  await until(
    () =>
      service.adapters.get(a.adapterId).status().state === 'ready' &&
      service.adapters.get(b.adapterId).status().state === 'ready',
  );
  const files = [];
  for (const [n, bytes] of [
    ['first.txt', Buffer.from('QA message attachment')],
    ['second.bin', Buffer.from([0, 1, 127, 255])],
  ]) {
    const { localPath } = await service.stageAttachment(a.connectionId, n);
    await writeFile(localPath, bytes);
    files.push({ path: localPath, digest: createHash('sha256').update(bytes).digest('hex') });
  }
  const sent = await service.send({
    connectionId: a.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'QA SECOND',
    text: 'QA exact session message',
    files: files.map((f) => f.path),
  });
  await until(() => service.store.get(sent.id, 'in')?.state === 'processed');
  await until(() => requests.some((r) => r.incoming));
  assert.ok(
    requests.some(
      (r) => r.kind === (mode === 'direct' ? 'ncf_agent_interconnect_agent_connect' : 'execute'),
    ),
    'requested tool exposure',
  );
  for (const { digest } of files) {
    const copy = await service.receiveFile(b.connectionId, sent.id, digest);
    assert.equal(
      createHash('sha256')
        .update(await readFile(copy.localPath))
        .digest('hex'),
      digest,
    );
  }
  if (deep) {
    const entered = new Promise((resolve) => {
      busySeen = resolve;
    });
    const busyRun = run(other, 'ses_opraqa_b', 'OPRA_HOLD_BUSY');
    await Promise.race([
      entered,
      delay(10000).then(() => {
        throw Error('busy host not entered');
      }),
    ]);
    const queued = await service.send({
      connectionId: a.connectionId,
      recipientNode: service.settings.value.nodeId,
      recipientNickname: 'QA SECOND',
      text: 'unique queued message',
    });
    assert.notEqual(service.store.get(queued.id, 'in')?.state, 'processed');
    releaseBusy();
    await busyRun;
    await until(() => service.store.get(queued.id, 'in')?.state === 'processed');
    const oldHost = host;
    const exited = once(oldHost, 'exit');
    oldHost.kill();
    await exited;
    await until(() => service.opencodeV2.runtime().length === 0);
    await service.stop();
    assert.equal(service.running, false);
    await assert.rejects(fetch(service.snapshot().mcpUrl, { signal: AbortSignal.timeout(1000) }));
    await service.start();
    const restartLine = logs.length;
    await startHost(port);
    await run(other, 'ses_opraqa_b', 'QA_WARMUP_RESTART');
    await until(() =>
      logs
        .slice(restartLine)
        .some((l) => l.includes('mcp connected') && l.includes(other.split('/').at(-1))),
    );
    await run(other, 'ses_opraqa_b', 'OPRA_BIND_SECOND');
    assert.ok(conflictCount > 0, 'explicit transfer challenge after restart');
    assert.equal(service.store.bindingForNickname('QA SECOND').connectionId, b.connectionId);
    allowTransfer = true;
    await run(other, 'ses_opraqa_b', 'OPRA_BIND_SECOND');
    const restored = service.store.bindingForNickname('QA SECOND');
    assert.notEqual(restored.connectionId, b.connectionId);
    assert.equal(restored.chatId, b.chatId);
    assert.equal(transferCount, 1);
    for (const { digest } of files) {
      const copy = await service.receiveFile(restored.connectionId, sent.id, digest);
      assert.equal(
        createHash('sha256')
          .update(await readFile(copy.localPath))
          .digest('hex'),
        digest,
      );
    }
  }
  console.log(
    JSON.stringify({
      version,
      mode,
      bindings: 3,
      locations: 2,
      receipt: true,
      wake: true,
      hashes: files.map((x) => x.digest),
      deep,
    }),
  );
} catch (err) {
  console.error(
    err instanceof Error
      ? err.message.replace(/[a-f\d-]{32,}/gi, '[private fixture value]')
      : 'Native check failed',
  );
  process.exitCode = 1;
} finally {
  releaseBusy();
  for (const child of children) child.kill();
  if (host?.exitCode === null) await Promise.race([once(host, 'exit'), delay(1500)]);
  for (const child of children) child.kill('SIGKILL');
  await service?.close();
  mock.closeAllConnections();
  await new Promise((resolve) => mock.close(resolve));
  await rm(dir, { recursive: true, force: true });
}

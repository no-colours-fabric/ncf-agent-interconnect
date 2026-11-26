import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NodeService } from '../desktop/core/service.js';
import { McpSetupPaths } from '../desktop/core/mcp-setup-paths.js';
import { CodexDesktopAdapter, codexEndpoints } from '../desktop/core/codex-adapter.js';
import { CodexQueueAdapter, codexQueueLocator } from '../desktop/core/codex-queue.js';
import { agentMessageText, type EventInput } from '../desktop/core/adapters.js';
import { codexQueueWitness } from '../desktop/core/delivery-attempt.js';
import type { AdapterProfile } from '../desktop/shared/contracts.js';

const windows = { skip: process.platform !== 'win32' };
async function until(check: () => boolean) {
  const deadline = Date.now() + 2500;
  while (!check()) {
    if (Date.now() > deadline) throw Error('Isolated legacy recovery did not finish');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function fixture(t: TestContext) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'ncf-legacy-recovery-')));
  const home = path.join(directory, 'selected-home');
  await mkdir(home);
  const socket = codexQueueLocator(home);
  const profile: AdapterProfile = {
    id: randomUUID(),
    label: 'Saved ChatGPT',
    kind: 'codex-desktop',
    socket: codexEndpoints()[0],
    threadId: randomUUID(),
  };
  const oldStatus = {
    id: profile.id,
    label: profile.label,
    kind: 'codex-desktop' as const,
    state: 'error' as const,
    error: 'Codex IPC: ENOENT',
    capabilities: {
      wakeIdle: false,
      receiveActive: false,
      nativeDisplay: false,
      exactSession: false,
    },
  };
  // Stub only native transport. No test ever connects to the real legacy pipe,
  // discovers a working profile or sends a message to a live agent.
  t.mock.method(CodexDesktopAdapter.prototype, 'start', async () => {});
  t.mock.method(CodexDesktopAdapter.prototype, 'status', () => structuredClone(oldStatus));
  const service = new NodeService(path.join(directory, 'node'), {
    codexSockets: () => [],
    wakeCodexChat: async () => {},
  });
  await service.open();
  t.after(async () => {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  });
  const configuration = path.join(home, 'config.toml');
  await writeFile(configuration, service.clientInstructions('codex').configuration);
  const paths = new McpSetupPaths(service.directory);
  await paths.remember('codex', configuration);
  service.settings.value.adapters.push(profile);
  await service.settings.save();
  await service.adapters.add(profile);
  const receiver = service.connect({
    nickname: 'Соня Ω',
    client: 'Codex',
    adapterId: profile.id,
    chatId: profile.threadId,
  });
  const sender = service.connect({ nickname: 'Fixture sender', client: 'MCP' });
  assert.equal(receiver.status, 'connected');
  assert.equal(sender.status, 'connected');
  if (receiver.status !== 'connected' || sender.status !== 'connected') throw Error('fixture');
  let available = false;
  let afterProbe: (() => Promise<void>) | undefined;
  let uncertain = false;
  const probes: AdapterProfile[] = [],
    offers: EventInput[] = [];
  const projections: (() => void)[] = [];
  t.mock.method(CodexQueueAdapter.prototype, 'start', async function (this: CodexQueueAdapter) {
    probes.push(structuredClone(this.profile));
    assert.equal(this.profile.socket, socket);
    assert.equal(this.profile.threadId, receiver.binding.chatId);
    if (!available) throw Error('Synthetic shared owner unavailable');
    await afterProbe?.();
  });
  t.mock.method(CodexQueueAdapter.prototype, 'status', function (this: CodexQueueAdapter) {
    return {
      ...oldStatus,
      id: this.profile.id,
      state: 'ready',
      error: null,
      capabilities: {
        wakeIdle: true,
        receiveActive: true,
        nativeDisplay: true,
        exactSession: true,
      },
    };
  });
  t.mock.method(CodexQueueAdapter.prototype, 'deliver', async (input: EventInput) => {
    input.beforeRelease!(agentMessageText(input), {
      messageId: input.deliveryAttempt!.id,
      runtime: codexQueueWitness,
      session: profile.threadId!,
    });
    offers.push(input);
    return { state: uncertain ? ('uncertain' as const) : ('queued' as const) };
  });
  t.mock.method(
    CodexQueueAdapter.prototype,
    'observeDelivery',
    (_attempt: unknown, current: () => boolean, admit: () => void) => {
      projections.push(() => {
        assert.equal(current(), true);
        admit();
      });
    },
  );
  return {
    service,
    profile,
    configuration,
    paths,
    home,
    socket,
    probes,
    offers,
    projections,
    binding: receiver.binding,
    available: () => {
      available = true;
    },
    afterProbe: (callback: () => Promise<void>) => {
      afterProbe = callback;
    },
    uncertain: () => {
      uncertain = true;
    },
    send: () =>
      service.send({
        connectionId: sender.binding.connectionId,
        recipientNode: service.settings.value.nodeId,
        recipientNickname: receiver.nickname,
        text: 'One exact full message — ё / Ω / 你好.',
      }),
  };
}

test(
  'Windows automatic legacy recovery uses the verified selected socket and keeps the original unread message',
  windows,
  async (t) => {
    const f = await fixture(t);
    const message = await f.send();
    await until(() => f.probes.length === 1);
    assert.equal(f.offers.length, 0);
    assert.equal(f.service.store.get(message.id, 'in')?.state, 'ready');
    f.available();
    f.service.desktopChatGptLaunched();
    await until(() => f.projections.length === 1);
    assert.equal(f.offers.length, 1);
    assert.equal(f.offers[0].messageId, message.id);
    assert.match(agentMessageText(f.offers[0]), /One exact full message — ё \/ Ω \/ 你好\./);
    assert.deepEqual(f.service.store.assertOwner(f.binding.connectionId).binding, f.binding);
    assert.deepEqual(
      f.service.settings.value.adapters.find((a) => a.id === f.profile.id),
      {
        ...f.profile,
        socket: f.socket,
        codexQueue: true,
      },
    );
    assert.equal(
      f.service.store.get(message.id, 'in')?.state,
      'ready',
      'A queue offer is not receipt',
    );
    f.projections[0]();
    await until(() => f.service.store.get(message.id, 'in')?.state === 'processed');
    f.service.desktopChatGptLaunched();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(f.offers.length, 1);
    assert.deepEqual(f.service.store.assertOwner(f.binding.connectionId).binding, f.binding);
  },
);

test(
  'Windows legacy recovery refuses an unconfigured selected profile without changing the binding',
  windows,
  async (t) => {
    const f = await fixture(t);
    await writeFile(f.configuration, '# A different application configuration\n');
    f.available();
    const message = await f.send();
    await Promise.allSettled([...f.service['jobs']]);
    assert.equal(f.probes.length, 0);
    assert.equal(f.offers.length, 0);
    assert.deepEqual(
      f.service.settings.value.adapters.find((a) => a.id === f.profile.id),
      f.profile,
    );
    assert.deepEqual(f.service.store.assertOwner(f.binding.connectionId).binding, f.binding);
    assert.equal(f.service.store.get(message.id, 'in')?.state, 'ready');
  },
);

test(
  'a profile change during the exact-chat probe cannot migrate the old Windows binding',
  windows,
  async (t) => {
    const f = await fixture(t);
    const other = path.join(path.dirname(f.home), 'other-home');
    await mkdir(other);
    const otherConfiguration = path.join(other, 'config.toml');
    await writeFile(otherConfiguration, f.service.clientInstructions('codex').configuration);
    f.available();
    f.afterProbe(() => f.paths.remember('codex', otherConfiguration));
    const message = await f.send();
    await Promise.allSettled([...f.service['jobs']]);
    assert.equal(f.probes.length, 1);
    assert.equal(f.offers.length, 0);
    assert.deepEqual(
      f.service.settings.value.adapters.find((a) => a.id === f.profile.id),
      f.profile,
    );
    assert.deepEqual(f.service.store.assertOwner(f.binding.connectionId).binding, f.binding);
    assert.equal(f.service.store.get(message.id, 'in')?.state, 'ready');
  },
);

test(
  'an uncertain message is observed by its original witness instead of resent after a launch event',
  windows,
  async (t) => {
    const f = await fixture(t);
    f.available();
    f.uncertain();
    const message = await f.send();
    await until(() => f.projections.length === 1);
    await Promise.allSettled([...f.service['jobs']]);
    assert.equal(f.offers.length, 1);
    assert.equal(f.offers[0].messageId, message.id);
    const attempt = f.offers[0].deliveryAttempt!;
    assert.equal(f.service.store.deliveryAttempt(attempt.id).meta.phase, 'uncertain');
    f.service.desktopChatGptLaunched();
    await Promise.allSettled([...f.service['jobs']]);
    assert.equal(f.offers.length, 1);
    assert.equal(f.service.store.get(message.id, 'in')?.state, 'ready');
    f.projections[0]();
    await until(() => f.service.store.get(message.id, 'in')?.state === 'processed');
    f.service.desktopChatGptLaunched();
    await Promise.allSettled([...f.service['jobs']]);
    assert.equal(f.offers.length, 1);
    assert.deepEqual(f.service.store.assertOwner(f.binding.connectionId).binding, f.binding);
  },
);

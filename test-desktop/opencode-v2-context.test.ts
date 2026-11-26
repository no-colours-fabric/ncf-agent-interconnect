import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { setImmediate as tick } from 'node:timers/promises';
import { openCodeV2ProductFixture, OpenCodeV2HostFixture } from './fixtures/opencode-v2-host.js';
import { startOpenCodeV2 } from '../desktop/integrations/opencode-v2.js';

test('native session metadata remains compatible across the 2.0.4 boundary', async (t) => {
  const { client, host } = await openCodeV2ProductFixture(t);
  const sessionID = host.addSession('ses_metadata');
  for (const _meta of [
    { sessionID },
    { 'ai.opencode/sessionID': sessionID },
    { sessionID, 'ai.opencode/sessionID': sessionID },
  ]) {
    const result = await client.callTool({ name: 'node_status', arguments: {}, _meta });
    assert.equal(result.isError, undefined);
  }
  const result = await client.callTool({
    name: 'node_status',
    arguments: {},
    _meta: { sessionID, 'ai.opencode/sessionID': 'ses_other' },
  });
  assert.equal(result.isError, true);
});

test('setup runtime diagnostics follow the active target and node lifecycle', async (t) => {
  const { service, provision, target, setup, handle } = await openCodeV2ProductFixture(t);
  const status = await setup.v2Status(target);
  assert.equal(status.generation, provision.generation);
  const runtime = () => service.snapshot({ lanDiscovery: true }).openCodeV2Runtime!;
  assert.equal(runtime()[0]?.state, 'registered');
  await handle.dispose();
  await new Promise<void>((resolve, reject) => {
    if (!runtime().length) return resolve();
    const timer = setTimeout(() => reject(new Error('Bridge remained registered')), 2000);
    service.once('change', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  assert.deepEqual(runtime(), []);
  const host = new OpenCodeV2HostFixture();
  host.context.options = { targetId: provision.targetId, generation: provision.generation };
  host.context.app.version = '3.0.0';
  await assert.rejects(startOpenCodeV2(host.context, provision), /V2_HOST_UNSUPPORTED/);
  assert.deepEqual(runtime(), [
    {
      targetId: provision.targetId,
      generation: provision.generation,
      state: 'unsupported',
      version: '3.0.0',
    },
  ]);
  await service.stop();
  assert.equal(service.snapshot().running, false);
  assert.deepEqual(runtime(), []);
});

test('a stopped node prevents registration in one location and the same setup works after restart', async (t) => {
  const { service, provision, handle } = await openCodeV2ProductFixture(t);
  await handle.dispose();
  await service.stop();
  const start = async () => {
    const host = new OpenCodeV2HostFixture();
    host.context.options = { targetId: provision.targetId, generation: provision.generation };
    host.context.app.version = '2.3.2';
    return startOpenCodeV2(host.context, provision, { timeoutMs: 2000 });
  };
  await assert.rejects(start(), /V2_REGISTRATION_UNAVAILABLE/);
  assert.deepEqual(service.opencodeV2.runtime(), []);
  await service.start();
  const restarted = await start();
  t.after(() => restarted.dispose());
  assert.equal(service.opencodeV2.runtime()[0]?.version, '2.3.2');
});

test('v2 own endpoint rejects generic bearer and generic endpoint rejects target credential', async (t) => {
  const { service, configuration } = await openCodeV2ProductFixture(t),
    remote = configuration.mcp.servers.ncf_agent_interconnect;
  const before = service.settings.value.adapters.length;
  assert.equal(
    (
      await fetch(remote.url, {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + service.settings.value.localToken,
          'content-type': 'application/json',
        },
        body: '{}',
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(service.snapshot().mcpUrl, {
        method: 'POST',
        headers: remote.headers,
        body: '{}',
      })
    ).status,
    401,
  );
  assert.equal(service.settings.value.adapters.length, before);
});
test('v2 handler needs exact host metadata; model contextToken cannot choose another chat', async (t) => {
  const { service, host, client, call } = await openCodeV2ProductFixture(t),
    id = host.addSession('ses_own');
  const missing = await client.callTool({
    name: 'agent_connect',
    arguments: { nickname: 'Missing metadata' },
  });
  assert.equal(missing.isError, true);
  assert.equal(host.waitCalls, 0);
  const foreign = await call('ses_absent', 'agent_connect', { nickname: 'Unknown native' });
  assert.equal(foreign.isError, true);
  assert.equal(host.waitCalls, 0);
  const correct = await call(id, 'agent_connect', {
    nickname: 'Exact native',
    contextToken: randomUUID(),
  });
  assert.equal(correct.isError, undefined, JSON.stringify(correct));
  const binding = service.store.list().find((agent) => agent.nickname === 'Exact native')!.binding!;
  assert.equal(binding.chatId, id);
  assert.equal(binding.client, 'OpenCode v2');
});
test('foreign tool identity and another native session cannot operate an existing v2 mailbox', async (t) => {
  const { service, host, call } = await openCodeV2ProductFixture(t),
    a = host.addSession('ses_A'),
    b = host.addSession('ses_B');
  const unknown = await call(a, 'foreign_agent_connect', { nickname: 'Must not connect' });
  assert.equal(unknown.isError, true);
  assert.equal(host.waitCalls, 0);
  const connected = await call(a, 'agent_connect', { nickname: 'Own mailbox' });
  assert.equal(connected.isError, undefined, JSON.stringify(connected));
  const owner = service.store.list().find((agent) => agent.nickname === 'Own mailbox')!;
  const result = await call(b, 'agent_history', { connectionId: owner.binding!.connectionId });
  assert.equal(result.isError, true);
  const rename = { connectionId: owner.binding!.connectionId, nickname: 'Новое v2 имя' };
  assert.equal((await call(b, 'agent_rename', rename)).isError, true);
  assert.equal(
    (await call(a, 'agent_rename', { ...rename, contextToken: randomUUID() })).isError,
    true,
  );
  assert.deepEqual((await call(a, 'agent_rename', rename)).structuredContent, {
    status: 'renamed',
    nickname: rename.nickname,
  });
  assert.deepEqual(service.store.assertOwner(rename.connectionId).binding, owner.binding);
  assert.equal(host.prompts.length, 0);
});
test('location routes isolate two concurrent hosts and release only the closing host', async (t) => {
  const { service, host, provision, call, connectHost, configuration } =
    await openCodeV2ProductFixture(t);
  const id = host.addSession();
  const connected = await call(id, 'agent_connect', { nickname: 'First location' });
  assert.equal(connected.isError, undefined, JSON.stringify(connected));
  const sibling = host.addSession('ses_sibling');
  assert.equal(
    (await call(sibling, 'agent_connect', { nickname: 'Sibling session' })).isError,
    undefined,
  );
  const second = new OpenCodeV2HostFixture('/isolated/another');
  second.context.options = { targetId: provision.targetId, generation: provision.generation };
  const handle = await startOpenCodeV2(second.context, provision);
  t.after(() => handle.dispose());
  const other = await connectHost(second);
  second.addSession(id);
  const meta = { 'ai.opencode/sessionID': id };
  const foreign = await other.callTool({
    name: 'agent_history',
    arguments: { connectionId: service.store.bindingForNickname('First location')!.connectionId },
    _meta: meta,
  });
  assert.equal(foreign.isError, true);
  assert.equal(
    (
      await other.callTool({
        name: 'agent_connect',
        arguments: { nickname: 'Second location' },
        _meta: meta,
      })
    ).isError,
    undefined,
  );
  const bootstrap = await connectHost();
  const diagnostic = await bootstrap.callTool({ name: 'node_status', arguments: {} });
  assert.deepEqual(diagnostic.structuredContent, {
    node: 'ready',
    openCodeV2: 'instance-route-required',
  });
  assert.equal(
    (
      await bootstrap.callTool({
        name: 'agent_connect',
        arguments: { nickname: 'Bootstrap' },
        _meta: meta,
      })
    ).isError,
    true,
  );
  const firstRoute = host.route(configuration.mcp.servers.ncf_agent_interconnect);
  const otherRoute = second.route(configuration.mcp.servers.ncf_agent_interconnect);
  assert.notEqual(firstRoute.url, otherRoute.url);
  const wrong = await fetch(firstRoute.url, {
    method: 'POST',
    headers: otherRoute.headers,
    body: '{}',
  });
  assert.equal(wrong.status, 401);
  await handle.dispose();
  assert.equal(
    (
      await call(id, 'agent_history', {
        connectionId: service.store.bindingForNickname('First location')!.connectionId,
      })
    ).isError,
    undefined,
  );
  assert.equal(
    (await fetch(otherRoute.url, { method: 'POST', headers: otherRoute.headers, body: '{}' }))
      .status,
    401,
  );
});

test('two live instances opening the same native chat suspend just that chat until one closes', async (t) => {
  const { host, service, call, provision, connectHost } = await openCodeV2ProductFixture(t);
  const shared = host.addSession('ses_shared'),
    sibling = host.addSession('ses_independent');
  assert.equal(
    (await call(shared, 'agent_connect', { nickname: 'Shared chat' })).isError,
    undefined,
  );
  assert.equal(
    (await call(sibling, 'agent_connect', { nickname: 'Independent chat' })).isError,
    undefined,
  );
  const original = service.store.bindingForNickname('Shared chat')!;
  const second = new OpenCodeV2HostFixture(host.workspace);
  second.addSession(shared);
  second.context.options = { targetId: provision.targetId, generation: provision.generation };
  const handle = await startOpenCodeV2(second.context, provision);
  t.after(() => handle.dispose());
  const client = await connectHost(second);
  const duplicate = await client.callTool({
    name: 'agent_connect',
    arguments: { nickname: 'Shared chat' },
    _meta: { 'ai.opencode/sessionID': shared },
  });
  assert.equal(duplicate.isError, true);
  assert.equal(service.store.bindingForNickname('Shared chat')?.adapterId, original.adapterId);
  assert.equal(service.adapters.get(original.adapterId).status().capabilities.wakeIdle, false);
  assert.equal((await call(shared, 'node_status', {})).isError, true);
  assert.equal((await call(sibling, 'node_status', {})).isError, undefined);
  await handle.dispose();
  assert.equal(
    (await call(shared, 'agent_connect', { nickname: 'Shared chat' })).isError,
    undefined,
  );
  assert.equal(
    service.store.bindingForNickname('Shared chat')?.connectionId,
    original.connectionId,
  );
});
test('already installed single-location legacy plugin retains its original endpoint and exact chat', async (t) => {
  const { host, call } = await openCodeV2ProductFixture(t, { legacy: true });
  const id = host.addSession('ses_legacy');
  assert.equal((await call(id, 'agent_connect', { nickname: 'Legacy host' })).isError, undefined);
  assert.equal(
    (await call('ses_unknown', 'agent_connect', { nickname: 'Foreign chat' })).isError,
    true,
  );
});
test('owner reconfigure invalidates old native transport without changing the saved binding', async (t) => {
  const { service, host, call, setup, target } = await openCodeV2ProductFixture(t);
  const id = host.addSession();
  const connected = await call(id, 'agent_connect', { nickname: 'Reconfigure fixture' });
  assert.equal(connected.isError, undefined, JSON.stringify(connected));
  const binding = service.store
    .list()
    .find((agent) => agent.nickname === 'Reconfigure fixture')!.binding!;
  await writeFile(target.configurationPath, '{}');
  const preview = await setup.v2Preview('isolated-window', target);
  assert.equal(
    (await setup.v2Apply('isolated-window', preview.planId, target, true)).status,
    'applied',
  );
  assert.equal(service.adapters.get(binding.adapterId).status().capabilities.wakeIdle, false);
  assert.equal(
    service.store.assertOwner(binding.connectionId).binding.connectionId,
    binding.connectionId,
  );
});
test('node lifecycle restart leaves old issued attempt uncertain and never replays old host evidence', async (t) => {
  const { service, host, call } = await openCodeV2ProductFixture(t, { timeoutMs: 40 });
  const id = host.addSession();
  host.promptResult = async (input) => host.user(input);
  const connected = await call(id, 'agent_connect', { nickname: 'Restart fixture' });
  assert.equal(connected.isError, undefined, JSON.stringify(connected));
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      service.off('change', check);
      reject(new Error('No receive arm'));
    }, 1000);
    const check = () => {
      if (
        !service.adapters
          .states()
          .some((state) => state.kind === 'opencode-v2' && state.state === 'ready')
      )
        return;
      clearTimeout(timer);
      service.off('change', check);
      resolve();
    };
    service.on('change', check);
    check();
  });
  const sender = service.connect({ nickname: 'Restart sender', client: 'fixture' });
  if (sender.status !== 'connected') throw new Error();
  const sent = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Restart fixture',
    text: 'one issued body',
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      service.off('change', check);
      reject(new Error('No uncertainty'));
    }, 1000);
    const check = () => {
      if (service.store.dispatchState(sent.id)?.state !== 'uncertain') return;
      clearTimeout(timer);
      service.off('change', check);
      resolve();
    };
    service.on('change', check);
    check();
  });
  const epoch = service.deliveryIncarnation;
  await service.stop();
  await service.start();
  assert.notEqual(service.deliveryIncarnation, epoch);
  host.delivered(id, host.prompts[0].id!);
  await tick();
  await tick();
  assert.equal(service.store.get(sent.id, 'in')?.state, 'ready');
  assert.equal(service.store.dispatchState(sent.id)?.state, 'uncertain');
  assert.equal(host.prompts.length, 1);
});

test('persisted v2 adapter reattaches current evidence after node startup precedes bridge registration', async (t) => {
  const profileId = randomUUID(),
    oldProfileId = randomUUID(),
    sessionID = 'ses_restart_rebind';
  const { service, host, call, provision, configuration } = await openCodeV2ProductFixture(t, {
    beforeRegistration: async (service, registration) => {
      service.settings.value.adapters.push({
        id: profileId,
        label: 'Persisted fixture',
        kind: 'opencode-v2',
        setupTargetId: registration.targetId,
        instanceId: registration.bootId,
        workspace: registration.workspace,
        sessionId: sessionID,
      });
      service.settings.value.adapters.push({
        id: oldProfileId,
        label: 'Old boot fixture',
        kind: 'opencode-v2',
        setupTargetId: registration.targetId,
        instanceId: randomUUID(),
        workspace: registration.workspace,
        sessionId: sessionID,
      });
      await service.settings.save();
      await service.stop();
      await service.start();
      assert.equal(service.adapters.get(profileId).status().capabilities.wakeIdle, false);
    },
  });
  host.addSession(sessionID);
  const connected = await call(sessionID, 'agent_connect', { nickname: 'Restored receive' });
  assert.equal(connected.isError, undefined, JSON.stringify(connected));
  assert.equal(
    (connected.structuredContent as { binding: { adapterId: string } }).binding.adapterId,
    profileId,
  );
  const wait = (condition: () => boolean) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        service.off('change', check);
        reject(new Error('Missing restored evidence listener'));
      }, 1000);
      const check = () => {
        if (!condition()) return;
        clearTimeout(timer);
        service.off('change', check);
        resolve();
      };
      service.on('change', check);
      check();
    });
  await wait(() => service.adapters.get(profileId).status().state === 'ready');
  const sender = service.connect({ nickname: 'Restored source', client: 'isolated' });
  if (sender.status !== 'connected') throw new Error();
  const sent = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Restored receive',
    text: 'One current restart body',
  });
  await wait(() => service.store.get(sent.id, 'in')?.state === 'processed');
  assert.equal(host.prompts.length, 1);
  assert.equal(service.store.deliveryAttempt(host.prompts[0].id!.slice(4)).meta.phase, 'committed');
  await call(sessionID, 'agent_connect', { nickname: 'Restored receive' });
  assert.equal(
    service.settings.value.adapters.filter((profile) => profile.id === profileId).length,
    1,
  );
  const route = host.route(configuration.mcp.servers.ncf_agent_interconnect);
  const boot = new URL(route.url).pathname.split('/').at(-2)!;
  const admission = service.opencodeV2.verifyRoute(
    provision.targetId,
    provision.generation,
    boot,
    route.headers['x-ncf-opencode-instance'],
  );
  const current = await service.opencodeV2.identity(
    provision.targetId,
    provision.generation,
    sessionID,
    boot,
    admission,
  );
  assert.equal(current.bridge.events.listenerCount('evidence'), 1);
  assert.equal(service.adapters.get(oldProfileId).status().capabilities.wakeIdle, false);
  await assert.rejects(
    service.opencodeV2.identity(provision.targetId, randomUUID(), sessionID),
    /UNAVAILABLE/,
  );
});

test('native session deletion and same-ID recreation cannot silently adopt the old named mailbox', async (t) => {
  const { service, host, call } = await openCodeV2ProductFixture(t);
  const id = host.addSession('ses_reused');
  const first = await call(id, 'agent_connect', { nickname: 'Lifetime fixture' });
  assert.equal(first.isError, undefined, JSON.stringify(first));
  const binding = (
    first.structuredContent as { binding: { adapterId: string; connectionId: string } }
  ).binding;
  const wait = (condition: () => boolean) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        service.off('change', check);
        reject(new Error('Missing lifecycle transition'));
      }, 1000);
      const check = () => {
        if (!condition()) return;
        clearTimeout(timer);
        service.off('change', check);
        resolve();
      };
      service.on('change', check);
      check();
    });
  await wait(() => service.adapters.get(binding.adapterId).status().state === 'ready');
  host.sessions.delete(id);
  host.events.publish({
    id: 'evt_deleted_session',
    created: 1,
    type: 'session.deleted',
    location: { directory: host.workspace },
    data: { sessionID: id },
  });
  await wait(() => service.adapters.get(binding.adapterId).status().state !== 'ready');
  host.addSession(id);
  host.sessions.set(id, { ...host.sessions.get(id)!, time: { created: 2, updated: 2 } });
  const recreated = await call(id, 'agent_connect', { nickname: 'Lifetime fixture' });
  assert.equal(recreated.isError, undefined, JSON.stringify(recreated));
  assert.equal((recreated.structuredContent as { status: string })?.status, 'nickname_in_use');
  assert.equal(
    service.store.assertOwner(binding.connectionId).binding.connectionId,
    binding.connectionId,
  );
});

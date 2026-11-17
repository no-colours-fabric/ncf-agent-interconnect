import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { setImmediate as tick } from 'node:timers/promises';
import { openCodeV2ProductFixture, OpenCodeV2HostFixture } from './fixtures/opencode-v2-host.js';
import { startOpenCodeV2 } from '../desktop/integrations/opencode-v2.js';

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
  assert.equal(host.prompts.length, 0);
});
test('two live bridges sharing target generation revoke authority instead of choosing the last instance', async (t) => {
  const { service, host, provision, call } = await openCodeV2ProductFixture(t);
  const id = host.addSession();
  const connected = await call(id, 'agent_connect', { nickname: 'Ambiguous fixture' });
  assert.equal(connected.isError, undefined, JSON.stringify(connected));
  const second = new OpenCodeV2HostFixture();
  second.context.options = { targetId: provision.targetId, generation: provision.generation };
  await assert.rejects(startOpenCodeV2(second.context, provision), /REGISTRATION_UNAVAILABLE/);
  const next = await call(id, 'node_status', {});
  assert.equal(next.isError, true);
  assert.equal(host.prompts.length, 0);
  const profile = service.settings.value.adapters.find(
    (profile) => profile.kind === 'opencode-v2',
  )!;
  assert.equal(service.adapters.get(profile.id).status().capabilities.wakeIdle, false);
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

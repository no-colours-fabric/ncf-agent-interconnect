import test from 'node:test';
import assert from 'node:assert/strict';
import { openCodeV2ProductFixture, Deferred } from './fixtures/opencode-v2-host.js';
import type { NodeService } from '../desktop/core/service.js';
import { openCodeV2PayloadHash } from '../desktop/core/opencode-v2-protocol.js';

function changed(service: NodeService, condition: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      service.off('change', check);
      reject(new Error('Expected isolated v2 state transition'));
    }, 3000);
    const check = () => {
      if (!condition()) return;
      clearTimeout(timer);
      service.off('change', check);
      resolve();
    };
    service.on('change', check);
    check();
  });
}
test('v2 exact own-handler connect does not await idle; canonical content joins real bridge evidence into common receipt', async (t) => {
  const { service, host, call } = await openCodeV2ProductFixture(t);
  const id = host.addSession('ses_Тайд漢字');
  host.busy.add(id);
  const connection = await call(id, 'agent_connect', { nickname: 'V2 fixture recipient' });
  assert.equal(connection.isError, undefined, JSON.stringify(connection));
  const result = connection.structuredContent as {
    status: string;
    binding: { connectionId: string; adapterId: string };
  };
  assert.equal(result.status, 'connected');
  assert.equal(host.prompts.length, 0);
  assert.equal(host.waitCalls, 1);
  host.status(id, 'idle');
  await changed(
    service,
    () => service.adapters.get(result.binding.adapterId).status().state === 'ready',
  );
  const sender = service.connect({ nickname: 'Fixture sender', client: 'isolated fixture' });
  assert.equal(sender.status, 'connected');
  if (sender.status !== 'connected') throw new Error();
  const text = 'Plain canonical body 漢字';
  const sent = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'V2 fixture recipient',
    text,
  });
  await changed(service, () => service.store.get(sent.id, 'in')?.state === 'processed');
  assert.equal(host.prompts.length, 1);
  assert.equal(host.prompts[0].sessionID, id);
  const attempt = service.store.deliveryAttempt(host.prompts[0].id!.slice(4));
  assert.equal(attempt.meta.phase, 'committed');
  assert.equal(host.prompts[0].id, attempt.meta.host?.messageId);
  assert.equal(attempt.meta.host?.messageId, 'msg_' + attempt.id);
  assert.equal(
    attempt.meta.payloadHash,
    openCodeV2PayloadHash({
      sessionID: host.prompts[0].sessionID,
      id: host.prompts[0].id!,
      text: host.prompts[0].text,
      delivery: 'queue',
      resume: true,
    }),
  );
  const ref = 'r' + service.store.get(sent.id, 'in')!.sequence.toString(36);
  assert.match(
    host.prompts[0].text,
    new RegExp(
      '^\\*\\*Incoming NCF Agent Interconnect\\*\\*\\n' +
        'From: "Fixture sender"\\n' +
        'Sent: .+\\n' +
        'Delivered: .+\\n\\n' +
        text +
        '\\n\\nReply-To "Fixture sender": ' +
        ref +
        '\\nUse agent_send\\(connectionId, replyRef="' +
        ref +
        '", text\\) to reply\\.$',
    ),
  );
  assert.equal(host.prompts[0].text.includes('agent_read'), false);
  const reply = await call(id, 'agent_send', {
    connectionId: result.binding.connectionId,
    replyRef: ref,
    text: 'Source fixture reply',
  });
  assert.equal(reply.isError, undefined, JSON.stringify(reply));
});
test('v2 late current-boot projection completes only its same uncertain common attempt without replay', async (t) => {
  const { service, host, call } = await openCodeV2ProductFixture(t, { timeoutMs: 40 });
  const id = host.addSession('ses_late');
  host.promptResult = async (input) => host.user(input);
  const connect = await call(id, 'agent_connect', { nickname: 'Late fixture' });
  assert.equal(connect.isError, undefined, JSON.stringify(connect));
  const result = connect.structuredContent as { binding: { adapterId: string } };
  await changed(
    service,
    () => service.adapters.get(result.binding.adapterId).status().state === 'ready',
  );
  const sender = service.connect({ nickname: 'Source sender', client: 'isolated' });
  if (sender.status !== 'connected') throw new Error();
  const sent = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Late fixture',
    text: 'one saved body',
  });
  await changed(service, () => service.store.dispatchState(sent.id)?.state === 'uncertain');
  assert.equal(service.store.get(sent.id, 'in')?.state, 'ready');
  assert.equal(host.prompts.length, 1);
  const saved = host.prompts[0].id!.slice(4);
  host.delivered(id, host.prompts[0].id!);
  await changed(service, () => service.store.get(sent.id, 'in')?.state === 'processed');
  assert.equal(service.store.deliveryAttempt(saved).id, saved);
  assert.equal(host.prompts.length, 1);
});

test('owner revocation during final private verification prevents any native body release', async (t) => {
  const { service, host, call } = await openCodeV2ProductFixture(t);
  const id = host.addSession('ses_gate_race'),
    connection = await call(id, 'agent_connect', { nickname: 'Gate race' });
  assert.equal(connection.isError, undefined, JSON.stringify(connection));
  const binding = (
    connection.structuredContent as { binding: { connectionId: string; adapterId: string } }
  ).binding;
  await changed(service, () => service.adapters.get(binding.adapterId).status().state === 'ready');
  const original = service.opencodeV2.auth.authenticate.bind(service.opencodeV2.auth),
    entered = new Deferred<void>(),
    release = new Deferred<void>();
  let calls = 0;
  service.opencodeV2.auth.authenticate = async (...args) => {
    const result = await original(...args);
    if (++calls === 2) {
      entered.resolve();
      await release.promise;
    }
    return result;
  };
  t.after(() => {
    release.resolve();
    service.opencodeV2.auth.authenticate = original;
  });
  const sender = service.connect({ nickname: 'Gate sender', client: 'fixture' });
  if (sender.status !== 'connected') throw new Error();
  const sent = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Gate race',
    text: 'Must not leave after revocation',
  });
  await entered.promise;
  service.disconnect(binding.connectionId);
  release.resolve();
  await changed(service, () =>
    ['uncertain', 'failed'].includes(service.store.dispatchState(sent.id)?.state ?? ''),
  );
  assert.equal(host.prompts.length, 0);
  assert.equal(service.store.dispatchState(sent.id)?.state, 'failed');
  assert.equal(service.store.get(sent.id, 'in')?.state, 'ready');
});

test('v2 native reservation fences explicit MCP read until the exact projected receipt', async (t) => {
  const { service, host, call } = await openCodeV2ProductFixture(t),
    id = host.addSession('ses_native_first');
  const connection = await call(id, 'agent_connect', { nickname: 'Native first' });
  assert.equal(connection.isError, undefined, JSON.stringify(connection));
  const binding = (
    connection.structuredContent as { binding: { connectionId: string; adapterId: string } }
  ).binding;
  await changed(service, () => service.adapters.get(binding.adapterId).status().state === 'ready');
  const entered = new Deferred<void>(),
    release = new Deferred<void>();
  host.promptResult = async (input) => {
    entered.resolve();
    await release.promise;
    host.delivered(id, input.id!);
    return host.user(input);
  };
  t.after(() => release.resolve());
  const sender = service.connect({ nickname: 'Race sender', client: 'fixture' });
  if (sender.status !== 'connected') throw new Error();
  const sent = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'Native first',
    text: 'One common content path',
  });
  await entered.promise;
  const read = await call(id, 'agent_read', { connectionId: binding.connectionId });
  assert.equal(read.isError, true);
  assert.equal(service.store.get(sent.id, 'in')?.state, 'ready');
  release.resolve();
  await changed(service, () => service.store.get(sent.id, 'in')?.state === 'processed');
  assert.equal(host.prompts.length, 1);
});
test('v2 explicit MCP receipt first prevents later native release when idle arms', async (t) => {
  const { service, host, call } = await openCodeV2ProductFixture(t),
    id = host.addSession('ses_mcp_first');
  host.busy.add(id);
  const connection = await call(id, 'agent_connect', { nickname: 'MCP first' });
  assert.equal(connection.isError, undefined, JSON.stringify(connection));
  const binding = (
    connection.structuredContent as { binding: { connectionId: string; adapterId: string } }
  ).binding;
  const sender = service.connect({ nickname: 'Explicit sender', client: 'fixture' });
  if (sender.status !== 'connected') throw new Error();
  const sent = await service.send({
    connectionId: sender.binding.connectionId,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: 'MCP first',
    text: 'Explicit read wins',
  });
  const read = await call(id, 'agent_read', { connectionId: binding.connectionId });
  assert.equal(read.isError, undefined, JSON.stringify(read));
  assert.equal(service.store.get(sent.id, 'in')?.state, 'processed');
  host.status(id, 'idle');
  await changed(service, () => service.adapters.get(binding.adapterId).status().state === 'ready');
  assert.equal(host.prompts.length, 0);
});

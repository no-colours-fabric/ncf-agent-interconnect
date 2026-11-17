import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { claudePluginFiles, publishClaudePlugin } from '../desktop/core/claude-plugin.js';
import {
  nativeClaudeFrame,
  nativeClaudeHash,
  nativeClaudeRowHash,
  nativeClaudeTrigger,
} from '../desktop/core/claude-native-content.js';

type Handler = ($: any, event: any, next: any) => Promise<any>;
async function fixture(t: test.TestContext, bare = true) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ncf-native-mod-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}\n');
  const files = claudePluginFiles({
    execPath: '/fixture/NCF',
    runtimeArgs: [],
    script: '/fixture/claude.js',
    nodeFile: '/fixture/node.json',
    platform: 'linux',
    version: '0.18.1',
  });
  await publishClaudePlugin(root, files);
  const main = await import(pathToFileURL(path.join(root, 'plugin/hooks/native-incoming.js')).href);
  const gate = await import(pathToFileURL(path.join(root, 'gate/hooks/gate.js')).href);
  const gates = new Map<string, Handler>();
  gate.register((name: string, handler: Handler) => {
    gates.set(name, handler);
    return { catch() {} };
  });
  const appends = new Map<string, Handler>();
  const own = { current: true } as any;
  main.startNative(own);
  main.registerNative(
    (name: string, handler: Handler) => {
      appends.set(name, handler);
    },
    () => own,
  );
  const sessionId = randomUUID(),
    delivery = randomUUID();
  const descriptor = { url: 'http://127.0.0.1:12345', token: 'isolated test capability' };
  const nativeLeaseNonce = randomUUID();
  const body =
    '**Incoming NCF Agent Interconnect**\nFrom: "Sender 漢字"\n\nFull body\n\nReply-To: r9\nUse agent_send(connectionId, replyRef="r9", text) to reply.';
  const reportKey = 'a'.repeat(64);
  const trigger = nativeClaudeTrigger + delivery;
  const reports: any[] = [];
  const calls: string[] = [];
  let mutate: ((message: any) => any) | undefined;
  const $ = {
    fs: {
      read: async (filename: string) =>
        JSON.stringify(
          filename === '/fixture/node.json'
            ? descriptor
            : { version: 1, sessionId, nonce: nativeLeaseNonce, active: true },
        ),
    },
    session: { id: async () => sessionId },
    http: {
      fetch: async (url: string, options: any) => {
        const input = JSON.parse(options.body);
        calls.push(new URL(url).pathname);
        let value: any;
        if (url.endsWith('/prepare'))
          value = {
            delivery,
            expiresAt: Date.now() + 600000,
            reportKey,
            trigger,
            envelopeHash: nativeClaudeHash(body),
            representationHashes: [
              nativeClaudeRowHash(body),
              nativeClaudeRowHash(body, 'node-owned current-chat context'),
              nativeClaudeRowHash(body, undefined, false),
              nativeClaudeRowHash(body, 'node-owned current-chat context', false),
            ],
          };
        else if (url.endsWith('/admit')) {
          assert.deepEqual(input, { sessionId, delivery, nativeLeaseNonce });
          value = { body, receiverContext: 'node-owned current-chat context' };
        } else {
          reports.push(input);
          value = { state: input.phase === 'stored' ? 'committed' : 'uncertain' };
        }
        return { ok: true, text: JSON.stringify(value) };
      },
    },
    prompt: {
      submit: async ({ text, asUser }: { text: string; asUser?: true }) => {
        assert.equal(asUser, true, 'native incoming must omit the host framing');
        assert.equal(
          text,
          trigger,
          'the main module must not submit a read notice or a second body',
        );
        const origin = { kind: 'plugin', name: 'ncf-agent-interconnect', asUser };
        const forward = Object.assign(
          async (event: any) => {
            assert.equal(event.text, body);
            assert.deepEqual(event.context, ['node-owned current-chat context']);
            const message = {
              type: 'user',
              role: 'user',
              content: [
                bare
                  ? { text: event.text, type: 'text' }
                  : { type: 'text', text: nativeClaudeFrame(event.text) },
              ],
            };
            // A queue record has the same text, but never counts as stored admission.
            await appends.get('session.append')!(
              $,
              { door: 'queue', origin, uuid: randomUUID(), message },
              async (e: any) => ({ message: e.message, uuid: e.uuid }),
            );
            assert.equal(reports.length, 0);
            const uuid = randomUUID();
            await appends.get('session.append')!(
              $,
              { door: 'prompt', origin, uuid, message },
              async (e: any) => ({ message: mutate ? mutate(e.message) : e.message, uuid: e.uuid }),
            );
            return event;
          },
          { origin: { plugin: 'ncf-agent-interconnect' } },
        );
        return gates.get('prompt.submit')!($, { text, origin }, forward);
      },
    },
  };
  await gates.get('session.start')!($, {}, (e: any) => e);
  return {
    $,
    main,
    own,
    gates,
    descriptor,
    sessionId,
    delivery,
    reportKey,
    reports,
    appends,
    calls,
    files,
    mutate(fn: typeof mutate) {
      mutate = fn;
    },
  };
}

test('actual emitted main/gate modules turn one opaque trigger into the canonical message and one stored-row report', async (t) => {
  const f = await fixture(t);
  await f.main.submitNative(f.$, f.own, f.descriptor, f.sessionId, { claim: 'b'.repeat(64) });
  assert.deepEqual(f.calls, [
    '/integrations/claude/native/prepare',
    '/integrations/claude/native/admit',
    '/integrations/claude/native/report',
  ]);
  assert.equal(f.reports.length, 1);
  assert.equal(f.reports[0].phase, 'stored');
  assert.equal(f.reports[0].delivery, f.delivery);
  assert.equal(f.reports[0].reportKey, f.reportKey);
  assert.ok(f.reports[0].storedRowId);
  assert.equal(
    f.reports[0].representationHash,
    nativeClaudeRowHash(
      '**Incoming NCF Agent Interconnect**\nFrom: "Sender 漢字"\n\nFull body\n\nReply-To: r9\nUse agent_send(connectionId, replyRef="r9", text) to reply.',
      undefined,
      false,
    ),
  );
  assert.equal(f.own.nativePending.size, 0);
  assert.match(f.files['plugin/hooks/wake.js'], /registerNative\(on, \(\) => scope\)/);
  assert.match(f.files['plugin/hooks/wake.js'], /--native-incoming/);
});

test('a downstream native rewrite cannot create receipt for the expected message', async (t) => {
  const f = await fixture(t);
  f.mutate((message) => ({
    ...message,
    content: [{ type: 'text', text: 'rewritten unrelated content' }],
  }));
  await f.main.submitNative(f.$, f.own, f.descriptor, f.sessionId, { claim: 'b'.repeat(64) });
  assert.equal(f.reports.length, 1);
  assert.equal(f.reports[0].phase, 'uncertain');
  assert.equal(f.reports[0].storedRowId, undefined);
});

test('wrapped own-plugin rows cannot commit bare delivery before or after downstream storage', async (t) => {
  for (const beforeStorage of [true, false]) {
    const f = await fixture(t, !beforeStorage);
    if (!beforeStorage)
      f.mutate((message) => ({
        ...message,
        content: [{ type: 'text', text: nativeClaudeFrame(message.content[0].text) }],
      }));
    await f.main.submitNative(f.$, f.own, f.descriptor, f.sessionId, { claim: 'b'.repeat(64) });
    assert.equal(f.reports.length, 1);
    assert.equal(f.reports[0].phase, 'uncertain');
    assert.equal(f.reports[0].storedRowId, undefined);
  }
});

test('a complete bare plugin-origin row uses the same strict witness and canonical text-block field order', async (t) => {
  const f = await fixture(t, true);
  await f.main.submitNative(f.$, f.own, f.descriptor, f.sessionId, { claim: 'b'.repeat(64) });
  assert.equal(f.reports.length, 1);
  assert.equal(f.reports[0].phase, 'stored');
  assert.ok(f.reports[0].storedRowId);
});

test('typed and foreign-plugin lookalike triggers pass unchanged without node authority', async (t) => {
  const f = await fixture(t);
  for (const origin of [{ plugin: 'engine' }, { plugin: 'foreign' }]) {
    const event = { text: nativeClaudeTrigger + f.delivery, origin: { kind: 'composer' } };
    const next = Object.assign(async (e: unknown) => e, { origin });
    assert.equal(await f.gates.get('prompt.submit')!(f.$, event, next), event);
  }
  assert.deepEqual(f.calls, []);
});

test('queued submit keeps its exact correlation until the later gate and stored row', async (t) => {
  const f = await fixture(t);
  let queued = '';
  f.$.prompt.submit = async ({ text, asUser }) => {
    assert.equal(asUser, true);
    queued = text;
    return { text };
  };
  await f.main.submitNative(f.$, f.own, f.descriptor, f.sessionId, { claim: 'b'.repeat(64) });
  assert.equal(f.reports.length, 0, 'queue resolution is neither failure nor receipt');
  assert.equal(f.own.nativePending.size, 1);
  const origin = { kind: 'plugin', name: 'ncf-agent-interconnect', asUser: true };
  await f.gates.get('prompt.submit')!(
    f.$,
    { text: queued, origin },
    Object.assign(
      async (event: any) => {
        const uuid = randomUUID();
        const message = {
          type: 'user',
          role: 'user',
          content: [{ type: 'text', text: event.text }],
        };
        await f.appends.get('session.append')!(
          f.$,
          { door: 'prompt', origin, uuid, message },
          async (e: any) => ({ uuid: e.uuid, message: e.message }),
        );
        return event;
      },
      { origin: { plugin: 'ncf-agent-interconnect' } },
    ),
  );
  assert.equal(f.reports.length, 1);
  assert.equal(f.reports[0].phase, 'stored');
  assert.equal(f.own.nativePending.size, 0);
});

test('bare incoming receipt still requires the exact plugin origin and asUser mode', async (t) => {
  const f = await fixture(t);
  f.$.prompt.submit = async () => ({ text: 'queued' });
  await f.main.submitNative(f.$, f.own, f.descriptor, f.sessionId, { claim: 'b'.repeat(64) });
  const message = {
    type: 'user',
    role: 'user',
    content: [
      {
        type: 'text',
        text: '**Incoming NCF Agent Interconnect**\nFrom: "Sender 漢字"\n\nFull body\n\nReply-To: r9\nUse agent_send(connectionId, replyRef="r9", text) to reply.',
      },
    ],
  };
  for (const origin of [
    { kind: 'composer' },
    { kind: 'plugin', name: 'foreign', asUser: true },
    { kind: 'plugin', name: 'ncf-agent-interconnect' },
    { kind: 'plugin', name: 'ncf-agent-interconnect', asUser: false },
  ]) {
    await f.appends.get('session.append')!(
      f.$,
      { door: 'prompt', origin, uuid: randomUUID(), message },
      async (e: any) => ({ message: e.message, uuid: e.uuid }),
    );
    assert.equal(
      f.reports.length,
      0,
      'lookalike or wrong-mode rows cannot spend the pending delivery',
    );
    assert.equal(f.own.nativePending.size, 1);
  }
  const uuid = randomUUID();
  await f.appends.get('session.append')!(
    f.$,
    {
      door: 'prompt',
      origin: { kind: 'plugin', name: 'ncf-agent-interconnect', asUser: true },
      uuid,
      message,
    },
    async (e: any) => ({ message: e.message, uuid: e.uuid }),
  );
  assert.equal(f.reports.length, 1);
  assert.equal(f.reports[0].phase, 'stored');
  assert.equal(f.reports[0].storedRowId, uuid);
  assert.equal(f.own.nativePending.size, 0);
});

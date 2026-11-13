import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runClaudeHook, claudeCallMetaKey } from '../desktop/integrations/claude-code.js';
import { readNativeLease, updateNativeLease } from '../desktop/integrations/claude-native-lease.js';
import { claudeFixture, FakeHelper, type ClaudeFixture } from './claude-code-fixture.js';

const leaseFile = (f: ClaudeFixture, session: string) =>
  path.join(path.dirname(f.nodeFile), 'claude-native', session + '.json');
const start = (f: ClaudeFixture, session: string, source?: string) =>
  runClaudeHook(
    f.nodeFile,
    JSON.stringify({ hook_event_name: 'SessionStart', session_id: session, source }),
  );

test('SessionStart compact preserves the active native lease, exact route and protected call', async (t) => {
  const f = await claudeFixture(t);
  const session = randomUUID();
  await f.hook('SessionStart', session, { source: 'startup' });
  const helper = new FakeHelper(f, session);
  await helper.attach();
  t.after(() => helper.detach());
  const connected = await f.connect(helper, session, 'Compact 漢字');
  const lease = await readNativeLease(f.nodeFile, session);
  const filename = leaseFile(f, session);
  const bytes = await readFile(filename);
  const current = f.service.claude.route(session).helper;
  assert.ok(current);
  const authority = [current.id, current.epoch, current.generation, current.nativeLeaseNonce];
  const proof = await f.preTool(session, 'node_status', {});

  assert.equal(await start(f, session, 'compact'), undefined);

  assert.deepEqual(await readNativeLease(f.nodeFile, session), lease);
  assert.deepEqual(await readFile(filename), bytes);
  assert.equal(f.service.claude.route(session).helper, current);
  assert.deepEqual(
    [current.id, current.epoch, current.generation, current.nativeLeaseNonce],
    authority,
  );
  const verified = await helper.verify('node_status', {}, proof);
  assert.equal(verified.status, 200);
  assert.equal(typeof verified.body.callToken, 'string');
  const client = await f.mcp();
  const result = await client.callTool({
    name: 'node_status',
    arguments: {},
    _meta: { [claudeCallMetaKey]: verified.body.callToken },
  });
  assert.notEqual(result.isError, true);
  assert.deepEqual(
    f.service.store.assertOwner(connected.binding.connectionId).binding,
    connected.binding,
  );
});

for (const state of ['missing', 'ended', 'conflicted'] as const) {
  test(`Compaction never creates or revives a ${state} native lease`, async (t) => {
    const f = await claudeFixture(t);
    const session = randomUUID();
    if (state !== 'missing') await f.hook('SessionStart', session, { source: 'startup' });
    if (state === 'ended') await f.hook('SessionEnd', session);
    if (state === 'conflicted') await updateNativeLease(f.nodeFile, session, 'SessionStart');
    const before = await readNativeLease(f.nodeFile, session);
    const bytes = state === 'missing' ? undefined : await readFile(leaseFile(f, session));
    let nodeCalls = 0;
    const original = f.service.claude.hook.bind(f.service.claude);
    f.service.claude.hook = async (raw) => {
      nodeCalls++;
      return original(raw);
    };

    assert.equal(await start(f, session, 'compact'), undefined);

    assert.deepEqual(await readNativeLease(f.nodeFile, session), before);
    if (bytes) assert.deepEqual(await readFile(leaseFile(f, session)), bytes);
    else await assert.rejects(readFile(leaseFile(f, session)), { code: 'ENOENT' });
    assert.equal(nodeCalls, 0);
    assert.equal(f.service.claude.route(session).helper, undefined);
  });
}

for (const state of ['corrupt', 'locked'] as const) {
  test(`Compaction fails closed without writing a ${state} native lease`, async (t) => {
    const f = await claudeFixture(t);
    const session = randomUUID();
    await f.hook('SessionStart', session, { source: 'startup' });
    const filename = leaseFile(f, session);
    if (state === 'corrupt') await writeFile(filename, '{invalid');
    else await mkdir(filename + '.lock', { mode: 0o700 });
    const bytes = await readFile(filename);

    await assert.rejects(start(f, session, 'compact'));

    assert.deepEqual(await readFile(filename), bytes);
    await assert.rejects(readNativeLease(f.nodeFile, session));
    assert.equal(f.service.claude.route(session).helper, undefined);
  });
}

for (const source of ['startup', 'resume', 'clear', 'unknown', undefined]) {
  test(`A repeated ${source ?? 'unspecified'} SessionStart still conflicts instead of extending authority`, async (t) => {
    const f = await claudeFixture(t);
    const session = randomUUID();
    await f.hook('SessionStart', session, { source: 'startup' });
    const helper = new FakeHelper(f, session);
    await helper.attach();
    t.after(() => helper.detach());
    const before = await readNativeLease(f.nodeFile, session);
    assert.ok(before?.active);
    const proof = await f.preTool(session, 'node_status', {});

    await start(f, session, source);

    const after = await readNativeLease(f.nodeFile, session);
    assert.equal(after?.active, false);
    assert.equal(after?.conflicted, true);
    assert.notEqual(after?.nonce, before.nonce);
    assert.equal(f.service.claude.route(session).helper, undefined);
    assert.equal((await helper.verify('node_status', {}, proof)).status, 400);
  });
}

test('A delayed compact HTTP report after SessionEnd cannot revive the old helper', async (t) => {
  const f = await claudeFixture(t);
  const session = randomUUID();
  await f.hook('SessionStart', session, { source: 'startup' });
  const helper = new FakeHelper(f, session);
  await helper.attach();
  t.after(() => helper.detach());
  let entered!: () => void;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => (entered = resolve));
  const held = new Promise<void>((resolve) => (release = resolve));
  t.after(() => release());
  const original = f.service.claude.hook.bind(f.service.claude);
  let rejected = false;
  f.service.claude.hook = async (raw) => {
    const input = raw as { event?: string; source?: string };
    if (input.event !== 'SessionStart' || input.source !== 'compact') return original(raw);
    entered();
    await held;
    try {
      return await original(raw);
    } catch (error) {
      rejected = true;
      throw error;
    }
  };
  const pending = start(f, session, 'compact');
  await waiting;
  await f.hook('SessionEnd', session);
  const ended = await readNativeLease(f.nodeFile, session);
  assert.equal(ended?.active, false);
  release();
  await pending;

  assert.equal(rejected, true);
  assert.deepEqual(await readNativeLease(f.nodeFile, session), ended);
  assert.equal(f.service.claude.route(session).helper, undefined);
});

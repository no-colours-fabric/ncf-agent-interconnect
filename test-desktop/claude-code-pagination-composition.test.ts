import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { claudeCallMetaKey } from '../desktop/integrations/claude-code.js';
import { until } from './aionui-fixture.js';
import { claudeFixture, FakeHelper } from './claude-code-fixture.js';

interface Page {
  messages: { envelope: { id: string } }[];
  nextCursor: number;
  hasMore: boolean;
}

test('An arrival during a partial read survives Stop renewal and a new helper epoch without duplicate returned IDs', async (t) => {
  const f = await claudeFixture(t);
  const session = randomUUID();
  const nickname = 'Pagination receiver 漢字';
  await f.hook('SessionStart', session, { source: 'startup' });
  const helper = new FakeHelper(f, session);
  await helper.attach();
  const connected = await f.connect(helper, session, nickname);
  const connectionId = String(connected.binding.connectionId);
  const adapter = f.service.adapters.get(String(connected.binding.adapterId));
  const client = await f.mcp();
  const sender = f.service.connect({ nickname: 'Pagination sender', client: 'MCP' });
  assert.equal(sender.status, 'connected');
  if (sender.status !== 'connected') throw new Error('The fixture sender is unavailable');
  const send = (text: string, files: string[] = []) =>
    f.service.send({
      connectionId: sender.binding.connectionId,
      recipientNode: f.service.settings.value.nodeId,
      recipientNickname: nickname,
      text,
      files,
    });
  const offered = (ids: string[]) =>
    until(() =>
      ids.every(
        (id) =>
          f.service.store.dispatchState(id)?.state === 'offered' && adapter.offerCurrent?.(id),
      ),
    );
  const flushFrames = async () => {
    const marker = randomUUID();
    const native = f.service.claude.route(session).helper;
    assert.ok(native);
    assert.equal(f.service.claude.send(native, { type: 'fixture-barrier', marker }), true);
    await until(() => helper.lines.some((line) => line.marker === marker));
  };
  // These are authenticated synthetic MCP reads, not evidence of autonomous idle wake.
  const read = async (after: number): Promise<Page> => {
    const args = { connectionId, after, limit: 2 };
    const proof = await f.preTool(session, 'agent_read', args);
    const verified = await helper.verify('agent_read', args, proof);
    assert.equal(verified.status, 200);
    const result = await client.callTool({
      name: 'agent_read',
      arguments: args,
      _meta: { [claudeCallMetaKey]: verified.body.callToken },
    });
    assert.equal(result.isError, undefined);
    await helper.written(result);
    return result.structuredContent as unknown as Page;
  };

  let release!: () => void;
  const barrier = new Promise<void>((resolve) => (release = resolve));
  let reached!: () => void;
  const materializing = new Promise<void>((resolve) => (reached = resolve));
  const originalMaterialize = f.service.files.materialize.bind(f.service.files);
  let pending: Promise<Page> | undefined;
  try {
    const filename = path.join(f.service.settings.value.exportRoots[0], 'page 1 漢字.txt');
    await writeFile(filename, 'bounded pagination fixture', 'utf8');
    await helper.detach();
    const ids: string[] = [];
    for (let index = 0; index < 5; index++)
      ids.push((await send(String(index + 1), index === 0 ? [filename] : [])).id);
    await until(() => ids.every((id) => f.service.store.get(id, 'in')?.state === 'ready'));
    // Finish the offline materialization attempt before attaching. Otherwise a
    // pre-existing job legitimately carries an earlier backlog snapshot.
    await until(() => f.service.store.dispatchState(ids[0])?.state === 'waiting');
    await helper.attach();
    await offered(ids);
    await flushFrames();
    assert.equal(helper.wakes().length, 1);
    await f.hook('Stop', session);
    await offered(ids);
    await flushFrames();
    assert.equal(helper.wakes().length, 2);

    let held = false;
    f.service.files.materialize = async (...args) => {
      if (args[0] === ids[0] && !held) {
        held = true;
        reached();
        await barrier;
      }
      return originalMaterialize(...args);
    };
    pending = read(0);
    await materializing;
    // history selected the first page before materialization reached this barrier.
    const later = await send('6, created while page 1 is preparing');
    ids.push(later.id);
    await offered(ids);
    await flushFrames();
    assert.equal(helper.wakes().length, 3);
    for (const id of ids) assert.equal(f.service.store.get(id, 'in')?.state, 'ready');
    await f.hook('Stop', session);
    await offered(ids);
    await flushFrames();
    assert.equal(helper.wakes().length, 4); // Only the new ID has an unused Stop budget.
    await f.hook('Stop', session);
    await flushFrames();
    assert.equal(helper.wakes().length, 4);
    release();
    const first = await pending;
    assert.deepEqual(
      first.messages.map((row) => row.envelope.id),
      ids.slice(0, 2),
    );
    assert.equal(first.hasMore, true);
    assert.equal(f.service.store.get(later.id, 'in')?.state, 'ready');
    await offered(ids.slice(2));
    await f.hook('Stop', session);
    await flushFrames();
    assert.equal(helper.wakes().length, 4); // Partial read did not reset unread budgets.

    await helper.detach();
    await helper.attach();
    await offered(ids.slice(2));
    await flushFrames();
    assert.equal(helper.wakes().length, 5);
    await f.hook('Stop', session);
    await offered(ids.slice(2));
    await flushFrames();
    assert.equal(helper.wakes().length, 6);
    await f.hook('Stop', session);
    await flushFrames();
    assert.equal(helper.wakes().length, 6);

    const returned = first.messages.map((row) => row.envelope.id);
    let cursor = first.nextCursor;
    let more: boolean = first.hasMore;
    while (more) {
      const page = await read(cursor);
      returned.push(...page.messages.map((row) => row.envelope.id));
      cursor = page.nextCursor;
      more = page.hasMore;
    }
    assert.deepEqual(returned, ids);
    assert.equal(new Set(returned).size, ids.length);
    for (const id of ids) assert.equal(f.service.store.get(id, 'in')?.state, 'processed');
    await flushFrames();
    const drainedWakeCount = helper.wakes().length;
    await f.hook('Stop', session);
    await flushFrames();
    assert.equal(helper.wakes().length, drainedWakeCount);
  } finally {
    release();
    await pending?.catch(() => {});
    f.service.files.materialize = originalMaterialize;
    await client.close();
    await helper.detach();
  }
});

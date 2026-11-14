import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { claudeFixture, FakeHelper } from './claude-code-fixture.js';
import { readNativeLease } from '../desktop/integrations/claude-native-lease.js';
import { runClaudeHook } from '../desktop/integrations/claude-code.js';
import { nativeClaudeRowHash } from '../desktop/core/claude-native-content.js';
import { until } from './aionui-fixture.js';

async function fixture(t: test.TestContext) {
  const f = await claudeFixture(t);
  const session = randomUUID();
  await f.hook('SessionStart', session, { source: 'startup' });
  const helper = new FakeHelper(f, session, session, undefined, false);
  await helper.attach();
  const connected = await f.connect(helper, session, 'Получатель 漢字');
  const lines: Record<string, unknown>[] = [];
  const lease = await readNativeLease(f.nodeFile, session);
  const sink = await f.service.claude.attachWakeSink(
    {
      sessionId: session,
      nativeLeaseNonce: lease!.nonce,
      nativeIncoming: 1,
    },
    {
      write(line) {
        lines.push(JSON.parse(line));
        return true;
      },
      end() {},
    },
  );
  t.after(() => f.service.claude.detachWakeSink(sink));
  const sender = f.service.connect({ nickname: 'Отправитель 漢字', client: 'MCP' });
  if (sender.status !== 'connected') throw new Error('fixture');
  const senderConnection = sender.binding.connectionId;
  async function send(text: string, nickname = String(connected.nickname), files: string[] = []) {
    return f.service.send({
      connectionId: senderConnection,
      recipientNode: f.service.settings.value.nodeId,
      recipientNickname: nickname,
      text,
      files,
    });
  }
  const wakes = () => lines.filter((line) => line.type === 'wake');
  return {
    ...f,
    helper,
    session,
    connected,
    send,
    wakes,
    post(route: string, body: unknown) {
      return f.post(
        route,
        route.endsWith('/native/admit')
          ? { nativeLeaseNonce: lease!.nonce, ...(body as object) }
          : body,
      );
    },
  };
}

test('private native HTTP admits one canonical body and cannot be cancelled through the MCP frame endpoint', async (t) => {
  const f = await fixture(t);
  const filename = path.join(f.directory, 'native 附件.txt');
  await writeFile(filename, 'Synthetic native attachment');
  f.service.files.exportRoots = [f.directory];
  const sent = await f.send('Полное входящее 漢字', String(f.connected.nickname), [filename]);
  await until(() => f.wakes().length === 1);
  const prepare = await f.post('/integrations/claude/native/prepare', {
    sessionId: f.session,
    claim: f.wakes()[0].claim,
  });
  assert.equal(prepare.status, 200, JSON.stringify(prepare.body));
  assert.equal('body' in prepare.body, false);
  const delivery = String(prepare.body.delivery);
  assert.equal(f.service.store.claudeDelivery(delivery)?.state, 'reserved');
  const admit = await f.post('/integrations/claude/native/admit', {
    sessionId: f.session,
    delivery,
  });
  assert.equal(admit.status, 200, JSON.stringify(admit.body));
  assert.match(
    String(admit.body.body),
    /^\*\*Incoming NCF Agent Interconnect\*\*\nFrom: "Отправитель 漢字"/,
  );
  assert.ok(!String(admit.body.body).includes('agent_read'));
  assert.ok(String(admit.body.body).includes('native 附件.txt'));
  const links = [...String(admit.body.body).matchAll(/\]\(<([^>]+)>\)/g)];
  assert.equal(links.length, 1);
  assert.ok(path.isAbsolute(links[0][1]));
  assert.equal(await readFile(links[0][1], 'utf8'), 'Synthetic native attachment');
  const foreign = await f.post('/integrations/claude/delivery', {
    helperId: f.helper.id,
    secret: f.helper.secret,
    delivery,
    phase: 'cancel',
  });
  assert.notEqual(foreign.status, 200);
  assert.equal(f.service.store.claudeDelivery(delivery)?.state, 'issued');
  const report = await f.post('/integrations/claude/native/report', {
    sessionId: f.session,
    delivery,
    reportKey: prepare.body.reportKey,
    phase: 'stored',
    storedRowId: randomUUID(),
    representationHash: nativeClaudeRowHash(String(admit.body.body)),
  });
  assert.deepEqual(report.body, { state: 'committed' });
  assert.equal(f.service.store.get(sent.id, 'in')?.state, 'processed');
  assert.equal(f.service.store.get(sent.id, 'out')?.state, 'processed');
});

test('two mailboxes in one native session keep exact claims, content and stored-row rights separate', async (t) => {
  const f = await fixture(t);
  const other = await f.connect(f.helper, f.session, 'Второй получатель');
  const a = await f.send('body A'),
    b = await f.send('body B', String(other.nickname));
  await until(() => f.wakes().length === 2);
  const prepared = await Promise.all(
    f.wakes().map(async (wake) => {
      const result = await f.post('/integrations/claude/native/prepare', {
        sessionId: f.session,
        claim: wake.claim,
      });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      return result.body;
    }),
  );
  const admitted = await Promise.all(
    prepared.map(async (value) => {
      const result = await f.post('/integrations/claude/native/admit', {
        sessionId: f.session,
        delivery: value.delivery,
      });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      return result.body;
    }),
  );
  assert.ok(String(admitted[0].body).includes('body A'));
  assert.ok(String(admitted[1].body).includes('body B'));
  const rowId = randomUUID();
  const report = (index: number, storedRowId: string, reportKey = prepared[index].reportKey) =>
    f.post('/integrations/claude/native/report', {
      sessionId: f.session,
      delivery: prepared[index].delivery,
      reportKey,
      phase: 'stored',
      storedRowId,
      representationHash: nativeClaudeRowHash(String(admitted[index].body)),
    });
  assert.notEqual((await report(0, rowId, prepared[1].reportKey)).status, 200);
  assert.equal(f.service.store.claudeDelivery(String(prepared[1].delivery))?.state, 'issued');
  assert.equal((await report(0, rowId)).status, 200);
  assert.notEqual((await report(1, rowId.toUpperCase())).status, 200);
  assert.equal(f.service.store.claudeDelivery(String(prepared[1].delivery))?.state, 'issued');
  assert.equal((await report(1, randomUUID())).status, 200);
  assert.equal(f.service.store.get(a.id, 'in')?.state, 'processed');
  assert.equal(f.service.store.get(b.id, 'in')?.state, 'processed');
});

test('a same-session compact preserves a prepared native operation without reconnect or a read tool', async (t) => {
  const f = await fixture(t);
  const sent = await f.send('after compact');
  await until(() => f.wakes().length > 0);
  const prepare = await f.post('/integrations/claude/native/prepare', {
    sessionId: f.session,
    claim: f.wakes().at(-1)!.claim,
  });
  assert.equal(prepare.status, 200);
  await runClaudeHook(
    f.nodeFile,
    JSON.stringify({
      hook_event_name: 'SessionStart',
      session_id: f.session,
      source: 'compact',
    }),
  );
  const admit = await f.post('/integrations/claude/native/admit', {
    sessionId: f.session,
    delivery: prepare.body.delivery,
  });
  assert.equal(admit.status, 200, JSON.stringify(admit.body));
  assert.ok(String(admit.body.body).includes('after compact'));
  assert.equal(f.service.store.get(sent.id, 'in')?.state, 'ready');
});

test('binding transfer after asynchronous service return withholds the native HTTP body at its final write boundary', async (t) => {
  const f = await fixture(t);
  const sent = await f.send('WITHHOLD-NATIVE-BODY-AFTER-TRANSFER');
  await until(() => f.wakes().length === 1);
  const prepared = await f.post('/integrations/claude/native/prepare', {
    sessionId: f.session,
    claim: f.wakes()[0].claim,
  });
  assert.equal(prepared.status, 200);
  const original = f.service.claudeNativeAdmit.bind(f.service);
  f.service.claudeNativeAdmit = async (raw) => {
    const body = await original(raw);
    const request = {
      nickname: String(f.connected.nickname),
      client: 'MCP',
      chatId: randomUUID(),
      adapterId: f.service.settings.value.adapters.find((profile) => profile.kind === 'manual')!.id,
    };
    const offer = f.service.connect(request);
    if (offer.status !== 'nickname_in_use') throw new Error('fixture transfer');
    assert.equal(
      f.service.connect({
        ...request,
        connectionId: offer.connectionId,
        transferId: offer.transferId,
        confirmTransfer: true,
      }).status,
      'connected',
    );
    return body;
  };
  const response = await f.post('/integrations/claude/native/admit', {
    sessionId: f.session,
    delivery: prepared.body.delivery,
  });
  assert.notEqual(response.status, 200);
  assert.ok(!JSON.stringify(response.body).includes('WITHHOLD-NATIVE-BODY-AFTER-TRANSFER'));
  assert.equal(f.service.store.claudeDelivery(String(prepared.body.delivery))?.state, 'uncertain');
  assert.equal(f.service.store.get(sent.id, 'in')?.state, 'ready');
  assert.equal(f.service.store.claudeFenced(sent.id), true);
  assert.ok(f.service.claude.route(f.session).helper, 'the helper itself remained live');
});

test('native pages preserve a late low-physical row beyond two hundred earlier offers', async (t) => {
  const f = await fixture(t);
  const node = f.service.settings.value.nodeId;
  const low = {
    protocol: 2 as const,
    id: randomUUID(),
    fromNode: node,
    toNode: node,
    fromNickname: 'Отправитель 漢字',
    toNickname: String(f.connected.nickname),
    createdAt: new Date().toISOString(),
    text: 'LOW-PHYSICAL-LATE-READY',
    replyTo: null,
    attachments: [],
  };
  f.service.store.insertLocal(low, false);
  const physical = f.service.store.get(low.id, 'in')!.sequence;
  for (let i = 0; i < 220; i++)
    f.service.store.insertLocal(
      {
        protocol: 2,
        id: randomUUID(),
        fromNode: node,
        toNode: node,
        fromNickname: 'Отправитель 漢字',
        toNickname: f.connected.nickname,
        createdAt: new Date().toISOString(),
        text: 'bounded page ' + i,
        replyTo: null,
        attachments: [],
      },
      true,
    );
  await f.send('last arrival');
  await until(() => f.wakes().length > 0);
  f.service.store.ready(low.id);
  (f.service as unknown as { messageReady(envelope: typeof low): void }).messageReady(low);
  await until(() => (f.service as unknown as { jobs: Set<Promise<void>> }).jobs.size === 0);
  const page = f.service.store.history(
    f.service.store.assertOwner(String(f.connected.binding.connectionId)).key,
    0,
    300,
    true,
  );
  assert.equal(page.messages.at(-1)?.envelope.id, low.id);
  assert.ok(page.nextCursor > physical);
  const originalHistory = f.service.store.history.bind(f.service.store);
  let pageScans = 0;
  f.service.store.history = (...args) => {
    if (args[2] === 200) pageScans++;
    return originalHistory(...args);
  };
  const completed: string[] = [];
  for (const expectedCount of [...Array<number>(11).fill(20), 2]) {
    const wake = f.wakes().at(-1)!;
    const prepare = await f.post('/integrations/claude/native/prepare', {
      sessionId: f.session,
      claim: wake.claim,
    });
    assert.equal(prepare.status, 200, JSON.stringify(prepare.body));
    const delivery = String(prepare.body.delivery);
    const ids = f.service.store.db
      .prepare('SELECT message_id FROM claude_delivery_items WHERE delivery_id=?')
      .all(delivery)
      .map((row) => String(row.message_id));
    assert.equal(ids.length, expectedCount);
    completed.push(...ids);
    const admit = await f.post('/integrations/claude/native/admit', {
      sessionId: f.session,
      delivery,
    });
    assert.equal(admit.status, 200, JSON.stringify(admit.body));
    if (expectedCount === 2) {
      assert.ok(String(admit.body.body).includes(low.text));
      assert.ok(String(admit.body.body).includes('Reply-To: r' + physical.toString(36)));
    }
    const before = f.wakes().length;
    const report = await f.post('/integrations/claude/native/report', {
      sessionId: f.session,
      delivery,
      reportKey: prepare.body.reportKey,
      phase: 'stored',
      storedRowId: randomUUID(),
      representationHash: nativeClaudeRowHash(String(admit.body.body)),
    });
    assert.deepEqual(report.body, { state: 'committed' });
    if (expectedCount === 20) await until(() => f.wakes().length > before);
  }
  assert.ok(
    pageScans <= 4,
    `native page commits must not recensus the remaining inbox: ${pageScans}`,
  );
  assert.equal(completed.length, 222);
  assert.equal(new Set(completed).size, 222);
  assert.equal(f.service.store.get(low.id, 'in')?.state, 'processed');
});

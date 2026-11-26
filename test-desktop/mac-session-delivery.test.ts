import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createMacSessionDelivery,
  type MacDeliveryHost,
} from '../desktop/main/mac-session-delivery.js';

test('session delivery checks the selected profile and releases only its own setting', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ncf-session-setting-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let profile: string | null = null;
  let current = '';
  let started = 0;
  const target = 'ws+unix://localhost/private/fixture.sock:/rpc';
  const host: MacDeliveryHost = {
    read: async () => current,
    chatgptRunning: async () => true,
    publish: async (url: string) => {
      current = url;
    },
    clear: async () => {
      current = '';
    },
    start: async (selected: string) => {
      assert.equal(selected, profile);
      started++;
      return { url: target };
    },
    stop: async () => assert.fail('An already-running process must not be stopped'),
  };
  const create = () => createMacSessionDelivery(directory, async () => profile, host);
  const first = create();
  assert.deepEqual(await first('status'), { state: 'configuration-required' });
  assert.deepEqual(await first('enable', '/private/fixture-a'), { state: 'unavailable' });
  assert.equal(started, 0);
  profile = '/private/fixture-a';
  assert.equal((await first('status')).state, 'ready');
  await first('enable', '/private/other');
  assert.equal(started, 0);
  const results = await Promise.all([first('enable', profile), first('enable', profile)]);
  assert.deepEqual(results, [
    { state: 'enabled', scope: 'login', profile, restartRequired: true },
    { state: 'enabled', scope: 'login', profile },
  ]);
  assert.equal(started, 1);
  assert.equal(current, target);
  const restarted = create();
  assert.deepEqual(await restarted('status'), { state: 'enabled', scope: 'login', profile });
  assert.deepEqual(await restarted('disable', profile), {
    state: 'ready',
    scope: 'login',
    profile,
    restartRequired: true,
  });
  assert.deepEqual(await restarted('disable', profile), {
    state: 'ready',
    scope: 'login',
    profile,
  });
  assert.equal(current, '');
  current = 'ws+unix://localhost/private/elsewhere:/rpc';
  assert.equal((await restarted('enable', profile)).state, 'conflict');
  assert.equal(started, 1);
  assert.equal(current, 'ws+unix://localhost/private/elsewhere:/rpc');
  current = '';
  await restarted('enable', profile);
  current = 'independently-changed';
  await restarted('disable', profile);
  assert.equal(current, 'independently-changed');
  current = '';
  const changed = createMacSessionDelivery(directory, async () => profile, {
    ...host,
    start: async () => {
      profile = '/private/fixture-b';
      return { url: target };
    },
  });
  assert.equal((await changed('enable', '/private/fixture-a')).state, 'ready');
  assert.equal(current, '');
});

test('an explicit Home to Work switch recovers the old selection if publication fails', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ncf-profile-switch-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let profile = '/fixture/Home',
    current = '',
    fail = false;
  const url = (name: string) => 'ws+unix://localhost' + name + '/owner.sock:/rpc';
  const host = {
    read: async () => current,
    chatgptRunning: async () => true,
    clear: async () => {
      current = '';
    },
    start: async (p: string) => ({ url: url(p) }),
    stop: async () => assert.fail('An already-running process must not be stopped'),
    publish: async (value: string) => {
      if (fail) throw Error('publish failed');
      current = value;
    },
  };
  const create = () => createMacSessionDelivery(dir, async () => profile, host);
  await create()('enable', profile);
  profile = '/fixture/Work';
  fail = true;
  await assert.rejects(create()('enable', profile), /publish failed/);
  assert.deepEqual(await create()('status'), {
    state: 'enabled',
    scope: 'login',
    profile: '/fixture/Home',
  });
  fail = false;
  assert.deepEqual(await create()('enable', profile), {
    state: 'enabled',
    scope: 'login',
    profile,
    restartRequired: true,
  });
  await create()('disable', '/fixture/Home');
  assert.equal(current, url(profile));
});

const urlFor = (profile: string) => 'ws+unix://localhost' + profile + '/owner.sock:/rpc';
const witness = (profile: string, pid: number) => ({
  pid,
  executable: '/fixture/vendor/codex',
  profile,
  marker: '14b6f727-1c32-4d43-8b06-d4d2da257da4',
  startedAt: '100:200',
});

test('only owned processes are stopped across profile switches and an interrupted disable can retry', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ncf-managed-delivery-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const home = '/fixture/Home';
  const work = '/fixture/Work';
  const own = new Set([123, 456]);
  const unrelated = new Set([789]);
  const issued: number[] = [];
  let profile = home;
  let current = '';
  let blocked = true;
  const host: MacDeliveryHost = {
    read: async () => current,
    chatgptRunning: async () => true,
    clear: async () => {
      current = '';
    },
    publish: async (url) => {
      current = url;
    },
    start: async (p) => ({ url: urlFor(p), managed: witness(p, p === home ? 123 : 456) }),
    stop: async (item) => {
      issued.push(item.pid);
      assert.deepEqual(item, witness(item.pid === 123 ? home : work, item.pid));
      assert.ok(!unrelated.has(item.pid));
      if (item.pid === 456 && blocked) throw new Error('Graceful exit not yet observed');
      own.delete(item.pid);
    },
  };
  const create = () => createMacSessionDelivery(dir, async () => profile, host);
  await create()('enable', home);
  profile = work;
  await create()('enable', work);
  await create()('disable', home);
  assert.deepEqual(issued, []);
  await assert.rejects(create()('disable', work), /Graceful exit not yet observed/);
  assert.deepEqual([...own], [456]);
  assert.equal(current, urlFor(work));
  assert.equal((await create()('status')).state, 'enabled');
  blocked = false;
  assert.deepEqual(await create()('disable', work), {
    state: 'ready',
    scope: 'login',
    profile: work,
    restartRequired: true,
  });
  assert.deepEqual(issued, [123, 456, 123, 456]);
  assert.deepEqual([...own], []);
  assert.deepEqual([...unrelated], [789]);
  assert.equal(current, '');
});

test('an older receipt releases only its login selector without inferring process ownership', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ncf-legacy-delivery-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const profile = '/fixture/Home';
  let current = urlFor(profile);
  await writeFile(
    path.join(dir, 'mac-session-delivery.json'),
    JSON.stringify({ profile, url: current }),
    { mode: 0o600 },
  );
  const change = createMacSessionDelivery(dir, async () => null, {
    read: async () => current,
    chatgptRunning: async () => false,
    clear: async () => {
      current = '';
    },
    publish: async () => assert.fail('Disable must not publish'),
    start: async () => assert.fail('Disable must not start a process'),
    stop: async () => assert.fail('The receipt has no process ownership proof'),
  });
  assert.deepEqual(await change('disable', profile), {
    state: 'ready',
    scope: 'login',
    profile,
  });
  assert.equal(current, '');
});

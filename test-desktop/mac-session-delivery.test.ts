import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createMacSessionDelivery } from '../desktop/main/mac-session-delivery.js';

test('session delivery checks the selected profile and releases only its own setting', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ncf-session-setting-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let profile: string | null = null;
  let current = '';
  let started = 0;
  const target = 'ws+unix://localhost/private/fixture.sock:/rpc';
  const host = {
    read: async () => current,
    publish: async (url: string) => {
      current = url;
    },
    clear: async () => {
      current = '';
    },
    start: async (selected: string) => {
      assert.equal(selected, profile);
      started++;
      return target;
    },
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
  assert.ok(results.every((result) => result.state === 'enabled'));
  assert.equal(started, 1);
  assert.equal(current, target);
  const restarted = create();
  assert.deepEqual(await restarted('status'), { state: 'enabled', scope: 'login', profile });
  assert.equal((await restarted('disable', profile)).state, 'ready');
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
      return target;
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
    clear: async () => {
      current = '';
    },
    start: async (p: string) => url(p),
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
  });
  await create()('disable', '/fixture/Home');
  assert.equal(current, url(profile));
});

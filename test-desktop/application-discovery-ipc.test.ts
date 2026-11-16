import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BrowserWindow, Dialog } from 'electron';
import { createApplicationDiscoveryHandler } from '../desktop/main/application-discovery-ipc.js';
import type { DiscoveryFiles } from '../desktop/core/application-discovery-platforms.js';
import type { ApplicationDiscoverySnapshot } from '../desktop/shared/application-discovery.js';

const emptyFiles: DiscoveryFiles = {
  canonical: async () => undefined,
  bytes: async () => Buffer.alloc(0),
  executable: async () => false,
  plist: async () => ({}),
  packageIdentity: async () => undefined,
  windowsCodex: async () => [],
};
function harness(files = emptyFiles, now?: () => number) {
  let picks = 0;
  const handler = createApplicationDiscoveryHandler({
    platform: 'linux',
    home: '/isolated',
    env: { PATH: '' },
    files,
    now,
    dialog: {
      showOpenDialog: async () => {
        picks++;
        return { canceled: true, filePaths: [] };
      },
    } as unknown as Pick<Dialog, 'showOpenDialog'>,
    window: () => ({ isDestroyed: () => false }) as BrowserWindow,
  });
  return { handler, picks: () => picks };
}

test('owner-only discovery IPC validates arguments and cannot write setup or inject a path', async () => {
  const { handler, picks } = harness();
  await assert.rejects(handler('applicationDiscovery', {}, ''), /session is missing/);
  await assert.rejects(
    handler('applicationDiscoveryChoose', { client: 'cursor', path: '/injected' }, 'owner'),
  );
  assert.equal(picks(), 0);
  assert.deepEqual(await handler('agent_send', {}, ''), { handled: false });
  await handler('applicationDiscoveryChoose', { client: 'cursor' }, 'owner');
  assert.equal(picks(), 1);
});

test('late startup scan cannot overwrite a newer manual refresh', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let blocked = false,
    time = 1000;
  const files = {
    ...emptyFiles,
    canonical: async (filename: string) => {
      if (!blocked && filename === '/usr/share/cursor') {
        blocked = true;
        await gate;
      }
      return undefined;
    },
  };
  const { handler } = harness(files, () => time);
  const startup = handler('applicationDiscovery', {}, 'owner');
  time = 2000;
  const refreshed = await handler('applicationDiscoveryRefresh', {}, 'owner');
  release();
  const initial = await startup;
  assert.ok(initial.handled && refreshed.handled);
  assert.equal(
    (initial.result as ApplicationDiscoverySnapshot).checkedAt,
    (refreshed.result as ApplicationDiscoverySnapshot).checkedAt,
  );
  assert.equal(
    (initial.result as ApplicationDiscoverySnapshot).checkedAt,
    '1970-01-01T00:00:02.000Z',
  );
});

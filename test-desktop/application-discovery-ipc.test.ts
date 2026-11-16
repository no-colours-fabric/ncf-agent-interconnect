import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BrowserWindow, Dialog } from 'electron';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
    stateDirectory: path.join(os.tmpdir(), 'ncf-discovery-ipc-' + randomUUID()),
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
    window: () => ({ isDestroyed: () => false, isVisible: () => true }) as BrowserWindow,
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

test('offers persist only after an exact owner window becomes visible', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-discovery-owner-'));
  try {
    const known = new Set([
      '/usr/share/cursor',
      '/usr/share/cursor/cursor',
      '/usr/share/cursor/resources/app/product.json',
    ]);
    const files: DiscoveryFiles = {
      ...emptyFiles,
      canonical: async (filename) => (known.has(filename) ? filename : undefined),
      executable: async (filename) => filename === '/usr/share/cursor/cursor',
      bytes: async () =>
        Buffer.from(JSON.stringify({ applicationName: 'cursor', nameShort: 'Cursor' })),
    };
    let visible = false;
    const options = {
      platform: 'linux' as const,
      stateDirectory: directory,
      home: '/isolated',
      env: { PATH: '' },
      files,
      dialog: {
        showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
      } as unknown as Pick<Dialog, 'showOpenDialog'>,
      window: () => ({ isDestroyed: () => false, isVisible: () => visible }) as BrowserWindow,
    };
    const handler = createApplicationDiscoveryHandler(options);
    const snapshot = await handler('applicationDiscovery', {}, 'owner');
    assert.ok(snapshot.handled);
    assert.deepEqual((snapshot.result as ApplicationDiscoverySnapshot).offers, ['cursor']);
    const filename = path.join(directory, 'application-discovery.json');
    await assert.rejects(readFile(filename), { code: 'ENOENT' });
    await assert.rejects(
      handler('applicationDiscoveryOffered', { clients: ['cursor'] }, 'owner'),
      /must be visible/,
    );
    await assert.rejects(readFile(filename), { code: 'ENOENT' });
    visible = true;
    await assert.rejects(
      handler('applicationDiscoveryOffered', { clients: ['codex'] }, 'owner'),
      /no longer available/,
    );
    await handler('applicationDiscoveryOffered', { clients: ['cursor'] }, 'owner');
    const restarted = createApplicationDiscoveryHandler(options);
    const next = await restarted('applicationDiscovery', {}, 'owner');
    assert.ok(next.handled);
    assert.deepEqual((next.result as ApplicationDiscoverySnapshot).offers, []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

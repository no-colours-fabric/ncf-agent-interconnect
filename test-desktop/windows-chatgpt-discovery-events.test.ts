import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { type spawn } from 'node:child_process';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { Dialog } from 'electron';
import { createApplicationDiscoveryHandler } from '../desktop/main/application-discovery-ipc.js';
import { detectChatgptCompatibility } from '../desktop/main/chatgpt-version.js';
import { watchWindowsChatgptInstallation } from '../desktop/main/chatgpt-windows-installation-events.js';
import type { DiscoveryFiles } from '../desktop/core/application-discovery-platforms.js';
import type { ApplicationDiscoverySnapshot } from '../desktop/shared/application-discovery.js';

test('Windows package invalidation publishes unknown and threshold changes through cached discovery without Refresh', async (t) => {
  const tempRoot = await realpath(os.tmpdir());
  const state = await realpath(await mkdtemp(path.join(tempRoot, 'ncf-win-discovery-')));
  let version: string | undefined;
  let reads = 0;
  const root = 'C:\\NCF-fixture\\OpenAI.Codex';
  const executable = root + '\\app\\ChatGPT.exe';
  const archivePath = root + '\\app\\resources\\app.asar';
  const files: DiscoveryFiles = {
    async canonical(filename) {
      return [root, executable, archivePath].includes(filename) ? filename : undefined;
    },
    async bytes(filename, size, offset = 0) {
      assert.equal(filename, archivePath);
      if (!version) return Buffer.alloc(0);
      const manifest = Buffer.from(
        JSON.stringify({ name: 'openai-codex-electron', author: 'OpenAI', version }),
      );
      const header = Buffer.from(
        JSON.stringify({ files: { 'package.json': { offset: '0', size: manifest.length } } }),
      );
      const prefix = Buffer.alloc(16);
      prefix.writeUInt32LE(4, 0);
      prefix.writeUInt32LE(header.length + 8, 4);
      prefix.writeUInt32LE(header.length, 12);
      return Buffer.concat([prefix, header, manifest]).subarray(offset, offset + size);
    },
    async executable() {
      return true;
    },
    async plist() {
      return {};
    },
    async packageIdentity() {
      return undefined;
    },
    async windowsCodex() {
      reads++;
      return [{ root, executable, packageFullName: 'OpenAI.Codex_fixture', architecture: 'x64' }];
    },
  };
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
  });
  const launch = (() => child) as unknown as typeof spawn;
  let published = 0;
  let completed: (() => void) | undefined;
  const handler = createApplicationDiscoveryHandler({
    platform: 'win32',
    home: 'C:\\NCF-fixture',
    env: {},
    files,
    stateDirectory: state,
    window: () => null,
    dialog: { showOpenDialog: () => assert.fail('A package event must not prompt') } as Pick<
      Dialog,
      'showOpenDialog'
    >,
    chatgptCompatibility: () => detectChatgptCompatibility(files, 'win32'),
    watchChatgptInstallations: (changed) => ({
      update() {},
      close: watchWindowsChatgptInstallation(changed, { platform: 'win32', launch }),
    }),
    onChatgptInstallationsChanged: () => {
      published++;
      completed?.();
    },
  });
  t.after(async () => {
    handler.close();
    assert.ok(state.startsWith(tempRoot + path.sep));
    await rm(state, { recursive: true });
  });
  async function snapshot() {
    const result = await handler('applicationDiscovery', {}, 'fixture-owner');
    assert.ok(result.handled);
    return result.result as ApplicationDiscoverySnapshot;
  }
  async function event(marker: 'ready' | 'changed') {
    const before = published;
    await new Promise<void>((resolve) => {
      completed = resolve;
      child.stdout.write(marker + '\n');
    });
    completed = undefined;
    assert.equal(published, before + 1);
  }
  assert.equal((await snapshot()).chatgptCompatibility?.version, undefined);
  await event('ready');
  assert.equal((await snapshot()).chatgptCompatibility?.version, undefined);
  for (const next of ['26.1111.71703', '26.1111.71704', '26.1111.71705', undefined]) {
    version = next;
    await event('changed');
    assert.equal((await snapshot()).chatgptCompatibility?.version, next);
  }
  const before = { reads, published };
  for (const guiEvent of ['gui-open', 'gui-close']) {
    child.emit(guiEvent);
    assert.equal((await snapshot()).chatgptCompatibility?.version, undefined);
  }
  assert.deepEqual({ reads, published }, before);
  handler.close();
  assert.equal(child.stdin.writableEnded, true);
  child.stdout.write('changed\n');
  assert.equal(published, before.published);
});

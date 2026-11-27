import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, realpath, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import type { Dialog } from 'electron';
import {
  createApplicationDiscoveryHandler,
  createNativeDiscoveryFiles,
} from '../desktop/main/application-discovery-ipc.js';
import { detectChatgptCompatibility } from '../desktop/main/chatgpt-version.js';
import { watchMacChatgptInstallations } from '../desktop/main/mac-chatgpt-installations.js';
import type { ApplicationDiscoverySnapshot } from '../desktop/shared/application-discovery.js';

// Use actual filesystem events and native bundle metadata without starting a desktop.
test(
  'macOS discovery publishes install, update and remove without an owner refresh',
  {
    skip: process.platform !== 'darwin',
    timeout: 20000,
  },
  async (t) => {
    const home = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ncf-chatgpt-installation-')));
    t.after(() => rm(home, { recursive: true, force: true }));
    const applications = path.join(home, 'Applications');
    const app = path.join(applications, 'ChatGPT.app');
    const stateDirectory = path.join(home, 'state');
    const native = createNativeDiscoveryFiles('darwin');
    const canonical = native.canonical.bind(native);
    const files = Object.assign(native, {
      canonical: (filename: string) =>
        filename.startsWith(home + path.sep) ? canonical(filename) : Promise.resolve(undefined),
    });
    const contents = (bundle: string) => path.join(bundle, 'Contents');
    const info = (bundle: string) => path.join(contents(bundle), 'Info.plist');
    const plist = (version: string) =>
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<plist version="1.0"><dict>' +
      '<key>CFBundleIdentifier</key><string>com.openai.codex</string>' +
      '<key>CFBundleExecutable</key><string>ChatGPT</string>' +
      '<key>CFBundleVersion</key><string>29030</string>' +
      '<key>CFBundleShortVersionString</key><string>' +
      version +
      '</string></dict></plist>';
    async function fixture(bundle: string, version: string) {
      const executable = path.join(contents(bundle), 'MacOS/ChatGPT');
      await mkdir(path.dirname(executable), { recursive: true });
      // Copying the fixture binary keeps canonical installation paths inside the bundle.
      await copyFile(process.execPath, executable);
      await writeFile(info(bundle), plist(version));
    }
    let changes = 0;
    const handler = createApplicationDiscoveryHandler({
      platform: 'darwin',
      home,
      env: {},
      files,
      stateDirectory,
      window: () => null,
      dialog: { showOpenDialog: () => assert.fail('This check must not prompt') } as Pick<
        Dialog,
        'showOpenDialog'
      >,
      chatgptCompatibility: (installs) => detectChatgptCompatibility(files, 'darwin', installs),
      watchChatgptInstallations: (changed) => watchMacChatgptInstallations([applications], changed),
      onChatgptInstallationsChanged: () => changes++,
    });
    t.after(handler.close);

    async function version() {
      const response = await handler('applicationDiscovery', {}, 'owner');
      assert.ok(response.handled);
      return (response.result as ApplicationDiscoverySnapshot).chatgptCompatibility?.version;
    }

    async function change(expected: string | undefined, mutate: () => Promise<void>) {
      const baseline = changes;
      await mutate();
      const deadline = Date.now() + 4000;
      do {
        if (changes > baseline && (await version()) === expected) return;
        await setTimeout(35);
      } while (Date.now() < deadline);
      assert.fail(
        'Expected a published version change to ' + expected + ', got ' + (await version()),
      );
    }

    assert.equal(await version(), undefined);
    const first = path.join(home, 'first.app');
    await fixture(first, '26.1111.71703');
    await change('26.1111.71703', async () => {
      await mkdir(applications);
      await rename(first, app);
    });
    await change('26.1111.71704', async () => {
      await writeFile(info(app) + '.tmp', plist('26.1111.71704'));
      await rename(info(app) + '.tmp', info(app));
    });
    const next = path.join(home, 'next.app');
    await fixture(next, '26.1111.71705');
    await change('26.1111.71705', async () => {
      await rename(app, path.join(home, 'old.app'));
      await rename(next, app);
    });
    await change(undefined, () => rm(app, { recursive: true }));
  },
);

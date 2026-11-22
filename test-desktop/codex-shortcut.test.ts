import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import type { BrowserWindow } from 'electron';
import { McpSetupPaths } from '../desktop/core/mcp-setup-paths.js';
import { McpSetupService } from '../desktop/core/mcp-setup.js';
import { mcpInstructions } from '../desktop/core/instructions.js';
import {
  codexShortcutPlatform,
  createCodexShortcutHandler,
} from '../desktop/main/codex-shortcut-ipc.js';
import {
  createMacCodexShortcut,
  verifyMacCodexShortcut,
  type MacCodexDesktopWitness,
} from '../desktop/main/codex-shortcut-mac.js';
import {
  codexShortcutDisplayName,
  hasCodexShortcutLaunchFlags,
  type CodexShortcutDestination,
  type CodexShortcutDestinationResult,
} from '../desktop/shared/codex-shortcut.js';
import { supportedLocales, t } from '../desktop/renderer/i18n/index.js';
import { mcpSetupMessages } from '../desktop/renderer/i18n/mcp-setup.js';
import {
  codexShortcutLocales,
  codexShortcutMessages,
} from '../desktop/shared/codex-shortcut-messages.js';

const execute = promisify(execFile);
const macShortcutName = codexShortcutDisplayName + '.app';
const windowsShortcutName = codexShortcutDisplayName + '.lnk';
test('shortcut supports installed desktop platforms and provides independent localized copy', () => {
  assert.equal(codexShortcutPlatform('darwin', false), null);
  assert.equal(codexShortcutPlatform('darwin', true), 'mac');
  assert.equal(codexShortcutPlatform('linux', true), null);
  assert.equal(codexShortcutPlatform('win32', true), 'windows');
  assert.equal(codexShortcutPlatform('win32', true, true), null);
  assert.equal(codexShortcutPlatform('win32', false), null);
  assert.equal(codexShortcutPlatform('darwin', true, true), 'mac');
  assert.equal(codexShortcutDisplayName, 'ChatGPT — NCF Agent Interconnect');
  assert.deepEqual(codexShortcutLocales, supportedLocales);
  for (const locale of supportedLocales) {
    const copy = codexShortcutMessages(locale);
    assert.match(copy.action, /ChatGPT/);
    assert.match(copy.created, /ChatGPT/);
    assert.match(copy.helpBefore, /ChatGPT/);
    assert.match(copy.helpWhen, /NCF Agent Interconnect/);
    assert.match(mcpSetupMessages(locale).codexNext, /ChatGPT/);
    assert.equal(t(locale, 'clientsKindCodex'), 'ChatGPT');
    for (const [key, value] of Object.entries(copy)) {
      assert.ok(value.trim(), locale + '.' + key);
      if (locale !== 'en' && key !== 'dock')
        assert.notEqual(value, codexShortcutMessages('en')[key as keyof typeof copy]);
    }
  }
});

test('shortcut launch flags route malformed Windows entries away from ordinary startup', () => {
  assert.equal(hasCodexShortcutLaunchFlags(['--background']), false);
  assert.equal(hasCodexShortcutLaunchFlags(['--data-dir', 'isolated']), false);
  for (const args of [
    ['--launch-codex', '--launcher-manifest', 'C:\\fixture\\manifest.json'],
    ['--launch-codex'],
    ['--launch-codex=true'],
    ['--launcher-manifest'],
    ['--launcher-manifest=malformed'],
  ])
    assert.equal(hasCodexShortcutLaunchFlags(args), true, args.join(' '));
});

test('shortcut resolves the ordinary configured Codex profile automatically and asks only for selected places', async (t) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ncf-codex-profile-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const defaultProfile = path.join(root, '.codex');
  const otherProfile = path.join(root, 'Other Codex profile');
  const desktopData = path.join(root, 'AppData', 'Codex');
  const stateDirectory = path.join(root, 'ncf-state');
  await Promise.all(
    [defaultProfile, otherProfile, desktopData, stateDirectory].map((directory) =>
      mkdir(directory, { mode: 0o700, recursive: true }),
    ),
  );
  const defaultConfig = path.join(defaultProfile, 'config.toml');
  const otherConfig = path.join(otherProfile, 'config.toml');
  const pathsFile = path.join(stateDirectory, 'mcp-setup-paths.json');
  const nodeUrl = 'http://127.0.0.1:44000/mcp';
  const instructions = mcpInstructions(nodeUrl, 'isolated-test-token', 'codex', '', '{}');
  const matching = '# Preserve this comment\n' + instructions.configuration;
  const service = new McpSetupService({
    stateDirectory,
    home: root,
    env: {},
    instructions: () => instructions,
  });
  const owner = { isDestroyed: () => false } as BrowserWindow;
  const customFolder = path.join(root, 'Other location');
  await mkdir(customFolder);
  const selectedDestination = path.join(customFolder, macShortcutName);
  let pinned: string[] = [];
  const input = (...destinations: CodexShortcutDestination[]) => ({ locale: 'en', destinations });
  const complete = (...destinations: CodexShortcutDestinationResult[]) => ({
    state: 'complete',
    destinations,
  });
  const failure = (reason: string) => ({ state: 'failed', reason });
  const dialogs: string[] = [];
  const revealed: string[] = [];
  const createRequests: Array<Parameters<typeof createMacCodexShortcut>[0]> = [];
  let cancelSave = false;
  let macInstall: 'found' | 'missing' | 'ambiguous' = 'found';
  let reuseDock = true;
  let macWitnesses: MacCodexDesktopWitness[] = [];
  let boundProfiles: readonly { socket?: string; codexQueue?: boolean }[] = [];
  const options: Parameters<typeof createCodexShortcutHandler>[0] = {
    platform: 'darwin',
    installed: true,
    appExecutable: path.join(root, 'NCF'),
    appPath: root,
    appData: path.dirname(desktopData),
    userData: stateDirectory,
    home: root,
    desktop: root,
    window: () => owner,
    configurationPath: async () => (await service.defaults('codex')).files[0].path,
    boundProfiles: () => boundProfiles,
    configuredFile: (filename) => service.configuredCodexFile(filename),
    reveal: (filename) => revealed.push(filename),
    dialog: {
      showOpenDialog: async (_owner, options) => {
        dialogs.push(options.defaultPath ?? '');
        assert.deepEqual(options.properties, ['openDirectory', 'createDirectory']);
        return cancelSave
          ? { canceled: true, filePaths: [] }
          : { canceled: false, filePaths: [customFolder] };
      },
    },
  };
  const mac: NonNullable<Parameters<typeof createCodexShortcutHandler>[1]> = {
    findMacCodex: async () =>
      macInstall === 'found'
        ? {
            desktop: path.join(root, 'Codex.app'),
            desktopExecutable: path.join(root, 'Codex.app/Contents/MacOS/Codex'),
            cli: path.join(root, 'codex'),
          }
        : macInstall === 'ambiguous'
          ? null
          : undefined,
    inspectMacCodexDesktop: async () => macWitnesses.shift() ?? { state: 'notRunning' },
    isMacCodexShortcut: async (filename) =>
      createRequests.some(({ destination }) => destination === filename) &&
      (await stat(filename).catch(() => null))?.isDirectory() === true,
    macCodexDockShortcuts: async () => pinned,
    macShortcutDirectory: realpath,
    verifyMacCodexShortcut: async ({ destination, profile, desktopData: data }) =>
      reuseDock &&
      createRequests.some(
        (entry) =>
          entry.destination === destination &&
          entry.profile === profile &&
          entry.desktopData === data,
      ),
    createMacCodexShortcut: async (request) => {
      createRequests.push(request);
      await mkdir(request.destination, { mode: 0o700 });
      return 'created';
    },
  };
  const handle = createCodexShortcutHandler(options, mac);

  await writeFile(defaultConfig, matching);
  await writeFile(otherConfig, matching);
  await t.test(
    'configured without a saved setup path uses the known ordinary profile',
    async () => {
      const status = await service.status('codex');
      assert.equal(status.state, 'configured');
      assert.equal(status.remembered, false);
      boundProfiles = [{ socket: path.join(defaultProfile, 'ipc', 'ipc.sock'), codexQueue: true }];
      assert.deepEqual(
        await handle('codexShortcutCreate', input('custom')),
        complete({ destination: 'custom', result: 'created' }),
      );
      assert.deepEqual(dialogs.splice(0), [root]);
      assert.equal(createRequests.length, 1);
      assert.equal(createRequests[0].profile, defaultProfile);
      assert.equal(createRequests[0].desktopData, desktopData);
      assert.equal(createRequests[0].destination, selectedDestination);
      await assert.rejects(stat(path.join(customFolder, 'Untitled.app')), { code: 'ENOENT' });
      assert.deepEqual(await handle('codexShortcutLocations', {}), []);
      await assert.rejects(handle('codexShortcutLocations', { path: customFolder }));
      assert.equal(await readFile(defaultConfig, 'utf8'), matching);
      assert.equal(await readFile(otherConfig, 'utf8'), matching);
      await assert.rejects(stat(pathsFile), { code: 'ENOENT' });
    },
  );

  await t.test(
    'mismatch, missing and ambiguous profiles or installations make no writes',
    async () => {
      const wrongNode = matching.replace(nodeUrl, 'http://127.0.0.1:44001/mcp');
      const wrongToken = matching.replace('isolated-test-token', 'different-fixture-token');
      for (const invalid of [wrongNode, wrongToken, matching + 'enabled = false\n']) {
        await writeFile(defaultConfig, invalid);
        assert.deepEqual(
          await handle('codexShortcutCreate', input('desktop')),
          failure('setupRequired'),
        );
        assert.equal(await readFile(defaultConfig, 'utf8'), invalid);
      }
      await rm(defaultConfig);
      assert.deepEqual(
        await handle('codexShortcutCreate', input('desktop')),
        failure('setupRequired'),
      );
      await writeFile(defaultConfig, matching);
      boundProfiles = [
        { socket: path.join(otherProfile, 'ipc', 'ipc.sock') },
        { socket: path.join(defaultProfile, 'ipc', 'ipc.sock') },
      ];
      assert.deepEqual(
        await handle('codexShortcutCreate', input('desktop')),
        failure('profileUnavailable'),
      );
      boundProfiles = [];
      macInstall = 'ambiguous';
      assert.deepEqual(
        await handle('codexShortcutCreate', input('desktop')),
        failure('profileUnavailable'),
      );
      macInstall = 'missing';
      assert.deepEqual(
        await handle('codexShortcutCreate', input('desktop')),
        failure('appMissing'),
      );
      macInstall = 'found';
      await rm(desktopData, { recursive: true });
      assert.deepEqual(
        await handle('codexShortcutCreate', input('desktop')),
        failure('profileUnavailable'),
      );
      await mkdir(desktopData);
      assert.equal(createRequests.length, 1);
      assert.deepEqual(dialogs, []);
      await assert.rejects(stat(pathsFile), { code: 'ENOENT' });
    },
  );

  await t.test('cancelling a custom location cancels every selected write', async () => {
    cancelSave = true;
    assert.deepEqual(
      await handle('codexShortcutCreate', input('desktop', 'applications', 'dock', 'custom')),
      { state: 'cancelled' },
    );
    assert.deepEqual(dialogs.splice(0), [root]);
    assert.equal(createRequests.length, 1);
    await assert.rejects(stat(path.join(root, 'Applications')), { code: 'ENOENT' });
    await assert.rejects(stat(path.join(stateDirectory, 'codex-dock')), { code: 'ENOENT' });
    cancelSave = false;
  });

  await t.test('Dock alone uses one private shortcut and reveals it only on request', async () => {
    const count = createRequests.length;
    assert.equal(await handle('codexShortcutRevealDock', {}), false);
    assert.deepEqual(
      await handle('codexShortcutCreate', input('dock')),
      complete({ destination: 'dock', result: 'dockPending' }),
    );
    const dock = createRequests[count].destination;
    assert.ok(dock.startsWith(path.join(stateDirectory, 'codex-dock') + path.sep));
    assert.deepEqual(revealed, []);
    assert.equal(await handle('codexShortcutRevealDock', {}), true);
    assert.deepEqual(revealed.splice(0), [dock]);
    await assert.rejects(handle('codexShortcutRevealDock', { path: root }));
    assert.deepEqual(
      await handle('codexShortcutCreate', input('dock')),
      complete({ destination: 'dock', result: 'dockPending' }),
    );
    assert.equal(createRequests.length, count + 1);
    reuseDock = false;
    assert.deepEqual(
      await handle('codexShortcutCreate', input('dock')),
      complete({ destination: 'dock', result: 'dockUnavailable' }),
    );
    reuseDock = true;
    assert.equal(await handle('codexShortcutRevealDock', {}), false);
    await assert.rejects(stat(path.join(root, macShortcutName)), { code: 'ENOENT' });
    await assert.rejects(stat(path.join(root, 'Applications')), { code: 'ENOENT' });
    assert.deepEqual(dialogs, []);
  });

  await t.test(
    'Mac reports standard locations, no-clobber and the manual Dock step separately',
    async () => {
      const alreadyPresent = path.join(root, macShortcutName);
      const previousName = path.join(root, 'Codex with NCF.app');
      await writeFile(alreadyPresent, 'Existing shortcut stays');
      await writeFile(previousName, 'Legacy shortcut stays');
      const count = createRequests.length;
      assert.deepEqual(
        await handle('codexShortcutCreate', input('desktop', 'applications', 'dock')),
        complete(
          { destination: 'desktop', result: 'alreadyExists' },
          { destination: 'applications', result: 'created' },
          { destination: 'dock', result: 'dockPending' },
        ),
      );
      assert.deepEqual(dialogs, []);
      assert.equal(createRequests.length, count + 1);
      const applicationsShortcut = path.join(root, 'Applications', macShortcutName);
      assert.equal(createRequests[count].destination, applicationsShortcut);
      assert.equal(createRequests[count].profile, defaultProfile);
      assert.equal(await handle('codexShortcutRevealDock', {}), true);
      assert.deepEqual(revealed.splice(0), [applicationsShortcut]);
      assert.equal(await readFile(alreadyPresent, 'utf8'), 'Existing shortcut stays');
      assert.equal(await readFile(previousName, 'utf8'), 'Legacy shortcut stays');
      assert.deepEqual(await handle('codexShortcutLocations', {}), ['applications']);
      pinned = [applicationsShortcut];
      assert.deepEqual(await handle('codexShortcutLocations', {}), ['applications', 'dock']);
      pinned = [];
      await rm(alreadyPresent);
      assert.deepEqual(
        await handle('codexShortcutCreate', input('desktop')),
        complete({ destination: 'desktop', result: 'created' }),
      );
      assert.deepEqual(await handle('codexShortcutLocations', {}), ['desktop', 'applications']);
      await rm(alreadyPresent, { recursive: true });
      assert.deepEqual(await handle('codexShortcutLocations', {}), ['applications']);
      assert.deepEqual(
        await handle('codexShortcutCreate', input('desktop')),
        complete({ destination: 'desktop', result: 'created' }),
      );
      assert.deepEqual(await handle('codexShortcutLocations', {}), ['desktop', 'applications']);
      assert.equal(await readFile(previousName, 'utf8'), 'Legacy shortcut stays');

      await assert.rejects(stat(pathsFile), { code: 'ENOENT' });
    },
  );

  await t.test(
    'Windows uses the verified ordinary profile for Desktop and the user Programs folder',
    async () => {
      const desktop = path.join(root, windowsShortcutName);
      const programs = path.join(root, 'Redirected Programs');
      await mkdir(programs);
      const startMenu = path.join(programs, windowsShortcutName);
      const legacyStartMenu = path.join(programs, 'Codex with NCF.lnk');
      const manifest = path.join(
        stateDirectory,
        'codex-launchers',
        'a'.repeat(32),
        'manifest.json',
      );
      const installed = { asarHash: '2'.repeat(64), profile: defaultProfile };
      const stale = { ...installed, asarHash: '6'.repeat(64) };
      const verificationCalls: string[] = [];
      let linkTarget = options.appExecutable;
      let linkManifest = manifest;
      let resolveCalls = 0;
      let existing = false;
      let profileState: 'ready' | 'appMissing' | 'profileUnavailable' = 'ready';
      const createCalls: string[] = [];
      const create = createCodexShortcutHandler({ ...options, platform: 'win32' }, undefined, {
        create: async (request, context) => {
          createCalls.push(request.destination);
          assert.deepEqual(request, {
            destination:
              createCalls.length === 2 ? path.join(programs, windowsShortcutName) : desktop,
            profile: defaultProfile,
            desktopData,
            appExecutable: options.appExecutable,
            appPath: root,
          });
          assert.deepEqual(context, { userData: stateDirectory });
          if (existing) return 'alreadyExists';
          await writeFile(request.destination, 'New Windows link', { flag: 'wx' });
          return 'created';
        },
        readLink: async () =>
          ({
            target: linkTarget,
            args: '--launch-codex --launcher-manifest "' + linkManifest + '"',
          }) as Awaited<
            ReturnType<NonNullable<Parameters<typeof createCodexShortcutHandler>[2]>['readLink']>
          >,
        programs: async () => {
          resolveCalls++;
          return programs;
        },
        desktopData: async (appData) => {
          assert.equal(appData, path.dirname(desktopData));
          return profileState === 'ready'
            ? { state: 'ready', directory: desktopData }
            : { state: profileState };
        },
        verifyManifest: async (filename: string, expected: Record<string, string>) => {
          verificationCalls.push(filename);
          assert.deepEqual(expected, {
            userData: stateDirectory,
            appExecutable: options.appExecutable,
            appPath: options.appPath,
            profile: defaultProfile,
            desktopData,
          });
          const saved = JSON.parse(await readFile(filename, 'utf8'));
          return saved.asarHash === installed.asarHash && saved.profile === expected.profile;
        },
      });
      assert.equal((await service.status('codex')).remembered, false);
      boundProfiles = [{ socket: String.raw`\\.\pipe\codex-ipc` }];
      assert.deepEqual(
        await create('codexShortcutCreate', input('desktop', 'startMenu')),
        complete(
          { destination: 'desktop', result: 'created' },
          { destination: 'startMenu', result: 'created' },
        ),
      );
      assert.equal(createCalls.length, 2);
      assert.equal(resolveCalls, 1);
      existing = true;
      await writeFile(desktop, 'Existing Windows link');
      await rm(startMenu);
      assert.deepEqual(
        await create('codexShortcutCreate', input('desktop')),
        complete({ destination: 'desktop', result: 'alreadyExists' }),
      );
      assert.deepEqual(createCalls, [desktop, path.join(programs, windowsShortcutName), desktop]);
      assert.equal(await readFile(desktop, 'utf8'), 'Existing Windows link');
      assert.deepEqual(await create('codexShortcutLocations', {}), []);
      await mkdir(path.dirname(manifest), { recursive: true });
      await writeFile(legacyStartMenu, 'Legacy Windows link');
      await writeFile(manifest, JSON.stringify(stale));
      assert.deepEqual(
        await create('codexShortcutLocations', {}),
        [],
        '690 manifest after update to 2ac',
      );
      await writeFile(manifest, JSON.stringify(installed));
      assert.deepEqual(await create('codexShortcutLocations', {}), ['desktop']);
      assert.equal(await readFile(legacyStartMenu, 'utf8'), 'Legacy Windows link');
      await writeFile(startMenu, 'Current Windows link');
      const previousVerifications = verificationCalls.length;
      assert.deepEqual(await create('codexShortcutLocations', {}), ['desktop', 'startMenu']);
      assert.deepEqual(verificationCalls.slice(previousVerifications), [manifest]);
      await rm(desktop);
      assert.deepEqual(await create('codexShortcutLocations', {}), ['startMenu']);
      existing = false;
      assert.deepEqual(
        await create('codexShortcutCreate', input('desktop')),
        complete({ destination: 'desktop', result: 'created' }),
      );
      assert.equal(await readFile(desktop, 'utf8'), 'New Windows link');
      assert.deepEqual(await create('codexShortcutLocations', {}), ['desktop', 'startMenu']);
      const beforeForeignLinks = verificationCalls.length;
      linkTarget = path.join(root, 'Not NCF');
      assert.deepEqual(await create('codexShortcutLocations', {}), []);
      linkTarget = options.appExecutable;
      linkManifest = path.join(root, 'manifest.json');
      await writeFile(linkManifest, JSON.stringify(installed));
      assert.deepEqual(await create('codexShortcutLocations', {}), []);
      assert.equal(verificationCalls.length, beforeForeignLinks);
      linkManifest = manifest;
      await writeFile(manifest, JSON.stringify({ ...installed, profile: otherProfile }));
      assert.deepEqual(await create('codexShortcutLocations', {}), []);
      await writeFile(manifest, '{');
      assert.deepEqual(await create('codexShortcutLocations', {}), []);
      assert.equal(await readFile(manifest, 'utf8'), '{');

      assert.deepEqual(await create('codexShortcutCreate', input('dock')), failure('failed'));
      await assert.rejects(create('codexShortcutCreate', input('desktop', 'desktop')));
      for (const state of ['appMissing', 'profileUnavailable'] as const) {
        profileState = state;
        assert.deepEqual(await create('codexShortcutCreate', input('desktop')), failure(state));
      }
      assert.equal(createCalls.length, 4);
      assert.deepEqual(dialogs, []);
      boundProfiles = [];
      await assert.rejects(stat(pathsFile), { code: 'ENOENT' });
    },
  );

  await t.test(
    'the exact running Mac Work pair wins with stock configuration and mixed bindings',
    async () => {
      const workProfile = path.join(root, '.codex-work');
      const workData = path.join(root, 'AppData', 'Codex-work');
      const workDesktop = path.join(root, 'Work desktop');
      await Promise.all([workProfile, workData, workDesktop].map((directory) => mkdir(directory)));
      const workConfig = path.join(workProfile, 'config.toml');
      await writeFile(workConfig, matching);
      const work = {
        state: 'running',
        profile: workProfile,
        desktopData: workData,
        process: '42:17:3',
      } as const;
      // The binding count and initial default both favor the other profile.
      const stock = { socket: path.join(defaultProfile, 'ipc', 'ipc.sock') };
      boundProfiles = [stock, stock, { socket: path.join(workProfile, 'ipc', 'ipc.sock') }];
      assert.equal((await service.status('codex')).remembered, false);
      const create = createCodexShortcutHandler({ ...options, desktop: workDesktop }, mac);
      const count = createRequests.length;
      macWitnesses = [work, { ...work, process: '42:18:9' }];
      assert.deepEqual(
        await create('codexShortcutCreate', input('desktop')),
        failure('profileUnavailable'),
      );
      macWitnesses = [work, { state: 'notRunning' }];
      assert.deepEqual(
        await create('codexShortcutCreate', input('desktop')),
        failure('profileUnavailable'),
      );
      macWitnesses = [{ state: 'unavailable' }];
      assert.deepEqual(
        await create('codexShortcutCreate', input('desktop')),
        failure('profileUnavailable'),
      );
      await writeFile(workConfig, '# Work is not configured for this node\n');
      macWitnesses = [work];
      assert.deepEqual(
        await create('codexShortcutCreate', input('desktop')),
        failure('setupRequired'),
      );
      assert.equal(createRequests.length, count);
      await assert.rejects(stat(path.join(workDesktop, macShortcutName)), { code: 'ENOENT' });
      await writeFile(workConfig, matching);
      macWitnesses = [work, work];
      assert.deepEqual(
        await create('codexShortcutCreate', input('desktop')),
        complete({ destination: 'desktop', result: 'created' }),
      );
      assert.equal(createRequests.length, count + 1);
      assert.equal(createRequests[count].profile, workProfile);
      assert.equal(createRequests[count].desktopData, workData);
      assert.equal(await readFile(workConfig, 'utf8'), matching);
      assert.equal(await readFile(defaultConfig, 'utf8'), matching);
      assert.deepEqual(dialogs, []);
      await assert.rejects(stat(pathsFile), { code: 'ENOENT' });
      boundProfiles = [];
    },
  );

  await t.test(
    'an explicitly configured nonstandard profile is not swapped for a matching default',
    async () => {
      await new McpSetupPaths(stateDirectory).remember('codex', otherConfig);
      const remembered = await readFile(pathsFile, 'utf8');
      const count = createRequests.length;
      assert.deepEqual(
        await handle('codexShortcutCreate', input('desktop')),
        failure('profileUnavailable'),
      );
      assert.equal(createRequests.length, count);
      assert.deepEqual(dialogs, []);
      assert.equal(await readFile(pathsFile, 'utf8'), remembered);
      assert.equal(await readFile(defaultConfig, 'utf8'), matching);
      assert.equal(await readFile(otherConfig, 'utf8'), matching);
    },
  );
});

test(
  'Mac shortcut creates a signed bundle, refuses replacement, and passes CLI arguments without launch environment',
  { skip: process.platform !== 'darwin' || process.env.NCF_TEST_CODEX_SHORTCUT_RUNTIME !== '1' },
  async (t) => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ncf-shortcut-')));
    t.after(() => rm(root, { recursive: true, force: true }));
    const profile = path.join(root, "Codex's profile");
    const desktopData = path.join(root, 'Desktop data');
    await mkdir(profile, { mode: 0o700 });
    await mkdir(desktopData, { mode: 0o700 });
    const bridgeProfile = path.join(root, 'c');
    await mkdir(bridgeProfile, { mode: 0o700 });
    const config = path.join(profile, 'config.toml');
    await writeFile(config, '# Existing Codex settings\n');
    const cli = path.join(root, "Codex's cli");
    await writeFile(cli, '#!/bin/sh\nprintf "%s\\n" "$@"\nexit 17\n', { mode: 0o755 });
    const destination = path.join(root, macShortcutName);
    const options = {
      destination,
      profile,
      desktopData,
      cli,
      desktop: path.join(root, 'Fixture Codex.app'),
      desktopExecutable: '/not-used/in-passthrough',
      appExecutable: process.execPath,
      appPath: process.cwd(),
      alreadyOpen: 'Close this profile',
      launchFailed: 'Could not open Codex',
    };
    assert.equal(await createMacCodexShortcut(options), 'created');
    await execute('/usr/bin/codesign', ['--verify', '--strict', destination]);
    const info = path.join(destination, 'Contents/Info.plist');
    const title = await execute('/usr/libexec/PlistBuddy', [
      '-c',
      'Print :CFBundleDisplayName',
      info,
    ]);
    assert.equal(title.stdout.trim(), 'ChatGPT — NCF Agent Interconnect');
    const executable = await execute('/usr/libexec/PlistBuddy', [
      '-c',
      'Print :CFBundleExecutable',
      info,
    ]);
    assert.equal(executable.stdout.trim(), 'CodexNCF');
    assert.deepEqual(
      await readFile(path.join(destination, 'Contents/Resources/icon.icns')),
      await readFile(path.join(options.appPath, 'desktop/assets/chatgpt-shortcut.icns')),
    );
    assert.equal(await verifyMacCodexShortcut(options), true);
    assert.equal(await verifyMacCodexShortcut({ ...options, alreadyOpen: 'Other locale' }), true);
    assert.equal(await verifyMacCodexShortcut({ ...options, profile: bridgeProfile }), false);
    const wrapper = path.join(destination, 'Contents/Resources/ncf-codex-cli');
    assert.ok((await stat(wrapper)).mode & 0o111);
    const manifest = path.join(destination, 'Contents/Resources/launch.json');
    const original = await readFile(manifest, 'utf8');
    assert.deepEqual(JSON.parse(original), {
      profile,
      desktopData,
      cli,
      desktop: options.desktop,
      runtime: options.appExecutable,
      alreadyOpen: options.alreadyOpen,
      launchFailed: options.launchFailed,
    });
    assert.equal(
      await createMacCodexShortcut({ ...options, launchFailed: 'Changed' }),
      'alreadyExists',
    );
    assert.equal(await readFile(manifest, 'utf8'), original);
    const args = ['--flag', "spaces and 'quotes'", 'αβ $literal'];
    await assert.rejects(
      execute(wrapper, args, { env: {}, encoding: 'utf8' }),
      (error: NodeJS.ErrnoException & { stdout?: string }) => {
        assert.equal(Number(error.code), 17);
        assert.equal(error.stdout, args.join('\n') + '\n');
        return true;
      },
    );
    const bridgeShortcut = path.join(root, 'Ownership fixture.app');
    assert.equal(
      await createMacCodexShortcut({
        ...options,
        profile: bridgeProfile,
        destination: bridgeShortcut,
        desktopExecutable: await realpath(process.execPath),
      }),
      'created',
    );
    const cliScript = [
      '#!/bin/sh',
      'printf "%s\\n" "$@" > "$FIXTURE_ARGV"',
      'printf "%s" "${NCF_CODEX_SHORTCUT_OWNER_MARKER-}" > "$FIXTURE_MARKER"',
      'exit 17',
      '',
    ].join('\n');
    await writeFile(cli, cliScript);
    const fixtureArgs = path.join(root, 'argv');
    const verification = path.join(root, 'marker-env');
    const ownerMarker = path.join(root, 'ncf-codex-owner-AB12CD');
    const ownedWrapper = path.join(bridgeShortcut, 'Contents/Resources/ncf-codex-cli');
    const env = {
      TMPDIR: root,
      CODEX_HOME: bridgeProfile,
      NCF_CODEX_SHORTCUT_OWNER_MARKER: ownerMarker,
      FIXTURE_ARGV: fixtureArgs,
      FIXTURE_MARKER: verification,
    };
    await writeFile(ownerMarker, '', { mode: 0o600 });
    const stdio = ['app-server', '--listen', 'stdio://'];
    await assert.rejects(execute(ownedWrapper, ['app-server', '--help'], { env }), {
      code: 17,
    });
    assert.equal((await stat(ownerMarker)).size, 0, 'Help does not claim ownership');
    await assert.rejects(
      execute(ownedWrapper, stdio, { env }),
      /The Codex App Server stopped during startup/,
    );
    assert.match(await readFile(fixtureArgs, 'utf8'), /unix:\/\/.*app-server-control\.sock/);
    await assert.rejects(stat(ownerMarker), { code: 'ENOENT' });
    assert.equal(await readFile(verification, 'utf8'), '');
    await assert.rejects(execute(ownedWrapper, stdio, { env }), { code: 17 });
    assert.equal(await readFile(fixtureArgs, 'utf8'), stdio.join('\n') + '\n');

    assert.equal(await readFile(config, 'utf8'), '# Existing Codex settings\n');
  },
);

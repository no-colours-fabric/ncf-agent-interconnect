import assert from 'node:assert/strict';
import os from 'node:os';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  chatgptCompatibility,
  isChatgptReleaseUrl,
} from '../desktop/shared/chatgpt-compatibility.js';
import {
  ChatgptCompatibilityNotice,
  showsChatgptCompatibilityNotice,
} from '../desktop/renderer/ChatgptCompatibilityNotice.js';
import { DesktopSessionDeliveryModel } from '../desktop/renderer/desktop-session-delivery-model.js';
import { sessionDeliveryMessages } from '../desktop/renderer/i18n/session-delivery.js';
import { supportedLocales } from '../desktop/renderer/i18n/index.js';
import {
  detectChatgptCompatibility,
  macChatgptVersionQuery,
  sameWindowsDesktop,
} from '../desktop/main/chatgpt-version.js';
import { NativeDiscoveryFiles } from '../desktop/core/application-discovery-platforms.js';

const good = { version: '26.1111.71704', build: '29030', architecture: 'arm64' };
const affected = { version: '26.1117.41037', build: '29803', architecture: 'arm64' };
const textOnly = (markup: string) =>
  markup.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, '');
const official =
  'https://persistent.oaistatic.com/codex-app-prod/ChatGPT-darwin-arm64-26.1111.71704.zip';

test('macOS version query reads the installed desktop when AppKit returns a string zero', () => {
  const architecture = 0x0100000c;
  const installation = '/fixtures/ChatGPT.app';
  const installedVersions = ['26.1111.71703', good.version, '26.1111.71705'];
  const bundle = ({ version, build }: { version: string; build: string }) => ({
    bundleIdentifier: 'com.openai.codex',
    executableArchitectures: [architecture],
    objectForInfoDictionaryKey(key: string) {
      return key === 'CFBundleShortVersionString' ? version : build;
    },
  });
  let running = false;
  let installedVersion = installedVersions[0];
  let installedReads = 0;
  const probe = (argv: string[]) =>
    JSON.parse(
      runInNewContext(macChatgptVersionQuery + '\nrun(argv)', {
        argv,
        ObjC: {
          import() {},
          unwrap: (value: unknown) => value,
          deepUnwrap: (value: unknown) => value,
        },
        $: {
          NSRunningApplication: {
            runningApplicationsWithBundleIdentifier: () => ({
              count: running ? '1' : '0',
              objectAtIndex: () => ({
                bundleURL: 'running desktop',
                executableArchitecture: architecture,
              }),
            }),
          },
          NSBundle: {
            bundleWithPath(filename: string) {
              assert.equal(filename, installation);
              installedReads++;
              return bundle({ version: installedVersion, build: good.build });
            },
            bundleWithURL: () => bundle(affected),
          },
        },
      }),
    );
  for (const version of installedVersions) {
    installedVersion = version;
    assert.deepEqual(probe([installation]), [{ ...good, version }]);
  }
  assert.deepEqual(probe([]), []);
  running = true;
  assert.deepEqual(probe([installation]), [affected]);
  assert.deepEqual(probe([]), [affected]);
  running = false;
  assert.deepEqual(probe([installation]), [{ ...good, version: installedVersion }]);
  assert.equal(installedReads, 4);
});

test('Windows only establishes the available compatibility metadata and keeps unknown versions undefined', async (context) => {
  const missing = Object.assign(new NativeDiscoveryFiles('win32'), { windowsCodex: undefined });
  const unreadable = Object.assign(new NativeDiscoveryFiles('win32'), {
    windowsCodex() {
      throw new Error('Package query unavailable');
    },
  });
  const arch = context.mock.method(os, 'arch', () => 'x64');
  for (const files of [missing, unreadable]) {
    const result = await detectChatgptCompatibility(files, 'win32');
    assert.equal(result.status, 'unknown');
    assert.equal(result.version, undefined);
    assert.equal(result.download?.coverage, 'automatic');
    assert.equal(
      result.download?.url,
      'https://persistent.oaistatic.com/codex-app-prod/releases/26.1111.9664.0/ChatGPT-x64.msix',
    );
    assert.equal(
      showsChatgptCompatibilityNotice(result, { busy: false, notice: 'configuration-required' }),
      false,
    );
  }
  for (const architecture of ['arm64', 'ia32'] as const) {
    arch.mock.mockImplementation(() => architecture);
    const result = await detectChatgptCompatibility(missing, 'win32');
    assert.equal(result.status, 'unknown');
    assert.equal(result.download, undefined);
  }
});

test('Windows requires the registered package identity and exact manifest executable of the process', () => {
  const pkg = {
    executable: 'C:\\WindowsApps\\OpenAI.Codex_fixture\\app\\ChatGPT.exe',
    packageFullName: 'OpenAI.Codex_fixture',
  };
  const proc = { path: pkg.executable.toUpperCase(), packageFullName: pkg.packageFullName };
  assert.ok(sameWindowsDesktop(proc, pkg));
  assert.ok(!sameWindowsDesktop({ ...proc, packageFullName: undefined }, pkg));
  assert.ok(!sameWindowsDesktop({ ...proc, packageFullName: 'Other' }, pkg));
  assert.ok(!sameWindowsDesktop({ ...proc, path: 'C:\\Other\\ChatGPT.exe' }, pkg));
  assert.ok(!sameWindowsDesktop(proc, { executable: pkg.executable }));
});

test('only a tested platform, architecture and exact build can establish current-turn delivery', () => {
  assert.equal(chatgptCompatibility('darwin', good).status, 'verified');
  assert.equal(chatgptCompatibility('darwin', affected).status, 'affected');
  for (const sample of [
    { ...affected, version: '26.1117.31558' },
    { ...good, build: '1' },
    { ...affected, build: undefined },
    {},
  ])
    assert.equal(chatgptCompatibility('darwin', sample).status, 'unknown');
  for (const platform of ['linux', 'win32'] as const) {
    assert.deepEqual(chatgptCompatibility(platform, good), {
      version: good.version,
      status: 'unknown',
    });
    assert.equal(isChatgptReleaseUrl(official, platform), false);
  }
  assert.equal(
    chatgptCompatibility('darwin', { ...good, architecture: 'x64' }).download,
    undefined,
  );
  assert.equal(isChatgptReleaseUrl(official, 'darwin'), true);
  assert.equal(isChatgptReleaseUrl(official + '?other', 'darwin'), false);
  assert.equal(isChatgptReleaseUrl(official.replace('https:', 'http:'), 'darwin'), false);
});

test('the notice requires a numeric version above the cutoff and a confirmed off state', () => {
  const ready = { state: 'ready', scope: 'login', profile: '/fixture/profile' } as const;
  for (const [version, visible] of [
    ['25.9999.99999', false],
    ['26.999.99999', false],
    ['26.1111.9', false],
    ['26.1111.71703', false],
    [good.version, false],
    ['26.1111.71705', true],
    ['26.1112.1', true],
    ['27.1.1', true],
    [undefined, false],
    ['invalid', false],
    ['26.1111.9664.0', false],
  ] as const) {
    const compatibility = { status: 'unknown' as const, version };
    assert.equal(
      showsChatgptCompatibilityNotice(compatibility, { busy: false, known: ready }),
      visible,
    );
    assert.equal(
      showsChatgptCompatibilityNotice(compatibility, {
        busy: false,
        notice: 'configuration-required',
      }),
      visible,
    );
    assert.equal(
      showsChatgptCompatibilityNotice(compatibility, {
        busy: false,
        known: { ...ready, state: 'enabled' },
      }),
      false,
    );
  }
  for (const notice of [
    'conflict',
    'unavailable',
    'unsupported',
    'close-required',
    undefined,
  ] as const) {
    assert.equal(
      showsChatgptCompatibilityNotice(
        { status: 'unknown', version: affected.version },
        { busy: false, notice },
      ),
      false,
    );
  }
  assert.equal(
    showsChatgptCompatibilityNotice(
      { status: 'unknown', version: affected.version },
      { busy: false, notice: 'unavailable', known: ready },
    ),
    false,
  );
});

test('all 15 locales render the new warning and an accessible switch without a download link', () => {
  const model = new DesktopSessionDeliveryModel(async () =>
    assert.fail('Static render cannot invoke IPC'),
  );
  assert.equal(supportedLocales.length, 15);
  for (const locale of supportedLocales) {
    const copy = sessionDeliveryMessages[locale];
    const html = renderToStaticMarkup(
      createElement(ChatgptCompatibilityNotice, { model, locale, showSwitch: true }),
    );
    assert.ok(textOnly(html).includes(copy.offWarning));
    assert.ok(textOnly(html).includes(copy.label));
    assert.match(html, /role="switch"/);
    assert.doesNotMatch(html, /href=|26\.1111/);
  }
});

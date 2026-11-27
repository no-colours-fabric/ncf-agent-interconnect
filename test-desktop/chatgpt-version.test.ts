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
  chatgptCompatibilityWarning,
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

test('macOS version metadata comes from the exact installed bundle regardless of GUI state', () => {
  const installation = '/fixtures/ChatGPT.app';
  let bundleIdentifier = 'com.openai.codex';
  let version = good.version;
  const probe = () =>
    JSON.parse(
      runInNewContext(macChatgptVersionQuery + '\nrun(argv)', {
        argv: [installation],
        ObjC: {
          import(name: string) {
            assert.equal(name, 'Foundation');
          },
          unwrap: (value: unknown) => value,
          deepUnwrap: (value: unknown) => value,
        },
        $: {
          get NSRunningApplication() {
            return assert.fail('Reading installed metadata must not query running applications');
          },
          NSBundle: {
            bundleWithPath(filename: string) {
              assert.equal(filename, installation);
              return {
                bundleIdentifier,
                executableArchitectures: [0x0100000c],
                objectForInfoDictionaryKey: (key: string) =>
                  key === 'CFBundleShortVersionString' ? version : good.build,
              };
            },
          },
        },
      }),
    );

  for (const installedVersion of ['26.1111.71703', good.version, '26.1111.71705']) {
    version = installedVersion;
    assert.deepEqual(probe(), { ...good, version });
  }
  bundleIdentifier = 'test.unrelated';
  assert.throws(probe, /Unknown bundle/);
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
      chatgptCompatibilityWarning(result, { busy: false, notice: 'configuration-required' }),
      'version-unknown',
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

test('off delivery warns above the cutoff and conditionally when the version is unknown', () => {
  const ready = { state: 'ready', scope: 'login', profile: '/fixture/profile' } as const;
  for (const [version, visible] of [
    ['25.9999.99999', undefined],
    ['26.999.99999', undefined],
    ['26.1111.9', undefined],
    ['26.1111.71703', undefined],
    [good.version, undefined],
    ['26.1111.71705', 'off'],
    ['26.1112.1', 'off'],
    ['27.1.1', 'off'],
    [undefined, 'version-unknown'],
    ['invalid', 'version-unknown'],
    ['26.1111.9664.0', 'version-unknown'],
  ] as const) {
    const compatibility = { status: 'unknown' as const, version };
    assert.equal(
      chatgptCompatibilityWarning(compatibility, { busy: false, known: ready }),
      visible,
    );
    assert.equal(
      chatgptCompatibilityWarning(compatibility, {
        busy: false,
        notice: 'configuration-required',
      }),
      visible,
    );
    assert.equal(
      chatgptCompatibilityWarning(compatibility, {
        busy: false,
        known: { ...ready, state: 'enabled' },
      }),
      undefined,
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
      chatgptCompatibilityWarning(
        { status: 'unknown', version: affected.version },
        { busy: false, notice },
      ),
      undefined,
    );
  }
  assert.equal(
    chatgptCompatibilityWarning(
      { status: 'unknown', version: affected.version },
      { busy: false, notice: 'unavailable', known: ready },
    ),
    'off',
  );
});

test('all 15 locales render the new warning and an accessible switch without a download link', () => {
  const model = new DesktopSessionDeliveryModel(async () =>
    assert.fail('Static render cannot invoke IPC'),
  );
  assert.equal(supportedLocales.length, 15);
  for (const locale of supportedLocales) {
    const copy = sessionDeliveryMessages[locale];
    for (const warning of ['off', 'version-unknown'] as const) {
      const html = renderToStaticMarkup(
        createElement(ChatgptCompatibilityNotice, { model, locale, warning, showSwitch: true }),
      );
      const expected =
        warning === 'off'
          ? copy.offWarning
          : copy.unknownVersionWarning.replace('{version}', good.version);
      assert.ok(textOnly(html).includes(expected));
      assert.ok(textOnly(html).includes(copy.label));
      assert.match(html, /role="switch"/);
      assert.doesNotMatch(html, /href=/);
    }
  }
});

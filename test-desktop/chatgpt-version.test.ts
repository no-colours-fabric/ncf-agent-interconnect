import assert from 'node:assert/strict';
import os from 'node:os';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  chatgptCompatibility,
  isChatgptReleaseUrl,
} from '../desktop/shared/chatgpt-compatibility.js';
import { ChatgptCompatibilityNotice } from '../desktop/renderer/ChatgptCompatibilityNotice.js';
import { supportedLocales, t } from '../desktop/renderer/i18n/index.js';
import { detectChatgptCompatibility, sameWindowsDesktop } from '../desktop/main/chatgpt-version.js';
import { NativeDiscoveryFiles } from '../desktop/core/application-discovery-platforms.js';

const good = { version: '26.1111.71704', build: '29030', architecture: 'arm64' };
const affected = { version: '26.1117.41037', build: '29803', architecture: 'arm64' };
const official =
  'https://persistent.oaistatic.com/codex-app-prod/ChatGPT-darwin-arm64-26.1111.71704.zip';

test('Windows without version metadata keeps the warning and offers the download only on an x64 runtime', async (context) => {
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
    const html = renderToStaticMarkup(
      createElement(ChatgptCompatibilityNotice, { compatibility: result, locale: 'ru' }),
    );
    assert.ok(html.includes(t('ru', 'chatgptDeliveryUnknown')));
    assert.ok(html.includes(result.download!.url));
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

test('Windows offers its official download only for a different or unknown app version', () => {
  const windowsUrl =
    'https://persistent.oaistatic.com/codex-app-prod/releases/26.1111.9664.0/ChatGPT-x64.msix';
  for (const [version, showLink] of [
    [good.version, false],
    ['26.1117.41037', true],
    [undefined, true],
  ] as const) {
    const compatibility = chatgptCompatibility('win32', { architecture: 'x64', version });
    assert.equal(compatibility.status, 'unknown');
    const html = renderToStaticMarkup(
      createElement(ChatgptCompatibilityNotice, { compatibility, locale: 'ru' }),
    );
    assert.ok(html.includes(t('ru', 'chatgptDeliveryUnknown')));
    assert.equal(html.includes('href='), showLink);
    assert.equal(html.includes(windowsUrl), showLink);
    if (version) assert.ok(html.includes('ChatGPT ' + version));
  }
});

test('each locale distinguishes observed queueing from unverified delivery and renders the platform-specific link', () => {
  for (const locale of supportedLocales) {
    const render = (compatibility: ReturnType<typeof chatgptCompatibility>) =>
      renderToStaticMarkup(createElement(ChatgptCompatibilityNotice, { compatibility, locale }));
    assert.equal(render(chatgptCompatibility('darwin', good)), '');
    const delayed = render(chatgptCompatibility('darwin', affected));
    const unknown = render(chatgptCompatibility('linux', good));
    const win = render(chatgptCompatibility('win32', { ...affected, architecture: 'x64' }));
    assert.ok(win.includes(t(locale, 'chatgptDeliveryUnknown')));
    assert.ok(win.includes(t(locale, 'chatgptDownloadAutomatic', { version: good.version })));
    assert.ok(win.includes('/26.1111.9664.0/ChatGPT-x64.msix'));
    const equal = render(chatgptCompatibility('win32', { ...good, architecture: 'x64' }));
    assert.ok(equal.includes(t(locale, 'chatgptDeliveryUnknown')));
    assert.ok(!equal.includes('href='));
    assert.ok(delayed.includes(t(locale, 'chatgptDeliveryAffected')));
    assert.ok(delayed.includes(t(locale, 'chatgptDownloadVerified', { version: good.version })));
    assert.ok(delayed.includes(official));
    assert.ok(unknown.includes(t(locale, 'chatgptDeliveryUnknown')));
    assert.ok(!unknown.includes('href='));
    assert.notEqual(t(locale, 'chatgptDeliveryUnknown'), t(locale, 'chatgptDeliveryAffected'));
  }
});

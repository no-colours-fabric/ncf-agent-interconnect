import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  detectChatgptCompatibility,
  selectWindowsDesktopPackages,
} from '../desktop/main/chatgpt-version.js';
import { NativeDiscoveryFiles } from '../desktop/core/application-discovery-platforms.js';

const installed = {
  executable: 'C:\\WindowsApps\\OpenAI.Codex_fixture\\app\\ChatGPT.exe',
  packageFullName: 'OpenAI.Codex_fixture',
};
const other = {
  executable: 'C:\\WindowsApps\\OpenAI.Codex_other\\app\\ChatGPT.exe',
  packageFullName: 'OpenAI.Codex_other',
};
const cli = { path: 'C:\\fixture\\tools\\codex.exe', packageFullName: null };
const desktop = { path: installed.executable, packageFullName: installed.packageFullName };

test('a unique registered desktop reads its archive version even when no process reader is available', async (context) => {
  const manifest = Buffer.from(
    JSON.stringify({
      name: 'openai-codex-electron',
      author: 'OpenAI',
      version: '26.1120.50957',
      codexBuildNumber: '30866',
    }),
  );
  const header = Buffer.from(
    JSON.stringify({ files: { 'package.json': { offset: '0', size: manifest.length } } }),
  );
  const prefix = Buffer.alloc(16);
  prefix.writeUInt32LE(4, 0);
  prefix.writeUInt32LE(header.length + 8, 4);
  prefix.writeUInt32LE(header.length, 12);
  const archive = Buffer.concat([prefix, header, manifest]);
  const files = Object.assign(new NativeDiscoveryFiles('win32'), {
    async windowsCodex() {
      return [{ ...installed, root: 'C:\\WindowsApps\\OpenAI.Codex_fixture', architecture: 'x64' }];
    },
    async canonical(filename: string) {
      assert.equal(filename, 'C:\\WindowsApps\\OpenAI.Codex_fixture\\app\\resources\\app.asar');
      return filename;
    },
    async bytes(_filename: string, size: number, offset = 0) {
      return archive.subarray(offset, offset + size);
    },
  });
  // This is only the test process environment; a process reader here would fail.
  const systemRoot = process.env.SystemRoot;
  context.after(() => {
    if (systemRoot === undefined) delete process.env.SystemRoot;
    else process.env.SystemRoot = systemRoot;
  });
  process.env.SystemRoot = 'C:\\missing-qa-process-reader';
  const result = await detectChatgptCompatibility(files, 'win32');
  assert.equal(result.version, '26.1120.50957');
});

test('a closed desktop keeps its unique installed version with or without unrelated codex CLI processes', () => {
  assert.deepEqual(selectWindowsDesktopPackages([installed], []), [installed]);
  assert.deepEqual(selectWindowsDesktopPackages([installed], [cli]), [installed]);
  assert.deepEqual(selectWindowsDesktopPackages([installed], [cli, cli]), [installed]);
});

test('an exact running desktop takes precedence over other registered installations', () => {
  assert.deepEqual(selectWindowsDesktopPackages([installed, other], [cli, desktop]), [installed]);
  assert.deepEqual(
    selectWindowsDesktopPackages(
      [installed, other],
      [{ ...desktop, path: desktop.path.toUpperCase() }],
    ),
    [installed],
  );
});

test('unmatched process names or package identities cannot choose among several installations', () => {
  for (const processes of [
    [],
    [cli],
    [{ ...desktop, packageFullName: other.packageFullName }],
    [{ ...desktop, path: cli.path }],
    [{ path: installed.executable }],
  ])
    assert.deepEqual(selectWindowsDesktopPackages([installed, other], processes), []);
  assert.deepEqual(selectWindowsDesktopPackages([], [cli]), []);
});

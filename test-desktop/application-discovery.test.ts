import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { ApplicationDiscovery, desktopExecutable } from '../desktop/core/application-discovery.js';
import {
  DiscoveryError,
  type DiscoveryFiles,
  asarManifest,
  peIdentity,
} from '../desktop/core/application-discovery-platforms.js';
import {
  discoveryCatalog,
  matchesDesktopMetadata,
} from '../desktop/core/application-discovery-catalog.js';
import { mcpSetupClients, type McpSetupClient } from '../desktop/shared/mcp-setup.js';

class FixtureFiles implements DiscoveryFiles {
  entries = new Map<string, Buffer>();
  links = new Map<string, string>();
  binaries = new Set<string>();
  denied = new Set<string>();
  reads: string[] = [];
  constructor(readonly paths = path.posix) {}
  add(filename: string, value: unknown = '') {
    this.entries.set(
      filename,
      Buffer.isBuffer(value)
        ? value
        : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)),
    );
    let directory = this.paths.dirname(filename);
    while (directory !== this.paths.dirname(directory)) {
      this.entries.set(directory, Buffer.alloc(0));
      directory = this.paths.dirname(directory);
    }
  }
  async canonical(filename: string): Promise<string | undefined> {
    for (let i = 0; i < 16; i++) {
      if (this.denied.has(filename)) throw Object.assign(new Error(), { code: 'EACCES' });
      const next = this.links.get(filename);
      if (next) {
        filename = next;
        continue;
      }
      return this.entries.has(filename) ? filename : undefined;
    }
    throw new DiscoveryError('limit-exceeded');
  }
  async bytes(filename: string, size: number, offset = 0) {
    this.reads.push(filename);
    const value = this.entries.get(filename);
    if (!value) throw Object.assign(new Error(), { code: 'ENOENT' });
    return value.subarray(offset, offset + size);
  }
  async executable(filename: string) {
    return this.binaries.has(filename);
  }
  async plist(filename: string) {
    return JSON.parse((await this.bytes(filename, 1024 * 1024)).toString());
  }
  async packageIdentity() {
    return undefined;
  }
  async windowsCodex() {
    return [];
  }
}

const products: Record<McpSetupClient, Record<string, unknown>> = {
  cursor: { applicationName: 'cursor', nameShort: 'Cursor' },
  opencode: { name: '@opencode/desktop' },
  codex: { name: 'openai-codex-electron', author: 'OpenAI' },
  aionui: { name: 'AionUi', productName: 'AionUi' },
  claude: { name: 'claude-desktop' },
};

function fixtures(platform: 'darwin' | 'win32' | 'linux') {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const files = new FixtureFiles(paths);
  const home = platform === 'win32' ? 'C:\\Users\\Fixture' : '/home/fixture';
  const env =
    platform === 'win32'
      ? {
          LOCALAPPDATA: 'C:\\Users\\Fixture\\AppData\\Local',
          ProgramFiles: 'C:\\Program Files',
          PATH: '',
        }
      : { PATH: '' };
  const roots = new Map<McpSetupClient, string>();
  for (const client of mcpSetupClients) {
    const descriptor = discoveryCatalog[client];
    if (platform === 'darwin') {
      const root = paths.join('/Applications', descriptor.bundles[0].name);
      roots.set(client, root);
      files.add(paths.join(root, 'Contents/Info.plist'), {
        CFBundleIdentifier: descriptor.bundles[0].id,
        CFBundleExecutable: 'Fixture',
      });
      const binary = paths.join(root, 'Contents/MacOS/Fixture');
      files.add(binary);
      files.binaries.add(binary);
    } else {
      const location = platform === 'win32' ? descriptor.windows[0] : descriptor.linux[0];
      const root =
        platform === 'win32'
          ? paths.join(env.LOCALAPPDATA!, 'Programs', location.directory)
          : location.directory;
      roots.set(client, root);
      const binary = paths.join(root, location.executable);
      files.add(binary);
      files.binaries.add(binary);
      files.add(
        paths.join(root, 'resources/app', client === 'cursor' ? 'product.json' : 'package.json'),
        products[client],
      );
    }
  }
  const detector = () => new ApplicationDiscovery({ platform, home, env, files });
  return { paths, files, home, env, roots, detector };
}

for (const platform of ['darwin', 'win32', 'linux'] as const) {
  test(`${platform}: all five standard installations, missing, access errors, and malformed identity`, async () => {
    const f = fixtures(platform);
    assert.deepEqual(
      (await f.detector().scan()).applications.map((a) => a.status),
      Array(5).fill('detected'),
    );
    assert.equal(
      f.files.reads.some((filename) =>
        /auth|settings\.json|config\.toml|mcp\.json|\.claude\.json/.test(filename),
      ),
      false,
    );
    const absent = new ApplicationDiscovery({
      platform,
      home: f.home,
      env: f.env,
      files: new FixtureFiles(f.paths),
    });
    assert.ok(
      (await absent.scan()).applications.every((a) => a.status === 'not-found-in-known-locations'),
    );
    f.files.denied.add(f.roots.get('cursor')!);
    assert.equal(
      (await f.detector().scan()).applications.find((a) => a.client === 'cursor')!.status,
      'unknown',
    );
    f.files.denied.clear();
    const bad =
      platform === 'darwin'
        ? f.paths.join(f.roots.get('cursor')!, 'Contents/Info.plist')
        : f.paths.join(f.roots.get('cursor')!, 'resources/app/product.json');
    f.files.add(bad, {});
    assert.equal(
      (await f.detector().scan()).applications.find((a) => a.client === 'cursor')!.status,
      'unknown',
    );
  });

  test(`${platform}: Unicode custom install, duplicate links, cycle and unsupported portable`, async () => {
    const f = fixtures(platform),
      root = f.roots.get('cursor')!;
    const custom =
      platform === 'win32' ? 'D:\\Приложения\\Cursor.exe' : '/fixture/Приложения/Cursor';
    const binary =
      platform === 'darwin'
        ? f.paths.join(root, 'Contents/MacOS/Fixture')
        : f.paths.join(
            root,
            discoveryCatalog.cursor[platform === 'win32' ? 'windows' : 'linux'][0].executable,
          );
    f.files.links.set(custom, binary);
    const detector = f.detector();
    detector.choose('cursor', custom);
    assert.equal(
      (await detector.scan()).applications.find((a) => a.client === 'cursor')!.instances.length,
      1,
    );
    f.files.links.set(custom, custom);
    const cycle = (await detector.scan()).applications.find((a) => a.client === 'cursor')!;
    assert.equal(cycle.status, 'detected');
    assert.ok(cycle.coverage.some((source) => source.reason === 'limit-exceeded'));
    const portable =
      platform === 'win32' ? 'D:\\Portable\\Cursor.AppImage' : '/fixture/Cursor.AppImage';
    f.files.add(portable);
    detector.choose('cursor', portable);
    assert.ok(
      (await detector.scan()).applications
        .find((a) => a.client === 'cursor')!
        .coverage.some((c) => c.reason === 'unsupported-package-format'),
    );
  });
}

test('CLI agent alone does not imply Cursor Desktop or Codex Desktop', async () => {
  const files = new FixtureFiles();
  files.add('/bin/cursor-agent');
  files.binaries.add('/bin/cursor-agent');
  files.add('/bin/codex');
  files.binaries.add('/bin/codex');
  const scan = await new ApplicationDiscovery({
    platform: 'linux',
    home: '/fixture',
    env: { PATH: '/bin' },
    files,
  }).scan();
  assert.equal(
    scan.applications.find((a) => a.client === 'cursor')!.status,
    'not-found-in-known-locations',
  );
  assert.equal(
    scan.applications.find((a) => a.client === 'codex')!.status,
    'not-found-in-known-locations',
  );
});

test('Claude and OpenCode native/npm runtimes preserve installation versus compatibility separation', async () => {
  const files = new FixtureFiles();
  files.add('/fixture/.local/share/claude/versions/2.1.319');
  files.binaries.add('/fixture/.local/share/claude/versions/2.1.319');
  files.links.set('/fixture/.local/bin/claude', '/fixture/.local/share/claude/versions/2.1.319');
  files.add('/usr/lib/node_modules/@opencode/cli/package.json', {
    name: '@opencode/cli',
    version: '2.3.0',
    bin: { opencode: 'bin/opencode.cjs' },
  });
  files.add('/usr/lib/node_modules/@opencode/cli/bin/opencode.cjs', '#!/usr/bin/env node');
  const scan = await new ApplicationDiscovery({
    platform: 'linux',
    home: '/fixture',
    env: { PATH: '/usr/bin' },
    files,
  }).scan();
  assert.equal(scan.applications.find((a) => a.client === 'claude')!.status, 'detected');
  const opencode = scan.applications.find((a) => a.client === 'opencode')!;
  assert.equal(opencode.status, 'detected');
  assert.equal('ready' in opencode || 'apiMajor' in opencode, false);
});

test('desktop entry parser handles quoting/field codes without treating names or shell commands as identity', () => {
  assert.equal(
    desktopExecutable(
      '[Desktop Entry]\nType=Application\nName=Cursor\nExec="/opt/Space Name/cursor" --reuse-window %F\n',
    ),
    '/opt/Space Name/cursor',
  );
  assert.equal(
    desktopExecutable('[Desktop Entry]\nType=Application\nHidden=true\nExec=/bin/cursor\n'),
    undefined,
  );
  assert.throws(() =>
    desktopExecutable('[Desktop Entry]\nType=Application\nExec=sh -c "echo cursor"\n'),
  );
  assert.throws(() => desktopExecutable('[Desktop Entry]\nType=Application\nName=Cursor\n'));
});

test('ASAR and PE readers reject forged offsets and metadata links', async () => {
  const files = new FixtureFiles();
  const badAsar = Buffer.alloc(16);
  badAsar.writeUInt32LE(4);
  badAsar.writeUInt32LE(0xffffffff, 4);
  files.add('/app/resources/app.asar', badAsar);
  await assert.rejects(asarManifest(files, '/app'), /limit-exceeded/);
  const badPe = Buffer.alloc(64);
  badPe.write('MZ');
  badPe.writeUInt32LE(0xffffffff, 60);
  files.add('/app/app.exe', badPe);
  await assert.rejects(peIdentity(files, '/app/app.exe'), /invalid-metadata/);
});

test('official Cursor DEB metadata confirms the Linux identity and desktop locator', async () => {
  const fixture = JSON.parse(
    await readFile(
      new URL('./fixtures/application-discovery/cursor-linux.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(matchesDesktopMetadata('cursor', fixture.metadata.product), true);
  assert.equal(desktopExecutable(fixture.metadata.desktop), '/usr/share/cursor/cursor');
  assert.match(fixture.artifactSha256, /^[a-f0-9]{64}$/);
});

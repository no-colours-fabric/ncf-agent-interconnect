import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { readFile, mkdtemp, mkdir, writeFile, link, rm } from 'node:fs/promises';
import os from 'node:os';
import { ApplicationDiscovery, desktopExecutable } from '../desktop/core/application-discovery.js';
import {
  DiscoveryError,
  type DiscoveryFiles,
  asarManifest,
  peIdentity,
  jsonObject,
  NativeDiscoveryFiles,
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
  async installationEntries(directory: string) {
    return [...this.entries.keys()].filter(
      (filename) => this.paths.dirname(filename) === directory,
    );
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

test('PE identity trims padded vendor resource strings observed in the official Windows installer', async () => {
  const files = new FixtureFiles();
  const resource = Buffer.from('ProductName\0Cursor    \0CompanyName\0Anysphere    \0', 'utf16le');
  const executable = Buffer.alloc(256 + resource.length);
  executable.write('MZ');
  executable.writeUInt32LE(64, 60);
  executable.write('PE\0\0', 64);
  executable.writeUInt16LE(1, 70);
  executable.write('.rsrc', 88);
  executable.writeUInt32LE(resource.length, 104);
  executable.writeUInt32LE(256, 108);
  resource.copy(executable, 256);
  files.add('/fixture/Cursor.exe', executable);
  assert.deepEqual(await peIdentity(files, '/fixture/Cursor.exe'), {
    product: 'Cursor',
    publisher: 'Anysphere',
  });
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

test('Windows Cursor metadata is independently sourced from the standard Windows installation', async () => {
  const fixture = JSON.parse(
    await readFile(
      new URL('./fixtures/application-discovery/cursor-windows.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(matchesDesktopMetadata('cursor', fixture.metadata), true);
  assert.equal(fixture.metadata.win32AppUserModelId, 'Anysphere.Cursor');
  assert.equal(fixture.version, '3.29.9');
});

test('metadata nesting and truncated PATH coverage fail to unknown instead of false absence', async () => {
  assert.throws(() => jsonObject('['.repeat(65) + '0' + ']'.repeat(65)), /limit-exceeded/);
  assert.throws(() => jsonObject('{invalid'), /invalid-metadata/);
  const scan = await new ApplicationDiscovery({
    platform: 'linux',
    home: '/fixture',
    env: { PATH: Array.from({ length: 65 }, (_, i) => '/bin' + i).join(':') },
    files: new FixtureFiles(),
  }).scan();
  assert.ok(scan.applications.every((app) => app.status === 'unknown'));
});

test('Windows Claude Desktop version directories are found without claiming backend readiness', async () => {
  const f = fixtures('win32');
  const old = f.roots.get('claude')!;
  for (const filename of f.files.entries.keys())
    if (filename.startsWith(old)) f.files.entries.delete(filename);
  const root = f.paths.join(f.env.LOCALAPPDATA!, 'AnthropicClaude/app-1.1.7');
  const runtime = f.paths.join(root, 'claude.exe');
  f.files.add(runtime);
  f.files.binaries.add(runtime);
  f.files.add(f.paths.join(root, 'resources/app/package.json'), { name: 'claude-desktop' });
  const result = (await f.detector().scan()).applications.find((app) => app.client === 'claude')!;
  assert.equal(result.status, 'detected');
  assert.deepEqual(
    result.instances.map((entry) => entry.form),
    ['desktop'],
  );
  assert.equal('ready' in result, false);
});

test('native Claude launcher hardlinks require the same file identity in the versioned install root', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-discovery-links-'));
  try {
    const versions = path.join(directory, 'versions');
    await mkdir(versions);
    const target = path.join(versions, '2.1.319');
    await writeFile(target, 'native binary fixture');
    const launcher = path.join(directory, 'claude.exe');
    await link(target, launcher);
    const files = new NativeDiscoveryFiles();
    assert.equal(await files.linkedClaudeRuntime(launcher, versions), true);
    const unrelated = path.join(directory, 'unrelated.exe');
    await writeFile(unrelated, 'native binary fixture');
    assert.equal(await files.linkedClaudeRuntime(unrelated, versions), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

for (const platform of ['win32', 'linux', 'darwin'] as const) {
  test(`R7-A ${platform}: local links and parent junctions reject nonlocal hops before filesystem access`, async () => {
    const paths = platform === 'win32' ? path.win32 : path.posix;
    const root = platform === 'win32' ? 'C:\\Apps' : '/fixture';
    const alias = paths.join(root, 'Alias');
    const runtime = paths.join(alias, 'Cursor.exe');
    const destinations = [
      String.raw`\\server\share\Cursor.exe`,
      '//server/share/Cursor.exe',
      String.raw`\\?\UNC\server\share\Cursor.exe`,
      String.raw`\\.\PhysicalDrive0`,
      String.raw`\??\C:\Cursor.exe`,
    ];
    if (platform === 'win32') destinations.push(String.raw`C:\NUL`, String.raw`C:Cursor.exe`);
    for (const link of [alias, runtime]) {
      for (const destination of destinations) {
        const calls: { operation: string; filename: string }[] = [];
        const files = new NativeDiscoveryFiles(platform, {
          async lstat(filename: string) {
            calls.push({ operation: 'lstat', filename });
            return { isSymbolicLink: () => filename === link };
          },
          async readlink(filename: string) {
            calls.push({ operation: 'readlink', filename });
            return destination;
          },
          async realpath(filename: string) {
            calls.push({ operation: 'realpath', filename });
            return filename;
          },
        } as unknown as NonNullable<ConstructorParameters<typeof NativeDiscoveryFiles>[1]>);
        await assert.rejects(files.canonical(runtime), /source-unavailable/);
        assert.deepEqual(calls.at(-1), { operation: 'readlink', filename: link });
        assert.ok(
          calls.every(
            (call) => call.filename === link || link.startsWith(call.filename + paths.sep),
          ),
        );
        assert.equal(
          calls.some((call) => call.operation === 'realpath'),
          false,
        );
      }
    }
    for (const destination of destinations) {
      const calls: string[] = [];
      const files = new NativeDiscoveryFiles(platform, {
        async lstat(filename: string) {
          calls.push(filename);
          return { isSymbolicLink: () => false };
        },
        async realpath(filename: string) {
          calls.push(filename);
          return destination;
        },
      } as unknown as NonNullable<ConstructorParameters<typeof NativeDiscoveryFiles>[1]>);
      await assert.rejects(files.canonical(runtime), /source-unavailable/);
      assert.equal(calls.at(-1), runtime);
      assert.equal(calls.includes(destination), false);
    }
  });
}

for (const platform of ['linux', 'win32'] as const) {
  test(`R7-B ${platform}: desktop metadata cannot identify an out-of-root runtime; whole-install aliases remain valid`, async () => {
    const f = fixtures(platform);
    const root = f.roots.get('cursor')!;
    const executable =
      discoveryCatalog.cursor[platform === 'win32' ? 'windows' : 'linux'][0].executable;
    const runtime = f.paths.join(root, executable);
    const external = platform === 'win32' ? 'D:\\Unrelated\\node.exe' : '/usr/bin/node';
    f.files.add(external);
    f.files.binaries.add(external);
    f.files.links.set(runtime, external);
    const checked: string[] = [];
    const originalExecutable = f.files.executable.bind(f.files);
    f.files.executable = async (filename) => {
      checked.push(filename);
      return originalExecutable(filename);
    };
    const rejected = (await f.detector().scan()).applications.find(
      (app) => app.client === 'cursor',
    )!;
    assert.equal(rejected.status, 'unknown');
    assert.equal(rejected.instances.length, 0);
    assert.ok(rejected.coverage.some((source) => source.reason === 'unverified-identity'));
    assert.equal(checked.includes(external), false);
    assert.equal(f.files.reads.includes(external), false);

    const physical = platform === 'win32' ? 'D:\\Приложения\\Cursor' : '/opt/Приложения/Cursor';
    for (const [filename, contents] of [...f.files.entries]) {
      if (!filename.startsWith(root + f.paths.sep)) continue;
      const relocated = f.paths.join(physical, f.paths.relative(root, filename));
      f.files.add(relocated, contents);
      if (f.files.binaries.has(filename)) f.files.binaries.add(relocated);
      f.files.entries.delete(filename);
    }
    f.files.links.delete(runtime);
    f.files.links.set(root, physical);
    const accepted = (await f.detector().scan()).applications.find(
      (app) => app.client === 'cursor',
    )!;
    assert.equal(accepted.status, 'detected');
    assert.deepEqual(
      accepted.instances.map((instance) => instance.path),
      [physical],
    );
    assert.ok(checked.includes(f.paths.join(physical, executable)));
  });
}

import { constants } from 'node:fs';
import { access, lstat, open, readlink, realpath } from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { DiscoveryReason } from '../shared/application-discovery.js';

export class DiscoveryError extends Error {
  constructor(readonly reason: DiscoveryReason) {
    super(reason);
  }
}

export const errorReason = (error: unknown): DiscoveryReason => {
  if (error instanceof DiscoveryError) return error.reason;
  const code = (error as NodeJS.ErrnoException).code;
  if (code === 'EACCES' || code === 'EPERM') return 'access-denied';
  if (code === 'ELOOP') return 'limit-exceeded';
  if (code === 'ENOENT' || code === 'ENOTDIR') return 'missing-runtime';
  return 'source-unavailable';
};

export interface DiscoveryFiles {
  canonical(filename: string): Promise<string | undefined>;
  bytes(filename: string, size: number, offset?: number): Promise<Buffer>;
  executable(filename: string): Promise<boolean>;
  plist(filename: string): Promise<Record<string, unknown>>;
  packageIdentity(
    name: string,
    runtime?: string,
  ): Promise<{ name: string; publisher: string } | undefined>;
  windowsCodex?(): Promise<{ root: string; executable: string }[]>;
}

const runFile = promisify(execFile);

/** Bounded PE resource strings, corroborated by both product and publisher. */
export async function peIdentity(
  files: DiscoveryFiles,
  filename: string,
): Promise<{ product: string; publisher: string } | undefined> {
  const head = await files.bytes(filename, 64);
  if (head.length !== 64 || head.toString('ascii', 0, 2) !== 'MZ') return undefined;
  const offset = head.readUInt32LE(60);
  if (offset > 4 * 1024 * 1024) throw new DiscoveryError('invalid-metadata');
  const coff = await files.bytes(filename, 24, offset);
  if (coff.length !== 24 || coff.toString('ascii', 0, 4) !== 'PE\0\0')
    throw new DiscoveryError('invalid-metadata');
  const count = coff.readUInt16LE(6),
    optionalSize = coff.readUInt16LE(20);
  if (count > 96 || optionalSize > 4096) throw new DiscoveryError('limit-exceeded');
  const sections = await files.bytes(filename, count * 40, offset + 24 + optionalSize);
  if (sections.length !== count * 40) throw new DiscoveryError('invalid-metadata');
  for (let i = 0; i < count; i++) {
    const item = sections.subarray(i * 40, (i + 1) * 40);
    if (item.toString('ascii', 0, 8).replace(/\0/g, '') !== '.rsrc') continue;
    const size = item.readUInt32LE(16),
      start = item.readUInt32LE(20);
    if (size > 4 * 1024 * 1024) throw new DiscoveryError('limit-exceeded');
    const data = await files.bytes(filename, size, start);
    if (data.length !== size) throw new DiscoveryError('invalid-metadata');
    const text = data.toString('utf16le');
    const field = (key: string) => text.match(new RegExp(key + '\\0+([^\\0]{1,160})'))?.[1]?.trim();
    const product = field('ProductName'),
      publisher = field('CompanyName');
    if (product && publisher) return { product, publisher };
  }
  return undefined;
}

/** Only known OS metadata readers run here; discovered applications never execute. */
export class NativeDiscoveryFiles implements DiscoveryFiles {
  constructor(private readonly platform: NodeJS.Platform = process.platform) {}
  async windowsCodex(): Promise<{ root: string; executable: string }[]> {
    const system = process.env.SystemRoot ?? 'C:\\Windows';
    const command = path.win32.join(system, 'System32/WindowsPowerShell/v1.0/powershell.exe');
    const script =
      "[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; @(Get-AppxPackage -Name 'OpenAI.Codex' | Select-Object Name,Publisher,InstallLocation) | ConvertTo-Json -Compress";
    const { stdout } = await runFile(
      command,
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { shell: false, timeout: 4000, maxBuffer: 65536, windowsHide: true },
    );
    const raw: unknown = stdout.trim() ? JSON.parse(stdout) : [];
    const packages = Array.isArray(raw) ? raw : [raw];
    if (packages.length > 16) throw new DiscoveryError('limit-exceeded');
    const found: { root: string; executable: string }[] = [];
    for (const item of packages) {
      if (
        !item ||
        item.Name !== 'OpenAI.Codex' ||
        typeof item.Publisher !== 'string' ||
        !/OpenAI/.test(item.Publisher) ||
        typeof item.InstallLocation !== 'string' ||
        !path.win32.isAbsolute(item.InstallLocation)
      )
        throw new DiscoveryError('unverified-identity');
      const root = await this.canonical(item.InstallLocation);
      if (!root) throw new DiscoveryError('missing-runtime');
      const manifestFile = await this.canonical(path.win32.join(root, 'AppxManifest.xml'));
      if (!manifestFile || !manifestFile.startsWith(root + path.win32.sep))
        throw new DiscoveryError('invalid-metadata');
      const xml = await this.bytes(manifestFile, 1024 * 1024 + 1);
      if (xml.length > 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml.toString()))
        throw new DiscoveryError('invalid-metadata');
      const executable = xml.toString().match(/<Application\b[^>]*\bExecutable="([^"]+)"/)?.[1];
      if (!executable || /[&<>]/.test(executable)) throw new DiscoveryError('invalid-metadata');
      const runtime = await this.canonical(path.win32.resolve(root, executable));
      if (
        !runtime ||
        !runtime.startsWith(root + path.win32.sep) ||
        !(await this.executable(runtime))
      )
        throw new DiscoveryError('missing-runtime');
      found.push({ root, executable: runtime });
    }
    return found;
  }
  async canonical(filename: string): Promise<string | undefined> {
    if (!path.isAbsolute(filename) || filename.startsWith('\\\\'))
      throw new DiscoveryError('source-unavailable');
    let linked = false;
    try {
      let target = filename;
      for (let depth = 0; depth < 16; depth++) {
        const info = await lstat(target);
        if (!info.isSymbolicLink()) return await realpath(target);
        linked = true;
        target = path.resolve(path.dirname(target), await readlink(target));
      }
      throw new DiscoveryError('limit-exceeded');
    } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? ''))
        if (!linked) return undefined;
        else throw new DiscoveryError('missing-runtime');
      throw error;
    }
  }

  async bytes(filename: string, size: number, offset = 0): Promise<Buffer> {
    if (
      !Number.isSafeInteger(size) ||
      size < 0 ||
      size > 16 * 1024 * 1024 ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    )
      throw new DiscoveryError('limit-exceeded');
    const file = await open(
      filename,
      constants.O_RDONLY | (constants.O_NONBLOCK ?? 0) | (constants.O_NOFOLLOW ?? 0),
    );
    try {
      const stat = await file.stat();
      if (!stat.isFile()) throw new DiscoveryError('invalid-metadata');
      const data = Buffer.alloc(Math.min(size, Math.max(0, stat.size - offset)));
      const { bytesRead } = await file.read(data, 0, data.length, offset);
      return data.subarray(0, bytesRead);
    } finally {
      await file.close();
    }
  }

  async executable(filename: string): Promise<boolean> {
    if (!(await lstat(filename)).isFile()) return false;
    await access(filename, this.platform === 'win32' ? constants.F_OK : constants.X_OK);
    const head = await this.bytes(filename, 64);
    if (this.platform === 'win32') {
      if (head.length < 64 || head.toString('ascii', 0, 2) !== 'MZ') return false;
      const offset = head.readUInt32LE(60);
      if (offset > 4 * 1024 * 1024) throw new DiscoveryError('invalid-metadata');
      return (await this.bytes(filename, 4, offset)).equals(Buffer.from('PE\0\0'));
    }
    if (this.platform === 'linux') return head.subarray(0, 4).equals(Buffer.from('\x7fELF'));
    return (
      head.length >= 4 &&
      [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0xbebafeca].includes(
        head.readUInt32BE(0),
      )
    );
  }

  async plist(filename: string): Promise<Record<string, unknown>> {
    const data = await this.bytes(filename, 1024 * 1024 + 1);
    if (data.length > 1024 * 1024) throw new DiscoveryError('limit-exceeded');
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn('/usr/bin/plutil', ['-convert', 'json', '-o', '-', '--', '-'], {
        shell: false,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      const chunks: Buffer[] = [];
      let length = 0;
      const timer = setTimeout(() => {
        child.kill();
        reject(new DiscoveryError('source-unavailable'));
      }, 2000);
      child.on('error', reject);
      child.stdin.on('error', reject);
      child.stdout.on('data', (chunk: Buffer) => {
        length += chunk.length;
        if (length > 1024 * 1024) {
          child.kill();
          reject(new DiscoveryError('limit-exceeded'));
        } else chunks.push(chunk);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(Buffer.concat(chunks).toString('utf8'));
        else reject(new DiscoveryError('invalid-metadata'));
      });
      child.stdin.end(data);
    });
    return jsonObject(stdout);
  }

  async packageIdentity(
    name: string,
    runtime?: string,
  ): Promise<{ name: string; publisher: string } | undefined> {
    // Fixed package IDs and argv: no shell, package scripts, installation, or client execution.
    if (!['opencode', 'aionui', 'chatgpt', 'codex', 'claude-code'].includes(name))
      throw new DiscoveryError('invalid-metadata');
    for (const [command, args] of [
      ['/usr/bin/dpkg-query', ['-W', '-f=${Status}\n${Package}\n${Maintainer}', name]],
      ['/usr/bin/rpm', ['-q', '--qf', 'install ok installed\n%{NAME}\n%{VENDOR}', name]],
    ] as const) {
      try {
        const { stdout } = await runFile(command, [...args], {
          shell: false,
          timeout: 1500,
          maxBuffer: 8192,
        });
        const [status, installed, publisher] = stdout.trim().split('\n');
        if (status === 'install ok installed' && installed === name && publisher) {
          if (!runtime || !path.posix.isAbsolute(runtime) || /[\r\n\0*?\[\]]/.test(runtime))
            throw new DiscoveryError('unverified-identity');
          const ownershipArgs =
            command === '/usr/bin/dpkg-query'
              ? ['-S', runtime]
              : ['-q', '--queryformat', '%{NAME}', '-f', runtime];
          const ownership = await runFile(command, ownershipArgs, {
            shell: false,
            timeout: 1500,
            maxBuffer: 8192,
          });
          const owns =
            command === '/usr/bin/dpkg-query'
              ? ownership.stdout
                  .trim()
                  .split('\n')
                  .some(
                    (line) =>
                      line === name + ': ' + runtime ||
                      (line.startsWith(name + ':') && line.endsWith(': ' + runtime)),
                  )
              : ownership.stdout.trim() === name;
          if (owns) return { name, publisher };
        }
      } catch (error) {
        if (errorReason(error) === 'access-denied') throw error;
      }
    }
    return undefined;
  }
}

export function jsonObject(text: string): Record<string, unknown> {
  let depth = 0,
    quoted = false,
    escaped = false;
  for (const char of text) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') {
      if (++depth > 64) throw new DiscoveryError('limit-exceeded');
    } else if (char === '}' || char === ']') depth--;
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new DiscoveryError('invalid-metadata');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new DiscoveryError('invalid-metadata');
  return value as Record<string, unknown>;
}

/** Reads only a named package/product manifest, never application code or profiles. */
export async function manifest(
  files: DiscoveryFiles,
  root: string,
  relative: string,
): Promise<Record<string, unknown> | undefined> {
  const paths = /^[A-Za-z]:[\\/]/.test(root) ? path.win32 : path.posix;
  const filename = paths.join(root, relative);
  const canonical = await files.canonical(filename);
  if (!canonical) return undefined;
  if (!canonical.startsWith(root + paths.sep)) throw new DiscoveryError('invalid-metadata');
  const data = await files.bytes(canonical, 1024 * 1024 + 1);
  if (data.length > 1024 * 1024) throw new DiscoveryError('limit-exceeded');
  return jsonObject(data.toString('utf8'));
}

export async function asarManifest(
  files: DiscoveryFiles,
  root: string,
): Promise<Record<string, unknown> | undefined> {
  const paths = /^[A-Za-z]:[\\/]/.test(root) ? path.win32 : path.posix;
  const filename = await files.canonical(paths.join(root, 'resources', 'app.asar'));
  if (!filename) return undefined;
  if (!filename.startsWith(root + paths.sep)) throw new DiscoveryError('invalid-metadata');
  const prefix = await files.bytes(filename, 16);
  if (prefix.length !== 16 || prefix.readUInt32LE(0) !== 4)
    throw new DiscoveryError('invalid-metadata');
  const headerSize = prefix.readUInt32LE(4),
    jsonSize = prefix.readUInt32LE(12);
  if (headerSize < 8 || headerSize > 16 * 1024 * 1024 || jsonSize > headerSize - 8)
    throw new DiscoveryError('limit-exceeded');
  const header = jsonObject((await files.bytes(filename, jsonSize, 16)).toString('utf8'));
  const entry = (header.files as Record<string, unknown> | undefined)?.['package.json'] as
    { offset?: unknown; size?: unknown; link?: unknown; unpacked?: unknown } | undefined;
  if (
    !entry ||
    entry.link ||
    entry.unpacked ||
    typeof entry.offset !== 'string' ||
    !/^\d+$/.test(entry.offset) ||
    typeof entry.size !== 'number' ||
    !Number.isSafeInteger(entry.size) ||
    entry.size < 1 ||
    entry.size > 1024 * 1024
  )
    throw new DiscoveryError('invalid-metadata');
  const offset = 8 + headerSize + Number(entry.offset);
  if (!Number.isSafeInteger(offset)) throw new DiscoveryError('invalid-metadata');
  return jsonObject((await files.bytes(filename, entry.size, offset)).toString('utf8'));
}

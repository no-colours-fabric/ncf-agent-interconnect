import { createReadStream, createWriteStream, realpath as callbackRealpath } from 'node:fs';
import { mkdir, stat, rename, unlink, open, copyFile, link } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import type { Attachment } from '../shared/contracts.js';

const realpath = promisify(callbackRealpath.native);
const code = (error: unknown) => (error as NodeJS.ErrnoException).code;
const maxBytes = 100 * 1024 * 1024;
export class FileStore {
  readonly directory: string;
  constructor(
    readonly dataDir: string,
    public exportRoots: string[],
  ) {
    this.directory = path.join(dataDir, 'blobs');
  }
  async init(): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
  }
  blob(id: string): string {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid attachment ID');
    return path.join(this.directory, id);
  }
  async hash(filename: string): Promise<string> {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(filename)) hash.update(chunk);
    return hash.digest('hex');
  }
  async exists(file: Attachment): Promise<boolean> {
    try {
      return (
        (await stat(this.blob(file.id))).size === file.size &&
        (await this.hash(this.blob(file.id))) === file.id
      );
    } catch (error) {
      if (code(error) === 'ENOENT') return false;
      throw error;
    }
  }
  async snapshot(filename: string): Promise<Attachment> {
    const canonical = await realpath(filename),
      roots = await Promise.all(
        this.exportRoots.map((p) =>
          realpath(p).catch((e) => {
            if (code(e) === 'ENOENT') return null;
            throw e;
          }),
        ),
      );
    if (
      !roots.some((root) => {
        if (!root) return false;
        const relative = path.relative(root, canonical);
        return (
          relative !== '' &&
          relative !== '..' &&
          !relative.startsWith('..' + path.sep) &&
          !path.isAbsolute(relative)
        );
      })
    )
      throw new Error('The file is outside the permitted export folders');
    const info = await stat(canonical);
    if (!info.isFile() || info.size > maxBytes)
      throw new Error('Only regular files up to 100 MiB are allowed');
    const name = path.basename(canonical);
    if (/[\x00-\x1f]/.test(name)) throw new Error('The filename contains control characters');
    const temp = path.join(this.directory, randomUUID() + '.tmp'),
      hash = createHash('sha256');
    let size = 0;
    try {
      const counter = new Transform({
        transform(chunk: Buffer, _encoding, done) {
          size += chunk.length;
          if (size > maxBytes) return done(new Error('The file exceeds 100 MiB'));
          hash.update(chunk);
          done(null, chunk);
        },
      });
      await pipeline(
        createReadStream(canonical),
        counter,
        createWriteStream(temp, { flags: 'wx', mode: 0o600 }),
      );
      const file = { id: hash.digest('hex'), name, size };
      if (await this.exists(file)) await unlink(temp);
      else await rename(temp, this.blob(file.id));
      return file;
    } catch (e) {
      await unlink(temp).catch(() => {});
      throw e;
    }
  }
  async chunk(file: Attachment, offset: number, length: number): Promise<string> {
    if (offset < 0 || length < 1 || length > 192 * 1024 || offset + length > file.size)
      throw new Error('Invalid attachment range');
    const handle = await open(this.blob(file.id), 'r');
    try {
      const bytes = Buffer.alloc(length);
      const result = await handle.read(bytes, 0, length, offset);
      if (result.bytesRead !== length) throw new Error('The attachment is damaged');
      return bytes.toString('base64');
    } finally {
      await handle.close();
    }
  }
  async receive(
    file: Attachment,
    getChunk: (offset: number, length: number) => Promise<string>,
  ): Promise<void> {
    if (file.size > maxBytes) throw new Error('The file exceeds 100 MiB');
    if (await this.exists(file)) return;
    const partial = this.blob(file.id) + '.part',
      handle = await open(partial, 'a+', 0o600);
    try {
      let offset = (await handle.stat()).size;
      if (offset > file.size) {
        await handle.truncate(0);
        offset = 0;
      }
      while (offset < file.size) {
        const length = Math.min(192 * 1024, file.size - offset),
          data = Buffer.from(await getChunk(offset, length), 'base64');
        if (data.length !== length) throw new Error('Invalid attachment chunk size');
        let written = 0;
        while (written < data.length)
          written += (await handle.write(data, written, data.length - written)).bytesWritten;
        offset += data.length;
      }
      await handle.sync();
    } finally {
      await handle.close();
    }
    if ((await this.hash(partial)) !== file.id) {
      await unlink(partial);
      throw new Error('Attachment SHA-256 mismatch');
    }
    await rename(partial, this.blob(file.id));
  }
  async materialize(messageId: string, file: Attachment): Promise<string> {
    if (!/^[0-9a-f-]{36}$/i.test(messageId) || !(await this.exists(file)))
      throw new Error('The verified attachment is unavailable');
    let safe = file.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '_');
    if (!safe || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(safe)) safe = '_' + safe;
    if (safe.length > 120) safe = safe.slice(0, 95) + path.extname(safe).slice(0, 20);
    const directory = path.join(this.dataDir, 'Received', messageId);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const original = path.parse(file.id.slice(0, 16) + '-' + safe);
    for (let attempt = 0; attempt < 32; attempt++) {
      const target = path.join(
        directory,
        original.name + (attempt ? '-original-' + attempt : '') + original.ext,
      );
      try {
        if ((await stat(target)).size === file.size && (await this.hash(target)) === file.id)
          return target;
        continue;
      } catch (e) {
        if (code(e) !== 'ENOENT') throw e;
      }
      const temp = target + '.' + randomUUID() + '.tmp';
      try {
        await copyFile(this.blob(file.id), temp);
        if ((await this.hash(temp)) !== file.id) throw new Error('The attachment copy is damaged');
        try {
          await link(temp, target);
        } catch (e) {
          if (code(e) !== 'EEXIST') throw e;
          if ((await stat(target)).size !== file.size || (await this.hash(target)) !== file.id)
            continue;
        }
        return target;
      } finally {
        await unlink(temp).catch(() => {});
      }
    }
    throw new Error('Too many modified attachment copies');
  }
}

import {
  createReadStream,
  createWriteStream,
  realpath as callbackRealpath,
  type BigIntStats,
} from 'node:fs';
import { mkdir, stat, rename, unlink, open, link, readdir, lstat, rmdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import type { Attachment } from '../shared/contracts.js';
import {
  defaultAttachmentLimitMiB,
  exceedsAttachmentLimit,
  localAttachmentLimitError,
  type AttachmentLimit,
} from '../shared/attachment-limit.js';

const realpath = promisify(callbackRealpath.native);
const code = (error: unknown) => (error as NodeJS.ErrnoException).code;
export class FileStore {
  readonly directory: string;
  private readers = 0;
  private writing = false;
  private waiting: { exclusive: boolean; ready: (release: () => void) => void }[] = [];
  private acquire(exclusive: boolean): Promise<() => void> {
    return new Promise((ready) => {
      // Active readers may depend on peer chunk reads: do not queue those behind a waiting cleanup.
      if (!exclusive && !this.writing && this.readers) {
        this.readers++;
        ready(() => {
          this.readers--;
          this.releaseWaiters();
        });
      } else {
        this.waiting.push({ exclusive, ready });
        this.releaseWaiters();
      }
    });
  }
  private releaseWaiters(): void {
    while (!this.writing && this.waiting.length) {
      const next = this.waiting[0];
      if (next.exclusive && this.readers) return;
      this.waiting.shift();
      if (next.exclusive) this.writing = true;
      else this.readers++;
      next.ready(() => {
        if (next.exclusive) this.writing = false;
        else this.readers--;
        this.releaseWaiters();
      });
    }
  }
  async withLease<T>(work: () => Promise<T>): Promise<T> {
    const release = await this.acquire(false);
    try {
      return await work();
    } finally {
      release();
    }
  }
  async exclusive<T>(work: () => Promise<T>): Promise<T> {
    const release = await this.acquire(true);
    try {
      return await work();
    } finally {
      release();
    }
  }
  async cleanup(
    task: { messageId: string; files: Pick<Attachment, 'id' | 'size'>[] },
    referenced: (id: string) => boolean,
    keepCopy: (id: string) => boolean,
  ): Promise<void> {
    if (!/^[0-9a-f-]{36}$/i.test(task.messageId)) throw new Error('Invalid cleanup message ID');
    if (task.files.some(({ id }) => !keepCopy(id))) {
      const root = path.join(this.dataDir, 'Received'),
        directory = path.join(root, task.messageId);
      try {
        const rootInfo = await lstat(root),
          info = await lstat(directory);
        if (rootInfo.isDirectory() && info.isDirectory()) {
          for (const entry of await readdir(directory, { withFileTypes: true })) {
            if (!entry.isFile()) continue;
            const candidate = path.join(directory, entry.name),
              info = await lstat(candidate);
            if (!info.isFile()) continue;
            const file = task.files.find(
              (file) =>
                !keepCopy(file.id) &&
                entry.name.startsWith(file.id.slice(0, 16) + '-') &&
                info.size === file.size,
            );
            if (file && (await this.hash(candidate)) === file.id && !keepCopy(file.id))
              await unlink(candidate);
          }
          await rmdir(directory).catch((error) => {
            if (!['ENOENT', 'ENOTEMPTY'].includes(code(error) ?? '')) throw error;
          });
        }
      } catch (error) {
        if (code(error) !== 'ENOENT') throw error;
      }
    }
    if (!(await lstat(this.directory)).isDirectory())
      throw new Error('The managed blob directory is unavailable');
    for (const file of task.files) {
      if (referenced(file.id)) continue;
      for (const candidate of [this.blob(file.id), this.blob(file.id) + '.part']) {
        await unlink(candidate).catch((error) => {
          if (code(error) !== 'ENOENT') throw error;
        });
      }
    }
  }
  constructor(
    readonly dataDir: string,
    public exportRoots: string[],
    private readonly attachmentLimit: () => AttachmentLimit = () => defaultAttachmentLimitMiB,
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
  async storedSize(file: Pick<Attachment, 'id' | 'size'>): Promise<number> {
    const info = await lstat(this.blob(file.id)).catch((error) => {
      if (code(error) === 'ENOENT') return null;
      throw error;
    });
    return info?.isFile() && info.size === file.size ? info.size : 0;
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
  async snapshot(filename: string, stagedPath?: string): Promise<Attachment> {
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
      (!stagedPath || path.relative(canonical, stagedPath) !== '') &&
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
    if (!info.isFile()) throw new Error('Only regular files are allowed');
    const limit = this.attachmentLimit();
    if (exceedsAttachmentLimit(info.size, limit)) throw new Error(localAttachmentLimitError);
    const name = path.basename(canonical);
    if (/[\x00-\x1f]/.test(name)) throw new Error('The filename contains control characters');
    const temp = path.join(this.directory, randomUUID() + '.tmp'),
      hash = createHash('sha256');
    let size = 0;
    try {
      const counter = new Transform({
        transform(chunk: Buffer, _encoding, done) {
          size += chunk.length;
          if (exceedsAttachmentLimit(size, limit))
            return done(new Error(localAttachmentLimitError));
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
    if (!Number.isSafeInteger(file.size) || file.size < 0)
      throw new Error('Invalid attachment size');
    if (await this.exists(file)) return;
    const partial = this.blob(file.id) + '.part';
    const handle = await open(partial, 'a+', 0o600);
    const hash = createHash('sha256');
    let valid = false;
    try {
      let offset = (await handle.stat()).size;
      if (offset > file.size) {
        await handle.truncate(0);
        offset = 0;
      }
      if (offset) {
        const prefix = handle.createReadStream({ start: 0, end: offset - 1, autoClose: false });
        for await (const data of prefix) hash.update(data);
      }
      while (offset < file.size) {
        const length = Math.min(192 * 1024, file.size - offset),
          data = Buffer.from(await getChunk(offset, length), 'base64');
        if (data.length !== length) throw new Error('Invalid attachment chunk size');
        let written = 0;
        while (written < data.length) {
          const { bytesWritten } = await handle.write(data, written, data.length - written);
          if (!bytesWritten) throw new Error('The attachment could not be written');
          written += bytesWritten;
        }
        hash.update(data);
        offset += data.length;
      }
      valid = (await handle.stat()).size === file.size && hash.digest('hex') === file.id;
      if (valid) await handle.sync();
    } finally {
      await handle.close();
    }
    if (!valid) {
      await unlink(partial);
      throw new Error('Attachment SHA-256 mismatch');
    }
    await rename(partial, this.blob(file.id));
  }

  async materialize(
    messageId: string,
    file: Attachment,
    onCreated?: (target: string, createdFile: BigIntStats) => Promise<void>,
  ): Promise<string> {
    if (!/^[0-9a-f-]{36}$/i.test(messageId))
      throw new Error('The verified attachment is unavailable');
    const blob = this.blob(file.id);
    const info = await stat(blob).catch((error) => {
      if (code(error) === 'ENOENT') return null;
      throw error;
    });
    if (!info?.isFile() || info.size !== file.size)
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
        if ((await stat(target)).size === file.size && (await this.hash(target)) === file.id) {
          if (!(await this.exists(file))) throw new Error('The verified attachment is unavailable');
          return target;
        }
        continue;
      } catch (e) {
        if (code(e) !== 'ENOENT') throw e;
      }
      const temp = target + '.' + randomUUID() + '.tmp';
      let created: BigIntStats | undefined;
      try {
        const hash = createHash('sha256');
        let size = 0;
        await pipeline(
          createReadStream(blob),
          new Transform({
            transform(data: Buffer, _encoding, done) {
              size += data.length;
              if (size > file.size)
                return done(new Error('The verified attachment is unavailable'));
              hash.update(data);
              done(null, data);
            },
          }),
          createWriteStream(temp, { flags: 'wx', mode: 0o600 }),
        );
        if (size !== file.size || hash.digest('hex') !== file.id)
          throw new Error('The verified attachment is unavailable');
        try {
          const witness = onCreated ? await lstat(temp, { bigint: true }) : undefined;
          await link(temp, target);
          created = witness;
        } catch (e) {
          if (code(e) !== 'EEXIST') throw e;
          if ((await stat(target)).size !== file.size || (await this.hash(target)) !== file.id)
            continue;
        }
      } finally {
        await unlink(temp).catch(() => {});
      }
      if (created) await onCreated?.(target, created);
      return target;
    }
    throw new Error('Too many modified attachment copies');
  }
}

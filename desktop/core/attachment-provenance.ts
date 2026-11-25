import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, realpath as callbackRealpath, type BigIntStats } from 'node:fs';
import { link, lstat, mkdir, open, rename, rmdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Attachment } from '../shared/contracts.js';

const realpath = promisify(callbackRealpath.native);
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';
const safeComponent = (value: string) =>
  value.length > 0 &&
  value.length <= 255 &&
  !/[<>:"/\\|?*\x00-\x1f]|[. ]$|^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value);

export interface ManagedAttachmentFile {
  directory: string;
  name: string;
  identity: string;
  revision: string;
}

type ManagedRoot = 'Temporary Attachments' | 'Received';

export class AttachmentProvenance {
  constructor(private readonly dataDir: string) {}

  private async managedFolder(root: ManagedRoot, directory: string): Promise<string> {
    if (!/^[0-9a-f-]{36}$/i.test(directory)) throw new Error('Invalid attachment directory');
    const parent = await realpath(this.dataDir);
    const base = path.join(parent, root);
    const target = path.join(base, directory);
    if (!(await lstat(base)).isDirectory() || !(await lstat(target)).isDirectory())
      throw new Error('The managed attachment directory is unavailable');
    if (path.relative(target, await realpath(target)))
      throw new Error('The managed attachment directory has changed');
    return target;
  }

  static witness(info: BigIntStats, directory: string, name: string): ManagedAttachmentFile {
    if (!info.isFile() || info.nlink !== 1n || info.ino === 0n || info.birthtimeNs <= 0n)
      throw new Error('The managed attachment cannot be identified');
    return {
      directory,
      name,
      identity: `${info.dev}:${info.ino}:${info.birthtimeNs}`,
      revision: `${info.size}:${info.mtimeNs}`,
    };
  }

  async isSourcePath(filename: string, directory: string, name: string): Promise<boolean> {
    const base = path.join(await realpath(this.dataDir), 'Temporary Attachments');
    return !path.relative(path.join(base, directory, name), path.resolve(filename));
  }

  async stage(name: string): Promise<{ localPath: string; witness: ManagedAttachmentFile }> {
    if (!safeComponent(name)) throw new Error('Choose a plain attachment filename');
    const base = path.join(await realpath(this.dataDir), 'Temporary Attachments');
    await mkdir(base, { mode: 0o700 }).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    });
    if (!(await lstat(base)).isDirectory())
      throw new Error('The managed attachment directory is unavailable');
    const directory = randomUUID();
    const target = path.join(base, directory);
    await mkdir(target, { mode: 0o700 });
    const localPath = path.join(target, name);
    const file = await open(localPath, 'wx', 0o600);
    try {
      return {
        localPath,
        witness: AttachmentProvenance.witness(await file.stat({ bigint: true }), directory, name),
      };
    } finally {
      await file.close();
    }
  }

  async inspect(
    root: ManagedRoot,
    directory: string,
    name: string,
  ): Promise<{ localPath: string; witness: ManagedAttachmentFile }> {
    if (!safeComponent(name)) throw new Error('Invalid managed attachment filename');
    const parent = await this.managedFolder(root, directory);
    const localPath = path.join(parent, name);
    return {
      localPath,
      witness: AttachmentProvenance.witness(
        await lstat(localPath, { bigint: true }),
        directory,
        name,
      ),
    };
  }

  async remove(
    root: ManagedRoot,
    expected: ManagedAttachmentFile,
    attachment: Pick<Attachment, 'id' | 'size'>,
    isCurrent: () => boolean = () => true,
  ): Promise<'removed' | 'missing' | 'preserved'> {
    const matches = (current: ManagedAttachmentFile) =>
      current.identity === expected.identity && current.revision === expected.revision;
    let current;
    try {
      current = await this.inspect(root, expected.directory, expected.name);
    } catch (error) {
      return missing(error) ? 'missing' : 'preserved';
    }
    if (!matches(current.witness) || !isCurrent()) return 'preserved';
    const parent = path.dirname(current.localPath);
    const quarantine = path.join(parent, '.cleanup-' + randomUUID());
    await mkdir(quarantine, { mode: 0o700 });
    const held = path.join(quarantine, 'file');
    try {
      // Verify the exact directory entry that was moved, rather than unlinking a path
      // another process could have replaced while the digest was being read.
      await rename(current.localPath, held);
      try {
        const valid = async () =>
          matches(
            AttachmentProvenance.witness(
              await lstat(held, { bigint: true }),
              expected.directory,
              expected.name,
            ),
          );
        if (await valid()) {
          const hash = createHash('sha256');
          let size = 0;
          for await (const chunk of createReadStream(held)) {
            size += chunk.length;
            hash.update(chunk);
          }
          if (
            size === attachment.size &&
            hash.digest('hex') === attachment.id &&
            (await valid()) &&
            isCurrent()
          ) {
            await unlink(held);
            return 'removed';
          }
        }
      } catch {
        // Preserve the quarantined entry on any proof failure.
      }
      // A newly occupied original path must not be overwritten. Keep both entries
      // on disk if another process inserted a replacement during the operation.
      await link(held, current.localPath)
        .then(() => unlink(held))
        .catch(() => {});
      return 'preserved';
    } finally {
      // Never recursively remove a quarantine directory that still contains a file.
      await rmdir(quarantine).catch(() => {});
    }
  }
}

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import type { BigIntStats } from 'node:fs';
import path from 'node:path';
import { atomicJson } from '../core/settings.js';

type ArchiveStat = (filename: string, options: { bigint: true }) => Promise<BigIntStats>;

/** Remember the installation only after its notice has been dismissed. */
export async function pendingInstallationRestartNotice(
  userData: string,
  archive: string,
  statArchive: ArchiveStat = stat,
): Promise<(() => Promise<void>) | null> {
  const info = await statArchive(archive, { bigint: true });
  if (!info.isFile()) return null;
  // The same build can be reinstalled. Use the physical archive identity as well as its path.
  const fingerprint = createHash('sha256')
    .update(
      [archive, info.dev, info.ino, info.size, info.birthtimeNs, info.mtimeNs]
        .map(String)
        .join('\0'),
    )
    .digest('hex');
  const marker = path.join(userData, 'installation-restart-notice.json');
  const stored = await readFile(marker, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (stored?.trim() === JSON.stringify(fingerprint)) return null;
  const remember = () => atomicJson(marker, fingerprint);
  if (stored !== null) return remember;

  // Older installed versions have node settings but no notice marker.
  const previousProfile = await stat(path.join(userData, 'settings.json')).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    },
  );
  if (previousProfile?.isFile()) return remember;
  await remember();
  return null;
}

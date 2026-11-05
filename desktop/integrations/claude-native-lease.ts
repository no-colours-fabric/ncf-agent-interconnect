import {
  constants,
  lstatSync,
  openSync,
  fstatSync,
  readFileSync,
  closeSync,
  type Stats,
} from 'node:fs';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const uuid = z.uuid().transform((value) => value.toLowerCase());
const leaseSchema = z
  .object({
    version: z.literal(1),
    sessionId: uuid,
    nonce: uuid,
    active: z.boolean(),
    conflicted: z.boolean().optional(),
  })
  .strict();

export type NativeLease = z.infer<typeof leaseSchema>;

function locations(nodeFile: string, sessionId: string) {
  const session = uuid.parse(sessionId);
  const directory = path.join(path.dirname(nodeFile), 'claude-native');
  const filename = path.join(directory, session + '.json');
  return { session, directory, filename, lock: filename + '.lock' };
}

const unavailable = () => new Error('The native Claude Code session lease is unavailable.');
const missing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === 'ENOENT';

function privateEntry(info: Stats, directory: boolean): boolean {
  return (
    !info.isSymbolicLink() &&
    (directory ? info.isDirectory() : info.isFile() && info.nlink === 1) &&
    (process.platform === 'win32' ||
      ((info.mode & 0o077) === 0 &&
        (!directory || (info.mode & 0o700) === 0o700) &&
        (!process.getuid || info.uid === process.getuid())))
  );
}

function readLease(nodeFile: string, sessionId: string, locked: boolean): NativeLease | null {
  const value = locations(nodeFile, sessionId);
  let descriptor: number | undefined;
  try {
    if (!privateEntry(lstatSync(value.directory), true)) throw unavailable();
    if (!locked) {
      try {
        lstatSync(value.lock);
        throw unavailable();
      } catch (error) {
        if (!missing(error)) throw error;
      }
    }
    const before = lstatSync(value.filename);
    if (!privateEntry(before, false) || before.size > 4096) throw unavailable();
    descriptor = openSync(value.filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const actual = fstatSync(descriptor);
    if (
      !privateEntry(actual, false) ||
      actual.size > 4096 ||
      actual.ino !== before.ino ||
      actual.dev !== before.dev
    )
      throw unavailable();
    const lease = leaseSchema.parse(JSON.parse(readFileSync(descriptor, 'utf8')));
    if (lease.sessionId !== value.session || (lease.conflicted && lease.active))
      throw unavailable();
    const after = lstatSync(value.filename);
    if (
      after.ino !== actual.ino ||
      after.dev !== actual.dev ||
      after.size !== actual.size ||
      after.mtimeMs !== actual.mtimeMs ||
      !privateEntry(after, false)
    )
      throw unavailable();
    if (!locked) {
      try {
        lstatSync(value.lock);
        throw unavailable();
      } catch (error) {
        if (!missing(error)) throw error;
      }
    }
    return lease;
  } catch (error) {
    if (missing(error)) return null;
    throw unavailable();
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

/** Read-only authorization check. An interrupted writer leaves the lease unavailable. */
export function readNativeLeaseSync(nodeFile: string, sessionId: string): NativeLease | null {
  return readLease(nodeFile, sessionId, false);
}

export async function readNativeLease(
  nodeFile: string,
  sessionId: string,
): Promise<NativeLease | null> {
  return readNativeLeaseSync(nodeFile, sessionId);
}

/** Persist native lifecycle evidence before attempting any HTTP notification. */
export async function updateNativeLease(
  nodeFile: string,
  sessionId: string,
  event: 'SessionStart' | 'SessionEnd',
): Promise<NativeLease> {
  const value = locations(nodeFile, sessionId);
  let acquired = false;
  let completed = false;
  let temporary: string | undefined;
  try {
    await mkdir(path.dirname(value.directory), { recursive: true, mode: 0o700 });
    await mkdir(value.directory, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error;
    });
    if (!privateEntry(lstatSync(value.directory), true)) throw unavailable();
    // Serialize independent hook processes. Never break a stale lock: it is a deny marker.
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        await mkdir(value.lock, { mode: 0o700 });
        acquired = true;
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }
    }
    if (!acquired) throw unavailable();
    const previous = readLease(nodeFile, sessionId, true);
    const conflicted = event === 'SessionStart' && !!(previous?.active || previous?.conflicted);
    const lease: NativeLease = {
      version: 1,
      sessionId: value.session,
      nonce: randomUUID(),
      active: event === 'SessionStart' && !conflicted,
      ...(conflicted ? { conflicted: true } : {}),
    };
    temporary = value.filename + '.' + randomUUID() + '.tmp';
    const file = await open(temporary, 'wx', 0o600);
    try {
      await file.writeFile(JSON.stringify(lease) + '\n', 'utf8');
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, value.filename);
    temporary = undefined;
    // Windows does not expose directory fsync through this interface.
    if (process.platform !== 'win32') {
      const directory = await open(value.directory, constants.O_RDONLY);
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    }
    completed = true;
    return lease;
  } catch {
    throw unavailable();
  } finally {
    if (temporary) await rm(temporary, { force: true }).catch(() => {});
    // Failed persistence must not expose the previous positive lease.
    if (acquired && completed) await rm(value.lock, { recursive: true }).catch(() => {});
  }
}

import { createHash } from 'node:crypto';
import {
  constants,
  closeSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  type Stats,
  writeSync,
} from 'node:fs';
import path from 'node:path';

/** Diagnostic-build metadata only. Never pass tokens, arguments, text or raw errors. */
export interface ClaudeTraceFields {
  session?: string | null;
  helper?: string;
  attempt?: string;
  request?: string | number;
  epoch?: string;
  phase?: string;
  outcome?: string;
  count?: number;
}

const identifiers = new Set(['session', 'helper', 'attempt', 'request', 'epoch']);
const codes = new Set(['phase', 'outcome']);
const codeValues = new Set([
  'validate',
  'commit',
  'cancel',
  'uncertain',
  'reserved',
  'issued',
  'committed',
  'cancelled',
  'sessionstart',
  'sessionend',
  'pretooluse',
  'stop',
  'resume',
  'accepted',
  'refused',
  'withheld',
  'initial',
  'initial-read-failed',
  'blocked',
  'missing',
  'not-pinned',
  'node-bootstrap',
  'unpinned-stream-ended',
  'consumed',
  'rejected',
  'started',
  'validated',
  'unknown',
  'active',
  'inactive',
  'absent',
  'unavailable',
]);
const limit = 4 * 1024 * 1024;

function existing(pathname: string): Stats | undefined {
  try {
    return lstatSync(pathname);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

function sameFile(left: Stats, right: Stats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function regularFile(file: Stats): boolean {
  return file.isFile() && !file.isSymbolicLink() && file.nlink === 1;
}

/** Best-effort bounded private JSONL shared by node, hook and helper processes. */
export function traceClaude(nodeFile: string, event: string, fields: ClaudeTraceFields = {}): void {
  let fd: number | undefined;
  try {
    if (!/^[a-z][a-z0-9_.-]{0,79}$/.test(event)) return;
    const directory = path.join(path.dirname(nodeFile), 'Diagnostics');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const dir = lstatSync(directory);
    if (!dir.isDirectory() || dir.isSymbolicLink()) return;
    if (
      process.platform !== 'win32' &&
      ((dir.mode & 0o077) !== 0 || (process.getuid && dir.uid !== process.getuid()))
    )
      return;
    const filename = path.join(directory, 'claude-code.jsonl'),
      before = existing(filename);
    if (before && !regularFile(before)) return;
    const noFollow = process.platform === 'win32' ? 0 : (constants.O_NOFOLLOW ?? 0),
      create = before ? 0 : constants.O_CREAT | constants.O_EXCL;
    fd = openSync(filename, constants.O_WRONLY | constants.O_APPEND | noFollow | create, 0o600);
    const file = fstatSync(fd);
    if (!regularFile(file) || (before && !sameFile(before, file)) || file.size >= limit) return;
    const current = existing(filename),
      currentDir = lstatSync(directory);
    if (
      !current ||
      !regularFile(current) ||
      !sameFile(file, current) ||
      !currentDir.isDirectory() ||
      currentDir.isSymbolicLink() ||
      !sameFile(dir, currentDir)
    )
      return;
    if (
      process.platform !== 'win32' &&
      ((file.mode & 0o077) !== 0 || (process.getuid && file.uid !== process.getuid()))
    )
      return;
    const safe: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (identifiers.has(key) && (typeof value === 'string' || typeof value === 'number'))
        safe[key] = createHash('sha256').update(String(value)).digest('hex').slice(0, 20);
      else if (codes.has(key) && typeof value === 'string' && codeValues.has(value))
        safe[key] = value;
      else if (key === 'count' && Number.isSafeInteger(value)) safe[key] = value as number;
    }
    writeSync(
      fd,
      JSON.stringify({ at: new Date().toISOString(), pid: process.pid, event, ...safe }) + '\n',
    );
  } catch {
    // Diagnostics must never affect admission, receipt or recovery.
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        /* Best-effort logging cannot affect delivery. */
      }
    }
  }
}

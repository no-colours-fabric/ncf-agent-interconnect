import type { DatabaseSync } from 'node:sqlite';
import type { Attachment, Message } from '../shared/contracts.js';
import type { ManagedAttachmentFile } from './attachment-provenance.js';

type Direction = Message['direction'];
interface SourceRow {
  owner: string;
  file: string;
  message_id: string | null;
}
type Source = {
  file: ManagedAttachmentFile;
  attachment: Pick<Attachment, 'id' | 'size'>;
};

/** Local provenance; no local filenames or file identities are accepted from a peer. */
export class AttachmentLedger {
  constructor(private readonly db: DatabaseSync) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS staged_attachment_sources (
        directory TEXT PRIMARY KEY, owner TEXT NOT NULL, file TEXT NOT NULL,
        message_id TEXT, direction TEXT NOT NULL DEFAULT 'out', file_id TEXT, size INTEGER,
        cleaned INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(message_id,direction) REFERENCES messages(id,direction) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS temporary_attachment_refs (
        message_id TEXT NOT NULL, direction TEXT NOT NULL, file_id TEXT NOT NULL,
        removed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(message_id,direction,file_id),
        FOREIGN KEY(message_id,direction) REFERENCES messages(id,direction) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS temporary_attachment_copies (
        message_id TEXT NOT NULL, file_id TEXT NOT NULL, name TEXT NOT NULL, file TEXT NOT NULL,
        direction TEXT NOT NULL DEFAULT 'in', PRIMARY KEY(message_id,file_id,name),
        FOREIGN KEY(message_id,direction,file_id) REFERENCES temporary_attachment_refs(message_id,direction,file_id) ON DELETE CASCADE
      );
    `);
  }

  registerSource(owner: string, file: ManagedAttachmentFile): void {
    this.db
      .prepare('INSERT INTO staged_attachment_sources(directory,owner,file) VALUES(?,?,?)')
      .run(file.directory, owner, JSON.stringify(file));
  }

  source(directory: string, owner: string, messageId: string): ManagedAttachmentFile | undefined {
    const row = this.db
      .prepare(
        'SELECT owner,file,message_id FROM staged_attachment_sources WHERE directory=? AND cleaned=0',
      )
      .get(directory) as SourceRow | undefined;
    if (!row || row.owner !== owner || (row.message_id !== null && row.message_id !== messageId))
      return;
    return JSON.parse(row.file) as ManagedAttachmentFile;
  }

  bindSources(owner: string, messageId: string, sources: readonly Source[]): void {
    const bind = this.db
      .prepare(`UPDATE staged_attachment_sources SET file=?,message_id=?,file_id=?,size=?
      WHERE directory=? AND owner=? AND cleaned=0 AND (message_id IS NULL OR message_id=?)`);
    for (const { file, attachment } of sources) {
      if (
        !bind.run(
          JSON.stringify(file),
          messageId,
          attachment.id,
          attachment.size,
          file.directory,
          owner,
          messageId,
        ).changes
      )
        throw new Error('The temporary attachment source changed');
    }
  }

  recordRefs(messageId: string, direction: Direction, ids: readonly string[]): void {
    const insert = this.db.prepare(
      'INSERT INTO temporary_attachment_refs(message_id,direction,file_id) VALUES(?,?,?)',
    );
    for (const id of ids) insert.run(messageId, direction, id);
  }

  temporaryIds(messageId: string, direction: Direction): string[] {
    return this.db
      .prepare('SELECT file_id FROM temporary_attachment_refs WHERE message_id=? AND direction=?')
      .all(messageId, direction)
      .map((row) => String(row.file_id));
  }

  unavailableIds(messageId: string, direction?: Direction): string[] {
    return this.db
      .prepare(
        `SELECT DISTINCT file_id FROM temporary_attachment_refs
      WHERE message_id=? AND removed=1 AND (? IS NULL OR direction=?)`,
      )
      .all(messageId, direction ?? null, direction ?? null)
      .map((row) => String(row.file_id));
  }

  recordCopy(messageId: string, id: string, file: ManagedAttachmentFile): void {
    this.db
      .prepare(
        `INSERT INTO temporary_attachment_copies(message_id,file_id,name,file)
      VALUES(?,?,?,?) ON CONFLICT(message_id,file_id,name) DO UPDATE SET file=excluded.file`,
      )
      .run(messageId, id, file.name, JSON.stringify(file));
  }

  copies(messageId: string, id: string): ManagedAttachmentFile[] {
    return this.db
      .prepare('SELECT file FROM temporary_attachment_copies WHERE message_id=? AND file_id=?')
      .all(messageId, id)
      .map((row) => JSON.parse(String(row.file)) as ManagedAttachmentFile);
  }

  verifiedSources(): Source[] {
    return this.db
      .prepare(
        `SELECT s.file,s.file_id,s.size FROM staged_attachment_sources s
      JOIN messages m ON m.id=s.message_id AND m.direction='out'
      WHERE s.cleaned=0 AND m.state='processed'`,
      )
      .all()
      .map((row) => ({
        file: JSON.parse(String(row.file)) as ManagedAttachmentFile,
        attachment: { id: String(row.file_id), size: Number(row.size) },
      }));
  }

  finishSource(directory: string): void {
    this.db
      .prepare('UPDATE staged_attachment_sources SET cleaned=1 WHERE directory=?')
      .run(directory);
  }

  verifiedReceived(): { messageId: string; attachment: Attachment; removed: boolean }[] {
    return this.db
      .prepare(
        `SELECT m.id,m.envelope,r.file_id,r.removed FROM temporary_attachment_refs r
      JOIN messages m ON m.id=r.message_id AND m.direction=r.direction
      WHERE r.direction='in' AND m.state='processed'`,
      )
      .all()
      .flatMap((row) => {
        const envelope = JSON.parse(String(row.envelope)) as Message['envelope'];
        const attachment = envelope.attachments.find(({ id }) => id === row.file_id);
        return attachment
          ? [{ messageId: String(row.id), attachment, removed: row.removed === 1 }]
          : [];
      });
  }

  finishReceived(messageId: string, id: string): void {
    // The local sender and recipient may share the same managed copy.
    this.db
      .prepare('UPDATE temporary_attachment_refs SET removed=1 WHERE message_id=? AND file_id=?')
      .run(messageId, id);
  }

  retainedBlob(id: string): boolean {
    return !!this.db
      .prepare(
        `SELECT 1 FROM messages m,json_each(m.envelope,'$.attachments') a
      WHERE json_extract(a.value,'$.id')=? AND NOT EXISTS (
        SELECT 1 FROM temporary_attachment_refs r WHERE m.id=r.message_id AND m.direction=r.direction
          AND r.file_id=? AND r.removed=1
      ) LIMIT 1`,
      )
      .get(id, id);
  }
}

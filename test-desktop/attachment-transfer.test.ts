import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { FileStore } from '../desktop/core/files.js';
import { SettingsFile } from '../desktop/core/settings.js';
import {
  bytesPerMiB,
  defaultAttachmentLimitMiB,
  exceedsAttachmentLimit,
  type AttachmentLimit,
} from '../desktop/shared/attachment-limit.js';

const describe = (payload: Buffer) => ({
  id: createHash('sha256').update(payload).digest('hex'),
  name: 'transfer.bin',
  size: payload.length,
});
const chunkSize = 192 * 1024;
async function filesFixture(t: test.TestContext, limit?: () => AttachmentLimit) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-transfer-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const files = new FileStore(directory, [directory], limit);
  await files.init();
  return { files, directory };
}

test('Resume hashes the retained prefix and checks the full digest before exposing a blob', async (t) => {
  const { files } = await filesFixture(t);
  const payload = Buffer.alloc(chunkSize + 41, 23);
  payload.fill(47, chunkSize);
  const attachment = describe(payload);
  const blob = files.blob(attachment.id);
  await assert.rejects(
    files.receive(attachment, async (offset, length) => {
      if (offset) throw new Error('synthetic link stopped');
      return payload.subarray(offset, offset + length).toString('base64');
    }),
    /synthetic link stopped/,
  );
  assert.equal((await stat(blob + '.part')).size, chunkSize);
  await assert.rejects(stat(blob), { code: 'ENOENT' });

  const offsets: number[] = [];
  await files.receive(attachment, async (offset, length) => {
    offsets.push(offset);
    return payload.subarray(offset, offset + length).toString('base64');
  });
  assert.deepEqual(offsets, [chunkSize]);
  assert.deepEqual(await readFile(blob), payload);
  await assert.rejects(stat(blob + '.part'), { code: 'ENOENT' });
  await files.receive(attachment, async () => {
    throw new Error('Verified dedup should not request chunks');
  });

  await writeFile(blob, Buffer.alloc(payload.length, 1));
  assert.equal(await files.exists(attachment), false);
  await files.receive(attachment, async (offset, length) =>
    payload.subarray(offset, offset + length).toString('base64'),
  );
  assert.deepEqual(await readFile(blob), payload);
});

test('Corrupt prefix and last chunk cannot publish or leave a falsely verified attachment', async (t) => {
  const { files } = await filesFixture(t);
  const payload = Buffer.alloc(chunkSize + 11, 43);
  const attachment = describe(payload);
  const blob = files.blob(attachment.id);
  await writeFile(blob + '.part', Buffer.alloc(chunkSize, 67));
  await assert.rejects(
    files.receive(attachment, async (offset, length) =>
      payload.subarray(offset, offset + length).toString('base64'),
    ),
    /SHA-256 mismatch/,
  );
  await assert.rejects(stat(blob + '.part'), { code: 'ENOENT' });
  await assert.rejects(stat(blob), { code: 'ENOENT' });
  await assert.rejects(
    files.receive(attachment, async (offset, length) =>
      (offset ? Buffer.alloc(length, 46) : payload.subarray(offset, offset + length)).toString(
        'base64',
      ),
    ),
    /SHA-256 mismatch/,
  );
  await assert.rejects(stat(blob), { code: 'ENOENT' });
});

test('Outgoing size limits do not affect incoming verification', async (t) => {
  let limit: AttachmentLimit = 1;
  const { directory, files } = await filesFixture(t, () => limit);
  const payload = Buffer.alloc(bytesPerMiB + 1, 4),
    attachment = describe(payload);
  const filename = path.join(directory, attachment.name);
  await writeFile(filename, payload);
  await assert.rejects(files.snapshot(filename), /attachment size limit/);
  await files.receive(attachment, async (offset, length) =>
    payload.subarray(offset, offset + length).toString('base64'),
  );
  assert.equal(await files.exists(attachment), true);
  limit = null;
  assert.deepEqual(await files.snapshot(filename), attachment);
  assert.deepEqual(await readFile(await files.materialize(randomUUID(), attachment)), payload);
});

test('Attachment settings persist default, positive MiB and unlimited without changing legacy settings', async (t) => {
  const { directory } = await filesFixture(t);
  const file = new SettingsFile(directory);
  await file.load();
  assert.equal(file.attachmentLimitMiB, defaultAttachmentLimitMiB);
  assert.equal(file.attachmentLimitMiB, 1024);
  assert.equal(exceedsAttachmentLimit(1024 * bytesPerMiB, defaultAttachmentLimitMiB), false);
  assert.equal(exceedsAttachmentLimit(1024 * bytesPerMiB + 1, defaultAttachmentLimitMiB), true);
  const before = await readFile(file.filename);
  await file.saveAttachmentLimit(1);
  const next = new SettingsFile(directory);
  await next.load();
  assert.equal(next.attachmentLimitMiB, 1);
  await assert.rejects(next.saveAttachmentLimit(0));
  await next.saveAttachmentLimit(null);
  await file.load();
  assert.equal(file.attachmentLimitMiB, null);
  assert.deepEqual(await readFile(file.filename), before);
});

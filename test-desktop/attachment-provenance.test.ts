import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { link, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AttachmentProvenance } from '../desktop/core/attachment-provenance.js';

const payload = Buffer.from('synthetic attachment');
const attachment = { id: createHash('sha256').update(payload).digest('hex'), size: payload.length };

async function fixture(t: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-attachment-proof-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, provenance: new AttachmentProvenance(directory) };
}

test('An exact staged attachment can be removed after its committed bytes are verified', async (t) => {
  const { provenance } = await fixture(t);
  const { localPath, witness: stage } = await provenance.stage('Снимок 漢字.txt');
  assert.equal(await readFile(localPath, 'utf8'), '');
  await writeFile(localPath, payload);
  const { witness } = await provenance.inspect(
    'Temporary Attachments',
    stage.directory,
    stage.name,
  );
  assert.equal(witness.identity, stage.identity);
  assert.equal(await provenance.remove('Temporary Attachments', witness, attachment), 'removed');
  await assert.rejects(readFile(localPath), { code: 'ENOENT' });
  assert.equal(await provenance.remove('Temporary Attachments', witness, attachment), 'missing');
});

test('Attachments replaced, edited, hard-linked or symlinked remain untouched', async (t) => {
  const { directory, provenance } = await fixture(t);
  const { localPath, witness: stage } = await provenance.stage('original.txt');
  await writeFile(localPath, payload);
  const { witness } = await provenance.inspect(
    'Temporary Attachments',
    stage.directory,
    stage.name,
  );
  const another = path.join(directory, 'ordinary.txt');
  await link(localPath, another);
  assert.equal(await provenance.remove('Temporary Attachments', witness, attachment), 'preserved');
  assert.deepEqual(await readFile(another), payload);
  await rm(another);
  assert.equal(
    await provenance.remove('Temporary Attachments', witness, {
      ...attachment,
      id: '0'.repeat(64),
    }),
    'preserved',
  );
  assert.deepEqual(await readFile(localPath), payload);
  await writeFile(localPath, 'edits');
  assert.equal(await provenance.remove('Temporary Attachments', witness, attachment), 'preserved');
  assert.equal(await readFile(localPath, 'utf8'), 'edits');
  await rename(localPath, another);
  await writeFile(localPath, payload);
  assert.equal(await provenance.remove('Temporary Attachments', witness, attachment), 'preserved');
  assert.deepEqual(await readFile(localPath), payload);
  if (process.platform !== 'win32') {
    await rm(localPath);
    await symlink(another, localPath);
    assert.equal(
      await provenance.remove('Temporary Attachments', witness, attachment),
      'preserved',
    );
    assert.equal(await readFile(another, 'utf8'), 'edits');
  }
  await assert.rejects(provenance.stage('../ordinary.txt'), /plain attachment filename/);
});

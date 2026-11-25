import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { NodeService } from '../build/core/service.js';
import { createUiEnvironment, createUiProfile } from './ui-test-profile.mjs';

const require = createRequire(import.meta.url);
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ncf-attachment-cleanup-ui-'));
const profile = path.join(temporary, 'node');
const environment = await createUiEnvironment(path.join(temporary, 'clients'));
let seed, app;

try {
  await createUiProfile(profile);
  seed = new NodeService(profile);
  await seed.open();
  const source = seed.connect({ nickname: 'Fixture sender', client: 'MCP' });
  const target = seed.connect({ nickname: 'Fixture recipient', client: 'MCP' });
  const { localPath } = await seed.stageAttachment(source.binding.connectionId, 'fixture.txt');
  await writeFile(localPath, 'Synthetic attachment');
  const { id } = await seed.send({
    connectionId: source.binding.connectionId,
    recipientNickname: target.nickname,
    recipientNode: seed.settings.value.nodeId,
    text: 'Keep this history',
    files: [localPath],
  });
  const file = seed.store.get(id, 'in').envelope.attachments[0];
  const { localPath: received } = await seed.receiveFile(target.binding.connectionId, id, file.id);
  seed.store.recordDelivery(target.binding.connectionId, [id]);
  seed.store.db
    .prepare('UPDATE received_attachment_times SET received_at=? WHERE message_id=?')
    .run(Date.now() - 10 * 86_400_000, id);
  await seed.close();
  seed = null;

  app = await electron.launch({
    executablePath: require('electron'),
    args: [process.cwd(), '--data-dir', profile],
    cwd: temporary,
    env: environment,
    chromiumSandbox: true,
    timeout: 30000,
  });
  const page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  const startup = page
    .getByRole('dialog')
    .filter({ has: page.getByTestId('application-startup-setup') });
  await startup.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByTestId('nav-settings').click();
  const cap = page.getByRole('form', { name: 'Attachment size limit' });
  await cap.getByRole('textbox', { name: 'Maximum size (MiB)' }).fill('2');
  await cap.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForFunction(
    async () => (await window.interconnect.invoke('snapshot')).attachmentLimitMiB === 2,
  );
  const section = page.getByRole('region', { name: 'Received attachments' });
  await section.getByText('Fixture recipient', { exact: false }).waitFor();
  assert.equal(await section.getByRole('button', { name: /temporary sources/i }).count(), 0);
  const action = section.getByRole('button', { name: 'Remove received attachments' });
  await action.click();
  const dialog = page.getByRole('dialog', { name: 'Remove received attachments' });
  await dialog.getByText(/Message history, file names and separately saved files/).waitFor();
  const age = dialog.getByRole('combobox', { name: 'Older than' });
  assert.equal((await age.innerText()).trim(), '30 days');
  await age.click();
  await page.getByRole('option', { name: '7 days', exact: true }).click();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await readFile(received, 'utf8'), 'Synthetic attachment');

  await action.click();
  await age.click();
  await page.getByRole('option', { name: '7 days', exact: true }).click();
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await section.getByText('Removed: 1. Preserved: 0.', { exact: true }).waitFor();
  await section.getByText('Managed storage: 0 byte', { exact: false }).waitFor();
  const pageRows = await page.evaluate(() =>
    window.interconnect.invoke('chatHistory', { nickname: 'Fixture recipient' }),
  );
  const row = pageRows.messages.find((row) => row.envelope.id === id);
  assert.equal(row.envelope.text, 'Keep this history');
  assert.equal(row.envelope.attachments[0].name, 'fixture.txt');
  assert.deepEqual(row.unavailableAttachments, [file.id]);
  // The sender still owns the shared verified file.
  assert.equal(await readFile(received, 'utf8'), 'Synthetic attachment');
  console.log(
    'Attachment Settings: usage, Cancel, age selection, confirmed IPC, history and shared content PASS',
  );
} finally {
  await app?.close();
  await seed?.close();
  await rm(temporary, { recursive: true, force: true });
}

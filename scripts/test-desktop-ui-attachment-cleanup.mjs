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
  await page.getByTestId('nav-agents').click();
  const fallback = page.getByRole('img', { name: 'Unknown application', exact: true }).first();
  await fallback.waitFor();
  const glyph = fallback.getByText('?', { exact: true });
  const { width, height, border, padding, radius } = await glyph.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      width: box.width,
      height: box.height,
      border: style.borderTopWidth,
      padding: style.paddingTop,
      radius: style.borderTopLeftRadius,
    };
  });
  assert.deepEqual([width, height, border, padding], [24, 24, '2px', '2px']);
  assert.ok(parseFloat(radius) > 0);
  await page.getByTestId('nav-settings').click();
  const cap = page.getByRole('form', { name: 'Attachment size limit' });
  await cap.getByRole('textbox', { name: 'Maximum size (MiB)' }).fill('2');
  await cap.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForFunction(
    async () => (await window.interconnect.invoke('snapshot')).attachmentLimitMiB === 2,
  );
  const section = page.getByRole('region', { name: 'Storage' });
  const attachments = section.getByText('Attachments', { exact: true });
  await attachments.waitFor();
  const size = section.getByText(/^\d+ byte/);
  await size.waitFor();
  assert.equal(await section.getByText('Fixture recipient', { exact: false }).count(), 0);
  assert.equal(await section.getByRole('button', { name: /temporary sources/i }).count(), 0);
  const action = section.getByRole('button', { name: 'Remove received attachments' });
  const labelBounds = await attachments.boundingBox();
  const sizeBounds = await size.boundingBox();
  const actionBounds = await action.boundingBox();
  assert.ok(labelBounds && sizeBounds && actionBounds);
  assert.ok(labelBounds.x < sizeBounds.x && sizeBounds.x + sizeBounds.width < actionBounds.x);
  await action.click();
  const dialog = page.getByRole('dialog', { name: 'Remove received attachments' });
  await dialog.getByText(/Message history, file names and separately saved files/).waitFor();
  const age = dialog.getByRole('combobox', { name: 'Older than' });
  assert.equal((await age.innerText()).trim(), '30 days');
  await age.click();
  await page.getByRole('option', { name: 'All', exact: true }).press('Enter');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await readFile(received, 'utf8'), 'Synthetic attachment');

  await action.click();
  await age.click();
  await page.getByRole('option', { name: 'All', exact: true }).press('Enter');
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await section.getByText('Removed: 1. Preserved: 0.', { exact: true }).waitFor();
  await section.getByText('0 byte', { exact: true }).waitFor();
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

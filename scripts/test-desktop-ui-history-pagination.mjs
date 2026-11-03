import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { createUiEnvironment, createUiProfile } from './ui-test-profile.mjs';
import {
  reproduceHistoryClickScroll,
  verifyChatHistoryPagination,
} from './ui-chat-history-smoke.mjs';

// Only the history smoke case, against the unchanged application in a disposable profile.
const require = createRequire(import.meta.url);
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ncf-history-pagination-'));
const profile = path.join(temporary, 'desktop');
const expectedTexts = [
  'A local message with no remote connections.',
  'Full incoming message\nThe second line should wrap without horizontal scrolling.\n<script>window.injected = true</script>\n[external link](https://untrusted.invalid)',
  ...Array.from({ length: 205 }, (_, index) => 'Paging message ' + index),
];
let application;
let stderr = '';
try {
  await createUiProfile(profile, 'Isolated history pagination');
  const executable = process.env.INTERCONNECT_TEST_EXECUTABLE;
  application = await electron.launch({
    executablePath: executable ?? require('electron'),
    args: [...(executable ? [] : [process.cwd()]), '--data-dir', profile],
    cwd: temporary,
    env: await createUiEnvironment(path.join(temporary, 'clients')),
    timeout: 30000,
  });
  application.process().stderr?.on('data', (data) => {
    stderr += data.toString();
  });
  const page = await application.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('button', { name: 'Agents', exact: true }).click();
  await page.evaluate(async (texts) => {
    const { nodeId } = await window.interconnect.invoke('snapshot');
    for (const [index, text] of texts.entries())
      await window.interconnect.invoke('send', {
        nickname: index === 1 ? 'Sender' : 'Interface check',
        recipientNode: nodeId,
        recipientNickname: index === 1 ? 'Interface check' : 'Local recipient',
        text,
      });
  }, expectedTexts);
  const open = async () => {
    await page.getByRole('button', { name: 'Open chat with Interface check', exact: true }).click();
    await page.getByText('Paging message 204', { exact: true }).waitFor();
  };
  const reopen = async () => {
    await page.getByRole('button', { name: 'Close chat', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await open();
  };
  await open();
  const reproduction = await reproduceHistoryClickScroll(page, expectedTexts);
  await reopen();
  const pagination = await verifyChatHistoryPagination(page, expectedTexts, reopen);
  assert.deepEqual(errors, []);
  const report = {
    packaged: Boolean(executable),
    reproduction,
    pagination,
    isolatedProfile: true,
    liveAgentsContacted: false,
    errors,
  };
  await mkdir('release', { recursive: true });
  await writeFile('release/history-pagination-smoke.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} catch (error) {
  console.error(stderr.slice(-6000));
  throw error;
} finally {
  if (application) await application.close();
  await rm(temporary, { recursive: true, force: true });
}

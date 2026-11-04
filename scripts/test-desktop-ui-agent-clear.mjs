import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createUiEnvironment, createUiProfile } from './ui-test-profile.mjs';
import { NodeService } from '../build/core/service.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// This scenario owns only private profiles and loopback peers. Run with GUI permission.
const require = createRequire(import.meta.url);
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ncf-clear-ui-'));
const profile = path.join(temporary, 'desktop');
const remoteProfile = path.join(temporary, 'remote');
const firstName = 'UI Alpha Ж';
const secondName = 'UI Beta 漢字';
let seed, remote, application, client;
const pageErrors = [];
const checks = [];
const snapshot = (page) => page.evaluate(() => window.interconnect.invoke('snapshot'));
const invoke = (page, method, params = {}) =>
  page.evaluate(({ method, params }) => window.interconnect.invoke(method, params), {
    method,
    params,
  });
async function until(check) {
  const deadline = Date.now() + 7000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('Isolated clear UI condition timed out');
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}
function connected(result) {
  assert.equal(result.status, 'connected');
  return result;
}
async function noOverflow(page) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
  );
}
try {
  await createUiProfile(profile, 'Clear UI local machine');
  await createUiProfile(remoteProfile, 'Clear UI remote machine');
  seed = new NodeService(profile);
  remote = new NodeService(remoteProfile);
  await seed.open();
  await remote.open();
  const manual = seed.settings.value.adapters[0].id;
  const first = connected(
    seed.connect({ nickname: firstName, client: 'clear-ui', chatId: 'first', adapterId: manual }),
  );
  const second = connected(
    seed.connect({ nickname: secondName, client: 'clear-ui', chatId: 'second', adapterId: manual }),
  );
  remote.connect({ nickname: 'Remote record stays', client: 'clear-ui' });
  const access = seed.network.accessCode();
  await remote.network.join(seed.snapshot().peerUrl, access.code);
  const exported = path.join(seed.settings.value.exportRoots[0], 'preserved-user-export.txt');
  await writeFile(exported, 'The user export survives local history deletion.\n');
  await seed.send({
    connectionId: first.binding.connectionId,
    recipientNode: seed.settings.value.nodeId,
    recipientNickname: secondName,
    text: 'Original processed history',
    files: [exported],
  });
  await seed.read(second.binding.connectionId);
  const secondIncarnation = seed.store.sourceStamp(secondName).incarnation;
  await seed.close();
  seed = null;
  const environment = await createUiEnvironment(path.join(temporary, 'clients'));
  console.error(
    JSON.stringify({
      event: 'clear-ui-launch',
      phase: 'electron.launch',
      testPid: process.pid,
      electronPid: null,
    }),
  );
  application = await electron.launch({
    executablePath: require('electron'),
    args: [process.cwd(), '--data-dir', profile],
    cwd: temporary,
    env: environment,
    timeout: 30000,
  });
  console.error(
    JSON.stringify({
      event: 'clear-ui-launch',
      phase: 'first-window',
      testPid: process.pid,
      electronPid: application.process().pid,
    }),
  );
  const page = await application.firstWindow();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.getByRole('button', { name: 'Agents', exact: true }).click();
  await page
    .getByRole('button', { name: 'Delete ' + firstName + ' and history', exact: true })
    .waitFor();
  await mkdir('release', { recursive: true });
  await page.screenshot({ path: 'release/clear-agents-en.png', animations: 'disabled' });
  await page
    .getByRole('button', { name: 'Delete ' + firstName + ' and history', exact: true })
    .click();
  let dialog = page.getByRole('dialog');
  await dialog.getByText(firstName + ': 1 messages', { exact: true }).waitFor();
  assert.equal(
    /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(await dialog.innerText()),
    false,
  );
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal((await snapshot(page)).agents.length, 2);
  checks.push('Cancel preserves both local records');
  await page
    .getByRole('button', { name: 'Delete ' + firstName + ' and history', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Delete agent and history', exact: true }).click();
  await until(async () => (await snapshot(page)).agents.length === 1);
  assert.equal((await snapshot(page)).agents[0].nickname, secondName);
  await page.getByRole('button', { name: 'Open chat with ' + secondName, exact: true }).click();
  await page.getByText('Original processed history', { exact: true }).waitFor();
  checks.push('Selected deletion preserves the other processed mailbox');
  await page.getByRole('button', { name: 'Close chat', exact: true }).click();

  // New input invalidates the exact preview; a stale confirm cannot delete it.
  await page
    .getByRole('button', { name: 'Delete ' + secondName + ' and history', exact: true })
    .click();
  await dialog.getByText(secondName + ': 1 messages', { exact: true }).waitFor();
  const current = await snapshot(page);
  await invoke(page, 'send', {
    nickname: secondName,
    sourceIncarnation: secondIncarnation,
    recipientNode: current.nodeId,
    recipientNickname: secondName,
    text: 'Arrived after preview',
  });
  await dialog.getByRole('button', { name: 'Delete agent and history', exact: true }).click();
  await dialog.getByText(secondName + ': 3 messages', { exact: true }).waitFor();
  assert.equal((await snapshot(page)).agents.length, 1);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  checks.push('Stale preview requires a new human confirmation');

  const settings = JSON.parse(await readFile(path.join(profile, 'settings.json'), 'utf8'));
  client = new Client({ name: 'clear-ui', version: '1' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL((await snapshot(page)).mcpUrl), {
      requestInit: { headers: { authorization: 'Bearer ' + settings.localToken } },
    }),
  );
  const tool = async (args) => {
    const response = await client.callTool({ name: 'agent_clear_history', arguments: args });
    assert.ok(!response.isError);
    return response.structuredContent;
  };
  await page.getByRole('button', { name: 'Open chat with ' + secondName, exact: true }).click();
  await page.getByTestId('agent-chat-compose-toggle').click();
  await page
    .getByRole('textbox', { name: 'Message from the user', exact: true })
    .fill('Draft belonging to the deleted incarnation');
  const preview = await tool({ connectionId: second.binding.connectionId, scope: 'agent' });
  await tool({
    connectionId: second.binding.connectionId,
    scope: 'agent',
    operationId: preview.operationId,
    confirm: true,
  });
  await until(async () => (await snapshot(page)).agents.length === 0);
  await invoke(page, 'registerAgent', { nickname: secondName });
  await page.getByRole('button', { name: 'Open chat with ' + secondName, exact: true }).click();
  await page.getByTestId('agent-chat-compose-toggle').click();
  await until(
    async () =>
      (await page
        .getByRole('textbox', { name: 'Message from the user', exact: true })
        .inputValue()) === '',
  );
  assert.equal(await page.getByText('Original processed history', { exact: true }).count(), 0);
  assert.notEqual((await snapshot(page)).agents[0].incarnation, secondIncarnation);
  let rejected = false;
  try {
    await invoke(page, 'send', {
      nickname: secondName,
      sourceIncarnation: secondIncarnation,
      recipientNode: current.nodeId,
      recipientNickname: secondName,
      text: 'Stale selection',
    });
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true);
  checks.push('External MCP clear and same-name recreation invalidate UI history and draft');

  await page.getByRole('button', { name: 'Close chat', exact: true }).click();
  await invoke(page, 'registerAgent', { nickname: firstName });
  const beforeAll = await snapshot(page);
  await page.getByTestId('interface-language').click();
  await page.getByRole('option', { name: 'Русский', exact: true }).click();
  await page.setViewportSize({ width: 1050, height: 700 });
  await page.getByTestId('clear-all-local-agents').click();
  dialog = page.getByRole('dialog');
  await dialog.getByText('Локальных агентов: 2, сообщений: 0', { exact: true }).waitFor();
  await noOverflow(page);
  await page.screenshot({ path: 'release/clear-agents-ru-dialog.png', animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  assert.equal((await snapshot(page)).agents.length, 2);
  await page.getByTestId('clear-all-local-agents').click();
  await dialog.getByRole('button', { name: 'Удалить всех локальных агентов', exact: true }).click();
  await until(async () => (await snapshot(page)).agents.length === 0);
  const afterAll = await snapshot(page);
  assert.deepEqual(
    afterAll.peers.map(({ id, address }) => ({ id, address })),
    beforeAll.peers.map(({ id, address }) => ({ id, address })),
  );
  assert.deepEqual(
    afterAll.adapters.map(({ id, kind }) => ({ id, kind })),
    beforeAll.adapters.map(({ id, kind }) => ({ id, kind })),
  );
  assert.equal(remote.snapshot().agents[0].nickname, 'Remote record stays');
  assert.equal(
    await readFile(exported, 'utf8'),
    'The user export survives local history deletion.\n',
  );
  await until(() => page.getByTestId('clear-all-local-agents').isDisabled());
  assert.equal(await page.locator(`[data-agent-id^="${settings.nodeId}:"]`).count(), 0);
  checks.push('All-local deletion preserves peer, adapters, remote record and user export');
  await noOverflow(page);
  assert.deepEqual(pageErrors, []);
  await writeFile(
    'release/agent-clear-ui-review.json',
    JSON.stringify(
      {
        checks,
        pageErrors,
        isolatedProfiles: true,
        loopbackOnly: true,
        nativePackageVerified: false,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify({ checks, pageErrors, isolatedProfiles: true, loopbackOnly: true }));
} catch (error) {
  const page = application?.windows()[0];
  if (page) {
    const dialogText = await page
      .getByRole('dialog')
      .innerText({ timeout: 1000 })
      .catch(() => '');
    console.error(JSON.stringify({ event: 'clear-ui-failure', dialogText }));
  }
  throw error;
} finally {
  await client?.close().catch(() => {});
  await application?.close().catch(() => {});
  await seed?.close().catch(() => {});
  await remote?.close().catch(() => {});
  await rm(temporary, { recursive: true, force: true });
}

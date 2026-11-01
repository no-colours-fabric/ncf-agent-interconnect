import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createUiProfile } from './ui-test-profile.mjs';
import { NodeService } from '../build/core/service.js';

const require = createRequire(import.meta.url);
const temp = await mkdtemp(path.join(os.tmpdir(), 'ncf-agents-tabs-'));
const owner = 'Owner Ж',
  otherOwner = 'Other owner',
  counterpart = 'Общий агент';
const literalName = 'data$&-{size}-漢字.txt';
const screenshots = [],
  errors = [],
  remotes = [];
let application, page;
const launchDiagnostic = {
  testPid: process.pid,
  testParentPid: process.ppid,
  electronPid: null,
};
function logLaunchPhase(phase) {
  console.error(JSON.stringify({ event: 'agents-tabs-gui-launch', phase, ...launchDiagnostic }));
}
const invoke = (method, params = {}) =>
  page.evaluate(({ method, params }) => window.interconnect.invoke(method, params), {
    method,
    params,
  });
const local = () => page.getByTestId('agents-panel-local');
const remote = () => page.getByTestId('agents-panel-remote');
const tab = (name) => page.getByTestId('agents-tab-' + name);
const field = (panel, name) => panel.getByRole('textbox', { name, exact: true });
const until = async (predicate) => {
  const deadline = Date.now() + 15000;
  while (!(await predicate())) {
    if (Date.now() >= deadline) throw new Error('Isolated agents-tabs check timed out');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};
async function selectSender(name) {
  await page.getByTestId('remote-sender').getByRole('combobox').click();
  await page.getByRole('option', { name, exact: true }).click();
}
async function choose(nodeId) {
  await remote()
    .getByTestId('directory-' + nodeId)
    .getByRole('button', { name: counterpart })
    .click();
}
async function capture(name) {
  const file = 'release/agents-tabs-' + name + '.png';
  await page.mouse.move(1, 1);
  await page.screenshot({ path: file, animations: 'disabled' });
  screenshots.push(file);
}
try {
  const profile = path.join(temp, 'desktop');
  await createUiProfile(profile);
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  logLaunchPhase('resolve-runtime');
  const executablePath = require('electron');
  logLaunchPhase('electron.launch');
  try {
    application = await electron.launch({
      executablePath,
      args: [process.cwd(), '--data-dir', profile],
      cwd: temp,
      env,
      timeout: 30000,
    });
  } catch (error) {
    logLaunchPhase('electron.launch-failed');
    throw new Error(
      'Electron GUI initialization failed during electron.launch. ' +
        `Test PID: ${process.pid}; test parent PID: ${process.ppid}; Electron PID: unavailable. ` +
        'On macOS, use an authorized desktop GUI environment; in Codex, use approved ' +
        'require_escalated execution instead of the restricted sandbox. ' +
        'No automatic retry was attempted. Inspect the original launch error before another launch.',
      { cause: error },
    );
  }
  launchDiagnostic.electronPid = application.process().pid ?? null;
  logLaunchPhase('first-window');
  page = await application.firstWindow();
  logLaunchPhase('window-ready');
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByTestId('nav-agents').click();
  assert.equal(await tab('local').getAttribute('aria-selected'), 'true');
  await invoke('registerAgent', { nickname: owner });
  await invoke('registerAgent', { nickname: otherOwner });
  await local()
    .getByRole('button', { name: new RegExp('^' + owner) })
    .click();
  await field(local(), 'Recipient agent name').fill('Local target');
  await field(local(), 'Message from the user').fill('Local exchange without remote nodes.');
  await local().getByRole('button', { name: 'Send message', exact: true }).click();
  await local().getByText('Local exchange without remote nodes.', { exact: true }).waitFor();
  assert.equal((await invoke('snapshot')).peers.length, 0);
  assert.equal(await local().getByRole('combobox').count(), 0);
  await page.evaluate(async (owner) => {
    const snapshot = await window.interconnect.invoke('snapshot');
    for (let index = 0; index < 99; index++)
      await window.interconnect.invoke('send', {
        nickname: owner,
        recipientNode: snapshot.nodeId,
        recipientNickname: 'Local target',
        text: 'Unrelated local history ' + index,
      });
  }, owner);
  await field(local(), 'Recipient agent name').fill('Local draft target');
  await field(local(), 'Message from the user').fill('Local draft $& {name}');
  await tab('local').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  assert.equal(await tab('remote').getAttribute('aria-selected'), 'true');
  assert.equal(await page.getByTestId('remote-sender').getByRole('combobox').innerText(), '\u200b');
  await field(remote(), 'Message from the user').fill('Remote draft $& {size}');
  assert.equal(
    await remote().getByRole('button', { name: 'Send message', exact: true }).isDisabled(),
    true,
  );
  await tab('local').click();
  assert.equal(await field(local(), 'Message from the user').inputValue(), 'Local draft $& {name}');
  assert.equal(await field(local(), 'Recipient agent name').inputValue(), 'Local draft target');
  const settings = JSON.parse(await readFile(path.join(profile, 'settings.json'), 'utf8'));
  for (let index = 0; index < 2; index++) {
    const remoteProfile = path.join(temp, 'remote-' + index);
    await createUiProfile(remoteProfile, 'Isolated remote ' + (index + 1));
    const node = new NodeService(remoteProfile);
    remotes.push(node);
    await node.open();
    const access = await invoke('accessCode');
    await node.network.join(`wss://127.0.0.1:${settings.peerPort}/peer`, access.code);
    const connected = node.connect({
      nickname: counterpart,
      client: 'Isolated UI test',
      chatId: randomUUID(),
    });
    assert.equal(connected.status, 'connected');
    node.testConnection = connected.binding.connectionId;
    await until(async () =>
      (await invoke('snapshot')).directories.some(
        (directory) =>
          directory.nodeId === node.settings.value.nodeId &&
          directory.agents.some((agent) => agent.nickname === counterpart),
      ),
    );
  }
  const [first, second] = remotes;
  const firstId = first.settings.value.nodeId,
    secondId = second.settings.value.nodeId;
  const attachment = path.join(first.settings.value.exportRoots[0], literalName);
  await writeFile(attachment, 'Verified isolated file.\n');
  const send = (node, recipientNickname, text, files = []) =>
    node.send({
      connectionId: node.testConnection,
      recipientNode: settings.nodeId,
      recipientNickname,
      text,
      files,
    });
  await send(first, owner, 'First peer attachment conversation.', [attachment]);
  await send(second, owner, 'Second peer same-name conversation.');
  await send(first, otherOwner, 'Other owner private conversation.');
  await until(
    async () =>
      (await invoke('snapshot')).agents.find((agent) => agent.nickname === owner).messageCount ===
      102,
  );
  await local().getByRole('button', { name: 'Load more messages', exact: true }).click();
  await local().getByText('First peer attachment conversation.', { exact: true }).waitFor();
  await local().getByText('Second peer same-name conversation.', { exact: true }).waitFor();
  const countBefore = await local()
    .getByText(/^Messages: /)
    .innerText();
  await local()
    .getByRole('button', { name: new RegExp('^' + owner) })
    .click();
  assert.equal(
    await local().getByText('First peer attachment conversation.', { exact: true }).isVisible(),
    true,
  );
  assert.equal(
    await local()
      .getByText(/^Messages: /)
      .innerText(),
    countBefore,
  );
  await mkdir('release', { recursive: true });
  await capture('en-local');
  const snapshotBefore = await invoke('snapshot');
  await tab('remote').click();
  await choose(firstId);
  assert.equal(
    await field(remote(), 'Message from the user').inputValue(),
    'Remote draft $& {size}',
  );
  await selectSender(owner);
  await remote().getByRole('button', { name: 'Load more messages', exact: true }).waitFor();
  assert.equal(
    await remote().getByText('First peer attachment conversation.', { exact: true }).count(),
    0,
  );
  await remote().getByRole('button', { name: 'Load more messages', exact: true }).click();
  await remote().getByText('First peer attachment conversation.', { exact: true }).waitFor();
  assert.equal(
    await remote().getByText('Second peer same-name conversation.', { exact: true }).count(),
    0,
  );
  assert.equal(
    await remote().getByText('Other owner private conversation.', { exact: true }).count(),
    0,
  );
  await remote()
    .getByRole('button', { name: 'Open ' + literalName, exact: true })
    .waitFor();
  await choose(firstId);
  assert.equal(
    await remote().getByText('First peer attachment conversation.', { exact: true }).isVisible(),
    true,
  );
  const saved = path.join(temp, 'saved.txt');
  await application.evaluate(({ dialog, shell }, saved) => {
    globalThis.__testOpenPaths = [];
    shell.openPath = async (filename) => {
      globalThis.__testOpenPaths.push(filename);
      return '';
    };
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: saved });
  }, saved);
  await remote()
    .getByRole('button', { name: 'Open ' + literalName, exact: true })
    .click();
  await remote()
    .getByRole('button', { name: 'Save ' + literalName, exact: true })
    .click();
  await until(async () => {
    try {
      await readFile(saved);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  });
  assert.equal(await readFile(saved, 'utf8'), await readFile(attachment, 'utf8'));
  assert.equal(
    path.extname((await application.evaluate(() => globalThis.__testOpenPaths))[0]),
    '.txt',
  );
  await choose(secondId);
  await remote().getByRole('button', { name: 'Load more messages', exact: true }).click();
  await remote().getByText('Second peer same-name conversation.', { exact: true }).waitFor();
  assert.equal(
    await remote().getByText('First peer attachment conversation.', { exact: true }).count(),
    0,
  );
  await selectSender(otherOwner);
  await remote().getByText('No messages yet.', { exact: true }).waitFor();
  assert.equal(
    await remote().getByText('Second peer same-name conversation.', { exact: true }).count(),
    0,
  );
  await choose(firstId);
  await remote().getByText('Other owner private conversation.', { exact: true }).waitFor();
  await selectSender(owner);
  await choose(secondId);
  await page.getByTestId('remote-recipient-node').getByRole('combobox').click();
  assert.equal(await page.getByRole('option', { name: 'This computer', exact: true }).count(), 0);
  await page.getByRole('option', { name: 'Isolated remote 1', exact: true }).click();
  assert.equal(await field(remote(), 'Recipient agent name').inputValue(), '');
  await field(remote(), 'Recipient agent name').fill('a'.repeat(121));
  await field(remote(), 'Recipient agent name').fill(counterpart);
  await page.getByTestId('nav-network').click();
  await page
    .getByTestId('directory-' + firstId)
    .getByRole('button', { name: counterpart })
    .click();
  assert.equal(await tab('remote').getAttribute('aria-selected'), 'true');
  assert.ok(
    (await page.getByTestId('remote-recipient-node').getByRole('combobox').innerText()).includes(
      'Isolated remote 1',
    ),
  );
  assert.equal(await field(remote(), 'Recipient agent name').inputValue(), counterpart);
  assert.equal(
    await page.getByTestId('remote-recipient-node').locator('input').inputValue(),
    firstId,
  );
  const snapshotAfter = await invoke('snapshot');
  assert.deepEqual(
    snapshotAfter.agents,
    snapshotBefore.agents,
    'navigation must not send or mark messages received',
  );
  await field(remote(), 'Message from the user').fill('Exact remote address send.');
  await remote().getByRole('button', { name: 'Send message', exact: true }).click();
  await until(
    () =>
      first.snapshot().agents.find((agent) => agent.nickname === counterpart).messageCount === 3,
  );
  assert.equal(
    second.snapshot().agents.find((agent) => agent.nickname === counterpart).messageCount,
    1,
  );
  const firstHistory = await first.userCall('history', { nickname: counterpart });
  const outgoing = firstHistory.messages.find(
    (message) => message.envelope.text === 'Exact remote address send.',
  );
  assert.equal(outgoing.envelope.toNode, firstId);
  assert.equal(outgoing.envelope.fromNickname, owner);
  await field(remote(), 'Message from the user').fill('Remote draft survives local send.');
  await tab('local').click();
  await local().getByText('First peer attachment conversation.', { exact: true }).waitFor();
  assert.equal(await field(local(), 'Message from the user').inputValue(), 'Local draft $& {name}');
  await local().getByRole('button', { name: 'Send message', exact: true }).click();
  await until(async () =>
    (await invoke('snapshot')).agents.some((agent) => agent.nickname === 'Local draft target'),
  );
  const localHistory = await invoke('history', { nickname: 'Local draft target' });
  assert.equal(localHistory.messages[0].envelope.toNode, settings.nodeId);
  await tab('remote').click();
  assert.equal(
    await field(remote(), 'Message from the user').inputValue(),
    'Remote draft survives local send.',
  );
  await remote().getByRole('button', { name: 'Load more messages', exact: true }).click();
  await remote().getByText('First peer attachment conversation.', { exact: true }).waitFor();
  await capture('en-remote');
  await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1050, 700),
  );
  for (const language of ['Русский', 'Deutsch', 'Français']) {
    await page.getByTestId('interface-language').getByRole('combobox').click();
    await page.getByRole('option', { name: language, exact: true }).click();
    for (const name of ['local', 'remote']) {
      await tab(name).click();
      assert.ok(
        await page
          .locator('main')
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      );
      const bounds = await tab(name).boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 1050);
      if (language === 'Русский') await capture('ru-' + name + '-1050x700');
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      defaultLocal: true,
      keyboardTabs: true,
      independentDrafts: true,
      localOnlySend: true,
      explicitRemoteSender: true,
      exactRemoteAddress: true,
      duplicateNamesSeparated: true,
      ownerHistoriesSeparated: true,
      rawPaginationBeyondEmptyFilteredPage: true,
      networkToRemote: true,
      navigationHasNoSideEffects: true,
      selectedHistoryPreserved: true,
      literalAttachmentOpenSave: true,
      languages: ['en', 'ru', 'de', 'fr'],
      minimumWindow: [1050, 700],
      liveAgentsContacted: false,
      pageErrors: errors,
      screenshots,
    }),
  );
} finally {
  for (const node of remotes) await node.close();
  if (application) await application.close();
  await rm(temp, { recursive: true, force: true });
}

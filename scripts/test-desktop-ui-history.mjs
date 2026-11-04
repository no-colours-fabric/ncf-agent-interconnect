import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { NodeService } from '../build/core/service.js';
import { createUiEnvironment, createUiProfile } from './ui-test-profile.mjs';

// Real storage and verified files in a private loopback node; no live agent bindings.
const require = createRequire(import.meta.url);
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ncf-chat-history-'));
const profile = path.join(temporary, 'node');
const alpha = 'Preview Alpha',
  beta = 'Preview Beta';
const count = 420;
const token = randomUUID();
const version = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
).version;
const keepOpen = process.argv.includes('--keep-open');
let service, application, server, historyGate;
const pendingHistory = [],
  openedFiles = [],
  savedFiles = [],
  errors = [],
  anchors = [];
const until = async (predicate) => {
  const deadline = Date.now() + 15000;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error('History and attachments check timed out');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};
async function frames(page, count = 4) {
  await page.evaluate(
    (count) =>
      new Promise((resolve) => {
        const next = () => {
          if (--count <= 0) resolve();
          else requestAnimationFrame(next);
        };
        requestAnimationFrame(next);
      }),
    count,
  );
}
async function startAnchorTrace(page, triggerTop) {
  return page.getByTestId('agent-chat-history').evaluate((element, triggerTop) => {
    if (triggerTop !== undefined) element.scrollTop = triggerTop;
    const top = element.getBoundingClientRect().top;
    const target = [...element.querySelectorAll('[data-testid="chat-message"]')].find(
      (item) => item.getBoundingClientRect().bottom > top + 1,
    );
    if (!target) throw new Error('A visible message is required for a scroll anchor');
    const trace = {
      sequence: target.dataset.sequence,
      offset: target.getBoundingClientRect().top - top,
      samples: [],
      running: true,
    };
    window.__historyAnchorTrace = trace;
    const sample = () => {
      if (!trace.running) return;
      const item = element.querySelector(`[data-sequence="${trace.sequence}"]`);
      if (!item) throw new Error('The visible message disappeared during pagination');
      trace.samples.push(
        item.getBoundingClientRect().top - element.getBoundingClientRect().top - trace.offset,
      );
      requestAnimationFrame(sample);
    };
    sample();
    return { sequence: trace.sequence, offset: trace.offset };
  }, triggerTop);
}
async function finishAnchorTrace(page, label) {
  await frames(page, 6);
  const trace = await page.evaluate(() => {
    const trace = window.__historyAnchorTrace;
    trace.running = false;
    return {
      sequence: trace.sequence,
      samples: trace.samples.length,
      maxShift: Math.max(...trace.samples.map(Math.abs)),
    };
  });
  anchors.push({ label, ...trace });
  assert.ok(trace.samples >= 4, label + ': insufficient paint samples');
  assert.ok(trace.maxShift <= 1, label + ': visible message moved ' + trace.maxShift + ' px');
}
async function message(index) {
  const from = index % 2 ? beta : alpha;
  const to = index % 2 ? alpha : beta;
  const attachments =
    index === 418 || index === 419 ? files : index % 97 === 0 ? files.slice(0, 1) : [];
  return service.userCall('send', {
    nickname: from,
    recipientNode: service.settings.value.nodeId,
    recipientNickname: to,
    text:
      index >= 418
        ? `Message ${index + 1}: sample attachments for opening and saving.`
        : `Message ${index + 1}\n` +
          Array.from(
            { length: 1 + (index % 5) },
            (_, line) => `History line ${line + 1}: older messages load above the current view.`,
          ).join('\n'),
    files: attachments,
  });
}
const names = [
  'notes.txt',
  'данные$&-{size}-漢字-with-a-long-file-name-for-wrapping.csv',
  'sample-image.png',
];
let files;
try {
  await createUiProfile(profile, 'History and attachments preview');
  service = new NodeService(profile);
  await service.open();
  files = names.map((name) => path.join(profile, 'Files', name));
  await writeFile(files[0], 'Private attachment fixture.\nUnicode: Москва 東京.\n');
  await writeFile(files[1], 'name,value\nAlpha,10\nBeta,20\n');
  await copyFile(path.resolve('build/assets/icon.png'), files[2]);
  for (let index = 0; index < count; index++) await message(index);
  assert.equal(
    service.snapshot().agents.find((agent) => agent.nickname === alpha).messageCount,
    count,
  );
  const rpc = async (request, response) => {
    try {
      if (request.headers.authorization !== 'Bearer ' + token) {
        response.writeHead(403).end();
        return;
      }
      let body = '';
      for await (const chunk of request) body += chunk;
      const { method, params } = JSON.parse(body);
      let result;
      if (method === 'appVersion') result = version;
      else if (method === 'copy') result = { copied: true };
      else if (method === 'openAttachment' || method === 'saveAttachment')
        result = await service.withUserAttachment(
          params.messageId,
          params.fileId,
          async (file, filename, assertCurrent) => {
            assertCurrent();
            if (method === 'openAttachment') {
              openedFiles.push({ file, filename, bytes: await readFile(filename) });
              return { opened: true };
            }
            const destination = path.join(temporary, 'saved', file.name);
            await mkdir(path.dirname(destination), { recursive: true });
            assertCurrent();
            await copyFile(filename, destination);
            savedFiles.push(destination);
            return { saved: true };
          },
        );
      else {
        if (method === 'chatHistory' && historyGate) {
          pendingHistory.push(params);
          await historyGate.promise;
        }
        result = await service.userCall(method, params);
      }
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(result));
    } catch (error) {
      response
        .writeHead(400, { 'content-type': 'application/json' })
        .end(JSON.stringify({ error: error.message }));
    }
  };
  server = createServer(rpc);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const preload = path.join(temporary, 'preload.cjs'),
    main = path.join(temporary, 'main.cjs');
  await writeFile(
    preload,
    `const{contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('interconnect',{invoke:(method,params={})=>ipcRenderer.invoke('fixture:call',method,params),onChange:(listener)=>{const callback=()=>listener();ipcRenderer.on('fixture:change',callback);return()=>ipcRenderer.removeListener('fixture:change',callback);},onNavigate:()=>()=>{}});`,
  );
  await writeFile(
    main,
    `const{app,BrowserWindow,ipcMain}=require('electron');app.setPath('userData',${JSON.stringify(path.join(temporary, 'client-profile'))});let window;ipcMain.handle('fixture:call',async(_event,method,params)=>{if(method==='fixtureNotify'){window.webContents.send('fixture:change');return true;}const response=await fetch(${JSON.stringify(url)},{method:'POST',headers:{authorization:${JSON.stringify('Bearer ' + token)}},body:JSON.stringify({method,params})});const value=await response.json();if(!response.ok)throw Error(value.error);if(method==='send')window.webContents.send('fixture:change');return value;});app.whenReady().then(()=>{window=new BrowserWindow({width:1240,height:900,title:'Chat history and attachments preview',webPreferences:{preload:${JSON.stringify(preload)},contextIsolation:true,sandbox:true}});window.loadFile(${JSON.stringify(path.resolve('build/renderer/index.html'))});});app.on('window-all-closed',()=>app.quit());`,
  );
  const env = await createUiEnvironment(path.join(temporary, 'client-home'));
  application = await electron.launch({
    executablePath: require('electron'),
    args: [main],
    cwd: temporary,
    env,
    timeout: 30000,
  });
  const page = await application.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByTestId('nav-agents').click();
  const chatButton = page.getByRole('button', { name: 'Open chat with ' + alpha, exact: true });
  await chatButton.waitFor();
  assert.ok(
    (await chatButton.locator('svg path').getAttribute('d')).includes('m0 14H6l-2 2V4h16z'),
  );
  await mkdir('release', { recursive: true });
  await page.screenshot({ path: 'release/history-agents-outline.png', animations: 'disabled' });
  await chatButton.click();
  await page
    .getByText('Message 420: sample attachments for opening and saving.', { exact: true })
    .waitFor();
  const toggle = page.getByTestId('agent-chat-compose-toggle');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  await toggle.click();
  await frames(page);
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  const history = page.getByTestId('agent-chat-history');
  assert.equal(await page.getByTestId('chat-message').count(), 100);
  assert.ok(
    await history.evaluate(
      (element) => element.scrollHeight - element.scrollTop - element.clientHeight < 2,
    ),
  );
  for (const name of names) {
    const last = page.getByTestId('chat-message').last();
    await last.getByRole('button', { name: 'Open ' + name, exact: true }).click();
    await last.getByRole('button', { name: 'Save ' + name, exact: true }).click();
  }
  await until(() => openedFiles.length === 3 && savedFiles.length === 3);
  for (let index = 0; index < files.length; index++) {
    assert.deepEqual(openedFiles[index].bytes, await readFile(files[index]));
    assert.deepEqual(await readFile(savedFiles[index]), await readFile(files[index]));
  }
  assert.ok(await history.evaluate((element) => element.scrollWidth <= element.clientWidth));
  await page.mouse.move(10, 10);
  await page.getByRole('tooltip').waitFor({ state: 'hidden' });
  await page.screenshot({ path: 'release/history-attachments.png', animations: 'disabled' });
  await page
    .getByTestId('chat-message')
    .last()
    .screenshot({ path: 'release/history-attachment-bubble.png', animations: 'disabled' });
  for (const expected of [200, 300, 400, 420]) {
    await history.evaluate((element) => {
      element.scrollTop = 90;
    });
    await frames(page);
    let release;
    historyGate = {
      promise: new Promise((resolve) => {
        release = resolve;
      }),
      release: () => release(),
    };
    const requests = pendingHistory.length;
    await startAnchorTrace(page, 40);
    await until(() => pendingHistory.length > requests);
    await frames(page, 8);
    historyGate.release();
    historyGate = null;
    await until(async () => (await page.getByTestId('chat-message').count()) === expected);
    await finishAnchorTrace(page, 'prepend-' + expected);
  }
  const sequences = await page
    .getByTestId('chat-message')
    .evaluateAll((elements) => elements.map((element) => Number(element.dataset.sequence)));
  assert.equal(new Set(sequences).size, count);
  assert.deepEqual(
    sequences,
    [...sequences].sort((a, b) => a - b),
  );
  assert.equal(
    await page.getByRole('button', { name: 'Load more messages', exact: true }).count(),
    0,
  );
  await startAnchorTrace(page);
  await message(420);
  await page.evaluate(() => window.interconnect.invoke('fixtureNotify'));
  await until(async () => (await page.getByTestId('chat-message').count()) === 421);
  await finishAnchorTrace(page, 'append-while-reading');
  await history.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await frames(page);
  await message(421);
  await page.evaluate(() => window.interconnect.invoke('fixtureNotify'));
  await until(async () => (await page.getByTestId('chat-message').count()) === 422);
  assert.ok(
    await history.evaluate(
      (element) => element.scrollHeight - element.scrollTop - element.clientHeight < 2,
    ),
  );
  assert.deepEqual(errors, []);
  const report = {
    messages: count,
    loadedPages: [100, 200, 300, 400, 420],
    anchors,
    attachmentNames: names,
    attachmentBytesVerified: true,
    opens: openedFiles.length,
    saves: savedFiles.length,
    chronologicalWithoutDuplicates: true,
    followsLatestAtBottom: true,
    horizontalOverflow: false,
    isolatedNode: true,
    liveAgentsContacted: false,
    errors,
  };
  await writeFile('release/history-verification.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (keepOpen) {
    await page.getByRole('button', { name: 'Close chat', exact: true }).click();
    await page.getByRole('button', { name: 'Open chat with ' + alpha, exact: true }).click();
    await page
      .getByText('Message 420: sample attachments for opening and saving.', { exact: true })
      .waitFor();
    await page.getByTestId('agent-chat-compose-toggle').click();
    await page.getByTestId('agent-chat-history').evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    console.log(
      'Private preview is open with 422 messages per sample agent and three verified attachment types. Close its window to remove the private fixture.',
    );
    await new Promise((resolve) => application.process().once('exit', resolve));
  }
} finally {
  historyGate?.release();
  if (application && application.process().exitCode === null) await application.close();
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  if (service) await service.close();
  await rm(temporary, { recursive: true, force: true });
}

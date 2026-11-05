import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createUiEnvironment, createUiProfile } from './ui-test-profile.mjs';

const require = createRequire(import.meta.url);
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ncf-preview-'));
let app;
const clients = [];
try {
  const packaged = process.env.INTERCONNECT_TEST_EXECUTABLE;
  const launchEnv = { ...(await createUiEnvironment(path.join(temporary, 'clients'))), TZ: 'UTC' };
  const profile = path.join(temporary, 'desktop');
  await createUiProfile(profile, 'Demo node');
  app = await electron.launch({
    executablePath: packaged ?? require('electron'),
    args: [...(packaged ? [] : [process.cwd()]), '--data-dir', profile],
    cwd: temporary,
    env: launchEnv,
  });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1440, 900),
  );
  await page.getByText('Connect agents', { exact: true }).waitFor();
  const settings = JSON.parse(await readFile(path.join(profile, 'settings.json'), 'utf8'));
  const snapshot = await page.evaluate(() => window.interconnect.invoke('snapshot'));
  const connect = async (nickname) => {
    const client = new Client({ name: 'MCP demo', version: '1' });
    clients.push(client);
    await client.connect(
      new StreamableHTTPClientTransport(new URL(snapshot.mcpUrl), {
        requestInit: { headers: { authorization: 'Bearer ' + settings.localToken } },
      }),
    );
    const result = await client.callTool({ name: 'agent_connect', arguments: { nickname } });
    assert.equal(result.structuredContent.status, 'connected');
    return { client, connectionId: result.structuredContent.binding.connectionId };
  };
  const researcher = await connect('Researcher'),
    reviewer = await connect('Reviewer');
  const file = path.join(profile, 'Files', 'review-checklist.md');
  await writeFile(
    file,
    '# Review checklist\n\n- Local routing\n- File integrity\n- Restart recovery\n',
  );
  const send = (sender, recipientNickname, text, files = []) =>
    sender.client.callTool({
      name: 'agent_send',
      arguments: {
        connectionId: sender.connectionId,
        recipientNode: settings.nodeId,
        recipientNickname,
        text,
        files,
      },
    });
  const receive = (receiver) =>
    receiver.client.callTool({
      name: 'agent_read',
      arguments: { connectionId: receiver.connectionId },
    });
  assert.ok(
    !(
      await send(
        researcher,
        'Reviewer',
        'The implementation is ready for review.\nI checked local routing, file integrity and restart recovery.\nPlease review the attached checklist.',
        [file],
      )
    ).isError,
  );
  await receive(reviewer);
  assert.ok(
    !(
      await send(
        reviewer,
        'Researcher',
        'Reviewed. Local messages work without remote peers, and the attachment matches its SHA-256 hash.\nThe checklist is complete.',
      )
    ).isError,
  );
  await receive(researcher);
  await page.getByRole('button', { name: 'Agents', exact: true }).click();
  await page.getByRole('button', { name: 'Open chat with Reviewer', exact: true }).click();
  await page
    .getByText(
      'Reviewed. Local messages work without remote peers, and the attachment matches its SHA-256 hash.',
      { exact: false },
    )
    .waitFor();
  await page.getByRole('button', { name: 'Open review-checklist.md', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Compose message', exact: true }).click();
  await page.locator('.MuiCollapse-entered [data-testid="agent-chat-compose"]').waitFor();
  await page.getByRole('textbox', { name: 'Recipient agent name', exact: true }).fill('Researcher');
  await page
    .getByRole('textbox', { name: 'Message from the user', exact: true })
    .fill('The review is complete. I will send the next results here.');
  assert.equal(
    (await page.evaluate(() => window.interconnect.invoke('snapshot'))).nodeLabel,
    'Demo node',
  );
  await mkdir('docs/assets', { recursive: true });
  await page.screenshot({ path: 'docs/assets/app-preview.png', animations: 'disabled' });
  console.log('Captured docs/assets/app-preview.png with isolated synthetic data.');
} finally {
  for (const client of clients) await client.close();
  if (app) await app.close();
  await rm(temporary, { recursive: true, force: true });
}

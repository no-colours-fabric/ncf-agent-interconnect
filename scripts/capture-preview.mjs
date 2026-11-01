import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const require = createRequire(import.meta.url);
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ncf-preview-'));
let app;
const clients = [];
try {
  const packaged = process.env.INTERCONNECT_TEST_EXECUTABLE;
  const launchEnv = { ...process.env, TZ: 'UTC' };
  delete launchEnv.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({
    executablePath: packaged ?? require('electron'),
    args: [...(packaged ? [] : [process.cwd()]), '--data-dir', temporary],
    cwd: temporary,
    env: launchEnv,
  });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 980));
  await page.getByText('Connect agents', { exact: true }).waitFor();
  await page.evaluate(() =>
    window.interconnect.invoke('saveNode', { nodeLabel: 'Demo node', listenHost: '127.0.0.1' }),
  );
  const settings = JSON.parse(await readFile(path.join(temporary, 'settings.json'), 'utf8'));
  const connect = async (nickname) => {
    const client = new Client({ name: 'MCP demo', version: '1' });
    clients.push(client);
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${settings.mcpPort}/mcp`), {
        requestInit: { headers: { authorization: 'Bearer ' + settings.localToken } },
      }),
    );
    const result = await client.callTool({ name: 'agent_connect', arguments: { nickname } });
    assert.equal(result.structuredContent.status, 'connected');
    return { client, connectionId: result.structuredContent.binding.connectionId };
  };
  const researcher = await connect('Researcher'),
    reviewer = await connect('Reviewer');
  const file = path.join(temporary, 'Files', 'review-checklist.md');
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
  await page.getByRole('button', { name: /^Reviewer/ }).click();
  await page
    .getByText(
      'Reviewed. Local messages work without remote peers, and the attachment matches its SHA-256 hash.',
      { exact: false },
    )
    .waitFor();
  await page.getByRole('button', { name: 'Open review-checklist.md', exact: true }).waitFor();
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

// Fixture sender for the isolated research runs: a separate standard-MCP agent that sends
// through NCF. It reads the app-owned local descriptor and never prints the token.
// Usage: node send.mjs <recipient> <text>
import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

// Resolve the MCP SDK from this repository checkout.
const require = createRequire(new URL('../../../package.json', import.meta.url));
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const {
  StreamableHTTPClientTransport,
} = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const descriptor = JSON.parse(await readFile(process.env.NCF_NODE_FILE, 'utf8'));
const [recipient, text] = process.argv.slice(2);
const client = new Client({ name: 'ncfcc-fixture-sender', version: '1' });
await client.connect(
  new StreamableHTTPClientTransport(new URL(descriptor.url), {
    requestInit: { headers: { authorization: 'Bearer ' + descriptor.token } },
  }),
);
const call = async (name, args) => {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw new Error(name + ': ' + JSON.stringify(result.content));
  return result.structuredContent;
};
// The binding of the first run is reused; a new chat would only see nickname_in_use.
const saved = path.join(path.dirname(new URL(import.meta.url).pathname), '.sender-connection');
let connectionId = await readFile(saved, 'utf8')
  .then((v) => v.trim())
  .catch(() => '');
if (!connectionId) {
  const connected = await call('agent_connect', { nickname: 'rr-Отправитель' });
  if (!connected.binding) throw new Error('connect: ' + connected.status);
  connectionId = connected.binding.connectionId;
  await writeFile(saved, connectionId, { mode: 0o600 });
}
const peers = await call('node_peers', {});
const sent = await call('agent_send', {
  connectionId,
  recipientNode: peers.localNode.id,
  recipientNickname: recipient,
  text,
});
console.log(JSON.stringify({ id: sent.id, delivery: sent.delivery, at: new Date().toISOString() }));
await client.close();

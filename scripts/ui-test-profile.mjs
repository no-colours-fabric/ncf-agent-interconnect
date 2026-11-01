import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';

export async function createUiProfile(directory, nodeLabel = 'Isolated interface check') {
  const files = path.join(directory, 'Files');
  await mkdir(files, { recursive: true, mode: 0o700 });
  // Ephemeral ports let a private test node run beside the working application.
  await writeFile(
    path.join(directory, 'settings.json'),
    JSON.stringify({
      version: 1,
      nodeId: randomUUID(),
      nodeLabel,
      localToken: randomBytes(32).toString('hex'),
      mcpPort: 0,
      peerPort: 0,
      listenHost: '127.0.0.1',
      exportRoots: [files],
      peers: [],
      adapters: [{ id: randomUUID(), kind: 'manual', label: 'Standard MCP' }],
    }),
    { mode: 0o600, flag: 'wx' },
  );
}

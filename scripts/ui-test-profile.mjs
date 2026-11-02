import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';

export async function createUiEnvironment(clientHome) {
  const environment = {
    ...process.env,
    HOME: clientHome,
    USERPROFILE: clientHome,
    CODEX_HOME: path.join(clientHome, '.codex'),
    XDG_CONFIG_HOME: path.join(clientHome, '.config'),
    OPENCODE_CONFIG: path.join(clientHome, '.config', 'opencode', 'opencode.json'),
    OPENCODE_CONFIG_DIR: path.join(clientHome, '.config', 'opencode'),
    APPDATA: path.join(clientHome, 'AppData', 'Roaming'),
    LOCALAPPDATA: path.join(clientHome, 'AppData', 'Local'),
  };
  delete environment.ELECTRON_RUN_AS_NODE;
  delete environment.OPENCODE_CONFIG_CONTENT;
  await Promise.all(
    [
      clientHome,
      environment.CODEX_HOME,
      environment.OPENCODE_CONFIG_DIR,
      environment.APPDATA,
      environment.LOCALAPPDATA,
    ].map((directory) => mkdir(directory, { recursive: true, mode: 0o700 })),
  );
  return environment;
}

export function uiClientConfigPaths(environment) {
  return [
    path.join(environment.HOME, '.cursor', 'mcp.json'),
    environment.OPENCODE_CONFIG,
    path.join(environment.OPENCODE_CONFIG_DIR, 'opencode.jsonc'),
    path.join(environment.CODEX_HOME, 'config.toml'),
  ];
}

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

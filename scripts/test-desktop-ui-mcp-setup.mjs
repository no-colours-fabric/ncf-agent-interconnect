import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { _electron as electron } from 'playwright';
import { parse as parseJson } from 'jsonc-parser';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { createUiProfile } from './ui-test-profile.mjs';

// Run after building the integrated source checkout:
// node scripts/test-desktop-ui-mcp-setup.mjs
// No client/agent is launched or contacted. The picker and OS file-opening UI are not exercised.
const require = createRequire(import.meta.url);
const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(await readFile(path.join(repository, 'package.json'), 'utf8'));
const mainEntry = path.resolve(repository, manifest.main);
await access(mainEntry).catch(() => {
  throw new Error(
    'Build the integrated application before running the MCP setup Electron scenario',
  );
});

const temporary = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ncf-electron-mcp-setup-')));
const clientHome = path.join(temporary, 'client-home');
const nodeData = path.join(temporary, 'node-data');
const appData = path.join(temporary, 'app-data');
const configHome = path.join(clientHome, '.config');
const codexHome = path.join(clientHome, '.codex');
const openCodeConfig = path.join(configHome, 'opencode', 'opencode.jsonc');
const rememberedFile = path.join(nodeData, 'mcp-setup-paths.json');
const bootstrap = path.join(temporary, 'isolated-electron.cjs');
const clients = [
  {
    id: 'cursor',
    label: 'Cursor',
    defaultFile: path.join(clientHome, '.cursor', 'mcp.json'),
    name: 'cursor.json',
    scope: 'mcpServers',
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    defaultFile: openCodeConfig,
    name: 'opencode.jsonc',
    scope: 'mcp',
  },
  {
    id: 'codex',
    label: 'Codex',
    defaultFile: path.join(codexHome, 'config.toml'),
    name: 'custom-profile.config.toml',
    scope: 'mcp_servers',
  },
].map((client) => ({
  ...client,
  selectedFile: path.join(temporary, 'selected configurations', 'профиль 漢字', client.name),
}));
const original = (client) =>
  client.id === 'codex'
    ? '# Keep this unrelated setting.\nmodel = "fixture-keep-codex"\n'
    : JSON.stringify(
        {
          fixture: 'keep-' + client.id,
          ...(client.id === 'opencode' ? { plugin: ['fixture-keep-plugin'] } : {}),
        },
        null,
        2,
      ) + '\n';

let application;
let page;
let phase = 'prepare isolated paths';
const pageErrors = [];
const pathsEqual = (a, b) =>
  process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

function assertTemporary(filename) {
  const relative = path.relative(temporary, path.resolve(filename));
  assert.ok(
    relative &&
      relative !== '..' &&
      !relative.startsWith('..' + path.sep) &&
      !path.isAbsolute(relative),
    'All application and client paths must stay inside the test directory',
  );
}

async function fingerprint(filename, includeSiblings = true) {
  assertTemporary(filename);
  const [bytes, info] = await Promise.all([readFile(filename), stat(filename, { bigint: true })]);
  return {
    hash: createHash('sha256').update(bytes).digest('hex'),
    inode: info.ino.toString(),
    modified: info.mtimeNs.toString(),
    changed: info.ctimeNs.toString(),
    ...(includeSiblings ? { siblings: (await readdir(path.dirname(filename))).sort() } : {}),
  };
}

async function assertNoConfigurationUi() {
  assert.equal(
    await page.locator('pre, textarea, [contenteditable="true"]').count(),
    0,
    'Configuration viewers and editors must be absent',
  );
  assert.equal(
    await page
      .getByRole('button', { name: /Copy configuration|Manual configuration|Review changes/i })
      .count(),
    0,
  );
  const body = await page.locator('body').innerText();
  assert.ok(
    !body.includes('fixture-keep-'),
    'Unrelated configuration contents must not reach the UI',
  );
  assert.ok(
    !body.includes('"mcpServers"') && !body.includes('[mcp_servers.'),
    'MCP configuration fragments must not reach the UI',
  );
  const { localToken } = JSON.parse(await readFile(path.join(nodeData, 'settings.json'), 'utf8'));
  assert.ok(!body.includes(localToken), 'The isolated node credential must not be displayed');
}

async function waitForApply() {
  await page.waitForFunction(
    () => {
      const button = document.querySelector('[data-testid="mcp-apply"]');
      return button && !button.disabled;
    },
    null,
    { timeout: 15000 },
  );
}

async function selectClient(client) {
  await page.getByRole('tab', { name: client.label, exact: true }).click();
  await page.getByTestId('mcp-configure-' + client.id).waitFor();
}

async function openSetup(client, filename) {
  await selectClient(client);
  await page.getByTestId('mcp-configure-' + client.id).click();
  const dialog = page.getByRole('dialog');
  await waitForApply();
  const input = dialog.getByTestId('mcp-path-configuration');
  if (filename) {
    assertTemporary(filename);
    await input.fill(filename);
    await waitForApply();
  }
  assert.equal(
    await dialog.locator('input:not([type="hidden"]), textarea').count(),
    1,
    'Only the file path is editable',
  );
  await assertNoConfigurationUi();
  return dialog;
}

async function launch() {
  const launchEnv = {
    ...process.env,
    HOME: clientHome,
    USERPROFILE: clientHome,
    APPDATA: appData,
    LOCALAPPDATA: path.join(temporary, 'local-app-data'),
    XDG_CONFIG_HOME: configHome,
    XDG_DATA_HOME: path.join(temporary, 'xdg-data'),
    XDG_CACHE_HOME: path.join(temporary, 'xdg-cache'),
    XDG_STATE_HOME: path.join(temporary, 'xdg-state'),
    CODEX_HOME: codexHome,
    OPENCODE_CONFIG: openCodeConfig,
    OPENCODE_CONFIG_DIR: path.join(configHome, 'opencode'),
  };
  delete launchEnv.ELECTRON_RUN_AS_NODE;
  delete launchEnv.OPENCODE_CONFIG_CONTENT;
  if (process.platform === 'win32') {
    launchEnv.HOMEDRIVE = path.parse(clientHome).root.slice(0, 2);
    launchEnv.HOMEPATH = clientHome.slice(2);
  }
  application = await electron.launch({
    executablePath: require('electron'),
    args: [bootstrap, '--data-dir', nodeData],
    cwd: temporary,
    env: launchEnv,
    timeout: 30000,
  });
  page = await application.firstWindow();
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.getByRole('button', { name: 'MCP setup', exact: true }).click();
  await page.getByRole('tab', { name: 'Cursor', exact: true }).waitFor();
  assert.equal(await page.getByRole('tab').count(), 5);
  // The sidebar language selector is outside the MCP setup card.
  const setupCard = page.getByRole('tabpanel').locator('..');
  assert.equal(await setupCard.getByRole('combobox').count(), 0);
  // Read-only bridge calls also confirm that the real app is using the isolated profile.
  const snapshot = await page.evaluate(() => window.interconnect.invoke('snapshot'));
  assert.equal(snapshot.peers.length, 0);
  assert.equal(snapshot.agents.length, 0);
  const boundaries = await application.evaluate(({ app }) => ({
    home: app.getPath('home'),
    data: app.getPath('userData'),
    appData: app.getPath('appData'),
  }));
  assert.ok(pathsEqual(boundaries.home, clientHome));
  assert.ok(pathsEqual(boundaries.data, nodeData));
  assert.ok(pathsEqual(boundaries.appData, appData));
  await assertNoConfigurationUi();
  await page.getByRole('tab', { name: 'AionUi', exact: true }).click();
  const aionSetup = page.getByTestId('aionui-setup');
  await aionSetup.getByText('Not paired', { exact: true }).waitFor();
  assert.equal(await aionSetup.getByTestId('mcp-open-file').count(), 1);
  await page.getByTestId('aionui-configure-access').click();
  const accessDialog = page.getByRole('dialog');
  assert.equal(
    await accessDialog.getByLabel('Pairing code', { exact: true }).getAttribute('type'),
    'password',
  );
  await accessDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await assertNoConfigurationUi();
  await page.getByRole('tab', { name: 'Cursor', exact: true }).click();
  await assertNoConfigurationUi();
}

try {
  for (const directory of [
    clientHome,
    nodeData,
    appData,
    path.join(temporary, 'local-app-data'),
    path.join(temporary, 'logs'),
  ])
    await mkdir(directory, { recursive: true });
  await createUiProfile(nodeData, 'Isolated MCP setup Electron check');
  for (const client of clients) {
    for (const filename of [client.defaultFile, client.selectedFile]) {
      assertTemporary(filename);
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(filename, original(client), { mode: 0o600, flag: 'wx' });
    }
  }
  // Isolation is established and asserted before importing any application code.
  // The actual built main, preload, renderer and setup handler remain unmodified.
  await writeFile(
    bootstrap,
    `
    const { app } = require('electron');
    const os = require('node:os');
    const path = require('node:path');
    const isolatedHome = ${JSON.stringify(clientHome)};
    const normalize = (value) => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
    if (normalize(os.homedir()) !== normalize(isolatedHome)) throw new Error('The Electron test home is not isolated');
    app.setPath('home', isolatedHome);
    app.setPath('appData', ${JSON.stringify(appData)});
    app.setPath('userData', ${JSON.stringify(nodeData)});
    app.setPath('logs', ${JSON.stringify(path.join(temporary, 'logs'))});
    import(${JSON.stringify(pathToFileURL(mainEntry).href)}).catch(() => { process.exitCode = 1; app.quit(); });
  `,
    { mode: 0o600, flag: 'wx' },
  );

  const defaultBefore = await Promise.all(clients.map((client) => fingerprint(client.defaultFile)));
  phase = 'launch the built application';
  await launch();
  assert.deepEqual(
    await Promise.all(clients.map((client) => fingerprint(client.defaultFile))),
    defaultBefore,
    'Initial startup checks must be read-only',
  );

  for (const client of clients) {
    phase = client.id + ': cancel an existing file';
    const selectedBefore = await fingerprint(client.selectedFile);
    let dialog = await openSetup(client, client.selectedFile);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual(
      await fingerprint(client.selectedFile),
      selectedBefore,
      'Cancel must leave the selected file untouched',
    );

    phase = client.id + ': cancel a missing file';
    const missing = path.join(temporary, 'never-created-' + client.id, client.name);
    dialog = await openSetup(client, missing);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await assert.rejects(access(path.dirname(missing)), { code: 'ENOENT' });

    phase = client.id + ': apply through renderer and IPC';
    dialog = await openSetup(client, client.selectedFile);
    await dialog.getByTestId('mcp-apply').click();
    await dialog.getByText('Setup applied.', { exact: true }).waitFor();
    await assertNoConfigurationUi();
    const text = await readFile(client.selectedFile, 'utf8');
    const config = client.id === 'codex' ? parseToml(text) : parseJson(text);
    const server = config[client.scope].ncf_agent_interconnect;
    const snapshot = await page.evaluate(() => window.interconnect.invoke('snapshot'));
    const settings = JSON.parse(await readFile(path.join(nodeData, 'settings.json'), 'utf8'));
    assert.ok(
      server.url === snapshot.mcpUrl,
      'The selected file must reference this isolated node',
    );
    const headers = client.id === 'codex' ? server.http_headers : server.headers;
    assert.ok(
      headers.Authorization === 'Bearer ' + settings.localToken,
      'The selected file must contain this isolated node credential',
    );
    if (client.id === 'codex') assert.equal(config.model, 'fixture-keep-codex');
    else assert.equal(config.fixture, 'keep-' + client.id);
    if (client.id === 'opencode') {
      assert.deepEqual(config.plugin, [
        'fixture-keep-plugin',
        pathToFileURL(path.join(nodeData, 'Integrations', 'opencode.js')).href,
      ]);
      assert.equal(server.oauth, false);
      assert.equal(server.enabled, true);
    }
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page
      .getByTestId('mcp-settings-status')
      .filter({ hasText: 'Settings are present' })
      .waitFor();
    const saved = JSON.parse(await readFile(rememberedFile, 'utf8'));
    assert.ok(pathsEqual(saved.paths[client.id], client.selectedFile));
    assert.deepEqual(Object.keys(saved).sort(), ['paths', 'version']);

    phase = client.id + ': repeat without rewriting';
    const beforeRepeat = await fingerprint(client.selectedFile);
    const rememberedBefore = await fingerprint(rememberedFile, false);
    dialog = await openSetup(client);
    assert.ok(
      pathsEqual(
        await dialog.getByTestId('mcp-path-configuration').inputValue(),
        client.selectedFile,
      ),
    );
    await dialog
      .getByText('These settings are already present. No changes are needed.', { exact: true })
      .waitFor();
    await dialog.getByTestId('mcp-apply').click();
    await dialog
      .getByText('Settings are already present. Nothing was changed.', { exact: true })
      .waitFor();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    assert.deepEqual(
      await fingerprint(client.selectedFile),
      beforeRepeat,
      'Repeated Apply must not replace or rewrite an already configured file',
    );
    assert.deepEqual(
      await fingerprint(rememberedFile, false),
      rememberedBefore,
      'Repeated Apply must not rewrite the same remembered path',
    );
  }

  phase = 'restart without changing client files';
  const beforeRestart = await Promise.all(
    clients.map((client) => fingerprint(client.selectedFile)),
  );
  const rememberedBeforeRestart = await fingerprint(rememberedFile, false);
  await application.close();
  application = undefined;
  await launch();
  for (const client of clients) {
    await selectClient(client);
    await page
      .getByTestId('mcp-settings-status')
      .filter({ hasText: 'Settings are present' })
      .waitFor();
    const status = await page.evaluate(
      (id) => window.interconnect.invoke('mcpSetupStatus', { client: id }),
      client.id,
    );
    assert.equal(status.state, 'configured');
    assert.equal(status.remembered, true);
    assert.ok(pathsEqual(status.files[0].path, client.selectedFile));
    assert.equal(
      await page.getByRole('button', { name: 'Open configuration file', exact: true }).count(),
      1,
    );
    await assertNoConfigurationUi();
  }
  assert.deepEqual(
    await Promise.all(clients.map((client) => fingerprint(client.selectedFile))),
    beforeRestart,
    'Startup/status checks must not write client files',
  );
  assert.deepEqual(await fingerprint(rememberedFile, false), rememberedBeforeRestart);
  assert.deepEqual(
    await Promise.all(clients.map((client) => fingerprint(client.defaultFile))),
    defaultBefore,
    'The other temporary client configurations must stay untouched',
  );
  assert.equal(pageErrors.length, 0, 'The real renderer must complete without JavaScript errors');
  console.log(
    JSON.stringify({
      electronRendererIpcSetup: true,
      clientTabs: 4,
      fileSetupTabs: 4,
      aionUiOwnerSetup: true,
      cancelExistingAndMissingFiles: true,
      applyUsesSelectedFile: true,
      repeatedApplyDoesNotRewrite: true,
      rememberedPathsAfterProcessRestart: true,
      startupChecksAreReadOnly: true,
      noFileConfigurationViewerOrEditor: true,
      allNodeAndClientPathsTemporary: true,
      nativePicker: 'not exercised; requires a separate native check',
      systemFileOpening: 'icon presence only; requires a separate native check',
      packagedApplication: 'not exercised; this scenario uses the integrated source build',
    }),
  );
} catch (error) {
  console.error('MCP setup Electron scenario failed during: ' + phase);
  throw error;
} finally {
  try {
    await application?.close();
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

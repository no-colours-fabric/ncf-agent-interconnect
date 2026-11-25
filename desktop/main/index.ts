import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  ipcMain,
  dialog,
  shell,
  clipboard,
} from 'electron';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import { mkdir, copyFile, appendFile } from 'node:fs/promises';
import { z } from 'zod';
import { NodeService } from '../core/service.js';
import { defaultMessageDisplayContext } from '../core/message-presentation.js';
import { wakeStockChat } from './codex-chat-wake.js';
import {
  macChatWake,
  runningMacCodexConfiguration,
  watchMacChatLaunches,
} from './codex-shortcut-mac.js';
import { StartupLifecycle } from './startup-lifecycle.js';
import { PairingApprovalWindow } from './pairing-approval-window.js';
import { LanSearchLifecycle } from './lan-search-lifecycle.js';
import { createMcpSetupHandler } from './mcp-setup-ipc.js';
import {
  createApplicationDiscoveryHandler,
  createNativeDiscoveryFiles,
} from './application-discovery-ipc.js';
import { detectChatgptCompatibility } from './chatgpt-version.js';
import { isChatgptReleaseUrl } from '../shared/chatgpt-compatibility.js';
import { UiServiceAccess } from './ui-service-access.js';
import { hasCodexShortcutLaunchFlags } from '../shared/codex-shortcut.js';
import { pendingInstallationRestartNotice } from './installation-restart-notice.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(1);
const windowsShortcutLaunch = process.platform === 'win32' && hasCodexShortcutLaunchFlags(args);
const dataArg = args.indexOf('--data-dir');
const alternateUserData = dataArg >= 0 ? args[dataArg + 1] : undefined;
if (!windowsShortcutLaunch && alternateUserData)
  app.setPath('userData', path.resolve(alternateUserData));
app.setName('NCF Agent Interconnect');
const runningCodexConfiguration =
  process.platform === 'darwin' && !alternateUserData
    ? () =>
        runningMacCodexConfiguration(app.getAppPath(), app.getPath('home'), app.getPath('appData'))
    : undefined;
let window: BrowserWindow | null = null,
  tray: Tray | null = null,
  service: NodeService | null = null,
  quitting = false;
let opening: Promise<void> | null = null;
let pairingApprovalWindow: PairingApprovalWindow | undefined;
let acknowledgeInstallationRestart: (() => Promise<void>) | null = null;
let installationRestartRecording: Promise<void> | undefined;
const startup = new StartupLifecycle(showWindow);
const lanSearchLifecycle = new LanSearchLifecycle(async (isCurrent) => {
  const active = service,
    owner = window;
  await opening;
  if (
    !isCurrent() ||
    quitting ||
    !active?.running ||
    service !== active ||
    !owner ||
    window !== owner ||
    !isWindowVisible()
  )
    return;
  await active.userCall('startLanSearch', {});
});
if (windowsShortcutLaunch) {
  // Shortcut arguments never start the hub or redirect to an alternate userData.
  if (!app.isPackaged) app.exit(1);
  else {
    void app
      .whenReady()
      .then(async () => {
        const { launchWindowsCodexFromArgs } = await import('./codex-shortcut-windows.js');
        const outcome = await launchWindowsCodexFromArgs(args, {
          userData: app.getPath('userData'),
          appExecutable: process.execPath,
          appPath: app.getAppPath(),
        });
        app.exit(outcome === 'launched' ? 0 : 1);
      })
      .catch(() => app.exit(1));
  }
} else if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => show());
  app.on('activate', () => show());
  app.on('window-all-closed', () => {});
  app.on('before-quit', (event) => {
    if (quitting) return;
    event.preventDefault();
    quitting = true;
    startup.stop();
    lanSearchLifecycle.close();
    pairingApprovalWindow?.close();
    void Promise.resolve(opening)
      .then(
        () => service?.close(),
        () => {},
      )
      .then(() => installationRestartRecording)
      .finally(() => {
        tray?.destroy();
        app.quit();
      });
  });
  void app
    .whenReady()
    .then(async () => {
      if (quitting) return;
      const data = app.getPath('userData');
      await mkdir(data, { recursive: true, mode: 0o700 });
      if (app.isPackaged) {
        acknowledgeInstallationRestart = await Promise.resolve()
          .then(() => {
            const originalFs = createRequire(import.meta.url)(
              'original-fs',
            ) as typeof import('node:fs');
            return pendingInstallationRestartNotice(
              data,
              app.getAppPath(),
              originalFs.promises.stat,
            );
          })
          .catch(() => null);
      }
      if (quitting) return;
      const image = nativeImage
        .createFromPath(
          path.join(
            directory,
            process.platform === 'darwin' ? '../assets/trayTemplate.png' : '../assets/icon.png',
          ),
        )
        .resize({ width: 22, height: 22 });
      if (process.platform === 'darwin') image.setTemplateImage(true);
      tray = new Tray(image);
      tray.setToolTip('NCF Agent Interconnect — messaging node');
      service = new NodeService(data, {
        messageDisplayContext: () => defaultMessageDisplayContext(app.getSystemLocale()),
        runningCodexConfiguration,
        wakeCodexChat: alternateUserData
          ? undefined
          : process.platform === 'darwin'
            ? macChatWake(app.getAppPath(), app.getPath('home'), app.getPath('appData'))
            : ['win32', 'linux'].includes(process.platform)
              ? wakeStockChat
              : undefined,
        lanDiscovery: process.env.NCF_DISABLE_LAN_DISCOVERY === '1' ? undefined : {},
      });
      service.on('change', () => {
        pairingApprovalWindow?.sync();
        updateTray();
        window?.webContents.send('interconnect:change');
      });
      if (process.platform === 'darwin' && !alternateUserData) {
        const stopWatching = watchMacChatLaunches(app.getAppPath(), () =>
          service?.desktopChatGptLaunched(),
        );
        app.once('before-quit', stopWatching);
      }
      await startup.start(
        () => (opening = service!.open()),
        () => {
          updateTray();
          setupIpc();
        },
        !process.argv.includes('--background') && !app.getLoginItemSettings().wasOpenedAtLogin,
      );
    })
    .catch(async (e) => {
      startup.stop();
      lanSearchLifecycle.close();
      if (quitting) return;
      quitting = true;
      const message = (e as Error).stack ?? String(e);
      await appendFile(
        path.join(app.getPath('userData'), 'startup-error.log'),
        message + '\n',
      ).catch(() => {});
      dialog.showErrorBox('NCF Agent Interconnect', (e as Error).message);
      app.quit();
    });
}
function updateTray(): void {
  if (quitting || !service || !tray) return;
  const state = service.snapshot(),
    unread = state.agents.reduce((sum, c) => sum + c.unread, 0);
  tray.setToolTip(
    `NCF Agent Interconnect — ${state.running ? 'running' : 'stopped'}${unread ? `, new messages: ${unread}` : ''}`,
  );
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: state.running ? 'Node running' : 'Node stopped', enabled: false },
      { label: 'Open app', click: () => show() },
      { label: 'Settings and MCP setup', click: () => show('settings') },
      {
        label: state.running ? 'Stop messaging' : 'Start messaging',
        click: () => {
          void service!
            .userCall(state.running ? 'stop' : 'start')
            .catch((e) => dialog.showErrorBox('Messaging node', (e as Error).message));
        },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]),
  );
  tray.removeAllListeners('double-click');
  tray.on('double-click', () => show());
  if (process.platform === 'darwin') {
    tray.removeAllListeners('click');
    tray.on('click', () => show());
  }
}
function show(tab?: string): void {
  startup.requestOpen(tab);
}
function isWindowVisible(): boolean {
  return !!window && !window.isDestroyed() && window.isVisible() && !window.isMinimized();
}
function windowVisibilityChanged(): void {
  if (quitting) return;
  lanSearchLifecycle.setVisible(isWindowVisible());
  if (window && !window.isDestroyed()) window.webContents.send('interconnect:change');
}
function showWindow(tab?: string): void {
  if (quitting || !service) return;
  if (window && !window.isDestroyed()) {
    window.show();
    window.focus();
    if (tab) window.webContents.send('interconnect:navigate', tab);
    return;
  }
  window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    title: 'NCF Agent Interconnect',
    backgroundColor: '#f5f7fa',
    show: false,
    webPreferences: {
      preload: path.join(directory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  const owner = window;
  const visibilityChanged = () => {
    if (window === owner) windowVisibilityChanged();
  };
  owner.on('show', visibilityChanged);
  owner.on('hide', visibilityChanged);
  owner.on('minimize', visibilityChanged);
  owner.on('restore', visibilityChanged);
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isChatgptReleaseUrl(url, process.platform)) void shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      window?.hide();
    }
  });
  window.on('closed', () => {
    if (window !== owner) return;
    window = null;
    windowVisibilityChanged();
  });
  window.once('ready-to-show', () => {
    if (!quitting) window?.show();
  });
  void window.loadFile(path.join(directory, '../renderer/index.html'), { hash: tab ?? '' });
}
function setupIpc(): void {
  pairingApprovalWindow = new PairingApprovalWindow({
    preload: path.join(directory, 'preload.cjs'),
    renderer: path.join(directory, '../renderer/index.html'),
    next: () => (!quitting && service?.running ? service.network.approvalHost.next() : undefined),
    displayed: (id) => !!service?.running && service.network.approvalHost.displayed(id),
    decide: async (id, decision) => {
      if (service?.running) await service.network.approvalHost.decide(id, decision);
    },
  });
  pairingApprovalWindow.sync();
  const userData = app.getPath('userData');
  const access = new UiServiceAccess(
    () => service,
    () => quitting,
  );
  const mcpSetup = createMcpSetupHandler({
    runningCodexConfiguration,
    instructions: (client) => access.current().clientInstructions(client),
    dialog,
    window: () => window,
    stateDirectory: userData,
    openPath: (filename) => shell.openPath(filename),
    codexShortcut: {
      platform: process.platform,
      installed: app.isPackaged,
      alternateUserData: !!alternateUserData,
      userData,
      appExecutable: process.execPath,
      appPath: app.getAppPath(),
      appData: app.getPath('appData'),
      home: app.getPath('home'),
      desktop: app.getPath('desktop'),
      boundProfiles: () => {
        const node = access.current();
        const profiles = node.settings.value.adapters;
        return node.store.list().flatMap(({ binding }) => {
          if (binding?.client !== 'Codex') return [];
          const profile = profiles.find(
            (item) =>
              item.id === binding.adapterId &&
              item.kind === 'codex-desktop' &&
              item.threadId === binding.chatId,
          );
          return [profile ?? {}];
        });
      },
      reveal: (filename) => shell.showItemInFolder(filename),
      dialog,
    },
  });
  const discoveryFiles = createNativeDiscoveryFiles();
  const applicationDiscovery = createApplicationDiscoveryHandler({
    files: discoveryFiles,
    chatgptCompatibility: (installs) =>
      detectChatgptCompatibility(discoveryFiles, process.platform, installs),
    dialog,
    window: () => window,
    stateDirectory: userData,
  });
  ipcMain.handle('interconnect:call', async (event, method: unknown, raw: unknown) => {
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      typeof method !== 'string'
    )
      throw new Error('Invalid operation source');
    if (method === 'windowState') {
      access.current();
      z.object({}).strict().parse(raw);
      return {
        visible: isWindowVisible(),
        installationRestartPending: acknowledgeInstallationRestart !== null,
      };
    }
    if (method === 'acknowledgeInstallationRestart') {
      z.object({}).strict().parse(raw);
      const acknowledge = acknowledgeInstallationRestart;
      if (acknowledge) {
        installationRestartRecording ??= acknowledge().catch(() => {});
        await installationRestartRecording;
        acknowledgeInstallationRestart = null;
      }
      return { acknowledged: true };
    }
    const discoveryResult = await applicationDiscovery(method, raw, String(event.sender.id));
    if (discoveryResult.handled) return discoveryResult.result;
    const setupResult = await access.waitFor(() => mcpSetup(method, raw, String(event.sender.id)));
    if (setupResult.handled) return setupResult.result;
    if (method === 'appVersion') return app.getVersion();
    if (method === 'copy') {
      const { text } = z.object({ text: z.string().max(100000) }).parse(raw);
      clipboard.writeText(text);
      return { copied: true };
    }
    if (method === 'loginState')
      return { supported: app.isPackaged, openAtLogin: app.getLoginItemSettings().openAtLogin };
    if (method === 'setLogin') {
      const { enabled } = z.object({ enabled: z.boolean() }).parse(raw);
      if (!app.isPackaged) throw new Error('Start at login is available after installing the app');
      app.setLoginItemSettings({ openAtLogin: enabled, args: ['--background'] });
      return { openAtLogin: app.getLoginItemSettings().openAtLogin };
    }
    if (method === 'pickExportFolder') {
      const exportWindow = window;
      const result = await access.waitFor(() =>
        dialog.showOpenDialog(exportWindow, {
          properties: ['openDirectory', 'createDirectory'],
        }),
      );
      if (result.canceled) return null;
      return access.current().userCall('exportRoots', { add: result.filePaths });
    }
    if (method === 'removeExportFolder') {
      const { folder } = z
        .object({ folder: z.string().min(1) })
        .strict()
        .parse(raw);
      return access.current().userCall('exportRoots', { remove: folder });
    }
    if (method === 'openAttachment' || method === 'saveAttachment') {
      const { messageId, fileId, direction } = z
        .object({
          messageId: z.uuid(),
          fileId: z.string().regex(/^[a-f0-9]{64}$/),
          direction: z.enum(['in', 'out']).optional(),
        })
        .parse(raw);
      const attachmentWindow = window;
      return access.current().withUserAttachment(
        messageId,
        fileId,
        async (file, local, assertCurrent) => {
          access.current();
          if (method === 'openAttachment') {
            assertCurrent();
            const error = await shell.openPath(local);
            if (error) throw new Error(error);
            return { opened: true };
          }
          const destination = await access.waitFor(() =>
            dialog.showSaveDialog(attachmentWindow, {
              defaultPath: file.name,
            }),
          );
          if (destination.filePath) {
            assertCurrent();
            await copyFile(local, destination.filePath);
          }
          return { saved: !!destination.filePath };
        },
        direction,
      );
    }
    if (
      ![
        'aionUiStatus',
        'aionUiInstructions',
        'aionUiPair',
        'aionUiCancelPair',
        'aionUiDisconnect',
        'snapshot',
        'startLanSearch',
        'stopLanSearch',
        'ackLanSearch',
        'history',
        'chatHistory',
        'instructions',
        'accessCode',
        'connectPeer',
        'removePeer',
        'requestPeerApproval',
        'peerApprovalProgress',
        'cancelPeerApproval',
        'confirmPeerApproval',
        'registerAgent',
        'renameAgent',
        'clearAgents',
        'saveAttachmentLimit',
        'receivedAttachmentUsage',
        'removeReceivedAttachments',
        'saveNode',
        'stop',
        'start',
        'send',
      ].includes(method)
    )
      throw new Error('This operation is not allowed by the interface');
    if (method === 'startLanSearch' || method === 'stopLanSearch') {
      z.object({}).strict().parse(raw);
      lanSearchLifecycle.supersede();
    }
    return access.current().userCall(method, raw, { requesterSession: String(event.sender.id) });
  });
}

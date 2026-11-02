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
import path from 'node:path';
import { mkdir, copyFile, appendFile } from 'node:fs/promises';
import { z } from 'zod';
import { NodeService } from '../core/service.js';
import { StartupLifecycle } from './startup-lifecycle.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const dataArg = process.argv.indexOf('--data-dir');
if (dataArg >= 0 && process.argv[dataArg + 1])
  app.setPath('userData', path.resolve(process.argv[dataArg + 1]));
app.setName('NCF Agent Interconnect');
let window: BrowserWindow | null = null,
  tray: Tray | null = null,
  service: NodeService | null = null,
  quitting = false;
let opening: Promise<void> | null = null;
const startup = new StartupLifecycle(showWindow);
const single = app.requestSingleInstanceLock();
if (!single) app.quit();
else {
  app.on('second-instance', () => show());
  app.on('activate', () => show());
  app.on('window-all-closed', () => {});
  app.on('before-quit', (event) => {
    if (quitting) return;
    event.preventDefault();
    quitting = true;
    startup.stop();
    void Promise.resolve(opening)
      .then(
        () => service?.close(),
        () => {},
      )
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
      service = new NodeService(data);
      service.on('change', () => {
        updateTray();
        window?.webContents.send('interconnect:change');
      });
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
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      window?.hide();
    }
  });
  window.on('closed', () => {
    window = null;
  });
  window.once('ready-to-show', () => {
    if (!quitting) window?.show();
  });
  void window.loadFile(path.join(directory, '../renderer/index.html'), { hash: tab ?? '' });
}
function setupIpc(): void {
  ipcMain.handle('interconnect:call', async (event, method: unknown, raw: unknown) => {
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      typeof method !== 'string'
    )
      throw new Error('Invalid operation source');
    if (!service) throw new Error('The node is not running');
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
      const result = await dialog.showOpenDialog(window, {
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result.canceled) return null;
      return service.userCall('exportRoots', {
        roots: [...new Set([...service.settings.value.exportRoots, ...result.filePaths])],
      });
    }
    if (method === 'openAttachment' || method === 'saveAttachment') {
      const { messageId, fileId } = z
        .object({ messageId: z.uuid(), fileId: z.string().regex(/^[a-f0-9]{64}$/) })
        .parse(raw);
      const attachmentWindow = window;
      return service.withUserAttachment(messageId, fileId, async (file, local, assertCurrent) => {
        if (method === 'openAttachment') {
          assertCurrent();
          const error = await shell.openPath(local);
          if (error) throw new Error(error);
          return { opened: true };
        }
        const destination = await dialog.showSaveDialog(attachmentWindow, {
          defaultPath: file.name,
        });
        if (destination.filePath) {
          assertCurrent();
          await copyFile(local, destination.filePath);
        }
        return { saved: !!destination.filePath };
      });
    }
    if (
      ![
        'snapshot',
        'history',
        'chatHistory',
        'instructions',
        'accessCode',
        'connectPeer',
        'registerAgent',
        'clearAgents',
        'saveNode',
        'stop',
        'start',
        'send',
      ].includes(method)
    )
      throw new Error('This operation is not allowed by the interface');
    return service.userCall(method, raw, { requesterSession: String(event.sender.id) });
  });
}

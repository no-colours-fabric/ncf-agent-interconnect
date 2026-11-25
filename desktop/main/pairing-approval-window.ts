import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';
import type { IncomingPairApproval, PairApprovalDecision } from '../shared/pairing-approval.js';

const action = z.enum(['view', 'ready', 'confirm', 'dismiss', 'suppress']);

export class PairingApprovalWindow {
  private current?: { request: IncomingPairApproval; window: BrowserWindow };

  constructor(
    private readonly options: {
      preload: string;
      renderer: string;
      next: () => IncomingPairApproval | undefined;
      displayed: (id: string) => boolean;
      decide: (id: string, decision: PairApprovalDecision) => Promise<void>;
    },
  ) {
    ipcMain.handle('interconnect:pair-approval-window', async (event, input: unknown) => {
      const current = this.current;
      if (
        !current ||
        event.sender !== current.window.webContents ||
        event.senderFrame !== current.window.webContents.mainFrame ||
        this.options.next()?.id !== current.request.id
      )
        throw new Error('Invalid connection approval source');

      const method = action.parse(input);
      if (method === 'view') return current.request;
      if (method === 'ready') {
        current.window.show();
        current.window.focus();
        if (current.window.isVisible()) this.options.displayed(current.request.id);
        return;
      }
      await this.options.decide(current.request.id, method);
    });
  }

  sync(): void {
    const next = this.options.next();
    if (next?.id === this.current?.request.id) return;
    this.close();
    if (!next) return;

    const window = new BrowserWindow({
      width: 490,
      height: 460,
      minWidth: 340,
      minHeight: 380,
      title: 'NCF Agent Interconnect',
      alwaysOnTop: true,
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: this.options.preload,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    const current = { request: next, window };
    this.current = current;
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event) => event.preventDefault());
    window.webContents.once('render-process-gone', () => {
      if (!window.isDestroyed()) window.destroy();
    });
    window.once('closed', () => {
      if (this.current !== current) return;
      this.current = undefined;
      void this.options
        .decide(next.id, 'dismiss')
        .then(() => this.sync())
        .catch(() => {});
    });
    void window.loadFile(this.options.renderer, { hash: 'pair-approval' }).catch(() => {
      if (!window.isDestroyed()) window.destroy();
    });
  }

  close(): void {
    const previous = this.current;
    this.current = undefined;
    if (previous && !previous.window.isDestroyed()) previous.window.destroy();
  }
}

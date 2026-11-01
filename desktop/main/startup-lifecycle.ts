export class StartupLifecycle {
  private phase: 'waiting' | 'starting' | 'ready' | 'stopped' = 'waiting';
  private pendingOpen = false;
  private pendingTab?: string;

  constructor(private readonly showWindow: (tab?: string) => void) {}

  requestOpen(tab?: string): void {
    if (this.phase === 'stopped') return;
    if (this.phase === 'ready') {
      this.showWindow(tab);
      return;
    }
    this.pendingOpen = true;
    if (tab !== undefined) this.pendingTab = tab;
  }

  async start(
    openService: () => Promise<void>,
    registerIpc: () => void,
    openByDefault: boolean,
  ): Promise<void> {
    if (this.phase !== 'waiting') return;
    this.phase = 'starting';
    try {
      await openService();
      if (this.phase !== 'starting') return;
      registerIpc();
      if (this.phase !== 'starting') return;
      const open = this.pendingOpen || openByDefault,
        tab = this.pendingTab;
      this.pendingOpen = false;
      this.pendingTab = undefined;
      this.phase = 'ready';
      if (open) this.showWindow(tab);
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  stop(): void {
    this.phase = 'stopped';
    this.pendingOpen = false;
    this.pendingTab = undefined;
  }
}

import type {
  McpSetupApplyResult,
  McpSetupClient,
  McpSetupDefaults,
  McpSetupFile,
  McpSetupInvoke,
  McpSetupPreview,
  McpSetupStatus,
} from '../shared/mcp-setup.js';

export interface McpSetupState {
  open: boolean;
  files: McpSetupFile[];
  busy: boolean;
  preview?: McpSetupPreview;
  result?: McpSetupApplyResult;
  error?: string;
  status?: McpSetupStatus;
}

/** Invalidates in-flight previews when paths, client, or dialog lifetime change. */
export class McpSetupFlow {
  private state: McpSetupState = { open: false, files: [], busy: false };
  private revision = 0;
  private statusRevision = 0;
  private listeners = new Set<() => void>();
  constructor(
    private readonly client: McpSetupClient,
    private readonly invoke: McpSetupInvoke,
  ) {}
  getSnapshot = (): McpSetupState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private set(value: Partial<McpSetupState>): void {
    this.state = { ...this.state, ...value };
    for (const listener of this.listeners) listener();
  }
  private discard(plan?: McpSetupPreview): void {
    if (plan) void this.invoke('mcpSetupDiscard', { planId: plan.planId }).catch(() => {});
  }
  async begin(): Promise<void> {
    const revision = ++this.revision;
    this.discard(this.state.preview);
    this.set({
      open: true,
      busy: true,
      files: [],
      preview: undefined,
      result: undefined,
      error: undefined,
    });
    try {
      const defaults = await this.invoke<McpSetupDefaults>('mcpSetupDefaults', {
        client: this.client,
      });
      if (revision === this.revision) {
        this.set({ files: defaults.files, busy: false });
        await this.review();
      }
    } catch (error) {
      if (revision === this.revision) this.set({ error: (error as Error).message });
    } finally {
      if (revision === this.revision) this.set({ busy: false });
    }
  }
  cancel(): void {
    if (this.state.busy) return;
    ++this.revision;
    this.discard(this.state.preview);
    this.set({ open: false, preview: undefined, result: undefined });
  }
  dispose(): void {
    ++this.revision;
    ++this.statusRevision;
    this.discard(this.state.preview);
  }
  setPath(id: string, path: string): void {
    if (this.state.busy || this.state.result) return;
    ++this.revision;
    this.discard(this.state.preview);
    this.set({
      files: this.state.files.map((file) => (file.id === id ? { ...file, path } : file)),
      preview: undefined,
      error: undefined,
    });
  }
  async refreshStatus(): Promise<void> {
    const revision = ++this.statusRevision;
    try {
      const status = await this.invoke<McpSetupStatus>('mcpSetupStatus', { client: this.client });
      if (revision === this.statusRevision) this.set({ status });
    } catch (error) {
      if (revision === this.statusRevision) this.set({ error: (error as Error).message });
    }
  }
  async openFile(): Promise<void> {
    try {
      await this.invoke('mcpSetupOpen', { client: this.client });
    } catch (error) {
      this.set({ error: (error as Error).message });
    }
  }
  async browse(id: string): Promise<void> {
    const file = this.state.files.find((item) => item.id === id);
    if (!file || this.state.busy) return;
    const revision = ++this.revision;
    this.set({ busy: true, error: undefined });
    try {
      const selected = await this.invoke<string | null>('mcpSetupBrowse', {
        client: this.client,
        path: file.path,
      });
      if (revision === this.revision && selected) {
        this.set({ busy: false });
        this.setPath(id, selected);
      }
    } catch (error) {
      if (revision === this.revision) this.set({ error: (error as Error).message });
    } finally {
      if (revision === this.revision) this.set({ busy: false });
    }
  }
  async review(): Promise<void> {
    if (this.state.busy || this.state.result || !this.state.files.length) return;
    const revision = ++this.revision;
    this.discard(this.state.preview);
    this.set({ busy: true, preview: undefined, error: undefined });
    try {
      const preview = await this.invoke<McpSetupPreview>('mcpSetupPreview', {
        client: this.client,
        files: this.state.files.map(({ id, path }) => ({ id, path })),
      });
      if (revision !== this.revision) this.discard(preview);
      else
        this.set({
          preview,
          files: this.state.files.map((file) => ({
            ...file,
            path: preview.files.find((item) => item.id === file.id)?.path ?? file.path,
          })),
        });
    } catch (error) {
      if (revision === this.revision) this.set({ error: (error as Error).message });
    } finally {
      if (revision === this.revision) this.set({ busy: false });
    }
  }
  async apply(): Promise<void> {
    const preview = this.state.preview;
    if (!preview || this.state.busy || this.state.result) return;
    const revision = ++this.revision;
    this.set({ busy: true, error: undefined });
    try {
      const result = await this.invoke<McpSetupApplyResult>('mcpSetupApply', {
        planId: preview.planId,
        confirmReplace: preview.requiresReplacement,
      });
      if (revision === this.revision) {
        this.set({ result });
        await this.refreshStatus();
      }
    } catch (error) {
      // Preserve the plan on transport uncertainty: retry uses the same operation ID.
      if (revision === this.revision) this.set({ error: (error as Error).message });
    } finally {
      if (revision === this.revision) this.set({ busy: false });
    }
  }
}

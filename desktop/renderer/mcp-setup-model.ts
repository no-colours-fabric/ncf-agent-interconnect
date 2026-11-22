import type {
  McpSetupApplyResult,
  McpSetupClient,
  McpSetupDefaults,
  McpSetupFile,
  McpSetupInvoke,
  McpSetupPreview,
  McpSetupStatus,
  McpSetupTarget,
} from '../shared/mcp-setup.js';
import { inspectSetupRetry } from './application-setup-model.js';

export interface McpSetupState {
  open: boolean;
  files: McpSetupFile[];
  busy: boolean;
  preview?: McpSetupPreview;
  result?: McpSetupApplyResult;
  error?: string;
  status?: McpSetupStatus;
  verified?: boolean;
  reviewRequired?: boolean;
  uncertain?: { preview: McpSetupPreview; files: McpSetupTarget[]; error: string };
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
    if (plan?.planId === this.state.uncertain?.preview.planId) return;
    if (plan) void this.invoke('mcpSetupDiscard', { planId: plan.planId }).catch(() => {});
  }
  async begin(): Promise<void> {
    if (this.state.busy) return;
    const revision = ++this.revision;
    const draft = this.state.files;
    const reviewRequired = !!this.state.uncertain || !!this.state.reviewRequired;
    this.discard(this.state.preview);
    this.set({
      open: true,
      busy: true,
      files: draft,
      preview: undefined,
      result: undefined,
      error: undefined,
      verified: false,
      reviewRequired,
    });
    try {
      const defaults = draft.length
        ? { files: draft }
        : await this.invoke<McpSetupDefaults>('mcpSetupDefaults', { client: this.client });
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
    this.set({ open: false, preview: undefined, result: undefined, verified: false });
  }
  dispose(): void {
    ++this.revision;
    ++this.statusRevision;
    this.discard(this.state.preview);
  }
  setPath(id: string, path: string): void {
    const file = this.state.files.find((item) => item.id === id);
    if (this.state.busy || !file || file.path === path) return;
    ++this.revision;
    this.discard(this.state.preview);
    this.set({
      files: this.state.files.map((file) => (file.id === id ? { ...file, path } : file)),
      preview: undefined,
      result: undefined,
      verified: false,
      error: undefined,
      reviewRequired: this.state.reviewRequired || !!this.state.uncertain,
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
    if (this.state.busy || this.state.result || this.state.verified || !this.state.files.length)
      return;
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
  async apply(confirmReplace = false): Promise<void> {
    const preview = this.state.preview;
    if (
      !preview ||
      this.state.busy ||
      this.state.result ||
      this.state.verified ||
      ((preview.requiresReplacement || this.state.reviewRequired) && !confirmReplace)
    )
      return;
    const revision = ++this.revision;
    this.set({ busy: true, error: undefined });
    try {
      const uncertain = this.state.uncertain;
      if (uncertain?.preview.planId === preview.planId) {
        const check = await inspectSetupRetry(this.invoke, this.client, uncertain.files, preview);
        if (revision !== this.revision) {
          this.discard(check.preview);
          return;
        }
        if (check.disposition === 'configured') {
          this.discard(check.preview);
          this.set({ verified: true, reviewRequired: false });
          await this.refreshStatus();
          return;
        }
        if (check.disposition === 'renewed') {
          this.set({ preview: check.preview, reviewRequired: true });
          return;
        }
        this.discard(check.preview);
      }
      const result = await this.invoke<McpSetupApplyResult | null>(
        this.client === 'codex' ? 'mcpSetupApplyChatGpt' : 'mcpSetupApply',
        { planId: preview.planId, confirmReplace: preview.requiresReplacement && confirmReplace },
      );
      if (!result) return;
      if (revision === this.revision) {
        this.set({ result, reviewRequired: result.status === 'failed' });
        await this.refreshStatus();
      }
    } catch (error) {
      // A new owner retry must inspect the selected target before using this operation again.
      if (revision === this.revision)
        this.set({
          error: (error as Error).message,
          uncertain: this.state.uncertain ?? {
            preview,
            files: this.state.files.map(({ id, path }) => ({ id, path })),
            error: (error as Error).message,
          },
        });
    } finally {
      if (revision === this.revision) this.set({ busy: false });
    }
  }
}

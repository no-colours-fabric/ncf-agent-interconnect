import {
  mcpSetupClients,
  type McpSetupApplyResult,
  type McpSetupClient,
  type McpSetupDefaults,
  type McpSetupInvoke,
  type McpSetupPreview,
  type McpSetupTarget,
} from '../shared/mcp-setup.js';

export interface ApplicationSetupState {
  phase:
    | 'idle'
    | 'preparing'
    | 'rechecking'
    | 'confirmation'
    | 'applying'
    | 'succeeded'
    | 'failed'
    | 'uncertain';
  target?: McpSetupTarget;
  preview?: McpSetupPreview;
  result?: McpSetupApplyResult;
  error?: string;
  uncertain?: { planId: string; error: string; preview: McpSetupPreview; target?: McpSetupTarget };
  renewed?: boolean;
  verified?: boolean;
}
export type ApplicationSetupStates = Record<McpSetupClient, ApplicationSetupState>;

/** Reads the selected file again. The guarded writer remains responsible for exact source stamps. */
export async function inspectSetupRetry(
  invoke: McpSetupInvoke,
  client: McpSetupClient,
  files: McpSetupTarget[],
  original: McpSetupPreview,
): Promise<{ preview: McpSetupPreview; disposition: 'configured' | 'same' | 'renewed' }> {
  const preview = await invoke<McpSetupPreview>('mcpSetupPreview', { client, files });
  if (
    preview.client !== client ||
    !preview.planId ||
    !preview.files.some((file) => file.id === 'configuration')
  ) {
    if (preview.planId) void invoke('mcpSetupDiscard', { planId: preview.planId }).catch(() => {});
    throw new Error('The current setup target could not be verified');
  }
  const projection = (value: McpSetupPreview) =>
    JSON.stringify({
      client: value.client,
      requiresReplacement: value.requiresReplacement,
      files: value.files.map(({ id, path, action, changes }) => ({ id, path, action, changes })),
    });
  const sameTarget =
    preview.files.find((file) => file.id === 'configuration')!.path ===
    original.files.find((file) => file.id === 'configuration')?.path;
  return {
    preview,
    disposition:
      sameTarget &&
      !preview.requiresReplacement &&
      preview.files.every((file) => file.action === 'unchanged')
        ? 'configured'
        : sameTarget &&
            projection(preview) === projection(original) &&
            Date.parse(original.expiresAt) > Date.now()
          ? 'same'
          : 'renewed',
  };
}

/** A click prepares and applies one existing client target; mounting never writes configuration. */
export class ApplicationSetupFlow {
  private states = Object.fromEntries(
    mcpSetupClients.map((client) => [client, { phase: 'idle' }]),
  ) as ApplicationSetupStates;
  private listeners = new Set<() => void>();
  private disposed = false;

  constructor(
    private readonly invoke: McpSetupInvoke,
    private readonly onApplied?: () => Promise<void>,
  ) {}

  getSnapshot = (): ApplicationSetupStates => this.states;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(client: McpSetupClient, state: ApplicationSetupState): void {
    if (this.disposed) return;
    this.states = { ...this.states, [client]: state };
    for (const listener of this.listeners) listener();
  }

  busy(client: McpSetupClient): boolean {
    const related: McpSetupClient[] =
      client === 'cursor' || client === 'aionui' ? ['cursor', 'aionui'] : [client];
    return related.some((item) =>
      ['preparing', 'rechecking', 'applying'].includes(this.states[item].phase),
    );
  }

  private discard(preview?: McpSetupPreview): void {
    if (preview) void this.invoke('mcpSetupDiscard', { planId: preview.planId }).catch(() => {});
  }

  async connect(client: McpSetupClient): Promise<void> {
    if (this.disposed || mcpSetupClients.some((item) => this.busy(item))) return;
    const previous = this.states[client];
    if (previous.phase === 'uncertain') {
      await this.recheck(client);
      return;
    }
    if (previous.phase === 'confirmation' || previous.phase === 'succeeded') return;
    this.discard(previous.preview);
    this.set(client, { phase: 'preparing', uncertain: previous.uncertain });
    let preview: McpSetupPreview | undefined;
    try {
      const defaults = await this.invoke<McpSetupDefaults>('mcpSetupDefaults', { client });
      if (this.disposed) return;
      if (
        defaults.client !== client ||
        defaults.files.length !== 1 ||
        defaults.files[0].id !== 'configuration' ||
        !defaults.files[0].path.trim()
      )
        throw new Error('The selected configuration target is unavailable');
      preview = await this.invoke<McpSetupPreview>('mcpSetupPreview', {
        client,
        files: defaults.files.map(({ id, path }) => ({ id, path })),
      });
      if (this.disposed) {
        this.discard(preview);
        return;
      }
      if (preview.client !== client || !preview.planId)
        throw new Error('The setup preview does not match the selected application');
      const needsConfirmation =
        preview.requiresReplacement || previous.result?.status === 'failed' || !!previous.uncertain;
      this.set(client, {
        phase: needsConfirmation ? 'confirmation' : 'preparing',
        target: { id: defaults.files[0].id, path: defaults.files[0].path },
        preview,
        uncertain: previous.uncertain,
        renewed: previous.result?.status === 'failed',
      });
      if (!needsConfirmation) await this.apply(client, false);
    } catch (error) {
      this.discard(preview);
      this.set(client, {
        phase: 'failed',
        error: String(error instanceof Error ? error.message : error),
        uncertain: previous.uncertain,
      });
    }
  }

  /** A separate owner retry first reads the original selected path, including its canonical target. */
  private async recheck(client: McpSetupClient): Promise<void> {
    const previous = this.states[client];
    if (!previous.target || !previous.preview) return;
    this.set(client, { ...previous, phase: 'rechecking' });
    let fresh: McpSetupPreview | undefined;
    try {
      const check = await inspectSetupRetry(
        this.invoke,
        client,
        [previous.target],
        previous.preview,
      );
      fresh = check.preview;
      if (this.disposed) {
        this.discard(fresh);
        return;
      }
      if (check.disposition === 'configured') {
        this.discard(fresh);
        this.set(client, { ...previous, phase: 'succeeded', verified: true, error: undefined });
        await this.onApplied?.().catch(() => {});
      } else if (check.disposition === 'same') {
        this.discard(fresh);
        this.set(client, { ...previous, phase: 'rechecking' });
        // The existing writer revalidates the original plan's source stamps before any write.
        await this.apply(client, previous.preview.requiresReplacement);
      } else {
        // Changed target, conflict or expiry: a fresh preview needs a new explicit confirmation.
        this.set(client, {
          ...previous,
          phase: 'confirmation',
          preview: fresh,
          renewed: true,
          error: undefined,
        });
      }
    } catch (error) {
      this.discard(fresh);
      this.set(client, {
        ...previous,
        phase: 'uncertain',
        error: String(error instanceof Error ? error.message : error),
      });
    }
  }

  async confirm(client: McpSetupClient): Promise<void> {
    if (
      this.states[client].phase !== 'confirmation' ||
      this.disposed ||
      mcpSetupClients.some((item) => this.busy(item))
    )
      return;
    await this.apply(client, true);
  }

  cancel(client: McpSetupClient): void {
    if (this.states[client].phase !== 'confirmation') return;
    this.discard(this.states[client].preview);
    this.set(client, { phase: 'idle', uncertain: this.states[client].uncertain });
  }

  invalidateSucceeded(client?: McpSetupClient): void {
    const clients =
      client === 'cursor' || client === 'aionui'
        ? (['cursor', 'aionui'] as const)
        : client
          ? [client]
          : mcpSetupClients;
    for (const item of clients)
      if (this.states[item].phase === 'succeeded')
        this.set(item, { phase: 'idle', uncertain: this.states[item].uncertain });
  }

  private async apply(client: McpSetupClient, confirmReplace: boolean): Promise<void> {
    const previous = this.states[client];
    const preview = previous.preview;
    if (!preview || this.disposed) return;
    this.set(client, { ...previous, phase: 'applying', error: undefined });
    try {
      const result = await this.invoke<McpSetupApplyResult>('mcpSetupApply', {
        planId: preview.planId,
        confirmReplace,
      });
      this.set(client, {
        ...previous,
        phase: result.status === 'failed' ? 'failed' : 'succeeded',
        preview,
        result,
        error: result.error,
      });
      // A status refresh failure must not turn a completed configuration write into a retry.
      if (result.status !== 'failed') await this.onApplied?.().catch(() => {});
    } catch (error) {
      // Keep the same operation on an uncertain reply. Never prepare a second write for a retry.
      this.set(client, {
        ...previous,
        phase: 'uncertain',
        preview,
        error: String(error instanceof Error ? error.message : error),
        uncertain: previous.uncertain ?? {
          planId: preview.planId,
          error: String(error instanceof Error ? error.message : error),
          preview,
          target: previous.target,
        },
      });
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const state of Object.values(this.states))
      if (state.phase === 'confirmation') this.discard(state.preview);
    this.listeners.clear();
  }
}

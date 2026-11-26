import {
  mcpSetupClients,
  type McpSetupApplyResult,
  type CodexSetupPreparation,
  type McpSetupClient,
  type McpSetupDefaults,
  type McpSetupInvoke,
  type McpSetupPreview,
  type McpSetupStatus,
  type McpSetupTarget,
} from '../shared/mcp-setup.js';
import { OpenCodeV2SetupFlow, type OpenCodeV2SetupState } from './opencode-v2-setup-model.js';
import { enableChatDelivery, type DeliveryIssue } from '../shared/desktop-session-delivery.js';

export type ApplicationSetupClient = McpSetupClient | 'opencode-v2';
export const applicationSetupClients: readonly ApplicationSetupClient[] = [
  ...mcpSetupClients,
  'opencode-v2',
];

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
  manualConfiguration?: string;
  configurations?: string[];
  deliveryIssue?: DeliveryIssue;
  preview?: McpSetupPreview;
  result?: McpSetupApplyResult;
  error?: string;
  uncertain?: { planId: string; error: string; preview: McpSetupPreview; target?: McpSetupTarget };
  renewed?: boolean;
  verified?: boolean;
  reviewRequired?: boolean;
}
type LegacyApplicationSetupStates = Record<McpSetupClient, ApplicationSetupState>;
export type ApplicationSetupStates = LegacyApplicationSetupStates & {
  'opencode-v2': OpenCodeV2SetupState;
};

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
  const target = preview.files.find((file) => file.id === 'configuration')!.path;
  const sameTarget = target === original.files.find((file) => file.id === 'configuration')?.path;
  if (
    sameTarget &&
    !preview.requiresReplacement &&
    preview.files.every((file) => file.action === 'unchanged')
  ) {
    if (client === 'codex') {
      const status = await invoke<McpSetupStatus>('mcpSetupStatus', { client }).catch((error) => {
        void invoke('mcpSetupDiscard', { planId: preview.planId }).catch(() => {});
        throw error;
      });
      if (
        !status.remembered ||
        !status.files.some((file) => file.id === 'configuration' && file.path === target)
      )
        return { preview, disposition: 'renewed' };
    }
    return { preview, disposition: 'configured' };
  }
  return {
    preview,
    disposition:
      sameTarget &&
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
  ) as LegacyApplicationSetupStates;
  private listeners = new Set<() => void>();
  private disposed = false;
  readonly openCodeV2: OpenCodeV2SetupFlow;
  private snapshot: ApplicationSetupStates;
  private readonly unsubscribeV2: () => void;

  constructor(
    private readonly invoke: McpSetupInvoke,
    private readonly onApplied?: () => Promise<void>,
  ) {
    this.openCodeV2 = new OpenCodeV2SetupFlow(invoke, onApplied, () =>
      mcpSetupClients.some((client) => this.busy(client)),
    );
    this.snapshot = { ...this.states, 'opencode-v2': this.openCodeV2.getSnapshot() };
    this.unsubscribeV2 = this.openCodeV2.subscribe(() => this.publish());
  }

  getSnapshot = (): ApplicationSetupStates => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(client: McpSetupClient, state: ApplicationSetupState): void {
    if (this.disposed) return;
    this.states = { ...this.states, [client]: state };
    this.publish();
  }

  private publish(): void {
    if (this.disposed) return;
    this.snapshot = { ...this.states, 'opencode-v2': this.openCodeV2.getSnapshot() };
    for (const listener of this.listeners) listener();
  }

  busy(client: ApplicationSetupClient): boolean {
    if (client === 'opencode-v2') return this.openCodeV2.busy();
    const related: McpSetupClient[] =
      client === 'cursor' || client === 'aionui' ? ['cursor', 'aionui'] : [client];
    return related.some((item) =>
      ['preparing', 'rechecking', 'applying'].includes(this.states[item].phase),
    );
  }

  private discard(preview?: McpSetupPreview): void {
    if (preview) void this.invoke('mcpSetupDiscard', { planId: preview.planId }).catch(() => {});
  }

  selectCodexConfiguration(configuration?: string) {
    const previous = this.states.codex;
    if (this.busy('codex') || previous.phase === 'uncertain') return;
    this.discard(previous.preview);
    this.set('codex', { phase: 'idle', manualConfiguration: configuration });
  }

  async connect(client: ApplicationSetupClient, choice?: string): Promise<void> {
    if (client === 'opencode-v2') {
      await this.openCodeV2.connect();
      return;
    }
    if (this.disposed || this.openCodeV2.busy() || mcpSetupClients.some((item) => this.busy(item)))
      return;
    const previous = this.states[client];
    if (previous.phase === 'uncertain') {
      await this.recheck(client);
      return;
    }
    if (client === 'codex' && previous.deliveryIssue && previous.target) {
      this.set(client, { ...previous, phase: 'applying' });
      const deliveryIssue = await enableChatDelivery(this.invoke, previous.target.path);
      this.set(client, {
        ...previous,
        phase: deliveryIssue ? 'failed' : 'succeeded',
        deliveryIssue,
      });
      await this.onApplied?.().catch(() => {});
      return;
    }
    if (previous.phase === 'confirmation' || previous.phase === 'succeeded') return;
    const reviewRequired = previous.reviewRequired || previous.result?.status === 'failed';
    this.discard(previous.preview);
    this.set(client, {
      ...previous,
      phase: 'preparing',
      preview: undefined,
      error: undefined,
      reviewRequired,
    });
    let preview: McpSetupPreview | undefined;
    try {
      if (client === 'codex') {
        const prepared = previous.manualConfiguration
          ? await this.invoke<McpSetupPreview>('mcpSetupPreview', {
              client,
              files: [{ id: 'configuration', path: previous.manualConfiguration }],
            })
          : await this.invoke<CodexSetupPreparation | null>(
              'codexSetupPrepare',
              choice ? { configuration: choice } : {},
            );
        if (prepared && 'configurations' in prepared) {
          this.set(client, {
            ...this.states[client],
            phase: 'idle',
            configurations: prepared.configurations,
          });
          return;
        }
        if (this.disposed) {
          this.discard(prepared ?? undefined);
          return;
        }
        if (!prepared) throw new Error('The selected configuration target is unavailable');
        preview = prepared;
        const file = preview.files.find(({ id }) => id === 'configuration');
        if (preview.client !== client || !preview.planId || !file)
          throw new Error('The setup preview does not match the selected application');
        const needsConfirmation = preview.requiresReplacement || reviewRequired;
        this.set(client, {
          ...this.states[client],
          configurations: undefined,
          target: { id: 'configuration', path: file.path },
          phase: needsConfirmation ? 'confirmation' : 'preparing',
          preview,
          renewed: reviewRequired,
        });
        if (!needsConfirmation) await this.apply(client, false);
        return;
      }
      const defaults = await this.invoke<McpSetupDefaults>('mcpSetupDefaults', { client });
      if (this.disposed) return;
      if (
        defaults.client !== client ||
        defaults.files.length !== 1 ||
        defaults.files[0].id !== 'configuration' ||
        !defaults.files[0].path.trim()
      )
        throw new Error('The selected configuration target is unavailable');
      const target =
        reviewRequired && previous.target
          ? previous.target
          : { id: defaults.files[0].id, path: defaults.files[0].path };
      this.set(client, { ...this.states[client], target });
      preview = await this.invoke<McpSetupPreview>('mcpSetupPreview', {
        client,
        files: [target],
      });
      if (this.disposed) {
        this.discard(preview);
        return;
      }
      if (preview.client !== client || !preview.planId)
        throw new Error('The setup preview does not match the selected application');
      const needsConfirmation = preview.requiresReplacement || reviewRequired;
      this.set(client, {
        ...this.states[client],
        phase: needsConfirmation ? 'confirmation' : 'preparing',
        preview,
        renewed: reviewRequired,
      });
      if (!needsConfirmation) await this.apply(client, false);
    } catch (error) {
      this.discard(preview);
      this.set(client, {
        ...this.states[client],
        phase: 'failed',
        error: String(error instanceof Error ? error.message : error),
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
        const deliveryIssue =
          client === 'codex'
            ? await enableChatDelivery(this.invoke, previous.target.path)
            : undefined;
        this.set(client, {
          ...previous,
          deliveryIssue,
          phase: deliveryIssue ? 'failed' : 'succeeded',
          verified: true,
          result: undefined,
          error: undefined,
          reviewRequired: false,
        });
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
          reviewRequired: true,
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

  async confirm(client: ApplicationSetupClient): Promise<void> {
    if (client === 'opencode-v2') {
      await this.openCodeV2.confirm();
      return;
    }
    if (
      this.states[client].phase !== 'confirmation' ||
      this.disposed ||
      this.openCodeV2.busy() ||
      mcpSetupClients.some((item) => this.busy(item))
    )
      return;
    await this.apply(client, true);
  }

  cancel(client: ApplicationSetupClient): void {
    if (client === 'opencode-v2') {
      this.openCodeV2.cancel();
      return;
    }
    if (this.states[client].configurations) {
      this.set(client, { ...this.states[client], phase: 'idle', configurations: undefined });
      return;
    }
    if (this.states[client].phase !== 'confirmation') return;
    this.discard(this.states[client].preview);
    this.set(client, { ...this.states[client], phase: 'idle', preview: undefined });
  }

  invalidateSucceeded(client?: ApplicationSetupClient): void {
    if (!client || client === 'opencode-v2') this.openCodeV2.invalidateSucceeded();
    if (client === 'opencode-v2') return;
    const clients =
      client === 'cursor' || client === 'aionui'
        ? (['cursor', 'aionui'] as const)
        : client
          ? [client]
          : mcpSetupClients;
    for (const item of clients)
      if (this.states[item].phase === 'succeeded')
        this.set(item, {
          ...this.states[item],
          phase: 'idle',
          preview: undefined,
          result: undefined,
          error: undefined,
          verified: false,
        });
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
      const deliveryIssue =
        client === 'codex' && result.status !== 'failed' && previous.target
          ? await enableChatDelivery(this.invoke, previous.target.path)
          : undefined;
      this.set(client, {
        ...previous,
        deliveryIssue,
        phase: result.status === 'failed' || deliveryIssue ? 'failed' : 'succeeded',
        preview,
        result,
        error: result.error,
        reviewRequired: result.status === 'failed',
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
        reviewRequired: true,
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
    this.unsubscribeV2();
    this.openCodeV2.dispose();
    this.disposed = true;
    for (const state of Object.values(this.states))
      if (state.phase === 'confirmation') this.discard(state.preview);
    this.listeners.clear();
  }
}

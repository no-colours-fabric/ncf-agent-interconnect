import type {
  McpSetupInvoke,
  OpenCodeV2SetupApplyResult,
  OpenCodeV2SetupDefaults,
  OpenCodeV2SetupPreview,
  OpenCodeV2SetupRequests,
  OpenCodeV2SetupResponses,
  OpenCodeV2SetupStatus,
  OpenCodeV2SetupTarget,
} from '../shared/mcp-setup.js';
import type { ApplicationSetupState } from './application-setup-model.js';

interface UnconfirmedSetup {
  target: OpenCodeV2SetupTarget;
  preview: OpenCodeV2SetupPreview;
  error: string;
}

export interface OpenCodeV2SetupState {
  phase: ApplicationSetupState['phase'];
  availability: 'checking' | 'available' | 'unavailable';
  checking: boolean;
  open: boolean;
  manualMajor: 1 | 2;
  target?: OpenCodeV2SetupTarget;
  alternatives: string[];
  status?: OpenCodeV2SetupStatus;
  preview?: OpenCodeV2SetupPreview;
  result?: OpenCodeV2SetupApplyResult;
  failedWrite?: OpenCodeV2SetupApplyResult;
  uncertain?: UnconfirmedSetup;
  unconfirmed?: UnconfirmedSetup;
  error?: string;
  reviewRequired?: boolean;
  renewed?: boolean;
  verified?: boolean;
}

export function openCodeV2TargetKey(target: OpenCodeV2SetupTarget): string {
  return JSON.stringify([
    target.major,
    target.installationId,
    target.installationPath,
    target.profilePath,
    target.configurationPath,
  ]);
}

function validTarget(target: OpenCodeV2SetupTarget | undefined): target is OpenCodeV2SetupTarget {
  return (
    !!target &&
    target.major === 2 &&
    [target.profilePath, target.configurationPath].every(
      (value) => typeof value === 'string' && !!value.trim() && value.length <= 8192,
    ) &&
    [target.installationId, target.installationPath].every(
      (value) =>
        value === null || (typeof value === 'string' && !!value.trim() && value.length <= 8192),
    )
  );
}

const sameTarget = (left: OpenCodeV2SetupTarget, right: OpenCodeV2SetupTarget) =>
  openCodeV2TargetKey(left) === openCodeV2TargetKey(right);
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Dedicated v2 calls keep installation/profile/config selection out of legacy v1 setup. */
export class OpenCodeV2SetupFlow {
  private state: OpenCodeV2SetupState = {
    phase: 'idle',
    availability: 'checking',
    checking: false,
    open: false,
    manualMajor: 2,
    alternatives: [],
  };
  private listeners = new Set<() => void>();
  private revision = 0;
  private statusRevision = 0;
  private disposed = false;
  private pendingStatus?: Promise<void>;

  constructor(
    private readonly invoke: McpSetupInvoke,
    private readonly onApplied?: () => Promise<void>,
    private readonly otherBusy: () => boolean = () => false,
  ) {}

  getSnapshot = (): OpenCodeV2SetupState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private set(value: Partial<OpenCodeV2SetupState>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...value };
    for (const listener of this.listeners) listener();
  }
  private call<M extends keyof OpenCodeV2SetupRequests>(
    method: M,
    input: OpenCodeV2SetupRequests[M],
  ): Promise<OpenCodeV2SetupResponses[M]> {
    return this.invoke<OpenCodeV2SetupResponses[M]>(method, input);
  }
  busy(): boolean {
    return ['preparing', 'rechecking', 'applying'].includes(this.state.phase);
  }
  checkingOriginal(): boolean {
    return (
      !!this.state.unconfirmed &&
      this.state.preview?.planId === this.state.unconfirmed.preview.planId &&
      !!this.state.target &&
      sameTarget(this.state.target, this.state.unconfirmed.target)
    );
  }
  selectManualMajor(major: 1 | 2): void {
    if (!this.busy()) this.set({ manualMajor: major });
  }
  private discard(preview?: OpenCodeV2SetupPreview): void {
    if (
      !preview ||
      preview.planId === this.state.unconfirmed?.preview.planId ||
      preview.planId === this.state.uncertain?.preview.planId
    )
      return;
    void this.call('opencodeV2SetupDiscard', { planId: preview.planId }).catch(() => {});
  }

  refresh(): Promise<void> {
    if (this.pendingStatus) return this.pendingStatus;
    const revision = ++this.statusRevision;
    const selected = this.state.target;
    this.set({ checking: true });
    const pending = (async () => {
      try {
        let defaults: OpenCodeV2SetupDefaults | undefined;
        if (!selected) {
          defaults = await this.call('opencodeV2SetupDefaults', {});
          if (defaults.client !== 'opencode-v2' || !validTarget(defaults.target))
            throw new Error('The OpenCode v2 configuration target is unavailable');
        }
        const target = selected ?? defaults!.target;
        const status = await this.call('opencodeV2SetupStatus', { target });
        if (
          status.client !== 'opencode-v2' ||
          !validTarget(status.target) ||
          !sameTarget(target, status.target)
        )
          throw new Error('The OpenCode v2 status does not match the selected target');
        if (revision === this.statusRevision)
          this.set({
            availability: 'available',
            status,
            target: { ...target },
            alternatives: defaults?.alternatives ?? this.state.alternatives,
          });
      } catch (error) {
        if (revision === this.statusRevision)
          this.set({ availability: 'unavailable', error: message(error) });
      } finally {
        if (revision === this.statusRevision) this.set({ checking: false });
      }
    })();
    this.pendingStatus = pending;
    void pending.finally(() => {
      if (this.pendingStatus === pending) this.pendingStatus = undefined;
    });
    return pending;
  }

  setConfigurationPath(path: string): void {
    if (this.busy() || !this.state.target) return;
    ++this.revision;
    ++this.statusRevision;
    this.pendingStatus = undefined;
    this.discard(this.state.preview);
    this.set({
      target: { ...this.state.target, configurationPath: path },
      preview: undefined,
      result: undefined,
      verified: false,
      error: undefined,
      phase: 'idle',
      checking: false,
      reviewRequired: this.state.reviewRequired || !!this.state.uncertain,
    });
  }

  async browse(): Promise<void> {
    if (this.busy() || this.otherBusy() || !this.state.target) return;
    const revision = ++this.revision;
    const target = { ...this.state.target };
    this.set({ phase: 'preparing', error: undefined });
    try {
      const selected = await this.call('opencodeV2SetupBrowse', { target });
      if (revision !== this.revision || this.disposed) return;
      if (selected) {
        if (!validTarget(selected))
          throw new Error('The selected OpenCode v2 target is unavailable');
        this.discard(this.state.preview);
        ++this.statusRevision;
        this.pendingStatus = undefined;
        this.set({
          target: { ...selected },
          preview: undefined,
          result: undefined,
          verified: false,
          checking: false,
          reviewRequired: this.state.reviewRequired || !!this.state.uncertain,
        });
      }
    } catch (error) {
      if (revision === this.revision) this.set({ error: message(error) });
    } finally {
      if (revision === this.revision)
        this.set({ phase: this.checkingOriginal() ? 'uncertain' : 'idle' });
    }
  }

  async beginManual(): Promise<void> {
    if (this.busy() || this.otherBusy()) return;
    this.set({
      open: true,
      manualMajor: 2,
      ...(this.state.phase === 'succeeded'
        ? { phase: 'idle' as const, result: undefined, verified: false }
        : {}),
    });
    if (this.checkingOriginal()) return;
    if (!this.state.target || this.state.availability !== 'available') await this.refresh();
    if (this.state.open && this.state.target && this.state.availability === 'available')
      await this.review();
  }

  private validatePreview(preview: OpenCodeV2SetupPreview, target: OpenCodeV2SetupTarget): void {
    if (
      preview.client !== 'opencode-v2' ||
      !preview.planId ||
      !validTarget(preview.target) ||
      !preview.targetId ||
      preview.files.length !== 1 ||
      preview.files[0].id !== 'configuration' ||
      preview.files[0].path !== preview.target.configurationPath ||
      preview.target.profilePath !== target.profilePath ||
      preview.target.installationId !== target.installationId ||
      preview.target.installationPath !== target.installationPath
    )
      throw new Error('The OpenCode v2 preview does not match the selected target');
  }

  private async prepare(automatic: boolean): Promise<void> {
    if (this.disposed || this.busy() || this.otherBusy()) return;
    const intentRevision = this.revision;
    if (this.state.checking) await this.refresh();
    if (!this.state.target || this.state.availability !== 'available') await this.refresh();
    if (
      !this.state.target ||
      this.state.availability !== 'available' ||
      this.disposed ||
      intentRevision !== this.revision ||
      this.busy() ||
      this.otherBusy()
    )
      return;
    const target = { ...this.state.target };
    const revision = ++this.revision;
    this.discard(this.state.preview);
    this.set({
      phase: 'preparing',
      preview: undefined,
      result: undefined,
      verified: false,
      error: undefined,
    });
    let preview: OpenCodeV2SetupPreview | undefined;
    try {
      preview = await this.call('opencodeV2SetupPreview', { target });
      if (revision !== this.revision || this.disposed) {
        this.discard(preview);
        return;
      }
      this.validatePreview(preview, target);
      const renewed = !!this.state.reviewRequired || !sameTarget(target, preview.target);
      const confirmation = preview.requiresReplacement || renewed;
      this.set({
        preview,
        target: { ...preview.target },
        renewed,
        reviewRequired: renewed,
        phase: automatic && confirmation ? 'confirmation' : 'idle',
      });
      if (!automatic) await this.refresh();
      else if (!confirmation) await this.apply(false);
    } catch (error) {
      this.discard(preview);
      if (revision === this.revision) this.set({ phase: 'failed', error: message(error) });
    }
  }
  review(): Promise<void> {
    return this.prepare(false);
  }

  async connect(): Promise<void> {
    if (
      this.disposed ||
      this.busy() ||
      this.state.checking ||
      this.otherBusy() ||
      this.state.phase === 'confirmation' ||
      this.state.phase === 'succeeded'
    )
      return;
    this.set({ open: false });
    if (this.state.unconfirmed && this.state.phase === 'uncertain') await this.checkResult();
    else await this.prepare(true);
  }

  async checkResult(): Promise<void> {
    if (
      this.disposed ||
      this.busy() ||
      this.state.checking ||
      this.otherBusy() ||
      !this.state.unconfirmed
    )
      return;
    const original = this.state.unconfirmed;
    const revision = ++this.revision;
    this.set({ phase: 'rechecking', error: undefined });
    let fresh: OpenCodeV2SetupPreview | undefined;
    try {
      fresh = await this.call('opencodeV2SetupPreview', { target: { ...original.target } });
      if (revision !== this.revision || this.disposed) {
        this.discard(fresh);
        return;
      }
      this.validatePreview(fresh, original.target);
      const same =
        sameTarget(original.target, fresh.target) && original.preview.targetId === fresh.targetId;
      const projection = (value: OpenCodeV2SetupPreview) =>
        JSON.stringify({
          requiresReplacement: value.requiresReplacement,
          files: value.files.map(({ id, path, action, changes }) => ({
            id,
            path,
            action,
            changes,
          })),
        });
      if (
        same &&
        !fresh.requiresReplacement &&
        fresh.files.every((file) => file.action === 'unchanged')
      ) {
        this.discard(fresh);
        this.set({
          phase: 'succeeded',
          target: { ...original.target },
          preview: original.preview,
          result: undefined,
          verified: true,
          unconfirmed: undefined,
          error: undefined,
          reviewRequired: false,
        });
        await this.afterApplied();
      } else if (
        same &&
        projection(fresh) === projection(original.preview) &&
        Date.parse(original.preview.expiresAt) > Date.now()
      ) {
        this.discard(fresh);
        this.set({ target: { ...original.target }, preview: original.preview, phase: 'idle' });
        await this.write(original.preview, original.target, original.preview.requiresReplacement);
      } else {
        this.set({
          target: { ...fresh.target },
          preview: fresh,
          renewed: true,
          reviewRequired: true,
          phase: this.state.open ? 'idle' : 'confirmation',
        });
      }
    } catch (error) {
      this.discard(fresh);
      if (revision === this.revision) this.set({ phase: 'uncertain', error: message(error) });
    }
  }

  async apply(confirmReplace = false): Promise<void> {
    if (
      this.disposed ||
      this.busy() ||
      this.state.checking ||
      this.otherBusy() ||
      !this.state.preview ||
      !this.state.target ||
      this.state.verified ||
      this.state.phase === 'succeeded' ||
      this.state.phase === 'failed'
    )
      return;
    if (this.checkingOriginal()) {
      await this.checkResult();
      return;
    }
    if ((this.state.preview.requiresReplacement || this.state.reviewRequired) && !confirmReplace)
      return;
    await this.write(this.state.preview, { ...this.state.target }, confirmReplace);
  }
  confirm(): Promise<void> {
    return this.apply(true);
  }

  private async write(
    preview: OpenCodeV2SetupPreview,
    target: OpenCodeV2SetupTarget,
    confirmReplace: boolean,
  ): Promise<void> {
    const revision = ++this.revision;
    this.set({ phase: 'applying', error: undefined });
    try {
      const result = await this.call('opencodeV2SetupApply', {
        planId: preview.planId,
        target,
        confirmReplace,
      });
      if (revision !== this.revision || this.disposed) return;
      if (
        !validTarget(result.target) ||
        !sameTarget(target, result.target) ||
        result.targetId !== preview.targetId ||
        !['applied', 'unchanged', 'failed'].includes(result.status) ||
        !Array.isArray(result.files) ||
        result.files.length !== 1 ||
        result.files[0].path !== target.configurationPath
      )
        throw new Error('The OpenCode v2 result does not match the selected target');
      this.set({
        result,
        failedWrite: result.status === 'failed' ? result : this.state.failedWrite,
        target,
        preview,
        phase: result.status === 'failed' ? 'failed' : 'succeeded',
        error: result.error,
        reviewRequired: result.status === 'failed',
        unconfirmed: undefined,
      });
      if (result.status !== 'failed') await this.afterApplied();
    } catch (error) {
      if (revision !== this.revision || this.disposed) return;
      const unconfirmed = { target, preview, error: message(error) };
      this.set({
        phase: 'uncertain',
        target,
        preview,
        error: unconfirmed.error,
        reviewRequired: true,
        unconfirmed,
        uncertain: this.state.uncertain ?? unconfirmed,
      });
    }
  }
  private async afterApplied(): Promise<void> {
    await this.refresh();
    await this.onApplied?.().catch(() => {});
  }

  cancel(): void {
    if (this.busy()) return;
    ++this.revision;
    this.discard(this.state.preview);
    this.set({
      open: false,
      phase: 'idle',
      preview: undefined,
      result: undefined,
      verified: false,
    });
  }
  invalidateSucceeded(): void {
    if (this.state.phase === 'succeeded')
      this.set({ phase: 'idle', preview: undefined, result: undefined, verified: false });
  }
  async openFile(): Promise<void> {
    const { target, status } = this.state;
    if (
      !target ||
      !status ||
      !sameTarget(target, status.target) ||
      ['missing', 'unavailable'].includes(status.state)
    )
      return;
    try {
      await this.call('opencodeV2SetupOpen', { target: { ...target } });
    } catch (error) {
      this.set({ error: message(error) });
    }
  }
  dispose(): void {
    this.discard(this.state.preview);
    this.disposed = true;
    ++this.revision;
    ++this.statusRevision;
    this.listeners.clear();
  }
}

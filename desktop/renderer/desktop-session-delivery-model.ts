import {
  configureChatDelivery,
  type DeliveryAction,
  type DeliveryIssue,
  type DesktopSessionDelivery,
} from '../shared/desktop-session-delivery.js';
import type { McpSetupInvoke } from '../shared/mcp-setup.js';

type Verified = Extract<DesktopSessionDelivery, { profile: string }>;
type Notice = Exclude<DesktopSessionDelivery, Verified>['state'];
export type PendingDeliveryAction = Exclude<DeliveryAction, 'status'>;

interface DeliveryState {
  known?: Verified;
  notice?: Notice;
  issue?: DeliveryIssue;
  busy: boolean;
  pendingAction?: PendingDeliveryAction;
  queueWarningPending?: true;
  restartPending?: true;
}

/** One owner-side delivery state for Quick Connect, the warnings and manual setup. */
export class DesktopSessionDeliveryModel {
  private state: DeliveryState = { busy: false };
  private listeners = new Set<() => void>();
  private revision = 0;
  private writing = false;
  private loaded = false;

  constructor(private readonly invoke: McpSetupInvoke) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(state: DeliveryState) {
    const { queueWarningPending, restartPending } = this.state;
    this.state = { queueWarningPending, restartPending, ...state };
    for (const listener of this.listeners) listener();
  }

  isWriting() {
    return this.writing;
  }

  acknowledgeRestart() {
    if (this.state.restartPending) this.set({ ...this.state, restartPending: undefined });
  }

  acknowledgeQueueWarning() {
    if (this.state.queueWarningPending) this.set({ ...this.state, queueWarningPending: undefined });
  }

  load() {
    if (!this.loaded) void this.refresh();
  }

  async refresh() {
    if (this.writing) return;
    this.loaded = true;
    const revision = ++this.revision;
    this.set({ ...this.state, issue: undefined, busy: true });
    try {
      const status = await this.invoke<DesktopSessionDelivery>('desktopSessionDelivery', {
        action: 'status',
      });
      if (revision !== this.revision) return;
      if ('profile' in status) this.set({ known: status, busy: false });
      else if (status.state === 'configuration-required' || status.state === 'unsupported')
        this.set({ notice: status.state, busy: false });
      else this.set({ ...this.state, notice: status.state, busy: false });
    } catch {
      if (revision === this.revision)
        this.set({ ...this.state, notice: 'unavailable', busy: false });
    }
  }

  private beginWrite(pendingAction: PendingDeliveryAction) {
    this.loaded = true;
    this.writing = true;
    this.revision++;
    this.set({ ...this.state, issue: undefined, busy: true, pendingAction });
  }

  private finishWrite(status?: DesktopSessionDelivery, issue?: DeliveryIssue) {
    this.writing = false;
    if (status && 'profile' in status)
      this.set({
        known: status,
        issue,
        busy: false,
        queueWarningPending:
          this.state.pendingAction === 'disable' || this.state.queueWarningPending,
        restartPending: status.restartRequired === true ? true : this.state.restartPending,
      });
    else if (status) this.set({ notice: status.state, issue, busy: false });
    else this.set({ ...this.state, issue, busy: false, pendingAction: undefined });
  }

  async change(action: PendingDeliveryAction, profile: string) {
    if (this.writing || this.state.busy) return;
    const disabling = action === 'disable';
    if (
      disabling &&
      (this.state.known?.state !== 'enabled' || this.state.known.profile !== profile)
    )
      return;
    this.beginWrite(action);
    try {
      const result = await this.invoke<DesktopSessionDelivery>('desktopSessionDelivery', {
        action,
        profile,
      });
      if ('profile' in result) {
        const expected = action === 'enable' ? 'enabled' : 'ready';
        const succeeded = result.state === expected && result.profile === profile;
        if (!succeeded) this.finishWrite(undefined, 'unavailable');
        else this.finishWrite(result);
      } else if (
        result.state === 'unsupported' ||
        (action === 'disable' && result.state === 'configuration-required')
      ) {
        this.finishWrite(result);
      } else {
        this.finishWrite(
          undefined,
          result.state === 'configuration-required' ? 'unavailable' : result.state,
        );
      }
    } catch {
      this.finishWrite(undefined, 'unavailable');
    }
  }

  async enableForConfiguration(configuration: string) {
    if (this.writing) return { issue: 'unavailable' as const };
    this.beginWrite('enable');
    const result = await configureChatDelivery(this.invoke, configuration);
    // Quick Connect presents its own error beside the selected configuration.
    const status = result.status;
    // A status read can establish a no-op, but only a successful mutation can request a restart.
    this.finishWrite(
      status && 'profile' in status && !result.changed
        ? { ...status, restartRequired: undefined }
        : status,
    );
    return result;
  }
}

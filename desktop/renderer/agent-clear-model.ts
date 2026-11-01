import type {
  AgentClearInput,
  AgentClearPreview,
  AgentClearResponse,
  AgentClearResult,
  AgentIdentity,
} from '../shared/contracts.js';
import { nicknameKey } from '../shared/contracts.js';

export interface AgentClearState {
  open: boolean;
  busy: 'preview' | 'confirm' | null;
  input: AgentClearInput | null;
  preview: AgentClearPreview | null;
  stale: boolean;
  error: string;
}
const empty = (): AgentClearState => ({
  open: false,
  busy: null,
  input: null,
  preview: null,
  stale: false,
  error: '',
});

export class AgentClearFlow {
  private state = empty();
  private revision = 0;
  private listeners = new Set<() => void>();
  constructor(private invoke: (input: AgentClearInput) => Promise<AgentClearResponse>) {}
  getSnapshot = (): AgentClearState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(state: AgentClearState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  cancel(): void {
    if (this.state.busy === 'confirm') return;
    this.revision++;
    this.update(empty());
  }
  async begin(input: AgentClearInput, stale = false): Promise<void> {
    const revision = ++this.revision;
    this.update({ ...empty(), open: true, input, stale, busy: 'preview' });
    try {
      const preview = await this.invoke(input);
      if (revision !== this.revision) return;
      if (preview.status !== 'confirmation_required')
        throw new Error('A deletion preview was expected');
      this.update({ ...this.state, preview, busy: null });
    } catch (error) {
      if (revision === this.revision)
        this.update({ ...this.state, busy: null, error: (error as Error).message });
    }
  }
  async confirm(): Promise<AgentClearResult | null> {
    const { input, preview, busy } = this.state;
    if (!input || !preview || busy) return null;
    const revision = this.revision;
    this.update({ ...this.state, busy: 'confirm', error: '' });
    try {
      const result = await this.invoke({
        ...input,
        operationId: preview.operationId,
        confirm: true,
      });
      if (revision !== this.revision) return null;
      if (result.status !== 'cleared') throw new Error('The agent deletion was not confirmed');
      this.revision++;
      this.update(empty());
      return result;
    } catch (error) {
      if (revision !== this.revision) return null;
      if (/^clear_preview_(stale|expired):/.test((error as Error).message))
        await this.begin(input, true);
      else this.update({ ...this.state, busy: null, error: (error as Error).message });
      return null;
    }
  }
}

export function agentCacheKey(agent: AgentIdentity | undefined): string | null {
  return agent
    ? agent.key + ':' + (agent.incarnation ?? 'legacy-' + (agent.binding?.generation ?? 0))
    : null;
}
export function invalidatedAgent(
  previous: AgentIdentity[],
  next: AgentIdentity[],
  nickname: string,
): boolean {
  if (!nickname) return false;
  const key = nicknameKey(nickname),
    before = previous.find((agent) => agent.key === key),
    after = next.find((agent) => agent.key === key);
  return !after || (!!before && agentCacheKey(before) !== agentCacheKey(after));
}

export function visibleAgentHistory<T>(
  history: { owner: string; messages: T[]; nextCursor: number; hasMore: boolean },
  key: string | null,
): { messages: T[]; nextCursor: number; hasMore: boolean } {
  return key && history.owner === key ? history : { messages: [], nextCursor: 0, hasMore: false };
}

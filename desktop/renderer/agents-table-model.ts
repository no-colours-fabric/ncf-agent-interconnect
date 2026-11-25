import {
  agentApplicationSchema,
  nicknameKey,
  type AgentApplicationId,
  type AgentIdentity,
  type Snapshot,
} from '../shared/contracts.js';

export interface AgentRow {
  id: string;
  nickname: string;
  nodeId: string;
  local: boolean;
  online: boolean;
  client?: string;
  application?: AgentApplicationId;
  messageCount?: number;
  lastMessageAt?: string | null;
  incomingCount?: number;
  outgoingCount?: number;
  identity?: AgentIdentity;
}

export function agentRows(snapshot: Snapshot): AgentRow[] {
  const localDirectory = snapshot.directories.find((directory) => directory.local);
  const adapters = new Map(snapshot.adapters.map((adapter) => [adapter.id, adapter.kind]));
  const rows: AgentRow[] = snapshot.agents.map((identity) => {
    return {
      id: snapshot.nodeId + ':' + identity.key,
      nickname: identity.nickname,
      nodeId: snapshot.nodeId,
      local: true,
      online:
        snapshot.running &&
        localDirectory?.state === 'ready' &&
        localDirectory.agents.some(
          (agent) =>
            nicknameKey(agent.nickname) === nicknameKey(identity.nickname) &&
            agent.availability === 'online',
        ),
      client: identity.binding?.client,
      application: identity.binding
        ? agentApplicationSchema.safeParse(adapters.get(identity.binding.adapterId)).data
        : undefined,
      messageCount: identity.messageCount,
      lastMessageAt: identity.lastMessageAt,
      incomingCount: identity.incomingCount,
      outgoingCount: identity.outgoingCount,
      identity,
    };
  });
  for (const directory of snapshot.directories.filter((directory) => !directory.local)) {
    for (const agent of directory.agents) {
      rows.push({
        id: directory.nodeId + ':' + nicknameKey(agent.nickname),
        nickname: agent.nickname,
        nodeId: directory.nodeId,
        local: false,
        application: agent.application,
        online: snapshot.running && directory.state === 'ready' && agent.availability === 'online',
      });
    }
  }
  return rows.sort(
    (a, b) => a.nickname.localeCompare(b.nickname) || a.nodeId.localeCompare(b.nodeId),
  );
}

export type AgentSortColumn = 'name' | 'application' | 'node' | 'lastMessage' | 'messages';
export interface AgentSort {
  column: AgentSortColumn;
  direction: 'asc' | 'desc';
}

export function agentLastMessageTime(agent: AgentRow): number | undefined {
  const time = Date.parse(agent.lastMessageAt ?? '');
  return Number.isFinite(time) ? time : undefined;
}

export function sortAgentRows(
  rows: readonly AgentRow[],
  sort: AgentSort,
  locale: string,
  nodeName: (nodeId: string) => string,
  applicationName: (application: AgentApplicationId) => string,
): AgentRow[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const value = (agent: AgentRow): string | number | undefined => {
    switch (sort.column) {
      case 'name':
        return agent.nickname;
      case 'application':
        return agent.application ? applicationName(agent.application) : undefined;
      case 'node':
        return nodeName(agent.nodeId).trim() || undefined;
      case 'lastMessage':
        return agentLastMessageTime(agent);
      case 'messages':
        return agent.messageCount;
    }
  };
  return rows
    .map((agent) => ({ agent, value: value(agent) }))
    .sort((a, b) => {
      if (a.value === undefined && b.value !== undefined) return 1;
      if (a.value !== undefined && b.value === undefined) return -1;
      const comparison =
        typeof a.value === 'number' && typeof b.value === 'number'
          ? a.value - b.value
          : collator.compare(String(a.value ?? ''), String(b.value ?? ''));
      return (
        comparison * (sort.direction === 'asc' ? 1 : -1) ||
        collator.compare(a.agent.nickname, b.agent.nickname) ||
        a.agent.id.localeCompare(b.agent.id)
      );
    })
    .map(({ agent }) => agent);
}

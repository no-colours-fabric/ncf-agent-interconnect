import { nicknameKey, type AgentIdentity, type Snapshot } from '../shared/contracts.js';

export interface AgentRow {
  id: string;
  nickname: string;
  nodeId: string;
  local: boolean;
  online: boolean;
  client?: string;
  messageCount?: number;
  lastMessageAt?: string | null;
  incomingCount?: number;
  outgoingCount?: number;
  identity?: AgentIdentity;
}

export function agentRows(snapshot: Snapshot): AgentRow[] {
  const localDirectory = snapshot.directories.find((directory) => directory.local);
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
            nicknameKey(agent.nickname) === identity.key && agent.availability === 'online',
        ),
      client: identity.binding?.client,
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
        online: snapshot.running && directory.state === 'ready' && agent.availability === 'online',
      });
    }
  }
  return rows.sort(
    (a, b) => a.nickname.localeCompare(b.nickname) || a.nodeId.localeCompare(b.nodeId),
  );
}

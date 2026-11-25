import { nicknameKey, type AdapterProfile, type Snapshot } from '../shared/contracts.js';

export type AgentApplication =
  'codex-desktop' | 'claude-code' | 'cursor' | 'opencode' | 'aionui' | `client:${string}`;

export interface AgentApplicationEvidence {
  application: AgentApplication;
  availability: 'online' | 'unknown';
}

const applicationOrder: AgentApplication[] = [
  'codex-desktop',
  'claude-code',
  'cursor',
  'opencode',
  'aionui',
];

function applicationFromKind(kind: AdapterProfile['kind']): AgentApplication | null {
  if (kind === 'codex-desktop') return 'codex-desktop';
  if (kind === 'claude-code') return 'claude-code';
  if (kind === 'cursor-hook') return 'cursor';
  if (kind === 'opencode-http') return 'opencode';
  if (kind === 'aionui') return 'aionui';
  return null;
}

function applicationFromClient(client: string): AgentApplication {
  const normalized = client.normalize('NFKC').trim().toLocaleLowerCase('en');
  if (normalized === 'claude code') return 'claude-code';
  if (normalized === 'aionui' || normalized === 'aionui with cursor agent') return 'aionui';
  if (normalized === 'cursor') return 'cursor';
  if (normalized === 'opencode') return 'opencode';
  if (normalized === 'codex desktop') return 'codex-desktop';
  return `client:${client.trim()}`;
}

export function configuredAgentApplications(
  snapshot: Pick<Snapshot, 'agents' | 'adapters' | 'directories' | 'running'>,
): AgentApplicationEvidence[] {
  const localDirectory = snapshot.directories.find((directory) => directory.local);
  const adapters = new Map(snapshot.adapters.map((adapter) => [adapter.id, adapter]));
  const evidence = new Map<AgentApplication, AgentApplicationEvidence>();

  for (const agent of snapshot.agents) {
    if (!agent.binding) continue;
    const profile = adapters.get(agent.binding.adapterId);
    const application =
      (profile && applicationFromKind(profile.kind)) ?? applicationFromClient(agent.binding.client);
    const available =
      snapshot.running &&
      localDirectory?.state === 'ready' &&
      localDirectory.agents.some(
        (entry) =>
          nicknameKey(entry.nickname) === nicknameKey(agent.nickname) &&
          entry.availability === 'online',
      );
    const previous = evidence.get(application);
    evidence.set(application, {
      application,
      availability: previous?.availability === 'online' || available ? 'online' : 'unknown',
    });
  }

  return [...evidence.values()].sort((left, right) => {
    const leftOrder = applicationOrder.indexOf(left.application);
    const rightOrder = applicationOrder.indexOf(right.application);
    if (leftOrder !== rightOrder)
      return (
        (leftOrder < 0 ? applicationOrder.length : leftOrder) -
        (rightOrder < 0 ? applicationOrder.length : rightOrder)
      );
    return left.application.localeCompare(right.application);
  });
}

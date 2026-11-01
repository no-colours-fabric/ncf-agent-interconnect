import type { AdapterProfile, Snapshot } from '../shared/contracts.js';

export function applicationStatus(
  kind: AdapterProfile['kind'],
  snapshot: Pick<Snapshot, 'adapters' | 'agents'>,
) {
  const profiles = snapshot.adapters.filter((profile) => profile.kind === kind),
    ids = new Set(profiles.map((profile) => profile.id)),
    agents = snapshot.agents.filter((agent) => agent.binding && ids.has(agent.binding.adapterId)),
    connections = profiles.map((profile) => ({
      profile,
      agents: agents.filter((agent) => agent.binding?.adapterId === profile.id),
    })),
    readyAgents = connections
      .filter(({ profile }) => profile.state === 'ready')
      .reduce((count, connection) => count + connection.agents.length, 0);
  const summary = !agents.length
    ? 'none'
    : kind === 'manual'
      ? 'manual'
      : !readyAgents
        ? 'paused'
        : readyAgents < agents.length
          ? 'partial'
          : 'connected';
  const issues = connections.filter(
    ({ profile }) => profile.error || profile.state === 'error' || profile.state === 'uncertain',
  );
  return { agents, connections, summary, issues };
}

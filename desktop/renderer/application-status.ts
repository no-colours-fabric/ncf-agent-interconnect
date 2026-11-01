import type { AdapterProfile, AdapterState, Snapshot } from '../shared/contracts.js';
import type { Messages } from './i18n/messages.js';

interface ConnectionPresentation {
  status: keyof Messages;
  impact: keyof Messages;
  action: keyof Messages;
  tone: 'default' | 'success' | 'info' | 'warning';
}

export function connectionPresentation(
  profile: AdapterState,
  hasBoundAgents: boolean,
): ConnectionPresentation {
  if (profile.state === 'uncertain')
    return {
      status: 'clientsNeedsReview',
      impact: 'clientsUncertainImpact',
      action: 'clientsCheckBeforeRetry',
      tone: 'warning',
    };
  if (profile.kind === 'manual')
    return {
      status: 'clientsReceiveMcp',
      impact: 'clientsManualImpact',
      action: 'clientsMcpAction',
      tone: 'default',
    };
  if (profile.state === 'ready') {
    const automatic = canDeliverAutomatically(profile);
    return {
      status: hasBoundAgents
        ? automatic
          ? 'clientsAuto'
          : 'clientsNeedsReview'
        : automatic
          ? 'clientsAvailable'
          : 'clientsUnavailable',
      impact: hasBoundAgents
        ? automatic
          ? 'clientsReadyImpact'
          : 'clientsUnavailableImpact'
        : 'clientsUnboundImpact',
      action: hasBoundAgents
        ? automatic
          ? 'clientsNoAction'
          : 'clientsCheckExactChat'
        : 'clientsUseSavedAction',
      tone: hasBoundAgents ? (automatic ? 'success' : 'warning') : 'default',
    };
  }
  if (profile.state === 'checking')
    return {
      status: 'clientsChecking',
      impact: 'clientsCheckingImpact',
      action: 'clientsWaitAction',
      tone: 'info',
    };
  if (!hasBoundAgents)
    return {
      status: 'clientsUnavailable',
      impact: 'clientsUnboundImpact',
      action: 'clientsUseSavedAction',
      tone: 'default',
    };
  const unsupported =
    profile.error === 'The handler for this Codex chat does not support external input';
  const unconfirmed =
    profile.error === 'The handler for this Codex chat did not confirm external input support';
  return {
    status: 'clientsPaused',
    impact: unsupported
      ? 'clientsUnsupportedImpact'
      : unconfirmed
        ? 'clientsUnconfirmedImpact'
        : 'clientsUnavailableImpact',
    action: unsupported ? 'clientsMcpAction' : 'clientsCheckExactChat',
    tone: 'warning',
  };
}

function canDeliverAutomatically(profile: AdapterState): boolean {
  return (
    profile.state === 'ready' &&
    !profile.error &&
    profile.capabilities.wakeIdle &&
    profile.capabilities.exactSession
  );
}

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
      .filter(({ profile }) => canDeliverAutomatically(profile))
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

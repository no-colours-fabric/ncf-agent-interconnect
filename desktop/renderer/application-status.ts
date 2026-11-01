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
  if (profile.released)
    return {
      status: 'clientsReleased',
      impact: hasBoundAgents ? 'clientsReleasedImpact' : 'clientsUnboundImpact',
      action: hasBoundAgents ? 'clientsReleasedAction' : 'clientsUseSavedAction',
      tone: 'default',
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
  if (unsupported || unconfirmed)
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
  return {
    status: 'clientsNotConfirmed',
    impact: 'clientsUnavailableImpact',
    action: 'clientsCheckExactChat',
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

export type ConnectionSummary =
  'none' | 'manual' | 'connected' | 'partial' | 'released' | 'notConfirmed' | 'paused';

export function applicationStatus(
  kind: AdapterProfile['kind'],
  snapshot: Pick<Snapshot, 'adapters' | 'agents'>,
): {
  agents: Snapshot['agents'];
  connections: { profile: AdapterState; agents: Snapshot['agents'] }[];
  summary: ConnectionSummary;
  issues: { profile: AdapterState; agents: Snapshot['agents'] }[];
} {
  const profiles = snapshot.adapters.filter((profile) => profile.kind === kind),
    ids = new Set(profiles.map((profile) => profile.id)),
    agents = snapshot.agents.filter((agent) => agent.binding && ids.has(agent.binding.adapterId)),
    connections = profiles.map((profile) => ({
      profile,
      agents: agents.filter((agent) => agent.binding?.adapterId === profile.id),
    })),
    bound = connections.filter(({ agents }) => agents.length),
    boundCount = bound.reduce((count, connection) => count + connection.agents.length, 0),
    readyAgents = connections
      .filter(({ profile }) => canDeliverAutomatically(profile))
      .reduce((count, connection) => count + connection.agents.length, 0);
  let summary: ConnectionSummary;
  if (!boundCount) summary = 'none';
  else if (kind === 'manual') summary = 'manual';
  else if (readyAgents === boundCount) summary = 'connected';
  else if (readyAgents > 0) summary = 'partial';
  else if (bound.some(({ profile }) => profile.state === 'uncertain')) summary = 'paused';
  else if (bound.some(({ profile }) => profile.state === 'checking')) summary = 'paused';
  else if (bound.every(({ profile }) => profile.released)) summary = 'released';
  else summary = 'notConfirmed';
  // A released connection is not a technical failure; keep only real issues.
  const issues = connections.filter(
    ({ profile }) =>
      !profile.released &&
      (profile.error || profile.state === 'error' || profile.state === 'uncertain'),
  );
  return { agents, connections, summary, issues };
}

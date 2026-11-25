export interface IncomingPairApproval {
  id: string;
  nodeId: string;
  label: string;
  address: string;
  fingerprint: string;
}

export type PairApprovalDecision = 'confirm' | 'dismiss' | 'suppress';

export type OutgoingPairApproval =
  | { state: 'waiting' | 'shown' | 'dismissed' | 'suppressed' | 'unsupported' }
  | { state: 'paired'; id: string; label: string };

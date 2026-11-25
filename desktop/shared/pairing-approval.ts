export interface IncomingPairApproval {
  id: string;
  label: string;
  address: string;
  comparisonCode: string;
}

export type PairApprovalDecision = 'confirm' | 'dismiss' | 'suppress';

export type OutgoingPairApproval =
  | { state: 'waiting' | 'shown'; comparisonCode: string }
  | { state: 'dismissed' | 'suppressed' | 'unsupported' }
  | { state: 'paired'; id: string; label: string };

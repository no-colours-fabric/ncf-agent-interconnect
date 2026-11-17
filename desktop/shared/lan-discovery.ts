/** Discovery metadata is unauthenticated and never grants access to a node. */
export interface DiscoveredLanNode {
  key: string;
  nodeId: string;
  label: string;
  address: string;
}

/** Source-validated discovery metadata remains unauthenticated. */
export type LanDiscoveryObservation = Readonly<DiscoveredLanNode>;

export type LanDiscoveryUnavailable = 'no-interfaces' | 'transport-error';
export type LanAnnouncementUnavailable =
  LanDiscoveryUnavailable | 'stopped' | 'listener-unavailable' | 'listener-local';

export interface LanDiscoverySnapshot {
  state: 'stopped' | 'searching' | 'unavailable';
  reason: LanDiscoveryUnavailable | null;
  announcement: {
    available: boolean;
    reason: LanAnnouncementUnavailable | null;
  };
  nodes: DiscoveredLanNode[];
}

/** Keep this value when opening the code dialog; do not resolve its key again. */
export type LanPairSelection = Readonly<DiscoveredLanNode>;

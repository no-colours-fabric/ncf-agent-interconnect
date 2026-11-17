/** Caller-supplied inventory; reading the operating system is a separate runtime boundary. */
export interface NetworkInterfaceAddressInput {
  readonly address: string;
  readonly family: string | number;
  readonly netmask: string;
  readonly internal: boolean;
  readonly mac?: string;
}

export type NetworkInterfaceSnapshot = Readonly<
  Record<string, readonly NetworkInterfaceAddressInput[] | undefined>
>;

/** A name survives address changes; a usable MAC also permits a rename match. */
export interface NetworkInterfaceExclusion {
  readonly name: string;
  readonly mac?: string;
}

export interface LocalIpv4Address {
  readonly address: string;
  readonly netmask: string;
  readonly prefixLength: number;
  readonly internal: boolean;
}

export type InterfaceAddressRejection =
  | 'unsupported-family'
  | 'malformed-address'
  | 'unspecified-address'
  | 'non-unicast-address'
  | 'broadcast-address'
  | 'invalid-netmask'
  | 'subnet-address';

export interface RejectedInterfaceAddress {
  readonly address: string;
  readonly reason: InterfaceAddressRejection;
}

export interface NetworkInterfaceInventory {
  readonly name: string;
  readonly macs: readonly string[];
  /** A hint for exclusions, never a cryptographic identity or a permanent hardware GUID. */
  readonly identity: 'name-and-mac' | 'name-only' | 'multiple-macs';
  readonly addresses: readonly LocalIpv4Address[];
  readonly rejected: readonly RejectedInterfaceAddress[];
  readonly excluded: boolean;
}

export interface NetworkInterfaceExclusionState {
  readonly exclusion: NetworkInterfaceExclusion;
  readonly matchingNames: readonly string[];
  readonly absent: boolean;
  /** All matches remain excluded until an owner explicitly resolves the record. */
  readonly ambiguous: boolean;
}

export type ListenAddressExclusion =
  'excluded-interface' | 'shared-address' | 'invalid-interface-address';

export interface NetworkListenAddressPolicy {
  readonly address: string;
  readonly interfaceNames: readonly string[];
  readonly allowed: boolean;
  readonly reason: ListenAddressExclusion | null;
}

/** Desired destination-IP policy, not proof of a successful bind or a physical ingress filter. */
export interface NetworkInterfacePolicy {
  readonly interfaces: readonly NetworkInterfaceInventory[];
  readonly addresses: readonly NetworkListenAddressPolicy[];
  readonly listenAddresses: readonly string[];
  readonly exclusions: readonly NetworkInterfaceExclusionState[];
}

export interface NetworkInterfaceStatus extends NetworkInterfacePolicy {
  readonly listeners: readonly {
    address: string;
    port: number;
    state: 'listening' | 'error';
    error: string | null;
  }[];
  readonly inventoryError: string | null;
}

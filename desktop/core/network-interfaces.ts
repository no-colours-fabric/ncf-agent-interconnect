import type {
  InterfaceAddressRejection,
  LocalIpv4Address,
  NetworkInterfaceExclusion,
  NetworkInterfaceInventory,
  NetworkInterfacePolicy,
  NetworkInterfaceSnapshot,
  RejectedInterfaceAddress,
} from '../shared/network-interfaces.js';

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
function ipv4(value: string): number | undefined {
  const parts = value.split('.');
  if (
    parts.length !== 4 ||
    parts.some((part) => !/^(0|[1-9][0-9]{0,2})$/.test(part) || Number(part) > 255)
  )
    return undefined;
  return parts.reduce((result, part) => result * 256 + Number(part), 0);
}
function unicastRejection(address: string): InterfaceAddressRejection | null {
  const value = ipv4(address);
  if (value === undefined) return 'malformed-address';
  if (value === 0) return 'unspecified-address';
  if (value === 0xffffffff) return 'broadcast-address';
  const first = Math.floor(value / 0x1000000);
  return first === 0 || first >= 224 ? 'non-unicast-address' : null;
}
function addressRejection(address: string, netmask: string): InterfaceAddressRejection | null {
  const rejected = unicastRejection(address);
  if (rejected) return rejected;
  const mask = ipv4(netmask);
  if (mask === undefined) return 'invalid-netmask';
  const inverse = ~mask >>> 0;
  if ((inverse & (inverse + 1)) !== 0) return 'invalid-netmask';
  // /31 point-to-point endpoints and /32 host addresses have no subnet broadcast.
  if (inverse <= 1) return null;
  const host = (ipv4(address)! & inverse) >>> 0;
  if (host === 0) return 'subnet-address';
  return host === inverse ? 'broadcast-address' : null;
}

/** Missing, zero or multicast MACs cannot identify an interface across a rename. */
export function usableInterfaceMac(value: string | undefined): string | undefined {
  if (!value || !/^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(value)) return undefined;
  const normalized = value.toLowerCase().replaceAll('-', ':');
  if (normalized === '00:00:00:00:00:00' || (parseInt(normalized.slice(0, 2), 16) & 1) !== 0)
    return undefined;
  return normalized;
}
function assertName(name: string): void {
  if (typeof name !== 'string' || !name.length || /[\x00-\x1f\x7f]/.test(name))
    throw new TypeError('An interface exclusion requires a nonempty OS interface name');
}
const exclusionKey = (value: NetworkInterfaceExclusion): string =>
  JSON.stringify([value.name, value.mac ?? null]);

/** Invalid saved policy must fail explicitly, never degrade into default-all. */
export function normalizeInterfaceExclusions(
  exclusions: readonly NetworkInterfaceExclusion[],
): NetworkInterfaceExclusion[] {
  const unique = new Map<string, NetworkInterfaceExclusion>();
  for (const value of exclusions) {
    assertName(value.name);
    const mac = usableInterfaceMac(value.mac);
    if (value.mac !== undefined && !mac)
      throw new TypeError('An interface exclusion contains an unusable MAC address');
    const normalized = mac ? { name: value.name, mac } : { name: value.name };
    unique.set(exclusionKey(normalized), normalized);
  }
  return [...unique.values()].sort(
    (a, b) => compare(a.name, b.name) || compare(a.mac ?? '', b.mac ?? ''),
  );
}

/** No I/O, timers, runtime discovery, mutation of inputs or cap inherited from LAN discovery. */
export function computeNetworkInterfacePolicy(
  snapshot: NetworkInterfaceSnapshot,
  exclusions: readonly NetworkInterfaceExclusion[] = [],
): NetworkInterfacePolicy {
  const normalized = normalizeInterfaceExclusions(exclusions);
  const owners = new Map<string, Map<string, boolean>>();
  const interfaces: NetworkInterfaceInventory[] = Object.entries(snapshot)
    .sort(([a], [b]) => compare(a, b))
    .map(([name, entries]) => {
      assertName(name);
      const addresses = new Map<string, LocalIpv4Address>();
      const rejected = new Map<string, RejectedInterfaceAddress>();
      const macs = new Set<string>();
      for (const entry of entries ?? []) {
        const mac = usableInterfaceMac(entry.mac);
        if (mac) macs.add(mac);
        if (entry.family === 'IPv6' || entry.family === 6) continue;
        const reason =
          entry.family === 'IPv4' || entry.family === 4
            ? addressRejection(entry.address, entry.netmask)
            : 'unsupported-family';
        if (
          (entry.family === 'IPv4' || entry.family === 4) &&
          unicastRejection(entry.address) === null
        ) {
          let names = owners.get(entry.address);
          if (!names) owners.set(entry.address, (names = new Map()));
          // Conflicting metadata for one owner remains ineligible, regardless of input order.
          names.set(name, (names.get(name) ?? true) && reason === null);
        }
        if (reason) {
          const value = { address: entry.address, reason };
          rejected.set(JSON.stringify(value), value);
          continue;
        }
        const value = {
          address: entry.address,
          netmask: entry.netmask,
          prefixLength: 32 - Math.log2((~ipv4(entry.netmask)! >>> 0) + 1),
          internal: entry.internal,
        };
        addresses.set(JSON.stringify(value), value);
      }
      const sortedMacs = [...macs].sort(compare);
      return {
        name,
        macs: sortedMacs,
        identity:
          sortedMacs.length === 0
            ? 'name-only'
            : sortedMacs.length === 1
              ? 'name-and-mac'
              : 'multiple-macs',
        addresses: [...addresses.values()].sort(
          (a, b) =>
            ipv4(a.address)! - ipv4(b.address)! ||
            a.prefixLength - b.prefixLength ||
            Number(a.internal) - Number(b.internal),
        ),
        rejected: [...rejected.values()].sort(
          (a, b) => compare(a.address, b.address) || compare(a.reason, b.reason),
        ),
        excluded: normalized.some(
          (value) => value.name === name || (!!value.mac && macs.has(value.mac)),
        ),
      };
    });
  const excludedNames = new Set(
    interfaces.filter((entry) => entry.excluded).map(({ name }) => name),
  );
  const addresses = [...owners.entries()]
    .sort(([a], [b]) => ipv4(a)! - ipv4(b)!)
    .map(([address, names]) => {
      const interfaceNames = [...names.keys()].sort(compare);
      const excluded = interfaceNames.filter((name) => excludedNames.has(name));
      const reason = excluded.length
        ? excluded.length === interfaceNames.length
          ? ('excluded-interface' as const)
          : ('shared-address' as const)
        : [...names.values()].some((valid) => !valid)
          ? ('invalid-interface-address' as const)
          : null;
      return { address, interfaceNames, allowed: reason === null, reason };
    });
  return {
    interfaces,
    addresses,
    listenAddresses: addresses.filter((value) => value.allowed).map(({ address }) => address),
    exclusions: normalized.map((exclusion) => {
      const matches = interfaces.filter(
        (entry) =>
          entry.name === exclusion.name || (!!exclusion.mac && entry.macs.includes(exclusion.mac)),
      );
      return {
        exclusion,
        matchingNames: matches.map(({ name }) => name),
        absent: matches.length === 0,
        ambiguous: matches.length > 1 || matches.some((entry) => entry.macs.length > 1),
      };
    }),
  };
}

/** Capture every usable MAC hint; absence of a MAC leaves only the exact OS name. */
export function exclusionsForInterface(
  snapshot: NetworkInterfaceSnapshot,
  name: string,
): NetworkInterfaceExclusion[] {
  const entry = computeNetworkInterfacePolicy(snapshot).interfaces.find(
    (value) => value.name === name,
  );
  if (!entry) throw new Error('The selected network interface is not present');
  return entry.macs.length
    ? entry.macs.map((mac) => ({ name: entry.name, mac }))
    : [{ name: entry.name }];
}

/** Remove only the exact owner-selected record; callers must surface all affected matches. */
export function removeInterfaceExclusion(
  exclusions: readonly NetworkInterfaceExclusion[],
  selected: NetworkInterfaceExclusion,
): NetworkInterfaceExclusion[] {
  const key = exclusionKey(normalizeInterfaceExclusions([selected])[0]);
  return normalizeInterfaceExclusions(exclusions).filter((value) => exclusionKey(value) !== key);
}

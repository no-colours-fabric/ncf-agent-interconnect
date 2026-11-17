import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNetworkInterfacePolicy,
  exclusionsForInterface,
  normalizeInterfaceExclusions,
  removeInterfaceExclusion,
  usableInterfaceMac,
} from '../desktop/core/network-interfaces.js';
import type {
  NetworkInterfaceAddressInput,
  NetworkInterfaceSnapshot,
} from '../desktop/shared/network-interfaces.js';

const macA = '02:00:00:00:00:01';
const macB = '02:00:00:00:00:02';
const macC = '02:00:00:00:00:03';
const ip = (
  address: string,
  mac = macA,
  extra: Partial<NetworkInterfaceAddressInput> = {},
): NetworkInterfaceAddressInput => ({
  address,
  netmask: '255.255.255.0',
  family: 'IPv4',
  mac,
  internal: false,
  ...extra,
});
const loopback = () =>
  ip('127.0.0.1', '00:00:00:00:00:00', { netmask: '255.0.0.0', internal: true });

test('default-all includes assigned loopback, VPN, virtual, link-local, /31 and /32 IPv4 only', () => {
  const snapshot = {
    loopback: [loopback(), ip('::1', '', { family: 'IPv6', netmask: 'ffff:ffff:ffff:ffff::' })],
    ethernet: [ip('192.0.2.10')],
    vpn: [ip('10.8.0.4', macB, { netmask: '255.255.255.255' })],
    virtual: [ip('198.18.0.0', macC, { netmask: '255.255.255.254', family: 4 })],
    linklocal: [ip('169.254.10.20', '', { netmask: '255.255.0.0' })],
    v6only: [ip('2001:db8::1', macC, { family: 6, netmask: 'ffff:ffff:ffff:ffff::' })],
    detached: undefined,
  } satisfies NetworkInterfaceSnapshot;
  const policy = computeNetworkInterfacePolicy(snapshot);
  assert.deepEqual(policy.listenAddresses, [
    '10.8.0.4',
    '127.0.0.1',
    '169.254.10.20',
    '192.0.2.10',
    '198.18.0.0',
  ]);
  assert.equal(policy.interfaces.length, 7);
  assert.equal(policy.interfaces.find(({ name }) => name === 'v6only')!.rejected.length, 0);
  assert.equal(
    policy.interfaces.find(({ name }) => name === 'virtual')!.addresses[0].prefixLength,
    31,
  );
  assert.deepEqual(computeNetworkInterfacePolicy({}).listenAddresses, []);
  assert.deepEqual(policy.exclusions, []);
});

test('new interfaces and secondary addresses are eligible without altering old input or exclusions', () => {
  const before = Object.freeze({
    en0: Object.freeze([Object.freeze(ip('192.0.2.10'))]),
  });
  const first = computeNetworkInterfacePolicy(before);
  const after = { ...before, en0: [...before.en0, ip('192.0.2.11')], vpn: [ip('10.0.0.2', macB)] };
  assert.deepEqual(computeNetworkInterfacePolicy(after).listenAddresses, [
    '10.0.0.2',
    '192.0.2.10',
    '192.0.2.11',
  ]);
  assert.deepEqual(first.listenAddresses, ['192.0.2.10']);
  assert.equal(before.en0.length, 1);
});

test('an exclusion follows name across DHCP and MAC changes, without excluding a reused IP elsewhere', () => {
  const excluded = exclusionsForInterface({ en0: [ip('192.0.2.10')] }, 'en0');
  const policy = computeNetworkInterfacePolicy(
    {
      en0: [ip('192.0.2.30', macB), ip('192.0.2.31', macB)],
      en1: [ip('192.0.2.10', macC)],
      lo: [loopback()],
    },
    excluded,
  );
  assert.deepEqual(policy.listenAddresses, ['127.0.0.1', '192.0.2.10']);
  assert.deepEqual(policy.exclusions[0].matchingNames, ['en0']);
  assert.equal(policy.exclusions[0].ambiguous, false);
});

test('a normalized usable MAC preserves the exclusion across interface rename', () => {
  const policy = computeNetworkInterfacePolicy(
    {
      'Ethernet 新': [ip('192.0.2.25', '02-00-00-00-00-0A')],
      ethernet: [ip('198.51.100.25', macB)],
    },
    [{ name: 'Old interface', mac: '02:00:00:00:00:0A' }],
  );
  assert.deepEqual(policy.listenAddresses, ['198.51.100.25']);
  assert.deepEqual(policy.exclusions[0].matchingNames, ['Ethernet 新']);
  assert.equal(policy.exclusions[0].absent, false);
  assert.equal(policy.exclusions[0].exclusion.mac, '02:00:00:00:00:0a');
});

test('exact OS names retain Unicode and case distinctions', () => {
  const policy = computeNetworkInterfacePolicy(
    {
      Сеть: [ip('192.0.2.10', '')],
      сеть: [ip('192.0.2.11', '')],
    },
    [{ name: 'Сеть' }],
  );
  assert.deepEqual(policy.listenAddresses, ['192.0.2.11']);
  assert.deepEqual(policy.exclusions[0].matchingNames, ['Сеть']);
});

test('name/MAC disagreement and duplicate MACs exclude every ambiguous match', () => {
  const policy = computeNetworkInterfacePolicy(
    {
      en0: [ip('192.0.2.10', macB)],
      en1: [ip('192.0.2.11', macA)],
      bridge: [ip('192.0.2.12', macA)],
      vpn: [ip('10.8.0.4', macC)],
    },
    [{ name: 'en0', mac: macA }],
  );
  assert.deepEqual(policy.listenAddresses, ['10.8.0.4']);
  assert.deepEqual(policy.exclusions[0].matchingNames, ['bridge', 'en0', 'en1']);
  assert.equal(policy.exclusions[0].ambiguous, true);
});

test('an excluded owner denies a shared destination IP on every interface', () => {
  const policy = computeNetworkInterfacePolicy(
    {
      en0: [ip('192.0.2.10', macA)],
      bridge: [ip('192.0.2.10', macB), ip('192.0.2.11', macB)],
    },
    [{ name: 'en0' }],
  );
  assert.deepEqual(policy.listenAddresses, ['192.0.2.11']);
  assert.deepEqual(policy.addresses[0], {
    address: '192.0.2.10',
    interfaceNames: ['bridge', 'en0'],
    allowed: false,
    reason: 'shared-address',
  });
});

test('missing and unusable MACs retain a name-only exclusion with honest rename limits', () => {
  for (const mac of [
    '',
    '00:00:00:00:00:00',
    'ff:ff:ff:ff:ff:ff',
    '01:00:00:00:00:01',
    'invalid',
  ]) {
    const excluded = exclusionsForInterface({ tunnel: [ip('10.8.0.4', mac)] }, 'tunnel');
    assert.deepEqual(excluded, [{ name: 'tunnel' }]);
    assert.equal(
      computeNetworkInterfacePolicy({ tunnel: [ip('10.8.0.5', mac)] }, excluded).listenAddresses
        .length,
      0,
    );
    const renamed = computeNetworkInterfacePolicy({ renamed: [ip('10.8.0.5', mac)] }, excluded);
    assert.equal(renamed.exclusions[0].absent, true);
    assert.equal(renamed.interfaces[0].identity, 'name-only');
  }
});

test('absent exclusions survive removal/reappearance and can be explicitly removed for recovery', () => {
  const exclusions = Object.freeze([
    Object.freeze({ name: 'vpn', mac: macA }),
    Object.freeze({ name: 'missing' }),
  ]);
  const absent = computeNetworkInterfacePolicy({}, exclusions);
  assert.equal(absent.exclusions.length, 2);
  assert.ok(absent.exclusions.every((value) => value.absent));
  const snapshot = { vpn: [ip('10.8.0.4')] };
  assert.deepEqual(computeNetworkInterfacePolicy(snapshot, exclusions).listenAddresses, []);
  const recovered = removeInterfaceExclusion(exclusions, { name: 'vpn', mac: macA });
  assert.deepEqual(recovered, [{ name: 'missing' }]);
  assert.deepEqual(computeNetworkInterfacePolicy(snapshot, recovered).listenAddresses, [
    '10.8.0.4',
  ]);
  assert.equal(exclusions.length, 2);
});

test('rejects malformed, wildcard, non-unicast, subnet and broadcast addresses and invalid masks', () => {
  const invalid = [
    ip('0.0.0.0'),
    ip('0.1.2.3'),
    ip('224.0.0.1'),
    ip('239.255.73.36'),
    ip('240.0.0.1'),
    ip('255.255.255.255'),
    ip('192.0.2.0'),
    ip('192.0.2.255'),
    ip('192.0.2.256'),
    ip('192.0.02.1'),
    ip('192.0.2.1 '),
    ip('192.0.2'),
    ip('host.invalid'),
    ip('*'),
    ip('192.0.2.1', macA, { netmask: '255.0.255.0' }),
    ip('192.0.2.2', macA, { netmask: 'invalid' }),
    ip('192.0.2.3', macA, { family: 'unknown' }),
  ];
  const policy = computeNetworkInterfacePolicy({ bad: invalid });
  assert.deepEqual(policy.listenAddresses, []);
  assert.equal(policy.interfaces[0].rejected.length, invalid.length);
  const valid = computeNetworkInterfacePolicy({
    point: [
      ip('198.51.100.0', macA, { netmask: '255.255.255.254' }),
      ip('198.51.100.1', macA, { netmask: '255.255.255.254' }),
    ],
    host: [ip('192.0.2.255', macB, { netmask: '255.255.255.255' })],
  });
  assert.deepEqual(valid.listenAddresses, ['192.0.2.255', '198.51.100.0', '198.51.100.1']);
});

test('invalid metadata on any shared owner cannot be bypassed by another valid owner', () => {
  const snapshot = {
    en0: [ip('192.0.2.10', macA, { netmask: 'invalid' })],
    en1: [ip('192.0.2.10', macB), ip('192.0.2.11', macB)],
  };
  const policy = computeNetworkInterfacePolicy(snapshot);
  assert.deepEqual(policy.listenAddresses, ['192.0.2.11']);
  assert.equal(policy.addresses[0].reason, 'invalid-interface-address');
  assert.equal(
    computeNetworkInterfacePolicy(snapshot, [{ name: 'en0' }]).addresses[0].reason,
    'shared-address',
  );
});

test('inventory does not inherit discovery interface caps and deduplicates listen addresses', () => {
  const snapshot = Object.fromEntries(
    Array.from({ length: 48 }, (_, index) => [
      `nic-${index}`,
      [ip(`198.18.${index}.1`, '', { netmask: '255.255.0.0' })],
    ]),
  );
  snapshot.duplicate = [ip('198.18.0.1', '')];
  const policy = computeNetworkInterfacePolicy(snapshot);
  assert.equal(policy.interfaces.length, 49);
  assert.equal(policy.listenAddresses.length, 48);
  assert.deepEqual(policy.addresses[0].interfaceNames, ['duplicate', 'nic-0']);
});

test('multiple MAC hints remain visible and generate explicit exclusions for each hint', () => {
  const snapshot = { en0: [ip('192.0.2.10', macA), ip('192.0.2.11', macB)] };
  const excluded = exclusionsForInterface(snapshot, 'en0');
  assert.deepEqual(excluded, [
    { name: 'en0', mac: macA },
    { name: 'en0', mac: macB },
  ]);
  const policy = computeNetworkInterfacePolicy(snapshot, excluded);
  assert.equal(policy.interfaces[0].identity, 'multiple-macs');
  assert.ok(policy.exclusions.every((value) => value.ambiguous));
  assert.deepEqual(policy.listenAddresses, []);
  assert.throws(() => exclusionsForInterface(snapshot, 'absent'), /not present/);
});

test('normalization is deterministic, detached and never drops invalid saved policy into default-all', () => {
  const exclusions = [
    { name: 'en0', mac: '02-00-00-00-00-0A' },
    { name: 'en0', mac: '02:00:00:00:00:0a' },
    { name: 'other' },
  ];
  assert.deepEqual(normalizeInterfaceExclusions(exclusions), [
    { name: 'en0', mac: '02:00:00:00:00:0a' },
    { name: 'other' },
  ]);
  assert.equal(usableInterfaceMac('02-00-00-00-00-0A'), '02:00:00:00:00:0a');
  for (const exclusion of [
    { name: '' },
    { name: 'bad\nname' },
    { name: 'en0', mac: 'bad' },
    { name: 'en0', mac: '00:00:00:00:00:00' },
  ]) {
    assert.throws(() => computeNetworkInterfacePolicy({}, [exclusion]), TypeError);
  }
  const snapshot = {
    z: [ip('192.0.2.10'), ip('192.0.2.10'), loopback()],
    a: [ip('10.0.0.2', macB)],
  };
  const reversed = Object.fromEntries(
    Object.entries(snapshot)
      .reverse()
      .map(([name, entries]) => [name, [...entries].reverse()]),
  );
  const first = computeNetworkInterfacePolicy(snapshot, exclusions);
  assert.deepEqual(first, computeNetworkInterfacePolicy(reversed, [...exclusions].reverse()));
  assert.notEqual(first.interfaces[1].addresses[0], snapshot.z[0]);
});

test('recovery removes the exact record without silently removing other exclusions for the same name', () => {
  const exclusions = [{ name: 'en0', mac: macA }, { name: 'en0', mac: macB }, { name: 'en1' }];
  assert.deepEqual(removeInterfaceExclusion(exclusions, { name: 'en0', mac: macA }), [
    { name: 'en0', mac: macB },
    { name: 'en1' },
  ]);
  assert.deepEqual(removeInterfaceExclusion(exclusions, { name: 'absent' }), exclusions);
});

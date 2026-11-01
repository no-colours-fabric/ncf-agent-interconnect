import test from 'node:test';
import assert from 'node:assert/strict';
import { createNodeLabelResolver } from '../desktop/renderer/node-labels.js';
import type { Snapshot, AgentDirectory } from '../desktop/shared/contracts.js';

type Names = Pick<Snapshot, 'nodeId' | 'nodeLabel' | 'peers' | 'directories'>;
const local = '00000000-0000-4000-8000-000000000001';
const first = '00000000-0000-4000-8000-000000000002';
const second = '00000000-0000-4000-8000-000000000003';
const peer = (id: string, label: string) => ({
  id,
  label,
  address: '',
  connected: true,
  error: null,
});
const directory = (nodeId: string, nodeLabel: string): AgentDirectory => ({
  nodeId,
  nodeLabel,
  local: false,
  state: 'offline',
  epoch: null,
  revision: null,
  updatedAt: null,
  total: 0,
  truncated: false,
  agents: [],
});
const fixture = (): Names => ({
  nodeId: local,
  nodeLabel: 'Local Mac',
  peers: [peer(first, 'Remote Windows')],
  directories: [directory(first, 'Stale directory'), directory(second, 'Directory only')],
});

test('local label outranks peers, configured peers outrank directories and empty labels fall through', () => {
  const snapshot = fixture();
  snapshot.peers.push(peer(local, 'Wrong local label'));
  snapshot.directories.push(directory(local, 'Also wrong'));
  const labels = createNodeLabelResolver()(snapshot, 'en');
  assert.equal(labels(local), 'Local Mac');
  assert.equal(labels(first), 'Remote Windows');
  assert.equal(labels(second), 'Directory only');
  snapshot.peers[0].label = '';
  assert.equal(createNodeLabelResolver()(snapshot, 'en')(first), 'Stale directory');
});

test('unknown historical nodes receive distinct localized aliases without exposing identifiers', () => {
  const resolver = createNodeLabelResolver();
  const labels = resolver(fixture(), 'en');
  const firstUnknown = labels('historical-one'),
    secondUnknown = labels('historical-two');
  assert.match(firstUnknown, /^Unknown computer \(\d+\)$/);
  assert.notEqual(firstUnknown, secondUnknown);
  assert.equal(resolver(fixture(), 'en')('historical-one'), firstUnknown);
  assert.match(resolver(fixture(), 'ru')('historical-one'), /^Неизвестный компьютер \(\d+\)$/);
});

test('duplicate machine names stay attached to UUIDs across reorder and rename', () => {
  const snapshot = fixture();
  snapshot.peers.push(peer(second, 'remote windows'));
  const resolver = createNodeLabelResolver();
  const initial = resolver(snapshot, 'en');
  const a = initial(first),
    b = initial(second);
  assert.notEqual(a.toLowerCase(), b.toLowerCase());
  snapshot.peers.reverse();
  snapshot.directories.reverse();
  assert.equal(resolver(snapshot, 'en')(first), a);
  assert.equal(resolver(snapshot, 'en')(second), b);
  snapshot.peers.find((p) => p.id === first)!.label = 'Renamed machine';
  assert.equal(resolver(snapshot, 'en')(first), 'Renamed machine');
  snapshot.peers.find((p) => p.id === first)!.label = 'Remote Windows';
  assert.equal(resolver(snapshot, 'en')(first), a);
});

test('window restart resets ordinal allocation; identical known snapshots have deterministic numbering', () => {
  const snapshot = fixture();
  snapshot.peers.push(peer(second, 'Remote Windows'));
  const firstWindow = createNodeLabelResolver()(snapshot, 'en');
  const newWindow = createNodeLabelResolver()(snapshot, 'en');
  assert.equal(firstWindow(first), newWindow(first));
  const one = firstWindow('earlier-unknown');
  const two = firstWindow('later-unknown');
  assert.equal(newWindow('later-unknown'), one);
  assert.notEqual(newWindow('later-unknown'), two);
});

test('literal user labels are preserved and generated suffixes cannot collide with them', () => {
  const snapshot = fixture();
  const literal = "Machine $& $$ $` $' {node} Ж 漢字";
  snapshot.nodeLabel = literal;
  const resolver = createNodeLabelResolver();
  assert.equal(resolver(snapshot, 'en')(local), literal);
  snapshot.peers = [peer(first, 'Work'), peer(second, 'Work'), peer('extra', 'Work (2)')];
  const labels = resolver(snapshot, 'en');
  assert.equal(labels('extra'), 'Work (2)');
  assert.equal(new Set([labels(first), labels(second), labels('extra')]).size, 3);
});

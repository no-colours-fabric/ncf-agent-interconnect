import type { Snapshot } from '../shared/contracts.js';
import { t, type Locale } from './i18n/index.js';

type NodeSnapshot = Pick<Snapshot, 'nodeId' | 'nodeLabel' | 'peers' | 'directories'>;
const labelKey = (label: string) => label.trim().normalize('NFC').toLowerCase();

// Ordinals belong to this window, survive refresh/reorder/rename and reset on restart.
// Reloading the renderer also starts a new registry; ordinals are not persisted.
// They distinguish labels only; callers continue addressing nodes by their full UUID.
export function createNodeLabelResolver() {
  const ordinals = new Map<string, number>();
  const ordinal = (id: string) => {
    if (!ordinals.has(id)) ordinals.set(id, ordinals.size + 1);
    return ordinals.get(id)!;
  };
  return (snapshot: NodeSnapshot, locale: Locale): ((id: string) => string) => {
    const names = new Map<string, string>();
    const add = (id: string, name: string) => {
      if (name.trim() && !names.has(id)) names.set(id, name);
    };
    add(snapshot.nodeId, snapshot.nodeLabel);
    for (const peer of snapshot.peers) add(peer.id, peer.label);
    for (const directory of snapshot.directories) add(directory.nodeId, directory.nodeLabel);
    for (const id of [...names.keys()].sort()) ordinal(id);
    const counts = new Map<string, number>();
    for (const name of names.values())
      counts.set(labelKey(name), (counts.get(labelKey(name)) ?? 0) + 1);
    const reserved = new Set([...names.values()].map(labelKey));
    const resolved = new Map<string, string>();
    const used = new Set<string>();
    const numbered = (id: string, name: string) => {
      let attempt = 0,
        result: string;
      do {
        result = `${name} (${ordinal(id)}${attempt ? '.' + attempt : ''})`;
        attempt++;
      } while (reserved.has(labelKey(result)) || used.has(labelKey(result)));
      return result;
    };
    for (const [id, name] of [...names].sort(([a], [b]) => ordinal(a) - ordinal(b))) {
      const label = counts.get(labelKey(name))! > 1 ? numbered(id, name) : name;
      resolved.set(id, label);
      used.add(labelKey(label));
    }
    return (id: string) => {
      if (!resolved.has(id)) {
        const label = numbered(id, t(locale, 'unknownComputer'));
        resolved.set(id, label);
        used.add(labelKey(label));
      }
      return resolved.get(id)!;
    };
  };
}

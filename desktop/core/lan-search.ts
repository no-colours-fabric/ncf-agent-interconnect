import { performance } from 'node:perf_hooks';
import type { LanDiscoveryObservation } from '../shared/lan-discovery.js';
import type { LanSearchSnapshot } from '../shared/lan-search.js';
import { LanDiscovery, type LanDiscoveryOptions, type LocalLanNode } from './lan-discovery.js';

export const lanSearchLimits = Object.freeze({
  durationMs: 30000,
  entries: 128,
  retentionMs: 10 * 60 * 1000,
});

export interface LanSearchOptions extends Omit<
  LanDiscoveryOptions,
  'changed' | 'observed' | 'querying'
> {
  changed?: () => void;
  pairedNodeIds?: () => readonly string[];
}

interface Observation {
  node: LanDiscoveryObservation;
  lastSeen: number;
  firstRun: number;
  seen: boolean;
}

/** Owns search UX state without granting trust or configuring a listener. */
export class LanSearch {
  private readonly discovery: LanDiscovery;
  private readonly observations = new Map<string, Observation>();
  private readonly responders = new Set<string>();
  private phase: LanSearchSnapshot['phase'] = 'stopped';
  private reason: LanSearchSnapshot['reason'] = null;
  private opened = false;
  private generation = 0;
  private runId = 0;
  private startedAt = 0;
  private elapsedMs = 0;
  private lastNow = -Infinity;
  private dirty = false;
  private cancelTick?: () => void;

  constructor(private readonly options: LanSearchOptions) {
    this.discovery = new LanDiscovery({
      ...options,
      now: () => this.now(),
      querying: false,
      observed: (node) => this.observe(node),
      changed: () => this.transportChanged(),
    });
  }

  /** Opens the transport for announcements; an owner search is a separate action. */
  async open(): Promise<void> {
    if (this.opened) return;
    this.stopTransport();
    this.phase = 'stopped';
    this.reason = null;
    const generation = this.generation;
    await this.discovery.start();
    if (generation !== this.generation) return;
    const transport = this.discovery.snapshot();
    this.opened = transport.state === 'searching';
    if (transport.state === 'unavailable') {
      this.phase = 'unavailable';
      this.reason = transport.reason;
    }
    if (this.opened) {
      const every =
        this.options.every ??
        ((callback, milliseconds) => {
          const timer = setInterval(callback, milliseconds);
          timer.unref();
          return () => clearInterval(timer);
        });
      this.cancelTick = every(() => {
        if (generation === this.generation) this.tick();
      }, 1000);
    }
    this.notify();
  }

  startSearch(): boolean {
    if (!this.opened || this.discovery.snapshot().state !== 'searching') return false;
    const now = this.now();
    this.prune(now);
    this.runId++;
    this.startedAt = now;
    this.elapsedMs = 0;
    this.responders.clear();
    this.phase = 'searching';
    this.reason = null;
    this.discovery.setQuerying(true, now + lanSearchLimits.durationMs);
    this.notify();
    return this.phase === 'searching';
  }

  stopSearch(): void {
    this.refresh(this.now());
    if (this.phase !== 'searching') return;
    this.phase = 'stopped';
    this.discovery.setQuerying(false);
    this.notify();
  }

  acknowledge(keys: readonly string[]): void {
    let changed = false;
    for (const key of keys.slice(0, lanSearchLimits.entries)) {
      const observation = this.observations.get(key);
      if (observation && !observation.seen) {
        observation.seen = true;
        changed = true;
      }
    }
    if (changed) this.notify();
  }

  updateLocal(local: LocalLanNode): void {
    this.discovery.updateLocal(local);
  }

  discoverySnapshot(): ReturnType<LanDiscovery['snapshot']> {
    return this.discovery.snapshot();
  }

  snapshot(): LanSearchSnapshot {
    const now = this.now();
    this.refresh(now);
    this.prune(now);
    const paired = new Set(this.options.pairedNodeIds?.() ?? []);
    const observations = [...this.observations.values()].sort((a, b) =>
      a.node.key.localeCompare(b.node.key, 'en'),
    );
    return {
      phase: this.phase,
      reason: this.reason,
      runId: this.runId,
      durationMs: lanSearchLimits.durationMs,
      elapsedMs: this.elapsedMs,
      foundCount: this.responders.size,
      nodes: observations.map(({ node, lastSeen, firstRun }) => ({
        ...node,
        observedInRun: this.responders.has(node.key),
        newlyFound: firstRun === this.runId,
        lastSeenAgoMs: Math.max(0, now - lastSeen),
      })),
      unseenKeys: observations
        .filter(({ node, seen }) => !seen && !paired.has(node.nodeId))
        .map(({ node }) => node.key),
    };
  }

  close(): void {
    this.stopTransport();
    this.phase = 'stopped';
    this.reason = null;
    this.elapsedMs = 0;
    this.observations.clear();
    this.responders.clear();
    this.dirty = false;
  }

  private stopTransport(): void {
    this.generation++;
    this.cancelTick?.();
    this.cancelTick = undefined;
    this.discovery.setQuerying(false);
    this.discovery.stop();
    this.opened = false;
  }

  private now(): number {
    const value = (this.options.now ?? (() => performance.now()))();
    if (Number.isFinite(value)) this.lastNow = Math.max(this.lastNow, value);
    return Number.isFinite(this.lastNow) ? this.lastNow : 0;
  }

  private observe(node: LanDiscoveryObservation): void {
    const now = this.now();
    this.refresh(now);
    if (this.phase !== 'searching') return;
    // Responses refresh the engine's 30s cache, so a 30s pass cannot exceed its cap.
    if (!this.responders.has(node.key) && this.responders.size >= lanSearchLimits.entries) return;
    const previous = this.observations.get(node.key);
    if (!previous && this.observations.size >= lanSearchLimits.entries) {
      const oldest = [...this.observations.values()]
        .filter((entry) => !this.responders.has(entry.node.key))
        .sort((a, b) => a.lastSeen - b.lastSeen)[0];
      if (!oldest) return;
      this.observations.delete(oldest.node.key);
    }
    this.observations.set(node.key, {
      node: Object.freeze({ ...node }),
      lastSeen: now,
      firstRun: previous?.firstRun ?? this.runId,
      seen: previous?.seen ?? false,
    });
    if (!this.responders.has(node.key) || previous?.node.label !== node.label) this.dirty = true;
    this.responders.add(node.key);
  }

  private refresh(now: number): void {
    if (this.phase !== 'searching') return;
    this.elapsedMs = Math.min(lanSearchLimits.durationMs, Math.max(0, now - this.startedAt));
    if (this.elapsedMs >= lanSearchLimits.durationMs) {
      this.phase = 'complete';
      this.discovery.setQuerying(false);
      this.dirty = true;
    }
  }

  private prune(now: number): void {
    for (const [key, entry] of this.observations) {
      if (now - entry.lastSeen >= lanSearchLimits.retentionMs) {
        this.observations.delete(key);
        this.dirty = true;
      }
    }
  }

  private transportChanged(): void {
    const state = this.discovery.snapshot();
    if (state.state === 'searching') {
      this.opened = true;
      if (this.phase === 'unavailable') {
        this.phase = 'stopped';
        this.reason = null;
      }
      this.notify();
      return;
    }
    if (state.state !== 'unavailable') return;
    if (state.reason === 'no-interfaces' && this.phase === 'searching') {
      this.opened = false;
      this.notify();
      return;
    }
    this.opened = false;
    this.refresh(this.now());
    this.phase = 'unavailable';
    this.reason = state.reason;
    this.discovery.setQuerying(false);
    this.notify();
  }

  private tick(): void {
    const searching = this.phase === 'searching';
    const now = this.now();
    this.refresh(now);
    this.prune(now);
    if (searching || this.dirty) this.notify();
  }

  private notify(): void {
    this.dirty = false;
    this.options.changed?.();
  }
}

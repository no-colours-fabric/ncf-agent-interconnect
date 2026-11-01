import { randomUUID } from 'node:crypto';
import {
  nicknameKey,
  directorySnapshotSchema,
  type AgentDirectory,
  type DirectoryAgent,
  type DirectorySnapshot,
} from '../shared/contracts.js';

// Live evidence is deliberately separate from durable chat bindings and mailboxes.
export class AgentPresence {
  private sessions = new Map<
    string,
    {
      online: boolean;
      connections: Set<string>;
      version: number;
      expires: number;
      timer?: NodeJS.Timeout;
    }
  >();
  private remote = new Map<string, { snapshot: DirectorySnapshot; updatedAt: string }>();
  private local: DirectorySnapshot = { epoch: randomUUID(), revision: 0, agents: [], total: 0 };
  private signature = '';
  constructor(
    private readonly changed: () => void,
    private readonly leaseMs = 20000,
  ) {}

  touch(session: string, connectionId?: string): void {
    const evidence = this.sessions.get(session) ?? {
      online: false,
      connections: new Set<string>(),
      version: 0,
      expires: 0,
    };
    if (connectionId) evidence.connections.add(connectionId);
    evidence.online = true;
    evidence.version++;
    evidence.expires = Date.now() + this.leaseMs;
    clearTimeout(evidence.timer);
    const version = evidence.version;
    evidence.timer = setTimeout(() => this.uncertain(session, version), this.leaseMs + 1);
    evidence.timer.unref();
    this.sessions.set(session, evidence);
    this.changed();
  }
  version(session: string): number {
    return this.sessions.get(session)?.version ?? 0;
  }
  uncertain(session: string, observedVersion = this.version(session)): boolean {
    const evidence = this.sessions.get(session);
    if (this.version(session) !== observedVersion) return false;
    if (evidence && Date.now() < evidence.expires) return false;
    if (evidence?.online) {
      evidence.online = false;
      this.changed();
    }
    return true;
  }
  close(session: string): void {
    clearTimeout(this.sessions.get(session)?.timer);
    if (this.sessions.delete(session)) this.changed();
  }
  isOnline(connectionId: string): boolean {
    return [...this.sessions.values()].some(
      (value) => value.online && value.connections.has(connectionId),
    );
  }
  reset(): void {
    for (const evidence of this.sessions.values()) clearTimeout(evidence.timer);
    this.sessions.clear();
    this.remote.clear();
    this.local = { epoch: randomUUID(), revision: 0, agents: [], total: 0 };
    this.signature = '';
  }
  update(agents: DirectoryAgent[]): boolean {
    agents.sort((a, b) => nicknameKey(a.nickname).localeCompare(nicknameKey(b.nickname)));
    const signature = JSON.stringify(agents);
    if (signature === this.signature) return false;
    this.signature = signature;
    const bounded: DirectoryAgent[] = [];
    let bytes = 256;
    for (const agent of agents) {
      const size = Buffer.byteLength(JSON.stringify(agent)) + 1;
      if (bounded.length === 1000 || bytes + size > 384 * 1024) break;
      bounded.push(agent);
      bytes += size;
    }
    this.local = {
      ...this.local,
      revision: this.local.revision + 1,
      total: agents.length,
      agents: bounded,
    };
    return true;
  }
  snapshot(): DirectorySnapshot {
    return this.local;
  }
  begin(peerId: string): void {
    this.remote.delete(peerId);
  }
  receive(peerId: string, raw: DirectorySnapshot): boolean {
    const snapshot = directorySnapshotSchema.parse(raw),
      old = this.remote.get(peerId);
    if (
      old &&
      (old.snapshot.epoch !== snapshot.epoch || old.snapshot.revision >= snapshot.revision)
    )
      return false;
    if (
      new Set(snapshot.agents.map((agent) => nicknameKey(agent.nickname))).size !==
      snapshot.agents.length
    )
      throw new Error('The remote directory contains duplicate names');
    this.remote.set(peerId, { snapshot, updatedAt: new Date().toISOString() });
    return true;
  }
  remoteDirectory(
    nodeId: string,
    nodeLabel: string,
    connected: boolean,
    supported: boolean,
  ): AgentDirectory {
    const cached = this.remote.get(nodeId),
      snapshot = cached?.snapshot;
    const state = !connected
      ? 'offline'
      : !supported
        ? 'unsupported'
        : !snapshot
          ? 'syncing'
          : 'ready';
    return {
      nodeId,
      nodeLabel,
      local: false,
      state,
      epoch: snapshot?.epoch ?? null,
      revision: snapshot?.revision ?? null,
      updatedAt: cached?.updatedAt ?? null,
      total: snapshot?.total ?? 0,
      truncated: !!snapshot && snapshot.total > snapshot.agents.length,
      agents: state === 'ready' ? snapshot!.agents : [],
    };
  }
}

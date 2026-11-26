import { createSocket, type Socket } from 'node:dgram';
import { isIPv4 } from 'node:net';
import { networkInterfaces } from 'node:os';
import { performance } from 'node:perf_hooks';
import { z } from 'zod';
import type {
  DiscoveredLanNode,
  LanAnnouncementUnavailable,
  LanDiscoverySnapshot,
  LanDiscoveryObservation,
  LanPairSelection,
} from '../shared/lan-discovery.js';

export const lanDiscoveryLimits = Object.freeze({
  group: '239.255.73.36',
  port: 7337,
  packetBytes: 1024,
  cacheEntries: 128,
  cacheMs: 30000,
  packetsPerSecond: 64,
  sourcePacketsPerSecond: 8,
  announceMs: 10000,
  replyMs: 2000,
  replyBatch: 8,
  queryMs: 10000,
  queryRestartMs: 1000,
  interfaces: 32,
});

const base = { service: z.literal('ncf-agent-interconnect'), version: z.literal(1) };
const identity = {
  nodeId: z.uuid(),
  label: z
    .string()
    .min(1)
    .max(120)
    .refine((value) => !!value.trim() && !/[\p{Cc}\u202a-\u202e\u2066-\u2069]/u.test(value)),
};
const announcementSchema = z
  .object({
    ...base,
    type: z.literal('announce'),
    ...identity,
    peerPort: z.number().int().min(1).max(65535),
  })
  .strict();
const querySchema = z.object({ ...base, type: z.literal('query') }).strict();
const directQueryPadding = '0'.repeat(512);
const directQuerySchema = z
  .object({ ...base, type: z.literal('direct-query'), padding: z.literal(directQueryPadding) })
  .strict();
const packetSchema = z.discriminatedUnion('type', [
  querySchema,
  directQuerySchema,
  announcementSchema,
]);
const query = Buffer.from(JSON.stringify({ ...baseValues(), type: 'query' }));
const directQuery = Buffer.from(
  JSON.stringify({ ...baseValues(), type: 'direct-query', padding: directQueryPadding }),
);
function baseValues() {
  return { service: 'ncf-agent-interconnect', version: 1 };
}

export interface LanInterface {
  address: string;
  netmask: string;
}
export interface LocalLanNode {
  nodeId: string;
  label: string;
  /** The live peer server's bound address, never merely a configured address. */
  listener: { address: string; port: number } | null;
  listeners?: readonly { address: string; port: number }[];
  interfaces?: readonly LanInterface[];
}
export interface LanDiscoveryTransport {
  start(handlers: {
    message(data: Uint8Array, sourceAddress: string): void;
    failed(error?: unknown): void;
  }): Promise<void>;
  /** A query response may target its validated source at the same discovery port. */
  send(data: Uint8Array, interfaceAddress?: string, recipientAddress?: string): void;
  stop(): void;
}
export interface LanDiscoveryOptions {
  local: LocalLanNode;
  interfaces?: () => LanInterface[];
  transport?: (interfaces: readonly LanInterface[]) => LanDiscoveryTransport;
  now?: () => number;
  every?: (callback: () => void, milliseconds: number) => () => void;
  changed?: () => void;
  /** Pause owner searches independently from listener announcements and replies. */
  querying?: boolean;
  observed?: (node: LanDiscoveryObservation) => void;
}

const ipv4Number = (address: string): number =>
  address.split('.').reduce((value, octet) => (value * 256 + Number(octet)) >>> 0, 0);
function unicast(address: string): boolean {
  if (!isIPv4(address)) return false;
  const [first] = address.split('.').map(Number);
  return first > 0 && first !== 127 && first < 224;
}
function validInterface(value: LanInterface): boolean {
  if (!unicast(value.address) || !isIPv4(value.netmask)) return false;
  const mask = ipv4Number(value.netmask),
    inverse = ~mask >>> 0;
  // A contiguous mask with at least two subnet bits excludes default routes.
  return mask >= 0xc0000000 && (inverse & (inverse + 1)) === 0;
}
function onInterface(address: string, entry: LanInterface): boolean {
  if (!unicast(address)) return false;
  const source = ipv4Number(address),
    local = ipv4Number(entry.address),
    mask = ipv4Number(entry.netmask);
  if ((source & mask) !== (local & mask)) return false;
  const host = (source & ~mask) >>> 0,
    inverse = ~mask >>> 0;
  // /31 and /32 have no directed broadcast address.
  return inverse <= 1 || (host !== 0 && host !== inverse);
}
export function lanInterfaces(): LanInterface[] {
  return Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => !entry.internal && entry.family === 'IPv4')
    .map(({ address, netmask }) => ({ address, netmask }));
}
function interfaceList(values: LanInterface[]): LanInterface[] {
  const found = new Map<string, LanInterface>();
  for (const value of values) {
    if (validInterface(value) && !found.has(value.address)) found.set(value.address, { ...value });
    if (found.size >= lanDiscoveryLimits.interfaces) break;
  }
  return [...found.values()];
}

/** Uses IPv4 multicast consistently on all supported operating systems. */
export function udpLanTransport(
  interfaces: readonly LanInterface[],
  multicast: { group: string; port: number } = lanDiscoveryLimits,
): LanDiscoveryTransport {
  let receiver: Socket | undefined;
  const senders = new Map<string, Socket>();
  let active = false;
  const close = (socket: Socket) => {
    try {
      socket.close();
    } catch {
      /* A socket may have failed before binding. */
    }
  };
  const stop = () => {
    active = false;
    if (receiver) close(receiver);
    receiver = undefined;
    for (const socket of senders.values()) close(socket);
    senders.clear();
  };
  return {
    async start(handlers) {
      if (active) throw new Error('LAN discovery transport is already started');
      active = true;
      try {
        const socket = createSocket({ type: 'udp4', reuseAddr: true });
        receiver = socket;
        await new Promise<void>((resolve, reject) => {
          const closed = () => reject(new Error('LAN discovery transport stopped'));
          const failed = (error: Error) => {
            socket.off('close', closed);
            reject(error);
          };
          socket.once('error', failed);
          socket.once('close', closed);
          socket.bind(multicast.port, '0.0.0.0', () => {
            socket.off('error', failed);
            socket.off('close', closed);
            resolve();
          });
        });
        if (!active) return;
        socket.on('error', handlers.failed);
        for (const entry of interfaces) socket.addMembership(multicast.group, entry.address);
        socket.on('message', (data, source) => {
          if (active) handlers.message(data, source.address);
        });
        socket.unref();
        // A separate sender per interface avoids shared multicast-interface races.
        for (const entry of interfaces) {
          const sender = createSocket('udp4');
          senders.set(entry.address, sender);
          await new Promise<void>((resolve, reject) => {
            const closed = () => reject(new Error('LAN discovery transport stopped'));
            const failed = (error: Error) => {
              sender.off('close', closed);
              reject(error);
            };
            sender.once('error', failed);
            sender.once('close', closed);
            sender.bind(0, entry.address, () => {
              sender.off('error', failed);
              sender.off('close', closed);
              resolve();
            });
          });
          if (!active) return;
          sender.on('error', handlers.failed);
          sender.setMulticastTTL(1);
          sender.setMulticastInterface(entry.address);
          sender.setMulticastLoopback(false);
          sender.unref();
        }
      } catch (error) {
        stop();
        throw error;
      }
    },
    send(data, interfaceAddress, recipientAddress) {
      if (!active || data.byteLength > lanDiscoveryLimits.packetBytes) return;
      for (const [address, socket] of senders) {
        if (interfaceAddress && interfaceAddress !== address) continue;
        socket.send(data, multicast.port, recipientAddress ?? multicast.group, (error) => {
          // A failed reply to one host does not interrupt multicast or other listeners.
          if (error && !recipientAddress && active) {
            stop();
            // The service receives a failure through the socket's error channel.
            socket.emit('error', error);
          }
        });
      }
    },
    stop,
  };
}

interface CachedNode {
  node: DiscoveredLanNode;
  expires: number;
}

/** No peer configuration, secrets, pairing or agent directory are reachable here. */
export class LanDiscovery {
  private local: LocalLanNode;
  private interfaces: LanInterface[] = [];
  private transport?: LanDiscoveryTransport;
  private cancelTick?: () => void;
  private generation = 0;
  private transportGeneration = 0;
  private reconciling?: Promise<void>;
  private state: LanDiscoverySnapshot['state'] = 'stopped';
  private reason: LanDiscoverySnapshot['reason'] = null;
  private cache = new Map<string, CachedNode>();
  private sourceRates = new Map<string, number>();
  private rateWindow = -Infinity;
  private packetCount = 0;
  private lastAnnounce = -Infinity;
  private lastQuery = -Infinity;
  private querying: boolean;
  private queryUntil = Infinity;
  private queryRequested = false;
  private announceRequested = false;
  private lastReply = -Infinity;
  private readonly pendingQueries = new Set<string>();
  private dirty = false;
  private readonly now: () => number;
  constructor(private readonly options: LanDiscoveryOptions) {
    this.local = structuredClone(options.local);
    this.now = options.now ?? (() => performance.now());
    this.querying = options.querying ?? true;
  }
  async start(): Promise<void> {
    this.stop();
    const generation = this.generation;
    const every =
      this.options.every ??
      ((callback, milliseconds) => {
        const timer = setInterval(callback, milliseconds);
        timer.unref();
        return () => clearInterval(timer);
      });
    this.cancelTick = every(() => {
      if (generation !== this.generation) return;
      void this.reconcileInterfaces();
      this.tick();
    }, 1000);
    await this.reconcileInterfaces(true);
    if (generation === this.generation) this.tick();
  }
  private interfaceSnapshot(): LanInterface[] {
    return interfaceList(
      (this.options.interfaces ?? (() => [...(this.local.interfaces ?? lanInterfaces())]))(),
    );
  }
  private reconcileInterfaces(force = false): Promise<void> {
    let interfaces: LanInterface[];
    try {
      interfaces = this.interfaceSnapshot();
    } catch {
      this.failed();
      return Promise.resolve();
    }
    const sameInterfaces = JSON.stringify(interfaces) === JSON.stringify(this.interfaces);
    if (!force && sameInterfaces && this.reconciling) return this.reconciling;
    if (!force && sameInterfaces && this.reason === 'no-interfaces') return Promise.resolve();
    if (
      !force &&
      this.state === 'searching' &&
      JSON.stringify(interfaces) === JSON.stringify(this.interfaces)
    )
      return Promise.resolve();
    const generation = this.generation;
    const transportGeneration = ++this.transportGeneration;
    this.transport?.stop();
    this.transport = undefined;
    this.interfaces = interfaces;
    this.pendingQueries.clear();
    if (!interfaces.length) {
      this.state = 'unavailable';
      this.reason = 'no-interfaces';
      this.options.changed?.();
      return Promise.resolve();
    }
    let transport: LanDiscoveryTransport;
    try {
      transport = (this.options.transport ?? udpLanTransport)(interfaces);
    } catch {
      this.failed();
      return Promise.resolve();
    }
    this.transport = transport;
    this.state = 'searching';
    this.reason = null;
    const current = () =>
      generation === this.generation && transportGeneration === this.transportGeneration;
    const operation = (async () => {
      try {
        await transport.start({
          message: (data, source) => {
            if (current() && this.state === 'searching') this.receive(data, source);
          },
          failed: () => {
            if (current()) this.failed();
          },
        });
        if (!current()) {
          transport.stop();
          return;
        }
        this.announceRequested = true;
        this.lastAnnounce = -Infinity;
        this.tick();
        this.options.changed?.();
      } catch {
        if (current()) this.failed();
        else transport.stop();
      }
    })();
    this.reconciling = operation;
    void operation.finally(() => {
      if (this.reconciling === operation) this.reconciling = undefined;
    });
    return operation;
  }
  stop(): void {
    this.generation++;
    this.transportGeneration++;
    this.cancelTick?.();
    this.cancelTick = undefined;
    this.transport?.stop();
    this.transport = undefined;
    this.state = 'stopped';
    this.reason = null;
    this.cache.clear();
    this.sourceRates.clear();
    this.packetCount = 0;
    this.rateWindow = -Infinity;
    this.lastAnnounce = this.lastQuery = this.lastReply = -Infinity;
    this.pendingQueries.clear();
    this.announceRequested = this.dirty = false;
    this.queryRequested = false;
  }
  /** Both the deadline and transport ticks use the injected monotonic clock. */
  setQuerying(enabled: boolean, until = Infinity): void {
    this.querying = enabled;
    this.queryUntil = until;
    this.queryRequested = enabled;
    if (enabled && this.state === 'searching') this.tick();
  }
  updateLocal(local: LocalLanNode): void {
    this.local = structuredClone(local);
    this.announceRequested = true;
    this.dirty = true;
    if (this.cancelTick) void this.reconcileInterfaces();
    else if (this.state === 'unavailable') void this.start();
  }
  snapshot(): LanDiscoverySnapshot {
    const reason = this.announcementReason();
    return {
      state: this.state,
      reason: this.reason,
      announcement: { available: reason === null, reason },
      nodes: this.currentNodes(),
    };
  }
  select(key: string): LanPairSelection | undefined {
    const entry = this.cache.get(key);
    return entry && entry.expires > this.now() ? Object.freeze({ ...entry.node }) : undefined;
  }
  private currentNodes(): DiscoveredLanNode[] {
    const now = this.now();
    return [...this.cache.values()]
      .filter((entry) => entry.expires > now)
      .map((entry) => ({ ...entry.node }))
      .sort((a, b) => a.key.localeCompare(b.key, 'en'));
  }
  private announcementReason(): LanAnnouncementUnavailable | null {
    if (this.state === 'stopped') return 'stopped';
    if (this.reason) return this.reason;
    const listeners = this.local.listeners ?? (this.local.listener ? [this.local.listener] : []);
    const valid = listeners.filter(
      (listener) => Number.isInteger(listener.port) && listener.port > 0 && listener.port <= 65535,
    );
    if (!valid.length) return 'listener-unavailable';
    if (
      valid.every((listener) => listener.address.startsWith('127.') || listener.address === '::1')
    )
      return 'listener-local';
    if (
      !valid.some((listener) => this.interfaces.some((entry) => entry.address === listener.address))
    )
      return 'listener-unavailable';
    if (!z.object(identity).safeParse(this.local).success) return 'listener-unavailable';
    return null;
  }
  private failed(): void {
    this.stop();
    this.state = 'unavailable';
    this.reason = 'transport-error';
    this.options.changed?.();
  }

  private receive(data: Uint8Array, source: string): void {
    const now = this.now();
    if (now - this.rateWindow >= 1000) {
      this.rateWindow = now;
      this.packetCount = 0;
      this.sourceRates.clear();
    }
    if (
      ++this.packetCount > lanDiscoveryLimits.packetsPerSecond ||
      !data.byteLength ||
      data.byteLength > lanDiscoveryLimits.packetBytes ||
      this.interfaces.some((entry) => entry.address === source) ||
      !this.interfaces.some((entry) => onInterface(source, entry))
    )
      return;
    const count = (this.sourceRates.get(source) ?? 0) + 1;
    this.sourceRates.set(source, count);
    if (count > lanDiscoveryLimits.sourcePacketsPerSecond) return;
    let packet: z.infer<typeof packetSchema>;
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
      const result = packetSchema.safeParse(JSON.parse(text));
      if (!result.success) return;
      packet = result.data;
    } catch {
      return;
    }
    if (packet.type === 'query') {
      this.announceRequested = true;
      return;
    }
    if (packet.type === 'direct-query') {
      if (this.pendingQueries.size < lanDiscoveryLimits.replyBatch) this.pendingQueries.add(source);
      return;
    }
    const nodeId = packet.nodeId.toLowerCase();
    if (nodeId === this.local.nodeId.toLowerCase()) return;
    const key = `${nodeId}@${source}:${packet.peerPort}`;
    const existing = this.cache.get(key);
    if (!existing && this.cache.size >= lanDiscoveryLimits.cacheEntries) return;
    const node = {
      key,
      nodeId,
      label: packet.label,
      address: `wss://${source}:${packet.peerPort}/peer`,
    };
    this.cache.set(key, { node, expires: now + lanDiscoveryLimits.cacheMs });
    this.options.observed?.(Object.freeze({ ...node }));
    if (!existing || existing.node.label !== node.label) this.dirty = true;
  }
  private tick(): void {
    if (this.state !== 'searching') return;
    const now = this.now();
    for (const [key, entry] of this.cache) {
      if (entry.expires <= now) {
        this.cache.delete(key);
        this.dirty = true;
      }
    }
    try {
      if (
        this.querying &&
        now < this.queryUntil &&
        (this.queryRequested || now - this.lastQuery >= lanDiscoveryLimits.queryMs) &&
        now - this.lastQuery >= lanDiscoveryLimits.queryRestartMs
      ) {
        this.lastQuery = now;
        this.queryRequested = false;
        // Older nodes still understand the compact multicast query.
        this.transport?.send(query);
        this.transport?.send(directQuery);
      }
      const announceDue =
        (this.announceRequested || now - this.lastAnnounce >= lanDiscoveryLimits.announceMs) &&
        now - this.lastAnnounce >= lanDiscoveryLimits.replyMs;
      const repliesDue =
        this.pendingQueries.size > 0 && now - this.lastReply >= lanDiscoveryLimits.replyMs;
      if ((announceDue || repliesDue) && this.announcementReason() === null) {
        const packets = new Map<string, Buffer>();
        for (const listener of this.local.listeners ??
          (this.local.listener ? [this.local.listener] : [])) {
          if (
            !this.interfaces.some((entry) => entry.address === listener.address) ||
            !Number.isInteger(listener.port) ||
            listener.port < 1 ||
            listener.port > 65535
          )
            continue;
          packets.set(
            listener.address,
            Buffer.from(
              JSON.stringify({
                ...baseValues(),
                type: 'announce',
                nodeId: this.local.nodeId,
                label: this.local.label,
                peerPort: listener.port,
              }),
            ),
          );
        }
        if (announceDue) {
          this.lastAnnounce = now;
          this.announceRequested = false;
          for (const [address, data] of packets) this.transport?.send(data, address);
        }
        if (repliesDue) {
          this.lastReply = now;
          const sources = this.interfaces
            .filter((entry) => packets.has(entry.address))
            .sort((a, b) => ipv4Number(b.netmask) - ipv4Number(a.netmask));
          // Multicast may work in only one direction. Reply once to each validated source
          // using an advertised address in that source's most specific local subnet.
          for (const recipientAddress of this.pendingQueries) {
            const source = sources.find((entry) => onInterface(recipientAddress, entry));
            if (!source) continue;
            const packet = packets.get(source.address)!;
            // A padded opt-in query is at least as large as the reply it can trigger.
            if (packet.byteLength <= directQuery.byteLength)
              this.transport?.send(packet, source.address, recipientAddress);
          }
        }
      }
      // Discard the batch even if no listener is currently available.
      if (repliesDue) this.pendingQueries.clear();
    } catch {
      this.failed();
      return;
    }
    if (this.dirty) {
      this.dirty = false;
      this.options.changed?.();
    }
  }
}

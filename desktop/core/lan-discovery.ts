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
const packetSchema = z.discriminatedUnion('type', [querySchema, announcementSchema]);
const query = Buffer.from(JSON.stringify({ ...baseValues(), type: 'query' }));
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
}
export interface LanDiscoveryTransport {
  start(handlers: {
    message(data: Uint8Array, sourceAddress: string): void;
    failed(): void;
  }): Promise<void>;
  /** Multicast only; callers cannot select a destination or an arbitrary port. */
  send(data: Uint8Array, interfaceAddress?: string): void;
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
export function udpLanTransport(interfaces: readonly LanInterface[]): LanDiscoveryTransport {
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
          socket.bind(lanDiscoveryLimits.port, '0.0.0.0', () => {
            socket.off('error', failed);
            socket.off('close', closed);
            resolve();
          });
        });
        if (!active) return;
        socket.on('error', handlers.failed);
        for (const entry of interfaces)
          socket.addMembership(lanDiscoveryLimits.group, entry.address);
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
    send(data, interfaceAddress) {
      if (!active || data.byteLength > lanDiscoveryLimits.packetBytes) return;
      for (const [address, socket] of senders) {
        if (interfaceAddress && interfaceAddress !== address) continue;
        socket.send(data, lanDiscoveryLimits.port, lanDiscoveryLimits.group, (error) => {
          if (error && active) {
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
  private pendingReply = false;
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
    let transport: LanDiscoveryTransport | undefined;
    try {
      this.interfaces = interfaceList((this.options.interfaces ?? lanInterfaces)());
      if (!this.interfaces.length) {
        this.state = 'unavailable';
        this.reason = 'no-interfaces';
        this.options.changed?.();
        return;
      }
      this.state = 'searching';
      transport = (this.options.transport ?? udpLanTransport)(this.interfaces);
      this.transport = transport;
      await transport.start({
        message: (data, source) => {
          if (generation === this.generation && this.state === 'searching')
            this.receive(data, source);
        },
        failed: () => {
          if (generation === this.generation) this.failed();
        },
      });
      if (generation !== this.generation || this.state !== 'searching') {
        transport.stop();
        return;
      }
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
      this.tick();
      this.options.changed?.();
    } catch {
      if (generation === this.generation) this.failed();
      else transport?.stop();
    }
  }
  stop(): void {
    this.generation++;
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
    this.lastAnnounce = this.lastQuery = -Infinity;
    this.pendingReply = this.dirty = false;
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
    this.pendingReply = true;
    this.dirty = true;
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
    const listener = this.local.listener;
    if (!listener || !Number.isInteger(listener.port) || listener.port < 1 || listener.port > 65535)
      return 'listener-unavailable';
    if (listener.address === '127.0.0.1' || listener.address === '::1') return 'listener-local';
    if (!this.interfaces.some((entry) => entry.address === listener.address))
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
      this.pendingReply = true;
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
        this.transport?.send(query);
      }
      if (
        this.announcementReason() === null &&
        (now - this.lastAnnounce >= lanDiscoveryLimits.announceMs || this.pendingReply) &&
        now - this.lastAnnounce >= lanDiscoveryLimits.replyMs
      ) {
        this.lastAnnounce = now;
        this.pendingReply = false;
        this.transport?.send(
          Buffer.from(
            JSON.stringify({
              ...baseValues(),
              type: 'announce',
              nodeId: this.local.nodeId,
              label: this.local.label,
              peerPort: this.local.listener!.port,
            }),
          ),
          this.local.listener!.address,
        );
      }
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

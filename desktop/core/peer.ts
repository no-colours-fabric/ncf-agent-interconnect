import https from 'node:https';
import tls from 'node:tls';
import { readFile, writeFile } from 'node:fs/promises';
import { X509Certificate, randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { hostname, networkInterfaces } from 'node:os';
import { isIPv4, type Socket } from 'node:net';
import { PeerListeners } from './peer-listeners.js';
import { computeNetworkInterfacePolicy } from './network-interfaces.js';
import type {
  NetworkInterfaceSnapshot,
  NetworkInterfaceStatus,
} from '../shared/network-interfaces.js';
import { EventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';
import selfsigned from 'selfsigned';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { z } from 'zod';
import {
  envelopeSchema,
  directorySnapshotSchema,
  type DirectorySnapshot,
  type Envelope,
  type MessageState,
  type Peer,
} from '../shared/contracts.js';
import { localAddresses, normalizePeerAddress, type SettingsFile } from './settings.js';
import { PairingClient, PairingError, PairingHost, type PairedIdentity } from './pairing.js';

const messageFrame = z.object({ type: z.literal('message'), envelope: envelopeSchema }).strict();
const directoryFeature = 'agent-directory-v1';
const nodeLabelHeader = 'x-ncf-node-label';
const nodeLabelSchema = z.string().min(1).max(120);
const frameSchema = z.discriminatedUnion('type', [
  messageFrame,
  z.object({ type: z.literal('directory'), snapshot: directorySnapshotSchema }).strict(),
  z.object({ type: z.literal('identity'), label: nodeLabelSchema }).strict(),
  z.object({ type: z.literal('hello'), protocol: z.literal(2), nodeId: z.uuid() }).strict(),
  z
    .object({
      type: z.literal('receipt'),
      id: z.uuid(),
      state: z.enum(['received', 'ready', 'processed']),
    })
    .strict(),
  z
    .object({
      type: z.literal('blob/read'),
      requestId: z.uuid(),
      messageId: z.uuid(),
      fileId: z.string().regex(/^[a-f0-9]{64}$/),
      offset: z.number().int().min(0),
      length: z
        .number()
        .int()
        .min(1)
        .max(192 * 1024),
    })
    .strict(),
  z
    .object({ type: z.literal('blob/result'), requestId: z.uuid(), data: z.string().max(300000) })
    .strict(),
  z
    .object({ type: z.literal('blob/error'), requestId: z.uuid(), error: z.string().max(200) })
    .strict(),
]);
export type Frame = z.infer<typeof frameSchema>;
interface Link {
  socket: WebSocket | null;
  error: string | null;
  connecting: boolean;
  directorySupported: boolean;
  identitySupported: boolean;
  generation: number;
  addressIndex: number;
  activeAddress: string | null;
  timer?: NodeJS.Timeout;
}
interface PairLease {
  check(): void;
  release(): void;
}
export const secretMatches = (actual: unknown, expected: string): boolean =>
  typeof actual === 'string' &&
  Buffer.byteLength(actual) === Buffer.byteLength(expected) &&
  timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
const encodedNodeLabel = (label: string): string =>
  Buffer.from(label, 'utf8').toString('base64url');
const decodedNodeLabel = (value: string | string[] | undefined): string | undefined => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return undefined;
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.toString('base64url') !== value) return undefined;
  try {
    const label = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    if (!Buffer.from(label, 'utf8').equals(bytes)) return undefined;
    const parsed = nodeLabelSchema.safeParse(label);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};
function pinned(certificate: string): {
  ca: string;
  checkServerIdentity: typeof tls.checkServerIdentity;
} {
  const fingerprint = new X509Certificate(certificate).fingerprint256;
  return {
    ca: certificate,
    checkServerIdentity: (_host, cert) =>
      cert.raw && new X509Certificate(cert.raw).fingerprint256 === fingerprint
        ? undefined
        : new Error('The remote node certificate does not match the access code'),
  };
}
export class PeerNetwork extends EventEmitter {
  private servers = new Map<string, https.Server>();
  private probes = new Map<import('node:http').ClientRequest, string>();
  private candidates = new Map<string, Map<string, number>>();
  private readonly peerListeners: PeerListeners;
  private inventoryTimer?: NodeJS.Timeout;
  private inventoryError: string | null = null;
  private lastInventory?: NetworkInterfaceSnapshot;
  private policy = computeNetworkInterfacePolicy({});
  private requestGuards = new WeakMap<import('node:http').IncomingMessage, () => boolean>();
  get server(): https.Server | undefined {
    return [...this.servers.values()].find((server) => server.listening);
  }
  get endpoints(): { address: string; port: number }[] {
    return this.peerListeners
      .snapshot()
      .filter((value) => value.state === 'listening')
      .map(({ address, port }) => ({ address, port }));
  }
  networkStatus(): NetworkInterfaceStatus {
    return {
      ...this.policy,
      listeners: this.peerListeners.snapshot(),
      inventoryError: this.inventoryError,
    };
  }
  async refreshInterfaces(): Promise<void> {
    try {
      const inventory = this.inventory();
      const policy = computeNetworkInterfacePolicy(
        inventory,
        this.settings.value.networkExclusions ?? [],
      );
      const changed =
        JSON.stringify(policy) !== JSON.stringify(this.policy) || this.inventoryError !== null;
      this.lastInventory = structuredClone(inventory);
      this.policy = policy;
      this.inventoryError = null;
      const updating = this.peerListeners.update(policy.listenAddresses);
      if (changed) this.emit('change');
      await updating;
      this.port = this.peerListeners.port;
      if (changed) this.emit('change');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.lastInventory) {
        const policy = computeNetworkInterfacePolicy(
          this.lastInventory,
          this.settings.value.networkExclusions ?? [],
        );
        const changed = JSON.stringify(policy) !== JSON.stringify(this.policy);
        this.policy = policy;
        const updating = this.peerListeners.update(policy.listenAddresses);
        if (changed) this.emit('change');
        await updating;
      }
      if (this.inventoryError !== message) {
        this.inventoryError = message;
        this.emit('change');
      }
    }
  }
  private wss?: WebSocketServer;
  private links = new Map<string, Link>();
  private sockets = new Set<WebSocket>();
  private socketPeers = new WeakMap<WebSocket, string>();
  private requests = new Map<
    string,
    {
      peerId: string;
      resolve: (value: string) => void;
      reject: (e: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();
  private certificate = '';
  private key = '';
  private readonly pairingHost = new PairingHost(() => ({
    nodeId: this.settings.value.nodeId,
    label: this.settings.value.nodeLabel,
    certificate: this.certificate,
  }));
  private heartbeat?: NodeJS.Timeout;
  private stopped = true;
  private pairingGeneration = 0;
  private pairingLeases = new Map<string, symbol>();
  port = 0;
  onFrame: (peerId: string, frame: Frame) => Promise<void> = async () => {};
  onIdentity: (peerId: string, label: string, isCurrent: () => boolean) => Promise<void> =
    async () => {};
  constructor(
    readonly settings: SettingsFile,
    private readonly inventory: () => NetworkInterfaceSnapshot = networkInterfaces,
  ) {
    super();
    this.peerListeners = new PeerListeners({
      bind: (address, port) => this.bindServer(address, port),
      changed: () => {
        this.port = this.peerListeners.port;
        this.emit('change');
      },
      fallback: () =>
        this.emit(
          'problem',
          'The listening port was in use. A free port was selected; use an address shown under Remote nodes.',
        ),
    });
  }
  async start(): Promise<void> {
    this.stopped = false;
    const certFile = path.join(this.settings.directory, 'node-cert.pem'),
      keyFile = path.join(this.settings.directory, 'node-key.pem');
    try {
      this.certificate = await readFile(certFile, 'utf8');
      this.key = await readFile(keyFile, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      const names = localAddresses().map((ip) => ({ type: 7 as const, ip }));
      const generated = await selfsigned.generate(
        [{ name: 'commonName', value: this.settings.value.nodeId }],
        {
          keyType: 'ec',
          curve: 'P-256',
          algorithm: 'sha256',
          notAfterDate: new Date(Date.now() + 365 * 86400000),
          extensions: [
            {
              name: 'subjectAltName',
              altNames: [...names, { type: 2, value: 'localhost' }, { type: 2, value: hostname() }],
            },
          ],
        },
      );
      this.certificate = generated.cert;
      this.key = generated.private;
      await writeFile(certFile, this.certificate, { mode: 0o600 });
      await writeFile(keyFile, this.key, { mode: 0o600 });
    }
    this.wss = new WebSocketServer({
      noServer: true,
      maxPayload: 512 * 1024,
      perMessageDeflate: false,
    });
    this.wss.on('headers', (headers, req) => {
      if (req.headers['x-ncf-features'] === directoryFeature)
        headers.push('X-NCF-Features: ' + directoryFeature);
      headers.push('X-NCF-Node-Label: ' + encodedNodeLabel(this.settings.value.nodeLabel));
    });
    const inventory = this.inventory();
    this.policy = computeNetworkInterfacePolicy(
      inventory,
      this.settings.value.networkExclusions ?? [],
    );
    this.lastInventory = structuredClone(inventory);
    await this.peerListeners.start(this.policy.listenAddresses, this.settings.value.peerPort);
    this.port = this.peerListeners.port;
    this.inventoryTimer = setInterval(() => {
      void this.refreshInterfaces();
    }, 2000);
    this.inventoryTimer.unref();
    const alive = new WeakMap<WebSocket, boolean>();
    this.heartbeat = setInterval(() => {
      for (const ws of this.sockets) {
        if (alive.get(ws) === false) {
          ws.terminate();
          continue;
        }
        alive.set(ws, false);
        ws.once('pong', () => alive.set(ws, true));
        if (ws.readyState === WebSocket.OPEN) ws.ping();
      }
    }, 15000);
    this.heartbeat.unref();
    for (const peer of this.settings.value.peers) this.connect(peer);
  }
  private async bindServer(address: string, port: number) {
    let active = true;
    const sockets = new Set<Socket>();
    const admitted = () => active && !this.stopped && this.peerListeners.allows(address);
    const server = https.createServer({ cert: this.certificate, key: this.key }, (req, res) => {
      if (!admitted()) {
        req.socket.destroy();
        return;
      }
      if (req.method === 'GET' && req.url === '/identity' && !req.headers.origin) {
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ nodeId: this.settings.value.nodeId }));
        return;
      }
      this.requestGuards.set(req, admitted);
      void this.pair(req, res).catch(() => {
        if (!res.headersSent) res.writeHead(400);
        res.end();
      });
    });
    server.requestTimeout = 10000;
    server.on('connection', (socket: Socket) => {
      sockets.add(socket);
      socket.once('close', () => sockets.delete(socket));
      if (!admitted()) socket.destroy();
    });
    server.on('upgrade', (req, socket, head) => {
      if (!admitted()) {
        socket.destroy();
        return;
      }
      const peer = this.settings.value.peers.find((p) => p.id === req.headers['x-node-id']);
      if (
        !peer ||
        req.url !== '/peer' ||
        req.headers.origin ||
        !secretMatches(req.headers.authorization, 'Bearer ' + peer.secret)
      ) {
        socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        return;
      }
      this.wss!.handleUpgrade(req, socket, head, (ws) =>
        this.attach(
          peer,
          ws,
          false,
          req.headers['x-ncf-features'] === directoryFeature,
          decodedNodeLabel(req.headers[nodeLabelHeader]),
        ),
      );
    });

    const close = async () => {
      active = false;
      if (this.servers.get(address) === server) this.servers.delete(address);
      const closing = server.listening
        ? new Promise<void>((resolve) => server.close(() => resolve()))
        : Promise.resolve();
      for (const socket of sockets) socket.destroy();
      server.closeAllConnections();
      await closing;
    };
    try {
      await new Promise<void>((resolve, reject) => {
        const failed = (error: Error) => {
          server.off('listening', listening);
          reject(error);
        };
        const listening = () => {
          server.off('error', failed);
          resolve();
        };
        server.once('error', failed);
        server.once('listening', listening);
        server.listen(port, address);
      });
    } catch (error) {
      await close();
      throw error;
    }
    server.on('error', (error) => this.emit('problem', error.message));
    this.servers.set(address, server);
    return { port: (server.address() as { port: number }).port, close };
  }
  private link(peerId: string): Link {
    let value = this.links.get(peerId);
    if (!value) {
      value = {
        socket: null,
        error: null,
        connecting: false,
        directorySupported: false,
        identitySupported: false,
        generation: 0,
        addressIndex: 0,
        activeAddress: null,
      };
      this.links.set(peerId, value);
    }
    return value;
  }
  states(): {
    id: string;
    connected: boolean;
    directorySupported: boolean;
    activeAddress: string | null;
    error: string | null;
  }[] {
    return this.settings.value.peers.map((p) => ({
      id: p.id,
      connected: this.link(p.id).socket?.readyState === WebSocket.OPEN,
      directorySupported: this.link(p.id).directorySupported,
      activeAddress: this.link(p.id).activeAddress,
      error: this.link(p.id).error,
    }));
  }
  private schedule(peer: Peer): void {
    const current = this.settings.value.peers.find((value) => value.id === peer.id);
    if (!current) return;
    peer = current;
    const link = this.link(peer.id);
    if (this.stopped || link.socket || link.timer || !this.routes(peer).length) return;
    link.timer = setTimeout(() => {
      link.timer = undefined;
      this.connect(peer);
    }, 1500);
    link.timer.unref();
  }
  /** Only validated discovery observations feed this bounded, volatile candidate set. */
  observeEndpoint(node: { nodeId: string; address: string }): void {
    const peer = this.settings.value.peers.find((entry) => entry.id === node.nodeId);
    if (!peer || this.stopped) return;
    let address: string;
    try {
      address = normalizePeerAddress(node.address);
      const host = new URL(address).hostname;
      if (!isIPv4(host) || Number(host.split('.')[0]) === 0 || Number(host.split('.')[0]) >= 224)
        return;
    } catch {
      return;
    }
    const now = performance.now();
    for (const [id, values] of this.candidates) {
      for (const [candidate, seen] of values) if (now - seen >= 30000) values.delete(candidate);
      if (!values.size || !this.settings.value.peers.some((entry) => entry.id === id))
        this.candidates.delete(id);
    }
    const values = this.candidates.get(peer.id) ?? new Map<string, number>();
    const total = [...this.candidates.values()].reduce((count, entries) => count + entries.size, 0);
    if (!values.has(address) && total >= 128) return;
    values.set(address, now);
    while (values.size > 8) values.delete(values.keys().next().value!);
    this.candidates.set(peer.id, values);
    this.schedule(peer);
  }
  private routes(peer: Peer): string[] {
    const now = performance.now();
    return [
      ...new Set([
        ...(peer.address ? [peer.address] : []),
        ...[...(this.candidates.get(peer.id) ?? [])]
          .filter(([, seen]) => now - seen < 30000)
          .map(([address]) => address),
      ]),
    ];
  }
  private verifyAlternate(peer: Peer, address: string): Promise<void> {
    const endpoint = new URL(address);
    endpoint.protocol = 'https:';
    endpoint.pathname = '/identity';
    return new Promise((resolve, reject) => {
      // No authorization, code, local identity or content is sent by this pinned public probe.
      const request = https.request(
        endpoint,
        { ...pinned(peer.certificate), method: 'GET', agent: false, timeout: 3000 },
        (response) => {
          const chunks: Buffer[] = [];
          let length = 0;
          response.on('data', (chunk: Buffer) => {
            length += chunk.length;
            if (length > 512) request.destroy(new Error('Invalid alternate node identity'));
            else chunks.push(chunk);
          });
          response.on('aborted', () =>
            reject(new Error('Alternate node identity response interrupted')),
          );
          response.on('error', reject);
          response.on('end', () => {
            try {
              const identity = z
                .object({ nodeId: z.uuid() })
                .strict()
                .parse(JSON.parse(Buffer.concat(chunks).toString()));
              if (response.statusCode !== 200 || identity.nodeId !== peer.id)
                throw new Error('The alternate address does not match the paired node');
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        },
      );
      this.probes.set(request, peer.id);
      const deadline = setTimeout(
        () => request.destroy(new Error('Alternate node identity request timed out')),
        3000,
      );
      deadline.unref();
      request.once('close', () => {
        clearTimeout(deadline);
        this.probes.delete(request);
      });
      request.on('error', reject);
      request.on('timeout', () =>
        request.destroy(new Error('Alternate node identity request timed out')),
      );
      request.end();
    });
  }
  private connect(peer: Peer): void {
    const current = this.settings.value.peers.find((value) => value.id === peer.id);
    if (!current) return;
    peer = current;
    const link = this.link(peer.id);
    const routes = this.routes(peer);
    if (this.stopped || !routes.length || link.socket || link.connecting) return;
    const address = routes[link.addressIndex++ % routes.length];
    const generation = link.generation;
    const isCurrent = () =>
      !this.stopped &&
      link.generation === generation &&
      this.settings.value.peers.some(
        (entry) =>
          entry.id === peer.id &&
          entry.secret === peer.secret &&
          entry.certificate === peer.certificate,
      );
    link.connecting = true;
    void (async () => {
      if (address !== peer.address) await this.verifyAlternate(peer, address);
      if (!isCurrent() || link.socket) return;
      const ws = new WebSocket(normalizePeerAddress(address), {
        ...pinned(peer.certificate),
        headers: {
          authorization: 'Bearer ' + peer.secret,
          'x-node-id': this.settings.value.nodeId,
          'x-ncf-features': directoryFeature,
          [nodeLabelHeader]: encodedNodeLabel(this.settings.value.nodeLabel),
        },
        handshakeTimeout: 6000,
        maxPayload: 512 * 1024,
        perMessageDeflate: false,
      });
      this.attach(peer, ws, true, false, undefined, address);
    })().catch((error) => {
      if (!isCurrent() || link.socket) return;
      link.connecting = false;
      link.error = error instanceof Error ? error.message : String(error);
      this.emit('change');
      this.schedule(peer);
    });
  }
  private attach(
    peer: Peer,
    ws: WebSocket,
    outbound: boolean,
    directorySupported = false,
    remoteLabel?: string,
    address?: string,
  ): void {
    this.socketPeers.set(ws, peer.id);
    this.sockets.add(ws);
    let verified = false;
    if (outbound)
      ws.once('upgrade', (response) => {
        directorySupported = response.headers['x-ncf-features'] === directoryFeature;
        remoteLabel = decodedNodeLabel(response.headers[nodeLabelHeader]);
      });
    const link = this.link(peer.id),
      generation = link.generation,
      isCurrent = () => {
        const current = this.settings.value.peers.find((value) => value.id === peer.id);
        return (
          !this.stopped &&
          link.generation === generation &&
          link.socket === ws &&
          current?.secret === peer.secret &&
          current.certificate === peer.certificate
        );
      },
      deadline = setTimeout(() => ws.terminate(), 6000);
    const hello = () => {
      if (this.stopped || link.generation !== generation) {
        ws.terminate();
        return;
      }
      void this.write(ws, { type: 'hello', protocol: 2, nodeId: this.settings.value.nodeId }).catch(
        () => ws.terminate(),
      );
    };
    if (ws.readyState === WebSocket.OPEN) hello();
    else ws.once('open', hello);
    ws.on('message', (data: RawData, binary: boolean) => {
      void (async () => {
        if (link.generation !== generation) return;
        if (verified && link.socket !== ws) return;
        if (binary) throw new Error('Expected protocol 2 JSON');
        const frame = frameSchema.parse(JSON.parse(data.toString()));
        if (!verified) {
          if (frame.type !== 'hello' || frame.nodeId !== peer.id)
            throw new Error('The remote node does not match the configured peer');
          if (link.socket && link.socket !== ws) {
            const preferred = this.settings.value.nodeId < peer.id ? outbound : !outbound;
            if (!preferred) {
              ws.close();
              return;
            }
            link.socket.terminate();
          }
          verified = true;
          clearTimeout(deadline);
          link.socket = ws;
          link.activeAddress = address ?? null;
          link.directorySupported = directorySupported;
          link.identitySupported = remoteLabel !== undefined;
          link.connecting = false;
          link.error = null;
          if (!isCurrent()) return;
          // The next frame can arrive while the peer name is being saved.
          this.emit('authenticated', peer.id);
          if (remoteLabel !== undefined) await this.onIdentity(peer.id, remoteLabel, isCurrent);
          if (!isCurrent()) return;
          if (link.identitySupported)
            await this.write(ws, {
              type: 'identity',
              label: nodeLabelSchema.parse(this.settings.value.nodeLabel),
            });
          if (!isCurrent()) return;
          this.emit('connected', peer.id);
          this.emit('change');
          return;
        }
        if (link.socket !== ws) return;
        if (frame.type === 'hello') throw new Error('Repeated handshake');
        if (frame.type === 'directory' && !directorySupported)
          throw new Error('Agent directory was not negotiated on this connection');
        if (frame.type === 'identity') {
          if (!link.identitySupported)
            throw new Error('Node identity updates were not negotiated on this connection');
          await this.onIdentity(peer.id, frame.label, isCurrent);
          return;
        }
        if (frame.type === 'blob/result' || frame.type === 'blob/error') {
          const request = this.requests.get(frame.requestId);
          if (request && request.peerId === peer.id) {
            clearTimeout(request.timer);
            this.requests.delete(frame.requestId);
            if (frame.type === 'blob/error') request.reject(new Error(frame.error));
            else request.resolve(frame.data);
          }
          return;
        }
        await this.onFrame(peer.id, frame);
      })().catch((e) => {
        if (link.generation !== generation) return;
        if (verified && link.socket !== ws) return;
        link.error = (e as Error).message;
        ws.close(1008, 'Invalid message');
        this.emit('change');
      });
    });
    ws.on('error', (e) => {
      if (link.generation !== generation) return;
      if (verified && link.socket !== ws) return;
      link.error = e.message;
      this.emit('change');
    });
    ws.on('close', () => {
      clearTimeout(deadline);
      this.sockets.delete(ws);
      if (link.generation !== generation) return;
      link.connecting = false;
      if (link.socket === ws) {
        link.socket = null;
        link.activeAddress = null;
        link.directorySupported = false;
        link.identitySupported = false;
        for (const [id, r] of this.requests)
          if (r.peerId === peer.id) {
            clearTimeout(r.timer);
            r.reject(new Error('The connection was interrupted'));
            this.requests.delete(id);
          }
        this.emit('change');
        this.emit('disconnected', peer.id);
      }
      this.schedule(peer);
    });
  }
  private write(ws: WebSocket, frame: Frame): Promise<void> {
    return new Promise((resolve, reject) => {
      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error('The node is disconnected'));
        return;
      }
      ws.send(JSON.stringify(frame), (error) => (error ? reject(error) : resolve()));
    });
  }
  send(peerId: string, frame: Frame): Promise<void> {
    const ws = this.link(peerId).socket;
    return ws
      ? this.write(ws, frame)
      : Promise.reject(new Error('The remote node is disconnected'));
  }
  reconnectPeer(peerId: string): void {
    const link = this.link(peerId);
    link.generation++;
    clearTimeout(link.timer);
    link.timer = undefined;
    link.socket = null;
    link.activeAddress = null;
    link.addressIndex = 0;
    link.connecting = false;
    link.directorySupported = false;
    link.identitySupported = false;
    link.error = null;
    for (const socket of this.sockets)
      if (this.socketPeers.get(socket) === peerId) socket.terminate();
    for (const [id, request] of this.requests)
      if (request.peerId === peerId) {
        clearTimeout(request.timer);
        request.reject(new Error('The peer authorization changed'));
        this.requests.delete(id);
      }
    this.emit('disconnected', peerId);
    this.emit('change');
    const peer = this.settings.value.peers.find((value) => value.id === peerId);
    if (peer) this.connect(peer);
  }
  message(envelope: Envelope): Promise<void> {
    return this.send(envelope.toNode, { type: 'message', envelope });
  }
  directory(peerId: string, snapshot: DirectorySnapshot): Promise<void> {
    if (!this.link(peerId).directorySupported)
      return Promise.reject(new Error('Agent directory is not supported by this peer'));
    return this.send(peerId, { type: 'directory', snapshot });
  }
  async publishIdentity(label: string): Promise<void> {
    const frame: Frame = { type: 'identity', label: nodeLabelSchema.parse(label) };
    await Promise.allSettled(
      [...this.links.entries()].map(([peerId, link]) =>
        link.identitySupported && link.socket ? this.send(peerId, frame) : Promise.resolve(),
      ),
    );
  }
  receipt(peerId: string, id: string, state: Exclude<MessageState, 'queued'>): Promise<void> {
    return this.send(peerId, { type: 'receipt', id, state });
  }
  chunk(
    peerId: string,
    messageId: string,
    fileId: string,
    offset: number,
    length: number,
  ): Promise<string> {
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.requests.delete(requestId);
        reject(new Error('Attachment chunk request timed out'));
      }, 15000);
      this.requests.set(requestId, { peerId, resolve, reject, timer });
      void this.send(peerId, {
        type: 'blob/read',
        requestId,
        messageId,
        fileId,
        offset,
        length,
      }).catch((e) => {
        clearTimeout(timer);
        this.requests.delete(requestId);
        reject(e);
      });
    });
  }
  accessCode(): { code: string; expiresAt: string } {
    return this.pairingHost.createCode();
  }
  private holdPeer(nodeId: string): PairLease {
    if (this.stopped)
      throw new PairingError(
        'Pairing was canceled because this node stopped. Create a new access code to reconnect.',
        409,
      );
    const key = nodeId.toLowerCase();
    if (this.pairingLeases.has(key))
      throw new PairingError(
        'Another connection to this node is being paired. Retry from one computer only.',
        409,
      );
    if (this.pairingLeases.size >= 32)
      throw new PairingError(
        'Too many connections are being paired. Wait for current attempts to finish.',
        409,
      );
    const token = Symbol();
    this.pairingLeases.set(key, token);
    return {
      check: () => {
        if (this.stopped || this.pairingLeases.get(key) !== token)
          throw new PairingError(
            'Pairing was canceled before saving. Create a new access code.',
            409,
          );
      },
      release: () => {
        if (this.pairingLeases.get(key) === token) this.pairingLeases.delete(key);
      },
    };
  }
  private async savePeer(
    identity: PairedIdentity,
    address?: string,
    beforeWrite?: () => void,
    commitGuard?: () => void,
  ): Promise<Peer> {
    let saved!: Peer;
    await this.settings.savePeers(
      (current) => {
        const previous = current.find((peer) => peer.id === identity.nodeId);
        saved = {
          id: identity.nodeId,
          label: identity.label,
          address: address ?? previous?.address ?? '',
          certificate: identity.certificate,
          secret: identity.secret,
        };
        return previous
          ? current.map((peer) => (peer.id === saved.id ? saved : peer))
          : [...current, saved];
      },
      beforeWrite,
      commitGuard,
    );
    return saved;
  }
  private peerCommitted(peerId: string): void {
    if (this.stopped) return;
    try {
      this.reconnectPeer(peerId);
      this.emit('change');
    } catch {
      const message = 'The peer was authorized, but its connection could not be restarted.';
      this.link(peerId).error = message;
      try {
        this.emit('problem', message);
      } catch {
        // Listener failures cannot invalidate an already durable authorization.
      }
    }
  }
  private async pair(
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse,
  ): Promise<void> {
    const json = (status: number, value: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(value));
    };
    if (req.method !== 'POST' || req.url !== '/pair' || req.headers.origin) {
      json(404, { error: 'Not found' });
      return;
    }
    req.setTimeout(8000, () => req.destroy());
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of req) {
      length += (chunk as Buffer).length;
      if (length > 24000) {
        json(413, { error: 'Request too large' });
        return;
      }
      chunks.push(Buffer.from(chunk));
    }
    try {
      if (!this.requestGuards.get(req)?.())
        throw new PairingError('The receiving interface is no longer enabled', 409);
      let input: unknown;
      try {
        input = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        input = null;
      }
      let saved: Peer | undefined;
      const response = await this.pairingHost.handle(input, async (identity, beforeWrite) => {
        const lease = this.holdPeer(identity.nodeId);
        const generation = this.pairingGeneration;
        const commitGuard = () => {
          lease.check();
          if (generation !== this.pairingGeneration || !this.requestGuards.get(req)?.())
            throw new PairingError('The receiving interface is no longer enabled', 409);
        };
        try {
          saved = await this.savePeer(
            identity,
            undefined,
            () => {
              commitGuard();
              beforeWrite();
            },
            commitGuard,
          );
        } finally {
          lease.release();
        }
      });
      if (saved) this.peerCommitted(saved.id);
      json(200, response);
    } catch (error) {
      json(error instanceof PairingError ? error.status : 400, {
        error: error instanceof PairingError ? error.message : 'Pairing verification failed',
      });
    }
  }
  private pairRequest(
    endpoint: URL,
    input: unknown,
    certificate?: string,
  ): Promise<{ body: unknown; certificate: string }> {
    return new Promise((resolve, reject) => {
      const req = https.request(
        endpoint,
        {
          // Only public PAKE data crosses the initial, unauthenticated TLS channel.
          ...(certificate ? pinned(certificate) : { rejectUnauthorized: false }),
          agent: false,
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          timeout: 8000,
        },
        (res) => {
          const raw = (res.socket as tls.TLSSocket).getPeerCertificate().raw;
          if (!raw) {
            req.destroy(new Error('The remote node did not provide a certificate'));
            return;
          }
          const observed = new X509Certificate(raw).toString();
          const chunks: Buffer[] = [];
          let length = 0;
          res.on('data', (chunk: Buffer) => {
            length += chunk.length;
            if (length > 24000) req.destroy(new Error('Invalid node response'));
            else chunks.push(chunk);
          });
          res.on('end', () => {
            try {
              const body: unknown = JSON.parse(Buffer.concat(chunks).toString());
              if (res.statusCode !== 200) {
                const error = z.object({ error: z.string().max(240) }).safeParse(body);
                throw new PairingError(
                  error.success ? error.data.error : 'Connection rejected',
                  res.statusCode ?? 400,
                );
              }
              resolve({ body, certificate: observed });
            } catch (error) {
              reject(error);
            }
          });
          res.on('aborted', () => reject(new Error('The pairing response was interrupted')));
          res.on('error', reject);
        },
      );
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('The node is unavailable at this address')));
      req.end(JSON.stringify(input));
    });
  }
  async join(address: string, code: string, expectedNodeId?: string): Promise<Peer> {
    const generation = this.pairingGeneration;
    const beforeWrite = () => {
      if (this.stopped || generation !== this.pairingGeneration)
        throw new PairingError(
          'Pairing was canceled because this node stopped. Create a new access code to reconnect.',
          409,
        );
    };
    beforeWrite();
    const client = new PairingClient(code, {
      nodeId: this.settings.value.nodeId,
      label: this.settings.value.nodeLabel,
      certificate: this.certificate,
    });
    const normalized = normalizePeerAddress(address),
      endpoint = new URL(normalized);
    endpoint.protocol = 'https:';
    endpoint.pathname = '/pair';
    const challenge = await this.pairRequest(endpoint, client.start());
    const request = client.prove(challenge.body, challenge.certificate);
    if (expectedNodeId && client.nodeId() !== expectedNodeId.toLowerCase())
      throw new PairingError('The remote node does not match the selected discovery result', 409);
    beforeWrite();
    const lease = this.holdPeer(client.nodeId());
    try {
      const proof = await this.pairRequest(endpoint, request, client.certificate());
      lease.check();
      beforeWrite();
      const confirm = client.confirm(proof.body);
      let receipt: unknown;
      try {
        receipt = (await this.pairRequest(endpoint, confirm, client.certificate())).body;
      } catch (error) {
        if (error instanceof PairingError) throw error;
        // The exact same confirmation is idempotent; never start another claim here.
        try {
          receipt = (await this.pairRequest(endpoint, confirm, client.certificate())).body;
        } catch {
          throw new Error(
            'Pairing confirmation is uncertain. Create a new access code on the other computer to reconnect.',
          );
        }
      }
      const identity = client.finish(receipt);
      let peer: Peer;
      const commitGuard = () => {
        lease.check();
        beforeWrite();
      };
      try {
        peer = await this.savePeer(identity, normalized, commitGuard, commitGuard);
      } catch {
        throw new Error(
          'The remote node authorized this connection, but this computer could not save it. Create a new access code to reconnect.',
        );
      }
      if (this.stopped || generation !== this.pairingGeneration)
        throw new Error(
          'Pairing confirmation is uncertain because this node stopped during saving. Create a new access code to reconnect.',
        );
      this.peerCommitted(peer.id);
      return peer;
    } finally {
      lease.release();
    }
  }
  async close(): Promise<void> {
    this.stopped = true;
    this.pairingGeneration++;
    this.pairingLeases.clear();
    this.candidates.clear();
    for (const request of this.probes.keys()) request.destroy(new Error('Node stopped'));
    this.probes.clear();
    this.pairingHost.reset();
    clearInterval(this.heartbeat);
    clearInterval(this.inventoryTimer);
    await this.peerListeners.close();
    for (const link of this.links.values()) {
      link.generation++;
      clearTimeout(link.timer);
      link.timer = undefined;
      link.connecting = false;
      link.directorySupported = false;
      link.identitySupported = false;
      link.socket = null;
      link.activeAddress = null;
    }
    for (const ws of this.sockets) ws.terminate();
    for (const r of this.requests.values()) {
      clearTimeout(r.timer);
      r.reject(new Error('Node stopped'));
    }
    this.requests.clear();
    if (this.wss) await new Promise<void>((resolve) => this.wss!.close(() => resolve()));
  }
}

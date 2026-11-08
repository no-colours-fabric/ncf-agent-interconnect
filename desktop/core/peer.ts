import https from 'node:https';
import tls from 'node:tls';
import { readFile, writeFile } from 'node:fs/promises';
import { X509Certificate, randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { hostname } from 'node:os';
import { EventEmitter } from 'node:events';
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
  const parsed = nodeLabelSchema.safeParse(bytes.toString('utf8'));
  return parsed.success ? parsed.data : undefined;
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
  server?: https.Server;
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
  onIdentity: (peerId: string, label: string) => Promise<void> = async () => {};
  constructor(readonly settings: SettingsFile) {
    super();
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
    this.server = https.createServer({ cert: this.certificate, key: this.key }, (req, res) => {
      void this.pair(req, res).catch(() => {
        if (!res.headersSent) res.writeHead(400);
        res.end();
      });
    });
    this.server.requestTimeout = 10000;
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
    this.server.on('upgrade', (req, socket, head) => {
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
    const listen = (port: number) =>
      new Promise<void>((resolve, reject) => {
        this.server!.once('error', reject);
        this.server!.listen(port, this.settings.value.listenHost, () => {
          this.server!.off('error', reject);
          resolve();
        });
      });
    try {
      await listen(this.settings.value.peerPort);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw e;
      await listen(0);
      this.emit(
        'problem',
        'The listening port was in use. A free port was selected; use the address shown under Remote nodes.',
      );
    }
    this.server.on('error', (e) => this.emit('problem', e.message));
    this.port = (this.server.address() as { port: number }).port;
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
      };
      this.links.set(peerId, value);
    }
    return value;
  }
  states(): {
    id: string;
    connected: boolean;
    directorySupported: boolean;
    error: string | null;
  }[] {
    return this.settings.value.peers.map((p) => ({
      id: p.id,
      connected: this.link(p.id).socket?.readyState === WebSocket.OPEN,
      directorySupported: this.link(p.id).directorySupported,
      error: this.link(p.id).error,
    }));
  }
  private schedule(peer: Peer): void {
    const current = this.settings.value.peers.find((value) => value.id === peer.id);
    if (!current) return;
    peer = current;
    const link = this.link(peer.id);
    if (this.stopped || link.socket || link.timer || !peer.address) return;
    link.timer = setTimeout(() => {
      link.timer = undefined;
      this.connect(peer);
    }, 1500);
    link.timer.unref();
  }
  private connect(peer: Peer): void {
    const current = this.settings.value.peers.find((value) => value.id === peer.id);
    if (!current) return;
    peer = current;
    const link = this.link(peer.id);
    if (this.stopped || !peer.address || link.socket || link.connecting) return;
    link.connecting = true;
    const ws = new WebSocket(normalizePeerAddress(peer.address), {
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
    this.attach(peer, ws, true);
  }
  private attach(
    peer: Peer,
    ws: WebSocket,
    outbound: boolean,
    directorySupported = false,
    remoteLabel?: string,
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
          link.directorySupported = directorySupported;
          link.identitySupported = remoteLabel !== undefined;
          link.connecting = false;
          link.error = null;
          if (remoteLabel !== undefined) await this.onIdentity(peer.id, remoteLabel);
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
          await this.onIdentity(peer.id, frame.label);
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
  ): Promise<Peer> {
    let saved!: Peer;
    await this.settings.savePeers((current) => {
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
    }, beforeWrite);
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
      let input: unknown;
      try {
        input = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        input = null;
      }
      let saved: Peer | undefined;
      const response = await this.pairingHost.handle(input, async (identity, beforeWrite) => {
        const lease = this.holdPeer(identity.nodeId);
        try {
          saved = await this.savePeer(identity, undefined, () => {
            lease.check();
            beforeWrite();
          });
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
  async join(address: string, code: string): Promise<Peer> {
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
      try {
        peer = await this.savePeer(identity, normalized, () => {
          lease.check();
          beforeWrite();
        });
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
    this.pairingHost.reset();
    clearInterval(this.heartbeat);
    for (const link of this.links.values()) {
      link.generation++;
      clearTimeout(link.timer);
      link.timer = undefined;
      link.connecting = false;
      link.directorySupported = false;
      link.identitySupported = false;
      link.socket = null;
    }
    for (const ws of this.sockets) ws.terminate();
    for (const r of this.requests.values()) {
      clearTimeout(r.timer);
      r.reject(new Error('Node stopped'));
    }
    this.requests.clear();
    if (this.wss) await new Promise<void>((resolve) => this.wss!.close(() => resolve()));
    if (this.server?.listening) {
      this.server.closeIdleConnections();
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    }
  }
}

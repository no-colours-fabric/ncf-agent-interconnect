import { EventEmitter } from 'node:events';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import {
  envelopeSchema,
  deliveryStatus,
  nicknameKey,
  nicknameSchema,
  type AdapterProfile,
  type Attachment,
  type AgentClearInput,
  type AgentClearResponse,
  type Envelope,
  type Snapshot,
  type SendInput,
  type SendResult,
  type AgentDirectory,
  type NicknameConflict,
} from '../shared/contracts.js';
import { SettingsFile, localAddresses, adapterSchema, atomicJson } from './settings.js';
import { AgentStore, type ConnectInput, type ConnectResult } from './agent-store.js';
import { FileStore } from './files.js';
import { PeerNetwork, type Frame } from './peer.js';
import { AdapterRegistry } from './adapters.js';
import { McpEndpoint } from './mcp-http.js';
import { mcpInstructions } from './instructions.js';
import { ClientContexts, type ClientContext } from './client-contexts.js';
import { discoverCodex, codexEndpoints } from './codex-adapter.js';
import { AgentPresence } from './presence.js';

export class NodeService extends EventEmitter {
  store!: AgentStore;
  files!: FileStore;
  network!: PeerNetwork;
  mcp!: McpEndpoint;
  readonly settings: SettingsFile;
  readonly adapters = new AdapterRegistry();
  readonly contexts = new ClientContexts(this);
  private readonly presence: AgentPresence;
  running = false;
  private receiving: Promise<void> | null = null;
  private receiveAgain = false;
  private dispatching = new Set<string>();
  private jobs = new Set<Promise<void>>();
  private fileJobs = new Set<Promise<unknown>>();
  private cleaningFiles: Promise<void> | null = null;
  private cleanFilesAgain = false;
  private async fileOperation<T>(work: () => Promise<T>): Promise<T> {
    const operation = this.files.withLease(work);
    this.fileJobs.add(operation);
    try {
      return await operation;
    } finally {
      this.fileJobs.delete(operation);
      this.drainFileCleanup();
    }
  }
  private drainFileCleanup(): void {
    if (this.closing || !this.store || !this.files) return;
    if (this.cleaningFiles) {
      this.cleanFilesAgain = true;
      return;
    }
    if (!this.store.fileCleanup().length) return;
    this.cleaningFiles = this.files
      .exclusive(async () => {
        for (const task of this.store.fileCleanup()) {
          try {
            await this.files.cleanup(
              task,
              (id) => this.store.attachmentReferenced(id),
              () => !!this.store.get(task.messageId),
            );
            this.store.finishFileCleanup(task.messageId);
          } catch {
            // Keep the durable task for the next operation or restart; never log history or paths.
          }
        }
      })
      .finally(() => {
        this.cleaningFiles = null;
        const again = this.cleanFilesAgain;
        this.cleanFilesAgain = false;
        if (again) this.drainFileCleanup();
      });
  }
  private errors: string[] = [];
  private lifecycle: Promise<void> = Promise.resolve();
  private closing: Promise<void> | null = null;
  private adapterSetup: Promise<void> = Promise.resolve();
  private acceptingIntegrations = false;
  private directoryPublish?: NodeJS.Timeout;
  get integrationsReady(): boolean {
    return this.running && this.acceptingIntegrations;
  }
  constructor(
    readonly directory: string,
    private readonly integrationOptions: {
      codexSockets?: () => string[];
      clientLeaseMs?: number;
    } = {},
  ) {
    super();
    this.settings = new SettingsFile(directory);
    this.presence = new AgentPresence(
      () => this.refreshPresence(),
      integrationOptions.clientLeaseMs,
    );
  }
  private get integrationExtension(): string {
    return import.meta.url.endsWith('.ts') ? 'ts' : 'js';
  }
  private get openCodePlugin(): string {
    return path.join(this.directory, 'Integrations', 'opencode.' + this.integrationExtension);
  }
  private async publishIntegration(): Promise<void> {
    await mkdir(path.dirname(this.openCodePlugin), { recursive: true, mode: 0o700 });
    const source = await readFile(
      new URL('../integrations/opencode.' + this.integrationExtension, import.meta.url),
    );
    const temporary = this.openCodePlugin + '.' + randomUUID() + '.tmp';
    await writeFile(temporary, source, { mode: 0o600, flag: 'wx' });
    await rename(temporary, this.openCodePlugin);
    await atomicJson(path.join(this.directory, 'Integrations', 'node.json'), {
      url: this.snapshot().mcpUrl,
      token: this.settings.value.localToken,
    });
  }
  async open(): Promise<void> {
    await this.settings.load();
    this.store = new AgentStore(this.directory);
    this.files = new FileStore(this.directory, this.settings.value.exportRoots);
    await this.files.init();
    this.adapters.on('change', () => {
      this.refreshPresence();
      this.emit('change');
    });
    this.adapters.on('idle', () => this.drainAdapters());
    await this.start();
  }
  private transition(work: () => Promise<void>): Promise<void> {
    const operation = this.lifecycle.then(work);
    this.lifecycle = operation.catch(() => {});
    return operation;
  }
  start(): Promise<void> {
    if (this.closing) return Promise.reject(new Error('The app is closing'));
    return this.transition(() => this.startNow());
  }
  private async startNow(): Promise<void> {
    if (this.running) return;
    if (!localAddresses().includes(this.settings.value.listenHost)) {
      this.problem(
        'The saved local IP is unavailable. Listening is limited to this computer; choose a network IP in Settings.',
      );
      this.settings.value.listenHost = '127.0.0.1';
    }
    this.network = new PeerNetwork(this.settings);
    this.presence.reset();
    this.mcp = new McpEndpoint(this);
    this.network.onFrame = (id, frame) => this.receive(id, frame);
    this.network.on('change', () => this.emit('change'));
    this.network.on('problem', (e) => this.problem(String(e)));
    this.network.on('connected', (id: string) => {
      this.presence.begin(id);
      if (this.network.states().find((state) => state.id === id)?.directorySupported)
        void this.network.directory(id, this.presence.snapshot()).catch(() => {});
      void this.flush(id);
      void this.drainIncoming();
    });
    this.network.on('disconnected', () => {
      this.emit('change');
      this.mcp.notify({ source: 'application', type: 'directory_changed' });
    });
    try {
      await this.network.start();
      await this.mcp.start(this.settings.value.mcpPort);
      this.settings.value.peerPort = this.network.port;
      this.settings.value.mcpPort = this.mcp.port;
      await this.settings.save();
      this.running = true;
      this.refreshPresence();
      await this.adapters.configure(this.settings.value.adapters);
      await this.publishIntegration();
      this.acceptingIntegrations = true;
      void this.drainIncoming();
      this.drainAdapters();
      this.drainFileCleanup();
      this.emit('change');
    } catch (e) {
      this.running = false;
      this.acceptingIntegrations = false;
      await this.adapters.close();
      await this.network.close();
      await this.mcp.close();
      throw e;
    }
  }
  private problem(message: string): void {
    this.errors = [...this.errors.slice(-19), message];
    this.emit('change');
  }
  snapshot(): Snapshot {
    return {
      running: this.running,
      nodeId: this.settings.value.nodeId,
      nodeLabel: this.settings.value.nodeLabel,
      mcpUrl: `http://127.0.0.1:${this.settings.value.mcpPort}/mcp`,
      peerUrl: `wss://${this.settings.value.listenHost}:${this.settings.value.peerPort}/peer`,
      listenHost: this.settings.value.listenHost,
      localAddresses: localAddresses(),
      peers: this.settings.value.peers.map((p) => ({
        id: p.id,
        label: p.label,
        address: p.address,
        connected: this.running && !!this.network.states().find((s) => s.id === p.id)?.connected,
        error: this.network?.states().find((s) => s.id === p.id)?.error ?? null,
      })),
      agents: this.store.list(),
      directories: this.agentDirectories(),
      adapters: this.adapters.states(),
      exportRoots: this.settings.value.exportRoots,
      errors: [...this.errors],
    };
  }
  connect(args: Partial<ConnectInput> & { nickname: string; client: string }): ConnectResult {
    const input = z
      .object({
        nickname: nicknameSchema,
        client: z.string().min(1).max(120),
        chatId: z.string().min(1).max(200).optional(),
        adapterId: z.uuid().optional(),
        connectionId: z.uuid().optional(),
        transferId: z.uuid().optional(),
        confirmTransfer: z.boolean().optional(),
        resetHistory: z.boolean().optional(),
      })
      .strict()
      .parse(args);
    const adapterId =
      input.adapterId ?? this.settings.value.adapters.find((a) => a.kind === 'manual')!.id;
    const profile = this.settings.value.adapters.find((a) => a.id === adapterId);
    if (
      (profile?.kind === 'opencode-http' && input.chatId !== profile.sessionId) ||
      (profile?.kind === 'codex-desktop' && input.chatId !== profile.threadId)
    )
      throw new Error(
        'The adapter chatId must match its exact session. Use a separate integration for another chat.',
      );
    if (input.resetHistory) {
      const previous = this.store
        .list()
        .find((agent) => agent.key === nicknameKey(input.nickname))?.binding;
      const prior = this.settings.value.adapters.find(
        (adapter) => adapter.id === previous?.adapterId,
      );
      if (
        prior &&
        profile &&
        prior.kind === profile.kind &&
        ((profile.kind === 'codex-desktop' && prior.threadId === profile.threadId) ||
          (profile.kind === 'opencode-http' &&
            prior.workspace === profile.workspace &&
            prior.sessionId === profile.sessionId))
      )
        throw new Error('A fresh start requires another exact chat');
    }
    this.adapters.get(adapterId);
    const result = this.store.connect({
      ...input,
      chatId: input.chatId ?? input.connectionId ?? randomUUID(),
      adapterId,
    });
    if (result.status === 'connected') {
      this.mcp.notify({
        source: 'application',
        type: 'binding_changed',
        nickname: result.nickname,
      });
      this.drainAdapters();
      if (result.historyCleared) this.drainFileCleanup();
    }
    this.emit('change');
    this.refreshPresence();
    const warnings = this.nicknameWarnings(input.nickname);
    return warnings.length ? { ...result, warnings } : result;
  }
  clearAgents(
    args: AgentClearInput,
    requester: { channel: 'interface' | 'mcp'; session: string; connectionId?: string },
  ): AgentClearResponse {
    const input = z
      .object({
        scope: z.enum(['agent', 'all']),
        nickname: nicknameSchema.optional(),
        operationId: z.uuid().optional(),
        confirm: z.boolean().default(false),
      })
      .strict()
      .parse(args);
    const result = this.store.clearAgents(input, requester);
    if (result.status === 'cleared') {
      this.refreshPresence();
      this.mcp.notify({ source: 'application', type: 'agents_cleared', scope: result.scope });
      this.emit('change');
      this.drainAdapters();
      this.drainFileCleanup();
    }
    return result;
  }
  touchClientSession(session: string, connectionId?: string): void {
    if (connectionId) this.store.assertOwner(connectionId);
    this.presence.touch(session, connectionId);
  }
  clientSessionVersion(session: string): number {
    return this.presence.version(session);
  }
  uncertainClientSession(session: string, version: number): boolean {
    return this.presence.uncertain(session, version);
  }
  closeClientSession(session: string): void {
    this.presence.close(session);
  }
  disconnect(connectionId: string): { disconnected: true } {
    this.store.disconnect(connectionId);
    this.refreshPresence();
    this.emit('change');
    return { disconnected: true };
  }
  private refreshPresence(): void {
    if (!this.store || !this.network) return;
    const changed = this.presence.update(
      this.store.list().flatMap((agent) => {
        if (!agent.binding) return [];
        const online = this.running && this.presence.isOnline(agent.binding.connectionId);
        const adapter = this.adapters
          .states()
          .find((value) => value.id === agent.binding!.adapterId);
        const automatic = adapter?.state === 'ready' && adapter.capabilities.wakeIdle;
        return [
          {
            nickname: agent.nickname,
            availability: online ? ('online' as const) : ('unknown' as const),
            delivery: !online
              ? ('unknown' as const)
              : automatic
                ? ('automatic' as const)
                : ('mcp' as const),
          },
        ];
      }),
    );
    if (!changed) return;
    if (this.running && !this.directoryPublish) {
      this.directoryPublish = setTimeout(() => {
        this.directoryPublish = undefined;
        for (const peer of this.network.states())
          if (this.running && peer.connected && peer.directorySupported)
            void this.network.directory(peer.id, this.presence.snapshot()).catch(() => {});
      }, 25);
      this.directoryPublish.unref();
    }
    this.emit('change');
    this.mcp?.notify({ source: 'application', type: 'directory_changed' });
  }
  agentDirectories(): AgentDirectory[] {
    const local = this.presence.snapshot();
    return [
      {
        nodeId: this.settings.value.nodeId,
        nodeLabel: this.settings.value.nodeLabel,
        local: true,
        state: this.running ? 'ready' : 'offline',
        epoch: local.epoch,
        revision: local.revision,
        updatedAt: null,
        total: local.total,
        truncated: local.total > local.agents.length,
        agents: this.running ? local.agents : [],
      },
      ...this.settings.value.peers.map((peer) => {
        const state = this.network?.states().find((value) => value.id === peer.id);
        return this.presence.remoteDirectory(
          peer.id,
          peer.label,
          this.running && !!state?.connected,
          !!state?.directorySupported,
        );
      }),
    ];
  }
  nicknameWarnings(nickname: string): NicknameConflict[] {
    const key = nicknameKey(nickname);
    return this.agentDirectories()
      .filter((directory) => !directory.local && directory.state === 'ready')
      .flatMap((directory) =>
        directory.agents
          .filter((agent) => nicknameKey(agent.nickname) === key)
          .map((agent) => ({
            code: 'nickname_on_remote_node' as const,
            nodeId: directory.nodeId,
            nodeLabel: directory.nodeLabel,
            nickname: agent.nickname,
            availability: agent.availability,
          })),
      );
  }
  listAgents(
    args: {
      nodeId?: string;
      nickname?: string;
      includeUnavailable?: boolean;
      cursor?: string;
      limit?: number;
    } = {},
  ): unknown {
    const directories = this.agentDirectories().filter(
      (directory) => !args.nodeId || directory.nodeId === args.nodeId.toLowerCase(),
    );
    if (args.nodeId && !directories.length) throw new Error('The node is not configured');
    const snapshotId = createHash('sha256')
      .update(
        JSON.stringify({
          directories,
          nodeId: args.nodeId,
          nickname: args.nickname,
          includeUnavailable: !!args.includeUnavailable,
        }),
      )
      .digest('hex');
    let offset = 0;
    if (args.cursor) {
      const cursor = z
        .object({ snapshotId: z.string(), offset: z.number().int().nonnegative() })
        .strict()
        .parse(JSON.parse(Buffer.from(args.cursor, 'base64url').toString()));
      if (cursor.snapshotId !== snapshotId)
        throw new Error('The directory changed; restart pagination without a cursor');
      offset = cursor.offset;
    }
    const agents = directories
      .filter((directory) => directory.state === 'ready')
      .flatMap((directory) =>
        directory.agents
          .filter(
            (agent) =>
              (args.includeUnavailable || agent.availability === 'online') &&
              (!args.nickname || nicknameKey(agent.nickname) === nicknameKey(args.nickname)),
          )
          .map((agent) => ({
            ...agent,
            nodeId: directory.nodeId,
            nodeLabel: directory.nodeLabel,
            local: directory.local,
          })),
      );
    const limit = args.limit ?? 100,
      hasMore = offset + limit < agents.length;
    return {
      snapshotId,
      complete: directories.every(
        (directory) => directory.state === 'ready' && !directory.truncated,
      ),
      nodes: directories.map(({ agents: _agents, ...node }) => node),
      agents: agents.slice(offset, offset + limit),
      hasMore,
      nextCursor: hasMore
        ? Buffer.from(JSON.stringify({ snapshotId, offset: offset + limit })).toString('base64url')
        : null,
    };
  }
  async installAdapter(raw: AdapterProfile): Promise<void> {
    if (!this.running) throw new Error('Node stopped');
    const profile = adapterSchema.parse(raw),
      index = this.settings.value.adapters.findIndex((a) => a.id === profile.id);
    if (index >= 0) this.settings.value.adapters[index] = profile;
    else this.settings.value.adapters.push(profile);
    await this.settings.save();
    await this.adapters.add(profile);
    this.emit('change');
    this.drainAdapters();
  }
  async connectAutomatic(
    args: {
      nickname: string;
      contextToken?: string;
      connectionId?: string;
      transferId?: string;
      confirmTransfer?: boolean;
      resetHistory?: boolean;
    },
    host: { client: string; meta?: Record<string, unknown> },
  ): Promise<ConnectResult & { delivery?: { automatic: boolean; description: string } }> {
    const { contextToken, ...input } = args;
    let context: ClientContext | undefined;
    if (contextToken) context = this.contexts.consume(contextToken);
    else if (/codex/i.test(host.client)) {
      let metadata = host.meta?.['x-codex-turn-metadata'];
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch {
          metadata = undefined;
        }
      }
      const nested =
        metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
      const threadId = z
        .uuid()
        .safeParse(host.meta?.threadId ?? nested.thread_id ?? nested.threadId);
      if (!threadId.success)
        throw new Error(
          'Codex did not provide the current chat context. Automatic binding is not supported by this client version.',
        );
      const result = await this.connectCodex(
        { ...input, client: 'Codex' },
        { threadId: threadId.data },
      );
      return {
        ...result,
        delivery: {
          automatic: true,
          description:
            'Messages with their sender, body and attachment links are delivered automatically to this Codex Desktop chat. This integration is experimental.',
        },
      };
    } else if (/opencode/i.test(host.client))
      throw new Error(
        'For automatic OpenCode binding, add the bundled plugin using the MCP setup instructions. No session configuration is required.',
      );
    if (!context && input.connectionId) {
      if (input.transferId)
        context = this.store.transferContext(input.connectionId, input.transferId, input.nickname);
      else {
        const owner = this.store.assertOwner(input.connectionId);
        if (owner.key !== nicknameKey(input.nickname))
          throw new Error('The connection belongs to another agent');
        context = {
          client: owner.binding.client,
          chatId: owner.binding.chatId,
          adapterId: owner.binding.adapterId,
        };
      }
      if (context.client !== host.client)
        throw new Error('This connection was created by another client');
    }
    context ??= {
      client: host.client.slice(0, 120),
      chatId: randomUUID(),
      adapterId: this.settings.value.adapters.find((a) => a.kind === 'manual')!.id,
    };
    if (contextToken && !input.connectionId) {
      const existing = this.store
        .list()
        .find((a) => a.key === nicknameKey(input.nickname))?.binding;
      if (
        existing &&
        existing.chatId === context.chatId &&
        existing.adapterId === context.adapterId &&
        existing.client === context.client
      )
        input.connectionId = existing.connectionId;
    }
    const result = this.connect({ ...input, ...context }),
      automatic = this.adapters.get(context.adapterId).status().capabilities.wakeIdle;
    return {
      ...result,
      delivery: {
        automatic,
        description: automatic
          ? 'Incoming messages are delivered to this chat automatically'
          : 'This client uses standard MCP. Automatic wake-up is not supported; history is available in the app and through MCP.',
      },
    };
  }
  async connectCodex(
    args: Partial<ConnectInput> & { nickname: string; client: string },
    target: { threadId: string; socket?: string },
  ): Promise<ConnectResult> {
    const validated = z
      .object({ threadId: z.uuid(), socket: z.string().min(1).max(2000).optional() })
      .strict()
      .parse(target);
    if (args.chatId && args.chatId !== validated.threadId)
      throw new Error('chatId and codexTarget.threadId must refer to the same chat');
    let adapterId = '';
    const setup = this.adapterSetup.then(async () => {
      const socket =
        validated.socket ??
        (await discoverCodex(
          validated.threadId,
          this.integrationOptions.codexSockets?.() ?? [
            ...codexEndpoints(),
            ...this.settings.value.adapters
              .filter((a) => a.kind === 'codex-desktop' && a.socket)
              .map((a) => a.socket!),
          ],
        ));
      let profile = this.settings.value.adapters.find(
        (a) => a.kind === 'codex-desktop' && a.threadId === validated.threadId,
      );
      if (args.adapterId && profile?.id !== args.adapterId)
        throw new Error('A different adapter was selected; use the integration for this chat');
      if (!profile) {
        profile = {
          id: randomUUID(),
          label: 'Codex',
          kind: 'codex-desktop',
          threadId: validated.threadId,
          socket,
        };
        this.settings.value.adapters.push(profile);
        await this.settings.save();
        await this.adapters.add(profile);
      } else if (
        profile.socket !== socket ||
        this.adapters.get(profile.id).status().state !== 'ready'
      ) {
        profile.socket = socket;
        await this.settings.save();
        await this.adapters.add(profile);
      }
      adapterId = profile.id;
      this.emit('change');
      const status = this.adapters.get(adapterId).status();
      if (status.state !== 'ready')
        throw new Error(status.error ?? 'The exact Codex chat is unavailable');
    });
    this.adapterSetup = setup.catch(() => {});
    await setup;
    const existing = this.store.list().find((a) => a.key === nicknameKey(args.nickname))?.binding;
    const connectionId =
      args.connectionId ??
      (existing?.chatId === validated.threadId &&
      existing.adapterId === adapterId &&
      existing.client === args.client
        ? existing.connectionId
        : undefined);
    return this.connect({ ...args, connectionId, chatId: validated.threadId, adapterId });
  }
  async read(connectionId: string, after = 0, limit = 50, unread = false): Promise<unknown> {
    return this.fileOperation(async () => {
      const owner = this.store.assertOwner(connectionId),
        page = this.store.history(owner.key, after, limit, unread);
      const prepared = await allFileResults(
        page.messages.map(async (row) => ({
          ...row,
          files: await allFileResults(
            row.envelope.attachments.map(async (file) => ({
              ...file,
              localPath: await this.files.materialize(row.envelope.id, file),
            })),
          ),
        })),
      );
      this.store.assertOwner(connectionId);
      for (const row of prepared)
        if (!this.store.get(row.envelope.id, row.direction))
          throw new Error('The message was cleared');
      const delivered = await this.recordDelivery(
        connectionId,
        prepared
          .filter((row) => row.direction === 'in' && row.state === 'ready')
          .map((row) => row.envelope.id),
      );
      this.store.assertOwner(connectionId);
      for (const row of prepared)
        if (!this.store.get(row.envelope.id, row.direction))
          throw new Error('The message was cleared');
      const messages = prepared
        .filter((row) => !unread || delivered.has(row.envelope.id))
        .map(({ state, error: _error, ...message }) => ({
          ...message,
          ...(message.direction === 'in'
            ? { replyRef: 'r' + this.store.get(message.envelope.id, 'in')!.sequence.toString(36) }
            : {}),
          delivery: deliveryStatus(
            this.store.get(message.envelope.id, message.direction)?.state ?? state,
          ),
        }));
      return { ...page, messages };
    });
  }
  private async recordDelivery(connectionId: string, ids: string[]): Promise<Set<string>> {
    const delivered = this.store.recordDelivery(connectionId, ids);
    await Promise.all(
      [...delivered].map(async (id) => {
        const row = this.store.get(id, 'in')!;
        if (row.envelope.fromNode !== this.settings.value.nodeId)
          await this.network.receipt(row.envelope.fromNode, id, 'processed').catch(() => {});
      }),
    );
    if (delivered.size) this.emit('change');
    return delivered;
  }
  resolveReplyAddress(
    connectionId: string,
    address: {
      replyRef?: string;
      recipientNode?: string;
      recipientNickname?: string;
      replyTo?: string | null;
    },
  ): Pick<SendInput, 'recipientNode' | 'recipientNickname' | 'replyTo'> {
    const owner = this.store.assertOwner(connectionId);
    if (address.replyRef !== undefined) {
      if (
        address.recipientNode !== undefined ||
        address.recipientNickname !== undefined ||
        address.replyTo !== undefined
      )
        throw new Error('Use either replyRef or a full explicit reply address, not both');
      const ref = address.replyRef;
      if (!/^r[1-9a-z][0-9a-z]{0,10}$/.test(ref)) throw new Error('Invalid replyRef');
      const sequence = Number.parseInt(ref.slice(1), 36);
      if (!Number.isSafeInteger(sequence) || 'r' + sequence.toString(36) !== ref)
        throw new Error('Invalid replyRef');
      const original = this.store.incomingBySequence(owner.key, sequence)?.envelope;
      if (!original || original.toNode !== this.settings.value.nodeId)
        throw new Error('replyRef does not identify an incoming message for this agent');
      return {
        recipientNode: original.fromNode,
        recipientNickname: original.fromNickname,
        replyTo: original.id,
      };
    }
    if (!address.recipientNode || !address.recipientNickname)
      throw new Error('recipientNode and recipientNickname are required without replyRef');
    return {
      recipientNode: address.recipientNode,
      recipientNickname: address.recipientNickname,
      replyTo: address.replyTo,
    };
  }
  async send(args: SendInput & { connectionId: string }): Promise<SendResult> {
    const before = this.store.assertOwner(args.connectionId);
    return this.sendFrom(before.nickname, args, () => {
      this.store.assertOwner(args.connectionId);
    });
  }
  private async sendFrom(
    nickname: string,
    args: SendInput,
    stillOwner: () => void = () => {},
  ): Promise<SendResult> {
    if (!args.recipientNode)
      throw new Error('recipientNode is required; select an explicit node UUID from node_peers');
    const recipientNode = z.uuid().parse(args.recipientNode).toLowerCase(),
      local = recipientNode === this.settings.value.nodeId,
      replyTo = args.replyTo ? z.uuid().parse(args.replyTo) : null;
    if (!local && !this.settings.value.peers.some((p) => p.id === recipientNode))
      throw new Error('The remote node has not been configured by the user');
    const checkReply = () => {
      if (replyTo) {
        const original = this.store.get(replyTo, 'in')?.envelope;
        if (
          !original ||
          original.toNode !== this.settings.value.nodeId ||
          nicknameKey(original.toNickname) !== nicknameKey(nickname) ||
          original.fromNode !== recipientNode ||
          nicknameKey(original.fromNickname) !== nicknameKey(args.recipientNickname)
        )
          throw new Error(
            'The reply address must match the sender of an incoming message for this agent',
          );
      }
    };
    checkReply();
    this.store.ensure(nickname);
    const sourceStamp = this.store.sourceStamp(nickname);
    const checkSource = () => {
      stillOwner();
      if (sourceStamp.connectionId) this.store.assertOwner(sourceStamp.connectionId);
      const current = this.store.sourceStamp(nickname);
      if (
        current.incarnation !== sourceStamp.incarnation ||
        current.generation !== sourceStamp.generation ||
        current.connectionId !== sourceStamp.connectionId
      )
        throw new Error('The source agent binding changed; this pending send was cancelled');
    };

    const id = args.id ? z.uuid().parse(args.id) : randomUUID();
    const envelope = await this.fileOperation(async () => {
      checkSource();
      if (this.store.clearedState(id, 'out'))
        throw new Error('This message ID belongs to cleared history. Use a new message ID');
      const snapshots = await Promise.allSettled(
        (args.files ?? []).map((file) => this.files.snapshot(file)),
      );
      const attachments = snapshots.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
      );
      try {
        const failed = snapshots.find((result) => result.status === 'rejected');
        if (failed?.status === 'rejected') throw failed.reason;
        checkSource();
        checkReply();
        const existing = this.store.get(id, 'out');
        const envelope = envelopeSchema.parse({
          protocol: 2,
          id,
          fromNode: this.settings.value.nodeId,
          toNode: recipientNode,
          fromNickname: nickname,
          toNickname: args.recipientNickname,
          createdAt: existing?.envelope.createdAt ?? new Date().toISOString(),
          text: args.text,
          replyTo,
          attachments,
        });
        if (local) {
          const previous = this.store.get(id, 'in');
          this.store.insertLocal(envelope, this.running);
          if (
            this.running &&
            this.store.get(id, 'in')?.state === 'ready' &&
            (!previous || previous.state === 'received')
          )
            this.messageReady(envelope);
        } else this.store.insert(envelope, 'out');
        return envelope;
      } catch (error) {
        this.store.queueFileCleanup(randomUUID(), attachments);
        throw error;
      }
    });
    checkSource();
    if (!this.store.get(id, 'out')) throw new Error('The outgoing message was cleared');
    if (!local && this.running) await this.network.message(envelope).catch(() => {});
    checkSource();
    const current = this.store.get(id, 'out');
    if (!current) throw new Error('The outgoing message was cleared');
    this.emit('change');
    return {
      id,
      accepted: true,
      recipientNode,
      recipientNickname: envelope.toNickname,
      delivery: deliveryStatus(current.state),
    };
  }
  async receiveFile(connectionId: string, messageId: string, fileId: string): Promise<unknown> {
    return this.fileOperation(async () => {
      const owner = this.store.assertOwner(connectionId),
        row = [this.store.get(messageId, 'in'), this.store.get(messageId, 'out')].find(
          (candidate) =>
            candidate &&
            (candidate.direction === 'in'
              ? nicknameKey(candidate.envelope.toNickname)
              : nicknameKey(candidate.envelope.fromNickname)) === owner.key,
        );
      if (
        !row ||
        (row.direction === 'in'
          ? nicknameKey(row.envelope.toNickname)
          : nicknameKey(row.envelope.fromNickname)) !== owner.key ||
        row.state === 'received'
      )
        throw new Error('The attachment does not belong to this agent or is not ready');
      const file = row.envelope.attachments.find((f) => f.id === fileId);
      if (!file) throw new Error('Attachment not found');
      const localPath = await this.files.materialize(messageId, file);
      this.store.assertOwner(connectionId);
      if (!this.store.get(messageId, row.direction)) throw new Error('The message was cleared');
      return { ...file, localPath };
    });
  }
  async withUserAttachment<T>(
    messageId: string,
    fileId: string,
    work: (file: Attachment, localPath: string, assertCurrent: () => void) => Promise<T>,
  ): Promise<T> {
    return this.fileOperation(async () => {
      const row = this.store.get(messageId),
        file = row?.envelope.attachments.find((file) => file.id === fileId);
      if (!row || row.state === 'received' || !file)
        throw new Error('Verified attachment not found');
      const assertCurrent = () => {
        if (!this.store.get(messageId, row.direction))
          throw new Error(
            'The attachment message was cleared. An already opened or copied external file cannot be recalled',
          );
      };
      const localPath = await this.files.materialize(messageId, file);
      assertCurrent();
      const result = await work(file, localPath, assertCurrent);
      assertCurrent();
      return result;
    });
  }
  private async receive(peerId: string, frame: Frame): Promise<void> {
    if (frame.type === 'directory') {
      const link = this.network.states().find((state) => state.id === peerId);
      if (!link?.connected || !link.directorySupported)
        throw new Error('The directory does not belong to a negotiated peer connection');
      if (this.presence.receive(peerId, frame.snapshot)) {
        this.emit('change');
        this.mcp.notify({ source: 'application', type: 'directory_changed', nodeId: peerId });
      }
    } else if (frame.type === 'message') {
      await this.fileOperation(async () => {
        const envelope = frame.envelope;
        if (envelope.fromNode !== peerId || envelope.toNode !== this.settings.value.nodeId)
          throw new Error('The message route does not match the connection');
        this.store.insert(envelope, 'in');
        const state =
          this.store.get(envelope.id, 'in')?.state ?? this.store.clearedState(envelope.id, 'in');
        if (state && state !== 'queued') await this.network.receipt(peerId, envelope.id, state);
      });
      void this.drainIncoming();
      this.emit('change');
    } else if (frame.type === 'receipt') {
      if (this.store.clearedState(frame.id, 'out')) return;
      if (this.store.get(frame.id, 'out')?.envelope.toNode !== peerId)
        throw new Error('The receipt does not belong to this sender');
      this.store.receipt(frame.id, frame.state);
      this.emit('change');
    } else if (frame.type === 'blob/read') {
      try {
        const row = this.store.get(frame.messageId, 'out'),
          file = row?.envelope.attachments.find((f) => f.id === frame.fileId);
        if (row?.direction !== 'out' || row.envelope.toNode !== peerId || !file)
          throw new Error('Invalid file request');
        const data = await this.fileOperation(async () => {
          if (!this.store.get(frame.messageId, 'out')) throw new Error('The message was cleared');
          const data = await this.files.chunk(file, frame.offset, frame.length);
          if (!this.store.get(frame.messageId, 'out')) throw new Error('The message was cleared');
          return data;
        });
        if (!this.store.get(frame.messageId, 'out')) throw new Error('The message was cleared');
        await this.network.send(peerId, { type: 'blob/result', requestId: frame.requestId, data });
      } catch {
        await this.network
          .send(peerId, {
            type: 'blob/error',
            requestId: frame.requestId,
            error: 'The attachment is unavailable',
          })
          .catch(() => {});
      }
    }
  }
  private async flush(peerId: string): Promise<void> {
    for (const row of this.store.pending('out'))
      if (row.envelope.toNode === peerId && this.store.get(row.envelope.id, 'out')) {
        try {
          await this.network.message(row.envelope);
        } catch {
          break;
        }
      }
  }
  private drainIncoming(): Promise<void> {
    if (this.receiving) {
      this.receiveAgain = true;
      return this.receiving;
    }
    this.receiving = (async () => {
      do {
        this.receiveAgain = false;
        for (const row of this.store.pending('in')) {
          try {
            await this.fileOperation(async () => {
              if (!this.store.get(row.envelope.id, 'in')) return;
              const local = row.envelope.fromNode === this.settings.value.nodeId;
              for (const file of row.envelope.attachments) {
                if (local) {
                  if (!(await this.files.exists(file)))
                    throw new Error('The local attachment is damaged or unavailable');
                } else
                  await this.files.receive(file, (offset, length) =>
                    this.network.chunk(
                      row.envelope.fromNode,
                      row.envelope.id,
                      file.id,
                      offset,
                      length,
                    ),
                  );
              }
              if (!this.store.get(row.envelope.id, 'in')) return;
              this.store.ready(row.envelope.id);
              if (!local)
                await this.network
                  .receipt(row.envelope.fromNode, row.envelope.id, 'ready')
                  .catch(() => {});
              if (this.store.get(row.envelope.id, 'in')) this.messageReady(row.envelope);
            });
          } catch (e) {
            this.store.error(row.envelope.id, (e as Error).message);
            this.emit('change');
          }
        }
      } while (this.receiveAgain && this.running);
    })().finally(() => {
      this.receiving = null;
    });
    return this.receiving;
  }
  private messageReady(envelope: Envelope): void {
    this.mcp.notify({
      source: 'application',
      type: 'message_ready',
      nickname: envelope.toNickname,
      messageId: envelope.id,
    });
    this.emit('change');
    this.drainAdapters();
  }
  private drainAdapters(): void {
    if (!this.running) return;
    for (const event of this.store.pendingSystemEvents()) {
      const key = 'system:' + event.id;
      const adapter = this.adapters.get(event.binding.adapterId);
      if (this.dispatching.has(key) || !adapter.status().capabilities.wakeIdle) continue;
      this.dispatching.add(key);
      const job = (async () => {
        this.store.systemDispatch(event.id, 'dispatching');
        try {
          const result = await adapter.deliver({
            nickname: event.nickname,
            binding: event.binding,
            messageId: 'system:' + event.id,
            systemEvent: event,
          });
          this.store.systemDispatch(event.id, result.state, result.error ?? null);
        } catch (e) {
          this.store.systemDispatch(event.id, 'uncertain', (e as Error).message);
        } finally {
          this.dispatching.delete(key);
          this.emit('change');
        }
      })();
      this.jobs.add(job);
      void job.finally(() => this.jobs.delete(job));
    }
    for (const identity of this.store.list()) {
      if (!identity.binding) continue;
      const binding = identity.binding,
        dispatchKey = identity.key + ':' + identity.binding.connectionId,
        adapter = this.adapters.get(binding.adapterId);
      if (this.dispatching.has(dispatchKey) || !adapter.status().capabilities.wakeIdle) continue;
      const ready = this.store.history(identity.key, 0, 200, true).messages;
      const row = ready.find((message) => {
        const previous = this.store.dispatchState(message.envelope.id);
        return (
          !previous ||
          previous.connectionId !== binding.connectionId ||
          ['waiting', 'failed', 'admitted'].includes(previous.state)
        );
      });
      if (!row) continue;
      this.dispatching.add(dispatchKey);
      const job = (async () => {
        let admitted = false,
          submitting = false;
        try {
          this.store.assertOwner(binding.connectionId);
          this.store.dispatch(row.envelope.id, binding.connectionId, 'dispatching');
          const files = await this.fileOperation(() =>
            allFileResults(
              row.envelope.attachments.map(async (file) => ({
                ...file,
                localPath: await this.files.materialize(row.envelope.id, file),
              })),
            ),
          );
          this.store.assertOwner(binding.connectionId);
          if (!this.store.get(row.envelope.id, 'in')) throw new Error('The message was cleared');
          submitting = true;
          const result = await adapter.deliver({
            nickname: identity.nickname,
            binding,
            messageId: row.envelope.id,
            replyRef: 'r' + this.store.get(row.envelope.id, 'in')!.sequence.toString(36),
            message: {
              fromNode: row.envelope.fromNode,
              fromNickname: row.envelope.fromNickname,
              text: row.envelope.text,
              files,
            },
            isCurrent: () => {
              try {
                this.store.assertOwner(binding.connectionId);
                return this.store.get(row.envelope.id, 'in')?.state === 'ready';
              } catch {
                return false;
              }
            },
          });
          if (result.state === 'admitted') {
            await this.recordDelivery(binding.connectionId, [row.envelope.id]);
            admitted = true;
          } else
            this.store.dispatch(
              row.envelope.id,
              binding.connectionId,
              result.state,
              result.error ?? null,
            );
        } catch (e) {
          this.store.dispatch(
            row.envelope.id,
            binding.connectionId,
            submitting ? 'uncertain' : 'failed',
            (e as Error).message,
          );
        } finally {
          this.dispatching.delete(dispatchKey);
          this.emit('change');
          if (admitted) this.drainAdapters();
        }
      })();
      this.jobs.add(job);
      void job.finally(() => this.jobs.delete(job));
    }
  }
  async userCall(
    method: string,
    raw: unknown = {},
    context: { requesterSession?: string } = {},
  ): Promise<unknown> {
    if (method === 'snapshot') return this.snapshot();
    if (method === 'clearAgents')
      return this.clearAgents(raw as AgentClearInput, {
        channel: 'interface',
        session: context.requesterSession ?? 'local-interface',
      });
    if (method === 'chatHistory') {
      const { nickname, incarnation, before, limit } = z
        .object({
          nickname: nicknameSchema,
          incarnation: z.uuid().optional(),
          before: z.number().int().positive().optional(),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .strict()
        .parse(raw);
      if (incarnation && this.store.sourceStamp(nickname).incarnation !== incarnation)
        throw new Error('The selected agent changed');
      return this.store.chatHistory(nicknameKey(nickname), before, limit);
    }
    if (method === 'history') {
      const { nickname, after, limit, incarnation } = z
        .object({
          nickname: nicknameSchema,
          incarnation: z.uuid().optional(),
          after: z.number().int().min(0).default(0),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .parse(raw);
      if (incarnation && this.store.sourceStamp(nickname).incarnation !== incarnation)
        throw new Error('The selected agent changed');
      return this.store.history(nicknameKey(nickname), after, limit);
    }
    if (method === 'instructions') {
      const { client } = z.object({ client: z.enum(['cursor', 'opencode', 'codex']) }).parse(raw);
      return mcpInstructions(
        this.snapshot().mcpUrl,
        this.settings.value.localToken,
        client,
        pathToFileURL(this.openCodePlugin).href,
      );
    }
    if (method === 'accessCode') {
      if (!this.running) throw new Error('Start the node first');
      return this.network.accessCode();
    }
    if (method === 'connectPeer') {
      const args = z
        .object({ address: z.string().min(1).max(1000), code: z.string().max(30000) })
        .strict()
        .parse(raw);
      const peer = await this.network.join(args.address, args.code);
      return { id: peer.id, label: peer.label };
    }
    if (method === 'registerAgent') {
      const { nickname } = z.object({ nickname: nicknameSchema }).parse(raw);
      const key = this.store.ensure(nickname);
      const identity = this.store.list().find((c) => c.key === key)!;
      this.emit('change');
      return { nickname: identity.nickname };
    }
    if (method === 'saveNode') {
      const input = z
        .object({ nodeLabel: z.string().min(1).max(120), listenHost: z.string() })
        .strict()
        .parse(raw);
      if (!localAddresses().includes(input.listenHost))
        throw new Error('Choose a local IP address');
      const restart = input.listenHost !== this.settings.value.listenHost;
      if (restart) await this.stop();
      Object.assign(this.settings.value, input);
      await this.settings.save();
      if (restart) await this.start();
      this.emit('change');
      return { saved: true };
    }
    if (method === 'stop') {
      await this.stop();
      return { running: false };
    }
    if (method === 'start') {
      await this.start();
      return { running: true };
    }
    if (method === 'send') {
      const args = z
        .object({
          nickname: nicknameSchema,
          sourceIncarnation: z.uuid().optional(),
          recipientNode: z.uuid(),
          recipientNickname: nicknameSchema,
          text: z.string().min(1).max(65536),
          files: z.array(z.string()).max(16).default([]),
        })
        .strict()
        .parse(raw);
      if (
        args.sourceIncarnation &&
        this.store.sourceStamp(args.nickname).incarnation !== args.sourceIncarnation
      )
        throw new Error('The selected source agent changed');
      return this.sendFrom(args.nickname, args);
    }
    if (method === 'exportRoots') {
      const { roots } = z.object({ roots: z.array(z.string().min(1)).min(1).max(32) }).parse(raw);
      for (const root of roots) await mkdir(root, { recursive: true, mode: 0o700 });
      this.settings.value.exportRoots = roots;
      this.files.exportRoots = roots;
      await this.settings.save();
      this.emit('change');
      return { saved: true };
    }
    throw new Error('Unknown interface operation');
  }
  stop(): Promise<void> {
    return this.transition(() => this.stopNow());
  }
  private async stopNow(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    clearTimeout(this.directoryPublish);
    this.directoryPublish = undefined;
    this.acceptingIntegrations = false;
    this.contexts.clear();
    this.store.invalidateClearRequests();
    await this.adapters.close();
    await this.network.close();
    await this.receiving;
    await Promise.all([...this.jobs]);
    await this.mcp.close();
    this.emit('change');
  }
  close(): Promise<void> {
    if (!this.closing)
      this.closing = (async () => {
        await this.stop();
        await Promise.allSettled([...this.fileJobs]);
        await this.cleaningFiles;
        this.store.close();
      })();
    return this.closing;
  }
}

// A failed file must not release its lease while sibling operations still write copies.
async function allFileResults<T>(operations: Promise<T>[]): Promise<T[]> {
  const results = await Promise.allSettled(operations);
  const failed = results.find((result) => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
  return results.map((result) => (result as PromiseFulfilledResult<T>).value);
}

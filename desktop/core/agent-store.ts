import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  nicknameKey,
  type Binding,
  type Attachment,
  type AgentClearInput,
  type AgentClearPreview,
  type AgentClearResponse,
  type AgentIdentity,
  type Envelope,
  type Message,
  type MessageState,
  type ChatHistoryPage,
  type SystemEvent,
  type NicknameConflict,
} from '../shared/contracts.js';

type Row = Record<string, string | number | null>;
export interface ConnectInput {
  nickname: string;
  client: string;
  chatId: string;
  adapterId: string;
  connectionId?: string;
  transferId?: string;
  confirmTransfer?: boolean;
  resetHistory?: boolean;
}
export type ConnectResult = (
  | {
      status: 'connected';
      nickname: string;
      binding: Binding;
      historyCleared?: true;
      resetLimits?: string;
    }
  | {
      status: 'nickname_in_use';
      nickname: string;
      connectionId: string;
      transferId: string;
      choices: { mode: 'transfer' | 'reset'; transferId: string }[];
      currentOwner: Omit<Binding, 'connectionId'>;
      requestingChat: { client: string; chatId: string; adapterId: string };
      userApprovalRequired: true;
    }
) & { warnings?: NicknameConflict[] };

export class AgentStore {
  readonly db: DatabaseSync;
  private clearRequests = new Map<
    string,
    {
      requester: string;
      scope: 'agent' | 'all';
      key: string | null;
      snapshot: string;
      preview: AgentClearPreview;
      expires: number;
    }
  >();
  constructor(directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(directory, 'agents.sqlite'));
    const version = Number(
      (this.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
    );
    if (version !== 0 && version !== 1 && version !== 2 && version !== 3 && version !== 4) {
      this.db.close();
      throw new Error('Unsupported agent storage format');
    }
    if (
      version === 0 &&
      this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .get()
    ) {
      this.db.close();
      throw new Error('Unversioned storage is not supported');
    }
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
    try {
      this.transaction(() => {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (key TEXT PRIMARY KEY, nickname TEXT NOT NULL, binding TEXT, generation INTEGER NOT NULL DEFAULT 0, incarnation TEXT NOT NULL DEFAULT '');
      CREATE TABLE IF NOT EXISTS transfers (id TEXT PRIMARY KEY, key TEXT NOT NULL, generation INTEGER NOT NULL, requester TEXT NOT NULL, details TEXT NOT NULL, expires INTEGER NOT NULL, consumed INTEGER NOT NULL DEFAULT 0, mode TEXT NOT NULL DEFAULT 'transfer');
      CREATE TABLE IF NOT EXISTS messages (sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, local_key TEXT NOT NULL, direction TEXT NOT NULL, envelope TEXT NOT NULL, state TEXT NOT NULL, error TEXT, UNIQUE(id,direction));
      CREATE INDEX IF NOT EXISTS inbox ON messages(local_key,state,sequence);
      CREATE TABLE IF NOT EXISTS cleared_messages (id TEXT NOT NULL, direction TEXT NOT NULL, digest TEXT NOT NULL, state TEXT NOT NULL, PRIMARY KEY(id,direction));
      CREATE TABLE IF NOT EXISTS file_cleanup (message_id TEXT PRIMARY KEY, files TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS timeline (cursor INTEGER PRIMARY KEY AUTOINCREMENT, message_id TEXT NOT NULL, direction TEXT NOT NULL, UNIQUE(message_id,direction));
      CREATE TABLE IF NOT EXISTS system_events (id INTEGER PRIMARY KEY AUTOINCREMENT, connection_id TEXT NOT NULL, event TEXT NOT NULL, dispatch_state TEXT NOT NULL DEFAULT 'pending', error TEXT);
      CREATE TABLE IF NOT EXISTS dispatches (message_id TEXT PRIMARY KEY, connection_id TEXT NOT NULL, state TEXT NOT NULL, error TEXT);
      UPDATE dispatches SET state='uncertain',error='The app stopped before confirming message receipt' WHERE state='dispatching';
      UPDATE system_events SET dispatch_state='uncertain' WHERE dispatch_state='dispatching';
      -- A wake signal carries no content: an interrupted offer is stale, not uncertain.
      UPDATE dispatches SET state='offered',error=NULL WHERE state='offering';
      UPDATE system_events SET dispatch_state='pending' WHERE dispatch_state='offering';
      -- Claude Code delivery attempts: the node picks the exact IDs; only the helper's
      -- report of a completed frame write commits receipt.
      CREATE TABLE IF NOT EXISTS claude_deliveries (id TEXT PRIMARY KEY, connection_id TEXT NOT NULL, agent_key TEXT NOT NULL, incarnation TEXT NOT NULL, binding_generation INTEGER NOT NULL, helper_id TEXT NOT NULL, scope TEXT NOT NULL, state TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, error TEXT);
      CREATE TABLE IF NOT EXISTS claude_delivery_items (delivery_id TEXT NOT NULL, message_id TEXT NOT NULL, PRIMARY KEY(delivery_id,message_id));
      CREATE INDEX IF NOT EXISTS claude_delivery_message ON claude_delivery_items(message_id);
      -- Reserved content never left the node, so no write was possible; issued content
      -- may have been written by the helper, so its receipt stays uncertain.
      UPDATE claude_deliveries SET state='cancelled',error='The app stopped before the content left the node' WHERE state='reserved';
      UPDATE claude_deliveries SET state='uncertain',error='The app stopped after the content was handed to the Claude Code helper' WHERE state='issued';
      PRAGMA user_version=4;`);
        if (version === 1)
          this.db.exec("ALTER TABLE transfers ADD COLUMN mode TEXT NOT NULL DEFAULT 'transfer'");
        if (version === 1 || version === 2) {
          this.db.exec("ALTER TABLE agents ADD COLUMN incarnation TEXT NOT NULL DEFAULT ''");
          for (const row of this.db.prepare('SELECT key FROM agents').all() as Row[])
            this.db
              .prepare('UPDATE agents SET incarnation=? WHERE key=?')
              .run(randomUUID(), row.key);
        }
      });
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  ensure(nickname: string): string {
    const key = nicknameKey(nickname);
    this.db
      .prepare('INSERT OR IGNORE INTO agents(key,nickname,incarnation) VALUES(?,?,?)')
      .run(key, nickname, randomUUID());
    return key;
  }
  sourceStamp(nickname: string): {
    generation: number;
    connectionId: string | null;
    incarnation: string | null;
  } {
    const row = this.db
      .prepare('SELECT generation,binding,incarnation FROM agents WHERE key=?')
      .get(nicknameKey(nickname)) as Row | undefined;
    return {
      generation: Number(row?.generation ?? 0),
      incarnation: row ? String(row.incarnation) : null,
      connectionId: row?.binding ? (JSON.parse(String(row.binding)) as Binding).connectionId : null,
    };
  }
  private identity(key: string): Row {
    const row = this.db.prepare('SELECT * FROM agents WHERE key=?').get(key) as Row | undefined;
    if (!row) throw new Error('Agent not found');
    return row;
  }
  private confirmedTransfer(input: ConnectInput): Row {
    const request = this.db
      .prepare('SELECT * FROM transfers WHERE id=?')
      .get(input.transferId ?? '') as Row | undefined;
    if (
      !request ||
      request.key !== nicknameKey(input.nickname) ||
      request.requester !== input.connectionId ||
      request.consumed ||
      Number(request.expires) < Date.now()
    )
      throw new Error('A current transferId and user approval for this transfer are required');
    const row = this.db
      .prepare('SELECT generation,binding FROM agents WHERE key=?')
      .get(nicknameKey(input.nickname)) as Row | undefined;
    if (
      !row?.binding ||
      request.generation !== row.generation ||
      request.details !==
        JSON.stringify({
          client: input.client,
          chatId: input.chatId,
          adapterId: input.adapterId,
        })
    )
      throw new Error('The binding changed. Request a new transfer and obtain user approval again');
    if (request.mode !== (input.resetHistory ? 'reset' : 'transfer'))
      throw new Error(
        'This transferId does not approve the selected history mode. Use the matching choice',
      );
    return request;
  }
  connect(input: ConnectInput): ConnectResult {
    const key = nicknameKey(input.nickname);
    return this.transaction(() => {
      const request = input.confirmTransfer === true ? this.confirmedTransfer(input) : null;
      if (input.connectionId && !request) {
        const owner = this.assertOwner(input.connectionId);
        if (owner.key !== key) throw new Error('The connection belongs to another agent');
      }
      this.ensure(input.nickname);
      const row = this.identity(key);
      const owner = row.binding ? (JSON.parse(String(row.binding)) as Binding) : null;
      if (
        input.resetHistory &&
        (!owner || (input.chatId === owner.chatId && input.adapterId === owner.adapterId))
      )
        throw new Error(
          'A fresh start is available only when taking an occupied name from another chat',
        );
      if (owner && input.connectionId === owner.connectionId) {
        if (
          input.chatId !== owner.chatId ||
          input.client !== owner.client ||
          input.adapterId !== owner.adapterId
        )
          throw new Error('The connection ID belongs to another binding');
        return { status: 'connected', nickname: String(row.nickname), binding: owner };
      }
      let connectionId: string = randomUUID();
      if (owner) {
        if (!input.confirmTransfer) {
          const choices = (['transfer', 'reset'] as const).map((mode) => {
            const transferId = randomUUID();
            this.db
              .prepare(
                'INSERT INTO transfers(id,key,generation,requester,details,expires,mode) VALUES(?,?,?,?,?,?,?)',
              )
              .run(
                transferId,
                key,
                row.generation,
                connectionId,
                JSON.stringify({
                  client: input.client,
                  chatId: input.chatId,
                  adapterId: input.adapterId,
                }),
                Date.now() + 600000,
                mode,
              );
            return { mode, transferId };
          });
          const transferId = choices[0].transferId;
          const { connectionId: _secret, ...currentOwner } = owner;
          return {
            status: 'nickname_in_use',
            nickname: String(row.nickname),
            connectionId,
            transferId,
            choices,
            currentOwner,
            requestingChat: {
              client: input.client,
              chatId: input.chatId,
              adapterId: input.adapterId,
            },
            userApprovalRequired: true,
          };
        }
        connectionId = String(request!.requester);
        this.db.prepare('UPDATE transfers SET consumed=1 WHERE id=?').run(input.transferId!);
        if (input.resetHistory) {
          this.clearHistory(key);
          this.db.prepare('DELETE FROM transfers WHERE key=?').run(key);
        }
        const event = {
          connectionId: owner.connectionId,
          binding: owner,
          type: 'agent_moved',
          ...(input.resetHistory ? { historyCleared: true } : {}),
          nickname: String(row.nickname),
          text: input.resetHistory
            ? `Agent ${JSON.stringify(row.nickname)} was reset by the user. Its previous MCP history was deleted and this connection is disabled.`
            : `Agent ${JSON.stringify(row.nickname)} was moved to another chat (${input.client}) by the user. The previous chat connection is disabled.`,
          createdAt: new Date().toISOString(),
        };
        this.db
          .prepare('INSERT INTO system_events(connection_id,event) VALUES(?,?)')
          .run(owner.connectionId, JSON.stringify(event));
      } else if (input.confirmTransfer)
        throw new Error('Cannot confirm a transfer that was not requested');
      const binding: Binding = {
        connectionId,
        client: input.client,
        chatId: input.chatId,
        adapterId: input.adapterId,
        generation: Number(row.generation) + 1,
      };
      this.db
        .prepare('UPDATE agents SET binding=?,generation=?,incarnation=? WHERE key=?')
        .run(
          JSON.stringify(binding),
          binding.generation,
          input.resetHistory ? randomUUID() : row.incarnation,
          key,
        );
      return {
        status: 'connected',
        nickname: String(row.nickname),
        binding,
        ...(input.resetHistory
          ? {
              historyCleared: true as const,
              resetLimits:
                'Reset clears local MCP history and queued output. Existing client transcripts, foreign admitted history and remote queues remain. In-flight messages cannot be recalled; previously unknown incoming messages may arrive after reset.',
            }
          : {}),
      };
    });
  }
  invalidateClearRequests(): void {
    this.clearRequests.clear();
  }
  clearAgents(
    input: AgentClearInput,
    requester: { channel: 'interface' | 'mcp'; session: string; connectionId?: string },
  ): AgentClearResponse {
    const result = this.transaction<AgentClearResponse>(() => {
      const owner =
        requester.channel === 'mcp' ? this.assertOwner(requester.connectionId ?? '') : null;
      if (owner && input.nickname !== undefined)
        throw new Error('MCP agent scope only clears its own mailbox');
      if (input.scope === 'all' && input.nickname !== undefined)
        throw new Error('All scope does not accept a nickname');
      const key =
        input.scope === 'agent' ? (owner?.key ?? nicknameKey(input.nickname ?? '')) : null;
      const requesterKey = JSON.stringify([
        requester.channel,
        requester.session,
        requester.connectionId ?? null,
        owner?.binding ?? null,
      ]);
      const rows = (
        key === null
          ? this.db.prepare('SELECT * FROM agents ORDER BY key').all()
          : this.db.prepare('SELECT * FROM agents WHERE key=?').all(key)
      ) as Row[];
      if (key !== null && !rows.length)
        throw new Error(
          input.confirm
            ? 'clear_preview_stale: the agent was removed; request a new preview and obtain explicit user confirmation'
            : 'Agent not found',
        );
      const targets = rows.map((row) => {
        const messages = this.db
          .prepare('SELECT id,direction,sequence FROM messages WHERE local_key=? ORDER BY sequence')
          .all(row.key);
        return {
          key: row.key,
          nickname: row.nickname,
          incarnation: row.incarnation,
          generation: row.generation,
          binding: row.binding,
          count: messages.length,
          fingerprint: createHash('sha256').update(JSON.stringify(messages)).digest('hex'),
        };
      });
      const snapshot = JSON.stringify(targets);
      if (!input.confirm) {
        if (input.operationId)
          throw new Error('An operationId can only be used to confirm its preview');
        for (const [id, request] of this.clearRequests)
          if (request.expires <= Date.now()) this.clearRequests.delete(id);
        if (this.clearRequests.size >= 128)
          throw new Error('Too many pending clear previews; wait for one to expire');
        const operationId = randomUUID(),
          expires = Date.now() + 600000;
        const preview: AgentClearPreview = {
          status: 'confirmation_required',
          operationId,
          scope: input.scope,
          targets: targets.map((target) => ({
            nickname: String(target.nickname),
            messageCount: target.count,
          })),
          agentCount: targets.length,
          messageCount: targets.reduce((sum, target) => sum + target.count, 0),
          expiresAt: new Date(expires).toISOString(),
        };
        this.clearRequests.set(operationId, {
          requester: requesterKey,
          scope: input.scope,
          key,
          snapshot,
          preview,
          expires,
        });
        return preview;
      }
      const request = this.clearRequests.get(input.operationId ?? '');
      if (!request || request.expires <= Date.now()) {
        this.clearRequests.delete(input.operationId ?? '');
        throw new Error(
          'clear_preview_expired: request a new preview and obtain explicit user confirmation',
        );
      }
      if (
        request.requester !== requesterKey ||
        request.scope !== input.scope ||
        request.key !== key
      )
        throw new Error('This clear operation does not belong to this requester, scope or target');
      if (request.snapshot !== snapshot) {
        this.clearRequests.delete(input.operationId!);
        throw new Error(
          'clear_preview_stale: agents or messages changed; request a new preview and obtain explicit user confirmation',
        );
      }
      for (const row of rows) {
        if (row.binding) {
          const binding = JSON.parse(String(row.binding)) as Binding;
          const event = {
            connectionId: binding.connectionId,
            binding,
            type: 'agent_moved',
            historyCleared: true,
            agentRemoved: true,
            nickname: String(row.nickname),
            text: 'The user removed this agent and its local MCP history. This connection is disabled.',
            createdAt: new Date().toISOString(),
          };
          this.db
            .prepare('INSERT INTO system_events(connection_id,event) VALUES(?,?)')
            .run(binding.connectionId, JSON.stringify(event));
        }
        this.clearHistory(String(row.key));
        this.db.prepare('DELETE FROM transfers WHERE key=?').run(row.key);
        this.db.prepare('DELETE FROM agents WHERE key=?').run(row.key);
      }

      return {
        status: 'cleared',
        scope: input.scope,
        agentCount: request.preview.agentCount,
        messageCount: request.preview.messageCount,
        limits:
          'Only local agents and MCP history were removed. Client transcripts, remote copies and remote queues remain. Already submitted external messages cannot be recalled; unknown incoming messages may create new mailboxes.',
      };
    });
    if (result.status === 'cleared') this.clearRequests.delete(input.operationId!);
    return result;
  }
  private clearHistory(key: string): void {
    // Any persistent dispatch row is evidence of a possible past admission, even after its state was overwritten.
    const rows = this.db
      .prepare(
        `SELECT m.* FROM messages m WHERE m.local_key=? OR
      (m.direction='in' AND m.state!='processed' AND m.id IN
        (SELECT id FROM messages WHERE local_key=? AND direction='out') AND NOT EXISTS
        (SELECT 1 FROM dispatches d WHERE d.message_id=m.id))`,
      )
      .all(key, key) as Row[];
    for (const row of rows) {
      const id = String(row.id),
        direction = String(row.direction),
        envelope = JSON.parse(String(row.envelope)) as Envelope;
      this.db
        .prepare('INSERT INTO cleared_messages(id,direction,digest,state) VALUES(?,?,?,?)')
        .run(id, direction, envelopeDigest(envelope), row.state);
      this.queueFileCleanup(id, envelope.attachments);
      this.db.prepare('DELETE FROM timeline WHERE message_id=? AND direction=?').run(id, direction);
      this.db.prepare('DELETE FROM messages WHERE id=? AND direction=?').run(id, direction);
      if (direction === 'in') this.db.prepare('DELETE FROM dispatches WHERE message_id=?').run(id);
    }
  }
  clearedState(id: string, direction: 'in' | 'out'): MessageState | undefined {
    const row = this.db
      .prepare('SELECT state FROM cleared_messages WHERE id=? AND direction=?')
      .get(id, direction) as Row | undefined;
    return row?.state as MessageState | undefined;
  }
  queueFileCleanup(messageId: string, files: Pick<Attachment, 'id' | 'size'>[]): void {
    if (files.length)
      this.db
        .prepare('INSERT OR IGNORE INTO file_cleanup(message_id,files) VALUES(?,?)')
        .run(messageId, JSON.stringify(files.map(({ id, size }) => ({ id, size }))));
  }
  fileCleanup(): { messageId: string; files: Pick<Attachment, 'id' | 'size'>[] }[] {
    return (this.db.prepare('SELECT * FROM file_cleanup').all() as Row[]).map((row) => ({
      messageId: String(row.message_id),
      files: JSON.parse(String(row.files)),
    }));
  }
  finishFileCleanup(messageId: string): void {
    this.db.prepare('DELETE FROM file_cleanup WHERE message_id=?').run(messageId);
  }
  attachmentReferenced(id: string): boolean {
    return !!this.db
      .prepare(
        "SELECT 1 FROM messages m, json_each(m.envelope,'$.attachments') f WHERE json_extract(f.value,'$.id')=? LIMIT 1",
      )
      .get(id);
  }
  assertOwner(connectionId: string): { key: string; nickname: string; binding: Binding } {
    for (const row of this.db
      .prepare('SELECT key,nickname,binding FROM agents WHERE binding IS NOT NULL')
      .all() as Row[]) {
      const binding = JSON.parse(String(row.binding)) as Binding;
      if (binding.connectionId === connectionId)
        return { key: String(row.key), nickname: String(row.nickname), binding };
    }
    if (this.events(connectionId).length)
      throw new Error('agent_moved: the user moved or removed this agent; read connection_events');
    throw new Error(
      'Connection not found. Call agent_connect with the agent name chosen by the user',
    );
  }
  transferContext(
    connectionId: string,
    transferId: string,
    nickname: string,
  ): { client: string; chatId: string; adapterId: string } {
    const row = this.db.prepare('SELECT * FROM transfers WHERE id=?').get(transferId) as
      Row | undefined;
    if (
      !row ||
      row.requester !== connectionId ||
      row.key !== nicknameKey(nickname) ||
      row.consumed ||
      Number(row.expires) < Date.now()
    )
      throw new Error('The transfer request expired. Reconnect.');
    return JSON.parse(String(row.details)) as { client: string; chatId: string; adapterId: string };
  }
  list(): AgentIdentity[] {
    return (
      this.db
        .prepare(
          `SELECT c.*,COUNT(m.id) AS message_count,
           SUM(CASE WHEN m.direction='in' AND m.state='ready' THEN 1 ELSE 0 END) AS unread,
           SUM(CASE WHEN m.direction='in' THEN 1 ELSE 0 END) AS incoming_count,
           SUM(CASE WHEN m.direction='out' THEN 1 ELSE 0 END) AS outgoing_count,
           MAX(json_extract(m.envelope,'$.createdAt')) AS last_message_at
           FROM agents c LEFT JOIN messages m ON m.local_key=c.key GROUP BY c.key ORDER BY c.nickname`,
        )
        .all() as Row[]
    ).map((r) => ({
      key: String(r.key),
      incarnation: String(r.incarnation),
      nickname: String(r.nickname),
      binding: r.binding ? (JSON.parse(String(r.binding)) as Binding) : null,
      messageCount: Number(r.message_count),
      unread: Number(r.unread ?? 0),
      incomingCount: Number(r.incoming_count ?? 0),
      outgoingCount: Number(r.outgoing_count ?? 0),
      lastMessageAt: r.last_message_at ? String(r.last_message_at) : null,
    }));
  }
  disconnect(connectionId: string): void {
    this.transaction(() => {
      const owner = this.assertOwner(connectionId);
      this.db.prepare('UPDATE agents SET binding=NULL WHERE key=?').run(owner.key);
    });
  }
  events(connectionId: string, after = 0): SystemEvent[] {
    return (
      this.db
        .prepare('SELECT id,event FROM system_events WHERE connection_id=? AND id>? ORDER BY id')
        .all(connectionId, after) as Row[]
    ).map((r) => ({ ...JSON.parse(String(r.event)), id: Number(r.id) }) as SystemEvent);
  }
  pendingSystemEvents(): SystemEvent[] {
    return (
      this.db
        .prepare(
          "SELECT id,event FROM system_events WHERE dispatch_state IN ('pending','waiting','failed') ORDER BY id",
        )
        .all() as Row[]
    ).map((r) => ({ ...JSON.parse(String(r.event)), id: Number(r.id) }) as SystemEvent);
  }
  systemDispatch(id: number, state: string, error: string | null = null): void {
    this.db
      .prepare('UPDATE system_events SET dispatch_state=?,error=? WHERE id=?')
      .run(state, error, id);
  }
  insert(envelope: Envelope, direction: 'in' | 'out'): boolean {
    return this.transaction(() => this.insertRow(envelope, direction));
  }
  insertLocal(envelope: Envelope, ready: boolean): boolean {
    if (envelope.fromNode !== envelope.toNode)
      throw new Error('A local route must stay on the same node');
    return this.transaction(() => {
      const inserted = this.insertRow(envelope, 'out');
      this.insertRow(envelope, 'in');
      if (ready) this.markReady(envelope.id);
      return inserted;
    });
  }
  private insertRow(envelope: Envelope, direction: 'in' | 'out'): boolean {
    const otherCleared = this.db
      .prepare('SELECT digest FROM cleared_messages WHERE id=? AND direction=?')
      .get(envelope.id, direction === 'in' ? 'out' : 'in') as Row | undefined;
    if (
      otherCleared &&
      (envelope.fromNode !== envelope.toNode || otherCleared.digest !== envelopeDigest(envelope))
    )
      throw new Error('Duplicate ID with different content');
    const cleared = this.db
      .prepare('SELECT digest FROM cleared_messages WHERE id=? AND direction=?')
      .get(envelope.id, direction) as Row | undefined;
    if (cleared) {
      if (cleared.digest !== envelopeDigest(envelope))
        throw new Error('Duplicate ID with different content');
      return false;
    }
    const existing = this.get(envelope.id, direction),
      other = this.get(envelope.id, direction === 'in' ? 'out' : 'in'),
      encoded = JSON.stringify(envelope);
    if (
      other &&
      (envelope.fromNode !== envelope.toNode || JSON.stringify(other.envelope) !== encoded)
    )
      throw new Error('Duplicate ID with different content');
    if (existing) {
      if (JSON.stringify(existing.envelope) !== encoded)
        throw new Error('Duplicate ID with different content');
      return false;
    }
    const key = this.ensure(direction === 'in' ? envelope.toNickname : envelope.fromNickname);
    this.db
      .prepare('INSERT INTO messages(id,local_key,direction,envelope,state) VALUES(?,?,?,?,?)')
      .run(envelope.id, key, direction, encoded, direction === 'in' ? 'received' : 'queued');
    if (direction === 'out')
      this.db
        .prepare('INSERT INTO timeline(message_id,direction) VALUES(?,?)')
        .run(envelope.id, direction);
    return true;
  }
  private message(row: Row): Message {
    return {
      sequence: Number(row.sequence),
      envelope: JSON.parse(String(row.envelope)) as Envelope,
      direction: row.direction as 'in' | 'out',
      state: row.state as MessageState,
      error: row.error as string | null,
    };
  }
  get(id: string, direction?: 'in' | 'out'): Message | undefined {
    const r = (
      direction
        ? this.db.prepare('SELECT * FROM messages WHERE id=? AND direction=?').get(id, direction)
        : this.db
            .prepare(
              "SELECT * FROM messages WHERE id=? ORDER BY CASE direction WHEN 'out' THEN 0 ELSE 1 END LIMIT 1",
            )
            .get(id)
    ) as Row | undefined;
    return r ? this.message(r) : undefined;
  }
  incomingBySequence(key: string, sequence: number): Message | undefined {
    const row = this.db
      .prepare("SELECT * FROM messages WHERE sequence=? AND direction='in' AND local_key=?")
      .get(sequence, key) as Row | undefined;
    return row ? this.message(row) : undefined;
  }
  history(
    key: string,
    after = 0,
    limit = 50,
    unread = false,
    unfenced = false,
  ): { messages: Message[]; nextCursor: number; hasMore: boolean } {
    const rows = this.db
      .prepare(
        `SELECT m.*,t.cursor AS sequence FROM timeline t JOIN messages m ON m.id=t.message_id AND m.direction=t.direction WHERE m.local_key=? AND t.cursor>? ${unread ? "AND m.direction='in' AND m.state='ready'" : ''} ${unfenced ? `AND NOT (m.direction='in' AND ${fenced('m.id')})` : ''} ORDER BY t.cursor LIMIT ?`,
      )
      .all(key, after, limit + 1) as Row[];
    const messages = rows.slice(0, limit).map((r) => this.message(r));
    return {
      messages,
      nextCursor: messages.at(-1)?.sequence ?? after,
      hasMore: rows.length > limit,
    };
  }
  chatHistory(key: string, before?: number, limit = 100): ChatHistoryPage {
    const rows = this.db
      .prepare(
        `SELECT m.*,t.cursor AS sequence FROM timeline t JOIN messages m
         ON m.id=t.message_id AND m.direction=t.direction
         WHERE m.local_key=? ${before === undefined ? '' : 'AND t.cursor<?'}
         ORDER BY t.cursor DESC LIMIT ?`,
      )
      .all(...(before === undefined ? [key, limit + 1] : [key, before, limit + 1])) as Row[];
    const messages = rows
      .slice(0, limit)
      .reverse()
      .map((row) => this.message(row));
    return {
      messages,
      nextCursor: messages[0]?.sequence ?? before ?? 0,
      hasMore: rows.length > limit,
    };
  }
  pending(direction: 'in' | 'out'): Message[] {
    return (
      this.db
        .prepare(
          `SELECT * FROM messages WHERE direction=? AND state${direction === 'in' ? "='received'" : "!='processed'"} ORDER BY sequence`,
        )
        .all(direction) as Row[]
    ).map((r) => this.message(r));
  }
  ready(id: string): void {
    this.transaction(() => this.markReady(id));
  }
  private markReady(id: string): void {
    this.db
      .prepare(
        "UPDATE messages SET state='ready',error=NULL WHERE id=? AND direction='in' AND state='received'",
      )
      .run(id);
    this.db
      .prepare(
        "INSERT OR IGNORE INTO timeline(message_id,direction) SELECT id,direction FROM messages WHERE id=? AND direction='in' AND state IN ('ready','processed')",
      )
      .run(id);
    const incoming = this.get(id, 'in');
    if (incoming && incoming.envelope.fromNode === incoming.envelope.toNode)
      this.receipt(id, incoming.state);
  }
  receipt(id: string, state: MessageState): void {
    const row = this.get(id, 'out'),
      rank = { queued: 0, received: 1, ready: 2, processed: 3 };
    if (row && rank[state] > rank[row.state])
      this.db
        .prepare("UPDATE messages SET state=?,error=NULL WHERE id=? AND direction='out'")
        .run(state, id);
  }
  recordDelivery(connectionId: string, ids: string[]): Set<string> {
    return this.transaction(() => {
      const owner = this.assertOwner(connectionId),
        delivered = new Set<string>();
      for (const id of ids) {
        const row = this.get(id, 'in');
        if (
          !row ||
          nicknameKey(row.envelope.toNickname) !== owner.key ||
          !['ready', 'processed'].includes(row.state)
        )
          throw new Error('The message does not belong to this agent or is not ready');
        if (row.state === 'processed') continue;
        if (this.claudeFenced(id))
          throw new Error(
            'The message is being delivered to Claude Code or its delivery is uncertain',
          );
        // Terminal transport receipt: the client received the message. It is
        // independent of whether the model completed the requested work.
        this.db
          .prepare("UPDATE messages SET state='processed',error=NULL WHERE id=? AND direction='in'")
          .run(id);
        this.dispatch(id, connectionId, 'admitted');
        if (row.envelope.fromNode === row.envelope.toNode) this.receipt(id, 'processed');
        delivered.add(id);
      }
      return delivered;
    });
  }
  error(id: string, error: string): void {
    this.db.prepare("UPDATE messages SET error=? WHERE id=? AND direction='in'").run(error, id);
  }
  dispatch(id: string, connectionId: string, state: string, error: string | null = null): void {
    if (!this.get(id, 'in')) return;
    this.db
      .prepare(
        'INSERT INTO dispatches(message_id,connection_id,state,error) VALUES(?,?,?,?) ON CONFLICT(message_id) DO UPDATE SET connection_id=excluded.connection_id,state=excluded.state,error=excluded.error',
      )
      .run(id, connectionId, state, error);
  }
  dispatchState(id: string): { connectionId: string; state: string } | null {
    const row = this.db
      .prepare('SELECT connection_id,state FROM dispatches WHERE message_id=?')
      .get(id) as Row | undefined;
    return row ? { connectionId: String(row.connection_id), state: String(row.state) } : null;
  }
  /** A message held by an active or uncertain Claude Code delivery attempt. */
  claudeFenced(id: string): boolean {
    return !!this.db
      .prepare(`SELECT 1 FROM (SELECT ? AS fenced_id) WHERE ${fenced('fenced_id')}`)
      .get(id);
  }
  /**
   * Reserve the node-chosen IDs for one Claude Code request before any
   * asynchronous preparation. Concurrent reads, history, attachments and
   * automatic dispatch skip fenced IDs; a fenced ID cannot be reserved twice.
   */
  reserveClaudeDelivery(input: {
    connectionId: string;
    ids: string[];
    helperId: string;
    scope: Record<string, unknown>;
  }): string {
    return this.transaction(() => {
      const owner = this.assertOwner(input.connectionId);
      const row = this.db.prepare('SELECT incarnation FROM agents WHERE key=?').get(owner.key) as
        Row | undefined;
      const active = this.db
        .prepare(
          "SELECT COUNT(*) AS count FROM claude_deliveries WHERE connection_id=? AND state IN ('reserved','issued')",
        )
        .get(input.connectionId) as { count: number };
      if (active.count >= 32) throw new Error('Too many Claude Code deliveries are in progress');
      for (const id of input.ids) {
        const message = this.get(id, 'in');
        if (
          !message ||
          nicknameKey(message.envelope.toNickname) !== owner.key ||
          message.state !== 'ready'
        )
          throw new Error('The message does not belong to this agent or is not ready');
        if (this.claudeFenced(id)) throw new Error('The message is already being delivered');
      }
      const id = randomUUID(),
        now = Date.now();
      this.db
        .prepare(
          "INSERT INTO claude_deliveries(id,connection_id,agent_key,incarnation,binding_generation,helper_id,scope,state,created,updated) VALUES(?,?,?,?,?,?,?,'reserved',?,?)",
        )
        .run(
          id,
          input.connectionId,
          owner.key,
          String(row?.incarnation ?? ''),
          owner.binding.generation,
          input.helperId,
          JSON.stringify(input.scope),
          now,
          now,
        );
      for (const message of input.ids)
        this.db
          .prepare('INSERT INTO claude_delivery_items(delivery_id,message_id) VALUES(?,?)')
          .run(id, message);
      return id;
    });
  }
  private claudeTransition(id: string, from: string[], to: string, error: string | null): boolean {
    return (
      Number(
        this.db
          .prepare(
            `UPDATE claude_deliveries SET state=?,error=?,updated=? WHERE id=? AND state IN (${from.map(() => '?').join(',')})`,
          )
          .run(to, error, Date.now(), id, ...from).changes,
      ) === 1
    );
  }
  /** Intent persisted: from here on the content may leave the node. */
  issueClaudeDelivery(id: string): void {
    if (!this.transaction(() => this.claudeTransition(id, ['reserved'], 'issued', null)))
      throw new Error('The Claude Code delivery is no longer reserved');
  }
  /** Only when ordering proves the content was not written to Claude Code. */
  cancelClaudeDelivery(id: string, reason: string): boolean {
    return this.transaction(() =>
      this.claudeTransition(id, ['reserved', 'issued'], 'cancelled', reason),
    );
  }
  /** The content may have been written; receipt stays unknown and the IDs stay fenced. */
  uncertainClaudeDelivery(id: string, reason: string): boolean {
    return this.transaction(() => {
      if (!this.claudeTransition(id, ['issued'], 'uncertain', reason)) return false;
      for (const item of this.claudeDeliveryItems(id))
        this.db
          .prepare("UPDATE messages SET error=? WHERE id=? AND direction='in' AND state='ready'")
          .run('Delivery to Claude Code is uncertain; it will not be repeated automatically', item);
      return true;
    });
  }
  private claudeDeliveryItems(id: string): string[] {
    return (
      this.db
        .prepare('SELECT message_id FROM claude_delivery_items WHERE delivery_id=? ORDER BY rowid')
        .all(id) as Row[]
    ).map((row) => String(row.message_id));
  }
  claudeDelivery(
    id: string,
  ):
    | { connectionId: string; helperId: string; scope: Record<string, unknown>; state: string }
    | undefined {
    const row = this.db.prepare('SELECT * FROM claude_deliveries WHERE id=?').get(id) as
      Row | undefined;
    return row
      ? {
          connectionId: String(row.connection_id),
          helperId: String(row.helper_id),
          scope: JSON.parse(String(row.scope)) as Record<string, unknown>,
          state: String(row.state),
        }
      : undefined;
  }
  /**
   * The helper wrote the complete response frame: record receipt for the IDs the
   * node chose. A cleared or reset mailbox is never revived, and receipt does
   * not depend on the binding still being current.
   */
  commitClaudeDelivery(id: string): string[] {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT * FROM claude_deliveries WHERE id=?').get(id) as
        Row | undefined;
      if (!row || !this.claudeTransition(id, ['issued'], 'committed', null)) return [];
      const agent = this.db
        .prepare('SELECT incarnation FROM agents WHERE key=?')
        .get(String(row.agent_key)) as Row | undefined;
      if (!agent || String(agent.incarnation) !== String(row.incarnation)) return [];
      const delivered: string[] = [];
      for (const item of this.claudeDeliveryItems(id)) {
        const message = this.get(item, 'in');
        if (!message || nicknameKey(message.envelope.toNickname) !== String(row.agent_key))
          continue;
        if (message.state !== 'ready') continue;
        this.db
          .prepare("UPDATE messages SET state='processed',error=NULL WHERE id=? AND direction='in'")
          .run(item);
        this.dispatch(item, String(row.connection_id), 'admitted');
        if (message.envelope.fromNode === message.envelope.toNode) this.receipt(item, 'processed');
        delivered.push(item);
      }
      return delivered;
    });
  }
  /** Issued attempts of a helper that can no longer report its write become uncertain. */
  claudeHelperGone(helperId: string): number {
    const rows = this.db
      .prepare("SELECT id FROM claude_deliveries WHERE helper_id=? AND state='issued'")
      .all(helperId) as Row[];
    for (const row of rows)
      this.uncertainClaudeDelivery(
        String(row.id),
        'The Claude Code helper disconnected before confirming the response write',
      );
    return rows.length;
  }
  /** Unresolved attempts per agent key, for inspection; nothing here resolves them. */
  claudeUncertain(): Map<string, number> {
    const rows = this.db
      .prepare(
        "SELECT d.agent_key AS key, COUNT(i.message_id) AS count FROM claude_deliveries d JOIN claude_delivery_items i ON i.delivery_id=d.id WHERE d.state='uncertain' GROUP BY d.agent_key",
      )
      .all() as Row[];
    return new Map(rows.map((row) => [String(row.key), Number(row.count)]));
  }
  close(): void {
    this.clearRequests.clear();
    this.db.close();
  }
}

/** SQL: the message ID column is held by a reserved, issued or uncertain Claude delivery. */
const fenced = (column: string) =>
  `EXISTS (SELECT 1 FROM claude_delivery_items fi JOIN claude_deliveries fd ON fd.id=fi.delivery_id WHERE fi.message_id=${column} AND fd.state IN ('reserved','issued','uncertain'))`;

// Field order is canonical; user text, Unicode, case and attachment order stay intact.
function envelopeDigest(envelope: Envelope): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        envelope.protocol,
        envelope.id,
        envelope.fromNode,
        envelope.toNode,
        envelope.fromNickname,
        envelope.toNickname,
        envelope.createdAt,
        envelope.text,
        envelope.replyTo,
        envelope.attachments.map(({ id, name, size }) => [id, name, size]),
      ]),
    )
    .digest('hex');
}

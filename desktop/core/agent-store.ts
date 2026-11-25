import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  codexQueueWitness,
  type DeliveryAttempt,
  type DeliveryMetadata,
  type DeliveryPhase,
  decodeDelivery,
  encodeDelivery,
  membersHash,
  coarseDelivery,
} from './delivery-attempt.js';
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
    if (![0, 1, 2, 3, 4, 5, 6].includes(version)) {
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
      UPDATE system_events SET dispatch_state='uncertain' WHERE dispatch_state='dispatching';
      -- A wake signal carries no content: an interrupted offer is stale, not uncertain.
      UPDATE dispatches SET state='offered',error=NULL WHERE state='offering';
      UPDATE system_events SET dispatch_state='pending' WHERE dispatch_state='offering';
      -- Claude Code delivery attempts: the node picks the exact IDs; only the helper's
      -- report of a completed frame write commits receipt.
      CREATE TABLE IF NOT EXISTS claude_deliveries (id TEXT PRIMARY KEY, connection_id TEXT NOT NULL, agent_key TEXT NOT NULL, incarnation TEXT NOT NULL, binding_generation INTEGER NOT NULL, helper_id TEXT NOT NULL, scope TEXT NOT NULL, state TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, error TEXT);
      CREATE TABLE IF NOT EXISTS claude_delivery_items (delivery_id TEXT NOT NULL, message_id TEXT NOT NULL, PRIMARY KEY(delivery_id,message_id));
      CREATE INDEX IF NOT EXISTS claude_delivery_message ON claude_delivery_items(message_id);
      CREATE UNIQUE INDEX IF NOT EXISTS claude_native_stored_row ON claude_deliveries(lower(json_extract(scope,'$.nativePrompt.storedRowId'))) WHERE json_extract(scope,'$.nativePrompt.storedRowId') IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS claude_native_admitted_envelope ON claude_deliveries(json_extract(scope,'$.nativePrompt.envelopeHash')) WHERE json_extract(scope,'$.nativePrompt.envelopeHash') IS NOT NULL AND state IN ('issued','uncertain','committed');
      -- Reserved content never left the node, so no write was possible; issued content
      -- may have been written by the helper, so its receipt stays uncertain.
      UPDATE claude_deliveries SET state='cancelled',error='The app stopped before the content left the node' WHERE state='reserved';
      UPDATE claude_deliveries SET state='uncertain',error='The app stopped after the content was handed to the Claude Code helper' WHERE state='issued';
      `);
        if (version === 1)
          this.db.exec("ALTER TABLE transfers ADD COLUMN mode TEXT NOT NULL DEFAULT 'transfer'");
        if (version === 1 || version === 2) {
          this.db.exec("ALTER TABLE agents ADD COLUMN incarnation TEXT NOT NULL DEFAULT ''");
          for (const row of this.db.prepare('SELECT key FROM agents').all() as Row[])
            this.db
              .prepare('UPDATE agents SET incarnation=? WHERE key=?')
              .run(randomUUID(), row.key);
        }
        if (version < 5) {
          this.db.exec(
            'ALTER TABLE dispatches ADD COLUMN attempt_id TEXT; ALTER TABLE dispatches ADD COLUMN attempt_meta TEXT;',
          );
        }
        if (version < 6) {
          this.db.exec("ALTER TABLE agents ADD COLUMN name_key TEXT NOT NULL DEFAULT ''");
          const setName = this.db.prepare('UPDATE agents SET name_key=? WHERE key=?');
          for (const row of this.db.prepare('SELECT key,nickname FROM agents').all() as Row[])
            setName.run(nicknameKey(String(row.nickname)), row.key);
          this.db.exec('CREATE UNIQUE INDEX agent_name_key ON agents(name_key);');
        }
        this.db.exec('CREATE INDEX IF NOT EXISTS dispatch_attempt ON dispatches(attempt_id);');
        this.db.exec(
          "UPDATE dispatches SET state='uncertain',error='The app stopped before confirming message receipt' WHERE state='dispatching' AND attempt_id IS NULL;",
        );
        this.db.exec(
          "UPDATE dispatches SET state='uncertain' WHERE attempt_id IS NULL AND state NOT IN ('admitted','offered','waiting','failed','revoked','uncertain');",
        );
        this.recoverDeliveries();
        this.db.exec('PRAGMA user_version=6;');
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
  keyForNickname(nickname: string): string | undefined {
    const row = this.db
      .prepare('SELECT key FROM agents WHERE name_key=?')
      .get(nicknameKey(nickname));
    return row ? String(row.key) : undefined;
  }
  bindingForNickname(nickname: string): Binding | undefined {
    const row = this.db
      .prepare('SELECT binding FROM agents WHERE name_key=?')
      .get(nicknameKey(nickname));
    return row?.binding ? (JSON.parse(String(row.binding)) as Binding) : undefined;
  }
  ensure(nickname: string): string {
    const existing = this.keyForNickname(nickname);
    if (existing !== undefined) return existing;
    const nameKey = nicknameKey(nickname);
    const key = this.db.prepare('SELECT 1 FROM agents WHERE key=?').get(nameKey)
      ? randomUUID()
      : nameKey;
    this.db
      .prepare('INSERT INTO agents(key,nickname,incarnation,name_key) VALUES(?,?,?,?)')
      .run(key, nickname, randomUUID(), nameKey);
    return key;
  }
  rename(input: {
    key: string;
    incarnation: string;
    currentNickname: string;
    nickname: string;
  }): 'renamed' | 'unchanged' | 'nickname_in_use' | 'stale' {
    const nameKey = nicknameKey(input.nickname);
    return this.transaction(() => {
      const current = this.db
        .prepare('SELECT nickname,incarnation FROM agents WHERE key=?')
        .get(input.key);
      if (current?.incarnation !== input.incarnation || current.nickname !== input.currentNickname)
        return 'stale';
      const occupied = this.keyForNickname(input.nickname);
      if (occupied !== undefined && occupied !== input.key) return 'nickname_in_use';
      if (current.nickname === input.nickname) return 'unchanged';
      this.db
        .prepare('UPDATE agents SET nickname=?,name_key=? WHERE key=?')
        .run(input.nickname, nameKey, input.key);
      this.db.prepare('DELETE FROM transfers WHERE key=?').run(input.key);
      return 'renamed';
    });
  }
  sourceStamp(nickname: string) {
    return this.sourceStampByKey(this.keyForNickname(nickname));
  }
  sourceStampByKey(key: string | undefined): {
    generation: number;
    connectionId: string | null;
    incarnation: string | null;
  } {
    const row =
      key === undefined
        ? undefined
        : this.db.prepare('SELECT generation,binding,incarnation FROM agents WHERE key=?').get(key);
    return {
      generation: Number(row?.generation ?? 0),
      incarnation: row ? String(row.incarnation) : null,
      connectionId: row?.binding ? (JSON.parse(String(row.binding)) as Binding).connectionId : null,
    };
  }
  nicknameForKey(key: string): string {
    return String(this.identity(key).nickname);
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
      request.key !== this.keyForNickname(input.nickname) ||
      request.requester !== input.connectionId ||
      request.consumed ||
      Number(request.expires) < Date.now()
    )
      throw new Error('A current transferId and user approval for this transfer are required');
    const row = this.db
      .prepare('SELECT generation,binding FROM agents WHERE key=?')
      .get(request.key) as Row | undefined;
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
    return this.transaction(() => {
      const request = input.confirmTransfer === true ? this.confirmedTransfer(input) : null;
      if (input.connectionId && !request) {
        const owner = this.assertOwner(input.connectionId);
        if (owner.key !== this.keyForNickname(input.nickname))
          throw new Error('The connection belongs to another agent');
      }
      const key = this.ensure(input.nickname);
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
        input.scope === 'agent' ? (owner?.key ?? this.keyForNickname(input.nickname ?? '')) : null;
      const requesterKey = JSON.stringify([
        requester.channel,
        requester.session,
        requester.connectionId ?? null,
        owner?.binding ?? null,
      ]);
      const rows = (
        key === null
          ? this.db.prepare('SELECT * FROM agents ORDER BY key').all()
          : key === undefined
            ? []
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
          key: key ?? null,
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
      row.key !== this.keyForNickname(nickname) ||
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
  insertLocal(envelope: Envelope, ready: boolean, recipientKey?: string): boolean {
    if (envelope.fromNode !== envelope.toNode)
      throw new Error('A local route must stay on the same node');
    return this.transaction(() => {
      const inserted = this.insertRow(envelope, 'out');
      this.insertRow(envelope, 'in', recipientKey);
      if (ready) this.markReady(envelope.id);
      return inserted;
    });
  }
  private insertRow(envelope: Envelope, direction: 'in' | 'out', recipientKey?: string): boolean {
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
    const key =
      (direction === 'in' ? (this.replyOwnerKey(envelope) ?? recipientKey) : undefined) ??
      this.ensure(direction === 'in' ? envelope.toNickname : envelope.fromNickname);
    this.db
      .prepare('INSERT INTO messages(id,local_key,direction,envelope,state) VALUES(?,?,?,?,?)')
      .run(envelope.id, key, direction, encoded, direction === 'in' ? 'received' : 'queued');
    if (direction === 'out')
      this.db
        .prepare('INSERT INTO timeline(message_id,direction) VALUES(?,?)')
        .run(envelope.id, direction);
    return true;
  }
  private replyOwnerKey(envelope: Envelope): string | undefined {
    if (!envelope.replyTo) return undefined;
    const original = this.get(envelope.replyTo, 'out')?.envelope;
    if (
      !original ||
      original.toNode !== envelope.fromNode ||
      original.fromNode !== envelope.toNode ||
      nicknameKey(original.fromNickname) !== nicknameKey(envelope.toNickname)
    )
      return undefined;
    return this.messageOwnerKey(original.id, 'out');
  }
  messageOwnerKey(id: string, direction: 'in' | 'out'): string | undefined {
    const row = this.db
      .prepare('SELECT local_key FROM messages WHERE id=? AND direction=?')
      .get(id, direction);
    return row ? String(row.local_key) : undefined;
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
  /** Claude-private bounded selection; uncertain dispatch is never replayed. */
  claudeIncomingIds(key: string, limit = 20): string[] {
    return (
      this.db
        .prepare(
          `SELECT m.id FROM timeline t JOIN messages m ON m.id=t.message_id AND m.direction=t.direction
         WHERE m.local_key=? AND m.direction='in' AND m.state='ready'
         AND NOT ${fenced('m.id')}
         AND NOT EXISTS (SELECT 1 FROM dispatches d WHERE d.message_id=m.id AND d.state IN ('dispatching','uncertain'))
         ORDER BY t.cursor LIMIT ?`,
        )
        .all(key, Math.min(20, Math.max(1, limit))) as Row[]
    ).map((row) => String(row.id));
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
          this.messageOwnerKey(id, 'in') !== owner.key ||
          !['ready', 'processed'].includes(row.state)
        )
          throw new Error('The message does not belong to this agent or is not ready');
        if (row.state === 'processed') continue;
        if (this.claudeFenced(id) || this.deliveryFenced(id))
          throw new Error(
            'The message is being delivered to Claude Code or its delivery is uncertain',
          );
        // Terminal transport receipt: the client received the message. It is
        // independent of whether the model completed the requested work.
        this.markDelivered(row, connectionId);
        delivered.add(id);
      }
      return delivered;
    });
  }
  /** The sole message/receipt mutation; callers validate their own witness first. */
  private markDelivered(row: Message, connectionId: string, attemptId?: string): void {
    const id = row.envelope.id;
    const typed = this.db
      .prepare('SELECT attempt_id FROM dispatches WHERE message_id=?')
      .get(id) as Row | undefined;
    if (typed?.attempt_id && typed.attempt_id !== attemptId)
      throw new Error('Another delivery attempt owns this message');
    this.db
      .prepare("UPDATE messages SET state='processed',error=NULL WHERE id=? AND direction='in'")
      .run(id);
    if (!attemptId) this.dispatch(id, connectionId, 'admitted');
    if (row.envelope.fromNode === row.envelope.toNode) this.receipt(id, 'processed');
  }
  /** Uncertainty belongs to the message, not the current connection. */
  deliveryFenced(id: string): boolean {
    return !!this.db
      .prepare(
        "SELECT 1 FROM dispatches WHERE message_id=? AND state IN ('dispatching','uncertain')",
      )
      .get(id);
  }
  reserveDelivery(input: {
    connectionId: string;
    ids: string[];
    transport: DeliveryMetadata['transport'];
    lifecycle: DeliveryMetadata['lifecycle'];
    invocation?: DeliveryMetadata['invocation'];
  }): DeliveryAttempt {
    return this.transaction(() => {
      if (
        !input.ids.length ||
        input.ids.length > 200 ||
        new Set(input.ids).size !== input.ids.length
      )
        throw new Error('Invalid delivery member set');
      const owner = this.assertOwner(input.connectionId);
      const incarnation = this.sourceStampByKey(owner.key).incarnation;
      const { client: _client, ...captured } = owner.binding;
      const id = randomUUID(),
        now = Date.now();
      const meta: DeliveryMetadata = {
        version: 1,
        transport: input.transport,
        phase: 'reserved',
        owner: { agentKey: owner.key, incarnation: incarnation!, ...captured },
        lifecycle: input.lifecycle,
        ...(input.invocation ? { invocation: input.invocation } : {}),
        payloadHash: null,
        membersHash: membersHash(input.ids),
        created: now,
        updated: now,
      };
      const encoded = encodeDelivery(meta);
      for (const item of input.ids) {
        const message = this.get(item, 'in');
        if (!message || this.messageOwnerKey(item, 'in') !== owner.key || message.state !== 'ready')
          throw new Error('The message is not ready for this binding');
        if (this.claudeFenced(item) || this.deliveryFenced(item))
          throw new Error('Message delivery is in progress or uncertain; content is not repeated');
        const previous = this.db
          .prepare('SELECT attempt_id,attempt_meta FROM dispatches WHERE message_id=?')
          .get(item) as Row | undefined;
        if (
          previous &&
          (previous.attempt_id !== null || previous.attempt_meta !== null) &&
          (!previous.attempt_id ||
            !previous.attempt_meta ||
            decodeDelivery(previous.attempt_meta).phase !== 'cancelled')
        )
          throw new Error('The previous attempt does not permit a new release');
      }
      for (const item of input.ids)
        this.db
          .prepare(
            `INSERT INTO dispatches(message_id,connection_id,state,error,attempt_id,attempt_meta)
          VALUES(?,?,'dispatching',NULL,?,?) ON CONFLICT(message_id) DO UPDATE SET
          connection_id=excluded.connection_id,state=excluded.state,error=NULL,attempt_id=excluded.attempt_id,attempt_meta=excluded.attempt_meta`,
          )
          .run(item, input.connectionId, id, encoded);
      return { id, ids: [...input.ids], meta };
    });
  }
  deliveryAttempt(id: string): DeliveryAttempt {
    const rows = this.db
      .prepare('SELECT * FROM dispatches WHERE attempt_id=? ORDER BY message_id')
      .all(id) as Row[];
    if (!/^[a-f0-9-]{36}$/i.test(id) || !rows.length || rows.length > 200)
      throw new Error('The delivery attempt is unavailable');
    const meta = decodeDelivery(rows[0]!.attempt_meta);
    const ids = rows.map((row) => String(row.message_id));
    if (
      membersHash(ids) !== meta.membersHash ||
      rows.some(
        (row) =>
          row.attempt_meta !== rows[0]!.attempt_meta ||
          row.connection_id !== meta.owner.connectionId ||
          row.state !== coarseDelivery(meta.phase),
      )
    )
      throw new Error('The delivery member set changed');
    return { id, ids, meta };
  }
  assertDeliveryCurrent(id: string): DeliveryAttempt {
    const attempt = this.deliveryAttempt(id),
      captured = attempt.meta.owner;
    const current = this.assertOwner(captured.connectionId);
    if (
      current.key !== captured.agentKey ||
      current.binding.generation !== captured.generation ||
      current.binding.chatId !== captured.chatId ||
      current.binding.adapterId !== captured.adapterId ||
      this.sourceStampByKey(current.key).incarnation !== captured.incarnation
    )
      throw new Error('The delivery binding changed');
    for (const item of attempt.ids) {
      const message = this.get(item, 'in');
      if (
        !message ||
        this.messageOwnerKey(item, 'in') !== current.key ||
        message.state !== 'ready' ||
        this.claudeFenced(item)
      )
        throw new Error('The delivery message is no longer available');
    }
    return attempt;
  }
  private changeDelivery(
    id: string,
    from: DeliveryPhase[],
    to: DeliveryPhase,
    patch: Partial<DeliveryMetadata> = {},
  ): DeliveryAttempt {
    const attempt = this.deliveryAttempt(id);
    if (!from.includes(attempt.meta.phase)) throw new Error('The delivery phase changed');
    const old = encodeDelivery(attempt.meta);
    const meta = { ...attempt.meta, ...patch, phase: to, updated: Date.now() };
    const encoded = encodeDelivery(meta);
    for (const item of attempt.ids) {
      const update = this.db
        .prepare(
          `UPDATE dispatches SET state=?,attempt_meta=?,error=NULL WHERE
        message_id=? AND connection_id=? AND attempt_id=? AND attempt_meta=? AND state=?`,
        )
        .run(
          coarseDelivery(to),
          encoded,
          item,
          attempt.meta.owner.connectionId,
          id,
          old,
          coarseDelivery(attempt.meta.phase),
        );
      if (Number(update.changes) !== 1) throw new Error('The delivery compare-and-set failed');
    }
    return { ...attempt, meta };
  }
  sealDelivery(id: string, payloadHash: string | null, host?: DeliveryMetadata['host']): void {
    this.transaction(() => {
      this.assertDeliveryCurrent(id);
      this.changeDelivery(id, ['reserved'], 'sealed', { payloadHash, ...(host ? { host } : {}) });
    });
  }
  issueDelivery(id: string): void {
    this.transaction(() => {
      this.assertDeliveryCurrent(id);
      this.changeDelivery(id, ['sealed'], 'issued');
    });
  }
  /** Only a trusted ordering/no-body witness can cancel after release intent. */
  cancelDelivery(id: string, definiteNoBody = false): void {
    this.transaction(() =>
      this.changeDelivery(
        id,
        definiteNoBody ? ['reserved', 'sealed', 'issued', 'host-accepted'] : ['reserved', 'sealed'],
        'cancelled',
      ),
    );
  }
  uncertainDelivery(id: string): void {
    this.transaction(() => {
      const attempt = this.changeDelivery(
        id,
        ['reserved', 'sealed', 'issued', 'host-accepted'],
        'uncertain',
      );
      for (const item of attempt.ids)
        this.db
          .prepare("UPDATE messages SET error=? WHERE id=? AND direction='in' AND state='ready'")
          .run(
            'Delivery is uncertain; this saved message will not be repeated automatically',
            item,
          );
    });
  }
  completeDelivery(id: string, lifecycle: DeliveryMetadata['lifecycle']): Set<string> {
    return this.finishDelivery(id, lifecycle, ['issued', 'host-accepted']);
  }
  acceptOpenCodeV2Delivery(
    id: string,
    host: NonNullable<DeliveryMetadata['host']>,
    payloadHash: string,
  ): void {
    this.transaction(() => {
      const attempt = this.assertDeliveryCurrent(id);
      if (
        JSON.stringify(attempt.meta.host) !== JSON.stringify(host) ||
        attempt.meta.payloadHash !== payloadHash
      )
        throw new Error('The OpenCode v2 host witness changed');
      if (attempt.meta.phase === 'uncertain' || attempt.meta.phase === 'host-accepted') return;
      this.changeDelivery(id, ['issued'], 'host-accepted');
    });
  }
  /** Only the v2 adapter's exact current-boot projection join may complete its uncertainty. */
  completeOpenCodeV2Delivery(
    id: string,
    lifecycle: DeliveryMetadata['lifecycle'],
    host: NonNullable<DeliveryMetadata['host']>,
    payloadHash: string,
  ): Set<string> {
    return this.finishDelivery(id, lifecycle, ['issued', 'host-accepted', 'uncertain'], {
      host,
      payloadHash,
    });
  }
  pendingCodexQueueDeliveries(connectionId: string): DeliveryAttempt[] {
    const rows = this.db
      .prepare(
        "SELECT DISTINCT attempt_id FROM dispatches WHERE connection_id=? AND state IN ('dispatching','uncertain') AND attempt_id IS NOT NULL",
      )
      .all(connectionId) as Row[];
    return rows.flatMap((row) => {
      try {
        const attempt = this.deliveryAttempt(String(row.attempt_id));
        const { host, phase } = attempt.meta;
        return attempt.ids.length === 1 &&
          (phase === 'issued' || phase === 'uncertain') &&
          host?.runtime === codexQueueWitness &&
          host.messageId === attempt.id
          ? [attempt]
          : [];
      } catch {
        return [];
      }
    });
  }
  completeCodexQueueDelivery(attempt: DeliveryAttempt): Set<string> {
    const { host, payloadHash, lifecycle } = attempt.meta;
    if (
      !host ||
      host.runtime !== codexQueueWitness ||
      host.messageId !== attempt.id ||
      !payloadHash
    )
      throw new Error('The Codex transcript witness is unavailable');
    return this.finishDelivery(attempt.id, lifecycle, ['issued', 'uncertain'], {
      host,
      payloadHash,
    });
  }
  private finishDelivery(
    id: string,
    lifecycle: DeliveryMetadata['lifecycle'],
    phases: DeliveryPhase[],
    witness?: { host: NonNullable<DeliveryMetadata['host']>; payloadHash: string },
  ): Set<string> {
    return this.transaction(() => {
      const previous = this.deliveryAttempt(id);
      if (previous.meta.phase === 'committed') return new Set<string>();
      const attempt = this.assertDeliveryCurrent(id);
      if (JSON.stringify(attempt.meta.lifecycle) !== JSON.stringify(lifecycle))
        throw new Error('The delivery lifecycle changed');
      if (
        witness &&
        (attempt.meta.transport !== 'native' ||
          JSON.stringify(attempt.meta.host) !== JSON.stringify(witness.host) ||
          attempt.meta.payloadHash !== witness.payloadHash ||
          witness.host.session !== attempt.meta.owner.chatId)
      )
        throw new Error('The native projection witness changed');
      this.changeDelivery(id, phases, 'committed');
      for (const item of attempt.ids)
        this.markDelivered(this.get(item, 'in')!, attempt.meta.owner.connectionId, id);
      return new Set(attempt.ids);
    });
  }
  private recoverDeliveries(): void {
    const rows = this.db
      .prepare('SELECT * FROM dispatches WHERE attempt_id IS NOT NULL OR attempt_meta IS NOT NULL')
      .all() as Row[];
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
      const key = row.attempt_id === null ? 'orphan:' + row.message_id : String(row.attempt_id);
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      const row = group[0]!,
        id = String(row.attempt_id ?? '');
      try {
        const meta = decodeDelivery(row.attempt_meta);
        const terminal = meta.phase === 'cancelled' || meta.phase === 'committed';
        if (
          !/^[a-f0-9-]{36}$/i.test(id) ||
          group.length > 200 ||
          (!terminal &&
            membersHash(group.map((item) => String(item.message_id))) !== meta.membersHash) ||
          group.some(
            (item) =>
              item.attempt_meta !== row.attempt_meta ||
              item.connection_id !== meta.owner.connectionId ||
              item.state !== coarseDelivery(meta.phase),
          ) ||
          (meta.phase === 'committed' &&
            group.some((item) => this.get(String(item.message_id), 'in')?.state === 'ready'))
        )
          throw new Error('Invalid recovered attempt');
        // A cancelled/committed group may have been partially replaced/cleared.
        // Terminal per-row evidence remains valid; it cannot authorize an old CAS.
        const phase = ['reserved', 'sealed'].includes(meta.phase)
          ? 'cancelled'
          : ['issued', 'host-accepted'].includes(meta.phase)
            ? 'uncertain'
            : meta.phase;
        this.db
          .prepare('UPDATE dispatches SET state=?,attempt_meta=? WHERE attempt_id=?')
          .run(coarseDelivery(phase), encodeDelivery({ ...meta, phase, updated: Date.now() }), id);
      } catch {
        if (row.attempt_id === null)
          this.db
            .prepare("UPDATE dispatches SET state='uncertain' WHERE message_id=?")
            .run(row.message_id);
        else
          this.db
            .prepare("UPDATE dispatches SET state='uncertain' WHERE attempt_id=?")
            .run(row.attempt_id);
      }
    }
  }
  error(id: string, error: string): void {
    this.db.prepare("UPDATE messages SET error=? WHERE id=? AND direction='in'").run(error, id);
  }
  dispatch(id: string, connectionId: string, state: string, error: string | null = null): void {
    if (!this.get(id, 'in')) return;
    // Only exact attempt CAS may change typed rows, including terminal ones.
    if (
      this.db
        .prepare(
          'SELECT 1 FROM dispatches WHERE message_id=? AND (attempt_id IS NOT NULL OR attempt_meta IS NOT NULL)',
        )
        .get(id)
    )
      return;
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
        if (!message || this.messageOwnerKey(id, 'in') !== owner.key || message.state !== 'ready')
          throw new Error('The message does not belong to this agent or is not ready');
        if (this.claudeFenced(id)) throw new Error('The message is already being delivered');
        if (['dispatching', 'uncertain'].includes(this.dispatchState(id)?.state ?? ''))
          throw new Error('Message delivery is in progress or uncertain; content is not repeated');
        const common = this.db
          .prepare('SELECT attempt_id,attempt_meta FROM dispatches WHERE message_id=?')
          .get(id) as Row | undefined;
        if (common && (common.attempt_id !== null || common.attempt_meta !== null)) {
          if (
            !common.attempt_id ||
            !common.attempt_meta ||
            decodeDelivery(common.attempt_meta).phase !== 'cancelled'
          )
            throw new Error('Another attempt still owns this message');
          // A definite no-body attempt can be replaced by this private proof path.
          // Its old callbacks lose their exact CAS target; uncertainty is never removed.
          this.db
            .prepare('DELETE FROM dispatches WHERE message_id=? AND attempt_id=?')
            .run(id, common.attempt_id);
        }
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
    if (
      !this.transaction(() => {
        const attempt = this.claudeDelivery(id);
        if (attempt?.scope.transport === 'native-prompt-v1' && !attempt.scope.nativePrompt)
          throw new Error('The native Claude Code envelope has not been sealed');
        return this.claudeTransition(id, ['reserved'], 'issued', null);
      })
    )
      throw new Error('The Claude Code delivery is no longer reserved');
  }
  /** Node-owned expected content is immutable before the native body is released. */
  sealClaudeNativeDelivery(id: string, envelopeHash: string, representationHashes: string[]): void {
    const hash = /^[a-f0-9]{64}$/;
    if (
      !hash.test(envelopeHash) ||
      !representationHashes.length ||
      representationHashes.length > 4 ||
      representationHashes.some((value) => !hash.test(value))
    )
      throw new Error('The native Claude Code envelope metadata is invalid');
    const expected = {
      envelopeHash,
      representationHashes: [...new Set(representationHashes)].sort(),
    };
    this.transaction(() => {
      const attempt = this.claudeDelivery(id);
      if (!attempt || attempt.scope.transport !== 'native-prompt-v1')
        throw new Error('This is not a native Claude Code delivery');
      if (attempt.scope.nativePrompt) {
        const previous = attempt.scope.nativePrompt as typeof expected;
        if (
          previous.envelopeHash !== expected.envelopeHash ||
          JSON.stringify(previous.representationHashes) !==
            JSON.stringify(expected.representationHashes)
        )
          throw new Error('The native Claude Code envelope is already sealed');
        return;
      }
      if (attempt.state !== 'reserved')
        throw new Error('The native Claude Code delivery is no longer reserved');
      this.assertClaudeDeliveryCurrent(id);
      this.db
        .prepare("UPDATE claude_deliveries SET scope=?,updated=? WHERE id=? AND state='reserved'")
        .run(JSON.stringify({ ...attempt.scope, nativePrompt: expected }), Date.now(), id);
    });
  }
  /** Only when ordering proves the content was not written to Claude Code. */
  cancelClaudeDelivery(id: string, reason: string): boolean {
    return this.transaction(() => {
      const attempt = this.claudeDelivery(id);
      if (attempt?.scope.transport === 'native-prompt-v1' && attempt.state === 'issued')
        throw new Error('Released native content cannot be cancelled; admission is uncertain');
      return this.claudeTransition(id, ['reserved', 'issued'], 'cancelled', reason);
    });
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
  /** Captured mailbox and binding authority must still belong to this attempt. */
  assertClaudeDeliveryCurrent(id: string): void {
    const row = this.db.prepare('SELECT * FROM claude_deliveries WHERE id=?').get(id) as
      Row | undefined;
    if (!row) throw new Error('The Claude Code delivery is unknown');
    const owner = this.assertOwner(String(row.connection_id));
    const agent = this.db.prepare('SELECT incarnation FROM agents WHERE key=?').get(owner.key) as
      Row | undefined;
    if (
      owner.key !== row.agent_key ||
      owner.binding.generation !== Number(row.binding_generation) ||
      !agent ||
      agent.incarnation !== row.incarnation
    )
      throw new Error('The Claude Code delivery binding is no longer current');
  }
  /**
   * The helper wrote the complete MCP frame, or the native host kept the sealed
   * exact content row: record receipt for node-chosen IDs. A cleared or reset mailbox is never revived, and receipt
   * requires the captured binding to remain current. A revoked write whose
   * ordering cannot be proved stays uncertain instead of creating receipt.
   */
  commitClaudeDelivery(
    id: string,
    nativeWitness?: { storedRowId: string; representationHash: string },
  ): string[] {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT * FROM claude_deliveries WHERE id=?').get(id) as
        Row | undefined;
      if (!row) return [];
      const scope = JSON.parse(String(row.scope)) as Record<string, unknown>;
      if (scope.transport === 'native-prompt-v1') {
        const expected = scope.nativePrompt as
          | { representationHashes: string[]; storedRowId?: string; representationHash?: string }
          | undefined;
        if (
          !nativeWitness ||
          !nativeWitness.storedRowId ||
          nativeWitness.storedRowId.length > 200 ||
          /[\x00-\x1f\x7f]/.test(nativeWitness.storedRowId) ||
          !Array.isArray(expected?.representationHashes) ||
          !expected.representationHashes.includes(nativeWitness.representationHash)
        )
          throw new Error('The stored Claude Code row does not match this delivery');
        if (
          expected.storedRowId !== undefined &&
          (expected.storedRowId !== nativeWitness.storedRowId ||
            expected.representationHash !== nativeWitness.representationHash)
        )
          throw new Error('The native Claude Code delivery already names another row');
      } else if (nativeWitness) {
        throw new Error('A native stored row cannot commit an MCP response delivery');
      }
      if (row.state !== 'issued') return [];
      this.assertClaudeDeliveryCurrent(id);
      if (nativeWitness) {
        const foreign = this.db
          .prepare(
            "SELECT id FROM claude_deliveries WHERE id<>? AND lower(json_extract(scope,'$.nativePrompt.storedRowId'))=lower(?)",
          )
          .get(id, nativeWitness.storedRowId);
        if (foreign)
          throw new Error('The stored Claude Code row already belongs to another delivery');
        this.db.prepare('UPDATE claude_deliveries SET scope=? WHERE id=?').run(
          JSON.stringify({
            ...scope,
            nativePrompt: { ...(scope.nativePrompt as object), ...nativeWitness },
          }),
          id,
        );
      }
      if (!this.claudeTransition(id, ['issued'], 'committed', null)) return [];
      const agent = this.db
        .prepare('SELECT incarnation FROM agents WHERE key=?')
        .get(String(row.agent_key)) as Row | undefined;
      if (!agent || String(agent.incarnation) !== String(row.incarnation)) return [];
      const delivered: string[] = [];
      for (const item of this.claudeDeliveryItems(id)) {
        const message = this.get(item, 'in');
        if (!message || this.messageOwnerKey(item, 'in') !== row.agent_key) continue;
        if (message.state !== 'ready') continue;
        this.markDelivered(message, String(row.connection_id));
        delivered.push(item);
      }
      return delivered;
    });
  }
  /** Issued attempts of a helper that can no longer report its write become uncertain. */
  claudeHelperGone(helperId: string, epoch?: string): number {
    const rows = this.db
      .prepare("SELECT id FROM claude_deliveries WHERE helper_id=? AND state='issued'")
      .all(helperId) as Row[];
    const affected = rows.filter(
      (row) => !epoch || this.claudeDelivery(String(row.id))?.scope.epoch === epoch,
    );
    for (const row of affected)
      this.uncertainClaudeDelivery(
        String(row.id),
        'The Claude Code helper disconnected before confirming the response write',
      );
    return affected.length;
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

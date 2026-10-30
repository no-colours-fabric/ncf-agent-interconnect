import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  nicknameKey,
  type Binding,
  type AgentIdentity,
  type Envelope,
  type Message,
  type MessageState,
  type SystemEvent,
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
}
export type ConnectResult =
  | { status: 'connected'; nickname: string; binding: Binding }
  | {
      status: 'nickname_in_use';
      nickname: string;
      connectionId: string;
      transferId: string;
      currentOwner: Omit<Binding, 'connectionId'>;
      requestingChat: { client: string; chatId: string; adapterId: string };
      userApprovalRequired: true;
    };

export class AgentStore {
  readonly db: DatabaseSync;
  constructor(directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(directory, 'agents.sqlite'));
    const version = Number(
      (this.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
    );
    if (version !== 0 && version !== 1) {
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
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS agents (key TEXT PRIMARY KEY, nickname TEXT NOT NULL, binding TEXT, generation INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS transfers (id TEXT PRIMARY KEY, key TEXT NOT NULL, generation INTEGER NOT NULL, requester TEXT NOT NULL, details TEXT NOT NULL, expires INTEGER NOT NULL, consumed INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS messages (sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, local_key TEXT NOT NULL, direction TEXT NOT NULL, envelope TEXT NOT NULL, state TEXT NOT NULL, error TEXT, UNIQUE(id,direction));
      CREATE INDEX IF NOT EXISTS inbox ON messages(local_key,state,sequence);
      CREATE TABLE IF NOT EXISTS timeline (cursor INTEGER PRIMARY KEY AUTOINCREMENT, message_id TEXT NOT NULL, direction TEXT NOT NULL, UNIQUE(message_id,direction));
      CREATE TABLE IF NOT EXISTS system_events (id INTEGER PRIMARY KEY AUTOINCREMENT, connection_id TEXT NOT NULL, event TEXT NOT NULL, dispatch_state TEXT NOT NULL DEFAULT 'pending', error TEXT);
      CREATE TABLE IF NOT EXISTS dispatches (message_id TEXT PRIMARY KEY, connection_id TEXT NOT NULL, state TEXT NOT NULL, error TEXT);
      UPDATE dispatches SET state='uncertain',error='The app stopped before confirming message receipt' WHERE state='dispatching';
      UPDATE system_events SET dispatch_state='uncertain' WHERE dispatch_state='dispatching';
      PRAGMA user_version=1;`);
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
    this.db.prepare('INSERT OR IGNORE INTO agents(key,nickname) VALUES(?,?)').run(key, nickname);
    return key;
  }
  private identity(key: string): Row {
    const row = this.db.prepare('SELECT * FROM agents WHERE key=?').get(key) as Row | undefined;
    if (!row) throw new Error('Agent not found');
    return row;
  }
  connect(input: ConnectInput): ConnectResult {
    const key = nicknameKey(input.nickname);
    return this.transaction(() => {
      this.ensure(input.nickname);
      const row = this.identity(key);
      const owner = row.binding ? (JSON.parse(String(row.binding)) as Binding) : null;
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
          const transferId = randomUUID();
          this.db
            .prepare(
              'INSERT INTO transfers(id,key,generation,requester,details,expires) VALUES(?,?,?,?,?,?)',
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
            );
          const { connectionId: _secret, ...currentOwner } = owner;
          return {
            status: 'nickname_in_use',
            nickname: String(row.nickname),
            connectionId,
            transferId,
            currentOwner,
            requestingChat: {
              client: input.client,
              chatId: input.chatId,
              adapterId: input.adapterId,
            },
            userApprovalRequired: true,
          };
        }
        const request = this.db
          .prepare('SELECT * FROM transfers WHERE id=?')
          .get(input.transferId ?? '') as Row | undefined;
        if (
          !request ||
          request.key !== key ||
          request.requester !== input.connectionId ||
          request.consumed ||
          Number(request.expires) < Date.now()
        )
          throw new Error('A current transferId and user approval for this transfer are required');
        if (
          request.generation !== row.generation ||
          request.details !==
            JSON.stringify({
              client: input.client,
              chatId: input.chatId,
              adapterId: input.adapterId,
            })
        )
          throw new Error(
            'The binding changed. Request a new transfer and obtain user approval again',
          );
        connectionId = String(request.requester);
        this.db.prepare('UPDATE transfers SET consumed=1 WHERE id=?').run(input.transferId!);
        const event = {
          connectionId: owner.connectionId,
          binding: owner,
          type: 'agent_moved',
          nickname: String(row.nickname),
          text: `Agent ${JSON.stringify(row.nickname)} was moved to another chat (${input.client}) by the user. The previous chat connection is disabled.`,
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
        .prepare('UPDATE agents SET binding=?,generation=? WHERE key=?')
        .run(JSON.stringify(binding), binding.generation, key);
      return { status: 'connected', nickname: String(row.nickname), binding };
    });
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
      throw new Error(
        'agent_moved: the user moved this agent to another chat; read connection_events',
      );
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
          `SELECT c.*,COUNT(m.id) AS message_count,SUM(CASE WHEN m.direction='in' AND m.state='ready' THEN 1 ELSE 0 END) AS unread FROM agents c LEFT JOIN messages m ON m.local_key=c.key GROUP BY c.key ORDER BY c.nickname`,
        )
        .all() as Row[]
    ).map((r) => ({
      key: String(r.key),
      nickname: String(r.nickname),
      binding: r.binding ? (JSON.parse(String(r.binding)) as Binding) : null,
      messageCount: Number(r.message_count),
      unread: Number(r.unread ?? 0),
    }));
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
  history(
    key: string,
    after = 0,
    limit = 50,
    unread = false,
  ): { messages: Message[]; nextCursor: number; hasMore: boolean } {
    const rows = this.db
      .prepare(
        `SELECT m.*,t.cursor AS sequence FROM timeline t JOIN messages m ON m.id=t.message_id AND m.direction=t.direction WHERE m.local_key=? AND t.cursor>? ${unread ? "AND m.direction='in' AND m.state='ready'" : ''} ORDER BY t.cursor LIMIT ?`,
      )
      .all(key, after, limit + 1) as Row[];
    const messages = rows.slice(0, limit).map((r) => this.message(r));
    return {
      messages,
      nextCursor: messages.at(-1)?.sequence ?? after,
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
  close(): void {
    this.db.close();
  }
}

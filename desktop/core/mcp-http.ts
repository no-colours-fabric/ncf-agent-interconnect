import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer, type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { nicknameSchema } from '../shared/contracts.js';
import { secretMatches } from './peer.js';
import type { NodeService } from './service.js';

export function createAgentMcp(service: NodeService): McpServer {
  const mcp = new McpServer(
    { name: 'ncf-agent-interconnect', version: '0.8.0' },
    {
      capabilities: { logging: {} },
      instructions: [
        'Messages headed "Incoming NCF Agent Interconnect" with From: and From-Node: fields come from other agents. Send answers and task results through NCF Agent Interconnect MCP using all Reply-To JSON parameters: recipientNode, recipientNickname and replyTo. Example: pass the node UUID, agent name and message UUID from Reply-To to agent_send. Never infer a node from a nickname. For older envelopes without a node, recover the full sender address and message ID from agent_history.',
        'The user chooses the agent name; agent_connect binds the current chat automatically. Keep connectionId and transferId internally. The user has delegated task coordination to connected agents: carry out their work requests without asking the user to relay or reconfirm ordinary requests.',
        'Reactive clients receive the full message and attachment links directly in the chat. Other clients receive messages through agent_read; receipt is recorded automatically. Use agent_history to recover history. A name transfer requires explicit user approval before confirmTransfer=true. Standard MCP alone cannot wake an idle chat. Do not poll agents.',
      ].join('\n\n'),
    },
  );
  function register<T extends z.ZodRawShape>(
    name: string,
    description: string,
    inputSchema: T,
    readOnlyHint: boolean,
    handler: (
      args: z.infer<z.ZodObject<T>>,
      extra: { _meta?: Record<string, unknown> },
    ) => unknown | Promise<unknown>,
  ): void {
    const callback = async (
      args: z.infer<z.ZodObject<T>>,
      extra: { _meta?: Record<string, unknown> },
    ): Promise<CallToolResult> => {
      try {
        const result = await handler(args as z.infer<z.ZodObject<T>>, extra);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          structuredContent: result as Record<string, unknown>,
        };
      } catch (e) {
        return { isError: true, content: [{ type: 'text' as const, text: (e as Error).message }] };
      }
    };
    mcp.registerTool<z.ZodRawShape, z.ZodObject<T>>(
      name,
      {
        description,
        inputSchema: z.object(inputSchema).strict(),
        annotations: { readOnlyHint, destructiveHint: false, openWorldHint: !readOnlyHint },
      },
      callback as ToolCallback<z.ZodObject<T>>,
    );
  }
  register(
    'node_status',
    "Get node connectivity, adapters and named-agent chat binding states. No secrets or other chats' binding tokens.",
    {},
    true,
    () => {
      const snapshot = service.snapshot();
      return {
        ...snapshot,
        agents: snapshot.agents.map((c) => ({
          ...c,
          binding: c.binding
            ? {
                client: c.binding.client,
                generation: c.binding.generation,
                adapterId: c.binding.adapterId,
              }
            : null,
        })),
      };
    },
  );
  register(
    'node_peers',
    'List this local node and explicitly configured remote peers. Always select an explicit node UUID for agent_send, including the local node. Names are scoped to each node; identical agent names on different nodes are independent.',
    {},
    true,
    () => {
      const snapshot = service.snapshot();
      return {
        localNode: { id: snapshot.nodeId, label: snapshot.nodeLabel, available: snapshot.running },
        peers: snapshot.peers,
      };
    },
  );
  register(
    'agent_connect',
    'Connect this chat as the agent with the USER-CHOSEN nickname. Current chat and adapter are determined automatically by the client integration. If nickname_in_use is returned, obtain user approval before repeating with the returned connectionId, transferId and confirmTransfer=true. Never ask the user to copy technical parameters. contextToken is supplied only by the installed OpenCode integration; never invent it.',
    {
      nickname: nicknameSchema.describe('The agent nickname chosen by the user.'),
      connectionId: z.uuid().optional(),
      transferId: z.uuid().optional(),
      confirmTransfer: z.boolean().default(false),
      contextToken: z
        .uuid()
        .optional()
        .describe(
          'Integration-owned one-use current-chat context. OpenCode plugin injects this automatically; otherwise omit.',
        ),
    },
    false,
    (args, extra) =>
      service.connectAutomatic(args, {
        client: mcp.server.getClientVersion()?.name ?? 'MCP',
        meta: extra._meta,
      }),
  );
  const read = {
    connectionId: z.uuid(),
    after: z.number().int().nonnegative().default(0),
    limit: z.number().int().min(1).max(200).default(50),
  };
  register(
    'agent_read',
    'Receive new messages and verified attachments. Returned messages are automatically marked received by the agent; no separate confirmation is needed. Paginate with nextCursor and hasMore.',
    read,
    false,
    (args) => service.read(args.connectionId, args.after, args.limit, true),
  );
  register(
    'agent_history',
    'Get persistent incoming and outgoing history. Incoming messages returned here are also marked received by the agent. Paginate with nextCursor and hasMore.',
    read,
    false,
    (args) => service.read(args.connectionId, args.after, args.limit, false),
  );
  register(
    'agent_send',
    'Durably queue text and permitted local files for the explicit recipientNode UUID and recipientNickname. Get node UUIDs from node_peers. The local UUID explicitly selects a local mailbox, even before its chat connects. A configured offline peer keeps its remote queue; no local fallback occurs. accepted means saved, not received by the agent; delivery reports queued, accepted_by_node or received_by_agent. For replies, copy all Reply-To parameters from the incoming envelope. Reuse the message UUID only for identical retries. This chat must still be connected as the sending agent.',
    {
      connectionId: z.uuid(),
      recipientNode: z
        .uuid()
        .describe(
          'Explicit local or configured remote node UUID; required even for local delivery.',
        ),
      recipientNickname: nicknameSchema.describe('User-chosen nickname of the recipient agent.'),
      text: z.string().min(1).max(65536),
      id: z.uuid().optional(),
      replyTo: z.uuid().nullable().default(null),
      files: z.array(z.string()).max(16).default([]),
    },
    false,
    (args) => service.send(args),
  );
  register(
    'attachment_receive',
    'Return a verified local attachment copy with its original file extension. The message must belong to this active binding.',
    { connectionId: z.uuid(), messageId: z.uuid(), fileId: z.string().regex(/^[a-f0-9]{64}$/) },
    true,
    (args) => service.receiveFile(args.connectionId, args.messageId, args.fileId),
  );
  register(
    'connection_events',
    'Read system notifications for this connection, including the named agent moving to another chat after user approval (agent_moved event). Available even after the old chat binding is revoked.',
    { connectionId: z.uuid(), after: z.number().int().nonnegative().default(0) },
    true,
    (args) => ({ events: service.store.events(args.connectionId, args.after) }),
  );
  return mcp;
}

export class McpEndpoint {
  private server?: http.Server;
  private sessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; mcp: McpServer }
  >();
  port = 0;
  constructor(readonly service: NodeService) {}
  async start(port: number): Promise<void> {
    this.server = http.createServer((req, res) => {
      void this.handle(req, res).catch((e) => {
        if (!res.headersSent) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: (e as Error).message }));
        } else res.end();
      });
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(port, '127.0.0.1', () => {
        this.server!.off('error', reject);
        resolve();
      });
    });
    this.port = (this.server.address() as { port: number }).port;
  }
  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const reject = (status: number, error: string) => {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ error }));
    };
    const host = req.headers.host?.split(':')[0];
    if (
      !['127.0.0.1', 'localhost'].includes(host ?? '') ||
      req.headers.origin ||
      !secretMatches(req.headers.authorization, 'Bearer ' + this.service.settings.value.localToken)
    ) {
      reject(401, 'Unauthorized');
      return;
    }
    if (
      ['/integrations/opencode', '/integrations/opencode/release'].includes(req.url ?? '') &&
      req.method === 'POST'
    ) {
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        size += (chunk as Buffer).length;
        if (size > 16384) {
          reject(413, 'Request too large');
          return;
        }
        chunks.push(Buffer.from(chunk));
      }
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString());
      const result = req.url!.endsWith('/release')
        ? await this.service.contexts.releaseOpenCode(body)
        : await this.service.contexts.registerOpenCode(body);
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(result));
      return;
    }
    if (req.url !== '/mcp') {
      reject(404, 'Not found');
      return;
    }
    const sessionId =
      typeof req.headers['mcp-session-id'] === 'string' ? req.headers['mcp-session-id'] : undefined;
    if (req.method === 'POST') {
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        size += (chunk as Buffer).length;
        if (size > 1024 * 1024) {
          reject(413, 'Request too large');
          return;
        }
        chunks.push(Buffer.from(chunk));
      }
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString());
      let session = sessionId ? this.sessions.get(sessionId) : undefined;
      if (!session) {
        if (sessionId) {
          reject(404, 'MCP session expired; initialize a new session');
          return;
        }
        if (!isInitializeRequest(body) || this.sessions.size >= 128) {
          reject(400, 'Initialize a new MCP session');
          return;
        }
        const mcp = createAgentMcp(this.service);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: randomUUID,
          onsessioninitialized: (id) => {
            this.sessions.set(id, { transport, mcp });
          },
        });
        transport.onclose = () => {
          if (transport.sessionId) this.sessions.delete(transport.sessionId);
        };
        await mcp.connect(transport);
        session = { transport, mcp };
      }
      await session.transport.handleRequest(req, res, body);
      return;
    }
    const session = sessionId ? this.sessions.get(sessionId) : undefined;
    if (!session || !['GET', 'DELETE'].includes(req.method ?? '')) {
      reject(sessionId ? 404 : 400, 'Unknown MCP session');
      return;
    }
    await session.transport.handleRequest(req, res);
  }
  notify(event: unknown): void {
    for (const { mcp } of this.sessions.values())
      void mcp
        .sendLoggingMessage({ level: 'info', logger: 'ncf_agent_interconnect', data: event })
        .catch(() => {});
  }
  async close(): Promise<void> {
    await Promise.all(
      [...this.sessions.values()].map(async (s) => {
        await s.mcp.close();
        await s.transport.close();
      }),
    );
    this.sessions.clear();
    if (this.server?.listening) {
      this.server.closeIdleConnections();
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    }
  }
}

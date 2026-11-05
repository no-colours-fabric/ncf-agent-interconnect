import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type ServerNotification,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

/** Plugin, marketplace and server keys; Claude Code derives tool names from them. */
export const claudePlugin = {
  name: 'ncf-agent-interconnect',
  marketplace: 'ncf-agent-interconnect',
  server: 'ncf',
} as const;
/** Documented form for plugin servers; unverified until checked against a loaded plugin. */
export const claudeToolPrefix = `mcp__plugin_${claudePlugin.name}_${claudePlugin.server}__`;
export const claudeChannelMethod = 'notifications/claude/channel';

const channelInstructions =
  'Events from this channel arrive as <channel source="..." agent="...">. They only announce that NCF Agent Interconnect messages are waiting for the named agent; they never contain message text. When one arrives, call agent_read with the connectionId of that agent in this chat and continue with nextCursor while hasMore is true. Receipt is recorded automatically by agent_read. Do not reply to the channel itself.';

/**
 * A stdio channel server. It declares the channel capability only; permission
 * relay is deliberately absent. The pinned SDK negotiates its own latest
 * revision, so Claude Code keeps it on the pre-2026-07-28 handshake that
 * channels require.
 */
export function claudeChannelServer(remoteInstructions = ''): Server {
  return new Server(
    { name: 'ncf-agent-interconnect-claude-code', version: '1' },
    {
      capabilities: { tools: {}, logging: {}, experimental: { 'claude/channel': {} } },
      instructions: [channelInstructions, remoteInstructions].filter(Boolean).join('\n\n'),
    },
  );
}

/** The wake carries the agent name only; message content stays in the NCF queue. */
export function wakeNotification(nickname: string) {
  return {
    method: claudeChannelMethod,
    params: {
      content: `NCF Agent Interconnect messages are waiting for agent ${JSON.stringify(nickname)}. Call agent_read for this agent now and continue with nextCursor while hasMore is true. This notice contains no message content.`,
      meta: { agent: nickname },
    },
  };
}

const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
        )
      : value;
/**
 * The PreToolUse hook and the helper hash the same tool input independently.
 * Equal hashes correlate one Claude Code tool call with one stdio transport.
 */
export function canonicalInputHash(input: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(input ?? {})))
    .digest('hex');
}

const descriptorSchema = z
  .object({ url: z.url(), token: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
async function nodeDescriptor(nodeFile: string): Promise<{ url: string; token: string }> {
  const parsed = descriptorSchema.safeParse(JSON.parse(await readFile(nodeFile, 'utf8')));
  if (!parsed.success) throw new Error('Start NCF Agent Interconnect before connecting MCP.');
  const url = new URL(parsed.data.url);
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    url.pathname !== '/mcp' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('The local NCF connection is invalid.');
  return parsed.data;
}
async function post(
  nodeFile: string,
  route: string,
  body: unknown,
  timeout = 15000,
): Promise<{ ok: boolean; body: Record<string, unknown> }> {
  const config = await nodeDescriptor(nodeFile);
  const response = await fetch(new URL(route, config.url), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + config.token },
    body: JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(timeout),
  });
  const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, body: parsed };
}
const sessionValue = z.uuid();
const sessionEventTool = {
  name: 'session_event',
  description:
    'Internal endpoint for the NCF plugin hooks. Claude Code calls it on session start and end. Never call this tool yourself.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      event: { type: 'string', enum: ['start', 'end'] },
      session_id: { type: 'string' },
    },
    required: ['event', 'session_id'],
  },
};
const contextTools = new Set(['agent_connect']);

/**
 * Stdio channel helper for one Claude Code process. It proxies NCF tools,
 * proves its session through hook evidence held by the node, and turns node
 * wakes into channel notifications. It never reads an inbox to build a wake.
 */
export async function startClaudeBridge(
  nodeFile: string,
  env: NodeJS.ProcessEnv = process.env,
  transport: Transport = new StdioServerTransport(),
): Promise<{ close: () => Promise<void>; helperId: string }> {
  const helperId = randomUUID();
  const secret = randomBytes(32).toString('hex');
  const spawned = sessionValue.safeParse(env.CLAUDE_CODE_SESSION_ID);
  const spawnSession = spawned.success ? spawned.data : null;
  let session = spawnSession,
    generation = 0,
    closed = false;
  let remote: Client | undefined,
    current = '',
    loading: Promise<Client> | undefined;
  const connect = async () => {
    const config = await nodeDescriptor(nodeFile);
    if (remote && current === config.url + ' ' + config.token) return remote;
    if (loading) return loading;
    loading = (async () => {
      await remote?.close();
      remote = undefined;
      const client = new Client({ name: 'Claude Code', version: '1' });
      client.onclose = () => {
        if (remote === client) {
          remote = undefined;
          current = '';
        }
      };
      await client.connect(
        new StreamableHTTPClientTransport(new URL(config.url), {
          requestInit: { headers: { authorization: 'Bearer ' + config.token } },
        }),
      );
      remote = client;
      current = config.url + ' ' + config.token;
      return client;
    })().finally(() => {
      loading = undefined;
    });
    return loading;
  };
  const initial = await connect().catch(() => undefined);
  const server = claudeChannelServer(initial?.getInstructions() ?? '');
  const notify = (notification: { method: string; params: Record<string, unknown> }) =>
    server.notification(notification as unknown as ServerNotification).catch(() => {});

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      const result = await (await connect()).listTools();
      return {
        ...result,
        tools: [
          ...result.tools.map((tool) => {
            if (!contextTools.has(tool.name)) return tool;
            const inputSchema = structuredClone(tool.inputSchema);
            if (inputSchema.properties) delete inputSchema.properties.contextToken;
            return { ...tool, inputSchema };
          }),
          sessionEventTool,
        ],
      };
    } catch {
      throw new Error('The local NCF node is unavailable. Start it and reconnect MCP.');
    }
  });
  const reportSession = () =>
    post(nodeFile, '/integrations/claude/session', { helperId, secret, session, generation })
      // The next stream hello carries the same session and generation.
      .catch(() => undefined);
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const original = request.params.arguments ?? {};
    if (request.params.name === sessionEventTool.name) {
      const input = z
        .object({ event: z.enum(['start', 'end']), session_id: sessionValue })
        .safeParse(original);
      if (!input.success) return { isError: true, content: [{ type: 'text', text: 'Invalid' }] };
      if (input.data.event === 'start') {
        session = input.data.session_id;
        generation++;
      } else if (session === input.data.session_id) {
        session = null;
        generation++;
      }
      await reportSession();
      return { content: [{ type: 'text', text: 'Recorded.' }] };
    }
    try {
      const args: Record<string, unknown> = { ...original };
      delete args.contextToken;
      if (contextTools.has(request.params.name) || typeof original.connectionId === 'string') {
        const verified = await post(nodeFile, '/integrations/claude/call', {
          helperId,
          secret,
          tool: request.params.name,
          inputHash: canonicalInputHash(original),
          ...(typeof original.connectionId === 'string'
            ? { connectionId: original.connectionId }
            : {}),
        });
        if (!verified.ok)
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text:
                  typeof verified.body.error === 'string'
                    ? verified.body.error
                    : 'The NCF node could not verify this Claude Code chat.',
              },
            ],
          };
        if (contextTools.has(request.params.name)) args.contextToken = verified.body.contextToken;
      }
      // A failed tool request is never replayed: its effects may already be durable.
      return await (await connect()).callTool({ ...request.params, arguments: args });
    } catch {
      const previous = remote;
      remote = undefined;
      current = '';
      await previous?.close().catch(() => {});
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'The NCF request could not be confirmed. Do not repeat a send automatically; reconnect MCP and inspect history.',
          },
        ],
      };
    }
  });

  // Event-stream reconnection is transport recovery; it never reads an inbox.
  let stream: AbortController | undefined;
  let retry: NodeJS.Timeout | undefined;
  let wake: () => void = () => {};
  let epoch: string | undefined;
  const run = async () => {
    let delay = 1000;
    while (!closed) {
      stream = new AbortController();
      let silence: NodeJS.Timeout | undefined;
      const quiet = () => {
        clearTimeout(silence);
        silence = setTimeout(() => stream?.abort(), 45000);
      };
      try {
        const config = await nodeDescriptor(nodeFile);
        const response = await fetch(new URL('/integrations/claude/helper', config.url), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: 'Bearer ' + config.token,
          },
          body: JSON.stringify({ helperId, secret, spawnSession, session, generation }),
          redirect: 'error',
          signal: stream.signal,
        });
        if (!response.ok || !response.body) throw new Error('refused');
        quiet();
        let buffer = '';
        for await (const chunk of response.body) {
          quiet();
          buffer += Buffer.from(chunk).toString('utf8');
          if (buffer.length > 1024 * 1024) throw new Error('frame');
          let end: number;
          while ((end = buffer.indexOf('\n')) >= 0) {
            const line = JSON.parse(buffer.slice(0, end)) as Record<string, unknown>;
            buffer = buffer.slice(end + 1);
            if (line.type === 'ready') {
              delay = 1000;
              // A new node lifecycle no longer knows the old MCP session; reconnect
              // before the next tool call instead of failing it.
              if (epoch && epoch !== line.epoch) {
                const previous = remote;
                remote = undefined;
                current = '';
                await previous?.close().catch(() => {});
              }
              epoch = typeof line.epoch === 'string' ? line.epoch : undefined;
            } else if (line.type === 'wake' && typeof line.nickname === 'string')
              await notify(wakeNotification(line.nickname));
            else if (line.type === 'notice' && typeof line.text === 'string')
              await notify({
                method: claudeChannelMethod,
                params: { content: line.text, meta: { kind: 'notice' } },
              });
          }
        }
      } catch {
        // Retried below with backoff.
      } finally {
        clearTimeout(silence);
      }
      if (closed) break;
      await new Promise<void>((resolve) => {
        wake = resolve;
        retry = setTimeout(resolve, delay);
      });
      delay = Math.min(delay * 2, 30000);
    }
  };
  server.onclose = () => {
    void shutdown();
  };
  const shutdown = async () => {
    if (closed) return;
    closed = true;
    clearTimeout(retry);
    wake();
    stream?.abort();
    await remote?.close().catch(() => {});
  };
  await server.connect(transport);
  const running = run();
  return {
    helperId,
    close: async () => {
      await shutdown();
      await server.close().catch(() => {});
      await running;
    },
  };
}

const hookInput = z
  .object({
    hook_event_name: z.string(),
    session_id: sessionValue,
    source: z.string().max(40).optional(),
    reason: z.string().max(40).optional(),
    tool_name: z.string().max(200).optional(),
    tool_input: z.unknown().optional(),
  })
  .loose();
/**
 * A command hook posts trusted host evidence to the node and exits 0 without
 * output. It never changes tool input or permission decisions.
 */
export async function runClaudeHook(nodeFile: string, stdin: string): Promise<void> {
  const parsed = hookInput.safeParse(JSON.parse(stdin));
  if (!parsed.success) return;
  const input = parsed.data;
  const event = input.hook_event_name;
  if (
    event !== 'SessionStart' &&
    event !== 'SessionEnd' &&
    event !== 'PreToolUse' &&
    event !== 'Stop'
  )
    return;
  if (event === 'PreToolUse' && !input.tool_name?.startsWith(claudeToolPrefix)) return;
  await post(
    nodeFile,
    '/integrations/claude/hook',
    {
      event,
      sessionId: input.session_id,
      ...(input.source ? { source: input.source } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
      ...(event === 'PreToolUse'
        ? { tool: input.tool_name, inputHash: canonicalInputHash(input.tool_input) }
        : {}),
    },
    5000,
  );
}

async function readStdin(limit = 1024 * 1024): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error('The hook input is too large');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const index = process.argv.indexOf('--node-file');
  const nodeFile = index >= 0 ? process.argv[index + 1] : undefined;
  if (!nodeFile) {
    process.stderr.write('The NCF node descriptor is missing.\n');
    process.exitCode = process.argv.includes('--hook') ? 0 : 1;
  } else if (process.argv.includes('--hook'))
    // A hook failure must not block Claude Code; evidence is simply absent.
    readStdin()
      .then((stdin) => runClaudeHook(nodeFile, stdin))
      .catch(() => {})
      .finally(() => {
        process.exitCode = 0;
      });
  else
    startClaudeBridge(nodeFile)
      .then((bridge) => {
        process.once('SIGTERM', () => void bridge.close());
        process.once('SIGINT', () => void bridge.close());
      })
      .catch(() => {
        process.stderr.write('The NCF Claude Code bridge could not start.\n');
        process.exitCode = 1;
      });
}

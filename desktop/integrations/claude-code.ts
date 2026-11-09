import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type JSONRPCMessage,
  type ServerNotification,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { readNativeLease, updateNativeLease } from './claude-native-lease.js';

/** Plugin, marketplace and server keys; Claude Code derives tool names from them. */
export const claudePlugin = {
  name: 'ncf-agent-interconnect',
  marketplace: 'ncf-agent-interconnect',
  server: 'ncf',
  /** The notice gate; the main plugin depends on it, so its mod runs first. */
  gate: 'ncf-agent-interconnect-gate',
} as const;
/** Documented form for plugin servers; unverified until checked against a loaded plugin. */
export const claudeToolPrefix = `mcp__plugin_${claudePlugin.name}_${claudePlugin.server}__`;
export const claudeChannelMethod = 'notifications/claude/channel';
/** Private bridge-to-node admission capability; never a model tool argument. */
export const claudeCallMetaKey = 'ncf/claude-call';
/** Private node-to-bridge delivery attempt of a read result; stripped before Claude Code sees it. */
export const claudeDeliveryMetaKey = 'ncf/claude-delivery';

const channelInstructions =
  'Channel wake delivery is experimental and unconfirmed. If an event from this channel arrives as <channel source="..." agent="...">, it only announces that NCF Agent Interconnect messages are waiting for the named agent; it never contains message text. Call agent_read with the connectionId of that agent in this chat and continue with nextCursor while hasMore is true. Messages remain available through agent_read without a channel event. A read does not establish automatic idle wake. Do not poll or reply to the channel itself.';

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
 * Hash only the original tool arguments. The integration-owned proof is
 * injected later and establishes authority independently of this integrity hash.
 */
export function canonicalInputHash(input: unknown): string {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const { contextToken: _proof, ...original } = input as Record<string, unknown>;
    input = original;
  }
  return createHash('sha256')
    .update(JSON.stringify(canonical(input ?? {})))
    .digest('hex');
}

/**
 * Stdio to Claude Code where a frame counts as sent only when the write callback
 * reports the whole frame handed to the pipe without error. That is the local
 * full-frame handoff a delivery commits on; it is not an acknowledgement by
 * Claude Code or the model.
 */
export class ClaudeStdioTransport extends StdioServerTransport {
  constructor(
    stdin: NodeJS.ReadableStream = process.stdin,
    private readonly stdout: NodeJS.WritableStream = process.stdout,
  ) {
    super(stdin as never, stdout as never);
  }
  override send(message: JSONRPCMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stdout.write(serializeMessage(message), (error) => (error ? reject(error) : resolve()));
    });
  }
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
const sessionValue = z.uuid().transform((value) => value.toLowerCase());
const contextTools = new Set(['agent_connect']);

/**
 * Stdio channel helper for one Claude Code process. It proxies NCF tools,
 * proves its session through hook evidence held by the node, and turns node
 * wakes into channel notifications. It never reads an inbox to build a wake.
 */
export async function startClaudeBridge(
  nodeFile: string,
  env: NodeJS.ProcessEnv = process.env,
  transport: Transport = new ClaudeStdioTransport(),
): Promise<{ close: () => Promise<void>; helperId: string }> {
  const helperId = randomUUID();
  const secret = randomBytes(32).toString('hex');
  // Delivery attempts of read results, keyed by the JSON-RPC id of their response.
  const deliveries = new Map<string | number, string>();
  const report = async (delivery: string, phase: 'commit' | 'cancel' | 'uncertain') => {
    // A commit is idempotent on node-owned IDs, so a failed report is retried a
    // few times; without it the attempt stays uncertain, never processed.
    for (let attempt = 0; attempt < (phase === 'commit' ? 3 : 1); attempt++)
      try {
        const sent = await post(nodeFile, '/integrations/claude/delivery', {
          helperId,
          secret,
          delivery,
          phase,
        });
        if (sent.ok) return;
      } catch {
        // Retried below.
      }
  };
  const send = transport.send.bind(transport);
  transport.send = async (message, options) => {
    const id =
      'id' in message && ('result' in message || 'error' in message) ? message.id : undefined;
    const delivery = id === undefined ? undefined : deliveries.get(id);
    if (delivery === undefined) return send(message, options);
    deliveries.delete(id!);
    try {
      await send(message, options);
    } catch (error) {
      // The frame may be partly written: receipt is unknown, never repeated.
      void report(delivery, 'uncertain');
      throw error;
    }
    void report(delivery, 'commit');
  };
  const spawned = sessionValue.safeParse(env.CLAUDE_CODE_SESSION_ID);
  const spawnSession = spawned.success ? spawned.data : null;
  const session = spawnSession;
  const generation = 0;
  let closed = false;
  let nativeLeaseNonce: string | null = null;
  let nativeLeasePinned = false;
  let nativeLeaseBlocked = false;
  if (spawnSession) {
    try {
      const lease = await readNativeLease(nodeFile, spawnSession);
      if (lease?.active) {
        nativeLeaseNonce = lease.nonce;
        nativeLeasePinned = true;
      }
    } catch {
      nativeLeaseBlocked = true;
    }
  }
  const nativeLeaseCurrent = async (): Promise<boolean> => {
    if (!spawnSession || !nativeLeasePinned || !nativeLeaseNonce || nativeLeaseBlocked)
      return false;
    try {
      const lease = await readNativeLease(nodeFile, spawnSession);
      return !!lease?.active && lease.nonce === nativeLeaseNonce;
    } catch {
      return false;
    }
  };
  const unverifiedContext = () => ({
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: 'This native Claude Code session is not verified. Use the client controls to reconnect MCP.',
      },
    ],
  });
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
        tools: result.tools.map((tool) => {
          const inputSchema = structuredClone(tool.inputSchema);
          inputSchema.properties = {
            ...inputSchema.properties,
            contextToken: {
              type: 'string',
              description:
                'One-use current-call proof supplied automatically by the installed NCF hook.',
            },
          };
          return { ...tool, inputSchema };
        }),
      };
    } catch {
      throw new Error('The local NCF node is unavailable. Start it and reconnect MCP.');
    }
  });
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const original = request.params.arguments ?? {};
    if (request.params.name === 'session_event')
      return {
        isError: true,
        content: [
          { type: 'text', text: 'Model tool calls cannot change the native chat context.' },
        ],
      };
    try {
      const args: Record<string, unknown> = { ...original };
      delete args.contextToken;
      let callToken: string;
      if (!(await nativeLeaseCurrent())) return unverifiedContext();
      {
        const verified = await post(nodeFile, '/integrations/claude/call', {
          helperId,
          secret,
          tool: request.params.name,
          inputHash: canonicalInputHash(original),
          contextToken: original.contextToken,
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
        if (typeof verified.body.callToken !== 'string') return unverifiedContext();
        callToken = verified.body.callToken;
        if (contextTools.has(request.params.name)) args.contextToken = verified.body.contextToken;
      }
      if (!(await nativeLeaseCurrent())) return unverifiedContext();
      // A failed tool request is never replayed: its effects may already be durable.
      const client = await connect();
      if (!(await nativeLeaseCurrent())) return unverifiedContext();
      const currentCall = async (phase: 'forward' | 'return') => {
        const verified = await post(nodeFile, '/integrations/claude/call/validate', {
          helperId,
          secret,
          callToken,
          phase,
        });
        if (!verified.ok || verified.body.valid !== true)
          throw new Error('The current Claude Code call is no longer authorized.');
      };
      await currentCall('forward');
      if (!(await nativeLeaseCurrent())) return unverifiedContext();
      const result = await client.callTool({
        ...request.params,
        arguments: args,
        _meta: { ...request.params._meta, [claudeCallMetaKey]: callToken },
      });
      // The node's delivery attempt is private to this bridge.
      const delivery =
        typeof result._meta?.[claudeDeliveryMetaKey] === 'string'
          ? (result._meta[claudeDeliveryMetaKey] as string)
          : undefined;
      if (result._meta) {
        const { [claudeDeliveryMetaKey]: _delivery, ...meta } = result._meta;
        result._meta = Object.keys(meta).length ? meta : undefined;
      }
      try {
        await currentCall('return');
        // Admission may already have had durable effects; a late authority loss
        // withholds content without undoing or replaying that operation.
        if (!(await nativeLeaseCurrent()))
          throw new Error('The Claude Code call result could not be confirmed.');
      } catch (error) {
        // Nothing of this result has been written to Claude Code.
        if (delivery) await report(delivery, 'cancel');
        throw error;
      }
      // Receipt is committed by the transport after the full frame is written.
      if (delivery) deliveries.set(extra.requestId, delivery);
      return result;
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
          body: JSON.stringify({
            helperId,
            secret,
            spawnSession,
            session,
            generation,
            nativeLeaseNonce,
          }),
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
            if (line.type === 'native-lease' && !nativeLeasePinned && !nativeLeaseBlocked) {
              if (line.session !== spawnSession || typeof line.nonce !== 'string') {
                nativeLeaseBlocked = true;
                continue;
              }
              const lease = spawnSession ? await readNativeLease(nodeFile, spawnSession) : null;
              if (!lease?.active || lease.nonce !== line.nonce) {
                nativeLeaseBlocked = true;
                continue;
              }
              nativeLeaseNonce = line.nonce;
              nativeLeasePinned = true;
            } else if (line.type === 'ready') {
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
            } else if (line.type === 'wake' && typeof line.nickname === 'string') {
              if (await nativeLeaseCurrent()) await notify(wakeNotification(line.nickname));
            } else if (
              line.type === 'notice' &&
              typeof line.text === 'string' &&
              (await nativeLeaseCurrent())
            )
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
      // An unbound helper cannot acquire another native incarnation after its
      // first stream disconnects. The owner must use the client's fresh-helper lifecycle.
      if (!nativeLeasePinned) nativeLeaseBlocked = true;
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
  // Claude Code drops channel events sent before its MCP handshake completes, so
  // the route is offered to the node only once the client is initialized.
  let running: Promise<void> | undefined;
  server.oninitialized = () => {
    running ??= run();
  };
  await server.connect(transport);
  return {
    helperId,
    close: async () => {
      await shutdown();
      await server.close().catch(() => {});
      await running;
    },
  };
}

/**
 * The installed mod's child for one exact native session: it holds the node's
 * wake stream and prints each claimed wake as one JSON line. It never reads an
 * inbox. Reconnection is transport recovery; it ends when the native session
 * ends or its parent goes away.
 */
export async function runWakeStream(
  nodeFile: string,
  session: string,
  write: (line: string) => void = (line) => void process.stdout.write(line),
  parent: () => number = () => process.ppid,
): Promise<void> {
  const sessionId = sessionValue.parse(session);
  const parentPid = parent();
  let delay = 1000;
  for (;;) {
    if (parent() !== parentPid) return;
    const lease = await readNativeLease(nodeFile, sessionId).catch(() => null);
    if (!lease?.active) return;
    const stream = new AbortController();
    let silence: NodeJS.Timeout | undefined;
    const quiet = () => {
      clearTimeout(silence);
      silence = setTimeout(() => stream.abort(), 45000);
    };
    try {
      const config = await nodeDescriptor(nodeFile);
      const response = await fetch(new URL('/integrations/claude/wake/stream', config.url), {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + config.token },
        body: JSON.stringify({ sessionId, nativeLeaseNonce: lease.nonce }),
        redirect: 'error',
        signal: stream.signal,
      });
      if (!response.ok || !response.body) throw new Error('refused');
      quiet();
      let buffer = '';
      for await (const chunk of response.body) {
        quiet();
        buffer += Buffer.from(chunk).toString('utf8');
        if (buffer.length > 65536) throw new Error('frame');
        let end: number;
        while ((end = buffer.indexOf('\n')) >= 0) {
          const line = JSON.parse(buffer.slice(0, end)) as Record<string, unknown>;
          buffer = buffer.slice(end + 1);
          if (line.type === 'error') throw new Error('refused');
          if (line.type === 'ready') delay = 1000;
          if (
            line.type === 'wake' &&
            typeof line.claim === 'string' &&
            /^[0-9a-f]{64}$/.test(line.claim) &&
            typeof line.notice === 'string'
          )
            write(JSON.stringify({ type: 'wake', claim: line.claim, notice: line.notice }) + '\n');
        }
        if (parent() !== parentPid) return;
      }
    } catch {
      // Retried below with backoff while the native session lasts.
    } finally {
      clearTimeout(silence);
      stream.abort();
    }
    if (parent() !== parentPid) return;
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, 30000);
  }
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
 * Persist native lifecycle evidence before HTTP. PreToolUse injects an opaque
 * node-issued proof without making a permission decision.
 */
export async function runClaudeHook(
  nodeFile: string,
  stdin: string,
): Promise<Record<string, unknown> | undefined> {
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
  const lease =
    event === 'SessionStart' || event === 'SessionEnd'
      ? await updateNativeLease(nodeFile, input.session_id, event)
      : await readNativeLease(nodeFile, input.session_id);
  if (!lease || (event !== 'SessionEnd' && !lease.active)) return;
  const response = await post(
    nodeFile,
    '/integrations/claude/hook',
    {
      event,
      sessionId: input.session_id,
      nativeLeaseNonce: lease.nonce,
      ...(input.source ? { source: input.source } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
      ...(event === 'PreToolUse'
        ? { tool: input.tool_name, inputHash: canonicalInputHash(input.tool_input) }
        : {}),
    },
    5000,
  );
  if (event === 'PreToolUse' && response.ok && typeof response.body.contextToken === 'string')
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        updatedInput: {
          ...(input.tool_input &&
          typeof input.tool_input === 'object' &&
          !Array.isArray(input.tool_input)
            ? (input.tool_input as Record<string, unknown>)
            : {}),
          contextToken: response.body.contextToken,
        },
      },
    };
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
  } else if (process.argv.includes('--wake-stream')) {
    const session = process.argv[process.argv.indexOf('--session') + 1] ?? '';
    runWakeStream(nodeFile, session)
      .catch(() => {})
      .finally(() => {
        process.exitCode = 0;
      });
  } else if (process.argv.includes('--hook'))
    // A hook failure must not block Claude Code; evidence is simply absent.
    readStdin()
      .then((stdin) => runClaudeHook(nodeFile, stdin))
      .then((output) => {
        if (output) process.stdout.write(JSON.stringify(output) + '\n');
      })
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

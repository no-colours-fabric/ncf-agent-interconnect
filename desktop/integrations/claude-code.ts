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
import {
  readInitialNativeLease,
  readNativeLease,
  updateNativeLease,
} from './claude-native-lease.js';
import { traceClaude } from './claude-diagnostics.js';

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

/** Decode private JSON lines without changing Unicode across transport chunks. */
export class ClaudeJsonLineDecoder {
  private readonly decoder = new TextDecoder('utf-8', { fatal: true });
  private buffer = '';
  constructor(private readonly limit: number) {}
  push(chunk: Uint8Array): Record<string, unknown>[] {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    if (Buffer.byteLength(this.buffer, 'utf8') > this.limit)
      throw new Error('The Claude Code integration stream frame is too large.');
    const lines: Record<string, unknown>[] = [];
    let end: number;
    while ((end = this.buffer.indexOf('\n')) >= 0) {
      lines.push(JSON.parse(this.buffer.slice(0, end)) as Record<string, unknown>);
      this.buffer = this.buffer.slice(end + 1);
    }
    return lines;
  }
  finish(): void {
    this.buffer += this.decoder.decode();
    if (this.buffer.length)
      throw new Error('The Claude Code integration stream ended with an incomplete frame.');
  }
}

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
  interface PendingFrame {
    delivery: string;
    requestId: string | number;
    signal: AbortSignal;
    digest: string;
    validate: () => Promise<void>;
    writing: boolean;
    settled: boolean;
    cleanup: () => void;
  }
  const deliveries = new Map<string | number, PendingFrame>();
  const resultDigest = (result: unknown) =>
    createHash('sha256')
      .update(JSON.stringify(canonical(result)))
      .digest('hex');
  const report = async (
    delivery: string,
    phase: 'validate' | 'commit' | 'cancel' | 'uncertain',
  ) => {
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
        traceClaude(nodeFile, 'bridge.delivery-report', {
          helper: helperId,
          attempt: delivery,
          phase,
          outcome: sent.ok ? 'accepted' : 'refused',
        });
        if (sent.ok) return true;
      } catch {
        // Retried below.
      }
    return false;
  };
  const settle = (entry: PendingFrame, phase: 'commit' | 'cancel' | 'uncertain') => {
    if (entry.settled) return;
    entry.settled = true;
    entry.cleanup();
    if (deliveries.get(entry.requestId) === entry) deliveries.delete(entry.requestId);
    void report(entry.delivery, phase).then((accepted) => {
      if (!accepted && phase === 'commit') void report(entry.delivery, 'uncertain');
    });
  };
  const send = transport.send.bind(transport);
  transport.send = async (message, options) => {
    const id =
      'id' in message && ('result' in message || 'error' in message) ? message.id : undefined;
    const entry = id === undefined ? undefined : deliveries.get(id);
    if (!entry) return send(message, options);
    // The SDK clones a handler result during validation. Match its complete
    // content as well as the server-owned request signal; an id alone is not
    // evidence that this frame carries the reserved page.
    if (!('result' in message) || resultDigest(message.result) !== entry.digest) {
      settle(entry, 'cancel');
      return send(message, options);
    }
    if (entry.signal.aborted || entry.settled) {
      settle(entry, 'cancel');
      throw new Error('The Claude Code response was cancelled before writing.');
    }
    try {
      await entry.validate();
      if (entry.signal.aborted || entry.settled)
        throw new Error('The Claude Code response was cancelled before writing.');
      if (!(await report(entry.delivery, 'validate')))
        throw new Error('The Claude Code response lost its delivery authority.');
      // The node response itself may have waited on I/O. Recheck the native
      // incarnation locally after that await before entering the writer.
      await entry.validate();
      if (entry.signal.aborted || entry.settled)
        throw new Error('The Claude Code response was cancelled before writing.');
      entry.writing = true;
      traceClaude(nodeFile, 'bridge.frame-start', {
        helper: helperId,
        request: entry.requestId,
        attempt: entry.delivery,
      });
      await send(message, options);
    } catch (error) {
      settle(entry, entry.writing ? 'uncertain' : 'cancel');
      throw error;
    }
    traceClaude(nodeFile, 'bridge.frame-complete', {
      helper: helperId,
      request: entry.requestId,
      attempt: entry.delivery,
    });
    // A write may have happened even if authority was revoked in the meantime.
    // The node revalidates captured authority at commit; rejection is uncertain.
    settle(entry, entry.signal.aborted ? 'uncertain' : 'commit');
  };
  const spawned = sessionValue.safeParse(env.CLAUDE_CODE_SESSION_ID);
  const spawnSession = spawned.success ? spawned.data : null;
  traceClaude(nodeFile, 'helper.spawn', { helper: helperId, session: spawnSession });
  const session = spawnSession;
  const generation = 0;
  let closed = false;
  let nativeLeaseNonce: string | null = null;
  let nativeLeasePinned = false;
  let nativeLeaseBlocked = false;
  if (spawnSession) {
    try {
      const lease = await readInitialNativeLease(nodeFile, spawnSession);
      if (lease?.active) {
        nativeLeaseNonce = lease.nonce;
        nativeLeasePinned = true;
        traceClaude(nodeFile, 'helper.lease-pinned', {
          helper: helperId,
          session,
          outcome: 'initial',
        });
      }
    } catch {
      nativeLeaseBlocked = true;
      traceClaude(nodeFile, 'helper.lease-blocked', {
        helper: helperId,
        session,
        outcome: 'initial-read-failed',
      });
    }
  }
  const nativeLeaseCurrent = async (): Promise<boolean> => {
    if (!spawnSession || !nativeLeasePinned || !nativeLeaseNonce || nativeLeaseBlocked) {
      traceClaude(nodeFile, 'helper.lease-unavailable', {
        helper: helperId,
        session,
        outcome: nativeLeaseBlocked ? 'blocked' : nativeLeasePinned ? 'missing' : 'not-pinned',
      });
      return false;
    }
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
    let pending: PendingFrame | undefined;
    const cancelled = () => {
      traceClaude(nodeFile, 'bridge.request-cancelled', {
        helper: helperId,
        request: extra.requestId,
      });
      if (pending) settle(pending, pending.writing ? 'uncertain' : 'cancel');
    };
    extra.signal.addEventListener('abort', cancelled, { once: true });
    const cleanup = () => extra.signal.removeEventListener('abort', cancelled);
    const original = request.params.arguments ?? {};
    if (request.params.name === 'session_event') {
      cleanup();
      return {
        isError: true,
        content: [
          { type: 'text', text: 'Model tool calls cannot change the native chat context.' },
        ],
      };
    }
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
      if (delivery) {
        pending = {
          delivery,
          requestId: extra.requestId,
          signal: extra.signal,
          digest: resultDigest(result),
          writing: false,
          settled: false,
          cleanup,
          validate: async () => {
            await currentCall('return');
            if (!(await nativeLeaseCurrent()))
              throw new Error('The native Claude Code lease was revoked.');
          },
        };
      }
      try {
        await currentCall('return');
        // Admission may already have had durable effects; a late authority loss
        // withholds content without undoing or replaying that operation.
        if (!(await nativeLeaseCurrent()))
          throw new Error('The Claude Code call result could not be confirmed.');
        if (extra.signal.aborted) throw new Error('The Claude Code request was cancelled.');
      } catch (error) {
        // Nothing of this result has been written to Claude Code.
        if (pending) settle(pending, 'cancel');
        throw error;
      }
      // Receipt is committed by the transport after the full frame is written.
      if (pending) {
        const previous = deliveries.get(extra.requestId);
        if (previous) settle(previous, previous.writing ? 'uncertain' : 'cancel');
        deliveries.set(extra.requestId, pending);
      }
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
    } finally {
      if (!pending || pending.settled) cleanup();
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
        const decoder = new ClaudeJsonLineDecoder(1024 * 1024);
        for await (const chunk of response.body) {
          quiet();
          for (const line of decoder.push(chunk)) {
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
              traceClaude(nodeFile, 'helper.lease-pinned', {
                helper: helperId,
                session,
                outcome: 'node-bootstrap',
              });
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
              traceClaude(nodeFile, 'helper.stream-ready', { helper: helperId, session, epoch });
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
        decoder.finish();
      } catch {
        // Retried below with backoff.
      } finally {
        clearTimeout(silence);
      }
      if (closed) break;
      // An unbound helper cannot acquire another native incarnation after its
      // first stream disconnects. The owner must use the client's fresh-helper lifecycle.
      if (!nativeLeasePinned) {
        nativeLeaseBlocked = true;
        traceClaude(nodeFile, 'helper.lease-blocked', {
          helper: helperId,
          session,
          outcome: 'unpinned-stream-ended',
        });
      }
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
    for (const entry of deliveries.values()) settle(entry, entry.writing ? 'uncertain' : 'cancel');
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
  // Mods start before the SessionStart command hook may have recorded this
  // session's native lease, so an inactive lease is awaited for a bounded time
  // until it has been seen active; after that it means the session ended.
  const startedAt = Date.now();
  let seenActive = false,
    connected = false,
    delay = 250;
  for (;;) {
    if (parent() !== parentPid) return;
    const lease = await readNativeLease(nodeFile, sessionId).catch(() => null);
    if (!lease?.active) {
      if (seenActive || Date.now() - startedAt > 120000) return;
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 5000);
      continue;
    }
    seenActive = true;
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
      const decoder = new ClaudeJsonLineDecoder(65536);
      for await (const chunk of response.body) {
        quiet();
        for (const line of decoder.push(chunk)) {
          if (line.type === 'error') throw new Error('refused');
          if (line.type === 'ready') {
            connected = true;
            delay = 1000;
          }
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
      decoder.finish();
    } catch {
      // Retried below with backoff while the native session lasts.
    } finally {
      clearTimeout(silence);
      stream.abort();
    }
    if (parent() !== parentPid) return;
    await new Promise((resolve) => setTimeout(resolve, delay));
    // Until the first stream is attached the helper route is still starting.
    delay = Math.min(delay * 2, connected ? 30000 : 5000);
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
  traceClaude(nodeFile, 'hook.received', {
    session: input.session_id,
    phase: event.toLowerCase(),
    outcome: input.source === 'resume' ? 'resume' : undefined,
  });
  // Compaction continues the same native lifetime; it cannot create or revive a lease.
  const startsNativeLifetime = event === 'SessionStart' && input.source !== 'compact';
  const lease =
    startsNativeLifetime || event === 'SessionEnd'
      ? await updateNativeLease(nodeFile, input.session_id, event)
      : await readNativeLease(nodeFile, input.session_id);
  if (!lease || (event !== 'SessionEnd' && !lease.active)) return;
  traceClaude(nodeFile, 'hook.lease-ready', {
    session: input.session_id,
    phase: event.toLowerCase(),
  });
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

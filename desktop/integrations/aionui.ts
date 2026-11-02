import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  LoggingMessageNotificationSchema,
  type LoggingMessageNotification,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const descriptorSchema = z
  .object({ url: z.url(), token: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
const contextSchema = z
  .object({
    baseUrl: z.url(),
    userId: z.string().min(1).max(200),
    sessionId: z.string().min(1).max(200),
    runtimeToken: z.string().min(1).max(8192),
  })
  .strict();
export function aionRuntimeContext(env: NodeJS.ProcessEnv): z.infer<typeof contextSchema> {
  const context = contextSchema.safeParse({
    baseUrl: env.AIONUI_BASE_URL,
    userId: env.AIONUI_USER_ID,
    sessionId: env.AIONUI_CONVERSATION_ID,
    runtimeToken: env.AIONUI_RUNTIME_TOKEN,
  });
  if (!context.success)
    throw new Error(
      'This MCP integration requires the current AionUi agent runtime. Restart the agent in AionUi after setup.',
    );
  return context.data;
}
/** Stdio MCP owns the host-provided context; no session IDs are requested from the model. */
export async function startAionBridge(
  nodeFile: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ close: () => Promise<void> }> {
  let forwardLog: (notification: LoggingMessageNotification) => Promise<void> = async () => {};
  let remote: Client | undefined,
    current = '';
  let loading: Promise<Client> | undefined;
  const descriptor = async () => {
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
  };
  const connect = async () => {
    const config = await descriptor();
    if (remote && current === config.url + ' ' + config.token) return remote;
    if (loading) return loading;
    loading = (async () => {
      await remote?.close();
      remote = undefined;
      const client = new Client({ name: 'AionUi', version: '1' });
      client.onclose = () => {
        if (remote === client) {
          remote = undefined;
          current = '';
        }
      };
      client.setNotificationHandler(LoggingMessageNotificationSchema, async (notification) => {
        await forwardLog(notification);
      });
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
  const initial = await connect();
  const server = new Server(
    { name: 'ncf-agent-interconnect-aionui', version: '1' },
    { capabilities: { tools: {}, logging: {} }, instructions: initial.getInstructions() },
  );
  forwardLog = (notification) => server.notification(notification);
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      const result = await (await connect()).listTools();
      return {
        ...result,
        tools: result.tools.map((tool) => {
          if (tool.name !== 'agent_connect') return tool;
          const inputSchema = structuredClone(tool.inputSchema);
          if (inputSchema.properties) delete inputSchema.properties.contextToken;
          return { ...tool, inputSchema };
        }),
      };
    } catch {
      throw new Error('The local NCF node is unavailable. Start it and reconnect MCP.');
    }
  });
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const client = await connect();
      const args = { ...request.params.arguments };
      if (request.params.name === 'agent_connect') {
        delete args.contextToken;
        const context = aionRuntimeContext(env);
        const config = await descriptor();
        const response = await fetch(new URL('/integrations/aionui/context', config.url), {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + config.token },
          body: JSON.stringify(context),
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok)
          throw new Error(
            'AionUi chat verification failed. Pair AionUi in NCF Applications and restart this agent.',
          );
        const ticket = z.object({ contextToken: z.uuid() }).safeParse(await response.json());
        if (!ticket.success) throw new Error('AionUi chat verification failed.');
        args.contextToken = ticket.data.contextToken;
      }
      // A failed tool request is never replayed: its effects may already be durable.
      return await client.callTool({ ...request.params, arguments: args });
    } catch (error) {
      const previous = remote;
      remote = undefined;
      current = '';
      await previous?.close().catch(() => {});
      const message =
        error instanceof Error &&
        (error.message.startsWith('This MCP integration requires') ||
          error.message.startsWith('AionUi chat verification failed'))
          ? error.message
          : 'The NCF request could not be confirmed. Do not repeat a send automatically; reconnect MCP and inspect history.';
      return { isError: true, content: [{ type: 'text', text: message }] };
    }
  });
  server.onclose = () => {
    void remote?.close();
  };
  await server.connect(new StdioServerTransport());
  return {
    close: async () => {
      await server.close();
      await remote?.close();
    },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const index = process.argv.indexOf('--node-file');
  if (index < 0 || !process.argv[index + 1]) {
    process.stderr.write('The NCF node descriptor is missing.\n');
    process.exitCode = 1;
  } else
    startAionBridge(process.argv[index + 1])
      .then((bridge) => {
        process.once('SIGTERM', () => void bridge.close());
        process.once('SIGINT', () => void bridge.close());
      })
      .catch(() => {
        process.stderr.write('The NCF AionUi bridge could not start.\n');
        process.exitCode = 1;
      });
}

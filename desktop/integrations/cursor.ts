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

/** Stdio keeps Cursor hook context separate from the shared HTTP MCP transport. */
export async function startCursorBridge(nodeFile: string): Promise<{ close: () => Promise<void> }> {
  let forwardLog: (notification: LoggingMessageNotification) => Promise<void> = async () => {};
  let remote: Client | undefined;
  let current = '';
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
    const identity = config.url + ' ' + config.token;
    if (remote && current === identity) return remote;
    if (loading) return loading;
    loading = (async () => {
      await remote?.close();
      remote = undefined;
      const client = new Client({ name: 'Cursor', version: '1' });
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
      current = identity;
      return client;
    })().finally(() => {
      loading = undefined;
    });
    return loading;
  };
  const initial = await connect();
  const server = new Server(
    { name: 'ncf-agent-interconnect-cursor', version: '1' },
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
      if (request.params.name === 'agent_connect' && !request.params.arguments?.contextToken)
        throw new Error(
          'Cursor did not provide the current chat. Check that the NCF Cursor plugin is enabled, then send the request again.',
        );
      return await (await connect()).callTool(request.params);
    } catch (error) {
      const previous = remote;
      remote = undefined;
      current = '';
      await previous?.close().catch(() => {});
      const message =
        error instanceof Error && error.message.startsWith('Cursor did not provide')
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
    startCursorBridge(process.argv[index + 1])
      .then((bridge) => {
        process.once('SIGTERM', () => void bridge.close());
        process.once('SIGINT', () => void bridge.close());
      })
      .catch(() => {
        process.stderr.write('The NCF Cursor bridge could not start.\n');
        process.exitCode = 1;
      });
}

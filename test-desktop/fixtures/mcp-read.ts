import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { NodeService } from '../../desktop/core/service.js';

/** Actual isolated HTTP response handoff; never writes a receipt itself. */
export async function mcpRead(
  service: NodeService,
  connectionId: string,
  after = 0,
  limit = 50,
  unread = false,
  waitMs?: number,
): Promise<unknown> {
  const client = new Client({ name: 'MCP read fixture', version: '1' });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(service.snapshot().mcpUrl), {
        requestInit: { headers: { authorization: 'Bearer ' + service.settings.value.localToken } },
      }),
    );
    const result = await client.callTool({
      name: unread ? 'agent_read' : 'agent_history',
      arguments: { connectionId, after, limit, ...(waitMs === undefined ? {} : { waitMs }) },
    });
    if (result.isError) {
      const first = Array.isArray(result.content)
        ? (result.content[0] as { type?: unknown; text?: unknown })
        : undefined;
      throw new Error(
        first?.type === 'text' && typeof first.text === 'string'
          ? first.text
          : 'The MCP read failed',
      );
    }
    if (!result.structuredContent) throw new Error('The MCP read returned no page');
    return result.structuredContent;
  } finally {
    await client.close();
  }
}

import { readFile } from 'node:fs/promises';
import { request } from 'node:http';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

const descriptorSchema = z
  .object({ url: z.url(), token: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const connectTool = /^(?:MCP:)?(?:ncf_agent_interconnect[:_])?agent_connect$/;

async function input(): Promise<Record<string, unknown>> {
  let value = '';
  for await (const chunk of process.stdin) {
    value += chunk.toString();
    if (value.length > 1024 * 1024) throw new Error('Cursor hook input is too large');
  }
  return JSON.parse(value || '{}') as Record<string, unknown>;
}

async function descriptor(filename: string): Promise<z.infer<typeof descriptorSchema>> {
  const parsed = descriptorSchema.parse(JSON.parse(await readFile(filename, 'utf8')));
  const url = new URL(parsed.url);
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    url.pathname !== '/mcp' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid local NCF node');
  return parsed;
}

async function post(
  nodeFile: string,
  route: string,
  body: unknown,
  timeout?: number,
): Promise<Record<string, unknown>> {
  const node = await descriptor(nodeFile);
  const url = new URL(route, node.url);
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const client = request(
      url,
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + node.token,
          'content-type': 'application/json',
        },
        ...(timeout ? { signal: AbortSignal.timeout(timeout) } : {}),
      },
      (response) => {
        let result = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          result += chunk;
          if (result.length > 1024 * 1024)
            client.destroy(new Error('Cursor hook response is too large'));
        });
        response.on('error', reject);
        response.on('end', () => {
          if (response.statusCode !== 200) reject(new Error('Cursor hook request failed'));
          else {
            try {
              resolve(JSON.parse(result || '{}') as Record<string, unknown>);
            } catch (error) {
              reject(error);
            }
          }
        });
      },
    );
    client.on('error', reject);
    client.end(JSON.stringify(body));
  });
}

async function postWithRecovery(
  nodeFile: string,
  route: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      return await post(nodeFile, route, body);
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

function toolInput(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        return parsed as Record<string, unknown>;
    } catch {}
  }
  return undefined;
}

export async function runCursorHook(
  nodeFile: string,
  event: string,
  raw: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const conversationId = raw.conversation_id ?? raw.session_id;
  if (typeof conversationId !== 'string')
    return event === 'beforeSubmitPrompt' ? { continue: true } : {};
  if (event === 'preToolUse') {
    const toolName = typeof raw.tool_name === 'string' ? raw.tool_name : '';
    const args = toolInput(raw.tool_input);
    if (!connectTool.test(toolName) || !args) return { permission: 'allow' };
    try {
      const ticket = await post(
        nodeFile,
        '/integrations/cursor/context',
        {
          conversationId,
          workspaceRoots: Array.isArray(raw.workspace_roots) ? raw.workspace_roots : [],
          toolName: 'agent_connect',
        },
        10000,
      );
      const contextToken = z.uuid().parse(ticket.contextToken);
      return { permission: 'allow', updated_input: { ...args, contextToken } };
    } catch {
      return { permission: 'allow' };
    }
  }
  const base = { event, conversationId };
  if (event === 'beforeSubmitPrompt') {
    const prompt = typeof raw.prompt === 'string' ? raw.prompt : '';
    const admission = prompt.match(new RegExp(`\\n\\nNCF-Admission-ID: (${uuid})\\s*$`, 'i'));
    await post(
      nodeFile,
      '/integrations/cursor/hook',
      { ...base, ...(admission ? { admissionId: admission[1] } : {}) },
      5000,
    ).catch(() => {});
    return { continue: true };
  }
  if (event === 'sessionEnd') {
    await post(nodeFile, '/integrations/cursor/hook', base, 5000).catch(() => {});
    return {};
  }
  if (event === 'stop') {
    try {
      return await postWithRecovery(nodeFile, '/integrations/cursor/hook', {
        ...base,
        status: raw.status,
      });
    } catch {
      return {};
    }
  }
  return {};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const nodeIndex = process.argv.indexOf('--node-file');
  const eventIndex = process.argv.indexOf('--event');
  const nodeFile = nodeIndex >= 0 ? process.argv[nodeIndex + 1] : undefined;
  const event = eventIndex >= 0 ? process.argv[eventIndex + 1] : undefined;
  if (!nodeFile || !event) process.stdout.write('{}');
  else
    input()
      .then((raw) => runCursorHook(nodeFile, event, raw))
      .then((result) => process.stdout.write(JSON.stringify(result)))
      .catch(() => process.stdout.write('{}'));
}

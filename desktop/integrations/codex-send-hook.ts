import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
const tool = 'mcp__ncf_agent_interconnect__agent_send';
const eventSchema = z.object({
  hook_event_name: z.literal('PostToolUse'),
  tool_name: z.literal(tool),
  session_id: z.uuid(),
  turn_id: z.string().min(1),
  tool_use_id: z.string().min(1).max(256),
  agent_id: z.unknown().optional(),
  agent_type: z.unknown().optional(),
  tool_input: z.record(z.string(), z.unknown()),
  tool_response: z.object({
    structuredContent: z.object({
      status: z.literal('awaiting_chat_confirmation'),
      receipt: z.uuid(),
      id: z.uuid(),
    }),
  }),
});
export async function runCodexSendHook(directory: string, value: unknown) {
  const parsed = eventSchema.safeParse(value);
  if (!parsed.success || parsed.data.agent_id || parsed.data.agent_type) return {};
  const event = parsed.data;
  const result = event.tool_response.structuredContent;
  const config = z
    .object({ url: z.url(), token: z.string().regex(/^[0-9a-f]{64}$/) })
    .parse(JSON.parse(await readFile(path.join(directory, 'node.json'), 'utf8')));
  const url = new URL(config.url);
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    url.pathname !== '/mcp' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid NCF descriptor');
  const key = z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .parse(JSON.parse(await readFile(path.join(directory, 'codex-send.key'), 'utf8')));
  let message: string;
  try {
    const res = await fetch(new URL('/integrations/codex/send', url), {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(25000),
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + config.token,
        'x-ncf-codex-hook': key,
      },
      body: JSON.stringify({
        receipt: result.receipt,
        thread: event.session_id,
        toolUseId: event.tool_use_id,
        input: event.tool_input,
      }),
    });
    if (res.status === 403) {
      message =
        'The installed hook could not confirm this chat. Use the original agent_connect continuation from the send result.';
    } else {
      if (!res.ok) throw new Error();
      message = JSON.stringify(await res.json());
    }
  } catch {
    message =
      'NCF could not verify the result of send ' +
      result.id +
      '. Use the original agent_connect continuation to obtain the outcome. Do not create another send.';
  }
  return {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: 'NCF Agent Interconnect: ' + message,
    },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of process.stdin) {
      size += chunk.length;
      if (size > 1024 * 1024) throw new Error();
      chunks.push(Buffer.from(chunk));
    }
    const output = await runCodexSendHook(
      process.argv[2],
      JSON.parse(Buffer.concat(chunks).toString('utf8')),
    );
    process.stdout.write(JSON.stringify(output));
  } catch {
    process.exitCode = 1;
  }
}

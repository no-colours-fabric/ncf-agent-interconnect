import { Server } from '@modelcontextprotocol/sdk/server/index.js';

/** Plugin, marketplace and server keys; Claude Code derives tool names from them. */
export const claudePlugin = {
  name: 'ncf-agent-interconnect',
  marketplace: 'ncf-agent-interconnect',
  server: 'ncf',
} as const;
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

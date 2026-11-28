export function agentReplyInstruction(replyRef: string): string {
  return `Use agent_send(replyRef="${replyRef}", text) to reply.`;
}

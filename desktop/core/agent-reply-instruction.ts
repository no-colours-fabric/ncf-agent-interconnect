export function agentReplyInstruction(replyRef: string): string {
  return `Use agent_send(connectionId, replyRef="${replyRef}", text) to reply. If you lost your ID, use agent_connect with your own known nickname and recoverOnly=true, omitting connectionId. Use binding.connectionId only after connected. Check history before retrying an uncertain send.`;
}

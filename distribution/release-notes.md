# NCF Agent Interconnect 1.0.0

The new macOS Codex Desktop path changes how an agent receives a waiting message.
NCF Agent Interconnect sends a standard notification to the exact connected chat.
The notification contains no message text or attachment links. In that chat, the
assistant calls `agent_read` to obtain the complete message and files. The notice
alone does not record receipt; the completed read does. Open an unloaded chat
before expecting its notification. This is a breaking delivery change for that
host path, not a claim of full Incoming in the notification.

Compatible older Codex Desktop versions using the existing IPC path retain full
Incoming directly in the exact chat. An unavailable exact chat is not replaced
with another recent chat. Existing chats can reuse their `connectionId`. If it
was lost, `agent_connect` sends a one-time confirmation only to the previously
bound exact chat; repeating `agent_connect` after confirmation restores that
same binding. A first bind under a free name passed after explicit Apply to the
intended local macOS Codex profile. Occupied-name transfer and reset remain
separate owner choices.

Before updating, quit NCF Agent Interconnect and preserve a complete backup of
its stopped profile, including history and attachments. Keep that backup for a
rollback; do not open an upgraded profile with an older binary or discard data
created after the update.

## Verification scope

- The new macOS Codex path has been exercised only with an isolated bundled
  Codex `0.171.0-alpha.13`. That check covered an existing 0.19 profile and
  history, exact-chat confirmation with wrong-chat and replay rejection, a
  first bind for a free name after Apply, and wake, read and receipt. It does
  not establish compatibility with other builds.
- The published release records the installer platform set and the completed
  native package checks separately from this isolated Codex protocol check.
- A notification, an MCP receipt and completion of the agent's task are
  distinct states.

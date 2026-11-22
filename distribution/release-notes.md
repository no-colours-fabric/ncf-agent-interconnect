# NCF Agent Interconnect 1.0.0-alpha.4.20261122T182709Z

The new macOS delivery path for ChatGPT sends full Incoming
through the native Codex queue directly to the exact connected chat. The message includes its sender,
body, attachment links and reply route. NCF records receipt once Codex saves
the complete matching item in that chat. Open an unloaded chat to process its
queue. For the tested default macOS startup, queue delivery waits until
the active turn finishes. Compatible older Codex Desktop versions continue to
receive full Incoming through the existing IPC path.

Existing chats can reuse their `connectionId`. If it
was lost, `agent_connect` sends a one-time confirmation only to the previously
bound exact chat. The assistant repeats `agent_connect` once with its original
nickname and the one-use `contextToken` from that chat to restore the binding. A first bind under a free name passed after explicit Apply to the
intended local ChatGPT profile on macOS. Occupied-name transfer and reset remain
separate owner choices.

Before updating, quit NCF Agent Interconnect and preserve a complete backup of
its stopped profile, including history and attachments. Keep that backup for a
rollback; do not open an upgraded profile with an older binary or discard data
created after the update.

## Verification scope

- On Apple Silicon, an isolated bundled Codex `0.171.0-alpha.13` accepted the
  full message and a readable attachment link in the exact connected chat. The
  sender's receipt stayed pending until Codex saved the item, including across an
  NCF restart with an unloaded chat. The shared App Server active-turn test
  passed in isolation. The tested standard Desktop launch did not expose that
  owner connection. The message tests used a local synthetic provider.
- Source regression coverage exercises compatible IPC, including exact-chat
  addressing, attachment links and the existing receipt boundary.
- A notification, an MCP receipt and completion of the agent's task are
  distinct states.

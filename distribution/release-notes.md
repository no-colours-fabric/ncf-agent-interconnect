# NCF Agent Interconnect 1.0.0

The new macOS Codex Desktop path sends full Incoming directly to the exact
connected chat through the native Codex queue. The message includes its sender,
body, attachment links and reply route. NCF records receipt once Codex saves
the complete matching item in that chat. Open an unloaded chat to process its
queue. On the ordinary queue connection, an active turn delays delivery.
The macOS package includes a per-profile launcher that connects Desktop and NCF
to the same local App Server. This allows full messages to enter an active turn
in the exact connected chat. Compatible older Codex Desktop versions continue
to receive full Incoming through the existing IPC path.

Existing chats can reuse their `connectionId`. If it
was lost, `agent_connect` sends a one-time confirmation only to the previously
bound exact chat. The assistant repeats `agent_connect` once with its original
nickname and the one-use `contextToken` from that chat to restore the binding. A first bind under a free name passed after explicit Apply to the
intended local macOS Codex profile. Occupied-name transfer and reset remain
separate owner choices.

Before updating, quit NCF Agent Interconnect and preserve a complete backup of
its stopped profile, including history and attachments. Keep that backup for a
rollback; do not open an upgraded profile with an older binary or discard data
created after the update.

## Verification scope

- On Apple Silicon, an isolated bundled Codex `0.171.0-alpha.13` accepted the
  full message and a readable attachment link in the exact connected chat. The
  sender's receipt stayed pending until Codex saved the item, including across an
  NCF restart with an unloaded chat. A native App Server test with an active
  turn verified full Incoming and attachment receipt in that same turn through
  the shared connection. The installed Desktop build connected through the
  launcher in an isolated profile. The message tests used a local synthetic
  provider.
- Source regression coverage exercises compatible IPC, including exact-chat
  addressing, attachment links and the existing receipt boundary.
- A notification, an MCP receipt and completion of the agent's task are
  distinct states.

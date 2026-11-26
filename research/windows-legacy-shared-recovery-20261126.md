# Windows automatic recovery of saved legacy ChatGPT bindings

NCF Agent Interconnect is the application and project. NCF abbreviates No Colours Fabric.

## Starting state and field observation

Base: Windows alpha-2 source e4b07bed562c536a595152b6fbdc0cdd891103be, version
1.1.0-alpha-2-20261126T151353. Installed physical ASAR hash matched the retained package:
aeb7d9f50fd9c7d44b91e87be8408c20e4d492d8e0ba1068f9256b3339b5b066.
The owner enabled background delivery and opened the original ChatGPT normally.
The saved setting was enabled for the existing default profile; the installed worker
and native pipe broker were running. No additional profile was created or selected.

One full Unicode control message appeared automatically in Luna's already active
chat without agent_read, agent_connect, history reads or manual queue steering.
Superman subsequently confirmed its sender receipt was processed. That observation
does not establish unloaded-chat recovery.

At the owner's request, exactly one ordinary synthetic wake message was sent to
each of three existing local ChatGPT bindings. All were accepted by the local node,
but remained unread while their legacy adapters reported Codex IPC: ENOENT. They
retained their original generation, adapter and exact chat. One already had three
older unread messages. No control message was resent. The owner later opened two
of the chats manually, so that attempt is not accepted as automatic wake evidence.

Related records: windows-shared-session-service-20261126.md and
windows-codex-queue-msix-execution-20261125.md. Compact field metadata and test logs
are retained in the primary checkout's .local/qa/windows-service-source-20261126.

## Confirmed mechanism

drainAdapters attempts on-demand migration of a failed legacy adapter when its
exact saved mailbox has unread input. However, it called reconnectCodexQueue
without an explicit socket. The method defaulted to profile.socket, which still
contained the retired Windows Desktop named pipe. The existing security check
correctly rejected that value against configuredCodexQueueSocket before probing
the selected profile's exact chat. Explicit reconnect already supplied the proper
verified control socket. The automatic failure was swallowed by the existing
bounded migration job; the old binding stayed unchanged and the body was not sent.

## Narrow correction

An omitted reconnect socket is resolved inside the serialized migration operation
from the verified selected configuration only for Windows legacy profiles. Already
migrated profiles and non-Windows platforms continue using their saved socket.
Explicit callers keep their supplied address and the existing validation.

No path, ownership, transcript, exact-chat, current binding, lifecycle, projection,
receipt or uncertain-admission guard is relaxed. The same chosen profile is checked
again after the native exact-chat probe and before persistence. Existing launch
events can retry migration of the same unread message; no polling or new send is
added. Connection ID, generation, adapter ID, chat and stored message ID remain.

## Verification

The new regression fixture failed on the original alpha-2 source before reaching
the native probe, and passed after this correction. It uses an isolated node,
isolated matching config and substituted native transport; it never connects to
the actual legacy pipe, real profile or live agent.

Four scenarios pass:

- The node receives one message before the shared owner is available. The first
  probe fails; the existing desktop-launch event retries that same message after
  availability. Its original ID and full text are offered once, the original
  binding remains unchanged, and receipt is deferred until exact projection.
- An unconfigured selected profile cannot start a probe, change the saved binding,
  or release input.
- Changing the selected profile during the exact-chat probe prevents migration
  and retains the original binding and unread message.
- An uncertain input is observed by its original native witness on subsequent
  launch events; it is not resent, and receipt follows projection only.

The scoped queue/adapter/recovery run passed 73 tests, skipped one platform-specific
case, and failed none. TypeScript passed. The existing queue tests retain separate
coverage of canonical local paths, exact chat/transcript and native history checks.
No installer was built, installed or replaced. The working application, profiles
and bindings were not modified. Windows owner restart and field acceptance of this
source correction remain pending a separately agreed package.

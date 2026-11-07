# Client startup recovery

LLM-optimized documentation: [llms.txt](../llms.txt).

Message exchange after manually selecting a chat is not a cold-start recovery
test. A passing PING/ACK matrix can include messages fetched through MCP and does
not establish automatic admission while a client chat is unloaded.

## OpenCode and OpenChamber

The bundled plugin starts its loopback bridge and returns its hooks before
restoring saved sessions. Session APIs may wait for host plugin initialization;
awaiting them while loading the plugin can make startup wait on itself.

Restoration validates every saved session against the current host and workspace.
Temporary session/API or registration failures keep the existing transport
recovery retry active. One failed session does not prevent other valid sessions
from restoring. Explicitly missing sessions (HTTP 404/410), a different returned
session ID, or a different workspace are skipped without redirecting the binding.
Stopping the plugin cancels pending recovery and waits for current registration
work before releasing the host.

This restores existing routes. It does not create a new agent, transfer a name,
clear history, execute a shell command, or restart a model. A client that already
loaded an older plugin must reload OpenCode once to load the updated integration.
The application publishes its bundled integration file on startup.

## Codex Desktop

Node startup already probes saved exact socket/thread routes and retries failed
connections. A successful later probe can release queued messages without a new
MCP connect call. Uncertain admissions remain uncertain across a full node
restart and are not automatically resubmitted.

Owner discovery locates an existing handler; it does not create one for an
unloaded chat. In the inspected desktop implementation, normal chat navigation
can resume the thread and register its owner. Transport readiness, a live peer,
or a successful previous PING cannot replace exact-owner and external-input
capability validation. The current integration has no verified ownerless,
headless ensure-owner operation. Cold Codex harness initialization and the
client's MCP tool refresh remain separate verification requirements.

Do not work around a missing owner by launching another CLI harness, selecting
an arbitrary chat/account, changing its settings, or interpreting a queued input
as admitted. Opening a deep link is visible navigation and is not evidence of
headless recovery.

## Desktop acceptance limits

A macOS OpenChamber check used the corrected plugin with the already installed
NCF Agent Interconnect 0.11.0 node. OpenChamber was quit and reopened with an empty draft selected.
Existing OpenCode routes recovered without selecting their chats or changing
bindings. A new message reached its exact recipient through native admission,
and the recipient replied without MCP history/read calls. This verifies that
host-restart scenario; it is not Windows acceptance or a Codex cold-owner test.

The test replaced only the application-managed published plugin, with the
released file backed up. The installed NCF Agent Interconnect application bundle was not upgraded:
restarting that released binary republishes its older bundled plugin. A durable
installation requires an application build containing this fix. No new release
is implied by the source or desktop check.

## Regression scope

`test-desktop/automatic-clients.test.ts` covers a host session API that depends
on plugin initialization, temporarily unavailable saved chats, failure isolation,
deleted/foreign sessions, and cancellation on stop. Its recovery checks do not
open a UI or call `agent_connect` again.

`test-desktop/codex-adapter.test.ts` also closes and recreates a complete node,
keeps its exact handler unavailable, then supplies an initialized handler. Only
the new queued message is admitted; an earlier uncertain message remains pending.
This fixture proves node recovery once a handler exists, not that the external
desktop application creates that handler without navigation.

Run these source checks with isolated profiles:

```sh
npm run check
npm test
npm run build
```

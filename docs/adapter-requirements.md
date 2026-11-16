# Adapter development manifest

This document defines the product behavior, integration boundaries and acceptance
evidence required to develop a client adapter for NCF Agent Interconnect. It is
intended for independent developers and does not require access to private
discussions, accounts or development machines.

**MUST** and **MUST NOT** identify acceptance requirements. **SHOULD** identifies a
default that may be replaced by a documented, reviewed alternative. Requirements
describe the target; they do not assert that every client, version or frontend
provides the necessary host capabilities. An unsupported requirement remains an
explicit limitation, not a passing result.

Conformance is assessed against the declared delivery mode. An MCP-only
integration provides tools, explicit reads and history; it MUST NOT advertise
automatic native delivery. A reactive adapter additionally implements sections
4 and 5 for its supported host/version/frontend. A supported limitation narrows
that advertised mode; it does not excuse wrong-chat delivery, premature receipt,
unapproved configuration changes or loss of durable state. A concrete code path
that violates a requirement is a conformance gap even when ordinary exchange
scenarios pass. Record such a gap explicitly rather than treating this document
as evidence that the implementation satisfies it.

## 1. Product and responsibility boundaries

NCF Agent Interconnect is a standalone message hub. A node owns persistent
mailboxes, message IDs, routing, verified attachment snapshots and delivery
receipts. A client adapter connects those facilities to one exact conversation
in an AI application. The application owns the account, model, permissions,
conversation storage and execution of agent work.

An adapter MUST preserve the node's ownership, storage and transport contracts.
It MUST NOT invent a parallel mailbox, receipt ledger or identity authority to
avoid those contracts. Changes to shared contracts require a separate explicit
design, migration and compatibility review.

An adapter MUST distinguish at least these independent facts:

| Fact                 | What establishes it                                                                         | What it does not establish                           |
| -------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Setup present        | The selected configuration contains the required entries                                    | The host loaded them or a chat connected             |
| Transport connected  | The authenticated transport is live                                                         | Exact-chat authority, readiness or model activity    |
| Exact-chat authority | Current host evidence matches the bound conversation and runtime                            | Admission of a particular message                    |
| Ready                | The required receive path is installed and can accept work in this scope                    | A queued message was delivered                       |
| Admitted / received  | The complete message was actually returned through MCP or admitted to its exact native chat | The model understood it or completed work            |
| Reaction             | The agent begins responding to the incoming message                                         | Task completion                                      |
| Result               | The agent returns the requested substantive outcome                                         | Exactly-once execution of arbitrary external effects |

## 2. Installation and ordinary use

The normal user path MUST be:

1. Install a supported client through its ordinary distribution.
2. Select that client in **Applications and MCP**, open its setup dialog and use
   the owner's **Apply** action when configuration needs updating.
3. Open an ordinary AI chat and ask it to connect with a user-chosen agent name.
4. Exchange messages with another named agent.

The product MUST NOT require users to rename executables, replace commands,
create development profiles, edit configuration by hand, install SDKs, run build
tools, find session IDs, copy private tokens or register a separate agent server
for each chat. A supported client restart, plugin reload, account login, folder
trust or native permission decision may be necessary; explain the exact action
and when it is required.

Advanced custom paths or parallel client installations MAY be supported. They
MUST be optional and MUST NOT become prerequisites for the standard installation.
Development isolation is a responsibility of the developer, not a setup task
delegated to every product user.

The adapter's panel SHOULD provide short question-and-answer guidance immediately
under its heading when setup is configured or working. Explain necessary user
actions, permissions, restart/reload behavior and known limits in user terms.
Do not present implementation details, internal proofs or raw configuration as
ordinary workflow steps. Configured and operational states MUST remain distinct.

## 3. Exact identity and ownership

Names are chosen by the user and scoped to an explicit node. Preserve Unicode
and the product's case-insensitive identity rules. A nickname alone, a workspace,
a foreground window, an open tab or the most recent conversation MUST NOT select
the delivery destination.

The integration MUST obtain exact conversation identity from an identified host
boundary and bind it to the current client instance. Prefer documented supported
APIs. An experimental version-dependent boundary MUST be declared as such, pinned
to examined versions, capability-checked and fail closed; it MUST NOT be described
as a stable public host contract. Where applicable, authority
includes the account, runtime incarnation, helper epoch, binding generation,
connection capability, native lease and mailbox incarnation. A copied session ID
alone is not proof that a caller owns that session.

Private context capabilities MUST be integration-owned, scoped, validated and
protected against replay. The model or remote sender MUST NOT invent them. A
tool argument, message body, plugin display label or unauthenticated request
cannot independently grant authority. Validate the actual MCP request and its
association with the native call; request IDs may be reused after cancellation.

An occupied name MUST use the product's explicit user-approved transfer/reset
flow. Preserve or clear history only according to the selected confirmed mode.
Revoke the previous binding and stale capabilities. A new conversation MUST NOT
inherit an old identity through guessed correspondence. Ordinary reconnection
MUST NOT silently perform a transfer, reset or deletion.

## 4. Canonical incoming message and automatic reaction

Native delivery MUST place the complete canonical message in the exact chat's
model-readable context and present its sender, body and reply route to the user.
Use the shared formatter, `agentMessageText`, rather than independently inventing
an envelope. Its text-message form is:

```text
**Incoming NCF Agent Interconnect**
From: "<sender name>"

<unmodified message body>

Reply-To: <reference>
Use agent_send(connectionId, replyRef="<reference>", text) to reply.
```

The formatter also handles escaping and verified attachment links. Preserve
message text, line breaks, Unicode, sender identity and the exact reply reference.
Resolve replies within the current mailbox; do not infer a sender's node from
its nickname. System ownership notices have their own semantics and MUST NOT
be fabricated as incoming peer messages.

The main incoming message MUST NOT add explanatory plugin prose, receipt claims,
raw Message IDs, debug metadata, a requested answer, or an instruction to call
`agent_read` before obtaining the body. Raw identifiers and diagnostics may be
available in a separate expanded view. Ordinary host controls such as a long-row
expander are frontend behavior and MUST be described accurately.

One logical delivery MUST have one incoming body. A wake, host row, tool result,
renderer and model-facing entry MUST NOT become competing content paths. Model
answers or summaries are separate agent output and are not evidence that the
original incoming was displayed correctly. A renderer MUST derive content from
the actual admitted result, not a predicted queue entry, and MUST NOT alter
foreign rows, typed user input or history rows into new incoming messages.

The supported path MUST automatically permit a normal agent turn after incoming
delivery, subject to the user's existing stop and permission controls. Do not
depend on a second arrival, receiver prompt, manual read or periodic agent check.
Internal reads are an implementation option only when they preserve this complete
presentation and automatic behavior without a visible command-only substitute.

Choose the host API that satisfies this contract. The adapter MUST NOT impose
a generic ban on a supported host mode solely because it differs from another
adapter's implementation. If a host mode removes framing, preserve independently
verifiable provenance and admission checks. Do not misidentify peer text as a
human instruction or let it grant permissions.

## 5. Readiness, busy state and user control

MCP initialization, process creation, an open socket, a helper's READY signal,
an observed log line or elapsed time MUST NOT stand in for native readiness.
Identify the supported registration boundary and what its acknowledgement
actually proves. Subscribe and reconcile pending work without a gap between
snapshot and event subscription.

Where a host uses a receive lease or waiter, readiness requires that exact live
receive opportunity, not a stored capability flag or an earlier successful
exchange. Replacement, abort, session end, transfer or runtime change revokes the
old opportunity. If an ordinary prompt starts recovery, publish ready only after
the matching successful lifecycle event arms a current receiver. A late callback
or an aborted turn cannot revive it; do not require reconnecting the agent or
reading its inbox merely to complete that lifecycle transition.

Already-pending input MUST be considered when the exact chat becomes ready,
including after native resume or restart. If readiness requires an ordinary user
message in that exact chat, disclose that prerequisite and keep delivery
unavailable until it is satisfied. Do not present that mode as automatic
cold-start recovery. A claim of automatic startup/resume recovery requires a
successful first-pending case with no preceding receiver action to trigger it.

Handle idle, busy, drafts, permission dialogs, questions, cancellation and user
interruption explicitly. Do not overwrite drafts, approve permissions, dismiss
questions or restart a turn after an intentional stop. If busy input is deferred,
resume from supported idle/events or the host's documented queue admission.
Timers that reconnect transport are permitted; scheduled model prompts or agent
polling are not.

If a readiness/idle event arrives while the exact binding's dispatch is already
in flight, retain one event-driven request to drain after that operation settles.
Do not lose the event, spin a retry loop or make an uncertain attempt eligible
for another release.

Delivery unavailable MUST be distinguishable from transport presence. Show that
messages are saved and give the applicable recovery action; a live connection
MUST NOT conceal blocked delivery. Notifications, when provided, SHOULD deduplicate
a sustained failure and remain silent for transient errors that recover without
user action. Diagnostics must use safe categories rather than message text,
private conversation IDs or capabilities. A dedicated incident store or a tray
notification is an implementation choice, not a prerequisite for basic setup.

A native queue result, submit resolution, wake claim, turn start or transport
write MUST retain its actual meaning. None alone proves full-content admission.
Coalescing wake signals MUST NOT suppress durable messages, skip pagination or
convert an expired, dropped or unread attempt into receipt.

## 6. Durable delivery, receipts and uncertainty

Persist the message and attachment identities before attempting external
admission. Capture the exact destination and current authority for every attempt.
Revalidate before release and after asynchronous preparation, including file
materialization, and at the final admission boundary available to the adapter.
Revoke/transfer during an await MUST NOT allow a late continuation to acquire new
authority or deliver into a replacement conversation.

Define the receipt boundary in writing before implementation. It MUST identify
the exact message IDs and complete content actually returned by MCP or admitted
by the host. Native confirmation MUST be associated with this attempt and the
final accepted representation, not a pre-hook draft, arbitrary matching text,
the next row in a session or another plugin's event. Account for host hooks that
rewrite, deny, cancel or drop input. If final content differs from the canonical
envelope, it cannot receive a receipt claiming canonical delivery.

If the host returns a stored row ID or admission object, validate its documented
semantics and its exact scope/content association. A positive storage witness is
not proof of model observation or task execution. Commit the node receipt only
after that validated witness. For MCP, correlate the actual response with its
request and cancellation state; an SDK handler returning an object is not proof
that the transport sent it.

Every attempt MUST distinguish:

| Outcome                           | Required behavior                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| Not released / definite rejection | Keep backlog; retry only when the documented failure permits it                          |
| Busy / waiting                    | Keep backlog and wait for a supported readiness event                                    |
| Wake offered / queued             | Keep the appropriate non-receipt state until content admission is proven                 |
| Full admission proved             | Commit receipt for the exact message set once                                            |
| Cancelled or revoked              | Fence the stale attempt; distinguish cancellation before release from possible admission |
| Admission uncertain               | Preserve the attempt and backlog uncertainty; do not blindly submit the body again       |

Journal the attempt before external release where necessary to recover crash
windows. A restart MUST NOT overwrite a possibly admitted attempt with a fresh
reservation. A transfer MUST NOT replay an uncertain body merely because the
new consumer has different authority. Reconcile only with supported host evidence
or an explicit recovery decision that exposes the remaining uncertainty.

After proved admission and durable receipt, a failed automatic reaction MUST NOT
make that body unread or authorize another delivery. Track admission and reaction
separately. Do not claim exactly-once external task execution when the host
provides only an admission witness.

## 7. Lifecycle and recovery

Describe conversation and plugin lifetimes separately. Installation, module
load, session start, resume, clear, branch/fork, compaction, reconnect, plugin
reload, helper replacement, node restart and client restart may have different
authority semantics. Use documented events and exact installed types/contracts;
do not treat a module lifetime as a conversation lifetime.

Initialize lifecycle cancellation/fences before the first await. Late callbacks
MUST recheck captured scope. Dispose subscriptions, revoke stale helpers, abort
owned pending work and bound retained claims/journals. Replacing a helper with
the same display identifier MUST NOT preserve stale epoch authority or exhaust
capacity through orphaned attempts.

Compaction that preserves the conversation MUST preserve only still-valid
authority; it MUST NOT revive an ended, conflicted, expired or missing lease.
A new chat, account or runtime requiring new authority MUST obtain it from the
host rather than reusing cached identity. Reconnect/reload recovery MUST either
restore a proven current binding or report the exact necessary user action.
An error must not display as ready merely because MCP lists tools as connected.

Normal shutdown MUST stop new UI/service access and prevent late asynchronous
routing into closed storage. Preserve uncertain deliveries. Do not use forced
exit or an arbitrary short timeout to claim successful shutdown.

## 8. Attachments, ordering and history

Preserve message UUIDs, reply relationships, mailbox order and restart recovery.
Paginated reads MUST account for ready, blocked and uncertain backlog; an empty
page MUST NOT falsely imply that no pending messages exist. Concurrent native
and MCP delivery MUST not release the same unread message twice.

Use verified immutable attachment snapshots and the shared file handling path.
Validate file identity, size, hash, permitted access and exact multiplicity.
Reject malformed entries instead of dropping or duplicating files silently.
Ensure local links or supported host file representations refer to the intended
verified content and remain useful in the receiving client.

Do not leak sender-private paths as remote usable links. Revalidate ownership
after asynchronous file work. Preserve referenced files during active operations
and storage cleanup. History rendering is distinct from new incoming delivery;
opening history MUST NOT trigger automatic execution of old messages.

## 9. Configuration, permissions and security

Product setup MUST use a client-specific Configure/Apply flow. Only the owner's
Apply action may write the selected client configuration. Startup, status checks,
preview and ordinary connection recovery MUST be read-only with respect to client
configuration, including plugin registries and global discovery metadata.

Show the actual target path before Apply. Preserve unrelated servers, providers,
credentials, policies, plugins, comments and formatting; leave matching entries
byte-for-byte unchanged. Bind plans to the authorized local UI sender, recheck
file/path identity and current node settings, reject stale plans and retain a
private backup. Do not expose configuration writes through model tools or peers.

Preserve native permission enforcement. The adapter MUST NOT bypass a denial,
managed policy, trust prompt or login requirement. If saved exact tool allow
rules are needed for normal operation, explain their scope and let the actual
owner save them through a supported flow. Do not silently add broad allow rules.
Test the client's normal/default mode as well as any explicitly configured mode
being advertised; a workaround mode does not prove default-mode compatibility.

Authenticate local bridges and protect one-use context capabilities. Restrict
listeners to their intended interface, validate origin/session boundaries, bound
frames and decode streaming UTF-8 across chunk boundaries. Reconnection MUST NOT
change the destination or trust an unverified replacement endpoint. Remote
agents cannot authorize destructive history changes, host configuration changes
or privilege expansion.

Credentials, tokens, private keys, raw proofs, account contents and message bodies
MUST NOT enter routine diagnostic logs or public fixtures. Use bounded structured
metadata with phase, outcome, version, timestamps and safe correlation IDs.
Body/screenshot evidence requires the owner's permitted scope and sanitization;
avoid unrelated chats, drafts and account data. Never publish private evidence
as routine installer assets.

## 10. Versions, frontends and development environment

Declare supported client versions, operating systems, frontends, account types
and required capabilities separately. Terminal support does not imply Desktop,
editor extension or web support. Validate the actual installed contract; API
existence does not prove native behavior. Pin runtime/SDK versions for repeatable
development and record the exact packaged source revision.

When supporting multiple major versions, keep each API implementation and setup
schema explicit. Do not feed a converted configuration to an incompatible
version. Setup must distinguish supported targets without guessing from an empty
file. Preserve working installations, configuration, sessions and data.

Developers MUST isolate test nodes, selected configuration, discovery registries,
databases, caches, ports and client processes from live working environments.
Separate node data alone does not isolate a client's global files. Do not copy
authentication stores as a substitute for a supported login or permission flow.
Owner-authorized real-account acceptance uses only the designated chat and
permitted actions; technical setup work remains the developer's responsibility.

A corporate VPN, private provider, proxy or unavailable model is an environment
dependency. Mark affected checks BLOCKED and state the necessary owner action.
Do not weaken TLS, change credentials, replace the provider or claim an adapter
failure solely because the provider is unreachable. Such an environment-specific
requirement MUST NOT become a universal installation prerequisite.

## 11. Required acceptance evidence

Before implementation, provide a capability/design table: supported host API and
version, exact session authority, readiness boundary, content path, receipt
witness, cancellation/revocation behavior and unresolved crash windows. Unsupported
mechanisms MUST be rejected explicitly rather than replaced by sleep, log timing,
arbitrary UI selection or an undocumented assumption.

Use focused automated tests for the affected boundaries and one bounded native
plan. At minimum, cover the following, reporting a specific supported outcome or
explicit limitation for each relevant case:

| Area          | Required cases                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Setup         | Clean standard installation; Apply; unchanged repeat Apply; unrelated settings preserved; startup/restart read-only; optional custom paths       |
| Identity      | Two chats in one folder; different folders/instances; Unicode names; explicit transfer; stale connection; no wrong-chat fallback                 |
| Delivery      | First pending message on exact resume; idle and subsequent input; busy defer; draft; question/permission; user stop                              |
| Content       | Canonical sender/body/reply route; Unicode and multiline text; attachments; one body; no host framing or read-command substitute                 |
| Receipt       | Exact admitted ID/content; host rewrite/deny; request cancellation and ID reuse; empty/error response; response release and commit crash windows |
| Recovery      | Node/client restart; plugin reload/reconnect; compaction; clear/fork; helper replacement; stale callbacks and late responses                     |
| Durability    | Multiple messages/pages; blocked and uncertain backlog; concurrent consumers; no replay after uncertain admission or after receipt               |
| Shutdown      | Ordinary supported Quit; actual main-process exit; no late closed-storage access                                                                 |
| Compatibility | Existing supported version/adapter behavior retained; declared frontend/version boundaries                                                       |

For the end-to-end product proof, use a genuinely empty ordinary native chat.
Submit only the ordinary user request to connect as the user-chosen agent name.
Do not pre-bind the agent, preload a mailbox, import a prepared history or add
test instructions to that chat. From another real NCF agent, send a normal
substantive question whose body specifies neither the expected answer nor a
special reply tool. The standard envelope footer remains present.

Record the full Incoming in the receiving chat, its automatic reaction, the
actual reply arriving at the sender and the exact message's admission/receipt
witness. Verify the body occurs once and no extra receiver prompt or manual read
was needed. A scripted marker exchange may test routing but MUST NOT be presented
as this clean-dialogue proof. Keep technical correlation and user-visible
observation as separate evidence.

Every report MUST state exact source/package/runtime identity, client/frontend,
account/permission mode, relevant owner actions, case IDs and outcomes. Use
**PASS**, **FAIL**, **BLOCKED** or **NOT RUN** with limits. A mock, compiler check,
source review, transport acknowledgement or UI screenshot cannot independently
prove all layers. Do not convert a finite sample into a universal guarantee.

## 12. Handoff and release

An independent developer's handoff MUST include:

- Exact base and head revisions, branch, changed paths and build instructions.
- Capability/design table, implemented boundaries and remaining limitations.
- Focused automated results and a compact native evidence index with provenance.
- Setup/reload/permission guidance and a supported clean uninstall path that
  preserves unrelated configuration and data.
- Compatibility and storage migration/rollback implications, if any.
- A privacy-safe diagnostic collection procedure for unresolved failures.

Reviewers MUST state what they independently reviewed or ran and what evidence
they reused. Consolidate findings; do not launch duplicate full campaigns.
Reuse successful checks for unchanged source/dependencies. After a harness-only
fix, rerun the failed check on the same binary. A concrete product change requires
its affected regression and a package built from the final immutable revision.

Build native installers on the target operating system and verify shipped assets
outside the source checkout. Native package success is distinct from real-client
acceptance. Publish only with accurate version, platform and verification limits;
preserve owner-managed installers, backups, private profiles and unfinished work.
Do not declare release readiness while a required product behavior is unresolved.

## Implementation reference map

Use the repository version associated with the handoff; these references provide
entry points, not permission to bypass a requirement:

| Responsibility                                   | Reference                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Shared adapter interface and canonical formatter | `desktop/core/adapters.ts`                                                                        |
| Binding, capabilities and public types           | `desktop/shared/contracts.ts`                                                                     |
| Node routing and adapter coordination            | `desktop/core/service.ts`                                                                         |
| Persistent messages, dispatch and history        | `desktop/core/agent-store.ts`                                                                     |
| Bundled host-side integrations                   | `desktop/integrations/`                                                                           |
| Configuration editor/core and owner IPC          | `desktop/core/mcp-setup.ts`, `desktop/core/mcp-setup-editors.ts`, `desktop/main/mcp-setup-ipc.ts` |
| Setup component                                  | `desktop/renderer/McpSetup.tsx`                                                                   |
| Isolated automated checks                        | `test-desktop/`                                                                                   |

Read the [message protocol](message-protocol.md),
[setup contract](mcp-setup-integration.md), [architecture](architecture.md) and
[development guide](development.md) alongside the implementation. Host-specific
examples are implementation references; they do not extend another client's
capabilities or replace that client's own documented contract.

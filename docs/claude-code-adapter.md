# Claude Code integration

The integration delivers a full **Incoming NCF Agent Interconnect**
message to the exact connected Claude chat: original sender, body, attachment
links, `Reply-To` and `Use agent_send(connectionId, replyRef="…", text) to reply.`
There is no model instruction to fetch the body, and no Message ID in the main
message. The mod requests unframed text with `asUser: true`; the engine-owned
plugin origin remains available to the gate and receipt checks. Manual MCP
reads remain available as a separate explicit action.

Release 0.18.3 unframed incoming passed a real-account exchange in a new, empty
Claude Desktop chat on Linux x64 (Desktop 4.4212.0, Claude Code backend 2.1.309,
Auto mode). The owner chose the name; Claude connected itself after the user's
ordinary setup request. Its new mailbox contained no messages and no old history
was imported. Another agent then sent an ordinary question whose body specified
neither a reply tool nor an expected answer. Claude received the complete message
without the explanatory plugin wrapper and sent its own answer through NCF; the
sending agent actually received it. The standard NCF reply footer was retained.
For that same incoming ID, exactly one committed native delivery matched the
final stored-row UUID and complete bare representation digest. The owner inspected
and accepted the displayed exchange. This establishes this bounded exchange,
not task completion or exactly-once model execution.

Release 0.18.2 direct incoming passed a bounded real-account check on Linux x64
with Claude Desktop 4.4212.0, Claude Code backend 2.1.309 and Auto mode. One message
from an actual agent reached its exact bound chat, committed receipt from the
matching final native stored row, and produced an automatic agent_send reply that
the sender actually received. There was no receiver prompt, manual read, second
arrival or duplicate body. This is separate from the earlier terminal renderer
and synthetic capability probes. That 0.18.2 check used the earlier framed
submission and does not establish native acceptance of the unframed change.

These checks cover the existing Linux installation and real account, including
a new chat and mailbox in 0.18.3; they are not new-account first-run acceptance.
Live Claude delivery on macOS and Windows, other frontends, claude.ai and Agent
SDK sessions is not established. Claude may collapse a long visible row behind
Show more. The earlier 0.18.2 framed result retained host plugin attribution;
the 0.18.3 exchange confirmed the canonical body without that explanatory frame.

## Requirements

- Compatible Claude Code mods and the generated NCF main and gate plugins.
  The current emitted files passed offline compiler validation with native
  2.1.309 and 2.1.319. Compiler validation is not live client acceptance.
- Mods must not be turned off by safe mode, `disableAllHooks`, managed policy or
  the frontend. NCF does not change organization policy. Without the exact
  native stream, automatic incoming stays unavailable and manual `agent_read`
  remains possible. MCP initialization alone never proves automatic delivery.
- No development channel flag is required. The automatic incoming path has no
  channel notification or read-command fallback.

## Set up

1. Start NCF Agent Interconnect. At startup it publishes a local marketplace to
   `<user data>/Integrations/claude-code` with two plugins:
   - `ncf-agent-interconnect`: the MCP server, the lifecycle and tool-call
     command hooks, and the direct-incoming mod;
   - `ncf-agent-interconnect-gate`: the gate mod.

   Both run the installed NCF executable with `ELECTRON_RUN_AS_NODE=1`. Node.js,
   Bun and a source checkout are not required. Startup only publishes these
   files; it never writes Claude Code settings.

2. Open **Applications & MCP → Claude Code** and click **Configure Claude Code**. The
   dialog selects `$CLAUDE_CONFIG_DIR/settings.json`, or
   `~/.claude/settings.json` when that variable is unset. Choose another user
   settings file with the picker if needed. `~/.claude.json` is managed by
   Claude Code and is refused.
3. Review the explanation and click **Apply**. Apply adds:
   - `extraKnownMarketplaces.ncf-agent-interconnect`, a `directory` source for
     the published marketplace;
   - `enabledPlugins["ncf-agent-interconnect@ncf-agent-interconnect"]: true`;
   - `enabledPlugins["ncf-agent-interconnect-gate@ncf-agent-interconnect"]: true`;
   - one entry in `permissions.allow`:
     `mcp__plugin_ncf-agent-interconnect_ncf__agent_read`. It permits explicit manual
     reads without a prompt; direct incoming does not call this tool.

   Other settings, comments, hooks, plugins and permissions stay as they were.
   Matching settings are left byte-for-byte unchanged. Updates keep a private
   backup, and a disabled plugin or moved marketplace needs confirmation. No
   other tool, wildcard, Bash rule or bypass mode is added. Cancel writes
   nothing.

4. Start or resume Claude Code normally. To connect and send in auto mode without
   repeated permission prompts, open `/permissions` and save allow rules for
   these exact tools in **User** scope for the current Claude profile:

   ```text
   mcp__plugin_ncf-agent-interconnect_ncf__agent_connect
   mcp__plugin_ncf-agent-interconnect_ncf__agent_send
   ```

   The exact `mcp__plugin_ncf-agent-interconnect_ncf__agent_read` rule already
   comes from NCF Apply. The owner saves connect/send in Claude's native UI;
   NCF does not add them to Apply. No server wildcard is needed. Each saved
   rule permits that tool's calls within its settings scope; other tools need
   their own permission. Preserve existing deny/ask and managed rules, which
   retain priority. See [Claude Code permissions](https://code.claude.com/docs/en/permissions#manage-permissions).

5. In the chat, write
   `Connect as agent <a name you choose>.` Never enter session IDs or tokens.

After NCF moves to another location, reopen the dialog and Apply again. Restart
Claude Code or run `/reload-plugins` after Apply.

## How the plugins work together

- **Order.** The main plugin depends on the exact-version gate plugin. A mod's
  own prompt hook cannot guard its own submit, so the separate gate checks it.
  Missing or mismatched dependencies cannot authorize content delivery.
- **Private stream.** The installed main mod opens an event-driven stream for
  its exact native session. Its scope exists before the first await and is
  rechecked after asynchronous work. It never polls MCP or another chat.
- **Prepare.** A one-use claim binds the current session, native lease, unique
  helper/epoch/generation, stream incarnation, connection, binding generation
  and backlog. The node reserves its own ready IDs before preparing attachments.
  It seals the exact canonical body and allowed final representation hashes in
  the existing durable delivery ledger. The mod receives an opaque delivery
  trigger and a private report capability, not the body.
- **Admission.** The main mod submits that trigger once with `asUser: true` to
  omit the host's explanatory frame. Its engine-owned origin remains the NCF
  plugin; typed or foreign-plugin text cannot authorize delivery. The gate
  obtains its actual current native session and lease,
  and exchanges that exact delivery ID at the node. Only current authority can
  persist write intent and release the full body. A final synchronous check
  precedes the HTTP body write. The gate forwards the returned body without
  selecting another pending notice or issuing a model tool call.
- **Stored row.** The main mod observes only its own prompt-origin, main-loop
  user row. After the host keeps it, the returned UUID must equal the pinned
  input UUID and the complete representation must match a node-sealed digest.
  The entire canonical body block must also match the node's envelope hash both
  before and after storage; a wrapped or rewritten row remains uncertain.
  Only that witness can commit the node's captured IDs. Queue records, matching
  substrings, submit resolution and turn starts never create receipt.
- **Status.** Availability remains conservative: stored legacy confirmation,
  MCP initialization, stream attachment and ordinary successful reads do not
  promote the chat to verified automatic delivery. Historical K5 evidence and
  native platform limits remain separate from this source candidate.

## How the chat is identified

The helper keeps its native spawn session and a private native-lease
incarnation. Installed command hooks persist lifecycle state before HTTP, so
successful local revocation does not depend on the node being reachable. The
node validates the current lease and exact helper transport before a route,
call, wake stream or claim can be used. A stale helper cannot acquire a newer
incarnation merely by reconnecting.

For every NCF tool call, the native `PreToolUse` hook requests a node-issued
one-use proof and injects it with `updatedInput`. The proof binds session,
helper, transport epoch, generation, native incarnation, tool and argument hash.
Missing, foreign, replayed or expired proofs fail closed. A separate private
call permit keeps the same authority across awaited work and result handling.
The hook does not change permission decisions.

Without explicit tool allow rules, auto mode can refuse the changed input after
the server reviewed the model's original arguments. Full native error results
confirmed that cause for two earlier fixture connect attempts; the short UI
label alone had not established it. Repeating an old proof is not a recovery.

In the isolated Linux 2.1.319 fixture, actual owner-saved exact connect/send
rules then permitted a fresh connection and two sends in auto with no new
dialogs while the changed-input hook stayed active. This is configured auto
compatibility, not unconfigured auto or every-tool acceptance. The existing
Apply-installed read rule had independently allowed an auto read. No permission
hook override, broader rule or manual-mode switch was used in the configured
scenario. Moving an occupied name still needs the separate NCF owner approval.

## Lifecycle

- Startup or exact resume creates a current native scope; pending inbox is
  offered through its event stream. First-resume behavior of the new direct
  content path requires native acceptance.
- Compaction within the same session keeps only an already active native lease
  and exact binding. It never creates, revives or rotates an ended, missing or
  conflicted lease. The real-account Desktop 2.1.309 protected-call check passed;
  that check did not establish the new direct content path.
- Busy input, drafts and dialogs remain subject to the host's prompt scheduler.
  A dropped or ambiguous submission is not automatically repeated. Content
  released under durable intent can remain uncertain even if no receipt exists.
- In-process clear, resume, branch or session end revokes the old scope. A new
  context does not inherit an occupied agent name. Restart the client normally
  and use the normal explicit connect/transfer flow when required.
- Node or helper/stream replacement never reauthorizes an old operation.
  Name transfer requires owner approval and revokes the previous binding.
- With no compatible mod/stream, manual reads remain available. NCF does not
  substitute a recent chat, a read instruction, timed retries or polling.

## Delivery and receipt

- For **direct native incoming**, receipt means that the exact host-kept row
  returned the pinned UUID and full expected representation, and the node
  committed the same captured IDs under still-current authority. It is not a
  model acknowledgement, proof of native disk persistence or task completion.
  A denied/replaced row cannot receipt the expected body.
- Before intent and content release, a prepared attempt may be cancelled. Once
  native write intent is durable, lost/partial HTTP, host drop, scope revocation,
  crash or missing stored-row report leaves durable **uncertainty**. Missing
  commit is never proof that content was not sent. No automatic replay or
  rollback is permitted. The stored-row UUID and possibly admitted canonical
  envelope cannot be spent by another delivery.
- For **explicit manual MCP reads**, receipt means that the complete
  `agent_read` or `agent_history` response frame
  was written by the exact Claude Code helper to its stdio connection with
  Claude Code. For each such read the node chooses the page, reserves its ready
  incoming IDs before preparing files, revalidates the call's native authority
  and persists its intent before it releases content to the helper. The helper
  checks authority again, writes the frame and reports the result:
  - complete write: receipt is committed for the node-chosen IDs;
  - nothing written (authority lost first): the attempt is cancelled and the
    messages stay unread;
  - failed or partial write, or a helper or NCF that stopped after content was
    released: the attempt stays **uncertain**.
- This is a local full-frame handoff. It is not an acknowledgement that Claude
  Code stored the response or that the model read it, and it says nothing about
  task completion.
- IDs of an attempt in progress or uncertain are fenced. Unread agent reads
  report an explicit busy or uncertain error when the selected page is blocked;
  `agent_history` lists them without content, attachments refuse them, and no
  adapter admits them, also after a transfer. NCF never repeats or rolls back
  uncertain content automatically, and an old commit never revives a cleared or
  reset mailbox. The owner's history in NCF keeps the full content and shows the
  uncertainty on the message.
- Reads through other MCP clients keep their receipt behaviour, except that
  blocked unread pages also report busy or uncertain rather than an empty inbox.

For candidate build instructions, diagnostics and historical native
manual cases are in [Claude diagnostic testing](claude-code-diagnostic-testing.md).

## Verification

`docs/claude-code-candidate-verification.md` lists the exact revisions, the
commands, the native campaign with its case table and the open items. Sanitized
native evidence is in `docs/evidence/claude-code-candidate-native.json`. macOS,
Windows, Claude Desktop and organization policies were not verified by the
submitter.

Subsequent corrective evidence has narrower provenance:

- Exact `586385d0655cd632747219a368ceada4744bbfa8`, version 0.18.3: one native
  Linux package and own-ASAR verification passed. The real-account, new-chat
  exchange above confirmed unframed incoming, an unscripted reply received by
  the actual sender, and receipt for the same message and final stored row.
  An earlier fixed-marker exchange on this package proves routing and format
  only; it is not the basis for the unscripted-dialogue result. Ordinary Ctrl+Q
  ended the supervised Electron main with code zero, no signal or closed-store
  error; the same version then resumed on the original working data. Selected
  settings and marketplace hashes stayed unchanged. All four installers use
  this build source; the tagged follow-up only records verification in docs.
- Exact `ff058f0e40fc30001fa0cd1efe0f0f97ab4df8ae`, version 0.18.2: one native
  Linux build and own-ASAR check passed. GUI acceptance used the extracted
  contents of that same AppImage with the verified identical ASAR, not a claim
  about the FUSE wrapper's exit. The real-account Desktop check above confirmed
  the full canonical body, final stored-row UUID and sealed representation
  digest, node receipt and automatic reply received by the other agent. The
  current chat's tool group showed agent_send only. Contextual help appeared
  under the configured Claude heading and stayed hidden for an unconfigured
  client. Ordinary Ctrl+Q ended the actual supervised Electron main with code
  zero, no signal or closed-store error; the same binary was then started on
  the same working data, peers and bindings. All three checked configuration
  hashes stayed unchanged immediately after NCF startup; selected settings and
  marketplace hashes stayed unchanged throughout. Claude updated its own global
  state during native use; NCF did not write it or inspect its contents. No live
  Claude account was tested on macOS or Windows.
  The tagged follow-up changes only test expectations and documentation; all
  installers identify the actual build source above.

- The same-session compact correction has a failing regression on exact `7cc4123` and twelve passing focused synthetic cases after the fix. They cover lease bytes, exact route/binding and protected MCP calls, unavailable states, repeated starts and a delayed compact notification after SessionEnd. This is source evidence, not a native compaction result.
- Exact `a00294d3`: Linux x64 AppImage and Claude Code 2.1.319; first pending
  exact-resume read and fixture-node restart passed in manual mode after actual
  owner approval. One existing-binding auto-read passed separately. These three
  bounded runs do not establish the cause of historical K5 or fresh auto-connect.
- Configured auto on the same `a00294d3` AppImage: the owner saved exact
  connect/send rules in fixture user scope, then a new chat made a successful
  fresh connection and two sequential local sends with no new permission
  dialogs. The recipient read exactly the two matching message IDs once. One
  preceding empty-input connect failed nickname validation: four native calls
  total, not a clean three-call run, and no claim of zero internal preflight
  effects. The protected-call pipeline is unchanged in `407f967`; this is not
  installed-product `407f967` native evidence or a restart-persistence test.
- Research `437c5f5`: retained actual read rows after exact resume showed the
  guarded terminal Incoming once, default metadata hidden, Ctrl+O metadata
  visible, then hidden again. The owner confirmed the switching behavior; sender
  and body on this revision were checked in terminal capture. This was not a new
  first-delivery or a new receipt/model acknowledgement proof.
- Research `6db26af` changed only the reply footer to the standard instruction;
  a pure formatter regression covered that change. The shipped modules use that
  formatter and the `437c5f5` registration layout. Generated-entry tests run them
  through the production `wake.js` and plugin name, not a standalone probe.
- In the old isolated Linux run, SIGTERM was followed by a failed HTTP probe
  and a successful `kill -0` at about four seconds, then SIGKILL. No process
  state or exit status was captured; PID existence does not prove executing
  rather than zombie state. Closed-store IPC errors were logged during
  teardown. An infinite hang and a three-second shutdown SLA are not established;
  actual natural Quit/exit remains a final native acceptance check.

Rendering is downstream of the same tool result. It makes no inbox or network
call, records no receipt, and does not promote automatic-delivery status. Errors,
interruption, unknown results, foreign tools and `agent_history` keep native
rendering. No irreversible seen-ID cache suppresses later redraws.

## Targeted development checks

```sh
node --experimental-sqlite --import tsx --test test-desktop/claude-code-*.test.ts test-desktop/offered-ledger.test.ts
```

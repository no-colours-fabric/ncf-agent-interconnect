# Claude Code integration

NCF announces incoming agent messages in the exact interactive Claude Code chat
that connected under a user-chosen agent name. The announcement is a short
notice without message content, submitted by an NCF Claude Code mod with plugin
attribution. Claude then receives the message, attachments and Reply-To through
the ordinary `agent_read` tool. In the terminal, the NCF mod renders the actual
returned read as **Incoming NCF Agent Interconnect** with sender, original body,
attachments, Reply-To and the standard `agent_send` reply instruction. The
notification shows a short pending label instead of the internal read command.
Ctrl+O exposes the returned page metadata; ordinary group expansion does not.
This changes presentation only, never the stored/model-facing notice or receipt.
Claude Desktop, claude.ai, Agent SDK sessions
and Claude inside other applications are not covered.

## Requirements

- Interactive Claude Code with mods (enabled by default from version 2.1.287).
  Versions 2.1.318 and 2.1.319 on Linux were used for native verification.
  The terminal renderer was checked against the generated declarations and
  native behavior of 2.1.319; other render surfaces are not verified.
- Mods must not be turned off. `--safe-mode`, `disableAllHooks`, the managed
  settings `allowManagedModsOnly` or `allowManagedHooksOnly`, and Claude Desktop
  WSL sessions turn them off. Then NCF reports automatic wake as unavailable;
  messages stay available through `agent_read`. NCF never changes organization
  policy.
- No development flag is needed. Claude Code channels are no longer used for
  announcements; the legacy channel event is sent only when the mod's stream is
  absent, and Claude Code ignores it without
  `--dangerously-load-development-channels`.

## Set up

1. Start NCF Agent Interconnect. At startup it publishes a local marketplace to
   `<user data>/Integrations/claude-code` with two plugins:
   - `ncf-agent-interconnect`: the MCP server, the lifecycle and tool-call
     command hooks, and the wake mod;
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
     `mcp__plugin_ncf-agent-interconnect_ncf__agent_read`. It lets announced
     messages be received without a prompt.

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

- **Order.** The NCF plugin declares the gate as a dependency with the exact
  application version. In Claude Code's documented mod order, a mod runs before
  the mods it lists under `dependencies`, so the gate sees every notice the NCF
  mod submits. If the gate is missing, disabled or from another NCF version,
  Claude Code does not load the NCF plugin at all. NCF then shows the chat as
  not connected instead of letting notices start turns unchecked.
- **Wake stream.** At session start the NCF mod reads the private node
  descriptor and spawns the installed runtime as the wake stream of this exact
  native session. The stream is pinned to the session's native lease and to the
  helper route the node already trusts. The mod's lifecycle scope exists before
  its first await and is rechecked after each one; `session.end` ends the
  stream.
- **Claim and notice.** For each wake the node issues a one-use claim bound to
  the native session, node incarnation, helper epoch and generation, native
  lease, agent binding and the captured backlog. It also composes the notice
  text with a random wake reference. The mod consumes the claim and immediately
  submits that exact text, never as the user and never again after a drop.
- **Gate.** A mod's own hooks never see its own submission, so the gate runs in
  the separate plugin. When the queued notice is dequeued, right before its
  turn, the gate names it to the node by the SHA-256 of its text. The node
  starts only that notice's claim, once, and only while it is still current. A
  failed or timed-out check drops the notice. Owner prompts pass unchanged. An
  older queued notice cannot start a newer claim, carry an old identity under a
  new binding or spend a new owner's wake.
- **Status.** A connected wake stream remains _set up but not verified_. A gate
  start permits a notice but does not prove that its native read will succeed.
  The first-resume failure reported in campaign K5 remains under native
  investigation. MCP initialization, gate starts and ordinary reads never
  promote the chat to confirmed automatic delivery.

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

| Situation                                         | Behaviour                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Launch or exact `claude --resume <id>`            | Supported. The mod's stream attaches to the exact session; messages already waiting are announced without a prompt or a second message.                                                                                                                                                           |
| Later arrivals, busy turns                        | Supported. A notice waits until the session is idle. A newer wake supersedes an older queued notice; one read drains the backlog.                                                                                                                                                                 |
| Compaction in the same session                    | Keeps the current active native lease and exact binding. It never creates or revives a missing, ended or conflicted lease. New native starts keep their separate lifetime checks.                                                                                                                 |
| Stop or Esc                                       | The queued notice is dropped by Claude Code and never resubmitted. A turn that ends with a message still unread is announced once more; nothing polls.                                                                                                                                            |
| Draft in the input, permission or question dialog | The notice waits for the session to be idle and leaves the draft and the dialog unchanged.                                                                                                                                                                                                        |
| In-process `/clear`, `/resume` or `/branch`       | `session.end` ends the old stream and its notices. Claude Code does not start mods again for the new context, so it stays unbound and no name moves automatically. Recovery: quit Claude Code and start it again (`claude --resume <id>` for an existing chat), then connect if it is a new chat. |
| NCF restart                                       | The helper keeps its pinned native incarnation; the mod's stream reconnects as transport recovery. Claims of the previous NCF run are void.                                                                                                                                                       |
| Name transfer                                     | Requires explicit owner approval and revokes the former binding; claims of the former binding are refused.                                                                                                                                                                                        |
| Mods off, plugin missing or gate disabled         | No automatic wake; status says so. Messages stay readable with `agent_read`.                                                                                                                                                                                                                      |

## Delivery and receipt

- A wake carries only the agent name. It is never a receipt. Issued or consumed
  claims, a submitted notice and a reported turn never mark messages received
  and never hide them.
- Receipt means that the complete `agent_read` or `agent_history` response frame
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

For the corrective branch, build instructions, diagnostics and three native
manual cases are in [Claude diagnostic testing](claude-code-diagnostic-testing.md).

## Verification

`docs/claude-code-candidate-verification.md` lists the exact revisions, the
commands, the native campaign with its case table and the open items. Sanitized
native evidence is in `docs/evidence/claude-code-candidate-native.json`. macOS,
Windows, Claude Desktop and organization policies were not verified by the
submitter.

Subsequent corrective evidence has narrower provenance:

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

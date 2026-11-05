# Claude Code integration

NCF announces incoming agent messages in the exact interactive Claude Code chat
that connected under a user-chosen agent name. The announcement is a Claude
Code channel event without message content. Claude then receives the message,
attachments and Reply-To through the ordinary `agent_read` tool, which records
receipt. Claude Desktop, claude.ai, Agent SDK sessions and Claude inside other
applications are not covered. Channels are a Claude Code research preview, so
this integration is experimental.

## Requirements

- Interactive Claude Code with channels support. Version 2.1.309 was used to
  validate the generated plugin. No live session was used.
- Authentication through a claude.ai account or a Claude Console API key.
  Amazon Bedrock, Google Cloud Agent Platform and Microsoft Foundry do not
  support channels.
- On claude.ai Team and Enterprise plans, an Owner must enable channels
  (`channelsEnabled`). NCF never changes organization policy.
- Each launch must opt in explicitly:

  ```sh
  claude --dangerously-load-development-channels plugin:ncf-agent-interconnect@ncf-agent-interconnect
  ```

  Claude Code shows a full-screen warning that the owner must confirm. The
  flag is ignored with `-p` and in the Agent SDK. Without it, Claude Code drops
  channel events silently; messages stay queued and no receipt is written.
  Never replace it with `--dangerously-skip-permissions`.

## Set up

1. Start NCF Agent Interconnect. At startup it publishes a local marketplace
   with the NCF plugin to `<user data>/Integrations/claude-code`. The plugin
   runs the installed NCF executable with `ELECTRON_RUN_AS_NODE=1`. Node.js,
   Bun and a source checkout are not required.
2. Open **MCP setup → Claude Code** and click **Configure Claude Code**. The
   dialog selects `$CLAUDE_CONFIG_DIR/settings.json`, or
   `~/.claude/settings.json` when that variable is unset. Choose another
   user settings file with the picker if needed. `~/.claude.json` is managed
   by Claude Code and is refused.
3. Review the explanation and click **Apply**. Apply adds:
   - `extraKnownMarketplaces.ncf-agent-interconnect`, a `directory` source
     for the published marketplace;
   - `enabledPlugins["ncf-agent-interconnect@ncf-agent-interconnect"]: true`;
   - one entry in `permissions.allow`:
     `mcp__plugin_ncf-agent-interconnect_ncf__agent_read`. It lets announced
     messages be received, and their receipt recorded, without a prompt.

   Other settings, comments and permissions stay as they were. Matching
   settings are left byte-for-byte unchanged. Updates keep a private backup,
   and a disabled plugin or moved marketplace needs confirmation. No other
   tool, server-wide wildcard, Bash rule or bypass mode is added.

4. Start Claude Code with the command shown under the card. In the chat,
   write `Connect as agent <a name you choose>.` Never enter session IDs or
   tokens.
5. Ask another agent to send a message. Claude Code shows a channel event and
   calls `agent_read`. The Applications page reports automatic delivery only
   after such a read has confirmed that the channel is active in this process.
   Until then the connection shows as checking and messages remain available
   through `agent_read`.

After NCF moves to another location, reopen the dialog and Apply again. Restart
Claude Code or run `/reload-plugins` after Apply.

## How the chat is identified

The helper keeps its native spawn session and a private native-lease
incarnation. Installed command hooks persist lifecycle state before HTTP, so
successful local revocation does not depend on the node being reachable.
The node validates the current lease and exact helper transport before a route
or call can be used. A stale helper cannot acquire a newer incarnation merely
by reconnecting.

For every NCF tool call, the native `PreToolUse` hook requests a node-issued
one-use proof and injects it with `updatedInput`. The proof binds session,
helper, transport epoch, generation, native incarnation, tool and argument
hash. Equal arguments never select another chat. Missing, foreign, replayed or
expired proofs fail closed. Model lifecycle tools have no authority;
`session_event` is not exposed or generated as a hook.

The hook does not change permission decisions. Auto mode may reject an updated
MCP input and is **NOT_TESTED** for this correction; no automatic permission
grant is used as a workaround. See the
[official updated-input contract](https://code.claude.com/docs/en/hooks#pretooluse-updatedinput-in-auto-mode).

Initial startup and exact CLI resume still require matching native spawn and
command-hook evidence. `--continue` and resume without an explicit ID are not
claimed supported when their native IDs disagree. In-process clear/resume
cannot retarget an old helper: after the old session's trusted `SessionEnd`,
the new context stays unbound until a fresh helper is created through the
normal owner/client lifecycle. The application does not launch one. Agent-name
transfer retains its ordinary explicit owner approval.

This is a first-stage P1 correction with a declared functional limitation.
It does not close startup delivery T13/F11, remaining delivery findings or
native client acceptance. In particular, a new session ID alone cannot revoke
an old session, and offline clear is not proven if the old-session signal or
its local persistence is missing.

## Delivery and receipt

- The wake contains only the agent name. NCF records it as `offered`, which is
  not a receipt. Receipt is written when `agent_read` returns the message.
- A wake covers the messages already queued; each later arrival is announced
  again, so an ignored event cannot stall the inbox. A read that leaves
  messages behind sends one new wake.
- When a turn ends with a message still unread, the observation-only `Stop`
  hook lets NCF announce it once more. Each message is renewed at most once. These are event driven; nothing polls or
  runs on a timer.
- A wake interrupted by a restart is offered again; it never becomes
  `uncertain`. Uncertain records of other adapters are not changed.
- Outgoing replies use `agent_send`; the protocol and receipt semantics are
  unchanged.
- Permission relay is not declared. Prompts and drafts stay in the local
  Claude Code terminal.

## Recovery

| Situation                                 | First-stage boundary                                                                                                                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NCF/transport restarts with a live helper | The helper retains its pinned native incarnation. Revoked or changed durable state is rejected; restart is not authority to adopt a fresh nonce. Delivery/reconnect acceptance remains a separate stage. |
| Exact CLI resume                          | Matching native spawn and lifecycle evidence can establish the route. T13/F11 first-wake delivery remains open; next-event delivery is not accepted as its closure.                                      |
| In-process clear/resume                   | The trusted old-session end fences the old route. A different new session stays unbound until a fresh helper; no name transfer is automatic.                                                             |
| Helper exits                              | Use the client's ordinary Reconnect lifecycle. The new helper still needs current native evidence. NCF never launches the agent.                                                                         |
| Missing/corrupt/conflicting lease         | No positive route or call proof. A lifecycle signal with failed local persistence is not proof of safe offline clear.                                                                                    |

## Verification limits

Source checks cover the following, using synthetic helpers, real helper and
hook processes, isolated nodes and temporary settings files:

- protocol negotiation;
- exact routes for two chats in one folder and for two processes;
- forged, replayed, missing and ambiguous context;
- session switches;
- dropped wakes without receipt;
- coalescing and partial reads;
- node restart with a live helper, and helper death;
- setup Apply, Cancel and no-op;
- plugin generation and validation.

They do not contact Claude Code or any account.

The following are historical observations on the pre-correction handoff, not
acceptance of the corrected source. The submitted 19/20 count combines
candidates, helpers and evidence layers; scope gaps remain under review.

On-site run `ncfcc-20261105-r1` (2026-11-05) used three interactive Claude
Code 2.1.318 sessions with a claude.ai account, the installed Linux x64 package
and a dedicated `CLAUDE_CONFIG_DIR`. It verified the following live:

- channel registration;
- the loaded tool name `mcp__plugin_ncf-agent-interconnect_ncf__agent_read`
  and the applied allow rule;
- idle wakes in both directions;
- exact routing among six directions;
- drafts, open permission cards and AskUserQuestion forms during events;
- busy turns and pagination;
- NCF restart and transport loss with live helpers;
- `/clear`, name transfer, helper death with `/mcp` Reconnect;
- attachments;
- a session without the channel flag.

Open items:

- **First wake after a launch with `--resume`.** Claude Code registers the
  channel listener after the MCP connection log; an early-offer race is a
  hypothesis consistent with the supplied timeline, not proven exclusive vendor
  causation. A message already queued at launch is therefore delivered
  with the next event, not before the first action. No helper-visible client
  event marks the registration, so this release does not add a timing
  heuristic.
- **Historical resume-hook error.** The submitted candidate generated an
  unsupported `mcp_tool` path at launch resume. The P1 correction removes that
  authority path. Native F3 verification has not been run; its removal is not
  proof of F11 recovery.
- **Platform and account coverage.** macOS arm64, Windows x64 and a second
  account were not run.

## Owner-run validation

Use a disposable Claude Code profile (`CLAUDE_CONFIG_DIR`) and test agents only.

1. Install the NCF package on macOS arm64 and Windows x64. Run
   `npm run build:release -- --mac` or `--win` natively on that system.
2. Apply the Claude Code setup to the disposable profile's `settings.json`.
   Confirm that no other file changed.
3. Start Claude Code with the launch command. Accept the development-channel
   warning and check `/plugin` and `/mcp` for `plugin:ncf-agent-interconnect:ncf`.
4. Connect as agent A. Send from agent B and confirm all of the following:
   - one channel event;
   - an automatic `agent_read` without a prompt;
   - receipt recorded;
   - automatic status shown in Applications.
5. Leave a draft in the input and open a permission prompt, then send again.
   Record whether the draft and the dialog survive.
6. Quit Claude Code, run `claude --resume <id>` and send before typing anything.
   Record whether the wake arrives.
7. Run `/clear` and verify the trusted old-session revocation. The new chat
   must remain unbound until a fresh helper; do not count in-process automatic
   resume as passed on this first-stage correction.
8. Restart NCF while Claude Code runs and send. Confirm delivery without user
   action.
9. Start Claude Code without the flag and send. Confirm the message stays
   queued and unread.

Record version, platform, authentication type and results. Do not reuse
private chats or real configuration.

## Targeted development checks

```sh
node --experimental-sqlite --import tsx --test test-desktop/claude-code-*.test.ts test-desktop/offered-ledger.test.ts
```

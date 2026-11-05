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

The stdio MCP process can outlive a chat through `/clear` or `/resume`, so it
never counts as the chat itself. NCF accepts only evidence produced by Claude
Code:

- the `CLAUDE_CODE_SESSION_ID` given to the helper at spawn;
- `SessionStart` and `SessionEnd` command hooks of the plugin, sent to the
  node with the app-owned local credential;
- `mcp_tool` hooks for `SessionStart` and `SessionEnd`, which reach the helper
  over its own stdio transport after `/clear`, compaction or an in-process
  switch;
- a `PreToolUse` hook for each NCF tool. It reports the session and a hash of
  the exact tool input, and never changes the input or the permission decision.

The helper hashes the arguments it receives. A call is forwarded only when
exactly one fresh `PreToolUse` record matches. That record is consumed, and it
proves which session this transport serves. Model-supplied `contextToken`
values are removed.

After proof, `agent_connect` receives a one-use ticket from the node.
Workspace, title, PID, transcript and model-supplied identifiers are never
used. Two processes that claim one chat pause delivery. A session switch blocks
the old route before a new one is admitted.

## Delivery and receipt

- The wake contains only the agent name. NCF records it as `offered`, which is
  not a receipt. Receipt is written when `agent_read` returns the message.
- A wake covers the messages already queued; each later arrival is announced
  again, so an ignored event cannot stall the inbox. A read that leaves
  messages behind sends one new wake. These are event driven; nothing polls or
  runs on a timer.
- A wake interrupted by a restart is offered again; it never becomes
  `uncertain`. Uncertain records of other adapters are not changed.
- Outgoing replies use `agent_send`; the protocol and receipt semantics are
  unchanged.
- Permission relay is not declared. Prompts and drafts stay in the local
  Claude Code terminal.

## Recovery

| Situation                                  | Behaviour                                                                                                                                                                                                                                                                        |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NCF restarts while Claude Code runs        | The helper reconnects its event stream with backoff and proves its route again with its in-memory secret and session generation. Stale offers are re-sent once. No user or model action is needed.                                                                               |
| Claude Code starts with `--resume <id>`    | The helper environment and the `SessionStart` command hook name the same session, so the route is proven before the first prompt. After `--continue`, or `--resume` without an ID, the environment can hold the startup ID; the route is then proven at the first NCF tool call. |
| `/clear` or `/resume` in a running process | `SessionEnd` and the session events block the old route. The new chat does not inherit the agent name; moving it requires the owner-approved transfer. Resuming the original chat restores its route.                                                                            |
| The stdio helper exits                     | Claude Code marks the server failed. Use **Reconnect** in `/mcp`. Messages stay queued; the new helper is proven again before any wake. NCF never starts Claude Code itself.                                                                                                     |

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

Not yet verified with a live Claude Code session:

- channel registration;
- the qualified tool name in a loaded plugin;
- `mcp_tool` hook calls to the `session_event` tool;
- `PreToolUse` input identity;
- drafts and pending permission dialogs during a channel event;
- the macOS and Windows packages.

Until the owner-run procedure below passes, these items stay open.

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
7. Run `/clear` and send. No wake may reach the new chat. Run `/resume` back to
   the original chat and confirm delivery resumes.
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

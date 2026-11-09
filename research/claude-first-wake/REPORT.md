# Claude Code first wake after exact resume: research report

Campaign `ncfcr-20261109`, run on 2026-11-09 from BASE
`273b91b8d62c3bf2c8fd57b7b345b660187dc3fa`. This is developer research, not a
release or a native acceptance of the product. All product invariants of the
BASE are unchanged; the prototype lives only under `research/claude-first-wake`.

## Outcome

**Supported implementation path found, as an isolated prototype.**

The Claude Code terminal Mod API delivers an already pending NCF message after
an exact native `--resume`. It needs no user prompt, no manual read and no
second incoming message, and it works independently of channel registration
timing.

The mechanism is:

1. `session.start` gives the exact native session (`$.session.id`).
2. The mod asks the node one bounded question.
3. If there is a pending message, the mod calls `$.prompt.submit` with default
   plugin attribution.

The Channels path alone is shown to lose the first wake in a bounded,
reproduced race.

The prototype is not active in the product plugin. Adopting it is an
integration decision; see "Integration proposal".

## Evidence summary

Every native run used:

- Claude Code 2.1.318 (native install, Linux x86_64);
- a claude.ai personal account with no organization policy;
- a dedicated `CLAUDE_CONFIG_DIR`;
- the isolated source fixture node `research/claude-first-wake/fixture-node.ts`
  (own data directory, loopback, ephemeral ports, no peers);
- the receiver conversation `SESSION-B`, agent `rr-Борис`.

The procedure was the same each time:

1. The previous turn completed and the owner exited.
2. A fresh probe was queued by a standard-MCP fixture sender.
3. The owner launched the exact `--resume` and confirmed only the
   development-channel warning where the flag was used.
4. No receiver input was given after consent.

Sanitized correlations are in `evidence/native-campaign.json`.

| Run | Mod | Channel flag | Result                                                                                                                                                                                                                                                                               |
| --- | --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FW1 | yes | yes          | Delivered. In this run the channel event started the turn first (transcript `origin: channel`), and the mod prompt followed as a second turn with an empty read: a benign duplicate.                                                                                                 |
| FB1 | no  | yes          | **Not delivered.** Message stayed `ready/offered`; there were no transcript rows after resume.                                                                                                                                                                                       |
| FW2 | yes | yes          | Delivered by a mod-originated turn (`origin: plugin ncf-first-wake-research`). `agent_read` returned both pending IDs (`2d578abe…` from FB1, `6e5d0b89…`), and both were receipted. The late channel event joined the same turn as a queued command and caused a second, empty read. |
| FW3 | yes | **no**       | Delivered by the mod alone. Claude Code logged `Channel notifications skipped`; the plugin-origin turn read `b1ed7f0b…`; one read, no duplicate.                                                                                                                                     |
| FB2 | no  | yes          | **Not delivered.** The node wrote the wake at 12:35:52.667Z; Claude Code logged `Channel notifications registered` at 12:35:52.681Z, 14 ms later. The message stayed unread.                                                                                                         |

Each delivery is correlated through three independent sources:

| Source                | Evidence                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Node                  | Mod query and answer, dispatch transitions, `processed/admitted`                          |
| Native transcript     | Turn origin, `agent_read` tool use, returned synthetic IDs                                |
| Claude Code debug log | Mod `session.start`, `$.http.fetch`, `$.prompt.submit`, MCP connect, channel registration |

The terminal UI marks the mod prompt as `Prompt from the ncf-first-wake-research
plugin`; it is not presented as user input.

Native F3 check: on this BASE, `--resume` launches show no `SessionStart` hook
error. The `mcp_tool` session hooks were removed by the BASE corrections.

## Branch results

### 1. Terminal Mod background submission — succeeded (prototype)

**Contract.** The documented Mods API:

- `session.start` fires once per load before the first prompt, and not after
  `/clear`, `/resume` or `/branch`.
- `session.end` fires on exit and on those switches.
- `$.session.id` returns the current session.
- `$.prompt.submit({ text })` waits for idle, starts a turn with plugin
  attribution and resolves when the turn starts, or with `{ drop }`.
- `$.http.fetch`, `$.fs.read` and `$.env.get` are available.

**Gates.**

- Mods are on by default from v2.1.287 in the terminal, and from v2.1.286 in
  the Desktop app.
- They are off with `--safe-mode`, `disableAllHooks`, managed
  `allowManagedModsOnly` or `allowManagedHooksOnly`, and in Desktop WSL
  sessions.
- The Claude Code 2.1.318 static analyser accepted the module:
  `hooks: session.start, session.end`; `calls: $.prompt.submit, $.session.id,
$.env.get, $.fs.read, $.http.fetch`.
- The test kit of that version ran the offline tests: 4/4.

**Scope and lifecycle.**

- The mod handles only the start of a loaded session: launch, exact
  `--resume`, or reload.
- `session.end` fences its scope, so a late answer after `/clear` or
  `/resume` submits nothing.
- In-process `/clear` and `/resume` are not covered, because `session.start`
  does not fire for them. This matches the BASE stage-one limitation: no old
  helper is retargeted.

**Safety.**

- The mod submits only a fixed notice naming the escaped bound agent, never
  user commands and never `asUser`.
- It submits nothing when the node reports no binding, nothing pending, no
  current route, or ambiguity, or when the deadline expires.
- A dropped or refused submission is reported and never retried, so an
  explicit Stop is respected.
- It never reads the inbox.

**Node side.**

- The research endpoint subscribes before it snapshots, so an arrival between
  the two is not missed.
- It answers only for a unique current native route, which includes the
  lease nonce.
- A deadline is reported as a resource limit, never as a wake.

### 2. Event-driven command-hook wake (`asyncRewake`) — not pursued

The task orders the branches. Branch 1 met the requirement, so the
`asyncRewake` waiter was not prototyped. Its documented properties are:

- an exit-2 wake;
- a timeout that bounds a waiter;
- an observation-only shape.

These would require a long-lived waiter whose deadline must never become a
wake. The mod path avoids that.

### 3. Channels readiness contract — terminated

No documented channel readiness or registration contract exists in the
Channels reference or the Mod API. The only signal is the debug-log line
`Channel notifications registered`. Debug scraping, MCP initialisation,
`ping`, a successful notification write or a sleep are not readiness.

FB2 bounds the failure: a wake written 14 ms before registration was dropped
silently. A later incoming message is not an acceptable bootstrap.

The branch ends here, with the mod as the concrete alternative.

Additional finding: transcript rows record `origin: { kind: 'channel', server }`
for admitted channel events, and the documented Mod event `session.append`
fires for each row before it is stored. A mod could therefore observe channel
admission natively. This can reduce duplicates. It is not a readiness
contract and was not prototyped.

## Duplicates

FW1 and FW2 show both mechanisms waking the same backlog. The second read is
empty and receipt is idempotent, so no message is duplicated or lost. It still
costs one extra turn. The mod has no API to withdraw a queued prompt.

Options for integration, in order of preference:

1. **Mod as the only first-wake mechanism.** The node does not channel-offer
   the backlog that existed when a new helper lifecycle starts, if that
   backlog was announced through the mod path. This needs a node-side claim,
   recorded when the mod answer is issued.
2. **Mod observes channel admission.** The mod uses `session.append`
   (origin `channel`, own server) and skips its submission when a channel
   event was already admitted.
3. **Accept the benign duplicate.**

## Post-tool evidence and receipt (documentary analysis)

Official contracts checked on 2026-11-09 (`hooks.md`):

- **`PostToolUse`** fires after a successful execution. It receives
  `tool_response` as the tool's structured output, plus `tool_use_id` and
  `mcp_server` (v2.1.274+). Hooks can replace the output with
  `updatedToolOutput` or `updatedMCPToolOutput`, so `tool_response` is not
  guaranteed to equal what the model received.
- **`PostToolUseFailure`** fires for thrown errors and for MCP `isError`
  results. It does not fire for pre-execution rejections (validation,
  permission denial) or for cancellation.
- **`PostToolBatch`** fires once per resolved batch, before the next model
  request. Its `tool_response` is documented as the content the model receives
  in the `tool_result` block. Of the hook events, it is the closest documented
  witness of model-facing content.
- **Mod `session.append`** fires for each kept row, including `tool_result`.
  It can rewrite the row, so a positive witness must be the last writer or
  must compare against the stored row.

None of these establishes that the model understood a message or finished a
task. The native transcript in this campaign shows `tool_result` rows with
exactly the returned synthetic IDs. This is independent client evidence for
these runs, not a product receipt protocol.

A positive-witness or prepare/commit protocol would need:

- binding to the verified session, `tool_use_id`, helper incarnation and call
  permit;
- rejection of stale, foreign or replayed witnesses;
- durable uncertainty for a crash between write and commit.

Under the task constraints, it was not implemented. Production receipt
semantics are unchanged.

## Integration proposal (requires Bob's approval)

1. Ship the mod module inside the existing NCF plugin. `hooks/hooks.json`
   accepts `modules` next to `hooks`. Keep it disabled by default behind an
   explicit owner setting until integration approval.
2. Move the research endpoint into `/integrations/claude/` with the existing
   node token and lease checks. Bind the answer to the helper epoch, and add a
   claim that suppresses the duplicate channel offer of the same backlog
   (option 1 above).
3. Keep Channels for later arrivals. Keep D6/D6a coalescing and Stop renewal
   unchanged.
4. Document the gates: mod availability, `--safe-mode`, organization policy,
   Desktop WSL. Without a mod, behaviour falls back to the current Channels
   path and F11 remains.

## Limits

- Linux x86_64 only, one account, one client version. Not run: macOS, Windows,
  organization policy and the Desktop app.
- The source fixture node ran from this branch, not an installed package.
- Five resume runs (three with the mod) show behaviour, not a probability or a
  maximum delay.
- Duplicates in FW1 and FW2 are documented, not removed.
- In-process `/clear` and `/resume`, busy, draft and permission interactions
  of the mod prompt were not exercised in this campaign. The mod reference
  documents queueing until idle and dropping on Stop.
- The internal-read receipt gap (receipt recorded before a later bridge check
  withholds the response) is unchanged.

## Reproduce

```sh
node --experimental-sqlite --import tsx --test research/claude-first-wake/tests/endpoint.test.ts
cd research/claude-first-wake/mod && claude plugin test   # Claude Code 2.1.318
node --experimental-sqlite --import tsx research/claude-first-wake/fixture-node.ts --data <isolated dir>
```

To run a native case:

1. Write a dedicated profile `settings.json` that points to the fixture node's
   `Integrations/claude-code` marketplace.
2. Bind an agent once.
3. Close the conversation after the turn completes.
4. Queue a probe.
5. Run the exact resume. Omit `--plugin-dir` for the control:

   ```sh
   NCF_FIRST_WAKE_DESCRIPTOR=<data>/research-first-wake.json CLAUDE_CONFIG_DIR=<profile> \
     claude --resume <session> --plugin-dir research/claude-first-wake/mod \
     [--dangerously-load-development-channels plugin:ncf-agent-interconnect@ncf-agent-interconnect]
   ```

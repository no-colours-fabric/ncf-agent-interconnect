# Claude Code corrective branch: build and manual testing

Branch: `codex/claude-direct-delivery` in
`https://github.com/no-colours-fabric/ncf-agent-interconnect`.
Base: `b522648f9b52798c52bbf04f2f67b1312da53a2b` (0.18.1).
Record the exact HEAD and packaged `sourceRevision`; the unchanged version label
alone does not identify this unreleased direct-incoming candidate. No main
integration, publication or working-node replacement follows from source checks.

## Build from GitHub

Use a new checkout on the target operating system, Node.js 22.12 or later and
the ordinary platform build prerequisites. No source archive or binary transfer
is needed:

```sh
git clone --branch codex/claude-direct-delivery --single-branch https://github.com/no-colours-fabric/ncf-agent-interconnect.git ncf-claude-diagnostic
cd ncf-claude-diagnostic
git rev-parse HEAD
npm ci
npm run prepare:runtime
npm run build
```

Build only on the OS where the application will run. `prepare:runtime` ensures
the native Electron distribution exists; the Linux fixture's initial package
attempt failed without it after `npm ci`. Then package with the existing target:

```sh
# Linux x64
npm exec --offline --no -- electron-builder --publish never --linux AppImage --x64

# macOS Apple Silicon (use --x64 on an Intel Mac)
npm exec --offline --no -- electron-builder --publish never --mac dmg --arm64
```

Run only the command for your machine. Outputs are under `release/`. No release
upload is performed. The package builder above does not rerun the full suite;
local corrective checks and their limits are recorded separately. Do not use a
different OS's Electron runtime or assume cross-compilation is native acceptance.

## Isolated setup and logs

Keep the working paired node and coordination chat unchanged. Use a new, empty folder for
diagnostic node data and a separate Claude profile. Launch the diagnostic
application with `--data-dir <absolute test-data folder>`; on Linux execute the
AppImage with that argument, and on macOS run the executable inside the built
app's `Contents/MacOS/` directory with it. Alternatively, `npm start -- --data-dir
<absolute test-data folder>` runs the same compiled source before packaging.
Use nonconflicting test listening ports; the Linux fixture used `peerPort: 0`
and an empty peers list. Never reuse the working node's private state.

For the test terminals, set `CLAUDE_CONFIG_DIR` to a separate profile directory
before launching Claude. Log in through the normal client flow if needed. In
NCF's Claude setup dialog select that profile's settings file and Apply. Only
use synthetic messages/files, and leave remote peers empty. Start Claude
normally; no development plugin flag is required. Restart/reload plugins after
Apply if the client still has a cached marketplace. The human supplies normal
permissions and transfer approval.

This diagnostic branch writes bounded private JSONL to:

```text
<test-data folder>/Integrations/Diagnostics/claude-code.jsonl
```

The file contains UTC timestamps, process IDs, event codes and hashed session,
helper, request and attempt identifiers. It never records message bodies, tool
arguments, agent names, paths, tokens, proofs or raw error text. A log is bounded
to approximately 4 MiB; use a fresh test-data folder for a new campaign rather
than deleting node state. Logging failures do not change delivery behavior.
Keep the test profile and node data locally; send only the diagnostic JSONL,
Git commit, OS/architecture, `claude --version`, scenario times and observations.
Do not send `node.json`, settings, native-lease files, databases or client
transcripts. Note whether you used packaged runtime or `npm start`.

## Native saved permissions for auto mode

In the isolated Claude profile, the actual owner opens `/permissions` and saves
these exact allow rules in **User** scope:

```text
mcp__plugin_ncf-agent-interconnect_ncf__agent_connect
mcp__plugin_ncf-agent-interconnect_ncf__agent_send
```

Keep the exact `mcp__plugin_ncf-agent-interconnect_ncf__agent_read` rule already
installed by NCF Apply. Confirm the selected profile/scope in the native UI.
Do not use a server wildcard, remove deny/ask rules or replace managed policy.
Agents do not write the permission settings, and Apply does not automatically
add connect/send. Other tools remain subject to their normal permissions.
See [native rule management](https://code.claude.com/docs/en/permissions#manage-permissions)
and [exact MCP tool rules](https://code.claude.com/docs/en/permissions#mcp).

This configuration was natively checked on Linux with the `a00294d3` AppImage
and Claude Code 2.1.319, whose protected-call pipeline is unchanged in `407f967`.
The owner saved the rules, a new chat remained in auto mode, a fresh connect
succeeded and two sequential synthetic local sends reached the existing fixture
recipient exactly once with no new dialogs. There was also one earlier
empty-input connect validation error, making four native calls total. PreToolUse
still changed input; no forced ask/allow mod, manual mode or proof reuse was used.
Saved rule evidence and use in that scenario do not establish all other tools,
future restart persistence, or installed `407f967` native verification.

Without these explicit rules, the earlier native errors confirmed changed input
after auto review as the reason for refusal. Keep that unconfigured limitation
separate from configured success. Reuse the bounded result; do not repeat a
campaign to remove the invalid model call from its history.

## Direct incoming acceptance

The new path submits a node-authorized full message, not a notice requesting
`agent_read`. The main view must contain the exact sender/body/attachment links,
`Reply-To` and standard `Use agent_send(...) to reply.` footer, with one body
copy. It must not expose an opaque admission trigger, Message ID or metadata
JSON as the incoming message. Native plugin attribution remains visible.

Source tests cover reservation, authority races, durable intent, exact final row
witness, uncertainty, fencing and generated main/gate behavior. Earlier terminal
read-renderer captures, the a002 manual/auto scenarios and the synthetic Desktop
2.1.309 visible-body capability are separate evidence. They do not prove the
complete new production path.

On the exact built candidate, use the operator-authorized separate real-account
chat named `Клод Linux`. Preserve working agent names and unrelated settings.
Perform one fresh synthetic delivery after recording source/runtime identity;
observe the actual human-visible full envelope and automatic reaction. Correlate
one message ID internally through native stored-row report and committed receipt,
without reading or exporting chat correspondence. The node may log bounded
hashed phase metadata, never body, tokens or configuration. A queue/start event
is not receipt. If the outcome becomes uncertain, stop and preserve it; do not
send the same content again to manufacture a pass.

Any working-runtime switch requires exact app-owned file provenance and an
explicit rollback plan; do not modify auth, copy profiles or weaken permissions.
The currently installed 0.18.1 is not silently treated as this candidate.

The legacy manual-read renderer still applies only to an actual exact own
`agent_read` result: compact sender/body/footer, expanded metadata without a
second body copy. Its retained-row evidence does not establish direct delivery.

Offline generated-entry checks use an explicitly selected native CLI without
a signed-in session, network peers or a real client profile:

```sh
NCF_CLAUDE_TEST_CLI=/absolute/path/to/claude node --experimental-sqlite --import tsx --test test-desktop/claude-code-presentation.test.ts
```

They materialize the exact generated main and gate plugins in a temporary
directory. The mounted fixture loads the main production `wake.js`, verifies
relative imports and the production namespace, and never fires session-start
or command hooks. Without that explicit CLI path, the SDK portion is skipped.
These tests do not establish terminal paint or native delivery.

## Historical manual scenarios — reuse unchanged evidence

Do not rerun this historical matrix merely for the new content path. Reuse its
recorded revision-specific results and run only the affected acceptance above.

### 1. First pending message after exact resume

Open two independent Claude terminals. Connect the sender as `Test Sender`
and the receiver as `Борис 漢字`. Finish a harmless receiver turn, then exit that
receiver. Send one uniquely numbered synthetic message to `Борис 漢字` while
it is closed. Resume the same receiver through Claude's resume picker; do not
type a prompt, request a manual read or send a second message. Observe whether
the first pending message is read automatically. Repeat once after quitting
and restarting NCF with the same test data.

Expected: exact recipient, one returned copy of each message, no false receipt
for a refused read. A gate start alone is not success. If the receiver says its
native session is unverified, stop that attempt and record the time before any
recovery action; preserve the log. This specifically investigates K5 and the
initial lease/bootstrap ordering. No fixed maximum latency is claimed.

### 2. Unicode, busy input and Stop

Keep sender and receiver open. Put an unsent draft `DRAFT 漢字 keep exactly`
in the receiver input, then send a uniquely numbered message. Verify the draft
survives exactly and the notice is attributed to the plugin. Start a harmless
receiver task that waits for an ordinary question or permission; while it is
pending, send three more numbered messages. Do not grant any extra permission
on behalf of NCF. Confirm the existing interaction normally and check message
order and uniqueness after the receiver becomes idle. In a separate pending
turn, send another message and press Esc to drop the queued work.

Expected: Unicode names route correctly; no interference with input/dialogs;
no repeated content. Esc must not automatically resurrect cancelled work. The
unread message remains available to an explicit later read. Record which
message was pending when Esc was pressed and whether any extra empty wake turn
appeared. Log events distinguish claim, write and receipt; they contain no body.

### 3. Approved transfer and node restart during delivery

Use a third independent Claude chat. While the original receiver has pending
work, connect the third chat as the same `Борис 漢字`. Approve moving that name
through the normal owner-consent flow. Send a new numbered message; only the
new owner may read it. Try an explicit read from the old receiver and record
the refusal. Send a synthetic text file attachment, request its read in the
new receiver, and quit/restart NCF with the same test data while delivery is
in progress. Timing may produce either a completed read or an interrupted one;
do not repeat content blindly to force a particular outcome.

Expected: old authority is refused; a fully confirmed read is not replayed.
If the write outcome is unknown, the owner history retains the message and the
agent gets an explicit busy/uncertain result, not an empty inbox or a false
receipt. Preserve that state for analysis; do not clear history, reset the
agent or manually edit the database. This manual case samples real timing;
deterministic cancellation/transfer/file races are covered by local regressions.

For each case send the UTC start/end, message numbers, observed outcome and
diagnostic file. A failure is useful evidence; a successful manual run does not
establish atomic host admission or coverage of other client frontends.

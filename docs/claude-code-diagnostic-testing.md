# Claude Code corrective branch: build and manual testing

Branch: `codex/claude-candidate-diagnostics` in
`https://github.com/no-colours-fabric/ncf-agent-interconnect`.
This branch starts at candidate `d329e9958e6464887995f16928fd3b92f7216fd5`,
not current main. Its historical application version is still 0.12.0; record
the Git commit as the test identity. Do not install its data over a working node.
The branch is a diagnostic candidate, not a published release.

## Build from GitHub

Use a new checkout on the target operating system, Node.js 22.12 or later and
the ordinary platform build prerequisites. No source archive or binary transfer
is needed:

```sh
git clone --branch codex/claude-candidate-diagnostics --single-branch https://github.com/no-colours-fabric/ncf-agent-interconnect.git ncf-claude-diagnostic
cd ncf-claude-diagnostic
git rev-parse HEAD
npm ci
npm run build
```

Build only on the OS where the application will run. After `npm ci` has installed
the native Electron runtime, package with the existing target:

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

Quit the normal NCF instance before this test. Use a new, empty folder for
diagnostic node data and a separate Claude profile. Launch the diagnostic
application with `--data-dir <absolute test-data folder>`; on Linux execute the
AppImage with that argument, and on macOS run the executable inside the built
app's `Contents/MacOS/` directory with it. Alternatively, `npm start -- --data-dir
<absolute test-data folder>` runs the same compiled source before packaging.

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

## Three manual scenarios

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

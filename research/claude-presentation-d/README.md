# NCF incoming presentation: isolated proof

This is a research-only terminal renderer for Claude Code 2.1.319. It is not part
of the installed NCF application and does not establish native acceptance. It
handles only the exact NCF `agent_read` tool. It changes no permissions, native
context, delivery attempts, history, receipt, inbox state or model-facing text.
It makes no network, filesystem, process, tool or prompt API calls.

The source baseline is `a00294d3c959e69936094e1eef1b4a71c34fe2f0`.
Use the already-built isolated application and existing authenticated fixture.
Do not rebuild NCF, change its installed marketplace, restart the node, create
another name or move a binding to run this probe.

## Source and offline checks

Read `hooks/register.js` and `hooks/presentation.js` before loading the mod.
With the native 2.1.319 executable:

```sh
claude plugin validate /absolute/path/to/presentation-d-probe
claude plugin test /absolute/path/to/presentation-d-probe
```

Validation and mocks do not verify terminal paint, visibility or native receipt.
The testing kit must mount the render site using `$.ui.mount`; manual
`$.ui.render` dispatch did not exercise the same chain in our 2.1.319 harness.
The `plugin: '*'` matcher also failed our narrow control; the prototype uses
component matchers and strict tool/provenance checks inside each handler.

## One bounded native proof

The assistant operates only the already-approved isolated fixture. A real owner
must answer any trust or native permission dialog. Never automate their answer.
Keep the working paired node and coordination chat unchanged.

1. Save the existing idle fixture A session ID and permission mode. Close only
   that fixture terminal session cleanly. Resume that exact session using its
   existing profile/workspace and normal installed NCF plugins, adding just:
   `--plugin-dir /absolute/path/to/presentation-d-probe`. Do not set `asUser`,
   bypass permissions, reconnect the agent name or change client settings.
2. Confirm this renderer and both normal NCF mods loaded. In the default terminal
   view, send exactly one synthetic message from the existing fixture sender.
   Suggested body: `D-001: first incoming. Точный текст 漢字`. No receiver prompt,
   manual read, second arrival or Ctrl+O to make the body visible. Observe sender,
   original body and Reply-To without expanding the MCP result; record actual
   tool name, tool-use ID, one message ID and ordinary frame/commit evidence.
3. Once A is idle again, send one subsequent synthetic message, body
   `D-002: subsequent incoming. Вторая строка`. Verify the same visible fields,
   automatic reaction and a single body copy. After both deliveries, use Ctrl+O
   once and return: the body must remain available exactly once, with returned
   page metadata. Do not treat callback invocation as proof of visibility.
4. After those two independent deliveries, run one explicit diagnostic failed
   `agent_read` in A with a fresh nonexistent connection UUID. This is a
   deliberate failure probe, not a wake test. Verify a visible native error;
   no invented incoming body or receipt, and no perpetual receiving state.
   Never retry a real uncertain read to obtain a prettier result.

If the renderer does not run, the tool name/output shape is different, or the
host collapses/truncates the custom row, stop and report that exact boundary.
Do not substitute a model paraphrase, manual expansion or terminal insertion.
Do not run append/self-send alternatives, rebuild or repeat S1/S2/S3.

The assistant collects: exact Git revision, prototype file hashes, installed
CLI version, loaded plugin list, default-view and expanded-view observations,
sanitized tool name/result wrapper structure, message/tool-use IDs, UTC events,
and PASS/FAIL/BLOCKED per the two deliveries and failure. A real human observation
or sanitized terminal capture establishes the visible result; mock trees do not.
No auth, settings, raw input/proof/token, real conversation or personal paths.

## Rendering boundary

ToolUse is the only Incoming body site, also when a group unfolds. A separate
ToolResult is empty only for the same exact tool/request ID and valid actual
page. There is no seen-ID cache. Expanded ToolUse preserves all page fields:
body once in Incoming, other fields in metadata with an explicit text reference.
Errors, interruption, unknown shapes, history and foreign tools keep native
rendering. The notification rewrite is display-only and never contains a body.
Only terminal rendering is attempted; no Desktop/VS Code claim is made.

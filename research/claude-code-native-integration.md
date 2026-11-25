# Claude Code native integration research

Historical findings from November 2026 on Claude Desktop with the Claude Code backend. Versions and environments below define the scope of each observation.

## Native content and presentation

On 13 November, a real-account probe with backend 2.1.309 appended an exact user-role text row via `session.append`. The host returned the row's UUID and marked it `isMeta=true`. A later answer explicitly referred to a marker present only in that body, though the strict exact-marker assertion failed. The ordinary Desktop view hid the appended row and showed only a separate plugin notification. This establishes model access to the appended text in that environment. Human-visible delivery, exact-target authority, and receipt were outside the probe.

The runtime rejected duplicate lifecycle handlers and reading an API method as a value (`typeof`); direct invocation and reuse of the existing lifecycle handlers compiled. Retained 2.1.319 declarations exposed `ToolUse.output`, `ToolResult.output`, and `ToolGroup` unfolding. Those declarations alone did not establish native rendering. Presentation review found that attachment matching must preserve multiplicity, malformed attachment entries must fall back to native rendering, and suppression must require nonempty, matching request identifiers.

The subsequent delivery design introduced a one-use claim bound to the exact session and current authority, plus a durable intent before body release. The node commits its own message IDs only on the exact host-kept row witness. A missing result after intent leaves delivery uncertain and blocks blind replay. A positive receipt establishes host admission, with model observation and task completion measured separately. Historical source references: `511cf27` and `bcb582a`.

## Auto mode and exact permissions

One recorded Auto denial explicitly said the hook changed the input after review and the review did not cover the modified call. On 22 November, Linux Mint 22.3 x86_64 with Claude Desktop 6.28899.6 / backend 2.1.330 reproduced denial for `agent_connect` with only `agent_read` allowed. Manual **Allow once**, within the then-current 30-second proof window, completed the exact binding. With exact `agent_connect` and `agent_send` rules added to the isolated project's settings, Auto mode accepted both calls without a new prompt. A separate file-access approval was needed for an attachment outside the workspace in a Manual run. This supports scoped per-tool rules for the observed case, with file access controlled independently. The installed 2.1.319 declarations limited `ToolRequestMeta` to the connector scope and did not establish it as an authority carrier for the regular NCF server. `mcpCall` likewise did not establish the normal user permission path.

### Setup design in the 1.1.0 candidate

Reviewed `codex/release-1.1.0` at `14c8ee6`. Changes `1ba2e80` and `760e891` extend setup from the original `agent_read` rule to ten exact NCF MCP tool rules in the selected Claude Code user `settings.json`. The default-profile **Connect** and manual **Apply** use the same rule set. Setup adds only missing entries and keeps an existing matching configuration byte-for-byte. The allowlist covers ordinary connection, messages, history, attachments, status, discovery and disconnect. Clearing history requires its own approval. No wildcard, shell permission, or attachment filesystem permission is added.

Exact, server-wide, and wildcard `ask` or `deny` rules that match a required tool in the selected file stop the change before writing. Restrictions in other scopes and managed policies still govern the actual client. A disabled plugin or a different marketplace path requires separate confirmation. Exact rules address the observed prompt problem without granting unrelated capabilities or relying on a blanket approval mode.

### Evidence and limits

- Candidate setup checks cover clean settings, upgrades from one and three rules, preview of only the missing rules, identical rules through **Connect** and **Apply**, cancellation, private backups, preservation of unrelated settings and existing matching rules, and refusal before writing on conflicts. The integrated source checks and isolated macOS Electron UI check passed. These checks do not run a live Claude Code conversation.
- A separate historical Linux AppImage built from `7deeff5`, the source of `760e891`, verified all ten rules after a clean **Connect** and checked them with Claude Code 2.1.330 against an isolated synthetic provider. This was an earlier Claude-only package, separate from the combined 1.1.0 candidate.
- The observed live Auto result above covers connect and send in its Linux environment. Live acceptance of the combined 1.1.0 package, live execution of all ten actions, and behavior across other native platforms, merged settings scopes, and managed policies remain unconfirmed.

## Bootstrap on macOS

On `4b18efd` with Node 22.12.0, the same isolated case passed in about 9.7 seconds and failed in about 15.1 seconds across two attempts. In the failing run, the valid lease file was present and the writer lock had disappeared about 0.45 seconds after process start. The helper still reached the 15-second deadline and blocked native initialization. Its waiting path depended on `fs.watch` and rejected on deadline without a final guarded read. The exact reason the notification failed to trigger a successful read was unconfirmed. A bounded periodic recheck and final guarded read addressed that failure mode while preserving rejection for a persistent lock and preserving ownership and nonce checks.

# Codex MCP recovery when native chat access fails (issue 15)

26 November 2026. Baseline `87c069a9c975d73e0dc40422c2cdb3b84eb5a92a`. The Windows investigation previously identified a CLI launch refusal before initialization. See [Windows queue worker execution](windows-codex-queue-msix-execution-20261125.md). This investigation concerns how the agent can proceed when native access fails and its MCP connection remains usable.

## Reproduction

On macOS arm64, a temporary NCF Agent Interconnect node, SQLite store and real HTTP MCP client were connected to a synthetic App Server session. The exact thread and queue probes succeeded. The fixture rejected `thread/items/list`. The stock baseline returned “The saved Codex chat, its input queue or its transcript is unavailable” without a stage or recovery action. The same MCP client then used the saved binding to receive a complete pending message. A second baseline case delivered a single synthetic confirmation, injected the same readiness failure during redemption, restored readiness and retried the original proof. The stock service rejected it as invalid or expired. These baseline assertions were replayed against the unmodified product sources archived from the revision above.

## Repair

The MCP error preserves the operation that failed. A caller that supplied and proved its current binding gets one immediate action, a single service-side `agent_read` for pending mail. The next `agent_connect` on that binding returns to native recovery and revalidates the exact chat and profile. A bounded checkpoint allows multiple transient failures within its original lifetime.

A caller completing a confirmation gets one action, retry the same `agent_connect` in that chat when the failed stage is available. A readiness refusal before binding can reuse the original proof within its existing deadline. Only one concurrent redemption can succeed. An outstanding offer is observed on its original witness; reading its status does not request another confirmation. A caller without a verified mailbox receives no mailbox credential. The MCP response exposes a stage, an action and, for a retained proof, its deadline. It does not echo native errors, paths or proof values.

## Verification and limits

- The regression exercises real MCP error, read and retry calls. It checks complete Unicode content, the processed message ID, the identical binding (including generation), repeated failure on the saved route, one confirmation submission, rejection in another chat, concurrent redemption and rejection of replay after success.
- Fault injection distinguishes session opening, exact thread verification, queue access, history access, transcript verification and active-turn lookup. Existing tests cover uncertain native admission and history-preserving transfer.
- On macOS, the targeted Codex adapter, queue and legacy recovery suites passed 75 checks, skipped seven Windows-only checks and reported zero failures. TypeScript and scoped formatting passed. The App Server faults were injected at the native transport boundary. This change has no installed-build field acceptance. The owner confirmed the separate tab-focus issue was already fixed and removed the Windows focus experiment from scope.

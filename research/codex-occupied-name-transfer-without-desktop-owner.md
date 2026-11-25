# Codex occupied-name transfer without a desktop owner

25 November 2026. A live Codex chat requested a history-preserving transfer of an occupied local name. The workspace source inspected was `d21566c`. The host was macOS 26.5.2 on arm64. Installed bundles in `/Applications` were ChatGPT 26.1120.50957 (30866) and NCF Agent Interconnect 1.0.0 (1.0.6). The active process bundle versions were not established. The local node was running and the existing binding's `codex-desktop` adapter reported `ready`, `exactSession: true` and `receiveActive: true`.

The first `agent_connect` returned `isError: true` with the text `The requested name is already bound. Use its original Codex chat or restore the Desktop integration.` It returned neither a transfer offer nor a confirmation for the requesting chat. A read-only node status check confirmed that the existing binding was still present. No binding credential, alternate chat, reset or repeated connection call was used.

In the inspected `desktop/core/service.ts`, `connectAutomatic` enters `requestCodexRecovery` when desktop owner discovery raises `CodexDesktopUnavailable`. For an occupied name, recovery requires the binding and its saved adapter to match the requesting thread and support queue recovery. A request to move the name to another thread stops before a confirmation or transfer offer is issued. A ready adapter for the existing binding does not establish the Desktop route for the requesting chat. See [client startup recovery](../docs/client-startup-recovery.md) and [live legacy delivery](chatgpt-live-legacy-delivery-macos.md) for the related owner-discovery and same-chat recovery behavior.

The reason owner discovery failed for the live requesting chat remains unverified. No client configuration, binding or history was changed during the incident.

## Release candidate repair for issue #13

Allow a verified destination chat to enter the existing transfer flow after the selected local Codex profile confirms that exact chat through its queue and transcript. The one-use confirmation reaches only the destination. Redeeming it yields a transfer choice while retaining the original binding. Approval verifies the destination again and consumes the existing transfer authorization through the mailbox store. An unsupported queue, exact-chat mismatch, wrong history mode or changed authorization leaves the original binding intact.

The isolated MCP regression uses a synthetic Desktop IPC source and an instrumented queue destination. It verifies rejection of an unknown chat and a misplaced confirmation, preservation of a pending message and its verified attachment before approval, refusal when the destination becomes unavailable, then a history-preserving transfer to the exact destination. Existing regressions cover recovery of the original chat, challenge expiry and replay prevention. Native acceptance on the macOS release candidate remains open.

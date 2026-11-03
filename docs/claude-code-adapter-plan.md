# Claude Code adapter: work plan

Base: `d57e73c7480a0b3f17dc941bc32fafbc0e68bf2f` (published in `codex/next-release`).
Branch: `codex/claude-code-adapter`. The governing documents are the developer
response (revision 2) and the initial specification. Where they differ, the
response wins. Decisions and deviations are in
[claude-code-adapter-decisions.md](claude-code-adapter-decisions.md).

Each step is one or more topical commits on a linear series without merges.

1. **Plan and decisions.** This file and the decision log.
2. **Channel helper skeleton and negotiation fixture.** A stdio helper
   (`desktop/integrations/claude-code.ts`) declares
   `experimental['claude/channel']` and tools. A regression test offers
   protocol `2026-07-28` and asserts that the pinned SDK negotiates
   `2025-11-25` and still declares the channel capability.
3. **Dispatch ledger: `offered`.** A separate commit with a persisted `offered`
   dispatch state and its offer epoch. A wake-only adapter writes
   `offering`, not `dispatching`. After a restart, `offering` becomes a stale
   offer and never becomes `uncertain`. Redispatch excludes current offers and
   re-offers only after a proven transport lifecycle change. Existing
   `uncertain` rows and other adapters are unchanged. Tests cover types,
   selection, system events, restart, saved `dispatching`, new generations and
   diagnostics.
4. **Trusted session context in the core.** This step adds:
   - `kind: 'claude-code'`;
   - a `ClaudeSessions` registry of helper streams, hook records, proofs and a
     persisted route proof;
   - routes `/integrations/claude/{helper,hook,call}`;
   - `ClaudeCodeAdapter` (wake-only, coalescing);
   - a `connectAutomatic` branch, snapshot privacy and an honest
     automatic-delivery status.

   Tests cover:
   - an exact route with two chats in one folder and with two instances;
   - forged and replayed context;
   - startup and session switches;
   - a silently dropped wake with no receipt;
   - offered/coalescing and the pagination race;
   - node restart with a live helper, and helper death.

5. **Helper, hooks and published plugin.** This step adds:
   - stdio proxy, wake notifications, the session-event tool and stream
     reconnection;
   - a hook entry point for SessionStart, SessionEnd and PreToolUse;
   - a local marketplace and plugin published from the installed app into
     `userData/Integrations/claude-code`.

   Tests use real helper and hook processes.

6. **Owner setup.** This step adds:
   - a `claude` setup client with explicit defaults, generator and editor
     branches for the selected Claude Code user `settings.json`;
   - the marketplace, the enabled plugin, and a narrow `agent_read` allow
     rule, applied only after Apply.

   Tests cover Apply, Cancel, no-op, unrelated preservation and IPC.

7. **Renderer and localization.** This step adds:
   - a Claude Code tab and dialog;
   - application status and Applications→MCP navigation;
   - strings in all 15 dictionaries;
   - updated UI tests.
8. **Packaging, verification and documentation.** This step adds:
   - an installed-runtime check of the Claude helper and hooks;
   - `docs/claude-code-adapter.md`;
   - verification limits and an owner-run validation procedure.
9. **Checks and handoff.** Run the full checks, write `VERIFICATION.md`, then
   produce the bundle and patches archive for the integrator.

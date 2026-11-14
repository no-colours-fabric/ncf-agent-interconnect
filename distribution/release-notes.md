## 0.18.2

- Add Claude Code setup with bundled exact-session MCP, lifecycle, native incoming and gate plugins. Only the owner's Apply action updates the selected client settings.
- Deliver a full Incoming message to the model and native conversation: sender, original Unicode body, attachment links and the standard reply instruction. Automatic delivery no longer asks the model to call `agent_read`.
- Persist delivery intent before releasing content and confirm receipt from the exact final native stored row. Explicit MCP reads retain their full-frame receipt boundary. Keep uncertain attempts fenced across restart and transfer without blind replay.
- Preserve queued submissions until admission or a terminal outcome, bound lost delivery attempts, and continue inbox pages without repeated full-backlog scans.
- Add contextual setup help, preserve current Claude authority through same-session compaction and prevent desktop calls from accessing a closed node during shutdown. Retain existing Codex, Cursor and AionUi fixes.
- Include four installers: Apple Silicon DMG, Intel DMG, Windows x64 EXE and Linux x86_64 AppImage.

Quit the app before replacing it. Existing history, bindings, attachments, peers and AionUi authorization are preserved. First start upgrades storage to format 4; older published releases cannot open it. Keep a stopped pre-upgrade profile backup if rollback is required. At an unchanged installation path, existing clients need no new Apply. Reload or restart Claude Code after its installed plugins change.

Claude verification is frontend- and version-specific; the Claude guide records Linux Desktop and terminal evidence separately. Live Claude behavior on macOS and Windows is unverified. The tested terminal auto-mode setup uses owner-saved exact connect/send allow rules through Claude's native `/permissions` UI; Apply adds only the read rule. Existing deny, ask and managed rules retain priority. Unconfigured auto and other tools are not covered by that result. Receipt confirms native stored-row admission or an explicit MCP full-frame handoff, not model acknowledgement or task completion.

Peer protocol 2 and the eleven-tool MCP schema are unchanged. macOS packages are ad-hoc signed without Apple notarization; Windows is unsigned. The Intel package was not run on Intel hardware.

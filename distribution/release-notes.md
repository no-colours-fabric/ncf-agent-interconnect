## 0.18.1

- Add Claude Code setup with bundled exact-session MCP, lifecycle, wake and gate plugins. Only the owner's Apply action updates the selected client settings.
- Render actual returned agent messages as Incoming with sender, original body, attachments and the standard reply instruction. Ctrl+O shows response metadata.
- Persist Claude delivery intent before releasing content; commit receipt after the helper completes its MCP response frame. Keep uncertain attempts fenced across restart and transfer without blind replay.
- Prevent new desktop calls and delayed dialogs from accessing the node after shutdown begins. Retain the current Codex, Cursor and AionUi fixes.
- Preserve current Claude authority through same-session compaction without reviving ended or conflicted sessions.
- Publish a Linux x86_64 AppImage alongside the Apple Silicon DMG, Intel DMG and Windows x64 EXE.

Quit the app before replacing it. Existing history, bindings, attachments, peers and AionUi authorization are preserved. First start upgrades storage to format 4; older releases cannot open it. Keep a stopped pre-upgrade profile backup if rollback is required. At an unchanged installation path, existing clients need no new Apply. Claude Code setup requires Apply and a plugin reload or restart.

Claude Code native evidence is from Linux CLI 2.1.319. The tested auto-mode setup uses owner-saved exact connect/send allow rules through Claude's native `/permissions` UI; Apply adds only the read rule. Unconfigured auto and other tools are not covered. Claude terminal behavior on macOS and Windows is unverified. An earlier candidate's first-resume failure was not reproduced in three bounded later reads; its cause remains unproven. Receipt confirms a local full-frame handoff, not model acknowledgement or task completion. See the Claude guide for exact verification and lifecycle limits.

Peer protocol 2 and the eleven-tool MCP schema are unchanged. macOS packages are ad-hoc signed without Apple notarization; Windows is unsigned. The Intel package was not run on Intel hardware.

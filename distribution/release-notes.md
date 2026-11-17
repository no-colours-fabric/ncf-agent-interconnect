## 0.18.7

- Agents now explains how to connect assistants from chats in AI applications. The application list uses actual local bindings; unknown availability is not presented as a ready connection.
- Manual agent creation remains available through a diagnostic link. Its dialog explains the normal chat connection and diagnostic simulation while preserving name-transfer approval and history guidance. All fifteen interface languages are included.
- Remove the decorative arrow from inline AionUi setup actions. Public supported-application lists explicitly qualify AionUi with Cursor Agent.

Existing messages, files, agents, bindings, paired nodes, client configuration and storage format 5 are retained. Updates from versions before 0.18.6 require a complete stopped pre-upgrade profile backup; older binaries cannot open format 5. Use the normal installer to update the application.

This release does not include LAN discovery, OpenCode v2 or the broader setup redesign. The Windows sleep/resume scenario in issue #1, offer-state warning in issue #2 and the white-window investigation in issue #3 remain separate; this release does not claim to resolve them.

Four installers: Apple Silicon DMG, Intel DMG, Windows x64 EXE and Linux x86_64 AppImage. macOS packages are ad-hoc signed without notarization; Windows is unsigned. Intel runtime execution is not claimed. Platform verification and actual interface images are included in the published release description.

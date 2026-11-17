## 0.18.6

- Prevent a ready incoming message from being released concurrently by native delivery and MCP inbox/history reads. One shared reservation protects the complete message group before files are prepared.
- Record MCP receipt after the full real response write, with current invocation, binding and message checks before body release. Cancelled, partial and uncertain attempts cannot silently become retryable; processed history remains available to its current owner without another receipt.
- Restore compatibility with Codex Desktop thread stream v13 while retaining v11. An exact owner alone no longer makes the adapter ready: a supported exact-chat runtime snapshot is required. Unsupported versions and malformed snapshots show a specific error.

Existing data, agent names, bindings, messages, attachments and paired peers are retained. Storage upgrades to format 5 on first start. Quit NCF and retain a complete stopped pre-upgrade profile backup before updating. Older binaries reject format 5; do not open an upgraded profile with an older app. Rollback requires the stopped backup and must preserve any data created after the upgrade. Client settings need no new Apply when installation paths remain the same.

Receipt is a complete local transport handoff or the existing adapter admission witness, not model acknowledgement or task completion. Peer protocol 2, the eleven MCP tools and client permission rules remain unchanged. Existing Claude frontend/version limits remain; no new live Claude account verification is claimed. The v13 compatibility repair does not by itself close the broader Windows sleep/resume scenario in issue #1. OpenCode v2 and LAN node discovery are not included.

Source and isolated transport checks are reused for unchanged code; package/native outcomes are reported with the published release. Four installers: Apple Silicon DMG, Intel DMG, Windows x64 EXE and Linux x86_64 AppImage. macOS packages are ad-hoc signed without notarization; Windows is unsigned. Intel runtime execution is not required or claimed.

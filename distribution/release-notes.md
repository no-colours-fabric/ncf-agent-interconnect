Verify the native installer/archive against its accompanying checksums. Packages
include Electron 45.1.0 and do not require Node.js, npm or a source checkout.
macOS requires version 13 or later and Apple Silicon; Windows packages target x64.

### Changes in 0.13.0

- Add AionUi integration for the Cursor Agent backend with owner-approved WebUI
  pairing, exact account/chat verification and a bundled MCP bridge. Native
  completion events resume delivery to busy chats without scheduled polling.
- Add an AionUi setup tab in all fifteen languages. Authorization, saved Cursor
  MCP settings and an actually connected bridge have separate status indicators.
  Only Apply changes the selected configuration; matching entries and unrelated
  settings are preserved, with a private backup for changed files.
- Pass current runtime context through literal Cursor environment references.
  No runtime token, account or chat value is stored in the configuration. Missing,
  invalid and unresolved context is rejected with value-free diagnostics.
- Preserve the previous authorization when pairing cannot be saved, support
  cancellation of pending owner approval, and verify runtime proof only through
  the paired WebUI. The package includes `guides/AionUi.md`.
- Add bounded synthetic fixture cleanup and visible-status regressions. Preserve
  message IDs, history, attachments, automatic receipts and uncertain dispatch.

Claude Code integration is planned for a separate release and is not included.

### Upgrade

Quit the existing node before replacing the application. Never open one data
directory in two instances. Storage format 3, peer protocol 2 and the eleven-tool
MCP schema are unchanged. Existing agents, history, attachments and paired routes
remain compatible. Client configuration is not rewritten automatically on upgrade.

For AionUi, pair its loopback WebUI and apply setup for the actual Cursor Agent
configuration. An older preview bridge entry without environment references
requires Apply again, followed by restarting the corresponding agent/MCP host.
The AionUi bridge replaces the ordinary NCF entry in that Cursor file and cannot
be used by Cursor chats outside AionUi; use a separate profile when needed.

Reconnect MCP after updating the app. Restart OpenCode/OpenChamber if its bundled
plugin changed. Upgrades from 0.10.0 or earlier migrate storage formats 1/2
atomically to format 3; back up a stopped node first. Older binaries reject format 3.

### Verification and known limits

The accompanying native platform reports identify the exact source revision,
operating system, architecture and completed runtime/GUI checks. Source tests and
renderer fixtures alone do not constitute native package verification. Automated
checks use temporary profiles, synthetic messages and private attachment fixtures,
without contacting live agents or changing real client configuration.

OpenCode setup targets v1 and rejects detected v2 configuration. Codex Desktop
delivery remains experimental and depends on an existing exact owner handler;
discovery does not initialize an unloaded chat. Standard MCP clients do not
automatically wake idle chats. A setup status does not prove that a client reloaded
its configuration or connected.

AionUi setup supports its Cursor Agent backend and desktop-pairing WebUI on IPv4
loopback. Other AionUi backends, password-mode/remote WebUI and arbitrary vendor
versions are not claimed supported. The inspected vendor baseline is AionUi
2.2.2/Core 0.2.2 and Cursor Agent 2026.10.22-27dcf5f. Synthetic packaged-helper
checks are distinct from a complete live vendor chain or real account switching;
consult the platform reports for the scope actually verified.

macOS packages use an ad-hoc signature without Apple notarization. Windows
packages are unsigned. Interactive installation/uninstallation, Start at login,
native file-picker display and external editor launching are verified only when
the platform report explicitly records those checks.

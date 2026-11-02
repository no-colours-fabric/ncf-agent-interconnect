Verify the native installer/archive against its accompanying checksums. Packages
include Electron 45.1.0 and do not require Node.js, npm or a source checkout.
macOS requires version 13 or later and Apple Silicon; Windows packages target x64.

### Changes in 0.12.0

- Combine local and known remote agents in one table with a contour chat icon,
  confirmed online indicators and compact total/incoming/outgoing message counts.
- Open local chats in a right drawer with avatars, latest messages at the bottom,
  older history above and verified attachment controls. Preserve the visible
  message through pagination and loading-state changes. Keep newer drafts when
  delayed sends finish, and display failed sends in their original chat.
- Simplify remote-node and application tables. Show the application version and
  place language selection above the sidebar node status.
- Add client-specific Cursor, OpenCode v1 and Codex setup tabs and dialogs in all
  fifteen interface languages. Only Apply creates or updates the selected client
  file; matching settings and unrelated options remain unchanged. Changed files
  receive a private backup.
- Remember selected configuration paths and check settings read-only at startup.
  Keep the system open-file icon visible, with guidance when setup must first
  create the file. Present the connection prompt as code with a copy icon.

### Upgrade

Quit the existing node before replacing the application. Never open one data
directory in two instances. Storage format 3, peer protocol 2 and the eleven-tool
MCP schema are unchanged. Existing agents, history, attachments and paired routes
remain compatible. Client configuration is not rewritten automatically on upgrade.

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

macOS packages use an ad-hoc signature without Apple notarization. Windows
packages are unsigned. Interactive installation/uninstallation, Start at login,
native file-picker display and external editor launching are verified only when
the platform report explicitly records those checks.

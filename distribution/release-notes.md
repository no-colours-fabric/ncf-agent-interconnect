Download the macOS Apple Silicon DMG/ZIP or Windows x64 installer/ZIP and verify
the files against SHA256SUMS. Packages include Electron 45.1.0 and do not require
Node.js, npm or a source checkout. macOS requires version 13 or later.

### Changes in 0.11.1

- Fix OpenCode/OpenChamber startup restoration. Plugin loading returns before
  waiting for chat APIs, avoiding a dependency cycle during host initialization.
- Retry temporary saved-chat/API and registration failures. One unavailable chat
  no longer prevents other saved chats from restoring. Deleted or foreign chats
  are not redirected. Stopping the host cancels recovery.
- Preserve existing agent bindings, history, message identities, attachments and
  uncertain admissions. No new polling of working agents or automatic repeat of
  uncertain model input is introduced.
- Add isolated startup/stop regressions and packaged-runtime host-restart checks.

### Upgrade

Quit the existing node before replacing the application. Never open its data
directory in two instances. Storage format 3, peer protocol 2 and the eleven-tool
MCP schema are unchanged from 0.11.0. Existing agents and paired routes remain.

After starting the updated node, reload OpenCode or restart OpenChamber once to
load the corrected bundled plugin. The already running host retains its previous
plugin until it reloads. No client configuration edits or agent-name transfers
are needed for the update.

Upgrades from 0.10.0 or earlier migrate storage formats 1/2 atomically to format 3;
back up a stopped node first. Older binaries reject format 3.

### Verification and known limits

Consult the accompanying native platform reports for the exact source revision
and completed runtime/GUI checks. Automated package checks use temporary profiles
and synthetic messages, not live agents or real client configuration. Manual
macOS OpenChamber validation of the plugin fix is documented separately; it does
not substitute for native Windows verification.

Codex cold-owner initialization is **not fixed** in this release. Discovery finds
an existing exact handler but does not load an unloaded desktop chat. Recovery
once a handler exists is tested separately. A manually activated PING/ACK matrix
does not prove unattended startup or MCP-tool restoration by the client.

macOS packages are ad-hoc signed without Apple notarization. Windows packages are
unsigned. Interactive installation/uninstallation and Start at login remain
manual checks unless a platform report explicitly records otherwise.

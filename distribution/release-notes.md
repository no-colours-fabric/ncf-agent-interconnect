## 0.18.4

- Keep uncertain native delivery fenced when an agent name moves to a new chat with its history. A transfer no longer makes a possibly admitted message eligible for another automatic release.
- Wait for an old in-flight delivery to finish. Definite pre-release failures can resume the transferred backlog without another idle event; late revoked results preserve uncertainty.
- Add the standalone adapter development manifest for external contributors, with required behavior and conditional host-specific techniques.

Ten new isolated regressions cover transfer, late completion, restart and safe retry. Previously accepted client exchanges are reused; no new live Claude, Cursor, Codex or OpenCode account scenario is claimed for this fix. Receipt remains separate from task completion.

Storage format 4, peer protocol 2, the eleven-tool MCP schema, settings and permissions are unchanged. Quit NCF before replacing it. Existing data, bindings, attachments and peers are retained; no new Apply is needed when installation paths remain the same. Releases before 0.18.2 cannot open storage format 4, so rollback to them requires a stopped pre-upgrade backup.

Known limits remain: the general MCP response-handoff and shared native/MCP reservation gaps are not fixed in this release; Cursor's admission marker and the OpenCode v1 host-witness limitation remain separate. OpenCode v2 and installed-application discovery are still in development and are not included. Live Claude evidence remains specific to the previously verified Linux frontend; macOS/Windows live Claude and Intel runtime execution are not verified.

Four installers: Apple Silicon DMG, Intel DMG, Windows x64 EXE and Linux x86_64 AppImage. macOS packages are ad-hoc signed without notarization; Windows is unsigned. Platform package and smoke results are reported with the published release.

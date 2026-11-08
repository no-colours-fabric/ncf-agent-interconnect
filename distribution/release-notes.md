## 0.17.3

- Fix delivery for large Codex Desktop chat snapshots. The adapter assembles a complete frame before parsing JSON and accepts frames up to a fixed 128 MiB limit instead of the former 32 MiB limit.
- Resume queued delivery when readiness arrives during a failed dispatch. Requests whose admission is uncertain remain pending and are not replayed automatically; receipt still requires confirmed admission.

Quit NCF Agent Interconnect from its tray menu before replacing it, then start the updated app. Updating from 0.17.2 at the same installation path needs no new Apply or agent connection. Existing bindings, history, attachments, peer settings and AionUi authorization are preserved. If the installation path changes, update affected client paths through their setup dialog and Apply.

Codex Desktop integration remains experimental and version dependent. Synthetic source and package checks are separate from live-client validation; delivery to the affected working Codex chat was not tested in this release cycle. Cursor and AionUi verification limits from earlier releases remain unchanged.

Storage format 3, peer protocol 2 and the eleven-tool MCP schema are unchanged. macOS packages are ad-hoc signed without Apple notarization; Windows is unsigned. The Intel package was not run on Intel hardware.

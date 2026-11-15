## 0.18.3

- Remove Claude's explanatory plugin prefix and suffix from native Incoming messages. Preserve the complete original body, sender, attachment links and reply instruction.
- Keep engine-owned plugin provenance and exact session authority. Native receipt also requires the whole canonical body block to match the node-sealed envelope before and after storage; wrapped or rewritten content stays uncertain rather than receiving a positive receipt.

Queued delivery, restart and transfer fences, MCP tools, permissions, settings and storage format 4 are unchanged from 0.18.2. Existing data and bindings are preserved. Quit NCF before replacing it, then reload the Claude plugins with `/reload-plugins` and reconnect MCP in the intended chat. Preserve unsent drafts. NCF does not add broader permission rules.

Releases before 0.18.2 cannot open storage format 4. Retain a stopped pre-upgrade backup when upgrading from them. Receipt confirms exact native row admission, not model acknowledgement or task completion. Verification and frontend limits are recorded in the Claude guide; historical framed evidence is separate from this change. Live Claude behavior on macOS and Windows and Intel runtime execution remain unverified.

Four installers are provided: Apple Silicon DMG, Intel DMG, Windows x64 EXE and Linux x86_64 AppImage. macOS packages are ad-hoc signed without notarization; Windows is unsigned.

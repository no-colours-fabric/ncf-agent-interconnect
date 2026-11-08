## 0.17.1-preview.1

Local Windows preview for owner verification; not a published release.

- Fix the Cursor Windows PowerShell hook command so the host pipeline preserves UTF-8 JSON and the helper exit code.
- Share one MCP connection between direct Cursor and Cursor Agent in AionUi. The direct plugin and AionUi authorization remain separate.
- Clarify the shared configuration in both setup tabs and dialogs across all fifteen languages.

Quit NCF Agent Interconnect before replacing it. Open Cursor setup in the preview and click Apply to regenerate its managed hooks, then reload the integration as required by Cursor. Existing chat history and peer settings are preserved.

The command regression passed on Windows PowerShell. Actual Cursor native acceptance for this combined preview is pending owner testing. The Windows installer is unsigned.

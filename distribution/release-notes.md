## 0.17.0

LLM-optimized documentation: [llms.txt](../llms.txt).

- Direct Cursor setup now installs the included reactive local plugin through
  the existing Apply dialog, using the application runtime without system Node.js.
- Exact open chats can receive messages in the IDE and Agents Window while
  unselected. An ordinary message restores delivery after a window reload.
- Updated Cursor metrics, fifteen-language setup guidance and user documentation.

Quit the application before replacing it. Existing agents, history, attachments
and client configuration are preserved; storage format 3 and peer protocol 2
are unchanged. Apply Cursor setup and restart Cursor once to load the plugin;
keep connected chat tabs open.

Cursor native delivery was checked on macOS Cursor 3.28.7 with a temporary
workspace plugin. Windows Cursor 3.27.22 source UI Cancel/Apply passed; native
delivery was not verified because scoped UI automation was blocked. A full
Cursor application Quit/restart was not tested. Existing Cursor Agent through
AionUi passed on macOS; its Windows native check was not run.

macOS packages are ad-hoc signed without Apple notarization; Windows is unsigned.
The Intel package was not run on Intel hardware. Claude Code is not included.

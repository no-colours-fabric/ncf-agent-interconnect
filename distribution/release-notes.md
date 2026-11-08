## 0.17.2

- Restore an existing Cursor chat after a restart with one ordinary message. Its binding is preserved; another `agent_connect` or `agent_read` call is unnecessary. Delivery stays recovering until the turn completes and its reactive wait is armed.
- Show restored Cursor chats as available while their exact wait is active, and withdraw that availability when the wait ends.
- Refresh current node display names on authenticated connection, reconnection and live rename. Compatible peers save the new name without changing node identity, authorization or agent bindings. Older peers without this capability keep their known name.

Quit NCF Agent Interconnect before replacing it, then start the updated app. In each previously connected Cursor chat, send one ordinary message and let its response finish. Keep the tab open. When the installation path is unchanged, updating from 0.17.1 does not require another Apply or reconnect. If the app path changes, use Cursor setup and Apply to update its paths. Earlier Cursor installations still need their setup steps. Existing history, attachments, peer settings and AionUi authorization are preserved.

Source and package checks are separate from native Cursor UI validation. A new full Cursor application Quit/restart check was not run for this release. Earlier direct Cursor and AionUi exchanges do not extend that verification scope.

macOS packages are ad-hoc signed without Apple notarization; Windows is unsigned. The Intel package was not run on Intel hardware.

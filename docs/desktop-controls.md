# NCF Agent Interconnect settings and monitoring

LLM-optimized documentation: [llms.txt](../llms.txt).

Use the NCF Agent Interconnect window for setup and monitoring. Configure connections and check their state and message delivery here. Discuss tasks and results with your AI assistants in their usual chats.

The **Agents** page shows local agents and known agents on paired computers. You can view a local agent's messages and files, or delete one or all local agents along with their history. Start with the [user guide](usage.md) or the [first-connection instructions](setup.md).

## Agents and messages

**Agents** shows local agents and known agents on paired computers. Use a local agent's chat icon to open its message history and send a message from the app. A remote agent's chat icon opens a send-only message view with that agent and computer fixed as the recipient; choose which local agent sends it. Replies in an AI chat are normally handled by the agent without you copying an address.

Only confirmed online clients receive the online indicator. An unknown or unavailable state does not prove that an agent cannot receive a queued message later. New-message counts refer to messages the agents have not yet received. They do not track completed tasks.

Messages and verified incoming file copies remain in the app's history across restarts. To attach outgoing files, first allow their folders in **Settings**. A message can include up to 16 files of at most 100 MiB each. Incoming files can be opened or saved from the app or through links delivered to a supported chat.

## Remove local agents and history

On **Agents**, use a local row's delete control for one agent, or **Delete all local agents and history** for every agent on this computer. Review the confirmation: it lists the affected agents and message counts. Confirming removes their local NCF Agent Interconnect records and history and revokes their chat bindings. Cancel leaves them intact. If the data changes before confirmation, review a fresh preview.

This action does not remove agents on other computers, AI application chat transcripts, remote copies or messages already submitted elsewhere. New incoming messages can create new unbound mailboxes. For a move to another chat that should preserve history, use the [transfer choice](usage.md#files-replies-and-history) when connecting the name there.

## Connections, appearance and language

**Applications & MCP** shows saved application configuration and known activity. Authorization, configuration and a live chat connection can have separate states. After a restart, send one ordinary message in the same previously connected Cursor chat. Delivery remains recovering during that turn and becomes ready after the turn completes and the reactive wait is armed; another message, connection or read request is not required. The setup check reads client files; only your Apply action in a Configure dialog updates the selected file.

**Remote nodes** manages explicitly paired computers and their connection state. **Settings** includes this computer's display name, local network address, outgoing file folders and optional Start at login. Compatible paired computers receive the current display name on authenticated connection or reconnection and when you rename this computer while connected. The saved remote name changes without changing its node identity, authorization or agent bindings. Older peers without this capability keep their known pairing name until they support an update. Closing the window leaves the app in the tray; Quit stops the node and its connections.

Use the language selector at the bottom of the sidebar. The app saves the choice in its profile and supports English, Russian, Simplified Chinese, French, German, Italian, Spanish, Kazakh, Japanese, Brazilian Portuguese, Korean, Turkish, Polish, Dutch and Ukrainian. Agent names, message text and filenames keep their original language. The app also saves light or dark appearance. If profile storage is unavailable, a language change lasts only for the current session.

For data locations, credentials and removal, see [privacy and storage](privacy.md).

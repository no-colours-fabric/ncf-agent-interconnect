# NCF Agent Interconnect settings and monitoring

LLM-optimized documentation: [llms.txt](../llms.txt).

Discuss tasks and results in the AI chats you already use. The NCF Agent Interconnect window provides application connection settings, computer pairing, delivery status and message history for diagnostics and administration. Its history views and manual message controls support troubleshooting; assistants connect by request in their AI chats, without per-agent configuration in this window.

## Agents and messages

**Agents** starts with a guide to connecting assistants from their AI chats and a connection request you can copy. It shows local agents and known agents on paired computers. Use a local agent's chat icon to open its message history and send a message from the app. A remote agent's chat icon opens a send-only message view with that agent and computer fixed as the recipient; choose which local agent sends it. Replies in an AI chat are normally handled by the agent without you copying an address.

For ordinary work, open a chat in a configured AI application, choose a name and role for its assistant, and ask it there to connect under that name. The connected chat then appears on **Agents**; you do not need to create its agent in this window first.

The **For diagnostics: Create an agent manually** link remains available on **Agents**. It opens the name dialog and creates a local mailbox without connecting an AI chat. Afterward, ask the assistant in a configured chat to connect under the same name. The dialog warns when that name is also used on a paired computer, and the app's manual controls can simulate agent activity for diagnostics. If a name is already bound to another local chat, connecting a different chat still requires your explicit transfer and history choice; manual creation does not bypass that decision.

Only confirmed online clients receive the online indicator. An unknown or unavailable state does not prove that an agent cannot receive a queued message later. New-message counts refer to messages the agents have not yet received. They do not track completed tasks.

Incoming messages presented to supported agents include **From**, **Sent**, **Delivered** and **Reply-To** with the sender's name. **Sent** is the envelope creation time; **Delivered** is recorded when the receiving app constructs the incoming message or read result. Dates use the receiving app's system locale and time zone, display seconds and omit an offset. These are display values, not proof of receipt, model acknowledgement or task completion.

Messages and verified incoming file copies remain in the app's history across restarts. To attach outgoing files, first allow their folders in **Settings**. A message can include up to 16 files of at most 100 MiB each. Incoming files can be opened or saved from the app or through links delivered to a supported chat.

## Remove local agents and history

On **Agents**, use a local row's delete control for one agent, or **Delete all local agents and history** for every agent on this computer. Review the confirmation: it lists the affected agents and message counts. Confirming removes their local NCF Agent Interconnect records and history and revokes their chat bindings. Cancel leaves them intact. If the data changes before confirmation, review a fresh preview.

This action does not remove agents on other computers, AI application chat transcripts, remote copies or messages already submitted elsewhere. New incoming messages can create new unbound mailboxes. For a move to another chat that should preserve history, use the [transfer choice](usage.md#files-replies-and-history) when connecting the name there.

## Connections, appearance and language

**Applications** in the sidebar shows detected applications, saved configuration and known activity. Newly detected applications can appear in startup setup cards. For a detected application, **Connect** uses the default configuration target; a replacement requires a file preview and your explicit **Apply** confirmation. **Manual setup** keeps the client-specific file chooser, preview and **Apply** action. Detection does not verify compatibility, saved configuration or chat readiness. OpenCode v2 is shown first, while **Show OpenCode v1** retains its separate setup; OpenCode detection proves neither version is ready. AionUi setup covers Cursor Agent only. Authorization, configuration and a live chat connection can have separate states.

After a restart, send one ordinary message in the same previously connected Cursor chat. Delivery remains recovering during that turn and becomes ready after the turn completes and the reactive wait is armed; another message, connection or read request is not required.

**Remote nodes** shows this computer's actual enabled connection address and temporary code, nearby search results and explicitly paired computers. If no eligible listener is available, it shows no listening address rather than a stale endpoint. Create a code while the node is running. Opening the window starts one 30-second search on the local IPv4 network. **Stop search** retains results already found; **Search again** retries. An unseen-result count appears in the sidebar until the results are viewed. Reported addresses for one claimed node identity appear together in its details; the same name with a different identity stays separate. A result remains unverified until you select its exact address and pair using the other computer's code. **Connect by address** remains available if search fails or misses a computer. Search does not create a network route or hosted relay.

**Settings → Network settings** shows the assigned local IPv4 addresses. By default, the app listens on all eligible addresses; you can exclude an interface and **Save** to remove its addresses from this app's listeners. This does not disable the adapter or change the system firewall. An absent or ambiguously matched interface needs review in the technical details; exclusions can be removed. MCP remains on `127.0.0.1`. **Settings** also includes **Computer name**, outgoing file folders and optional Start at login. Compatible paired computers receive the current display name on authenticated connection or reconnection and when you rename this computer while connected. The saved remote name changes without changing its node identity, authorization or agent bindings. Older peers without this capability keep their known pairing name until they support an update. Closing the window leaves the app in the tray; Quit stops the node and its connections.

Use the language selector at the bottom of the sidebar. The app saves the choice in its profile and supports English, Russian, Simplified Chinese, French, German, Italian, Spanish, Kazakh, Japanese, Brazilian Portuguese, Korean, Turkish, Polish, Dutch and Ukrainian. Agent names, message text and filenames keep their original language. The app also saves light or dark appearance. If profile storage is unavailable, a language change lasts only for the current session.

For data locations, credentials and removal, see [privacy and storage](privacy.md).

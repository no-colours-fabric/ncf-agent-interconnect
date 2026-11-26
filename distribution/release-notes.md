# NCF Agent Interconnect 1.1.0

## Application setup

- When you choose **Connect** or **Apply** for Claude Code or OpenCode, setup adds only the missing permissions for routine NCF Agent Interconnect actions. Existing restrictions still apply. If a rule in the selected profile conflicts, setup explains the conflict before saving changes.
- OpenCode v2 can deliver messages and attachments to their connected chats when several project directories are open in one OpenCode process. Its setup shows whether the plugin has connected.
- At startup, NCF Agent Interconnect offers setup for the detected OpenCode major version. If the version is unknown, choose v1 or v2. **Applications** still shows OpenCode v1 setup when a v1 configuration or installation is detected.
- In **Applications → ChatGPT**, choose **Connect** to set up the profile and turn on **Background chat delivery**.
  - **macOS:** Choose **Home** or **Work** if offered. If you see **Restart ChatGPT**, select **Got it**, then quit ChatGPT completely and reopen it.
  - **Windows:** Use the default profile. Quit ChatGPT completely before turning background delivery on or off, then reopen it.
  - Use the settings gear for **Manual setup**.
- Use the power button next to **Running** or **Stopped** in the sidebar to start or stop the local node.

Message and attachment delivery was verified with the official OpenCode CLI versions **2.2.5**, **2.3.0**, **2.3.2**, and **2.4.2** on Apple Silicon macOS, and **2.3.2** and **2.4.2** in an emulated Linux/amd64 Docker environment. Both used isolated profiles and a local test model. OpenCode Desktop and Windows CLI delivery were outside these checks.

## Agents and message history

- In **Agents**, click **Name**, **Application**, **Node**, **Last message**, **Messages**, or **Attachments** to sort by that column. Click the same header again to reverse the order.
- In **Agents**, the **Application** group shows the app icon in a narrow cell and the app name in the next cell. If the app is unknown, the group shows only a boxed **?**, labeled “Unknown application” for accessibility.
- Rename a local agent from its already connected chat when the integration can verify that chat. You can also choose **Rename agent** in **Agents**. The connected chat, history, pending messages and attachments stay with the agent.
- When moving an existing agent name to another ChatGPT chat, the move can still proceed if the first check fails and the new chat receives and confirms the connection request. The existing connection and history stay in place until you approve the move.
- The **Sent** and **Delivered** times in incoming messages follow the receiving computer’s regional format.
- In a local agent’s history, use **Attachments only** to find messages with attachments, including messages whose files are now unavailable. Turn off the filter to see all messages. History keeps the message and marks any unavailable file.
- NCF Agent Interconnect automatically removes unchanged temporary source files it created for transfer once delivery to the receiving agent is recorded. Working files and files still awaiting delivery are kept.
- In **Settings → Storage**, the **Attachments** row shows the total space used by received attachments. Choose **Remove received attachments**, select **7, 30, 90, or 365 days** or **All**, then confirm. In **Agents**, the **Attachments** column shows storage used by each local agent. Use the same action and age choices in a local agent’s row to remove eligible files for that agent. The displayed size and history refresh after cleanup. Removed files remain listed by name as unavailable, and separately saved files are kept.
- **Settings → Attachment size limit** applies to each outgoing file. The default is **1 GiB**, and you can change or turn it off. Receiving files is independent of this setting. A message can stay queued if a computer running an older version applies a lower receiving limit.

## Paired computers

- In **Remote nodes**, choose **Disconnect** and confirm to end a pairing. Compatible connected computers remove the pairing on both sides and keep their local agents and message history. Pair the computers again to reconnect.
- When **Request approval** is available, compare the six-digit request code shown on both computers. Choose **Confirm** on the receiving computer only if the codes match. The computer that sent the request waits for the receiver’s approval. If it runs an older version and still shows **Confirm**, confirm there as well. You can still pair by entering the receiving computer’s temporary connection code.
- Fixed the cursor position when editing an address under **Remote nodes**.

## ChatGPT compatibility

Background chat delivery works with supported ChatGPT profiles on macOS and Windows. With the setting on, an eligible connected chat can receive an incoming message while ChatGPT is responding. If an eligible connected chat is no longer open, background delivery can also resume it without you switching to it.

Without background delivery, incoming messages on ChatGPT versions newer than **26.1111.71704** may stay queued until the current reply ends or the next turn begins.

See [our delivery regression report in OpenAI Codex issue #63680](https://github.com/openai/codex/issues/63680) for the behavior we observed and the results of our checks. The [related discussion in OpenAI Codex issue #51625](https://github.com/openai/codex/issues/51625#issuecomment-7135067258) requests a supported way to send messages during an active turn.

When NCF Agent Interconnect detects a version of ChatGPT newer than **26.1111.71704** and background delivery is off, the ChatGPT card in **Overview** and **Applications** warns that messages may stay queued. Use the **Background chat delivery** switch in the warning when available. If ChatGPT needs setup and **Connect** is available, the switch starts that setup.

- [Apple Silicon Mac — ChatGPT 26.1111.71704](https://persistent.oaistatic.com/codex-app-prod/ChatGPT-darwin-arm64-26.1111.71704.zip)
- [Windows x64 — ChatGPT 26.1111.71704 (MSIX package 26.1111.9664.0)](https://persistent.oaistatic.com/codex-app-prod/releases/26.1111.9664.0/ChatGPT-x64.msix)

If messages stay queued, open the connected chat. The installed ChatGPT quit-and-reopen flow is still awaiting verification on macOS and Windows.

## Cursor delivery after restart

After Cursor restarts or reloads, send an ordinary message in the same connected Cursor chat and let the turn finish. Keep the chat open while you work.

## Updating

Before updating, quit NCF Agent Interconnect and back up its complete local profile, including history and attachments. Version 1.1.0 changes the profile format. To return to 1.0.0, restore the backup you made before updating. Save any work created after the update that you want to keep.

If the Windows installer asks you to close connected applications, close the listed apps and click **Retry**. The installer can stop its own idle background service. A running service from an older build can still block the first upgrade.

# NCF Agent Interconnect 1.1.0

## Application setup

- When you choose **Connect** or **Apply** for Claude Code or OpenCode, setup adds only the missing permissions for routine NCF Agent Interconnect actions. Existing restrictions still apply. If a rule in the selected profile conflicts, setup explains the conflict before saving changes.
- **Applications** shows OpenCode v1 setup by default when it detects a v1 configuration or installation. OpenCode v2 setup remains available.

Live message delivery in OpenCode v2 remains unverified for this release.

## Agents and message history

- In **Agents**, click **Name**, **Application**, **Node**, **Last message**, **Messages**, or **Attachments** to sort by that column. Click the same header again to reverse the order.
- In **Agents**, the **Application** column shows a separate icon for each known app. Hover over it to see the app name. A **?** indicates an unknown application, for example when a paired computer does not report it.
- Rename a local agent from its already connected chat when the integration can verify that chat. You can also choose **Rename agent** in **Agents**. The connected chat, history, pending messages and attachments stay with the agent.
- When moving an existing agent name to another ChatGPT chat, the move can still proceed if the first check fails and the new chat receives and confirms the connection request. The existing connection and history stay in place until you approve the move.
- The **Sent** and **Delivered** times in incoming messages follow the receiving computer’s regional format.
- In a local agent’s history, use **Attachments only** to find messages with attachments, including messages whose files are now unavailable. Turn off the filter to see all messages. History keeps the message and marks any unavailable file.
- NCF Agent Interconnect automatically removes unchanged temporary source files it created for transfer once delivery to the receiving agent is recorded. Working files and files still awaiting delivery are kept.
- **Settings → Received attachments** shows local attachment storage by agent. Choose an age of **7, 30, 90, or 365 days** to remove eligible received files. In **Agents**, the **Attachments** column shows storage used by each local agent. Choose **Remove received attachments** in the local agent’s row to remove eligible files for that agent. The displayed size and history refresh after cleanup. Removed files remain listed by name as unavailable, and separately saved files are kept.
- **Settings → Attachment size limit** applies to each outgoing file. The default is **1 GiB**, and you can change or turn it off. Receiving files is independent of this setting. A message can stay queued if a computer running an older version applies a lower receiving limit.

## Paired computers

- In **Remote nodes**, choose **Disconnect** and confirm to end a pairing. Compatible connected computers remove the pairing on both sides and keep their local agents and message history. Pair the computers again to reconnect.
- When **Request approval** is available, compare the six-digit request code shown on both computers. Choose **Confirm** on each computer only if the codes match. You can still pair by entering the receiving computer’s temporary connection code.

## ChatGPT compatibility

For stable real-time messaging, stay on ChatGPT app version **26.1111.71704** or earlier. On newer versions, incoming messages may stay queued until the current reply ends or the next turn begins.

See [our delivery regression report in OpenAI Codex issue #63680](https://github.com/openai/codex/issues/63680) for the behavior we observed and the results of our checks. The [related discussion in OpenAI Codex issue #51625](https://github.com/openai/codex/issues/51625#issuecomment-7135067258) requests a supported way to send messages during an active turn.

During setup, NCF Agent Interconnect may warn about delivery delays if your ChatGPT version is newer or cannot be determined.

- [Apple Silicon Mac — ChatGPT 26.1111.71704](https://persistent.oaistatic.com/codex-app-prod/ChatGPT-darwin-arm64-26.1111.71704.zip)
- [Windows x64 — ChatGPT 26.1111.71704 (MSIX package 26.1111.9664.0)](https://persistent.oaistatic.com/codex-app-prod/releases/26.1111.9664.0/ChatGPT-x64.msix)

If a connected chat stays closed after a restart and messages are missing,
open that chat.

## Cursor delivery after restart

After Cursor restarts or reloads, send an ordinary message in the same connected Cursor chat and let the turn finish. Keep the chat open while you work.

## Updating

Before updating, quit NCF Agent Interconnect and back up its complete local profile, including history and attachments. Version 1.1.0 changes the profile format. To return to 1.0.0, restore the backup you made before updating. Save any work created after the update that you want to keep.

If the Windows installer asks you to close connected applications, close the listed apps and click **Retry**.

# NCF Agent Interconnect 1.1.0

## Application setup

- When you choose **Connect** or **Apply** for Claude Code or OpenCode, setup adds only the missing permissions for routine NCF Agent Interconnect actions. Existing restrictions still apply. If a rule in the selected profile conflicts, setup explains the conflict before saving changes.
- **Applications** shows OpenCode v1 setup by default when it detects a v1 configuration or installation. OpenCode v2 setup remains available.

Live message delivery in OpenCode v2 remains unverified for this release.

## Agents and message history

- In **Agents**, click **Name**, **Application**, **Node**, **Last message**, or **Messages** to sort by that column. Click the same header again to reverse the order.
- The **Application** column shows the name and icon for known apps used by local and remote agents. If a paired computer doesn’t report the app, the column shows **Unknown application**.
- In **Agents**, choose **Rename agent** to change a local agent’s name and keep its connected chat and history.
- When moving an existing agent name to another ChatGPT chat, the move can still proceed if the first check fails and the new chat receives and confirms the connection request. The existing connection and history stay in place until you approve the move.
- The **Sent** and **Delivered** times in incoming messages follow the receiving computer’s regional format.
- Message history remains readable when an attachment is unavailable. The history marks the affected attachment as unavailable.
- Use **Settings → Temporary attachments** to remove temporary source files and received copies that the app recognizes as eligible after delivery. Working files and files awaiting delivery are kept. History keeps the messages and attachment names and marks removed copies as unavailable.
- Use **Settings → Attachment size limit** to change or turn off the per-file limit, which defaults to **1 GiB**. If an attachment exceeds the receiving computer’s limit, the message stays queued.

## Paired computers

- In **Remote nodes**, use **Remove node** and confirm to remove a selected paired computer. Pair it again to reconnect.
- When approval is available, choose **Request approval** and confirm the request on the receiving computer. You can still pair by entering the receiving computer’s code.

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

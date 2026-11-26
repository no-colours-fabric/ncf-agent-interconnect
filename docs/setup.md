# Set up NCF Agent Interconnect

LLM-optimized documentation: [llms.txt](../llms.txt).

First install NCF Agent Interconnect and configure the AI application you use. The application-specific guides cover ChatGPT, Claude Code, Cursor, OpenCode and AionUi with Cursor Agent; their support limits differ. Then connect assistants by name in their AI chats to work on a shared task. Each additional agent needs no separate setup. Pair another computer only if you need to work across computers on your local network.

## 1. Install and start NCF Agent Interconnect

Download the installer for your computer from the [latest release](https://github.com/no-colours-fabric/ncf-agent-interconnect/releases/latest): arm64 DMG for Apple Silicon Mac, x64 DMG for Intel Mac, x64 EXE for Windows or x86_64 AppImage for Linux. On a Mac, open the DMG and drag NCF Agent Interconnect into Applications. On Windows, run the installer. On Linux, make the AppImage executable and run it. Packages contain the runtime; you do not need development tools for the provided installers.

Start NCF Agent Interconnect. Keep it running while agents exchange messages. Use the power button next to **Running** or **Stopped** in the sidebar to start or stop the local node. Closing the window leaves it running in the tray; use the tray's Quit command to stop it. [Installation and updates](installation.md) has platform details.

## 2. Choose an application

On **Connect your apps**, choose an application or select **Not now**. You can return to **Applications** from the sidebar, use **Refresh** to check again or use **Choose installation** to locate an app manually.

If an application shows **Not found in known locations** or **Unknown**, expand **Locations checked** or choose its installation manually. For OpenCode use the setup for the version you installed. The **OpenCode v1** switch shows the separate v1 setup. For Claude Desktop, check that your setup uses a compatible Claude Code backend.

For a detected application, select **Connect** from its startup card or under **Applications**. If the app asks to replace existing settings, review the selected file and change preview, then choose **Apply** or **Cancel**. Follow **Next step** to reconnect or restart the application and connect its chat.

For another installation or profile, use **Manual setup** and the client-specific Configure dialog. Check the full configuration path, use **Choose file** if needed, review the preview and click **Apply**. Cancel does not write. Unrelated settings are preserved and an already matching NCF Agent Interconnect entry is left alone. Detection, saved configuration and a live chat connection are separate states.

After Connect or Apply, restart Cursor once to load its included plugin, or restart the selected OpenCode version after setup. For ChatGPT, follow the [profile and restart steps](mcp-clients.md#codex-desktop). Restart Claude Code or reload its plugins. For AionUi with Cursor Agent, follow its [separate owner authorization and Cursor Agent bridge setup](aionui-setup.md). Saved settings alone do not mean that an agent chat is connected or that its plugin is running.

| Application                         | What to expect after setup                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| OpenCode with the bundled v1 plugin | Restart after setup. Busy chats receive messages when they become idle.                                                      |
| OpenCode v2                         | Use the separate v2 setup, restart OpenCode and connect in the intended chat. Live v2 delivery has not yet been verified.    |
| ChatGPT                             | Choose your profile if prompted and follow the [ChatGPT setup](mcp-clients.md#codex-desktop) restart steps.                  |
| Cursor                              | Restart Cursor after setup. For restart recovery in a connected chat, see [Cursor setup](mcp-clients.md#cursor).             |
| AionUi with Cursor Agent            | Use Cursor Agent in AionUi and complete its authorization and setup.                                                         |
| Claude Code with compatible mods    | Restart Claude Code or reload its plugins. See [Claude setup](mcp-clients.md#claude-code) for permissions and compatibility. |
| Other compatible MCP clients        | Ask the assistant to check for messages if its application does not deliver them automatically.                              |

The [application-specific guide](mcp-clients.md) covers setup choices and compatibility limits.

## 3. Connect a chat

In the configured AI application, open a normal chat. Choose a name for its assistant and ask it to connect under that name. For example, after agent Sam defines search requirements in one chat in ChatGPT, ask in a second: “Connect as agent Nora. Build search using agent Sam’s requirements.” Ask Nora to clarify open questions with Sam. This is an ordinary chat request, not required command syntax; choose your own name, task and collaborator. Once the application or profile is configured, each new chat needs no separate per-agent configuration. Use a different name for each simultaneous agent on the same computer. A substantive reply about the work is a better end-to-end check than a saved configuration indicator.

If the name is already connected to another chat, the new chat will ask whether to transfer it with its local MCP history or start fresh by deleting that history. Choose explicitly. See [moving an agent](usage.md#files-replies-and-history) before choosing the destructive option.

## 4. Connect another computer, if needed

Start NCF Agent Interconnect on both computers and open **Remote nodes**. Check that the receiving computer shows an enabled connection address. If it does not, review excluded interfaces under **Settings → Network settings**. Opening the window starts a 30-second search. Use **Stop search** or **Search again** as needed. Select the intended computer and address from the search results, or use **Connect by address** if search misses it.

- **Request approval:** If this option is available, open the request on both computers. Compare all six digits, including any leading zero. Choose **Confirm** on both computers only if the codes match and you recognize the other computer. If the codes differ, cancel the request.
- **Enter a connection code:** On the receiving computer, create a temporary connection code. Enter it on the computer starting the connection. Keep it private. It has eight characters, expires after ten minutes and authorizes one pairing.

Review paired computers under **Remote nodes**. To end a pairing, select that computer, choose **Disconnect** and confirm. If the other computer is offline or runs an older version, it may still show the saved pairing. To reconnect, pair the computers again.

The computers must be able to reach each other at the address you use. Once paired, specify the destination computer when asking an agent to contact someone whose name appears on both computers. Saved pairings reconnect without a new code. See the [engineering reference](pairing.md) for technical details.

## Check a problem in order

1. Confirm that the NCF Agent Interconnect app is running on each involved computer.
2. In **Applications**, check the selected profile. If the ChatGPT warning says background delivery is off, use its switch when available. If messages are still missing after a restart, open the connected chat. After a restart, send one ordinary message in the same previously connected Cursor chat and let that turn finish.

   Without background delivery, incoming messages on ChatGPT versions newer than **26.1111.71704** may stay queued until the current reply ends or the next turn begins. See [ChatGPT compatibility and downloads](mcp-clients.md#codex-desktop).

3. In the intended chat, confirm that the assistant connected under the name you chose.
4. For another computer, check its pairing and connection under **Remote nodes**. If discovery finds nothing, check that the other app is running, an enabled IPv4 endpoint is shown, and the two computers can reach each other; review any excluded interfaces and use **Connect by address** if needed. Identify the intended computer if names repeat.
5. Ask for a reply about the task. If messages still have not arrived, check the intended chat and message history before asking the assistant to resend.

Once connected, follow [working with agents from your chats](usage.md). For data retained by the app and AI clients, see [privacy and storage](privacy.md).

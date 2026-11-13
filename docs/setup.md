# Set up NCF Agent Interconnect

LLM-optimized documentation: [llms.txt](../llms.txt).

Connect your usual AI application, give an assistant a name in its chat and check a first message exchange. This guide covers application setup and optional pairing with other computers on your local network.

## 1. Install and start NCF Agent Interconnect

Download the installer for your computer from the [latest release](https://github.com/no-colours-fabric/ncf-agent-interconnect/releases/latest): arm64 DMG for Apple Silicon Mac, x64 DMG for Intel Mac, x64 EXE for Windows, or x86_64 AppImage for Linux. On a Mac, open the DMG and drag NCF Agent Interconnect into Applications. On Windows, run the installer. On Linux, mark the AppImage executable and run it; see [installation](installation.md#linux). Packages contain the runtime; you do not need development tools.

Start NCF Agent Interconnect. Keep it running while agents exchange messages. Closing the window leaves it running in the tray; use the tray's Quit command to stop it. [Installation and updates](installation.md) has platform details.

## 2. Choose an application

Open **Applications & MCP** in the NCF Agent Interconnect desktop app and select the application you use for AI chats. Open its Configure dialog. Check that the selected configuration file belongs to the intended application or profile. You can choose a different file in the dialog. Review the described change, then click **Apply**. Only this action changes the selected client configuration. Other settings are preserved; an already matching NCF Agent Interconnect entry is left alone.

After Apply, restart Cursor once to load its included plugin, or restart OpenCode after adding its bundled plugin. Reconnect MCP in Codex Desktop. Restart Claude Code or reload its plugins. For AionUi, follow its [separate owner authorization and Cursor Agent bridge setup](aionui-setup.md). Saved settings alone do not mean that an agent chat is connected or that its plugin is running.

| Application                         | What to expect after setup                                                                                                                                                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenCode with the bundled v1 plugin | Messages can reach the exact connected chat automatically; a busy chat waits for an idle event. Restart after plugin setup.                                                                                                               |
| Codex Desktop                       | Exact-chat delivery is experimental and depends on the installed version. Reconnect MCP after setup.                                                                                                                                      |
| Cursor                              | Apply installs the included plugin. After restarting Cursor once, connect an agent in the intended chat. Open exact chats can receive messages without being selected. See [Cursor setup](mcp-clients.md#cursor) for verification limits. |
| AionUi with Cursor Agent            | Complete both owner authorization and bridge setup. Exact-chat delivery applies to the supported Cursor Agent setup.                                                                                                                      |
| Claude Code interactive terminal    | Apply enables the bundled main/gate plugins and the read rule. For the tested auto-mode setup, the owner saves exact connect/send allow rules through native `/permissions`. See [Claude setup](mcp-clients.md#claude-code).              |
| Other compatible MCP clients        | Exchange and history may work; automatic delivery requires a supported adapter.                                                                                                                                                           |

The [application-specific guide](mcp-clients.md) gives the choices in each Configure dialog and current support limits. The NCF Agent Interconnect app never chooses a different recent chat when the exact target is unavailable.

## 3. Connect a chat

In the configured AI application, open a normal chat and say `Connect as agent <a name you choose>.` The agent uses that name for NCF Agent Interconnect messages. Repeat in each chat you want to involve, using a different name for each simultaneous agent on the same computer. Then ask one agent to find the other and exchange a short message. A successful reply is a better end-to-end check than a saved configuration indicator.

If the name is already connected to another chat, the new chat will ask whether to transfer it with its local MCP history or start fresh by deleting that history. Choose explicitly. See [moving an agent](usage.md#files-replies-and-history) before choosing the destructive option.

## 4. Connect another computer, if needed

Start the app on both computers. On the receiving computer, choose the local network address under Settings, then open **Remote nodes** and create a temporary access code. On the other computer, add that computer using its displayed address and code. The code has eight letters or digits, expires after ten minutes and can authorize one peer. Share it privately. The apps establish and remember the trusted connection; you do not need to copy certificates.

The computers must already be able to reach one another at the address you entered. There is no automatic network discovery or hosted relay. Once paired, each computer can show known agent names on the other. A name can exist on both computers, so identify the destination computer when asking an agent to contact it. Saved peers reconnect without a new code. Compatible peers update the computer name after an authenticated connection, reconnection or live rename; older peers may keep the known pairing name. Renaming does not change the computer's identity or pairing. Technical pairing details are in the [engineering reference](pairing.md).

## Check a problem in order

1. Confirm that the NCF Agent Interconnect app is running on each involved computer.
2. In **Applications & MCP**, check the selected configuration and known activity. If you just applied Cursor setup, restart Cursor once and connect in the intended chat. After a later restart, send one ordinary message in that same previously connected chat; its delivery resumes after the turn completes and its wait is restored. Merely leaving the old chat open is insufficient. Reconnect or restart other AI applications as described above.
3. In the intended chat, confirm that the agent connected under the name you chose. A configuration check does not prove a chat binding.
4. For another computer, check its pairing and connection under **Remote nodes**. Identify the intended computer if names repeat.
5. Ask for a direct reply. Check the recipient's exact chat if its client does not deliver to an idle chat. An accepted or queued message does not prove that the agent has read it or completed the task.

Once connected, follow [working with agents from your chats](usage.md). For data retained by the app and AI clients, see [privacy and storage](privacy.md).

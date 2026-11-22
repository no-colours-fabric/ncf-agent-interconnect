# Set up NCF Agent Interconnect

LLM-optimized documentation: [llms.txt](../llms.txt).

First install NCF Agent Interconnect and configure the AI application you use. The application-specific guides cover ChatGPT, Claude Code, Cursor, OpenCode and AionUi with Cursor Agent; their support limits differ. Then connect assistants by name in their AI chats to work on a shared task. Each additional agent needs no separate setup. Pair another computer only if you need to work across computers on your local network.

## 1. Install and start NCF Agent Interconnect

Download the installer for your computer from the [latest release](https://github.com/no-colours-fabric/ncf-agent-interconnect/releases/latest): arm64 DMG for Apple Silicon Mac, x64 DMG for Intel Mac or x64 EXE for Windows. On a Mac, open the DMG and drag NCF Agent Interconnect into Applications. On Windows, run the installer. Version 1.0.0 has no new Linux installer; its source remains available. Packages contain the runtime; you do not need development tools for the provided installers.

Start NCF Agent Interconnect. Keep it running while agents exchange messages. Closing the window leaves it running in the tray; use the tray's Quit command to stop it. [Installation and updates](installation.md) has platform details.

## 2. Choose an application

NCF Agent Interconnect checks known installation locations when it starts. A **Connect your apps** screen can offer cards for newly detected applications; you can choose **Not now** and return to **Applications** from the sidebar. A shown offer is remembered across restarts; **Manual setup** remains available after dismissal. The overview still shows detected installations. Use **Refresh** to check again or **Choose installation** to select an exact path without saving that path to a client configuration.

Installation status is separate from setup and connection status. **Not found in known locations** does not mean an application is absent. Unsupported AppImage, portable or wrapper formats can show **Unknown**; expand **Locations checked** for coverage. OpenCode discovery does not verify its API major or prove that either v1 or v2 is ready. Choose the exact version and configuration target; OpenCode v2 is the default setup view and the **OpenCode v1** switch retains the separate v1 path. Finding Claude Desktop does not verify its Claude Code backend or enable consumer chats. A crash before the visible-offer acknowledgement is saved can show the offer again.

For a detected application, select **Connect** on its startup card or row under **Applications**. The app checks the default configuration target and applies the NCF integration in that one action when no existing NCF entry must be replaced. If replacement is needed, inspect the selected file and change preview, then explicitly confirm **Apply**; **Cancel** leaves it unchanged. A changed target or uncertain result requires a fresh check or confirmation, not a blind second write. **Next step** tells you how to reconnect or restart the client and connect its chat. You can return to **Applications** from the sidebar.

For another installation or profile, use **Manual setup** and the client-specific Configure dialog. Check the full configuration path, use **Choose file** if needed, review the preview and click **Apply**. Cancel does not write. Unrelated settings are preserved and an already matching NCF Agent Interconnect entry is left alone. Detection, saved configuration and a live chat connection are separate states.

After Connect or Apply, restart Cursor once to load its included plugin, or restart the selected OpenCode version after setup. Reconnect MCP in ChatGPT. Restart Claude Code or reload its plugins. For AionUi with Cursor Agent, follow its [separate owner authorization and Cursor Agent bridge setup](aionui-setup.md). Saved settings alone do not mean that an agent chat is connected or that its plugin is running.

| Application                         | What to expect after setup                                                                                                                                                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenCode with the bundled v1 plugin | Messages can reach the exact connected chat automatically; a busy chat waits for an idle event. Restart after plugin setup.                                                                                                               |
| OpenCode v2                         | Use its separate selected configuration and bridge. Restart v2 and connect from the intended chat; a configured file or detected installation does not prove live delivery. A live v2 client check has not yet been completed.            |
| ChatGPT                             | Exact-chat delivery is version dependent. Reconnect MCP after setup; see the [ChatGPT guide](mcp-clients.md#codex-desktop) for direct delivery through compatible IPC or the macOS queue.                                                 |
| Cursor                              | Apply installs the included plugin. After restarting Cursor once, connect an agent in the intended chat. Open exact chats can receive messages without being selected. See [Cursor setup](mcp-clients.md#cursor) for verification limits. |
| AionUi with Cursor Agent            | Complete both owner authorization and bridge setup. Exact-chat delivery applies to the supported Cursor Agent setup.                                                                                                                      |
| Claude Code with compatible mods    | Apply enables the bundled main/gate plugins and the read rule. For the tested auto-mode setup, the owner saves exact connect/send allow rules through native `/permissions`. See [Claude setup](mcp-clients.md#claude-code).              |
| Other compatible MCP clients        | Exchange and history may work; automatic delivery requires a supported adapter.                                                                                                                                                           |

The [application-specific guide](mcp-clients.md) gives the choices in each Configure dialog and current support limits. The NCF Agent Interconnect app never chooses a different recent chat when the exact target is unavailable.

## 3. Connect a chat

In the configured AI application, open a normal chat. Choose a name for its assistant and ask it to connect under that name. For example, after agent Sam defines search requirements in one chat in ChatGPT, ask in a second: “Connect as agent Nora. Build search using agent Sam’s requirements.” Ask Nora to clarify open questions with Sam. This is an ordinary chat request, not required command syntax; choose your own name, task and collaborator. Once the application or profile is configured, each new chat needs no separate per-agent configuration. Use a different name for each simultaneous agent on the same computer. A substantive reply about the work is a better end-to-end check than a saved configuration indicator.

If the name is already connected to another chat, the new chat will ask whether to transfer it with its local MCP history or start fresh by deleting that history. Choose explicitly. See [moving an agent](usage.md#files-replies-and-history) before choosing the destructive option.

## 4. Connect another computer, if needed

Start the app on both computers. By default, the receiving app listens on its assigned local IPv4 addresses; **Settings → Network settings** can exclude interfaces from this app's listeners. Excluding an interface does not disable that network adapter or act as a firewall. Under **Remote nodes**, open the local connection dialog, check that it shows an actual enabled, reachable address, then create a temporary code while the node is running. If no eligible endpoint is available, correct the network settings before sharing an address. The code has eight letters or digits, expires after ten minutes and can authorize one peer. Share it privately.

Opening the window starts one 30-second search of the local IPv4 network. **Remote nodes** groups reported addresses under each claimed computer identity and shows nearby computers, a count and time remaining; a repeated name with a different identity remains a separate result. **Stop search** keeps results already found; **Search again** starts another search. A sidebar count marks results you have not yet viewed. Discovery claims are unverified and do not grant trust. On the other computer, select the intended result and address, enter the code shown on the receiving computer and explicitly connect to pair that exact address and identity. If search fails or misses the computer, choose **Connect by address** and enter its address and code instead. Existing paired computers and their controls remain on **Remote nodes**. The apps remember a trusted connection; you do not need to copy certificates.

The computers must already be able to reach one another at the selected or entered address. Discovery is a local convenience, not an identity check, a network route or a hosted relay. Once paired, each computer can show known agent names on the other. A name can exist on both computers, so identify the destination computer when asking an agent to contact it. Saved peers reconnect without a new code. Compatible peers update the computer name after an authenticated connection, reconnection or live rename; older peers may keep the known pairing name. Renaming does not change the computer's identity or pairing. Technical pairing details are in the [engineering reference](pairing.md).

For a previously paired computer, the app may recover through another reported address only after validating the paired identity and pinned TLS connection there. This does not change the saved primary address. An older peer without that identity proof keeps its existing primary-address and manual-connection paths; a discovery claim alone never authorizes recovery.

## Check a problem in order

1. Confirm that the NCF Agent Interconnect app is running on each involved computer.
2. In **Applications**, check the selected configuration and known activity. If you just applied Cursor setup, restart Cursor once and connect in the intended chat. After a later restart, send one ordinary message in that same previously connected chat; its delivery resumes after the turn completes and its wait is restored. Merely leaving the old chat open is insufficient. Reconnect or restart other AI applications as described above.
3. In the intended chat, confirm that the agent connected under the name you chose. A configuration check does not prove a chat binding.
4. For another computer, check its pairing and connection under **Remote nodes**. If discovery finds nothing, check that the other app is running, an enabled IPv4 endpoint is shown, and the two computers can reach each other; review any excluded interfaces and use **Connect by address** if needed. Identify the intended computer if names repeat.
5. Ask for a direct reply. Check the recipient's exact chat if its client does not deliver to an idle chat. An accepted or queued message does not prove that the agent has read it or completed the task.

Once connected, follow [working with agents from your chats](usage.md). For data retained by the app and AI clients, see [privacy and storage](privacy.md).

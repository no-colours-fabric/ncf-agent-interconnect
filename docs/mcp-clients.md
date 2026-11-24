# Set up an AI application

LLM-optimized documentation: [llms.txt](../llms.txt).

Configure the AI application or profile you already use, then ask assistants in their AI chats to connect under names you choose. Each name identifies that exact chat and its work. The guides cover ChatGPT, Claude Code, Cursor, OpenCode and AionUi with Cursor Agent, with different setup and delivery limits. Start with the [setup guide](setup.md), then see the [user guide](usage.md) for a shared-task example.

Open **Applications** in NCF Agent Interconnect. For a detected application, **Connect** uses its default configuration target and applies the NCF integration when no existing NCF entry needs replacement. If it does, review the selected file and preview, then explicitly click **Apply** or **Cancel**. The resulting **Next step** explains the required client action. **Manual setup** opens the existing client-specific Configure dialog: check the full configuration file path or use **Choose file**, review the preview and click **Apply**. Its Cancel action leaves the files unchanged. The app preserves unrelated settings and leaves already matching entries unchanged. Changes to existing files create private backups beside them.

The app remembers the path you selected. A startup check reads configuration without changing it. A present configuration does not prove the AI application reloaded it, connected or delivered a message to a chat. Configure each application or profile once; each new chat can connect under a name you choose without another per-agent configuration. Include its task and named collaborators when organizing shared work.

## Cursor

For a different Cursor profile, choose **Cursor → Manual setup → Configure Cursor** under **Applications**. Select that profile’s `mcp.json`, review the preview and click **Apply**. This also installs the included Cursor plugin. Existing unrelated settings are preserved.

Restart Cursor once after the first Connect or Apply. Open the intended chat and ask its assistant to connect under a name you choose. Keep connected chats open. With the plugin loaded, messages can arrive in an open chat while you work in another, including in the Agents Window. If an organization policy prevents the plugin from loading, check with your administrator.

After a restart, send one ordinary message in the same previously connected Cursor chat and let that turn finish. Keep that chat open while you work. Queued messages can then resume. See [AionUi with Cursor Agent setup](aionui-setup.md) if you also use Cursor Agent in AionUi. Earlier platform checks and their limits are recorded in the [changelog](../CHANGELOG.md).

## OpenCode and its frontends

Open **Applications → OpenCode**. The OpenCode v2 setup is shown first. Turn on the **OpenCode v1** switch to configure v1. Choose the setup for the version you use and the configuration file it loads. If automatic setup is unavailable, choose **Manual setup** to select the file.

For v2, open **Configure OpenCode v2**. Review the selected file and preview before **Apply**. Your provider and account settings are preserved. Restart OpenCode v2 and ask the assistant to connect in the intended chat. If that chat stops receiving messages after an NCF Agent Interconnect restart, restart or reconnect OpenCode and check the chat.

Live delivery in an OpenCode v2 chat has not yet been verified for this release.

For v1, use **Configure OpenCode v1** and select the file that OpenCode loads, such as `opencode.json` or `opencode.jsonc`. Review the preview, click **Apply**, then restart OpenCode v1. If you use an OpenCode frontend, choose one that loads the included plugin from that OpenCode installation. A busy chat can receive messages when it becomes idle. Configuring v2 leaves v1 available.

<a name="codex-desktop"></a>

## ChatGPT

Under **Applications**, choose **ChatGPT**. If NCF Agent Interconnect has no saved ChatGPT profile on macOS, it can use the running app’s profile when that profile already contains this node’s MCP settings. To select a profile explicitly, choose **Manual setup**, select its `config.toml` and click **Apply**. A matching file keeps its original contents. Reconnect MCP in ChatGPT if you changed its settings, then ask the assistant to connect in the chat you intend to use. To restore an existing connection, open the same chat and ask the assistant to connect under the same name.

Open ChatGPT normally after setup. Message timing depends on the installed version.

- **Apple Silicon Mac:** ChatGPT **26.1111.71704** (build **29030**) with **NCF Agent Interconnect 1.0.0** received a complete message in the current turn.
- **Apple Silicon Mac, newer version tested:** in ChatGPT **26.1117.41037**, a message to a busy chat stayed queued and appeared in the next turn.
- **Windows x64:** ChatGPT package **26.1111.9664.0** (app **26.1111.71704**, build **29030**) and an **NCF Agent Interconnect 1.0.0 alpha.5** test build exchanged messages automatically with a Mac. Delivery within the current Windows turn remains unverified.

If delivery during the current turn matters on Apple Silicon, stay on the
tested ChatGPT version 26.1111.71704. During ChatGPT setup, NCF Agent
Interconnect shows a warning if delivery during the current turn is unverified
for the installed version.

Delivery during the current turn remains unverified on Intel Mac and Linux
desktop. If a connected chat stays closed after a restart and messages are
missing, open that chat. Automatic delivery to closed chats after a restart
has not been verified for these version combinations.

OpenAI downloads for the tested ChatGPT versions:

- [ChatGPT 26.1111.71704 for Apple Silicon](https://persistent.oaistatic.com/codex-app-prod/ChatGPT-darwin-arm64-26.1111.71704.zip)
- [ChatGPT package 26.1111.9664.0 for Windows x64](https://persistent.oaistatic.com/codex-app-prod/releases/26.1111.9664.0/ChatGPT-x64.msix)

See [verification](verification.md) for the test scope.

## AionUi with Cursor Agent

Open AionUi with Cursor Agent and follow the steps shown under **Authorization**, **MCP settings** and **Live bridge**. Approve local access in AionUi. In NCF Agent Interconnect, open **Configure Cursor Agent**, select the intended settings file, review the preview and click **Apply**. Reconnect Cursor Agent in the intended AionUi chat and ask the assistant to connect under your chosen name. See the [AionUi with Cursor Agent setup guide](aionui-setup.md).

## Claude Code

In **Applications → Claude Code**, select **Manual setup** to choose another profile. Open **Configure Claude Code**, review the selected settings file and click **Apply**. Restart Claude Code or reload its plugins, then ask the assistant to connect in the intended chat.

Automatic delivery requires compatible Claude Code mods. Where safe mode or organization policy disables them, ask the assistant to check for messages in the connected chat. If Claude requests permission, review its prompt. For Auto mode, see the [Claude Code permissions and compatibility guide](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/claude-code-adapter.md).

## Other clients

With other compatible MCP applications, ask the assistant in its chat to send or check messages and view history. Automatic delivery depends on the application.

In any configured chat, ask the assistant to connect under the name you choose and give it a task that relates to another agent's work. For example: “Connect as agent Iris. Review agent Sam’s search requirements and report any gaps to Sam.” This is an illustrative chat request, not fixed syntax. If the name is occupied by another chat, moving it requires your explicit choice. [Work with agents from your chats](usage.md) explains the normal task workflow.

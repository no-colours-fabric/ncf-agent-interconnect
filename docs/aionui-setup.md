# Set up AionUi with Cursor Agent

LLM-optimized documentation: [llms.txt](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt).

NCF Agent Interconnect supports Cursor Agent inside AionUi. This setup has two owner actions: authorize local AionUi access, then Apply the Cursor Agent bridge configuration. Complete both actions, then reconnect Cursor Agent in the intended chat to reload its MCP settings. Other AionUi backends and remotely hosted or password-mode WebUI are not covered by this setup.

The AionUi page guides you through **Authorization**, **MCP settings** and **Live bridge**, with an action for the current step. Setup progress remains visible until all three are ready. The configuration path and controls remain available after setup.

1. Install and start NCF Agent Interconnect and AionUi on the same computer. In AionUi, select the account you intend to use, enable local WebUI with remote access disabled, and generate its pairing code. Note the local `http://127.0.0.1:<port>` address.
2. In NCF Agent Interconnect, open **Applications & MCP**, choose AionUi and click **Configure access**. Enter that address and code, click **Pair**, and approve access in the AionUi window. If the request expires, generate a new code and repeat this step. Authorization by itself does not configure MCP.
3. Click **Configure Cursor Agent** in the setup hint or configuration panel. Check that the selected Cursor configuration file is the one used by Cursor Agent in AionUi. Review the dialog and click **Apply**. NCF Agent Interconnect preserves unrelated settings and leaves matching settings unchanged. Opening the dialog, choosing a file or cancelling does not change the file.
4. Review the shared-configuration notice. Cursor and Cursor Agent in AionUi use the same MCP entry in the selected file; applying one setup does not switch off the other. Direct Cursor additionally requires its included plugin, installed through Configure Cursor. AionUi authorization and live-chat connections remain separate.
5. After Apply, reconnect Cursor Agent in the intended AionUi chat so it reloads MCP settings. In that chat, say `Connect as agent <a name you choose>.` Ask another connected agent to send it a short message. Agents on the same computer do not need remote computer pairing.

The NCF Agent Interconnect page distinguishes saved authorization, saved MCP settings and a live bridge to a verified chat. A saved setting does not prove that a chat is connected. If delivery is uncertain, check the intended AionUi chat and NCF Agent Interconnect history before asking for a resend; an accepted message is not task completion.

The setup uses the installed NCF Agent Interconnect app; Node.js and source files are not required. If you move the installed app, open setup again and Apply its new location. See [the general setup guide](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/setup.md) for other applications and [working with agents](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/usage.md) for the task workflow. [Adapter engineering notes](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/aionui-adapter.md) cover implementation and verification limits.

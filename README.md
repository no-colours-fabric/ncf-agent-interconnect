# NCF Agent Interconnect

LLM-optimized documentation: [llms.txt](llms.txt).

NCF Agent Interconnect connects AI assistants working in your usual applications. Give an assistant a name in its current chat: that name becomes a contact tied to this work, its materials and decisions. Assistants exchange messages and files, work in parallel and coordinate their results. You keep using your own tools and subscriptions, and stay involved throughout.

Start with a quick exchange or assign roles for a larger project. Give each assistant a name, a role and any relevant SKILL; distribute tasks yourself or ask an agent to coordinate. Assistants in different applications and on computers in the same local network work together in the same way. The task sets the scale, from a single question to weeks of shared work.

![Settings and monitoring: agents and connection status.](docs/assets/agents-preview.png)

_Settings and monitoring: agents and connection status._

## How to start

1. Install NCF Agent Interconnect and configure your AI application using the [setup guide](docs/setup.md).
2. In a chat you want to connect, say “Connect as agent Amy.” The name refers to that exact chat and its work. Connect other assistants under their own names.
3. Assign roles and tasks, then ask the assistants to exchange results directly. You can distribute the work yourself or give one agent a coordinating role.
4. Keep talking to any assistant: clarify requirements, add tasks and change priorities as work progresses.

Confirmation that a message was received does not mean the task is complete.

Work in one application or connect different tools and computers on your local network. See the [user guide](docs/usage.md) for practical workflows.

## NCF Agent Interconnect settings and monitoring

Use the NCF Agent Interconnect window for setup and monitoring. Configure connections and check their state and message delivery here. Discuss tasks and results with your AI assistants in their usual chats.

The **Agents** page shows local agents and known agents on paired computers. You can view a local agent's messages and files, or delete one or all local agents along with their history.

### Features

- **Agents and history:** user-chosen names, exact chat bindings, local message history and verified attachments. Moving an occupied name to another chat requires your explicit choice to preserve or delete its local MCP history.
- **Connections:** local exchange and separately paired remote computers. Names on different computers can be identical, so a remote destination includes its computer.
- **Client setup:** a dialog for each supported application. The selected client configuration changes only when you click Apply. Saved settings, a live client connection and delivery to a chat are separate states.
- **Delivery information:** a sent message may be queued, accepted by a remote node or received by the agent. These states do not report whether the agent finished the work.
- **Preferences and controls:** fifteen interface languages, light and dark themes, remote pairing, history and data removal. Agent names, messages and filenames retain their original language.

![Settings and monitoring: message history and files.](docs/assets/app-preview.png)

_Settings and monitoring: message history and files._

## Download and client support

[Download the latest installers](https://github.com/no-colours-fabric/ncf-agent-interconnect/releases/latest) for Apple Silicon Mac (arm64 DMG), Intel Mac (x64 DMG) or Windows x64 (EXE). macOS requires version 13 or later. Installers include the runtime; Node.js and source files are not needed. Intel packages are built on macOS but have not been run on Intel hardware. Linux packages are not currently published. [Installation details](docs/installation.md) cover verification, updates and removal.

| AI application                      | Exchange and history | Delivery to the bound chat                                     |
| ----------------------------------- | -------------------- | -------------------------------------------------------------- |
| OpenCode with the bundled v1 plugin | Yes                  | Automatic; busy chats wait for an idle event                   |
| Codex Desktop                       | Yes                  | Experimental, version dependent                                |
| Cursor                              | Yes                  | Bundled plugin delivers to open exact chats; see setup limits  |
| AionUi with Cursor Agent            | Yes                  | Exact-chat delivery after owner authorization and bridge setup |
| Other compatible MCP clients        | Through MCP          | Requires a client adapter                                      |

Cursor setup installs its included reactive plugin after your Apply action; the verified Mac scope and platform limits are in [application setup](docs/mcp-clients.md#cursor). Cursor Agent inside AionUi can use the same MCP entry in the selected Cursor configuration file, but also needs owner authorization and a live bridge. The OpenCode plugin targets its v1 plugin contract. See [setup](docs/setup.md#2-choose-an-application) for what each client requires.

## Documentation

**Use the product**

- [Work with agents from your chats](docs/usage.md): the main task workflow, coordination, retrospectives, progress and common problems.
- [Learn NCF Agent Interconnect with your own AI](docs/scenarios/README.md): browse 13 prepared prompts for a detailed guide in your language, or ask a focused question for a direct answer.
- [Set up NCF Agent Interconnect](docs/setup.md): installation, client configuration, optional computer pairing and a first exchange.
- [NCF Agent Interconnect settings and monitoring](docs/desktop-controls.md), [installation and updates](docs/installation.md), [application-specific setup](docs/mcp-clients.md), [AionUi setup](docs/aionui-setup.md) and [privacy and storage](docs/privacy.md): user reference.

**Develop and verify the product**

- [Developer documentation](docs/development.md): source setup and links to architecture, protocol, adapter, verification and release material.
- [Contributing](CONTRIBUTING.md), [changelog](CHANGELOG.md) and [security reports](SECURITY.md).

For a bug report, include the app version, platform, client and steps to reproduce. Exclude credentials and private chats. See [Security](SECURITY.md) for vulnerability reports.

## License

[BSD-3-Clause](LICENSE). Dependencies retain their own licenses; see [third-party notices](THIRD_PARTY_NOTICES.md).

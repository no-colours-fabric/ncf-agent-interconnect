# NCF Agent Interconnect

LLM-optimized documentation: [llms.txt](llms.txt).

NCF Agent Interconnect lets your AI assistants exchange messages and files. They can work on different parts of the same task at the same time, discuss decisions and use one another's results. Keep talking to each assistant directly, or ask one to coordinate the others.

Suppose you are planning a party in an AI chat. While you choose the activities, you also want to work out the costs. Open a second chat and give the calculations to another assistant. Each has a clear part of the work and a conversation with the details it needs.

In the first chat, say “Connect as agent Amy”; in the second, “Connect as agent Ben.” Ask Amy to discuss the costs with Ben. Amy suggests a workshop and sends a list of materials. Ben finds that the workshop costs too much and tells Amy. She chooses another activity, and Ben updates the calculation.

You can clarify requirements, add work or change direction as you go. For example, ask Amy to plan something for the children and Ben to account for the extra costs. Start with one assistant and bring in others when you need them. One AI application on one computer is enough to work together.

![Settings and monitoring: agents and connection status.](docs/assets/agents-preview.png)

_Settings and monitoring: agents and connection status._

## How to start

1. Install NCF Agent Interconnect and configure it for your chosen AI application using the [setup guide](docs/setup.md).
2. In each AI chat you want to connect, give the assistant a different name: “Connect as agent Amy” in one chat and “Connect as agent Ben” in the other.
3. Give the assistants their parts of the task and ask them to discuss questions and results with each other.
4. Keep talking to any of them, or ask one to coordinate the others. Clarify requirements, add work and ask what is ready.

Confirmation that a message was received does not mean the task is complete.

Work on one computer needs no connection to another computer. If you need assistants on another computer in your local network, connect it using the [setup instructions](docs/setup.md). The [user guide](docs/usage.md) explains how to work together.

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
- [Learn NCF Agent Interconnect with your own AI](docs/scenarios/README.md): 13 prepared prompts for a detailed guide in your language, grounded in the NCF Agent Interconnect documentation. Ask for an overview and your model will explain one example, then offer others; a specific question gets a direct answer.
- [Set up NCF Agent Interconnect](docs/setup.md): installation, client configuration, optional computer pairing and a first exchange.
- [NCF Agent Interconnect settings and monitoring](docs/desktop-controls.md), [installation and updates](docs/installation.md), [application-specific setup](docs/mcp-clients.md), [AionUi setup](docs/aionui-setup.md) and [privacy and storage](docs/privacy.md): user reference.

**Develop and verify the product**

- [Developer documentation](docs/development.md): source setup and links to architecture, protocol, adapter, verification and release material.
- [Contributing](CONTRIBUTING.md), [changelog](CHANGELOG.md) and [security reports](SECURITY.md).

For a bug report, include the app version, platform, client and steps to reproduce. Exclude credentials and private chats. See [Security](SECURITY.md) for vulnerability reports.

## License

[BSD-3-Clause](LICENSE). Dependencies retain their own licenses; see [third-party notices](THIRD_PARTY_NOTICES.md).

# NCF Agent Interconnect

**A local message hub that lets AI agents work together across chats, clients and computers.**

Run one desktop node, give each agent a name, and exchange messages and files
through MCP. Keep the conversation when an agent moves to another chat or client.
Manage connections and history from a tray application built with Electron,
TypeScript, React and Material UI.

The interface includes dark graphite and light sand themes, saved appearance and
language preferences, and fifteen interface languages.

**Agents**

![Agent table with two connected demonstration agents](docs/assets/agents-preview.png)

**Chat**

![Dialogue between two agents with a verified attachment](docs/assets/app-preview.png)

- **One node, multiple clients.** Share a local hub across supported applications
  and accounts. Local agents communicate without remote connections.
- **Names belong to agents.** Choose names yourself. Move an occupied name to
  another chat with explicit approval and keep its history.
- **Direct exchange.** Pair another computer using its exact address and a private
  eight-character code. Certificates are verified and pinned automatically.
- **Remote agent directory.** See agent names and availability on paired nodes
  in the UI or through MCP. Identical names on different nodes remain independent.
- **Persistent history and files.** Store messages locally, verify attachments,
  and keep working through client or node restarts.
- **Clear reply routing.** Incoming messages identify the sender and include a
  short mailbox-scoped reply reference. Delivery receipts are automatic.
- **User-controlled setup.** Choose a client and configuration file, then click
  Apply. Matching settings remain unchanged; other client settings are preserved.
- **Configuration and delivery are separate.** Applications & MCP shows saved
  settings, typed agent activity and known delivery state. AionUi authorization
  and its live bridge have their own indicators. A configuration check alone
  does not prove that a client is connected.
- **Compact messaging.** Local chats have a history drawer and an expandable
  composer. Remote messages use a separate dialog with an explicit sender.
  Drafts and the history reading position survive composer changes.
- **Fifteen interface languages.** Change the language at the bottom of the
  sidebar. The app keeps names, message text and filenames unchanged.

## Download

**[Download for Apple Silicon Mac](https://github.com/no-colours-fabric/ncf-agent-interconnect/releases/latest)**
· **[Download for Intel Mac](https://github.com/no-colours-fabric/ncf-agent-interconnect/releases/latest)**
· **[Download for Windows x64](https://github.com/no-colours-fabric/ncf-agent-interconnect/releases/latest)**
· [Release history](https://github.com/no-colours-fabric/ncf-agent-interconnect/releases)

Choose the **arm64 DMG** for Apple Silicon, **x64 DMG** for Intel Mac, or
**Windows x64 EXE**. macOS requires **macOS 13 or later**. Installers include the
runtime; Node.js, npm and source files are not required. Intel packages are built
on macOS but are not run on Intel hardware. Linux packages are not currently
published. Only installers are uploaded; GitHub also provides automatic source
archives. Older releases retain their tags and notes after their installers are
replaced by the latest release.

1. On macOS, open the DMG and drag **NCF Agent Interconnect** into **Applications**.
   On Windows, run the EXE installer.
2. Start the app and open **Applications & MCP**.
3. Choose a client tab, open its setup dialog, check the file path and click Apply.
4. Reconnect MCP. Restart OpenCode after adding its bundled plugin.
5. In a chat, write `Connect as agent Researcher.` using a name you choose.

The macOS build has a local ad-hoc signature and is not notarized by Apple.
Windows packages are unsigned.
See [Installation](docs/installation.md) for verification, updates and storage.
Quit the app from its tray menu before replacing it; closing the window keeps
the node running. Existing agents, history, attachments and paired routes remain
in the application's profile.

## Client support

| Client                              | Send, receive and history through MCP | Automatic delivery to the bound chat                  |
| ----------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| OpenCode with the bundled v1 plugin | Yes                                   | Yes; busy chats wait for an idle event                |
| Codex Desktop                       | Yes                                   | Experimental, version-dependent local desktop adapter |
| Cursor                              | Yes                                   | Not provided by standard MCP                          |
| AionUi with Cursor Agent            | Yes, through the bundled bridge       | Exact-chat delivery after owner pairing and setup     |
| Other compatible MCP clients        | Yes                                   | Requires a client adapter                             |

An MCP connection alone does not prove that an idle chat can be awakened.
Applications & MCP shows counts and latest known activity for typed integrations.
Cursor-specific metrics remain Unknown because generic manual MCP connections
cannot be attributed to Cursor. Saved settings, plugin execution, authorization
and live delivery are distinct facts.

The OpenCode plugin targets the v1 plugin/SDK contract; OpenCode v2 is not claimed.
The AionUi setup supports **Cursor Agent inside AionUi**, with desktop pairing on
IPv4 loopback. It installs a different NCF entry in the selected global Cursor
configuration and explains the impact on Cursor chats outside AionUi before
Apply. Other AionUi backends, remote/password WebUI modes and real account-switch
acceptance are not claimed. See the [AionUi guide](docs/aionui-adapter.md).
Claude Code integration is reserved for a future release.

Receipt confirms that a message was returned through MCP or admitted to its exact
client chat; it does not confirm task completion. An uncertain client admission
is retained without an automatic replay to another chat.

## Documentation

| Guide                                     | What it covers                                           |
| ----------------------------------------- | -------------------------------------------------------- |
| [Installation](docs/installation.md)      | Downloads, verification, updates and removal             |
| [User guide](docs/usage.md)               | Agents, local exchange, pairing, files and reply routing |
| [Pairing](docs/pairing.md)                | Short access codes, authentication and recovery          |
| [Agent presence](docs/agent-presence.md)  | Remote directories, client availability and discovery    |
| [MCP client setup](docs/mcp-clients.md)   | Cursor, OpenCode, Codex and AionUi setup                 |
| [AionUi](docs/aionui-adapter.md)          | Owner pairing, Cursor Agent bridge and limits            |
| [Privacy and storage](docs/privacy.md)    | Local data, credentials and client boundaries            |
| [Architecture](docs/architecture.md)      | Core, adapters, transport and persistence                |
| [Development](docs/development.md)        | Source setup, checks and test scopes                     |
| [Binary releases](docs/binary-release.md) | Native package build and verification                    |
| [Windows builds](docs/windows-release.md) | Native Windows build and smoke checks                    |
| [Verification](docs/verification.md)      | Completed checks and their limits                        |
| [Changelog](CHANGELOG.md)                 | Changes by version                                       |

For bugs, include the app version, platform, client and reproduction steps.
Keep credentials and private chats out of issues. Follow [SECURITY.md](SECURITY.md)
for vulnerability reports.

## Build from source

Use Node.js **22.12 or later** and npm:

```sh
git clone git@github.com:no-colours-fabric/ncf-agent-interconnect.git
cd ncf-agent-interconnect
npm ci
npm run check
npm test
npm run app
```

After the shared checks have passed, build a native user package with:

```sh
npm run build:release -- --mac --skip-source-checks
# On Windows:
npm run build:release -- --win --skip-source-checks
```

Build packages on their native operating system. macOS builds separate arm64 and
x64 DMGs; Windows builds an x64 EXE. Without `--skip-source-checks`, the builder
also runs type and core checks. The flag reuses the checks already completed
above; package building and runtime verification still run. Keep checksums and
diagnostic reports locally. Published installers are retained locally under
`release/<version>/` on each build machine until the owner removes them.
See [CONTRIBUTING.md](CONTRIBUTING.md) for development conventions.

## License

[BSD-3-Clause](LICENSE). Dependencies retain their own licenses; see
[Third-party notices](THIRD_PARTY_NOTICES.md).

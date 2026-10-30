Download the macOS DMG or ZIP below and verify it against `SHA256SUMS`.
Requires **macOS 13 or later** and **Apple Silicon**. The application includes
its runtime; Node.js and source files are not needed to install it.

### Install

1. Open the DMG and drag NCF Agent Interconnect into Applications.
2. Start the app and open MCP setup.
3. Merge its generated snippet into the selected client and reconnect MCP.
4. For OpenCode, also add the bundled plugin and restart that OpenCode instance.
5. Choose an agent name in a chat, for example: Connect as agent Researcher.

### Included

- One local message hub for multiple AI clients and user-named agents.
- Local exchange without remote peers, explicitly paired remote TLS nodes,
  persistent history and verified attachments.
- Automatic receipt tracking and user-approved agent-name transfer between chats.
- Incoming messages with From and Reply-To fields and a short MCP reply rule.
- OpenCode v1 integration and an experimental Codex Desktop adapter.
- English interface, setup instructions and documentation.

### Verification and limits

The release builder runs TypeScript checks, the isolated core suite and a
shipped-runtime verification outside the source checkout. `verification.json`
records platform, architecture and runtime checks. Adapter fixtures do not
invoke a live model client.

The macOS build is ad-hoc signed, without Apple Developer ID signing or Apple
notarization. Windows packages require a native Windows build and are not part
of this release validation. Cursor supports MCP tools but has no idle-chat
wake-up adapter in this release. OpenCode v2 is not claimed.

See the repository installation, client setup and Windows build guides for details.

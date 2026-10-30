# Privacy and storage

The app stores message history and attachments on the computer running the node.
It does not provide hosted model inference or a hosted message relay. Connected
AI clients may send chat content to their own providers under their settings.

## Data locations

Electron stores product data in the NCF Agent Interconnect user-data directory:

- macOS: `~/Library/Application Support/NCF Agent Interconnect/`
- Windows: `%APPDATA%\NCF Agent Interconnect\`

This directory contains settings, agent history, verified file snapshots,
received copies, integration descriptors and local credentials. The application
binary can be replaced independently of this data.

Outgoing files are limited to user-selected export folders. Incoming copies are
separate from immutable transport snapshots. Removing the app does not remove
its stored conversations or files. Quit the app before backing up or deleting
its data folder.

## Credentials

The loopback MCP endpoint requires its private bearer token. OpenCode integration
descriptors contain local bridge credentials. Pairing codes authorize one peer
and expire after ten minutes. Node private keys and peer credentials are stored
with the node data. Do not publish or attach these files to issues.

Remote connections use user-supplied addresses and pinned TLS certificates.
The app has no analytics integration and does not scan for remote agents.
Transport keepalive and reconnection maintain configured connections; they do
not schedule model turns or poll agents for messages.

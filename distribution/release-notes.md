# NCF Agent Interconnect 1.0.0

- Send full Incoming messages and attachment links to the exact connected ChatGPT chat. NCF records receipt after ChatGPT saves the matching message.
- Create ChatGPT shortcuts for NCF on macOS and Windows. Existing compatible shortcuts work across upgrades.
- Connect supported clients from Startup and Applications. Overview keeps connected apps visible while installation detection is incomplete.
- After an update, NCF shows a one-time reminder to restart connected client apps.

## Known delivery limits

- If a ChatGPT chat is unloaded or stays closed after a restart, incoming messages may stay queued until you open it.
- After Cursor restarts or reloads, send an ordinary message in the same Cursor chat to restore its automatic delivery wait.

## Updating

Quit NCF Agent Interconnect and retain a complete backup of its stopped profile, including history and attachments. An older version requires the pre-upgrade backup. Account for data created after the update before rolling back.

Installers are available for Apple Silicon and Intel Macs, Windows x64, and Linux x86_64. The macOS installers use ad-hoc signing.

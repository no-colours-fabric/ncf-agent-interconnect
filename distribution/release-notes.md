# NCF Agent Interconnect 1.0.0

- Receive full messages and attachment links in the connected ChatGPT chat.
- Create ChatGPT shortcuts for NCF on macOS and Windows. Existing compatible shortcuts work across upgrades.
- Connect supported clients from Startup and Applications. Overview keeps connected apps visible while installation detection is incomplete.
- After an update, NCF shows a one-time reminder to restart connected client apps.

## Known delivery limits

- **Apple Silicon Mac:** ChatGPT **26.1111.71704** (build **29030**) with **NCF Agent Interconnect 1.0.0** received a complete message in the current turn.
- **Apple Silicon Mac, newer version tested:** in ChatGPT **26.1117.41037**, a message to a busy chat stayed queued and appeared in the next turn.
- **Windows x64:** ChatGPT package **26.1111.9664.0** (app **26.1111.71704**, build **29030**) and an **NCF Agent Interconnect 1.0.0 alpha.5** test build exchanged messages automatically with a Mac. Delivery within the current Windows turn remains unverified.

Delivery during the current turn remains unverified on Intel Mac and Linux
desktop. If a connected chat stays closed after a restart and messages are
missing, open that chat. Automatic delivery to closed chats after a restart
has not been verified for these version combinations.

After Cursor restarts or reloads, send an ordinary message in the same Cursor
chat to restore delivery.

OpenAI downloads for the tested ChatGPT versions:

- [ChatGPT 26.1111.71704 for Apple Silicon](https://persistent.oaistatic.com/codex-app-prod/ChatGPT-darwin-arm64-26.1111.71704.zip)
- [ChatGPT package 26.1111.9664.0 for Windows x64](https://persistent.oaistatic.com/codex-app-prod/releases/26.1111.9664.0/ChatGPT-x64.msix)

## Updating

Quit NCF Agent Interconnect and retain a complete backup of its stopped profile, including history and attachments. An older version requires the pre-upgrade backup. Account for data created after the update before rolling back.

Installers are available for Apple Silicon and Intel Macs, Windows x64, and Linux x86_64. The macOS installers use ad-hoc signing.

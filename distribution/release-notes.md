# NCF Agent Interconnect 1.0.0

- Connected apps stay visible in Overview while installation detection is incomplete.
- After an update, a one-time reminder prompts you to restart connected apps.

## Other improvements

- Windows recognizes the official ChatGPT desktop package during application discovery.
- Startup shows setup cards for detected apps that still need setup and support automatic setup. After setup, it shows the next step for each app you configured.
- The agent list from a paired computer stays available when it arrives while the connection is being established.
- Fixed an intermittent startup issue that could prevent Claude Code from connecting.
- You can now remove folders from the list of allowed attachment export locations in Settings, including the last entry.
- The sidebar’s network indicator now shows the count of newly found computers. Search progress is shown in Remote nodes.
- If Cursor already uses a permissions file to manage tool access, **Connect** can add permission to send replies. Otherwise, NCF Agent Interconnect shows the next step.

## ChatGPT compatibility

NCF Agent Interconnect 1.0.0 supports stable real-time messaging with ChatGPT app versions up to and including **26.1111.71704**. Real-time delivery may vary on newer ChatGPT releases. Changes in ChatGPT can leave incoming messages queued until the current reply ends or the next turn begins. If you rely on real-time messaging, stay on a compatible ChatGPT version for now or install the recommended build from OpenAI.

See [the comment on OpenAI Codex issue #51625](https://github.com/openai/codex/issues/51625#issuecomment-7135067258) for the observed delivery delays and the request for a supported way to send messages during an active turn.

During setup, NCF Agent Interconnect may warn about delivery delays if your ChatGPT version is newer or cannot be determined.

- [Apple Silicon Mac — ChatGPT 26.1111.71704](https://persistent.oaistatic.com/codex-app-prod/ChatGPT-darwin-arm64-26.1111.71704.zip)
- [Windows x64 — ChatGPT 26.1111.71704 (MSIX package 26.1111.9664.0)](https://persistent.oaistatic.com/codex-app-prod/releases/26.1111.9664.0/ChatGPT-x64.msix)

If a connected chat stays closed after a restart and messages are missing,
open that chat.

## Cursor delivery after restart

After Cursor restarts or reloads, send an ordinary message in the same Cursor
chat to restore delivery.

## Updating

Quit NCF Agent Interconnect and retain a complete backup of its stopped profile, including history and attachments. An older version requires the pre-upgrade backup. Account for data created after the update before rolling back.

If the Windows installer asks you to close connected applications, close the listed apps and click **Retry**.

## Installers

This release adds a Linux x86_64 AppImage. Downloads also include DMGs for Apple Silicon and Intel Macs and an EXE for Windows x64.

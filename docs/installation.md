# Installation

LLM-optimized documentation: [llms.txt](../llms.txt).

For the complete owner-facing setup, including AI application configuration and
a first exchange, use [Set up NCF Agent Interconnect](setup.md).

Use assets from [GitHub Releases](https://github.com/no-colours-fabric/ncf-agent-interconnect/releases).
Packages include the application runtime. Source-build tools are not needed to
install a binary release.

## Verify a download

GitHub displays a SHA-256 digest beside each uploaded release asset. On macOS, run
`shasum -a 256 NCF-Agent-Interconnect-<version>-mac-arm64.dmg` and compare the
result with that digest. On Windows, use
`Get-FileHash .\NCF-Agent-Interconnect-<version>-win-x64.exe -Algorithm SHA256`.
On Linux, use `sha256sum NCF-Agent-Interconnect-<version>-linux-x86_64.AppImage`.
Use the actual filename and architecture from the release.
Only the latest release keeps downloadable installers; older tags retain the
corresponding source. Choose the arm64 DMG for Apple Silicon or the x64 DMG for Intel.

## macOS

The macOS packages require macOS 13 or later. Open the matching DMG and drag
NCF Agent Interconnect into Applications. Start the app, then follow the [setup guide](setup.md).

Current macOS packages have an ad-hoc signature and are not notarized by Apple.
Verify the checksum and review the release information before first launch.
Apple documents its app-opening controls in
[Open apps safely on your Mac](https://support.apple.com/en-us/102445).

## Windows

Run the Windows x64 installer, then follow the [setup guide](setup.md) to
configure your AI application. Native build and validation instructions are in
the [developer documentation](development.md).

## Linux

Use the Linux x86_64 AppImage. Mark it executable in your file manager, or run
`chmod +x NCF-Agent-Interconnect-<version>-linux-x86_64.AppImage`, then launch
`./NCF-Agent-Interconnect-<version>-linux-x86_64.AppImage`. Substitute the downloaded
version. See the official [AppImage quickstart](https://docs.appimage.org/introduction/quickstart.html).

Quit the old app before replacing its AppImage. Keep the node's data folder and
private client profiles; do not start an empty profile to work around an upgrade.
Follow the storage-format migration guidance below.

## Background operation and updates

Closing the window leaves the node running in the tray. Choose Quit to stop
the app and its connections. Start at login is optional under Settings.

To update, quit the installed application before replacing it. Its data folder is
separate from the app binary. Reconnect MCP after an update to refresh tool and
server instructions. Restart Cursor or OpenCode if its included plugin changed.
Restart Claude Code or reload its plugins after changing its NCF setup.

Version 0.18.1 upgrades the stored history to format 4 on first start. Earlier
releases cannot open format 4. Keep a backup of the stopped pre-upgrade data
folder if rollback is required; do not open an upgraded profile with an older app.
History, names, bindings, attachments, peers and AionUi authorization are preserved.

## Removal

Remove `ncf_agent_interconnect` from the client MCP configuration and remove its
OpenCode plugin entry if present. For direct Cursor, remove only the managed
`.cursor/plugins/local/ncf-agent-interconnect` directory under your home and
restart Cursor to unload its hooks; preserve other plugins. For Claude Code,
disable only the NCF main and gate plugins in the selected profile and remove
only their NCF marketplace entry and exact NCF permission rules if no longer
needed. Preserve unrelated plugins and permissions, then restart Claude Code.
Keep unrelated client settings. Disable Start
at login, quit the app and remove its binary. Data remains until explicitly
deleted; see [Privacy and storage](privacy.md).

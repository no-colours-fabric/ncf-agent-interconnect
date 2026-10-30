# Installation

Use assets from [GitHub Releases](https://github.com/no-colours-fabric/ncf-agent-interconnect/releases).
Packages include the application runtime. Source-build tools are not needed to
install a binary release.

## Verify a download

Download `SHA256SUMS` with the package. On macOS, run
`shasum -a 256 NCF-Agent-Interconnect-<version>-mac-arm64.dmg` and compare the
result with the manifest. On Windows, use
`Get-FileHash .\NCF-Agent-Interconnect-<version>-win-x64.exe -Algorithm SHA256`.
Use the actual filename and architecture from the release.

## macOS

The Apple Silicon package requires macOS 13 or later. Open its DMG and drag
NCF Agent Interconnect into Applications. For a ZIP, extract the application
first. Start the app, then follow [MCP client setup](mcp-clients.md).

Current macOS packages have an ad-hoc signature and are not notarized by Apple.
Verify the checksum and review the release information before first launch.
Apple documents its app-opening controls in
[Open apps safely on your Mac](https://support.apple.com/en-us/102445).

## Windows

Use a natively built Windows installer or extract the matching Windows ZIP into
a permanent folder. Native build and validation instructions are in
[Windows builds](windows-release.md). Do not treat a source build on another
operating system as Windows verification.

## Background operation and updates

Closing the window leaves the node running in the tray. Choose Quit to stop
the app and its connections. Start at login is optional under Settings.

To update, quit the installed application before replacing it. Its data folder is
separate from the app binary. Reconnect MCP after an update to refresh tool and
server instructions. Restart OpenCode if its bundled plugin changed.

## Removal

Remove `ncf_agent_interconnect` from the client MCP configuration and remove its
OpenCode plugin entry if present. Keep unrelated client settings. Disable Start
at login, quit the app and remove its binary. Data remains until explicitly
deleted; see [Privacy and storage](privacy.md).

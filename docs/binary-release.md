# Binary releases

Build natively on the target operating system and architecture. The builder
deliberately rejects cross-target runtime substitution.

```sh
npm ci
npm run build:release -- --mac
# Native Windows:
npm run build:release -- --win
```

The command prepares the runtime, checks TypeScript, runs core tests, builds the
renderer and core, packages the application and runs installed-runtime checks.
Outputs are placed in `release/` with `SHA256SUMS`, `README.md` and
`verification.json`.

Expected assets are a macOS DMG and ZIP, or a Windows installer and ZIP. Filenames
include NCF-Agent-Interconnect, version, operating system and architecture.
Dependencies, Electron/Chromium license files and project notices accompany
the packaged application.

On macOS, verify the app with `codesign --verify --deep --strict` and run the
packaged GUI test from an isolated data directory. Current packages are ad-hoc
signed without Apple notarization. Windows signing and native verification
must be recorded separately; see [Windows builds](windows-release.md).

Publish packages as GitHub Release assets with checksums, a tag matching the
source version, installation instructions and accurate platform verification
notes. Use the same frozen source for each platform and record its revision.
Do not publish node data, credentials, logs or private chats with a release.

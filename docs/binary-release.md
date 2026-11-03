# Binary releases

Use a short release cycle. Keep one version and source revision across platforms;
reuse completed checks when the relevant source and dependencies are unchanged.

## Routine cycle

1. Set the version and short release notes. Run `npm run check` and `npm test`
   once for the combined source, or reuse a successful check of that same source.
2. Build on each target operating system. Install dependencies with `npm ci`
   only for a fresh checkout or a changed lockfile. When the source checks above
   have passed, use:

   ```sh
   npm run build:release -- --mac --skip-source-checks
   # On native Windows:
   npm run build:release -- --win --skip-source-checks
   ```

   The flag skips only the duplicate type/core test pass. The native build and
   packaged-runtime verification still run. Without it, the builder also runs
   its own source checks; do not run those checks separately beforehand.

3. Run one packaged smoke on each available native test platform. Add feature-specific tests
   only for changed behavior or a concrete failure. A full fifteen-locale pass,
   long-history run, adapter matrix or installer lifecycle is not a routine gate.
4. Upload only the current installers, check version, filenames and upload
   completion once, then publish. Keep the description to changes and material
   limitations. Do not repeat server-digest or download checks without a transfer
   error or a concrete integrity concern.
5. After successful publication with all required installers, remove uploaded
   assets from older releases. Preserve Git tags, source history and release
   descriptions. Keep the previous installers until their replacements are live.

Publish three installers: macOS Apple Silicon DMG, macOS Intel DMG and Windows
x64 EXE. Use separate macOS packages, not a Universal package. Run native
acceptance on the available Apple Silicon Mac and Windows machine. There is no
Intel test machine: an Intel runtime test is not required and must not block
publication. State briefly that the Intel package was not run on Intel hardware.
The current builder uses the host architecture; this policy records the future
Intel packaging requirement without implementing it or changing the existing
Apple Silicon-only 0.13.0 release. ZIP alternatives are outside the routine
publication set and are not built by default.

`SHA256SUMS`, `verification.json`, logs and any acceptance reports stay local.
Do not upload separate README copies, screenshots or diagnostic archives. GitHub
creates source archives from tags automatically. Release assets are the intended
place for downloadable installers, separate from Git source history.

## Additional checks

Run locale checks for localization/layout changes; history and attachment checks
for their changes; and packaged adapter checks for changed adapters or packaging
boundaries. Installer, signing, dependency or runtime changes require the relevant
native checks. Do not repeat passed stages after a QA-only fix: rerun the failed
check against the existing binary. Rebuild when product code or packaging changes.

Build macOS packages on macOS and Windows packages on Windows. A source check
is not native runtime verification. Do not label the untested Intel package as
natively verified.
Automated checks use isolated profiles and configuration files, without live
agents. Never publish node data, credentials, private chats or raw logs.
macOS currently uses an ad-hoc signature without Apple notarization; Windows
packages are unsigned. See [Windows builds](windows-release.md).

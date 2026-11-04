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
   packaged-runtime verification still run on the host architecture. Without it, the builder also runs
   its own source checks; do not run those checks separately beforehand.

3. Run one packaged smoke on each available native test platform. Add feature-specific tests
   only for changed behavior or a concrete failure. A full fifteen-locale pass,
   long-history run, adapter matrix or installer lifecycle is not a routine gate.
4. Upload only the current installers, check version, filenames and upload
   completion once, then publish. Keep the description to changes and material
   limitations. Do not repeat server-digest or download checks without a transfer
   error or a concrete integrity concern. Before publication and worktree cleanup,
   retain the installers in the primary checkout's `release/<version>/` as described
   below.
5. After successful publication with all required installers, remove uploaded
   assets from older releases. Preserve Git tags, source history and release
   descriptions. The release-retention workflow performs this cleanup after a
   non-prerelease becomes Latest. Keep the previous installers until their replacements are live.
6. Remove completed task/release worktrees and their temporary local and origin
   `codex/*` branches on the participating machines, including detached worktrees
   and temporary publisher/staging repositories. Check ancestry or patch
   equivalence for cherry-picked changes; a different commit ID alone does not
   mean the change is unfinished. Preserve `main`, release tags, unfinished work,
   uncommitted files and directories needed by running previews, including their
   dependency targets. Keep private profiles outside disposable worktrees. Retain
   necessary standalone QA commits in one compact local bundle before deleting
   their branches, and record the remaining exceptions. Do not create another
   release or rerun product tests for documentation-only cleanup rules.

Publish three installers: macOS Apple Silicon DMG, macOS Intel DMG and Windows
x64 EXE. `--mac` builds both DMGs in one pass; `--arm64` or `--x64` selects one.
The non-host macOS architecture uses an official matching Electron download;
the host runtime is never substituted. Its package layout and Mach-O architecture
are checked without executing it. Run the packaged smoke on the available
Apple Silicon Mac and Windows machine. There is no Intel test machine: Intel
runtime execution is not a release gate and is reported as untested.
ZIP alternatives are not built or published by default.

## Local installer retention

Starting with the next release after 0.14.0, each native build machine keeps the
installers it builds in its primary repository checkout under `release/<version>/`.
On the coordinator's Mac, the directory is
`/Users/a.prokopenko/dev/agent-interconnect-mcp/release/<version>/`. Windows uses
`<primary-repository>\release\<version>\`; future Linux builds use the equivalent
repository-root directory when that platform is supported.

Copy the completed DMG/EXE installers out of disposable release worktrees before
publication or cleanup. Keep the platform/architecture in each installer filename.
These persistent version directories contain the distributions and remain ignored
by Git. The owner manages their retention: agents, scripts and release cleanup
must not delete, replace or prune their contents.

Temporary staging/build/evidence directories, including
`.local/windows-evidence-archive`, are cleaned after the installers have been
retained. Keep only necessary compact QA history or private backups outside those
temporary directories; do not accumulate duplicate installer archives there.
Never apply recursive temporary-directory cleanup to the primary `release/`
directory. This rule does not enable Linux packaging or require rebuilding or
downloading previous releases.

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

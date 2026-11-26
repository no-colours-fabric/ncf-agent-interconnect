# Windows shared ChatGPT session service

## Objective and starting state

NCF Agent Interconnect is the application and project; NCF abbreviates No Colours Fabric.
The owner requested ordinary ChatGPT startup with complete automatic incoming messages in
an occupied chat and wake of its exact unloaded chat, without a laboratory script or a
special shortcut. Superman owns shared setup UI and the shared-server wake mechanism;
Luna owns this Windows backend. Bob coordinates release numbering. The base is
9965ba8c8fecd5e1a43c5a62ba513aa56e6f92d8, including the Windows vendor resolver and
fa9af9d shared-owner wake. The shared UI patches are 2f9c000 and ed851c9.

See windows-local-responses-delivery-20261126.md for the preceding protocol and signed
GUI connection experiments, including the owner-denied sandbox administrator prompt.
No administrator prompt was repeated, working GUI restarted, or working profile changed.

Platform: Windows x64; registered ChatGPT MSIX 26.1120.6357.0; trusted vendor cache CLI
0.171.0-alpha.13.2; NCF Electron 45.1.0. Only the existing vendor-owned hash-derived
cache is used. Missing or changed vendor assets fail closed, without downloads/copies.

## Mechanism and boundaries

An explicitly enabled user-mode worker runs independently of the hub and starts the
genuine vendor foreground App Server for the selected existing stock profile. The
original signed ChatGPT selects it through CODEX_APP_SERVER_WS_URL. Its own private
named pipe bridges opaque WebSocket bytes to the existing authenticated AF_UNIX helper.
The service contains no model fixture, provider key, CLI override, or vendor-source patch.

The pipe has a protected current-user DACL, rejects remote clients, reserves its first
instance, and verifies the original registered package process or its one immediate
child, user, elevation, live process identity, exact main profile and data paths.
The native broker pins and hashes the registered assets and vendor-owned cache before
launch. It owns a separate hidden console and stops only its exact foreground process
gracefully. It never kills clients by name or changes permissions of vendor files.

The setup scope is user. Enable/Disable require ChatGPT closed and operate only on
their exact saved selector and autorun values. Foreign values are retained. An unknown
control outcome does not authorize a second mutation path or another worker launch.
Status is read-only; enabled means the owner's saved selection, not delivery receipt.
Receipts and exact-chat admission remain in the existing typed core.

The worker survives hub Quit. NCF startup, its own logon entry and installer completion
restore the saved service. **Starting ChatGPT alone cannot revive a stopped service.**
The owner can open NCF to restore it, or disable the saved setting and use normal
ChatGPT startup. An update stops the authenticated service before replacing files and
then restores it; a normal uninstall withdraws only its own registration. Other live
integrations remain installer blockers. Actual owner upgrade/uninstall tests are pending.

The first alpha deliberately supports the verified canonical default .codex and
Roaming/Codex layout with no MSIX shadow. Other layouts return unsupported rather than
routing a different profile. The approved shared UI shows the profile and scope before
the explicit action, requires closed ChatGPT on Windows, and offers read-only status
after uncertain results.

## Native observations and failed approaches

- Native exact current GUI identity/profile inspection passed in 136 ms without
  restarting or interacting with that GUI.
- Opening the protected WindowsApps container itself for READ_ATTRIBUTES was denied,
  while exact package/app/resources/file handles succeeded. Only that exact container
  gets a read-only GetFileAttributes no-reparse check; pinned children, asset hashes and
  identity checks remain mandatory. No ACL or package registration was changed.
- SHA256Cng with a sequential 1 MiB stream buffer avoids the excessive small-read cost
  observed in the first native hashing implementation.
- The socket filename can appear before listen readiness. Bounded retries are permitted
  only after the unchanged native helper proves pre-connect failure 10061 or missing
  directory 2/3. No protocol body has been released at those points. Unknown outcomes
  do not retry delivery.
- broker-trial-result-05.json: genuine foreground started; local-model turn completed
  on that server; a non-GUI peer was rejected; private control authenticated; graceful
  foreground and broker exit were both zero.
- worker-trial-result-02.json: the exact worker loaded from a miniature physical ASAR,
  published its isolated registrations, survived parent IPC disconnect, and disabled
  cleanly. Waiting for ChildProcess close after Electron IPC disconnect initially hung
  the harness despite actual process exit. The harness now observes exit explicitly.
- worker-trial-result-03.json: initial service restore succeeded, but stopping a detached
  restored foreground failed. Windows inherits the Ctrl+C-ignore attribute for a new
  process group. The broker now explicitly resets it before spawning the CLI and then
  ignores Ctrl+C only in itself. No product forced termination was introduced.
- worker-trial-result-04.json passed all recovery checks with the final broker: startup,
  hub disconnect survival, upgrade stop/exit0, retained choice, NCF-startup restoration
  of the same profile, second stop/exit0, saved-choice visibility, explicit disable,
  own selector removal, foreign Run preservation and disabled settings.
- Twelve scoped backend/native-registry tests and TypeScript passed. The registry test
  executes the product transaction redirected only to a UUID Software test hive, with
  no real Environment/Run writes. The worker fixture likewise redirects both registry
  keys and uses a synthetic profile, private appData and an isolated local provider.
  Its running-GUI count is fixture-specific, never a bypass in the product.

Compact native results are retained outside the disposable source worktree under the
primary checkout's .local/qa/windows-service-source-20261126. Earlier protocol results
are under .local/qa/windows-local-responses-20261126. They contain synthetic identifiers
only; fixture keys and environment contents are excluded from this report and product.

## Verification limits

The preceding HOT and unloaded/restart proofs used App Server-created chats, one exact
full userMessage, one receipt and an empty queue; the independent active turn was
preserved. The original signed GUI connected to that isolated server, but a GUI-created
chat and visible delivery were not proven. The owner explicitly accepted that boundary
and will test the installed alpha in the existing working profile. Ordinary-icon GUI
delivery, browser availability, real installation/update/uninstallation, and logon
restoration remain owner acceptance, not claims from protocol/source checks.

No working registry values, Pair state, client configuration, chats, shortcuts, release
artifacts or installed application were changed by these tests. No package is published.

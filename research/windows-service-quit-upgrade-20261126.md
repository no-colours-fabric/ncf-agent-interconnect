# Windows background delivery: Quit and upgrade

NCF Agent Interconnect is the application and project. NCF abbreviates the brand
No Colours Fabric.

## Objective and starting state

The owner reported that an upgrade remained blocked after normally closing
ChatGPT and quitting NCF Agent Interconnect. He then manually ended `codex.exe`
and `codex-code-mode-host.exe`. Their historical executable paths, parent process
IDs, console membership and the original installer trace were not captured.
These names alone do not identify an owned process or authorize stopping it.

The assigned isolated investigation starts at
`57eb92bc7af6a14ef2cf504ea65ea5ae94fa397f` (Windows alpha-5). Preserve the current
Quit semantics: the hub exits, while an explicitly enabled independent delivery
service can remain. The installer must stop its authenticated service before
replacing installed files, without force-closing a connected client. See also
`windows-shared-session-service-20261126.md` and
`windows-oneclick-field-integration-20261126.md`.

## Confirmed failures

1. The installer's WMI query projects ProcessId, CommandLine and ExecutablePath,
   but the returned objects lack their WMI object path. Calling GetOwnerSid on
   these projected objects raises InvalidOperationException. This fails during
   inventory, before the authenticated service-stop request, and can also fail
   during the final Restart Manager inspection. Including `__PATH` restores the
   existing owner check; it does not bypass it.
2. With inventory repaired, the private console shutdown accepts only the broker
   and its App Server. A direct code-mode host sharing that console causes a
   refusal before Ctrl+C. The isolated worker continues holding
   `resources/app.asar`; exclusive open and replacement remain blocked.

The second failure is a reproduced mechanism consistent with the owner's report,
not proof of the process tree that existed before he ended the two processes.

## Narrow correction

- Preserve the WMI object path in inventory and lock-holder queries.
- Remember the code-mode host path only after the existing registered vendor
  package and hash-derived cache checks have pinned and matched all assets.
- Permit that exact executable in the private shutdown console only when it is
  the live server's immediate child, has the same non-elevated owner, and has a
  valid creation time no earlier than the server. Hold the native handle through
  shutdown, recheck console membership, then send one graceful console signal.
  Wait for the server and verified children within the existing 15-second bound.
- Reject unknown paths, wrong parents and identity failures without signalling.
  Keep the active-client guard and final Restart Manager inspection unchanged.
- Name an external file-lock holder in the existing English installer prompt so
  its owner can close it normally and Retry. The installer currently supports
  en_US only. No application locale or renderer changes are made.
- Preserve the enabled preference, profile and history. Quit semantics, client
  configuration, registry selectors and normal delivery are unchanged.

## Native verification and unsuccessful fixture approaches

`test-desktop/windows-service-lifecycle.test.ts` compiles the actual product C#
helpers and an isolated .NET fixture. Harmless fixture executables replace only
process construction; real private-pipe ACLs, controller ownership checks,
Commands/StopServer, installer inventory, archive/helper hash checks and Restart
Manager execute. The query is restricted to a known fixture PID. No original
ChatGPT executable, model, working profile or installed service is used.

The first harness advertised readiness before reserving its pipe, producing
ENOENT and leaving four disposable workers. Readiness was corrected to reserve
the first pipe before announcing ready and reserve the next instance before
replying. Those four known workers were closed normally through their own
fixture endpoint after verifying their scratch executable and marker. No kill
or broad process-name shutdown was used.

An early harness used a fully loaded ManagementObject and therefore missed the
projected-inventory failure until the final lock check. It was corrected to call
the actual product Query for the known fixture PID. The resulting RED run failed
at inventory with InvalidOperationException in every case. After adding only
`__PATH`, the owned-host case still failed at service shutdown while active,
foreign-path and busy-editor protections passed. This separated the two defects.

After the console correction, five native scenarios passed (six node:test
results including the parent):

| Scenario                              | Observed result                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Hub absent, own direct code-mode host | Authenticated stop succeeds; no blockers; archive opens exclusively and can be renamed for replacement. |
| Active client channel                 | Stop refuses without writing; releasing that fixture channel and Retry succeeds.                        |
| Same basename from a foreign path     | Refuses without signalling; normal fixture closure permits Retry.                                       |
| Exact host path with the wrong parent | Refuses without signalling; normal fixture closure permits Retry.                                       |
| External editor holds archive         | Own service stops; editor stays alive and is named in the prompt; normal editor closure permits Retry.  |

Each case preserves the hashes of its enabled setting, profile history and
archive. TypeScript and repository formatting pass. Compact native RED/GREEN
logs and JSON remain outside the worktree under the primary checkout's
`.local/qa/windows-installer-lifecycle-20261126/`. The green run is
`native-green-05`, six passed, zero failed. The final TypeScript-only annotation
and formatting changes do not alter the native fixture behavior.

## Limits and first-upgrade compatibility

The active-client fixture exercises the product's native connected-channel guard;
it is not a signed ChatGPT GUI lifecycle test. The owner still performs the real
Quit/upgrade/ordinary-launch acceptance. No installer was built or installed and
no working process was stopped or restarted during this investigation.

Important open compatibility point: the new installer calls the stop command in
the currently installed old copy. That old service still executes its old console
matcher. A new helper fixes subsequent shutdowns, but does not by itself prove an
upgrade can stop an already running alpha-5 broker containing the old matcher.
The fixture deliberately tests matching corrected preflight/service code, not a
mixed old/new installation. This first-upgrade path remains unverified and was
reported to the release coordinator before any packaging request. Do not label
the original owner upgrade blocker resolved until this path is addressed or the
owner has confirmed the relevant old service is already absent. Do not bypass
active-client checks, kill by basename, or clear a saved delivery preference as
an upgrade workaround.

## Mixed-version result

The follow-up mixed native probe (`mixed-06`) compiled the unchanged broker and
Control implementation extracted byte-for-byte from `57eb92b` with SHA-256
`bbd7de7f39f247a4240602ecb79a67bfbe2db4e5a7cbe187214e893624e9cd71`.
It used the corrected preflight from `22125b2`. The old C# source was not patched;
the disposable worker/process-construction fixture remains a substitute for the
installed Node service and signed GUI. This is a mixed native helper test, not a
claim that a real ChatGPT window was started or closed during the probe.

- With no active client and a direct owned host, inventory recognizes the old
  worker and reaches its stop request. The old console matcher refuses; both the
  executable and archive remain locked. Enabled/profile/history fixture hashes
  are unchanged. The test passed by asserting this expected compatibility blocker,
  not by achieving a successful upgrade.
- With an active fixture client and no extra host, the old implementation refuses
  without stopping it. After normal fixture client disconnection, Retry succeeds
  and both executable and archive become available. The saved setting and history
  remain unchanged. These native guard results do not prove signed-GUI lifecycle.
- Both own fixture trees were then closed through fixture-only normal teardown;
  this is not a product recovery endpoint or a procedure available to the owner.
  No working process or client setting was touched.

The old protocol offers no operation to atomically reserve an inactive service
and replace its console matcher. Its failed stop re-enables acceptance. An
external AttachConsole/signal fallback following that refusal would therefore
race a new real client and bypass the existing active-client guard. It was not
implemented. Likewise, there is no justification for terminating a process by
basename or deleting the enabled setting to get past the installer.

A real old-service upgrade remains blocked until the old process tree is absent.
A normal Windows restart followed by installation before opening ChatGPT is a
possible owner-controlled transition, but has not been verified here: the enabled
service has an existing per-user autorun entry and may start again at login. It
must not be advertised as a guaranteed recovery. A safe field attempt must leave
the preflight refusal intact and stop if files are still held; it must not ask the
owner to repeatedly kill unnamed processes. The delivery coordinator received
the exact native result and this limitation before any package build.

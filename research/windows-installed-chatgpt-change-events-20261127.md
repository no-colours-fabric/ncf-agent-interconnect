# Windows installed ChatGPT version change events

NCF Agent Interconnect is the application and project. NCF abbreviates the brand
No Colours Fabric.

## Research boundary and objective

This research was explicitly designated in the Windows agent chat during issue 28.
The narrow objective is to find a read-only Windows package event source that
invalidates discovery without version polling or dependence on ChatGPT processes.
Routine version-selector implementation and acceptance are separate QA work.

Starting product: 5af40bb6d7e680d3ba2c2ba33a5fc100fccaba4d, with the AGENTS-only
merge 978489fd9431096c6b4257d07eccfc460302dd55 and the Windows version fix
3dd03add1ce062ea832adfffe63fd8af2455c457. The coordinator's intermediate b6d0b5c
was initially unavailable from origin (`upload-pack: not our ref`). Common main
and IPC changes require agreement with Kontur; no renderer changes are owned here.

## Options and observed results

Windows 10.0.19045 x64 / Node 22.23.1 / Windows PowerShell 5.1:

- A read-only check found the current user's AppModel Repository Packages key
  accessible and one registered OpenAI.Codex entry. RegNotifyChangeKeyValue is a
  documented notification primitive, but relying on the internal repository key
  layout is unnecessary when the package catalog exposes explicit lifecycle events.
  No registry watch or mutation was implemented.
- `Windows.ApplicationModel.PackageCatalog.OpenForCurrentUser()` succeeded.
  Installing, updating, uninstalling and status events are exposed on this OS.
- PowerShell `Register-ObjectEvent` rejected WinRT events with
  `Windows PowerShell не удается подписаться на события Windows RT.`
- Reflection EventInfo.AddEventHandler/RemoveEventHandler also rejected dynamic
  WinRT event registration. The `finally` removal exception obscured the first
  error in that probe; it is not evidence of a successful registration.
- The actual add accessor returns EventRegistrationToken; calling its matching
  remove accessor with that token succeeded. The read-only probe printed
  `subscribed` then `unsubscribed`. No package was installed, updated or removed.

## Implemented event source and native validation

The Windows-only main module uses a private hidden PowerShell child and a .NET
callback. It opens the catalog for the current user and retains each handler and
registration token. Completed package operations and status events for the exact
OpenAI.Codex family produce only a `changed` marker. The marker carries no version,
path, identity authorization or configuration. Normal discovery remains responsible
for registered package verification and archive metadata.

A `ready` marker closes the gap between an initial read and subscription. EOF on
the private stdin removes all four subscriptions and exits. Unexpected stream
failure reconnects the event transport with bounded backoff; it does not poll
package versions. GUI open/close has no input route in this source.

Unit checks cover marker filtering, disposal, transport failure/reconnection and
non-Windows no-op. The Windows native fixture uses real catalog token registration
and removal, with synthetic CLR callback arguments for matching/nonmatching
identity, incomplete installation, update target and status. It does not mutate
the actual installation or assert that a synthetic callback is a real MSIX update.

The first native fixture timed out because it tried to reference an in-memory
Add-Type assembly by an empty Assembly.Location. The fixture was corrected to
compile its synthetic types alongside the callback and to reject on helper exit
and always dispose on test completion. The failed own test invocation was stopped;
no working ChatGPT or NCF process was stopped. The corrected native fixture exited 0.

## Limits and retained evidence

No actual MSIX update, uninstall, GUI close/open, working profile or registry setting
was changed. An actual update-to-open-panel integration check remains separate
from the native subscription proof and requires the agreed shared discovery hook.
Compact logs are retained in the primary checkout at
`.local/qa/windows-round-25-28-35-38-20261127/`.

Primary references:

- https://learn.microsoft.com/en-us/uwp/api/windows.applicationmodel.packagecatalog
- https://learn.microsoft.com/en-us/uwp/api/windows.applicationmodel.packageupdatingeventargs
- https://learn.microsoft.com/en-us/uwp/api/windows.applicationmodel.packageinstallingeventargs
- https://learn.microsoft.com/en-us/uwp/api/windows.applicationmodel.packagestatuschangedeventargs
- https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-regnotifychangekeyvalue

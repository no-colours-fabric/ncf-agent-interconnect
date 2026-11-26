# Windows discovery and background-delivery disable: issues 11 and 35

NCF Agent Interconnect is the application and project. NCF abbreviates the brand
No Colours Fabric.

## Objective and baseline

The owner assigned Windows acceptance for discovery after disconnect with Port
(issue 11) and Windows delivery-service disable lifecycle with Kontur and Mika
(issue 35). Source: 94519243f185338b0e48cb156bd6687d9d4e62d6, verified source-only
bundle with prerequisite a555d7a and SHA-256
cda38c6a2d85ae87468189ac983c5f6a0f10f9be88227bfcea1803107e5e0366.
The originally named 054f7db/ref was unavailable; the coordinator states that
94519243 has the same desktop source with product metadata. The Windows delivery
backend/service/native broker are unchanged from the available alpha-9 product.

Windows 10 build 19045, host Node 22.23.1 x64. Installed NCF executable version
was read as 1.1.0-alpha-9-20261126T192806. Registered ChatGPT MSIX is
26.1120.6357.0 (application 26.1120.50957). No working profile, live pairing,
release branch or package metadata was changed, and no installer was built/run.

Related records: windows-service-quit-upgrade-20261126.md (source history),
windows-alpha8-package-20261126.md and windows-alpha8-owner-acceptance-20261126.md
in the primary local research directory. Issue 29 is outside this round.

## Issue 35: verified results

The unchanged baseline Windows backend and native lifecycle tests passed 19/19
on this source. They cover correct own process shutdown, active-client refusal,
same-basename foreign processes, wrong parents, independently busy files and
the explicit expected-profile/close-required/ambiguous-result guards.

A separate bounded native experiment executed the real CJS worker, real compiled
broker and trusted packaged vendor CLI in a fresh profile with no account or
model requests. The worker's normal runtime ASAR/stamp/native-helper/package
checks ran. The current installed helper was checked against the exact installed
alpha-9 archive and identity stamp before its test-only copy was used. Its hash:
65a7d76eb23907281a132984d9bed1778c7c631daa166258696f6f18fe487112.
No vendor binary was downloaded, modified or copied from WindowsApps.

The harness redirected only the existing registry transaction's literal key
paths into a unique non-startup Software test hive. It excluded the unrelated
working GUI from the outer package-running count for this new disposable home;
the actual broker retained its native package/image/SID/parent/start and console
ownership checks. No GUI was launched or terminated. This is an explicit fixture
boundary, not a test of the handler's default-profile restriction on a second
real user profile.

| Scenario                                      | Observed result                                                                                                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh saved enable and real worker startup    | Enabled reply on the exact fixture profile; authenticated native control status enabled.                                                                                     |
| Explicit disable                              | Ready reply; worker exit zero, native broker/server/helper PIDs no longer alive, saved enabled false.                                                                        |
| Enable and disable again                      | Same successful result, profile and pipe ID preserved.                                                                                                                       |
| Foreign Run entry during second disable       | Only the owned selector removed; unrelated test Run value preserved.                                                                                                         |
| Existing fixture history and configuration    | Byte hashes unchanged after both cycles.                                                                                                                                     |
| Repeat disable with the worker already absent | Ready; disabled choice preserved; no worker start. The real native helper established absence; registry/broadcast boundaries were mocked for this final handler-only repeat. |
| Active-GUI marker in the handler fixture      | Enable and disable both return close-required before any additional save/start/registry operation. No real GUI was used as the marker.                                       |

The first full-worker attempt stopped before any profile/server creation because
the harness still pinned the older alpha-8 helper hash. It was corrected to
validate the current exact alpha-9 archive and its matching helper stamp. This
was an investigation harness correction, not a product change. The repeat-only
driver's first invocation used a Windows absolute path as an ESM import specifier;
it stopped before running the test and succeeded after using a file URL.

The successful Windows reply still includes requiresClosedChatGPT: true. Closing
ChatGPT is a precondition; the backend does not request an additional post-action
restartRequired field. Actual ordinary GUI launch remains unverified. Mika
confirmed that the common UI/contract 910e868 is compatible: no post-disable
restart dialog when restartRequired is absent. Kontur keeps ready as success,
not partial stop. No Windows product fix or common union/renderer change was
necessary on this baseline.

Limits: ordinary signed ChatGPT GUI launch after disabling was NOTRUN. Removal
of the fixture selector and preservation of fixture config/history do not prove
that UI scenario or the working account's behavior. These are native service,
transport and controlled backend tests, with no model, real chat or GUI acceptance.
The affected checks must be repeated on the final common revision before a build.

Compact private QA remains in the primary checkout's
.local/qa/windows-round-11-35-20261126/: baseline.log/native-baseline.json,
worker-disable-result-02.json, repeat-disable-result.json and the reviewed
controllers. Completed disposable native profiles/archives were removed only
after verifying exact workspace scope, own markers, zero runtime references
and no reparse entries; native-cleanup.json records that cleanup. No release
artifact or working profile was removed.

## Issue 11: safe two-host baseline

Port's supplied original observation: Windows Disconnect for Mac, then the first
Mac search misses Windows while the reverse direction and manual request work.
It is a report supplied by Port, not a captured old-run timing measurement.

The joint fresh-node harness uses actual NodeService and UDP discovery with
separate multicast group 239.255.73.137 and port 47337. The only temporary source
adaptation allows that test group/port and captures errors; production defaults
and working discovery remain unchanged. Fresh state and ephemeral TCP ports
prevent overlap with the working peer. No addresses or profile names are
included here. Windows listener inventory: loopback /8, virtual external /20 and
physical external /24; three listeners, no transport opening errors. Mac reports
loopback, /24 and /21. No OS interface, VPN or firewall changes were made.

Mac's test approval path additionally contains issue 13; its discovery/disconnect
source matches the baseline. This limits an exact whole-product cross-platform
SHA claim for Pair. The Windows side uses baseline approval and explicitly
confirms after progress shown.

Before any disconnect, Windows already receives Mac announcements while Mac
reports zero raw Windows UDP announcements. Thus the asymmetric symptom does
not first arise from Disconnect or search-cache state.

First pairing direction: Mac initiates, Windows approves, both Connected. Windows
zeroes counters and disconnects; both first searches run once:

| Snapshot    | Windows searches for Mac         | Mac searches for Windows (Port observation) |
| ----------- | -------------------------------- | ------------------------------------------- |
| +0 seconds  | Searching, not found in this run | Searching, not found                        |
| +10 seconds | Found in this run                | Not found; no raw Windows UDP               |
| +30 seconds | Complete, found                  | Complete, not found; raw Windows UDP 0      |

Windows counters from zero to +30: queries in 9, out 3; Mac announcements in 5,
observations 5; Windows announce send calls 10; faults none. At +0, two old-run
Mac announcements had arrived before search start, so they were not counted as
fresh run discoveries. Send-call counts are not proof of wire delivery.

Two independent one-packet controls used the same valid test-node announcement,
157 bytes, explicitly bound to Windows /24 and the test port only:

| UTC time     | Path                              | Native callback    | Mac observation reported by Port        |
| ------------ | --------------------------------- | ------------------ | --------------------------------------- |
| 19:21:29.457 | Multicast through /24 only, TTL 1 | No error, 4.750 ms | Windows announcements 0, observations 0 |
| 19:22:02.882 | Unicast to the isolated Mac /24   | No error, 2.533 ms | One announcement, one observation       |

This establishes a multicast/unicast delivery distinction. It does not alone
identify the OS/network component dropping multicast or prove a Windows
interface-selection product bug. A callback success does not prove reception.
The reverse manual Pair initiated by Windows then reached Connected after
progress shown, confirm-baseline true and progress paired. The mirror baseline
was subsequently checked below, before applying any candidate product patch.

The mirrored baseline also completed: Windows initiated Pair, Mac approved,
Windows confirmed baseline approval, both Connected; Mac then disconnected.
Windows first post-disconnect search (run 2) started within 19:26:21–19:26:25 UTC.
At +0 seconds it was searching/not found; +10 found; +30 complete/found.
Counters zero to +30: queries in 7/out 3, Mac announcements in 3/observations 3,
Windows announcement send calls 6, no faults or transport restart. This confirms
the successful Windows receiving direction independently of disconnect initiator.
Mac's mirror result is supplied separately by Port.

The first received candidate probe patch was reviewed but never applied or run:
its direct-query schema was not matched by the receive branch, which would then
access nodeId on a query. Port independently withdrew that exact patch after his
fixture caught the same problem. No source fix was improvised by the Windows
tester; the corrected candidate remains Port's responsibility.

## Issue 11: candidate-v2 native run

Baseline probe quit with exit zero before applying the corrected candidate.
The baseline-only patch was reversed, then Port's v2 patch applied. Exact patch
SHA-256: 0ce2c18ff2dfcf4ef03d0f44f3418792ac1225f656cc9b43c84458dcee078c27.
Test-adapted lan-discovery.ts Git blob:
74b34a12555c97d2af86747cf711de2f938b3bce. The harness's source hash is
a3b6dfa93605ef027559fc67a2a978b391bb0639862c758e1278b104d22e6054.
These identify the tested candidate including its nonproduction group/port
parameter. Port owns the production change; no Windows product commit or build
is implied by testing this temporary adaptation. Port reported 76 affected tests,
TypeScript and diff checks passed before transferring v2.

Both fresh candidate probes used the same separate group/port as the baseline.
Mac initiated Pair, both Connected, Windows disconnected, each side ran its first
search once. Windows search began within 19:30:43–19:30:47 UTC.

| Snapshot    | Windows result/counters                                                                  | Mac result reported by Port                          |
| ----------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| +0 seconds  | Searching/not found; query out 1, direct query out 1, direct in 0, unicast replies 0     | Not found                                            |
| +10 seconds | Found; direct queries in 3, unicast replies out 1; Mac announcements in 2                | Found; one accepted Windows announcement             |
| +30 seconds | Complete/found; direct queries in 9/out 3, unicast replies out 3; Mac announcements in 4 | Complete/found; three accepted Windows announcements |

At +30 Windows also had compact queries in 9/out 3, total announce send calls 15,
observations 4, no errors or transport restart. Mac reported three direct queries
sent and no incoming compact Windows multicast queries, so the successful direct
answer path was observed independently of fixing the underlying multicast loss.
The mirrored candidate scenario was then completed as described below.

The mirrored candidate completed successfully too: Windows initiated the new
Pair, both Connected, Mac disconnected and started its first search; Windows
then zeroed counters and started run 2 within 19:34:06–19:34:10 UTC.

| Snapshot    | Windows result/counters                                                               | Mac result reported by Port                                                |
| ----------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| +0 seconds  | Searching/not found; direct query out 1, replies out 0                                | Disconnect visible, unpaired, not found                                    |
| +10 seconds | Found; direct queries in 3/out 2, unicast replies out 1, Mac announcements 1          | Found; direct query out 1, one accepted Windows announcement               |
| +30 seconds | Complete/found; direct queries in 7/out 3, unicast replies out 1, Mac announcements 3 | Complete/found; direct queries out 3, three accepted Windows announcements |

Windows final compact queries were in 7/out 3, announce send calls 7, observations
3, no faults or transport restart. Mac again reported zero incoming Windows
multicast/query and no faults. The candidate therefore restored first-search
discovery on this tested asymmetric topology in both disconnect directions,
without requiring a second search or manual address entry after disconnect.

Port identifies production code 0f00e6f228e7b063781853221f8389e880443066 and the
same tested LAN blob 74b34a12555c97d2af86747cf711de2f938b3bce. Final integration
and approval-path changes still need the final common-source verification.

Both own Windows probes quit with exit zero; their finally blocks closed the
isolated NodeService and removed their unique temporary state. Port reports the
same cleanup on Mac. Reviewed probe/patch copies were retained in primary QA,
then only the exact temporary adaptation and unchanged copied probe files were
removed from this worktree. No production network fix was authored or retained
by Luna: Port owns its immutable source. The only task source result here is
this research report. No installer, package metadata or live client was changed.

Before packaging, rerun the affected Windows backend/native lifecycle checks on
the supplied final integration revision; this report does not claim that future
gate passed. Ordinary signed GUI launch after disable and real working-profile
UI acceptance remain open. All observed network results are from the fresh
two-host NodeService stand, not the installed application UI.

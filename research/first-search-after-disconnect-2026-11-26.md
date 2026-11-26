# First search after Disconnect on macOS and Windows

Related: [network discovery transport](network-discovery-transport.md), [remote nodes feedback](remote-nodes-feedback-1.1.0.md), and [receiver-only connection approval](receiver-only-pair-approval-2026-11-26.md).

## Setup

- Baseline discovery source: `054f7dbb84b7799838ae16ee972d689815994f12`. The Windows baseline checkout was `94519243f185338b0e48cb156bd6687d9d4e62d6`. The relevant desktop sources were identical between those revisions. The Mac baseline probe included the independent receiver-only change for approval. Discovery and Disconnect logic were still at baseline.
- Mac: Darwin 25.5.0, Node 22.12.0, one LAN IPv4 interface /24 and a tunnel interface /21, plus loopback. Windows 10 build 19045, Node 22.23.1, active /24 and /20 IPv4 interfaces, plus loopback. The paired route used the shared /24. Both systems kept their existing VPN and network settings.
- Tested the real core and native UDP/TCP on two physical computers, with fresh temporary state and separate peer/MCP ports. The test group and port were `239.255.73.137:47337`. The program never used the live discovery group/port, application profiles, agent directory, or working peer state. The probe displays a test endpoint only on an explicit command. Omit that output from retained logs.
- Candidate source: `0f00e6f228e7b063781853221f8389e880443066` (LAN discovery blob `74b34a12555c97d2af86747cf711de2f938b3bce`). The Windows test applies the discovery patch and probe to the identical baseline desktop source. Its baseline pairing code retains the independent local confirmation.

## Reproduction and diagnosis

1. Start the isolated probes with the same discovery group. Check inventory and the initial counters. Use the exact shared-LAN test endpoint and node ID to request a connection. Accept on the recipient. For a baseline initiator, use `progress`, `confirm-baseline`, and `progress`. For the updated initiator, use `progress` after recipient approval. Verify Connected on both.
2. Reset counters and use `disconnect` on Windows. Start `search` once on each system. The probe snapshots the run at 0, 10, and 30 seconds. Repeat after a fresh request in the opposite direction, with Mac initiating Disconnect.
3. Compare transport ingress (`otherAnnouncesIn`) with accepted observations (`otherObserved`), query counters, current-run results, and the Disconnect state. Inspect sender callback evidence separately from attempted send counters.

The baseline reproduced both directions of Disconnect. After Windows initiated Disconnect, Mac's first search finished without Windows. Mac attempted three queries, received zero Windows announcements, and reported no transport error. Windows received the Mac queries and found Mac at 10 and 30 seconds. After reverse manual pairing and Mac-initiated Disconnect, the same pattern held. The Mac run showed no Windows announcements or result at 0, 10, and 30 seconds. Windows found Mac at 10 and 30 seconds. Both directions of the manual approval exchange worked; both sides reflected Disconnect.

The asymmetric multicast delivery was already present before Disconnect. Mac had active memberships for the test group on the /24 and tunnel interfaces. Windows sent one valid test announcement on its /24 as multicast, followed by the same test announcement over unicast to the Mac /24 on the same UDP port. Both Windows send callbacks succeeded. The Mac UDP receive callback recorded zero Windows announcements after multicast and one after unicast, which the discovery parser accepted. This evidence places the observed loss before the Mac application packet parser and shows a working direct UDP route. The hosts' internal or network component dropping multicast was not identified. The test did not require VPN or firewall configuration changes.

## Change

Keep existing multicast queries, periodic announcements, and multicast responses to compact queries. A new padded query additionally requests a reply to the validated source IPv4 at the fixed discovery port. The responder uses the live advertised address in the most specific matching local subnet. The batch limit is eight unique sources per two-second reply window. Replies cannot exceed the query size. Existing receive caps and strict announce schema are unchanged. The original compact query cannot trigger an address-directed reply. Older peers can continue with multicast; both sides must support the new query to use the one-way-multicast recovery path. The result remains an untrusted discovery observation. Pairing and TLS checks are separate.

The first attempt to use compact queries for directed replies failed the existing no-unicast-reflection test. That approach was replaced with the distinct padded request, and the legacy request test now explicitly verifies that its replies stay multicast. The focused new test verifies selection of the most specific live sender, malformed/off-subnet rejection, per-source deduplication, batch limits and reply-size bounds. All 76 affected tests, TypeScript, formatting and diff checks passed for the candidate.

## Candidate on the same macOS/Windows pair

| Disconnect initiated on | Mac first search at 0 / 10 / 30 seconds | Windows first search at 0 / 10 / 30 seconds |
| ----------------------- | --------------------------------------- | ------------------------------------------- |
| Windows                 | Absent / found / found                  | Absent / found / found                      |
| Mac                     | Absent / found / found                  | Absent / found / found                      |

All four searches started with the remote pairing removed and finished in the same run. Mac accepted one Windows announcement by 10 seconds and three by 30 seconds in each run. Windows recorded three directed replies during its first zero-to-30-second snapshot window and one during its second window. The second Windows counter reset occurred after Mac could already start searching, so the two hosts' counter windows do not align exactly. Windows accepted four Mac announcements in the first completed run and three in the second. Mac still received no Windows multicast queries. Neither probe restarted its transport or reported a transport fault during the searches. The same network settings and interface inventories were used for baseline and candidate. Both probes exited normally and cleaned their own temporary profiles.

These were native socket and core acceptance runs on the two target operating systems with a non-production discovery group. Installer behavior, native Electron window/focus, Linux and the exact multicast-loss component remain unverified.

## Probe use

With dependencies installed on the candidate, run `node --experimental-sqlite --import tsx research/remote-nodes-native-probe.ts Mac <revision>` or substitute `Windows` on Windows. Use the same isolated group on both sides, only one probe per host. Commands: `inventory`, `status`, `zero`, `endpoint INDEX`, `request URL NODE_ID`, `approve`, `progress`, `disconnect`, `search`, and `quit`. To create a baseline scratch copy, apply only the discovery group/port injection and optional error argument from the candidate's `udpLanTransport` and copy the probe. The original request protocol and original multicast actions must remain unchanged in that copy.

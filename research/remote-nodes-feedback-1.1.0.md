# Remote nodes feedback for 1.1.0

Starting source: `f9d9cf0d3bef08f874db5e6177b4a2d61d356dd2`. Related: [Remote node approval and removal](remote-node-approval-and-removal.md) and [Network discovery transport](network-discovery-transport.md).

## Disconnect and the first search

The old removal cleared local trust, terminated its socket, and left the second node's pairing intact. The second node could retry the stale credential and surface the raw WebSocket upgrade refusal. Its retained pairing also filtered an available node out of the first owner search. Clearing a browser row or discovery cache alone would not revoke the selected pairing.

Local Disconnect still uses the precise authorization selected by the owner. After durable removal it sends a private WebSocket close code on the current authenticated link. The receiver acts on it only after authenticating the exact peer and checking the current link generation and authorization. Both sides remove only that peer's entry, stop its reconnect work, and show a localized transition. Discovery can then surface any fresh observation for that node. Other peers, agents and message history use their existing storage.

An older node or an interrupted link may not send the close code. When a reachable paired endpoint refuses authorization, the new node checks both the pinned certificate and the exact UUID through the existing public identity endpoint before retiring the rejected authorization. A different UUID or unavailable identity probe leaves the entry intact. An older app cannot render the new status. A node without a live link or reachable configured or discovered route learns of the change only when a route becomes available and the peer can be verified.

## Comparison code

The previous receiver-only approval exchange did not prove that both people were looking at the same pending request. The versioned approval route commits the requester's identity and random token before returning the receiver's fresh challenge. The verified signed transcript includes the challenge ID, both node IDs, certificate digests and names, and the requester token. Both nodes independently derive the same six decimal digits from that transcript, including leading zeroes. The digits are for visual comparison. The actual pairing still uses the full authenticated transcript, exact node ID, certificate pin and generated credential.

Each owner must confirm the same request. After confirming first, the receiver keeps the code visible. A cancellation authenticated by the commitment also works when it reaches the receiver before the signed request. Retries get fresh challenges and commitments. Suppression stays scoped to the existing UUID and certificate combination. The old approval route is deliberately incompatible with bilateral comparison, so mixed-version nodes use the unchanged access-code flow.

## Verification

The loopback suite uses disposable profiles and injected discovery. It exercises Disconnect from the connector and from the accepting node, runs the first search on both computers, checks both peer stores, and covers unrelated links and local history. Approval cases cover both decision orders, cancel, mismatched commitments and signatures, old endpoints, repeat and suppression. A separate mixed-revision loopback run loaded the exact starting source plus the new implementation. Access-code pairing worked in both directions. The new side handled a legacy refusal without displaying the raw status and preserved trust when the pinned endpoint reported a different UUID.

The renderer tests run the actual React entry point with fixture IPC in isolated Chrome. Native Electron window and focus behavior, actual LAN multicast and release installers remain unverified.

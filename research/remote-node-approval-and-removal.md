# Remote node approval and removal

Issue [#8](https://github.com/no-colours-fabric/ncf-agent-interconnect/issues/8) and ROADMAP R-0013 start from release base `d0d8eb506cedb17c51792ffc9ef96ba3c1a97df4`. Related transport investigation: [network-discovery-transport.md](network-discovery-transport.md). These changes use the existing peer listener and current manual address forms.

## Selected connection removal

The renderer captures the selected peer ID and an opaque token for its current authorization when it opens the confirmation dialog. The token is derived from the current peer credential and certificate and is only included in the owner renderer snapshot. The serialized settings write verifies both values, so a stale dialog cannot delete a replacement pairing. The network closes only that peer's sockets, retry timer, alternate probes and pending attachment requests after the durable write. Code-session and approval state for the selected peer is discarded. Other peer records, active links, local agents and the history database are left alone.

Closing a socket alone is insufficient: the timer, discovery routes and configured addresses may schedule a new connection. An ID-only deletion also leaves a stale confirmation able to remove an authorization replaced since the dialog was opened.

## Receiver approval

The legacy strict `/pair` SRP exchange and its one-use access code remain available. Adding an approval phase to that route would break the old receiver's parser, so the new exchange uses a separate versioned transcript at `/pair-approval`. A 404 leaves the code form usable and produces a specific compatibility message.

A public challenge contains a fresh ID and the receiving node's identity. The requester checks that the certificate in the response matches the TLS certificate it observed and that the expected discovery UUID, if present, matches. Subsequent requests use that certificate pin and the frozen address. The requester signs a transcript covering the challenge ID, both IDs, labels and certificate digests, and a random session token with its existing TLS private key. The receiver verifies the signature before exposing a dialog and checks any already-paired certificate pin. The UI shows details of the actual signing node. Initial discovery and initial manual addressing still have no pre-existing identity trust for never-paired nodes.

The receiver acknowledges display after the dedicated renderer has drawn the requester details and Electron reports that its window is visible. A close dismisses the exact pending ID. A retry creates a new ID. Confirmation authorizes only that frozen request. The requester must then commit the authenticated exchange before either node adds the pair. The receiver commits first and can acknowledge an identical retry. The requester can then save the verified recipient, with the per-peer lease and commit fence still in force. Interruption after the receiving side commits may leave a one-sided authorization. A new explicit approval or code pairing can recover that state.

Suppression is saved for the UUID and certificate digest together. Pairing with the explicitly supplied code clears the matching suppression atomically with peer settings. Profiles without active suppressions omit the optional setting. Downgrading the same data directory to an older release with a strict settings schema may require removing the new field when active suppressions exist. The code compatibility result is between two nodes, each with its own profile.

Challenges, requests and retained receipts are bounded and expire. An approval window does not create or replace the local access code. Discovery, automatic reconnect for other paired nodes, agent directory capabilities and the local MCP listener are unchanged.

## Verification scope

Loopback fixtures covered confirmed removal of a connected node, another live peer, retained local agents and history, a wrong or stale removal token, persistence across restart, and explicit re-pairing. Approval fixtures covered waiting versus displayed, close without admission, exact repeated request, positive pairing, signed requester proof, durable per-certificate suppression, reset by successful code, old endpoint 404, and continued code pairing. A separate mixed-revision run loaded the exact baseline source and the new source in the same isolated harness. Baseline and current nodes paired by code in both directions, and the current node recognized the baseline's response as unsupported for receiver approval. No live NCF agent or existing product profile was used by the tests.

The renderer suite exercises the exact application entry point with a fixture bridge and blocked external requests. This can verify the controls, display acknowledgement contract and code form. Native always-on-top behavior, focus policies and installation on macOS, Windows and Linux are release acceptance checks.

The selected code-dialog regressions and the new removal and approval renderer cases passed. The wider browser sweep found that the sticky-header case fails its geometry precondition before checking acknowledgement. The isolated case reproduced the same assertion on the exact baseline and on the new code.

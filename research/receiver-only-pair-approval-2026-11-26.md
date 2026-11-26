# Receiver-only connection approval

Starting revision: `054f7dbb84b7799838ae16ee972d689815994f12`, `1.1.0-alpha-9-20261126T192806`. Related: [remote nodes feedback](remote-nodes-feedback-1.1.0.md).

## Finding and change

The initiator already explicitly selects the destination and sends the signed approval request. In the baseline, the requester also had to click a second local confirmation after the recipient displayed the comparison code. A focused loopback test reproduced the extra requirement: the recipient had approved the exact request, both peer stores were empty, and the first progress request still left the recipient dialog pending.

The requester now displays the six-digit code and keeps the request pending until the recipient's approval. After approval, the initiator commits automatically through the unchanged, certificate-pinned v2 exchange. The recipient still validates the signed request, requires the displayed request ID and an explicit approval, and rechecks the request and interface policy before saving or acknowledging the peer. The code still derives from the same authenticated transcript on both machines. Cancellation, suppression, and the separate access-code flow remain available. The address field and its parsing are outside this change. The two changed strings cover all 15 product locales.

## Verification

- The focused regression failed on the baseline and passed after the change. Both stores remain empty while the code is displayed and immediately after recipient approval, until the authenticated commit. The test then verifies the exact UUIDs, connecting address and shared authorization.
- 43 loopback tests passed for approval, access-code pairing and disconnection. Coverage includes wrong expected identity, dismissal and retry, cancellation after approval and before commit, suppression, and access-code fallback when the approval route is unavailable.
- Two targeted Chrome fixture cases ran the actual main renderer and recipient popup. They verified the six-digit code in both, the recipient-only confirmation control, the wait state, cancellation or dismissal, and retention of the manual access-code flow. The fixture substitutes IPC; operating-system window and focus behavior remains unverified.
- The exact baseline source and the changed implementation successfully paired in both directions on isolated loopback. A new initiator commits after the recipient approves, including when the recipient runs the baseline. A baseline initiator retains its local confirmation requirement, including when the recipient is new. The unchanged v2 protocol permits both combinations. The non-v2 fallback was tested with an isolated missing-route fixture, not with a native installer.
- TypeScript, affected-file formatting and the diff check passed. No working profiles or release metadata were changed.

# Agent rename and message identity

Base: `d21566cb2b06e6d831a03a8a5e90c7acb31810b9` (R-0018).
Related records: [Cursor reactivity](cursor-reactivity.md) and
[Claude native integration](claude-code-native-integration.md).

## Findings

The prior store used the normalized nickname as the primary key, as the
mailbox owner on message rows and as an authority stamp on delivery attempts.
Moving that key would invalidate a legitimate in-flight admission. Rewriting
the envelope would also change duplicate detection, historical sender and
recipient fields, and retained payload hashes. Neither approach was tested
against a live client.

Storage format 6 adds a unique normalized name to the existing agent row.
The migration preserves the primary key, incarnation, binding and stored
envelope. Renaming updates the display and routing names in one transaction.
A previously used name is reusable. If its former owner still holds the
legacy storage key, the new mailbox gets a separate key. Unconfirmed transfer
approvals for the old name are discarded on a successful rename. Current
admissions, message cursors and attachment ownership follow the stored key.

Local sends capture an existing recipient's key and incarnation before
asynchronous attachment preparation. A rename during that send preserves the
captured mailbox. A reset or removal during preparation cancels the send
instead of delivering into a replacement mailbox. Replies use the original
outgoing message ID, matching original sender name and reverse node route.
This lets old references reach the renamed sender even if the old name has
already been reused. The receiver trusts the authenticated origin node for
the identity of the replying mailbox on that node.

## Validation and limits

Tests use a format-5 fixture, isolated loopback sends, real fixture files and
stored delivery-attempt state. Remote reply routing is covered at the store
boundary. The first loopback attempt hit the sandbox listen restriction.
Two early fixture issues were missing legacy defaults and a missing export
root. Explicit name-based and key-based lookups keep the previously supported
name-based stamp behavior.

An ordinary network message that has yet to reach the destination node still
carries a nickname only. If it uses the old name and has no matching original
message for its reply, ordinary name-based routing applies at acceptance.
No permanent alias or network protocol field is added. Native client and
installer behavior remain unverified in this slice.

# Short access codes

To connect two computers, enter the receiving node's address and its temporary
eight-character code. No certificate copying, export or manual trust decision
is required. Codes use `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, accept either letter
case and contain no punctuation. Eight independent random symbols give 40 bits
of entropy. A checksum would replace random symbols; authentication already
rejects mistyped codes, so all eight positions remain random.

A code expires after ten minutes and permits five handshake starts across all
clients. Invalid starts also consume the budget. Each started session permits
one proof attempt. One successful claim authorizes one peer. Creating a new code
invalidates sessions whose settings write has not begun. Stop or restart clears temporary codes and
sessions; saved peers, identities, keys and message history are preserved.

## Protocol

This is an application PAKE over HTTPS, independent of the established
protocol-2 WebSocket transport. It uses the pinned `fast-srp-hap` 2.0.4 library
with its fixed `SRP.params[3072]` group, SHA-256 and HAP proof mode. The SRP identity
is the ASCII string `ncf-pair/v3`; the password is the uppercase ASCII code.
Neither side accepts group, hash or proof-mode parameters from the network.
The implementation uses fresh 32-byte salts and private values per session.

The initial TLS certificate is untrusted. Only public identities, certificates
and PAKE values cross that channel. The code and the permanent peer credential
are never transmitted. The client checks that the advertised certificate equals
the actual TLS certificate, then pins subsequent handshake requests to it.
PAKE authentication establishes that this certificate belongs to the code holder.

`POST /pair` has three phases:

1. `start`: exchange public identities and receive a random session UUID, salt
   and server SRP value B. The response fixes version 3 and suite
   `srp6a-3072-sha256-hap`.
2. `prove`: send A, M1 and a client MAC. The server verifies the MAC in constant
   time before checking M1. It returns M2 and a server MAC. The client verifies
   that MAC in constant time before checking M2. No peer is admitted yet.
3. `confirm`: the client authenticates its acceptance of the server proof. The
   server persists the peer in the settings write queue, rotates any previous
   connection only after successful persistence, and returns a committed MAC.
   The client verifies this acknowledgement before saving its peer.

Transport restart and status notifications run after the durable authorization
and committed acknowledgement are recorded. Their failure reports a connection
problem and does not release the claim or repeat admission.

Pairing operations also hold an exclusive local lease for the canonical peer
UUID. An outgoing operation holds it from the checked challenge through its
local settings commit; an incoming confirmation holds it during admission.
Conflicting operations receive HTTP 409 before writing and instruct the user to
retry from one computer only. This prevents simultaneous opposite-direction or
overlapping outgoing pairings from saving different credentials. Leases are
bounded to 32 peers, checked at the write boundary, released by their owner and
cleared on stop. A late response from a stopped operation cannot replace a newer
authorization.

The canonical transcript is a UTF-8 JSON array containing, in order: domain,
suite, session UUID, salt, A, B, client node UUID, client label, client certificate
DER encoded as base64, server node UUID, server label and server certificate DER
encoded as base64. SRP values and proofs use fixed-length lowercase hex. JSON
string encoding and array boundaries make the representation unambiguous.

Each MAC key is HKDF-SHA256 of the SRP session key, with SHA-256 of the transcript
as salt and ASCII `ncf-pair/v3/<purpose>` as info. Purposes are `client`, `server`,
`confirm`, `committed` and `peer-secret`, each producing 32 bytes. HMAC-SHA256
authenticates the UTF-8 JSON array `[domain, purpose, transcript, proofs]`.
The client MAC includes `[M1]`; the server, confirm and committed MACs include
`[M1, M2]`. The separately derived `peer-secret` becomes the existing persistent
peer credential. Both node identities and certificate pins are thus bound to
the exchange; role-specific keys prevent reflection.

## Limits and recovery

Handshake JSON bodies are limited to 24,000 bytes and have an eight-second
inactivity timeout. SRP values must be 384 bytes in the range `1..N-1`; salts,
proofs and MACs have fixed sizes. At most five unfinished sessions exist per code.

An identical confirmation shares one pending commit and subsequently returns
its cached acknowledgement. Changed confirmations are rejected. This permits
one automatic retry of the exact confirmation after a lost network response,
without repeating admission. Up to sixteen committed acknowledgements remain
cached until the original code expires, including when another code is created.
Stop or restart clears that in-memory cache.
At most sixteen commits may be in progress. Identical confirmations share their
pending result even if a new code is created; reset clears this recovery map too.

The settings write guard runs synchronously after directory creation and directly
before the exclusive temporary-file write begins. Before that boundary, stop,
expiry or code replacement cancels the queued write. Once the write has begun,
it may finish durably. Creating a new code then preserves the completed claim's
acknowledgement. Stop or restart instead reports uncertainty and forbids the old
operation from restoring the receipt cache or restarting transport. A canceled
client join likewise cannot perform a late settings write after stop.

If the server restarts before the client recovers its acknowledgement, or the
client cannot save an already authorized peer, pairing may be incomplete. The
error directs the user to create a new code and pair again. The app does not
silently start another claim. Failed settings validation or writing preserves
the previous in-memory peer pin and credential.

Existing configured peers continue to use pinned TLS and their saved credentials
without another code. Both apps must support short-code pairing to establish a
new connection; the old `ncfnode:v2:` code format is no longer issued or accepted.

## Implementation sources

- [Homebridge SRP implementation and API](https://github.com/homebridge/fast-srp/blob/master/src/srp.ts)
- [Fixed group parameters](https://github.com/homebridge/fast-srp/blob/master/src/params.ts)
- [RFC 5054: SRP groups and validation requirements](https://www.rfc-editor.org/rfc/rfc5054)

RFC 5054 supplies the group and SRP requirements; it does not specify this
application's three-phase protocol. No independent audit of this application
protocol is claimed.

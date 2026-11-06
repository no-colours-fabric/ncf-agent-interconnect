# AionUi adapter engineering reference

LLM-optimized documentation: [llms.txt](../llms.txt).

This page documents the adapter contract, implementation and verification limits.
For owner-facing steps, use [Set up AionUi with Cursor Agent](aionui-setup.md).

## Behaviour

The generated Cursor entry contains literal `${env:AIONUI_BASE_URL}`,
`${env:AIONUI_USER_ID}`, `${env:AIONUI_CONVERSATION_ID}` and
`${env:AIONUI_RUNTIME_TOKEN}` references. Cursor resolves them from its current
AionUi ACP process when starting the MCP helper. This explicit mapping is
required because the stdio transport does not inherit arbitrary environment
variables. NCF does not resolve these references or write their values into the
configuration or its backups. No token, account or chat identifier is requested
from the user. Cursor documents this mechanism under
[config interpolation](https://cursor.com/docs/mcp#config-interpolation).

Outside AionUi, missing variables can remain unresolved literal references.
The helper rejects these, including a partially unresolved context, before
requesting runtime proof. It reports only missing or invalid field names, never
their values. There is no fallback to another process, account or chat.

Runtime proof is requested only through the owner-paired WebUI:
its frontend cookie passes the WebUI gate, and native runtime headers reach
that WebUI's own Core. The request excludes Core session/refresh cookies and
Authorization, forcing Core to verify the runtime token instead of accepting
the paired JWT. Core and WebUI may use different ports. The environment's Core
URL is never used as the proof destination; an unrelated loopback server
cannot attest to a chat. The node also verifies the same chat through the
ordinary paired API and checks both pinned account identities. It never
selects the latest chat, searches for a substitute, or asks an agent to infer
session identifiers. A backend that does not supply native current-chat context
cannot use automatic delivery through this bridge.

Delivery uses the existing HTTP `/api/conversations/:id/messages` and WebSocket
`/ws` APIs. A confirmed HTTP 202 response with message and turn IDs records
receipt in NCF. Receipt is admission to the client chat, not task completion.
Messages, Unicode names, attachment links, NCF message IDs and history remain in
the existing durable queue. A busy chat or HTTP 409 waits for that exact chat's
native `turn.completed` idle event. No scheduled agent polling or terminal input
injection is used. Network reconnection is transport recovery; it inspects the
pinned chat after reconnecting to recover a missed completion event.

If admission is uncertain because a request or its response was lost, NCF keeps
the uncertain record and does not automatically replay it on completion,
reconnection or restart. Inspect the exact AionUi transcript and NCF history
before deciding what to send next.

Pairing credentials are stored privately in the node's user-data directory.
They are not included in the client MCP configuration, renderer instructions,
adapter diagnostics or logs.
Native runtime credentials are used only during context registration and are
not persisted. The refresh cookie is sent only to its own API path. A replacement
pairing becomes active only after its credentials are durably saved. A failed
write leaves the previous authorization and binding intact; an initial failed
write leaves the app unpaired. A new pairing can then be attempted normally.

Logout, revoked access and an account identity mismatch invalidate the saved
access when observed through an authenticated request or native realtime
revocation. Every delivery is gated by pinned-account verification. NCF does
not assume that ordinary browser logout closes an existing WebSocket. Without
a server revocation event, the saved pairing indicator can remain until the
next authenticated operation; it is not a continuous account-liveness signal.
Old bindings are never reassigned to a different account. Pair again after
access ends. A new pairing creates a new authorization; moving an occupied
agent name requires the owner's explicit transfer approval. **Disconnect**
disables local access immediately and attempts normal server-side logout.

## Verification limits

Protocol fixtures cover exact chat/account binding, Unicode and attachment
preservation, receipt, busy/409 event recovery, transport reconnection, durable
restart recovery, uncertain admission, logout/revoke, both account identity
boundaries, and a real stdio MCP bridge process. An integrated Electron scenario uses the
actual main, preload, renderer and service, synthetic Core/WebUI on separate
ports, the generated Electron Node-mode bridge, exact-chat delivery and owner
disconnect. It also rejects setup IPC from a second window. These checks use
isolated nodes and
synthetic accounts, not live agents or client configuration files.

Earlier exploratory API experiments used AionUi 2.2.2 with Core 0.2.2 and Cursor
Agent. They demonstrated owner-approved pairing, HTTP 202/409 and native
`turn.completed` events. The complete setup flow with the installed AionUi application has not yet been
verified end to end; the integrated Electron check uses synthetic vendor APIs. A real account
switch was not performed; logout followed by HTTP 401 does not establish account
switch correctness. Other AionUi versions/backends and native Windows/Linux
packages require separate verification. This adapter supports desktop-pairing
WebUI mode on IPv4 loopback; password-mode or remotely hosted WebUI is refused.

## Targeted development checks

After `npm run build`, run
`node --import tsx scripts/test-desktop-ui-aionui.mjs` for the integrated Electron
boundary scenario. It creates temporary node and client homes and never starts
an installed AionUi instance or a real agent.

Runtime-proof and persistence regressions are in `test-desktop/aionui.test.ts`:
a forged loopback proof server is never contacted; a valid native token reaches
the paired WebUI's distinct Core without a Core JWT; controlled rename failures
leave no newly active authorization and successful retries match saved state.

`test-desktop/aionui-cursor-env.test.ts` exercises the generated entry across a
stdio environment whitelist into the real helper, including the old entry's
failure, exact-chat admission and fully or partially unresolved references.
It also checks owner Apply, replacement confirmation, backups, unrelated
settings, matching no-op bytes and separate Cursor/AionUi statuses.

Run it with `node --experimental-sqlite --import tsx --test
test-desktop/aionui-cursor-env.test.ts`. By default it uses the documented
interpolation contract and MCP SDK whitelist. To inspect a reviewed installed
Cursor CLI bundle, set `NCF_CURSOR_CLI_BUNDLE` to its absolute `index.js` path
before running the same test. That mode evaluates the bundle's exact pure
resolver and whitelist functions in an isolated VM with synthetic context;
it does not execute the CLI launcher. The reviewed build is
`2026.10.22-27dcf5f` for macOS Apple Silicon and Windows x64. Other bundle
fingerprints require a source review rather than silently using a substitute.
This is a loader compatibility check, not live ACP or installed NCF acceptance.

## Supported platform gates

The release targets are macOS Apple Silicon and Windows x64. Both use the
installed NCF executable, `ELECTRON_RUN_AS_NODE=1`, an absolute bundled helper
path, and separate argument elements. No shell command, manual path quoting,
source checkout or system Node is required by the product configuration.
Paths are built with `fileURLToPath` and `path.join`; never treat a file URL's
pathname as a Windows filesystem path. The default Cursor file is
`~/.cursor/mcp.json` on both platforms and can be changed with the owner picker.
Project/profile overrides must point to the file actually used by Cursor Agent.

Before marking a native target ready, run the installed executable directly
against its own `app.asar/build/integrations/aionui.js` and production
dependencies (`Contents/Resources` on macOS, `resources` on Windows), from a
real directory outside the checkout. An extracted helper
or external verification script is not this test. Preserve Electron's RunAsNode
fuse. Check install/user-data paths containing spaces, Cyrillic and CJK, the
stdio handshake, exact synthetic chats, missing-context errors without secrets,
and unchanged client files outside Apply. GUI test launches must delete an
inherited `ELECTRON_RUN_AS_NODE`; helper launches must explicitly set it to `1`.

The real AionUi → Cursor Agent → MCP-helper environment chain remains a separate
vendor integration gate on both platforms. A backend may filter inherited
variables; a configured RunAsNode override does not prove that the four AionUi
context variables survived. Never persist the runtime token in the client file
or fall back to another chat. The synthetic loader check supplies per-chat ACP
context and does not establish this complete vendor chain. No Windows installed AionUi
helper, real account-switch or native release package PASS is claimed here.

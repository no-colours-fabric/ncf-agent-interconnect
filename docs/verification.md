# Verification

LLM-optimized documentation: [llms.txt](../llms.txt).

Release verification distinguishes product-core checks from client and operating
system checks. A capability is not treated as verified merely because a tool
returned success.

## Automated coverage

The product suite covers isolated local and remote exchange, multiple peers,
case-insensitive agent identity, approved transfers and revocation, full history,
readiness cursors, file hashes, idempotent retries, concurrent receipt, restart
recovery and adapter busy/idle behavior.

Pairing tests cover mutual authentication, transcript and proof mutations,
attempt and expiry bounds, concurrent claims, write failures, interrupted commits
and confirmation retries. Presence tests cover push directories, stale sockets
and snapshots, transport evidence, shared sessions and legacy peer compatibility.
These checks do not constitute an independent cryptographic audit.

The OpenCode fixture uses the bundled plugin and a simulated SDK session host.
The existing Codex fixture implements the compatible older local desktop IPC
frames and inspects the complete Incoming body, attachment links and reply route.
The separate macOS queue check verifies the saved native chat item before receipt. These
fixtures do not invoke a live model.

## ChatGPT desktop 26.1117.41037

Release acceptance prioritizes an ordinary ChatGPT launch with the desktop
owning the chat and its tools. NCF may automatically start a helper
`codex app-server` process for the bound profile's queue. The user launches
ChatGPT from its usual icon. Measure a full ordinary user message in the
bound chat within five seconds while the model is working. Exclude time
spent in a blocking tool. Exercise wake after an application restart and
the built-in browser on this same setup.

A source build of NCF Agent Interconnect delivered through a normally launched
ChatGPT on macOS. One previously bound chat that had been inactive since before
the app started received its message in 5.5 seconds. In another chat, the agent
used the built-in browser to read a page title. A message sent during that
response was recorded once, in the next turn, after 21 seconds. The native
queue was empty at the end. This run kept the user's desktop session open.
This adapter uses a separate bundled `codex app-server --listen stdio://`
worker for queue operations when the desktop control socket is unavailable.
ChatGPT runs the turn and supplies the built-in browser.

A separate test installed a local marketplace plugin in a temporary profile of
the bundled Codex runtime on macOS and on emulated Linux x86_64. A local test
model kept a request open for four seconds. A trusted asynchronous
`UserPromptSubmit` hook received a synthetic event during that request. Codex
emitted the warning and included the signal in the next model request of the
same turn after the first request finished. The history contained zero incoming
user messages for the event. An event received after the turn ended started
zero turns. After restarting the test server, the chat remained unloaded.
Enqueuing a full message at this point left one pending item. Once the host
resumed that exact chat, history contained one user message with the original
ID and body, and the pending count was zero on both platforms. Windows, the
Linux desktop UI and the full tool inventory were outside these runs.

OpenAI documents two other plugin paths. A mounted MCP App can send a message
to the active conversation or a new conversation. MCP Events supports inbound
webhooks for subscribed Work chats on the web, desktop Work chats using Cloud,
and dots. See the [message target specification](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#prompt-target-and-send-behavior),
[hook lifecycle](https://learn.chatgpt.com/docs/hooks) and
[MCP Events](https://developers.openai.com/plugins/build/mcp-events).

### Connection confirmation during a busy turn

A real stock macOS chat received an ordinary confirmation after a busy turn. The
recipient reported that redemption failed. A read-only App Server inspection found
the completed user item, including its client ID and admission time, and no remaining
confirmation in the queue. The reported error alone does not distinguish expiration
from another invalidation. Envelope timestamps do not measure visibility to the model.

The isolated recovery test holds an offer for fifteen simulated minutes and checks
that the queued proof is insufficient. Recent admission of the same message in the
exact chat permits recovery of the same binding. An admission older than five minutes,
a mismatched ID or payload, a revoked binding and a replay are rejected. Waiting
offers have a 24-hour upper bound and are invalidated on NCF restart. A stock macOS
desktop launch can wake an existing confirmation while NCF is running, after it
matches the native queue by client ID and payload hash. No new confirmation is sent.

### Local plugin and active-turn probes

The local MCP Events probe used a working loopback MCP server. The bundled
macOS and Linux runtimes called its test tool successfully. Both rejected
`mcpServer/event/stream/start` for that server with
`MCP event subscriptions are only supported for hosted apps`. Neither runtime
requested an event stream from the fixture. The
[MCP Events specification](https://github.com/modelcontextprotocol/ext-events/blob/main/specification/beta/events/events.mdx)
defines the client subscription. The
[bundled runtime's request handler](https://github.com/openai/codex/blob/rust-v0.171.0-alpha.13/codex-rs/app-server/src/request_processors/mcp_event_stream.rs)
enforces which servers can supply one.

Run the isolated steering probe with Node.js 22.12 or newer. Pass the absolute
path to the Codex executable bundled with the ChatGPT build being tested.

```sh
node scripts/probe-codex-incoming.mjs /absolute/path/to/codex
```

The probe starts a local test model, a local MCP tool, and two independent App
Server processes sharing a temporary profile. It sends 10,956 UTF-8 bytes
with a unique ID while the model is streaming and while an MCP tool is still
running. It checks the live item, saved history, next model input, and a second
chat. Exit 2 means the tested transport missed the immediate external delivery
criterion. Exit 1 indicates a failed fixture or an unexpected delivery result.
These measurements cover App Server notifications and storage. Desktop
rendering requires a separate observation.

| Observation                                                    | macOS arm64       | Linux x86_64 under emulation |
| -------------------------------------------------------------- | ----------------- | ---------------------------- |
| External process steering an active desktop-style stdio owner  | Thread not found  | Thread not found             |
| Owner emits the full message during a streaming response       | 2–3 ms            | 10 ms                        |
| Owner emits the full message during a blocked MCP tool call    | After tool return | After tool return            |
| Exact full messages saved after each test, target / other chat | 1 / 0             | 1 / 0                        |

In a macOS positive control two clients connected to the same App Server over
its private Unix socket. The second client delivered the full message in 3 ms
during streaming. A blocked tool still delayed the message until its return.
The desktop instance in the separate isolated GUI run selected stdio for the
local host. The [external steering request](https://github.com/openai/codex/issues/51625)
describes the same distinction. During a separate test that held the model
request open before its first response, the owner acknowledged steering but
emitted the item only after the model was released.

A separate five-second deadline probe used two independent clients connected to
one App Server through its local Unix socket. The first client started a chat
and observed its live items. The second called `turn/interrupt`, waited for the
exact turn to finish with status `interrupted`, and submitted one ordinary
`turn/start` message with the original client message ID. In six maximum-size
trials per platform (three during streaming and three during a held test tool),
the first client received the full 65,536-character user item in 14–15 ms on
macOS and 29–43 ms on emulated Linux x86_64. After stopping and restarting
the App Server, each exact chat contained its complete original message once
and the control chat contained none. Each maximum-size trial used a separate
active chat to avoid triggering model context compaction between trials.
An owner-side steering control accepted input in 1 ms but emitted its user
item after 7,514 ms when a tool was held for 7.5 seconds. These measurements
start at the submitting client and end at the observing runtime event. They
do not cover desktop screen paint, Windows, context compaction or the native
browser. The interrupt ended the in-progress turn. The shared server was
explicitly selected in the fixture; configuring a separate local service did
not attach it to the default desktop stdio host.

Two further macOS probes exercised plugin delivery. The experimental Agent
Message Board opened a stream for the active turn and forwarded a 150-character
preview to the model after the outstanding request finished. It never requested
the rest of the post. A local marketplace plugin returned a completed MCP tool
call with a valid UI resource URI. A freshly launched private desktop profile
read the exact saved chat. During the observation it did not resume the chat,
fetch the widget resource, or call the widget's receiver. This GUI probe used
an isolated profile without a ChatGPT account. Windows and signed-in widget
restoration were outside these tests.

### Combined local service, active read and native queue

In ChatGPT 26.1117.41037 on a signed-in Mac, the local NCF service woke a previously bound idle chat. Its full ordinary user message was first observed in chat history 1.66 seconds after send. The verified receipt preceded the observation. In another run the recipient used the built-in browser and a timed shell command. An ordinary incoming message sent while that response was active appeared in the following turn after 29.3 seconds, and the recipient replied to it. Opening the exact chat did not preempt the busy turn. These timings measure recorded chat items. Screen paint was not measured.

A repeat on the signed-in Mac sent 780 Unicode characters (1,266 UTF-8 bytes)
through the NCF service during a known active turn. The ordinary user item
was still absent at 5.221 s and 30.707 s. It was present at 31.079 s.
The completed chat contained the full multiline body exactly once. In response,
the recipient used the built-in browser to open example.com and returned its
page title and the final marker. Both the desktop profile's `app-server daemon
version` and `app-server proxy` reported a missing control socket before the
test. These timings end at the desktop chat history read.

In another signed-in run on the default transport the recipient solved an
arithmetic task with zero tool calls. NCF sent a message while the turn was
in progress. The full ordinary item was absent at 5.294 s and 21.216 s and
was first observed at 21.739 s in the following turn. The saved history
contained one matching user item. The adapter reported `receiveActive: false`.

An isolated two-process check tested `thread/queue/start` during a held
model request with zero tool calls. The helper added the message, and the
turn owner could list it in the queue. The helper's start request required
a thread resume in its own process. The owner's start request reported an
active turn. No full user item appeared during the five-second observation.
The owner admitted the queued message after its active turn completed.

Two further probes used a temporary profile, the bundled macOS CLI and a
local model that kept streaming reasoning without tools. The public
`thread/inject_items` request from a second App Server returned “thread not
found”. The CLI command `codex queue --resume` returned success in 33 ms.
The complete text was in the queue, with zero matching user items in the
original turn after 5.371 s. With a separate listening server selected through
`--remote`, the command took 51 ms and reported that the thread already had
an active writer. There were zero matching user items after 5.383 s. In
both cases the owner admitted the queued message in the next turn and
emptied the queue.

The signed-in macOS profile had `followUpQueueMode = "steer"` set. For a
further test, the recipient first sent a progress message, then solved an
arithmetic problem without tools. NCF sent a multiline message after that
progress checkpoint. At 5.309 s the original turn was still running and
contained zero matching user items. The item remained absent at 55.038 s.
At 55.765 s the full text appeared in the following turn. The completed
original turn contained zero tool calls. In a separate check in the same
chat, the built-in `cua_repl` browser opened example.com and the recipient
returned the title “Example Domain” and the page URL.

Three checks covered alternatives to the native queue in this build:

- In a temporary profile, the helper called `thread/resume` while the owner
  was receiving reasoning summary events. Resume reported an active writer.
  The helper's `turn/steer` with the original thread and turn IDs returned
  “thread not found”. The owner then steered its own still-running turn.
  Its full ordinary control item appeared in 6 ms and was saved once. The
  helper's message was absent from the saved user items.
- An offline test executed the installed desktop's MCP App submission handlers
  with a fixture for an existing local chat and a recording submission target.
  The Work composer provided no independent submit callback for that chat.
  The local fallback forwarded the entire text with an explicit queue
  override, even with the Steer preference selected. This tests routing,
  not the time to render a mounted plugin. The
  [MCP Apps extension](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#prompt-target-and-send-behavior)
  defines the active conversation target and submission behavior.
- In another active turn of the signed-in chat, the first-party
  `send_message_to_thread` tool acknowledged the follow-up after 4.483 s.
  The marker was observed in the same turn as a `functionCallOutput`.
  The completed turn contained zero matching `userMessage` items.

#### Cold restart of the primary ChatGPT Work profile on macOS

A real-profile acceptance test on ChatGPT 26.1117.41037 used the production
NCF queue adapter and macOS launch watcher. After the primary desktop process
exited completely, NCF sent one 562-character Unicode message to the existing
chat bound to Боб. The read-only observer found it in the native queue after
188 ms. The application was still closed, the message was absent from chat
history, and NCF had not recorded receipt.

The tester then opened the user's usual ChatGPT Work application entry with
no thread URL or transport override. The new process selected the same profile.
The NCF launch watcher opened the exact chat automatically. The full ordinary
user message was first observed in history 18.432 s after the launch request
and 18.621 s after send. The observer found one complete copy, an NCF receipt
and an empty queue. These times measure history visibility in one cold launch.

The reply included the final marker and the unpredictable title of a loopback
page that Боб opened in the built-in browser. The HTTP fixture received the
request, the chat recorded completed `cua_repl.js` calls, and `pwd` returned
the correct workspace. This run used the normal desktop-owned App Server and
the passive queue helper. NCF held the message until the ordinary application
launch.

#### Local plugin, MCP Events and native queue working together

The isolated probe sends one multiline Unicode message through the NCF
`agent_send` MCP tool while the bundled runtime is streaming reasoning. Once
NCF persists the message, a fixture MCP server publishes its ID and full body
over `events/stream`. A local plugin hook subscribes on behalf of the exact chat.
The production NCF adapter independently submits the ordinary message through
the native queue. A `Stop` hook can admit the event body to another model
request in the original turn. The local test model controls when its first
request ends. The probe checks the next request, ordinary chat items in the
target and control chats, and the native queue independently.

| Runtime and first request                   | Hook confirmed full event | Next model request in original turn contained full text | Full ordinary user item in original turn within 5 s |
| ------------------------------------------- | ------------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| macOS arm64, early model boundary           | 10 ms                     | 77 ms                                                   | No                                                  |
| macOS arm64, held 6.5 s                     | 10 ms                     | 6,519 ms                                                | No                                                  |
| Emulated Linux x86_64, early model boundary | 29 ms                     | 707 ms                                                  | No                                                  |
| Emulated Linux x86_64, held 6.5 s           | 26 ms                     | 6,575 ms                                                | No                                                  |

In all four runs the original turn was still active at the five-second check.
The queue held the full message and the target chat history contained zero matching
user items. After the fixture released the turn, exactly one full ordinary item
appeared in the following turn. The control chat received zero copies.
This build rejected a native subscription to the local MCP server with
`MCP event subscriptions are only supported for hosted apps`.

The same probe separately tested 65,536 characters with an early model boundary.
The hook confirmed the complete text after 27 ms on macOS and 88 ms on
emulated Linux. The next model request in the original turn did not contain
the complete text on either platform. The following turn stored one ordinary
user message with the complete text in each case.

Run the cases after building the project. Exit 2 indicates that the runtime
missed the five-second ordinary-message criterion.

```sh
node --experimental-sqlite scripts/probe-codex-incoming.mjs /absolute/path/to/codex --plugin-queue
node --experimental-sqlite scripts/probe-codex-incoming.mjs /absolute/path/to/codex --plugin-queue --hold-reasoning
node --experimental-sqlite scripts/probe-codex-incoming.mjs /absolute/path/to/codex --plugin-queue --max-body
```

A separate run in the normally launched, signed-in macOS app exercised the
native NCF queue together with a first-party `send_message_to_thread` signal
in the chat bound to Боб. The signal carried none of the NCF body or marker.
At 5.163 s the chat still had its original active turn and zero matching user
items. The last observation without the ordinary message was at 12.091 s.
The full text was first observed at 12.667 s in the following turn. The original
turn contained zero tool calls. Боб then opened example.com in the built-in
browser and returned its title and the marker from the end of the NCF message.
The timestamps measure observed chat history. The local test plugin was
installed only in the isolated profile.

#### Selecting the same local App Server

Separate tests launched the stock macOS application with a temporary profile,
no account, and the bundled 0.171.0-alpha.13 App Server. A compatible server
was already listening on the profile's private Unix socket. With the default
environment, and again with `CODEX_APP_SERVER_USE_LOCAL_DAEMON=1` alone, the
desktop initialized its own stdio child. Setting `CODEX_APP_SERVER_WS_URL` to
`ws+unix://localhost/<absolute-socket-path-without-leading-slash>:/rpc` in
the desktop process environment connected its local host to the prestarted
server. The desktop logged a successful WebSocket initialization and spawned
no stdio child. The socket stayed local to the user. The variant without a
hostname failed in this build.

The production NCF adapter connected to this same server through its standard
profile socket and reported active receipt for the exact bound chat. From
`NodeService.send` to the first observed ordinary chat item, a 1,024-character
message took 15 ms during streamed output and 7,511 ms during a tool held for
7.5 seconds. In each trial, NCF recorded receipt, the full body appeared once
in the target chat, and the control chat received zero copies. The adapter
used its existing steering behavior and let the active turn continue.

A follow-up probe exercised the same adapter with a local model fixture and
zero tool calls. The probe waited for the desktop runtime's first
`item/reasoning/summaryTextDelta` before sending. A full 1,024-character
ordinary message appeared after 16 ms while the summary continued streaming
and after 8 ms when the fixture paused after its first summary delta. When
the fixture held the model request before sending any response headers or
events, the item appeared after 7,504 ms, following a deliberate 7.5-second
hold. Each message reached the next model request in the same turn, was
recorded once in the target chat, and was absent from the control chat.
These times end at the App Server event.

With the desktop connected, a test client interrupted a turn blocked in a
fixture tool, waited for confirmation, and submitted a 65,536-character
ordinary message to that exact chat. A second protocol client observed the
full user item after 22 ms. Its full text survived an App Server restart
exactly once, with zero copies in the control chat. The measurement used a
local model fixture and began at the protocol client. It excludes NCF transit
and GUI painting. In a separate check, the shared test chat admitted a queued
message and the queue emptied. Its MCP inventory contained the test server
only. An actual `mcpServer/tool/call` for the built-in browser returned
`unknown MCP server 'cua_repl'`. Signed-in browser use, a normal relaunch
inheriting this setting, and Windows and Linux desktop behavior under this
transport were outside that isolated run.

#### Prestarted server with the existing Боб chat on macOS

A QA process started the bundled App Server on the current user's private
profile socket before LaunchServices opened the installed ChatGPT application.
In a control with a temporary profile, the real `app-server daemon start`
reported a healthy, version-matched server. The desktop still started its own
stdio child. In the positive configuration, the GUI login session briefly set
`CODEX_APP_SERVER_WS_URL` to `ws+unix://localhost<absolute-socket-path>:/rpc`.
The app launch supplied no transport option. ChatGPT connected over WebSocket
and spawned zero stdio servers. The test restored the GUI environment as soon
as the process started. A second instance with a temporary window profile kept
the original desktop running. Both App Servers used the real local Codex
profile. This verifies LaunchServices inheritance on macOS. The test installed
no persistent NCF launch settings.

The original desktop retained the idle chat's writer lock after switching
away from it for 83 s. With the owner's permission, the original desktop
archived and immediately restored the chat. The prestarted server then resumed
the same thread ID. Subsequent launches resumed it without repeating this step.

Two real model turns emitted reasoning summary deltas before the NCF service
sent its message. The production adapter reported active delivery. Both full
ordinary user items appeared under the original turn ID without an interrupt.
There were zero blocking tool calls at admission.

| NCF body          | From NCF send to full ordinary item | Independent history check                                                                                                                          |
| ----------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 65,536 characters | 3,486 ms                            | After restarting the App Server, one user item in the original turn contained the full body with the identical SHA-256.                            |
| 1,024 characters  | 379 ms                              | The full item was first read from that same turn's history at 413 ms. Desktop logs confirmed a successful resume of the exact chat before sending. |

The clocks end at the App Server notification or history read. Screen paint
was outside the timing probe. The QA client started the reasoning turns on the
shared server. The saved response to the maximum-size input included its
unpredictable final marker, and the NCF queue was empty at completion.

The resumed chat reported 255 MCP tools across five servers in the first
configuration. In a foreground launch, the desktop resumed Боб before any test
client requested a resume. That chat reported 259 tools across six servers.
Боб executed `pwd` in the terminal and evaluated `317 * 29` in Node REPL.
The recorded tool calls completed and returned the correct workspace and 9193.
Actual `cua_repl.js` calls to a loopback fixture with a secret page title and
to example.com failed with `The browser access host is unavailable`. The
loopback fixture received zero requests. Delivering the browser instruction
through the native queue in a separate turn produced the same error. The
foreground chat's inventory did not offer `open_in_codex` to open the browser
panel first. Боб confirmed this in a separate test.

A follow-up used both `CODEX_APP_SERVER_WS_URL` and
`CODEX_APP_SERVER_USE_LOCAL_DAEMON=1` for a separate LaunchServices instance
with its own Chromium data and a private test socket. The primary ChatGPT
process and the working NCF node kept running. The desktop resumed Боб on
the shared server. The chat listed 271 tools, and `pwd` succeeded. Two
built-in browser attempts separated by a tool reset reported “native pipe
closed before response”. The loopback page received zero requests. A separate
turn explicitly selected the bundled Browser plugin. Its browser skill was
unavailable in that session, and the page again received zero requests.
In a separate isolated profile, the official managed daemon reported a
version matching the bundled CLI. With the daemon flag alone the desktop
started its own stdio child. Both test apps and the test daemon were stopped.

Another check made the stock server a child of a test process running the NCF
node service. The foreground desktop again connected and resumed Боб. The
original desktop's first-party `send_message_to_thread` returned an active-writer
error when the second instance owned the chat. All these runs used the real
local Codex profile and separate Chromium window data for the test instance.
They did not time screen painting or exercise a cold restart of the user's
primary window. Windows and Linux desktop acceptance for this configuration
are outstanding.

With an open `agent_read(waitMs)`, the same service can return the full body during an independent parallel tool. In three isolated macOS runs the runtime emitted the 10,956-byte tool result after 6–13 ms while the other tool was still running. The next model request included the full body after the deliberately held tool returned around two seconds later. The arrival wait ends on an incoming message, timeout or transport closure. A stock chat with no open read uses the native adapter.

Run the combined check after `npm run build` using the executable from the installed ChatGPT package:

```sh
node --experimental-sqlite scripts/probe-codex-incoming.mjs /absolute/path/to/codex --ncf-inbox
```

This probe uses a temporary configured profile, a local test model, one pre-approved inbox tool and the production NCF server with an exact Codex binding. The compiled runtime, its chat storage, the native queue and the NCF receipt are real. The probe releases the other tool immediately after observing the full inbox item. The event and the next model request contained the entire 13,273-byte and 196,464-byte bodies on both macOS and emulated Linux x86_64. The second body had the maximum 65,536 UTF-16 code units. The short result remained complete in saved Codex history. The larger result remained complete in NCF history, while Codex stored a preview. The tested runtime sets a [64 KiB limit on saved MCP results](https://github.com/openai/codex/blob/rust-v0.171.0-alpha.13/codex-rs/rollout/src/policy.rs#L16).

After restarting the profile's App Server, the probe sends another 195,081-byte body without an open inbox read. Its test desktop handler resumes the exact chat in response to the NCF wake. On both platforms the ordinary message was saved in full once, the second chat stayed empty, receipt was recorded and the queue emptied. The fixture supplies the desktop link handler in this test. A native Windows run and a Linux GUI acceptance run are still outstanding.

The installed-runtime verifier extracts the packaged app outside the source
checkout, loads the shipped integration and checks real MCP exchange using the
bundled Electron/Node runtime. A separate Electron GUI test checks rendering,
native file-operation boundaries, receipt counters and close-to-tray behavior.

## Platform and client limits

- Installer and native platform checks are reported for the exact published
  source revision in its release notes. Intel runtime checks require Intel
  hardware; package layout and architecture are separate checks.
- OpenCode v1 retains its bundled exact-chat plugin. OpenCode v2 has separate
  setup and source-level checks; live v2 client delivery was not verified for
  0.19.0. Do not infer either version's readiness from installation detection.
- Delivery in ChatGPT is experimental and version-dependent. Compatible
  older IPC provides full Incoming in the exact chat. The macOS queue sends
  the same full Incoming and records receipt after Codex saves the matching
  item. See the release notes for the tested client versions and platforms.
- Cursor has a bundled plugin for open exact chats, including unselected chats.
  AionUi support is limited to Cursor Agent after owner authorization and a
  live bridge. Client and platform results have the narrower scopes recorded
  in [application-specific setup](mcp-clients.md).
- Claude Code's full Incoming uses compatible mods. Its Linux Desktop and
  terminal evidence is frontend-specific; live Claude behavior on macOS and
  Windows was not verified for 0.19.0. See the [Claude Code guide](claude-code-adapter.md).
- Standard MCP clients can send and read through tools. Idle notification or
  automatic full-content delivery requires a supported client integration.

Release notes should list checks actually completed for their exact source
revision, runtime and platform. Keep private client configuration and live
conversations outside test artifacts and public reports.

Remote-directory acceptance also requires the two-computer native scenarios in
[agent presence](agent-presence.md). A source-mode harness result is marked
`packaged: false` and does not satisfy that requirement.

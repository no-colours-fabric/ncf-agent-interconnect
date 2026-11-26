# Windows local Responses delivery experiment

NCF Agent Interconnect is the application and project. NCF abbreviates No Colours Fabric.

## Objective and starting state

Superman requested native Windows protocol verification of a shared foreground App Server, followed separately by an isolated GUI prerequisite check. Working ChatGPT, authentication, NCF bindings and profiles were excluded. Related reports: windows-owned-pipe-websocket-20261126.md and windows-shared-owner-wake-lab-20261126.md in this directory.

The source under test was 9965ba8c8fecd5e1a43c5a62ba513aa56e6f92d8, combining the Windows e20548d resolver with fa9af9d shared-owner wake. The source worktree remained unchanged. The registered Windows ChatGPT package was 26.1120.6357.0. The existing vendor-owned CLI cache was resolved and revalidated against current package assets before each experiment; CLI SHA256 was 2a1ec3f1dd463fd30224be4c0c67d3fe83d3d863a3d7539ccad366952436d2aa. No CLI was downloaded, copied out of WindowsApps or patched.

The received portable fixture ZIP was 6,266 bytes, SHA256 f0fdb46ed29877cbb9a9f78a7e517249048c7502b2c0f569bebf7b793214d5ef. Only the three reviewed entries README.md, model.mjs and smoke.mjs were extracted. The provider uses an ephemeral authenticated loopback HTTP listener and a locally generated fixture-only key. It provides no OpenAI account. No key is retained in this report.

## Model smoke

The supplied smoke passed with the verified Windows CLI: exact user text reached the local provider, reasoning was held, the assistant returned NCF-QA-OK, and the same turn completed. Only a cleanup containment check was added to a separate smoke copy, to verify its canonical temporary parent before recursive removal. The original fixture sources were preserved.

## Native NCF protocol trials

The controller launched a foreground vendor App Server with a canonical private AF_UNIX endpoint in a short disposable profile. The unchanged installed NCF native helper was rehashed (a96e01a58771dc767807c0f349f948abd4c53f3f3b249cb09111e8a1be262fc3). Its verified byte copy was placed in the lab worktree's expected build/assets location, solely to run the TypeScript adapter without a product build.

Actual NodeService, AgentStore, AdapterRegistry and CodexQueueAdapter implementations were used. Disposable NCF state had no peers, loopback-only network interfaces, ephemeral ports and no LAN discovery. The test did not call live agent_read or agent_connect. Synthetic sender and recipient bindings existed only in that isolated store.

The test wrapper captured the node's memoized full Incoming presentation before dispatch and wrote it to the fixture's expected-message file. It did not alter the payload, release gate, adapter result or receipt checks. Assertions required exact native client ID, a single userMessage containing the entire presentation, empty matching queue, processed incoming and outgoing rows, and exactly one successful completeCodexQueueDelivery result. Thus a queued response alone was never counted as receipt.

All chats were created by the App Server test client, not the GUI. Bodies included Cyrillic, accented characters, Greek, Japanese and an emoji.

| Case                   | Observed result                                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Busy recipient         | PASS: full ordinary userMessage once, one real NCF receipt, exact model input, matching queue empty. The original held turn completed with the same ID.                                                                                                                                                                                                        |
| Unloaded recipient     | PASS: persisted target was explicitly confirmed notLoaded after restarting only the isolated server. One NCF dispatch woke it; full userMessage once, one receipt, exact model input, queue empty. The independent held control turn remained inProgress with the same ID.                                                                                     |
| Adapter reconstruction | PASS: observation of a single queued dispatch was deliberately deferred in the test wrapper, then the isolated NCF service was stopped/started. The persisted dispatch was observed by the reconstructed adapter without another send/deliver call. One full userMessage, one receipt, exact model input, queue empty; neighboring control turn stayed active. |

Busy evidence is protocol-result-02.json. Sleeping/recovery evidence is protocol-result-05.json, under .local/qa/windows-local-responses-20261126. Each records synthetic message, native item, attempt and turn IDs, exact synthetic presentation and store states. These IDs are laboratory data only.

In the busy case the native steer interrupted the fixture's first held HTTP response; a subsequent request contained the full message. The explicit release command raced with that closure and produced unknown_command_or_label. It did not resend the message, and no duplicate native item or receipt was observed. Admission was acknowledged before the controller's release call; the completed native projection timestamp was subsequently observed. This is protocol evidence, not visual proof of an active GUI chat.

## Failed harness approaches and corrections

1. Initial trial used the wrong exported service class name, InterconnectService instead of NodeService. It stopped before creating or sending a test chat message. The failed report was retained.
2. The vendor rejected thread/unload as an unknown method, code -32600. No sleeping NCF message was submitted. The failure and exact method list are retained in report 02.
3. Supported thread/unsubscribe returned unsubscribed, but an immediate read still reported idle. Unsubscription alone was not treated as proof of unloading (report 03). Instead two synthetic chats were persisted, only the isolated server was restarted, and their notLoaded state was verified before any delivery.
4. The fixture initially demanded receiveActive=true for an unloaded thread (report 04). Source line behavior intentionally sets that capability only for active/idle threads on a shared owner. The fixture precondition was corrected to compare the actual thread state; product assertions and source guards were unchanged. The succeeding report 05 covers both remaining cases; the already successful busy case was not repeated.

No uncertain message was resubmitted, no production source was changed, and no installer was built.

## GUI boundary

The protocol controller's account/read(refreshToken:false) returned requiresOpenaiAuth=false and account=null with the fixture provider.

A separate fresh original signed GUI was then connected to the same isolated foreground server through the previously verified private own-user pipe. The byte observer copied each WebSocket buffer before parsing (the previous in-place unmasking harness error was not repeated). Its own account/read response also confirmed requiresOpenaiAuth=false and account=null. The GUI initialize succeeded, HTTP upgrade was 101, and the native guard authenticated the original GUI's immediate child against the exact main PID, package identity, same user and start time. This was a GUI connection/account prerequisite result, not a GUI-created chat or visible delivery result.

The GUI automatically issued windowsSandbox/readiness and windowsSandbox/setupStart. The owner reported denying an administrator prompt during this experiment. The preserved data confirms the setupStart request; the exact executable shown in UAC was not captured, so attributing the prompt to sandbox setup is a well-supported hypothesis, not a captured UAC identity. No approval was accepted, no elevation was retried and no security policy was changed by the test. The isolated main and its relay/server/model processes were stopped. An elevated read-only process inventory subsequently confirmed zero remaining processes referring to any of these disposable profiles. An earlier inventory in the restricted sandbox failed Access denied; its apparent zero count was not accepted as evidence.

The isolated .sandbox log recorded Windows sandbox selection disabled and MXC availability false before the request. The test did not interact with a sign-in form or enter the provider key into OpenAI authentication. The local fixture key was used only in child environments for the local provider. The raw GUI report's inherited tcpUsed/tokensUsed flags describe the private bridge; they do not mean that the model lacked an authenticated HTTP listener or that the original GUI performed no background network activity. The GUI performed ordinary startup plugin synchronization, including HTTP 429 warnings, inside the disposable CODEX_HOME.

The official gateway guide, https://learn.chatgpt.com/docs/enterprise/connect-to-a-gateway, was consulted as a supported-provider reference. Documentation does not establish this particular Windows GUI's visible state. The available Windows computer-use skill explicitly says: "Do not automate the ChatGPT desktop app UI or Codex CLI or Codex extensions within Windows apps." Consequently no GUI clicking, New chat action or sign-in automation is performed. Visible New chat availability and GUI-created-chat delivery remain separately unverified.

## Cleanup and product handoff

All 13 disposable runtime directories from this task were removed after saving compact JSON outcomes and verifying the corresponding processes had exited. Canonical paths and containment were checked before deletion. The only permitted reparse leaves were the test profiles' exact app-server-control/app-server-control.sock entries; their native AF_UNIX tag 0x80000023 was verified and each leaf was unlinked without traversal before removing the directory. Unexpected reparse points were rejected. Approximately 90 MB was removed. The active source worktree, dependencies, all retained installers and working profiles remain intact.

Superman accepted the protocol result and assigned Windows alpha-2 for a future package. That package must contain the actual service and ordinary-launch hookup; the existing 9965ba8c source does not contain the standalone fixture's listener/controller and must not be represented as a complete installer for this behavior. The owner will perform visible GUI acceptance, so another isolated GUI delivery proof is not a build prerequisite. No test model or fixture key may be included in the product.

Read-only current vendor bootstrap inspection found that the selector is CODEX_APP_SERVER_WS_URL ?? hostConfig.websocket_url. The stock local host definition is the fixed object {id:'local',display_name:'Local',kind:'local'}; no supported persisted override of that object was established. This is evidence for an environment selector, not authorization to edit vendor files or assume an undocumented configuration key. A global user environment override by itself is insufficient: background listener lifetime, stock-mode restoration, custom-profile separation and installer shutdown must be addressed. Shared setup/design coordination was requested from Superman before writing a second incompatible UI or making any live registry/configuration change.

One bounded NCF read while awaiting coordination returned 'Message delivery is in progress or uncertain; content is not repeated'. It was not retried or treated as an empty inbox. Previously submitted messages were not replayed, and no binding was reset.

# Signed-in ChatGPT Home delivery on macOS

23 November 2026. ChatGPT desktop 26.1117.41037, bundled Codex CLI 0.171.0-alpha.13. The existing Home sign-in was verified with the bundled CLI. Both runs targeted the same Home binding.

NCF Agent Interconnect sent live local messages to the bound Home chat. The initial workload was submitted separately to that chat using the bundled CLI. The original turn was active when NCF created the message in each test. Elapsed times are measured from message creation using the NCF outbound record, local turn completion and the ordinary user item in persisted history, all on the same machine. The time of painting a bubble in the GUI was not instrumented.

| GUI launch         | Original turn ended | Ordinary message recorded | Receiving turn |
| ------------------ | ------------------: | ------------------------: | -------------- |
| Pass-through stdio |             1317 ms |                   5485 ms | Following      |
| Stock Home         |            33160 ms |                  33181 ms | Following      |

Both ordinary items matched the complete original test body, Unicode, newlines, indentation, sender, timestamps, reply reference and reply instructions. An independent read using the bundled thread/items/list and thread/queue/list confirmed one matching userMessage and zero residual queued copies for each. Stock Home recorded the NCF item 21 ms after the original turn ended. It continued working for 33.160 seconds after NCF created the message.

## Built-in browser

With pass-through stdio the signed-in Home chat invoked the native browser tool. It returned `native pipe closed before response`. The blind loopback page received zero requests. The relay passed the GUI byte streams to the stock executable and did not supply a second client endpoint. NCF delivery in this run used the existing adapter, not an owner-connected turn/steer request.

With stock Home the chat reported that it could not call the iab interaction tool. A scoped open_in_codex request to display the page returned queued. The loopback fixture recorded one page request. A follow-up asking for the already open tab title did not return the expected secret title. Page loading was observed. Agent browser control in this Home chat was not established. These results do not isolate the cause of the relay error.

A previous independent stock Work run returned the exact blind page title through the built-in browser. That result applies to Work. Neither Home run demonstrated mid-turn ordinary-message admission. Windows, remote-origin delivery, Remote Control pairing and tab selection during delivery were not tested here. The macOS foreground application changed when the test GUI launched.

The temporary Home instances were closed after their turns finished. No changes were applied to either user profile configuration or agent binding. No product source or release package was changed by this test.

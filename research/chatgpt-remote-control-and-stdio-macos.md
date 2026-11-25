# Stock ChatGPT, Remote Control and stdio on macOS

23 November 2026. Installed desktop 26.1117.41037, bundled Codex CLI 0.171.0-alpha.13.

## Signed-in desktop control

The last pre-send snapshot showed the receiving chat idle. A real NCF message reached the exact bound chat. The built-in cua_repl browser opened a blind loopback page. Exactly one request reached the fixture, and the returned document title matched the independently generated value. The page check used the ordinary NCF transport. It is not a Remote Control or relay browser measurement. The UI tab and its paint time were not instrumented.

## Native Remote Control and CLI

Only the local Codex host was exposed to this test. The stock profile had no app-server-control/app-server-control.sock, and the bundled daemon version command returned ENOENT. The CLI has remote-control start, stop, and pair. The experimental schema advertises host-side status, enable, disable, pairing start/status, client list and revoke. No documented third-party controller API for the existing GUI was identified. No pairing was changed. No authenticated second controller was available to measure a real Remote Control delivery to the bound chat.

An independent fixture held a real Codex turn in streamed reasoning. The explicit queue and exec commands used the exact thread and the installed binary.

```text
queue_exit 0 cli_ms 42 complete_body_in_queue True
at_ms 15035 original_reasoning True ordinary_in_original 0 saved_complete_copies 0
full_body_in_following_turn True remaining_exact_rows 0
resume_exit 1 ms 31 writer_conflict True thread_not_loaded False
current_turn_has_full_prompt False source_still_reasoning True
```

## Relay and GUI admission

The test relay forwarded stdio bytes for isolated profiles and passed all normal launch arguments to the bundled CLI. It exposed no second client endpoint and inspected no protocol frames. The test driver was the legitimate parent client on the owner connection. A second independent client used the same temporary profile, thread ID and turn ID.

The 10,956-byte input appeared after 3 ms on the owner connection. A second run used the production formatter, 65,536 UTF-16 code units of body and a 116,665-byte full formatted envelope. It appeared in 7 ms, in the original turn. The model received the complete envelope; history contained exactly one copy in the target and zero copies in the control. Both independent clients returned thread not found. Timings end at a protocol observation; these were controlled model fixtures, not production latency measurements.

LaunchServices started a stock test GUI and a separate relay test GUI with isolated unsigned-in profiles. Both selected stdio and initialized their local host. A further relay run explicitly addressed a scratch thread with a queued request. After 16 seconds, the request was still queued and the scratch model had received zero copies. The GUI reported that sign-in was required to start a durable thread. Built-in browser success behind the relay has not been verified. Test instances were closed; the primary signed-in desktop was not restarted.

## Windows

No native Windows run. The Windows CreateProcessW command line has a 32,767 UTF-16-unit limit including its terminator. For a maximum NCF message a portable implementation needs a data stream such as stdio. The Windows limit has no bearing on which App Server owns a turn.

[OpenAI Remote connections](https://learn.chatgpt.com/docs/remote-connections) · [OpenAI developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli) · [Microsoft CreateProcessW](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw)

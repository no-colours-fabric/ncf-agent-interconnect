# Live NCF delivery on macOS after desktop downgrade

24 November 2026. The running application was /Applications/ChatGPT.app, version 26.1111.71704, build 29030. The running NCF Agent Interconnect candidate came from the existing macOS arm64 focus build at 04fa3417aebc96e3920ca7160c2ce147e41c279d. Its packaged adapter matched the worktree build byte-for-byte. The codexExchange implementation in that package matched tag v0.19.0 after normalizing JavaScript compilation. Its active branch sends thread-follower-steer-turn. Packaged module SHA-256: 80cbcac37f785c002d8909ac1799b4497d284e52583818b596b8c68270336a03.

The receiving chat's saved binding was initially configured for codex-queue. A message submitted while the chat was unloaded did not enter the transcript in the first 40 seconds. A stock desktop follow-up activated the exact chat. A normal agent_connect with the existing nickname from that chat restored legacy IPC without transferring the nickname or clearing history. Both test participants retained their exact bindings and had legacy IPC selected in persisted settings after the test.

## Controlled busy turn

An NCF agent_send targeted the bound chat during an active turn. The original and receiving turns matched. Native dispatch committed. Elapsed times are measured from message creation.

| Event                                                  | Elapsed time |
| ------------------------------------------------------ | -----------: |
| NCF created message                                    |         0 ms |
| Full ordinary user message recorded in the active turn |       877 ms |
| The assistant reply included the unique last line      |     60722 ms |
| Original turn completed                                |     61792 ms |

One recorded message matched the full Unicode body and indentation, original sender, timestamps and Reply-To. No browser call occurred during the measured busy turn. A separate browser check in the same exact chat and installed desktop reached the blind loopback page and returned its exact random title through the browser tool. The page received 1 request.

This live check measures persisted chat items and same-turn model acknowledgment. It did not measure first-paint time, selected-tab changes, cold wake through the legacy adapter, maximum input length or native Windows behavior. No product rebuild was needed.

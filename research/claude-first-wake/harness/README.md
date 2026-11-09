# Native experiment harness (research only)

Tools used for the r2 native cases. They act only on an isolated fixture
directory (`$NCF_RESEARCH_HOME`, default `~/ncf-readiness`) holding the fixture
node data (`node/`), a dedicated `CLAUDE_CONFIG_DIR` (`claude-profile/`) and the
fixture folders. They never print the node token.

- `launch-resume.sh <folder> <session>`: exact `--resume` with the candidate mod,
  the gate and the observer, in that `--plugin-dir` order.
- `launch-new.sh <folder>`: a new fixture conversation (setup only).
- `send.mjs <nickname> <text>`: standard-MCP fixture sender
  (`NCF_NODE_FILE` names the node descriptor).
- `control.mjs <hold|release|arm|transfer> [json]`: fixture node research
  controls (requires the node started with `--control`).
- `case-runner.mjs <modDir> <cases.json>`: reload-based multi-case runner. Its
  finding: module reloads are deferred until the session is idle, so it cannot
  queue a notice during busy work (see the continuation report).

Owner input for the tmux-driven cases was sent with `tmux send-keys`; consent,
folder trust, permission approvals and question answers were given by the owner.

#!/bin/sh
# Exact resume of a fixture conversation with the research mods. Usage: launch-resume.sh <folder> <session>
cd "${NCF_RESEARCH_HOME:-$HOME/ncf-readiness}/$1" || exit 1
R="$(cd "$(dirname "$0")/.." && pwd)"
exec env NCF_FIRST_WAKE_DESCRIPTOR="${NCF_RESEARCH_HOME:-$HOME/ncf-readiness}/node/research-first-wake.json" \
  CLAUDE_CONFIG_DIR="${NCF_RESEARCH_HOME:-$HOME/ncf-readiness}/claude-profile" \
  claude --resume "$2" --plugin-dir "$R/mod" --plugin-dir "$R/gate-mod" --plugin-dir "$R/probe-mod" --debug

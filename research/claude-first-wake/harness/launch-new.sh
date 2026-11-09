#!/bin/sh
# Start a new fixture conversation in a folder (setup only). Usage: launch-new.sh <folder>
cd "${NCF_RESEARCH_HOME:-$HOME/ncf-readiness}/$1" || exit 1
exec env CLAUDE_CONFIG_DIR="${NCF_RESEARCH_HOME:-$HOME/ncf-readiness}/claude-profile" claude --debug

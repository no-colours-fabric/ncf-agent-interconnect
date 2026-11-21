#!/bin/sh
set -eu
resources=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)
if [ "${1-}" = '--launch' ]; then
  if [ "$#" -lt 2 ] || [ "$#" -gt 3 ] || [ ! -d "$2" ]; then
    echo 'Usage: open-codex-with-ncf --launch /absolute/codex-home [/absolute/desktop-user-data]' >&2
    exit 2
  fi
  profile=$(CDPATH='' cd -- "$2" && pwd -P)
  if [ "$#" -eq 3 ]; then
    user_data=$(CDPATH='' cd -- "$3" && pwd -P)
    exec /usr/bin/open -n -a '/Applications/ChatGPT.app' \
      --env "CODEX_HOME=$profile" \
      --env "CODEX_ELECTRON_USER_DATA_PATH=$user_data" \
      --env "CODEX_CLI_PATH=$resources/open-codex-with-ncf"
  fi
  exec /usr/bin/open -n -a '/Applications/ChatGPT.app' \
    --env "CODEX_HOME=$profile" \
    --env "CODEX_CLI_PATH=$resources/open-codex-with-ncf"
fi
exec /usr/bin/env ELECTRON_RUN_AS_NODE=1 \
  "$resources/../MacOS/NCF Agent Interconnect" \
  "$resources/app.asar/build/integrations/codex-app-server.js" "$@"

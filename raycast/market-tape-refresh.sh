#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Refresh Market Tape
# @raycast.mode compact
#
# Optional parameters:
# @raycast.icon 🔄
# @raycast.packageName Market Tape
# @raycast.description Force a full re-pull of all ~2,700 stocks, then open the screen. Takes about a minute.

set -euo pipefail
DIR="$HOME/market-tape"
PY="$(command -v python3 || echo /usr/bin/python3)"

echo "Re-pulling the whole universe…"
if "$PY" "$DIR/refresh.py" >/tmp/market-tape.log 2>&1; then
  open "$DIR/build/local.html"
  echo "$(grep -Eo '[0-9]+ rows from [0-9,]+ screened.*' /tmp/market-tape.log | tail -1)"
else
  echo "Refresh failed — see /tmp/market-tape.log"
  exit 1
fi

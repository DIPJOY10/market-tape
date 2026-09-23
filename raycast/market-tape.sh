#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Market Tape
# @raycast.mode compact
#
# Optional parameters:
# @raycast.icon 📈
# @raycast.packageName Market Tape
# @raycast.description Open the live US equity screen. Re-pulls the data first if it is more than 4 hours old.

set -euo pipefail
DIR="$HOME/market-tape"
PY="$(command -v python3 || echo /usr/bin/python3)"
STALE_HOURS=4

AGE="$("$PY" "$DIR/fresh.py" "$STALE_HOURS" 2>/dev/null)" && FRESH=1 || FRESH=0

if [ "$FRESH" -eq 0 ]; then
  echo "Pulling fresh market data…"
  if ! "$PY" "$DIR/refresh.py" >/tmp/market-tape.log 2>&1; then
    echo "Refresh failed — opening last good copy. See /tmp/market-tape.log"
  fi
fi

open "$DIR/build/local.html"

if [ "$FRESH" -eq 1 ]; then
  echo "Market Tape opened · data $AGE"
else
  echo "Market Tape opened · data refreshed just now"
fi

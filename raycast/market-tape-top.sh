#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Market Tape Top Picks
# @raycast.mode fullOutput
#
# Optional parameters:
# @raycast.icon 🏆
# @raycast.packageName Market Tape
# @raycast.description Top-scoring names per cap tier and the key metric extremes, as text. No browser.

set -euo pipefail
DIR="$HOME/market-tape"
MARKET="${MARKET_TAPE_MARKET:-us}"   # us | in  (see markets.py)
PY="$(command -v python3 || echo /usr/bin/python3)"

if ! "$PY" "$DIR/fresh.py" 4 "$MARKET" >/dev/null 2>&1; then
  "$PY" "$DIR/refresh.py" --market "$MARKET" >/tmp/market-tape.log 2>&1 || true
fi
"$PY" "$DIR/digest.py" "$MARKET"

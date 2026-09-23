#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Refresh Market Tape
# @raycast.mode compact
#
# Optional parameters:
# @raycast.icon 🔄
# @raycast.packageName Market Tape
# @raycast.description Force a full re-pull of all ~2,700 stocks and 5y of price history, then open the screen.

set -euo pipefail
DIR="$HOME/market-tape"
PY="$(command -v python3 || echo /usr/bin/python3)"
PORT=8811

echo "Re-pulling the whole universe…"
if ! "$PY" "$DIR/refresh.py" >/tmp/market-tape.log 2>&1; then
  echo "Refresh failed — see /tmp/market-tape.log"
  exit 1
fi

if ! curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
  nohup "$PY" "$DIR/serve.py" --port "$PORT" --no-open >/tmp/market-tape-serve.log 2>&1 &
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1 && break
    sleep 0.3
  done
fi

if curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
  open "http://localhost:$PORT/"
else
  open "$DIR/build/local.html"
fi
grep -Eo '[0-9]+ rows from [0-9,]+ screened.*' /tmp/market-tape.log | tail -1

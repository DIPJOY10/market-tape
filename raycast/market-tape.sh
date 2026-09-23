#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Market Tape
# @raycast.mode compact
#
# Optional parameters:
# @raycast.icon 📈
# @raycast.packageName Market Tape
# @raycast.description Open the live US equity screen. Re-pulls if the data is over 4h old, and starts the local server so the watchlist saves to SQLite.

set -euo pipefail
DIR="$HOME/market-tape"
MARKET="${MARKET_TAPE_MARKET:-us}"   # us | in  (see markets.py)
PY="$(command -v python3 || echo /usr/bin/python3)"
PORT=8811
STALE_HOURS=4

AGE="$("$PY" "$DIR/fresh.py" "$STALE_HOURS" "$MARKET" 2>/dev/null)" && FRESH=1 || FRESH=0

if [ "$FRESH" -eq 0 ]; then
  echo "Pulling fresh market data…"
  if ! "$PY" "$DIR/refresh.py" --market "$MARKET" >/tmp/market-tape.log 2>&1; then
    echo "Refresh failed — opening last good copy. See /tmp/market-tape.log"
  fi
fi

# The server backs the watchlist with SQLite. Without it the page still works,
# but a watchlist would live in browser storage only.
if ! curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
  nohup "$PY" "$DIR/serve.py" --port "$PORT" --market "$MARKET" --no-open >/tmp/market-tape-serve.log 2>&1 &
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1 && break
    sleep 0.3
  done
fi

if curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
  open "http://localhost:$PORT/"
  STORE="watchlist in SQLite"
else
  open "$DIR/build/$MARKET/local.html"
  STORE="server did not start — watchlist in browser storage"
fi

if [ "$FRESH" -eq 1 ]; then
  echo "Market Tape opened · data $AGE · $STORE"
else
  echo "Market Tape opened · data refreshed just now · $STORE"
fi

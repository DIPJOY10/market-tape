#!/usr/bin/env python3
"""
Local server for Market Tape.

Serves build/local.html and backs the watchlist with SQLite in watchlist.db, so a
watchlist survives browser changes, private windows and cleared site data. Opened
straight from disk instead, the page falls back to localStorage on its own.

    python3 serve.py [--port 8811] [--no-open]

Binds to 127.0.0.1 only - nothing here is reachable from the network.
"""
import argparse, json, mimetypes, os, pathlib, sqlite3, threading, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

HERE = pathlib.Path(__file__).resolve().parent
BUILD = HERE / "build"
DB = HERE / "watchlist.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS watchlist (
  ticker      TEXT PRIMARY KEY,
  added_at    TEXT NOT NULL,
  added_price REAL,
  note        TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS snapshots (
  ticker TEXT NOT NULL,
  ts     TEXT NOT NULL,
  price  REAL,
  PRIMARY KEY (ticker, ts)
);
CREATE INDEX IF NOT EXISTS idx_snap_ticker ON snapshots(ticker, ts);
"""

_lock = threading.Lock()


def db():
    con = sqlite3.connect(DB, timeout=10)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    with db() as con:
        con.executescript(SCHEMA)


class Handler(BaseHTTPRequestHandler):
    server_version = "MarketTape"

    def log_message(self, fmt, *args):      # quiet unless something breaks
        pass

    # ---------------------------------------------------------------- helpers
    def _send(self, code, body=b"", ctype="application/json", extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, obj, code=200):
        self._send(code, json.dumps(obj).encode(), "application/json")

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if not n:
            return {}
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return {}

    # ------------------------------------------------------------------ verbs
    def do_GET(self):
        path = urlparse(self.path).path
        if path.startswith("/api/"):
            return self._api_get(path)
        return self._static(path)

    do_HEAD = do_GET

    def do_POST(self):
        path = urlparse(self.path).path
        payload = self._body()
        if path == "/api/watchlist":
            t = (payload.get("ticker") or "").strip().upper()
            if not t:
                return self._json({"error": "ticker required"}, 400)
            with _lock, db() as con:
                con.execute(
                    "INSERT OR IGNORE INTO watchlist(ticker, added_at, added_price, note)"
                    " VALUES(?,?,?,?)",
                    (t, payload.get("added_at") or "", payload.get("added_price"),
                     payload.get("note") or ""))
            return self._json({"ok": True, "ticker": t})

        if path == "/api/snapshot":
            prices = payload.get("prices") or {}
            ts = payload.get("ts") or ""
            if not prices or not ts:
                return self._json({"error": "ts and prices required"}, 400)
            with _lock, db() as con:
                watched = {r["ticker"] for r in con.execute("SELECT ticker FROM watchlist")}
                rows = [(t, ts, p) for t, p in prices.items() if t in watched and p is not None]
                con.executemany(
                    "INSERT OR REPLACE INTO snapshots(ticker, ts, price) VALUES(?,?,?)", rows)
            return self._json({"ok": True, "recorded": len(rows)})

        return self._json({"error": "not found"}, 404)

    def do_DELETE(self):
        path = urlparse(self.path).path
        if path.startswith("/api/watchlist/"):
            t = unquote(path[len("/api/watchlist/"):]).upper()
            with _lock, db() as con:
                con.execute("DELETE FROM watchlist WHERE ticker=?", (t,))
            return self._json({"ok": True})
        return self._json({"error": "not found"}, 404)

    def do_PATCH(self):
        path = urlparse(self.path).path
        if path.startswith("/api/watchlist/"):
            t = unquote(path[len("/api/watchlist/"):]).upper()
            note = (self._body().get("note") or "")[:500]
            with _lock, db() as con:
                con.execute("UPDATE watchlist SET note=? WHERE ticker=?", (note, t))
            return self._json({"ok": True})
        return self._json({"error": "not found"}, 404)

    # -------------------------------------------------------------- api reads
    def _api_get(self, path):
        if path == "/api/health":
            return self._json({"ok": True, "db": DB.name})

        if path == "/api/watchlist":
            with db() as con:
                rows = [dict(r) for r in con.execute(
                    "SELECT ticker, added_at, added_price, note FROM watchlist"
                    " ORDER BY added_at")]
            return self._json({"items": rows})

        if path.startswith("/api/history/"):
            t = unquote(path[len("/api/history/"):]).upper()
            with db() as con:
                rows = [dict(r) for r in con.execute(
                    "SELECT ts, price FROM snapshots WHERE ticker=? ORDER BY ts", (t,))]
            return self._json({"ticker": t, "points": rows})

        return self._json({"error": "not found"}, 404)

    # ---------------------------------------------------------------- statics
    def _static(self, path):
        rel = "local.html" if path in ("/", "/index.html") else path.lstrip("/")
        target = (BUILD / rel).resolve()
        try:                                   # never serve outside build/
            target.relative_to(BUILD.resolve())
        except ValueError:
            return self._send(403, b"forbidden", "text/plain")
        if not target.is_file():
            return self._send(404, b"not found", "text/plain")
        ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        self._send(200, target.read_bytes(), ctype)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8811)
    ap.add_argument("--no-open", action="store_true")
    args = ap.parse_args()

    if not (BUILD / "local.html").exists():
        raise SystemExit("build/local.html missing - run: python3 refresh.py")

    init_db()
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    url = f"http://localhost:{args.port}/"
    print(f"Market Tape on {url}   (watchlist -> {DB.name})")
    if not args.no_open:
        webbrowser.open(url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()

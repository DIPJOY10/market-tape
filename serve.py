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
CACHE = HERE / "cache"
DB = HERE / "watchlist.db"
MARKET = "us"                   # which market's page is served at /

SCHEMA = """
CREATE TABLE IF NOT EXISTS lists (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS watchlist (
  list_id     INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  ticker      TEXT NOT NULL,
  market      TEXT NOT NULL DEFAULT 'us',
  added_at    TEXT NOT NULL,
  added_price REAL,
  note        TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (list_id, market, ticker)
);
CREATE TABLE IF NOT EXISTS snapshots (
  ticker TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT 'us',
  ts     TEXT NOT NULL,
  price  REAL,
  PRIMARY KEY (ticker, market, ts)
);
CREATE INDEX IF NOT EXISTS idx_snap_ticker ON snapshots(ticker, market, ts);
"""

DEFAULT_LIST = "My watchlist"


def ensure_default(con):
    row = con.execute("SELECT id FROM lists ORDER BY id LIMIT 1").fetchone()
    if row:
        return row["id"]
    cur = con.execute("INSERT INTO lists(name, created_at) VALUES(?, datetime('now'))",
                      (DEFAULT_LIST,))
    return cur.lastrowid


def migrate(con):
    """Carry older databases forward rather than dropping them:
       v1 keyed rows by ticker alone; v2 added named lists; v3 adds the market,
       so one list can hold names from more than one country."""
    cols = {r["name"] for r in con.execute("PRAGMA table_info(watchlist)")}
    if not cols or "market" in cols:
        return

    if "list_id" in cols:                      # v2 -> v3: add market to the key
        rows = [dict(r) for r in con.execute(
            "SELECT list_id, ticker, added_at, added_price, note FROM watchlist")]
        con.execute("DROP TABLE watchlist")
        con.executescript(SCHEMA)
        con.executemany(
            "INSERT OR IGNORE INTO watchlist"
            "(list_id, ticker, market, added_at, added_price, note) VALUES(?,?,'us',?,?,?)",
            [(r["list_id"], r["ticker"], r["added_at"] or "", r["added_price"],
              r["note"] or "") for r in rows])
        print(f"  moved {len(rows)} saved names onto the multi-market schema")
        return

    # v1 -> v3: no lists at all yet
    rows = [dict(r) for r in con.execute(
        "SELECT ticker, added_at, added_price, note FROM watchlist")]
    con.execute("DROP TABLE watchlist")
    con.executescript(SCHEMA)
    lid = ensure_default(con)
    con.executemany(
        "INSERT OR IGNORE INTO watchlist"
        "(list_id, ticker, market, added_at, added_price, note) VALUES(?,?,'us',?,?,?)",
        [(lid, r["ticker"], r["added_at"] or "", r["added_price"], r["note"] or "")
         for r in rows])
    print(f"  migrated {len(rows)} saved names into '{DEFAULT_LIST}'")


_lock = threading.Lock()


def db():
    con = sqlite3.connect(DB, timeout=10)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    with db() as con:
        con.execute("PRAGMA foreign_keys=ON")
        con.executescript(SCHEMA)
        migrate(con)
        ensure_default(con)


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

        if path == "/api/lists":
            name = (payload.get("name") or "").strip()[:60]
            if not name:
                return self._json({"error": "name required"}, 400)
            with _lock, db() as con:
                try:
                    cur = con.execute(
                        "INSERT INTO lists(name, created_at) VALUES(?, datetime('now'))",
                        (name,))
                    return self._json({"ok": True, "id": cur.lastrowid, "name": name})
                except sqlite3.IntegrityError:
                    return self._json({"error": "a list with that name already exists"}, 409)

        if path == "/api/watchlist":
            t = (payload.get("ticker") or "").strip().upper()
            lid = payload.get("list_id")
            if not t:
                return self._json({"error": "ticker required"}, 400)
            with _lock, db() as con:
                if not lid:
                    lid = ensure_default(con)
                con.execute(
                    "INSERT OR IGNORE INTO watchlist"
                    "(list_id, ticker, market, added_at, added_price, note)"
                    " VALUES(?,?,?,?,?,?)",
                    (lid, t, payload.get("market") or MARKET,
                     payload.get("added_at") or "", payload.get("added_price"),
                     payload.get("note") or ""))
            return self._json({"ok": True, "ticker": t, "list_id": lid})

        if path == "/api/snapshot":
            prices = payload.get("prices") or {}
            ts = payload.get("ts") or ""
            if not prices or not ts:
                return self._json({"error": "ts and prices required"}, 400)
            with _lock, db() as con:
                watched = {r["ticker"] for r in con.execute(
                    "SELECT DISTINCT ticker FROM watchlist")}
                rows = [(t, ts, p) for t, p in prices.items()
                        if t in watched and p is not None]
                con.executemany(
                    "INSERT OR REPLACE INTO snapshots(ticker, ts, price) VALUES(?,?,?)",
                    rows)
            return self._json({"ok": True, "recorded": len(rows)})

        return self._json({"error": "not found"}, 404)

    def do_DELETE(self):
        path = urlparse(self.path).path
        parts = [unquote(x) for x in path.strip("/").split("/")]

        # /api/lists/<id>
        if len(parts) == 3 and parts[1] == "lists":
            with _lock, db() as con:
                con.execute("PRAGMA foreign_keys=ON")
                if con.execute("SELECT COUNT(*) FROM lists").fetchone()[0] <= 1:
                    return self._json({"error": "cannot delete the only list"}, 409)
                con.execute("DELETE FROM lists WHERE id=?", (parts[2],))
            return self._json({"ok": True})

        # /api/watchlist/<list_id>/<ticker>
        if len(parts) == 4 and parts[1] == "watchlist":
            with _lock, db() as con:
                con.execute("DELETE FROM watchlist WHERE list_id=? AND ticker=?",
                            (parts[2], parts[3].upper()))
            return self._json({"ok": True})

        return self._json({"error": "not found"}, 404)

    def do_PATCH(self):
        path = urlparse(self.path).path
        parts = [unquote(x) for x in path.strip("/").split("/")]
        payload = self._body()

        # /api/lists/<id>  -> rename
        if len(parts) == 3 and parts[1] == "lists":
            name = (payload.get("name") or "").strip()[:60]
            if not name:
                return self._json({"error": "name required"}, 400)
            with _lock, db() as con:
                try:
                    con.execute("UPDATE lists SET name=? WHERE id=?", (name, parts[2]))
                except sqlite3.IntegrityError:
                    return self._json({"error": "a list with that name already exists"}, 409)
            return self._json({"ok": True})

        # /api/watchlist/<list_id>/<ticker>  -> note
        if len(parts) == 4 and parts[1] == "watchlist":
            note = (payload.get("note") or "")[:500]
            with _lock, db() as con:
                con.execute("UPDATE watchlist SET note=? WHERE list_id=? AND ticker=?",
                            (note, parts[2], parts[3].upper()))
            return self._json({"ok": True})

        return self._json({"error": "not found"}, 404)

    # -------------------------------------------------------------- api reads
    def _api_get(self, path):
        parts = [unquote(x) for x in path.strip("/").split("/")]

        if path == "/api/health":
            return self._json({"ok": True, "market": MARKET})

        if len(parts) == 4 and parts[1] == "data":
            code = parts[2]
            d = CACHE / code
            if not (d / "rows.json").exists():
                return self._json({"error": f"market {code} has not been pulled"}, 404)
            try:
                payload = {k: json.load(open(d / f"{k}.json"))
                           for k in ("rows", "tape", "sect", "meta")}
            except Exception as e:
                return self._json({"error": str(e)}, 500)
            return self._json(payload)

        if path == "/api/markets":
            out = []
            for d in sorted((HERE / "build").glob("*")):
                if not (d / "local.html").exists():
                    continue
                meta = HERE / "cache" / d.name / "meta.json"
                label = d.name
                if meta.exists():
                    try:
                        label = json.load(open(meta)).get("label", d.name)
                    except Exception:
                        pass
                out.append({"code": d.name, "label": label, "active": d.name == MARKET})
            return self._json({"markets": out})

        if path == "/api/lists":
            with db() as con:
                ensure_default(con)
                rows = [dict(r) for r in con.execute(
                    "SELECT l.id, l.name, l.created_at,"
                    "       (SELECT COUNT(*) FROM watchlist w WHERE w.list_id = l.id) AS count"
                    "  FROM lists l ORDER BY l.id")]
            return self._json({"lists": rows})

        # /api/watchlist or /api/watchlist/<list_id>
        if parts[:2] == ["api", "watchlist"]:
            with db() as con:
                lid = parts[2] if len(parts) == 3 else ensure_default(con)
                rows = [dict(r) for r in con.execute(
                    "SELECT ticker, market, added_at, added_price, note FROM watchlist"
                    " WHERE list_id=? ORDER BY added_at", (lid,))]
            return self._json({"list_id": int(lid), "items": rows})

        if len(parts) == 3 and parts[1] == "history":
            with db() as con:
                rows = [dict(r) for r in con.execute(
                    "SELECT ts, price FROM snapshots WHERE ticker=? ORDER BY ts",
                    (parts[2].upper(),))]
            return self._json({"ticker": parts[2].upper(), "points": rows})

        return self._json({"error": "not found"}, 404)

    # ---------------------------------------------------------------- statics
    def _static(self, path):
        if path in ("/", "/index.html"):
            rel = f"{MARKET}/local.html"
        else:
            rel = path.lstrip("/")
            if rel.endswith("/"):              # /in/ -> that market's page
                rel += "local.html"
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
    global MARKET
    ap = argparse.ArgumentParser(description="Serve Market Tape with a local watchlist")
    ap.add_argument("--port", type=int, default=8811)
    ap.add_argument("--market", default="us", help="which built market to serve")
    ap.add_argument("--no-open", action="store_true")
    args = ap.parse_args()

    MARKET = args.market
    built = sorted(d.name for d in BUILD.glob("*") if (d / "local.html").exists())
    if MARKET not in built:
        raise SystemExit(
            f"build/{MARKET}/local.html missing - run: python3 refresh.py --market {MARKET}"
            + (f"\nAlready built: {', '.join(built)}" if built else ""))

    init_db()
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    url = f"http://localhost:{args.port}/"
    print(f"Market Tape on {url}   markets: {', '.join(built)}   "
          f"(watchlist -> {DB.name})")
    if not args.no_open:
        webbrowser.open(url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()

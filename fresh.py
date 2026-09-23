#!/usr/bin/env python3
"""Exit 0 if the cached data is younger than N hours, 1 if it is stale or missing.
    python3 fresh.py 4 [market]
Also prints a human-readable age on stdout."""
import datetime, json, pathlib, sys

args = [a for a in sys.argv[1:] if not a.startswith("-")]
hours = float(args[0]) if args else 4.0
market = args[1] if len(args) > 1 else "us"
meta = pathlib.Path(__file__).resolve().parent / "cache" / market / "meta.json"
if not meta.exists():
    print("no data yet"); sys.exit(1)
try:
    gen = datetime.datetime.fromisoformat(json.load(open(meta))["generated"])
except Exception:
    print("unreadable timestamp"); sys.exit(1)
age = (datetime.datetime.now() - gen).total_seconds()
mins = age / 60
print(f"{int(mins)}m old" if mins < 90 else f"{mins / 60:.1f}h old")
sys.exit(0 if age < hours * 3600 else 1)

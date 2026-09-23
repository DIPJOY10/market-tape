#!/usr/bin/env python3
"""Plain-text digest of the last refresh — top picks per tier plus key metrics.
Used by the Raycast "Market Tape Top Picks" command; also fine on its own."""
import datetime, json, pathlib, sys

HERE = pathlib.Path(__file__).resolve().parent
CACHE = HERE / "cache"

def load(name, default=None):
    f = CACHE / name
    if not f.exists():
        return default
    return json.load(open(f))

def elig(r):
    min_a = 8 if r["tier"] in ("Mega", "Large") else 5
    if (r.get("na") or 0) < min_a: return False
    if not (r.get("fpe") and 0 < r["fpe"] <= 60): return False
    if not (r.get("pe") and r["pe"] > 0): return False
    if r.get("de") is not None and r["de"] > 3: return False
    return r.get("up") is not None

def money(x):
    if x is None: return "-"
    return f"${x:,.0f}" if abs(x) >= 100 else f"${x:,.2f}"

def main():
    rows = load("rows.json")
    meta = load("meta.json", {})
    if not rows:
        print("No data yet. Run:  python3 ~/market-tape/refresh.py")
        return 1

    gen = meta.get("generated", "")
    try:
        age = datetime.datetime.now() - datetime.datetime.fromisoformat(gen)
        hrs = age.total_seconds() / 3600
        when = (f"{int(age.total_seconds() // 60)}m ago" if hrs < 1
                else f"{hrs:.1f}h ago" if hrs < 48 else f"{age.days}d ago")
    except Exception:
        when = gen or "unknown"

    print(f"MARKET TAPE  ·  data pulled {when}")
    print(f"{meta.get('universe', '?'):,} stocks screened  ·  {meta.get('rows', '?')} in the table"
          f"  ·  {meta.get('actions', '?')} rating actions\n")

    tape = load("tape.json", [])
    if tape:
        for i in range(0, len(tape), 4):
            print("  " + "   ".join(
                f"{t['k']}: {t['v']}{(' ' + t['d']) if t['d'] else ''}" for t in tape[i:i + 4]))
        print()

    for tier, label in (("Mega", ">$200B"), ("Large", "$10-200B"),
                        ("Mid", "$2-10B"), ("Small", "<$2B")):
        top = sorted((r for r in rows if r["tier"] == tier and elig(r)),
                     key=lambda r: -r["sc"])[:5]
        print(f"── {tier.upper()} CAP  {label}")
        if not top:
            print("   nothing clears the filter\n"); continue
        for i, r in enumerate(top, 1):
            print(f"   {i}. {r['t']:<6} {money(r['px']):>10} → {money(r['tgt']):<10}"
                  f" {r['up']:>+6.0f}%  {r['fpe']:>5.1f}x  ST:{r['stL']:<8} LT:{r['ltL']:<8}"
                  f" {r['n'][:26]}")
        print()

    cov = lambda r: (r.get("na") or 0) >= 8
    def block(title, rows_, fmt):
        print(f"── {title}")
        for r in rows_:
            print(f"   {r['t']:<6} {fmt(r):<46} {r['n'][:24]}")
        print()

    block("LARGEST TARGET UPSIDE",
          sorted((r for r in rows if cov(r) and r.get("up") is not None),
                 key=lambda r: -r["up"])[:5],
          lambda r: f"{r['up']:+.0f}%  {money(r['px'])} → {money(r['tgt'])}")
    block("MOST UPGRADES",
          sorted((r for r in rows if r["up_c"] > 0), key=lambda r: -r["up_c"])[:5],
          lambda r: f"{r['up_c']} raises / {r['dn_c']} cuts")
    block("MOST DOWNGRADES",
          sorted((r for r in rows if r["dn_c"] > 0), key=lambda r: -r["dn_c"])[:5],
          lambda r: f"{r['dn_c']} cuts / {r['up_c']} raises")
    block("CHEAPEST HIGH-QUALITY",
          sorted((r for r in rows if (r.get("qlt") or 0) >= 70 and (r.get("fpe") or 0) > 0
                  and cov(r)), key=lambda r: r["fpe"])[:5],
          lambda r: f"{r['fpe']:.1f}x fwd  quality {r['qlt']:.0f} pctile")
    def mom(r):
        cell = lambda x: "    -" if x is None else f"{x:+5.1f}"
        return (f"2D{cell(r.get('d2'))}  1W{cell(r.get('w1'))}"
                f"  3W{cell(r.get('w3'))}  1M{cell(r.get('m1'))}"
                f"  3M{cell(r.get('m3'))}")

    block("STRONGEST 3-MONTH MOMENTUM",
          sorted((r for r in rows if r.get("m3") is not None and cov(r)),
                 key=lambda r: -r["m3"])[:5], mom)
    block("WEAKEST 3-MONTH MOMENTUM",
          sorted((r for r in rows if r.get("m3") is not None and cov(r)),
                 key=lambda r: r["m3"])[:5], mom)
    block("BEST 1-WEEK MOMENTUM",
          sorted((r for r in rows if r.get("w1") is not None and cov(r)),
                 key=lambda r: -r["w1"])[:5], mom)
    block("BEST 3-WEEK MOMENTUM",
          sorted((r for r in rows if r.get("w3") is not None and cov(r)),
                 key=lambda r: -r["w3"])[:5], mom)
    block("WEAKEST 3-WEEK MOMENTUM",
          sorted((r for r in rows if r.get("w3") is not None and cov(r)),
                 key=lambda r: r["w3"])[:5], mom)

    print("Percentile rankings of published numbers — not investment advice.")
    return 0

if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
Market Tape — end-to-end refresh.

Pulls live US equity data from TradingView's public scanner, scores the
universe, scans headlines for analyst rating actions, and writes build/index.html.

    python3 refresh.py

Then republish that file to the artifact URL in artifact.json to update it in place.
No API key required. Takes roughly 1-2 minutes, mostly the news scan.
"""
import argparse, bisect, datetime, json, math, pathlib, re, time, urllib.parse, urllib.request

import markets
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

HERE = pathlib.Path(__file__).resolve().parent
CACHE = HERE / "cache"        # per-market subdirectory chosen in main()
BUILD = HERE / "build"
P = markets.get(markets.DEFAULT)   # active market profile
UA = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}

COLS = ["name","description","close","change","market_cap_basic","sector","industry",
 "price_earnings_ttm","price_earnings_growth_ttm","earnings_per_share_diluted_ttm",
 "earnings_per_share_forecast_next_fy","price_sales_current","price_book_fq",
 "enterprise_value_ebitda_ttm","price_free_cash_flow_ttm","total_revenue_ttm",
 "total_revenue_yoy_growth_ttm","total_revenue_yoy_growth_fq","net_income_ttm","oper_income_ttm",
 "gross_margin_ttm","operating_margin_ttm","free_cash_flow_margin_ttm","return_on_equity",
 "return_on_invested_capital","debt_to_equity","current_ratio","dividends_yield_current",
 "price_target_1y","price_target_high","price_target_low","recommendation_mark","recommendation_total",
 "RSI","price_52_week_high","price_52_week_low","Perf.W","Perf.1M","Perf.3M","Perf.6M","Perf.YTD","Perf.Y",
 "SMA50","SMA200",
 "beta_1_year","earnings_release_next_date"]

def post(market, payload):
    req = urllib.request.Request(f"https://scanner.tradingview.com/{market}/scan",
                                 data=json.dumps(payload).encode(), headers=UA)
    return json.load(urllib.request.urlopen(req, timeout=45))


def screen(lo, hi=None, min_vol=None, pages=6, size=400):
    flt = [{"left": "type", "operation": "equal", "right": "stock"},
           {"left": "is_primary", "operation": "equal", "right": True}]
    flt.append({"left": "market_cap_basic", "operation": "in_range", "right": [lo, hi]} if hi
               else {"left": "market_cap_basic", "operation": "egreater", "right": lo})
    if min_vol:
        flt.append({"left": "average_volume_30d_calc", "operation": "egreater", "right": min_vol})
    out = {}
    for p in range(pages):
        r = post(P["scanner"], {"filter": flt, "options": {"lang": "en"},
                                "markets": [P["market"]],
                             "symbols": {"query": {"types": []}, "tickers": []}, "columns": COLS,
                             "sort": {"sortBy": "market_cap_basic", "sortOrder": "desc"},
                             "range": [p * size, (p + 1) * size]})
        if not r["data"]:
            break
        for row in r["data"]:
            d = dict(zip(COLS, row["d"])); d["ticker"] = row["s"]; out[row["s"]] = d
        time.sleep(0.25)
    return out


def fetch_universe():
    print("  fetching universe ...", flush=True)
    u = screen(P["floor"])
    u.update(screen(P["small_floor"], P["floor"], min_vol=P["min_volume"], pages=4))
    print(f"    {len(u)} stocks")
    return u


# ---------------------------------------------------------------- macro tape
# (symbol, label, unit, headwind) - headwind marks series where "up" is a
# drag on equities, so a rising print is not coloured green.
def fetch_macro():
    print("  fetching macro ...", flush=True)
    cols = ["close", "change", "Perf.YTD", "Perf.Y"]
    tks = [m[0] for m in P["macro"]]
    r = post("global", {"symbols": {"tickers": tks, "query": {"types": []}}, "columns": cols})
    got = {row["s"]: dict(zip(cols, row["d"])) for row in r["data"]}
    tape = []
    for tk, label, unit, headwind in P["macro"]:
        d = got.get(tk)
        if not d or d.get("close") is None:
            continue
        c = d["close"]
        val = (f"${c:,.2f}" if unit == "$" else f"{c:,.2f}%" if unit == "%" and c < 20
               else f"{c:,.2f}")
        sub, cls = "", "fl"
        if tk in markets.ECON_SUB:
            sub = markets.ECON_SUB[tk]
        else:
            ytd = d.get("Perf.YTD")
            if ytd is not None:
                sub = f"{'+' if ytd > 0 else ''}{ytd:.1f}% YTD"
                cls = ("dn" if ytd > 0 else "up") if headwind else ("up" if ytd > 0 else "dn")
            elif d.get("change") is not None:
                sub = f"{'+' if d['change'] > 0 else ''}{d['change']:.1f}% today"
        tape.append({"k": label, "v": val, "d": sub, "c": cls})
    return tape


HIST_KEEP = 400          # trading days of closes to retain per ticker
HIST_MIN_DAYS = 2        # a "2-day" move needs a close at least this many days old
HIST_MAX_DAYS = 6        # ...but not older than this, or it is not a 2-day move

def load_history():
    f = CACHE / "history.json"
    return json.load(open(f)) if f.exists() else {}

def update_history(hist, univ, today):
    """Append today's close per ticker. Keyed by date so irregular runs stay honest."""
    for v in univ:
        if v["px"] is None:
            continue
        series = hist.setdefault(v["ticker"], [])
        if series and series[-1][0] == today:
            series[-1][1] = round(v["px"], 4)
        else:
            series.append([today, round(v["px"], 4)])
        if len(series) > HIST_KEEP:
            del series[:-HIST_KEEP]
    return hist

def two_day(hist, ticker, px, today):
    """Percent change against the newest stored close that is 2-6 days old.
    Returns None until enough history has accumulated - never a guess."""
    series = hist.get(ticker)
    if not series or px is None:
        return None
    t = datetime.date.fromisoformat(today)
    for date, close in reversed(series):
        try:
            age = (t - datetime.date.fromisoformat(date)).days
        except ValueError:
            continue
        if age < HIST_MIN_DAYS:
            continue
        if age > HIST_MAX_DAYS:
            return None
        if close:
            return (px / close - 1) * 100
    return None

def return_path(v):
    """Price at each known horizon, back-solved from the horizon returns.
    A sparse but real price path - not a full daily series."""
    px = v["px"]
    if px is None:
        return None
    pts = []
    for days, field, label in ((365, "Perf.Y", "1Y"), (182, "Perf.6M", "6M"),
                               (91, "Perf.3M", "3M"), (30, "Perf.1M", "1M"),
                               (7, "Perf.W", "1W"), (1, "change", "1D")):
        r = num(v.get(field))
        if r is not None and r > -99:
            pts.append([days, round(px / (1 + r / 100), 4), label])
    pts.append([0, round(px, 4), "now"])
    pts.sort(key=lambda p: -p[0])
    return pts if len(pts) >= 3 else None

# ------------------------------------------------- daily price series (charts)
DAILY_SESSIONS = 252         # ~1 trading year kept at full daily resolution
WEEKLY_STRIDE = 5            # every 5th session ~= weekly, for the 5-year view
YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/{}?range=5y&interval=1d"


def fetch_series(rows, workers=16):
    """Five years of daily closes from Yahoo's public chart endpoint - one call per
    symbol, no auth. Best effort: a symbol that will not resolve simply gets no chart,
    and the page falls back to the path reconstructed from TradingView's returns."""
    print(f"  fetching 5y price history for {len(rows)} symbols ...", flush=True)

    def one(name):
        sym = markets.yahoo_symbol(P, name)   # BRK.B -> BRK-B, RELIANCE -> RELIANCE.NS
        try:
            req = urllib.request.Request(YAHOO.format(urllib.parse.quote(sym)),
                                         headers={"User-Agent": "Mozilla/5.0"})
            d = json.load(urllib.request.urlopen(req, timeout=25))
            r = (d.get("chart") or {}).get("result")
            if not r:
                return name, None
            r = r[0]
            ts = r.get("timestamp") or []
            cl = (r["indicators"]["quote"][0] or {}).get("close") or []
            pts = [(t, c) for t, c in zip(ts, cl) if c]
            return name, pts or None
        except Exception:
            return name, None

    out = {}
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for name, pts in ex.map(one, [r["t"] for r in rows]):
            if pts:
                out[name] = pts
    print(f"    {len(out)}/{len(rows)} resolved")
    return out


def _pack(sub, scale, with_offsets):
    """Closes normalised to 0..scale ints plus the real bounds, so the page can rebuild
    true prices (price = lo + v/scale * (hi-lo)) without shipping full floats."""
    vals = [c for _, c in sub]
    lo, hi = min(vals), max(vals)
    span = (hi - lo) or 1.0
    blob = {"v": [round((c - lo) / span * scale) for c in vals],
            "lo": round(lo, 4), "hi": round(hi, 4), "s": scale,
            "t0": int(sub[0][0]), "t1": int(sub[-1][0])}
    if with_offsets:
        # exact calendar day offsets, so short-range hovers name the right session
        d0 = datetime.date.fromtimestamp(sub[0][0])
        blob["o"] = [(datetime.date.fromtimestamp(t) - d0).days for t, _ in sub]
    return blob


def chart_blob(pts):
    """Daily for the last trading year, weekly for five years, plus the index where
    the current calendar year begins so the YTD range can be sliced exactly."""
    if not pts or len(pts) < 30:
        return None
    daily = pts[-DAILY_SESSIONS:]
    weekly = pts[::WEEKLY_STRIDE]
    if weekly[-1][0] != pts[-1][0]:
        weekly = weekly + [pts[-1]]
    jan1 = datetime.date(datetime.date.fromtimestamp(pts[-1][0]).year, 1, 1)
    ytd_idx = next((i for i, (t, _) in enumerate(daily)
                    if datetime.date.fromtimestamp(t) >= jan1), 0)
    return {"d": _pack(daily, 10000, True),     # fine scale: hover prices stay accurate
            "w": _pack(weekly, 1000, False),    # coarse is fine across five years
            "yi": ytd_idx}


def series_change(pts, sessions):
    """Exact change over N trading sessions, from the real daily closes.
    TradingView publishes 1W/1M/3M but nothing between, so horizons like the
    2-day and 3-week moves are derived here instead."""
    if not pts or len(pts) < sessions + 1:
        return None
    return (pts[-1][1] / pts[-1 - sessions][1] - 1) * 100


def series_2day(pts):
    return series_change(pts, 2)


def series_3week(pts):
    return series_change(pts, 15)      # 15 trading sessions ~= three weeks


# ------------------------------------------------------------------- scoring
def num(x):
    return x if isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) else None

def pct_rank(vals):
    s = sorted(v for v in vals if v is not None)
    def f(x):
        if x is None or not s: return None
        return bisect.bisect_left(s, x) / len(s) * 100
    return f

def avg(vals):
    vs = [v for v in vals if v is not None]
    return sum(vs) / len(vs) if vs else None

def band(x):
    if x is None: return "n/a"
    for e, l in ((20, "Weak"), (40, "Cautious"), (60, "Neutral"), (80, "Positive")):
        if x < e: return l
    return "Strong"

def score(U, now_ts):
    univ = list(U.values())
    for v in univ:
        px = num(v["close"]); v["px"] = px
        e = num(v["earnings_per_share_forecast_next_fy"]); et = num(v["earnings_per_share_diluted_ttm"])
        v["fwd_pe"] = px / e if (px and e and e > 0) else None
        v["eps_g_fwd"] = ((e / et) - 1) * 100 if (e and et and et > 0) else None
        pf = num(v["price_free_cash_flow_ttm"])
        v["fcf_yield"] = 100 / pf if (pf and pf > 0) else None
        pt = num(v["price_target_1y"]); v["upside"] = (pt / px - 1) * 100 if (pt and px) else None
        hi = num(v["price_52_week_high"]); v["off_high"] = (px / hi - 1) * 100 if (hi and px) else None
        ed = num(v["earnings_release_next_date"])
        v["earn_in"] = round((ed - now_ts) / 86400) if ed else None
        v["mc"] = num(v["market_cap_basic"]) or 0
        v["tier"] = markets.tier_of(P, v["mc"])

    by_sec = defaultdict(list)
    for v in univ: by_sec[v["sector"] or "?"].append(v)
    for rows in by_sec.values():
        for field, invert in (("fwd_pe", True), ("enterprise_value_ebitda_ttm", True),
                              ("price_sales_current", True), ("fcf_yield", False)):
            vals = []
            for x in rows:
                val = x.get(field) if field == "fwd_pe" else num(x.get(field))
                if invert and val is not None and val <= 0: val = None
                x["_tmp"] = val; vals.append(val)
            r = pct_rank(vals)
            for x in rows:
                p = r(x["_tmp"]); x[f"r_{field}"] = (100 - p) if (p is not None and invert) else p

    for field in ("return_on_invested_capital", "operating_margin_ttm", "free_cash_flow_margin_ttm",
                  "gross_margin_ttm", "total_revenue_yoy_growth_ttm", "total_revenue_yoy_growth_fq",
                  "eps_g_fwd", "Perf.W", "Perf.3M", "Perf.1M", "upside", "current_ratio"):
        r = pct_rank([(x.get(field) if field in ("eps_g_fwd", "upside") else num(x.get(field)))
                      for x in univ])
        for x in univ:
            x[f"r_{field}"] = r(x.get(field) if field in ("eps_g_fwd", "upside") else num(x.get(field)))
    rd = pct_rank([num(x.get("debt_to_equity")) for x in univ])
    for x in univ:
        p = rd(num(x.get("debt_to_equity"))); x["r_de"] = (100 - p) if p is not None else None

    for v in univ:
        v["VALUE"] = avg([v.get("r_fwd_pe"), v.get("r_enterprise_value_ebitda_ttm"),
                          v.get("r_fcf_yield"), v.get("r_price_sales_current")])
        v["QUALITY"] = avg([v.get("r_return_on_invested_capital"), v.get("r_operating_margin_ttm"),
                            v.get("r_free_cash_flow_margin_ttm"), v.get("r_gross_margin_ttm"),
                            v.get("r_de"), v.get("r_current_ratio")])
        v["GROWTH"] = avg([v.get("r_total_revenue_yoy_growth_ttm"),
                           v.get("r_total_revenue_yoy_growth_fq"), v.get("r_eps_g_fwd")])
        rm = num(v.get("recommendation_mark"))
        v["r_rec"] = (5 - rm) / 4 * 100 if rm is not None else None
        v["SENT"] = (avg([v.get("r_rec"), v.get("r_upside")])
                     if (num(v.get("recommendation_total")) or 0) >= 5 else None)
        v["MOM"] = avg([v.get("r_Perf.W"), v.get("r_Perf.1M"), v.get("r_Perf.3M")])
        core = [v["VALUE"], v["QUALITY"], v["GROWTH"]]
        v["SCORE"] = (avg(core + [x for x in (v.get("SENT"), v.get("MOM")) if x is not None])
                      if all(c is not None for c in core) else None)
        rsi = num(v.get("RSI"))
        v["ST"] = avg([v.get("MOM"), v.get("SENT"), None if rsi is None else 100 - abs(rsi - 55) * 2.2])
        v["LT"] = avg([v.get("QUALITY"), v.get("GROWTH"), v.get("VALUE"), v.get("r_de")])
        v["ST_label"] = band(v["ST"]); v["LT_label"] = band(v["LT"])

    by_ind = defaultdict(list)
    for v in univ: by_ind[v.get("industry") or "?"].append(v)
    for rows in by_ind.values():
        rows.sort(key=lambda x: -x["mc"])
        for v in rows:
            peers = sorted((p for p in rows if p["name"] != v["name"]),
                           key=lambda p: abs(math.log((p["mc"] or 1) + 1) - math.log((v["mc"] or 1) + 1)))
            v["competitors"] = [p["name"] for p in peers[:4]]
    return univ


# ----------------------------------------------------------- analyst actions
UP_RE = re.compile(r'\b(upgrad|raised to|initiat\w* .*(buy|overweight|outperform)|'
                   r'price target (raised|increased)|target raised|PT raised|'
                   r'Outperform From|Buy From|Overweight From)', re.I)
DN_RE = re.compile(r'\b(downgrad|lowered to|cut to|price target (lowered|cut|reduced)|'
                   r'target (lowered|cut)|PT (lowered|cut)|Underweight From|Sell From|'
                   r'Underperform From)', re.I)

def fetch_ratings(cands):
    print(f"  scanning headlines for {len(cands)} tickers ...", flush=True)
    def one(v):
        tk = v["ticker"]
        url = ("https://news-mediator.tradingview.com/public/view/v1/symbol?filter=lang%3Aen"
               f"&filter=symbol%3A{urllib.parse.quote(tk)}&client=overview&streaming=false")
        try:
            r = json.load(urllib.request.urlopen(
                urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=25))
        except Exception:
            return tk, []
        out = []
        for it in r.get("items", [])[:25]:
            t = it["title"]
            tag = "UP" if UP_RE.search(t) else ("DOWN" if DN_RE.search(t) else None)
            if tag:
                out.append({"d": datetime.datetime.fromtimestamp(
                    it["published"], datetime.timezone.utc).strftime("%Y-%m-%d"),
                    "g": tag, "x": t[:130]})
        return tk, out
    res = {}
    with ThreadPoolExecutor(max_workers=16) as ex:
        for tk, items in ex.map(one, cands):
            if items: res[tk] = items
    n = sum(len(v) for v in res.values())
    print(f"    {n} actions across {len(res)} tickers")
    return res, n


# -------------------------------------------------------------- sector table
SECT_LABEL = [("Perf.YTD", 2), ("Perf.3M", 3), ("Perf.1M", 4), ("fwd_pe", 5),
              ("return_on_invested_capital", 6), ("total_revenue_yoy_growth_ttm", 7), ("upside", 8)]

def sector_table(univ):
    import statistics as st
    g = defaultdict(list)
    for v in univ:
        if v["mc"] >= P["tiers"][2][1] and v.get("sector"): g[v["sector"]].append(v)
    rows = []
    for sec, rs in g.items():
        if len(rs) < 5: continue
        row = [sec, len(rs)]
        for field, _ in SECT_LABEL:
            vals = [r.get(field) for r in rs if isinstance(r.get(field), (int, float))]
            row.append(round(st.median(vals), 1) if vals else 0.0)
        rows.append(row)
    rows.sort(key=lambda r: -r[2])
    return rows


# -------------------------------------------------------------------- export
def R(x, p=2):
    return None if not isinstance(x, (int, float)) or not math.isfinite(x) else round(x, p)

def export_rows(univ, ratings, hist=None, today=None, series=None):
    ok = lambda v: v["SCORE"] is not None and (v.get("recommendation_total") or 0) >= 4
    sel = {}
    caps = {"Mega": 99, "Large": 130, "Mid": 130, "Small": 90}
    for t, capn in ((name, caps.get(name, 100)) for name, _, _ in P["tiers"]):
        for v in sorted((x for x in univ if x["tier"] == t and ok(x)),
                        key=lambda x: -x["SCORE"])[:capn]:
            sel[v["ticker"]] = v
    for v in univ:
        if (v["mc"] >= P["big_cap_always"] or v["name"] in P["ai"]) and v["SCORE"] is not None:
            sel[v["ticker"]] = v
    rows = []
    for v in sel.values():
        acts = ratings.get(v["ticker"], [])
        rows.append({"t": v["name"], "n": v["description"], "sec": v["sector"], "ind": v["industry"],
          "tier": v["tier"], "ai": 1 if v["name"] in P["ai"] else 0,
          "mc": R(v["mc"], 0), "px": R(v["px"]), "tgt": R(v.get("price_target_1y")),
          "tgH": R(v.get("price_target_high")), "tgL": R(v.get("price_target_low")),
          "up": R(v.get("upside"), 1), "rec": R(v.get("recommendation_mark")),
          "na": v.get("recommendation_total"), "fpe": R(v.get("fwd_pe"), 1),
          "pe": R(v.get("price_earnings_ttm"), 1), "ev": R(v.get("enterprise_value_ebitda_ttm"), 1),
          "ps": R(v.get("price_sales_current"), 1), "pb": R(v.get("price_book_fq"), 1),
          "fcfy": R(v.get("fcf_yield"), 1), "rg": R(v.get("total_revenue_yoy_growth_ttm"), 1),
          "rgq": R(v.get("total_revenue_yoy_growth_fq"), 1), "eg": R(v.get("eps_g_fwd"), 1),
          "roic": R(v.get("return_on_invested_capital"), 1), "roe": R(v.get("return_on_equity"), 1),
          "om": R(v.get("operating_margin_ttm"), 1), "fm": R(v.get("free_cash_flow_margin_ttm"), 1),
          "de": R(v.get("debt_to_equity")), "dy": R(v.get("dividends_yield_current"), 2),
          "ytd": R(v.get("Perf.YTD"), 1),
          "d1": R(v.get("change"), 1),
          "d2": R(series_2day((series or {}).get(v["name"]))
                  or (two_day(hist, v["ticker"], v["px"], today) if hist else None), 1),
          "ch": chart_blob((series or {}).get(v["name"])),
          "w1": R(v.get("Perf.W"), 1),
          "w3": R(series_3week((series or {}).get(v["name"])), 1),
          "m1": R(v.get("Perf.1M"), 1),
          "m3": R(v.get("Perf.3M"), 1), "m6": R(v.get("Perf.6M"), 1),
          "y1": R(v.get("Perf.Y"), 1), "rsi": R(v.get("RSI"), 0), "oh": R(v.get("off_high"), 1),
          "hi": R(v.get("price_52_week_high")), "lo": R(v.get("price_52_week_low")),
          "s50": R(v.get("SMA50")), "s200": R(v.get("SMA200")), "path": return_path(v),
          "beta": R(v.get("beta_1_year")), "st": R(v.get("ST"), 0), "lt": R(v.get("LT"), 0),
          "stL": v["ST_label"], "ltL": v["LT_label"], "sc": R(v.get("SCORE"), 0),
          "val": R(v.get("VALUE"), 0), "qlt": R(v.get("QUALITY"), 0), "grw": R(v.get("GROWTH"), 0),
          "comp": v.get("competitors", []),
          "up_c": sum(1 for a in acts if a["g"] == "UP"),
          "dn_c": sum(1 for a in acts if a["g"] == "DOWN"),
          "acts": acts[:4], "ein": v.get("earn_in")})
    rows.sort(key=lambda r: -(r["mc"] or 0))
    return rows


# The Vite build emits a complete HTML document. That is exactly what we want on
# disk, but a Claude Artifact supplies its own doctype/head wrapper, so that version
# ships as head-contents plus body-contents with the wrapper removed.
def strip_for_artifact(html):
    head = re.search(r"<head[^>]*>(.*?)</head>", html, re.S)
    body = re.search(r"<body[^>]*>(.*?)</body>", html, re.S)
    if not head or not body:
        return html
    h = head.group(1)
    h = re.sub(r"<meta[^>]*>", "", h)        # host provides charset + viewport
    return h.strip() + "\n" + body.group(1).strip() + "\n"


def main():
    global P, CACHE, BUILD
    ap = argparse.ArgumentParser(description="Market Tape data pipeline")
    ap.add_argument("--market", default=markets.DEFAULT, choices=sorted(markets.MARKETS),
                    help="which market profile to pull (default: %(default)s)")
    ap.add_argument("--no-charts", action="store_true",
                    help="skip the per-symbol price history fetch")
    args = ap.parse_args()

    P = markets.get(args.market)
    CACHE = HERE / "cache" / P["code"]
    BUILD = HERE / "build" / P["code"]
    CACHE.mkdir(parents=True, exist_ok=True)
    BUILD.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    now = datetime.datetime.now()
    print(f"Market Tape refresh - {P['label']} ({P['currency']})")
    U = fetch_universe()
    tape = fetch_macro()
    univ = score(U, now.timestamp())
    cands, seen = [], set()
    for t, _, _ in P["tiers"]:
        rs = sorted((v for v in univ if v["tier"] == t and v["SCORE"] is not None),
                    key=lambda v: -v["SCORE"])[:60]
        for v in rs:
            if v["ticker"] not in seen: seen.add(v["ticker"]); cands.append(v)
    for v in univ:
        if v["mc"] >= P["rating_scan_cap"] and v["ticker"] not in seen:
            seen.add(v["ticker"]); cands.append(v)
    ratings, n_acts = fetch_ratings(cands)
    today = now.date().isoformat()
    hist = update_history(load_history(), univ, today)
    rows = export_rows(univ, ratings, hist, today)          # symbol set only
    series = {} if args.no_charts else fetch_series(rows)
    rows = export_rows(univ, ratings, hist, today, series)  # with charts + exact 2D
    json.dump(hist, open(CACHE / "history.json", "w"), separators=(",", ":"))
    have_2d = sum(1 for r in rows if r.get("d2") is not None)
    have_sp = sum(1 for r in rows if r.get("ch"))
    sect = sector_table(univ)

    tmpl_path = HERE / "page.tmpl.html"
    if not tmpl_path.exists():
        raise SystemExit("page.tmpl.html missing - build the UI first:\n"
                         "  cd web && npm install && npm run build && npm run sync")
    tmpl = tmpl_path.read_text()
    meta = {"asof": now.strftime("%-d %b %Y"),
            "genat": now.strftime("%-d %b %Y, %-I:%M%p").lower(),
            "rows": len(rows), "universe": len(univ), "actions": n_acts,
            "market": P["code"], "marketLabel": P["label"],
            "currency": P["currency"], "symbol": P["symbol"],
            "capUnits": P["cap_units"],
            "tiers": [[name, label] for name, _, label in P["tiers"]]}
    html = (tmpl.replace("__ROWS__", json.dumps(rows, separators=(",", ":")))
                .replace("__TAPE__", json.dumps(tape, separators=(",", ":")))
                .replace("__SECT__", json.dumps(sect, separators=(",", ":")))
                .replace("__META__", json.dumps(meta, separators=(",", ":"))))
    (BUILD / "local.html").write_text(html)
    out = BUILD / "index.html"
    out.write_text(strip_for_artifact(html))
    json.dump(rows, open(CACHE / "rows.json", "w"), separators=(",", ":"))
    json.dump(tape, open(CACHE / "tape.json", "w"), indent=1)
    json.dump(sect, open(CACHE / "sect.json", "w"), indent=1)
    # Cache the same object the page embeds, plus bookkeeping: the local server
    # hands this to the market switcher, which needs the currency and tier labels
    # as much as the page does.
    json.dump({**meta, "generated": now.isoformat(), "label": P["label"]},
              open(CACHE / "meta.json", "w"), indent=1)
    print(f"\n  wrote {BUILD / 'local.html'}  "
          f"({(BUILD / 'local.html').stat().st_size // 1024} KB)   [open this one]")
    print(f"  wrote {out}   [publish this one as the Artifact]")
    print(f"  {len(rows)} rows from {len(univ):,} screened, {n_acts} rating actions")
    have_3w = sum(1 for r in rows if r.get("w3") is not None)
    print(f"  2-day momentum on {have_2d}/{len(rows)} names, 3-week on {have_3w}, "
          f"charts on {have_sp}")
    print(f"  done in {time.time() - t0:.0f}s")
    cfg = HERE / "artifact.json"
    if cfg.exists():
        try:
            print(f"\n  Republish it to: {json.load(open(cfg))['url']}")
        except Exception:
            pass
    else:
        print("\n  Open build/local.html, or copy artifact.example.json to artifact.json"
              "\n  to record a Claude Artifact URL to republish to.")


if __name__ == "__main__":
    main()

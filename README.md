# Market Tape

A live US-equity screener. Pulls ~2,700 stocks, scores them on value, quality, growth,
momentum and sell-side sentiment, and renders a tabbed React app with per-symbol charts,
a multi-horizon momentum ladder, competitors, analyst upgrades and downgrades, and a
watchlist backed by SQLite.

```bash
git clone https://github.com/DIPJOY10/market-tape.git
cd market-tape
python3 refresh.py      # pull the data (~40s, no API keys)
python3 serve.py        # open it, with the watchlist saved to disk

python3 refresh.py --market in && python3 serve.py --market in --port 8812   # India
```

`refresh.py` needs nothing but the Python standard library. Node is only needed if you
change the UI.

---

## The app

Five tabs:

| Tab | What's on it |
|---|---|
| **Overview** | Top composite score per cap tier, plus metric extremes: largest target upside, most upgrades and downgrades, cheapest high-quality, best and worst momentum |
| **The screen** | Every stock, sortable on any column, filterable by tier, sector, AI-linked, profitable, or watchlist-only. Click a row to expand it |
| **Watchlist** | Named lists of what you starred, with entry price, days held and performance since you added it |
| **Sectors** | Median stock per sector across performance, valuation and growth |
| **Notes** | Hand-written market commentary and the caveats that matter |

**Expanded row** — sparkline, 52-week range position, momentum from 2 days to 1 year,
the full metric set, industry competitors and recent analyst actions.

**Full chart** — click any sparkline for selectable ranges (1M / 3M / 6M / YTD / 1Y / 5Y),
price and date axes, rolling 50- and 200-day means computed from the series, and a
crosshair reporting the close, date and change from the range start for any session.
Daily resolution out to one year, weekly across five.

## Watchlists

Keep as many named lists as you like — create, rename and delete them from the Watchlist
tab. Starring a name on the screen adds it to whichever list you have open, and the tab
you were last on is remembered between sessions.

Entries record the price on the day you added them, so the tab shows performance since
rather than just a list of names.

Two storage backends, chosen at runtime — the app probes for the API and falls back
silently:

| How you open it | Storage | Survives |
|---|---|---|
| `python3 serve.py` | SQLite in `watchlist.db` | browser changes, cleared site data, private windows |
| `build/local.html` from disk, or published as an Artifact | `localStorage` | that browser only |

In the fallback case the tab says so, because clearing site data would erase the lists.
When they are saved to disk it says nothing — that is the normal case and needs no
explaining. `serve.py` binds to `127.0.0.1` only and is stdlib-only — no Flask, no pip
install. A database created before named lists is migrated on first run: its names move
into a list called "My watchlist" rather than being dropped.

## Commands

```bash
python3 refresh.py                   # full US pull -> build/us/
python3 refresh.py --market in       # India -> build/in/
python3 refresh.py --no-charts       # skip 5y price history: faster, smaller page
python3 serve.py --port 8811         # serve the US build + watchlist API
python3 serve.py --market in --port 8812   # serve India alongside it
python3 digest.py [market]           # plain-text top picks and metric extremes
python3 fresh.py 4 [market]          # exit 0 if cached data is under 4 hours old
```

## Changing the UI

The React app lives in `web/`. `refresh.py` does **not** run Vite — it injects data into
the already-built `page.tmpl.html`, which is committed. So refreshing data needs no Node
at all. Rebuild only when you change the interface:

```bash
cd web
npm install
npm run build     # vite build, then copies dist/index.html -> ../page.tmpl.html
npm run dev       # hot reload; the page renders empty until you run refresh.py
```

The build is a single self-contained HTML file (`vite-plugin-singlefile`): the Claude
Artifact sandbox cannot fetch sibling assets, and the local path opens straight from disk.

## Raycast

Raycast → Settings → **Extensions** → **+** → **Add Script Directory** → select `raycast/`.

| Command | Behaviour |
|---|---|
| **Market Tape** | Opens the screen. Re-pulls if data is over 4h old, starts `serve.py` so the watchlist is SQLite-backed |
| **Refresh Market Tape** | Forces a full re-pull, then opens |
| **Market Tape Top Picks** | Prints picks and metric extremes as text, no browser |

The scripts assume the repo is at `~/market-tape`. Edit `DIR` at the top of each if not.

## Markets

Two profiles ship today, and the pipeline is driven entirely by them:

| Code | Market | Currency | Universe | Chart symbols |
|---|---|---|---|---|
| `us` | United States | USD, T/B/M | NASDAQ, NYSE, AMEX | `NVDA` |
| `in` | India | INR, lakh crore | NSE | `RELIANCE.NS` |

Each market builds to `build/<code>/` and caches to `cache/<code>/`, so they never
collide. The UI takes its currency symbol, market-cap units, tier labels and macro
tape from whichever profile produced the data — nothing about dollars is hardcoded in
the frontend.

Watchlist rows carry the market they came from, so one list can hold names from both.

### Adding a market

Add an entry to `MARKETS` in `markets.py`. Nothing else should need editing:

| Field | What it drives |
|---|---|
| `scanner`, `market` | the TradingView scanner endpoint and query body |
| `currency`, `symbol`, `cap_units` | how prices and market caps are printed |
| `yahoo_suffix`, `yahoo_dot` | how a ticker is spelled for the chart endpoint |
| `floor`, `small_floor`, `min_volume` | the two screening sweeps |
| `tiers` | cap-tier thresholds *in local currency* and their labels |
| `macro` | the symbols on the tape, and which are headwinds |
| `ai` | the ticker set the "AI-linked only" filter matches |
| `big_cap_always`, `rating_scan_cap` | which names are always kept and headline-scanned |

Worth checking first, since these are what usually break: that the scanner endpoint
returns rows for your market, that Yahoo resolves a sample ticker with your suffix,
and that the news endpoint returns headlines for an exchange-prefixed symbol. All
three are plain HTTP and take a minute to verify with `curl`.

## How the scoring works

Value, quality and growth are **percentile ranks**, not absolute judgements. Value is
ranked *within sector* — a 15× bank and a 15× software company are not the same bet.
Quality and growth rank across the whole universe.

| Score | Built from |
|---|---|
| **Value** | forward P/E, EV/EBITDA, P/S, FCF yield — sector-relative |
| **Quality** | ROIC, operating margin, FCF margin, gross margin, leverage, current ratio |
| **Growth** | revenue growth TTM and latest quarter, forward EPS growth |
| **Short term** | 1W / 1M / 3M momentum, analyst sentiment, RSI position |
| **Long term** | quality, growth, valuation, leverage |

Tiers: Mega >$200B · Large $10–200B · Mid $2–10B · Small <$2B.

## Data sources

| Source | Used for | Auth |
|---|---|---|
| `scanner.tradingview.com` | fundamentals, prices, targets, consensus ratings | none |
| `query1.finance.yahoo.com` | 5y daily price history for charts and exact 2-day moves | none |
| `news-mediator.tradingview.com` | headlines, parsed for analyst rating actions | none |

These are public, undocumented endpoints. They can change or rate-limit without notice,
and this project is for personal and educational use — check each provider's terms before
doing anything else with it. Every network call degrades gracefully: a symbol that will
not resolve simply has no chart.

## Layout

```
refresh.py            fetch → score → rate-scan → inject → build
serve.py              local server + SQLite watchlist API (stdlib only)
digest.py             plain-text summary of the last pull
fresh.py              freshness probe
page.tmpl.html        the built UI, committed so refreshing needs no Node
web/                  React + Vite source for that template
raycast/              three Raycast script commands
markets.py            market profiles: currency, tiers, macro tape, ticker spelling
build/<market>/       generated; local.html is what you open
cache/<market>/       rows, tape, sectors, meta, accumulated daily closes
watchlist.db          your watchlist (gitignored)
```

## What does not auto-update

The **Notes** tab is hand-written prose carrying a visible date stamp. Everything else
regenerates on every pull. If the market has moved, rewrite or delete those notes — they
will otherwise contradict the live tables beside them.

## Known limits

- **Competitor sets come from TradingView's industry classification** and are sometimes
  wrong — insurers filed under "Technology Services", storage grouped with networking.
- **Trailing P/E can be flattered by one-off gains.** Check it against operating margin
  before believing a cheap headline multiple.
- **A low multiple on peak cyclical earnings is not value.** Memory, refining and shipping
  routinely screen at 5–13× forward at the top of their cycle.
- **Rating actions are parsed from headline text**, so they sample what the newswire
  surfaced rather than recording every analyst action.
- **Small-cap price targets often rest on 4–8 estimates** and swing on one revision.

## Not investment advice

This is a descriptive ranking of published numbers. "Screens undervalued" is a different
claim from "will go up", and stocks that screen cheap are usually cheap for reasons
informed people believe in. Nothing here is a recommendation to buy or sell anything.
For decisions you will act on, talk to a licensed adviser.

## License

MIT — see [LICENSE](LICENSE).

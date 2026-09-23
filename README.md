# Market Tape

A live US-equity screener that pulls ~2,700 stocks, scores them on value, quality,
growth, momentum and sell-side sentiment, and renders a single sortable HTML page —
with per-symbol price charts, a multi-horizon momentum ladder, competitors and recent
analyst upgrades and downgrades.

No API keys. No pip installs. Python standard library only.

```bash
git clone https://github.com/DIPJOY10/market-tape.git
cd market-tape
python3 refresh.py
open build/local.html
```

About 20 seconds for a full run.

---

## What you get

**The screen** — every stock above $1.5B (plus liquid small caps down to $300M),
ranked by a composite score. Sort any column, filter by cap tier or sector, search,
and click any row to expand it.

**Per-symbol detail** — six months of daily closes with the 50- and 200-day moving
averages drawn in, position within the 52-week range, a momentum ladder spanning
2 days to 1 year, the full metric set, industry competitors, and recent analyst actions.

**Top of the screen** — best composite score per cap tier, plus metric extremes:
largest target upside, most upgrades, most downgrades, cheapest high-quality names,
strongest and weakest momentum.

**Macro tape** — rates across the curve, oil, gold, the dollar, VIX, CPI, unemployment.

## Commands

```bash
python3 refresh.py               # full pull, writes build/index.html + build/local.html
python3 refresh.py --no-charts   # skip per-symbol price history (faster)
python3 digest.py                # plain-text top picks and metric extremes
python3 fresh.py 4               # exit 0 if cached data is under 4 hours old
```

## Raycast

Raycast → Settings → **Extensions** → **+** → **Add Script Directory** → select
`raycast/`. Three commands appear:

| Command | Behaviour |
|---|---|
| **Market Tape** | Opens the screen. Re-pulls first if data is over 4h old. |
| **Refresh Market Tape** | Forces a full re-pull, then opens. |
| **Market Tape Top Picks** | Prints picks and metric extremes as text, no browser. |

The scripts assume the repo lives at `~/market-tape`. Edit `DIR` at the top of each
if you clone it elsewhere.

## How the scoring works

Value, quality and growth are **percentile ranks**, not absolute judgements. Value is
ranked *within sector* — a 15× bank and a 15× software company are not the same bet.
Quality and growth rank across the whole universe.

| Score | Built from |
|---|---|
| **Value** | forward P/E, EV/EBITDA, P/S, FCF yield — all sector-relative |
| **Quality** | ROIC, operating margin, FCF margin, gross margin, leverage, current ratio |
| **Growth** | revenue growth TTM and latest quarter, forward EPS growth |
| **Short term** | 1W / 1M / 3M momentum, analyst sentiment, RSI position |
| **Long term** | quality, growth, valuation, leverage |

Tiers: Mega >$200B · Large $10–200B · Mid $2–10B · Small <$2B.

## Data sources

| Source | Used for | Auth |
|---|---|---|
| `scanner.tradingview.com` | fundamentals, prices, targets, consensus ratings | none |
| `query1.finance.yahoo.com` | daily price history for charts and exact 2-day moves | none |
| `news-mediator.tradingview.com` | headlines, parsed for analyst rating actions | none |

These are public, undocumented endpoints. They can change or rate-limit without
notice, and this project is intended for personal and educational use — check each
provider's terms before doing anything else with it. Every network call degrades
gracefully: a symbol that will not resolve simply has no chart.

## Files

```
refresh.py            fetch → score → rate-scan → build
digest.py             plain-text summary of the last pull
fresh.py              freshness probe
page.tmpl.html        the page; placeholders filled at build time
raycast/              three Raycast script commands
artifact.example.json optional Claude Artifact URL to republish to
build/index.html      for publishing as a Claude Artifact (host supplies doctype/head)
build/local.html      standalone; this is what you open from disk
cache/                rows, tape, sectors, meta and accumulated daily closes
```

`build/` and `cache/` are generated and gitignored.

## What does not auto-update

Two sections of `page.tmpl.html` are hand-written prose: the "what's driving this
market" themes and the caveat notes. They carry a visible date stamp. If the market
moves meaningfully they will contradict the live tables above them — rewrite them or
delete them.

## Known limits

- **Competitor sets come from TradingView's industry classification** and are sometimes
  wrong — insurers filed under "Technology Services", storage grouped with networking.
- **Trailing P/E can be flattered by one-off gains.** Check `pe` against operating
  margin before believing a cheap headline multiple.
- **A low multiple on peak cyclical earnings is not value.** Memory, refining and
  shipping names routinely screen at 5–13× forward at the top of their cycle.
- **Rating actions are parsed from headline text**, so they sample what the newswire
  surfaced rather than recording every analyst action.
- **Small-cap price targets often rest on 4–8 estimates** and swing on one revision.

## Not investment advice

This is a descriptive ranking of published numbers. "Screens undervalued" is a
different claim from "will go up", and stocks that screen cheap are usually cheap for
reasons informed people believe in. Nothing here is a recommendation to buy or sell
anything. For decisions you will act on, talk to a licensed adviser.

## License

MIT — see [LICENSE](LICENSE).

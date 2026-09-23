#!/usr/bin/env python3
"""
Market profiles.

Everything that differs between one country's market and another lives here, so
adding a market means adding a dict rather than editing the pipeline. See the
README section "Adding a market" for what each field drives.
"""

# (symbol, label, unit, headwind) - headwind marks series where a rising print is
# a drag on equities, so it is not coloured green.
US_MACRO = [
    ("SP:SPX", "S&P 500", "", False), ("NASDAQ:NDX", "Nasdaq 100", "", False),
    ("CBOE:VIX", "VIX", "", True), ("TVC:US02Y", "US 2Y", "%", True),
    ("TVC:US10Y", "US 10Y", "%", True), ("TVC:US30Y", "US 30Y", "%", True),
    ("NYMEX:CL1!", "Crude", "$", True), ("TVC:GOLD", "Gold", "$", False),
    ("TVC:DXY", "Dollar (DXY)", "", False),
    ("ECONOMICS:USINTR", "Fed funds", "%", True),
    ("ECONOMICS:USIRYY", "CPI y/y", "%", True),
    ("ECONOMICS:USUR", "Unemployment", "%", True),
]

IN_MACRO = [
    ("NSE:NIFTY", "Nifty 50", "", False), ("BSE:SENSEX", "Sensex", "", False),
    ("NSE:BANKNIFTY", "Bank Nifty", "", False),
    ("TVC:IN10Y", "India 10Y", "%", True),
    ("FX_IDC:USDINR", "USD/INR", "", True),
    ("NYMEX:CL1!", "Crude", "$", True), ("TVC:GOLD", "Gold", "$", False),
    ("ECONOMICS:ININTR", "RBI repo", "%", True),
    ("ECONOMICS:INIRYY", "CPI y/y", "%", True),
]

# Economic series carry no meaningful YTD or daily change, so they get a static
# descriptor rather than a percentage that would read as a market move.
ECON_SUB = {
    "ECONOMICS:USINTR": "target upper bound",
    "ECONOMICS:USIRYY": "year over year",
    "ECONOMICS:USUR": "U-3 rate",
    "ECONOMICS:ININTR": "policy rate",
    "ECONOMICS:INIRYY": "year over year",
}

US_AI = set((
    "NVDA AMD AVGO TSM MU ARM MRVL INTC QCOM TXN ADI NXPI ON LSCC CRDO ALAB MPWR SNPS "
    "CDNS ASML AMAT LRCX KLAC TER ENTG NVMI MSFT GOOGL AMZN META ORCL IBM AAPL CRM NOW "
    "SNOW MDB DDOG CRWD PANW APP S ESTC GTLB PATH ADBE ANET CIEN COHR LITE VRT SMCI DELL "
    "HPE WDC STX APH FN CLS NTAP JBL CRWV NBIS IREN EQIX DLR OKLO SMR VST CEG TLN GEV ETN "
    "PWR NRG PLTR SNDK AI BBAI SOUN TEM").split())

IN_AI = set((
    "TCS INFY WIPRO HCLTECH TECHM LTIM PERSISTENT COFORGE MPHASIS TATAELXSI KPITTECH "
    "ZENSARTECH CYIENT SONATSOFTW BSOFT NEWGEN HAPPSTMNDS INTELLECT TANLA ROUTE "
    "AFFLE NAUKRI POLICYBZR ZOMATO PAYTM NYKAA DIXON KAYNES SYRMA AMBER CDSL BSE").split())


MARKETS = {
    "us": {
        "code": "us",
        "label": "United States",
        "scanner": "america",          # scanner.tradingview.com/<scanner>/scan
        "market": "america",           # the "markets" field in the query body
        "currency": "USD",
        "symbol": "$",
        "cap_units": "western",        # T / B / M
        "yahoo_suffix": "",            # Yahoo spells US tickers plainly
        "yahoo_dot": "-",              # BRK.B -> BRK-B
        "floor": 1_500_000_000,        # main sweep: market cap at or above this
        "small_floor": 300_000_000,    # second sweep, with a liquidity filter
        "min_volume": 150_000,
        "tiers": [("Mega", 2e11, ">$200B"), ("Large", 1e10, "$10–200B"),
                  ("Mid", 2e9, "$2–10B"), ("Small", 0, "<$2B")],
        "macro": US_MACRO,
        "ai": US_AI,
        "big_cap_always": 1.0e11,      # always keep names at least this large
        "rating_scan_cap": 1.5e11,     # and scan their headlines for rating actions
    },
    "in": {
        "code": "in",
        "label": "India",
        "scanner": "india",
        "market": "india",
        "currency": "INR",
        "symbol": "₹",
        "cap_units": "indian",         # Cr / L, which is what the market quotes
        "yahoo_suffix": ".NS",         # NSE listings on Yahoo
        "yahoo_dot": "-",
        # INR thresholds, set to land near the USD tiers at roughly 90/USD
        "floor": 50_000_000_000,       # ~$525M
        "small_floor": 10_000_000_000, # ~$105M
        "min_volume": 50_000,
        # quoted in crore throughout, which is how the market itself talks
        "tiers": [("Mega", 5e12, ">₹5L Cr"), ("Large", 1e12, "₹1–5L Cr"),
                  ("Mid", 2e11, "₹20k–1L Cr"), ("Small", 0, "<₹20k Cr")],
        "macro": IN_MACRO,
        "ai": IN_AI,
        "big_cap_always": 2.0e12,
        "rating_scan_cap": 3.0e12,
    },
}

DEFAULT = "us"


def get(code):
    code = (code or DEFAULT).lower()
    if code not in MARKETS:
        raise SystemExit(f"unknown market {code!r}; known: {', '.join(MARKETS)}")
    return MARKETS[code]


def tier_of(profile, mc):
    for name, floor, _ in profile["tiers"]:
        if mc >= floor:
            return name
    return profile["tiers"][-1][0]


def yahoo_symbol(profile, name):
    return name.replace(".", profile["yahoo_dot"]) + profile["yahoo_suffix"]

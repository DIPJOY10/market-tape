import React from "react";
import { useMarket } from "../market.jsx";

function MarketSwitch() {
  const { markets, code, switchTo, loading, error } = useMarket();
  if (!markets || markets.length < 2) return null;   // nothing to switch between
  return (
    <div className="mkt">
      <div className="mkt-pills" role="group" aria-label="Market">
        {markets.map((m) => (
          <button key={m.code} className="mkt-pill"
                  aria-pressed={m.code === code}
                  disabled={loading != null}
                  onClick={() => switchTo(m.code)}>
            {m.label}
            {loading === m.code && <span className="mkt-load" aria-hidden="true" />}
          </button>
        ))}
      </div>
      {error && <span className="mkt-err">{error}</span>}
    </div>
  );
}

export default function Header() {
  const { tape, meta, label } = useMarket();
  return (
    <header className="top">
      <div className="top-in">
        <div className="eyebrow">
          {label} equities &middot; live TradingView data &middot; {meta.asof || ""}
        </div>
        <div className="top-row">
          <h1>Market Tape 2026</h1>
          <MarketSwitch />
        </div>
        <p className="sub">
          {meta.rows || 0} listed stocks from mega to small cap, scored on value, quality,
          growth, momentum and sell-side sentiment. Every price, target and fundamental is
          pulled live &mdash; open any row for charts, competitors and recent analyst actions.
        </p>
        <div className="asof">
          <span className="stamp">{(meta.universe || 0).toLocaleString()} stocks screened</span>
          <span className="stamp">{meta.actions || 0} rating actions parsed</span>
          {meta.genat && <span className="stamp">data pulled {meta.genat}</span>}
        </div>
        <div className="tape">
          {tape.map((t) => (
            <div className="tick" key={t.k}>
              <div className="k">{t.k}</div>
              <div className="v">{t.v}</div>
              <div className={"d " + t.c}>{t.d}</div>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

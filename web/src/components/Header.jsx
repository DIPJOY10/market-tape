import React from "react";
import { TAPE } from "../data.js";

export default function Header({ meta }) {
  return (
    <header className="top">
      <div className="top-in">
        <div className="eyebrow">
          US equities &middot; live TradingView data &middot; {meta.asof || ""}
        </div>
        <h1>Market Tape 2026</h1>
        <p className="sub">
          {meta.rows || 0} US-listed stocks from mega to small cap, scored on value, quality,
          growth, momentum and sell-side sentiment. Every price, target and fundamental is
          pulled live &mdash; open any row for charts, competitors and recent analyst actions.
        </p>
        <div className="asof">
          <span className="stamp">{(meta.universe || 0).toLocaleString()} stocks screened</span>
          <span className="stamp">{meta.actions || 0} rating actions parsed</span>
          {meta.genat && <span className="stamp">data pulled {meta.genat}</span>}
          <span className="stamp">Educational analysis &mdash; not investment advice</span>
        </div>
        <div className="tape">
          {TAPE.map((t) => (
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

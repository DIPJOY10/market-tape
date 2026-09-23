import React, { useMemo } from "react";
import { byTicker } from "../data.js";
import { fmtP, fmtMoney, fmtNum, fmtPct, signClass, recLabel, DASH } from "../format.js";
import { Sparkline } from "./Viz.jsx";

function sinceAdded(item, row) {
  if (!row || item.added_price == null || !item.added_price) return null;
  return (row.px / item.added_price - 1) * 100;
}

function daysHeld(item) {
  if (!item.added_at) return null;
  const t = Date.parse(item.added_at);
  if (isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 86400000));
}

export default function Watchlist({ wl, onJump, onChart }) {
  const rows = useMemo(
    () => wl.items.map((i) => ({ item: i, row: byTicker.get(i.ticker) || null })),
    [wl.items]
  );

  const totals = useMemo(() => {
    const vals = rows.map(({ item, row }) => sinceAdded(item, row)).filter((v) => v != null);
    if (!vals.length) return null;
    return {
      n: vals.length,
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      winners: vals.filter((v) => v > 0).length,
    };
  }, [rows]);

  const storeLabel = {
    loading: "checking storage…",
    sqlite: "saved to watchlist.db",
    browser: "saved in this browser only",
  }[wl.mode];

  return (
    <section>
      <div className="shead">
        <h2>Watchlist</h2>
        <p>Star any name on the screen and it lands here, with what it has done since you added it.</p>
      </div>

      <div className="wl-head">
        <span className={"store" + (wl.mode === "sqlite" ? " ok" : "")}>{storeLabel}</span>
        {wl.mode === "browser" && (
          <span style={{ color: "var(--muted)", fontSize: 12.5 }}>
            Run <code>python3 serve.py</code> to keep it in SQLite on disk instead.
          </span>
        )}
        {totals && (
          <span className="since" style={{ marginLeft: "auto", color: "var(--muted)" }}>
            {totals.n} tracked &middot; {totals.winners} up &middot; average{" "}
            <b className={signClass(totals.avg)}>{fmtPct(totals.avg)}</b> since added
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="wl-empty">
          <p className="big">Nothing on the watchlist yet</p>
          <p>Open <strong>The screen</strong> and click the &#9734; beside any ticker.</p>
          <p style={{ fontSize: 12, marginTop: 10 }}>
            Entries record the price on the day you added them, so this page can show
            performance since, not just a list of names.
          </p>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table id="main" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th></th><th>Ticker</th><th>Chart</th><th>Added</th><th>Held</th>
                <th>Entry</th><th>Now</th><th>Since added</th><th>Target</th>
                <th>Consensus</th><th>Note</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, row }) => {
                const chg = sinceAdded(item, row);
                const held = daysHeld(item);
                const rec = row ? recLabel(row.rec) : null;
                return (
                  <tr key={item.ticker}>
                    <td>
                      <button className="star" aria-pressed="true"
                              aria-label={"Remove " + item.ticker}
                              onClick={() => wl.remove(item.ticker)}>{"★"}</button>
                    </td>
                    <td>
                      <button className="jump" onClick={() => onJump(item.ticker)}>
                        <span className="tk">{item.ticker}</span>
                      </button>
                      <span className="co">{row ? row.n : "not in this pull"}</span>
                    </td>
                    <td style={{ width: 130 }}>
                      {row && row.ch ? (
                        <button className="spark-btn" style={{ width: 120 }}
                                onClick={() => onChart(item.ticker)}
                                aria-label={"Chart for " + item.ticker}>
                          <Sparkline ch={row.ch} w={120} h={30} />
                        </button>
                      ) : DASH}
                    </td>
                    <td className="num">{item.added_at ? item.added_at.slice(0, 10) : DASH}</td>
                    <td className="num">{held == null ? DASH : held + "d"}</td>
                    <td className="num">{fmtMoney(item.added_price)}</td>
                    <td className="num">{row ? fmtMoney(row.px) : DASH}</td>
                    <td className={"num " + signClass(chg)}>{fmtPct(chg)}</td>
                    <td className="num">{row ? fmtMoney(row.tgt) : DASH}</td>
                    <td>{rec ? <span className={"rt " + rec.cls}>{rec.text}</span> : DASH}</td>
                    <td style={{ minWidth: 170 }}>
                      <input className="wl-note" defaultValue={item.note || ""}
                             placeholder="why you are watching"
                             aria-label={"Note for " + item.ticker}
                             onBlur={(e) => wl.setNote(item.ticker, e.target.value)} />
                    </td>
                    <td>
                      <button className="btn danger" onClick={() => wl.remove(item.ticker)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

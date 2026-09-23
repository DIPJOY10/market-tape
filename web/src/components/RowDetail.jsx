import React from "react";
import { fmtP, fmtNum, fmtPct, DASH } from "../format.js";
import { Sparkline, RangeBar, MomentumLadder } from "./Viz.jsx";

const metrics = (r) => [
  ["Trailing P/E", fmtNum(r.pe, 1, "×")],
  ["EV/EBITDA", fmtNum(r.ev, 1, "×")],
  ["P/S", fmtNum(r.ps, 1, "×")],
  ["P/B", fmtNum(r.pb, 1, "×")],
  ["FCF yield", fmtNum(r.fcfy, 1, "%")],
  ["Rev gth (Q)", fmtNum(r.rgq, 1, "%")],
  ["Fwd EPS gth", fmtNum(r.eg, 1, "%")],
  ["Op margin", fmtNum(r.om, 1, "%")],
  ["FCF margin", fmtNum(r.fm, 1, "%")],
  ["ROE", fmtNum(r.roe, 1, "%")],
  ["Debt/equity", fmtNum(r.de, 2)],
  ["Div yield", fmtNum(r.dy, 2, "%")],
  ["Beta", fmtNum(r.beta, 2)],
  ["RSI", r.rsi == null ? DASH : String(r.rsi)],
  ["From 52w high", fmtNum(r.oh, 1, "%")],
  ["Target range", r.tgL != null && r.tgH != null
    ? `${r.tgL.toFixed(0)}–${r.tgH.toFixed(0)}` : DASH],
];

const BARS = [["Value", "val"], ["Quality", "qlt"], ["Growth", "grw"],
              ["Short", "st"], ["Long", "lt"]];

export default function RowDetail({ row: r, colSpan, onChart, onJump }) {
  return (
    <tr className="det">
      <td colSpan={colSpan}>
        <div className="det-in">
          <div className="dblk">
            <h4>Price &amp; momentum</h4>
            <div className="chart">
              {r.ch ? (
                <button className="spark-btn" onClick={() => onChart(r.t)}
                        aria-label={"Open full chart for " + r.t}>
                  <Sparkline ch={r.ch} />
                  <span className="spark-meta">
                    <span>6 months</span>
                    <span className="expand">Full chart &#8599;</span>
                  </span>
                </button>
              ) : (
                <p className="none">No price history resolved for this symbol.</p>
              )}
              <RangeBar px={r.px} lo={r.lo} hi={r.hi} />
              <MomentumLadder row={r} />
            </div>
          </div>

          <div className="dblk">
            <h4>Full metrics</h4>
            <div className="mgrid">
              {metrics(r).map(([k, v]) => (
                <div className="mg" key={k}>
                  <div className="k">{k}</div>
                  <div className="v">{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="dblk">
            <h4>Competitors &mdash; {r.ind || ""}</h4>
            {r.comp && r.comp.length ? (
              <div className="peers">
                {r.comp.map((p) => (
                  <button className="peer jump" key={p} onClick={() => onJump(p)}>{p}</button>
                ))}
              </div>
            ) : <p className="none">No close peers in this industry group.</p>}

            <div style={{ marginTop: 14 }}>
              <h4>Percentile scores</h4>
              <div className="scorebars">
                {BARS.map(([label, key]) => (
                  <div className="sb" key={label}>
                    <span className="lab">{label}</span>
                    <span className="track">
                      <span className="fill" style={{ width: (r[key] ?? 0) + "%" }} />
                    </span>
                    <span className="n">{r[key] ?? DASH}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="dblk">
            <h4>Recent analyst actions</h4>
            {r.acts && r.acts.length ? (
              <ul className="acts">
                {r.acts.map((a, i) => (
                  <li key={i}>
                    <span className={"abadge a-" + a.g}>{a.g === "UP" ? "UP" : "DN"}</span>
                    <span className="adate">{a.d.slice(5)}</span>
                    <span>{a.x}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="none">No rating actions captured in the trailing window.</p>}
          </div>
        </div>
      </td>
    </tr>
  );
}

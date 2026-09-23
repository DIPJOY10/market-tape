import React from "react";
import { useMarket } from "../market.jsx";
import { fmtPct, signClass } from "../format.js";

const COLS = ["YTD", "3M", "1M", "Fwd P/E", "ROIC", "Rev growth", "Target upside"];

export default function Sectors() {
  const { sect: SECT } = useMarket();
  const maxAbs = Math.max(1, ...SECT.map((r) => Math.abs(r[2])));
  return (
    <section>
      <div className="shead">
        <h2>Sector scoreboard</h2>
        <p>Median stock per sector, $2B+ market cap. Sorted by year to date.</p>
      </div>
      <div className="sect-wrap">
        <table>
          <thead>
            <tr>
              <th>Sector</th><th>n</th>
              {COLS.map((c) => <th key={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {SECT.map((r) => (
              <tr key={r[0]}>
                <td>
                  <strong>{r[0]}</strong>
                  <span className="bar" style={{
                    width: ((Math.abs(r[2]) / maxAbs) * 100).toFixed(0) + "%",
                    background: r[2] >= 0 ? "var(--pos)" : "var(--neg)",
                  }} />
                </td>
                <td className="num" style={{ color: "var(--faint)" }}>{r[1]}</td>
                <td className={"num " + signClass(r[2])}>{fmtPct(r[2])}</td>
                <td className={"num " + signClass(r[3])}>{fmtPct(r[3])}</td>
                <td className={"num " + signClass(r[4])}>{fmtPct(r[4])}</td>
                <td className="num">{r[5].toFixed(1)}&times;</td>
                <td className="num">{r[6].toFixed(1)}%</td>
                <td className="num">{r[7].toFixed(1)}%</td>
                <td className="num up">+{r[8].toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

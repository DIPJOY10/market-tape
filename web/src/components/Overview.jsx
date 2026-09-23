import React, { useMemo } from "react";
import { eligible, covered } from "../data.js";
import { useMarket } from "../market.jsx";
import { fmtP, fmtPct, signClass, fmtNum } from "../format.js";
import { StarButton } from "./Viz.jsx";

function TickerButton({ t, onJump }) {
  return (
    <button className="jump" onClick={() => onJump(t)} aria-label={"Show " + t}>
      <span className="tk">{t}</span>
    </button>
  );
}

function MetricCard({ title, rows, onJump }) {
  return (
    <div className="mv">
      <h4>{title}</h4>
      <ul>
        {rows.length === 0 && <li style={{ color: "var(--faint)" }}>&ndash;</li>}
        {rows.map(({ t, value, sub, cls }) => (
          <li key={t}>
            <TickerButton t={t} onJump={onJump} />
            <span className="sm">{sub}</span>
            <span className={"num " + (cls || "")}>{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const top = (list, key, desc, n = 5) =>
  [...list].sort((a, b) => {
    const x = a[key], y = b[key];
    if (x == null) return 1;
    if (y == null) return -1;
    return desc ? y - x : x - y;
  }).slice(0, n);

export default function Overview({ onJump, wl }) {
  const { rows: ROWS, tiers: TIERS } = useMarket();
  const picks = useMemo(() => TIERS.map(([tier, label]) => [
    tier, label,
    ROWS.filter((r) => r.tier === tier && eligible(r))
        .sort((a, b) => b.sc - a.sc).slice(0, 6),
  ]), [ROWS, TIERS]);

  const cards = useMemo(() => {
    const cov = ROWS.filter(covered);
    return [
      ["Largest target upside",
        top(cov.filter((r) => r.up != null), "up", true).map((r) => ({
          t: r.t, value: fmtPct(r.up, 0), cls: signClass(r.up),
          sub: `${fmtP(r.px)} → ${fmtP(r.tgt)}`,
        }))],
      ["Most upgrades",
        top(ROWS.filter((r) => r.up_c > 0), "up_c", true).map((r) => ({
          t: r.t, value: r.up_c, cls: "up",
          sub: r.dn_c ? `${r.dn_c} cuts too` : "no cuts",
        }))],
      ["Most downgrades",
        top(ROWS.filter((r) => r.dn_c > 0), "dn_c", true).map((r) => ({
          t: r.t, value: r.dn_c, cls: "dn",
          sub: r.up_c ? `${r.up_c} raises too` : "no raises",
        }))],
      ["Cheapest high-quality",
        top(cov.filter((r) => r.qlt >= 70 && r.fpe > 0), "fpe", false).map((r) => ({
          t: r.t, value: fmtNum(r.fpe, 1, "×"),
          sub: `quality ${r.qlt} pctile`,
        }))],
      ["Best 1-week momentum",
        top(cov.filter((r) => r.w1 != null), "w1", true).map((r) => ({
          t: r.t, value: fmtPct(r.w1, 0), cls: signClass(r.w1),
          sub: `3M ${fmtPct(r.m3, 0)}`,
        }))],
      ["Best 3-week momentum",
        top(cov.filter((r) => r.w3 != null), "w3", true).map((r) => ({
          t: r.t, value: fmtPct(r.w3, 0), cls: signClass(r.w3),
          sub: `1W ${fmtPct(r.w1, 0)} \u00b7 3M ${fmtPct(r.m3, 0)}`,
        }))],
      ["Weakest 3-week momentum",
        top(cov.filter((r) => r.w3 != null), "w3", false).map((r) => ({
          t: r.t, value: fmtPct(r.w3, 0), cls: signClass(r.w3),
          sub: `1W ${fmtPct(r.w1, 0)} \u00b7 3M ${fmtPct(r.m3, 0)}`,
        }))],
      ["Weakest 3-month momentum",
        top(cov.filter((r) => r.m3 != null), "m3", false).map((r) => ({
          t: r.t, value: fmtPct(r.m3, 0), cls: signClass(r.m3),
          sub: r.oh != null ? `${r.oh.toFixed(0)}% off high` : "",
        }))],
    ];
  }, [ROWS]);

  return (
    <>
      <section>
        <div className="shead">
          <h2>Top of the screen</h2>
          <p>Best composite score in each tier &mdash; profitable, covered by enough analysts,
            not over-levered. Rebuilt on every refresh. Click a ticker to open it on the screen.</p>
        </div>
        <div className="tops">
          {picks.map(([tier, label, list]) => (
            <div className="tp" key={tier}>
              <div className="tp-h">
                <span className="tp-t">{tier} cap</span>
                <span className="tp-s">{label}</span>
              </div>
              <ol className="tp-l">
                {list.length === 0 && (
                  <li style={{ gridColumn: "1/-1", color: "var(--faint)" }}>
                    Nothing clears the filter.
                  </li>
                )}
                {list.map((r, i) => (
                  <li key={r.t}>
                    <span className="r">{i + 1}</span>
                    <TickerButton t={r.t} onJump={onJump} />
                    <span className="mt">
                      {fmtP(r.px)} &rarr; {fmtP(r.tgt)} &middot; {fmtNum(r.fpe, 1, "×")}
                    </span>
                    <span className={"num " + signClass(r.up)}>{fmtPct(r.up, 0)}</span>
                    <StarButton ticker={r.t} wl={wl} />
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="shead">
          <h2>Key metrics right now</h2>
          <p>Extremes in this data set.</p>
        </div>
        <div className="movers">
          {cards.map(([title, rows]) => (
            <MetricCard key={title} title={title} rows={rows} onJump={onJump} />
          ))}
        </div>
      </section>
    </>
  );
}

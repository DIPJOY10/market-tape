import React from "react";
import { sliceRange, bounds } from "../chart.js";
import { fmtP, fmtPct, signClass } from "../format.js";

export function Sparkline({ ch, w = 260, h = 56 }) {
  const d = sliceRange(ch, "6M");
  if (!d) return null;
  const { px } = d, n = px.length, PAD = 3;
  const lo = Math.min(...px), hi = Math.max(...px), span = hi - lo || 1;
  const X = (i) => PAD + (i / (n - 1)) * (w - 2 * PAD);
  const Y = (p) => h - PAD - ((p - lo) / span) * (h - 2 * PAD);
  const pts = px.map((p, i) => `${X(i).toFixed(1)},${Y(p).toFixed(1)}`);
  const col = px[n - 1] >= px[0] ? "var(--pos)" : "var(--neg)";
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
         role="img" aria-label="Six month price">
      <path d={`M${pts.join(" L")} L${X(n - 1).toFixed(1)},${h - PAD} L${PAD},${h - PAD} Z`}
            fill={col} opacity=".12" />
      <polyline points={pts.join(" ")} fill="none" stroke={col} strokeWidth="1.6"
                strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={X(n - 1).toFixed(1)} cy={Y(px[n - 1]).toFixed(1)} r="2.4" fill={col} />
    </svg>
  );
}

export function RangeBar({ px, lo, hi }) {
  if (px == null || lo == null || hi == null || hi <= lo) return null;
  const pos = Math.max(0, Math.min(1, (px - lo) / (hi - lo)));
  return (
    <div className="rng">
      <div className="rng-track">
        <span className="rng-mark" style={{ left: `calc(${(pos * 100).toFixed(1)}% - 1px)` }} />
      </div>
      <div className="rng-lab">
        <span>52w low {fmtP(lo)}</span>
        <span>{(pos * 100).toFixed(0)}% of range</span>
        <span>high {fmtP(hi)}</span>
      </div>
    </div>
  );
}

const HORIZONS = [["2D", "d2"], ["1W", "w1"], ["1M", "m1"], ["3M", "m3"],
                  ["6M", "m6"], ["YTD", "ytd"], ["1Y", "y1"]];

export function MomentumLadder({ row }) {
  const vals = HORIZONS.map(([label, key]) => [label, row[key]]);
  const max = Math.max(10, ...vals.map(([, v]) => (v == null ? 0 : Math.abs(v))));
  return (
    <div className="mom">
      {vals.map(([label, v]) => {
        if (v == null) {
          return (
            <div className="mom-row" key={label}>
              <span className="h">{label}</span>
              <span className="mom-bar"><span className="zero" /></span>
              <span className="n" style={{ color: "var(--faint)" }}>&ndash;</span>
            </div>
          );
        }
        const width = Math.min(50, (Math.abs(v) / max) * 50).toFixed(1) + "%";
        const pos = v >= 0;
        return (
          <div className="mom-row" key={label}>
            <span className="h">{label}</span>
            <span className="mom-bar">
              <span className="zero" />
              <i style={pos
                ? { left: "50%", width, background: "var(--pos)" }
                : { right: "50%", width, background: "var(--neg)" }} />
            </span>
            <span className={"n " + signClass(v)}>{fmtPct(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function StarButton({ ticker, wl, size }) {
  const on = wl.has(ticker);
  return (
    <button
      className="star"
      aria-pressed={on}
      title={on ? "Remove from watchlist" : "Add to watchlist"}
      aria-label={on ? `Remove ${ticker} from watchlist` : `Add ${ticker} to watchlist`}
      style={size ? { fontSize: size } : undefined}
      onClick={(e) => { e.stopPropagation(); on ? wl.remove(ticker) : wl.add(ticker); }}
    >
      {on ? "★" : "☆"}
    </button>
  );
}

import React, { useMemo, useState } from "react";
import { sliceRange, bounds } from "../chart.js";
import { fmtP, fmtPct, fmtDate, signClass } from "../format.js";

export function Sparkline({ ch, w = 260, h = 56, interactive = true }) {
  const [hover, setHover] = useState(null);
  const d = useMemo(() => sliceRange(ch, "6M"), [ch]);
  if (!d) return null;

  const { px } = d, n = px.length, PAD = 3;
  const lo = Math.min(...px), hi = Math.max(...px), span = hi - lo || 1;
  const X = (i) => PAD + (i / (n - 1)) * (w - 2 * PAD);
  const Y = (p) => h - PAD - ((p - lo) / span) * (h - 2 * PAD);
  const pts = px.map((p, i) => `${X(i).toFixed(1)},${Y(p).toFixed(1)}`);
  const col = px[n - 1] >= px[0] ? "var(--pos)" : "var(--neg)";

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (w / rect.width);
    const i = Math.round(((x - PAD) / (w - 2 * PAD)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  // Keep the bubble inside the chart rather than letting it run off an edge.
  const tipLeft = hover == null ? 0
    : Math.max(0, Math.min(100, (X(hover) / w) * 100));

  return (
    <div className="spark-hold">
      <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
           role="img" aria-label="Six month price"
           onPointerMove={interactive ? onMove : undefined}
           onPointerLeave={interactive ? () => setHover(null) : undefined}>
        <path d={`M${pts.join(" L")} L${X(n - 1).toFixed(1)},${h - PAD} L${PAD},${h - PAD} Z`}
              fill={col} opacity=".12" />
        <polyline points={pts.join(" ")} fill="none" stroke={col} strokeWidth="1.6"
                  strokeLinejoin="round" strokeLinecap="round" />
        {hover != null && (
          <g>
            <line x1={X(hover)} y1={PAD} x2={X(hover)} y2={h - PAD}
                  stroke="var(--ink)" strokeWidth="1" opacity=".4" />
            <circle cx={X(hover)} cy={Y(px[hover])} r="2.8" fill={col}
                    stroke="var(--surf)" strokeWidth="1.5" />
          </g>
        )}
        <circle cx={X(n - 1).toFixed(1)} cy={Y(px[n - 1]).toFixed(1)} r="2.4" fill={col} />
      </svg>
      {hover != null && (
        <span className="spark-tip" style={{ left: `${tipLeft}%` }}>
          <b>{fmtP(px[hover])}</b>
          <i>{fmtDate(d.ts[hover])}</i>
        </span>
      )}
    </div>
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

const HORIZONS = [["2D", "d2"], ["1W", "w1"], ["3W", "w3"], ["1M", "m1"],
                  ["3M", "m3"], ["6M", "m6"], ["YTD", "ytd"], ["1Y", "y1"]];

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

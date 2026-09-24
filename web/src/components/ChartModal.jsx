import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMarket } from "../market.jsx";
import { RANGES, sliceRange, bounds, maLabel } from "../chart.js";
import { fmtP, fmtPct, fmtDate, signClass } from "../format.js";
import { MomentumLadder, StarButton } from "./Viz.jsx";

const PAD = { L: 8, R: 58, T: 14, B: 26 };

function useWidth(ref) {
  const [w, setW] = useState(600);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(Math.max(280, el.clientWidth || 600));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

export default function ChartModal({ ticker, onClose, wl }) {
  const { byTicker } = useMarket();
  const row = byTicker.get(ticker);
  const [range, setRange] = useState("6M");
  const [hover, setHover] = useState(null);
  const hostRef = useRef(null);
  const closeRef = useRef(null);
  const W = useWidth(hostRef);
  const H = Math.max(200, Math.min(360, Math.round(W * 0.42)));

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  useEffect(() => setHover(null), [range]);

  const d = useMemo(() => (row ? sliceRange(row.ch, range) : null), [row, range]);
  const geom = useMemo(() => {
    if (!d) return null;
    const { lo, hi } = bounds(d);
    const n = d.px.length;
    const pw = W - PAD.L - PAD.R, ph = H - PAD.T - PAD.B;
    return {
      lo, hi, n, pw, ph,
      X: (i) => PAD.L + (n === 1 ? 0 : (i / (n - 1)) * pw),
      Y: (p) => PAD.T + ph - ((p - lo) / (hi - lo || 1)) * ph,
    };
  }, [d, W, H]);

  if (!row) return null;

  const onMove = (e) => {
    if (!geom) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const i = Math.max(0, Math.min(geom.n - 1,
      Math.round(((x - PAD.L) / (geom.pw || 1)) * (geom.n - 1))));
    setHover(i);
  };

  const maPath = (arr) => {
    if (!geom) return "";
    const seg = [];
    let started = false;
    for (let k = 0; k < geom.n; k++) {
      if (arr[k] == null) { started = false; continue; }
      seg.push((started ? "L" : "M") + geom.X(k).toFixed(1) + "," + geom.Y(arr[k]).toFixed(1));
      started = true;
    }
    return seg.length < 3 ? "" : seg.join(" ");
  };

  const rangeChg = d ? (d.px[d.px.length - 1] / d.px[0] - 1) * 100 : null;
  const rLo = d ? Math.min(...d.px) : null;
  const rHi = d ? Math.max(...d.px) : null;
  const up = d ? d.px[d.px.length - 1] >= d.px[0] : true;
  const col = up ? "var(--pos)" : "var(--neg)";

  return (
    <div className="modal" onClick={(e) => {
      if (e.target.classList.contains("modal-bg")) onClose();
    }}>
      <div className="modal-bg" />
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={"Chart for " + row.t}>
        <button className="modal-x" ref={closeRef} onClick={onClose} aria-label="Close chart">&times;</button>
        <div className="m-head">
          <h3>{row.t}</h3>
          <StarButton ticker={row.t} wl={wl} size="16px" />
          <span className="px">{fmtP(row.px)}</span>
          {row.d1 != null && (
            <span className={"cg " + signClass(row.d1)}>{fmtPct(row.d1, 2)} today</span>
          )}
          <span className="nm">{row.n}</span>
        </div>

        <div className="m-tabs" role="group" aria-label="Chart range">
          {RANGES.map(([k]) => (
            <button key={k} className="m-tab" aria-pressed={range === k}
                    onClick={() => setRange(k)}>{k}</button>
          ))}
        </div>

        <div className="m-chart" ref={hostRef}>
          {hover != null && d && geom && (
            <span className="chart-tip" style={{
              left: `${Math.max(6, Math.min(94, (geom.X(hover) / W) * 100))}%`,
              top: `${Math.max(0, (geom.Y(d.px[hover]) / H) * 100 - 2)}%`,
            }}>
              <span className="tp-px">{fmtP(d.px[hover])}</span>
              <span className="tp-dt">{fmtDate(d.ts[hover], true)}</span>
              <span className={"tp-ch " + signClass(d.px[hover] / d.px[0] - 1)}>
                {fmtPct((d.px[hover] / d.px[0] - 1) * 100)} from range start
              </span>
            </span>
          )}
          {!d ? <p className="none">No data for this range.</p> : (
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
                 aria-label={`${row.t} price over ${range}`}
                 onPointerMove={onMove} onPointerDown={onMove}
                 onPointerLeave={() => setHover(null)}>
              {[0, 1, 2, 3, 4].map((i) => {
                const gp = geom.lo + (geom.hi - geom.lo) * i / 4;
                const gy = geom.Y(gp);
                return (
                  <g key={i}>
                    <line x1={PAD.L} y1={gy} x2={PAD.L + geom.pw} y2={gy}
                          stroke="var(--line)" strokeWidth="1" opacity=".55" />
                    <text x={PAD.L + geom.pw + 7} y={gy + 3.5} className="ax">{fmtP(gp)}</text>
                  </g>
                );
              })}
              {(() => {
                const ticks = Math.min(5, geom.n);
                return Array.from({ length: ticks }, (_, i) => {
                const ti = Math.round((i / (ticks - 1 || 1)) * (geom.n - 1));
                const anchor = i === 0 ? "start" : i === ticks - 1 ? "end" : "middle";
                const long = range === "1Y" || range === "5Y" || range === "YTD";
                return (
                  <text key={i} x={geom.X(ti).toFixed(1)} y={H - 8} className="ax"
                        textAnchor={anchor}>{fmtDate(d.ts[ti], long)}</text>
                );
                });
              })()}
              {maPath(d.ma200) && (
                <path d={maPath(d.ma200)} fill="none" stroke="var(--faint)"
                      strokeWidth="1.2" strokeDasharray="1 4" opacity=".85" />
              )}
              {maPath(d.ma50) && (
                <path d={maPath(d.ma50)} fill="none" stroke="var(--faint)"
                      strokeWidth="1.2" strokeDasharray="4 3" opacity=".85" />
              )}
              <path fill={col} opacity=".10"
                    d={`M${d.px.map((p, i) => `${geom.X(i).toFixed(1)},${geom.Y(p).toFixed(1)}`).join(" L")}`
                       + ` L${geom.X(geom.n - 1).toFixed(1)},${PAD.T + geom.ph}`
                       + ` L${PAD.L},${PAD.T + geom.ph} Z`} />
              <polyline fill="none" stroke={col} strokeWidth="1.8"
                        strokeLinejoin="round" strokeLinecap="round"
                        points={d.px.map((p, i) => `${geom.X(i).toFixed(1)},${geom.Y(p).toFixed(1)}`).join(" ")} />
              {hover != null && (
                <g>
                  <line x1={geom.X(hover)} y1={PAD.T} x2={geom.X(hover)} y2={PAD.T + geom.ph}
                        stroke="var(--ink)" strokeWidth="1" opacity=".45" />
                  <circle cx={geom.X(hover)} cy={geom.Y(d.px[hover])} r="3.5"
                          fill={col} stroke="var(--surf)" strokeWidth="1.5" />
                </g>
              )}
            </svg>
          )}
        </div>

        <div className="m-read">
          {hover == null || !d ? (
            <span className="hint">Hover the chart for any session</span>
          ) : (
            <>
              <span className="rd-d">{fmtDate(d.ts[hover], true)}</span>
              <span className="rd-p">{fmtP(d.px[hover])}</span>
              <span className={signClass(d.px[hover] / d.px[0] - 1)}>
                {fmtPct((d.px[hover] / d.px[0] - 1) * 100)} from range start
              </span>
              {d.ma50[hover] != null && (
                <span className="rd-m">{maLabel(range, false)} {fmtP(d.ma50[hover])}</span>
              )}
              {d.ma200[hover] != null && (
                <span className="rd-m">{maLabel(range, true)} {fmtP(d.ma200[hover])}</span>
              )}
            </>
          )}
        </div>

        {d && (
          <div className="m-foot">
            <span>
              <b className={signClass(rangeChg)}>{fmtPct(rangeChg)}</b> over {range}
            </span>
            <span>range low {fmtP(rLo)}</span>
            <span>high {fmtP(rHi)}</span>
            <span className="ma-key">
              &ndash;&ndash; {maLabel(range, false)} &nbsp;&middot;&middot;&middot; {maLabel(range, true)}
            </span>
          </div>
        )}

        <div className="m-mom">
          <h4>Momentum</h4>
          <MomentumLadder row={row} />
        </div>
      </div>
    </div>
  );
}

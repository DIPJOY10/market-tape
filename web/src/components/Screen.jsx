import React, { useEffect, useMemo, useRef, useState } from "react";
import { ROWS, SECTORS } from "../data.js";
import { fmtCap, fmtMoney, fmtNum, fmtPct, signClass, recLabel, DASH } from "../format.js";
import { StarButton } from "./Viz.jsx";
import RowDetail from "./RowDetail.jsx";

const COLS = [
  { k: "star", l: "", sortable: false },
  { k: "t", l: "Ticker", type: "s" },
  { k: "mc", l: "Cap" },
  { k: "px", l: "Price" },
  { k: "tgt", l: "Target" },
  { k: "up", l: "Upside" },
  { k: "rec", l: "Consensus" },
  { k: "st", l: "Short term" },
  { k: "lt", l: "Long term" },
  { k: "fpe", l: "Fwd P/E" },
  { k: "rg", l: "Rev gth" },
  { k: "roic", l: "ROIC" },
  { k: "d2", l: "2D" },
  { k: "w1", l: "1W" },
  { k: "m1", l: "1M" },
  { k: "m3", l: "3M" },
  { k: "up_c", l: "Upg/Dng" },
];

const TIER_CHIPS = [["", "All"], ["Mega", "Mega"], ["Large", "Large"],
                    ["Mid", "Mid"], ["Small", "Small"]];

export default function Screen({ focus, onFocusDone, onChart, wl }) {
  const [q, setQ] = useState("");
  const [tier, setTier] = useState("");
  const [sector, setSector] = useState("");
  const [aiOnly, setAiOnly] = useState(false);
  const [profOnly, setProfOnly] = useState(false);
  const [watchOnly, setWatchOnly] = useState(false);
  const [sort, setSort] = useState({ k: "sc", dir: -1 });
  const [open, setOpen] = useState(null);
  const tableRef = useRef(null);

  // Arriving from a ticker link elsewhere: clear the filters, reveal that row.
  useEffect(() => {
    if (!focus) return;
    setQ(focus); setTier(""); setSector("");
    setAiOnly(false); setProfOnly(false); setWatchOnly(false);
    setOpen(focus);
    onFocusDone();
    requestAnimationFrame(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [focus, onFocusDone]);

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = ROWS.filter((r) => {
      if (tier && r.tier !== tier) return false;
      if (sector && r.sec !== sector) return false;
      if (aiOnly && !r.ai) return false;
      if (profOnly && !(r.fpe > 0)) return false;
      if (watchOnly && !wl.has(r.t)) return false;
      if (needle) {
        const hay = `${r.t} ${r.n} ${r.ind || ""} ${r.sec || ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const { k, dir } = sort;
    out.sort((a, b) => {
      if (k === "t") return dir * String(a.t).localeCompare(String(b.t));
      const x = a[k], y = b[k];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return dir * (x - y);
    });
    return out;
  }, [q, tier, sector, aiOnly, profOnly, watchOnly, sort, wl]);

  const clickHead = (c) => {
    if (c.sortable === false) return;
    setSort((s) => s.k === c.k
      ? { k: c.k, dir: -s.dir }
      : { k: c.k, dir: c.type === "s" ? 1 : -1 });
  };

  return (
    <section>
      <div className="shead">
        <h2>The screen</h2>
        <p>Sort any column. Click a row to expand it.</p>
      </div>

      <div className="tools">
        <div className="trow">
          <input type="search" id="q" value={q} placeholder="Search ticker, company, industry"
                 aria-label="Search" onChange={(e) => { setQ(e.target.value); setOpen(null); }} />
          <div className="chips" role="group" aria-label="Market cap tier">
            {TIER_CHIPS.map(([val, label]) => (
              <button key={label} className="chip" aria-pressed={tier === val}
                      onClick={() => { setTier(val); setOpen(null); }}>{label}</button>
            ))}
          </div>
          <select aria-label="Sector" value={sector}
                  onChange={(e) => { setSector(e.target.value); setOpen(null); }}>
            <option value="">All sectors</option>
            {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="tgl" aria-pressed={aiOnly}
                  onClick={() => setAiOnly((v) => !v)}>AI-linked only</button>
          <button className="tgl" aria-pressed={profOnly}
                  onClick={() => setProfOnly((v) => !v)}>Profitable only</button>
          <button className="tgl" aria-pressed={watchOnly}
                  onClick={() => setWatchOnly((v) => !v)}>
            Watchlist only{wl.items.length ? ` (${wl.items.length})` : ""}
          </button>
          <span className="count">{view.length} of {ROWS.length} shown</span>
        </div>
      </div>

      <div className="tbl-wrap" ref={tableRef}>
        <table id="main">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.k} className={c.sortable === false ? "" : "s"}
                    tabIndex={c.sortable === false ? -1 : 0}
                    data-dir={sort.k === c.k ? sort.dir : undefined}
                    onClick={() => clickHead(c)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clickHead(c); }
                    }}>
                  {c.l}{c.sortable !== false && (
                    <span className="ar">{sort.k === c.k && sort.dir === 1 ? "▲" : "▼"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => {
              const rec = recLabel(r.rec);
              const isOpen = open === r.t;
              return (
                <React.Fragment key={r.t}>
                  <tr className={isOpen ? "open" : undefined}
                      onClick={() => setOpen(isOpen ? null : r.t)}>
                    <td><StarButton ticker={r.t} wl={wl} /></td>
                    <td>
                      <span className="tk">{r.t}</span>
                      <span className="co">{r.n}</span>
                    </td>
                    <td className="num">{fmtCap(r.mc)}</td>
                    <td className="num">{fmtMoney(r.px)}</td>
                    <td className="num">{fmtMoney(r.tgt)}</td>
                    <td className={"num " + signClass(r.up)}>{fmtPct(r.up)}</td>
                    <td>
                      <span className={"rt " + rec.cls}>{rec.text}</span>{" "}
                      <span className="num" style={{ color: "var(--faint)" }}>{r.na || 0}</span>
                    </td>
                    <td><span className={"pill p-" + r.stL}>{r.stL}</span></td>
                    <td><span className={"pill p-" + r.ltL}>{r.ltL}</span></td>
                    <td className="num">{fmtNum(r.fpe, 1, "×")}</td>
                    <td className={"num " + signClass(r.rg)}>{fmtPct(r.rg)}</td>
                    <td className="num">{fmtNum(r.roic, 1, "%")}</td>
                    <td className={"num " + signClass(r.d2)}>{fmtPct(r.d2)}</td>
                    <td className={"num " + signClass(r.w1)}>{fmtPct(r.w1)}</td>
                    <td className={"num " + signClass(r.m1)}>{fmtPct(r.m1)}</td>
                    <td className={"num " + signClass(r.m3)}>{fmtPct(r.m3)}</td>
                    <td className="ud">
                      {r.up_c || r.dn_c ? (
                        <>
                          <span className="up">{r.up_c}</span>
                          <span style={{ color: "var(--faint)" }}>/</span>
                          <span className="dn">{r.dn_c}</span>
                        </>
                      ) : <span style={{ color: "var(--faint)" }}>{DASH}</span>}
                    </td>
                  </tr>
                  {isOpen && (
                    <RowDetail row={r} colSpan={COLS.length} onChart={onChart}
                               onJump={(t) => { setQ(t); setOpen(t); }} />
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

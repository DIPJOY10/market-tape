import React, { useMemo, useState } from "react";
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

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const active = wl.lists.find((l) => l.id === wl.activeId);

  const submitNew = async (e) => {
    e.preventDefault();
    const res = await wl.createList(draft);
    if (res && res.error) { setErr(res.error); return; }
    setDraft(""); setErr(""); setCreating(false);
  };

  const rename = async () => {
    const next = prompt("Rename this list", active ? active.name : "");
    if (next == null) return;
    const res = await wl.renameList(wl.activeId, next);
    if (res && res.error) setErr(res.error);
  };

  const drop = async () => {
    if (!active) return;
    if (!confirm("Delete \"" + active.name + "\" and everything on it?")) return;
    const res = await wl.deleteList(wl.activeId);
    if (res && res.error) setErr(res.error);
  };

  return (
    <section>
      <div className="shead">
        <h2>Watchlists</h2>
        <p>Star any name on the screen and it lands on the list you have open,
           with what it has done since you added it.</p>
      </div>

      <div className="wl-bar">
        <div className="wl-pills" role="tablist" aria-label="Watchlists">
          {wl.lists.map((l) => (
            <button key={l.id} className="wl-pill" role="tab"
                    aria-selected={l.id === wl.activeId}
                    onClick={() => wl.setActive(l.id)}>
              {l.name}
              <span className="ct">
                {l.id === wl.activeId ? wl.items.length : (l.count ?? 0)}
              </span>
            </button>
          ))}
        </div>
        {creating ? (
          <form className="wl-new" onSubmit={submitNew}>
            <input autoFocus value={draft} maxLength={60} placeholder="List name"
                   aria-label="New list name"
                   onChange={(e) => { setDraft(e.target.value); setErr(""); }} />
            <button className="btn" type="submit">Create</button>
            <button className="btn" type="button"
                    onClick={() => { setCreating(false); setDraft(""); setErr(""); }}>
              Cancel
            </button>
          </form>
        ) : (
          <div className="wl-actions">
            <button className="btn" onClick={() => setCreating(true)}>+ New list</button>
            {active && <button className="btn" onClick={rename}>Rename</button>}
            {wl.lists.length > 1 && (
              <button className="btn danger" onClick={drop}>Delete list</button>
            )}
          </div>
        )}
      </div>

      {err && <p className="wl-err">{err}</p>}

      {wl.mode === "browser" && (
        <p className="wl-warn">
          These lists are stored in this browser only, and clearing site data will erase
          them. Open Market Tape with <code>python3 serve.py</code> to keep them saved
          on your machine.
        </p>
      )}

      {totals && (
        <div className="wl-head">
          <span className="since" style={{ marginLeft: "auto", color: "var(--muted)" }}>
            {totals.n} tracked &middot; {totals.winners} up &middot; average{" "}
            <b className={signClass(totals.avg)}>{fmtPct(totals.avg)}</b> since added
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="wl-empty">
          <p className="big">Nothing on {active ? active.name : "this list"} yet</p>
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

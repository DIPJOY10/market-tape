import { useCallback, useEffect, useState } from "react";

// Two storage backends, chosen at runtime:
//   sqlite  - serve.py is running, rows live in watchlist.db on disk
//   browser - opened from file:// or published as an Artifact; localStorage only
// The API is probed once; everything below works the same either way.

const KEY = "mt.watchlist.v1";

async function probe() {
  try {
    const r = await fetch("/api/health", { method: "GET" });
    if (!r.ok) return false;
    const j = await r.json();
    return j.ok === true;
  } catch {
    return false;
  }
}

function localRead() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function localWrite(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* private window, blocked storage - the list simply does not persist */
  }
}

export function useWatchlist(rows) {
  const [mode, setMode] = useState("loading");
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const hasApi = await probe();
      if (!alive) return;
      if (hasApi) {
        try {
          const r = await fetch("/api/watchlist");
          const j = await r.json();
          if (!alive) return;
          setItems(j.items || []);
          setMode("sqlite");
          return;
        } catch {
          /* fall through to browser storage */
        }
      }
      if (!alive) return;
      setItems(localRead());
      setMode("browser");
    })();
    return () => { alive = false; };
  }, []);

  const add = useCallback(async (ticker, note = "") => {
    const row = rows.find((r) => r.t === ticker);
    const entry = {
      ticker,
      note,
      added_at: new Date().toISOString(),
      added_price: row ? row.px : null,
    };
    setItems((prev) => (prev.some((i) => i.ticker === ticker) ? prev : [...prev, entry]));
    if (mode === "sqlite") {
      try {
        await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
      } catch { /* keep the optimistic entry; next load reconciles */ }
    } else {
      const next = localRead();
      if (!next.some((i) => i.ticker === ticker)) localWrite([...next, entry]);
    }
  }, [mode, rows]);

  const remove = useCallback(async (ticker) => {
    setItems((prev) => prev.filter((i) => i.ticker !== ticker));
    if (mode === "sqlite") {
      try {
        await fetch("/api/watchlist/" + encodeURIComponent(ticker), { method: "DELETE" });
      } catch { /* optimistic */ }
    } else {
      localWrite(localRead().filter((i) => i.ticker !== ticker));
    }
  }, [mode]);

  const setNote = useCallback(async (ticker, note) => {
    setItems((prev) => prev.map((i) => (i.ticker === ticker ? { ...i, note } : i)));
    if (mode === "sqlite") {
      try {
        await fetch("/api/watchlist/" + encodeURIComponent(ticker), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        });
      } catch { /* optimistic */ }
    } else {
      localWrite(localRead().map((i) => (i.ticker === ticker ? { ...i, note } : i)));
    }
  }, [mode]);

  const has = useCallback((t) => items.some((i) => i.ticker === t), [items]);

  return { mode, items, add, remove, setNote, has };
}

import { useCallback, useEffect, useMemo, useState } from "react";

// Two storage backends, chosen at runtime:
//   disk    - serve.py is running; lists and names live in watchlist.db
//   browser - opened from file:// or published as an Artifact; localStorage only
// Everything below works the same either way.

const KEY = "mt.watchlist.v2";
const ACTIVE_KEY = "mt.watchlist.active";
const DEFAULT_LIST = "My watchlist";

async function probe() {
  try {
    const r = await fetch("/api/health");
    return r.ok && (await r.json()).ok === true;
  } catch {
    return false;
  }
}

function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && raw.lists && raw.lists.length) return raw;
  } catch { /* fall through to a fresh store */ }
  return {
    lists: [{ id: 1, name: DEFAULT_LIST, created_at: new Date().toISOString() }],
    items: { 1: [] },
  };
}

function writeLocal(store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch { /* private window or blocked storage: it simply will not persist */ }
}

export function useWatchlist(rows) {
  const [mode, setMode] = useState("loading");
  const [lists, setLists] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [byList, setByList] = useState({});

  const remember = (id) => {
    try { localStorage.setItem(ACTIVE_KEY, String(id)); } catch { /* optional */ }
  };

  // ---------------------------------------------------------------- bootstrap
  useEffect(() => {
    let alive = true;
    (async () => {
      const onDisk = await probe();
      if (!alive) return;

      let remembered = null;
      try { remembered = localStorage.getItem(ACTIVE_KEY); } catch { /* optional */ }

      if (onDisk) {
        try {
          const ls = (await (await fetch("/api/lists")).json()).lists || [];
          const pick = ls.find((l) => String(l.id) === remembered) || ls[0];
          const items = pick
            ? (await (await fetch("/api/watchlist/" + pick.id)).json()).items || []
            : [];
          if (!alive) return;
          setLists(ls);
          setActiveId(pick ? pick.id : null);
          setByList(pick ? { [pick.id]: items } : {});
          setMode("disk");
          return;
        } catch { /* fall through to browser storage */ }
      }
      if (!alive) return;
      const store = readLocal();
      const pick = store.lists.find((l) => String(l.id) === remembered) || store.lists[0];
      setLists(store.lists);
      setActiveId(pick.id);
      setByList(store.items);
      setMode("browser");
    })();
    return () => { alive = false; };
  }, []);

  const items = useMemo(() => byList[activeId] || [], [byList, activeId]);

  const loadList = useCallback(async (id) => {
    if (mode === "disk" && !byList[id]) {
      try {
        const j = await (await fetch("/api/watchlist/" + id)).json();
        setByList((p) => ({ ...p, [id]: j.items || [] }));
      } catch { setByList((p) => ({ ...p, [id]: [] })); }
    }
  }, [mode, byList]);

  const setActive = useCallback((id) => {
    setActiveId(id);
    remember(id);
    loadList(id);
  }, [loadList]);

  const syncLocal = useCallback((nextLists, nextItems) => {
    if (mode === "browser") writeLocal({ lists: nextLists, items: nextItems });
  }, [mode]);

  // ------------------------------------------------------------------ entries
  const add = useCallback(async (ticker, note = "") => {
    if (!activeId) return;
    const row = rows.find((r) => r.t === ticker);
    const entry = {
      ticker, note,
      added_at: new Date().toISOString(),
      added_price: row ? row.px : null,
    };
    let nextItems;
    setByList((prev) => {
      const cur = prev[activeId] || [];
      if (cur.some((i) => i.ticker === ticker)) { nextItems = prev; return prev; }
      nextItems = { ...prev, [activeId]: [...cur, entry] };
      return nextItems;
    });
    setLists((prev) => prev.map((l) =>
      l.id === activeId ? { ...l, count: (l.count || 0) + 1 } : l));

    if (mode === "disk") {
      try {
        await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...entry, list_id: activeId }),
        });
      } catch { /* optimistic; next load reconciles */ }
    } else {
      const store = readLocal();
      const cur = store.items[activeId] || [];
      if (!cur.some((i) => i.ticker === ticker)) {
        store.items[activeId] = [...cur, entry];
        writeLocal(store);
      }
    }
  }, [activeId, mode, rows]);

  const remove = useCallback(async (ticker) => {
    if (!activeId) return;
    setByList((prev) => ({
      ...prev,
      [activeId]: (prev[activeId] || []).filter((i) => i.ticker !== ticker),
    }));
    setLists((prev) => prev.map((l) =>
      l.id === activeId ? { ...l, count: Math.max(0, (l.count || 1) - 1) } : l));

    if (mode === "disk") {
      try {
        await fetch(`/api/watchlist/${activeId}/${encodeURIComponent(ticker)}`,
                    { method: "DELETE" });
      } catch { /* optimistic */ }
    } else {
      const store = readLocal();
      store.items[activeId] = (store.items[activeId] || [])
        .filter((i) => i.ticker !== ticker);
      writeLocal(store);
    }
  }, [activeId, mode]);

  const setNote = useCallback(async (ticker, note) => {
    if (!activeId) return;
    setByList((prev) => ({
      ...prev,
      [activeId]: (prev[activeId] || []).map((i) =>
        i.ticker === ticker ? { ...i, note } : i),
    }));
    if (mode === "disk") {
      try {
        await fetch(`/api/watchlist/${activeId}/${encodeURIComponent(ticker)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        });
      } catch { /* optimistic */ }
    } else {
      const store = readLocal();
      store.items[activeId] = (store.items[activeId] || []).map((i) =>
        i.ticker === ticker ? { ...i, note } : i);
      writeLocal(store);
    }
  }, [activeId, mode]);

  // -------------------------------------------------------------------- lists
  const createList = useCallback(async (name) => {
    const clean = (name || "").trim().slice(0, 60);
    if (!clean) return { error: "Give the list a name." };
    if (lists.some((l) => l.name.toLowerCase() === clean.toLowerCase())) {
      return { error: "You already have a list called that." };
    }
    if (mode === "disk") {
      try {
        const r = await fetch("/api/lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: clean }),
        });
        const j = await r.json();
        if (!r.ok) return { error: j.error || "Could not create that list." };
        const entry = { id: j.id, name: clean, count: 0 };
        setLists((p) => [...p, entry]);
        setByList((p) => ({ ...p, [j.id]: [] }));
        setActiveId(j.id); remember(j.id);
        return { ok: true };
      } catch {
        return { error: "Could not reach the local server." };
      }
    }
    const store = readLocal();
    const id = Math.max(0, ...store.lists.map((l) => l.id)) + 1;
    store.lists.push({ id, name: clean, created_at: new Date().toISOString() });
    store.items[id] = [];
    writeLocal(store);
    setLists(store.lists); setByList(store.items);
    setActiveId(id); remember(id);
    return { ok: true };
  }, [lists, mode]);

  const renameList = useCallback(async (id, name) => {
    const clean = (name || "").trim().slice(0, 60);
    if (!clean) return { error: "Give the list a name." };
    setLists((p) => p.map((l) => (l.id === id ? { ...l, name: clean } : l)));
    if (mode === "disk") {
      try {
        await fetch("/api/lists/" + id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: clean }),
        });
      } catch { /* optimistic */ }
    } else {
      const store = readLocal();
      store.lists = store.lists.map((l) => (l.id === id ? { ...l, name: clean } : l));
      writeLocal(store);
    }
    return { ok: true };
  }, [mode]);

  const deleteList = useCallback(async (id) => {
    if (lists.length <= 1) return { error: "Keep at least one list." };
    const rest = lists.filter((l) => l.id !== id);
    setLists(rest);
    setByList((p) => { const n = { ...p }; delete n[id]; return n; });
    if (activeId === id) { setActiveId(rest[0].id); remember(rest[0].id); loadList(rest[0].id); }
    if (mode === "disk") {
      try { await fetch("/api/lists/" + id, { method: "DELETE" }); }
      catch { /* optimistic */ }
    } else {
      const store = readLocal();
      store.lists = store.lists.filter((l) => l.id !== id);
      delete store.items[id];
      writeLocal(store);
    }
    return { ok: true };
  }, [lists, activeId, mode, loadList]);

  const has = useCallback((t) => items.some((i) => i.ticker === t), [items]);

  return { mode, lists, activeId, setActive, items, add, remove, setNote, has,
           createList, renameList, deleteList };
}

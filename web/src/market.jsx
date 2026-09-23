import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { EMBEDDED, DEFAULT_TIERS } from "./data.js";
import { setLocale } from "./format.js";

const Ctx = createContext(null);

export function useMarket() {
  return useContext(Ctx);
}

export function MarketProvider({ children }) {
  // Start on whatever the build shipped with, so the page works with no server
  // and as a published Artifact.
  const [data, setData] = useState(EMBEDDED);
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState("");
  const cache = useMemo(() => new Map(), []);

  const code = data.meta.market || "us";

  // Which other markets have been pulled? Only the local server knows.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/markets");
        if (!r.ok) return;
        const j = await r.json();
        if (alive && j.markets && j.markets.length > 1) setMarkets(j.markets);
      } catch { /* no server: the switcher stays hidden */ }
    })();
    return () => { alive = false; };
  }, []);

  const switchTo = useCallback(async (next) => {
    if (next === code || loading) return;
    if (cache.has(next)) { setData(cache.get(next)); setError(""); return; }
    setLoading(next);
    setError("");
    try {
      const r = await fetch(`/api/data/${next}/all`);
      if (!r.ok) throw new Error((await r.json()).error || "could not load that market");
      const payload = await r.json();
      cache.set(next, payload);
      setData(payload);
    } catch (e) {
      setError(e.message || "Could not load that market.");
    } finally {
      setLoading(null);
    }
  }, [code, loading, cache]);

  // Currency and units are read by the formatters, which are called all over the
  // tree. Set them during render so children format in the right currency on the
  // very first paint after a switch, not one frame later.
  setLocale({
    symbol: data.meta.symbol || "$",
    capUnits: data.meta.capUnits || "western",
  });

  const value = useMemo(() => ({
    ...data,
    code,
    markets,
    loading,
    error,
    switchTo,
    byTicker: new Map(data.rows.map((r) => [r.t, r])),
    sectors: [...new Set(data.rows.map((r) => r.sec).filter(Boolean))].sort(),
    tiers: data.meta.tiers && data.meta.tiers.length ? data.meta.tiers : DEFAULT_TIERS,
    label: data.meta.marketLabel || "United States",
  }), [data, code, markets, loading, error, switchTo]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MarketProvider, useMarket } from "./market.jsx";
import { useWatchlist } from "./watchlist.js";
import Header from "./components/Header.jsx";
import Tabs from "./components/Tabs.jsx";
import Overview from "./components/Overview.jsx";
import Screen from "./components/Screen.jsx";
import Watchlist from "./components/Watchlist.jsx";
import Sectors from "./components/Sectors.jsx";
import Notes from "./components/Notes.jsx";
import ChartModal from "./components/ChartModal.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

const TABS = [
  ["overview", "Overview"],
  ["screen", "The screen"],
  ["watchlist", "Watchlist"],
  ["sectors", "Sectors"],
  ["notes", "Notes"],
];

function tabFromHash() {
  const h = (location.hash || "").replace(/^#\/?/, "");
  return TABS.some(([id]) => id === h) ? h : "overview";
}

function Shell() {
  const [tab, setTab] = useState(tabFromHash);
  const [chartTicker, setChartTicker] = useState(null);
  const [focus, setFocus] = useState(null);          // ticker to reveal on the screen
  const { rows, code } = useMarket();
  const wl = useWatchlist(rows);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const go = useCallback((id) => {
    location.hash = "/" + id;
    setTab(id);
    scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Jumping to a ticker from anywhere lands on the screen with that row open.
  const jump = useCallback((ticker) => {
    setFocus(ticker);
    go("screen");
  }, [go]);

  const counts = useMemo(() => ({ watchlist: wl.items.length }), [wl.items.length]);

  return (
    <>
      <Header />
      <Tabs tabs={TABS} active={tab} onChange={go} counts={counts} />
      <div className="wrap">
        <ErrorBoundary label="This tab" resetKey={tab + code}>
        {tab === "overview" && (
          <Overview onJump={jump} onChart={setChartTicker} wl={wl} />
        )}
        {tab === "screen" && (
          <Screen key={code} focus={focus} onFocusDone={() => setFocus(null)}
                  onChart={setChartTicker} wl={wl} />
        )}
        {tab === "watchlist" && (
          <Watchlist wl={wl} onJump={jump} onChart={setChartTicker} />
        )}
        {tab === "sectors" && <Sectors />}
        {tab === "notes" && <Notes />}
        </ErrorBoundary>
        <footer>
          <p className="src">
            <strong>Data</strong> TradingView &mdash; fundamentals, consensus estimates and
            price targets &middot; Yahoo Finance &mdash; daily price history. Fundamentals are
            trailing twelve months unless marked forward. Rating actions are parsed from
            headlines over the trailing three weeks.
          </p>
          <p className="src">
            <strong>Method</strong> Value, quality and growth are percentile ranks &mdash;
            value within sector, quality and growth across the universe. Short term blends
            1W/1M/3M momentum, analyst sentiment and RSI; long term blends quality, growth,
            valuation and leverage.
          </p>
          <p className="fine">For research purposes. Not investment advice.</p>
        </footer>
      </div>
      {chartTicker && (
        <ErrorBoundary label="The chart" resetKey={chartTicker}
                       onDismiss={() => setChartTicker(null)}>
          <ChartModal ticker={chartTicker} onClose={() => setChartTicker(null)} wl={wl} />
        </ErrorBoundary>
      )}
    </>
  );
}

export default function App() {
  return (
    <MarketProvider>
      <Shell />
    </MarketProvider>
  );
}

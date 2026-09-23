import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ROWS, META } from "./data.js";
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

export default function App() {
  const [tab, setTab] = useState(tabFromHash);
  const [chartTicker, setChartTicker] = useState(null);
  const [focus, setFocus] = useState(null);          // ticker to reveal on the screen
  const wl = useWatchlist(ROWS);

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
      <Header meta={META} />
      <Tabs tabs={TABS} active={tab} onChange={go} counts={counts} />
      <div className="wrap">
        <ErrorBoundary label="This tab" resetKey={tab}>
        {tab === "overview" && (
          <Overview onJump={jump} onChart={setChartTicker} wl={wl} />
        )}
        {tab === "screen" && (
          <Screen focus={focus} onFocusDone={() => setFocus(null)}
                  onChart={setChartTicker} wl={wl} />
        )}
        {tab === "watchlist" && (
          <Watchlist wl={wl} onJump={jump} onChart={setChartTicker} />
        )}
        {tab === "sectors" && <Sectors />}
        {tab === "notes" && <Notes meta={META} />}
        </ErrorBoundary>
        <footer>
          <p><strong>Source &amp; timing.</strong> TradingView's live scanner for fundamentals,
            prices, targets and consensus ratings; Yahoo's chart endpoint for daily price
            history. Fundamentals are trailing twelve months unless labelled forward. Rating
            actions are parsed from headline text over roughly the trailing three weeks and
            are a sample, not a complete record.</p>
          <p><strong>Scoring.</strong> Value, quality and growth are percentile ranks &mdash;
            value within sector, quality and growth across the whole universe. These are
            descriptive rankings of published numbers, not forecasts.</p>
          <p><strong>This is not investment advice.</strong> Nothing here is a recommendation
            to buy or sell any security. &ldquo;Undervalued&rdquo; means cheap against peers
            and its own fundamentals on these metrics &mdash; a different claim from
            &ldquo;will go up&rdquo;. Stocks that screen cheap are usually cheap for reasons a
            lot of informed people believe in.</p>
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

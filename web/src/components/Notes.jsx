import React from "react";

// Hand-written commentary. It does NOT regenerate on refresh - the date stamp is the
// honest signal. Rewrite or delete these when the tape has moved.
const WRITTEN = "18 Sep 2026";

const THEMES = [
  ["01", "Hard assets are beating AI",
   "Energy Minerals lead every sector YTD on a single-digit forward multiple, with crude well off its lows and gold near records. Gold miners are close behind."],
  ["02", "AI split into two opposite trades",
   "Electronic Technology (chips, hardware) and Technology Services (software) moved in opposite directions over three months. One sell-side note put it plainly: the hardware-versus-software trade has been turned on its head."],
  ["03", "A memory supercycle inside the selloff",
   "Micron and Sandisk posted triple-digit revenue growth while trading at single-digit to low-teens forward earnings — the classic signature of peak cyclical profits."],
  ["04", "Rates are hiking, not cutting",
   "The Fed raised 25bp to 3.75–4.00% with CPI above target. The front end repriced hard. That is a rising discount rate against every long-duration growth story."],
  ["05", "Breadth is thin",
   "The index sat near highs while the median $2B+ stock fell over the past month in most sectors. VIX in the mid-teens was not pricing that."],
  ["06", "Value sits in insurance and energy",
   "Finance and Energy Minerals trade at roughly half the forward multiple of Electronic Technology. Reinsurers and specialty insurers screen well against rate hikes."],
];

const CAVEATS = [
  ["A low P/E on peak cyclical earnings is not cheap",
   "Memory and storage, and refiners and tankers, screen at 5–13× forward after enormous revenue growth. Those multiples are the market saying the earnings do not persist."],
  ["Trailing P/E can be flattered by one-off gains",
   "Alphabet's trailing net income has run well above its operating income on non-operating gains. Check the P/E against operating margin before believing a cheap headline multiple."],
  ["The AI capex bill lands in earnings later",
   "Meta grew revenue strongly while diluted EPS fell, as capex flows into depreciation. Oracle has carried negative free cash flow against a large backlog. Expect this to widen across hyperscalers."],
  ["Price targets are the sell side's opinion, not a forecast",
   "Consensus targets here imply large upside on dozens of names. In a tape where the median stock is falling, that usually means targets are stale rather than that returns are free."],
];

export default function Notes() {
  return (
    <>
      <section>
        <div className="shead">
          <h2>What is actually driving this market</h2>
          <p>The AI trade is no longer the whole story.</p>
          <span className="stale">
            commentary written {WRITTEN} &mdash; every table in this app is live

          </span>
        </div>
        <div className="themes">
          {THEMES.map(([n, h, p]) => (
            <div className="th" key={n}>
              <div className="n">{n}</div>
              <h3>{h}</h3>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="shead"><h2>Read the numbers with these caveats</h2></div>
        {CAVEATS.map(([h, p]) => (
          <div className="note" key={h}>
            <h3>{h}</h3>
            <p>{p}</p>
          </div>
        ))}
      </section>
    </>
  );
}

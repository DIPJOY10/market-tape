// Series maths for the price charts. The pipeline ships closes as integers
// normalised against the real bounds, so prices rebuild exactly here.

export const RANGES = [
  ["1M", 22], ["3M", 63], ["6M", 126], ["YTD", "ytd"], ["1Y", 252], ["5Y", "w"],
];

export function unpack(p) {
  const span = p.hi - p.lo;
  const sc = p.s || 1000;
  return p.v.map((u) => p.lo + (u / sc) * span);
}

export function unpackT(p) {
  if (p.o) return p.o.map((d) => (p.t0 + d * 86400) * 1000);
  const n = p.v.length;
  const step = (p.t1 - p.t0) / (n - 1 || 1);
  return p.v.map((_, i) => (p.t0 + step * i) * 1000);
}

// Trailing mean; null until enough points exist, so the line simply starts later.
export function rollMean(a, k) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i];
    if (i >= k) sum -= a[i - k];
    out.push(i >= k - 1 ? sum / k : null);
  }
  return out;
}

export function maLabel(range, slow) {
  if (range === "5Y") return slow ? "40w" : "10w";
  return slow ? "200d" : "50d";
}

// Returns {px, ts, ma50, ma200, key} for one range, or null when there is no series.
// Averages are computed over the whole stored series and sliced alongside the prices,
// so a 1M view still shows a true 200-day mean rather than starting from blank.
export function sliceRange(ch, key) {
  if (!ch) return null;
  const weekly = key === "5Y";
  const src = weekly ? ch.w : ch.d;
  if (!src || !src.v || src.v.length < 5) return null;

  const px = unpack(src);
  const ts = unpackT(src);
  const ma50 = rollMean(px, weekly ? 10 : 50);
  const ma200 = rollMean(px, weekly ? 40 : 200);

  let from = 0;
  if (key === "YTD") {
    from = Math.min(ch.yi || 0, Math.max(0, px.length - 2));
  } else if (!weekly && key !== "1Y") {
    const want = (RANGES.find((r) => r[0] === key) || [null, px.length])[1];
    from = Math.max(0, px.length - want);
  }

  return {
    key,
    px: px.slice(from),
    ts: ts.slice(from),
    ma50: ma50.slice(from),
    ma200: ma200.slice(from),
  };
}

// Vertical bounds covering the price line and whichever averages are on screen.
export function bounds(d) {
  const sets = [d.px];
  for (const m of [d.ma50, d.ma200]) {
    const vals = m.filter((v) => v != null);
    if (vals.length > 2) sets.push(vals);
  }
  const rawLo = Math.min(...sets.map((a) => Math.min(...a)));
  const hi = Math.max(...sets.map((a) => Math.max(...a)));
  const pad = (hi - rawLo) * 0.08 || 1;
  // Across a long range the padding can push the floor below zero, which would
  // print a negative price on the axis. A share price never is.
  const lo = rawLo >= 0 ? Math.max(0, rawLo - pad) : rawLo - pad;
  return { lo, hi: hi + pad };
}

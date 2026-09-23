import { CURRENCY, CAP_UNITS } from "./data.js";

export const DASH = "–";

export function num(x) {
  return typeof x === "number" && isFinite(x) ? x : null;
}

export function fmtP(x) {
  if (num(x) === null) return DASH;
  return CURRENCY + (Math.abs(x) >= 100
    ? x.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : x.toFixed(2));
}

export function fmtMoney(x) {
  if (num(x) === null) return DASH;
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtCap(x) {
  if (!x) return DASH;
  if (CAP_UNITS === "indian") {
    // What the market itself quotes: 1 crore = 1e7, 1 lakh crore = 1e12.
    if (x >= 1e12) return (x / 1e12).toFixed(2) + "L Cr";
    if (x >= 1e7) return Math.round(x / 1e7).toLocaleString() + " Cr";
    return Math.round(x / 1e5).toLocaleString() + " L";
  }
  if (x >= 1e12) return (x / 1e12).toFixed(2) + "T";
  if (x >= 1e9) return (x / 1e9).toFixed(0) + "B";
  return (x / 1e6).toFixed(0) + "M";
}

export function fmtNum(x, p = 1, suffix = "") {
  if (num(x) === null) return DASH;
  return x.toFixed(p) + suffix;
}

export function fmtPct(x, p = 1) {
  if (num(x) === null) return DASH;
  return (x > 0 ? "+" : "") + x.toFixed(p) + "%";
}

export function signClass(x) {
  if (num(x) === null) return "fl";
  return x > 0 ? "up" : x < 0 ? "dn" : "fl";
}

export function fmtDate(ms, long) {
  return new Date(ms).toLocaleDateString(undefined, long
    ? { year: "numeric", month: "short", day: "numeric" }
    : { month: "short", day: "numeric" });
}

export function recLabel(m) {
  if (num(m) === null) return { text: DASH, cls: "fl" };
  if (m < 1.5) return { text: "Strong Buy", cls: "up" };
  if (m < 2.5) return { text: "Buy", cls: "up" };
  if (m < 3.5) return { text: "Hold", cls: "fl" };
  if (m < 4.5) return { text: "Sell", cls: "dn" };
  return { text: "Strong Sell", cls: "dn" };
}

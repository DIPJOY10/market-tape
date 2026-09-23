// The pipeline injects the active market's payload as inert JSON script tags.
// Other markets are fetched from the local server at runtime, if one is running.
function readJSON(id, fallback) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  try {
    const txt = el.textContent.trim();
    if (!txt || txt.startsWith("__")) return fallback;   // placeholder, never filled
    return JSON.parse(txt);
  } catch {
    return fallback;
  }
}

export const EMBEDDED = {
  rows: readJSON("mt-rows", []),
  tape: readJSON("mt-tape", []),
  sect: readJSON("mt-sect", []),
  meta: readJSON("mt-meta", {}),
};

export const DEFAULT_TIERS = [
  ["Mega", ">$200B"], ["Large", "$10-200B"], ["Mid", "$2-10B"], ["Small", "<$2B"],
];

// Shared gate for "top picks": profitable, covered, not over-levered.
export function eligible(r) {
  const minA = r.tier === "Mega" || r.tier === "Large" ? 8 : 5;
  if ((r.na || 0) < minA) return false;
  if (!(r.fpe > 0 && r.fpe <= 60)) return false;
  if (!(r.pe > 0)) return false;
  if (r.de != null && r.de > 3) return false;
  return r.up != null;
}

export const covered = (r) => (r.na || 0) >= 8;

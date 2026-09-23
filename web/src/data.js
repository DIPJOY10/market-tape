// The pipeline injects these as inert JSON script tags at build-data time.
function readJSON(id, fallback) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  try {
    const txt = el.textContent.trim();
    if (!txt || txt.startsWith("__")) return fallback;  // placeholder, never filled
    return JSON.parse(txt);
  } catch {
    return fallback;
  }
}

export const ROWS = readJSON("mt-rows", []);
export const TAPE = readJSON("mt-tape", []);
export const SECT = readJSON("mt-sect", []);
export const META = readJSON("mt-meta", {});

export const byTicker = new Map(ROWS.map((r) => [r.t, r]));

export const SECTORS = [...new Set(ROWS.map((r) => r.sec).filter(Boolean))].sort();

export const TIERS = [
  ["Mega", ">$200B"], ["Large", "$10–200B"], ["Mid", "$2–10B"], ["Small", "<$2B"],
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

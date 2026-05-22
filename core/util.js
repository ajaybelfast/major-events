// ============================================================
//  UTIL — small shared helpers
// ============================================================

// User-readable date string, e.g. "20 May 2026". Accepts a YYYY-MM-DD
// string or a Date.
export function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Today's date as a YYYY-MM-DD string in the user's LOCAL timezone.
// `new Date().toISOString()` returns the UTC date, which can be off-by-one
// in non-UTC timezones — e.g. at 9am local in AU, ISO date is still the
// previous calendar day. Use this for any comparison against YYYY-MM-DD
// values stored in the sheet (which represent local calendar dates).
export function todayLocalStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Parse a YYYY-MM-DD string as local midnight (not UTC) so date comparisons
// against locally-constructed dates (weekStart, monthStart, etc.) are
// correct. Returns Date(NaN) for empty / falsy input.
export function parseLocalDate(str) {
  if (!str) return new Date(NaN);
  const [y, m, d] = str.split('-');
  return new Date(+y, +m - 1, +d);
}

// Returns a hex colour for a sport category. If the category is missing
// from SPORT_COLORS (e.g. a sport added to the sheet that we haven't
// hand-picked a colour for yet), assigns one from a 10-colour fallback
// palette in round-robin order and caches it back into SPORT_COLORS so
// the same sport keeps the same colour for the rest of the session.
// `SPORT_COLORS` is a global from lookups.js.
const _fallbackColors = ['#FF9F43','#EE5A24','#C4E538','#009432','#0652DD','#9980FA','#ED4C67','#F79F1F','#A3CB38','#1289A7'];
let _fallbackIdx = 0;
export function getColor(type) {
  if (!SPORT_COLORS[type]) SPORT_COLORS[type] = _fallbackColors[_fallbackIdx++ % _fallbackColors.length];
  return SPORT_COLORS[type];
}

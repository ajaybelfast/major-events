// ============================================================
//  DATA
// ============================================================
// One module for everything tournament-data-shaped:
//   - State: TOURNAMENTS, MATCHES, MATCHES_BY_TOURNAMENT, SPORT_CATEGORIES
//     (live bindings — consumers see the latest array via ES live exports).
//   - Sheet URLs + RFC-4180 CSV parser + fetch helper.
//   - `loadData()` orchestrates the four parallel sheet fetches and
//     populates the state above.
//   - Data-prep helpers used everywhere: `effectiveCategory` and the
//     `NO_SUBCATEGORY_SPLIT` set that drives it.
//
// `buildPromotionsData` is imported from features/promotions and called at
// the end of `loadData()` so promo state is ready before any UI renders.

import { buildPromotionsData } from '../features/promotions.js';

// ── Sheet URLs ───────────────────────────────────────────────

const SHEET_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSfVuGE4L38QC5CVV9zc3AN-vZ8Pi0ka7ieO10gpPZVq4bDYqoK41kUNaSxoKbGpmnEuwubg_Ln_mdE/pub';
const SHEET_URL_TOURNAMENTS      = `${SHEET_BASE}?gid=718549522&single=true&output=csv`;
const SHEET_URL_MATCHES          = `${SHEET_BASE}?gid=531923703&single=true&output=csv`;
// SportCategories tab — gid 986148101.
// Columns: `category` (matches effectiveCategory output, e.g. "Tennis" or
// "Esports (VALORANT)") and `toprevsport` (yes/no).
const SHEET_URL_SPORT_CATEGORIES = `${SHEET_BASE}?gid=986148101&single=true&output=csv`;
// Columns: `name`, `description`, `startdate`, `enddate`, `linkedtournaments`
// (pipe-delimited tournament names), `sport`.
const SHEET_URL_PROMOTIONS       = `${SHEET_BASE}?gid=502400076&single=true&output=csv`;

// ── State ────────────────────────────────────────────────────
// TOURNAMENTS and SPORT_CATEGORIES are exported as live bindings —
// reassigned by `loadData()`. MATCHES and MATCHES_BY_TOURNAMENT stay
// private; consumers reach them through `getMatchesForTournament()`.

export let TOURNAMENTS = [];
export let SPORT_CATEGORIES = []; // [{ category, topRevSport }]
let MATCHES = [];
let MATCHES_BY_TOURNAMENT = new Map();

// ── Data prep ────────────────────────────────────────────────

// Categories listed here are never split out by sub-category — every event
// in the category collapses into one lane / row regardless of `sub-category`.
// Esports stays sub-categorised (CS2, VALORANT, etc. each get their own lane).
export const NO_SUBCATEGORY_SPLIT = new Set(['Yachting']);

// Esports entries carry a `game` field — use "Esports (game)" as the row key.
// For categories in NO_SUBCATEGORY_SPLIT this collapses to the bare category,
// so they share a single lane regardless of sub-category.
export function effectiveCategory(ev) {
  if (NO_SUBCATEGORY_SPLIT.has(ev.category)) return ev.category;
  return ev.subCategory ? `${ev.category} (${ev.subCategory})` : ev.category;
}

export function getMatchesForTournament(tournamentName) {
  return MATCHES_BY_TOURNAMENT.get((tournamentName || '').toLowerCase()) || [];
}

// ── CSV parser ───────────────────────────────────────────────

// RFC-4180 CSV parser — handles quoted fields containing commas or newlines.
// Walks the whole text once and emits rows; a `\n` inside quotes is treated
// as cell content, not a row terminator. (The old approach split on \r?\n
// first, which corrupted any row whose cell contained an embedded newline —
// e.g. a multi-line description typed with Enter in a Google Sheets cell.)
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\r') { /* skip — handled by following \n */ }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else { field += ch; }
    }
  }
  // Flush trailing field/row if the file doesn't end in a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function fetchSheet(url) {
  // Cache-bust: Google's published CSV has a 5-min CDN cache and the browser
  // adds its own — both can serve stale rows after a trader edits the sheet.
  const bust = url + (url.includes('?') ? '&' : '?') + '_=' + Date.now();
  const res  = await fetch(bust, { cache: 'no-store' });
  const text = await res.text();
  const rows = parseCSV(text).filter(r => r.some(c => c.trim() !== ''));
  if (rows.length === 0) return [];
  const heads = rows.shift().map(h => h.trim().toLowerCase());
  const col   = name => heads.indexOf(name);
  return rows.map(parts => name => (parts[col(name)] || '').trim());
}

// ── loadData ─────────────────────────────────────────────────

export async function loadData() {
  const [tournamentRows, matchRows, sportRows, promoRows] = await Promise.all([
    fetchSheet(SHEET_URL_TOURNAMENTS),
    fetchSheet(SHEET_URL_MATCHES).catch(err => {
      console.error('Failed to load Matches tab:', err);
      return [];
    }),
    fetchSheet(SHEET_URL_SPORT_CATEGORIES).catch(err => {
      console.warn('Failed to load SportCategories tab (this is fine if you haven\'t set up the gid yet):', err);
      return [];
    }),
    fetchSheet(SHEET_URL_PROMOTIONS).catch(err => {
      console.warn('Failed to load Promotions tab (this is fine if you haven\'t set up the gid yet):', err);
      return [];
    }),
  ]);

  TOURNAMENTS = tournamentRows.map(get => {
    const startDate = get('startdate');
    const endDate   = get('enddate') || startDate;
    const ev = {
      category:  get('category'),
      name:      get('name'),
      format:    get('format'),
      country:   get('country'),
      startDate,
      endDate,
    };
    const subCategory = get('sub-category');
    if (subCategory) ev.subCategory = subCategory;
    if (get('highlight').toLowerCase() === 'yes') ev.highlight = true;
    if (get('toppin').toLowerCase() === 'yes') ev.topPin = true;
    ev.lengthDays = Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1;
    return ev;
  });

  MATCHES = matchRows.map(get => {
    const startDate = get('startdate');
    return {
      name:       get('name'),
      format:     'match',
      tournament: get('tournament'),
      startDate,
      endDate:    get('enddate') || startDate,
      country:    get('country'),
      category:   get('category'),
    };
  });

  MATCHES_BY_TOURNAMENT = new Map();
  MATCHES.forEach(m => {
    const key = (m.tournament || '').toLowerCase();
    if (!MATCHES_BY_TOURNAMENT.has(key)) MATCHES_BY_TOURNAMENT.set(key, []);
    MATCHES_BY_TOURNAMENT.get(key).push(m);
  });

  // Sport categories table: drives the "Top revenue" surfaces. One row per sport.
  SPORT_CATEGORIES = sportRows
    .map(get => ({
      category:    get('category'),
      topRevSport: get('toprevsport').toLowerCase() === 'yes',
    }))
    .filter(r => r.category);

  // Promotions parsing lives in features/promotions.js; we hand it the rows.
  buildPromotionsData(promoRows, TOURNAMENTS, effectiveCategory);
}

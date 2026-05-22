// ============================================================
//  TOP REVENUE SPORTS
// ============================================================
// Driven by the `SportCategories` sheet tab — one row per sport, with a
// `toprevsport` column. `category` values must match what
// `effectiveCategory()` returns at runtime (e.g. "Tennis" or
// "Esports (VALORANT)").

const TOP_REV_ONLY_KEY = 'mjr_top_rev_only';

export let topRevenueSports = new Set();
export let showOnlyTopRevenue = false;

export function isTopRevenueSport(sport) {
  return topRevenueSports.has(sport);
}

// Dependencies (SPORT_CATEGORIES, TOURNAMENTS, effectiveCategory) are passed
// in so this module stays independent of the rest of `app.js`. Called once
// from `init()` after data has been loaded.
export function computeTopRevenueSports(sportCategories, tournaments, effectiveCategory) {
  const flagged = new Set(
    sportCategories.filter(c => c.topRevSport).map(c => c.category)
  );
  // Expand: an event is "top revenue" if either its raw `category` (e.g.
  // "Esports") OR its rendered `effectiveCategory()` (e.g.
  // "Esports (VALORANT)") is flagged. This lets the sheet hold a single
  // high-level entry like "Esports" that automatically covers every
  // sub-categorised game.
  topRevenueSports = new Set();
  tournaments.forEach(ev => {
    if (flagged.has(ev.category) || flagged.has(effectiveCategory(ev))) {
      topRevenueSports.add(effectiveCategory(ev));
    }
  });
}

export function loadTopRevenueFilter() {
  try {
    showOnlyTopRevenue = localStorage.getItem(TOP_REV_ONLY_KEY) === '1';
  } catch {
    showOnlyTopRevenue = false;
  }
}

export function saveTopRevenueFilter() {
  try {
    localStorage.setItem(TOP_REV_ONLY_KEY, showOnlyTopRevenue ? '1' : '0');
  } catch {}
}

// Imported bindings can't be reassigned across module boundaries — callers
// use this setter to mutate the boolean. Reads still go through the live
// `showOnlyTopRevenue` export.
export function setShowOnlyTopRevenue(v) {
  showOnlyTopRevenue = !!v;
}

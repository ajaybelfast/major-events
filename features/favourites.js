// ============================================================
//  FAVOURITES — user-starred tournaments.
// ============================================================
// Stable per-edition key: same tournament in 2026 vs 2027 are distinct
// favourites. State is mutable; consumers reach for the live binding for
// reads (ES module live-binding semantics) and use the setter for writes.

const FAV_KEY = 'mjr_favourites';
const FAV_ONLY_KEY = 'mjr_fav_only';

export let favourites = new Set();
export let showOnlyFavourites = false;

export function favKeyOf(ev) {
  return `${ev.name}|${ev.startDate}`;
}

export function isFavourite(ev) {
  return favourites.has(favKeyOf(ev));
}

export function loadFavourites() {
  try {
    favourites = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'));
  } catch {
    favourites = new Set();
  }
  try {
    showOnlyFavourites = localStorage.getItem(FAV_ONLY_KEY) === '1';
  } catch {
    showOnlyFavourites = false;
  }
}

export function saveFavourites() {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify([...favourites]));
  } catch {}
}

export function saveFavOnly() {
  try {
    localStorage.setItem(FAV_ONLY_KEY, showOnlyFavourites ? '1' : '0');
  } catch {}
}

// Imported bindings can't be reassigned across module boundaries, so callers
// use this setter to mutate the boolean. Reads still go through the live
// `showOnlyFavourites` export.
export function setShowOnlyFavourites(v) {
  showOnlyFavourites = !!v;
}

export function toggleFavourite(ev) {
  const k = favKeyOf(ev);
  if (favourites.has(k)) favourites.delete(k);
  else favourites.add(k);
  saveFavourites();
}

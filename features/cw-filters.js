// ============================================================
//  CALENDAR / WEEKLY SIDEBAR FILTERS
// ============================================================
// State and UI for the left-hand sidebar shown in Calendar and Weekly
// views. Hosts: per-sport / per-country filter toggles, plus a
// consolidated "Special filters" section for favourites, top-revenue,
// and active promotions.
//
// Also owns `getFilteredTournaments()` — the single function every
// non-timeline view goes through to obtain the currently-filtered set.

import { getColor, todayLocalStr } from '../core/util.js';
import { TOURNAMENTS, effectiveCategory } from '../core/data.js';
import { currentView } from '../core/view-state.js';
import { buildCalendarView } from '../views/calendar.js';
import { buildWeeklyView } from '../views/weekly.js';
import { updateFilterBtn } from './filters.js';
import {
  showOnlyFavourites,
  setShowOnlyFavourites,
  saveFavOnly,
  isFavourite,
} from './favourites.js';
import {
  showOnlyTopRevenue,
  setShowOnlyTopRevenue,
  saveTopRevenueFilter,
  isTopRevenueSport,
  topRevenueSports,
} from './top-revenue.js';
import {
  showOnlyPromos,
  setShowOnlyPromos,
  savePromoFilter,
  hasActivePromo,
  PROMOTIONS,
} from './promotions.js';

// `SPORT_ICONS` and `getFlag` are globals from lookups.js.

export const cwFilters = { sports: new Set(), countries: new Set() };

// User preference (applies to calendar + weekly views): when true, drop any
// tournament whose endDate is strictly before today. "Strictly" means a
// tournament that ends *today* still shows. Persisted to localStorage.
const HIDE_COMPLETED_KEY = 'mjr_hide_completed';
export let hideCompleted = false;

export function setHideCompleted(v) {
  hideCompleted = !!v;
}
export function loadHideCompleted() {
  try { hideCompleted = localStorage.getItem(HIDE_COMPLETED_KEY) === '1'; }
  catch { hideCompleted = false; }
}
export function saveHideCompleted() {
  try { localStorage.setItem(HIDE_COMPLETED_KEY, hideCompleted ? '1' : '0'); } catch {}
}

export function getFilteredTournaments() {
  const { sports, countries } = cwFilters;
  const todayStr = todayLocalStr();
  const tournaments = TOURNAMENTS;
  if (!sports.size && !countries.size && !showOnlyFavourites
      && !showOnlyTopRevenue && !showOnlyPromos && !hideCompleted) {
    return tournaments;
  }
  return tournaments.filter(ev => {
    const sportOk   = !sports.size   || sports.has(effectiveCategory(ev));
    const countryOk = !countries.size || countries.has(ev.country);
    const favOk     = !showOnlyFavourites || isFavourite(ev);
    const topRevOk  = !showOnlyTopRevenue || isTopRevenueSport(effectiveCategory(ev));
    const promoOk   = !showOnlyPromos || hasActivePromo(ev);
    const notDone   = !hideCompleted || ev.endDate >= todayStr;
    return sportOk && countryOk && favOk && topRevOk && promoOk && notDone;
  });
}

export function buildCwSidebar() {
  // Single "Special filters" section consolidating the toggles that don't fit
  // the sport/country lists: favorite events, top-revenue sports, active promos.
  // Each toggle still hides itself if its underlying data is empty.
  const body = document.getElementById('cwSidebarBody');
  let special = document.getElementById('cwSpecialFilters');
  if (!special) {
    special = document.createElement('div');
    special.className = 'cw-section';
    special.id = 'cwSpecialFilters';
    special.innerHTML = `
      <div class="cw-section-title">Special filters</div>
      <div class="cw-filter-list" id="cwSpecialList"></div>
    `;
    body.insertBefore(special, body.firstChild);
  }
  const specialList = document.getElementById('cwSpecialList');
  specialList.innerHTML = '';

  // Favourites — always rendered.
  const favItem = document.createElement('div');
  favItem.className = 'cw-filter-item' + (showOnlyFavourites ? ' cw-active' : '');
  favItem.dataset.label = 'favorites favorite events my favorite events only';
  favItem.innerHTML = `<i class="fa-solid fa-star" style="color:#F7C948;width:14px;text-align:center;flex-shrink:0;font-size:12px"></i><span class="cw-filter-label">My favorite events only</span>`;
  favItem.addEventListener('click', () => {
    setShowOnlyFavourites(!showOnlyFavourites);
    saveFavOnly();
    favItem.classList.toggle('cw-active', showOnlyFavourites);
    updateCwUI();
    rebuildCwView();
    updateFilterBtn();
  });
  specialList.appendChild(favItem);

  // Top-revenue — only when the sheet has flagged sports.
  if (topRevenueSports.size > 0) {
    const trItem = document.createElement('div');
    trItem.className = 'cw-filter-item' + (showOnlyTopRevenue ? ' cw-active' : '');
    trItem.dataset.label = 'top revenue sports only';
    trItem.innerHTML = `<i class="fa-solid fa-dollar-sign" style="color:#F7C948;width:14px;text-align:center;flex-shrink:0;font-size:12px"></i><span class="cw-filter-label">Top revenue sports only</span>`;
    trItem.addEventListener('click', () => {
      setShowOnlyTopRevenue(!showOnlyTopRevenue);
      saveTopRevenueFilter();
      trItem.classList.toggle('cw-active', showOnlyTopRevenue);
      updateCwUI();
      rebuildCwView();
      updateFilterBtn();
    });
    specialList.appendChild(trItem);
  }

  // Active promotions — only when promos exist.
  if (PROMOTIONS.length > 0) {
    const promoItem = document.createElement('div');
    promoItem.className = 'cw-filter-item' + (showOnlyPromos ? ' cw-active' : '');
    promoItem.dataset.label = 'promotions active promos only';
    promoItem.innerHTML = `<i class="fa-solid fa-gift" style="color:#c084fc;width:14px;text-align:center;flex-shrink:0;font-size:12px"></i><span class="cw-filter-label">Active promotions only</span>`;
    promoItem.addEventListener('click', () => {
      setShowOnlyPromos(!showOnlyPromos);
      savePromoFilter();
      promoItem.classList.toggle('cw-active', showOnlyPromos);
      updateCwUI();
      rebuildCwView();
      updateFilterBtn();
    });
    specialList.appendChild(promoItem);
  }

  // Clean up any legacy sections from earlier builds where these had their own
  // headers — safe even on fresh DOM (querySelectorAll returns empty NodeList).
  ['cwFavSection', 'cwTopRevSection', 'cwPromoSection'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });

  const tournaments = TOURNAMENTS;
  buildCwSportList();
  buildCwList(
    'cwCountryList',
    [...new Set(tournaments.map(ev => ev.country))].sort(),
    cwFilters.countries,
    country => `<span style="font-size:15px;flex-shrink:0;line-height:1">${getFlag(country)}</span>`
  );
  updateCwUI();
}

// Sport list: top-revenue sports float to the top under a "Top revenue"
// header, the rest sit under "Other sports". Top-revenue rows also get a
// trailing $ icon so the marking is visible even when the toggle is off.
function buildCwSportList() {
  const list = document.getElementById('cwSportList');
  list.innerHTML = '';
  const tournaments = TOURNAMENTS;
  const all = [...new Set(tournaments.map(ev => effectiveCategory(ev)))].sort();
  const top  = all.filter(s => isTopRevenueSport(s));
  const rest = all.filter(s => !isTopRevenueSport(s));

  function renderSport(sport, isTopRev) {
    const cls   = SPORT_ICONS[sport] || 'fa-solid fa-trophy';
    const color = getColor(sport);
    const el = document.createElement('div');
    el.className = 'cw-filter-item' + (cwFilters.sports.has(sport) ? ' cw-active' : '');
    el.dataset.label = sport.toLowerCase();
    const trailing = isTopRev ? '<i class="fa-solid fa-dollar-sign cw-toprev-icon"></i>' : '';
    el.innerHTML = `<i class="${cls}" style="color:${color};width:14px;text-align:center;flex-shrink:0;font-size:12px"></i><span class="cw-filter-label">${sport}</span>${trailing}`;
    el.addEventListener('click', () => {
      cwFilters.sports.has(sport) ? cwFilters.sports.delete(sport) : cwFilters.sports.add(sport);
      el.classList.toggle('cw-active', cwFilters.sports.has(sport));
      updateCwUI();
      rebuildCwView();
    });
    list.appendChild(el);
  }

  if (top.length > 0 && rest.length > 0) {
    const hdr = document.createElement('div');
    hdr.className = 'cw-subgroup-header';
    hdr.innerHTML = '<i class="fa-solid fa-dollar-sign"></i> Top revenue';
    list.appendChild(hdr);
    top.forEach(s => renderSport(s, true));
    const hdr2 = document.createElement('div');
    hdr2.className = 'cw-subgroup-header cw-subgroup-header-rest';
    hdr2.textContent = 'Other sports';
    list.appendChild(hdr2);
    rest.forEach(s => renderSport(s, false));
  } else {
    all.forEach(s => renderSport(s, isTopRevenueSport(s)));
  }
}

function buildCwList(listId, items, filterSet, iconFn) {
  const list = document.getElementById(listId);
  list.innerHTML = '';
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'cw-filter-item' + (filterSet.has(item) ? ' cw-active' : '');
    el.dataset.label = item.toLowerCase();
    el.innerHTML = `${iconFn(item)}<span class="cw-filter-label">${item}</span>`;
    el.addEventListener('click', () => {
      filterSet.has(item) ? filterSet.delete(item) : filterSet.add(item);
      el.classList.toggle('cw-active', filterSet.has(item));
      updateCwUI();
      rebuildCwView();
    });
    list.appendChild(el);
  });
}

export function clearCwSearch() {
  const inp = document.getElementById('cwSearchInput');
  if (!inp) return;
  inp.value = '';
  filterCwSidebar('');
  inp.focus();
}

export function filterCwSidebar(q) {
  const lq = q.trim().toLowerCase();
  ['cwSportList', 'cwCountryList'].forEach(id => {
    const list = document.getElementById(id);
    let anyVisible = false;
    list.querySelectorAll('.cw-filter-item').forEach(el => {
      const match = !lq || el.dataset.label.includes(lq);
      el.style.display = match ? '' : 'none';
      if (match) anyVisible = true;
    });
    // Hide the section title if nothing matches.
    const section = list.closest('.cw-section');
    if (section) section.style.display = anyVisible || !lq ? '' : 'none';
  });
}

export function updateCwUI() {
  const total = cwFilters.sports.size + cwFilters.countries.size
              + (showOnlyFavourites ? 1 : 0)
              + (showOnlyTopRevenue ? 1 : 0)
              + (showOnlyPromos ? 1 : 0);
  const badge = document.getElementById('cwActiveBadge');
  // Keep the badge in the layout always (visibility, not display) so
  // toggling a filter doesn't reflow the header and shift everything below.
  if (badge) {
    badge.textContent = total || '';
    badge.style.visibility = total ? 'visible' : 'hidden';
  }
  const btn = document.getElementById('cwClearBtn');
  if (btn) btn.disabled = !total;
}

export function clearCwFilters() {
  cwFilters.sports.clear();
  cwFilters.countries.clear();
  setShowOnlyFavourites(false);
  setShowOnlyTopRevenue(false);
  setShowOnlyPromos(false);
  saveFavOnly();
  saveTopRevenueFilter();
  savePromoFilter();
  updateFilterBtn();
  document.getElementById('cwSearchInput').value = '';
  filterCwSidebar('');
  buildCwSidebar();
  rebuildCwView();
}

export function rebuildCwView() {
  if (currentView === 'calendar') buildCalendarView();
  else if (currentView === 'weekly') buildWeeklyView();
}

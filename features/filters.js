// ============================================================
//  FILTERS + SORT (timeline sidebar)
// ============================================================
// Sort mode (live / alpha / country), per-mode active filter set, the
// filter-panel UI, and the sorted-data getters that views consume.
//
// `catData` and `_countryData` are caches built from TOURNAMENTS; the
// sorted getters layer in the user's filters (sport/country/favourites/
// top-revenue/promos) on top of those caches.

import {
  ROW_PAD,
  LANE_H,
  dayOffset,
  TIMELINE_START,
  TIMELINE_END,
} from '../core/timeline-config.js';
import { TOURNAMENTS, effectiveCategory } from '../core/data.js';
import { currentView } from '../core/view-state.js';
import { buildSidebar } from '../views/sidebar.js';
import { buildTimelineRows } from '../views/timeline-rows.js';
import { rebuildCwView, buildCwSidebar, updateCwUI, cwFilters } from './cw-filters.js';
import {
  isFavourite,
  showOnlyFavourites,
  setShowOnlyFavourites,
  saveFavOnly,
} from './favourites.js';
import {
  isTopRevenueSport,
  showOnlyTopRevenue,
  setShowOnlyTopRevenue,
  saveTopRevenueFilter,
  topRevenueSports,
} from './top-revenue.js';
import {
  hasActivePromo,
  showOnlyPromos,
  setShowOnlyPromos,
  savePromoFilter,
  PROMOTIONS,
} from './promotions.js';

// ── State ─────────────────────────────────────────────────────

export let sortMode = 'live';
export let activeFilters = new Set();
let catData = [];
let _countryData = null;


export function getSortMode() { return sortMode; }
export function getActiveFilters() { return activeFilters; }
export function setActiveFilters(set) { activeFilters = set; }
export function setSortModeValue(v) { sortMode = v; }

// ── Data prep (lane assignment + caches) ─────────────────────

export function buildData() {
  _countryData = null;
  const cats = [...new Set(TOURNAMENTS.map(t => effectiveCategory(t)))].sort();
  catData = cats.map(cat => {
    const events = TOURNAMENTS
      .filter(t => effectiveCategory(t) === cat)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    const laneEnd = [];
    events.forEach(ev => {
      const start = dayOffset(ev.startDate);
      const end   = start + ev.lengthDays;
      let lane = laneEnd.findIndex(e => e <= start);
      if (lane === -1) lane = laneEnd.length;
      laneEnd[lane] = end;
      ev._lane = lane;
    });

    const laneCount = Math.max(1, laneEnd.length);
    const rowHeight = ROW_PAD * 2 + laneCount * LANE_H;
    return { cat, events, laneCount, rowHeight };
  });
}

export function getCountryData() {
  if (_countryData) return _countryData;
  const map = {};
  TOURNAMENTS.forEach(ev => {
    if (!map[ev.country]) map[ev.country] = [];
    map[ev.country].push(ev);
  });
  _countryData = Object.keys(map).sort().map(country => {
    const events = map[country].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const laneEnd = [];
    events.forEach(ev => {
      const start = dayOffset(ev.startDate);
      const end   = start + ev.lengthDays;
      let lane = laneEnd.findIndex(e => e <= start);
      if (lane === -1) lane = laneEnd.length;
      laneEnd[lane] = end;
      ev._cLane = lane;
    });
    const laneCount = Math.max(1, laneEnd.length);
    return { country, events, laneCount, rowHeight: ROW_PAD * 2 + laneCount * LANE_H };
  }).filter(({ events }) =>
    events.some(ev =>
      new Date(ev.endDate) >= TIMELINE_START && new Date(ev.startDate) <= TIMELINE_END
    )
  );
  return _countryData;
}

export function getCountryStatus({ events }) {
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  let isActive = false, nextMs = null;
  events.forEach(ev => {
    const startMs = new Date(ev.startDate).getTime();
    const endMs   = new Date(ev.endDate).getTime() + 86400000;
    if (todayMs >= startMs && todayMs < endMs) {
      isActive = true;
    } else if (startMs > todayMs) {
      if (nextMs === null || startMs < nextMs) nextMs = startMs;
    }
  });
  return { isActive, nextMs };
}

function assignLanes(events) {
  const laneEnd = [];
  events.forEach(ev => {
    const start = dayOffset(ev.startDate);
    const end   = start + ev.lengthDays;
    let lane = laneEnd.findIndex(e => e <= start);
    if (lane === -1) lane = laneEnd.length;
    laneEnd[lane] = end;
    ev._lane = lane;
  });
  const laneCount = Math.max(1, laneEnd.length);
  return { laneCount, rowHeight: ROW_PAD * 2 + laneCount * LANE_H };
}

function assignCountryLanes(events) {
  const laneEnd = [];
  events.forEach(ev => {
    const start = dayOffset(ev.startDate);
    const end   = start + ev.lengthDays;
    let lane = laneEnd.findIndex(e => e <= start);
    if (lane === -1) lane = laneEnd.length;
    laneEnd[lane] = end;
    ev._cLane = lane;
  });
  const laneCount = Math.max(1, laneEnd.length);
  return { laneCount, rowHeight: ROW_PAD * 2 + laneCount * LANE_H };
}

// ── Sorted data getters (consumed by sidebar + timeline-rows) ─

export function getSortedCatData() {
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  let source    = activeFilters.size > 0 ? catData.filter(d => activeFilters.has(d.cat)) : catData;
  if (showOnlyTopRevenue) {
    source = source.filter(d => isTopRevenueSport(d.cat));
  }
  if (showOnlyFavourites) {
    source = source
      .map(d => ({ ...d, events: d.events.filter(isFavourite) }))
      .filter(d => d.events.length > 0);
  }
  if (showOnlyPromos) {
    source = source
      .map(d => ({ ...d, events: d.events.filter(hasActivePromo) }))
      .filter(d => d.events.length > 0);
  }

  function makeEntry(cat, events, isLiveSlice) {
    const { laneCount, rowHeight } = assignLanes(events);
    let isActive = false, nextMs = null;
    events.forEach(ev => {
      const s = new Date(ev.startDate).getTime();
      const e = new Date(ev.endDate).getTime() + 86400000;
      if (todayMs >= s && todayMs < e) isActive = true;
      else if (s > todayMs && (nextMs === null || s < nextMs)) nextMs = s;
    });
    return { cat, events, laneCount, rowHeight, isLiveSlice, isActive, nextMs };
  }

  if (sortMode === 'alpha') {
    return source.map(({ cat, events }) => makeEntry(cat, events, false));
  }

  // Live mode: pull active events into compact top rows; rest sorts below.
  const liveEntries = [], restEntries = [];

  source.forEach(({ cat, events }) => {
    const active = events.filter(ev => {
      const s = new Date(ev.startDate).getTime();
      const e = new Date(ev.endDate).getTime() + 86400000;
      return todayMs >= s && todayMs < e;
    });
    const rest = events.filter(ev => new Date(ev.startDate).getTime() > todayMs);

    if (active.length > 0) {
      liveEntries.push(makeEntry(cat, active, true));
      if (rest.length > 0) restEntries.push(makeEntry(cat, rest, false));
    } else {
      restEntries.push(makeEntry(cat, events, false));
    }
  });

  liveEntries.sort((a, b) => a.cat.localeCompare(b.cat));
  restEntries.sort((a, b) => {
    if (a.nextMs && !b.nextMs) return -1;
    if (!a.nextMs && b.nextMs) return 1;
    if (a.nextMs && b.nextMs)  return a.nextMs - b.nextMs;
    return a.cat.localeCompare(b.cat);
  });

  return [...liveEntries, ...restEntries];
}

export function getSortedCountryData() {
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  let source    = activeFilters.size > 0
    ? getCountryData().filter(d => activeFilters.has(d.country))
    : getCountryData();
  if (showOnlyTopRevenue) {
    source = source
      .map(d => ({ ...d, events: d.events.filter(ev => isTopRevenueSport(effectiveCategory(ev))) }))
      .filter(d => d.events.length > 0);
  }
  if (showOnlyFavourites) {
    source = source
      .map(d => ({ ...d, events: d.events.filter(isFavourite) }))
      .filter(d => d.events.length > 0);
  }
  if (showOnlyPromos) {
    source = source
      .map(d => ({ ...d, events: d.events.filter(hasActivePromo) }))
      .filter(d => d.events.length > 0);
  }

  // One row per country, sorted alphabetically — matches the A–Z mode's
  // "everything in one place" philosophy.
  return source
    .map(({ country, events }) => {
      const { laneCount, rowHeight } = assignCountryLanes(events);
      let isActive = false, nextMs = null;
      events.forEach(ev => {
        const s = new Date(ev.startDate).getTime();
        const e = new Date(ev.endDate).getTime() + 86400000;
        if (todayMs >= s && todayMs < e) isActive = true;
        else if (s > todayMs && (nextMs === null || s < nextMs)) nextMs = s;
      });
      return { country, events, laneCount, rowHeight, isLiveSlice: false, isActive, nextMs };
    })
    .sort((a, b) => a.country.localeCompare(b.country));
}

// ── Persistence ──────────────────────────────────────────────

export function loadFilters() {
  try {
    const saved = localStorage.getItem(`mjr_filters_${sortMode}`);
    activeFilters = saved ? new Set(JSON.parse(saved)) : new Set();
  } catch { activeFilters = new Set(); }
  updateFilterBtn();
}

export function saveFilters() {
  localStorage.setItem(`mjr_filters_${sortMode}`, JSON.stringify([...activeFilters]));
}

// ── Filter button + panel UI ─────────────────────────────────

export function updateFilterBtn() {
  const btn = document.getElementById('filterBtn');
  if (!btn) return;
  const count = activeFilters.size
              + (showOnlyFavourites ? 1 : 0)
              + (showOnlyTopRevenue ? 1 : 0)
              + (showOnlyPromos ? 1 : 0);
  btn.classList.toggle('filter-btn-active', count > 0);
  let badge = btn.querySelector('.filter-badge');
  if (count > 0) {
    if (!badge) { badge = document.createElement('span'); badge.className = 'filter-badge'; btn.appendChild(badge); }
    badge.textContent = count;
  } else if (badge) {
    badge.remove();
  }
  const clearBtn = document.getElementById('filterClearIconBtn');
  if (clearBtn) clearBtn.classList.toggle('visible', count > 0);
}

export function toggleFilterPanel() {
  const panel = document.getElementById('filterPanel');
  const isOpen = panel.classList.toggle('open');
  if (isOpen) renderFilterOptions();
}

export function renderFilterOptions() {
  const container = document.getElementById('filterOptions');
  container.innerHTML = '';

  // Favourites toggle — always at the top of the panel.
  const favLabel = document.createElement('label');
  favLabel.className = 'filter-option filter-option-fav';
  const favCb = document.createElement('input');
  favCb.type = 'checkbox';
  favCb.checked = showOnlyFavourites;
  favCb.addEventListener('change', () => {
    setShowOnlyFavourites(favCb.checked);
    saveFavOnly();
    updateFilterBtn();
    rebuildViews();
    const view = currentView;
    if (view === 'calendar' || view === 'weekly') rebuildCwView();
  });
  const favSpan = document.createElement('span');
  favSpan.innerHTML = '<i class="fa-solid fa-star" style="color:#F7C948;margin-right:6px"></i>My favorite events only';
  favLabel.appendChild(favCb);
  favLabel.appendChild(favSpan);
  container.appendChild(favLabel);

  // Top-revenue-sports toggle — only renders if any sports are flagged in the sheet.
  if (topRevenueSports.size > 0) {
    const trLabel = document.createElement('label');
    trLabel.className = 'filter-option filter-option-toprev';
    const trCb = document.createElement('input');
    trCb.type = 'checkbox';
    trCb.checked = showOnlyTopRevenue;
    trCb.addEventListener('change', () => {
      setShowOnlyTopRevenue(trCb.checked);
      saveTopRevenueFilter();
      updateFilterBtn();
      rebuildViews();
      const view = currentView;
      if (view === 'calendar' || view === 'weekly') rebuildCwView();
    });
    const trSpan = document.createElement('span');
    trSpan.innerHTML = '<i class="fa-solid fa-dollar-sign" style="color:#F7C948;margin-right:6px"></i>Top revenue sports only';
    trLabel.appendChild(trCb);
    trLabel.appendChild(trSpan);
    container.appendChild(trLabel);
  }

  // Active-promos toggle — hides itself when the sheet has no promos.
  if (PROMOTIONS.length > 0) {
    const prLabel = document.createElement('label');
    prLabel.className = 'filter-option filter-option-promo';
    const prCb = document.createElement('input');
    prCb.type = 'checkbox';
    prCb.checked = showOnlyPromos;
    prCb.addEventListener('change', () => {
      setShowOnlyPromos(prCb.checked);
      savePromoFilter();
      updateFilterBtn();
      rebuildViews();
      const view = currentView;
      if (view === 'calendar' || view === 'weekly') rebuildCwView();
    });
    const prSpan = document.createElement('span');
    prSpan.innerHTML = '<i class="fa-solid fa-gift" style="color:#c084fc;margin-right:6px"></i>Active promotions only';
    prLabel.appendChild(prCb);
    prLabel.appendChild(prSpan);
    container.appendChild(prLabel);
  }

  const sep = document.createElement('div');
  sep.className = 'filter-option-sep';
  container.appendChild(sep);

  // For sport mode, float top-revenue sports to the top under a labelled header.
  const isSportMode = sortMode !== 'country';
  const rawOptions = sortMode === 'country'
    ? getCountryData().map(d => d.country)
    : catData.map(d => d.cat);

  function renderOption(opt) {
    const label = document.createElement('label');
    label.className = 'filter-option';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = activeFilters.has(opt);
    cb.addEventListener('change', () => {
      if (cb.checked) activeFilters.add(opt);
      else activeFilters.delete(opt);
      saveFilters();
      updateFilterBtn();
      rebuildViews();
    });
    const span = document.createElement('span');
    if (isSportMode && isTopRevenueSport(opt)) {
      span.innerHTML = `${opt}<i class="fa-solid fa-dollar-sign filter-toprev-icon"></i>`;
    } else {
      span.textContent = opt;
    }
    label.appendChild(cb);
    label.appendChild(span);
    container.appendChild(label);
  }

  if (isSportMode && topRevenueSports.size > 0) {
    const top = rawOptions.filter(o => isTopRevenueSport(o));
    const rest = rawOptions.filter(o => !isTopRevenueSport(o));
    if (top.length > 0) {
      const hdr = document.createElement('div');
      hdr.className = 'filter-section-header';
      hdr.innerHTML = '<i class="fa-solid fa-dollar-sign"></i> Top revenue';
      container.appendChild(hdr);
      top.forEach(renderOption);
    }
    if (rest.length > 0) {
      const hdr2 = document.createElement('div');
      hdr2.className = 'filter-section-header filter-section-header-rest';
      hdr2.textContent = 'Other sports';
      container.appendChild(hdr2);
      rest.forEach(renderOption);
    }
  } else {
    rawOptions.forEach(renderOption);
  }
}

export function clearFilters() {
  activeFilters.clear();
  setShowOnlyFavourites(false);
  setShowOnlyTopRevenue(false);
  setShowOnlyPromos(false);
  saveFilters();
  saveFavOnly();
  saveTopRevenueFilter();
  savePromoFilter();
  updateFilterBtn();
  renderFilterOptions();
  rebuildViews();
}

export function rebuildViews() {
  document.getElementById('sidebarRows').innerHTML = '';
  document.getElementById('timelineRows').innerHTML = '';
  buildSidebar();
  buildTimelineRows();
}

export function initFilterClickOutside() {
  document.addEventListener('click', e => {
    const panel = document.getElementById('filterPanel');
    const btn   = document.getElementById('filterBtn');
    if (panel.classList.contains('open') && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
      panel.classList.remove('open');
    }
  });
}

export function toggleSidebar() {
  const sidebar   = document.querySelector('.sidebar');
  const backdrop  = document.getElementById('sidebarBackdrop');
  const btn       = document.getElementById('hamburgerBtn');
  const collapsed = sidebar.classList.toggle('collapsed');
  btn.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  if (collapsed) document.getElementById('filterPanel').classList.remove('open');
  if (window.innerWidth <= 768) {
    backdrop.classList.toggle('visible', !collapsed);
  }
}

export function setSort(mode) {
  document.getElementById('filterPanel').classList.remove('open');
  sortMode = mode;
  loadFilters();
  const label = mode === 'country' ? 'Country' : 'Sport';
  document.getElementById('sidebarLabel').textContent = label;
  const filterBtn = document.getElementById('filterBtn');
  if (filterBtn) filterBtn.title = `Filter by ${label.toLowerCase()}`;
  document.getElementById('btnAlpha').classList.toggle('on',   mode === 'alpha');
  document.getElementById('btnLive').classList.toggle('on',    mode === 'live');
  document.getElementById('btnCountry').classList.toggle('on', mode === 'country');
  document.getElementById('sidebarRows').innerHTML  = '';
  document.getElementById('timelineRows').innerHTML = '';
  buildSidebar();
  buildTimelineRows();
}

// Apply a chip click from the header search ("Filter to Tennis" /
// "Filter to Spain"). Switches sort mode if needed and overrides
// both the timeline filter set and the cw-sidebar filter sets so
// the filter is visible in every view.
export function applySearchFilter(kind, label) {
  if (kind === 'sport') {
    if (sortMode === 'country') applySortModeUiSwitch('live');
    setActiveFilters(new Set([label]));
    cwFilters.sports = new Set([label]);
    cwFilters.countries.clear();
  } else if (kind === 'country') {
    if (sortMode !== 'country') applySortModeUiSwitch('country');
    setActiveFilters(new Set([label]));
    cwFilters.countries = new Set([label]);
    cwFilters.sports.clear();
  } else {
    return;
  }
  saveFilters();
  updateFilterBtn();
  updateCwUI();
  rebuildViews();
  buildCwSidebar();
  if (currentView === 'calendar' || currentView === 'weekly') rebuildCwView();
}

// Shared by `setSort()` and `applySearchFilter()` — flips the active
// sort button styling and the sidebar label/title.
function applySortModeUiSwitch(mode) {
  sortMode = mode;
  const label = mode === 'country' ? 'Country' : 'Sport';
  document.getElementById('sidebarLabel').textContent = label;
  const filterBtn = document.getElementById('filterBtn');
  if (filterBtn) filterBtn.title = `Filter by ${label.toLowerCase()}`;
  document.getElementById('btnAlpha').classList.toggle('on',   mode === 'alpha');
  document.getElementById('btnLive').classList.toggle('on',    mode === 'live');
  document.getElementById('btnCountry').classList.toggle('on', mode === 'country');
}

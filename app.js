// ============================================================
//  MODULE IMPORTS
// ============================================================
// `app.js` is the orchestrator — it imports just the bits each
// init/refresh/window-bridge call actually touches. Module-to-module
// dependencies are wired directly in each module via its own imports.

import { TOURNAMENTS, SPORT_CATEGORIES, effectiveCategory, loadData } from './core/data.js';
import { computeTimelineBounds } from './core/timeline-config.js';
import { currentView, setView } from './core/view-state.js';
import { loadFavourites } from './features/favourites.js';
import { computeTopRevenueSports, loadTopRevenueFilter } from './features/top-revenue.js';
import { loadPromoFilter, buildPromoRail, closePromoPanel } from './features/promotions.js';
import {
  buildData,
  loadFilters,
  toggleFilterPanel,
  clearFilters,
  initFilterClickOutside,
  toggleSidebar,
  setSort,
} from './features/filters.js';
import {
  buildCwSidebar,
  clearCwSearch,
  filterCwSidebar,
  clearCwFilters,
} from './features/cw-filters.js';
import { openSettingsPanel, closeSettingsPanel } from './features/settings-panel.js';
import { initKeyboardShortcuts } from './features/keyboard.js';
import { initSearch } from './features/search.js';
import { buildSidebar } from './views/sidebar.js';
import { buildTimelineRows } from './views/timeline-rows.js';
import { buildMonthHeaders } from './views/month-headers.js';
import { buildCalendarView } from './views/calendar.js';
import { buildWeeklyView } from './views/weekly.js';
import {
  initScrollSync,
  initMobileTouch,
  initDragScroll,
  scrollToStart,
  goToToday,
  scrollToToday,
} from './views/scroll.js';

// Wire inline-HTML-handler-equivalents via addEventListener at init time so
// the DOM has no `onclick="…"` attributes (which would force every handler
// function to live on `window`, fragile across module refactors).
function wireDomHandlers() {
  const on = (sel, ev, fn) => {
    document.querySelectorAll(sel).forEach(el => el.addEventListener(ev, fn));
  };
  on('.header-logo',          'click', scrollToStart);
  on('#btnTimeline',          'click', () => setView('timeline'));
  on('#btnCalendar',          'click', () => setView('calendar'));
  on('#btnWeekly',            'click', () => setView('weekly'));
  on('.today-btn',            'click', goToToday);
  on('.settings-btn',         'click', openSettingsPanel);
  on('#sidebarBackdrop',      'click', toggleSidebar);
  on('#hamburgerBtn',         'click', toggleSidebar);
  on('#filterClearIconBtn',   'click', clearFilters);
  on('.filter-clear-btn',     'click', clearFilters);
  on('#filterBtn',            'click', toggleFilterPanel);
  on('#btnAlpha',             'click', () => setSort('alpha'));
  on('#btnLive',              'click', () => setSort('live'));
  on('#btnCountry',           'click', () => setSort('country'));
  on('#cwSearchInput',        'input', e => filterCwSidebar(e.target.value));
  on('#cwSearchClear',        'click', clearCwSearch);
  on('#cwClearBtn',           'click', clearCwFilters);
  on('#settingsBackdrop',     'click', closeSettingsPanel);
  on('.settings-close',       'click', closeSettingsPanel);
  on('#promoPanelBackdrop',   'click', closePromoPanel);
  on('.promo-panel-close',    'click', closePromoPanel);
}

// Header date label — format "Wed 20 May 26". Called at init and from
// refreshAll() so it stays accurate if the page is left open across midnight.
function updateHeaderDate() {
  const el = document.getElementById('headerTodayDate');
  if (!el) return;
  const d = new Date();
  const days   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  el.textContent = `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ============================================================
//  RENDER PIPELINE
// ============================================================
// Two re-entrant primitives, shared by `init()` (first load) and
// `refreshAll()` (every 15 min). Splitting them this way means there
// can only be one source of truth for the sequence of build steps —
// adding a new step requires touching one function, not two.

// Fetches all four sheet tabs and (re)builds every derived cache. Safe
// to call on a populated app; reassigns the live bindings in core/data
// and features/* so subsequent renders see the latest data.
async function refreshData() {
  await loadData();
  computeTimelineBounds(TOURNAMENTS);
  buildData();
  computeTopRevenueSports(SPORT_CATEGORIES, TOURNAMENTS, effectiveCategory);
}

// Re-renders every view from the current data + filter state. Idempotent.
// Calls into the current cw view at the end so calendar / weekly stays
// in sync; the timeline rebuilds via buildSidebar + buildTimelineRows.
function renderAll() {
  updateHeaderDate();
  buildMonthHeaders();
  buildPromoRail();
  buildSidebar();
  buildTimelineRows();
  buildCwSidebar();
  if (currentView === 'calendar') buildCalendarView();
  else if (currentView === 'weekly') buildWeeklyView();
}

// ============================================================
//  INIT
// ============================================================
async function init() {
  document.getElementById('sidebarRows').innerHTML =
    '<div style="padding:16px 12px;color:#8b949e;font-size:13px">Loading…</div>';
  try {
    // 1. Pull fresh data + compute every derived cache.
    await refreshData();

    // 2. Load persisted UI state from localStorage.
    loadFavourites();
    loadTopRevenueFilter();
    loadPromoFilter();
    loadFilters();

    // 3. First render of every view.
    renderAll();

    // 4. One-time event-listener wiring + final DOM setup.
    initScrollSync();
    initDragScroll();
    initSearch();
    initFilterClickOutside();
    initMobileTouch();
    initKeyboardShortcuts();
    wireDomHandlers();
    if (window.innerWidth <= 768) {
      document.querySelector('.sidebar').classList.add('collapsed');
    }
    requestAnimationFrame(scrollToToday);

    // 5. Restore the last-used view (calendar / weekly) if any.
    let savedView = null;
    try { savedView = localStorage.getItem('mjr_view'); } catch {}
    if (savedView === 'calendar' || savedView === 'weekly') {
      setView(savedView);
    }
  } catch (err) {
    console.error('Failed to load tournament data:', err);
    document.getElementById('sidebarRows').innerHTML =
      '<div style="padding:16px 12px;color:#e53935;font-size:13px">Failed to load data. Check console.</div>';
  }
}

init();

// ============================================================
//  AUTO-REFRESH
// ============================================================
// Designed for unattended displays (e.g. meeting room screens) where the
// page is never reloaded. Every REFRESH_MS we re-fetch the sheet so new
// events appear, and re-render every view so the "today" marker, live
// indicators, past-week dimming, etc. stay accurate across midnight.
// Scroll positions are preserved so a viewer sees no visible jump.
const REFRESH_MS = 15 * 60 * 1000; // 15 minutes

async function refreshAll() {
  const scrolls = captureScrollPositions();
  try {
    await refreshData();
    renderAll();
    requestAnimationFrame(() => restoreScrollPositions(scrolls));
  } catch (err) {
    console.error('Auto-refresh failed:', err);
  }
}

function captureScrollPositions() {
  const tw = document.querySelector('.timeline-wrapper');
  const cv = document.getElementById('calendarView');
  const wm = document.getElementById('weeklyMainPanel');
  const sr = document.getElementById('sidebarRows');
  return {
    timelineX: tw ? tw.scrollLeft : 0,
    timelineY: tw ? tw.scrollTop  : 0,
    calendar:  cv ? cv.scrollTop  : 0,
    weekly:    wm ? wm.scrollTop  : 0,
    sidebar:   sr ? sr.scrollTop  : 0,
  };
}

function restoreScrollPositions(scrolls) {
  const tw = document.querySelector('.timeline-wrapper');
  const cv = document.getElementById('calendarView');
  const wm = document.getElementById('weeklyMainPanel');
  const sr = document.getElementById('sidebarRows');
  if (tw) { tw.scrollLeft = scrolls.timelineX; tw.scrollTop = scrolls.timelineY; }
  if (cv)   cv.scrollTop  = scrolls.calendar;
  if (wm)   wm.scrollTop  = scrolls.weekly;
  if (sr)   sr.scrollTop  = scrolls.sidebar;
}

setInterval(refreshAll, REFRESH_MS);


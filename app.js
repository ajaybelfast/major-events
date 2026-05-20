// ============================================================
//  COLOR HELPERS
// ============================================================
const _fallbackColors = ['#FF9F43','#EE5A24','#C4E538','#009432','#0652DD','#9980FA','#ED4C67','#F79F1F','#A3CB38','#1289A7'];
let _fallbackIdx = 0;
function getColor(type) {
  if (!SPORT_COLORS[type]) SPORT_COLORS[type] = _fallbackColors[_fallbackIdx++ % _fallbackColors.length];
  return SPORT_COLORS[type];
}

// ============================================================
//  TIMELINE CONFIG
// ============================================================
const DAY_PX = window.innerWidth <= 768 ? 9 : 18;
const BAR_H  = 29;
const LANE_H = 37;
const ROW_PAD = 8;

let TIMELINE_START, TIMELINE_END, TOTAL_DAYS, TOTAL_W;

function computeTimelineBounds() {
  let minDate = null, maxDate = null;
  TOURNAMENTS.forEach(ev => {
    const s = new Date(ev.startDate), e = new Date(ev.endDate);
    if (!minDate || s < minDate) minDate = s;
    if (!maxDate || e > maxDate) maxDate = e;
  });
  // Start: 1st of the earliest month
  TIMELINE_START = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  // End: last day of the latest month
  TIMELINE_END   = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
  TOTAL_DAYS     = Math.round((TIMELINE_END - TIMELINE_START) / 86400000);
  TOTAL_W        = TOTAL_DAYS * DAY_PX;
}

// Accepts either a YYYY-MM-DD string or a Date. Strings are parsed as LOCAL
// midnight (via parseLocalDate) to match TIMELINE_START — otherwise UTC
// parsing in non-UTC timezones (e.g. AU) makes dates land on the wrong day
// (e.g. May 31 ending up at the same offset as June 1).
function dayOffset(dateOrDate) {
  const d = (typeof dateOrDate === 'string') ? parseLocalDate(dateOrDate) : dateOrDate;
  return Math.round((d - TIMELINE_START) / 86400000);
}

// Parse a YYYY-MM-DD string as local midnight (not UTC) so date comparisons
// against locally-constructed dates (weekStart, monthStart, etc.) are correct.
function parseLocalDate(str) {
  if (!str) return new Date(NaN);
  const [y, m, d] = str.split('-');
  return new Date(+y, +m - 1, +d);
}

// Today's date as a YYYY-MM-DD string in the user's local timezone. Using
// new Date().toISOString() returns the UTC date, which can be off-by-one
// in non-UTC timezones — e.g. at 9am local in AU, ISO date is still the
// previous calendar day.
function todayLocalStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
//  DATA SOURCE
// ============================================================
const SHEET_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSfVuGE4L38QC5CVV9zc3AN-vZ8Pi0ka7ieO10gpPZVq4bDYqoK41kUNaSxoKbGpmnEuwubg_Ln_mdE/pub';
const SHEET_URL_TOURNAMENTS = `${SHEET_BASE}?gid=718549522&single=true&output=csv`;
const SHEET_URL_MATCHES     = `${SHEET_BASE}?gid=531923703&single=true&output=csv`;
// SportCategories tab — gid 986148101.
// Columns: `category` (matches effectiveCategory output, e.g. "Tennis" or
// "Esports (VALORANT)") and `toprevsport` (yes/no).
const SHEET_URL_SPORT_CATEGORIES = `${SHEET_BASE}?gid=986148101&single=true&output=csv`;
// Columns: `name`, `description`, `startdate`, `enddate`, `linkedtournaments` (pipe-delimited tournament names).
const SHEET_URL_PROMOTIONS = `${SHEET_BASE}?gid=502400076&single=true&output=csv`;

let TOURNAMENTS = [];
let MATCHES = [];
let MATCHES_BY_TOURNAMENT = new Map();
let SPORT_CATEGORIES = []; // [{ category, topRevSport }]
let PROMOTIONS = []; // [{ name, description, startDate, endDate, linkedTournaments: [] }]
let PROMOTIONS_BY_TOURNAMENT = new Map(); // lowercase tournament name → [promo, …]
let _activeMatchTournament = null;

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
  // Flush trailing field/row if file doesn't end in a newline.
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

async function loadData() {
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

  // Promotions: traders enter manually-created promos. A promo can be tied
  // either to specific tournaments (`linkedtournaments`, pipe-delimited) or
  // to a whole sport/category (`sport`) — or both. Everything in the sheet
  // is shown (no expiry filter); the only filter is structural validity.
  PROMOTIONS = promoRows
    .map(get => {
      const startDate = get('startdate');
      const endDate   = get('enddate') || startDate;
      return {
        name:               get('name'),
        description:        get('description'),
        startDate,
        endDate,
        linkedTournaments:  parseLinkedTournaments(get('linkedtournaments')),
        sport:              get('sport'),
      };
    })
    .filter(p => p.name && p.startDate && p.endDate && (p.linkedTournaments.length > 0 || p.sport));

  // Build the by-tournament map. Sport-wide promos expand to every tournament
  // whose raw category, sub-category, or effectiveCategory matches the sport
  // string (case-insensitive). A tournament that's directly linked AND also
  // matches a promo's sport is only recorded once (Set per tournament).
  PROMOTIONS_BY_TOURNAMENT = new Map();
  const recordedPairs = new Set(); // "<tournamentKey>|<promoIndex>" guard
  PROMOTIONS.forEach((p, idx) => {
    const addPromoTo = name => {
      const key = name.toLowerCase();
      const pairKey = `${key}|${idx}`;
      if (recordedPairs.has(pairKey)) return;
      recordedPairs.add(pairKey);
      if (!PROMOTIONS_BY_TOURNAMENT.has(key)) PROMOTIONS_BY_TOURNAMENT.set(key, []);
      PROMOTIONS_BY_TOURNAMENT.get(key).push(p);
    };
    p.linkedTournaments.forEach(addPromoTo);
    if (p.sport) {
      const target = p.sport.toLowerCase();
      TOURNAMENTS.forEach(ev => {
        if ((ev.category && ev.category.toLowerCase() === target) ||
            (ev.subCategory && ev.subCategory.toLowerCase() === target) ||
            (effectiveCategory(ev).toLowerCase() === target)) {
          addPromoTo(ev.name);
        }
      });
    }
  });
}

function getPromotionsForTournament(name) {
  return PROMOTIONS_BY_TOURNAMENT.get((name || '').toLowerCase()) || [];
}

// "Has an active promo" = at least one linked promo whose date range includes today.
function hasActivePromo(ev) {
  const todayStr = todayLocalStr();
  return getPromotionsForTournament(ev.name)
    .some(p => p.startDate <= todayStr && todayStr <= p.endDate);
}

// ============================================================
//  PROMOTIONS FILTER STATE
// ============================================================
let showOnlyPromos = false;
function loadPromoFilter() {
  try { showOnlyPromos = localStorage.getItem('mjr_promo_only') === '1'; }
  catch { showOnlyPromos = false; }
}
function savePromoFilter() {
  try { localStorage.setItem('mjr_promo_only', showOnlyPromos ? '1' : '0'); } catch {}
}

function getMatchesForTournament(tournamentName) {
  return MATCHES_BY_TOURNAMENT.get((tournamentName || '').toLowerCase()) || [];
}

// ============================================================
//  FAVOURITES
// ============================================================
// Stable per-edition key: same tournament in 2026 vs 2027 are distinct favourites.
const FAV_KEY = 'mjr_favourites';
let favourites = new Set();
let showOnlyFavourites = false;

function favKeyOf(ev) { return `${ev.name}|${ev.startDate}`; }
function isFavourite(ev) { return favourites.has(favKeyOf(ev)); }

function loadFavourites() {
  try { favourites = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); }
  catch { favourites = new Set(); }
  try { showOnlyFavourites = localStorage.getItem('mjr_fav_only') === '1'; }
  catch { showOnlyFavourites = false; }
}
function saveFavourites() {
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...favourites])); } catch {}
}
function saveFavOnly() {
  try { localStorage.setItem('mjr_fav_only', showOnlyFavourites ? '1' : '0'); } catch {}
}
function toggleFavourite(ev) {
  const k = favKeyOf(ev);
  if (favourites.has(k)) favourites.delete(k); else favourites.add(k);
  saveFavourites();
}

// ============================================================
//  TOP REVENUE SPORTS
// ============================================================
// Driven by the SportCategories sheet tab — one row per sport, with a
// `toprevsport` column. `category` values must match what `effectiveCategory()`
// returns at runtime (e.g. "Tennis" or "Esports (VALORANT)").
let topRevenueSports = new Set();
let showOnlyTopRevenue = false;

function computeTopRevenueSports() {
  // Build a flagged-set from SportCategories rows.
  const flagged = new Set(
    SPORT_CATEGORIES.filter(c => c.topRevSport).map(c => c.category)
  );
  // Expand: an event is "top revenue" if either its raw `category` (e.g.
  // "Esports") OR its rendered `effectiveCategory()` (e.g. "Esports (VALORANT)")
  // is flagged. This lets the sheet hold a single high-level entry like
  // "Esports" that automatically covers every sub-categorised game.
  topRevenueSports = new Set();
  TOURNAMENTS.forEach(ev => {
    if (flagged.has(ev.category) || flagged.has(effectiveCategory(ev))) {
      topRevenueSports.add(effectiveCategory(ev));
    }
  });
}
function isTopRevenueSport(sport) {
  return topRevenueSports.has(sport);
}
function loadTopRevenueFilter() {
  try { showOnlyTopRevenue = localStorage.getItem('mjr_top_rev_only') === '1'; }
  catch { showOnlyTopRevenue = false; }
}
function saveTopRevenueFilter() {
  try { localStorage.setItem('mjr_top_rev_only', showOnlyTopRevenue ? '1' : '0'); } catch {}
}

// ============================================================
//  SETTINGS PANEL
// ============================================================
function openSettingsPanel() {
  document.getElementById('settingsBackdrop').classList.add('open');
  const panel = document.getElementById('settingsPanel');
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  renderSettings();
}

function closeSettingsPanel() {
  document.getElementById('settingsBackdrop').classList.remove('open');
  const panel = document.getElementById('settingsPanel');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
}

function isSettingsPanelOpen() {
  const panel = document.getElementById('settingsPanel');
  return panel && panel.classList.contains('open');
}

function renderSettings() {
  const content = document.getElementById('settingsContent');
  content.innerHTML = '';
  content.appendChild(renderSettingsFavourites());
  content.appendChild(renderSettingsShortcuts());
}

function renderSettingsShortcuts() {
  const section = document.createElement('div');
  section.className = 'settings-section';

  const header = document.createElement('div');
  header.className = 'settings-section-header';
  header.innerHTML = `
    <span class="settings-section-title"><i class="fa-solid fa-keyboard" style="color:#7ee787"></i> Keyboard shortcuts</span>
  `;
  section.appendChild(header);

  const list = document.createElement('div');
  list.className = 'settings-shortcut-list';
  const shortcuts = [
    { key: 'T',   label: 'Go to today' },
    { key: 'S',   label: 'Focus search' },
    { key: 'V',   label: 'Cycle view (Timeline → Calendar → Weekly)' },
    { key: 'Esc', label: 'Close panel · timeline: scroll to start · calendar/weekly: go to today' },
  ];
  shortcuts.forEach(s => {
    const row = document.createElement('div');
    row.className = 'settings-shortcut-row';
    row.innerHTML = `
      <span class="settings-shortcut-label">${s.label}</span>
      <kbd class="settings-kbd">${s.key}</kbd>
    `;
    list.appendChild(row);
  });
  section.appendChild(list);

  return section;
}

function renderSettingsFavourites() {
  const section = document.createElement('div');
  section.className = 'settings-section';

  const favEvents = TOURNAMENTS
    .filter(isFavourite)
    .sort((a, b) => a.name.localeCompare(b.name));

  const header = document.createElement('div');
  header.className = 'settings-section-header';
  header.innerHTML = `
    <span class="settings-section-title"><i class="fa-solid fa-star" style="color:#F7C948"></i> Favorite Events</span>
    <span class="settings-section-count">${favEvents.length}</span>
  `;
  section.appendChild(header);

  const list = document.createElement('div');
  list.className = 'settings-fav-list';
  section.appendChild(list);

  if (favEvents.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'settings-fav-empty';
    empty.textContent = 'No favorite events yet. Star a tournament on the timeline to add it here.';
    list.appendChild(empty);
  } else {
    favEvents.forEach(ev => list.appendChild(renderSettingsFavRow(ev)));
  }

  const actions = document.createElement('div');
  actions.className = 'settings-section-actions';
  const clearBtn = document.createElement('button');
  clearBtn.className = 'settings-clear-btn';
  clearBtn.textContent = 'Clear all favorite events';
  clearBtn.disabled = favEvents.length === 0;
  clearBtn.addEventListener('click', clearAllFavourites);
  actions.appendChild(clearBtn);
  section.appendChild(actions);

  return section;
}

function renderSettingsFavRow(ev) {
  const row = document.createElement('div');
  row.className = 'settings-fav-row';

  const sport = effectiveCategory(ev);
  const dateStr = ev.startDate === ev.endDate
    ? fmtDate(ev.startDate)
    : `${fmtDate(ev.startDate)} – ${fmtDate(ev.endDate)}`;
  const country = ev.country ? ` · ${ev.country}` : '';

  row.innerHTML = `
    <i class="fa-solid fa-star settings-fav-icon"></i>
    <div class="settings-fav-meta">
      <div class="settings-fav-name">${ev.name}</div>
      <div class="settings-fav-detail">${sport} · ${dateStr}${country}</div>
    </div>
  `;

  const unstar = document.createElement('button');
  unstar.className = 'settings-fav-unstar';
  unstar.title = 'Remove from favorite events';
  unstar.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  unstar.addEventListener('click', () => {
    toggleFavourite(ev);
    row.classList.add('removing');
    setTimeout(() => {
      renderSettings();           // refresh count + list
      updateFilterBtn();
      updateCwUI();
      rebuildViews();
      if (currentView === 'calendar' || currentView === 'weekly') rebuildCwView();
    }, 180);
  });
  row.appendChild(unstar);
  return row;
}

function clearAllFavourites() {
  if (favourites.size === 0) return;
  const msg = `Remove all ${favourites.size} favorite events?`;
  if (!confirm(msg)) return;
  favourites.clear();
  saveFavourites();
  renderSettings();
  updateFilterBtn();
  updateCwUI();
  rebuildViews();
  if (currentView === 'calendar' || currentView === 'weekly') rebuildCwView();
}

// ============================================================
//  DATA PREP
// ============================================================

// Categories listed here are never split out by sub-category — every event in
// the category collapses into one lane / row regardless of `sub-category`.
// Esports stays sub-categorised (CS2, VALORANT, etc. each get their own lane).
const NO_SUBCATEGORY_SPLIT = new Set(['Yachting']);

// Esports entries carry a `game` field — use "Esports (game)" as the row key.
// For categories in NO_SUBCATEGORY_SPLIT this collapses to the bare category,
// so they share a single lane regardless of sub-category.
function effectiveCategory(ev) {
  if (NO_SUBCATEGORY_SPLIT.has(ev.category)) return ev.category;
  return ev.subCategory ? `${ev.category} (${ev.subCategory})` : ev.category;
}

// Full label for display contexts (tooltips, details) that should always show
// both category AND sub-category even when the lane collapses. Use this
// instead of effectiveCategory() when the reader needs to know the sub-cat.
function fullCategoryLabel(ev) {
  return ev.subCategory ? `${ev.category} (${ev.subCategory})` : ev.category;
}

// Sport label tailored for tooltips: shows "Category (sub-category)" — but
// suppresses the sub-category when it substantially duplicates the tournament
// name (e.g. avoids "Yachting (Rolex Sydney Hobart Yacht Race 2026)" sitting
// on top of "Rolex Sydney Hobart Yacht Race").
function tooltipSportLabel(ev) {
  if (!ev.subCategory) return ev.category;
  const sub  = ev.subCategory.toLowerCase().trim();
  const name = (ev.name || '').toLowerCase().trim();
  if (name && sub && (name.includes(sub) || sub.includes(name))) return ev.category;
  return `${ev.category} (${ev.subCategory})`;
}

let catData = [];

function buildData() {
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

// ============================================================
//  COUNTRY DATA (lazy — computed on first use)
// ============================================================
let _countryData = null;
function getCountryData() {
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

function getCountryStatus({ events }) {
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

function getSortedCountryData() {
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
  // "everything in one place" philosophy. The NOW badge still appears for
  // countries with any currently-live event (driven by isActive).
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

// ============================================================
//  BUILD: MONTH HEADERS
// ============================================================
function buildMonthHeaders() {
  const header = document.getElementById('monthsHeader');
  header.style.width = TOTAL_W + 'px';

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let d = new Date(TIMELINE_START);
  d.setDate(1);

  while (d < TIMELINE_END) {
    const off         = dayOffset(d);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const leftPx      = Math.max(0, off * DAY_PX);

    if (off >= 0) {
      const div = document.createElement('div');
      div.className  = 'month-divider';
      div.style.left = (off * DAY_PX) + 'px';
      header.appendChild(div);
    }

    const block = document.createElement('div');
    block.className   = 'month-block';
    block.style.left  = leftPx + 'px';
    block.style.width = (daysInMonth * DAY_PX) + 'px';
    block.innerHTML   = `
      <div class="month-year-label">${d.getFullYear()}</div>
      <div class="month-name-label">${MONTH_NAMES[d.getMonth()]}</div>
    `;
    header.appendChild(block);

    d.setMonth(d.getMonth() + 1);
  }

  // TODAY label
  const todayOffH = dayOffset(new Date());
  if (todayOffH >= 0 && todayOffH <= TOTAL_DAYS) {
    const todayLbl = document.createElement('div');
    todayLbl.className  = 'today-header-label';
    todayLbl.style.left = (todayOffH * DAY_PX) + 'px';
    todayLbl.textContent = 'TODAY';
    header.appendChild(todayLbl);
  }

  // Star markers — assign vertical lanes so no two labels ever overlap horizontally
  const LABEL_SLOT_H = 20; // px per lane slot — 3 lanes fit within the 64px header

  // Header rail shows ONLY tournaments explicitly pinned via the `toppin`
  // spreadsheet column. Works for any format (single-day OR multi-day).
  const headerEvents = TOURNAMENTS
    .filter(ev => ev.topPin === true)
    .map(ev => ({ ev, x: dayOffset(ev.startDate) * DAY_PX }))
    .filter(({ x }) => x >= 0 && x <= TOTAL_W)
    .sort((a, b) => a.x - b.x);

  // Estimate rendered label width (capped at max-width 120px) + small buffer
  function estLabelW(name) {
    return Math.min((name.length + 2) * 6.5 + 14, 120) + 6;
  }

  const laneEnd = []; // rightmost x occupied per lane
  headerEvents.forEach(item => {
    let lane = laneEnd.findIndex(right => right <= item.x);
    if (lane === -1) lane = laneEnd.length;
    laneEnd[lane] = item.x + estLabelW(item.ev.name);
    item.lane = lane;
  });

  headerEvents.forEach(({ ev, x, lane }) => {
    const marker = document.createElement('div');
    marker.className  = 'event-header-marker';
    marker.style.left = x + 'px';

    // Spacer pushes label down to the correct lane row
    if (lane > 0) {
      const spacer = document.createElement('div');
      spacer.style.cssText = `height:${lane * LABEL_SLOT_H}px;flex-shrink:0`;
      marker.appendChild(spacer);
    }

    // Every entry here is a `toppin` tournament — always render in the
    // original gold pill so it stands out as a curated, featured event.
    const label = document.createElement('div');
    label.className   = 'event-header-label';
    label.textContent = `★ ${ev.name}`;
    label.addEventListener('mouseenter', e => showTooltip(e, ev, '#F7C948'));
    label.addEventListener('mousemove',  moveTooltip);
    label.addEventListener('mouseleave', hideTooltip);
    label.addEventListener('click', () => navigateToEvent(ev));
    marker.appendChild(label);

    const tick = document.createElement('div');
    tick.className = 'event-header-tick';
    marker.appendChild(tick);

    header.appendChild(marker);
  });
}

// ============================================================
//  BUILD: PROMOTIONS RAIL
// ============================================================
// Horizontal rail above the timeline rows that surfaces all active and
// upcoming promotions. Each promo becomes a pill positioned at startDate
// → endDate. Overlapping promos stack into lanes. Hides itself when empty.
function buildPromoRail() {
  const rail = document.getElementById('promoRail');
  const sidebarSection = document.getElementById('sidebarPromoSection');
  if (!rail) return;
  rail.innerHTML = '';
  if (sidebarSection) sidebarSection.innerHTML = '';
  rail.style.width = TOTAL_W + 'px';

  if (PROMOTIONS.length === 0) {
    rail.classList.add('promo-rail-empty');
    if (sidebarSection) sidebarSection.classList.add('sidebar-promo-section-empty');
    return;
  }
  rail.classList.remove('promo-rail-empty');
  if (sidebarSection) sidebarSection.classList.remove('sidebar-promo-section-empty');

  // Clip to the visible timeline window; sort left-to-right for lane packing.
  const items = PROMOTIONS
    .map(p => {
      const startOff = dayOffset(p.startDate);
      const endOff   = dayOffset(p.endDate);
      return {
        p,
        x:     startOff * DAY_PX,
        width: Math.max(DAY_PX, (endOff - startOff + 1) * DAY_PX),
        endX:  (endOff + 1) * DAY_PX,
      };
    })
    .filter(it => it.endX > 0 && it.x < TOTAL_W)
    .sort((a, b) => a.x - b.x);

  // Greedy lane packing — same approach as the toppin rail.
  const laneEnd = [];
  items.forEach(it => {
    let lane = laneEnd.findIndex(right => right <= it.x);
    if (lane === -1) lane = laneEnd.length;
    laneEnd[lane] = it.x + it.width;
    it.lane = lane;
  });

  const LANE_H = 24;
  const railHeight = Math.max(1, laneEnd.length) * LANE_H + 6;
  rail.style.height = railHeight + 'px';

  // Mirror the rail height in the sidebar so the "Promotions" label sits at
  // the same Y as the pills, regardless of lane count. The label itself is
  // clickable and opens the promo panel.
  if (sidebarSection) {
    sidebarSection.style.height = railHeight + 'px';
    sidebarSection.innerHTML = `
      <i class="fa-solid fa-gift sidebar-promo-icon"></i>
      <span class="sidebar-promo-label">Promotions</span>
      <span class="sidebar-promo-count">${PROMOTIONS.length}</span>
    `;
    sidebarSection.classList.add('sidebar-promo-clickable');
    sidebarSection.title = 'See all promotions';
    sidebarSection.onclick = openPromoPanel;
  }

  const todayStr = todayLocalStr();
  items.forEach(it => {
    const pill = document.createElement('div');
    const isPast = it.p.endDate < todayStr;
    pill.className   = 'promo-pill' + (isPast ? ' promo-pill-past' : '');
    pill.style.left  = Math.max(0, it.x) + 'px';
    pill.style.width = Math.min(it.width, TOTAL_W - Math.max(0, it.x)) + 'px';
    pill.style.top   = (it.lane * LANE_H + 3) + 'px';

    const showLabel = it.width >= 80;
    pill.innerHTML = showLabel
      ? `<i class="fa-solid fa-gift promo-pill-icon"></i><span class="promo-pill-name">${it.p.name}</span>`
      : `<i class="fa-solid fa-gift promo-pill-icon"></i>`;
    if (!showLabel) pill.classList.add('promo-pill-icon-only');

    pill.addEventListener('mouseenter', e => showPromoTooltip(e, it.p));
    pill.addEventListener('mousemove',  moveTooltip);
    pill.addEventListener('mouseleave', hideTooltip);
    pill.addEventListener('click', () => {
      // If the promo links to a tournament that's on-screen, scroll to it.
      const first = it.p.linkedTournaments[0];
      if (!first) return;
      const ev = TOURNAMENTS.find(t => t.name.toLowerCase() === first.toLowerCase());
      if (ev) navigateToEvent(ev);
    });

    rail.appendChild(pill);
  });
}

function showPromoTooltip(e, promo) {
  const dateLabel = promo.startDate === promo.endDate
    ? fmtDate(promo.startDate)
    : `${fmtDate(promo.startDate)} – ${fmtDate(promo.endDate)}`;
  const sportRow = promo.sport
    ? `<div class="tt-row"><i class="fa-solid fa-layer-group tt-icon"></i><span class="tt-text">Sport: ${promo.sport}</span></div>`
    : '';
  const tournamentsRow = promo.linkedTournaments.length
    ? `<div class="tt-row"><i class="fa-solid fa-trophy tt-icon"></i><span class="tt-text">${promo.linkedTournaments.join(', ')}</span></div>`
    : '';
  tooltip.innerHTML = `
    <div class="tt-sport" style="color:#c084fc"><i class="fa-solid fa-gift"></i> Promotion</div>
    <div class="tt-name">${promo.name}</div>
    ${promo.description ? `<div class="tt-promo-desc">${promo.description}</div>` : ''}
    <div class="tt-row"><i class="fa-solid fa-calendar tt-icon"></i><span class="tt-text">${dateLabel}</span></div>
    ${sportRow}
    ${tournamentsRow}
  `;
  tooltip.classList.add('visible');
  moveTooltip(e);
}

// Bar-badge tooltip — lists every active promo for a single tournament. Used
// when the user hovers the gift icon embedded in the tournament bar.
function showBarPromoTooltip(e, promos) {
  const rows = promos.map(p => {
    const dateLabel = p.startDate === p.endDate
      ? fmtDate(p.startDate)
      : `${fmtDate(p.startDate)} – ${fmtDate(p.endDate)}`;
    return `
      <div class="tt-promo-item">
        <div class="tt-promo-name">${p.name}</div>
        ${p.description ? `<div class="tt-promo-desc">${p.description}</div>` : ''}
        <div class="tt-promo-date">${dateLabel}</div>
      </div>
    `;
  }).join('');
  tooltip.innerHTML = `
    <div class="tt-sport" style="color:#c084fc"><i class="fa-solid fa-gift"></i> ${promos.length === 1 ? 'Promotion' : `${promos.length} Promotions`}</div>
    ${rows}
  `;
  tooltip.classList.add('visible');
  moveTooltip(e);
}

// ============================================================
//  PROMOTIONS PANEL
// ============================================================
function openPromoPanel() {
  if (PROMOTIONS.length === 0) return;
  renderPromoPanel();
  document.getElementById('promoPanelBackdrop').classList.add('open');
  const panel = document.getElementById('promoPanel');
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
}

function closePromoPanel() {
  document.getElementById('promoPanelBackdrop').classList.remove('open');
  const panel = document.getElementById('promoPanel');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
}

function isPromoPanelOpen() {
  const panel = document.getElementById('promoPanel');
  return panel && panel.classList.contains('open');
}

function renderPromoPanel() {
  const content = document.getElementById('promoPanelContent');
  content.innerHTML = '';

  const todayStr = todayLocalStr();
  const active = [], upcoming = [], past = [];
  PROMOTIONS.forEach(p => {
    if (p.endDate < todayStr) past.push(p);
    else if (p.startDate > todayStr) upcoming.push(p);
    else active.push(p);
  });
  active.sort((a, b)   => a.startDate.localeCompare(b.startDate));
  upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));
  past.sort((a, b)     => b.endDate.localeCompare(a.endDate)); // most recently ended first

  const sections = [
    { label: 'Active',   items: active,   tone: 'active'   },
    { label: 'Upcoming', items: upcoming, tone: 'upcoming' },
    { label: 'Past',     items: past,     tone: 'past'     },
  ];

  let renderedAny = false;
  sections.forEach(s => {
    if (s.items.length === 0) return;
    renderedAny = true;
    const section = document.createElement('div');
    section.className = 'promo-panel-section';

    const header = document.createElement('div');
    header.className = 'promo-panel-section-header';
    header.innerHTML = `
      <span class="promo-panel-section-title">${s.label}</span>
      <span class="promo-panel-section-count">${s.items.length}</span>
    `;
    section.appendChild(header);

    s.items.forEach(p => section.appendChild(renderPromoCard(p, s.tone)));
    content.appendChild(section);
  });

  if (!renderedAny) {
    const empty = document.createElement('div');
    empty.className = 'promo-panel-empty';
    empty.textContent = 'No promotions yet. Add rows to the Promotions tab in the sheet.';
    content.appendChild(empty);
  }
}

function renderPromoCard(promo, tone) {
  const card = document.createElement('div');
  card.className = `promo-card promo-card-${tone}`;

  const dateLabel = promo.startDate === promo.endDate
    ? fmtDate(promo.startDate)
    : `${fmtDate(promo.startDate)} – ${fmtDate(promo.endDate)}`;

  const tournamentChips = promo.linkedTournaments.map(name => {
    const ev = TOURNAMENTS.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (ev) {
      return `<button class="promo-card-chip" data-evname="${ev.name.replace(/"/g, '&quot;')}"><i class="fa-solid fa-trophy"></i>${name}</button>`;
    }
    return `<span class="promo-card-chip promo-card-chip-missing" title="Not found in tournaments sheet">${name}</span>`;
  }).join('');

  // Sport-wide chip — shown when the promo has a `sport` value. Distinct
  // visual so traders see at a glance "this applies to every UFC event"
  // rather than mistaking it for a single tournament link.
  const sportChip = promo.sport
    ? `<span class="promo-card-chip promo-card-chip-sport" title="Applies to every event in this sport"><i class="fa-solid fa-layer-group"></i>${promo.sport}</span>`
    : '';
  const chipsHtml = sportChip + tournamentChips;

  card.innerHTML = `
    <div class="promo-card-top">
      <span class="promo-card-name">${promo.name}</span>
      <span class="promo-card-tone-badge promo-card-tone-${tone}">${tone}</span>
    </div>
    ${promo.description ? `<div class="promo-card-desc">${promo.description}</div>` : ''}
    <div class="promo-card-meta">
      <i class="fa-solid fa-calendar"></i><span>${dateLabel}</span>
    </div>
    ${chipsHtml ? `<div class="promo-card-chips">${chipsHtml}</div>` : ''}
  `;

  // Wire chip clicks: navigate to the tournament in the timeline and close the panel.
  card.querySelectorAll('button.promo-card-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const ev = TOURNAMENTS.find(t => t.name === btn.dataset.evname);
      if (ev) {
        closePromoPanel();
        navigateToEvent(ev);
      }
    });
  });

  return card;
}

// ============================================================
//  SORT MODE + FILTERS
// ============================================================
let sortMode = 'live';
let activeFilters = new Set();

function loadFilters() {
  try {
    const saved = localStorage.getItem(`mjr_filters_${sortMode}`);
    activeFilters = saved ? new Set(JSON.parse(saved)) : new Set();
  } catch { activeFilters = new Set(); }
  updateFilterBtn();
}

function saveFilters() {
  localStorage.setItem(`mjr_filters_${sortMode}`, JSON.stringify([...activeFilters]));
}

function updateFilterBtn() {
  const btn = document.getElementById('filterBtn');
  if (!btn) return;
  const count = activeFilters.size + (showOnlyFavourites ? 1 : 0) + (showOnlyTopRevenue ? 1 : 0) + (showOnlyPromos ? 1 : 0);
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

function toggleFilterPanel() {
  const panel = document.getElementById('filterPanel');
  const isOpen = panel.classList.toggle('open');
  if (isOpen) renderFilterOptions();
}

function renderFilterOptions() {
  const container = document.getElementById('filterOptions');
  container.innerHTML = '';

  // Favourites toggle — always at the top of the panel
  const favLabel = document.createElement('label');
  favLabel.className = 'filter-option filter-option-fav';
  const favCb = document.createElement('input');
  favCb.type = 'checkbox';
  favCb.checked = showOnlyFavourites;
  favCb.addEventListener('change', () => {
    showOnlyFavourites = favCb.checked;
    saveFavOnly();
    updateFilterBtn();
    rebuildViews();
    if (currentView === 'calendar' || currentView === 'weekly') rebuildCwView();
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
      showOnlyTopRevenue = trCb.checked;
      saveTopRevenueFilter();
      updateFilterBtn();
      rebuildViews();
      if (currentView === 'calendar' || currentView === 'weekly') rebuildCwView();
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
      showOnlyPromos = prCb.checked;
      savePromoFilter();
      updateFilterBtn();
      rebuildViews();
      if (currentView === 'calendar' || currentView === 'weekly') rebuildCwView();
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

function clearFilters() {
  activeFilters.clear();
  showOnlyFavourites = false;
  showOnlyTopRevenue = false;
  showOnlyPromos = false;
  saveFilters();
  saveFavOnly();
  saveTopRevenueFilter();
  savePromoFilter();
  updateFilterBtn();
  renderFilterOptions();
  rebuildViews();
}

function rebuildViews() {
  document.getElementById('sidebarRows').innerHTML = '';
  document.getElementById('timelineRows').innerHTML = '';
  buildSidebar();
  buildTimelineRows();
}

function initFilterClickOutside() {
  document.addEventListener('click', e => {
    const panel = document.getElementById('filterPanel');
    const btn   = document.getElementById('filterBtn');
    if (panel.classList.contains('open') && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
      panel.classList.remove('open');
    }
  });
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

function getSortedCatData() {
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

  // Live mode: pull active events into compact top rows; rest sorts below
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

function toggleSidebar() {
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

function setSort(mode) {
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

// ============================================================
//  BUILD: SIDEBAR
// ============================================================
function buildSidebar() {
  const container = document.getElementById('sidebarRows');
  container.innerHTML = '';

  if (sortMode === 'country') {
    getSortedCountryData().forEach(({ country, events, rowHeight, isLiveSlice, isActive, nextMs }) => {
      const today    = new Date(); today.setHours(0, 0, 0, 0);
      const nextDays = nextMs !== null ? Math.round((nextMs - today.getTime()) / 86400000) : null;
      const nextEv   = nextMs !== null ? events.find(ev => new Date(ev.startDate).getTime() === nextMs) : null;

      let statusHtml = '';
      if (isLiveSlice || isActive) {
        statusHtml = `<span class="status-now">NOW</span>`;
      } else if (nextDays !== null) {
        statusHtml = `<span class="status-soon">in ${nextDays}d</span>`;
      }

      const row = document.createElement('div');
      row.className    = 'sidebar-row';
      row.style.height = rowHeight + 'px';
      row.title        = country;
      row.innerHTML = `
        <div class="category-icon" style="font-size:24px">${getFlag(country)}</div>
        <div class="category-label" title="${country}">${country}</div>
        ${statusHtml}
      `;
      if (nextEv) {
        const badge = row.querySelector('.status-soon');
        if (badge) {
          badge.classList.add('status-soon-link');
          badge.addEventListener('click', e => { e.stopPropagation(); navigateToEvent(nextEv, true); });
        }
      }
      container.appendChild(row);
    });
    return;
  }

  getSortedCatData().forEach(({ cat, events, rowHeight, isLiveSlice, isActive, nextMs }) => {
    const iconCls = SPORT_ICONS[cat] || 'fa-solid fa-trophy';
    const logoUrl = ESPORTS_LOGOS[cat];
    const iconHtml = logoUrl
      ? `<img src="${logoUrl}" class="esports-logo" alt="${cat}" onerror="this.replaceWith(Object.assign(document.createElement('i'),{className:'${iconCls}'}))">`
      : `<i class="${iconCls}"></i>`;
    const nextEv = nextMs !== null ? events.find(ev => new Date(ev.startDate).getTime() === nextMs) : null;

    let statusHtml = '';
    if (isLiveSlice || isActive) {
      statusHtml = `<span class="status-now">NOW</span>`;
    } else if (nextMs !== null) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const nextDays = Math.round((nextMs - today.getTime()) / 86400000);
      statusHtml = `<span class="status-soon">in ${nextDays}d</span>`;
    }

    const row = document.createElement('div');
    row.className    = 'sidebar-row';
    row.style.height = rowHeight + 'px';
    row.title        = cat;
    const topRevHtml = isTopRevenueSport(cat)
      ? '<i class="fa-solid fa-dollar-sign sidebar-toprev-icon" title="Top revenue sport"></i>'
      : '';
    row.innerHTML = `
      <div class="category-icon">${iconHtml}</div>
      <div class="category-label" title="${cat}">${cat}${topRevHtml}</div>
      ${statusHtml}
    `;
    if (nextEv) {
      const badge = row.querySelector('.status-soon');
      if (badge) {
        badge.classList.add('status-soon-link');
        badge.addEventListener('click', e => { e.stopPropagation(); navigateToEvent(nextEv, true); });
      }
    }
    container.appendChild(row);
  });
}

// ============================================================
//  BUILD: TIMELINE ROWS + BARS
// ============================================================
function buildTimelineRows() {
  const rowsEl = document.getElementById('timelineRows');
  rowsEl.style.width = TOTAL_W + 'px';

  // Month grid lines
  let d = new Date(TIMELINE_START); d.setDate(1);
  while (d < TIMELINE_END) {
    const off = dayOffset(d);
    if (off >= 0) {
      const gl = document.createElement('div');
      gl.className  = 'grid-line-month';
      gl.style.left = (off * DAY_PX) + 'px';
      rowsEl.appendChild(gl);
    }
    d.setMonth(d.getMonth() + 1);
  }

  // Today marker
  const todayOff = dayOffset(new Date());
  if (todayOff >= 0 && todayOff <= TOTAL_DAYS) {
    const tm = document.createElement('div');
    tm.className  = 'today-marker';
    tm.style.left = (todayOff * DAY_PX) + 'px';
    rowsEl.appendChild(tm);
  }

  function makeBar(ev, startPx, widthPx, topPx, laneIdx, sportColor, isCountryView) {
    const isEvent = ev.format === 'event' || ev.format === 'onedayevent' || ev.format === 'race';
    const bar = document.createElement('div');
    bar.className = 'tournament-bar';
    bar.dataset.evName = ev.name;

    if (isEvent) {
      const isMono = !ev.highlight;
      bar.className = 'event-star-marker' + (isMono ? ' is-mono' : '');
      bar.style.cssText = `
        left:${startPx}px; top:${topPx}px;
        z-index:${10 + laneIdx};
      `;
      if (isMono) {
        const iconCls = SPORT_ICONS[effectiveCategory(ev)] || 'fa-solid fa-trophy';
        bar.innerHTML = `<i class="${iconCls}"></i>`;
      } else {
        bar.textContent = '★';
      }
    } else {
      bar.style.cssText = `
        left:${startPx}px; width:${widthPx}px; top:${topPx}px; height:${BAR_H}px;
        background:linear-gradient(135deg,#2d333b 0%,#1c2128 100%);
        border-left:3px solid #444c56;
        z-index:${10 + laneIdx};
      `;

      // Decide up-front whether the bar will get a today-sticker label, so the
      // in-bar label can be suppressed to avoid showing the name twice.
      let willShowTodayLabel = false;
      let todayPxCached = 0;
      const todayPx = dayOffset(new Date()) * DAY_PX;
      if (startPx < todayPx && startPx + widthPx > todayPx) {
        const remainingW = startPx + widthPx - todayPx;
        const approxMinW = ev.name.length * 6.5 + 44; // flag + text + padding estimate
        if (remainingW >= approxMinW) {
          willShowTodayLabel = true;
          todayPxCached = todayPx;
        }
      }

      if (willShowTodayLabel) {
        // Today-sticker handles the label entirely; leave the bar's left edge empty.
      } else if (isCountryView) {
        const iconCls = SPORT_ICONS[effectiveCategory(ev)] || 'fa-solid fa-trophy';
        if (widthPx >= 58) {
          bar.innerHTML = `<i class="${iconCls} bar-flag" style="font-size:13px"></i><span class="bar-text">${ev.name}</span>`;
        } else if (widthPx >= 34) {
          bar.innerHTML = `<i class="${iconCls} bar-flag" style="font-size:13px"></i>`;
        }
      } else {
        const flag = getFlag(ev.country);
        if (widthPx >= 58) {
          bar.innerHTML = `<span class="bar-flag">${flag}</span><span class="bar-text">${ev.name}</span>`;
        } else if (widthPx >= 34) {
          bar.innerHTML = `<span class="bar-flag">${flag}</span>`;
        }
      }

      if (willShowTodayLabel) {
        const offsetInBar = todayPxCached - startPx;
        const todayLabel  = document.createElement('div');
        todayLabel.className  = 'bar-today-label';
        todayLabel.style.left = (offsetInBar + 8) + 'px';
        if (isCountryView) {
          const iconCls = SPORT_ICONS[effectiveCategory(ev)] || 'fa-solid fa-trophy';
          todayLabel.innerHTML = `<i class="${iconCls}" style="font-size:13px;flex-shrink:0"></i><span class="bar-text">${ev.name}</span>`;
        } else {
          todayLabel.innerHTML = `<span class="bar-flag">${getFlag(ev.country)}</span><span class="bar-text">${ev.name}</span>`;
        }
        bar.appendChild(todayLabel);
      }

      // Favourite star — only when bar is wide enough to fit the icon comfortably.
      if (widthPx >= 58) {
        bar.classList.add('has-fav');
        const favBtn = document.createElement('button');
        const fav = isFavourite(ev);
        favBtn.className = 'bar-fav-btn' + (fav ? ' is-fav' : '');
        favBtn.title = fav ? 'Remove from favorite events' : 'Add to favorite events';
        favBtn.innerHTML = `<i class="${fav ? 'fa-solid' : 'fa-regular'} fa-star"></i>`;
        favBtn.addEventListener('click', e => {
          e.stopPropagation();
          toggleFavourite(ev);
          if (showOnlyFavourites) {
            rebuildViews();
          } else {
            const nowFav = isFavourite(ev);
            favBtn.classList.toggle('is-fav', nowFav);
            favBtn.title = nowFav ? 'Remove from favorite events' : 'Add to favorite events';
            favBtn.innerHTML = `<i class="${nowFav ? 'fa-solid' : 'fa-regular'} fa-star"></i>`;
          }
        });
        bar.appendChild(favBtn);
      }

      // Promo badge — indicates this tournament has 1+ active promotions linked
      // to it. Hover shows the promo list; click is a no-op (tooltip is the
      // primary affordance). Mirrors the fav star: only renders when bar is wide.
      const promos = getPromotionsForTournament(ev.name);
      // Visual highlight (purple ring + glow) when at least one promo is
      // currently running — applies regardless of bar width, so even narrow
      // bars get the cue.
      if (hasActivePromo(ev)) {
        bar.classList.add('bar-promo-active');
      }
      if (promos.length > 0 && widthPx >= 58) {
        bar.classList.add('has-promo');
        const promoBtn = document.createElement('button');
        promoBtn.className = 'bar-promo-btn';
        promoBtn.title = promos.length === 1
          ? `Promotion: ${promos[0].name}`
          : `${promos.length} active promotions`;
        promoBtn.innerHTML = `<i class="fa-solid fa-gift"></i>`;
        promoBtn.addEventListener('mouseenter', e => showBarPromoTooltip(e, promos));
        promoBtn.addEventListener('mousemove',  moveTooltip);
        promoBtn.addEventListener('mouseleave', hideTooltip);
        promoBtn.addEventListener('click', e => e.stopPropagation());
        bar.appendChild(promoBtn);
      }
    }

    if (!isEvent && ev.highlight) {
      bar.classList.add('bar-highlight');
      const shimmer = document.createElement('div');
      shimmer.className = 'shimmer-sweep';
      bar.appendChild(shimmer);
    }

    const ttColor = isEvent ? '#F7C948' : sportColor;
    bar.addEventListener('mouseenter', e => showTooltip(e, ev, ttColor));
    bar.addEventListener('mousemove',  moveTooltip);
    bar.addEventListener('mouseleave', hideTooltip);
    return bar;
  }

  // Country rows
  if (sortMode === 'country') {
    getSortedCountryData().forEach(({ country, events, rowHeight }) => {
      const row = document.createElement('div');
      row.className    = 'timeline-row';
      row.style.height = rowHeight + 'px';
      events.forEach(ev => {
        const color   = getColor(effectiveCategory(ev));
        const startPx = dayOffset(ev.startDate) * DAY_PX;
        const widthPx = Math.max(ev.lengthDays * DAY_PX, 6);
        const topPx   = ROW_PAD + ev._cLane * LANE_H;
        row.appendChild(makeBar(ev, startPx, widthPx, topPx, ev._cLane, color, true));
      });
      rowsEl.appendChild(row);
    });
    return;
  }

  // Category rows
  getSortedCatData().forEach(({ cat, events, rowHeight }) => {
    const color = getColor(cat);
    const row   = document.createElement('div');
    row.className    = 'timeline-row';
    row.style.height = rowHeight + 'px';
    events.forEach(ev => {
      const startPx = dayOffset(ev.startDate) * DAY_PX;
      const widthPx = Math.max(ev.lengthDays * DAY_PX, 6);
      const topPx   = ROW_PAD + ev._lane * LANE_H;
      row.appendChild(makeBar(ev, startPx, widthPx, topPx, ev._lane, color, false));
    });
    rowsEl.appendChild(row);
  });
}

// ============================================================
//  TOOLTIP
// ============================================================
const tooltip = document.getElementById('tooltip');

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function showTooltip(e, ev, color) {
  const countries = parseCountries(ev.country);
  const countryRows = (countries.length ? countries : [ev.country]).map(c =>
    `<div class="tt-row"><span class="tt-flag">${getFlag(c)}</span><span class="tt-text">${c}</span></div>`
  ).join('');
  const subRow = ev.subCategory ? `<div class="tt-subsport">${ev.subCategory}</div>` : '';
  const dateLabel = ev.startDate === ev.endDate
    ? fmtDate(ev.startDate)
    : `${fmtDate(ev.startDate)} – ${fmtDate(ev.endDate)}`;
  tooltip.innerHTML = `
    <div class="tt-sport" style="color:${color}">${ev.category}</div>
    ${subRow}
    <div class="tt-name">${ev.name}</div>
    ${countryRows}
    <div class="tt-row"><i class="fa-solid fa-calendar tt-icon"></i><span class="tt-text">${dateLabel}</span></div>
    <div class="tt-row"><i class="fa-solid fa-clock tt-icon"></i><span class="tt-text">${ev.lengthDays} day${ev.lengthDays !== 1 ? 's' : ''}</span></div>
  `;
  tooltip.classList.add('visible');
  moveTooltip(e);
}

function moveTooltip(e) {
  const pad = 14, tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  let x = e.clientX + pad, y = e.clientY + pad;
  if (x + tw > window.innerWidth)  x = e.clientX - tw - pad;
  if (y + th > window.innerHeight) y = e.clientY - th - pad;
  tooltip.style.left = x + 'px';
  tooltip.style.top  = y + 'px';
}

function hideTooltip() { tooltip.classList.remove('visible'); }

// ============================================================
//  VERTICAL SCROLL SYNC
// ============================================================
function initScrollSync() {
  const wrapper     = document.getElementById('timelineWrapper');
  const sidebarRows = document.getElementById('sidebarRows');

  wrapper.addEventListener('scroll', () => {
    sidebarRows.scrollTop = wrapper.scrollTop;
  });

  // Forward wheel events on the sidebar to the timeline
  document.querySelector('.sidebar').addEventListener('wheel', e => {
    e.preventDefault();
    wrapper.scrollTop += e.deltaY;
  }, { passive: false });
}

// ============================================================
//  MOBILE TOUCH SCROLL FORWARDING
// ============================================================
function initMobileTouch() {
  if (window.innerWidth > 768) return;

  const wrapper     = document.getElementById('timelineWrapper');
  const filterPanel = document.getElementById('filterPanel');

  // Forward vertical swipes on `el` to the timeline wrapper.
  // A tap (no real movement) is left alone so existing click/onclick handlers fire.
  function addScrollForwarding(el) {
    let startY, startX, lastY;

    el.addEventListener('touchstart', e => {
      startY = lastY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
    }, { passive: true });

    el.addEventListener('touchmove', e => {
      if (filterPanel.classList.contains('open')) return;
      const currentY = e.touches[0].clientY;
      const totalDy  = Math.abs(currentY - startY);
      const totalDx  = Math.abs(e.touches[0].clientX - startX);
      // Only intercept clearly vertical swipes (> 4 px and more vertical than horizontal)
      if (totalDy > 4 && totalDy > totalDx) {
        wrapper.scrollTop -= (currentY - lastY);
        e.preventDefault(); // suppresses the onclick so sidebar doesn't toggle on scroll
      }
      lastY = currentY;
    }, { passive: false });
  }

  addScrollForwarding(document.querySelector('.sidebar'));
  addScrollForwarding(document.getElementById('sidebarBackdrop'));
}

// ============================================================
//  DRAG-TO-SCROLL
// ============================================================
function initDragScroll() {
  const wrapper = document.getElementById('timelineWrapper');
  let dragging  = false, startX, startY, scrollX, scrollY;

  wrapper.addEventListener('mousedown', e => {
    if (e.target.closest('.tournament-bar')) return;
    dragging = true;
    startX   = e.clientX;
    startY   = e.clientY;
    scrollX  = wrapper.scrollLeft;
    scrollY  = wrapper.scrollTop;
    wrapper.classList.add('is-dragging');
  });

  document.addEventListener('mouseup', () => {
    dragging = false;
    wrapper.classList.remove('is-dragging');
  });

  wrapper.addEventListener('mousemove', e => {
    if (!dragging) return;
    e.preventDefault();
    wrapper.scrollLeft = scrollX - (e.clientX - startX);
    wrapper.scrollTop  = scrollY - (e.clientY - startY);
  });
}

// ============================================================
//  SCROLL TO TODAY
// ============================================================
function animateScroll(targetX, duration) {
  const wrapper = document.getElementById('timelineWrapper');
  const startX  = wrapper.scrollLeft;
  const delta   = targetX - startX;
  const t0      = performance.now();

  function step(now) {
    const p    = Math.min((now - t0) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 4);   // ease-out quartic
    wrapper.scrollLeft = startX + delta * ease;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function scrollToStart() {
  const wrapper = document.getElementById('timelineWrapper');
  const todayPx = dayOffset(new Date()) * DAY_PX;
  const targetX = Math.max(0, todayPx - wrapper.clientWidth * 0.25);
  const targetY = 0;
  const startX  = wrapper.scrollLeft;
  const startY  = wrapper.scrollTop;
  const deltaX  = targetX - startX;
  const deltaY  = targetY - startY;
  const t0      = performance.now();

  (function step(now) {
    const p    = Math.min((now - t0) / 1400, 1);
    const ease = 1 - Math.pow(1 - p, 4);
    wrapper.scrollLeft = startX + deltaX * ease;
    wrapper.scrollTop  = startY + deltaY * ease;
    if (p < 1) requestAnimationFrame(step);
  })(performance.now());
}

function goToToday() {
  if (currentView === 'timeline') {
    scrollToToday();
  } else if (currentView === 'calendar') {
    const container = document.getElementById('calendarView');
    const cell      = container.querySelector('.cal-month-current');
    if (cell) scrollToEl(container, cell);
  } else if (currentView === 'weekly') {
    const container = document.getElementById('weeklyMainPanel') || document.getElementById('weeklyView');
    const section   = container.querySelector('.week-section.week-current');
    if (section) scrollToEl(container, section);
  }
}

function scrollToToday() {
  const wrapper  = document.getElementById('timelineWrapper');
  const todayPx  = dayOffset(new Date()) * DAY_PX;
  const targetX  = Math.max(0, todayPx - wrapper.clientWidth * 0.25);
  animateScroll(targetX, 1400);
}

// ============================================================
//  NAVIGATE TO EVENT (shared by search + header click)
// ============================================================

// Scroll `container` so `targetEl` sits just below any sticky header inside it.
function scrollToEl(container, targetEl, smooth = true) {
  const stickyEl = container.querySelector('.weekly-year-label, .cal-year-label');
  const stickyH  = stickyEl ? stickyEl.offsetHeight : 0;
  // Sticky elements pin to the container's padding-box top, so the container's
  // own padding-top sits above the sticky's stuck position. Subtract both.
  const padTop   = parseFloat(getComputedStyle(container).paddingTop) || 0;
  const cr       = container.getBoundingClientRect();
  const tr       = targetEl.getBoundingClientRect();
  const top      = container.scrollTop + (tr.top - cr.top) - stickyH - padTop;
  container.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'instant' });
}

function scrollToWeekEvent(ev) {
  const evDate    = parseLocalDate(ev.startDate);
  const container = document.getElementById('weeklyMainPanel') || document.getElementById('weeklyView');
  const sections  = container.querySelectorAll('.week-section[data-week-start]');
  for (const section of sections) {
    const ws = parseLocalDate(section.dataset.weekStart);
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    if (evDate >= ws && evDate <= we) {
      scrollToEl(container, section);
      section.querySelectorAll('.week-event-item').forEach(item => {
        if (item.dataset.evName === ev.name) {
          item.classList.add('week-event-flash');
          item.addEventListener('animationend', () => item.classList.remove('week-event-flash'), { once: true });
        }
      });
      break;
    }
  }
}

function scrollToCalendarEvent(ev) {
  const evDate    = new Date(ev.startDate);
  const container = document.getElementById('calendarView');
  const cell      = container.querySelector(`.cal-month-cell[data-year-month="${evDate.getFullYear()}-${evDate.getMonth()}"]`);
  if (!cell) return;
  scrollToEl(container, cell);
  cell.querySelectorAll('.cal-event-item').forEach(item => {
    if (item.dataset.evName === ev.name) {
      item.classList.add('cal-event-flash');
      item.addEventListener('animationend', () => item.classList.remove('cal-event-flash'), { once: true });
    }
  });
}

function navigateToEvent(ev, horizontalOnly = false) {
  const wrapper = document.getElementById('timelineWrapper');
  const bars    = document.querySelectorAll(`[data-ev-name="${ev.name.replace(/"/g, '\\"')}"]`);
  // For ongoing events, anchor on today's column instead of startDate so we
  // don't scroll the user months into the past just to find an active bar.
  const todayStr = todayLocalStr();
  const anchorDate = (ev.startDate <= todayStr && todayStr <= ev.endDate)
    ? todayStr
    : ev.startDate;
  const targetX = Math.max(0, dayOffset(anchorDate) * DAY_PX - wrapper.clientWidth * 0.25);

  let targetY = wrapper.scrollTop;
  if (!horizontalOnly && bars.length > 0) {
    const bar = bars[0];
    const row = bar.closest('.timeline-row');
    if (row) {
      const headerH     = 64;
      const barTopInRow = parseFloat(bar.style.top) || 0;
      const barCenter   = row.offsetTop + barTopInRow + BAR_H / 2;
      targetY = Math.max(0, barCenter - headerH - (wrapper.clientHeight - headerH) * 0.5);
    }
  }

  const startX = wrapper.scrollLeft;
  const startY = wrapper.scrollTop;
  const deltaX = targetX - startX;
  const deltaY = targetY - startY;
  const t0     = performance.now();
  const dur    = 1000;

  (function step(now) {
    const p    = Math.min((now - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 4);
    wrapper.scrollLeft = startX + deltaX * ease;
    wrapper.scrollTop  = startY + deltaY * ease;
    if (p < 1) requestAnimationFrame(step);
  })(performance.now());

  setTimeout(() => {
    bars.forEach(el => {
      el.classList.remove('bar-flash');
      void el.offsetWidth;
      el.classList.add('bar-flash');
      el.addEventListener('animationend', () => el.classList.remove('bar-flash'), { once: true });
    });
  }, 750);
}

// ============================================================
//  SEARCH
// ============================================================
function initSearch() {
  const input   = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');

  function closeResults() {
    results.classList.remove('open');
    results.innerHTML = '';
    combinedItems = [];
    selectedIdx = -1;
  }

  function goToTournament(ev) {
    input.value = '';
    closeResults();
    if (currentView === 'calendar') {
      scrollToCalendarEvent(ev);
    } else if (currentView === 'weekly') {
      scrollToWeekEvent(ev);
    } else {
      navigateToEvent(ev);
    }
  }

  let combinedItems = []; // { type: 'chip', kind, label } | { type: 'tournament', ev }
  let selectedIdx = -1;

  function setSelected(idx) {
    const items = results.querySelectorAll('.search-result-item, .search-action-chip');
    items.forEach(el => el.classList.remove('search-result-selected'));
    selectedIdx = idx;
    if (idx >= 0 && idx < items.length) {
      items[idx].classList.add('search-result-selected');
      items[idx].scrollIntoView({ block: 'nearest' });
    }
  }

  function activateItem(item) {
    if (!item) return;
    if (item.type === 'chip') {
      applySearchFilter(item.kind, item.label);
      input.value = '';
      closeResults();
      input.blur();
    } else {
      goToTournament(item.ev);
    }
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    selectedIdx = -1;
    if (!q) { closeResults(); return; }

    // Action chips: distinct sports / countries that match the query.
    const matchingSports = [...new Set(TOURNAMENTS.map(ev => effectiveCategory(ev)))]
      .filter(s => s && s.toLowerCase().includes(q))
      .sort()
      .slice(0, 2);
    const matchingCountries = [...new Set(TOURNAMENTS.map(ev => ev.country).filter(Boolean))]
      .filter(c => c.toLowerCase().includes(q))
      .sort()
      .slice(0, 2);

    // Tournament rows: name OR sport OR country matches.
    const tournamentMatches = TOURNAMENTS.filter(ev => {
      const name    = (ev.name || '').toLowerCase();
      const sport   = effectiveCategory(ev).toLowerCase();
      const country = (ev.country || '').toLowerCase();
      return name.includes(q) || sport.includes(q) || country.includes(q);
    }).slice(0, 7);

    combinedItems = [
      ...matchingSports.map(s => ({ type: 'chip', kind: 'sport', label: s })),
      ...matchingCountries.map(c => ({ type: 'chip', kind: 'country', label: c })),
      ...tournamentMatches.map(ev => ({ type: 'tournament', ev })),
    ];

    if (combinedItems.length === 0) {
      results.innerHTML = '<div class="search-no-results">No results</div>';
      results.classList.add('open');
      return;
    }

    let html = '';
    const chipCount = matchingSports.length + matchingCountries.length;
    if (chipCount > 0) {
      html += '<div class="search-section-title">Filter to</div>';
      matchingSports.forEach(s => {
        const cls   = SPORT_ICONS[s] || 'fa-solid fa-trophy';
        const color = getColor(s);
        html += `<div class="search-action-chip">
          <i class="fa-solid fa-arrow-right sr-chip-arrow"></i>
          <i class="${cls} sr-chip-icon" style="color:${color}"></i>
          <span class="sr-chip-text">Filter to <strong>${s}</strong></span>
          <span class="sr-chip-kind">sport</span>
        </div>`;
      });
      matchingCountries.forEach(c => {
        html += `<div class="search-action-chip">
          <i class="fa-solid fa-arrow-right sr-chip-arrow"></i>
          <span class="sr-chip-flag">${getFlag(c)}</span>
          <span class="sr-chip-text">Filter to <strong>${c}</strong></span>
          <span class="sr-chip-kind">country</span>
        </div>`;
      });
      if (tournamentMatches.length > 0) {
        html += '<div class="search-section-title">Tournaments</div>';
      }
    }

    tournamentMatches.forEach(ev => {
      html += `<div class="search-result-item">
        <span class="sr-name">${ev.name}</span>
        <span class="sr-meta">${getFlag(ev.country)} ${ev.country} &middot; ${effectiveCategory(ev)} &middot; ${fmtDate(ev.startDate)}</span>
      </div>`;
    });

    results.innerHTML = html;
    results.classList.add('open');

    // Wire up all selectable rows in document order so keyboard nav matches.
    const rowEls = results.querySelectorAll('.search-result-item, .search-action-chip');
    rowEls.forEach((el, i) => {
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        activateItem(combinedItems[i]);
      });
      el.addEventListener('mousemove', () => setSelected(i));
    });
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeResults(); input.blur(); return; }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(Math.min(selectedIdx + 1, combinedItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(Math.max(selectedIdx - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = combinedItems[selectedIdx >= 0 ? selectedIdx : 0];
      activateItem(target);
    }
  });

  input.addEventListener('blur', () => setTimeout(closeResults, 150));
}

function applySearchFilter(kind, label) {
  if (kind === 'sport') {
    if (sortMode === 'country') {
      sortMode = 'live';
      document.getElementById('sidebarLabel').textContent = 'Sport';
      const filterBtn = document.getElementById('filterBtn');
      if (filterBtn) filterBtn.title = 'Filter by sport';
      document.getElementById('btnAlpha').classList.remove('on');
      document.getElementById('btnLive').classList.add('on');
      document.getElementById('btnCountry').classList.remove('on');
    }
    activeFilters = new Set([label]);
    cwFilters.sports = new Set([label]);
    cwFilters.countries.clear();
  } else if (kind === 'country') {
    if (sortMode !== 'country') {
      sortMode = 'country';
      document.getElementById('sidebarLabel').textContent = 'Country';
      const filterBtn = document.getElementById('filterBtn');
      if (filterBtn) filterBtn.title = 'Filter by country';
      document.getElementById('btnAlpha').classList.remove('on');
      document.getElementById('btnLive').classList.remove('on');
      document.getElementById('btnCountry').classList.add('on');
    }
    activeFilters = new Set([label]);
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

// ============================================================
//  CALENDAR / WEEKLY SIDEBAR FILTERS
// ============================================================
let currentView = 'timeline';
const cwFilters = { sports: new Set(), countries: new Set() };

function getFilteredTournaments() {
  const { sports, countries } = cwFilters;
  if (!sports.size && !countries.size && !showOnlyFavourites && !showOnlyTopRevenue && !showOnlyPromos) return TOURNAMENTS;
  return TOURNAMENTS.filter(ev => {
    const sportOk   = !sports.size   || sports.has(effectiveCategory(ev));
    const countryOk = !countries.size || countries.has(ev.country);
    const favOk     = !showOnlyFavourites || isFavourite(ev);
    const topRevOk  = !showOnlyTopRevenue || isTopRevenueSport(effectiveCategory(ev));
    const promoOk   = !showOnlyPromos || hasActivePromo(ev);
    return sportOk && countryOk && favOk && topRevOk && promoOk;
  });
}

function buildCwSidebar() {
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
    showOnlyFavourites = !showOnlyFavourites;
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
      showOnlyTopRevenue = !showOnlyTopRevenue;
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
      showOnlyPromos = !showOnlyPromos;
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

  buildCwSportList();
  buildCwList(
    'cwCountryList',
    [...new Set(TOURNAMENTS.map(ev => ev.country))].sort(),
    cwFilters.countries,
    country => `<span style="font-size:15px;flex-shrink:0;line-height:1">${getFlag(country)}</span>`
  );
  updateCwUI();
}

// Sport list: top-revenue sports float to the top under a "Top revenue" header,
// remaining sports below under "Other sports". Each top-revenue row also gets a
// trailing $ icon so the marking is visible even when the toggle is off.
function buildCwSportList() {
  const list = document.getElementById('cwSportList');
  list.innerHTML = '';
  const all = [...new Set(TOURNAMENTS.map(ev => effectiveCategory(ev)))].sort();
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

function clearCwSearch() {
  const inp = document.getElementById('cwSearchInput');
  if (!inp) return;
  inp.value = '';
  filterCwSidebar('');
  inp.focus();
}

function filterCwSidebar(q) {
  const lq = q.trim().toLowerCase();
  ['cwSportList', 'cwCountryList'].forEach(id => {
    const list = document.getElementById(id);
    let anyVisible = false;
    list.querySelectorAll('.cw-filter-item').forEach(el => {
      const match = !lq || el.dataset.label.includes(lq);
      el.style.display = match ? '' : 'none';
      if (match) anyVisible = true;
    });
    // hide section title if nothing matches
    const section = list.closest('.cw-section');
    if (section) section.style.display = anyVisible || !lq ? '' : 'none';
  });
}

function updateCwUI() {
  const total = cwFilters.sports.size + cwFilters.countries.size + (showOnlyFavourites ? 1 : 0) + (showOnlyTopRevenue ? 1 : 0) + (showOnlyPromos ? 1 : 0);
  const badge = document.getElementById('cwActiveBadge');
  // Keep badge in the layout always (visibility, not display) so adding/removing
  // a filter doesn't reflow the header height and shift everything below.
  if (badge) {
    badge.textContent = total || '';
    badge.style.visibility = total ? 'visible' : 'hidden';
  }
  const btn = document.getElementById('cwClearBtn');
  if (btn) btn.disabled = !total;
}

function clearCwFilters() {
  cwFilters.sports.clear();
  cwFilters.countries.clear();
  showOnlyFavourites = false;
  showOnlyTopRevenue = false;
  showOnlyPromos = false;
  saveFavOnly();
  saveTopRevenueFilter();
  savePromoFilter();
  updateFilterBtn();
  document.getElementById('cwSearchInput').value = '';
  filterCwSidebar('');
  buildCwSidebar();
  rebuildCwView();
}

function rebuildCwView() {
  if (currentView === 'calendar') buildCalendarView();
  else if (currentView === 'weekly') buildWeeklyView();
}

function setView(view) {
  currentView = view;
  try { localStorage.setItem('mjr_view', view); } catch {}
  const mainEl    = document.getElementById('mainView');
  const cwLayout  = document.getElementById('cwLayout');
  const calEl     = document.getElementById('calendarView');
  const weeklyEl  = document.getElementById('weeklyView');
  const btnTL     = document.getElementById('btnTimeline');
  const btnCal    = document.getElementById('btnCalendar');
  const btnWeekly = document.getElementById('btnWeekly');
  const todayBtn  = document.querySelector('.today-btn');

  mainEl.style.display    = 'none';
  cwLayout.style.display  = 'none';
  calEl.style.display     = 'none';
  weeklyEl.style.display  = 'none';
  btnTL.classList.remove('on');
  btnCal.classList.remove('on');
  btnWeekly.classList.remove('on');
  if (todayBtn) todayBtn.style.display = '';

  if (view === 'timeline') {
    mainEl.style.display = 'flex';
    btnTL.classList.add('on');
  } else if (view === 'calendar') {
    cwLayout.style.display = 'flex';
    calEl.style.display    = 'block';
    btnCal.classList.add('on');
    buildCalendarView();
  } else if (view === 'weekly') {
    cwLayout.style.display = 'flex';
    weeklyEl.style.display = 'flex';
    btnWeekly.classList.add('on');
    buildWeeklyView();
  }
}

function firstMondayOfYear(year) {
  const jan1 = new Date(year, 0, 1);
  const daysToMon = (8 - jan1.getDay()) % 7;
  return new Date(year, 0, 1 + daysToMon);
}

function buildWeeklyView() {
  _activeMatchTournament = null;

  const weeklyView = document.getElementById('weeklyView');
  weeklyView.innerHTML = '';

  const mainPanel = document.createElement('div');
  mainPanel.id = 'weeklyMainPanel';
  mainPanel.className = 'weekly-main-panel';
  weeklyView.appendChild(mainPanel);

  const matchPanelEl = document.createElement('div');
  matchPanelEl.id = 'weeklyMatchPanel';
  matchPanelEl.className = 'weekly-match-panel';
  weeklyView.appendChild(matchPanelEl);

  const container = mainPanel;

  const today      = new Date(); today.setHours(0,0,0,0);
  const MONTHS     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmtDate    = d => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  // Compute the rendered week window: trim weeks before the first filtered event
  // and after the last, but always extend to include the current week (which
  // keeps the "you are here" blue marker visible no matter the filter).
  function weekMondayOf(d) {
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    mon.setHours(0, 0, 0, 0);
    return mon;
  }
  const currentMon = weekMondayOf(today);
  const filtered = getFilteredTournaments();
  let renderStart, renderEnd;
  if (filtered.length === 0) {
    renderStart = new Date(currentMon);
    renderEnd   = new Date(currentMon);
  } else {
    let minStart = Infinity, maxEnd = -Infinity;
    filtered.forEach(ev => {
      const s = parseLocalDate(ev.startDate).getTime();
      const e = parseLocalDate(ev.endDate).getTime();
      if (s < minStart) minStart = s;
      if (e > maxEnd)   maxEnd   = e;
    });
    const firstMon = weekMondayOf(new Date(minStart));
    const lastMon  = weekMondayOf(new Date(maxEnd));
    renderStart = firstMon < currentMon ? firstMon : currentMon;
    renderEnd   = lastMon  > currentMon ? lastMon  : currentMon;
  }

  const startYear = renderStart.getFullYear();
  const endYear   = renderEnd.getFullYear();

  for (let year = startYear; year <= endYear; year++) {
    const yearStart = firstMondayOfYear(year);
    const yearEnd   = firstMondayOfYear(year + 1);

    let yearHeaderAdded = false;
    let weekNum = 1;
    let weekStart = new Date(yearStart);

    while (weekStart < yearEnd) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const isCurrentWeek = today >= weekStart && today <= weekEnd;
      const inRenderRange = weekEnd >= renderStart && weekStart <= renderEnd;

      if ((isCurrentWeek || inRenderRange)
          && weekEnd >= TIMELINE_START && weekStart <= TIMELINE_END) {
        if (!yearHeaderAdded) {
          const yearLabel = document.createElement('div');
          yearLabel.className = 'weekly-year-label';
          yearLabel.textContent = year;
          container.appendChild(yearLabel);
          yearHeaderAdded = true;
        }

        const isPastWeek = weekEnd < today;

        const weekEvents = getFilteredTournaments()
          .filter(ev => {
            const s = parseLocalDate(ev.startDate);
            const e = parseLocalDate(ev.endDate);
            return s <= weekEnd && e >= weekStart;
          })
          .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

        const section = document.createElement('div');
        section.className = 'week-section' + (isCurrentWeek ? ' week-current' : '') + (isPastWeek ? ' week-past' : '');
        section.dataset.weekStart = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;

        const hdr = document.createElement('div');
        hdr.className = 'week-header';
        const sd = weekStart.getDate(), sm = MONTHS[weekStart.getMonth()];
        const ed = weekEnd.getDate(),   em = MONTHS[weekEnd.getMonth()];
        hdr.innerHTML = `<span class="week-num-label">Week ${weekNum}</span><span class="week-date-range">${sd} ${sm} – ${ed} ${em}</span>`;
        section.appendChild(hdr);

        if (weekEvents.length > 0) {
          const list = document.createElement('div');
          list.className = 'week-event-list';

          weekEvents.forEach(ev => {
            const cat        = effectiveCategory(ev);
            const iconCls    = SPORT_ICONS[cat] || 'fa-solid fa-trophy';
            const color      = getColor(cat);
            const hasMatches = getMatchesForTournament(ev.name).length > 0;
            const startD     = parseLocalDate(ev.startDate);
            const endD       = parseLocalDate(ev.endDate);
            const durDays    = ev.lengthDays || (Math.round((endD - startD) / 86400000) + 1);
            const isLive     = today >= startD && today <= endD;
            const isStartHere = startD >= weekStart && startD <= weekEnd;
            const isEndHere   = endD   >= weekStart && endD   <= weekEnd;
            const spansMulti  = !(isStartHere && isEndHere); // both in same week ⇒ single-week event
            const showStart   = isStartHere && spansMulti;
            const showEnd     = isEndHere   && spansMulti;

            const isPast = endD < today;
            const item = document.createElement('div');
            item.className   = 'week-event-item'
              + (ev.highlight ? ' week-event-highlight' : '')
              + (isPast ? ' week-event-past' : '');
            item.dataset.evName = ev.name;

            const icon = document.createElement('i');
            icon.className   = iconCls;
            icon.style.color = color;

            const nameEl = document.createElement('span');
            nameEl.className   = 'week-event-name';
            const weekMarkerSlot = document.createElement('span');
            weekMarkerSlot.className = 'start-marker-slot';
            if (showStart) {
              const m = document.createElement('i');
              m.className = 'fa-solid fa-circle-play start-marker';
              m.title     = 'Starts this week';
              weekMarkerSlot.appendChild(m);
            } else if (showEnd) {
              const m = document.createElement('i');
              m.className = 'fa-solid fa-circle-xmark end-marker';
              m.title     = 'Ends this week';
              weekMarkerSlot.appendChild(m);
            }
            nameEl.appendChild(weekMarkerSlot);

            const nameTextCol = document.createElement('span');
            nameTextCol.className = 'week-event-name-col';
            const nameLineEl = document.createElement('span');
            nameLineEl.className = 'week-event-name-line';
            nameLineEl.textContent = ev.name;
            nameTextCol.appendChild(nameLineEl);
            if (ev.subCategory) {
              const subEl = document.createElement('span');
              subEl.className = 'week-event-sub';
              subEl.textContent = ev.subCategory;
              nameTextCol.appendChild(subEl);
            }
            nameEl.appendChild(nameTextCol);

            const flagEl = document.createElement('span');
            flagEl.className   = 'week-event-flag';
            flagEl.textContent = getFlag(ev.country);

            const startEl = document.createElement('span');
            startEl.className   = 'week-event-date';
            startEl.textContent = fmtDate(startD);

            const endEl = document.createElement('span');
            endEl.className   = 'week-event-date';
            endEl.textContent = fmtDate(endD);

            const durEl = document.createElement('span');
            durEl.className   = 'week-event-duration';
            durEl.textContent = `${durDays} day${durDays !== 1 ? 's' : ''}`;

            item.appendChild(icon);
            item.appendChild(nameEl);
            item.appendChild(flagEl);
            item.appendChild(startEl);
            item.appendChild(endEl);
            item.appendChild(durEl);

            if (hasMatches) {
              item.classList.add('has-matches');
              const link = document.createElement('a');
              link.className   = 'match-panel-link';
              link.href        = '#';
              link.textContent = 'Matches loaded ›';
              link.addEventListener('click', e => {
                e.preventDefault();
                if (_activeMatchTournament === ev.name) {
                  closeMatchPanel();
                } else {
                  buildMatchPanel(ev.name);
                }
              });
              item.appendChild(link);
            } else {
              item.appendChild(document.createElement('span')); // placeholder so grid columns stay aligned
            }

            if (isLive) {
              const dot = document.createElement('span');
              dot.className = 'week-event-live-dot';
              item.appendChild(dot);
            } else {
              item.appendChild(document.createElement('span'));
            }

            // Promo badge — small purple gift, hover-tooltip lists every promo.
            // Always append a slot (badge or empty span) so the grid stays aligned.
            const evPromos = getPromotionsForTournament(ev.name);
            if (evPromos.length > 0) {
              const badge = document.createElement('i');
              badge.className = 'fa-solid fa-gift week-event-promo-badge';
              badge.addEventListener('mouseenter', e => {
                e.stopPropagation();
                showBarPromoTooltip(e, evPromos);
              });
              badge.addEventListener('mousemove', e => { e.stopPropagation(); moveTooltip(e); });
              badge.addEventListener('mouseleave', e => { e.stopPropagation(); hideTooltip(); });
              item.appendChild(badge);
            } else {
              item.appendChild(document.createElement('span'));
            }

            list.appendChild(item);
          });

          section.appendChild(list);
        }

        container.appendChild(section);
      }

      weekNum++;
      weekStart.setDate(weekStart.getDate() + 7);
    }
  }

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const current = container.querySelector('.week-section.week-current');
    if (current) scrollToEl(container, current, false);
  }));
}

// Configurable split ratio — both panels get flex:1 (50/50) by default.
// To adjust, change the flex values on .weekly-main-panel and .weekly-match-panel in CSS.
function buildMatchPanel(tournamentName) {
  const panel = document.getElementById('weeklyMatchPanel');
  if (!panel) return;

  document.querySelectorAll('.week-event-item.match-active').forEach(el => el.classList.remove('match-active'));
  _activeMatchTournament = tournamentName;
  document.querySelectorAll('.week-event-item').forEach(el => {
    if (el.dataset.evName === tournamentName) el.classList.add('match-active');
  });

  const matches = getMatchesForTournament(tournamentName);
  panel.innerHTML = '';
  panel.classList.add('open');

  const header = document.createElement('div');
  header.className = 'match-panel-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'match-panel-title-wrap';

  const parentTournament = TOURNAMENTS.find(t => t.name.toLowerCase() === tournamentName.toLowerCase());
  if (parentTournament) {
    const flagEl = document.createElement('span');
    flagEl.className   = 'match-panel-header-flag';
    flagEl.textContent = getFlag(parentTournament.country);
    titleWrap.appendChild(flagEl);
  }

  const title = document.createElement('span');
  title.className   = 'match-panel-title';
  title.textContent = tournamentName;
  titleWrap.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.className   = 'match-panel-close';
  closeBtn.innerHTML   = '&times;';
  closeBtn.title       = 'Close';
  closeBtn.addEventListener('click', closeMatchPanel);

  header.appendChild(titleWrap);

  if (parentTournament) {
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const endDate  = parseLocalDate(parentTournament.endDate);
    const daysLeft = Math.round((endDate - today) / 86400000);
    let daysStr = '';
    if (daysLeft > 0)       daysStr = ` · ${daysLeft} days left`;
    else if (daysLeft === 0) daysStr = ' · ends today';

    const meta = document.createElement('div');
    meta.className   = 'match-panel-meta';
    meta.textContent = `Runs ${fmtDate(parentTournament.startDate)} – ${fmtDate(parentTournament.endDate)}${daysStr}`;
    header.appendChild(meta);
  }

  header.appendChild(closeBtn);
  panel.appendChild(header);

  const content = document.createElement('div');
  content.className = 'match-panel-content';

  let scrollTarget = null;

  if (matches.length === 0) {
    const empty = document.createElement('div');
    empty.className   = 'match-panel-empty';
    empty.textContent = 'No matches found.';
    content.appendChild(empty);
  } else {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const today   = new Date(); today.setHours(0, 0, 0, 0);

    // Group by Mon–Sun week
    const weekMap = new Map();
    matches.forEach(m => {
      const d   = parseLocalDate(m.startDate);
      const day = d.getDay();
      const mon = new Date(d);
      mon.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
      const key = `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,'0')}-${String(mon.getDate()).padStart(2,'0')}`;
      if (!weekMap.has(key)) weekMap.set(key, { mon, items: [] });
      weekMap.get(key).items.push(m);
    });

    let weekNum = 0;
    let firstSection = null;

    [...weekMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([, { mon, items }]) => {
        weekNum++;
        const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
        const isCurrentWeek = today >= mon && today <= sun;
        const isUpcoming    = mon > today;
        const isPastWeek    = sun < today;

        const section = document.createElement('div');
        section.className = 'match-week-section' + (isCurrentWeek ? ' match-week-current' : '') + (isPastWeek ? ' match-week-past' : '');

        const wHdr = document.createElement('div');
        wHdr.className = 'match-week-header';

        const numLabel = document.createElement('span');
        numLabel.className   = 'match-week-num';
        numLabel.textContent = `Week ${weekNum}`;

        const dateLabel = document.createElement('span');
        dateLabel.className   = 'match-week-dates';
        dateLabel.textContent = `${mon.getDate()} ${MONTHS[mon.getMonth()]} – ${sun.getDate()} ${MONTHS[sun.getMonth()]}`;

        wHdr.appendChild(numLabel);
        wHdr.appendChild(dateLabel);
        section.appendChild(wHdr);

        items
          .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name))
          .forEach(m => {
            const md      = parseLocalDate(m.startDate);
            const isToday = md.getTime() === today.getTime();
            const isPast  = md.getTime() < today.getTime();

            const item = document.createElement('div');
            item.className = 'match-item'
              + (isToday ? ' match-item-today' : '')
              + (isPast  ? ' match-item-past'  : '');

            const nameEl = document.createElement('span');
            nameEl.className   = 'match-item-name';
            nameEl.textContent = m.name;

            const dateEl = document.createElement('span');
            if (isToday) {
              dateEl.className   = 'match-item-date match-item-today-pill';
              dateEl.textContent = 'TODAY';
            } else {
              dateEl.className   = 'match-item-date';
              dateEl.textContent = `${md.getDate()} ${MONTHS[md.getMonth()]}`;
            }

            item.appendChild(dateEl);
            item.appendChild(nameEl);
            section.appendChild(item);
          });

        content.appendChild(section);

        if (!firstSection) firstSection = section;
        if (!scrollTarget && (isCurrentWeek || isUpcoming)) scrollTarget = section;
      });

    // Tournament finished — scroll to first week
    if (!scrollTarget) scrollTarget = firstSection;
  }

  panel.appendChild(content);

  if (scrollTarget) {
    requestAnimationFrame(() => {
      const cr = content.getBoundingClientRect();
      const tr = scrollTarget.getBoundingClientRect();
      content.scrollTop += tr.top - cr.top;
    });
  }
}

function closeMatchPanel() {
  _activeMatchTournament = null;
  const panel = document.getElementById('weeklyMatchPanel');
  if (panel) {
    panel.classList.remove('open');
    panel.innerHTML = '';
  }
  document.querySelectorAll('.week-event-item.match-active').forEach(el => el.classList.remove('match-active'));
}

function navigateToWeekForEvent(ev) {
  setView('weekly');
  setTimeout(() => scrollToWeekEvent(ev), 120);
}

function buildCalendarView() {
  const container = document.getElementById('calendarView');
  container.innerHTML = '';

  const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const today      = new Date(); today.setHours(0,0,0,0);

  // Only render years that actually contain filtered events — avoids empty Jan–Dec
  // grids for years like 2025/2027 when the active filter only matches 2026 events.
  const filtered = getFilteredTournaments();
  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'cal-empty';
    empty.textContent = 'No events match the current filters.';
    container.appendChild(empty);
    return;
  }
  const yearsSet = new Set();
  filtered.forEach(ev => {
    const sy = parseLocalDate(ev.startDate).getFullYear();
    const ey = parseLocalDate(ev.endDate).getFullYear();
    for (let y = sy; y <= ey; y++) yearsSet.add(y);
  });
  const years = [...yearsSet].sort((a, b) => a - b);

  for (const year of years) {
    const yearEl = document.createElement('div');
    yearEl.className   = 'cal-year-label';
    yearEl.textContent = year;
    container.appendChild(yearEl);

    const grid = document.createElement('div');
    grid.className = 'cal-grid';
    container.appendChild(grid);

    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(year, m, 1);
      const monthEnd   = new Date(year, m + 1, 0);
      const isCurrent  = today >= monthStart && today <= monthEnd;
      const isPast     = monthEnd < today;

      const monthEvents = getFilteredTournaments()
        .filter(ev => {
          const s = parseLocalDate(ev.startDate);
          const e = parseLocalDate(ev.endDate);
          return s <= monthEnd && e >= monthStart;
        })
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

      const cell = document.createElement('div');
      cell.className = 'cal-month-cell' + (isCurrent ? ' cal-month-current' : '') + (isPast ? ' cal-month-past' : '');
      cell.dataset.yearMonth = `${year}-${m}`;

      const mHeader = document.createElement('div');
      mHeader.className   = 'cal-month-header';
      mHeader.textContent = MONTH_NAMES[m];
      cell.appendChild(mHeader);

      const list = document.createElement('div');
      list.className = 'cal-event-list';

      monthEvents.forEach(ev => {
        const cat     = effectiveCategory(ev);
        const iconCls = SPORT_ICONS[cat] || 'fa-solid fa-trophy';
        const color   = getColor(cat);
        const startD  = parseLocalDate(ev.startDate);
        const endD    = parseLocalDate(ev.endDate);
        const isLive  = today >= startD && today <= endD;
        const isStartHere = startD >= monthStart && startD <= monthEnd;
        const isEndHere   = endD   >= monthStart && endD   <= monthEnd;
        const spansMulti  = !(isStartHere && isEndHere); // both in same month ⇒ single-month event
        const showStart   = isStartHere && spansMulti;
        const showEnd     = isEndHere   && spansMulti;

        const isPast = endD < today;
        const item = document.createElement('div');
        item.className = 'cal-event-item'
          + (ev.highlight ? ' cal-event-highlight' : '')
          + (isLive ? ' cal-event-live' : '')
          + (isPast ? ' cal-event-past' : '');
        item.dataset.evName = ev.name;

        const icon = document.createElement('i');
        icon.className = iconCls;
        icon.style.color = color;

        // Promo badge — tournaments with linked promos get a small purple gift
        // icon. Hover lists every promo. Renders inline next to the sport icon.
        const evPromos = getPromotionsForTournament(ev.name);
        let calPromoBadge = null;
        if (evPromos.length > 0) {
          calPromoBadge = document.createElement('i');
          calPromoBadge.className = 'fa-solid fa-gift cal-event-promo-badge';
          calPromoBadge.addEventListener('mouseenter', e => {
            e.stopPropagation();
            showBarPromoTooltip(e, evPromos);
          });
          calPromoBadge.addEventListener('mousemove', e => { e.stopPropagation(); moveTooltip(e); });
          calPromoBadge.addEventListener('mouseleave', e => { e.stopPropagation(); hideTooltip(); });
        }

        const calMarkerSlot = document.createElement('span');
        calMarkerSlot.className = 'start-marker-slot';
        if (showStart) {
          const m = document.createElement('i');
          m.className = 'fa-solid fa-circle-play start-marker';
          m.title     = 'Starts this month';
          calMarkerSlot.appendChild(m);
        } else if (showEnd) {
          const m = document.createElement('i');
          m.className = 'fa-solid fa-circle-xmark end-marker';
          m.title     = 'Ends this month';
          calMarkerSlot.appendChild(m);
        }

        const name = document.createElement('span');
        name.className   = 'cal-event-name';
        name.textContent = ev.name;

        item.appendChild(icon);
        item.appendChild(calMarkerSlot);
        item.appendChild(name);
        item.appendChild(calPromoBadge || document.createElement('span'));

        item.addEventListener('mouseenter', e => showTooltip(e, ev, color));
        item.addEventListener('mousemove',  moveTooltip);
        item.addEventListener('mouseleave', hideTooltip);
        item.addEventListener('click', () => navigateToWeekForEvent(ev));

        list.appendChild(item);
      });

      cell.appendChild(list);
      grid.appendChild(cell);
    }
  }

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const current = container.querySelector('.cal-month-current');
    if (current) scrollToEl(container, current, false);
  }));
}

// ============================================================
//  KEYBOARD SHORTCUTS
// ============================================================
function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    const inInput = document.activeElement.tagName === 'INPUT' ||
                    document.activeElement.tagName === 'TEXTAREA';

    // Escape: close promo panel → settings → match panel → timeline: scroll to start, calendar/weekly: go to today
    if (e.key === 'Escape' && !inInput) {
      if (isPromoPanelOpen()) {
        closePromoPanel();
      } else if (isSettingsPanelOpen()) {
        closeSettingsPanel();
      } else if (currentView === 'weekly' && _activeMatchTournament) {
        closeMatchPanel();
      } else if (currentView === 'calendar' || currentView === 'weekly') {
        goToToday();
      } else {
        scrollToStart();
      }
      return;
    }

    if (inInput) return; // don't steal T / S while user is typing

    if (e.key === 't' || e.key === 'T') {
      goToToday();
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    } else if (e.key === 'v' || e.key === 'V') {
      const order = ['timeline', 'calendar', 'weekly'];
      const i = order.indexOf(currentView);
      setView(order[(i + 1) % order.length]);
    }
  });
}

// ============================================================
//  INIT
// ============================================================
async function init() {
  document.getElementById('sidebarRows').innerHTML =
    '<div style="padding:16px 12px;color:#8b949e;font-size:13px">Loading…</div>';
  try {
    await loadData();
    computeTimelineBounds();
    buildData();
    computeTopRevenueSports();
    loadTopRevenueFilter();
    loadPromoFilter();
    updateHeaderDate();
    buildMonthHeaders();
    buildPromoRail();
    loadFavourites();
    loadFilters();
    buildSidebar();
    buildTimelineRows();
    buildCwSidebar();
    initScrollSync();
    initDragScroll();
    initSearch();
    initFilterClickOutside();
    initMobileTouch();
    initKeyboardShortcuts();
    if (window.innerWidth <= 768) {
      document.querySelector('.sidebar').classList.add('collapsed');
    }
    requestAnimationFrame(scrollToToday);
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
// Designed for unattended displays (e.g. meeting room screens) where the page is
// never reloaded. Every REFRESH_MS we re-fetch the sheet so new events appear,
// and re-render the views so the "today" marker, live indicators, past-week
// dimming, etc. stay accurate across midnight. Scroll positions are preserved
// so a viewer sees no visible jump.
const REFRESH_MS = 15 * 60 * 1000; // 15 minutes

async function refreshAll() {
  const tw = document.querySelector('.timeline-wrapper');
  const cv = document.getElementById('calendarView');
  const wm = document.getElementById('weeklyMainPanel');
  const sr = document.getElementById('sidebarRows');
  const scrolls = {
    timelineX: tw ? tw.scrollLeft : 0,
    timelineY: tw ? tw.scrollTop  : 0,
    calendar:  cv ? cv.scrollTop  : 0,
    weekly:    wm ? wm.scrollTop  : 0,
    sidebar:   sr ? sr.scrollTop  : 0,
  };

  try {
    await loadData();
    computeTimelineBounds();
    buildData();
    updateHeaderDate();
    buildMonthHeaders();
    buildPromoRail();
    buildSidebar();
    buildTimelineRows();
    buildCwSidebar();
    if (currentView === 'calendar')      buildCalendarView();
    else if (currentView === 'weekly')   buildWeeklyView();

    requestAnimationFrame(() => {
      const tw2 = document.querySelector('.timeline-wrapper');
      const cv2 = document.getElementById('calendarView');
      const wm2 = document.getElementById('weeklyMainPanel');
      const sr2 = document.getElementById('sidebarRows');
      if (tw2) { tw2.scrollLeft = scrolls.timelineX; tw2.scrollTop = scrolls.timelineY; }
      if (cv2)   cv2.scrollTop  = scrolls.calendar;
      if (wm2)   wm2.scrollTop  = scrolls.weekly;
      if (sr2)   sr2.scrollTop  = scrolls.sidebar;
    });
  } catch (err) {
    console.error('Auto-refresh failed:', err);
  }
}

setInterval(refreshAll, REFRESH_MS);

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

function dayOffset(dateStr) {
  return Math.round((new Date(dateStr) - TIMELINE_START) / 86400000);
}

// Parse a YYYY-MM-DD string as local midnight (not UTC) so date comparisons
// against locally-constructed dates (weekStart, monthStart, etc.) are correct.
function parseLocalDate(str) {
  if (!str) return new Date(NaN);
  const [y, m, d] = str.split('-');
  return new Date(+y, +m - 1, +d);
}

// ============================================================
//  DATA SOURCE
// ============================================================
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSfVuGE4L38QC5CVV9zc3AN-vZ8Pi0ka7ieO10gpPZVq4bDYqoK41kUNaSxoKbGpmnEuwubg_Ln_mdE/pub?output=csv';

let TOURNAMENTS = [];
let MATCHES = [];
let _activeMatchTournament = null;

// RFC-4180 CSV parser — handles quoted fields containing commas or newlines.
function parseCSVRow(line) {
  const fields = [];
  let field = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(field); field = ''; }
      else { field += ch; }
    }
  }
  fields.push(field);
  return fields;
}

async function loadData() {
  const res   = await fetch(SHEET_URL);
  const text  = await res.text();
  const rows  = text.trim().split(/\r?\n/);
  const heads = parseCSVRow(rows.shift()).map(h => h.trim().toLowerCase());
  const col   = name => heads.indexOf(name);

  TOURNAMENTS = [];
  MATCHES = [];

  rows
    .filter(r => r.trim())
    .forEach(row => {
      const parts     = parseCSVRow(row);
      const get       = name => (parts[col(name)] || '').trim();
      const startDate = get('startdate');
      const format    = get('format');

      if (format === 'match') {
        MATCHES.push({
          name:       get('name'),
          format:     'match',
          tournament: get('tournament'),
          startDate,
          endDate:    get('enddate') || startDate,
          country:    get('country'),
          category:   get('category'),
        });
        return;
      }

      const ev = {
        category:  get('category'),
        name:      get('name'),
        format,
        country:   get('country'),
        startDate,
        endDate:   get('enddate') || startDate,
      };
      const game = get('game');
      if (game) ev.game = game;
      if (get('important').toLowerCase() === 'yes') ev.important = true;
      ev.lengthDays = Math.round((new Date(ev.endDate) - new Date(ev.startDate)) / 86400000) + 1;
      TOURNAMENTS.push(ev);
    });
}

function getMatchesForTournament(tournamentName) {
  const normalized = tournamentName.toLowerCase();
  return MATCHES.filter(m => m.tournament.toLowerCase() === normalized);
}

// ============================================================
//  DATA PREP
// ============================================================

// Esports entries carry a `game` field — use "Esports (game)" as the row key
function effectiveCategory(ev) {
  return ev.game ? `${ev.category} (${ev.game})` : ev.category;
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
  const source  = activeFilters.size > 0
    ? getCountryData().filter(d => activeFilters.has(d.country))
    : getCountryData();

  function makeCountryEntry(country, events, isLiveSlice) {
    const { laneCount, rowHeight } = assignCountryLanes(events);
    let isActive = false, nextMs = null;
    events.forEach(ev => {
      const s = new Date(ev.startDate).getTime();
      const e = new Date(ev.endDate).getTime() + 86400000;
      if (todayMs >= s && todayMs < e) isActive = true;
      else if (s > todayMs && (nextMs === null || s < nextMs)) nextMs = s;
    });
    return { country, events, laneCount, rowHeight, isLiveSlice, isActive, nextMs };
  }

  const liveEntries = [], restEntries = [];

  source.forEach(({ country, events }) => {
    const active = events.filter(ev => {
      const s = new Date(ev.startDate).getTime();
      const e = new Date(ev.endDate).getTime() + 86400000;
      return todayMs >= s && todayMs < e;
    });
    const rest = events.filter(ev => new Date(ev.startDate).getTime() > todayMs);

    if (active.length > 0) {
      liveEntries.push(makeCountryEntry(country, active, true));
      if (rest.length > 0) restEntries.push(makeCountryEntry(country, rest, false));
    } else {
      restEntries.push(makeCountryEntry(country, events, false));
    }
  });

  liveEntries.sort((a, b) => a.country.localeCompare(b.country));
  restEntries.sort((a, b) => {
    if (a.nextMs && !b.nextMs) return -1;
    if (!a.nextMs && b.nextMs) return 1;
    if (a.nextMs && b.nextMs)  return a.nextMs - b.nextMs;
    return a.country.localeCompare(b.country);
  });

  return [...liveEntries, ...restEntries];
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
    const off         = dayOffset(d.toISOString().split('T')[0]);
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
  const todayOffH = dayOffset(new Date().toISOString().split('T')[0]);
  if (todayOffH >= 0 && todayOffH <= TOTAL_DAYS) {
    const todayLbl = document.createElement('div');
    todayLbl.className  = 'today-header-label';
    todayLbl.style.left = (todayOffH * DAY_PX) + 'px';
    todayLbl.textContent = 'TODAY';
    header.appendChild(todayLbl);
  }

  // Star markers — assign vertical lanes so no two labels ever overlap horizontally
  const LABEL_SLOT_H = 20; // px per lane slot — 3 lanes fit within the 64px header

  const headerEvents = TOURNAMENTS
    .filter(ev => ev.format === 'event' || ev.format === 'race')
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
  const count = activeFilters.size;
  btn.classList.toggle('filter-btn-active', count > 0);
  let badge = btn.querySelector('.filter-badge');
  if (count > 0) {
    if (!badge) { badge = document.createElement('span'); badge.className = 'filter-badge'; btn.appendChild(badge); }
    badge.textContent = count;
  } else if (badge) {
    badge.remove();
  }
}

function toggleFilterPanel() {
  const panel = document.getElementById('filterPanel');
  const isOpen = panel.classList.toggle('open');
  if (isOpen) renderFilterOptions();
}

function renderFilterOptions() {
  const container = document.getElementById('filterOptions');
  container.innerHTML = '';
  const options = sortMode === 'country'
    ? getCountryData().map(d => d.country)
    : catData.map(d => d.cat);
  options.forEach(opt => {
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
    span.textContent = opt;
    label.appendChild(cb);
    label.appendChild(span);
    container.appendChild(label);
  });
}

function clearFilters() {
  activeFilters.clear();
  saveFilters();
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
  const source  = activeFilters.size > 0 ? catData.filter(d => activeFilters.has(d.cat)) : catData;

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
    row.innerHTML = `
      <div class="category-icon">${iconHtml}</div>
      <div class="category-label" title="${cat}">${cat}</div>
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
    const off = dayOffset(d.toISOString().split('T')[0]);
    if (off >= 0) {
      const gl = document.createElement('div');
      gl.className  = 'grid-line-month';
      gl.style.left = (off * DAY_PX) + 'px';
      rowsEl.appendChild(gl);
    }
    d.setMonth(d.getMonth() + 1);
  }

  // Today marker
  const todayOff = dayOffset(new Date().toISOString().split('T')[0]);
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
      bar.className = 'event-star-marker';
      bar.style.cssText = `
        left:${startPx}px; top:${topPx}px;
        z-index:${10 + laneIdx};
      `;
      bar.textContent = '★';
    } else {
      bar.style.cssText = `
        left:${startPx}px; width:${widthPx}px; top:${topPx}px; height:${BAR_H}px;
        background:linear-gradient(135deg,#2d333b 0%,#1c2128 100%);
        border-left:3px solid #444c56;
        z-index:${10 + laneIdx};
      `;
      if (isCountryView) {
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
    }

    // If bar spans today, show name anchored at today line when left label is off-screen
    if (!isEvent) {
      const todayPx = dayOffset(new Date().toISOString().split('T')[0]) * DAY_PX;
      if (startPx < todayPx && startPx + widthPx > todayPx) {
        const remainingW  = startPx + widthPx - todayPx;
        const approxMinW  = ev.name.length * 6.5 + 44; // flag + text + padding estimate
        if (remainingW >= approxMinW) {
          const offsetInBar = todayPx - startPx;
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
      }
    }

    if (!isEvent && ev.important) {
      bar.classList.add('bar-important');
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
    `<div class="tt-row"><span style="font-size:24px">${getFlag(c)}</span>&nbsp;${c}</div>`
  ).join('');
  tooltip.innerHTML = `
    <div class="tt-sport" style="color:${color}">${effectiveCategory(ev)}</div>
    <div class="tt-name">${ev.name}</div>
    ${countryRows}
    <div class="tt-row">📅&nbsp;${fmtDate(ev.startDate)} – ${fmtDate(ev.endDate)}</div>
    <div class="tt-row">⏱&nbsp;${ev.lengthDays} day${ev.lengthDays !== 1 ? 's' : ''}</div>
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
  const todayPx = dayOffset(new Date().toISOString().split('T')[0]) * DAY_PX;
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
  const todayPx  = dayOffset(new Date().toISOString().split('T')[0]) * DAY_PX;
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
  const cr       = container.getBoundingClientRect();
  const tr       = targetEl.getBoundingClientRect();
  const top      = container.scrollTop + (tr.top - cr.top) - stickyH;
  container.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'instant' });
}

function scrollToWeekEvent(ev) {
  const evDate    = new Date(ev.startDate);
  const container = document.getElementById('weeklyMainPanel') || document.getElementById('weeklyView');
  const sections  = container.querySelectorAll('.week-section[data-week-start]');
  for (const section of sections) {
    const ws = new Date(section.dataset.weekStart);
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
  const targetX = Math.max(0, dayOffset(ev.startDate) * DAY_PX - wrapper.clientWidth * 0.25);

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

  let matches = [];
  let selectedIdx = -1;

  function setSelected(idx) {
    const items = results.querySelectorAll('.search-result-item');
    items.forEach(el => el.classList.remove('search-result-selected'));
    selectedIdx = idx;
    if (idx >= 0 && idx < items.length) {
      items[idx].classList.add('search-result-selected');
      items[idx].scrollIntoView({ block: 'nearest' });
    }
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    selectedIdx = -1;
    if (!q) { closeResults(); return; }

    matches = TOURNAMENTS
      .filter(ev => ev.name.toLowerCase().includes(q))
      .slice(0, 7);

    if (matches.length === 0) {
      results.innerHTML = '<div class="search-no-results">No results</div>';
    } else {
      results.innerHTML = matches.map((ev, i) =>
        `<div class="search-result-item" data-idx="${i}">
          <span class="sr-name">${ev.name}</span>
          <span class="sr-meta">${getFlag(ev.country)} ${ev.country} &middot; ${effectiveCategory(ev)} &middot; ${fmtDate(ev.startDate)}</span>
        </div>`
      ).join('');

      results.querySelectorAll('.search-result-item').forEach((el, i) => {
        el.addEventListener('mousedown', e => {
          e.preventDefault();
          goToTournament(matches[i]);
        });
        el.addEventListener('mousemove', () => setSelected(i));
      });
    }
    results.classList.add('open');
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeResults(); input.blur(); return; }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(Math.min(selectedIdx + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(Math.max(selectedIdx - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = selectedIdx >= 0 ? matches[selectedIdx] : matches[0];
      if (target) goToTournament(target);
    }
  });

  input.addEventListener('blur', () => setTimeout(closeResults, 150));
}

// ============================================================
//  CALENDAR / WEEKLY SIDEBAR FILTERS
// ============================================================
let currentView = 'timeline';
const cwFilters = { sports: new Set(), countries: new Set() };

function getFilteredTournaments() {
  const { sports, countries } = cwFilters;
  if (!sports.size && !countries.size) return TOURNAMENTS;
  return TOURNAMENTS.filter(ev => {
    const sportOk   = !sports.size   || sports.has(effectiveCategory(ev));
    const countryOk = !countries.size || countries.has(ev.country);
    return sportOk && countryOk;
  });
}

function buildCwSidebar() {
  buildCwList(
    'cwSportList',
    [...new Set(TOURNAMENTS.map(ev => effectiveCategory(ev)))].sort(),
    cwFilters.sports,
    sport => {
      const cls   = SPORT_ICONS[sport] || 'fa-solid fa-trophy';
      const color = getColor(sport);
      return `<i class="${cls}" style="color:${color};width:14px;text-align:center;flex-shrink:0;font-size:12px"></i>`;
    }
  );
  buildCwList(
    'cwCountryList',
    [...new Set(TOURNAMENTS.map(ev => ev.country))].sort(),
    cwFilters.countries,
    country => `<span style="font-size:15px;flex-shrink:0;line-height:1">${getFlag(country)}</span>`
  );
  updateCwUI();
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
  const total = cwFilters.sports.size + cwFilters.countries.size;
  const badge = document.getElementById('cwActiveBadge');
  if (badge) { badge.textContent = total || ''; badge.style.display = total ? '' : 'none'; }
  const btn = document.getElementById('cwClearBtn');
  if (btn) btn.disabled = !total;
}

function clearCwFilters() {
  cwFilters.sports.clear();
  cwFilters.countries.clear();
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
  const startYear  = TIMELINE_START.getFullYear();
  const endYear    = TIMELINE_END.getFullYear();
  const MONTHS     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmtDate    = d => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

  for (let year = startYear; year <= endYear; year++) {
    const yearStart = firstMondayOfYear(year);
    const yearEnd   = firstMondayOfYear(year + 1);

    let yearHeaderAdded = false;
    let weekNum = 1;
    let weekStart = new Date(yearStart);

    while (weekStart < yearEnd) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      if (weekEnd >= TIMELINE_START && weekStart <= TIMELINE_END) {
        if (!yearHeaderAdded) {
          const yearLabel = document.createElement('div');
          yearLabel.className = 'weekly-year-label';
          yearLabel.textContent = year;
          container.appendChild(yearLabel);
          yearHeaderAdded = true;
        }

        const isCurrentWeek = today >= weekStart && today <= weekEnd;

        const weekEvents = getFilteredTournaments()
          .filter(ev => {
            const s = parseLocalDate(ev.startDate);
            const e = parseLocalDate(ev.endDate);
            return s <= weekEnd && e >= weekStart;
          })
          .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

        const section = document.createElement('div');
        section.className = 'week-section' + (isCurrentWeek ? ' week-current' : '');
        section.dataset.weekStart = weekStart.toISOString().split('T')[0];

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
            const isNew      = new Date(ev.startDate) >= weekStart;
            const hasMatches = getMatchesForTournament(ev.name).length > 0;
            const startD     = parseLocalDate(ev.startDate);
            const endD       = parseLocalDate(ev.endDate);
            const durDays    = ev.lengthDays || (Math.round((endD - startD) / 86400000) + 1);

            const item = document.createElement('div');
            item.className   = 'week-event-item' + (isNew ? '' : ' week-event-ongoing');
            item.dataset.evName = ev.name;

            const icon = document.createElement('i');
            icon.className   = iconCls;
            icon.style.color = color;

            const nameEl = document.createElement('span');
            nameEl.className   = 'week-event-name';
            nameEl.textContent = ev.name;

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
            const item = document.createElement('div');
            item.className = 'match-item';

            const nameEl = document.createElement('span');
            nameEl.className   = 'match-item-name';
            nameEl.textContent = m.name;

            const md     = parseLocalDate(m.startDate);
            const dateEl = document.createElement('span');
            dateEl.className   = 'match-item-date';
            dateEl.textContent = `${md.getDate()} ${MONTHS[md.getMonth()]}`;

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
  const startYear  = TIMELINE_START.getFullYear();
  const endYear    = TIMELINE_END.getFullYear();

  for (let year = startYear; year <= endYear; year++) {
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

        const item = document.createElement('div');
        item.className = 'cal-event-item' + (ev.important ? ' cal-event-important' : '');
        item.dataset.evName = ev.name;

        const icon = document.createElement('i');
        icon.className = iconCls;
        icon.style.color = color;

        const name = document.createElement('span');
        name.className   = 'cal-event-name';
        name.textContent = ev.name;

        item.appendChild(icon);
        item.appendChild(name);

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

    // Escape: close the weekly match panel if open, otherwise scroll to start (like logo click)
    if (e.key === 'Escape' && !inInput) {
      if (currentView === 'weekly' && _activeMatchTournament) {
        closeMatchPanel();
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
    } else if (e.key === 'c' || e.key === 'C') {
      setView(currentView === 'calendar' ? 'timeline' : 'calendar');
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
    buildMonthHeaders();
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

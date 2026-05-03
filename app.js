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

// ============================================================
//  DATA SOURCE
// ============================================================
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSfVuGE4L38QC5CVV9zc3AN-vZ8Pi0ka7ieO10gpPZVq4bDYqoK41kUNaSxoKbGpmnEuwubg_Ln_mdE/pub?output=csv';

let TOURNAMENTS = [];

async function loadData() {
  const res   = await fetch(SHEET_URL);
  const text  = await res.text();
  const rows  = text.trim().split(/\r?\n/);
  const heads = rows.shift().split(',').map(h => h.trim().toLowerCase());
  const col   = name => heads.indexOf(name);

  TOURNAMENTS = rows
    .filter(r => r.trim())
    .map(row => {
      const parts = row.split(',');
      const get   = name => (parts[col(name)] || '').trim();
      const ev = {
        category:  get('category'),
        name:      get('name'),
        format:    get('format'),
        country:   get('country'),
        startDate: get('startdate'),
        endDate:   get('enddate'),
      };
      const game = get('game');
      if (game) ev.game = game;
      if (get('important').toLowerCase() === 'yes') ev.important = true;
      ev.lengthDays = Math.round((new Date(ev.endDate) - new Date(ev.startDate)) / 86400000) + 1;
      return ev;
    });
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

  // Star markers for event-format entries
  TOURNAMENTS
    .filter(ev => ev.format === 'event')
    .forEach(ev => {
      const x = dayOffset(ev.startDate) * DAY_PX;
      if (x < 0 || x > TOTAL_W) return;
      const marker = document.createElement('div');
      marker.className  = 'event-header-marker';
      marker.style.left = x + 'px';
      marker.innerHTML  = `
        <div class="event-header-label">★ ${ev.name}</div>
        <div class="event-header-tick"></div>
      `;
      marker.addEventListener('click', () => navigateToEvent(ev));
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
        <div class="category-icon" style="font-size:24px">${FLAGS[country] || '🌐'}</div>
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
    const isEvent = ev.format === 'event';
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
        const flag = FLAGS[ev.country] || '🌐';
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
            todayLabel.innerHTML = `<span class="bar-flag">${FLAGS[ev.country] || '🌐'}</span><span class="bar-text">${ev.name}</span>`;
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
  tooltip.innerHTML = `
    <div class="tt-sport" style="color:${color}">${effectiveCategory(ev)}</div>
    <div class="tt-name">${ev.name}</div>
    <div class="tt-row"><span style="font-size:24px">${FLAGS[ev.country] || '🌐'}</span>&nbsp;${ev.country}</div>
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

function scrollToToday() {
  const wrapper  = document.getElementById('timelineWrapper');
  const todayPx  = dayOffset(new Date().toISOString().split('T')[0]) * DAY_PX;
  const targetX  = Math.max(0, todayPx - wrapper.clientWidth * 0.25);
  animateScroll(targetX, 1400);
}

// ============================================================
//  NAVIGATE TO EVENT (shared by search + header click)
// ============================================================
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
    navigateToEvent(ev);
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
          <span class="sr-meta">${FLAGS[ev.country] || '🌐'} ${ev.country} &middot; ${effectiveCategory(ev)} &middot; ${fmtDate(ev.startDate)}</span>
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
    initScrollSync();
    initDragScroll();
    initSearch();
    initFilterClickOutside();
    initMobileTouch();
    if (window.innerWidth <= 768) {
      document.querySelector('.sidebar').classList.add('collapsed');
    }
    requestAnimationFrame(scrollToToday);
  } catch (err) {
    console.error('Failed to load tournament data:', err);
    document.getElementById('sidebarRows').innerHTML =
      '<div style="padding:16px 12px;color:#e53935;font-size:13px">Failed to load data. Check console.</div>';
  }
}

init();

// ============================================================
//  PROMOTIONS
// ============================================================
// Sport-trading promos sourced from the `Promotions` sheet tab. Promos can be
// tied to specific tournaments (`linkedtournaments`, pipe-delimited) and/or to
// a whole sport (`sport`). This module owns:
//
//   - Promo state + persistence (PROMOTIONS array, by-tournament index, filter)
//   - Promo rail above the timeline (buildPromoRail)
//   - Promo panel (slide-in right) with Active / Upcoming / Past grouping
//   - Tooltips for rail pills and bar badges
//
// External integration points are documented at `initPromotions(deps)` below.
// `parseLinkedTournaments` is a global from `lookups.js` (classic script).

import { fmtDate, todayLocalStr } from '../core/util.js';
import { DAY_PX, TOTAL_W, dayOffset } from '../core/timeline-config.js';
import { TOURNAMENTS } from '../core/data.js';
import { moveTooltip, hideTooltip } from '../views/tooltip.js';
import { navigateToEvent } from '../views/scroll.js';

const PROMO_ONLY_KEY = 'mjr_promo_only';

export let PROMOTIONS = []; // [{ name, description, startDate, endDate, linkedTournaments: [], sport }]
let PROMOTIONS_BY_TOURNAMENT = new Map(); // lowercase tournament name → [promo, …]
export let showOnlyPromos = false;

// ============================================================
//  STATE + PERSISTENCE
// ============================================================

export function setShowOnlyPromos(v) {
  showOnlyPromos = !!v;
}

export function loadPromoFilter() {
  try {
    showOnlyPromos = localStorage.getItem(PROMO_ONLY_KEY) === '1';
  } catch {
    showOnlyPromos = false;
  }
}

export function savePromoFilter() {
  try {
    localStorage.setItem(PROMO_ONLY_KEY, showOnlyPromos ? '1' : '0');
  } catch {}
}

// Parses raw CSV rows from the Promotions tab into PROMOTIONS, then builds the
// PROMOTIONS_BY_TOURNAMENT index — expanding sport-wide promos across every
// matching tournament (de-duped per tournament).
export function buildPromotionsData(promoRows, tournaments, effectiveCategory) {
  PROMOTIONS = promoRows
    .map(get => {
      const startDate = get('startdate');
      const endDate   = get('enddate') || startDate;
      return {
        name:              get('name'),
        description:       get('description'),
        startDate,
        endDate,
        linkedTournaments: parseLinkedTournaments(get('linkedtournaments')),
        sport:             get('sport'),
      };
    })
    .filter(p => p.name && p.startDate && p.endDate && (p.linkedTournaments.length > 0 || p.sport));

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
      tournaments.forEach(ev => {
        if ((ev.category && ev.category.toLowerCase() === target) ||
            (ev.subCategory && ev.subCategory.toLowerCase() === target) ||
            (effectiveCategory(ev).toLowerCase() === target)) {
          addPromoTo(ev.name);
        }
      });
    }
  });
}

export function getPromotionsForTournament(name) {
  return PROMOTIONS_BY_TOURNAMENT.get((name || '').toLowerCase()) || [];
}

// "Has an active promo" = at least one linked promo whose date range
// includes today.
export function hasActivePromo(ev) {
  const todayStr = todayLocalStr();
  return getPromotionsForTournament(ev.name)
    .some(p => p.startDate <= todayStr && todayStr <= p.endDate);
}

// ============================================================
//  PROMO RAIL (sticky strip above the timeline rows)
// ============================================================

export function buildPromoRail() {
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
      // Navigate to the first linked tournament. Use forwardOnly so the
      // horizontal scroll never goes backward into the past — for a finished
      // tournament we stay where we are horizontally (vertical scroll still
      // moves us to the tournament's row).
      const first = it.p.linkedTournaments[0];
      if (!first) return;
      const ev = TOURNAMENTS.find(t => t.name.toLowerCase() === first.toLowerCase());
      if (ev) navigateToEvent(ev, { forwardOnly: true });
    });

    rail.appendChild(pill);
  });
}

// ============================================================
//  TOOLTIPS — promo-specific renderers that share the global #tooltip element
// ============================================================

function showPromoTooltip(e, promo) {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;
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
// when the user hovers the gift icon embedded in the tournament bar (rendering
// of which still lives in app.js timeline code, which imports this function).
export function showBarPromoTooltip(e, promos) {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;
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
//  PROMO PANEL (slide-in right with Active / Upcoming / Past grouping)
// ============================================================

export function openPromoPanel() {
  if (PROMOTIONS.length === 0) return;
  renderPromoPanel();
  document.getElementById('promoPanelBackdrop').classList.add('open');
  const panel = document.getElementById('promoPanel');
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
}

export function closePromoPanel() {
  document.getElementById('promoPanelBackdrop').classList.remove('open');
  const panel = document.getElementById('promoPanel');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
}

export function isPromoPanelOpen() {
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

  const tournaments = TOURNAMENTS;
  const tournamentChips = promo.linkedTournaments.map(name => {
    const ev = tournaments.find(t => t.name.toLowerCase() === name.toLowerCase());
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
      const ev = tournaments.find(t => t.name === btn.dataset.evname);
      if (ev) {
        closePromoPanel();
        navigateToEvent(ev);
      }
    });
  });

  return card;
}

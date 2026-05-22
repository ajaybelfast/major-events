// ============================================================
//  WEEKLY VIEW
// ============================================================
// Vertically-stacked table of weeks (Mon–Sun), each listing the events
// touching that week. Trims empty leading/trailing weeks when filters
// narrow the result set, but always renders the current week so the blue
// "you are here" marker stays visible.
//
// The match panel is a sibling slide-in inside `#weeklyView` — when a row
// has matches data, a link opens it (features/match-panel.js).

import { parseLocalDate, getColor } from '../core/util.js';
import { TIMELINE_START, TIMELINE_END } from '../core/timeline-config.js';
import { effectiveCategory, getMatchesForTournament } from '../core/data.js';
import { moveTooltip, hideTooltip } from './tooltip.js';
import { scrollToEl } from './scroll.js';
import {
  buildMatchPanel,
  closeMatchPanel,
  getActiveMatchTournament,
  resetActiveMatchTournament,
} from '../features/match-panel.js';
import { getFilteredTournaments } from '../features/cw-filters.js';
import { getPromotionsForTournament, showBarPromoTooltip } from '../features/promotions.js';

// `SPORT_ICONS` and `getFlag` are globals from lookups.js (classic script).

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function firstMondayOfYear(year) {
  const jan1 = new Date(year, 0, 1);
  const daysToMon = (8 - jan1.getDay()) % 7;
  return new Date(year, 0, 1 + daysToMon);
}

function weekMondayOf(d) {
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  mon.setHours(0, 0, 0, 0);
  return mon;
}

export function buildWeeklyView() {
  resetActiveMatchTournament();

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
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fmtRowDate = d => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  // Compute the rendered week window: trim weeks before the first filtered
  // event and after the last, but always extend to include the current week
  // (which keeps the "you are here" blue marker visible no matter the filter).
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

  const timelineStart = TIMELINE_START;
  const timelineEnd   = TIMELINE_END;
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
          && weekEnd >= timelineStart && weekStart <= timelineEnd) {
        if (!yearHeaderAdded) {
          const yearLabel = document.createElement('div');
          yearLabel.className = 'weekly-year-label';
          yearLabel.textContent = year;
          container.appendChild(yearLabel);
          yearHeaderAdded = true;
        }

        const isPastWeek = weekEnd < today;
        const section = renderWeekSection({
          weekStart,
          weekEnd,
          weekNum,
          isCurrentWeek,
          isPastWeek,
          today,
          fmtRowDate,
        });
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

function renderWeekSection({ weekStart, weekEnd, weekNum, isCurrentWeek, isPastWeek, today, fmtRowDate }) {
  const weekEvents = getFilteredTournaments()
    .filter(ev => {
      const s = parseLocalDate(ev.startDate);
      const e = parseLocalDate(ev.endDate);
      return s <= weekEnd && e >= weekStart;
    })
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  const section = document.createElement('div');
  section.className = 'week-section'
    + (isCurrentWeek ? ' week-current' : '')
    + (isPastWeek    ? ' week-past'    : '');
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
      list.appendChild(renderWeekEventItem(ev, weekStart, weekEnd, today, fmtRowDate));
    });
    section.appendChild(list);
  }

  return section;
}

function renderWeekEventItem(ev, weekStart, weekEnd, today, fmtRowDate) {
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
  const isPast      = endD < today;

  const item = document.createElement('div');
  item.className   = 'week-event-item'
    + (ev.highlight ? ' week-event-highlight' : '')
    + (isPast       ? ' week-event-past'      : '');
  item.dataset.evName = ev.name;

  const icon = document.createElement('i');
  icon.className   = iconCls;
  icon.style.color = color;

  const nameEl = document.createElement('span');
  nameEl.className = 'week-event-name';
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
  startEl.textContent = fmtRowDate(startD);

  const endEl = document.createElement('span');
  endEl.className   = 'week-event-date';
  endEl.textContent = fmtRowDate(endD);

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
      if (getActiveMatchTournament() === ev.name) {
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

  // Promo badge — small purple gift; hover-tooltip lists every promo. Always
  // append a slot (badge or empty span) so the grid stays aligned.
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

  return item;
}

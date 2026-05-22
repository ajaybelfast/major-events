// ============================================================
//  CALENDAR VIEW
// ============================================================
// 12-month grid per year. Only renders years that have at least one
// filtered event (so applying a narrow filter doesn't show empty
// 2025/2027 grids when all matches are in 2026). Each month cell lists
// the events that touch it; clicking an event jumps to the Weekly view.

import { parseLocalDate, getColor } from '../core/util.js';
import { effectiveCategory } from '../core/data.js';
import { showTooltip, moveTooltip, hideTooltip } from './tooltip.js';
import { navigateToWeekForEvent, scrollToEl } from './scroll.js';
import { getFilteredTournaments } from '../features/cw-filters.js';
import { getPromotionsForTournament, showBarPromoTooltip } from '../features/promotions.js';

// `SPORT_ICONS` is a global from lookups.js.

const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export function buildCalendarView() {
  const container = document.getElementById('calendarView');
  container.innerHTML = '';

  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Only render years that actually contain filtered events — avoids empty
  // Jan–Dec grids for years like 2025/2027 when the active filter only
  // matches 2026 events.
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
      cell.className = 'cal-month-cell'
        + (isCurrent ? ' cal-month-current' : '')
        + (isPast    ? ' cal-month-past'    : '');
      cell.dataset.yearMonth = `${year}-${m}`;

      const mHeader = document.createElement('div');
      mHeader.className   = 'cal-month-header';
      mHeader.textContent = MONTH_NAMES[m];
      cell.appendChild(mHeader);

      const list = document.createElement('div');
      list.className = 'cal-event-list';

      monthEvents.forEach(ev => {
        list.appendChild(renderCalEventItem(ev, today, monthStart, monthEnd));
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

function renderCalEventItem(ev, today, monthStart, monthEnd) {
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
  const isPast      = endD < today;

  const item = document.createElement('div');
  item.className = 'cal-event-item'
    + (ev.highlight ? ' cal-event-highlight' : '')
    + (isLive       ? ' cal-event-live'      : '')
    + (isPast       ? ' cal-event-past'      : '');
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
    const marker = document.createElement('i');
    marker.className = 'fa-solid fa-circle-play start-marker';
    marker.title     = 'Starts this month';
    calMarkerSlot.appendChild(marker);
  } else if (showEnd) {
    const marker = document.createElement('i');
    marker.className = 'fa-solid fa-circle-xmark end-marker';
    marker.title     = 'Ends this month';
    calMarkerSlot.appendChild(marker);
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

  return item;
}

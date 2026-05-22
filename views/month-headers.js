// ============================================================
//  MONTH HEADERS (timeline)
// ============================================================
// Sticky header above the timeline rows. Renders the month grid (year +
// month name per column), the orange "TODAY" pill, and the gold "★ Name"
// pills for `toppin`-flagged tournaments. Top-pin pills lane-pack so they
// never overlap horizontally.

import {
  DAY_PX,
  TOTAL_W,
  TOTAL_DAYS,
  TIMELINE_START,
  TIMELINE_END,
  dayOffset,
} from '../core/timeline-config.js';
import { TOURNAMENTS } from '../core/data.js';
import { showTooltip, moveTooltip, hideTooltip } from './tooltip.js';
import { navigateToEvent } from './scroll.js';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function buildMonthHeaders() {
  const header = document.getElementById('monthsHeader');
  header.style.width = TOTAL_W + 'px';

  let d = new Date(TIMELINE_START);
  d.setDate(1);

  while (d < TIMELINE_END) {
    const off         = dayOffset(d);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const leftPx      = Math.max(0, off * DAY_PX);

    if (off >= 0) {
      const divider = document.createElement('div');
      divider.className  = 'month-divider';
      divider.style.left = (off * DAY_PX) + 'px';
      header.appendChild(divider);
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

  // "TODAY" pill on the header rail.
  const todayOff = dayOffset(new Date());
  if (todayOff >= 0 && todayOff <= TOTAL_DAYS) {
    const todayLbl = document.createElement('div');
    todayLbl.className  = 'today-header-label';
    todayLbl.style.left = (todayOff * DAY_PX) + 'px';
    todayLbl.textContent = 'TODAY';
    header.appendChild(todayLbl);
  }

  // Top-pin star markers — lane-packed so labels never overlap.
  // The header has room for 3 lanes within its 64px height.
  const LABEL_SLOT_H = 20;

  const headerEvents = TOURNAMENTS
    .filter(ev => ev.topPin === true)
    .map(ev => ({ ev, x: dayOffset(ev.startDate) * DAY_PX }))
    .filter(({ x }) => x >= 0 && x <= TOTAL_W)
    .sort((a, b) => a.x - b.x);

  // Estimate rendered label width (capped at max-width 120px) + small buffer.
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

    // Spacer pushes the label down to its assigned lane row.
    if (lane > 0) {
      const spacer = document.createElement('div');
      spacer.style.cssText = `height:${lane * LABEL_SLOT_H}px;flex-shrink:0`;
      marker.appendChild(spacer);
    }

    // Every entry is a `toppin` tournament — render in the gold pill.
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

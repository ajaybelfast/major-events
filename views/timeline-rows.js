// ============================================================
//  TIMELINE ROWS + BARS
// ============================================================
// The horizontal bars that visualise tournaments along the timeline.
// One row per sport (or per country in country-sort mode); inside each
// row, bars are pre-lane-packed by `assignLanes` / `assignCountryLanes`
// in the filters module so they never overlap.
//
// `makeBar` is the heart of this module — it produces a `.tournament-bar`
// (or `.event-star-marker` for single-day events), wires the fav star,
// the promo badge, the today-sticker label, the tooltip handlers, etc.

import {
  DAY_PX,
  BAR_H,
  LANE_H,
  ROW_PAD,
  TOTAL_W,
  TOTAL_DAYS,
  TIMELINE_START,
  TIMELINE_END,
  dayOffset,
} from '../core/timeline-config.js';
import { getColor } from '../core/util.js';
import { effectiveCategory } from '../core/data.js';
import { showTooltip, moveTooltip, hideTooltip } from './tooltip.js';
import {
  isFavourite,
  toggleFavourite,
  showOnlyFavourites,
} from '../features/favourites.js';
import {
  getPromotionsForTournament,
  hasActivePromo,
  showBarPromoTooltip,
} from '../features/promotions.js';
import {
  sortMode,
  getSortedCatData,
  getSortedCountryData,
  rebuildViews,
} from '../features/filters.js';

// `SPORT_ICONS` and `getFlag` are globals from lookups.js.

export function buildTimelineRows() {
  const rowsEl = document.getElementById('timelineRows');
  rowsEl.style.width = TOTAL_W + 'px';

  // Month grid lines.
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

  // Today marker.
  const todayOff = dayOffset(new Date());
  if (todayOff >= 0 && todayOff <= TOTAL_DAYS) {
    const tm = document.createElement('div');
    tm.className  = 'today-marker';
    tm.style.left = (todayOff * DAY_PX) + 'px';
    rowsEl.appendChild(tm);
  }

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

    // Favourite star — only when bar is wide enough to fit the icon.
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

    // Promo badge — purple ring (always when any active promo) + clickable
    // gift icon (only when bar is wide). Hover shows the promo list.
    const promos = getPromotionsForTournament(ev.name);
    if (hasActivePromo(ev)) bar.classList.add('bar-promo-active');
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

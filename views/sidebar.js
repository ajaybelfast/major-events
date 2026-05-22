// ============================================================
//  SIDEBAR (timeline)
// ============================================================
// Left-hand column of the timeline view. Renders one row per sport (or
// per country in country-sort mode). Each row shows an icon, the label,
// a status pill (NOW / in Xd), and — for sport rows — a gold $ marker
// if the sport is in the top-revenue set.

import { isTopRevenueSport } from '../features/top-revenue.js';
import { sortMode, getSortedCatData, getSortedCountryData } from '../features/filters.js';
import { navigateToEvent } from './scroll.js';

// `getFlag`, `SPORT_ICONS`, `ESPORTS_LOGOS` are globals from lookups.js.

export function buildSidebar() {
  const container = document.getElementById('sidebarRows');
  container.innerHTML = '';

  if (sortMode === 'country') {
    getSortedCountryData().forEach(entry => {
      container.appendChild(renderCountryRow(entry));
    });
    return;
  }

  getSortedCatData().forEach(entry => {
    container.appendChild(renderSportRow(entry));
  });
}

function renderCountryRow({ country, events, rowHeight, isLiveSlice, isActive, nextMs }) {
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
      badge.addEventListener('click', e => {
        e.stopPropagation();
        navigateToEvent(nextEv, { horizontalOnly: true });
      });
    }
  }
  return row;
}

function renderSportRow({ cat, events, rowHeight, isLiveSlice, isActive, nextMs }) {
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
      badge.addEventListener('click', e => {
        e.stopPropagation();
        navigateToEvent(nextEv, { horizontalOnly: true });
      });
    }
  }
  return row;
}

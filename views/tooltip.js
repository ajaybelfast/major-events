// ============================================================
//  TOOLTIP
// ============================================================
// Hover popup shown over timeline bars, calendar / weekly chips, header
// rail markers, etc. Resolves the DOM element lazily so module import
// order doesn't matter — `tooltip` is a getter rather than a static
// reference captured at module load.

import { fmtDate } from '../core/util.js';

// `parseCountries` and `getFlag` are defined as globals in `lookups.js`
// (which loads as a classic script before any module runs).

let _tooltipEl = null;
function el() {
  if (!_tooltipEl) _tooltipEl = document.getElementById('tooltip');
  return _tooltipEl;
}

export function showTooltip(e, ev, color) {
  const tooltip = el();
  if (!tooltip) return;
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

export function moveTooltip(e) {
  const tooltip = el();
  if (!tooltip) return;
  const pad = 14;
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  if (x + tw > window.innerWidth)  x = e.clientX - tw - pad;
  if (y + th > window.innerHeight) y = e.clientY - th - pad;
  tooltip.style.left = x + 'px';
  tooltip.style.top  = y + 'px';
}

export function hideTooltip() {
  const tooltip = el();
  if (tooltip) tooltip.classList.remove('visible');
}

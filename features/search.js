// ============================================================
//  SEARCH (header dropdown)
// ============================================================
// Smart search that surfaces three kinds of results from the same query:
//   1. Sport chips ("Filter to Tennis") — apply a filter via the
//      caller-supplied `applySearchFilter` callback.
//   2. Country chips ("Filter to Spain") — same.
//   3. Tournament rows — navigate to the event in whichever view the user
//      is currently looking at.
//
// `applySearchFilter` lives in app.js because it mutates sortMode,
// activeFilters, cwFilters, and triggers rebuilds. We just call it back here.

import { fmtDate, getColor } from '../core/util.js';
import { TOURNAMENTS, effectiveCategory } from '../core/data.js';
import { currentView } from '../core/view-state.js';
import {
  navigateToEvent,
  scrollToCalendarEvent,
  scrollToWeekEvent,
} from '../views/scroll.js';
import { applySearchFilter } from './filters.js';

// `SPORT_ICONS` and `getFlag` are globals from lookups.js (classic script).

export function initSearch() {
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
    const view = currentView;
    if (view === 'calendar') {
      scrollToCalendarEvent(ev);
    } else if (view === 'weekly') {
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

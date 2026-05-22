// ============================================================
//  SETTINGS PANEL
// ============================================================
// Slide-in right panel for managing user-level preferences. Currently
// surfaces: keyboard shortcuts (reference list) and Favorite Events
// management (full list, unstar / clear all).
//
// External dependencies are imported directly from their owning modules
// (TOURNAMENTS, currentView, etc.) — no runtime deps injection needed.

import {
  favourites,
  isFavourite,
  toggleFavourite,
  saveFavourites,
} from './favourites.js';
import { fmtDate } from '../core/util.js';
import { TOURNAMENTS, effectiveCategory } from '../core/data.js';
import { currentView } from '../core/view-state.js';
import { updateFilterBtn, rebuildViews } from './filters.js';
import { updateCwUI, rebuildCwView } from './cw-filters.js';

export function openSettingsPanel() {
  document.getElementById('settingsBackdrop').classList.add('open');
  const panel = document.getElementById('settingsPanel');
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  renderSettings();
}

export function closeSettingsPanel() {
  document.getElementById('settingsBackdrop').classList.remove('open');
  const panel = document.getElementById('settingsPanel');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
}

export function isSettingsPanelOpen() {
  const panel = document.getElementById('settingsPanel');
  return panel && panel.classList.contains('open');
}

export function renderSettings() {
  const content = document.getElementById('settingsContent');
  content.innerHTML = '';
  content.appendChild(renderSettingsFavourites());
  content.appendChild(renderSettingsShortcuts());
}

function renderSettingsShortcuts() {
  const section = document.createElement('div');
  section.className = 'settings-section';

  const header = document.createElement('div');
  header.className = 'settings-section-header';
  header.innerHTML = `
    <span class="settings-section-title"><i class="fa-solid fa-keyboard" style="color:#7ee787"></i> Keyboard shortcuts</span>
  `;
  section.appendChild(header);

  const list = document.createElement('div');
  list.className = 'settings-shortcut-list';
  const shortcuts = [
    { key: 'T',   label: 'Go to today' },
    { key: 'S',   label: 'Focus search' },
    { key: 'V',   label: 'Cycle view (Timeline → Calendar → Weekly)' },
    { key: 'Esc', label: 'Close panel · timeline: scroll to start · calendar/weekly: go to today' },
  ];
  shortcuts.forEach(s => {
    const row = document.createElement('div');
    row.className = 'settings-shortcut-row';
    row.innerHTML = `
      <span class="settings-shortcut-label">${s.label}</span>
      <kbd class="settings-kbd">${s.key}</kbd>
    `;
    list.appendChild(row);
  });
  section.appendChild(list);

  return section;
}

function renderSettingsFavourites() {
  const section = document.createElement('div');
  section.className = 'settings-section';

  const favEvents = TOURNAMENTS
    .filter(isFavourite)
    .sort((a, b) => a.name.localeCompare(b.name));

  const header = document.createElement('div');
  header.className = 'settings-section-header';
  header.innerHTML = `
    <span class="settings-section-title"><i class="fa-solid fa-star" style="color:#F7C948"></i> Favorite Events</span>
    <span class="settings-section-count">${favEvents.length}</span>
  `;
  section.appendChild(header);

  const list = document.createElement('div');
  list.className = 'settings-fav-list';
  section.appendChild(list);

  if (favEvents.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'settings-fav-empty';
    empty.textContent = 'No favorite events yet. Star a tournament on the timeline to add it here.';
    list.appendChild(empty);
  } else {
    favEvents.forEach(ev => list.appendChild(renderSettingsFavRow(ev)));
  }

  const actions = document.createElement('div');
  actions.className = 'settings-section-actions';
  const clearBtn = document.createElement('button');
  clearBtn.className = 'settings-clear-btn';
  clearBtn.textContent = 'Clear all favorite events';
  clearBtn.disabled = favEvents.length === 0;
  clearBtn.addEventListener('click', clearAllFavourites);
  actions.appendChild(clearBtn);
  section.appendChild(actions);

  return section;
}

function renderSettingsFavRow(ev) {
  const row = document.createElement('div');
  row.className = 'settings-fav-row';

  const sport = effectiveCategory(ev);
  const dateStr = ev.startDate === ev.endDate
    ? fmtDate(ev.startDate)
    : `${fmtDate(ev.startDate)} – ${fmtDate(ev.endDate)}`;
  const country = ev.country ? ` · ${ev.country}` : '';

  row.innerHTML = `
    <i class="fa-solid fa-star settings-fav-icon"></i>
    <div class="settings-fav-meta">
      <div class="settings-fav-name">${ev.name}</div>
      <div class="settings-fav-detail">${sport} · ${dateStr}${country}</div>
    </div>
  `;

  const unstar = document.createElement('button');
  unstar.className = 'settings-fav-unstar';
  unstar.title = 'Remove from favorite events';
  unstar.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  unstar.addEventListener('click', () => {
    toggleFavourite(ev);
    row.classList.add('removing');
    setTimeout(() => {
      renderSettings();           // refresh count + list
      updateFilterBtn();
      updateCwUI();
      rebuildViews();
      if (currentView === 'calendar' || currentView === 'weekly') rebuildCwView();
    }, 180);
  });
  row.appendChild(unstar);
  return row;
}

export function clearAllFavourites() {
  if (favourites.size === 0) return;
  const msg = `Remove all ${favourites.size} favorite events?`;
  if (!confirm(msg)) return;
  favourites.clear();
  saveFavourites();
  renderSettings();
  updateFilterBtn();
  updateCwUI();
  rebuildViews();
  if (currentView === 'calendar' || currentView === 'weekly') rebuildCwView();
}

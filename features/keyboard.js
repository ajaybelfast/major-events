// ============================================================
//  KEYBOARD SHORTCUTS
// ============================================================
// Global keydown handler. All the panel/view callbacks come in via
// `initKeyboardShortcuts(deps)` so this module stays decoupled from the
// rest of app.js. Add a new shortcut here AND in the settings-panel
// shortcut list so the help reflects it.

import {
  isPromoPanelOpen,
  closePromoPanel,
} from './promotions.js';
import {
  isSettingsPanelOpen,
  closeSettingsPanel,
} from './settings-panel.js';
import {
  closeMatchPanel,
  getActiveMatchTournament,
} from './match-panel.js';
import { goToToday, scrollToStart } from '../views/scroll.js';
import { currentView, setView } from '../core/view-state.js';

export function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    const inInput = document.activeElement.tagName === 'INPUT' ||
                    document.activeElement.tagName === 'TEXTAREA';

    // Esc priority: promo panel → settings → match panel → view default.
    // Timeline default = scroll to start; calendar/weekly default = go to today.
    if (e.key === 'Escape' && !inInput) {
      const view = currentView;
      if (isPromoPanelOpen()) {
        closePromoPanel();
      } else if (isSettingsPanelOpen()) {
        closeSettingsPanel();
      } else if (view === 'weekly' && getActiveMatchTournament()) {
        closeMatchPanel();
      } else if (view === 'calendar' || view === 'weekly') {
        goToToday();
      } else {
        scrollToStart();
      }
      return;
    }

    if (inInput) return; // don't steal T / S / V while the user is typing

    if (e.key === 't' || e.key === 'T') {
      goToToday();
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    } else if (e.key === 'v' || e.key === 'V') {
      const order = ['timeline', 'calendar', 'weekly'];
      const i = order.indexOf(currentView);
      setView(order[(i + 1) % order.length]);
    }
  });
}

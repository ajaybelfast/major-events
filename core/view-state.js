// ============================================================
//  VIEW STATE
// ============================================================
// Which top-level view is currently displayed (timeline / calendar /
// weekly), plus the `setView()` choreography that toggles the layouts.
//
// Exported as an ES module live binding — consumers `import { currentView }`
// and see the latest value at read time, no getters needed.

import { buildCalendarView } from '../views/calendar.js';
import { buildWeeklyView } from '../views/weekly.js';

export let currentView = 'timeline';

// Adds a `view-<name>` class to <body>, removing the previous one. CSS uses
// this for view-scoped rules (e.g. hiding the "Hide completed" pill in
// timeline view). Safe to call before setView() runs — used at boot.
export function applyViewBodyClass(view) {
  document.body.classList.remove('view-timeline', 'view-calendar', 'view-weekly');
  document.body.classList.add(`view-${view}`);
}

export function setView(view) {
  currentView = view;
  try { localStorage.setItem('mjr_view', view); } catch {}
  applyViewBodyClass(view);

  const mainEl    = document.getElementById('mainView');
  const cwLayout  = document.getElementById('cwLayout');
  const calEl     = document.getElementById('calendarView');
  const weeklyEl  = document.getElementById('weeklyView');
  const btnTL     = document.getElementById('btnTimeline');
  const btnCal    = document.getElementById('btnCalendar');
  const btnWeekly = document.getElementById('btnWeekly');
  const todayBtn  = document.querySelector('.today-btn');

  mainEl.style.display    = 'none';
  cwLayout.style.display  = 'none';
  calEl.style.display     = 'none';
  weeklyEl.style.display  = 'none';
  btnTL.classList.remove('on');
  btnCal.classList.remove('on');
  btnWeekly.classList.remove('on');
  if (todayBtn) todayBtn.style.display = '';

  if (view === 'timeline') {
    mainEl.style.display = 'flex';
    btnTL.classList.add('on');
  } else if (view === 'calendar') {
    cwLayout.style.display = 'flex';
    calEl.style.display    = 'block';
    btnCal.classList.add('on');
    buildCalendarView();
  } else if (view === 'weekly') {
    cwLayout.style.display = 'flex';
    weeklyEl.style.display = 'flex';
    btnWeekly.classList.add('on');
    buildWeeklyView();
  }
}

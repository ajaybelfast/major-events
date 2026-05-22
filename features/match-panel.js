// ============================================================
//  MATCH PANEL (weekly view)
// ============================================================
// Slide-in right-hand panel that lists every match for a single tournament,
// grouped Mon–Sun. Opened by clicking the "Matches loaded ›" link on a
// tournament row in the weekly view; closed by × button or Esc.
//
// Owns `_activeMatchTournament` (which tournament's matches the panel is
// currently showing). The weekly view rebuild clears this via
// `resetActiveMatchTournament()`; the Esc handler reads it via
// `getActiveMatchTournament()`.

import { fmtDate, parseLocalDate } from '../core/util.js';
import { TOURNAMENTS, getMatchesForTournament } from '../core/data.js';

// `getFlag` is a global from lookups.js (classic script).

let _activeMatchTournament = null;

export function getActiveMatchTournament() {
  return _activeMatchTournament;
}

export function resetActiveMatchTournament() {
  _activeMatchTournament = null;
}

export function closeMatchPanel() {
  _activeMatchTournament = null;
  const panel = document.getElementById('weeklyMatchPanel');
  if (panel) {
    panel.classList.remove('open');
    panel.innerHTML = '';
  }
  document.querySelectorAll('.week-event-item.match-active')
    .forEach(el => el.classList.remove('match-active'));
}

export function buildMatchPanel(tournamentName) {
  const panel = document.getElementById('weeklyMatchPanel');
  if (!panel) return;

  document.querySelectorAll('.week-event-item.match-active')
    .forEach(el => el.classList.remove('match-active'));
  _activeMatchTournament = tournamentName;
  document.querySelectorAll('.week-event-item').forEach(el => {
    if (el.dataset.evName === tournamentName) el.classList.add('match-active');
  });

  const matches = getMatchesForTournament(tournamentName);
  panel.innerHTML = '';
  panel.classList.add('open');

  const header = document.createElement('div');
  header.className = 'match-panel-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'match-panel-title-wrap';

  const parentTournament = TOURNAMENTS
    .find(t => t.name.toLowerCase() === tournamentName.toLowerCase());
  if (parentTournament) {
    const flagEl = document.createElement('span');
    flagEl.className   = 'match-panel-header-flag';
    flagEl.textContent = getFlag(parentTournament.country);
    titleWrap.appendChild(flagEl);
  }

  const title = document.createElement('span');
  title.className   = 'match-panel-title';
  title.textContent = tournamentName;
  titleWrap.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'match-panel-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.title     = 'Close';
  closeBtn.addEventListener('click', closeMatchPanel);

  header.appendChild(titleWrap);

  if (parentTournament) {
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const endDate  = parseLocalDate(parentTournament.endDate);
    const daysLeft = Math.round((endDate - today) / 86400000);
    let daysStr = '';
    if (daysLeft > 0)       daysStr = ` · ${daysLeft} days left`;
    else if (daysLeft === 0) daysStr = ' · ends today';

    const meta = document.createElement('div');
    meta.className   = 'match-panel-meta';
    meta.textContent = `Runs ${fmtDate(parentTournament.startDate)} – ${fmtDate(parentTournament.endDate)}${daysStr}`;
    header.appendChild(meta);
  }

  header.appendChild(closeBtn);
  panel.appendChild(header);

  const content = document.createElement('div');
  content.className = 'match-panel-content';

  let scrollTarget = null;

  if (matches.length === 0) {
    const empty = document.createElement('div');
    empty.className   = 'match-panel-empty';
    empty.textContent = 'No matches found.';
    content.appendChild(empty);
  } else {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const today  = new Date(); today.setHours(0, 0, 0, 0);

    // Group by Mon–Sun week.
    const weekMap = new Map();
    matches.forEach(m => {
      const d   = parseLocalDate(m.startDate);
      const day = d.getDay();
      const mon = new Date(d);
      mon.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
      const key = `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,'0')}-${String(mon.getDate()).padStart(2,'0')}`;
      if (!weekMap.has(key)) weekMap.set(key, { mon, items: [] });
      weekMap.get(key).items.push(m);
    });

    let weekNum = 0;
    let firstSection = null;

    [...weekMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([, { mon, items }]) => {
        weekNum++;
        const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
        const isCurrentWeek = today >= mon && today <= sun;
        const isUpcoming    = mon > today;
        const isPastWeek    = sun < today;

        const section = document.createElement('div');
        section.className = 'match-week-section'
          + (isCurrentWeek ? ' match-week-current' : '')
          + (isPastWeek    ? ' match-week-past'    : '');

        const wHdr = document.createElement('div');
        wHdr.className = 'match-week-header';

        const numLabel = document.createElement('span');
        numLabel.className   = 'match-week-num';
        numLabel.textContent = `Week ${weekNum}`;

        const dateLabel = document.createElement('span');
        dateLabel.className   = 'match-week-dates';
        dateLabel.textContent = `${mon.getDate()} ${MONTHS[mon.getMonth()]} – ${sun.getDate()} ${MONTHS[sun.getMonth()]}`;

        wHdr.appendChild(numLabel);
        wHdr.appendChild(dateLabel);
        section.appendChild(wHdr);

        items
          .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name))
          .forEach(m => {
            const md      = parseLocalDate(m.startDate);
            const isToday = md.getTime() === today.getTime();
            const isPast  = md.getTime() < today.getTime();

            const item = document.createElement('div');
            item.className = 'match-item'
              + (isToday ? ' match-item-today' : '')
              + (isPast  ? ' match-item-past'  : '');

            const nameEl = document.createElement('span');
            nameEl.className   = 'match-item-name';
            nameEl.textContent = m.name;

            const dateEl = document.createElement('span');
            if (isToday) {
              dateEl.className   = 'match-item-date match-item-today-pill';
              dateEl.textContent = 'TODAY';
            } else {
              dateEl.className   = 'match-item-date';
              dateEl.textContent = `${md.getDate()} ${MONTHS[md.getMonth()]}`;
            }

            item.appendChild(dateEl);
            item.appendChild(nameEl);
            section.appendChild(item);
          });

        content.appendChild(section);

        if (!firstSection) firstSection = section;
        if (!scrollTarget && (isCurrentWeek || isUpcoming)) scrollTarget = section;
      });

    // Tournament finished — scroll to first week.
    if (!scrollTarget) scrollTarget = firstSection;
  }

  panel.appendChild(content);

  if (scrollTarget) {
    requestAnimationFrame(() => {
      const cr = content.getBoundingClientRect();
      const tr = scrollTarget.getBoundingClientRect();
      content.scrollTop += tr.top - cr.top;
    });
  }
}

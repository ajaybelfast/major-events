// ============================================================
//  SCROLL HELPERS
// ============================================================
// Bundles all scroll-related behaviour for the timeline:
//   - Sync between the sidebar's vertical scroll and the timeline body.
//   - Drag-to-scroll on desktop (click + drag on the wrapper).
//   - Mobile touch forwarding so a vertical swipe on the sidebar scrolls
//     the timeline instead of bouncing.
//   - "Go to today" / "scroll to start" animations.
//   - View-aware navigation helpers used by search, sidebar status pills,
//     the promo rail, and the toppin pills.

import { DAY_PX, BAR_H, dayOffset } from '../core/timeline-config.js';
import { parseLocalDate, todayLocalStr } from '../core/util.js';
import { currentView, setView } from '../core/view-state.js';

// ── Vertical scroll sync ─────────────────────────────────────

export function initScrollSync() {
  const wrapper     = document.getElementById('timelineWrapper');
  const sidebarRows = document.getElementById('sidebarRows');

  wrapper.addEventListener('scroll', () => {
    sidebarRows.scrollTop = wrapper.scrollTop;
  });

  // Forward wheel events on the sidebar to the timeline.
  document.querySelector('.sidebar').addEventListener('wheel', e => {
    e.preventDefault();
    wrapper.scrollTop += e.deltaY;
  }, { passive: false });
}

// ── Mobile touch forwarding ──────────────────────────────────

export function initMobileTouch() {
  if (window.innerWidth > 768) return;

  const wrapper     = document.getElementById('timelineWrapper');
  const filterPanel = document.getElementById('filterPanel');

  // Forward vertical swipes on `el` to the timeline wrapper.
  // A tap (no real movement) is left alone so existing click/onclick handlers fire.
  function addScrollForwarding(el) {
    let startY, startX, lastY;

    el.addEventListener('touchstart', e => {
      startY = lastY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
    }, { passive: true });

    el.addEventListener('touchmove', e => {
      if (filterPanel.classList.contains('open')) return;
      const currentY = e.touches[0].clientY;
      const totalDy  = Math.abs(currentY - startY);
      const totalDx  = Math.abs(e.touches[0].clientX - startX);
      // Only intercept clearly vertical swipes (> 4 px and more vertical than horizontal).
      if (totalDy > 4 && totalDy > totalDx) {
        wrapper.scrollTop -= (currentY - lastY);
        e.preventDefault(); // suppresses the onclick so sidebar doesn't toggle on scroll
      }
      lastY = currentY;
    }, { passive: false });
  }

  addScrollForwarding(document.querySelector('.sidebar'));
  addScrollForwarding(document.getElementById('sidebarBackdrop'));
}

// ── Drag-to-scroll ───────────────────────────────────────────

export function initDragScroll() {
  const wrapper = document.getElementById('timelineWrapper');
  let dragging  = false, startX, startY, scrollX, scrollY;

  wrapper.addEventListener('mousedown', e => {
    if (e.target.closest('.tournament-bar')) return;
    dragging = true;
    startX   = e.clientX;
    startY   = e.clientY;
    scrollX  = wrapper.scrollLeft;
    scrollY  = wrapper.scrollTop;
    wrapper.classList.add('is-dragging');
  });

  document.addEventListener('mouseup', () => {
    dragging = false;
    wrapper.classList.remove('is-dragging');
  });

  wrapper.addEventListener('mousemove', e => {
    if (!dragging) return;
    e.preventDefault();
    wrapper.scrollLeft = scrollX - (e.clientX - startX);
    wrapper.scrollTop  = scrollY - (e.clientY - startY);
  });
}

// ── Scroll-to helpers ────────────────────────────────────────

function animateScroll(targetX, duration) {
  const wrapper = document.getElementById('timelineWrapper');
  const startX  = wrapper.scrollLeft;
  const delta   = targetX - startX;
  const t0      = performance.now();

  function step(now) {
    const p    = Math.min((now - t0) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 4);   // ease-out quartic
    wrapper.scrollLeft = startX + delta * ease;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

export function scrollToStart() {
  const wrapper = document.getElementById('timelineWrapper');
  const todayPx = dayOffset(new Date()) * DAY_PX;
  const targetX = Math.max(0, todayPx - wrapper.clientWidth * 0.25);
  const targetY = 0;
  const startX  = wrapper.scrollLeft;
  const startY  = wrapper.scrollTop;
  const deltaX  = targetX - startX;
  const deltaY  = targetY - startY;
  const t0      = performance.now();

  (function step(now) {
    const p    = Math.min((now - t0) / 1400, 1);
    const ease = 1 - Math.pow(1 - p, 4);
    wrapper.scrollLeft = startX + deltaX * ease;
    wrapper.scrollTop  = startY + deltaY * ease;
    if (p < 1) requestAnimationFrame(step);
  })(performance.now());
}

export function goToToday() {
  const view = currentView;
  if (view === 'timeline') {
    scrollToToday();
  } else if (view === 'calendar') {
    const container = document.getElementById('calendarView');
    const cell      = container.querySelector('.cal-month-current');
    if (cell) scrollToEl(container, cell);
  } else if (view === 'weekly') {
    const container = document.getElementById('weeklyMainPanel') || document.getElementById('weeklyView');
    const section   = container.querySelector('.week-section.week-current');
    if (section) scrollToEl(container, section);
  }
}

export function scrollToToday() {
  const wrapper  = document.getElementById('timelineWrapper');
  const todayPx  = dayOffset(new Date()) * DAY_PX;
  const targetX  = Math.max(0, todayPx - wrapper.clientWidth * 0.25);
  animateScroll(targetX, 1400);
}

// Scroll `container` so `targetEl` sits just below any sticky header inside it.
export function scrollToEl(container, targetEl, smooth = true) {
  const stickyEl = container.querySelector('.weekly-year-label, .cal-year-label');
  const stickyH  = stickyEl ? stickyEl.offsetHeight : 0;
  // Sticky elements pin to the container's padding-box top, so the container's
  // own padding-top sits above the sticky's stuck position. Subtract both.
  const padTop   = parseFloat(getComputedStyle(container).paddingTop) || 0;
  const cr       = container.getBoundingClientRect();
  const tr       = targetEl.getBoundingClientRect();
  const top      = container.scrollTop + (tr.top - cr.top) - stickyH - padTop;
  container.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'instant' });
}

export function scrollToWeekEvent(ev) {
  const evDate    = parseLocalDate(ev.startDate);
  const container = document.getElementById('weeklyMainPanel') || document.getElementById('weeklyView');
  const sections  = container.querySelectorAll('.week-section[data-week-start]');
  for (const section of sections) {
    const ws = parseLocalDate(section.dataset.weekStart);
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    if (evDate >= ws && evDate <= we) {
      scrollToEl(container, section);
      section.querySelectorAll('.week-event-item').forEach(item => {
        if (item.dataset.evName === ev.name) {
          item.classList.add('week-event-flash');
          item.addEventListener('animationend', () => item.classList.remove('week-event-flash'), { once: true });
        }
      });
      break;
    }
  }
}

export function scrollToCalendarEvent(ev) {
  const evDate    = new Date(ev.startDate);
  const container = document.getElementById('calendarView');
  const cell      = container.querySelector(`.cal-month-cell[data-year-month="${evDate.getFullYear()}-${evDate.getMonth()}"]`);
  if (!cell) return;
  scrollToEl(container, cell);
  cell.querySelectorAll('.cal-event-item').forEach(item => {
    if (item.dataset.evName === ev.name) {
      item.classList.add('cal-event-flash');
      item.addEventListener('animationend', () => item.classList.remove('cal-event-flash'), { once: true });
    }
  });
}

export function navigateToEvent(ev, opts = {}) {
  // Back-compat: callers used to pass `true` as a second positional arg.
  if (opts === true) opts = { horizontalOnly: true };
  const { horizontalOnly = false, forwardOnly = false } = opts;
  const wrapper = document.getElementById('timelineWrapper');
  const bars    = document.querySelectorAll(`[data-ev-name="${ev.name.replace(/"/g, '\\"')}"]`);
  // For ongoing events, anchor on today's column instead of startDate so we
  // don't scroll the user months into the past just to find an active bar.
  const todayStr = todayLocalStr();
  const anchorDate = (ev.startDate <= todayStr && todayStr <= ev.endDate)
    ? todayStr
    : ev.startDate;
  let targetX = Math.max(0, dayOffset(anchorDate) * DAY_PX - wrapper.clientWidth * 0.25);
  // forwardOnly: never scroll horizontally backwards (used by promo rail
  // clicks, where scrolling back into the past would be disorienting).
  if (forwardOnly && targetX < wrapper.scrollLeft) {
    targetX = wrapper.scrollLeft;
  }

  let targetY = wrapper.scrollTop;
  if (!horizontalOnly && bars.length > 0) {
    const bar = bars[0];
    const row = bar.closest('.timeline-row');
    if (row) {
      const headerH     = 64;
      const barTopInRow = parseFloat(bar.style.top) || 0;
      const barCenter   = row.offsetTop + barTopInRow + BAR_H / 2;
      targetY = Math.max(0, barCenter - headerH - (wrapper.clientHeight - headerH) * 0.5);
    }
  }

  const startX = wrapper.scrollLeft;
  const startY = wrapper.scrollTop;
  const deltaX = targetX - startX;
  const deltaY = targetY - startY;
  const t0     = performance.now();
  const dur    = 1000;

  (function step(now) {
    const p    = Math.min((now - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 4);
    wrapper.scrollLeft = startX + deltaX * ease;
    wrapper.scrollTop  = startY + deltaY * ease;
    if (p < 1) requestAnimationFrame(step);
  })(performance.now());

  setTimeout(() => {
    bars.forEach(el => {
      el.classList.remove('bar-flash');
      void el.offsetWidth;
      el.classList.add('bar-flash');
      el.addEventListener('animationend', () => el.classList.remove('bar-flash'), { once: true });
    });
  }, 750);
}

export function navigateToWeekForEvent(ev) {
  setView('weekly');
  setTimeout(() => scrollToWeekEvent(ev), 120);
}

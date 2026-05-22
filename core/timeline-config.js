// ============================================================
//  TIMELINE CONFIG
// ============================================================

import { parseLocalDate } from './util.js';

// Layout constants and bounds for the horizontal timeline view. The
// bounds (`TIMELINE_START`, `TIMELINE_END`, `TOTAL_DAYS`, `TOTAL_W`) are
// reassigned by `computeTimelineBounds()` after data loads, so they're
// exported as `let` live bindings — importers automatically see the
// updated values via ES module semantics.

// Pixels per timeline day. 9 on mobile so the whole year fits, 18 on
// desktop where there's room to breathe.
export const DAY_PX  = window.innerWidth <= 768 ? 9 : 18;
export const BAR_H   = 29;
export const LANE_H  = 37;
export const ROW_PAD = 8;

export let TIMELINE_START;
export let TIMELINE_END;
export let TOTAL_DAYS;
export let TOTAL_W;

// Derives the visible window from the loaded tournaments. Called once
// from `init()` in app.js after `loadData()` populates `TOURNAMENTS`.
export function computeTimelineBounds(tournaments) {
  let minDate = null, maxDate = null;
  tournaments.forEach(ev => {
    const s = new Date(ev.startDate), e = new Date(ev.endDate);
    if (!minDate || s < minDate) minDate = s;
    if (!maxDate || e > maxDate) maxDate = e;
  });
  // Start: 1st of the earliest month.
  TIMELINE_START = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  // End: last day of the latest month.
  TIMELINE_END   = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
  TOTAL_DAYS     = Math.round((TIMELINE_END - TIMELINE_START) / 86400000);
  TOTAL_W        = TOTAL_DAYS * DAY_PX;
}

// Number of days between an event date and TIMELINE_START.
// Accepts either a YYYY-MM-DD string or a Date. Strings are parsed as LOCAL
// midnight (via parseLocalDate) to match TIMELINE_START — otherwise UTC
// parsing in non-UTC timezones (e.g. AU) makes dates land on the wrong day
// (e.g. May 31 ending up at the same offset as June 1).
export function dayOffset(dateOrDate) {
  const d = (typeof dateOrDate === 'string') ? parseLocalDate(dateOrDate) : dateOrDate;
  return Math.round((d - TIMELINE_START) / 86400000);
}

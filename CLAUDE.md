# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build system or package manager. Open `index.html` directly in a browser, or serve locally:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Architecture

Single-page vanilla JS app. No framework, no bundler, no dependencies beyond Font Awesome (CDN).

**File roles:**
- `data.js` — global constants only: `SPORT_COLORS`, `SPORT_ICONS`, `ESPORTS_LOGOS`, `getFlag()`. Loaded first so app.js can reference these globals.
- `app.js` — all application logic: data fetching, view rendering, filtering, sorting, search, scroll behaviour.
- `style.css` — all styling for all three views.
- `index.html` — static markup shell. Both view containers (`#mainView` for timeline, `#cwLayout` for calendar/weekly) are always in the DOM; `setView()` shows/hides them.
- `tournaments.csv` — reference snapshot only, not loaded by the app.

**Data source:** Tournament data is fetched at runtime from a published Google Sheets CSV (`SHEET_URL` in app.js). Edit the sheet to add/update events — do not edit `data.js` for tournament data.

**Data shape:** Each CSV row produces either a `TOURNAMENTS[]` entry or a `MATCHES[]` entry (when `format === 'match'`). Key `format` values: `tournament`, `season`, `event`, `race`, `onedayevent`, `match`. The `match` format is excluded from `TOURNAMENTS` and linked to a parent tournament by name. Esports rows carry a `game` field; `effectiveCategory(ev)` returns `"Esports (game)"` for these.

## Three views

| View | Container | Sidebar |
|------|-----------|---------|
| Timeline | `#mainView` | `#sidebarRows` — sortable by Sport/Country/A–Z, with sport/country filter panel; filters persisted to `localStorage` per sort mode (`mjr_filters_*`) |
| Calendar | `#calendarView` inside `#cwLayout` | `#cwLayout > .cw-sidebar` — filters by sport + country (not persisted) |
| Weekly | `#weeklyView` inside `#cwLayout` | same shared cw-sidebar |

`setView(view)` switches between them. Calendar and Weekly share `#cwLayout` and `buildCwSidebar()` / `cwFilters`.

## Key patterns

**Lane assignment** (`assignLanes`, `assignCountryLanes`): greedy left-to-right collision detection that packs overlapping tournament bars into horizontal lanes. Each event gets `_lane` (sport view) or `_cLane` (country view). Row height is derived from lane count.

**Timeline coordinate system:** `DAY_PX` pixels per day (9 on mobile, 18 on desktop). `dayOffset(dateStr)` returns days from `TIMELINE_START`. All bar positions are computed as `dayOffset * DAY_PX`.

**Date parsing:** Use `parseLocalDate(str)` (not `new Date(str)`) for YYYY-MM-DD strings to avoid UTC/local midnight mismatch when comparing against locally-constructed dates.

**Live sort mode:** Active tournaments are split into a "live" slice shown at the top; upcoming tournaments sorted by start date follow below. This split happens in `getSortedCatData()` and `getSortedCountryData()`.

**Match panel:** In the Weekly view, clicking a tournament with associated `MATCHES` entries opens a slide-in panel (`buildMatchPanel`). Only one match panel is open at a time (`_activeMatchTournament`).

## Version query strings

`index.html` references scripts and CSS with `?v=N` cache-busting suffixes. Bump the version number manually after significant changes:

```html
<link rel="stylesheet" href="style.css?v=43">
<script src="data.js?v=30"></script>
<script src="app.js?v=57"></script>
```

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `T` | Go to today |
| `S` | Focus search |
| `C` | Toggle calendar view |
| `Esc` | Scroll to start (timeline) |
